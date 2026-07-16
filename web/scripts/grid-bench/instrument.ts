// Injected into the page before any app code (addInitScript). Installs a global
// rAF loop that, while recording, samples frame intervals and how many grid
// cards are actually visible -- the blank-frame (reflow flash) detector the user
// asked for. Everything lives on window.__bench so the node driver reads it via
// page.evaluate.
//
// Shipped as a plain-JS source STRING (not a function reference): esbuild/tsx
// wraps named functions with a `__name` helper, so a serialized function passed
// to addInitScript throws ReferenceError in the browser and never installs.

export type BenchSummary = {
  frames: number
  durationMs: number
  janky: number // interval > 16.7ms
  dropped: number // interval > 33.3ms
  p50: number
  p95: number
  p99: number
  maxInterval: number
  blankFrames: number // frames with zero visible cards while items exist
  minVisible: number
  longestTaskMs: number
}

declare global {
  interface Window {
    __bench?: {
      start: () => void
      stop: () => BenchSummary
    }
  }
}

export const INSTRUMENT_SOURCE = String.raw`
(function () {
  if (window.__bench) return;
  var state = { recording: false, samples: [], longestTaskMs: 0 };

  function countVisible() {
    var nodes = document.querySelectorAll('[data-index]');
    if (nodes.length === 0) return -1; // no grid mounted; ignore
    var vw = window.innerWidth, vh = window.innerHeight, n = 0;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) n++;
    }
    return n;
  }

  function loop() {
    if (state.recording) {
      state.samples.push({ t: performance.now(), visible: countVisible() });
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  try {
    var po = new PerformanceObserver(function (list) {
      if (!state.recording) return;
      var es = list.getEntries();
      for (var i = 0; i < es.length; i++) {
        if (es[i].duration > state.longestTaskMs) state.longestTaskMs = es[i].duration;
      }
    });
    po.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // no longtask support (Firefox): frame + blank stats still work.
  }

  function pct(sorted, p) {
    if (!sorted.length) return 0;
    var i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[i] || 0;
  }
  function r10(x) { return Math.round(x * 10) / 10; }

  window.__bench = {
    start: function () {
      state.samples.length = 0;
      state.longestTaskMs = 0;
      state.recording = true;
    },
    stop: function () {
      state.recording = false;
      var s = state.samples, intervals = [], blank = 0, minVis = Infinity;
      for (var i = 0; i < s.length; i++) {
        if (i > 0) intervals.push(s[i].t - s[i - 1].t);
        if (s[i].visible === 0) blank++;
        if (s[i].visible >= 0) minVis = Math.min(minVis, s[i].visible);
      }
      var sorted = intervals.slice().sort(function (a, b) { return a - b; });
      return {
        frames: s.length,
        durationMs: s.length > 1 ? r10(s[s.length - 1].t - s[0].t) : 0,
        janky: intervals.filter(function (x) { return x > 16.7; }).length,
        dropped: intervals.filter(function (x) { return x > 33.3; }).length,
        p50: r10(pct(sorted, 50)),
        p95: r10(pct(sorted, 95)),
        p99: r10(pct(sorted, 99)),
        maxInterval: r10(Math.max.apply(null, [0].concat(intervals))),
        blankFrames: blank,
        minVisible: minVis === Infinity ? -1 : minVis,
        longestTaskMs: r10(state.longestTaskMs)
      };
    }
  };
})();
`
