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
function viewHome(){
  const now=new Date(), y=now.getFullYear(), wk=byWeek();
  let ytd=0, total=0;
  for(const e of S.entries){ const v=calc(e).netKRW, d=parseD(e.date); total+=v; if(d.getFullYear()===y) ytd+=v; }
  const avg=recentAvgWeek(), rr=recentRate(), mon0=monday(now), thisWk=wk.get(isoOf(mon0))||0, lastWk=wk.get(isoOf(new Date(mon0.getFullYear(),mon0.getMonth(),mon0.getDate()-7)))||0;
  const start=monday(new Date(y,0,1)); const cells=[]; let max=0;
  for(let i=0;i<52;i++){ const m=new Date(start); m.setDate(m.getDate()+7*i); const v=wk.get(isoOf(m))||0; cells.push({m,v}); if(v>max)max=v; }
  const strip=cells.map(c=>{ const a=max?Math.max(.18,c.v/max):0; const now1=monday(now).getTime()===c.m.getTime();
    return `<div class="c${now1?" now":""}" style="${c.v>0?`background:color-mix(in srgb, var(--red) ${Math.round(a*100)}%, var(--cell0))`:""}" title="${weekLabel(isoOf(c.m))} · ${won(c.v)}"></div>`; }).join("");
  const labels=[], vals=[], tg=[], m0=monday(now), firstK=wk.size?[...wk.keys()].sort()[0]:isoOf(m0);
  for(let k=firstK; k<=isoOf(m0); k=addDays(k,7)){ labels.push(fmtD(parseD(k))); vals.push(wk.get(k)||0); tg.push(weekGoal(k)); }
  const hasGoal=tg.some(t=>t>0);
  return `
  <section class="card hero">
    <div class="label">${y}년 받은 배당 (세후)</div>
    <div class="big num">${won(ytd)}</div>
    <div class="sub">배당 들어온 주 ${cells.filter(c=>c.v>0).length}주 / 52주 · 누적 ${won(total)}</div>
    <div class="strip">${strip}</div>
    <div class="strip-legend"><span>1월</span><span>6월</span><span>12월</span></div>
    ${goalBlock()}
  </section>
  <section class="stats">
    <div class="stat"><div class="k">이번 주 (세후)</div><div class="v num">${won(thisWk)}</div><div class="muted" style="font-size:12px">지난주 ${won(lastWk)}</div></div>
    <div class="stat"><div class="k">최근 4주 평균 / 주</div><div class="v num">${won(avg)}</div></div>
    <div class="stat"><div class="k">연 환산 예상</div><div class="v num">${won(avg*52)}</div></div>
    <div class="stat" data-go-rate title="누르면 배당률 그래프로 이동"><div class="k">원금 대비 주배당률</div><div class="v num">${rr.rate!=null?rr.rate.toFixed(2)+"%":"-"}</div><div class="muted" style="font-size:12px">${rr.rate!=null?`최근 4주 · ${basisName()} · 원금 ${man(rr.pr)}만`:"계획 탭에서 원금을 넣어요"}</div></div>
  </section>
  ${alertCard()}
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

function viewHold(){
  if(!S.holdings.length) return `<section class="card"><div class="empty">보유 종목을 등록하면 현재 주가로 평가손익과 총수익률을 볼 수 있어요.</div></section><div class="btnrow"><button class="primary" id="addHold">종목 추가</button></div>`;
  const P=portfolio(), fx=S.settings.fx;
  const {tCost,tVal,tDivP,missing}=P, pl=tVal-tCost, gain=pl+tDivP, own=tCost-tDivP*RP(), q=Object.values(S.quotes).map(x=>x.at).sort().pop();
  const rows=P.rows.map(r=>{ const {h,p,cost,val,d}=r, kr=h.currency==="KRW";
    const pl1 = val!=null&&cost? val-cost : null, plp = pl1!=null? pl1/cost*100 : null, own1=cost-d*RP(), totp = pl1!=null&&own1>0? (pl1+d)/own1*100 : null;
    const avgTxt = kr ? (r.aK?won(r.aK):"평단 미입력") : r.aU ? usd(r.aU) : r.aK ? won(r.aK) : "평단 미입력";
    return `<div class="hl" data-hold="${h.id}"><div class="av" aria-hidden="true">${esc(h.ticker.slice(0,3))}</div>
      <div class="m"><div class="t">${esc(h.ticker)}</div><div class="s num">${qty(h.shares)}주 · 평단 ${avgTxt}</div></div>
      <div class="rt"><div class="t num">${val!=null?won(val):"가격 없음"}</div>${plp!=null?`<div class="s num ${cls(pl1)}">${pct(plp,1)}</div>`:`<div class="s">${p?"":"현재가 필요"}</div>`}${totp!=null&&d>0?`<div class="s num ${cls(totp)}" style="font-weight:500;font-size:12px">배당 포함 ${pct(totp,1)}</div>`:""}</div></div>`;
  }).join("");
  const odd=oddKrw();
  const banner = odd.length ? `<section class="card notice"><b>${odd.map(h=>esc(h.ticker)).join(", ")}</b> 종목이 국내(원) 종목으로 저장돼 있어서 현재가가 들어오지 않고 평가금액이 비어 있어요. 미국 주식을 원화로 산 거라면 ‘미국 종목이에요’를 눌러 주세요. 입력했던 평단은 원화 평단으로 옮겨져요.
    <div class="btnrow" style="margin-top:10px"><button class="primary" id="fixKrw">미국 종목이에요</button><button class="ghost" id="keepKrw">국내 종목 맞아요</button></div></section>` : "";
  const notes=[`달러 종목은 오늘 환율(${fx.toLocaleString()}원)로 평가해요.`];
  if(missing) notes.push(`가격이 없는 종목 ${missing}개는 합계에서 빠졌어요.`);
  if(!S.settings.tdKey) notes.push("설정에서 주가 API 키를 넣으면 현재가가 자동으로 들어와요.");
  if(tCost) notes.push(`배당 ${Math.round(RP()*100)}% 재투자 가정: 내가 넣은 돈 = 원금 ${won(tCost)} − 재투자한 배당 ${won(tDivP*RP())}. 비율은 설정에서 바꿔요.`);
  return `${banner}
  <section class="card hero2">
    <div class="k">평가금액${q?` · ${new Date(q).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}`:""}</div>
    <div class="big num">${won(tVal)}</div>
    <div class="num ${cls(gain)}" style="font-weight:600;margin:-8px 0 14px">${tCost?`${wonS(gain)}${own>0?` (${pct(gain/own*100,1)})`:""}`:"-"} <span class="muted" style="font-weight:400">배당 포함 총수익</span></div>
    <div class="mini"><div><div class="k">내가 넣은 돈</div><div class="v num">${tCost?won(Math.max(0,own)):"-"}</div></div>
    <div><div class="k">받은 배당</div><div class="v num up">${won(tDivP)}</div></div>
    <div><div class="k">평가손익</div><div class="v num ${cls(pl)}">${tCost?wonS(pl):"-"}</div></div></div>
    <details class="help" style="margin-top:12px"><summary>계산 기준</summary><p class="muted" style="margin:6px 0 0">${notes.join(" ")}</p></details>
  </section>
  <section class="card" style="padding:4px 16px">${rows}</section>
  <div class="btnrow"><button id="refQ" class="ghost" ${S.settings.tdKey?"":"disabled"}>주가 새로고침</button><button class="primary" id="addHold">종목 추가</button></div>`;
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

function viewChart(){
  const now=new Date(), y=now.getFullYear(), b=basis();
  const seg=`<div class="seg" id="cseg" style="margin-bottom:14px">${[["month","월별"],["week","주별"],["cum","누적"],["ticker","종목"],["rate","배당률"]].map(([k,l])=>`<button data-m="${k}" aria-pressed="${chartMode===k}">${l}</button>`).join("")}</div>`;
  if(chartMode==="ticker"){
    const ts=[...new Set(S.entries.map(e=>e.ticker))].sort();
    if(tickerSel!=="all" && !ts.includes(tickerSel)) tickerSel="all";
    const chips=`<div class="chips" id="tchips">${["all",...ts].map(t=>`<button data-t="${esc(t)}" aria-pressed="${tickerSel===t}">${t==="all"?"전체":esc(t)}</button>`).join("")}</div>`;
    if(tickerSel==="all"){ const o={}; for(const e of S.entries){ if(parseD(e.date).getFullYear()===y) o[e.ticker]=(o[e.ticker]||0)+calc(e).netKRW; }
      return seg+chips+`<section class="card"><h2>${y}년 종목별 비중 (세후)</h2>${donut(Object.entries(o).sort((a,b)=>b[1]-a[1]))}<p class="muted" style="margin:10px 0 0">위에서 종목을 고르면 그 종목만 날짜별로 볼 수 있어요.</p></section>`; }
    return seg+chips+tickerDetail(tickerSel);
  }
  if(chartMode==="rate") return seg+rateView();
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
  if(chartMode==="month"){
    body=`<section class="card"><h2>${y}년 월별 배당 </h2>${barChart({labels:months.map((_,i)=>(i+1)+"월"),values:months,target:hasGoal?goals:0})}
      <div class="legend"><span><i style="background:var(--red)"></i>받은 배당</span>${hasGoal?`<span><i style="background:var(--blue)"></i>그달 목표</span><span>흐린 막대: 목표 미달</span>`:""}</div></section>`;
  } else if(chartMode==="week"){
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
  const rows=Array.from({length:12},(_,i)=>{ const ym=ymOf(y,i), p=planOf(ym), v=inv[ym];
    return `<tr${ym===curYm?' class="cur"':""}><td class="l"><b>${i+1}월</b></td><td class="l muted">${p&&p.invest?hz(esc(p.invest)):"-"}</td><td><input class="inv num" data-ym="${ym}" type="${HIDE?"password":"number"}" inputmode="decimal" step="any" min="0" value="${v||""}" placeholder="0" aria-label="${y}년 ${i+1}월 투자금액 (만원)"></td></tr>`; }).join("");
  return `<section class="card"><h2>월별 투자금액 <small>단위: 만원</small></h2>${yearChips("iychips",years,y)}
    <div class="tbl"><table><thead><tr><th class="l">월</th><th class="l">계획</th><th>실제 투자</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted" id="invSum" style="margin:10px 0 0">${investSumTxt()}</p>
    <p class="muted" style="font-size:12px;margin:4px 0 0">그달 실제로 넣은 돈을 적으면 바로 저장돼요. 비우면 지워져요.</p></section>`;
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
  return curCard+yearOverview()+chart+list+btns+investCard()+note+clear;
}

function viewSet(){
  const st=S.settings;
  const num=(id,label,val,step,ph="")=>`<div class="srow"><label for="${id}">${label}</label><input id="${id}" type="number" inputmode="decimal" step="${step}" value="${val}" placeholder="${ph}"></div>`;
  return `
  <div class="gh">화면</div>
  <section class="card" style="padding:4px 16px">
    <div class="srow"><div><div class="t">금액 숨기기</div><div class="s">모든 금액·수량을 가려요. 이 기기에만 적용돼요.</div></div>
      <div class="seg" id="hideSeg" style="width:132px"><button data-h="0" aria-pressed="${!HIDE}">보이기</button><button data-h="1" aria-pressed="${HIDE}">숨기기</button></div></div>
  </section>
  <div class="gh">목표 · 수익률</div>
  <section class="card" style="padding:4px 16px">
    ${num("sgoal","기본 월 목표 (원)",st.goalMonthly||"","1000","예: 500000")}
    ${num("pby","기준 주배당 (%)",st.baseYield,"0.01")}
    ${num("srp","배당 재투자 비율 (%)",st.reinvestPct,"1")}
    ${num("sda","배당 변동 알림 기준 (%)",st.divAlertPct,"1")}
    <details class="help" style="margin:0 0 10px"><summary>이 값들이 쓰이는 곳</summary><p style="margin:6px 0 0">기본 월 목표는 계획이 없는 달에, 기준 주배당은 배당률 그래프의 기준선에 써요. 재투자 비율은 보유 탭의 총수익률(내가 넣은 돈 기준)에, 알림 기준은 요약 탭의 배당 변동 알림에 써요. 달마다 다른 목표는 계획 탭에서 정해요.</p></details>
  </section>
  <div class="gh">환율 · 세금</div>
  <section class="card" style="padding:4px 16px">
    <div class="srow"><div><div class="t num">${st.fx.toLocaleString()}원 / $1</div><div class="s">${st.fxDate?`${fmtD(parseD(st.fxDate))} 자동 갱신 · `:""}배당은 입금일 환율로 계산해요</div></div><button class="small" id="fxRef">새로고침</button></div>
    <div class="srow"><label for="sauto">환율 자동 연동</label><input type="checkbox" id="sauto" style="width:22px;height:22px" ${st.autoFx?"checked":""}></div>
    <div id="manualFx" ${st.autoFx?"hidden":""}>${num("sfx","직접 입력 환율",st.fx,"0.01")}</div>
    ${num("stu","미국 배당세 (%)",st.taxUS,"0.1")}
    ${num("stk","국내 배당세 (%)",st.taxKR,"0.1")}
    <div class="btnrow" style="margin:6px 0 12px"><button class="primary" id="saveSet">저장</button></div>
  </section>
  <div class="gh">연동</div>
  <section class="card">
    <h2>주가 <small>${st.tdKey?"연결됨":"미연결"}</small></h2>
    <input id="std" value="${esc(st.tdKey)}" placeholder="Twelve Data API 키를 붙여 넣으세요" autocomplete="off" spellcheck="false" aria-label="Twelve Data API 키">
    <div class="btnrow" style="margin-top:10px"><button id="tdSave" class="primary">키 저장 · 테스트</button></div>
    <details class="help"><summary>키 받는 법 · 보관 방식</summary><ol>
      <li>twelvedata.com 에서 무료 가입 (카드 불필요)</li><li>대시보드 API Keys에서 키 복사</li><li>위 칸에 붙여 넣고 저장</li></ol>
      키는 이 기기에만 저장돼요. 구글 동기화와 백업 파일에는 들어가지 않아서 다른 기기에서는 따로 넣어야 해요. 공유 기기에서는 쓰고 나서 지워 주세요. 무료는 하루 800회, 분당 8회까지예요. 국내 종목은 보유 탭에서 현재가를 직접 넣어 주세요.</details>
  </section>
  <section class="card">
    <h2>구글 계정 <small>${st.gLinked?"연결됨":"미연결"}</small></h2>
    <p class="muted" style="margin:0 0 10px">같은 구글 계정으로 연결하면 기기끼리 기록이 합쳐져요.${st.gLinked?(Drive.lastSync?` 이 기기 마지막 동기화 ${new Date(Drive.lastSync).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}`:" 이 기기에서는 아직 동기화 전이에요."):""}</p>
    <input id="sgc" value="${esc(st.gClientId)}" placeholder="구글 OAuth 클라이언트 ID" autocomplete="off" spellcheck="false" aria-label="구글 OAuth 클라이언트 ID">
    <div class="btnrow" style="margin-top:10px"><button class="primary" id="gLink">${st.gLinked?"지금 동기화":"구글 계정 연결"}</button><button id="gShare">연결 링크 복사</button>${st.gLinked?`<button class="ghost" id="gUnlink">연결 해제</button>`:""}</div>
    <details class="help"><summary>클라이언트 ID 만드는 법 (처음 한 번)</summary><ol>
      <li>console.cloud.google.com 접속 → 새 프로젝트 만들기</li>
      <li>API 및 서비스 → 라이브러리 → <b>Google Drive API</b> 사용 설정</li>
      <li>OAuth 동의 화면 → 외부(External) → 앱 이름·이메일 입력 → 테스트 사용자에 <b>내 구글 계정</b> 추가</li>
      <li>사용자 인증 정보 → OAuth 클라이언트 ID → 유형 <b>웹 애플리케이션</b></li>
      <li>승인된 JavaScript 원본에 <b>${esc(location.origin&&location.origin.startsWith("http")?location.origin:"https://내아이디.github.io")}</b> 추가 → 만들기</li>
      <li>나온 클라이언트 ID를 위 칸에 붙여 넣고 ‘구글 계정 연결’</li></ol>
      다른 기기에서는 ‘연결 링크 복사’로 보낸 링크를 열면 ID가 자동으로 들어가요. 로그인은 보통 알아서 이어지고, 풀리면 화면을 한 번 누르거나 위쪽 ☁ 버튼을 눌러 주세요.</details>
  </section>
  <div class="gh">데이터</div>
  <section class="card">
    <div class="btnrow"><button id="syOut">백업 파일 저장</button><button id="syIn">파일 합치기</button><button id="csv" class="ghost">CSV 내보내기</button></div>
    <input type="file" id="syFile" accept=".json,application/json,text/plain" hidden>
    <div class="btnrow" style="margin-top:10px"><button class="danger" id="wipe">이 기기의 모든 기록 삭제</button></div>
  </section>
  <p class="muted" style="text-align:center;font-size:12px;margin:4px 0 16px">v${APP_VERSION} · ${APP_DATE}${justUpdated?` · <span class="up">방금 업데이트 (v${esc(prevVer)} → v${APP_VERSION})</span>`:""}<br>${APP_NOTES}</p>`;
}

function render(){
  const v=$("#view");
  v.className = "tab-"+tab+(tab==="log"?(logMode==="table"?" one":" one list"):"");
  v.innerHTML = tab==="home"?viewHome():tab==="log"?viewLog():tab==="hold"?viewHold():tab==="chart"?viewChart():tab==="plan"?viewPlan():viewSet();
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", b.dataset.tab===tab));
  $("#fab").hidden = !(tab==="home"||tab==="log");
  const tb=document.querySelector('nav.tabs button[data-tab="'+tab+'"]'), pg=document.querySelector("header.top .pg"); if(tb&&pg) pg.textContent=tb.textContent;
  bindView(); Drive.setChip();
}
