// Hero demo: a copy of the app's match screen playing a scripted duel. Colours, sizes and chart rules follow lib/ui.dart and
// lib/chart/chart_painter.dart. Every number here is made up for illustration.
(function () {
  var cv = document.getElementById('chart');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var C = { bg: '#0c0c0d', panel: '#1c1c1e', line: '#2e2e31', text: '#f2f2f2', dim: '#9c9ca3', accent: '#ff4a1c' };
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
  var N = 120, STEP = 120, HOLD = 3200, START = 10000, MARGIN = 2000, LEV = 3, AXIS = 66, HEADROOM = 2.5;

  // Price path. Segments of drift make the swings the trades below ride.
  var seed = 11;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function gauss() { return (rnd() + rnd() + rnd() - 1.5) * 1.6; }
  function drift(i) { return i < 18 ? -0.45 : i < 42 ? 0.9 : i < 46 ? 0 : i < 62 ? -0.9 : i < 66 ? 0 : i < 84 ? -0.28 : i < 92 ? 0.1 : 0.75; }
  var candles = [], p = 36400;
  for (var i = 0; i < N; i++) {
    var o = p, c = o * (1 + drift(i) * 0.0011 + gauss() * 0.0013);
    candles.push({ o: o, c: c, h: Math.max(o, c) * (1 + rnd() * 0.0007), l: Math.min(o, c) * (1 - rnd() * 0.0007) });
    p = c;
  }
  var mine = [{ side: 1, open: 18, close: 42 }, { side: -1, open: 46, close: 62 }, { side: 1, open: 66, close: 84 }, { side: 1, open: 92, close: null }];
  var theirs = [{ side: 1, open: 14, close: 38 }, { side: -1, open: 50, close: 70 }, { side: 1, open: 76, close: 100 }, { side: -1, open: 106, close: null }];
  var pnl = function (t, price) { return t.side * MARGIN * LEV * (price / candles[t.open].c - 1); };
  function equity(ts, i) {
    var v = START, open = null;
    ts.forEach(function (t) {
      if (i < t.open) return;
      if (t.close !== null && i >= t.close) v += pnl(t, candles[t.close].c);
      else { v += pnl(t, candles[i].c); open = t; }
    });
    return { v: v, open: open };
  }

  // Formats from lib/ui.dart: U+2212 for minus, thousands commas.
  function money(x, d) {
    d = d === undefined ? 2 : d;
    var s = Math.abs(x).toFixed(d).split('.'), w = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (x < 0 && +Math.abs(x).toFixed(d) !== 0 ? '−' : '') + w + (s[1] ? '.' + s[1] : '');
  }
  var signed = function (x) { return (x >= 0 ? '+' : '') + money(x); };
  var pct = function (r) { return (r >= 0 ? '+' : '−') + Math.abs(r * 100).toFixed(2) + '%'; };
  var priceText = function (v) { return money(v, v >= 10000 ? 1 : v >= 100 ? 2 : 3); };

  // Eased on-screen values, like the app's rolling numbers.
  var shown = {};
  function ease(key, target, k) {
    var v = shown[key] === undefined ? target : shown[key];
    v += (target - v) * k; if (Math.abs(target - v) < 0.005) v = target;
    return (shown[key] = v);
  }
  var yMin, yMax, born, fired, acc, hold, last, closing;
  function reset() { closing = null; shown = {}; yMin = yMax = undefined; born = {}; fired = -1; acc = 0; hold = 0; $('btn-long').className = $('btn-short').className = 'btn'; }
  reset();

  function press(el) { el.classList.add('down'); setTimeout(function () { el.classList.remove('down'); }, 150); }
  function events(idx) {
    for (var i = fired + 1; i <= idx; i++) {
      mine.forEach(function (t) {
        if (t.open === i) { press($(t.side > 0 ? 'btn-long' : 'btn-short')); born['m' + t.open] = acc; }
        if (t.close === i) { press($('card')); closing = { t: t, until: acc + 320 }; }
      });
      theirs.forEach(function (t) { if (t.open === i) born['r' + t.open] = acc; });
    }
    fired = idx;
  }

  function draw(head) {
    var idx = Math.min(N - 1, Math.floor(head));
    var w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var plot = { top: 14, bottom: h - 6, right: w - AXIS };
    var vis = Math.max(30, Math.round(plot.right / 5.2)), cw = plot.right / vis;
    var X = function (i) { return plot.right - (head - i + 0.5 + HEADROOM) * cw; };
    var first = Math.max(0, Math.floor(head - vis - 1)), lastI = idx;
    var lo = Infinity, hi = -Infinity;
    for (var i = first; i <= lastI; i++) { lo = Math.min(lo, candles[i].l); hi = Math.max(hi, candles[i].h); }
    var span = Math.max(hi - lo, lo * 0.002), tMin = lo - span * 0.1, tMax = hi + span * 0.1;
    if (yMin === undefined) { yMin = tMin; yMax = tMax; } else { yMin += (tMin - yMin) * 0.12; yMax += (tMax - yMax) * 0.12; }
    var Y = function (v) { return plot.top + (yMax - v) / (yMax - yMin) * (plot.bottom - plot.top); };
    var now = candles[idx], py = Y(now.c);

    // Grid and axis labels
    var raw = (yMax - yMin) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
    ctx.font = '600 11px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (var g = Math.ceil(yMin / step) * step; g < yMax; g += step) {
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Y(g)); ctx.lineTo(plot.right, Y(g)); ctx.stroke();
      if (Math.abs(Y(g) - py) < 16) continue;
      ctx.fillStyle = C.dim; ctx.fillText(money(g, step >= 1 ? 0 : step >= 0.1 ? 1 : 2), plot.right + 8, Y(g));
    }

    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, plot.right, h); ctx.clip();
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(plot.right, py); ctx.stroke(); // live price level

    // Candles: up is hollow and bright, down is solid and dim.
    var bw = cw * 0.68;
    for (i = first; i <= lastI; i++) {
      var k = candles[i], up = k.c >= k.o, col = up ? C.text : C.dim, cx = X(i);
      var top = Y(Math.max(k.o, k.c)), bot = Math.max(Y(Math.min(k.o, k.c)), top + 1);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, cw * 0.12);
      ctx.beginPath(); ctx.moveTo(cx, Y(k.h)); ctx.lineTo(cx, Y(k.l)); ctx.stroke();
      if (up && bw >= 3) {
        ctx.fillStyle = C.bg; ctx.fillRect(cx - bw / 2, top, bw, bot - top);
        ctx.lineWidth = 1; ctx.strokeRect(cx - bw / 2 + 0.5, top + 0.5, bw - 1, Math.max(bot - top - 1, 0));
      } else { ctx.fillStyle = col; ctx.fillRect(cx - bw / 2, top, bw, bot - top); }
    }

    // Trades: mine solid accent, the opponent's hollow. Exit signs: + profit, - loss.
    function trades(ts, isMine) {
      ts.forEach(function (t) {
        if (t.open > idx) return;
        var color = isMine ? C.accent : C.text, ex = X(t.open), ey = Y(candles[t.open].c);
        ctx.lineWidth = 1.5; ctx.strokeStyle = isMine ? C.accent : C.dim;
        if (t.close !== null && t.close <= idx) {
          var xx = X(t.close), xy = Y(candles[t.close].c), win = pnl(t, candles[t.close].c) >= 0;
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(xx, xy); ctx.stroke();
          ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(xx, xy, 7, 0, 6.2832); ctx.fill();
          ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xx - 5, xy); ctx.lineTo(xx + 5, xy);
          if (win) { ctx.moveTo(xx, xy - 5); ctx.lineTo(xx, xy + 5); } ctx.stroke();
        } else if (isMine) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(plot.right, ey); ctx.stroke(); }
        var b = born[(isMine ? 'm' : 'r') + t.open], tt = b === undefined ? 1 : Math.min(1, (acc - b) / 350);
        var r = 7 * (1 + (1 - (1 - Math.pow(1 - tt, 3))) * 1.4), d = t.side * r;
        ctx.beginPath(); ctx.moveTo(ex, ey - d); ctx.lineTo(ex - r, ey + d); ctx.lineTo(ex + r, ey + d); ctx.closePath();
        ctx.fillStyle = isMine ? color : C.bg; ctx.fill();
        if (!isMine) { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineJoin = 'miter'; }
      });
    }
    trades(theirs, false); trades(mine, true);
    ctx.restore();

    // Live price tag on the axis, inverted like the app's.
    ctx.fillStyle = C.text; ctx.fillRect(plot.right + 3, py - 10, AXIS - 5, 20);
    ctx.fillStyle = C.bg; ctx.font = '700 11px ' + FONT; ctx.fillText(priceText(now.c), plot.right + 8, py);
    return idx;
  }

  function hud(idx, snap) {
    var m = equity(mine, idx), r = equity(theirs, idx), k = snap ? 1 : 0.3;
    var vm = ease('m', m.v, k), vr = ease('r', r.v, k);
    $('n-you').textContent = money(vm); $('n-rival').textContent = money(vr);
    $('p-you').textContent = pct(vm / START - 1); $('p-rival').textContent = pct(vr / START - 1);
    var lean = Math.min(0.94, Math.max(0.06, 0.5 + (m.v - r.v) / START * 5));
    $('lean').style.width = (ease('l', lean, snap ? 1 : 0.15) * 100).toFixed(1) + '%';
    var left = Math.max(0, Math.round(90 * (1 - idx / (N - 1))));
    $('clk').textContent = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2);
    $('clk').className = 'clk' + (left <= 10 ? ' end' : '');
    // The card stays a moment after a close so the tap on Close is seen.
    var card = $('card'), o = m.open, ending = !o && closing && acc < closing.until ? closing.t : null, st = o || ending;
    card.style.visibility = st ? 'visible' : 'hidden';
    if (st) {
      var price = ending ? candles[ending.close].c : candles[idx].c;
      $('card-name').textContent = (st.side > 0 ? 'Long ' : 'Short ') + LEV + 'x ' + (st.side > 0 ? '▲' : '▼') + ' ' + money(MARGIN, 0);
      $('card-pnl').textContent = signed(ease('c' + st.open, pnl(st, price), snap ? 1 : 0.3));
    }
  }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(t) {
    var dt = Math.min(t - (last || t), 100); last = t;
    if (!document.hidden) acc += dt;
    var head = Math.min(N - 1, acc / STEP);
    var idx = Math.min(N - 1, Math.floor(head));
    events(idx); draw(head); hud(idx, false);
    if (head >= N - 1) { hold += dt; if (hold > HOLD) reset(); }
    requestAnimationFrame(frame);
  }
  if (still) {
    var show = function () { reset(); acc = (N - 1) * STEP; draw(N - 1); hud(N - 1, true); };
    show(); window.addEventListener('resize', show);
  } else requestAnimationFrame(frame);
})();
