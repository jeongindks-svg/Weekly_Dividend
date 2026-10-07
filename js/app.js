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
  on("#pLoad",()=>{ if(S.plan.length && !confirm("PDF 계획(2026.9~2028.9)을 다시 불러올까요? 같은 달 계획은 PDF 내용으로 바뀌어요.")) return; loadPdfPlan(false); persist(); render(); toast("계획을 불러왔어요"); });
  on("#pClear",()=>{ if(!confirm("계획을 모두 삭제할까요?")) return; S.plan.forEach(x=>markDeleted(x.id)); S.plan=[]; persist(); render(); });
  const pb=v.querySelector("#pbasis"); if(pb) pb.onclick=ev=>{ const b=ev.target.closest("button"); if(b){ S.settings.goalBasis=b.dataset.b; touchSettings(); persist(); render(); } };
  const py=v.querySelector("#pby"); if(py) py.onchange=()=>{ const n=+py.value; if(n>0){ S.settings.baseYield=n; touchSettings(); persist(); toast("기준 주배당을 저장했어요"); } };
  on("#refQ",async()=>{ toast("주가를 불러오는 중…"); if(await refreshQuotes(true)) toast("주가를 새로 불러왔어요"); });
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
  on("#gLink",()=>{ const idv=$("#sgc").value.trim(); if(!idv){ toast("클라이언트 ID를 먼저 넣어 주세요"); return; }
    if(idv!==S.settings.gClientId){ S.settings.gClientId=idv; Drive.token=null; Drive.keep(); touchSettings(); saveLocal(); } Drive.sync(true); });
  on("#gUnlink",()=>{ if(!confirm("구글 연동을 해제할까요? 이 기기의 기록은 그대로 남아요.")) return;
    try{ if(Drive.token && window.google) google.accounts.oauth2.revoke(Drive.token,()=>{}); }catch(e){}
    Drive.token=null; Drive.keep(); Drive.fileId=null; S.settings.gLinked=false; saveLocal(); render(); });
  const hs=v.querySelector("#hideSeg"); if(hs) hs.onclick=ev=>{ const b=ev.target.closest("button"); if(b) setHide(b.dataset.h==="1"); };
  on("#csv",exportCSV);
  on("#gShare",async()=>{ const idv=(S.settings.gClientId||$("#sgc").value||"").trim();
    if(!idv){ toast("클라이언트 ID를 먼저 넣어 주세요"); return; }
    if(!/^https?:/.test(location.protocol)){ toast("웹 주소(https)로 열었을 때 만들 수 있어요"); return; }
    const url=location.origin+location.pathname+"#jb-client="+encodeURIComponent(idv);
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
$("#fab").onclick=batchSheet;
$("#syncChip").onclick=()=>{ if(S.settings.gLinked||S.settings.gClientId) Drive.sync(true); else { tab="set"; render(); toast("설정에서 구글 계정을 연결할 수 있어요"); } };

// ---------- start ----------
async function backgroundWork(){ await refreshTodayFx(); await backfillFx(); await refreshQuotes(false); await backfillPrices(); }
// 다른 기기에서 복사한 연결 링크(#jb-client=...)로 열었을 때 클라이언트 ID를 자동으로 넣어요
function applySetupLink(){
  try{ const m=location.hash.match(/jb-client=([^&]+)/); if(!m) return false;
    const id=decodeURIComponent(m[1]).trim(); history.replaceState(null,"",location.pathname+location.search);
    if(/^[\w.\-]+\.apps\.googleusercontent\.com$/.test(id)){ S.settings.gClientId=id; saveLocal(); tab="set"; return true; }
  }catch(e){}
  return false;
}
loadLocal();
Drive.restore();
const fromLink=applySetupLink();
if(!S.settings.planSeeded && !S.plan.length){ loadPdfPlan(true); saveLocal(); }
render();
if(fromLink) toast("연결 정보를 넣었어요. ‘구글 계정 연결’을 눌러 로그인해 주세요");
backgroundWork();
(mqWide.addEventListener ? mqWide.addEventListener("change",()=>render()) : mqWide.addListener(()=>render()));
Drive.startAuto();
if(Drive.linked()){ Drive.loadGIS().catch(()=>{}); Drive.sync(false); }
window.addEventListener("online", ()=>{ backgroundWork(); if(Drive.linked()) Drive.sync(false); });
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible"){ if(S.settings.fxDate!==todayStr()) refreshTodayFx(); if(Drive.linked()) Drive.sync(false); } });

// ---------- 서비스 워커 (오프라인·빠른 업데이트) ----------
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
window.addEventListener("load",()=>{ if(justUpdated) toast("v"+APP_VERSION+" 로 업데이트됐어요"); navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}
