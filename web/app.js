/* Currency — the web build, wearing the Android app's clothes.
 *
 * Layout mirrors app/build/outputs/screens: a flat black list, the base currency as its own row with
 * the amount in a green pill, names above codes, a floating capsule dock, and a full-screen warm-brown
 * keypad. Everything numeric still goes through the one conversion function below.
 */
(() => {
  "use strict";

  const VERSION = "web 1.3";

  /* ── catalogue ───────────────────────────────────────────────────────────── */
  const CAT = {
    USD:["United States Dollar","$"],   EUR:["Euro","€"],              GBP:["British Pound","£"],
    LBP:["Lebanese Pound","ل.ل"],      SYP:["Syrian Pound","S£"],     EGP:["Egyptian Pound","E£"],
    TRY:["Turkish Lira","₺"],           SAR:["Saudi Riyal","SAR"],      AED:["UAE Dirham","AED"],
    QAR:["Qatari Riyal","QAR"],         KWD:["Kuwaiti Dinar","KWD"],    BHD:["Bahraini Dinar","BHD"],
    OMR:["Omani Rial","OMR"],           JOD:["Jordanian Dinar","JOD"],  ILS:["Israeli Shekel","₪"],
    IQD:["Iraqi Dinar","IQD"],          IRR:["Iranian Rial","IRR"],     MAD:["Moroccan Dirham","MAD"],
    DZD:["Algerian Dinar","DZD"],       TND:["Tunisian Dinar","TND"],   LYD:["Libyan Dinar","LYD"],
    SDG:["Sudanese Pound","SDG"],       YER:["Yemeni Rial","YER"],      INR:["Indian Rupee","₹"],
    PKR:["Pakistani Rupee","PKR"],      BDT:["Bangladeshi Taka","BDT"], LKR:["Sri Lankan Rupee","LKR"],
    CNY:["Chinese Yuan","¥"],           JPY:["Japanese Yen","¥"],       KRW:["South Korean Won","₩"],
    HKD:["Hong Kong Dollar","HK$"],     SGD:["Singapore Dollar","S$"],  MYR:["Malaysian Ringgit","RM"],
    THB:["Thai Baht","฿"],              IDR:["Indonesian Rupiah","IDR"],PHP:["Philippine Peso","₱"],
    VND:["Vietnamese Dong","₫"],        AUD:["Australian Dollar","A$"], NZD:["New Zealand Dollar","NZ$"],
    CAD:["Canadian Dollar","C$"],       BRL:["Brazilian Real","R$"],    MXN:["Mexican Peso","MX$"],
    ARS:["Argentine Peso","AR$"],       CLP:["Chilean Peso","CLP"],     COP:["Colombian Peso","COP"],
    PEN:["Peruvian Sol","S/"],          ZAR:["South African Rand","R"], NGN:["Nigerian Naira","₦"],
    KES:["Kenyan Shilling","KSh"],      GHS:["Ghanaian Cedi","GH₵"],    RUB:["Russian Ruble","₽"],
    UAH:["Ukrainian Hryvnia","₴"],      PLN:["Polish Zloty","zł"],      CZK:["Czech Koruna","Kč"],
    HUF:["Hungarian Forint","Ft"],      RON:["Romanian Leu","lei"],     SEK:["Swedish Krona","kr"],
    NOK:["Norwegian Krone","kr"],       DKK:["Danish Krone","kr"],      CHF:["Swiss Franc","CHF"],
    ISK:["Icelandic Krona","kr"],       BTC:["Bitcoin","₿"],            ETH:["Ethereum","Ξ"],
    XAU:["Gold",null],                  XAG:["Silver",null],
  };

  const FLAG = { USD:"US", EUR:"EU", GBP:"GB", LBP:"LB", SYP:"SY", EGP:"EG", TRY:"TR", SAR:"SA",
    AED:"AE", QAR:"QA", KWD:"KW", BHD:"BH", OMR:"OM", JOD:"JO", ILS:"IL", IQD:"IQ", IRR:"IR",
    MAD:"MA", DZD:"DZ", TND:"TN", LYD:"LY", SDG:"SD", YER:"YE", INR:"IN", PKR:"PK", BDT:"BD",
    LKR:"LK", CNY:"CN", JPY:"JP", KRW:"KR", HKD:"HK", SGD:"SG", MYR:"MY", THB:"TH", IDR:"ID",
    PHP:"PH", VND:"VN", AUD:"AU", NZD:"NZ", CAD:"CA", BRL:"BR", MXN:"MX", ARS:"AR", CLP:"CL",
    COP:"CO", PEN:"PE", ZAR:"ZA", NGN:"NG", KES:"KE", GHS:"GH", RUB:"RU", UAH:"UA", PLN:"PL",
    CZK:"CZ", HUF:"HU", RON:"RO", SEK:"SE", NOK:"NO", DKK:"DK", CHF:"CH", ISK:"IS" };

  /* Notes only — the app never counts coins. */
  const DENOMS = {
    USD:[100,50,20,10,5,1],
    LBP:[100000,50000,20000,10000,5000,1000],
    EUR:[500,200,100,50,20,10,5],
    GBP:[50,20,10,5],
    SYP:[5000,2000,1000,500,200,100],
    TRY:[200,100,50,20,10,5],
    EGP:[200,100,50,20,10,5],
    AED:[1000,500,200,100,50,5],
    SAR:[500,100,50,10,5],
  };

  const FALLBACK = { USD:1, EUR:0.8905, GBP:0.742, LBP:89550.64, SYP:13002, EGP:53.899,
    TRY:50.063, SAR:3.75, AED:3.6725, QAR:3.64, KWD:0.3067, BHD:0.376, OMR:0.3845,
    JOD:0.709, ILS:3.34, IQD:1310, IRR:42000, MAD:9.24, DZD:129.5, TND:2.93, LYD:4.85,
    SDG:601, YER:250, INR:94.469, PKR:283.6, BDT:122.3, LKR:296.5, CNY:7.03, JPY:147.2,
    KRW:1370, HKD:7.81, SGD:1.28, MYR:4.14, THB:32.2, IDR:16250, PHP:57.6, VND:25400,
    AUD:1.54, NZD:1.68, CAD:1.37, BRL:5.35, MXN:18.4, ARS:1250, CLP:945, COP:3900,
    PEN:3.55, ZAR:17.3, NGN:1450, KES:129, GHS:11.7, RUB:79.5, UAH:41.5, PLN:3.62,
    CZK:20.8, HUF:335, RON:4.43, SEK:9.35, NOK:9.98, DKK:6.65, CHF:0.798, ISK:122 };
  // No baked-in crypto: a coin has no "reference rate" and quoting a hardcoded price as if it were
  // live is the kind of lie this app refuses. They arrive from CoinGecko or they read "—".

  const CRYPTO_IDS = { BTC: "bitcoin", ETH: "ethereum" };

  const DEFAULT_ORDER = ["LBP","EGP","TRY","EUR","INR","GBP","SYP","AED","SAR","XAU","XAG","BTC","JPY","CNY","CHF","CAD","AUD"];
  const STORE = "currency.web.v2";

  const state = {
    base:"USD", amount:100,
    rates:{ ...FALLBACK }, metals:{}, metalMeta:{}, updated:0, live:false,
    order:[...DEFAULT_ORDER], pinned:["LBP"], screen:"convert",
    chart:{ base:"EUR", quote:"USD", period:"3M" },
    count:{ bag:["USD"], counts:{}, expected:null, history:[], collapsed:[] },
  };

  /* ── helpers ─────────────────────────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const flagOf = (code) => {
    const cc = FLAG[code];
    if (!cc) return null;
    return String.fromCodePoint(...[...cc].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
  };
  const nameOf = (code) => (CAT[code] || [code])[0];
  const symOf = (code) => (CAT[code] || [, ""])[1] || "";

  /* Two decimals on every converted amount, four only where cents would round to nothing — the app
     shows E£5,389.90 and 8,955,064.00, and a web build that rounds to whole numbers reads as broken. */
  const money = (v) => {
    const abs = Math.abs(v);
    if (abs && abs < 0.01) return v.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const money2 = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /* Cash counting truncates: $700, not $700.00. */
  const whole = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const symPrefix = (code) => {
    const sym = symOf(code);
    if (!sym || /^[A-Z]{3}$/.test(sym)) return "";
    return /[^\x00-\x7F]/.test(sym) ? sym + " " : sym;
  };
  const signed = (code, amount) => symPrefix(code) + money(amount);
  const signedWhole = (code, amount) => symPrefix(code) + whole(amount);

  /* ── the one money convention ────────────────────────────────────────────── */
  const perUsd = (code) => (code === "XAU" || code === "XAG") ? state.metals[code] : state.rates[code];

  const convert = (value, from, to) => {
    const f = perUsd(from), t = perUsd(to);
    if (!f || !t) return 0;
    return (value / f) * t;
  };
  const toUsd = (value, code) => {
    const p = perUsd(code);
    return p ? value / p : 0;
  };

  /* ── metals: accept a publication, decide a direction, never replay one ──── */
  const M = window.Motion;

  const quoteOf = (json) => ({ ounceUsd: json.price, atMs: M.parseProviderAt(json.updatedAt) || 0 });

  /**
   * Folds a fresh read into the state. A publication the page has not seen is accepted, given a
   * direction against the previous price and a new sequence number; everything else is dropped, so
   * two polls inside one 30-second publication cost nothing and animate nothing.
   * Returns the codes that actually changed.
   */
  function applyMetals(quotes, receivedAt) {
    const changed = [];
    Object.keys(quotes).forEach((code) => {
      const quote = quotes[code];
      const previous = state.metalMeta[code];
      const stamp = quote.atMs > 0 ? quote.atMs : receivedAt;
      if (!M.accept(quote.ounceUsd, stamp, previous ? previous.atMs : 0)) return;
      state.metalMeta[code] = {
        ounceUsd: quote.ounceUsd,
        atMs: stamp,
        receivedAt,
        tick: M.tick(previous ? previous.ounceUsd : null, quote.ounceUsd),
        seq: (previous ? previous.seq : 0) + 1,
      };
      // The table holds units per 1 USD; one ounce is worth `ounceUsd` dollars, so it is 1/ounce
      // "ounces to the dollar". Storing the price here made XAU-as-base divide instead of multiply.
      state.metals[code] = 1 / quote.ounceUsd;
      changed.push(code);
    });
    return changed;
  }

  /** LIVE / DELAYED / OFFLINE for the metal feed, from the age of the newest accepted publication. */
  function metalsFeedState() {
    const stamps = Object.values(state.metalMeta).map((m) => m.receivedAt);
    const newest = stamps.length ? Math.max(...stamps) : 0;
    return M.feedState(stamps.length > 0, M.ageMs(Date.now(), newest));
  }

  const METALS_LABEL = { live: "live", delayed: "delayed", offline: "offline" };

  /* ── expression parser ───────────────────────────────────────────────────── */
  function evaluate(raw) {
    const src = String(raw).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/,/g, "").trim();
    if (!src) return null;
    const tokens = src.match(/\d*\.?\d+|[+\-*/()]/g);
    if (!tokens || tokens.join("") !== src.replace(/\s+/g, "")) return null;
    let i = 0;
    const peek = () => tokens[i];
    function primary() {
      const t = tokens[i];
      if (t === "(") { i++; const v = expr(); if (tokens[i] !== ")") throw 0; i++; return v; }
      if (t === "-") { i++; return -primary(); }
      if (t === undefined || !/^\d/.test(t)) throw 0;
      i++; const v = Number(t); if (!Number.isFinite(v)) throw 0; return v;
    }
    function term() {
      let v = primary();
      while (peek() === "*" || peek() === "/") {
        const op = tokens[i++]; const r = primary();
        if (op === "/" && r === 0) throw 0;
        v = op === "*" ? v * r : v / r;
      }
      return v;
    }
    const expr = () => { let v = term(); while (peek() === "+" || peek() === "-") { const op = tokens[i++]; const r = term(); v = op === "+" ? v + r : v - r; } return v; };
    try { const v = expr(); return i === tokens.length && Number.isFinite(v) ? v : null; } catch { return null; }
  }

  /* ── persistence ─────────────────────────────────────────────────────────── */
  function saveState() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        base: state.base, amount: state.amount, order: state.order, pinned: state.pinned,
        screen: state.screen,        chart: state.chart, count: state.count,
        rates: state.rates, metals: state.metals, updated: state.updated,
        metalMeta: state.metalMeta,
      }));
    } catch (e) { /* private mode: it still works, it just forgets */ }
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.base && CAT[s.base]) state.base = s.base;
      if (typeof s.amount === "number" && s.amount > 0) state.amount = s.amount;
      if (Array.isArray(s.order) && s.order.length) state.order = s.order.filter((c) => CAT[c]);
      if (Array.isArray(s.pinned)) state.pinned = s.pinned.filter((c) => CAT[c]);
      if (s.screen) state.screen = s.screen;
      if (s.chart) state.chart = { ...state.chart, ...s.chart };
      if (s.count) {
        state.count = {
          bag: Array.isArray(s.count.bag) && s.count.bag.length ? s.count.bag : ["USD"],
          counts: s.count.counts || {}, expected: s.count.expected ?? null,
          history: Array.isArray(s.count.history) ? s.count.history : [],
          collapsed: Array.isArray(s.count.collapsed) ? s.count.collapsed : [],
        };
      }
      if (s.rates) state.rates = { ...state.rates, ...s.rates };
      if (s.metals) state.metals = s.metals;
      // A stored publication time lets the first paint say DELAYED instead of pretending.
      if (s.metalMeta) state.metalMeta = s.metalMeta;
      if (s.updated) state.updated = s.updated;
    } catch (e) { /* a corrupt key must not brick the app */ }
  }

  /* ── toast ───────────────────────────────────────────────────────────────── */
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
  }

  /* ── sheets ──────────────────────────────────────────────────────────────── */
  const openSheets = new Set();
  function sheetOpen(id) {
    openSheets.add(id);
    $("scrim").classList.add("open");
    $(id).classList.add("open");
  }
  function sheetClose(id) {
    openSheets.delete(id);
    if (!openSheets.size) $("scrim").classList.remove("open");
    $(id).classList.remove("open");
  }
  function closeAllSheets() { [...openSheets].forEach(sheetClose); }
  $("scrim").addEventListener("click", closeAllSheets);

  /* ── keypad (amount and quantity share it) ───────────────────────────────── */
  let entry = "", fresh = false, kpCommit = null, kpMode = "amount";

  function paintKeypad() {
    const shown = entry
      ? entry.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/-/g, " − ")
      : "0";
    const solved = evaluate(entry);
    $("kpValue").textContent = solved != null && /[+\-*/]/.test(entry)
      ? shown + " = " + money(solved)
      : shown;
  }

  function openKeypad(opts) {
    kpMode = opts.mode || "amount";
    kpCommit = opts.onCommit;
    $("kpFlag").textContent = flagOf(opts.code) || "¤";
    $("kpName").textContent = opts.title || nameOf(opts.code);
    $("kpCode").textContent = opts.subtitle || opts.code;
    $("kpUnit").textContent = (symOf(opts.code) && !/^[A-Z]{3}$/.test(symOf(opts.code)) ? symOf(opts.code) + " " : "") + opts.code;
    $("kpGo").textContent = opts.confirm || "Convert";
    entry = opts.initial != null && opts.initial !== 0 ? String(opts.initial) : "";
    fresh = Boolean(entry);
    paintKeypad();
    $("keypad").classList.add("open");
  }
  function closeKeypad() { $("keypad").classList.remove("open"); }

  function press(key) {
    if (key === "C") { entry = ""; fresh = false; paintKeypad(); return; }
    if (key === "back") { entry = entry.slice(0, -1); fresh = false; paintKeypad(); return; }
    if (key === "1K" || key === "100" || key === "10") {
      // The app's shortcuts add zeros to what is already there: 5, then 1K, is 5000.
      const zeros = { "1K": "000", "100": "00", "10": "0" }[key];
      if (!entry || /[+\-*/]$/.test(entry)) entry = { "1K": "1000", "100": "100", "10": "10" }[key];
      else entry += zeros;
      fresh = false;
      paintKeypad();
      return;
    }
    if (fresh && /^[0-9.]$/.test(key)) entry = "";
    fresh = false;
    if (/[+\-*/]/.test(key) && /[+\-*/]$/.test(entry)) entry = entry.slice(0, -1);
    entry += key;
    paintKeypad();
  }

  function commitKeypad() {
    const v = evaluate(entry);
    if (v == null || v < 0) { toast("That is not a number I can read"); return; }
    try {
      if (kpCommit) kpCommit(v);
    } finally {
      // Whatever the caller does, the sheet closes: a keypad left sitting over the answer reads as
      // a tap that did not register.
      closeKeypad();
    }
  }

  $("kpGo").addEventListener("click", commitKeypad);
  $("kpClose").addEventListener("click", closeKeypad);
  document.querySelectorAll("[data-key]").forEach((b) => b.addEventListener("click", () => press(b.dataset.key)));

  /* ── picker ──────────────────────────────────────────────────────────────── */
  function openPicker({ title, codes, onPick }) {
    $("pickerTitle").textContent = title || "Choose a currency";
    $("pickerSearch").value = "";
    const list = $("pickerList");
    const draw = (q) => {
      list.innerHTML = "";
      const needle = (q || "").toLowerCase().trim();
      const hits = codes.filter((c) => !needle || c.toLowerCase().includes(needle) || nameOf(c).toLowerCase().includes(needle));
      hits.forEach((code) => {
        const row = el("div", "picker-item");
        const badge = el("div", "badge");
        const f = flagOf(code);
        if (f) { badge.classList.add("flag"); badge.textContent = f; }
        else { badge.classList.add("fiat"); badge.textContent = symOf(code) || code.slice(0, 1); }
        row.appendChild(badge);
        const col = el("div");
        col.appendChild(el("div", "pi1", code + " · " + nameOf(code)));
        col.appendChild(el("div", "pi2", perUsd(code) ? "1 USD = " + money(perUsd(code)) + " " + code : "no rate"));
        row.appendChild(col);
        row.addEventListener("click", () => { sheetClose("picker"); onPick(code); });
        list.appendChild(row);
      });
      if (!hits.length) list.appendChild(el("div", "empty", "Nothing matches that."));
    };
    draw("");
    $("pickerSearch").oninput = (e) => draw(e.target.value);
    sheetOpen("picker");
  }
  $("pickerClose").addEventListener("click", () => sheetClose("picker"));

  /* ── rates ───────────────────────────────────────────────────────────────── */
  const STALE_AFTER = 15 * 60 * 1000;

  function paintStatus() {
    const age = state.updated ? Date.now() - state.updated : Infinity;
    const fresh = age < STALE_AFTER;
    const when = state.updated
      ? new Date(state.updated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "—";
    // What matters is how old the numbers are, not which browser event fired last.
    $("convertSub").textContent = (fresh ? "Updated " : "Cached ") + when + " · " + state.order.length + " currencies · " + VERSION;
    const metalFeed = metalsFeedState();
    const metalText = metalFeed === "live"
      ? "gold & silver live"
      : metalFeed === "delayed"
        ? "gold & silver delayed"
        : "gold & silver offline";
    $("convertSource").textContent = navigator.onLine === false
      ? "Offline · rates from " + new Date(state.updated).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " · " + metalText
      : "Rates by open.er-api.com · " + metalText + " (30 s)";
    const pill = $("countRates");
    pill.classList.toggle("stale", !fresh);
    $("countRatesText").textContent = fresh ? "Rates live" : "Cached " + when;
  }

  function offlineNotice() {
    state.live = false;
    paintStatus();
  }

  async function loadRates() {
    if (navigator.onLine === false) offlineNotice();
    try {
      const cryptoIds = Object.values(CRYPTO_IDS).join(",");
      const [fiat, gold, silver, crypto] = await Promise.all([
        fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }).then((r) => r.json()),
        fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("https://api.gold-api.com/price/XAG", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=" + cryptoIds + "&vs_currencies=usd", { cache: "no-store" })
          .then((r) => r.json()).catch(() => null),
      ]);
      if (fiat && fiat.rates) state.rates = { ...state.rates, ...fiat.rates };
      // A coin worth N dollars is 1/N of a dollar's worth of coin; no reply means no price.
      if (crypto) {
        Object.entries(CRYPTO_IDS).forEach(([code, id]) => {
          const usd = crypto[id] && crypto[id].usd;
          if (usd > 0) state.rates[code] = 1 / usd;
          else delete state.rates[code];
        });
      }
      const quotes = {};
      if (gold && gold.price > 0) quotes.XAU = quoteOf(gold);
      if (silver && silver.price > 0) quotes.XAG = quoteOf(silver);
      const moved = applyMetals(quotes, Date.now());
      state.live = true;
      state.updated = Date.now();
      saveState();
      renderAll();
      moved.forEach(paintMetalRow);
      if (window.ChartView) window.ChartView.onRates();
    } catch (err) {
      offlineNotice();
    }
  }

  /* ── convert ─────────────────────────────────────────────────────────────── */
  function badgeFor(code) {
    const b = el("div", "badge");
    if (code === "XAU") { b.classList.add("metal-gold"); b.textContent = "Au"; return b; }
    if (code === "XAG") { b.classList.add("metal-silver"); b.textContent = "Ag"; return b; }
    const f = flagOf(code);
    if (f) { b.classList.add("flag"); b.textContent = f; }
    else { b.classList.add("fiat"); b.textContent = symOf(code) || code.slice(0, 1); }
    return b;
  }

  /** Rows in the app's order: the base first, then pinned, then the watch list. */
  function orderedCodes() {
    const rest = state.order.filter((c) => c !== state.base);
    rest.sort((a, b) => (state.pinned.includes(b) ? 1 : 0) - (state.pinned.includes(a) ? 1 : 0));
    return [state.base, ...rest];
  }

  /** The flash is a 900 ms window after an accepted publication, never a state that lingers. */
  function flashActive(code) {
    const meta = state.metalMeta[code];
    if (!meta || meta.tick === "flat") return null;
    return Date.now() - meta.receivedAt <= M.FLASH_MS ? meta : null;
  }

  const metalPillText = (code) => {
    const unit = perUsd(code) || 0;              // ounces per dollar
    return unit > 0 ? "$" + money2(1 / unit) + " / oz" : "—";
  };

  /**
   * Repaints one metal row in place. A tick must not rebuild the list: sixteen rows of DOM for one
   * number is exactly the recomposition storm the brief asks us to avoid.
   */
  function paintMetalRow(code) {
    const row = document.querySelector('#list .row[data-code="' + code + '"]');
    if (!row) return;
    const wrap = row.querySelector(".pill-wrap");
    const pill = row.querySelector(".pill-value");
    const tickEl = row.querySelector(".tick");
    if (!wrap || !pill) return;
    pill.textContent = metalPillText(code);
    const meta = flashActive(code);
    wrap.classList.remove("flash-up", "flash-down");
    if (tickEl) {
      tickEl.textContent = meta ? (meta.tick === "up" ? "▲" : "▼") : "";
      tickEl.className = "tick" + (meta ? " show " + meta.tick : "");
    }
    if (meta) {
      void wrap.offsetWidth;                    // restart the CSS animation on a fresh move
      wrap.classList.add(meta.tick === "up" ? "flash-up" : "flash-down");
      // The tint returns on its own (CSS), but the arrow is DOM: clear it when the window closes,
      // otherwise a row keeps pointing at a move that happened half a minute ago.
      setTimeout(() => paintMetalRow(code), M.FLASH_MS + 60);
    }
  }

  function rowFor(code) {
    const li = el("li", "row");
    li.dataset.code = code;
    if (code === state.base) li.classList.add("base");
    if (code === "XAU" || code === "XAG") li.classList.add("metal");
    li.appendChild(badgeFor(code));

    const main = el("div", "row-main");
    const name = el("div", "row-name");
    name.appendChild(el("span", null, nameOf(code)));
    if (state.pinned.includes(code) && code !== state.base) name.appendChild(el("span", "pin", "📌"));
    main.appendChild(name);
    main.appendChild(el("div", "row-code", code));
    li.appendChild(main);

    const value = el("div", "pill-value");
    const p = perUsd(code);
    if (code === state.base) {
      value.textContent = symPrefix(code) + money(state.amount);
    } else if (p && (code === "XAU" || code === "XAG")) {
      value.textContent = "$" + money2(p) + " / oz";
    } else if (p) {
      value.textContent = signed(code, convert(state.amount, state.base, code));
    } else {
      value.textContent = "—";
    }
    // The arrow floats in the gap before the pill, so no row ever changes width when a price moves.
    const wrap = el("div", "pill-wrap");
    wrap.appendChild(el("span", "tick"));
    wrap.appendChild(value);
    const meta = flashActive(code);
    if (meta) {
      wrap.classList.add(meta.tick === "up" ? "flash-up" : "flash-down");
      const tickEl = wrap.querySelector(".tick");
      tickEl.textContent = meta.tick === "up" ? "▲" : "▼";
      tickEl.className = "tick show " + meta.tick;
    }
    li.appendChild(wrap);

    li.addEventListener("click", () => {
      if (code === state.base) { openAmountSheet(); return; }
      // The currency that was the base has to stay watchable, or picking gold hides the dollars.
      if (!state.order.includes(state.base) && state.base !== code) state.order.unshift(state.base);
      state.base = code;
      saveState();
      renderAll();
      toast("Base set to " + code);
    });
    // Long press pins, the way a swipe right does in the app.
    let hold;
    li.addEventListener("pointerdown", () => {
      hold = setTimeout(() => { hold = null; togglePin(code); }, 480);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => li.addEventListener(ev, () => {
      if (hold) { clearTimeout(hold); hold = null; }
    }));
    return li;
  }

  function togglePin(code) {
    if (code === state.base) { toast("The base row stays on top"); return; }
    const i = state.pinned.indexOf(code);
    if (i >= 0) state.pinned.splice(i, 1); else state.pinned.push(code);
    saveState();
    renderList();
    toast(i >= 0 ? code + " unpinned" : code + " pinned");
  }

  function renderList() {
    const list = $("list");
    list.innerHTML = "";
    orderedCodes().forEach((code) => list.appendChild(rowFor(code)));
  }

  function openAmountSheet() {
    openKeypad({
      code: state.base, initial: state.amount, mode: "amount", confirm: "Convert",
      onCommit: (v) => { if (v <= 0) { toast("Amount has to be more than zero"); return; } state.amount = v; saveState(); renderList(); },
    });
  }

  /* ── menu ────────────────────────────────────────────────────────────────── */
  function renderMenu() {
    const list = $("menuList");
    list.innerHTML = "";
    const item = (label, note, action) => {
      const b = el("button", "menu-item");
      b.type = "button";
      const left = el("span", null, label);
      b.appendChild(left);
      if (note) b.appendChild(el("span", "mi2", note));
      b.addEventListener("click", () => { sheetClose("menu"); action(); });
      list.appendChild(b);
    };
    item("Refresh rates", state.live ? "live" : "cached", () => loadRates());
    item("Add gold and silver", state.order.includes("XAU") ? "in the list" : "spot, by the ounce", () => {
      ["XAU", "XAG"].forEach((c) => { if (!state.order.includes(c)) state.order.push(c); });
      saveState(); renderList();
      toast("Gold and silver added");
    });
    item("Reset the list", state.order.length + " rows", () => {
      state.order = [...DEFAULT_ORDER]; state.pinned = ["LBP"]; saveState(); renderList(); toast("List reset");
    });
    item("Install on this phone", "works offline", () => {
      if (installEvent) installEvent.prompt();
      else toast("Browser menu → Add to Home screen");
    });
    item("About", VERSION, () => toast("Rates: open.er-api · gold: gold-api · chart: ECB"));
  }
  $("moreMenu").addEventListener("click", () => { renderMenu(); sheetOpen("menu"); });
  $("menuClose").addEventListener("click", () => sheetClose("menu"));

  $("addRow").addEventListener("click", () => {
    openPicker({
      title: "Add to the list",
      codes: Object.keys(CAT).filter((c) => !state.order.includes(c)),
      onPick: (code) => {
        state.order.push(code);
        saveState(); renderList();
        toast(code + " added");
      },
    });
  });

  /* ── screens ─────────────────────────────────────────────────────────────── */
  function setScreen(screen) {
    state.screen = screen;
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + screen));
    document.querySelectorAll(".dock-tab").forEach((t) => t.classList.toggle("active", t.dataset.screen === screen));
    window.scrollTo({ top: 0 });
    if (screen === "chart" && window.ChartView) window.ChartView.show();
    if (screen === "count" && window.CountView) window.CountView.render();
    saveState();
  }
  document.querySelectorAll(".dock-tab").forEach((b) => b.addEventListener("click", () => setScreen(b.dataset.screen)));

  function renderAll() {
    paintStatus();
    renderList();
    if (window.CountView) window.CountView.render();
    if (window.ChartView) window.ChartView.paintHeader();
  }

  /* ── install + offline shell ─────────────────────────────────────────────── */
  let installEvent = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e;
    $("installBanner").hidden = false;
  });
  $("installBanner").addEventListener("click", async () => {
    if (!installEvent) { toast("Browser menu → Add to Home screen"); return; }
    installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") { $("installBanner").hidden = true; toast("Installed"); }
    installEvent = null;
  });
  window.addEventListener("appinstalled", () => { $("installBanner").hidden = true; });

  window.addEventListener("online", () => { toast("Back online"); loadRates(); });
  window.addEventListener("offline", () => { paintStatus(); toast("Offline · last known rates"); });
  /**
   * Metals only, on the provider's own clock: gold-api publishes once every 30 s, so polling faster
   * reads the same number and polling at all in a hidden tab is battery for nothing.
   */
  let metalsTimer = null;
  async function refreshMetals() {
    if (navigator.onLine === false) return;
    try {
      const [gold, silver] = await Promise.all([
        fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("https://api.gold-api.com/price/XAG", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      const quotes = {};
      if (gold && gold.price > 0) quotes.XAU = quoteOf(gold);
      if (silver && silver.price > 0) quotes.XAG = quoteOf(silver);
      const moved = applyMetals(quotes, Date.now());
      if (moved.length) {
        saveState();
        moved.forEach(paintMetalRow);
        paintStatus();
      }
    } catch (err) { /* a blink leaves the last price and its age alone */ }
  }

  function startMetalsLoop() {
    stopMetalsLoop();
    metalsTimer = setInterval(() => { if (!document.hidden) refreshMetals(); }, M.PROVIDER_PERIOD_MS);
  }
  function stopMetalsLoop() {
    if (metalsTimer) clearInterval(metalsTimer);
    metalsTimer = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMetalsLoop();
      return;
    }
    refreshMetals();
    startMetalsLoop();
    if (Date.now() - state.updated > 5 * 60 * 1000) loadRates();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    let hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) { hadController = true; return; }
      toast("New version ready — reopen the app");
    });
  }

  /* ── expose + boot ───────────────────────────────────────────────────────── */
  window.App = {
    state, CAT, DENOMS, FLAG, VERSION, flagOf, nameOf, symOf,    money, money2, whole, signed, signedWhole,
    perUsd, convert, toUsd, evaluate, toast, saveState, setScreen,
    sheetOpen, sheetClose, openKeypad, openPicker, renderAll, renderList, loadRates,
    // Exposed for the ticker's own use and for the browser checks that drive a price move.
    applyMetals, paintMetalRow, metalsFeedState,
  };

  loadState();
  renderAll();
  setScreen(state.screen || "convert");
  loadRates();
  startMetalsLoop();
})();
/* Chart — daily ECB reference rates, laid out like the app's own chart screen.
 *
 * Title reads "USD per 1 EUR", the swap lives in the header, periods sit under the line and the pair
 * pills under those. The ECB publishes ~30 currencies; anything else says so instead of inventing a
 * past, and a range with only two closes says why the line looks like a straight segment.
 */
(() => {
  const A = window.App;
  const W = 360, H = 200, PAD = { l: 2, r: 2, t: 12, b: 10 };
  const s = () => A.state.chart;

  let supported = null, series = [], loading = false, lastCount = 0;

  const nf = (v) => {
    const abs = Math.abs(v);
    const dec = abs >= 1000 ? 0 : abs >= 10 ? 2 : 4;
    return v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };

  const DAYS = { "1D": 4, "1W": 10, "1M": 31, "3M": 92, "6M": 183, "1Y": 366, "2Y": 731 };
  const startFor = (period) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS[period] || 92));
    return d.toISOString().slice(0, 10);
  };

  async function ensureSupported() {
    if (supported) return supported;
    const res = await fetch("https://api.frankfurter.dev/v1/currencies");
    const map = await res.json();
    supported = Object.keys(map).sort();
    return supported;
  }

  function paintHeader() {
    const { base, quote } = s();
    document.getElementById("chartTitle").textContent = quote + " per 1 " + base;
    document.getElementById("chartBase").textContent = base;
    document.getElementById("chartQuote").textContent = quote;
    document.getElementById("chartBaseFlag").textContent = A.flagOf(base) || "¤";
    document.getElementById("chartQuoteFlag").textContent = A.flagOf(quote) || "¤";
    document.querySelectorAll(".period").forEach((b) => b.classList.toggle("active", b.dataset.period === s().period));
  }

  function say(text) {
    const box = document.getElementById("chartEmpty");
    box.hidden = false;
    box.textContent = text;
    document.getElementById("chartLast").textContent = "—";
    document.getElementById("chartDelta").textContent = "";
    document.getElementById("chartNote").textContent = "no series";
    series = [];
  }
  const clearSay = () => { document.getElementById("chartEmpty").hidden = true; };

  async function load() {
    const { base, quote, period } = s();
    paintHeader();
    if (base === quote) { say("Pick two different currencies — a currency against itself is a straight line."); return; }
    loading = true;
    document.getElementById("chartSubtitle").textContent = "loading…";
    try {
      await ensureSupported();
      const missing = [base, quote].filter((c) => !supported.includes(c));
      if (missing.length) {
        say(missing.join(" and ") + (missing.length > 1 ? " have" : " has") +
          " no daily history at the ECB — the only keyless free source. The live rate is on the Convert tab; " +
          "this screen will not make up a past for it.");
        document.getElementById("chartSubtitle").textContent = "Not published by the ECB";
        return;
      }
      const end = new Date().toISOString().slice(0, 10);
      const url = "https://api.frankfurter.dev/v1/" + startFor(period) + ".." + end +
        "?base=" + encodeURIComponent(base) + "&symbols=" + encodeURIComponent(quote);
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const rates = data.rates || {};
      series = Object.keys(rates).sort()
        .map((day) => ({ at: day, value: rates[day][quote] }))
        .filter((p) => Number.isFinite(p.value));
      if (!series.length) { say("The ECB returned no quotes for this pair in this range."); return; }
      clearSay();
      draw(period);
      document.getElementById("chartSubtitle").textContent = "Daily reference rates · ECB";
    } catch (err) {
      document.getElementById("chartSubtitle").textContent = "Could not reach the ECB";
      if (!series.length) say("No series to show, and this build keeps no copy of the prices.");
    } finally {
      loading = false;
    }
  }

  function draw(period) {
    const svg = document.getElementById("chart");
    const { base, quote } = s();
    const values = series.map((p) => p.value);
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || Math.max(max * 0.01, 0.0001);
    const lo = min - span * 0.14, hi = max + span * 0.14;
    const x = (i) => PAD.l + (i / Math.max(1, series.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

    const pts = series.map((p, i) => [x(i), y(p.value)]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" ");
    const area = line + " L" + pts[pts.length - 1][0].toFixed(2) + " " + (H - PAD.b) + " L" + pts[0][0].toFixed(2) + " " + (H - PAD.b) + " Z";
    const last = series[series.length - 1], first = series[0];
    const up = last.value >= first.value;
    const colour = up ? "#00D632" : "#FF453A";

    svg.innerHTML = `
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${colour}" stop-opacity=".26"/>
          <stop offset="100%" stop-color="${colour}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#fill)"/>
      <path d="${line}" fill="none" stroke="${colour}" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${pts[pts.length - 1][0].toFixed(2)}" cy="${pts[pts.length - 1][1].toFixed(2)}" r="3.2" fill="${colour}"/>
      <line id="scrubLine" x1="0" y1="${PAD.t}" x2="0" y2="${H - PAD.b}" stroke="#55555C" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>
      <circle id="scrubDot" cx="0" cy="0" r="3.6" fill="#fff" opacity="0"/>
    `;

    document.getElementById("chartLast").textContent = nf(last.value);
    const change = ((last.value - first.value) / first.value) * 100;
    const delta = document.getElementById("chartDelta");
    delta.textContent = (change >= 0 ? "↑ " : "↓ ") + Math.abs(change).toFixed(4) + "%";
    delta.className = "quote-delta " + (change >= 0 ? "up" : "down");
    document.getElementById("chartNote").textContent =
      "1 " + base + " = " + nf(last.value) + " " + quote + " · " +
      new Date(last.at + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    if (series.length < 6) {
      const box = document.getElementById("chartEmpty");
      box.hidden = false;
      box.textContent = "Daily closes only: this range has " + series.length +
        " published points, so the line is short by nature, not by a missing download.";
    }
    lastCount = series.length;
    attachScrub(x, y);
  }

  function attachScrub(x, y) {
    const wrap = document.getElementById("chartWrap");
    const svg = document.getElementById("chart");
    const tip = document.getElementById("scrubTip");

    const move = (clientX) => {
      if (!series.length) return;
      const rect = svg.getBoundingClientRect();
      const rel = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const i = Math.round(rel * (series.length - 1));
      const point = series[i];
      const line = document.getElementById("scrubLine");
      const dot = document.getElementById("scrubDot");
      if (line) { line.setAttribute("x1", x(i)); line.setAttribute("x2", x(i)); line.setAttribute("opacity", "1"); }
      if (dot) { dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(point.value)); dot.setAttribute("opacity", "1"); }
      tip.classList.add("show");
      tip.style.left = Math.min(rect.width - 70, Math.max(70, (x(i) / W) * rect.width)) + "px";
      tip.textContent = new Date(point.at + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " · " + nf(point.value);
    };
    const clear = () => {
      tip.classList.remove("show");
      const line = document.getElementById("scrubLine"), dot = document.getElementById("scrubDot");
      if (line) line.setAttribute("opacity", "0");
      if (dot) dot.setAttribute("opacity", "0");
    };

    wrap.onpointerdown = (e) => {
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* no capture: scrubbing still works */ }
      move(e.clientX);
    };
    wrap.onpointermove = (e) => { if (e.buttons || e.pointerType === "touch") move(e.clientX); };
    wrap.onpointerup = (e) => { move(e.clientX); setTimeout(clear, 1500); };
    wrap.onpointerleave = clear;
  }

  async function pick(which) {
    await ensureSupported();
    A.openPicker({
      title: which === "base" ? "Chart from" : "Chart to",
      codes: supported,
      onPick: (code) => {
        s()[which] = code;
        if (s().base === s().quote) s()[which === "base" ? "quote" : "base"] = code === "USD" ? "EUR" : "USD";
        A.saveState();
        paintHeader();
        load();
      },
    });
  }

  document.getElementById("pickBase").addEventListener("click", () => pick("base"));
  document.getElementById("pickQuote").addEventListener("click", () => pick("quote"));
  document.getElementById("swapPair").addEventListener("click", () => {
    const c = s(); const t = c.base; c.base = c.quote; c.quote = t;
    A.saveState(); paintHeader(); load();
  });
  document.querySelectorAll(".period").forEach((b) => b.addEventListener("click", () => {
    s().period = b.dataset.period;
    A.saveState(); paintHeader(); load();
  }));

  window.ChartView = {
    show() { paintHeader(); if (!series.length && !loading) load(); },
    paintHeader,
    onRates() { /* ECB-only: the live fiat table does not feed this screen */ },
  };
})();
/* Count — the app's own bag, on the web.
 *
 * One container, one section per currency, a capsule stepper, notes only, and a breakdown that shows
 * every currency's own money next to its dollar value inside the total card. The expected amount is
 * typed in place and answered with ✓ Match / Short / Over as you count.
 */
(() => {
  const A = window.App;
  const c = () => A.state.count;

  const lineValue = (code, denom) => (c().counts[code]?.[denom] || 0) * denom;
  const localTotal = (code) => (A.DENOMS[code] || []).reduce((sum, d) => sum + lineValue(code, d), 0);
  const noteCount = (code) => (A.DENOMS[code] || []).reduce((sum, d) => sum + (c().counts[code]?.[d] || 0), 0);

  function totals() {
    let usd = 0, notes = 0, withMoney = 0;
    c().bag.forEach((code) => {
      const local = localTotal(code);
      if (local > 0) withMoney += 1;
      usd += A.toUsd(local, code);
      notes += noteCount(code);
    });
    return { usd, notes, currencies: withMoney };
  }

  const setCount = (code, denom, n) => {
    c().counts[code] = c().counts[code] || {};
    if (n <= 0) delete c().counts[code][denom];
    else c().counts[code][denom] = n;
    A.saveState();
    render();
  };

  function badgeFor(code) {
    const b = document.createElement("div");
    b.className = "badge";
    const f = A.flagOf(code);
    if (f) { b.classList.add("flag"); b.textContent = f; }
    else { b.classList.add("fiat"); b.textContent = A.symOf(code) || code; }
    return b;
  }

  /* ── one currency inside the bag ─────────────────────────────────────────── */
  function sectionFor(code) {
    const section = document.createElement("div");
    section.className = "cur-section" + (c().collapsed.includes(code) ? " collapsed" : "");

    const head = document.createElement("div");
    head.className = "cur-head";
    head.appendChild(badgeFor(code));

    const titles = document.createElement("div");
    titles.className = "cur-titles";
    titles.appendChild(Object.assign(document.createElement("div"), { className: "c1", textContent: code }));
    const notes = noteCount(code);
    titles.appendChild(Object.assign(document.createElement("div"), {
      className: "c2", textContent: A.nameOf(code) + " · " + notes + (notes === 1 ? " note" : " notes"),
    }));
    head.appendChild(titles);

    const total = document.createElement("div");
    total.className = "cur-total";
    total.appendChild(Object.assign(document.createElement("div"), {
      className: "t1", textContent: A.signedWhole(code, localTotal(code)),
    }));
    total.appendChild(Object.assign(document.createElement("div"), {
      className: "t2", textContent: "$" + A.money2(A.toUsd(localTotal(code), code)),
    }));
    head.appendChild(total);
    head.appendChild(Object.assign(document.createElement("div"), { className: "chev", textContent: "▾" }));

    head.addEventListener("click", () => {
      const i = c().collapsed.indexOf(code);
      if (i >= 0) c().collapsed.splice(i, 1); else c().collapsed.push(code);
      A.saveState();
      render();
    });
    section.appendChild(head);

    const body = document.createElement("div");
    body.className = "cur-body";
    (A.DENOMS[code] || []).forEach((denom) => body.appendChild(rowFor(code, denom)));
    section.appendChild(body);

    const foot = document.createElement("div");
    foot.className = "cur-foot";
    const rate = A.perUsd(code);
    foot.appendChild(Object.assign(document.createElement("span"), {
      textContent: code === "USD" ? "1 USD = 1.0000 USD" : rate ? "1 USD = " + A.money(rate) + " " + code : "no rate",
    }));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      if (c().bag.length === 1) { A.toast("Keep at least one currency in the bag"); return; }
      c().bag = c().bag.filter((x) => x !== code);
      delete c().counts[code];
      A.saveState();
      render();
    });
    foot.appendChild(remove);
    section.appendChild(foot);

    return section;
  }

  function rowFor(code, denom) {
    const row = document.createElement("div");
    row.className = "note-row";

    const label = document.createElement("div");
    label.className = "denom";
    label.appendChild(Object.assign(document.createElement("div"), {
      className: "d1",
      textContent: (A.symOf(code) && !/^[A-Z]{3}$/.test(A.symOf(code)) ? A.symOf(code) : "") + denom.toLocaleString("en-US"),
    }));
    label.appendChild(Object.assign(document.createElement("div"), { className: "d2", textContent: "banknote" }));

    const n = c().counts[code]?.[denom] || 0;
    const stepper = document.createElement("div");
    stepper.className = "stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "step";
    minus.textContent = "−";
    minus.disabled = n === 0;
    minus.addEventListener("click", () => setCount(code, denom, n - 1));

    const value = document.createElement("div");
    value.className = "count-val";
    value.textContent = n;
    value.title = "Tap to type";
    value.addEventListener("click", () => typeQuantity(code, denom, n));

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "step plus";
    plus.textContent = "+";
    let hold, longFired = false;
    plus.addEventListener("pointerdown", () => {
      longFired = false;
      hold = setTimeout(() => { hold = null; longFired = true; typeQuantity(code, denom, n); }, 450);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
      plus.addEventListener(ev, () => { if (hold) { clearTimeout(hold); hold = null; } }));
    plus.addEventListener("click", () => {
      if (longFired) { longFired = false; return; }
      setCount(code, denom, n + 1);
    });

    stepper.append(minus, value, plus);
    row.append(label, stepper);

    const amount = lineValue(code, denom);
    const line = document.createElement("div");
    line.className = "line-total" + (amount ? "" : " zero");
    line.textContent = amount ? A.signedWhole(code, amount) : "—";
    row.appendChild(line);
    return row;
  }

  function typeQuantity(code, denom, current) {
    A.openKeypad({
      code,
      title: A.nameOf(code) + " · " + A.symOf(code) + denom.toLocaleString("en-US"),
      subtitle: "how many notes",
      initial: current, mode: "quantity", confirm: "Set",
      onCommit: (v) => setCount(code, denom, Math.round(v)),
    });
  }

  /* ── the total card ──────────────────────────────────────────────────────── */
  function renderTotal() {
    const t = totals();
    const cents = Math.round(t.usd * 100);
    document.getElementById("countInt").textContent = Math.floor(cents / 100).toLocaleString("en-US");
    document.getElementById("countCents").textContent = "." + String(cents % 100).padStart(2, "0");
    document.getElementById("countMeta").textContent =
      t.notes + (t.notes === 1 ? " note" : " notes") + " · " + t.currencies + (t.currencies === 1 ? " currency" : " currencies");

    const breakdown = document.getElementById("countBreakdown");
    breakdown.innerHTML = "";
    c().bag.forEach((code) => {
      const local = localTotal(code);
      if (!local) return;
      const row = document.createElement("div");
      row.className = "bd";
      row.appendChild(Object.assign(document.createElement("span"), { className: "code", textContent: code }));
      row.appendChild(Object.assign(document.createElement("span"), { className: "loc", textContent: A.signedWhole(code, local) }));
      row.appendChild(Object.assign(document.createElement("span"), { className: "eq", textContent: "→" }));
      row.appendChild(Object.assign(document.createElement("span"), { className: "usd", textContent: "$" + A.money2(A.toUsd(local, code)) }));
      breakdown.appendChild(row);
    });

    const chip = document.getElementById("verdictChip");
    const exp = c().expected;
    if (!exp || exp <= 0) { chip.textContent = "—"; chip.className = "chip-v"; }
    else {
      const diff = t.usd - exp;
      if (Math.abs(diff) < 0.005) { chip.textContent = "✓ Match"; chip.className = "chip-v match"; }
      else if (diff < 0) { chip.textContent = "Short $" + A.money2(-diff); chip.className = "chip-v short"; }
      else { chip.textContent = "Over $" + A.money2(diff); chip.className = "chip-v over"; }
    }
    document.getElementById("countSave").disabled = t.usd <= 0;
  }

  function render() {
    const bag = document.getElementById("bag");
    bag.innerHTML = "";
    c().bag.forEach((code) => bag.appendChild(sectionFor(code)));
    renderTotal();

    // The expected figure is a line of text, not a form field: tapping it opens the app's own keypad.
    const label = document.getElementById("expectedLabel");
    label.innerHTML = "";
    label.appendChild(document.createTextNode("Expected $"));
    label.appendChild(Object.assign(document.createElement("b"), {
      textContent: c().expected ? A.money2(c().expected) : "—",
    }));
    label.onclick = () => A.openKeypad({
      code: "USD", title: "Expected in the bag", subtitle: "compared with the count",
      initial: c().expected || 0, mode: "quantity", confirm: "Set",
      onCommit: (v) => { c().expected = v > 0 ? v : null; A.saveState(); render(); },
    });

    const newest = c().history[0];
    document.getElementById("countFoot").textContent = newest
      ? "Last saved " + new Date(newest.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "Nothing saved yet · Save keeps the exact notes so Restore can rebuild the bag";
  }

  /* ── actions ─────────────────────────────────────────────────────────────── */
  document.getElementById("countClear").addEventListener("click", () => {
    c().counts = {};
    A.saveState();
    render();
    A.toast("Bag cleared");
  });

  document.getElementById("countSave").addEventListener("click", () => {
    const t = totals();
    if (t.usd <= 0) { A.toast("Count something first"); return; }
    c().history.unshift({
      at: Date.now(), totalUsd: t.usd, notes: t.notes,
      bag: [...c().bag], counts: JSON.parse(JSON.stringify(c().counts)),
    });
    c().history = c().history.slice(0, 40);
    A.saveState();
    render();
    A.toast("Saved · $" + A.money2(t.usd));
  });

  document.getElementById("countHistory").addEventListener("click", () => {
    const list = document.getElementById("historyList");
    list.innerHTML = "";
    if (!c().history.length) {
      list.appendChild(Object.assign(document.createElement("div"), {
        className: "empty", textContent: "No saved counts yet. Count a bag and press Save — the stacks come back exactly as you left them.",
      }));
    }
    c().history.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "hist";
      const left = document.createElement("div");
      left.appendChild(Object.assign(document.createElement("div"), { className: "h1", textContent: "$" + A.money2(entry.totalUsd) }));
      left.appendChild(Object.assign(document.createElement("div"), {
        className: "h2",
        textContent: new Date(entry.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) +
          " · " + entry.notes + " notes · " + entry.bag.join(" "),
      }));
      row.appendChild(left);

      const right = document.createElement("div");
      right.className = "h3";
      const restore = document.createElement("button");
      restore.type = "button";
      restore.className = "mini";
      restore.textContent = "Restore";
      restore.addEventListener("click", () => {
        c().bag = [...entry.bag];
        c().counts = JSON.parse(JSON.stringify(entry.counts));
        A.saveState();
        render();
        A.sheetClose("history");
        A.toast("Restored · $" + A.money2(entry.totalUsd));
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "mini";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        c().history.splice(index, 1);
        A.saveState();
        A.sheetClose("history");
        document.getElementById("countHistory").click();
        render();
      });
      right.append(restore, del);
      row.appendChild(right);
      list.appendChild(row);
    });
    A.sheetOpen("history");
  });
  document.getElementById("historyClose").addEventListener("click", () => A.sheetClose("history"));

  document.getElementById("addCurrency").addEventListener("click", () => {
    A.openPicker({
      title: "Add to the bag",
      codes: Object.keys(A.DENOMS).filter((code) => !c().bag.includes(code)),
      onPick: (code) => {
        c().bag.push(code);
        A.saveState();
        render();
        A.toast(code + " added to the bag");
      },
    });
  });

  document.getElementById("countRates").addEventListener("click", () => A.loadRates());

  window.CountView = { render };
})();
