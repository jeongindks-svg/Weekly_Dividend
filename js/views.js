"use strict";
// ---------- views ----------
function goalBlock(){
  const now=new Date(), y=now.getFullYear(), mi=now.getMonth(), g=goalFor(y,mi); if(!g) return "";
  const m=actualYm(ymOf(y,mi),basis()), p=Math.min(100,m/g*100);
  return `<div style="margin-top:14px"><div style="display:flex;justify-content:space-between;font-size:13px"><span class="muted">${mi+1}월 목표 ${won(g)} (${basisName()} 기준)</span><span class="num" style="font-weight:600">${Math.round(m/g*100)}%</span></div><div class="bar"><span style="width:${p}%"></span></div></div>`;
}
function yearChips(id, years, sel){
  return years.length>1 ? `<div class="chips" id="${id}">${years.map(y=>`<button data-y="${y}" aria-pressed="${sel===y}">${y}년</button>`).join("")}</div>` : "";
}
function divAlerts(){
  const th=+S.settings.divAlertPct||10, by={}, out=[], cutoff=isoOf(new Date(Date.now()-90*864e5));
  for(const e of S.entries) (by[e.ticker]=by[e.ticker]||[]).push(e);
  for(const t in by){ const a=by[t].sort((x,y)=>x.date.localeCompare(y.date)||(x.created||0)-(y.created||0)), last=a[a.length-1];
    if(last.date<cutoff) continue;
    const prev=a.slice(0,-1).filter(e=>e.currency===last.currency).slice(-4); if(!prev.length) continue;
    const avg=prev.reduce((s,e)=>s+e.perShare,0)/prev.length; if(!(avg>0)) continue;
    const ch=(last.perShare-avg)/avg*100; if(Math.abs(ch)>=th) out.push({t,last,avg,ch});
  }
  return out.sort((x,y)=>Math.abs(y.ch)-Math.abs(x.ch));
}
function alertCard(){
  const al=divAlerts(); if(!al.length) return "";
  const ps=(v,c)=>c==="KRW"?won(v):"$"+fmtPs(+v.toFixed(4));
  return `<section class="card"><h2>배당 변동 알림 <small>최근 지급 vs 이전 4회 평균 · ±${+S.settings.divAlertPct||10}% 이상</small></h2>
    ${al.map(a=>`<div class="lrow"><div><div class="t">${esc(a.t)}</div><div class="s num">${ps(a.last.perShare,a.last.currency)} (이전 평균 ${ps(a.avg,a.last.currency)})</div></div><div class="r"><div class="p ${a.ch>0?"up":"down"}" style="font-size:16px">${a.ch>0?"▲ 증액":"▼ 삭감"} ${Math.abs(a.ch).toFixed(1)}%</div></div></div>`).join("")}</section>`;
}
// ---- 주차별(달력 느낌): 금액이 큰 종목 3개 + 기타 ----
function weekInfo(es,b){ const by={}; let total=0; for(const e of es){ const a=amtOf(e,b); by[e.ticker]=(by[e.ticker]||0)+a; total+=a; }
  const arr=Object.entries(by).sort((x,y)=>y[1]-x[1]); return {total,top:arr.slice(0,3),rest:arr.slice(3).reduce((a,x)=>a+x[1],0)}; }
function weekChips(i){ if(!i.top.length) return ""; return `<div class="chiprow">${i.top.map(([t,v])=>`<span><b>${esc(t)}</b> ${won(v)}</span>`).join("")}${i.rest>0?`<span class="etc"><b>기타</b> ${won(i.rest)}</span>`:""}</div>`; }
function weekRow(k,es,b){ const i=weekInfo(es,b);
  return `<div class="wrow" data-week="${k}" role="button"><div class="wh"><div><div class="t">${weekLabel(k,true)}</div><div class="s">${fmtD(parseD(k))} – ${fmtD(parseD(addDays(k,6)))}</div></div><div class="p num ${i.total?"amt":"muted"}">${i.total?won(i.total):"-"}</div></div>${weekChips(i)}</div>`; }
function monthWeeks(ym){ const [y,m]=ym.split("-").map(Number), f=isoOf(monday(new Date(y,m-1,1))), out=[]; for(let i=-1;i<=5;i++){ const k=addDays(f,7*i); if(addDays(k,3).startsWith(ym)) out.push(k); } return out; }
function weekCalCard(){
  const now=new Date(), ym=ymOf(now.getFullYear(),now.getMonth()), b=basis(), wk=new Map();
  for(const e of S.entries){ const k=weekKey(e.date); if(!wk.has(k)) wk.set(k,[]); wk.get(k).push(e); }
  return `<section class="card"><h2>${now.getMonth()+1}월 주차별 <small>${basisName()} · 누르면 내역</small></h2>${monthWeeks(ym).map(k=>weekRow(k,wk.get(k)||[],b)).join("")}</section>`;
}
function monthlyCard(){
  const now=new Date(), cy=now.getFullYear(), b=basis();
  const ys=[...new Set([cy,...S.entries.map(e=>+e.date.slice(0,4))])].filter(y=>y<=cy).sort((a,c)=>c-a);
  if(!ys.includes(homeYear)) homeYear=cy;
  const y=homeYear, last=y===cy?now.getMonth():11, rs=monthRows(y);
  let tN=0,tG=0,tn=0,tGoal=0,tAct=0;
  const body=rs.slice(0,last+1).map((r,i)=>{ const g=goalFor(y,i), a=b==="gross"?r.gross:r.net; tN+=r.net; tG+=r.gross; tn+=r.n; if(g){ tGoal+=g; tAct+=a; }
    return `<tr data-month="${ymOf(y,i)}" style="cursor:pointer"${y===cy&&i===now.getMonth()?' class="cur"':""}><td class="l"><b>${i+1}월</b> <span class="muted">›</span></td><td class="${r.n?"amt":"muted"}">${r.n?won(r.net):"-"}</td><td>${g?won(g):"-"}</td><td class="${g?(a>=g?"up":"down"):""}">${g?Math.round(a/g*100)+"%":"-"}</td></tr>`; }).join("");
  return `<section class="card"><h2>월별 받은 배당 <small>월을 누르면 내역이 보여요</small></h2>${yearChips("hychips",ys,y)}
    <div class="tbl"><table><thead><tr><th class="l">월</th><th>세후</th><th>목표 배당</th><th>달성</th></tr></thead>
    <tbody>${body}<tr class="tot"><td class="l">합계</td><td class="amt">${won(tN)}</td><td>${tGoal?won(tGoal):"-"}</td><td>${tGoal?Math.round(tAct/tGoal*100)+"%":"-"}</td></tr></tbody></table></div></section>`;
}
// ---- 이번 주 일정: 월~일 요일별 입금(받은 것 + 예정) ----
function expectedFor(h){
  const es=S.entries.filter(e=>e.ticker===h.ticker).sort((a,c)=>c.date.localeCompare(a.date)); if(!es.length) return null;
  return calc({ticker:h.ticker,perShare:es[0].perShare,shares:h.shares,taxRate:taxFor(h.currency),fx:h.currency==="KRW"?1:S.settings.fx,currency:h.currency,price:0}).netKRW;
}
function dayInfo(D){
  const d=parseD(D), dow=d.getDay(), got=S.entries.filter(e=>e.date===D), recv=got.reduce((a,e)=>a+calc(e).netKRW,0), exp=[];
  for(const h of S.holdings){ if(!isDivStock(h)||(h.freq||"주배당")!=="주배당") continue; if(!payDaysOf(h).includes(dow)) continue; if(got.some(e=>e.ticker===h.ticker)) continue; exp.push({h,amt:expectedFor(h)}); }
  return {D,d,dow,got,recv,exp,expAmt:exp.reduce((a,x)=>a+(x.amt||0),0)};
}
const tkb=t=>esc(String(t).slice(0,3));
function weekDaysCard(){
  const m=monday(new Date()), today=todayStr(), days=Array.from({length:7},(_,i)=>dayInfo(isoOf(new Date(m.getFullYear(),m.getMonth(),m.getDate()+i))));
  const weekly=S.holdings.filter(h=>isDivStock(h)&&(h.freq||"주배당")==="주배당"), noDay=weekly.filter(h=>!payDaysOf(h).length);
  const tot=days.reduce((a,x)=>a+x.recv,0), left=days.reduce((a,x)=>a+(x.D>=today?x.expAmt:0),0);
  const cell=x=>{ const gt=[...new Set(x.got.map(e=>e.ticker))], all=[...gt.map(t=>({t,k:"g"})),...x.exp.map(o=>({t:o.h.ticker,k:"e"}))];
    const chips=all.slice(0,2).map(c=>`<i class="${c.k}">${tkb(c.t)}</i>`).join("")+(all.length>2?`<i class="m">+${all.length-2}</i>`:"");
    return `<button class="wd${x.D===today?" today":""}${x.D>today?" fut":""}" data-day="${x.D}" aria-label="${fmtD(x.d)} ${DOWN[x.dow]}요일"><span class="dw">${DOWN[x.dow]}</span><span class="dn">${x.d.getDate()}</span><span class="da${x.recv?" got":""}">${x.recv?kfmt(x.recv):(x.expAmt?"~"+kfmt(x.expAmt):"")}</span><span class="dt">${chips}</span></button>`; };
  return `<section class="card"><h2>이번 주 일정 <small>${fmtD(days[0].d)} – ${fmtD(days[6].d)}</small></h2>
    <div class="wdays">${days.map(cell).join("")}</div>
    <div class="wsum"><span>받은 배당 <b class="num">${won(tot)}</b></span>${left>0?`<span>남은 예정 <b class="num">~${won(left)}</b></span>`:""}</div>
    ${noDay.length?`<p class="muted" style="font-size:12px;margin:8px 0 0">${noDay.slice(0,3).map(h=>esc(h.ticker)).join(", ")}${noDay.length>3?" 외":""} 종목의 지급 요일을 정하면 입금 예정이 표시돼요 (보유 탭 → 종목).</p>`:""}</section>`;
}
function viewHome(){
  const now=new Date(), y=now.getFullYear(), wk=byWeek();
  let ytd=0, total=0;
  for(const e of S.entries){ const v=calc(e).netKRW, d=parseD(e.date); total+=v; if(d.getFullYear()===y) ytd+=v; }
  const avg=recentAvgWeek(), rr=recentRate(), mon0=monday(now), thisWk=wk.get(isoOf(mon0))||0, lastWk=wk.get(isoOf(new Date(mon0.getFullYear(),mon0.getMonth(),mon0.getDate()-7)))||0;
  const start=monday(new Date(y,0,1)); const cells=[]; let max=0;
  for(let i=0;i<52;i++){ const m=new Date(start); m.setDate(m.getDate()+7*i); const v=wk.get(isoOf(m))||0; cells.push({m,v}); if(v>max)max=v; }
  const strip=cells.map(c=>{ const a=max?Math.max(.18,c.v/max):0; const now1=monday(now).getTime()===c.m.getTime();
    return `<div class="c${now1?" now":""}" data-week="${isoOf(c.m)}" role="button" aria-label="${weekLabel(isoOf(c.m))} ${won(c.v)}" style="${c.v>0?`background:color-mix(in srgb, var(--red) ${Math.round(a*100)}%, var(--cell0))`:""}" title="${weekLabel(isoOf(c.m))} · ${won(c.v)}"></div>`; }).join("");
  const labels=[], vals=[], tg=[], m0=monday(now), firstK=wk.size?[...wk.keys()].sort()[0]:isoOf(m0);
  for(let k=firstK; k<=isoOf(m0); k=addDays(k,7)){ labels.push(fmtD(parseD(k))); vals.push(wk.get(k)||0); tg.push(weekGoal(k)); }
  const hasGoal=tg.some(t=>t>0);
  return `
  ${topCard()}
  <section class="card hero">
    <div class="label">${y}년 받은 배당 (세후)</div>
    <div class="big num">${won(ytd)}</div>
    <div class="sub">배당 들어온 주 ${cells.filter(c=>c.v>0).length}주 · 누적 ${won(total)}</div>
    ${goalBlock()}
  </section>
  ${weekDaysCard()}
  <section class="stats">
    <div class="stat"><div class="k">이번 주 (세후)</div><div class="v num">${won(thisWk)}</div><div class="muted" style="font-size:12px">지난주 ${won(lastWk)}</div></div>
    <div class="stat"><div class="k">최근 4주 평균 / 주</div><div class="v num">${won(avg)}</div></div>
    <div class="stat"><div class="k">연 환산 예상</div><div class="v num">${won(avg*52)}</div></div>
    <div class="stat" data-go-rate title="누르면 배당률 그래프로 이동"><div class="k">원금 대비 주배당률</div><div class="v num">${rr.rate!=null?rr.rate.toFixed(2)+"%":"-"}</div><div class="muted" style="font-size:12px">${rr.rate!=null?`최근 4주 · ${basisName()} · 원금 ${man(rr.pr)}만`:"계획 탭에서 원금을 넣어요"}</div></div>
  </section>
  <section class="card"><h2>올해 주간 기록 <small>점을 누르면 금액</small></h2><div class="strip">${strip}</div><div class="strip-legend"><span>1월</span><span>6월</span><span>12월</span></div></section>
  ${alertCard()}
  ${weekCalCard()}
  ${monthlyCard()}
  <section class="card"><h2>주별 받은 배당 <small>옆으로 밀면 이전 주가 보여요</small></h2>${scrollBars({labels,values:vals,target:hasGoal?tg:0})}</section>`;
}

function viewLog(){
  const list=sorted();
  if(!list.length) return `<div class="card empty">기록이 없어요.<br>‘+ 이번 주 배당’을 눌러 보유 종목의 배당을 한 번에 기록해 보세요.</div>`;
  const DOW="일월화수목금토";
  const seg=`<div class="seg" id="lseg" style="margin-bottom:12px"><button data-m="list" aria-pressed="${logMode==="list"}">목록</button><button data-m="table" aria-pressed="${logMode==="table"}">표</button></div>`;
  const add=`<div class="btnrow" style="margin-top:14px"><button id="addOne" class="ghost">개별 기록 추가</button><button id="csvLog" class="ghost">CSV 내보내기</button></div>`;
  const groups=new Map(); for(const e of list){ const k=weekKey(e.date); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(e); }
  const range=k=>{ const m=parseD(k), end=new Date(m); end.setDate(end.getDate()+6); return `${fmtD(m)} – ${fmtD(end)}`; };
  if(logMode==="table"){
    let rows="";
    for(const [k,arr] of groups){
      const sum=arr.reduce((a,e)=>a+calc(e).netKRW,0);
      rows+=`<tr class="wkh"><td colspan="6"><b style="color:var(--ink)">${weekLabel(k,true)}</b> · ${range(k)} · ${arr.length}건 · 합계 <b class="amt">${won(sum)}</b></td></tr>`;
      rows+=arr.map(e=>{ const c=calc(e), u=e.currency!=="KRW", d=parseD(e.date);
        return `<tr data-edit="${e.id}"><td><b>${esc(e.ticker)}</b><div class="s">${fmtD(d)} (${DOW[d.getDay()]})</div></td><td>${u?"$"+fmtPs(e.perShare):won(e.perShare)}</td><td>${qty(e.shares)}</td><td class="amt">${won(c.netKRW)}</td><td>${c.yield!=null?c.yield.toFixed(2)+"%":"-"}</td></tr>`; }).join("");
    }
    return seg+`<div class="card" style="padding:0"><div class="tbl ltbl"><table><thead><tr><th>종목 · 입금일</th><th>주당</th><th>수량</th><th>세후(원)</th><th>배당률</th></tr></thead><tbody>${rows}</tbody></table></div></div>`+add;
  }
  let html=seg;
  for(const [k,arr] of groups){
    const sum=arr.reduce((a,e)=>a+calc(e).netKRW,0);
    html+=`<div class="gh2"><span>${weekLabel(k,true)} <span class="muted">${range(k)}</span></span><b class="num">${won(sum)}</b></div><section class="card" style="padding:4px 16px">`;
    html+=arr.map(e=>{ const c=calc(e), u=e.currency!=="KRW", d=parseD(e.date);
      const sub=[`${fmtD(d)}(${DOW[d.getDay()]})`,`${u?"$"+fmtPs(e.perShare):won(e.perShare)} × ${qty(e.shares)}주`]; if(u&&e.fxPending) sub.push("환율 대기"); if(e.memo) sub.push(esc(e.memo));
      return `<div class="hl" data-edit="${e.id}"><div class="av" aria-hidden="true">${esc(e.ticker.slice(0,3))}</div>
        <div class="m"><div class="t">${esc(e.ticker)}</div><div class="s num">${sub.join(" · ")}</div></div>
        <div class="rt"><div class="t num">${won(c.netKRW)}</div><div class="s num muted">${c.yield!=null?c.yield.toFixed(2)+"%":(u&&S.settings.tdKey&&!e.priceFail?"…":"")}</div></div></div>`; }).join("");
    html+=`</section>`;
  }
  return html+add;
}

function holdBanner(){
  const odd=oddKrw();
  const banner = odd.length ? `<section class="card notice"><b>${odd.map(h=>esc(h.ticker)).join(", ")}</b> 종목이 국내(원) 종목으로 저장돼 있어서 현재가가 들어오지 않고 평가금액이 비어 있어요. 미국 주식을 원화로 산 거라면 ‘미국 종목이에요’를 눌러 주세요. 입력했던 평단은 원화 평단으로 옮겨져요.
    <div class="btnrow" style="margin-top:10px"><button class="primary" id="fixKrw">미국 종목이에요</button><button class="ghost" id="keepKrw">국내 종목 맞아요</button></div></section>` : "";
  return banner;
}

function tickerDetail(t){
  const es=S.entries.filter(e=>e.ticker===t).sort((a,b)=>a.date.localeCompare(b.date)||(a.created||0)-(b.created||0));
  if(!es.length) return `<section class="card"><div class="empty">${esc(t)} 기록이 아직 없어요.</div></section>`;
  const cur=es[0].currency, u=cur!=="KRW", last=es[es.length-1];
  const rec=es.slice(-4), avg=rec.reduce((a,e)=>a+e.perShare,0)/rec.length, tot=es.reduce((a,e)=>a+calc(e).netKRW,0);
  const show=es.slice(-26), labels=show.map(e=>fmtD(parseD(e.date)));
  const psFmt=v=>u?"$"+(+v).toFixed(3):Math.round(v).toLocaleString();
  const yl=show.map(e=>calc(e).yield);
  const rows=[...es].reverse().map(e=>{ const c=calc(e); return `<tr data-edit="${e.id}"><td class="l">${weekLabel(weekKey(e.date),true)}</td><td class="l">${fmtD(parseD(e.date))}</td><td>${u?"$"+fmtPs(e.perShare):won(e.perShare)}</td><td>${qty(e.shares)}</td><td class="amt">${won(c.netKRW)}</td><td>${c.yield!=null?c.yield.toFixed(2)+"%":"-"}</td></tr>`; }).join("");
  return `
  <section class="stats">
    <div class="stat"><div class="k">최근 주당 배당</div><div class="v num">${u?"$"+fmtPs(last.perShare):won(last.perShare)}</div></div>
    <div class="stat"><div class="k">최근 4회 평균</div><div class="v num">${u?"$"+fmtPs(avg.toFixed(4)):won(avg)}</div></div>
    <div class="stat"><div class="k">받은 배당 누적 (세후)</div><div class="v num up">${won(tot)}</div><div class="s" style="font-size:12px">${es.length}회</div></div>
  </section>
  <section class="card"><h2>주당 배당 변화 <small>최근 ${show.length}회</small></h2>${lineChart({labels,series:[{values:show.map(e=>e.perShare),color:"var(--red)",dots:true}],fmt:psFmt,fromZero:false,labelEvery:Math.max(1,Math.ceil(show.length/6))})}</section>
  ${yl.some(v=>v!=null)?`<section class="card"><h2>배당률 변화</h2>${lineChart({labels,series:[{values:yl,color:"var(--blue)",dots:true}],fmt:v=>v.toFixed(2)+"%",fromZero:false,labelEvery:Math.max(1,Math.ceil(show.length/6))})}</section>`:""}
  <section class="card"><h2>받은 금액 (세후)</h2>${barChart({labels,values:show.map(e=>calc(e).netKRW),labelEvery:Math.max(1,Math.ceil(show.length/6))})}</section>
  <section class="card full" style="padding:0"><div class="tbl"><table><thead><tr><th class="l">주차</th><th class="l">입금일</th><th>주당</th><th>수량</th><th>세후(원)</th><th>배당률</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function viewChart(modeOverride,noSeg){
  const mode=modeOverride||chartMode;
  const now=new Date(), y=now.getFullYear(), b=basis();
  const seg=noSeg?"":topCard()+`<div class="seg" id="cseg" style="margin-bottom:14px">${[["asset","자산"],["mix","비중"],["sim","재투자"],["rate","배당률"],["ticker","종목"]].map(([k,l])=>`<button data-m="${k}" aria-pressed="${mode===k}">${l}</button>`).join("")}</div>`;
  if(mode==="ticker"){
    const ts=[...new Set(S.entries.map(e=>e.ticker))].sort();
    if(tickerSel!=="all" && !ts.includes(tickerSel)) tickerSel="all";
    const chips=`<div class="chips" id="tchips">${["all",...ts].map(t=>`<button data-t="${esc(t)}" aria-pressed="${tickerSel===t}">${t==="all"?"전체":esc(t)}</button>`).join("")}</div>`;
    if(tickerSel==="all"){ const o={}; for(const e of S.entries){ if(parseD(e.date).getFullYear()===y) o[e.ticker]=(o[e.ticker]||0)+calc(e).netKRW; }
      // 현재 보유 비중: 평가금액 기준 (가격이 없는 종목은 매입금액으로 대신해요)
      const hv={}; let est=0; for(const r of portfolio().rows){ const v=r.val!=null?r.val:r.cost; if(!(v>0)) continue; hv[r.h.ticker]=(hv[r.h.ticker]||0)+v; if(r.val==null) est++; }
      const held=Object.entries(hv).sort((a,b)=>b[1]-a[1]);
      return seg+chips+`<section class="card"><h2>${y}년 받은 배당 비중 <small>세후</small></h2>${donut(Object.entries(o).sort((a,b)=>b[1]-a[1]))}</section>
        <section class="card"><h2>현재 보유 비중 <small>평가금액</small></h2>${held.length?donut(held):`<div class="empty">보유 탭에 종목을 넣으면 비중을 볼 수 있어요</div>`}${est?`<p class="muted" style="margin:10px 0 0;font-size:12px">현재가가 없는 ${est}개 종목은 매입금액으로 계산했어요.</p>`:""}</section>
        <p class="muted" style="margin:0 2px 12px">위에서 종목을 고르면 그 종목만 날짜별로 볼 수 있어요.</p>`; }
    return seg+chips+tickerDetail(tickerSel);
  }
  if(mode==="asset") return seg+assetView();
  if(mode==="mix") return seg+mixView();
  if(mode==="sim") return seg+simView();
  if(mode==="rate") return seg+rateView();
  const months=new Array(12).fill(0).map((_,i)=>actualYm(ymOf(y,i),b)), goals=months.map((_,i)=>goalFor(y,i)), hasGoal=goals.some(g=>g>0);
  const firstThisYear=S.entries.map(e=>e.date).filter(d=>d.startsWith(y+"-")).sort()[0];
  const startM=firstThisYear?parseD(firstThisYear).getMonth():0, cm=now.getMonth();
  const dim=new Date(y,cm+1,0).getDate();
  let startG=startM; while(startG<cm && !(goals[startG]>0)) startG++;
  let goalToDate=0; for(let i=startG;i<cm;i++) goalToDate+=goals[i]; goalToDate+=goals[cm]*now.getDate()/dim;
  const actToDate=months.slice(startG,cm+1).reduce((a,v)=>a+v,0);
  const goalCard = hasGoal ? `<section class="card"><h2>목표 대비</h2>
    <div class="stats" style="margin:0">
      <div class="stat"><div class="k">${cm+1}월</div><div class="v num">${goals[cm]?Math.round(months[cm]/goals[cm]*100)+"%":"-"}</div><div class="s" style="font-size:12px">${won(months[cm])} / ${won(goals[cm])}</div></div>
      <div class="stat"><div class="k">${startG===cm?"이번 달 지금까지":(startG+1)+"월부터 지금까지"}</div><div class="v num">${goalToDate?Math.round(actToDate/goalToDate*100):0}%</div><div class="s" style="font-size:12px">${won(actToDate)} / ${won(goalToDate)}</div></div>
    </div></section>`
    : `<section class="card"><div class="muted">계획 탭에서 <b>월별 목표</b>를 정하면 받은 금액과 목표를 그래프로 비교할 수 있어요.</div><div class="btnrow" style="margin-top:10px"><button id="goPlan">계획 탭으로</button></div></section>`;
  let body="";
  if(mode==="month"){
    body=`<section class="card"><h2>${y}년 월별 배당 </h2>${barChart({labels:months.map((_,i)=>(i+1)+"월"),values:months,target:hasGoal?goals:0})}
      <div class="legend"><span><i style="background:var(--red)"></i>받은 배당</span>${hasGoal?`<span><i style="background:var(--blue)"></i>그달 목표</span><span>흐린 막대: 목표 미달</span>`:""}</div></section>`;
  } else if(mode==="week"){
    const wk=new Map(); for(const e of S.entries){ const k=weekKey(e.date); wk.set(k,(wk.get(k)||0)+amtOf(e,b)); }
    const m0=monday(now), labels=[], vals=[], tg=[];
    for(let i=15;i>=0;i--){ const m=new Date(m0); m.setDate(m.getDate()-7*i); const k=isoOf(m); labels.push(weekLabel(k).replace("주차","주")); vals.push(wk.get(k)||0); tg.push(weekGoal(k)); }
    body=`<section class="card"><h2>최근 16주 </h2>${barChart({labels,values:vals,target:hasGoal?tg:0,labelEvery:3})}
      <div class="legend"><span><i style="background:var(--red)"></i>받은 배당</span>${hasGoal?`<span><i style="background:var(--blue)"></i>주간 목표 (월 목표×12÷52)</span>`:""}</div></section>`;
  } else {
    const labels=[], act=[], tgt=[]; let run=0, trun=0;
    for(let i=0;i<12;i++){ labels.push((i+1)+"월"); if(i<=cm){ run+=months[i]; act.push(i>=startM||run>0?run:null); } else act.push(null);
      if(i>=startM){ trun+=goals[i]; tgt.push(trun); } else tgt.push(null); }
    const series=[{values:act,color:"var(--red)"}]; if(hasGoal) series.push({values:tgt,color:"var(--blue)",dash:true});
    body=`<section class="card"><h2>${y}년 누적 배당 <small>${basisName()} ${won(months.reduce((a,v)=>a+v,0))}</small></h2>${lineChart({labels,series,labelEvery:2})}
      <div class="legend"><span><i style="background:var(--red)"></i>실제 누적</span>${hasGoal?`<span><i style="background:var(--blue)"></i>목표 누적</span>`:""}</div></section>`;
  }
  return seg+goalCard+body;
}

function yearOverview(){
  const now=new Date(), cy=now.getFullYear(), curYm=ymOf(cy,now.getMonth()), b=basis(), inv=investMap();
  const act={}; for(const e of S.entries){ const ym=e.date.slice(0,7); act[ym]=(act[ym]||0)+amtOf(e,b); }
  const starts=[...S.entries.map(e=>e.date.slice(0,7)), ...S.plan.map(p=>p.ym)].sort();
  const startYm=starts[0]||curYm;
  const ys=new Set([cy]); starts.forEach(ym=>ys.add(+ym.slice(0,4))); Object.keys(inv).forEach(ym=>ys.add(+ym.slice(0,4)));
  const years=[...ys].sort((a,c)=>a-c);
  let grid=`<div class="yh"></div>`+Array.from({length:12},(_,i)=>`<div class="yh">${i+1}</div>`).join("");
  const rows=[];
  for(const y of years){
    let gS=0,aS=0,iS=0;
    grid+=`<div class="yl">${y}</div>`;
    for(let i=0;i<12;i++){
      const ym=ymOf(y,i), g=ym>=startYm?goalFor(y,i):0, a=act[ym]||0, fut=ym>curYm;
      gS+=g; aS+=a; iS+=inv[ym]||0;
      let c="yc", st="", txt="";
      if(fut){ c+=" fut"; }
      else if(g){ const r=a/g; txt=Math.min(999,Math.round(r*100)); st = r>=1 ? "background:var(--red);color:#fff" : `background:color-mix(in srgb, var(--red) ${Math.round(10+r*50)}%, var(--cell0))`; }
      else if(a>0){ txt="·"; }
      if(ym===curYm) c+=" now";
      grid+=`<div class="${c}" style="${st}" title="${y}년 ${i+1}월 · 받은 배당 ${won(a)}${g?` / 목표 ${won(g)}`:""}${inv[ym]?` · 투자 ${inv[ym]}만원`:""}">${txt}</div>`;
    }
    rows.push(`<div class="lrow"><div><div class="t">${y}년</div><div class="s num">${gS?`목표 ${man(gS)}만 · `:""}받은 배당 ${aS?man(aS)+"만":"-"}${iS?` · 투자 ${hz(iS.toLocaleString("ko-KR",{maximumFractionDigits:1}))}만`:""}</div></div><div class="r"><div class="p ${gS&&y<=cy?(aS>=gS?"up":"down"):""}" style="font-size:16px">${gS&&y<=cy?Math.round(aS/gS*100)+"%":"-"}</div></div></div>`);
  }
  return `<section class="card full"><h2>연도별 한눈에 <small>칸 = 그달 목표 달성률(%)</small></h2>
    <div class="ygrid">${grid}</div>
    <div style="margin-top:10px">${rows.join("")}</div></section>`;
}
function investSumTxt(){
  const inv=investMap(), y=investYear; let yS=0, all=0;
  for(const ym in inv){ all+=inv[ym]; if(ym.startsWith(y+"-")) yS+=inv[ym]; }
  const f=n=>HIDE?MASK:n.toLocaleString("ko-KR",{maximumFractionDigits:1});
  return `${y}년 투자 <b class="num">${f(yS)}만원</b> · 전체 누적 <b class="num">${f(all)}만원</b>`;
}
function investCard(){
  const now=new Date(), cy=now.getFullYear(), curYm=ymOf(cy,now.getMonth()), inv=investMap();
  const ys=new Set([cy]); S.plan.forEach(p=>ys.add(+p.ym.slice(0,4))); Object.keys(inv).forEach(ym=>ys.add(+ym.slice(0,4)));
  const years=[...ys].sort((a,c)=>a-c); if(!years.includes(investYear)) investYear=cy;
  const y=investYear;
  const manual=investManual(), rows=Array.from({length:12},(_,i)=>{ const ym=ymOf(y,i), p=planOf(ym), v=inv[ym];
    return `<tr${ym===curYm?' class="cur"':""}><td class="l"><b>${i+1}월</b></td><td class="l muted">${p&&p.invest?hz(esc(p.invest)):"-"}</td><td><input class="inv num${manual[ym]?"":" auto"}" data-ym="${ym}" type="${HIDE?"password":"number"}" inputmode="decimal" step="any" min="0" value="${v||""}" placeholder="0" aria-label="${y}년 ${i+1}월 투자금액 (만원)"></td></tr>`; }).join("");
  return `<section class="card"><h2>월별 투자금액 <small>단위: 만원</small></h2>${yearChips("iychips",years,y)}
    <div class="tbl"><table><thead><tr><th class="l">월</th><th class="l">계획</th><th>실제 투자</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted" id="invSum" style="margin:10px 0 0">${investSumTxt()}</p>
    <p class="muted" style="font-size:12px;margin:4px 0 0">매수 기록이 있으면 그 금액을 자동으로 넣어요(옅은 글씨). 직접 적으면 그 값을 쓰고, 비우면 다시 자동 값으로 돌아가요.</p></section>`;
}
let assetRange = "year", assetDiv = true, ASSET=null, planMode = "plan";
function assetView(){
  if(!S.holdings.length) return `<section class="assetcard"><div class="empty" style="color:#9aa0ac">보유 탭에 종목과 매수 기록을 넣으면 내 투자 자산 그래프를 볼 수 있어요.</div></section>`;
  const R=[["year","올해"],["month","이달"],["1m","1달"],["6m","6달"],["1y","1년"],["all","전체"]];
  const d=assetData(assetRange), pts=d.pts; pts.forEach(p=>{ p.tot=p.val+(assetDiv?p.div:0); });
  const tabs=`<div class="rtabs" id="artabs">${R.map(([k,l])=>`<button data-r="${k}" aria-pressed="${assetRange===k}">${l}</button>`).join("")}</div>`;
  if(!pts.length) return `<section class="assetcard"><div class="empty" style="color:#9aa0ac">이 기간에는 보유 기록이 없어요.<br>매수 기록이 있는 기간을 골라 보세요.</div>${tabs}</section>`;
  const big=window.innerWidth>=700, k=big?1.25:1, W=big?720:400,H=big?300:290,pl=8,pr=big?84:58,pt=14,pb=big?32:26, t0=parseD(d.from).getTime(), t1=parseD(d.axisEnd).getTime();
  const vals=pts.flatMap(p=>[p.tot,p.cost]).filter(v=>v>0), hi0=Math.max(...vals), lo0=Math.min(...vals), padv=(hi0-lo0)*.06||hi0*.05, hi=hi0+padv, lo=Math.max(0,lo0-padv);
  const X=ms=>pl+(W-pl-pr)*(t1===t0?0:(ms-t0)/(t1-t0)), Y=v=>pt+(H-pt-pb)*(1-(v-lo)/((hi-lo)||1));
  let cpath="", prev=null; for(const p of pts){ if(!(p.cost>0)) continue; cpath+=prev==null?`M${X(p.ms)},${Y(p.cost)}`:`H${X(p.ms)}V${Y(p.cost)}`; prev=p; }
  const cx1=prev?X(prev.ms):0, area=cpath?`${cpath}L${cx1},${H-pb}L${X(pts.find(p=>p.cost>0).ms)},${H-pb}Z`:"";
  const aline=pts.filter(p=>p.tot>0).map(p=>`${X(p.ms).toFixed(1)},${Y(p.tot).toFixed(1)}`).join(" "), lp=[...pts].reverse().find(p=>p.tot>0);
  // x축 눈금
  const ticks=[]; const sd=parseD(d.from), ed=parseD(d.axisEnd), todayMs=parseD(todayStr()).getTime();
  if(assetRange==="year"||assetRange==="6m"||assetRange==="1y"){ const stepM=assetRange==="1y"?2:1; for(let c=new Date(sd.getFullYear(),sd.getMonth()+(assetRange==="year"?0:1),1); c<=ed; c=new Date(c.getFullYear(),c.getMonth()+stepM,1)) ticks.push([c.getTime(),(c.getMonth()+1)+"월"]); }
  else if(assetRange==="month"){ for(let day=1; day<=ed.getDate(); day+=5) ticks.push([new Date(ed.getFullYear(),ed.getMonth(),day).getTime(),day+"일"]); }
  else if(assetRange==="1m"){ for(let c=new Date(sd); c<=ed; c=new Date(c.getFullYear(),c.getMonth(),c.getDate()+7)) ticks.push([c.getTime(),(c.getMonth()+1)+"/"+c.getDate()]); }
  else { const n=Math.min(5,Math.max(1,Math.round((ed-sd)/864e5/60))); for(let i=0;i<=n;i++){ const c=new Date(sd.getTime()+(ed-sd)*i/n); ticks.push([c.getTime(),String(c.getFullYear()).slice(2)+"."+(c.getMonth()+1)]); } }
  const xl=ticks.map(([ms,l])=>`<text x="${X(ms).toFixed(1)}" y="${H-(big?10:6)}" font-size="${11.5*k}" text-anchor="${X(ms)<pl+14?"start":X(ms)>W-pr-14?"end":"middle"}" fill="${ms>todayMs?"#4b5060":"#e5e7eb"}">${l}</text>`).join("");
  ASSET={pts,X,Y,W,H,pl,pr,pt,pb};
  const last=pts[pts.length-1];
  return `<section class="assetcard full">
    <div class="lg"><span><i style="background:#ff6584"></i>자산${assetDiv?" (배당 포함)":""}</span><span><i style="background:#6b7384"></i>원금</span><button class="achip" id="adiv" aria-pressed="${assetDiv}">배당 포함</button></div>
    <div id="aHead" class="ahead">${assetHead(last,true)}</div>
    <svg id="assetsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="내 투자 자산 그래프" style="touch-action:pan-y">
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d8597" stop-opacity=".32"/><stop offset="1" stop-color="#7d8597" stop-opacity="0"/></linearGradient>
        <filter id="agl" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4"/></filter></defs>
      ${area?`<path d="${area}" fill="url(#ag)"/>`:""}
      ${cpath?`<path d="${cpath}" fill="none" stroke="#6b7384" stroke-width="${2.4*k}" stroke-linejoin="round"/>`:""}
      ${aline?`<polyline points="${aline}" fill="none" stroke="#ff6584" stroke-width="${3*k}" stroke-linejoin="round" stroke-linecap="round"/>`:""}
      ${lp?`<circle cx="${X(lp.ms)}" cy="${Y(lp.tot)}" r="${11*k}" fill="#ff6584" opacity=".35" filter="url(#agl)"/><circle cx="${X(lp.ms)}" cy="${Y(lp.tot)}" r="${6*k}" fill="#ff6584"/>`:""}
      <line id="acx" x1="0" x2="0" y1="${pt}" y2="${H-pb}" stroke="#9aa0ac" stroke-width="1" stroke-dasharray="3 3" visibility="hidden"/><circle id="acd" r="${5*k}" fill="#fff" visibility="hidden"/>
      <text x="${W-2}" y="${pt+9*k}" font-size="${12.5*k}" text-anchor="end" fill="#b3b8c4">${mfmt(hi)}</text>
      <text x="${W-2}" y="${H-pb-3}" font-size="${12.5*k}" text-anchor="end" fill="#b3b8c4">${mfmt(lo)}</text>
      ${xl}
    </svg>${tabs}
    <p class="note">자산은 매수 기록과 배당 입금일의 주가로 이은 추정선이에요. 원금은 그날까지 산 금액이에요. ‘배당 포함’은 평가금액에 그날까지 받은 배당(세후)을 더해요. 배당으로 재투자해서 산 것도 매수 기록에 넣었다면 겹쳐 보일 수 있으니 그땐 꺼 주세요.</p></section>`;
}
function assetHead(p,isNow){
  const gain=p.tot-p.cost, pc=p.cost>0?gain/p.cost*100:0, dt=parseD(p.D);
  return `<div class="ad">${isNow?"지금":(dt.getMonth()+1)+"월 "+dt.getDate()+"일"}</div><div class="av2 num">${won(p.tot)}</div>
    <div class="num ${gain>=0?"upd":"dnd"}">${wonS(gain)} (${pct(pc,1)}) <span class="adim">원금 ${won(p.cost)}${assetDiv&&p.div>0?` · 받은 배당 ${won(p.div)} 포함`:""}</span></div>`;
}
function viewPlan(){
  const now=new Date(), curYm=ymOf(now.getFullYear(),now.getMonth()), b=basis(), inv=investMap();
  const plan=[...S.plan].sort((a,c)=>a.ym.localeCompare(c.ym));
  if(!plan.length) return `<section class="card"><h2>월별 계획</h2><div class="empty" style="padding-top:8px">아직 계획이 없어요.<br>시작 원금과 매달 넣을 돈만 정하면 자동으로 만들어 줘요.</div>
    <div class="btnrow"><button class="primary" id="pGen">자동으로 만들기</button></div>
    <div class="btnrow" style="margin-top:8px"><button id="pImp">붙여넣기·파일로 불러오기</button><button id="pAdd" class="ghost">한 달씩 추가</button></div></section>`+investCard();
  const cur=planOf(curYm), mr=new Map(monthRates().map(m=>[m.ym,m])), p2=v=>v.toFixed(2)+"%";
  const curCard = cur ? (()=>{ const a=actualYm(curYm,b), pr=planRate(cur), m=mr.get(curYm), ar=m&&m.rate!=null?m.rate:null;
    return `<section class="card hero2"><div class="k">${now.getMonth()+1}월 받은 배당 (세후)</div>
    <div class="big num">${man(a)}<span style="font-size:18px;color:var(--muted);font-weight:500"> / ${hz(cur.expected)}만원</span></div>
    <div class="bar" style="margin:-4px 0 14px"><span style="width:${Math.min(100,a/(cur.expected*10000)*100)}%"></span></div>
    <div class="mini"><div><div class="k">계획 원금</div><div class="v num">${hz(cur.principal.toLocaleString())}만</div></div>
    <div><div class="k">계획 주배당</div><div class="v num">${pr!=null?p2(pr):"-"}</div></div>
    <div><div class="k">실제 주배당</div><div class="v num ${pr!=null&&ar!=null?(ar>=pr?"up":"down"):""}">${ar!=null?p2(ar):"-"}</div></div></div>
    ${cur.memo?`<p class="muted" style="margin:12px 0 0">${hz(esc(cur.memo))}</p>`:""}</section>`; })() : "";
  const labels=plan.map(p=>ymLabel(p.ym)), acts=plan.map(p=>p.ym<=curYm?actualYm(p.ym,b):0), exps=plan.map(p=>p.expected*10000);
  const rowOf=p=>{ const a=actualYm(p.ym,b), past=p.ym<=curYm, exp=p.expected*10000, r=exp?a/exp*100:0, isCur=p.ym===curYm;
    return `<div class="hl${isCur?" cur":""}" data-plan="${p.id}"><div class="m"><div class="t">${ymLabel(p.ym)}</div><div class="s num">원금 ${hz(p.principal.toLocaleString())}만${p.invest?` · ${hz(esc(p.invest))}`:""}</div></div>
      <div class="rt"><div class="t num">${past?man(a):"-"}<span class="muted" style="font-weight:400"> / ${hz(p.expected)}만</span></div><div class="s num ${past&&exp?(r>=100?"up":"down"):"muted"}">${past&&exp?Math.round(r)+"%":"예정"}</div></div></div>`; };
  const ci=Math.max(0,plan.findIndex(p=>p.ym>=curYm)-1), shown=plan.slice(ci,ci+12), rest=plan.filter(p=>!shown.includes(p));
  const rows=shown.map(rowOf).join("")+(rest.length?`<details class="help" style="margin:4px 0 10px"><summary>나머지 ${rest.length}개월 보기</summary>${rest.map(rowOf).join("")}</details>`:"");
  const chart=`<section class="card"><h2>예상 vs 실제</h2>${barChart({labels,values:acts,target:exps,labelEvery:Math.max(1,Math.ceil(plan.length/8))})}
    <div class="legend"><span><i style="background:var(--red)"></i>실제 배당</span><span><i style="background:var(--blue)"></i>예상 배당</span></div></section>`;
  const list=`<section class="card" style="padding:4px 16px"><h2 style="padding-top:12px">월별 계획 <small>눌러서 수정 · 단위 만원</small></h2>${rows}</section>`;
  const btns=`<div class="btnrow" style="margin-bottom:14px"><button class="primary" id="pAdd">월 추가</button><button id="pGen" class="ghost">자동으로 만들기</button></div>`;
  const note=`<p class="muted" style="font-size:12px;margin:0 2px 12px">실제 배당은 세후 기준이에요. 계획이 세전 금액이면 달성률이 낮게 보일 수 있어요. 기준 주배당은 설정 탭에서 바꿔요.</p>`;
  const clear=`<details class="help" style="margin:0 2px 12px"><summary>더 보기</summary><div class="btnrow" style="margin-top:8px"><button id="pImp">붙여넣기·파일로 불러오기</button><button id="pExp">CSV로 내보내기</button></div><div class="btnrow" style="margin-top:8px"><button class="danger" id="pClear">계획 전체 삭제</button></div></details>`;
  const pseg=`<div class="seg" id="pseg" style="margin:0 0 14px">${[["plan","월별 계획"],["year","연도별"],["invest","투자금"]].map(([k,l])=>`<button data-m="${k}" aria-pressed="${planMode===k}">${l}</button>`).join("")}</div>`;
  return curCard+pseg+(planMode==="year"?yearOverview()+chart:planMode==="invest"?investCard():list+btns+note+clear);
}

let SETOPEN = new Set();
function viewSet(){
  const st=S.settings;
  const num=(id,label,val,step,ph="")=>`<div class="srow"><label for="${id}">${label}</label><input id="${id}" type="number" inputmode="decimal" step="${step}" value="${val}" placeholder="${ph}"></div>`;
  const grp=(id,title,status,body)=>`<details class="sgrp" data-g="${id}"${SETOPEN.has(id)?" open":""}><summary><span class="gt">${title}</span><span class="gs">${status}</span></summary><div class="sbody">${body}</div></details>`;
  const goal=`${num("sgoal","기본 월 목표 (원)",st.goalMonthly||"","1000","예: 500000")}
    ${num("pby","기준 주배당 (%)",st.baseYield,"0.01")}
    ${num("srp","배당 재투자 비율 (%)",st.reinvestPct,"1")}
    ${num("sda","배당 변동 알림 기준 (%)",st.divAlertPct,"1")}
    <p class="muted" style="margin:4px 0 12px;font-size:12.5px">월 목표는 계획이 없는 달에, 기준 주배당은 배당률 그래프의 기준선에, 재투자 비율은 보유 탭의 총수익률에, 알림 기준은 요약 탭의 배당 변동 알림에 써요.</p>`;
  const fx=`<div class="srow"><div><div class="t num">${st.fx.toLocaleString()}원 / $1</div><div class="s">${st.fxDate?`${fmtD(parseD(st.fxDate))} 자동 갱신 · `:""}배당은 입금일 환율로 계산해요</div></div><button class="small" id="fxRef">새로고침</button></div>
    <div class="srow"><label for="sauto">환율 자동 연동</label><input type="checkbox" id="sauto" style="width:22px;height:22px" ${st.autoFx?"checked":""}></div>
    <div id="manualFx" ${st.autoFx?"hidden":""}>${num("sfx","직접 입력 환율",st.fx,"0.01")}</div>
    ${num("stu","미국 배당세 (%)",st.taxUS,"0.1")}
    ${num("stk","국내 배당세 (%)",st.taxKR,"0.1")}
    <div class="btnrow" style="margin:6px 0 12px"><button class="primary" id="saveSet">저장</button></div>`;
  const price=`<input id="std" value="${esc(st.tdKey)}" placeholder="Twelve Data API 키를 붙여 넣으세요" autocomplete="off" spellcheck="false" aria-label="Twelve Data API 키">
    <div class="btnrow" style="margin:10px 0"><button id="tdSave" class="primary">키 저장 · 테스트</button></div>
    <details class="help"><summary>키 받는 법 · 보관 방식</summary><ol>
      <li>twelvedata.com 에서 무료 가입 (카드 불필요)</li><li>대시보드 API Keys에서 키 복사</li><li>위 칸에 붙여 넣고 저장</li></ol>
      키는 이 기기에만 저장돼요. 구글 동기화와 백업 파일에는 들어가지 않아서 다른 기기에서는 따로 넣어야 해요. 공유 기기에서는 쓰고 나서 지워 주세요. 무료는 하루 800회, 분당 8회까지예요. 국내 종목은 보유 탭에서 현재가를 직접 넣어 주세요.</details>`;
  const cfgd=Cloud.configured(), who=Cloud.email();
  const google=`<p class="muted" style="margin:0 0 10px">${cfgd?(Cloud.ready()?`<b>${esc(who||"로그인됨")}</b> 계정으로 연결돼 있어요. 한 번 로그인하면 계속 유지되고, 변경하면 자동으로 동기화돼요.${Cloud.lastSync?` 마지막 동기화 ${new Date(Cloud.lastSync).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}`:""}`:"구글로 한 번 로그인하면 기기끼리 기록이 자동으로 합쳐져요."):"먼저 아래 ‘처음 한 번’ 안내대로 Supabase 주소와 키를 넣어 주세요."}</p>
    ${Cloud.fromFile()?"":`<input id="sbu" value="${esc((Cloud.cfg()||{}).url||"")}" placeholder="Supabase 프로젝트 주소 (https://○○○.supabase.co)" autocomplete="off" spellcheck="false" aria-label="Supabase 주소">
    <input id="sbk" value="${esc((Cloud.cfg()||{}).key||"")}" placeholder="publishable(anon) 키" autocomplete="off" spellcheck="false" aria-label="Supabase 키" style="margin-top:8px">`}
    <div class="btnrow" style="margin:10px 0"><button class="primary" id="gLink">${Cloud.ready()?"지금 동기화":"구글로 로그인"}</button>${Cloud.fromFile()?"":`<button id="gShare">연결 링크 복사</button>`}${Cloud.ready()?`<button class="ghost" id="gUnlink">로그아웃</button>`:""}</div>
    <details class="help"><summary>처음 한 번 설정하는 법</summary><ol>
      <li>supabase.com 에서 프로젝트를 만들어요 (이미 쓰는 프로젝트가 있으면 그대로 써도 돼요)</li>
      <li><b>SQL Editor</b>에서 아래 코드를 실행해 저장용 표를 만들어요.<pre style="white-space:pre-wrap;user-select:all;font-size:11.5px;background:var(--bg);padding:10px;border-radius:12px;margin:6px 0">create table if not exists public.app_state(
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}',
 updated_at timestamptz not null default now());
alter table public.app_state enable row level security;
create policy "own select" on public.app_state for select to authenticated using ((select auth.uid())=user_id);
create policy "own insert" on public.app_state for insert to authenticated with check ((select auth.uid())=user_id);
create policy "own update" on public.app_state for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own delete" on public.app_state for delete to authenticated using ((select auth.uid())=user_id);</pre></li>
      <li>Google Cloud Console → OAuth 클라이언트 ID(웹 애플리케이션) 만들기. <b>승인된 리디렉션 URI</b>에 Supabase가 알려 주는 콜백 주소(<code>https://○○○.supabase.co/auth/v1/callback</code>)를 넣어요</li>
      <li>Supabase → Authentication → Providers → <b>Google</b> 켜고 클라이언트 ID·시크릿 입력</li>
      <li>Supabase → Authentication → URL Configuration의 <b>Site URL</b>과 <b>Redirect URLs</b>에 이 앱 주소 <b>${esc(location.origin&&location.origin.startsWith("http")?location.origin+location.pathname:"https://내아이디.github.io/앱주소/")}</b> 를 넣어요</li>
      <li>Project Settings → API에서 <b>Project URL</b>과 <b>publishable(anon) 키</b>를 위 칸에 넣고 ‘구글로 로그인’. (service_role·secret 키는 절대 넣지 마세요)</li></ol>
      다른 기기에서는 ‘연결 링크 복사’로 보낸 링크를 열고 구글로 로그인만 하면 돼요.</details>`;
  const data=`<div class="btnrow" style="margin-bottom:10px"><button id="syOut">백업 파일 저장</button><button id="syIn">파일 합치기</button><button id="csv" class="ghost">CSV 내보내기</button></div>
    <input type="file" id="syFile" accept=".json,application/json,text/plain" hidden>
    <div class="btnrow" style="margin-bottom:12px"><button class="danger" id="wipe">이 기기의 모든 기록 삭제</button></div>`;
  return `
  <section class="card" style="padding:4px 16px">
    <div class="srow"><div><div class="t">금액 숨기기</div><div class="s">모든 금액·수량을 가려요. 이 기기에만 적용돼요.</div></div>
      <div class="seg" id="hideSeg" style="width:132px"><button data-h="0" aria-pressed="${!HIDE}">보이기</button><button data-h="1" aria-pressed="${HIDE}">숨기기</button></div></div>
  </section>
  <section class="card" style="padding:0 16px">
    ${grp("goal","목표 · 수익률",`재투자 ${st.reinvestPct}%`,goal)}
    ${grp("fx","환율 · 세금",`${st.fx.toLocaleString()}원 · ${st.taxUS}% / ${st.taxKR}%`,fx)}
    ${grp("price","주가 연동",st.tdKey?"연결됨":"미연결",price)}
    ${grp("google","구글 계정 · 자동 동기화",Cloud.ready()?"연결됨":"미연결",google)}
    ${grp("data","백업 · 데이터","",data)}
  </section>
  <p class="muted" style="text-align:center;font-size:12px;margin:4px 0 16px">v${APP_VERSION} · ${APP_DATE}${justUpdated?` · <span class="up">방금 업데이트 (v${esc(prevVer)} → v${APP_VERSION})</span>`:""}<br>${APP_NOTES}</p>`;
}

const NAVOF = {home:"home",hold:"hold",div:"div",log:"div",plan:"div",chart:"chart",set:"set"};
function render(){
  const v=$("#view");
  v.className = "tab-"+tab+(tab==="log"?(logMode==="table"?" one":" one list"):"");
  v.innerHTML = tab==="home"?viewHome():tab==="log"?topCard()+divSeg("log")+viewLog():tab==="hold"?viewHold():tab==="div"?viewDiv():tab==="chart"?viewChart():tab==="plan"?topCard()+divSeg("plan")+viewPlan():viewSet();
  const nv=NAVOF[tab]||tab;
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", b.dataset.tab===nv));
  $("#fab").hidden = !(tab==="home"||tab==="div"||tab==="log");
  const tb=document.querySelector('nav.tabs button[data-tab="'+nv+'"]'), pg=document.querySelector("header.top .pg"); if(tb&&pg) pg.textContent=tb.textContent;
  bindView(); Cloud.setChip();
}
