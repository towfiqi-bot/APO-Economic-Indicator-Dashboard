/* app.js - APO Economic Indicator Dashboard (FINAL)
   - Public: read-only (no CSV/JSON loaders visible)
   - Admin (admin.html): CSV/JSON loaders + download updated data.js
*/

const SOURCE_LABEL = "Source: Data_Master (Databook 2025 + Readiness 2025)";
const IS_ADMIN = !!window.APO_ADMIN;

/** -------- Defaults (fallback indicator defs) -------- */
const DEFAULT_INDICATORS = [
  { id:"GDP_PPP_2023_bn", label:"GDP in 2023 (Billion USD, 2023)", unit:"Billion USD", fmt:"0,0" },
  { id:"GDP_growth_2223_pct", label:"GDP growth (%, 2022–23)", unit:"Percent", fmt:"0.0", proj:"GDP_growth_proj_2530_pct" },
  { id:"GDPpc_PPP_2023_kUSD", label:"Per capita GDP in 2023 (Thousand USD, 2023)", unit:"Thousand USD", fmt:"0.0" },
  { id:"Population_2022_m", label:"Population (million, 2022)", unit:"Million", fmt:"0.0" },
  { id:"Employment_2023_thousand", label:"Number of employment (Thousands persons, 2023)", unit:"Thousand persons", fmt:"0,0" },
  { id:"Employment_rate_2023_pct", label:"Employment rate (2023)", unit:"Percent", fmt:"0.0" },
  { id:"LP_level_per_worker_2023_kUSD", label:"Per-worker labor productivity level (Thousand USD per worker, 2023)", unit:"Thousand USD", fmt:"0.0" },
  { id:"LP_growth_2223_pct", label:"Per-worker labor productivity growth (%, 2022–23)", unit:"Percent", fmt:"0.0", proj:"LP_growth_proj_2530_pct" },
  { id:"Agri_share_GDP_2023_pct", label:"Agriculture share in GDP (2023)", unit:"Percent", fmt:"0.0" },
  { id:"Mfg_share_GDP_2023_pct", label:"Manufacturing share in GDP (2023)", unit:"Percent", fmt:"0.0" },
  { id:"Capital_prod_growth_2223_pct", label:"Capital productivity growth (2022–23)", unit:"Percent", fmt:"0.0", proj:"Capital_prod_growth_proj_2530_pct" },
  { id:"TFP_growth_2223_pct", label:"TFP growth (2022–23)", unit:"Percent", fmt:"0.0", proj:"TFP_growth_proj_2530_pct" },
];

/** -------- Helpers -------- */
const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

function deepClone(x){ return JSON.parse(JSON.stringify(x)); }
function isNum(x){ return typeof x === "number" && Number.isFinite(x); }

function loadLS(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  }catch(_){ return fallback; }
}
function saveLS(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){}
}

function fmtNumber(x, decimals=null){
  if(!isNum(x)) return "–";
  if(decimals === null) return x.toLocaleString();
  return x.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** -------- Data -------- */
const PACKAGED = Array.isArray(window.APO_DATA) ? window.APO_DATA : [];
let DATA = deepClone(PACKAGED);

const PACKAGED_INDICATORS = Array.isArray(window.APO_INDICATORS)
  ? window.APO_INDICATORS
  : DEFAULT_INDICATORS;

let INDICATORS = deepClone(PACKAGED_INDICATORS);

const state = {
  view:"summary",
  indicatorId:null,
  country:"",
  mode:"all",       // data | projection | all
  sort:"highest",   // highest | lowest | alpha
  search:"",
  theme: loadLS("apo_theme", "violet") || "violet",
  sourceFile: (window.APO_META && window.APO_META.source_file) ? window.APO_META.source_file : "Data_Master"
};

if(IS_ADMIN){
  const saved = loadLS("apo_indicator_defs_v1", null);
  if(Array.isArray(saved) && saved.length) INDICATORS = saved;
}

/** -------- Indicator management -------- */
function getIndicator(id){ return INDICATORS.find(x=>x.id === id) || null; }

function economiesAll(){
  const s = new Set();
  DATA.forEach(r=>{ if(r && r.Economy) s.add(r.Economy); });
  return Array.from(s).sort((a,b)=>a.localeCompare(b));
}

function updateCounts(){
  const n = economiesAll().length;
  const el = $("#economyCount");
  if(el) el.textContent = n.toString();
  const src = $("#sourceLabel");
  if(src) src.textContent = SOURCE_LABEL;
}

/* Extend indicators (in memory) if new numeric columns exist */
function autoExtendIndicatorsFromData(){
  if(!DATA.length) return;
  const known = new Set(INDICATORS.map(x=>x.id));
  const cols = Object.keys(DATA[0] || {});
  const extra = [];
  cols.forEach(c=>{
    if(c === "Economy") return;
    if(known.has(c)) return;
    const anyNum = DATA.some(r => isNum(r[c]));
    if(!anyNum) return;
    extra.push({ id:c, label:c, unit:"", fmt:"0.0" });
  });
  if(extra.length){
    INDICATORS = INDICATORS.concat(extra);
    if(IS_ADMIN) saveLS("apo_indicator_defs_v1", INDICATORS);
  }
}

/** -------- Theme -------- */
function setTheme(theme){
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  saveLS("apo_theme", theme);
  $$("#themeSeg .segBtn").forEach(b=> b.classList.toggle("active", b.dataset.theme === theme));
}

/** -------- Navigation -------- */
function setActiveNav(view){
  $$(".navItem").forEach(b => b.classList.toggle("active", b.dataset.view === view));
}

function setCrumbs(view){
  const map = { summary:"Summary", indicators:"Indicators", profile:"Country profile", data:"Data" };
  const el = $("#crumbs");
  if(el) el.textContent = map[view] || "Summary";
}

function switchView(view){
  state.view = view;
  setActiveNav(view);
  setCrumbs(view);

  $$(".view").forEach(v => v.classList.add("hidden"));
  const target = $("#view-" + view);
  if(target) target.classList.remove("hidden");

  renderAll();
}

/** -------- Sidebar indicators -------- */
function renderIndicatorList(){
  const wrap = $("#indicatorList");
  if(!wrap) return;
  wrap.innerHTML = "";

  INDICATORS.forEach(ind=>{
    const b = document.createElement("button");
    b.className = "indBtn" + (state.indicatorId === ind.id ? " active" : "");
    b.textContent = ind.label;
    b.addEventListener("click", ()=>{
      state.indicatorId = ind.id;
      renderIndicatorList();
      if(state.view !== "indicators") switchView("indicators");
      else renderIndicators();
    });
    wrap.appendChild(b);
  });
}

/** -------- Summary -------- */
function sumIndicator(id){
  let s = 0;
  DATA.forEach(r=>{
    const v = r ? r[id] : null;
    if(isNum(v)) s += v;
  });
  return s;
}
function avgIndicator(id){
  let s=0, n=0;
  DATA.forEach(r=>{
    const v = r ? r[id] : null;
    if(isNum(v)){ s += v; n += 1; }
  });
  return n ? (s/n) : null;
}

function medianIndicator(id){
  const vals = [];
  DATA.forEach(r=>{
    const v = r ? r[id] : null;
    if(isNum(v)) vals.push(v);
  });
  if(!vals.length) return null;
  vals.sort((a,b)=>a-b);
  const mid = Math.floor(vals.length / 2);
  if(vals.length % 2) return vals[mid];
  return (vals[mid-1] + vals[mid]) / 2;
}

function minMaxIndicator(id){
  let min = null, max = null;
  DATA.forEach(r=>{
    const v = r ? r[id] : null;
    if(!isNum(v)) return;
    if(min === null || v < min) min = v;
    if(max === null || v > max) max = v;
  });
  return { min, max };
}

function argmaxEconomy(id){
  let best = null;
  DATA.forEach(r=>{
    const v = r ? r[id] : null;
    if(!isNum(v) || !r.Economy) return;
    if(!best || v > best.v) best = { name: r.Economy, v };
  });
  return best;
}

function argminEconomy(id){
  let best = null;
  DATA.forEach(r=>{
    const v = r ? r[id] : null;
    if(!isNum(v) || !r.Economy) return;
    if(!best || v < best.v) best = { name: r.Economy, v };
  });
  return best;
}

function renderSummary(){
  const root = $("#view-summary");
  if(!root) return;

  const gdp = sumIndicator("GDP_PPP_2023_bn");
  const gdpGrowth = avgIndicator("GDP_growth_2223_pct");
  const tfp = avgIndicator("TFP_growth_2223_pct");

  // ---- Summary helpers (no hard-coded values; everything computed from DATA columns) ----
  function findIndicatorDefAny(id){
    for(let i=0;i<INDICATORS.length;i++){
      const d = INDICATORS[i];
      if(!d) continue;
      if(d.id === id) return d;
      if(d.proj === id) return d;
    }
    return null;
  }
  function decimalsFromFmt(fmt){
    if(typeof fmt !== "string") return 1;
    const m = fmt.match(/\.(0+)/);
    return m ? m[1].length : 0;
  }
  function sortedNumeric(id){
    return DATA
      .map(r=>({ name: r && r.Economy, v: r ? r[id] : null }))
      .filter(x=>x.name && isNum(x.v));
  }
  function leaderboard(id){
    const rows = sortedNumeric(id);
    const n = rows.length;
    if(!n) return { top:[], bottom:[], min:null, max:null, n:0 };
    let min = rows[0].v, max = rows[0].v;
    rows.forEach(x=>{ if(x.v < min) min = x.v; if(x.v > max) max = x.v; });
    const desc = rows.slice().sort((a,b)=>b.v-a.v);
    const asc  = rows.slice().sort((a,b)=>a.v-b.v);
    const k = Math.min(5, n);
    return { top: desc.slice(0,k), bottom: asc.slice(0,k), min, max, n };
  }
  function barWidth(v, min, max){
    if(!isNum(v) || !isNum(min) || !isNum(max) || max === min) return 100;
    const t = (v - min) / (max - min);
    const pct = 12 + (t * 88);
    return Math.max(12, Math.min(100, Math.round(pct)));
  }
  function rankItemsHtml(items, id, min, max){
    const def = findIndicatorDefAny(id);
    const dec = def ? decimalsFromFmt(def.fmt) : 1;
    if(!items || !items.length) return `<div class="rankEmpty">—</div>`;
    return items.map((it, i)=>{
      const w = barWidth(it.v, min, max);
      return `
        <div class="rankItem" data-economy="${escapeHtml(it.name)}">
          <div class="rankNum">${i+1}</div>
          <div class="rankName" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>
          <div class="rankVal mono">${fmtNumber(it.v, dec)}</div>
          <div class="rankBarWrap" aria-hidden="true"><div class="rankBar" style="width:${w}%"></div></div>
        </div>
      `;
    }).join("");
  }
  function rankCardHtml(id, opts){
    opts = opts || {};
    const def = findIndicatorDefAny(id) || { label: id, unit: "" };
    const title = opts.title || def.label || id;

    const lb = leaderboard(id);
    const metaBits = [];
    if(def.unit) metaBits.push(def.unit);
    if(opts.meta) metaBits.push(opts.meta);
    metaBits.push(`n=${lb.n}`);

    return `
      <div class="rankCard">
        <div class="rankHeader">
          <div class="rankTitle">${escapeHtml(title)}</div>
          <div class="rankMeta">${escapeHtml(metaBits.join(" · "))}</div>
        </div>
        <div class="rankCols">
          <div class="rankCol">
            <div class="rankColTitle">Top 5</div>
            ${rankItemsHtml(lb.top, id, lb.min, lb.max)}
          </div>
          <div class="rankCol">
            <div class="rankColTitle">Bottom 5</div>
            ${rankItemsHtml(lb.bottom, id, lb.min, lb.max)}
          </div>
        </div>
      </div>
    `;
  }

  function goProfile(economy){
    if(!economy) return;
    state.country = economy;
    switchView("profile");
  }

  // ---- Signals & alerts ----
  const sigLargestGdp = argmaxEconomy("GDP_PPP_2023_bn");
  const sigHighestLp = argmaxEconomy("LP_level_per_worker_2023_kUSD");
  const sigHighestTfp = argmaxEconomy("TFP_growth_2223_pct");
  const sigFastGdpProj = argmaxEconomy("GDP_growth_proj_2530_pct");
  const sigTfpMomentumProj = argmaxEconomy("TFP_growth_proj_2530_pct");

  // ---- Aggregates ----
  const avgLp = avgIndicator("LP_level_per_worker_2023_kUSD");
  const medLp = medianIndicator("LP_level_per_worker_2023_kUSD");
  const avgGdpProj = avgIndicator("GDP_growth_proj_2530_pct");
  const avgTfpProj = avgIndicator("TFP_growth_proj_2530_pct");
  const gdpRows = sortedNumeric("GDP_PPP_2023_bn").sort((a,b)=>b.v-a.v);
  const totalGdp = gdpRows.reduce((s,x)=>s+x.v,0);
  const top5Share = (gdpRows.length && totalGdp) ? (gdpRows.slice(0,5).reduce((s,x)=>s+x.v,0) / totalGdp) : null;

  // ---- Gap to frontier (LP level) ----
  const frontier = sigHighestLp;
  const bottom = argminEconomy("LP_level_per_worker_2023_kUSD");
  const economies = economiesAll();
  const defaultCompare = (bottom && bottom.name) ? bottom.name : (economies[0] || "");

  // ---- Quadrant snapshot (default axes) ----
  const QUAD_X_DEFAULT = "GDPpc_PPP_2023_kUSD";
  const QUAD_Y_DEFAULT = "LP_level_per_worker_2023_kUSD";
  const quadX = QUAD_X_DEFAULT;
  const quadY = QUAD_Y_DEFAULT;
  const quadXDef = findIndicatorDefAny(quadX);
  const quadYDef = findIndicatorDefAny(quadY);
  const quadXMM = minMaxIndicator(quadX);
  const quadYMM = minMaxIndicator(quadY);

  // ---- Distributions (bin counts) ----
  function binCounts(id, bins){
    // bins: [{label, test(v)}]
    const rows = sortedNumeric(id);
    const counts = bins.map(_=>0);
    rows.forEach(({v})=>{
      for(let i=0;i<bins.length;i++){
        if(bins[i].test(v)){ counts[i] += 1; return; }
      }
    });
    return { n: rows.length, counts };
  }
  const growthBins = [
    { label:"< 0%", test:(v)=>v < 0 },
    { label:"0–2%", test:(v)=>v >= 0 && v < 2 },
    { label:"2–4%", test:(v)=>v >= 2 && v < 4 },
    { label:"4–6%", test:(v)=>v >= 4 && v < 6 },
    { label:"≥ 6%", test:(v)=>v >= 6 },
  ];
  const distGdp = binCounts("GDP_growth_2223_pct", growthBins);
  const distLp  = binCounts("LP_growth_2223_pct", growthBins);
  const distTfp = binCounts("TFP_growth_2223_pct", growthBins);

  function distBarsHtml(dist){
    const maxC = Math.max(1, ...dist.counts);
    return growthBins.map((b, i)=>{
      const c = dist.counts[i];
      const pct = dist.n ? (c / dist.n) : 0;
      const w = Math.round((c / maxC) * 100);
      return `
        <div class="distRow">
          <div class="distLabel">${b.label}</div>
          <div class="distBar"><div class="distFill" style="width:${w}%"></div></div>
          <div class="distVal mono">${c}${dist.n ? ` (${Math.round(pct*100)}%)` : ""}</div>
        </div>
      `;
    }).join("");
  }

  // ---- Rankings snapshot cards ----
  const rankCards = [
    { id:"GDP_PPP_2023_bn" },
    { id:"GDPpc_PPP_2023_kUSD" },
    { id:"Population_2022_m" },
    { id:"LP_level_per_worker_2023_kUSD" },
    { id:"GDP_growth_2223_pct" },
    { id:"LP_growth_2223_pct" },
    { id:"TFP_growth_2223_pct" },
    { id:"GDP_growth_proj_2530_pct", title:"GDP growth (%, 2025–30) (Projection)", meta:"2025–30" },
    { id:"LP_growth_proj_2530_pct", title:"Per-worker labor productivity growth (%, 2025–30) (Projection)", meta:"2025–30" },
    { id:"TFP_growth_proj_2530_pct", title:"TFP growth (%, 2025–30) (Projection)", meta:"2025–30" },
  ];
  const rankHtml = rankCards.map(c=>rankCardHtml(c.id, c)).join("");

  // ---- Quadrant scatter (SVG) ----
  function scale(v, min, max){
    if(!isNum(v) || !isNum(min) || !isNum(max) || max === min) return 0.5;
    return (v - min) / (max - min);
  }
  const pts = DATA
    .map(r=>({
      name: r && r.Economy,
      x: r ? r[quadX] : null,
      y: r ? r[quadY] : null,
      s: r ? r.GDP_PPP_2023_bn : null
    }))
    .filter(p=>p.name && isNum(p.x) && isNum(p.y));

  const sizeMM = minMaxIndicator("GDP_PPP_2023_bn");
  function rFromSize(v){
    if(!isNum(v) || !isNum(sizeMM.min) || !isNum(sizeMM.max) || sizeMM.max === sizeMM.min) return 4;
    const t = (v - sizeMM.min) / (sizeMM.max - sizeMM.min);
    return 3 + (t * 7);
  }

  const svgW = 640, svgH = 360;
  const pad = 28;
  const axis = {
    x0: pad, y0: svgH - pad,
    x1: svgW - pad, y1: pad
  };
  const midX = (axis.x0 + axis.x1)/2;
  const midY = (axis.y0 + axis.y1)/2;

  const dots = pts.map((p, i)=>{
    const tx = scale(p.x, quadXMM.min, quadXMM.max);
    const ty = scale(p.y, quadYMM.min, quadYMM.max);
    const cx = axis.x0 + tx * (axis.x1 - axis.x0);
    const cy = axis.y0 - ty * (axis.y0 - axis.y1);
    const rr = rFromSize(p.s);
    return `<circle class="qDot" data-economy="${escapeHtml(p.name)}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rr.toFixed(1)}">
      <title>${escapeHtml(p.name)}\n${(quadXDef?.label||quadX)}: ${fmtNumber(p.x)}\n${(quadYDef?.label||quadY)}: ${fmtNumber(p.y)}\nGDP: ${isNum(p.s)?fmtNumber(p.s):"–"}</title>
    </circle>`;
  }).join("");

  const quadrantSvg = `
    <svg class="quadSvg" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="Quadrant snapshot scatter">
      <line class="qAxis" x1="${axis.x0}" y1="${axis.y0}" x2="${axis.x1}" y2="${axis.y0}" />
      <line class="qAxis" x1="${axis.x0}" y1="${axis.y0}" x2="${axis.x0}" y2="${axis.y1}" />
      <line class="qMid" x1="${midX}" y1="${axis.y0}" x2="${midX}" y2="${axis.y1}" />
      <line class="qMid" x1="${axis.x0}" y1="${midY}" x2="${axis.x1}" y2="${midY}" />
      <text class="qLabel" x="${axis.x0}" y="${axis.y1-10}">${escapeHtml(quadYDef?.label || quadY)}</text>
      <text class="qLabel" x="${axis.x1}" y="${axis.y0+18}" text-anchor="end">${escapeHtml(quadXDef?.label || quadX)}</text>
      ${dots}
    </svg>
  `;

  // ---- Render ----
  root.innerHTML = `
    <div class="grid">
      <div class="tile clickable" id="tileTotalGdp">
        <div class="tileLabel">Total GDP in 2023 (Billion USD, 2023)</div>
        <div class="tileValue">${fmtNumber(gdp, 1)}T</div>
        <div class="tileSub">PPP-based (Databook convention) · Click to view breakdown</div>
      </div>
      <div class="tile">
        <div class="tileLabel">Avg. GDP growth (2022–23)</div>
        <div class="tileValue">${isNum(gdpGrowth) ? fmtNumber(gdpGrowth, 1) + "%" : "–"}</div>
        <div class="tileSub">Average over economies with available data</div>
      </div>
      <div class="tile">
        <div class="tileLabel">Avg. TFP growth (2022–23)</div>
        <div class="tileValue">${isNum(tfp) ? fmtNumber(tfp, 1) + "%" : "–"}</div>
        <div class="tileSub">Average over economies with available data</div>
      </div>
    </div>

    <div class="card">
      <div class="cardHeader">
        <div>
          <div class="cardTitle">Signals & alerts</div>
          <div class="cardSub">Quick scan of standouts from the latest data (and 2025–30 projections where available). Click a chip to open that economy.</div>
        </div>
      </div>
      <div class="chipRow" id="sigRow">
        <button class="chip" data-economy="${escapeHtml(sigLargestGdp?.name||"")}" ${sigLargestGdp?"":"disabled"}>
          <span class="chipK">Largest economy</span>
          <span class="chipV">${escapeHtml(sigLargestGdp?.name||"–")}</span>
        </button>
        <button class="chip" data-economy="${escapeHtml(sigHighestLp?.name||"")}" ${sigHighestLp?"":"disabled"}>
          <span class="chipK">Highest LP level</span>
          <span class="chipV">${escapeHtml(sigHighestLp?.name||"–")}</span>
        </button>
        <button class="chip" data-economy="${escapeHtml(sigHighestTfp?.name||"")}" ${sigHighestTfp?"":"disabled"}>
          <span class="chipK">Highest TFP growth</span>
          <span class="chipV">${escapeHtml(sigHighestTfp?.name||"–")}</span>
        </button>
        <button class="chip" data-economy="${escapeHtml(sigFastGdpProj?.name||"")}" ${sigFastGdpProj?"":"disabled"}>
          <span class="chipK">Fastest GDP growth (proj.)</span>
          <span class="chipV">${escapeHtml(sigFastGdpProj?.name||"–")}</span>
        </button>
        <button class="chip" data-economy="${escapeHtml(sigTfpMomentumProj?.name||"")}" ${sigTfpMomentumProj?"":"disabled"}>
          <span class="chipK">TFP momentum (proj.)</span>
          <span class="chipV">${escapeHtml(sigTfpMomentumProj?.name||"–")}</span>
        </button>
      </div>
      <div class="cardSub" style="margin-top:10px;">Validation: Each chip is computed by taking the max value of its indicator column across economies.</div>
    </div>

    <div class="summary2col">
      <div class="card">
        <div class="cardTitle">APO aggregates</div>
        <div class="cardSub">Portfolio view across economies.</div>
        <div class="kpiGrid">
          <div class="kpi">
            <div class="kpiK">Avg. LP level</div>
            <div class="kpiV">${isNum(avgLp)?fmtNumber(avgLp,1):"–"}</div>
            <div class="kpiS">kUSD/worker</div>
          </div>
          <div class="kpi">
            <div class="kpiK">Median LP level</div>
            <div class="kpiV">${isNum(medLp)?fmtNumber(medLp,1):"–"}</div>
            <div class="kpiS">kUSD/worker</div>
          </div>
          <div class="kpi">
            <div class="kpiK">Avg. GDP growth (proj.)</div>
            <div class="kpiV">${isNum(avgGdpProj)?fmtNumber(avgGdpProj,1)+"%":"–"}</div>
            <div class="kpiS">2025–30</div>
          </div>
          <div class="kpi">
            <div class="kpiK">Avg. TFP growth (proj.)</div>
            <div class="kpiV">${isNum(avgTfpProj)?fmtNumber(avgTfpProj,1)+"%":"–"}</div>
            <div class="kpiS">2025–30</div>
          </div>
          <div class="kpi">
            <div class="kpiK">Top 5 GDP share</div>
            <div class="kpiV">${isNum(top5Share)?fmtNumber(top5Share*100,1)+"%":"–"}</div>
            <div class="kpiS">of total GDP</div>
          </div>
        </div>
        <div class="cardSub" style="margin-top:10px;">Validation: GDP share = (sum of top-5 <span class="mono">GDP_PPP_2023_bn</span>) ÷ (sum over all economies).</div>
      </div>

      <div class="card">
        <div class="cardTitle">Gap to frontier</div>
        <div class="cardSub">Compare any economy’s labor productivity level with the frontier (highest LP level). This makes / “How far behind?”</div>
        <div class="gapGrid">
          <div class="gapBox">
            <div class="gapK">Frontier</div>
            <div class="gapV" id="gapFrontierName">${escapeHtml(frontier?.name||"–")}</div>
            <div class="gapS" id="gapFrontierVal">${isNum(frontier?.v)?fmtNumber(frontier.v,1):"–"} <span class="muted">kUSD/worker</span></div>
          </div>
          <div class="gapBox">
            <div class="gapK">Compare</div>
            <select class="select" id="gapCompareSelect" aria-label="Select economy to compare">
              ${economies.map(e=>`<option value="${escapeHtml(e)}" ${(e===defaultCompare)?"selected":""}>${escapeHtml(e)}</option>`).join("")}
            </select>
            <div class="gapS" id="gapCompareVal">—</div>
          </div>
          <div class="gapBox">
            <div class="gapK">Frontier / Compare</div>
            <div class="gapV" id="gapRatio">—</div>
            <div class="gapS">(level gap)</div>
          </div>
        </div>
        <div class="cardSub" style="margin-top:10px;">Validation: Ratio = <span class="mono">max(LP_level_per_worker_2023_kUSD)</span> ÷ selected economy’s <span class="mono">LP_level_per_worker_2023_kUSD</span>.</div>
      </div>
    </div>

    <div class="summary2col">
      <div class="card">
        <div class="cardHeader">
          <div>
            <div class="cardTitle">Quadrant snapshot</div>
            <div class="cardSub">A single chart to show “where economies sit” on <b>${escapeHtml(quadXDef?.label||quadX)}</b> (x) vs <b>${escapeHtml(quadYDef?.label||quadY)}</b> (y). Dot size is GDP (PPP, 2023). Hover for exact values; click a dot to open the economy profile.</div>
          </div>
        </div>
        ${quadrantSvg}
        <div class="cardSub" style="margin-top:10px;">This is a positioning map combining an <i>income/scale proxy</i> (GDP per capita) with a <i>productivity outcome</i> (LP per worker). It’s a quick “positioning map,” not a causal model.</div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div>
            <div class="cardTitle">Distributions</div>
            <div class="cardSub">How many economies fall into growth buckets (latest year) (Buckets: “<2%”, “2–4%”, etc.).</div>
          </div>
        </div>
        <div class="distBlock">
          <div class="distTitle">GDP growth (2022–23)</div>
          ${distBarsHtml(distGdp)}
        </div>
        <div class="distBlock">
          <div class="distTitle">Per-worker labor productivity growth (2022–23)</div>
          ${distBarsHtml(distLp)}
        </div>
        <div class="distBlock">
          <div class="distTitle">TFP growth (2022–23)</div>
          ${distBarsHtml(distTfp)}
        </div>
        <div class="cardSub" style="margin-top:10px;">Distributions show whether performance is “broad-based” (many economies in 2–4% / 4–6%) or “uneven” (mass near 0% / negative with a few high outliers). Counts come directly from the indicator columns in <span class="mono">data.js</span>.</div>
      </div>
    </div>

    <div class="card">
      <div class="cardHeader">
        <div>
          <div class="cardTitle">Rankings snapshot</div>
          <div class="cardSub">Top 5 and Bottom 5 economies across key indicators (levels, recent growth, and selected projections). Values come directly from <span class="mono">data</span>.</div>
        </div>
      </div>

      <div class="rankGrid" id="summaryRankGrid">
        ${rankHtml}
      </div>

      <div class="cardSub" style="margin-top:10px;">Validation: Each leaderboard is computed by sorting numeric values from the corresponding indicator column.</div>
    </div>
  `;

  // GDP breakdown
  const tile = $("#tileTotalGdp");
  if(tile) tile.addEventListener("click", openGdpModal);

  // Chip clicks -> profile
  $$("#sigRow .chip").forEach(b=>{
    b.addEventListener("click", ()=>{
      const e = b.dataset.economy;
      if(e) goProfile(e);
    });
  });

  // Ranking items click -> profile
  $$("#summaryRankGrid .rankItem").forEach(it=>{
    it.addEventListener("click", ()=>{
      const e = it.dataset.economy;
      if(e) goProfile(e);
    });
  });

  // Quadrant dots click -> profile
  $$(".quadSvg .qDot").forEach(dot=>{
    dot.addEventListener("click", ()=>{
      const e = dot.dataset.economy;
      if(e) goProfile(e);
    });
  });

  // Gap-to-frontier selector
  const sel = $("#gapCompareSelect");
  const cmpVal = $("#gapCompareVal");
  const ratioEl = $("#gapRatio");
  function updateGap(){
    if(!sel || !cmpVal || !ratioEl) return;
    const name = sel.value;
    const row = DATA.find(r=>r && r.Economy === name) || null;
    const v = row && isNum(row.LP_level_per_worker_2023_kUSD) ? row.LP_level_per_worker_2023_kUSD : null;
    cmpVal.textContent = isNum(v) ? `${fmtNumber(v,1)} kUSD/worker` : "–";
    if(frontier && isNum(frontier.v) && isNum(v) && v !== 0){
      ratioEl.textContent = `${fmtNumber(frontier.v / v, 1)}×`;
    }else{
      ratioEl.textContent = "–";
    }
  }
  if(sel) sel.addEventListener("change", updateGap);
  updateGap();
}

/** -------- Indicators -------- */
function setIndicatorHeader(ind){
  const t = $("#indicatorTitle");
  const s = $("#indicatorSub");
  if(!t || !s) return;
  if(!ind){
    t.textContent = "Indicators";
    s.textContent = "Please select an indicator from the sidebar.";
    return;
  }
  t.textContent = ind.label;
  const note = [];
  if(ind.unit) note.push(ind.unit);
  if(state.mode === "projection") note.push("Showing: Projection");
  if(state.mode === "data") note.push("Showing: Data");
  if(state.mode === "all") note.push(ind.proj ? "Showing: Data + Projection" : "Showing: Data");
  s.textContent = note.length ? note.join(" · ") : "";
}

function sortedRows(ind){
  const q = (state.search || "").trim().toLowerCase();
  const rows = q
    ? DATA.filter(r => (r.Economy||"").toLowerCase().includes(q))
    : DATA.slice();

  const mode = state.mode;
  const useProj = (mode !== "data") && !!ind.proj;
  const useData = (mode !== "projection");

  function pickVal(r){
    const dv = isNum(r[ind.id]) ? r[ind.id] : null;
    const pv = (ind.proj && isNum(r[ind.proj])) ? r[ind.proj] : null;
    if(mode === "data") return dv;
    if(mode === "projection") return pv;
    if(useData && useProj) return (isNum(dv) ? dv : (isNum(pv) ? pv : null));
    return useData ? dv : pv;
  }

  const sort = state.sort;
  if(sort === "alpha"){
    rows.sort((a,b)=>(a.Economy||"").localeCompare(b.Economy||""));
    return rows;
  }

  rows.sort((a,b)=>{
    const va = pickVal(a);
    const vb = pickVal(b);
    if(!isNum(va) && !isNum(vb)) return (a.Economy||"").localeCompare(b.Economy||"");
    if(!isNum(va)) return 1;
    if(!isNum(vb)) return -1;
    return sort === "highest" ? (vb - va) : (va - vb);
  });
  return rows;
}

function renderBars(ind){
  const list = $("#barList");
  const hint = $("#chartHint");
  if(!list || !hint) return;

  if(!ind){
    hint.textContent = "Please select an indicator.";
    list.innerHTML = "";
    return;
  }
  hint.textContent = "";

  const rows = sortedRows(ind);

  const showProj = (state.mode !== "data") && !!ind.proj;
  const showData = (state.mode !== "projection");
  const dual = showData && showProj;

  // Find max positive and max absolute negative across BOTH series (Data + Projection)
  let maxPos = 0;
  let maxNegAbs = 0;

  rows.forEach(r=>{
    const dv = isNum(r[ind.id]) ? r[ind.id] : null;
    const pv = (ind.proj && isNum(r[ind.proj])) ? r[ind.proj] : null;

    [dv, pv].forEach(v=>{
      if(!isNum(v)) return;
      if(v >= 0) maxPos = Math.max(maxPos, v);
      else maxNegAbs = Math.max(maxNegAbs, Math.abs(v));
    });
  });

  // If everything is missing or zero, avoid divide by zero
  const denom = (maxPos + maxNegAbs) || 1;
  const zeroPct = (maxNegAbs / denom) * 100; // where zero line sits

  function buildAxisLine(v, kind){
    // kind: "data" or "proj"
    const line = document.createElement("div");
    line.className = "barAxisLine";
    line.style.setProperty("--zero", `${zeroPct}%`);

    if(!isNum(v) || (v === 0)){
      return line; // no fill for missing/zero (zero still represented by the axis)
    }

    const seg = document.createElement("div");
    const isNeg = v < 0;
    seg.className = `barSeg ${kind} ${isNeg ? "neg" : "pos"}`;

    if(isNeg){
      // width proportional to abs(v) vs maxNegAbs within [0..zeroPct]
      const w = maxNegAbs ? (Math.abs(v) / maxNegAbs) * zeroPct : 0;
      const left = zeroPct - w;
      seg.style.left = `${left}%`;
      seg.style.width = `${w}%`;
    }else{
      // width proportional to v vs maxPos within [zeroPct..100]
      const span = 100 - zeroPct;
      const w = maxPos ? (v / maxPos) * span : 0;
      seg.style.left = `${zeroPct}%`;
      seg.style.width = `${w}%`;
    }

    line.appendChild(seg);
    return line;
  }

  list.innerHTML = "";
  rows.forEach(r=>{
    const dv = isNum(r[ind.id]) ? r[ind.id] : null;
    const pv = (ind.proj && isNum(r[ind.proj])) ? r[ind.proj] : null;

    const row = document.createElement("div");
    row.className = "barRow";

    const name = document.createElement("div");
    name.className = "barName";
    name.textContent = r.Economy || "—";

    const val = document.createElement("div");
    val.className = "barVal";

    if(dual){
      const wrap = document.createElement("div");
      wrap.className = "barTrackDual";
      wrap.appendChild(buildAxisLine(dv, "data"));
      wrap.appendChild(buildAxisLine(pv, "proj"));
      row.appendChild(name);
      row.appendChild(wrap);

      const dTxt = isNum(dv) ? fmtNumber(dv) : "–";
      const pTxt = isNum(pv) ? fmtNumber(pv) : "–";
      val.textContent = `D: ${dTxt}  |  P: ${pTxt}`;
      row.appendChild(val);
    }else{
      // single series diverging
      const v = (state.mode === "projection") ? pv : dv;
      const wrap = document.createElement("div");
      wrap.className = "barTrackDual"; // reuse container padding look
      wrap.style.gap = "0px";
      wrap.appendChild(buildAxisLine(v, (state.mode === "projection") ? "proj" : "data"));

      row.appendChild(name);
      row.appendChild(wrap);
      val.textContent = isNum(v) ? fmtNumber(v) : "–";
      row.appendChild(val);
    }

    list.appendChild(row);
  });
}

function renderIndicatorTable(ind){
  const tbl = $("#tableView");
  const meta = $("#tableMeta");
  if(!tbl || !meta) return;

  if(!ind){
    tbl.innerHTML = "";
    meta.textContent = "—";
    return;
  }

  const rows = sortedRows(ind);
  const showProj = (state.mode !== "data") && !!ind.proj;
  const showData = (state.mode !== "projection");

  meta.textContent = `Showing: ${rows.length} economies · Missing values display as “–”`;

  const head = [];
  head.push(`<tr>
    <th>Economy</th>
    ${showData ? `<th class="num">Data</th>` : ``}
    ${showProj ? `<th class="num">Projection</th>` : ``}
  </tr>`);

  const body = rows.map(r=>{
    const dv = isNum(r[ind.id]) ? r[ind.id] : null;
    const pv = (ind.proj && isNum(r[ind.proj])) ? r[ind.proj] : null;
    return `<tr>
      <td>${r.Economy || "—"}</td>
      ${showData ? `<td class="num">${isNum(dv) ? fmtNumber(dv) : "–"}</td>` : ``}
      ${showProj ? `<td class="num">${isNum(pv) ? fmtNumber(pv) : "–"}</td>` : ``}
    </tr>`;
  }).join("");

  tbl.innerHTML = `<thead>${head.join("")}</thead><tbody>${body}</tbody>`;
}

function renderIndicators(){
  const ind = state.indicatorId ? getIndicator(state.indicatorId) : null;

  // Mode button visibility
  const projBtn = $$('#modeSeg .segBtn').find(b=>b.dataset.mode === "projection");
  const allBtn  = $$('#modeSeg .segBtn').find(b=>b.dataset.mode === "all");
  if(ind && ind.proj){
    if(projBtn) projBtn.classList.remove("hidden");
    if(allBtn) allBtn.classList.remove("hidden");
  }else{
    if(projBtn) projBtn.classList.add("hidden");
    if(allBtn)  allBtn.classList.add("hidden");
    if(state.mode !== "data") state.mode = "data";
  }

  $$("#modeSeg .segBtn").forEach(b=> b.classList.toggle("active", b.dataset.mode === state.mode));

  setIndicatorHeader(ind);
  renderBars(ind);
  renderIndicatorTable(ind);
}

/** -------- Country profile (new layout) -------- */
function renderProfile(){
  const root = $("#view-profile");
  if(!root) return;

  const economies = economiesAll();
  if(!state.country && economies.length) state.country = economies[0];

  const r = DATA.find(x=>x.Economy === state.country) || null;

  const title = state.country ? state.country : "Country profile";
  const subtitle = "Key indicators (left) and narrative highlights (right).";

  const selectOptions = economies.map(e=>`<option value="${e}" ${e===state.country?"selected":""}>${e}</option>`).join("");

  const keyRows = DEFAULT_INDICATORS.map(ind=>{
    const dv = r && isNum(r[ind.id]) ? r[ind.id] : null;
    const pv = r && ind.proj && isNum(r[ind.proj]) ? r[ind.proj] : null;
    return `<tr>
      <td>${ind.label}</td>
      <td class="num">${isNum(dv) ? fmtNumber(dv) : "–"}</td>
      <td class="num">${ind.proj ? (isNum(pv) ? fmtNumber(pv) : "–") : "–"}</td>
    </tr>`;
  }).join("");

  const general = r && r.General_summary ? r.General_summary : "–";
  const challenges = r && r.Challenges_summary ? r.Challenges_summary : "–";

  root.innerHTML = `
    <div class="profileHeader">
      <div>
        <div class="profileName">${title}</div>
        <div class="profileSubtitle">${subtitle}<br/>${SOURCE_LABEL}</div>
      </div>
      <div>
        <select class="select" id="countrySelect" aria-label="Select economy">
          ${selectOptions}
        </select>
      </div>
    </div>

    <div class="profileGrid">
      <div class="card">
        <div class="cardTitle">Key indicators</div>
        <div class="cardSub">Data (left) and projection (right) where available</div>
        <div class="tableWrap">
          <table class="table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th class="num">Data</th>
                <th class="num">Projection</th>
              </tr>
            </thead>
            <tbody>${keyRows}</tbody>
          </table>
        </div>
      </div>

      <div class="profileRightStack">
        <div class="card">
          <div class="cardTitle">General summary</div>
          <div class="cardSub">From narrative fields in Data_Master (if provided)</div>
          <div class="textBlock">${escapeHtml(general)}</div>
        </div>

        <div class="card">
          <div class="cardTitle">Challenges</div>
          <div class="cardSub">From narrative fields in Data_Master (if provided)</div>
          <div class="textBlock">${escapeHtml(challenges)}</div>
        </div>
      </div>
    </div>
  `;

  const sel = $("#countrySelect");
  if(sel){
    sel.addEventListener("change",(e)=>{
      state.country = e.target.value;
      renderProfile();
    });
  }
}

function escapeHtml(s){
  if(typeof s !== "string") return "–";
  // preserve bullets/newlines safely
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/** -------- Data view -------- */
function renderDataView(){
  const root = $("#view-data");
  if(!root) return;

  const cols = DATA.length ? Object.keys(DATA[0]) : [];
  const q = (state.search||"").trim().toLowerCase();
  const rows = q ? DATA.filter(r => (r.Economy||"").toLowerCase().includes(q)) : DATA;

  const head = `<tr>${cols.map(c=>`<th class="${c!=='Economy'?'num':''}">${c}</th>`).join("")}</tr>`;
  const body = rows.map(r=>{
    const tds = cols.map(c=>{
      const v = r[c];
      const isN = isNum(v);
	const isNarr = (c === "General_summary" || c === "Challenges_summary");
	if(isNarr){
	  const full = (typeof v === "string" && v.trim()) ? v.trim() : "–";
	  const safe = full.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
	  return `<td class="longText" title="${safe}">
            <div class="clamp">${safe}</div>
          </td>`;
}
return `<td class="${(c!=='Economy' && isN)?'num':''}">${isN ? fmtNumber(v) : (v ?? "–")}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  root.innerHTML = `
    <div class="card">
      <div class="cardTitle">Data</div>
      <div class="cardSub">${SOURCE_LABEL}. Missing values display as “–”.</div>
      <div class="tableWrap">
        <table class="table">
          <thead>${head}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

/** -------- Export -------- */
function exportCurrentView(){
  const view = state.view;

  function downloadCSV(filename, rows){
    const csv = rows.map(r => r.map(x=>{
      const s = (x ?? "").toString();
      if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    }).join(",")).join("\n");

    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if(view === "indicators"){
    const ind = getIndicator(state.indicatorId);
    if(!ind){ alert("Select an indicator first."); return; }

    const showProj = (state.mode !== "data") && !!ind.proj;
    const showData = (state.mode !== "projection");

    const q = (state.search||"").trim().toLowerCase();
    const rows = q ? DATA.filter(r => (r.Economy||"").toLowerCase().includes(q)) : DATA;

    const out = [];
    out.push(["Economy", ...(showData?["Data"]:[]), ...(showProj?["Projection"]:[])]);
    rows.forEach(r=>{
      const data = isNum(r[ind.id]) ? r[ind.id] : "";
      const proj = (ind.proj && isNum(r[ind.proj])) ? r[ind.proj] : "";
      out.push([r.Economy, ...(showData?[data]:[]), ...(showProj?[proj]:[])]);
    });

    downloadCSV(`indicator_${ind.id}.csv`, out);
    return;
  }

  if(view === "profile"){
    if(!state.country){ alert("Select an economy first."); return; }
    const r = DATA.find(x=>x.Economy === state.country);
    if(!r){ alert("Economy not found."); return; }

    const out = [];
    out.push(["Indicator","Data","Projection"]);
    DEFAULT_INDICATORS.forEach(ind=>{
      const data = isNum(r[ind.id]) ? r[ind.id] : "";
      const proj = (ind.proj && isNum(r[ind.proj])) ? r[ind.proj] : "";
      out.push([ind.label, data, proj]);
    });

    downloadCSV(`profile_${state.country}.csv`, out);
    return;
  }

  const cols = DATA.length ? Object.keys(DATA[0]) : [];
  const out = [cols];
  DATA.forEach(r => out.push(cols.map(c => r[c] ?? "")));
  downloadCSV(`data_master_export.csv`, out);
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

/**
 * Simple balanced treemap (recursive split).
 * Not "squarified" perfection, but minimal and looks like a treemap.
 * Produces rectangles in container coordinates (x,y,w,h in [0..1]).
 */
function splitTreemap(items, x, y, w, h, vertical=true){
  // items: [{name, value}]
  if(items.length === 1){
    return [{...items[0], x, y, w, h}];
  }

  const total = items.reduce((s,it)=>s+it.value,0);
  const half = total / 2;

  let acc = 0;
  let idx = 0;
  while(idx < items.length && acc + items[idx].value <= half){
    acc += items[idx].value;
    idx++;
  }
  // ensure both groups non-empty
  if(idx === 0) idx = 1;
  if(idx === items.length) idx = items.length - 1;

  const a = items.slice(0, idx);
  const b = items.slice(idx);

  const sumA = a.reduce((s,it)=>s+it.value,0);
  const ratioA = sumA / total;

  if(vertical){
    const wA = w * ratioA;
    const wB = w - wA;
    return [
      ...splitTreemap(a, x, y, wA, h, !vertical),
      ...splitTreemap(b, x + wA, y, wB, h, !vertical),
    ];
  }else{
    const hA = h * ratioA;
    const hB = h - hA;
    return [
      ...splitTreemap(a, x, y, w, hA, !vertical),
      ...splitTreemap(b, x, y + hA, w, hB, !vertical),
    ];
  }
}

function colorForIndex(i){
  // deterministic pleasant variety without hard-coding country colors
  const hue = (i * 37) % 360;
  return `hsla(${hue}, 85%, 55%, 0.28)`;
}

/** -------- GDP modal -------- */
function openGdpModal(){
  const modal = $("#gdpModal");
  const body = $("#gdpModalBody");
  if(!modal || !body) return;

  const items = DATA
    .map(r=>({
      name: r.Economy,
      value: (isNum(r.GDP_PPP_2023_bn) ? r.GDP_PPP_2023_bn : null)
    }))
    .filter(x=>x.name && isNum(x.value));

  items.sort((a,b)=>b.value-a.value);

  const total = items.reduce((s,x)=>s+x.value,0);

  const rects = splitTreemap(items, 0, 0, 1, 1, true);

  body.innerHTML = `
    <div class="card" style="box-shadow:none; margin-bottom:12px;">
      <div class="cardSub">
        Validation: Total GDP is computed as sum of <span class="mono">GDP_PPP_2023_bn</span> across all loaded economies (T):
        <b>${fmtNumber(total,1)}T</b>.
      </div>
    </div>

    <div class="treemapWrap">
      <div class="treemap" id="gdpTreemap"></div>
    </div>
  `;

  const tm = document.getElementById("gdpTreemap");
  if(tm){
    rects.forEach((r, i)=>{
      const node = document.createElement("div");
      node.className = "tmNode";

      node.style.left   = (r.x * 100) + "%";
      node.style.top    = (r.y * 100) + "%";
      node.style.width  = (r.w * 100) + "%";
      node.style.height = (r.h * 100) + "%";
      node.style.background = colorForIndex(i);

      const area = r.w * r.h;
      if(area < 0.012) node.classList.add("tmTiny");

      node.title = `${r.name}: ${fmtNumber(r.value)} (bn, PPP 2023)`;

      node.innerHTML = `
        <div class="tmLabel">
          <div class="tmName">${r.name}</div>
          <div class="tmVal">${fmtNumber(r.value)}</div>
        </div>
      `;
      tm.appendChild(node);
    });
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden","false");
}
function closeGdpModal(){
  const modal = $("#gdpModal");
  if(!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
}

/** -------- Glossary modal -------- */
const GLOSSARY = [
  ["Gross Domestic Product (GDP)", "The total market value of all final goods and services produced within a country over a specific period (usually a year or a quarter)."],
  ["GDP growth", "The rate at which a country's GDP increases (or decreases) over time, usually reported quarterly or annually as a percentage."],
  ["Per capita GDP", "The average economic output (or income) per person in a country, often used as a rough proxy for living standards (GDP ÷ population)."],
  ["Per-worker labor productivity level", "Measures how much output each worker produces on average."],
  ["Per-worker labor productivity growth", "The rate at which output per worker increases over time."],
  ["Capital productivity growth", "The rate at which output produced per unit of capital increases over time. It measures how efficiently physical capital (machines, equipment, structures) is used to produce output."],
  ["TFP (Total Factor Productivity) growth", "The rate at which an economy becomes more efficient at using all inputs to produce output."],
];

function openGlossary(){
  const modal = $("#glossaryModal");
  const body = $("#glossaryModalBody");
  if(!modal || !body) return;

  body.innerHTML = `
    <div class="card" style="box-shadow:none;">
      ${GLOSSARY.map(([t,d])=>`
        <div style="margin-bottom:12px;">
          <div style="font-weight:900;">${t}</div>
          <div class="cardSub" style="margin-top:4px;">${d}</div>
        </div>
      `).join("")}
    </div>
  `;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden","false");
}
function closeGlossary(){
  const modal = $("#glossaryModal");
  if(!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
}

/** -------- Admin-only: CSV + JSON loaders, download data.js -------- */
async function fileToText(file){
  return await file.text();
}

function parseCSV(text){
  // minimal CSV parser: handles quotes + commas
  const rows = [];
  let i=0, field="", row=[], inQ=false;

  function pushField(){
    row.push(field);
    field="";
  }
  function pushRow(){
    // ignore completely empty rows
    if(row.some(c => (c||"").trim() !== "")) rows.push(row);
    row=[];
  }

  while(i < text.length){
    const ch = text[i];
    if(inQ){
      if(ch === '"'){
        if(text[i+1] === '"'){ field += '"'; i += 2; continue; }
        inQ=false; i++; continue;
      }
      field += ch; i++; continue;
    }else{
      if(ch === '"'){ inQ=true; i++; continue; }
      if(ch === ','){ pushField(); i++; continue; }
      if(ch === '\n'){ pushField(); pushRow(); i++; continue; }
      if(ch === '\r'){ i++; continue; }
      field += ch; i++; continue;
    }
  }
  pushField(); pushRow();
  return rows;
}

function coerceValue(v){
  if(v === null || v === undefined) return "";
  const s = String(v).trim();
  if(s === "" || s === "–" || s === "-") return "";
  // number?
  const n = Number(s.replace(/,/g,""));
  if(Number.isFinite(n) && String(n) !== "NaN") return n;
  return s;
}

async function handleCsvUpload(file){
  const txt = await fileToText(file);
  const rows = parseCSV(txt);
  if(rows.length < 2) throw new Error("CSV appears empty.");

  const header = rows[0].map(h => (h||"").trim());
  const out = rows.slice(1).map(r=>{
    const obj = {};
    header.forEach((h, idx)=>{
      obj[h] = coerceValue(r[idx]);
    });
    return obj;
  });

  if(!header.includes("Economy")){
    throw new Error("CSV must include an 'Economy' column.");
  }

  DATA = out;
  state.sourceFile = file.name || "Data_Master.csv";
  autoExtendIndicatorsFromData();
  updateCounts();
  renderAll();
}

async function handleIndicatorJsonUpload(file){
  const txt = await fileToText(file);
  const defs = JSON.parse(txt);
  if(!Array.isArray(defs) || !defs.length) throw new Error("Invalid indicator JSON: expected an array.");
  // shallow validation
  defs.forEach(d=>{
    if(!d || typeof d.id !== "string" || typeof d.label !== "string") throw new Error("Each indicator must have {id, label}.");
  });

  INDICATORS = defs;
  saveLS("apo_indicator_defs_v1", INDICATORS);
  renderIndicatorList();
  renderAll();
}

function downloadText(filename, content, mime="text/plain"){
  const blob = new Blob([content], { type:mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function makeDataJs(){
  const meta = {
    economies: economiesAll().length,
    source_file: state.sourceFile || "Data_Master"
  };
  // Include indicators so public build can use curated labels without any upload UI
  const parts = [];
  parts.push(`window.APO_META = ${JSON.stringify(meta)};`);
  parts.push(`window.APO_INDICATORS = ${JSON.stringify(INDICATORS)};`);
  parts.push(`window.APO_DATA = ${JSON.stringify(DATA)};`);
  return parts.join("\n");
}

/** -------- Render router -------- */
function renderAll(){
  updateCounts();
  renderIndicatorList();

  if(state.view === "summary") renderSummary();
  if(state.view === "indicators") renderIndicators();
  if(state.view === "profile") renderProfile();
  if(state.view === "data") renderDataView();
}

/** -------- Init -------- */
function init(){
  setTheme(state.theme);
  autoExtendIndicatorsFromData();
  renderIndicatorList();
  updateCounts();

  $$(".navItem").forEach(b=>{
    b.addEventListener("click", ()=> switchView(b.dataset.view));
  });

  const home = $("#brandHome");
  const homeGo = ()=>{ switchView("summary"); };
  if(home){
    home.addEventListener("click", homeGo);
    home.addEventListener("keydown",(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); homeGo(); }});
  }

  const search = $("#searchBox");
  if(search){
    search.addEventListener("input", (e)=>{
      state.search = e.target.value || "";
      renderAll();
    });
  }

  $$("#themeSeg .segBtn").forEach(b=>{
    b.addEventListener("click", ()=> setTheme(b.dataset.theme));
  });

  $$("#modeSeg .segBtn").forEach(b=>{
    b.addEventListener("click", ()=>{
      if(b.classList.contains("hidden")) return;
      state.mode = b.dataset.mode;
      renderIndicators();
    });
  });

  const sort = $("#sortSelect");
  if(sort){
    sort.addEventListener("change",(e)=>{
      state.sort = e.target.value;
      renderIndicators();
    });
  }

  const exp = $("#exportBtn");
  if(exp) exp.addEventListener("click", exportCurrentView);

  // Modals
  const gdpOv = $("#gdpModalOverlay");
  const gdpClose = $("#gdpModalClose");
  if(gdpOv) gdpOv.addEventListener("click", closeGdpModal);
  if(gdpClose) gdpClose.addEventListener("click", closeGdpModal);

  const glBtn = $("#glossaryBtn");
  const glOv = $("#glossaryModalOverlay");
  const glClose = $("#glossaryModalClose");
  if(glBtn) glBtn.addEventListener("click", openGlossary);
  if(glOv) glOv.addEventListener("click", closeGlossary);
  if(glClose) glClose.addEventListener("click", closeGlossary);

  document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape"){
      closeGdpModal();
      closeGlossary();
    }
  });

  // Admin-only hooks (only present in admin.html)
  if(IS_ADMIN){
    const csvInput = $("#csvInput");
    const indJsonInput = $("#indicatorJsonInput");
    const resetDataBtn = $("#resetDataBtn");
    const resetIndicatorsBtn = $("#resetIndicatorsBtn");
    const downloadDataJsBtn = $("#downloadDataJsBtn");
    const downloadIndicatorJsonBtn = $("#downloadIndicatorJsonBtn");

    if(csvInput){
      csvInput.addEventListener("change", async (e)=>{
        const f = e.target.files && e.target.files[0];
        if(!f) return;
        try{ await handleCsvUpload(f); }
        catch(err){ alert("CSV load failed: " + (err?.message || err)); }
        finally{ e.target.value = ""; }
      });
    }

    if(indJsonInput){
      indJsonInput.addEventListener("change", async (e)=>{
        const f = e.target.files && e.target.files[0];
        if(!f) return;
        try{ await handleIndicatorJsonUpload(f); }
        catch(err){ alert("Indicator JSON load failed: " + (err?.message || err)); }
        finally{ e.target.value = ""; }
      });
    }

    if(resetDataBtn){
      resetDataBtn.addEventListener("click", ()=>{
        DATA = deepClone(PACKAGED);
        state.sourceFile = (window.APO_META && window.APO_META.source_file) ? window.APO_META.source_file : "Data_Master";
        updateCounts();
        renderAll();
      });
    }

    if(resetIndicatorsBtn){
      resetIndicatorsBtn.addEventListener("click", ()=>{
        INDICATORS = deepClone(PACKAGED_INDICATORS);
        saveLS("apo_indicator_defs_v1", INDICATORS);
        renderIndicatorList();
        renderAll();
      });
    }

    if(downloadDataJsBtn){
      downloadDataJsBtn.addEventListener("click", ()=>{
        const txt = makeDataJs();
        downloadText("data.js", txt, "application/javascript;charset=utf-8;");
      });
    }

    if(downloadIndicatorJsonBtn){
      downloadIndicatorJsonBtn.addEventListener("click", ()=>{
        downloadText("indicator_labels.json", JSON.stringify(INDICATORS, null, 2), "application/json;charset=utf-8;");
      });
    }
  }

  switchView("summary");
}

init();
