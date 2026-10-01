/* Satoshi Pulse — shared JS: live price, converter, chart, reveal, nav */
(function () {
  "use strict";

  var FALLBACK = {
    price: 114650,
    change24: 1.8,
    mcap: 2280000000000
  };
  var livePrice = FALLBACK.price;

  function fmtUSD(n, decimals) {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals == null ? 0 : decimals,
      maximumFractionDigits: decimals == null ? 0 : decimals
    });
  }

  function fmtBig(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
    return fmtUSD(n);
  }

  /* ---------- Live price ---------- */

  function paintPrice(price, change, mcap) {
    livePrice = price;
    document.querySelectorAll(".js-btc-price").forEach(function (el) {
      el.textContent = fmtUSD(price);
    });
    document.querySelectorAll(".js-btc-change").forEach(function (el) {
      var up = change >= 0;
      el.textContent = (up ? "+" : "") + change.toFixed(1) + "%";
      el.classList.remove("up", "down");
      el.classList.add(up ? "up" : "down");
    });
    document.querySelectorAll(".js-btc-mcap").forEach(function (el) {
      el.textContent = fmtBig(mcap);
    });
    document.querySelectorAll(".js-btc-sats").forEach(function (el) {
      el.textContent = Math.round(1e8 / price).toLocaleString("en-US") + " sats";
    });
    runConverters();
  }

  function fetchPrice() {
    var url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true";
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (data) {
        var b = data && data.bitcoin;
        if (!b || !b.usd) throw new Error("bad payload");
        paintPrice(b.usd, b.usd_24h_change || 0, b.usd_market_cap || 0);
      })
      .catch(function () {
        paintPrice(FALLBACK.price, FALLBACK.change24, FALLBACK.mcap);
      });
  }

  /* ---------- Converter ---------- */

  function runConverters() {
    document.querySelectorAll("[data-converter]").forEach(function (root) {
      var btcIn = root.querySelector("[data-btc-input]");
      var usdIn = root.querySelector("[data-usd-input]");
      var note = root.querySelector("[data-conv-note]");
      if (note) {
        note.innerHTML = "1 BTC = <b>" + fmtUSD(livePrice) + "</b> &nbsp;·&nbsp; $1 buys <b>" +
          Math.round(1e8 / livePrice).toLocaleString("en-US") + " sats</b>";
      }
      if (!btcIn || !usdIn) return;
      if (root._wired) { sync(btcIn, usdIn, "btc"); return; }
      root._wired = true;
      btcIn.addEventListener("input", function () { sync(btcIn, usdIn, "btc"); });
      usdIn.addEventListener("input", function () { sync(btcIn, usdIn, "usd"); });
      sync(btcIn, usdIn, "btc");
    });
  }

  function sync(btcIn, usdIn, from) {
    var v;
    if (from === "btc") {
      v = parseFloat(btcIn.value);
      usdIn.value = isNaN(v) ? "" : (v * livePrice).toFixed(2);
    } else {
      v = parseFloat(usdIn.value);
      btcIn.value = isNaN(v) ? "" : (v / livePrice).toFixed(8);
    }
  }

  /* ---------- SVG price chart ---------- */

  // Plausible weekly closes, Jan–Sep 2026 ($K)
  var SERIES_2026 = [
    ["Jan 05", 101.2], ["Jan 12", 99.8], ["Jan 19", 97.4], ["Jan 26", 98.9],
    ["Feb 02", 95.2], ["Feb 09", 96.7], ["Feb 16", 99.1], ["Feb 23", 102.4],
    ["Mar 02", 104.8], ["Mar 09", 103.1], ["Mar 16", 106.9], ["Mar 23", 108.2],
    ["Mar 30", 107.5], ["Apr 06", 110.3], ["Apr 13", 112.8], ["Apr 20", 111.4],
    ["Apr 27", 114.6], ["May 04", 116.9], ["May 11", 118.2], ["May 18", 115.7],
    ["May 25", 117.8], ["Jun 01", 120.4], ["Jun 08", 119.1], ["Jun 15", 121.6],
    ["Jun 22", 123.9], ["Jun 29", 122.2], ["Jul 06", 124.8], ["Jul 13", 126.3],
    ["Jul 20", 125.1], ["Jul 27", 127.6], ["Aug 03", 129.8], ["Aug 10", 128.4],
    ["Aug 17", 124.2], ["Aug 24", 120.9], ["Aug 31", 118.7], ["Sep 07", 116.2],
    ["Sep 14", 113.8], ["Sep 21", 112.1], ["Sep 28", 114.6]
  ];

  function drawChart() {
    var svg = document.getElementById("price-chart");
    if (!svg) return;
    var W = 900, H = 380, PAD_L = 56, PAD_R = 16, PAD_T = 24, PAD_B = 34;
    var vals = SERIES_2026.map(function (d) { return d[1]; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var lo = Math.floor((min - 3) / 5) * 5, hi = Math.ceil((max + 3) / 5) * 5;
    function x(i) { return PAD_L + (i / (vals.length - 1)) * (W - PAD_L - PAD_R); }
    function y(v) { return PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B); }

    var ns = "http://www.w3.org/2000/svg";
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var defs = document.createElementNS(ns, "defs");
    defs.innerHTML =
      '<linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f7931a" stop-opacity="0.32"/>' +
      '<stop offset="1" stop-color="#f7931a" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#f7931a"/>' +
      '<stop offset="0.6" stop-color="#ffb347"/>' +
      '<stop offset="1" stop-color="#ffd580"/></linearGradient>';
    svg.appendChild(defs);

    // grid + y labels
    for (var g = lo; g <= hi; g += 10) {
      var gy = y(g);
      var line = document.createElementNS(ns, "line");
      line.setAttribute("x1", PAD_L); line.setAttribute("x2", W - PAD_R);
      line.setAttribute("y1", gy); line.setAttribute("y2", gy);
      line.setAttribute("stroke", "rgba(242,237,228,0.06)");
      svg.appendChild(line);
      var t = document.createElementNS(ns, "text");
      t.setAttribute("x", PAD_L - 10); t.setAttribute("y", gy + 3);
      t.setAttribute("text-anchor", "end");
      t.setAttribute("class", "chart-axis");
      t.textContent = "$" + g + "K";
      svg.appendChild(t);
    }
    // x labels (every 5th point)
    SERIES_2026.forEach(function (d, i) {
      if (i % 5 !== 0) return;
      var t = document.createElementNS(ns, "text");
      t.setAttribute("x", x(i)); t.setAttribute("y", H - 10);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "chart-axis");
      t.textContent = d[0];
      svg.appendChild(t);
    });

    var pts = vals.map(function (v, i) { return x(i) + "," + y(v); });
    var area = document.createElementNS(ns, "polygon");
    area.setAttribute("points", PAD_L + "," + (H - PAD_B) + " " + pts.join(" ") + " " + (W - PAD_R) + "," + (H - PAD_B));
    area.setAttribute("fill", "url(#areaFill)");
    svg.appendChild(area);

    var path = document.createElementNS(ns, "polyline");
    path.setAttribute("points", pts.join(" "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "url(#lineStroke)");
    path.setAttribute("stroke-width", "2.4");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);

    // last point dot
    var dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", x(vals.length - 1));
    dot.setAttribute("cy", y(vals[vals.length - 1]));
    dot.setAttribute("r", "4.5");
    dot.setAttribute("fill", "#ffd580");
    dot.setAttribute("stroke", "#0b0a10");
    dot.setAttribute("stroke-width", "2");
    svg.appendChild(dot);
  }

  /* ---------- Nav toggle ---------- */

  function wireNav() {
    var btn = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".main-nav");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      nav.classList.toggle("open");
      btn.textContent = nav.classList.contains("open") ? "CLOSE" : "MENU";
    });
  }

  /* ---------- Reveal on scroll ---------- */

  function wireReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    paintPrice(FALLBACK.price, FALLBACK.change24, FALLBACK.mcap);
    fetchPrice();
    setInterval(fetchPrice, 60000);
    drawChart();
    wireNav();
    wireReveal();
  });
})();
