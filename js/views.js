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
    return seg+`<div class="card" style="padding:0"><div class="tbl ltbl"><table><thead><tr><th>종목 · 입금일</th><th>주당</th><th>수량</th><th>세후(원)</th><th>배당률</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <p class="muted" style="font-size:12px;margin:8px 2px 0">표를 옆으로 밀면 더 볼 수 있어요. 행을 누르면 수정돼요.</p>`+add;
  }
  let html=seg;
  for(const [k,arr] of groups){
    const sum=arr.reduce((a,e)=>a+calc(e).netKRW,0);
    html+=`<section class="card wcard"><div class="wcard-h"><div><div class="wt">${weekLabel(k,true)}</div><div class="wr">${range(k)} · ${arr.length}건</div></div><div class="ws num">${won(sum)}</div></div>`;
    const days=new Map(); for(const e of arr){ if(!days.has(e.date)) days.set(e.date,[]); days.get(e.date).push(e); }
    for(const [d,es] of days){
      const same=f=>es.every(x=>String(x[f])===String(es[0][f]));
      const us=es.filter(x=>x.currency!=="KRW"), taxC=same("taxRate"), fxC=us.length>0&&us.every(x=>x.fx===us[0].fx), pend=us.some(x=>x.fxPending);
      const dd=parseD(d), pills=[];
      if(taxC) pills.push(`세금 ${es[0].taxRate}%`);
      if(fxC) pills.push(`환율 ${us[0].fx.toLocaleString()}원${pend?" (반영 대기)":""}`);
      html+=`<div class="dgroup"><div class="dh"><span class="d">${fmtD(dd)} (${DOW[dd.getDay()]})</span>${pills.map(t=>`<span class="pill num">${t}</span>`).join("")}</div>`;
      html+=es.map(e=>{ const c=calc(e), u=e.currency!=="KRW";
        const y = c.yield!=null ? `<span class="yield num">${c.yield.toFixed(2)}%</span>` : (u&&S.settings.tdKey&&!e.priceFail?`<span class="yield">주가 불러오는 중</span>`:"");
        const extra=[]; if(!taxC) extra.push(`세금 ${e.taxRate}%`); if(u&&!fxC) extra.push(`환율 ${e.fx}${e.fxPending?" (반영 대기)":""}`); if(e.memo) extra.push(esc(e.memo));
        return `<div class="ent" data-edit="${e.id}"><div class="av" aria-hidden="true">${esc(e.ticker.slice(0,3))}</div>
          <div class="m"><div class="tk">${esc(e.ticker)}</div>
          <div class="sb num">${u?"$"+fmtPs(e.perShare):won(e.perShare)} × ${qty(e.shares)}주${extra.length?" · "+extra.join(" · "):""}</div>${y}</div>
          <div class="am"><div class="a num">${won(c.netKRW)}</div>${u?`<div class="u num">${usd(c.net)}</div>`:""}</div></div>`; }).join("");
      html+=`</div>`;
    }
    html+=`</section>`;
  }
  return html+add;
}

function viewHold(){
  if(!S.holdings.length) return `<section class="card"><div class="empty">보유 종목을 등록하면 현재 주가로 평가손익과 배당 포함 수익을 볼 수 있어요.</div></section><div class="btnrow"><button class="primary" id="addHold">종목 추가</button></div>`;
  const P=portfolio(), fx=S.settings.fx;
  const rows=P.rows.map(r=>{ const {h,p,cost,val,d}=r, kr=h.currency==="KRW";
    const pl = val!=null&&cost? val-cost : null, plp = pl!=null? pl/cost*100 : null, own0=cost-d*RP(), tot = pl!=null&&own0>0? (pl+d)/own0*100 : null;
    const pTxt = p? (kr?won(p):usd(p)) : "가격 없음";
    const avgTxt = kr ? (r.aK?won(r.aK):"미입력") : r.aU ? usd(r.aU) : r.aK ? won(r.aK) : "미입력";
    return `<div class="row hrow" data-hold="${h.id}" style="cursor:pointer;align-items:flex-start"><div class="l"><div class="t">${esc(h.ticker)}<span class="tag">${esc(h.freq||"주배당")}</span>${kr?`<span class="tag">국내</span>`:""}</div>
      <div class="s num">${qty(h.shares)}주 · 평단 ${avgTxt} · 현재 ${pTxt}</div></div>
      <div class="r"><div class="num" style="font-weight:600">${val!=null?won(val):"-"}</div><div class="s num ${cls(pl||0)}">${pl!=null?`${wonS(pl)} (${pct(plp,1)})`:""}</div></div>
      <div class="full"><div class="s num">받은 배당 ${won(d)}${val?` <b class="up nw">(평가금액 대비 ${(d/val*100).toFixed(2)}%)</b>`:""}</div>
      ${tot!=null?`<div class="s num">총수익률 (재투자 반영) <b class="${cls(tot)}">${pct(tot,2)}</b></div>`:""}</div></div>`;
  }).join("");
  const {tCost,tVal,tDiv,tDivP,tFx,fxN,noFx,missing}=P, pl=tVal-tCost, gain=pl+tDivP, own=tCost-tDivP*RP(), q=Object.values(S.quotes).map(x=>x.at).sort().pop();
  const odd=oddKrw();
  const banner = odd.length ? `<section class="card notice"><b>${odd.map(h=>esc(h.ticker)).join(", ")}</b> 종목이 국내(원) 종목으로 저장돼 있어서 현재가가 들어오지 않고 평가금액이 비어 있어요. 미국 주식을 원화로 산 거라면 ‘미국 종목이에요’를 눌러 주세요. 입력했던 평단은 원화 평단으로 옮겨져요.
    <div class="btnrow" style="margin-top:10px"><button class="primary" id="fixKrw">미국 종목이에요</button><button class="ghost" id="keepKrw">국내 종목 맞아요</button></div></section>` : "";
  const notes=[`달러 종목은 오늘 환율(${fx.toLocaleString()}원)로 평가해요.`];
  if(tCost) notes.push(`배당 ${Math.round(RP()*100)}% 재투자 가정: 내가 넣은 돈 ${won(Math.max(0,own))} = 원금 ${won(tCost)} − 재투자한 배당 ${won(tDivP*RP())}. 비율은 설정에서 바꿔요.`);
  if(missing) notes.push(`가격이 없는 종목 ${missing}개는 합계에서 빠졌어요.`);
  if(!S.settings.tdKey) notes.push("설정에서 주가 API 키를 넣으면 현재가가 자동으로 들어와요.");
  return `${banner}
  <section class="card">
    <h2>내 주식 수익 <small>${q?`주가 ${new Date(q).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}`:""}</small></h2>
    <div class="stats" style="margin:0">
      <div class="stat"><div class="k">평가금액</div><div class="v num">${won(tVal)}</div></div>
      <div class="stat"><div class="k">평가손익</div><div class="v num ${cls(pl)}">${tCost?`${wonS(pl)}`:"-"}</div><div class="s num ${cls(pl)}" style="font-size:12px">${tCost?pct(pl/tCost*100):""}</div></div>
      <div class="stat"><div class="k">받은 배당 (세후)</div><div class="v num up">${won(tDiv)}</div><div class="s num up" style="font-size:12px">${tVal?`평가금액 대비 ${(tDivP/tVal*100).toFixed(2)}%`:""}</div></div>
      <div class="stat"><div class="k">총수익 (배당 포함)</div><div class="v num ${cls(gain)}">${tCost?wonS(gain):"-"}</div><div class="s num ${cls(gain)}" style="font-size:12px">${tCost&&own>0?`${pct(gain/own*100)} · 내 돈 대비`:""}</div></div>
    </div>
    <p class="muted" style="margin:10px 0 0">${notes.join(" ")}</p>
  </section>
  <section class="card" style="padding:4px 16px">${rows}</section>
  <div class="btnrow"><button id="refQ" ${S.settings.tdKey?"":"disabled"}>주가 새로고침</button><button class="primary" id="addHold">종목 추가</button></div>`;
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
  const goalCard = hasGoal ? `<section class="card"><h2>목표 대비 <small>${basisName()} 기준</small></h2>
    <div class="stats" style="margin:0">
      <div class="stat"><div class="k">${cm+1}월</div><div class="v num">${goals[cm]?Math.round(months[cm]/goals[cm]*100)+"%":"-"}</div><div class="s" style="font-size:12px">${won(months[cm])} / ${won(goals[cm])}</div></div>
      <div class="stat"><div class="k">${startG===cm?"이번 달 지금까지":(startG+1)+"월부터 지금까지"}</div><div class="v num">${goalToDate?Math.round(actToDate/goalToDate*100):0}%</div><div class="s" style="font-size:12px">${won(actToDate)} / ${won(goalToDate)}</div></div>
    </div></section>`
    : `<section class="card"><div class="muted">계획 탭에서 <b>월별 목표</b>를 정하면 받은 금액과 목표를 그래프로 비교할 수 있어요.</div><div class="btnrow" style="margin-top:10px"><button id="goPlan">계획 탭으로</button></div></section>`;
  let body="";
  if(chartMode==="month"){
    body=`<section class="card"><h2>${y}년 월별 배당 <small>${basisName()}</small></h2>${barChart({labels:months.map((_,i)=>(i+1)+"월"),values:months,target:hasGoal?goals:0})}
      <div class="legend"><span><i style="background:var(--red)"></i>받은 배당</span>${hasGoal?`<span><i style="background:var(--blue)"></i>그달 목표</span><span>흐린 막대: 목표 미달</span>`:""}</div></section>`;
  } else if(chartMode==="week"){
    const wk=new Map(); for(const e of S.entries){ const k=weekKey(e.date); wk.set(k,(wk.get(k)||0)+amtOf(e,b)); }
    const m0=monday(now), labels=[], vals=[], tg=[];
    for(let i=15;i>=0;i--){ const m=new Date(m0); m.setDate(m.getDate()-7*i); const k=isoOf(m); labels.push(weekLabel(k).replace("주차","주")); vals.push(wk.get(k)||0); tg.push(weekGoal(k)); }
    body=`<section class="card"><h2>최근 16주 <small>${basisName()}</small></h2>${barChart({labels,values:vals,target:hasGoal?tg:0,labelEvery:3})}
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
    rows.push(`<tr${y===cy?' class="cur"':""}><td class="l"><b>${y}</b></td><td>${gS?man(gS):"-"}</td><td class="${aS?"amt":""}">${aS?man(aS):"-"}</td><td class="${gS&&y<=cy?(aS>=gS?"up":"down"):""}">${gS&&y<=cy?Math.round(aS/gS*100)+"%":"-"}</td><td>${iS?hz(iS.toLocaleString("ko-KR",{maximumFractionDigits:1})):"-"}</td></tr>`);
  }
  return `<section class="card full"><h2>연도별 한눈에 <small>${basisName()} 기준</small></h2>
    <div class="ygrid">${grid}</div>
    <p class="muted" style="font-size:12px;margin:8px 0 12px">칸 숫자는 그달 목표 대비 달성률(%)이에요. 빨간 칸은 목표 달성, 점선 칸은 아직 오지 않은 달이에요.</p>
    <div class="tbl"><table><thead><tr><th class="l">연도</th><th>연 목표</th><th>받은 배당</th><th>달성</th><th>투자금</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    <p class="muted" style="font-size:12px;margin:6px 0 0">금액 단위: 만원</p></section>`;
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
  const now=new Date(), curYm=ymOf(now.getFullYear(),now.getMonth()), b=basis(), st=S.settings, inv=investMap(), wide=isWide();
  const plan=[...S.plan].sort((a,c)=>a.ym.localeCompare(c.ym));
  const head=`<section class="card"><h2>배당 계획 <small>단위: 만원</small></h2>
    <div class="grid2"><div><label class="f" for="pby">기준 주배당 (%)</label><input id="pby" type="number" inputmode="decimal" step="0.01" value="${st.baseYield}"></div>
    <div><label class="f">배당 비교 기준</label><div class="seg tall" id="pbasis"><button data-b="gross" aria-pressed="${b==="gross"}">세전</button><button data-b="net" aria-pressed="${b==="net"}">세후</button></div></div></div>
    <p class="muted" style="margin:10px 0 0">주배당은 원금 대비 한 주 기준이에요. 월 예상 배당 = 원금 × 주배당 × 4주. 계획은 보통 분배율 기준이라 세전 비교를 권해요.</p></section>`;
  if(!plan.length) return head+yearOverview()+`<section class="card"><div class="empty">아직 계획이 없어요.</div><div class="btnrow"><button id="pLoad">예상 배당금 계획 불러오기</button><button class="primary" id="pAdd">월 추가</button></div></section>`+investCard();
  const cur=planOf(curYm), P=portfolio(), mr=new Map(monthRates().map(m=>[m.ym,m])), p2=v=>v.toFixed(2)+"%";
  const curCard = cur ? (()=>{ const a=actualYm(curYm,b), pr=planRate(cur), m=mr.get(curYm), ar=m&&m.rate!=null?m.rate:null;
    return `<section class="card hero"><div class="label">${now.getMonth()+1}월 계획 · ${basisName()} 기준</div>
    <div class="big num">${man(a)}<span style="font-size:18px;color:var(--muted)"> / ${hz(cur.expected)}만원</span></div>
    <div class="bar"><span style="width:${Math.min(100,a/(cur.expected*10000)*100)}%"></span></div>
    <div class="stats" style="margin:14px 0 0">
      <div class="stat"><div class="k">계획 원금</div><div class="v num">${hz(cur.principal.toLocaleString())}만</div></div>
      <div class="stat"><div class="k">현재 평가액</div><div class="v num ${P.tVal/10000>=cur.principal?"up":"down"}">${P.tVal?man(P.tVal)+"만":"-"}</div></div>
      <div class="stat"><div class="k">계획 주배당률 (원금 대비)</div><div class="v num">${pr!=null?p2(pr):"-"}</div></div>
      <div class="stat"><div class="k">실제 주배당률 (이번 달)</div><div class="v num ${pr!=null&&ar!=null?(ar>=pr?"up":"down"):""}">${ar!=null?p2(ar):"-"}</div></div>
    </div>${cur.memo?`<p class="muted" style="margin:10px 0 0">${hz(esc(cur.memo))}</p>`:""}</section>`; })() : "";
  const labels=plan.map(p=>ymLabel(p.ym)), acts=plan.map(p=>p.ym<=curYm?actualYm(p.ym,b):0), exps=plan.map(p=>p.expected*10000);
  const rows=plan.map(p=>{ const a=actualYm(p.ym,b), past=p.ym<=curYm, r=p.expected?a/(p.expected*10000)*100:0, pr=planRate(p), m=mr.get(p.ym), ar=past&&m&&m.rate!=null?m.rate:null;
    return `<tr data-plan="${p.id}"${p.ym===curYm?' class="cur"':""}><td class="l"><b>${ymLabel(p.ym)}</b></td><td>${hz(p.principal.toLocaleString())}</td><td class="l">${hz(esc(p.invest||""))}</td><td>${inv[p.ym]?hz(inv[p.ym].toLocaleString("ko-KR",{maximumFractionDigits:1})):"-"}</td><td>${hz(p.expected)}</td><td class="amt">${past?man(a):"-"}</td><td class="${past?(r>=100?"up":"down"):""}">${past&&p.expected?Math.round(r)+"%":"-"}</td><td>${pr!=null?p2(pr):"-"}</td><td class="${ar!=null&&pr!=null?(ar>=pr?"up":"down"):""}">${ar!=null?p2(ar):"-"}</td><td class="l muted" style="white-space:normal;min-width:150px">${hz(esc(p.memo||""))}</td></tr>`; }).join("");
  const chart=`<section class="card"><h2>예상 vs 실제 <small>${basisName()}</small></h2>${barChart({labels,values:acts,target:exps,labelEvery:Math.max(1,Math.ceil(plan.length/8))})}
    <div class="legend"><span><i style="background:var(--red)"></i>실제 배당</span><span><i style="background:var(--blue)"></i>예상 배당</span></div></section>`;
  const table=`<section class="card full" style="padding:0"><div class="tbl"><table><thead><tr><th class="l">월</th><th>원금</th><th class="l">투자 계획</th><th>실제 투자</th><th>예상</th><th>실제</th><th>달성</th><th>계획 주배당</th><th>실제 주배당</th><th class="l">메모</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  const note=`<p class="muted" style="font-size:12px;margin:-6px 2px 12px">행을 누르면 그달 계획을 고칠 수 있어요. 주배당은 원금 대비 한 주 배당률이에요.</p>`;
  const btns=`<div class="btnrow" style="margin-bottom:14px"><button class="primary" id="pAdd">월 추가</button><button id="pLoad">PDF 계획 다시 불러오기</button></div>`;
  const clear=`<div class="btnrow" style="margin-top:8px"><button class="danger" id="pClear">계획 전체 삭제</button></div>`;
  // 넓은 화면에서는 투자금 카드를 그래프 옆에 두어 한 화면에 더 많이 보이게
  return wide ? head+curCard+yearOverview()+chart+investCard()+table+note+btns+clear
              : head+curCard+yearOverview()+chart+table+note+btns+investCard()+clear;
}

function viewSet(){
  const st=S.settings;
  return `
  <section class="card"><h2>화면</h2>
    <div class="row" style="padding-top:0"><div class="l"><div class="t">금액 숨기기</div><div class="s">모든 화면의 금액과 수량을 ••• 로 가려요. 이 기기에만 적용돼요. 위쪽 눈 모양 버튼으로도 바꿀 수 있어요.</div></div>
      <div class="r"><div class="seg" id="hideSeg" style="width:140px"><button data-h="0" aria-pressed="${!HIDE}">보이기</button><button data-h="1" aria-pressed="${HIDE}">숨기기</button></div></div></div>
  </section>
  <section class="card"><h2>목표</h2>
    <label class="f" for="sgoal">기본 월 목표 (계획이 없는 달, 원)</label><input id="sgoal" type="number" inputmode="numeric" step="1000" value="${st.goalMonthly||""}" placeholder="예: 500000">
    <p class="muted" style="margin:8px 0 0">달마다 다른 목표는 <b>계획</b> 탭에서 정해요.</p>
    <div class="btnrow" style="margin-top:10px"><button id="goPlan">월별 목표·계획 보기</button></div>
  </section>
  <section class="card"><h2>수익률·알림</h2>
    <div class="grid2"><div><label class="f" for="srp">배당 재투자 비율 (%)</label><input id="srp" type="number" inputmode="decimal" step="1" min="0" max="100" value="${st.reinvestPct}"></div>
    <div><label class="f" for="sda">배당 변동 알림 기준 (%)</label><input id="sda" type="number" inputmode="decimal" step="1" min="1" value="${st.divAlertPct}"></div></div>
    <p class="muted" style="margin:8px 0 0">받은 배당을 얼마나 다시 투자하는지 넣으면, 보유 탭의 총수익률이 ‘내가 넣은 돈’ 기준으로 계산돼요. 알림 기준은 최근 지급이 이전 평균보다 이만큼 이상 달라질 때 요약 탭에 표시해요.</p>
  </section>
  <section class="card"><h2>환율 <small>${st.fxDate?`${fmtD(parseD(st.fxDate))} 자동 갱신`:""}</small></h2>
    <div class="row" style="padding-top:0"><div class="l"><div class="t num">${st.fx.toLocaleString()}원 / $1</div><div class="s">배당 기록은 입금일 환율이 자동으로 적용돼요</div></div><div class="r"><button class="small" id="fxRef">새로고침</button></div></div>
    <label class="chk" style="font-weight:500;margin-top:6px"><input type="checkbox" id="sauto" ${st.autoFx?"checked":""}> 환율 자동 연동 (끄면 직접 입력)</label>
    <div id="manualFx" ${st.autoFx?"hidden":""}><label class="f" for="sfx">직접 입력 환율</label><input id="sfx" type="number" inputmode="decimal" step="0.01" value="${st.fx}"></div>
    <div class="grid2">
      <div><label class="f" for="stu">미국 배당세 (%)</label><input id="stu" type="number" inputmode="decimal" step="0.1" value="${st.taxUS}"></div>
      <div><label class="f" for="stk">국내 배당세 (%)</label><input id="stk" type="number" inputmode="decimal" step="0.1" value="${st.taxKR}"></div>
    </div>
    <div class="btnrow" style="margin-top:14px"><button class="primary" id="saveSet">저장</button></div>
  </section>
  <section class="card"><h2>주가 자동 연동 <small>${st.tdKey?"연결됨":"미연결"}</small></h2>
    <label class="f" for="std">Twelve Data API 키 (무료) <span class="muted">· 이 기기에만 저장돼요</span></label><input id="std" value="${esc(st.tdKey)}" placeholder="키를 붙여 넣으세요" autocomplete="off" spellcheck="false">
    <div class="btnrow" style="margin-top:10px"><button id="tdSave" class="primary">키 저장 · 테스트</button></div>
    <details class="help"><summary>무료 키 받는 법</summary><ol>
      <li>twelvedata.com 에서 무료 가입(Basic, 카드 불필요)</li><li>로그인 후 대시보드의 API Keys에서 키 복사</li><li>위 칸에 붙여 넣고 저장</li></ol>
      키는 구글 동기화와 백업 파일에 들어가지 않아서, 다른 기기에서는 따로 넣어야 해요. 공유 기기에서는 쓰고 나서 키를 지워 주세요. 미국 주식·ETF의 현재가와 입금일 종가가 자동으로 들어와요. 무료는 하루 800회, 분당 8회까지라 종목이 많으면 천천히 채워져요. 국내 종목은 보유 탭에서 현재가를 직접 넣어 주세요.</details>
  </section>
  <section class="card"><h2>구글 계정 연동 <small>${st.gLinked?"연결됨":"미연결"}</small></h2>
    <p class="muted" style="margin:0 0 8px">폰·태블릿·컴퓨터에서 같은 구글 계정으로 연결하면 기록이 구글 드라이브의 앱 전용 공간에 저장되고 서로 합쳐져요. 기록을 바꾸면 자동으로 올라가고, 앱이 열려 있는 동안은 1분마다 다른 기기의 변경을 가져와요. 로그인은 1시간 정도 유지되고, 만료되면 위쪽 ☁ 버튼을 눌러 다시 이어 주세요. (새로고침해도 팝업은 뜨지 않아요)</p>
    <label class="f" for="sgc">구글 OAuth 클라이언트 ID</label><input id="sgc" value="${esc(st.gClientId)}" placeholder="xxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false">
    ${st.gLinked?`<p class="muted" style="margin:8px 0 0">${Drive.lastSync?`이 기기 마지막 동기화 ${new Date(Drive.lastSync).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}`:"이 기기에서는 아직 동기화 전이에요"}</p>`:""}
    <div class="btnrow" style="margin-top:10px"><button class="primary" id="gLink">${st.gLinked?"지금 동기화":"구글 계정 연결"}</button><button id="gShare">다른 기기 연결 링크 복사</button>${st.gLinked?`<button class="ghost" id="gUnlink">연결 해제</button>`:""}</div>
    <details class="help"><summary>클라이언트 ID 만드는 법 (처음 한 번)</summary><ol>
      <li>console.cloud.google.com 접속 → 새 프로젝트 만들기</li>
      <li>API 및 서비스 → 라이브러리 → <b>Google Drive API</b> 사용 설정</li>
      <li>OAuth 동의 화면 → 외부(External) → 앱 이름·이메일 입력 → 테스트 사용자에 <b>내 구글 계정</b> 추가</li>
      <li>사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 유형 <b>웹 애플리케이션</b></li>
      <li>승인된 JavaScript 원본에 <b>${esc(location.origin&&location.origin.startsWith("http")?location.origin:"https://내아이디.github.io")}</b> 추가 → 만들기</li>
      <li>나온 클라이언트 ID를 위 칸에 붙여 넣고 ‘구글 계정 연결’</li></ol>
      <br><br><b>다른 기기(태블릿·컴퓨터)</b>: 위 ‘다른 기기 연결 링크 복사’를 카톡 등으로 보내 그 기기에서 열면 클라이언트 ID가 자동으로 들어가요. 그다음 ‘구글 계정 연결’만 누르면 끝이에요. 기기마다 같은 웹 주소를 써야 해요.</details>
  </section>
  <section class="card"><h2>파일로 합치기 · 백업</h2>
    <p class="muted" style="margin:0 0 10px">구글 연동 없이도 파일로 다른 기기와 합치거나 백업할 수 있어요.</p>
    <div class="btnrow"><button id="syOut">파일 저장</button><button id="syIn">파일 합치기</button></div>
    <div class="btnrow" style="margin-top:8px"><button id="csv" class="ghost">CSV 내보내기</button></div>
    <input type="file" id="syFile" accept=".json,application/json,text/plain" hidden>
  </section>
  <section class="card"><h2>앱 버전 ${justUpdated?`<small class="up">방금 업데이트됐어요</small>`:""}</h2>
    <div class="row" style="padding-top:0"><div class="l"><div class="t num">v${APP_VERSION}</div><div class="s">${APP_DATE} · ${APP_NOTES}</div></div></div>
    ${justUpdated?`<p class="muted" style="margin:8px 0 0">v${esc(prevVer)} → v${APP_VERSION} 로 올라갔어요.</p>`:""}
  </section>
  <section class="card"><h2>초기화</h2><div class="btnrow"><button class="danger" id="wipe">이 기기의 모든 기록 삭제</button></div></section>`;
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
