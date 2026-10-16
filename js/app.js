"use strict";
// ---------- bindings ----------
function bindView(){
  const v=$("#view"), on=(sel,fn)=>{ const el=v.querySelector(sel); if(el) el.onclick=fn; };
  v.querySelectorAll("[data-edit]").forEach(r=>r.onclick=()=>entrySheet(r.dataset.edit));
  v.querySelectorAll("[data-hold]").forEach(r=>r.onclick=()=>holdSheet(r.dataset.hold));
  on("#addOne",()=>entrySheet()); on("#addHold",()=>holdSheet()); on("#csvLog",exportCSV);
  const ls=v.querySelector("#lseg"); if(ls) ls.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ logMode=b.dataset.m; render(); } };
  const tc=v.querySelector("#tchips"); if(tc) tc.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ tickerSel=b.dataset.t; render(); } };
  v.querySelectorAll("[data-plan]").forEach(r=>r.onclick=()=>planSheet(r.dataset.plan));
  on("#goPlan",()=>{ tab="plan"; render(); window.scrollTo(0,0); });
  on("#goHold",()=>{ tab="hold"; render(); window.scrollTo(0,0); });
  v.querySelectorAll("[data-month]").forEach(r=>r.onclick=()=>monthSheet(r.dataset.month));
  v.querySelectorAll("[data-week]").forEach(r=>r.onclick=()=>weekSheet(r.dataset.week));
  v.querySelectorAll("[data-day]").forEach(r=>r.onclick=()=>daySheet(r.dataset.day));
  const segOf=(id,fn)=>{ const el=v.querySelector(id); if(el) el.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ fn(b); render(); } }; };
  segOf("#hsort",b=>holdSort=b.dataset.s); segOf("#hfilter",b=>holdFilter=b.dataset.a); segOf("#dseg",b=>divMode=b.dataset.m); segOf("#dtseg",b=>trendMode=b.dataset.m); segOf("#mixseg",b=>mixDim=b.dataset.m);
  v.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>{ tab=b.dataset.goto; render(); window.scrollTo(0,0); });
  on("#addHold2",()=>holdSheet()); on("#goCal",()=>monthCalSheet());
  const hq=v.querySelector("#hq"); if(hq) hq.oninput=()=>{ holdQ=hq.value; const p=hq.selectionStart; render(); const n=$("#hq"); if(n){ n.focus(); try{ n.setSelectionRange(p,p); }catch(e){} } };
  const hg=v.querySelector("#hgrp"); if(hg) hg.onchange=()=>{ holdGroup=hg.value; render(); };
  on("#hcmp",()=>{ holdCompact=!holdCompact; render(); });
  v.querySelectorAll("[data-gt]").forEach(g=>g.onclick=()=>{ const k=g.dataset.gt; if(holdShut.has(k)) holdShut.delete(k); else holdShut.add(k); render(); });
  segOf("#hmode",b=>holdMode=b.dataset.hm); segOf("#jseg",b=>jFilter=b.dataset.f); segOf("#cfilter",b=>cashAcc=b.dataset.a);
  on("#reMark",()=>{ const n=autoMarkReinvest(); if(!n){ toast("표시할 매수가 없어요"); return; } persist(); render(); toast(`${n}건을 재투자로 표시했어요. 맞지 않으면 종목 편집 → 매수 기록에서 고쳐 주세요`); });
  on("#addBuy",buyPick); on("#addSell",()=>sellSheet()); on("#addCash",()=>cashSheet());
  v.querySelectorAll("[data-trade]").forEach(r=>r.onclick=()=>tradeSheet(r.dataset.trade));
  v.querySelectorAll("[data-cash]").forEach(r=>r.onclick=()=>cashSheet(r.dataset.cash));
  ["#sim-m","#sim-p","#sim-d"].forEach(sel=>{ const el=v.querySelector(sel); if(el) el.onchange=()=>{ S.settings.sim={monthly:Math.max(0,+$("#sim-m").value||0),priceG:+$("#sim-p").value||0,divG:+$("#sim-d").value||0}; touchSettings(); persist(); render(); }; });
  v.querySelectorAll("details.sgrp").forEach(d=>d.addEventListener("toggle",()=>{ if(d.open) SETOPEN.add(d.dataset.g); else SETOPEN.delete(d.dataset.g); }));
  const ps=v.querySelector("#pseg"); if(ps) ps.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ planMode=b.dataset.m; render(); } };
  const hsc=v.querySelector("#hs"); if(hsc){ hsc.scrollLeft=hsc.scrollWidth; let dn=false,sx=0,sl=0;
    hsc.onpointerdown=e=>{ if(e.pointerType==="mouse"){ dn=true; sx=e.clientX; sl=hsc.scrollLeft; hsc.setPointerCapture(e.pointerId); hsc.style.cursor="grabbing"; } };
    hsc.onpointermove=e=>{ if(dn) hsc.scrollLeft=sl-(e.clientX-sx); };
    hsc.onpointerup=hsc.onpointercancel=()=>{ dn=false; hsc.style.cursor=""; }; }
  const hy=v.querySelector("#hychips"); if(hy) hy.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ homeYear=+b.dataset.y; render(); } };
  const iy=v.querySelector("#iychips"); if(iy) iy.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ investYear=+b.dataset.y; render(); } };
  const invs=[...v.querySelectorAll("input.inv")];
  invs.forEach((inp,k)=>{
    inp.onchange=()=>{ const ym=inp.dataset.ym, n=Math.max(0,+inp.value||0), id="inv-"+ym, x=S.invest.find(r=>r.ym===ym);
      if(x){ x.amount=n; x.updated=Date.now(); } else if(n>0){ S.deleted=S.deleted.filter(d=>d!==id); S.invest.push({id,ym,amount:n,created:Date.now(),updated:Date.now()}); }
      persist(); const sm=$("#invSum"); if(sm) sm.innerHTML=investSumTxt(); softRender(); };
    inp.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); inp.dispatchEvent(new Event("change")); const nx=invs[k+1]; if(nx) nx.focus(); else inp.blur(); } };
  });
  on("#fixKrw",()=>{ const fx=S.settings.fx; let ent=0;
    oddKrw().forEach(h=>{ h.currency="USD"; if(h.avgCost){ h.avgCostKRW=h.avgCost; h.avgCur="KRW"; h.avgCost=0; }
      if(h.manualPrice) h.manualPrice=Math.round(h.manualPrice/fx*100)/100; h.updated=Date.now();
      ent+=S.entries.filter(e=>e.ticker===h.ticker&&e.currency==="KRW").length; });
    persist(); render(); toast(ent?`미국 종목으로 바꿨어요. 원화로 저장된 배당 기록 ${ent}건은 기록 탭에서 통화를 확인해 주세요`:"미국 종목으로 바꿨어요. 종목을 눌러 매수 환율도 넣어 보세요"); refreshQuotes(true); });
  on("#keepKrw",()=>{ oddKrw().forEach(h=>{ h.krwOk=true; h.updated=Date.now(); }); persist(); render(); });
  on("#pAdd",()=>planSheet());
  on("#pGen",planGenSheet); on("#pImp",planImportSheet); on("#pExp",exportPlanCSV);
  on("#pClear",()=>{ if(!confirm("계획을 모두 삭제할까요?")) return; S.plan.forEach(x=>markDeleted(x.id)); S.plan=[]; persist(); render(); });
  const py=v.querySelector("#pby"); if(py) py.onchange=()=>{ const n=+py.value; if(n>0){ S.settings.baseYield=n; touchSettings(); persist(); toast("기준 주배당을 저장했어요"); } };
  on("#refQ",async()=>{ toast("주가를 불러오는 중…"); if(await refreshQuotes(true)) toast("주가를 새로 불러왔어요"); });
  on("#adiv",()=>{ assetDiv=!assetDiv; render(); });
  const at=v.querySelector("#artabs"); if(at) at.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ assetRange=b.dataset.r; render(); } };
  const asv=v.querySelector("#assetsvg"); if(asv&&ASSET){ const A=ASSET, head=$("#aHead"), cx=$("#acx"), cd=$("#acd");
    const show=ev=>{ const r=asv.getBoundingClientRect(); const x=(ev.clientX-r.left)/r.width*A.W; let best=null,bd=1e9; for(const p of A.pts){ const dx=Math.abs(A.X(p.ms)-x); if(dx<bd){ bd=dx; best=p; } }
      if(!best) return; head.innerHTML=assetHead(best,false); cx.setAttribute("x1",A.X(best.ms)); cx.setAttribute("x2",A.X(best.ms)); cx.setAttribute("visibility","visible");
      if(best.tot>0){ cd.setAttribute("cx",A.X(best.ms)); cd.setAttribute("cy",A.Y(best.tot)); cd.setAttribute("visibility","visible"); } };
    const reset=()=>{ head.innerHTML=assetHead(A.pts[A.pts.length-1],true); cx.setAttribute("visibility","hidden"); cd.setAttribute("visibility","hidden"); };
    asv.addEventListener("pointermove",show); asv.addEventListener("pointerdown",show); asv.addEventListener("pointerleave",reset); asv.addEventListener("pointerup",ev=>{ if(ev.pointerType!=="mouse") setTimeout(reset,1500); }); }
  const rs=v.querySelector("#rseg"); if(rs) rs.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ rateMode=b.dataset.m; render(); } };
  const cs=v.querySelector("#cseg"); if(cs) cs.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ chartMode=b.dataset.m; render(); } };
  on("#goGoal",()=>{ tab="set"; render(); setTimeout(()=>{ const g=$("#sgoal"); g&&g.focus(); },50); });
  const sa=v.querySelector("#sauto"); if(sa) sa.onchange=()=>{ $("#manualFx").hidden=sa.checked; };
  on("#fxRef",async()=>{ toast("환율을 불러오는 중…"); const r=await getFx(todayStr()); if(r.src==="offline") toast("인터넷 연결을 확인해 주세요"); else { S.settings.fx=r.rate; S.settings.fxDate=todayStr(); touchSettings(); persist(); render(); toast("환율을 갱신했어요"); } });
  on("#saveSet",()=>{ const st=S.settings; st.goalMonthly=+$("#sgoal").value||0; st.autoFx=$("#sauto").checked; if(!st.autoFx) st.fx=+$("#sfx").value||st.fx;
    st.taxUS=+$("#stu").value; st.taxKR=+$("#stk").value; touchSettings(); persist(); render(); toast("저장했어요"); if(st.autoFx) refreshTodayFx(); });
  ["#srp","#sda"].forEach(sel=>{ const el=v.querySelector(sel); if(el) el.onchange=()=>{ const st=S.settings;
    st.reinvestPct=Math.min(100,Math.max(0,+$("#srp").value||0)); st.divAlertPct=Math.max(1,+$("#sda").value||10); touchSettings(); persist(); toast("저장했어요"); }; });
  const sg=v.querySelector("#sgoal"); if(sg) sg.onchange=()=>{ S.settings.goalMonthly=+sg.value||0; touchSettings(); persist(); toast("목표를 저장했어요"); };
  on("#tdSave",async()=>{ S.settings.tdKey=$("#std").value.trim(); touchSettings(); persist();
    if(!S.settings.tdKey){ render(); toast("키를 지웠어요"); return; }
    try{ const j=await TD.call("price?symbol=SPY"); toast(j.price?"연결 성공! 주가를 불러올게요":"키를 확인해 주세요"); S.entries.forEach(e=>e.priceFail=false); refreshQuotes(true); backfillPrices(); }
    catch(e){ toast("키가 맞지 않거나 인터넷 연결이 없어요"); } render(); });
  on("#gLink",()=>{ const u=v.querySelector("#sbu"), k=v.querySelector("#sbk");
    if(u&&k){ const url=u.value.trim(), key=k.value.trim(), er=!url||!key?"Supabase 주소와 키를 모두 넣어 주세요":Cloud.checkKey(url,key); if(er){ toast(er); return; }
      const c=Cloud.cfg(); if(!c||c.url!==url.replace(/\/$/,"")||c.key!==key) Cloud.saveCfg(url,key); }
    Cloud.sync(true); });
  on("#gUnlink",()=>{ if(!confirm("로그아웃할까요? 이 기기의 기록은 그대로 남아요. 다시 로그인하면 자동 동기화가 이어져요.")) return; Cloud.logout(); });
  const hs=v.querySelector("#hideSeg"); if(hs) hs.onclick=ev=>{ const b=ev.target.closest("button"); if(b) setHide(b.dataset.h==="1"); };
  on("#csv",exportCSV);
  on("#gShare",async()=>{ const c=Cloud.cfg(); if(!c){ toast("Supabase 주소와 키를 먼저 넣어 주세요"); return; }
    if(!/^https?:/.test(location.protocol)){ toast("웹 주소(https)로 열었을 때 만들 수 있어요"); return; }
    const url=location.origin+location.pathname+"#jb-sb="+encodeURIComponent(btoa(JSON.stringify({u:c.url,k:c.key})));
    try{ await navigator.clipboard.writeText(url); toast("링크를 복사했어요. 다른 기기에서 열어 주세요"); }
    catch(e){ prompt("이 링크를 다른 기기에서 열어 주세요", url); } });
  v.querySelectorAll("[data-go-rate]").forEach(el=>el.onclick=()=>{ tab="chart"; chartMode="rate"; render(); window.scrollTo(0,0); });
  on("#syOut",()=>saveFile(`주배당_백업_${todayStr()}.json`,exportJSON(),"application/json"));
  const si=v.querySelector("#syIn"), sf=v.querySelector("#syFile");
  if(si){ si.onclick=()=>sf.click(); sf.onchange=async()=>{ const f=sf.files[0]; if(!f) return;
    try{ const p=JSON.parse(await f.text()); if(!p||!Array.isArray(p.entries)) throw 0; const n=mergeIn(p); persist(); render(); toast(`합쳤어요 · 새 기록 ${n}건`); }
    catch(e){ toast("파일 형식이 맞지 않아요"); } sf.value=""; }; }
  on("#wipe",()=>{ if(!confirm("이 기기의 모든 종목과 기록을 삭제할까요? 구글에 동기화된 데이터는 남아 있어요.")) return;
    const keep={tdKey:S.settings.tdKey,gClientId:S.settings.gClientId}; S=clone(DEFAULT); Object.assign(S.settings,keep); saveLocal(); render(); toast("삭제했어요"); });
}
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; render(); window.scrollTo(0,0); if(tab==="hold") refreshQuotes(false); });
$("#fab").onclick=()=>batchSheet();
$("#syncChip").onclick=()=>{ if(Cloud.configured()) Cloud.sync(true); else { tab="set"; render(); toast("설정에서 Supabase 주소와 키를 넣으면 구글 로그인으로 동기화할 수 있어요"); } };

// ---------- start ----------
async function backgroundWork(){ await refreshTodayFx(); await backfillFx(); await refreshQuotes(false); await backfillPrices(); }
// 다른 기기에서 복사한 연결 링크(#jb-sb=...)로 열었을 때 Supabase 주소·키를 자동으로 넣어요
function applySetupLink(){
  try{ const m=location.hash.match(/jb-sb=([^&]+)/); if(!m) return false;
    const o=JSON.parse(atob(decodeURIComponent(m[1]))); history.replaceState(null,"",location.pathname+location.search);
    if(o&&o.u&&o.k&&!Cloud.checkKey(o.u,o.k)){ Cloud.saveCfg(o.u,o.k); tab="set"; return true; }
  }catch(e){}
  return false;
}
loadLocal();
try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(e){}
// 이 기기의 저장 내용이 비어 있는데 이중 보관본에 기록이 남아 있으면 되살려요
if(!hasData(S)) IDB.get().then(v=>{ try{ if(!v||hasData(S)) return; const o=JSON.parse(v); if(!hasData(o)) return;
  const k=S.settings.tdKey; S=normalize(o); S.settings.tdKey=k||""; saveLocal(); render(); toast("이 기기에 남아 있던 백업에서 기록을 되살렸어요"); }catch(e){} });
const fromLink=applySetupLink();
render();
if(fromLink) toast("연결 정보를 넣었어요. ‘구글로 로그인’을 눌러 주세요");
backgroundWork();
(mqWide.addEventListener ? mqWide.addEventListener("change",()=>render()) : mqWide.addListener(()=>render()));
Cloud.startAuto();
if(Cloud.configured()){ Cloud.init().then(()=>Cloud.sync(false)); } else Cloud.setChip();
window.addEventListener("online", ()=>{ backgroundWork(); if(Cloud.linked()) Cloud.sync(false); });
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible"){ if(S.settings.fxDate!==todayStr()) refreshTodayFx(); if(Cloud.linked()&&Date.now()-Cloud.lastSync>2*60000) Cloud.sync(false); } });

// ---------- 서비스 워커 (오프라인·빠른 업데이트) ----------
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
window.addEventListener("load",()=>{ if(justUpdated) toast("v"+APP_VERSION+" 로 업데이트됐어요"); navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}
