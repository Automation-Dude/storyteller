// Panel Lab engine — grid, selection, detail panel, resize strategies,
// FLIP reflow + scroll anchoring. Vanilla JS; tweaks arrive via window.PanelLab.apply().

;(function () {
  const shell = document.getElementById("shell")
  const grid = document.getElementById("grid")
  const scroller = document.getElementById("gridScroll")
  const detail = document.getElementById("detail")
  const rz = document.getElementById("rz")
  const books = window.PL_BOOKS
  const coverFor = window.PL_coverFor

  const GAP_X = 18
  const PAD_X = 48 // grid horizontal padding total
  const MIN_W = 300
  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches

  const state = {
    tw: {
      theme: "paper",
      sep: "tone",
      navDark: false,
      resize: "fluid",
      motion: 1,
      keepInView: true,
      cardMin: 170,
    },
    open: false,
    panelW: 0, // applied width right now
    targetW: 384, // width when open (persists across open/close)
    cols: 0,
    selected: -1,
    cards: [],
    anims: new Map(), // el -> running FLIP Animation
    openAnim: 0, // rAF id
  }

  // ── build cards ─────────────────────────────────────────────
  const frag = document.createDocumentFragment()
  books.forEach((b, i) => {
    const el = document.createElement("div")
    el.className = "card"
    el.dataset.i = i
    el.innerHTML =
      '<div class="coverbox"><img alt="" draggable="false"></div>' +
      '<div class="meta">' +
      (b.rating != null
        ? '<span class="rt"><span class="heart">\u2665</span>' +
          b.rating.toFixed(2) +
          "</span>"
        : '<span class="rt">\u2014</span>') +
      '<div class="ttl">' +
      b.title +
      "</div>" +
      '<div class="auth">' +
      b.author +
      "</div>" +
      "</div>"
    frag.appendChild(el)
    state.cards.push(el)
  })
  grid.appendChild(frag)

  // lazy covers
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const img = e.target.querySelector("img")
          if (!img.src) img.src = coverFor(books[+e.target.dataset.i])
          io.unobserve(e.target)
        }
      }
    },
    { root: scroller, rootMargin: "900px" },
  )
  state.cards.forEach((el) => io.observe(el))

  // ── column math ─────────────────────────────────────────────
  function gridContentW() {
    return scroller.clientWidth - PAD_X
  }
  function colsFor(w) {
    return Math.max(1, Math.floor((w + GAP_X) / (state.tw.cardMin + GAP_X)))
  }
  function setColsStyle(n) {
    grid.style.gridTemplateColumns = "repeat(" + n + ", minmax(0, 1fr))"
    state.cols = n
  }

  // ── visible range (cards are in row-major order; offsetTop is monotonic) ──
  function visibleRange(buffer) {
    const top = scroller.scrollTop - buffer
    const bot = scroller.scrollTop + scroller.clientHeight + buffer
    const cards = state.cards
    let lo = 0,
      hi = cards.length - 1,
      first = cards.length
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (cards[mid].offsetTop + 300 >= top) {
        first = mid
        hi = mid - 1
      } else lo = mid + 1
    }
    let last = first
    while (last < cards.length && cards[last].offsetTop <= bot) last += 12
    return [Math.max(0, first - 1), Math.min(cards.length - 1, last)]
  }

  function pickAnchor() {
    const selEl = state.cards[state.selected]
    if (selEl) {
      const t = selEl.offsetTop,
        st = scroller.scrollTop
      if (t + 40 > st && t < st + scroller.clientHeight) return selEl
    }
    const [lo, hi] = visibleRange(0)
    for (let i = lo; i <= hi; i++) {
      if (state.cards[i].offsetTop >= scroller.scrollTop - 40)
        return state.cards[i]
    }
    return null
  }

  // ── FLIP reflow to a new column count ───────────────────────
  function flipReflow(newCols, animate) {
    const doAnim = animate && !reduced && state.tw.motion > 0
    let before = null,
      lo = 0,
      hi = -1
    if (doAnim) {
      ;[lo, hi] = visibleRange(700)
      before = []
      for (let i = lo; i <= hi; i++) {
        before.push([state.cards[i], state.cards[i].getBoundingClientRect()])
      }
    }
    const anchor = state.tw.keepInView ? pickAnchor() : null
    const aY = anchor ? anchor.offsetTop - scroller.scrollTop : 0

    setColsStyle(newCols)

    if (anchor) scroller.scrollTop = Math.max(0, anchor.offsetTop - aY)

    if (doAnim) {
      const dur = 240 * state.tw.motion
      for (const [el, r0] of before) {
        const old = state.anims.get(el)
        if (old) old.cancel()
        const r1 = el.getBoundingClientRect()
        const dx = r0.left - r1.left,
          dy = r0.top - r1.top
        if (Math.abs(dx) + Math.abs(dy) > 1) {
          const a = el.animate(
            [
              { transform: "translate(" + dx + "px," + dy + "px)" },
              { transform: "none" },
            ],
            { duration: dur, easing: EASE },
          )
          state.anims.set(el, a)
          a.onfinish = a.oncancel = () => {
            if (state.anims.get(el) === a) state.anims.delete(el)
          }
        }
      }
    }
  }

  function maybeReflow(animate) {
    const n = colsFor(gridContentW())
    if (n !== state.cols) flipReflow(n, animate)
  }

  // ── panel width application ─────────────────────────────────
  // frame-level scroll anchoring during continuous width changes
  let holdAnchor = null,
    holdY = 0
  function grabAnchor() {
    holdAnchor = state.tw.keepInView ? pickAnchor() : null
    if (holdAnchor) holdY = holdAnchor.offsetTop - scroller.scrollTop
  }
  function holdAnchorNow() {
    if (holdAnchor)
      scroller.scrollTop = Math.max(0, holdAnchor.offsetTop - holdY)
  }

  function applyWidth(w, live) {
    state.panelW = w
    detail.style.width = w + "px"
    if (live) {
      if (state.tw.resize !== "fluid") maybeReflow(true)
      holdAnchorNow()
    }
  }

  // ── open / close animation (rAF-driven so strategies apply) ──
  function animatePanel(to, done) {
    cancelAnimationFrame(state.openAnim)
    const from = state.panelW
    if (reduced || state.tw.motion === 0) {
      applyWidth(to, false)
      maybeReflow(false)
      holdAnchorNow()
      if (done) done()
      return
    }
    const dur = 360 * state.tw.motion
    const t0 = performance.now()
    grabAnchor()
    function tick(now) {
      const p = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3) // easeOutCubic
      applyWidth(from + (to - from) * e, true)
      if (p < 1) state.openAnim = requestAnimationFrame(tick)
      else {
        if (state.tw.resize === "fluid") {
          maybeReflow(true)
          holdAnchorNow()
        }
        holdAnchor = null
        if (done) done()
      }
    }
    state.openAnim = requestAnimationFrame(tick)
  }

  // ── selection ───────────────────────────────────────────────
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card")
    if (!card) return
    select(+card.dataset.i)
  })

  function select(i) {
    const prev = state.cards[state.selected]
    if (prev) prev.classList.remove("selected")
    state.selected = i
    state.cards[i].classList.add("selected")
    renderDetail(books[i])
    if (!state.open) {
      state.open = true
      shell.classList.add("panel-open")
      animatePanel(state.targetW)
    }
  }

  function closePanel() {
    if (!state.open) return
    state.open = false
    const prev = state.cards[state.selected]
    if (prev) prev.classList.remove("selected")
    state.selected = -1
    animatePanel(0, () => shell.classList.remove("panel-open"))
  }
  document.getElementById("dClose").addEventListener("click", closePanel)
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel()
  })

  // ── detail rendering ────────────────────────────────────────
  function hearts(r) {
    if (r == null) return '<span class="off">not rated yet</span>'
    let h = ""
    for (let i = 1; i <= 5; i++) {
      h +=
        '<span class="' + (i <= Math.round(r) ? "" : "off") + '">\u2665</span>'
    }
    return h
  }
  const DESCS = [
    "A patient, closely observed story that trades spectacle for accumulation — small scenes gathering weight until the ending lands quietly and completely.",
    "Told across one long season, this is a book about the distance between what people say and what they mean, written in prose that rewards slow reading.",
    "Equal parts field notes and confession, it circles its subject with dry humour and an unexpectedly tender final third.",
    "A deceptively simple premise unfolds into something stranger — a book that keeps revising what kind of book it is, without ever losing its footing.",
  ]
  function renderDetail(b) {
    document.getElementById("dCover").src = coverFor(b)
    document.getElementById("dTitle").textContent = b.title
    document.getElementById("dAuthor").textContent = b.author
    document.getElementById("dMeta").textContent =
      b.pages + " pages \u00b7 " + b.year
    document.getElementById("dHearts").innerHTML = hearts(b.rating)
    document.getElementById("dDesc").textContent =
      DESCS[(b.title.length + b.year) % DESCS.length]
    document.getElementById("dRows").innerHTML =
      '<div class="d-row"><span class="k">Author</span><span class="v">' +
      b.author +
      "</span></div>" +
      '<div class="d-row"><span class="k">Published</span><span class="v">' +
      b.year +
      "</span></div>" +
      '<div class="d-row"><span class="k">Pages</span><span class="v">' +
      b.pages +
      "</span></div>" +
      '<div class="d-row"><span class="k">Format</span><span class="v">' +
      (b.audio ? "Ebook + audiobook" : "Ebook") +
      "</span></div>" +
      '<div class="d-row"><span class="k">Tag</span><span class="v">' +
      b.tag +
      "</span></div>"
  }

  // ── resize drag ─────────────────────────────────────────────
  let drag = null // {startX, startW, raw, applied, rafOn}
  rz.addEventListener("pointerdown", (e) => {
    if (!state.open) return
    e.preventDefault()
    rz.setPointerCapture(e.pointerId)
    cancelAnimationFrame(state.openAnim)
    drag = {
      startX: e.clientX,
      startW: state.panelW,
      raw: state.panelW,
      applied: state.panelW,
    }
    shell.classList.add("resizing")
    grabAnchor()
    if (state.tw.resize === "snap") snapLoop()
  })
  rz.addEventListener("pointermove", (e) => {
    if (!drag) return
    const maxW = Math.min(720, shell.clientWidth * 0.45)
    drag.raw = Math.max(
      MIN_W,
      Math.min(maxW, drag.startW + (drag.startX - e.clientX)),
    )
    if (state.tw.resize === "snap") return // snapLoop applies it
    applyWidth(drag.raw, true)
  })
  function endDrag() {
    if (!drag) return
    drag = null
    shell.classList.remove("resizing")
    if (state.tw.resize === "fluid") {
      maybeReflow(true)
      holdAnchorNow()
    }
    if (state.tw.resize === "snap") applyWidth(snapTarget(state.panelW), true)
    state.targetW = state.panelW
    holdAnchor = null
  }
  rz.addEventListener("pointerup", endDrag)
  rz.addEventListener("pointercancel", endDrag)

  // snap: magnetic pull toward widths where the column count changes
  function snapTarget(raw) {
    const m = state.tw.cardMin,
      g = GAP_X
    const gw = gridContentW() + (state.panelW - raw) // grid width at raw
    const k = colsFor(gw)
    // panel widths at which the grid holds exactly k / k+1 columns tightly
    const cur = state.panelW + gridContentW() - (k * (m + g) - g)
    const next = state.panelW + gridContentW() - ((k + 1) * (m + g) - g)
    let best = raw
    for (const b of [cur, next]) {
      if (Math.abs(raw - b) < 30 && Math.abs(raw - b) < Math.abs(raw - best))
        best = b
    }
    return best
  }
  function snapLoop() {
    if (!drag) return
    const target = snapTarget(drag.raw)
    drag.applied += (target - drag.applied) * 0.32
    if (Math.abs(target - drag.applied) < 0.5) drag.applied = target
    applyWidth(drag.applied, true)
    requestAnimationFrame(snapLoop)
  }

  // ── tweaks ──────────────────────────────────────────────────
  const THEME_KEY = {
    "Warm paper": "paper",
    Porcelain: "porcelain",
    Linen: "linen",
    "Charcoal (dark)": "charcoal",
  }
  const SEP_KEY = {
    "Tone steps": "tone",
    Floating: "float",
    Hairlines: "hairline",
  }
  const RESIZE_KEY = {
    "Fluid scale": "fluid",
    "Live reflow": "reflow",
    "Magnetic snap": "snap",
  }

  window.PanelLab = {
    apply(t) {
      const tw = state.tw
      tw.theme = THEME_KEY[t.theme] || tw.theme
      tw.sep = SEP_KEY[t.sep] || tw.sep
      tw.resize = RESIZE_KEY[t.resize] || tw.resize
      tw.navDark = !!t.navDark
      tw.motion = t.motion
      tw.keepInView = !!t.keepInView
      shell.dataset.theme = tw.theme
      shell.dataset.sep = tw.sep
      shell.dataset.navdark = tw.navDark
      document.documentElement.style.setProperty("--dur", tw.motion)
      const minChanged = tw.cardMin !== t.cardMin
      tw.cardMin = t.cardMin
      maybeReflow(minChanged)
    },
  }

  addEventListener("resize", () => maybeReflow(false))

  // ── init ────────────────────────────────────────────────────
  // ResizeObserver handles first layout too (iframe may be 0-wide at parse time).
  new ResizeObserver(() => {
    if (gridContentW() > 0) maybeReflow(false)
  }).observe(scroller)
  if (gridContentW() > 0) setColsStyle(colsFor(gridContentW()))
})()
