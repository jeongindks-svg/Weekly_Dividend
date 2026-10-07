"use strict";
const LS_KEY = "weekly-div-journal-v1";
const DEFAULT = {
  v:2,
  settings:{ fx:1380, fxDate:"", taxUS:15, taxKR:15.4, autoFx:true, goalMonthly:0, baseYield:0.85, goalBasis:"gross", reinvestPct:100, divAlertPct:10, planSeeded:false, tdKey:"", gClientId:"", gLinked:false, updated:0 },
  holdings:[], entries:[], plan:[], invest:[], deleted:[], fxCache:{}, priceCache:{}, quotes:{}
};
let S = clone(DEFAULT);
const APP_VERSION="2.3", APP_DATE="2026-10-07", APP_NOTES="보유 탭을 애플 스타일로 단순하게 정리";
let prevVer=null; try{ prevVer=localStorage.getItem("jbd-ver"); localStorage.setItem("jbd-ver",APP_VERSION); }catch(e){}
const justUpdated = prevVer!==null && prevVer!==APP_VERSION;
let rateMode = "week";
let tab = "home", chartMode = "month", logMode = "list", tickerSel = "all", homeYear = null, investYear = null;
let renderTimer = null;

// ---------- utils ----------
function clone(o){ return JSON.parse(JSON.stringify(o)); }
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);
let HIDE = false; try{ HIDE = localStorage.getItem("jb-hide")==="1"; }catch(e){}
const MASK = "•••";
const hz = x => HIDE ? MASK : x;
const won = n => HIDE ? "₩"+MASK : (n<0?"-":"") + "₩" + Math.round(Math.abs(n)).toLocaleString("ko-KR");
const wonS = n => HIDE ? "₩"+MASK : (n>0?"+":"") + won(n);
const usd = n => HIDE ? "$"+MASK : (n<0?"-":"") + "$" + Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const qty = n => HIDE ? MASK : (+n).toLocaleString();
const pct = (n,d=2) => (n>0?"+":"") + n.toFixed(d) + "%";
const cls = n => n>0?"up":n<0?"down":"";
const isoOf = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const todayStr = () => isoOf(new Date());
const parseD = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const fmtD = d => `${d.getMonth()+1}/${d.getDate()}`;
function monday(d){ const x=new Date(d); x.setDate(x.getDate()-((x.getDay()+6)%7)); x.setHours(0,0,0,0); return x; }
const weekKey = s => isoOf(monday(parseD(s)));
const addDays = (s,n) => { const d=parseD(s); d.setDate(d.getDate()+n); return isoOf(d); };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const holdingOf = t => S.holdings.find(h=>h.ticker===t);
const freqN = t => { const f=(holdingOf(t)||{}).freq||"주배당"; return f==="월배당"?12:f==="분기배당"?4:52; };
const taxFor = cur => cur==="KRW"? S.settings.taxKR : S.settings.taxUS;
const online = () => navigator.onLine !== false;
const mqWide = window.matchMedia("(min-width:900px)");
const isWide = () => mqWide.matches;

function calc(e){
  const gross = e.perShare * e.shares, tax = gross*(e.taxRate/100), net = gross - tax;
  const fx = e.currency==="KRW" ? 1 : e.fx;
  const y = e.price>0 ? e.perShare/e.price*100 : null;
  return { gross, tax, net, netKRW: net*fx, grossKRW: gross*fx, yield:y, yieldAnnual: y!=null ? y*freqN(e.ticker) : null };
}
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),2200); }
async function fetchJSON(url, opts={}, ms=8000){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms);
  try{ const r=await fetch(url,Object.assign({signal:c.signal,cache:"no-store"},opts)); if(!r.ok){ const err=new Error("HTTP "+r.status); err.status=r.status; throw err; } return await r.json(); }
  finally{ clearTimeout(t); }
}
function softRender(){ clearTimeout(renderTimer); renderTimer=setTimeout(()=>{ const a=document.activeElement; if(a&&a.matches&&a.matches("#view input,#view select,#view textarea")){ softRender(); return; } if(!$("#sheetBg").classList.contains("open")) render(); },250); }

// ---------- 금액 숨기기 ----------
const EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.1 10.1 0 0 1 12 19c-6.4 0-10-7-10-7a18 18 0 0 1 4.1-4.9M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/></svg>';
function syncEye(){ const b=$("#eyeBtn"); if(!b) return; b.innerHTML=HIDE?EYE_OFF:EYE; b.setAttribute("aria-pressed",HIDE); b.setAttribute("aria-label",HIDE?"금액 보이기":"금액 숨기기"); }
function setHide(v){ HIDE=!!v; try{ localStorage.setItem("jb-hide",HIDE?"1":"0"); }catch(e){} syncEye(); render(); toast(HIDE?"금액을 숨겼어요":"금액을 다시 보여요"); }
$("#eyeBtn").onclick=()=>setHide(!HIDE);
syncEye();

// ---------- theme ----------
try{ localStorage.removeItem("jb-theme"); }catch(e){}

// ---------- storage ----------
function normalize(p){
  const o = Object.assign(clone(DEFAULT), p||{});
  o.settings = Object.assign(clone(DEFAULT.settings), (p&&p.settings)||{});
  for(const k of ["holdings","entries","plan","invest","deleted"]) if(!Array.isArray(o[k])) o[k]=[];
  for(const k of ["fxCache","priceCache","quotes"]) if(!o[k]||typeof o[k]!=="object") o[k]={};
  o.entries.forEach(e=>{ if(e.fxAuto===undefined) e.fxAuto=false; });
  return o;
}
// 주가 API 키는 이 기기에만 저장해요 (구글 동기화·백업 파일에는 넣지 않아요)
const TD_KEY = "jb-td";
function exportJSON(){ const o=clone(S); o.settings.tdKey=""; return JSON.stringify(o); }
function loadLocal(){ try{ const r=localStorage.getItem(LS_KEY); if(r) S=normalize(JSON.parse(r));
  const k=localStorage.getItem(TD_KEY); if(!S.settings.tdKey && k) S.settings.tdKey=k;
  else if(S.settings.tdKey && S.settings.tdKey!==k) saveLocal(); }catch(e){} }
function saveLocal(){ try{ if(S.settings.tdKey) localStorage.setItem(TD_KEY,S.settings.tdKey); else localStorage.removeItem(TD_KEY);
  localStorage.setItem(LS_KEY, exportJSON()); }catch(e){} }
function persist(){ saveLocal(); Drive.schedulePush(); }
function touchSettings(){ S.settings.updated = Date.now(); }

// ---------- exchange rate (자동) ----------
async function getFx(date){
  const isToday = date >= todayStr();
  if(S.fxCache[date] && !isToday) return {rate:S.fxCache[date], src:"saved"};
  if(online()){
    const q = isToday ? "latest" : date;
    const urls=[`https://api.frankfurter.dev/v1/${q}?base=USD&symbols=KRW`,`https://api.frankfurter.app/${q}?from=USD&to=KRW`];
    for(const u of urls){ try{ const j=await fetchJSON(u,{},6000); const r=j&&j.rates&&+j.rates.KRW;
      if(r>0){ const v=Math.round(r*100)/100; S.fxCache[isToday?todayStr():date]=v; return {rate:v,src:"live",base:j.date}; } }catch(e){} }
    if(isToday){ try{ const j=await fetchJSON("https://open.er-api.com/v6/latest/USD",{},6000); const r=j&&j.rates&&+j.rates.KRW;
      if(r>0){ const v=Math.round(r*100)/100; S.fxCache[todayStr()]=v; return {rate:v,src:"live"}; } }catch(e){} }
  }
  if(S.fxCache[date]) return {rate:S.fxCache[date],src:"saved"};
  return {rate:S.settings.fx, src:"offline"};
}
async function refreshTodayFx(){
  const r = await getFx(todayStr());
  if(r.src!=="offline"){ S.settings.fx=r.rate; S.settings.fxDate=todayStr(); saveLocal(); softRender(); }
}
async function backfillFx(){
  if(!online()) return;
  let changed=false;
  for(const e of S.entries){
    if(e.currency==="KRW" || !e.fxPending) continue;
    const r=await getFx(e.date); if(r.src==="offline") break;
    e.fx=r.rate; e.fxPending=false; e.updated=Date.now(); changed=true;
  }
  if(changed){ persist(); softRender(); }
}

// ---------- stock prices (Twelve Data, 미국 주식/ETF) ----------
const TD = {
  stamps:[],
  async call(path, credits=1){
    const key=S.settings.tdKey; if(!key) throw new Error("nokey");
    // 무료 요금제: 분당 8크레딧
    for(;;){ const now=Date.now(); this.stamps=this.stamps.filter(t=>now-t.at<61000);
      const used=this.stamps.reduce((a,t)=>a+t.n,0); if(used+credits<=8) break;
      await sleep(61000-(now-this.stamps[0].at)); }
    this.stamps.push({at:Date.now(),n:credits});
    const j = await fetchJSON(`https://api.twelvedata.com/${path}${path.includes("?")?"&":"?"}apikey=${encodeURIComponent(key)}`,{},10000);
    if(j && j.status==="error"){ const err=new Error(j.message||"error"); err.code=j.code; throw err; }
    return j;
  }
};
async function priceOn(ticker, date){
  S.priceCache[ticker]=S.priceCache[ticker]||{};
  if(S.priceCache[ticker][date]) return S.priceCache[ticker][date];
  const j = await TD.call(`time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&start_date=${addDays(date,-7)}&end_date=${addDays(date,1)}&outputsize=10`);
  const vals=(j.values||[]).filter(v=>v.datetime.slice(0,10)<=date).sort((a,b)=>b.datetime.localeCompare(a.datetime));
  if(!vals.length) return null;
  const p=Math.round(+vals[0].close*10000)/10000; S.priceCache[ticker][date]=p; return p;
}
let priceBusy=false;
async function backfillPrices(){
  if(priceBusy || !S.settings.tdKey || !online()) return; priceBusy=true;
  try{
    for(const e of S.entries){
      if(e.currency==="KRW" || e.price>0 || e.priceFail) continue;
      try{ const p=await priceOn(e.ticker,e.date); if(p){ e.price=p; e.updated=Date.now(); } else e.priceFail=true; persist(); softRender(); }
      catch(err){ if(err.message==="nokey"||err.code===401||err.code===429) break; e.priceFail=true; }
    }
  } finally{ priceBusy=false; }
}
let quoteBusy=false;
async function refreshQuotes(force){
  if(quoteBusy || !S.settings.tdKey || !online()) return false;
  const syms=[...new Set(S.holdings.filter(h=>h.currency!=="KRW").map(h=>h.ticker))];
  if(!syms.length) return false;
  const stale = syms.some(t=>!S.quotes[t] || Date.now()-S.quotes[t].at > 15*60000);
  if(!force && !stale) return false;
  quoteBusy=true;
  try{
    for(let i=0;i<syms.length;i+=8){
      const part=syms.slice(i,i+8);
      const j=await TD.call(`price?symbol=${part.map(encodeURIComponent).join(",")}`, part.length);
      if(part.length===1){ if(j.price) S.quotes[part[0]]={price:+j.price,at:Date.now()}; }
      else for(const t of part){ if(j[t]&&j[t].price) S.quotes[t]={price:+j[t].price,at:Date.now()}; }
    }
    saveLocal(); softRender(); return true;
  }catch(e){ if(force) toast(e.message==="nokey"?"설정에서 주가 API 키를 먼저 넣어 주세요":"주가를 불러오지 못했어요"); return false; }
  finally{ quoteBusy=false; }
}
function curPrice(h){ if(h.currency!=="KRW" && S.quotes[h.ticker]) return S.quotes[h.ticker].price; return h.manualPrice>0?h.manualPrice:null; }

// ---------- merge (기기 간 합치기) ----------
function markDeleted(id){ if(!S.deleted.includes(id)) S.deleted.push(id); }
function mergeList(mine, theirs, dead){
  const m=new Map(mine.map(x=>[x.id,x])); let added=0;
  for(const t of theirs||[]){ const cur=m.get(t.id);
    if(!cur){ m.set(t.id,t); added++; } else if((t.updated||t.created||0)>(cur.updated||cur.created||0)) m.set(t.id,t); }
  return {list:[...m.values()].filter(x=>!dead.has(x.id)), added};
}
function mergeIn(raw){
  const p=normalize(raw);
  const dead=new Set([...S.deleted,...p.deleted]);
  const e=mergeList(S.entries,p.entries,dead), h=mergeList(S.holdings,p.holdings,dead);
  const pl=mergeList(S.plan,p.plan,dead), iv=mergeList(S.invest,p.invest,dead); S.entries=e.list; S.holdings=h.list; S.plan=pl.list; S.invest=iv.list; S.deleted=[...dead];
  if((p.settings.updated||0) > (S.settings.updated||0)){ const keep={gLinked:S.settings.gLinked,tdKey:S.settings.tdKey}; S.settings=Object.assign(p.settings,keep); }
  S.fxCache=Object.assign({},p.fxCache,S.fxCache);
  for(const t in p.priceCache) S.priceCache[t]=Object.assign({},p.priceCache[t],S.priceCache[t]||{});
  for(const t in p.quotes) if(!S.quotes[t] || p.quotes[t].at>S.quotes[t].at) S.quotes[t]=p.quotes[t];
  return e.added;
}

// 기기 간 비교용 지문: 순서·기기별 임시값(환율 캐시 등)은 무시
function canon(v){ if(Array.isArray(v)) return v.map(canon); if(v&&typeof v==="object"){ const o={}; for(const k of Object.keys(v).sort()){ if(k==="priceFail") continue; o[k]=canon(v[k]); } return o; } return v; }
function digest(o){
  const by=a=>[...(a||[])].sort((x,y)=>String(x.id)<String(y.id)?-1:1), st=Object.assign({},o.settings);
  delete st.gLinked; delete st.fx; delete st.fxDate; delete st.tdKey;
  return JSON.stringify(canon([by(o.entries),by(o.holdings),by(o.plan),by(o.invest),[...(o.deleted||[])].sort(),st]));
}
