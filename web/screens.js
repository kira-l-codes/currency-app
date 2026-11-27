/* Add Currency, the chart pair picker, the metals sheet, the splash. Loaded after app.js. */
(function () {
  "use strict";
  const A = window.App;
  if (!A) return;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  // code -> [country, region], generated from Android's Currencies.kt (a test compares them).
  const GEO = {"AFN":["Afghanistan","Asia"],"ALL":["Albania","Europe"],"DZD":["Algeria","Africa"],"AOA":["Angola","Africa"],"ARS":["Argentina","Americas"],"AMD":["Armenia","Asia"],"AWG":["Aruba","Americas"],"AUD":["Australia","Oceania"],"AZN":["Azerbaijan","Asia"],"BSD":["Bahamas","Americas"],"BHD":["Bahrain","Asia"],"BDT":["Bangladesh","Asia"],"BBD":["Barbados","Americas"],"BYN":["Belarus","Europe"],"BZD":["Belize","Americas"],"BMD":["Bermuda","Americas"],"BTN":["Bhutan","Asia"],"BOB":["Bolivia","Americas"],"BAM":["Bosnia and Herzegovina","Europe"],"BWP":["Botswana","Africa"],"BRL":["Brazil","Americas"],"GBP":["United Kingdom","Europe"],"BND":["Brunei","Asia"],"BIF":["Burundi","Africa"],"KHR":["Cambodia","Asia"],"CAD":["Canada","Americas"],"CVE":["Cape Verde","Africa"],"XCG":["Curaçao","Americas"],"KYD":["Cayman Islands","Americas"],"XAF":["Central African Union","Africa"],"XPF":["French Pacific","Oceania"],"CLP":["Chile","Americas"],"CNY":["China","Asia"],"COP":["Colombia","Americas"],"KMF":["Comoros","Africa"],"CDF":["DR Congo","Africa"],"CKD":["Cook Islands","Oceania"],"CRC":["Costa Rica","Americas"],"CUP":["Cuba","Americas"],"CZK":["Czechia","Europe"],"GMD":["Gambia","Africa"],"DKK":["Denmark","Europe"],"DJF":["Djibouti","Africa"],"DOP":["Dominican Republic","Americas"],"XCD":["Eastern Caribbean","Americas"],"EGP":["Egypt","Africa"],"ERN":["Eritrea","Africa"],"ETB":["Ethiopia","Africa"],"EUR":["European Union","Europe"],"FKP":["Falkland Islands","Americas"],"FOK":["Faroe Islands","Europe"],"FJD":["Fiji","Oceania"],"GEL":["Georgia","Asia"],"GHS":["Ghana","Africa"],"GIP":["Gibraltar","Europe"],"GTQ":["Guatemala","Americas"],"GGP":["Guernsey","Europe"],"GNF":["Guinea","Africa"],"GYD":["Guyana","Americas"],"HTG":["Haiti","Americas"],"HNL":["Honduras","Americas"],"HKD":["Hong Kong","Asia"],"HUF":["Hungary","Europe"],"ISK":["Iceland","Europe"],"INR":["India","Asia"],"IDR":["Indonesia","Asia"],"IRR":["Iran","Asia"],"IQD":["Iraq","Asia"],"ILS":["Israel","Asia"],"JMD":["Jamaica","Americas"],"JPY":["Japan","Asia"],"JEP":["Jersey","Europe"],"JOD":["Jordan","Asia"],"KZT":["Kazakhstan","Asia"],"KES":["Kenya","Africa"],"KID":["Kiribati","Oceania"],"KWD":["Kuwait","Asia"],"KGS":["Kyrgyzstan","Asia"],"LAK":["Laos","Asia"],"LBP":["Lebanon","Asia"],"LSL":["Lesotho","Africa"],"LRD":["Liberia","Africa"],"LYD":["Libya","Africa"],"MOP":["Macau","Asia"],"MKD":["North Macedonia","Europe"],"MGA":["Madagascar","Africa"],"MWK":["Malawi","Africa"],"MYR":["Malaysia","Asia"],"MVR":["Maldives","Asia"],"IMP":["Isle of Man","Europe"],"MRU":["Western Sahara","Africa"],"MUR":["Mauritius","Africa"],"MXN":["Mexico","Americas"],"MDL":["Moldova","Europe"],"MNT":["Mongolia","Asia"],"MAD":["Morocco","Africa"],"MZN":["Mozambique","Africa"],"MMK":["Myanmar","Asia"],"NAD":["Namibia","Africa"],"NPR":["Nepal","Asia"],"TWD":["Taiwan","Asia"],"NZD":["New Zealand","Oceania"],"NIO":["Nicaragua","Americas"],"NGN":["Nigeria","Africa"],"KPW":["North Korea","Asia"],"NOK":["Norway","Europe"],"OMR":["Oman","Asia"],"PKR":["Pakistan","Asia"],"PAB":["Panama","Americas"],"PGK":["Papua New Guinea","Oceania"],"PYG":["Paraguay","Americas"],"PEN":["Peru","Americas"],"PHP":["Philippines","Asia"],"PLN":["Poland","Europe"],"QAR":["Qatar","Asia"],"RON":["Romania","Europe"],"RUB":["Russia","Europe"],"RWF":["Rwanda","Africa"],"SHP":["South Georgia","Africa"],"WST":["Samoa","Oceania"],"SAR":["Saudi Arabia","Asia"],"RSD":["Serbia","Europe"],"SCR":["Seychelles","Africa"],"SLE":["Sierra Leone","Africa"],"SGD":["Singapore","Asia"],"SBD":["Solomon Islands","Oceania"],"SOS":["Somalia","Africa"],"ZAR":["South Africa","Africa"],"KRW":["South Korea","Asia"],"SSP":["South Sudan","Africa"],"LKR":["Sri Lanka","Asia"],"SDG":["Sudan","Africa"],"SRD":["Suriname","Americas"],"SZL":["Eswatini","Africa"],"SEK":["Sweden","Europe"],"CHF":["Switzerland","Europe"],"SYP":["Syria","Asia"],"STN":["São Tomé and Príncipe","Africa"],"TJS":["Tajikistan","Asia"],"TZS":["Tanzania","Africa"],"THB":["Thailand","Asia"],"TOP":["Tonga","Oceania"],"TTD":["Trinidad and Tobago","Americas"],"TND":["Tunisia","Africa"],"TRY":["Türkiye","Asia"],"TMT":["Turkmenistan","Asia"],"TVD":["Tuvalu","Oceania"],"AED":["United Arab Emirates","Asia"],"UGX":["Uganda","Africa"],"UAH":["Ukraine","Europe"],"USD":["United States","Americas"],"UYU":["Uruguay","Americas"],"UZS":["Uzbekistan","Asia"],"VUV":["Vanuatu","Oceania"],"VES":["Venezuela","Americas"],"VND":["Vietnam","Asia"],"XOF":["West African Union","Africa"],"YER":["Yemen","Asia"],"ZMW":["Zambia","Africa"],"ZWG":["Zimbabwe","Africa"]};
  const CRYPTO = Object.keys(A.CRYPTO_IDS), METAL = ["XAU", "XAG"];

  /* ── Add Currency ──────────────────────────────────────────────────────── */
  const matches = (code, q) => {
    const n = q.trim().toLowerCase();
    if (!n) return true;
    const g = GEO[code] || ["", ""];
    return A.nameOf(code).toLowerCase().includes(n) || code.toLowerCase().includes(n)
      || g[0].toLowerCase().includes(n) || g[1].toLowerCase().includes(n);
  };
  function localCode() {
    const region = ((navigator.language || "").split("-")[1] || "").toUpperCase();
    if (!region) return null;
    return Object.keys(A.FLAG).find((c) => A.FLAG[c] === region && A.CAT[c]) || null;
  }
  function openAdd() {
    const old = $("addScreen"); if (old) old.remove();
    const picked = [];
    let tab = "all", q = "";
    const root = el("div", "overlay-screen"); root.id = "addScreen";
    const head = el("header", "head");
    const ht = el("div", "head-text"); ht.appendChild(el("div", "title", "Add Currency"));
    const done = el("button", "done-pill", "✓ Done"); done.type = "button";
    head.append(ht, done);
    const tabs = el("div", "seg");
    const body = el("div", "add-body"); body.id = "addBody";
    const search = el("div", "search-pill");
    const input = el("input"); input.id = "addSearch"; input.type = "text"; input.autocomplete = "off";
    input.placeholder = "Currency, Country, Region, or Code";
    const clear = el("button", "clear-x", "✕"); clear.type = "button"; clear.hidden = true;
    search.append(input, clear);
    const scrub = el("div", "scrubber"); scrub.id = "addScrub";
    root.append(head, tabs, body, scrub, search);
    document.body.appendChild(root);

    const pool = () => {
      const all = Object.keys(A.CAT);
      const sel = tab === "crypto" ? all.filter((c) => CRYPTO.includes(c)) : tab === "metal" ? all.filter((c) => METAL.includes(c)) : all;
      return sel.filter((c) => matches(c, q)).sort((a, b) => A.nameOf(a).localeCompare(A.nameOf(b)));
    };
    const toggle = (code) => {
      if (code === A.state.base) return;
      const i = A.state.order.indexOf(code);
      if (i >= 0) { A.state.order.splice(i, 1); const p = picked.indexOf(code); if (p >= 0) picked.splice(p, 1); }
      else { A.state.order.push(code); picked.push(code); }
      A.saveState(); A.renderList(); draw();
    };
    const rowFor = (code) => {
      const on = A.state.order.includes(code) || code === A.state.base;
      const r = el("div", "picker-item add-row"); r.dataset.code = code;
      const b = el("div", "badge");
      A.fillBadge(b, code);
      const col = el("div"); col.style.flex = "1";
      col.appendChild(el("div", "pi1", A.nameOf(code)));
      col.appendChild(el("div", "pi2", code));
      r.append(b, col);
      if (code === A.state.base) r.appendChild(el("span", "base-tag", "base"));
      r.appendChild(el("span", "check" + (on ? " on" : ""), on ? "✓" : ""));
      r.addEventListener("click", () => toggle(code));
      return r;
    };
    function draw() {
      tabs.innerHTML = "";
      [["all", "All"], ["crypto", "Crypto"], ["metal", "Metal"]].forEach(([id, label]) => {
        const t = el("button", "seg-tab" + (tab === id ? " on" : ""), label); t.type = "button"; t.dataset.tab = id;
        t.addEventListener("click", () => { tab = id; draw(); });
        tabs.appendChild(t);
      });
      body.innerHTML = "";
      const items = pool();
      if (tab === "metal" && !q.trim()) body.appendChild(el("div", "add-note", "Gold and silver are priced by the troy ounce. Tap one to add it to the list."));
      const loc = !q.trim() && tab === "all" ? localCode() : null;
      if (loc) {
        const h = el("div", "sec-head", "My Location — " + (GEO[loc] ? GEO[loc][0] : loc)); body.appendChild(h);
        body.appendChild(rowFor(loc));
      }
      if (picked.length && !q.trim()) {
        body.appendChild(el("div", "sec-head", "Selected · " + picked.length));
        picked.forEach((c) => body.appendChild(rowFor(c)));
      }
      const sections = [];
      items.forEach((c) => {
        const L = (A.nameOf(c)[0] || "#").toUpperCase();
        let s = sections[sections.length - 1];
        if (!s || s.L !== L) { s = { L, codes: [] }; sections.push(s); }
        s.codes.push(c);
      });
      sections.forEach((s) => {
        const h = el("div", "sec-head", s.L); h.id = "sec-" + s.L; body.appendChild(h);
        s.codes.forEach((c) => body.appendChild(rowFor(c)));
      });
      if (!items.length) body.appendChild(el("div", "add-note", q.trim() ? 'Nothing matches "' + q.trim() + '".' : "Nothing here yet."));
      scrub.innerHTML = "";
      scrub.hidden = sections.length <= 2;
      if (sections.length > 2) sections.forEach((s) => {
        const b = el("button", null, s.L); b.type = "button";
        b.addEventListener("click", () => { const t = $("sec-" + s.L); if (t) t.scrollIntoView(); });
        scrub.appendChild(b);
      });
    }
    input.addEventListener("input", () => { q = input.value; clear.hidden = !q; draw(); });
    clear.addEventListener("click", () => { input.value = ""; q = ""; clear.hidden = true; draw(); });
    done.addEventListener("click", () => root.remove());
    draw();
  }

  /* ── pair picker (chart) ───────────────────────────────────────────────── */
  function openPair({ title, codes, selected, onPick }) {
    const old = $("pairScreen"); if (old) old.remove();
    const root = el("div", "overlay-screen"); root.id = "pairScreen";
    const head = el("header", "head");
    const ht = el("div", "head-text"); ht.appendChild(el("div", "title", title));
    const x = el("button", "icon-pill", "✕"); x.type = "button"; x.addEventListener("click", () => root.remove());
    head.append(ht, x);
    const body = el("div", "add-body");
    [...new Set(codes)].forEach((code) => {
      const r = el("div", "picker-item"); r.dataset.code = code;
      const b = el("div", "badge");
      A.fillBadge(b, code);
      const col = el("div"); col.style.flex = "1";
      col.appendChild(el("div", "pi1", A.nameOf(code)));
      col.appendChild(el("div", "pi2", code));
      r.append(b, col, el("span", "check" + (code === selected ? " on" : ""), code === selected ? "✓" : ""));
      r.addEventListener("click", () => { root.remove(); onPick(code); });
      body.appendChild(r);
    });
    root.append(head, body);
    document.body.appendChild(root);
  }

  /* ── metals sheet ──────────────────────────────────────────────────────── */
  const OZ_G = 31.1034768;
  const usd2 = (v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const FEED = { live: "LIVE", delayed: "DELAYED", offline: "OFFLINE" };
  function metalRows(code, ounce) {
    const gram = (k) => ounce / OZ_G * k / 24;
    const rows = [["1 troy ounce", ounce, true]];
    if (code === "XAU") {
      [24, 22, 21, 18].forEach((k) => rows.push(["Gram · " + k + "k", gram(k)]));
      rows.push(["Gold pound · 21k · 7.32 g", gram(21) * 7.32]);
    } else rows.push(["Gram · fine (999)", ounce / OZ_G]);
    return rows;
  }
  let metalTimer = null;
  function openMetals(code) {
    const old = $("metalsSheet"); if (old) old.remove();
    clearInterval(metalTimer);
    const sheet = el("div", "sheet open"); sheet.id = "metalsSheet";
    const scrim = el("div", "scrim open"); scrim.id = "metalsScrim";
    const close = () => { clearInterval(metalTimer); sheet.remove(); scrim.remove(); };
    scrim.addEventListener("click", close);
    document.body.append(scrim, sheet);
    const paint = () => {
      sheet.innerHTML = "";
      sheet.appendChild(el("div", "grab"));
      const head = el("div", "sheet-head");
      head.appendChild(el("span", "sheet-title", (code === "XAU" ? "GOLD" : "SILVER") + " · SPOT"));
      const c = el("button", "kp-close small metal-close", "Close"); c.type = "button"; c.addEventListener("click", close);
      head.appendChild(c); sheet.appendChild(head);
      const meta = A.state.metalMeta[code];
      const ounce = meta && meta.ounceUsd > 0 ? meta.ounceUsd : (A.state.metals[code] > 0 ? 1 / A.state.metals[code] : 0);
      if (!(ounce > 0)) {
        sheet.appendChild(el("div", "add-note", "No price yet. Pull the list down to refresh once you are online."));
        return;
      }
      sheet.appendChild(el("div", "metal-big", usd2(ounce)));
      const feed = A.metalFeedFor(code);
      let sub = "per troy ounce · USD";
      if (meta && meta.atKnown && meta.atMs) {
        const d = new Date(meta.atMs);
        sub += " · " + d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + ", "
          + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      } else sub += " · update time unknown";
      const line = el("div", "metal-feed");
      const dot = el("span", "feed-dot " + (feed || "unknown"));
      line.append(dot, el("span", "feed-label", FEED[feed] || "AGE UNKNOWN"), el("span", "feed-sub", " " + sub));
      sheet.appendChild(line);
      metalRows(code, ounce).forEach(([label, v, strong]) => {
        const r = el("div", "metal-row" + (strong ? " strong" : ""));
        r.append(el("span", null, label), el("span", null, usd2(v)));
        sheet.appendChild(r);
      });
      sheet.appendChild(el("div", "hint", "Spot price in USD. Jewellers add a premium over this for worked gold."));
    };
    paint();
    metalTimer = setInterval(paint, 15000);   // the age re-reads the clock while the sheet is open
  }

  /* ── splash, once per launch ───────────────────────────────────────────── */
  function splash() {
    if (window.__noSplash || sessionStorage.getItem("splashed")) return;
    try { sessionStorage.setItem("splashed", "1"); } catch (err) { /* private mode */ }
    const s = el("div", "splash"); s.id = "splash";
    s.innerHTML = '<div class="sp-bars"><i class="sp-gold"></i><i class="sp-silver"></i></div>'
      + '<div class="sp-line"></div><div class="sp-title">Currency</div>'
      + '<div class="sp-sub">RATES · GOLD · COUNT</div><div class="sp-hair"><b></b></div>';
    document.body.appendChild(s);
    setTimeout(() => s.classList.add("out"), 700);
    setTimeout(() => s.remove(), 950);
  }

  window.Screens = { openAdd, openPair, openMetals, matches, GEO, metalRows, splash };
  splash();
})();
