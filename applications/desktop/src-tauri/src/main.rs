#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};

use anyhow::{anyhow, Context, Result};
use tauri::{path::BaseDirectory, Emitter, Manager, RunEvent};

struct ServerState {
    child: Mutex<Option<Child>>,
    shutting_down: Mutex<bool>,
    server_url: Mutex<Option<String>>,
}

const HEALTH_TIMEOUT: Duration = Duration::from_secs(120);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .manage(ServerState {
            child: Mutex::new(None),
            shutting_down: Mutex::new(false),
            server_url: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![set_titlebar_color])
        .setup(|app| {
            setup_menu(app.handle())?;

            // match the splash background until the web app takes over
            if let Some(window) = app.get_webview_window("main") {
                set_window_background(&window, 0.078, 0.063, 0.051);
            }

            // in dev the window points straight at the next dev server
            // (build.devUrl); set STORYTELLER_DESKTOP_BOOT=1 to exercise the
            // full boot flow from a debug build
            let dev_skip =
                cfg!(debug_assertions) && std::env::var("STORYTELLER_DESKTOP_BOOT").is_err();
            if !dev_skip {
                let handle = app.handle().clone();
                std::thread::spawn(move || boot(handle));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                stop_server(app.state::<ServerState>().inner());
            }
        });
}

/// the webview has no browser chrome, so back/forward/reload live in the
/// native menu (with the usual browser accelerators); appended to the default
/// menu so Edit/copy-paste etc. stay intact
fn setup_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

    let menu = Menu::default(app)?;
    let history = Submenu::with_items(
        app,
        "History",
        true,
        &[
            &MenuItem::with_id(app, "nav-back", "Back", true, Some("CmdOrCtrl+BracketLeft"))?,
            &MenuItem::with_id(
                app,
                "nav-forward",
                "Forward",
                true,
                Some("CmdOrCtrl+BracketRight"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "nav-reload", "Reload Page", true, Some("CmdOrCtrl+R"))?,
            &MenuItem::with_id(
                app,
                "nav-home",
                "Go to Library",
                true,
                Some("CmdOrCtrl+Shift+H"),
            )?,
        ],
    )?;
    menu.append(&history)?;
    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        match event.id().as_ref() {
            "nav-back" => {
                let _ = window.eval("history.back()");
            }
            "nav-forward" => {
                let _ = window.eval("history.forward()");
            }
            "nav-reload" => {
                let _ = window.eval("location.reload()");
            }
            "nav-home" => {
                let url = app
                    .state::<ServerState>()
                    .server_url
                    .lock()
                    .unwrap()
                    .clone();
                if let Some(url) = url {
                    let _ = navigate(app, &url);
                }
            }
            _ => {}
        }
    });
    Ok(())
}

/// the web app calls this (via @tauri-apps/api invoke) with the resolved
/// sidebar color so the transparent native title bar always matches the ui,
/// including theme switches
#[tauri::command]
fn set_titlebar_color(window: tauri::WebviewWindow, red: f64, green: f64, blue: f64) {
    set_window_background(&window, red, green, blue);
}

/// with titleBarStyle Transparent the macOS title bar shows the NSWindow
/// background color; other platforms keep their native chrome for now
fn set_window_background(window: &tauri::WebviewWindow, red: f64, green: f64, blue: f64) {
    #[cfg(target_os = "macos")]
    {
        let Ok(ns_window_ptr) = window.ns_window() else {
            return;
        };
        let ns_window_ptr = ns_window_ptr as usize;
        let _ = window.run_on_main_thread(move || {
            use objc2_app_kit::{NSColor, NSWindow};
            unsafe {
                let ns_window = &*(ns_window_ptr as *const NSWindow);
                let color = NSColor::colorWithSRGBRed_green_blue_alpha(red, green, blue, 1.0);
                ns_window.setBackgroundColor(Some(&color));
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, red, green, blue);
    }
}

fn boot(app: tauri::AppHandle) {
    if let Err(err) = boot_inner(&app) {
        emit_status(&app, "error", &format!("{err:#}"));
    }
}

fn boot_inner(app: &tauri::AppHandle) -> Result<()> {
    // attach to an externally managed server instead of spawning one
    if let Ok(url) = std::env::var("STORYTELLER_DESKTOP_SERVER_URL") {
        *app.state::<ServerState>().server_url.lock().unwrap() = Some(url.clone());
        return navigate(app, &url);
    }

    let app_data = app.path().app_data_dir().context("no app data directory")?;
    let data_dir = app_data.join("data");
    fs::create_dir_all(&data_dir)?;

    emit_status(app, "extracting", "Preparing application files…");
    let runtime_dir = ensure_runtime(app, &app_data)?;

    let secret_file = ensure_secret(&app_data)?;

    let port = resolve_port(&app_data)?;
    let readium_port = pick_port(8757);

    emit_status(app, "starting", "Starting Storyteller…");
    let log_path = app_data.join("server.log");
    spawn_server(
        app,
        &runtime_dir,
        &data_dir,
        &secret_file,
        &log_path,
        port,
        readium_port,
    )?;

    let deadline = Instant::now() + HEALTH_TIMEOUT;
    loop {
        if http_ok(port, "/api/health") {
            break;
        }
        if let Some(status) = server_exit_status(app) {
            return Err(anyhow!(
                "the server exited unexpectedly ({status})\n\n{}",
                log_tail(&log_path)
            ));
        }
        if Instant::now() >= deadline {
            stop_server(app.state::<ServerState>().inner());
            return Err(anyhow!(
                "the server did not become healthy within {}s\n\n{}",
                HEALTH_TIMEOUT.as_secs(),
                log_tail(&log_path)
            ));
        }
        std::thread::sleep(Duration::from_millis(300));
    }

    let url = format!("http://127.0.0.1:{port}");
    *app.state::<ServerState>().server_url.lock().unwrap() = Some(url.clone());
    navigate(app, &url)
}

/// port preference order: STORYTELLER_DESKTOP_PORT env, then "port" in
/// app_data/desktop.json, then 8756 with an ephemeral fallback. a pinned port
/// that is already taken is a hard error rather than a silent fallback.
fn resolve_port(app_data: &Path) -> Result<u16> {
    let config_path = app_data.join("desktop.json");
    let pinned = match std::env::var("STORYTELLER_DESKTOP_PORT") {
        Ok(value) => Some((
            value
                .parse::<u16>()
                .context("STORYTELLER_DESKTOP_PORT is not a valid port")?,
            "STORYTELLER_DESKTOP_PORT".to_string(),
        )),
        Err(_) => match fs::read_to_string(&config_path) {
            Ok(raw) => {
                let config: serde_json::Value = serde_json::from_str(&raw)
                    .with_context(|| format!("invalid json in {}", config_path.display()))?;
                match config.get("port") {
                    Some(value) => {
                        let port = value
                            .as_u64()
                            .and_then(|p| u16::try_from(p).ok())
                            .with_context(|| {
                                format!("invalid \"port\" in {}", config_path.display())
                            })?;
                        Some((port, format!("\"port\" in {}", config_path.display())))
                    }
                    None => None,
                }
            }
            Err(_) => None,
        },
    };

    match pinned {
        Some((port, source)) => {
            if TcpListener::bind(("127.0.0.1", port)).is_err() {
                return Err(anyhow!(
                    "port {port} (from {source}) is already in use — free it or pick another"
                ));
            }
            Ok(port)
        }
        None => Ok(pick_port(8756)),
    }
}

fn emit_status(app: &tauri::AppHandle, state: &str, message: &str) {
    let _ = app.emit(
        "boot-status",
        serde_json::json!({ "state": state, "message": message }),
    );
}

fn navigate(app: &tauri::AppHandle, url: &str) -> Result<()> {
    let window = app
        .get_webview_window("main")
        .context("main window missing")?;
    let parsed = url.parse().context("invalid server url")?;
    window.navigate(parsed).context("navigation failed")?;
    Ok(())
}

/// extract the bundled runtime tarball into app_data/runtime/<id> once per
/// build; the id is a hash of the tarball produced by assemble-runtime.ts
fn ensure_runtime(app: &tauri::AppHandle, app_data: &Path) -> Result<PathBuf> {
    if let Ok(dir) = std::env::var("STORYTELLER_DESKTOP_RUNTIME_DIR") {
        return Ok(PathBuf::from(dir));
    }

    let id = fs::read_to_string(
        app.path()
            .resolve("resources/runtime-id", BaseDirectory::Resource)?,
    )
    .context("bundled runtime-id resource missing")?;
    let id = id.trim();

    let runtimes = app_data.join("runtime");
    let dest = runtimes.join(id);
    if !dest.join("applications/web/server.js").exists() {
        let tarball = app
            .path()
            .resolve("resources/runtime.tar.gz", BaseDirectory::Resource)?;
        let tmp = runtimes.join(format!("{id}.partial"));
        if tmp.exists() {
            fs::remove_dir_all(&tmp)?;
        }
        fs::create_dir_all(&tmp)?;
        let file = fs::File::open(&tarball).context("bundled runtime tarball missing")?;
        let decoder = flate2::read::GzDecoder::new(std::io::BufReader::new(file));
        let mut archive = tar::Archive::new(decoder);
        archive.set_preserve_permissions(true);
        for entry in archive.entries().context("runtime extraction failed")? {
            let mut entry = entry.context("runtime extraction failed")?;
            // skip macOS AppleDouble metadata entries: extracted as real
            // files they'd be picked up by directory scans (e.g. migrations)
            let is_appledouble = entry
                .path()
                .context("runtime extraction failed")?
                .file_name()
                .map(|name| name.to_string_lossy().starts_with("._"))
                .unwrap_or(false);
            if is_appledouble {
                continue;
            }
            entry.unpack_in(&tmp).context("runtime extraction failed")?;
        }
        if dest.exists() {
            fs::remove_dir_all(&dest)?;
        }
        fs::rename(&tmp, &dest)?;
    }

    // drop runtimes from previous app versions
    if let Ok(entries) = fs::read_dir(&runtimes) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy() != id {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }

    Ok(dest)
}

fn ensure_secret(app_data: &Path) -> Result<PathBuf> {
    let secret_file = app_data.join("secret.key");
    if !secret_file.exists() {
        use rand::RngCore;
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
        fs::write(&secret_file, hex)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&secret_file, fs::Permissions::from_mode(0o600))?;
        }
    }
    Ok(secret_file)
}

fn pick_port(preferred: u16) -> u16 {
    if TcpListener::bind(("127.0.0.1", preferred)).is_ok() {
        return preferred;
    }
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(preferred)
}

fn spawn_server(
    app: &tauri::AppHandle,
    runtime_dir: &Path,
    data_dir: &Path,
    secret_file: &Path,
    log_path: &Path,
    port: u16,
    readium_port: u16,
) -> Result<()> {
    let exe_dir = std::env::current_exe()?
        .parent()
        .context("no exe dir")?
        .to_path_buf();
    let node = exe_dir.join(exe_name("node"));
    if !node.exists() {
        return Err(anyhow!(
            "node sidecar missing at {} — was fetch-binaries run before bundling?",
            node.display()
        ));
    }

    let web_dir = runtime_dir.join("applications").join("web");

    // sidecar dir first so the server finds readium/ffmpeg/ffprobe
    let mut path_entries = vec![exe_dir.clone()];
    if let Some(existing) = std::env::var_os("PATH") {
        path_entries.extend(std::env::split_paths(&existing));
    }
    let path_var = std::env::join_paths(path_entries)?;

    let log = fs::File::create(log_path)?;

    let mut cmd = Command::new(&node);
    // scrub ambient server config (a terminal launch inherits the shell env,
    // including direnv-exported dev vars) so only what we set below applies
    for (key, _) in std::env::vars_os() {
        let key_str = key.to_string_lossy();
        if key_str.starts_with("STORYTELLER_")
            || key_str.starts_with("NEXT_")
            || key_str.starts_with("AUTH_")
            || matches!(
                key_str.as_ref(),
                "PORT"
                    | "HOSTNAME"
                    | "NODE_ENV"
                    | "NODE_OPTIONS"
                    | "READIUM_PORT"
                    | "SQLITE_NATIVE_BINDING"
                    | "ERROR_ALIGN_NATIVE_BINDING"
            )
        {
            cmd.env_remove(key);
        }
    }
    cmd.arg("--enable-source-maps")
        .arg(web_dir.join("server.js"))
        .current_dir(&web_dir)
        .env("PATH", path_var)
        .env("NODE_ENV", "production")
        .env("NEXT_TELEMETRY_DISABLED", "1")
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("READIUM_PORT", readium_port.to_string())
        .env("STORYTELLER_DATA_DIR", data_dir)
        .env("STORYTELLER_SECRET_KEY_FILE", secret_file)
        .env("STORYTELLER_WORKER", "worker.mjs")
        .env("STORYTELLER_FILE_WRITE_WORKER", "fileWriteWorker.mjs")
        .env(
            "ERROR_ALIGN_NATIVE_BINDING",
            web_dir
                .join("work-dist")
                .join("@storyteller-platform")
                .join("align"),
        )
        .env(
            "SQLITE_NATIVE_BINDING",
            runtime_dir
                .join("node_modules")
                .join("better-sqlite3")
                .join("build")
                .join("Release")
                .join("better_sqlite3.node"),
        )
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone()?))
        .stderr(Stdio::from(log));

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn().context("failed to spawn server")?;
    *app.state::<ServerState>().child.lock().unwrap() = Some(child);
    Ok(())
}

fn exe_name(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

fn server_exit_status(app: &tauri::AppHandle) -> Option<String> {
    let state = app.state::<ServerState>();
    let mut guard = state.child.lock().unwrap();
    let child = guard.as_mut()?;
    match child.try_wait() {
        Ok(Some(status)) => Some(status.to_string()),
        _ => None,
    }
}

/// terminate gracefully so the server can stop readium and close sqlite;
/// SIGKILL only after a timeout
fn stop_server(state: &ServerState) {
    {
        let mut shutting_down = state.shutting_down.lock().unwrap();
        if *shutting_down {
            return;
        }
        *shutting_down = true;
    }
    let Some(mut child) = state.child.lock().unwrap().take() else {
        return;
    };

    #[cfg(unix)]
    unsafe {
        libc::kill(child.id() as libc::pid_t, libc::SIGTERM);
    }
    #[cfg(windows)]
    {
        // no SIGTERM on windows; kill the whole tree so readium doesn't orphan
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .status();
    }

    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            _ if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                break;
            }
            _ => std::thread::sleep(Duration::from_millis(200)),
        }
    }
}

/// minimal http health probe; avoids pulling in an http client crate
fn http_ok(port: u16, path: &str) -> bool {
    let addr = match format!("127.0.0.1:{port}").parse() {
        Ok(addr) => addr,
        Err(_) => return false,
    };
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_secs(2)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let request =
        format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 32];
    let Ok(n) = stream.read(&mut buf) else {
        return false;
    };
    String::from_utf8_lossy(&buf[..n]).contains(" 200 ")
}

fn log_tail(log_path: &Path) -> String {
    let Ok(content) = fs::read_to_string(log_path) else {
        return format!("(no server log at {})", log_path.display());
    };
    let tail: Vec<&str> = content.lines().rev().take(30).collect();
    let tail: Vec<&str> = tail.into_iter().rev().collect();
    format!(
        "Last log lines ({}):\n{}",
        log_path.display(),
        tail.join("\n")
    )
}
