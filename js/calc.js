"use strict";
// ---------- aggregates ----------
function sorted(){ return [...S.entries].sort((a,b)=> b.date.localeCompare(a.date) || (b.created||0)-(a.created||0)); }
function byWeek(){ const m=new Map(); for(const e of S.entries){ const k=weekKey(e.date); m.set(k,(m.get(k)||0)+calc(e).netKRW); } return m; }
function byMonth(y){ const a=new Array(12).fill(0); for(const e of S.entries){ const d=parseD(e.date); if(d.getFullYear()===y) a[d.getMonth()]+=calc(e).netKRW; } return a; }
function lastPerShare(t){ const e=sorted().find(x=>x.ticker===t); return e?e.perShare:""; }
function recentAvgWeek(){ const wk=byWeek(), m0=monday(new Date()); let s=0; for(let i=0;i<4;i++){ const m=new Date(m0); m.setDate(m.getDate()-7*i); s+=wk.get(isoOf(m))||0; } return s/4; }
function divByTicker(){ const o={}; for(const e of S.entries){ o[e.ticker]=(o[e.ticker]||0)+calc(e).netKRW; } return o; }

// ---------- charts (SVG) ----------
const kfmt = n => { if(HIDE) return "••"; const a=Math.abs(n); return a>=1e8?(n/1e8).toFixed(1)+"억": a>=1e4?Math.round(n/1e4)+"만": Math.round(n).toLocaleString(); };
function barChart({labels, values, target=0, H=190, labelEvery=1, fmt=kfmt}){
  const W=400, pl=38, pr=6, pt=10, pb=22, n=values.length;
  const tg = Array.isArray(target) ? target : values.map(()=>target);
  const constant = !Array.isArray(target);
  const max=Math.max(1, ...tg.map(t=>t*1.1), ...values)*1.05, bw=(W-pl-pr)/n, y=v=>pt+(H-pt-pb)*(1-v/max);
  let g=""; for(let i=0;i<=3;i++){ const v=max*i/3; g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)" stroke-width="1"/><text x="${pl-6}" y="${y(v)+4}" font-size="11.5" text-anchor="end" fill="var(--muted)">${fmt(v)}</text>`; }
  const bars=values.map((v,i)=>{ const x=pl+i*bw+bw*.18, w=bw*.64, h=(H-pt-pb)-(y(v)-pt);
    const t=tg[i]||0, miss = t>0 && v<t;
    let s=`<rect x="${x}" y="${y(v)}" width="${w}" height="${Math.max(0,h)}" rx="3" fill="var(--red)" opacity="${miss?.5:.9}"><title>${esc(labels[i])}: ${won(v)}${t?` / 목표 ${won(t)}`:""}</title></rect>`;
    if(!constant && t>0) s+=`<line x1="${x-bw*.1}" x2="${x+w+bw*.1}" y1="${y(t)}" y2="${y(t)}" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round"/>`;
    if((i%labelEvery===0&&(n-1-i>=labelEvery/2))||i===n-1) s+=`<text x="${x+w/2}" y="${H-7}" font-size="11.5" text-anchor="middle" fill="var(--muted)">${esc(labels[i])}</text>`;
    return s; }).join("");
  const tl = constant && target>0 ? `<line x1="${pl}" x2="${W-pr}" y1="${y(target)}" y2="${y(target)}" stroke="var(--blue)" stroke-width="2.5" stroke-dasharray="7 5"/>` : "";
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}${bars}${tl}</svg></div>`;
}
function lineChart({labels, series, H=210, labelEvery=1, fmt=kfmt, fromZero=true}){
  const W=400, pr=8, pt=10, pb=22, n=labels.length;
  const all=series.flatMap(s=>s.values).filter(v=>v!=null);
  let hi=Math.max(...all,0), lo=fromZero?0:Math.min(...all);
  if(!fromZero){ const pad=(hi-lo)*.25||hi*.1||1; lo=Math.max(0,lo-pad); hi=hi+pad; } else hi=Math.max(1,hi)*1.08;
  const tickW=Math.max(...[0,1,2,3].map(i=>String(fmt(lo+(hi-lo)*i/3)).length)); const pl=Math.max(36,tickW*7+10);
  const x=i=>pl+(W-pl-pr)*(n<=1?.5:i/(n-1)), y=v=>pt+(H-pt-pb)*(1-(v-lo)/(hi-lo||1));
  let g=""; for(let i=0;i<=3;i++){ const v=lo+(hi-lo)*i/3; g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/><text x="${pl-6}" y="${y(v)+4}" font-size="11.5" text-anchor="end" fill="var(--muted)">${fmt(v)}</text>`; }
  const lab=labels.map((l,i)=>((i%labelEvery===0&&(n-1-i>=labelEvery/2))||i===n-1)?`<text x="${x(i)}" y="${H-7}" font-size="11.5" text-anchor="${n>1&&i===n-1?"end":n>1&&i===0?"start":"middle"}" fill="var(--muted)">${esc(l)}</text>`:"").join("");
  const lines=series.map(s=>{ const pts=s.values.map((v,i)=>v==null?null:`${x(i)},${y(v)}`).filter(Boolean).join(" ");
    const dots = s.dots ? s.values.map((v,i)=>v==null?"":`<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${s.color}"><title>${esc(labels[i])}: ${fmt(v)}</title></circle>`).join("") : "";
    const lastI=s.values.map((v,i)=>v==null?-1:i).filter(i=>i>=0).pop();
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dash?'stroke-dasharray="6 4"':""} stroke-linejoin="round" stroke-linecap="round"/>`+dots
      + (!s.dots&&lastI!=null&&lastI>=0?`<circle cx="${x(lastI)}" cy="${y(s.values[lastI])}" r="4" fill="${s.color}"/>`:""); }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}${lab}${lines}</svg></div>`;
}
function scrollBars({labels, values, target=0, H=190}){
  const n=values.length, bw=Math.max(40,Math.ceil(300/Math.max(1,Math.min(n,7)))), W=Math.max(bw*n,300), pt=22, pb=22;
  const tg=Array.isArray(target)?target:values.map(()=>target), max=Math.max(1,...tg.map(t=>t*1.1),...values)*1.05, y=v=>pt+(H-pt-pb)*(1-v/max);
  const bars=values.map((v,i)=>{ const x=i*bw+bw*.2, w=bw*.6, h=Math.max(0,H-pb-y(v)), t=tg[i]||0, miss=t>0&&v<t;
    return `<rect x="${x}" y="${y(v)}" width="${w}" height="${h}" rx="4" fill="var(--red)" opacity="${v>0?(miss?.5:.9):.15}"><title>${esc(labels[i])}: ${won(v)}</title></rect>`
      +(v>0?`<text x="${x+w/2}" y="${y(v)-5}" font-size="11" text-anchor="middle" fill="var(--ink)">${kfmt(v)}</text>`:"")
      +(t>0?`<line x1="${x-bw*.08}" x2="${x+w+bw*.08}" y1="${y(t)}" y2="${y(t)}" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round"/>`:"")
      +`<text x="${x+w/2}" y="${H-6}" font-size="11" text-anchor="middle" fill="var(--muted)">${esc(labels[i])}</text>`; }).join("");
  return `<div class="hscroll" id="hs"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${bars}</svg></div>`+(tg.some(t=>t>0)?`<div class="legend"><span><i style="background:var(--blue)"></i>주간 목표</span></div>`:"");
}
const PALETTE=["var(--red)","var(--blue)","#E0A21B","#3E9C6B","#8B5CC7","#E26A2C","#2BA3B5","#9A6B4F"];
function donut(items){
  const tot=items.reduce((a,b)=>a+b[1],0); if(!tot) return `<div class="empty">아직 데이터가 없어요</div>`;
  let a=-Math.PI/2, paths=""; const R=70, r=44, cx=90, cy=90;
  items.forEach(([t,v],i)=>{ const f=v/tot; if(f>=.9999){ paths+=`<circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="${PALETTE[i%8]}" stroke-width="${R-r}"/>`; return; }
    const a2=a+f*2*Math.PI, lg=f>.5?1:0, p=(rr,ang)=>`${cx+rr*Math.cos(ang)},${cy+rr*Math.sin(ang)}`;
    paths+=`<path d="M${p(R,a)} A${R},${R} 0 ${lg} 1 ${p(R,a2)} L${p(r,a2)} A${r},${r} 0 ${lg} 0 ${p(r,a)} Z" fill="${PALETTE[i%8]}"><title>${esc(t)} ${won(v)}</title></path>`; a=a2; });
  const leg=items.map(([t,v],i)=>`<div class="row"><div class="l"><span class="t"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${PALETTE[i%8]};margin-right:6px"></i>${esc(t)}</span></div><div class="r num">${won(v)} <span class="muted">${Math.round(v/tot*100)}%</span></div></div>`).join("");
  return `<div style="display:flex;justify-content:center"><svg viewBox="0 0 180 180" width="180" height="180" role="img">${paths}<text x="90" y="86" text-anchor="middle" font-size="11" fill="var(--muted)">합계</text><text x="90" y="104" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)">${kfmt(tot)}</text></svg></div>${leg}`;
}

// ---------- goals / plan helpers ----------
// 모든 금액은 세후 기준으로 고정
const basis=()=>"net";
const basisName=()=>"세후";
const amtOf=(e,b)=>{ const c=calc(e); return b==="gross"?c.grossKRW:c.netKRW; };
const ymOf=(y,m)=>y+"-"+String(m+1).padStart(2,"0");
const ymLabel=ym=>{ const [y,m]=ym.split("-"); return `${y.slice(2)}.${+m}`; };
const man=n=>HIDE?MASK:(Math.round(n/1000)/10).toLocaleString("ko-KR",{maximumFractionDigits:1});
function planOf(ym){ return S.plan.find(p=>p.ym===ym); }
function goalFor(y,m){ const p=planOf(ymOf(y,m)); if(p&&p.expected>0) return p.expected*10000; return +S.settings.goalMonthly||0; }
function actualYm(ym,b){ let s=0; for(const e of S.entries) if(e.date.startsWith(ym)) s+=amtOf(e,b); return s; }
function weekLabel(k, withYear){ const th=parseD(addDays(k,3)), n=Math.ceil(th.getDate()/7);
  return `${withYear&&th.getFullYear()!==new Date().getFullYear()?th.getFullYear()+"년 ":""}${th.getMonth()+1}월 ${n}주차`; }
function weekGoal(k){ const th=parseD(addDays(k,3)); return goalFor(th.getFullYear(),th.getMonth())*12/52; }
const fmtPs=n=>String(+(+n).toFixed(4));
// 평단: USD 종목은 달러 평단(avgCost)·원화 평단(avgCostKRW)·매수 환율(buyFx) 중 두 개가 있으면 나머지를 계산
const RP=()=>Math.min(1,Math.max(0,(S.settings.reinvestPct===undefined?100:+S.settings.reinvestPct||0)/100));
function holdCalc(h){
  const fx=S.settings.fx, s=h.shares, p=curPrice(h);
  if(h.currency==="KRW"){ const a=+h.avgCost||0, cost=a*s, val=p?p*s:null; return {p,cost,val,aU:null,aK:a,buyFx:null,pricePL:val!=null&&a?val-cost:null,fxPL:null}; }
  let aU=+h.avgCost||0, aK=+h.avgCostKRW||0; const bf=+h.buyFx||0;
  if(!aU && aK && bf) aU=aK/bf;
  if(!aK && aU && bf) aK=aU*bf;
  const cost = aK ? aK*s : aU*s*fx, val = p ? p*s*fx : null, split = !!(aU&&aK), buyFx = split ? aK/aU : null;
  return {p,cost,val,aU,aK,buyFx, pricePL: val!=null&&aU ? (p-aU)*s*fx : null, fxPL: split ? aU*s*(fx-buyFx) : null};
}
function portfolio(){
  const dv=divByTicker(); let tCost=0,tVal=0,tDiv=0,tDivP=0,tFx=0,fxN=0,noFx=0,missing=0,uCost=0,uVal=0,kCost=0,kVal=0; const rows=[];
  for(const h of S.holdings){ const c=holdCalc(h), d=dv[h.ticker]||0;
    if(c.val==null) missing++; else { tVal+=c.val; tCost+=c.cost; tDivP+=d; if(c.fxPL!=null){ tFx+=c.fxPL; fxN++; uCost+=c.aU*h.shares; uVal+=c.p*h.shares; kCost+=c.cost; kVal+=c.val; } else if(h.currency!=="KRW"&&c.cost) noFx++; }
    tDiv+=d; rows.push(Object.assign({h,d},c)); }
  return {tCost,tVal,tDiv,tDivP,tFx,fxN,noFx,missing,rows,uCost,uVal,kCost,kVal};
}
const oddKrw=()=>S.holdings.filter(h=>h.currency==="KRW"&&!h.krwOk&&/^[A-Z][A-Z0-9.\-]{0,6}$/.test(h.ticker));
function investMap(){ const m={}; for(const v of S.invest) if(+v.amount>0) m[v.ym]=(m[v.ym]||0)+(+v.amount); return m; }
function monthRows(y){ const a=Array.from({length:12},()=>({net:0,gross:0,n:0}));
  for(const e of S.entries){ if(!e.date.startsWith(y+"-")) continue; const m=+e.date.slice(5,7)-1, c=calc(e); a[m].net+=c.netKRW; a[m].gross+=c.grossKRW; a[m].n++; }
  return a; }

// ---------- 원금 대비 주배당률 ----------
// 원금 = 보유 종목의 평단 × 수량. 매수 기록(날짜별)이 있으면 그 날짜까지 산 만큼만 원금으로 쳐요.
// (첫 매수일 이전의 배당은 첫 매수 기준으로 계산해요. 평단이 하나도 없을 때만 계획 탭의 월 원금을 써요.)
const lotBase=l=>l.total!=null?+l.total:l.shares*l.price; // 그 매수의 총 매수금액 (예전 기록은 수량×가격)
function lotCostKRW(h,l){ return lotBase(l)*(+h.lotScale>0?+h.lotScale:1)*(h.currency!=="KRW"?(+h.fxAvg>0?+h.fxAvg:(+l.fx||+h.buyFx||S.settings.fx)):1); }
function holdCostOn(h,date){
  const ls=h.lots; if(!ls||!ls.length) return holdCalc(h).cost;
  const on=ls.filter(l=>l.date<=date), use=on.length?on:[[...ls].sort((a,c)=>a.date.localeCompare(c.date))[0]];
  return use.reduce((a,l)=>a+lotCostKRW(h,l),0);
}
function principalOn(date){
  let t=0; for(const h of S.holdings){ const c=holdCostOn(h,date); if(c>0) t+=c; }
  if(t>0) return t;
  const p=planOf(date.slice(0,7)); return p&&p.principal>0 ? p.principal*10000 : 0;
}
function fallbackPrincipal(){ return principalOn("9999-12-31"); }
function planRate(p){ return p&&p.principal>0&&p.expected>0 ? p.expected/p.principal/4*100 : null; }
function weekAmts(b){ const m=new Map(); for(const e of S.entries){ const k=weekKey(e.date); m.set(k,(m.get(k)||0)+amtOf(e,b)); } return m; }
function weekRates(n){
  const b=basis(), wk=weekAmts(b), fb=fallbackPrincipal(), m0=monday(new Date()), out=[];
  for(let i=n-1;i>=0;i--){ const m=new Date(m0); m.setDate(m.getDate()-7*i);
    const k=isoOf(m), ym=addDays(k,3).slice(0,7), pp=principalOn(addDays(k,6)), pr=pp||fb, amt=wk.get(k)||0;
    out.push({k,ym,amt,pr,plan:!!pp,rate:pr>0?amt/pr*100:null}); }
  return out;
}
// 최근 4주 평균 (이번 주 배당이 아직 없으면 지난 4주)
function recentRate(){
  const r=weekRates(5), use=r[4].amt>0 ? r.slice(1) : r.slice(0,4);
  const amt=use.reduce((a,x)=>a+x.amt,0), pr=use.reduce((a,x)=>a+x.pr,0);
  return {rate:pr>0?amt/pr*100:null, pr:use[use.length-1].pr};
}
// 월별: 배당을 기록한 주만 모아서 (받은 배당 ÷ 원금)
function monthRates(){
  const b=basis(), wk=weekAmts(b), fb=fallbackPrincipal(), by=new Map();
  for(const [k,amt] of wk){ const ym=addDays(k,3).slice(0,7), pp=principalOn(addDays(k,6)), pr=pp||fb;
    const o=by.get(ym)||{ym,amt:0,pr:0,weeks:0,plan:!!pp}; o.amt+=amt; o.pr+=pr; o.weeks++; by.set(ym,o); }
  return [...by.values()].sort((a,c)=>a.ym.localeCompare(c.ym)).map(o=>Object.assign(o,{rate:o.pr>0?o.amt/o.pr*100:null, principal:o.weeks?o.pr/o.weeks:0}));
}
function principalNow(){
  const fb=fallbackPrincipal(); if(fb>0) return {v:fb,plan:false};
  const cur=ymOf(new Date().getFullYear(),new Date().getMonth()), ps=S.plan.filter(p=>p.principal>0&&p.ym<=cur).sort((a,c)=>c.ym.localeCompare(a.ym));
  return {v:ps.length?ps[0].principal*10000:0,plan:true};
}
const avgOf=(t,cur)=>{ const h=S.holdings.find(x=>x.ticker===t); if(!h) return 0; const c=holdCalc(h); return cur==="KRW"?(c.aK||0):(c.aU||0); };
function rateView(){
  const base=+S.settings.baseYield||0, b=basis(), p2=v=>v.toFixed(2)+"%", pn=principalNow();
  if(!S.entries.length||!(pn.v>0)) return `<section class="card"><div class="empty">원금과 배당 기록이 있어야 계산할 수 있어요.<br>보유 탭에 종목 평단과 수량을 입력해 주세요.</div><div class="btnrow"><button id="goHold">보유 탭으로</button></div></section>`;
  const rr=recentRate(), now=new Date(), cy=now.getFullYear();
  let tot=0, ytd=0; const cut=isoOf(new Date(now.getFullYear()-1,now.getMonth(),now.getDate()));
  for(const e of S.entries){ const a=amtOf(e,b); tot+=a; if(e.date.startsWith(cy+"-")) ytd+=a; }
  const seg=`<div class="seg" id="rseg" style="margin:0 0 14px">${[["week","주별"],["month","월별"],["ticker","종목별"]].map(([k,l])=>`<button data-m="${k}" aria-pressed="${rateMode===k}">${l}</button>`).join("")}</div>`;
  const hero=`<section class="card hero2"><div class="k">원금 대비 주배당률 · 최근 4주 평균</div>
    <div class="big num">${rr.rate!=null?p2(rr.rate):"-"}</div>
    <div class="mini"><div><div class="k">연 환산</div><div class="v num">${rr.rate!=null?(rr.rate*52).toFixed(1)+"%":"-"}</div></div>
    <div><div class="k">누적</div><div class="v num">${p2(tot/pn.v*100)}</div></div>
    <div><div class="k">올해</div><div class="v num">${p2(ytd/pn.v*100)}</div></div></div>
    <p class="muted" style="margin:12px 0 0;font-size:12px">${basisName()} · 원금 ${man(pn.v)}만원 (${pn.plan?"계획 탭 기준":"평단 × 수량"})${base?` · 기준 주 ${base}%`:""}</p></section>`;
  let body="";
  if(rateMode==="week"){
    const all=weekRates(52).map(w=>Object.assign(w,{rate:w.amt/(w.pr||pn.v)*100})), fi=all.findIndex(w=>w.amt>0), ws=fi>=0?all.slice(fi):[], sh=ws.slice(-26);
    const series=[{values:sh.map(w=>w.rate),color:"var(--red)",dots:true}]; if(base>0) series.push({values:sh.map(()=>base),color:"var(--blue)",dash:true});
    const rows=[...ws].reverse().filter(w=>w.amt>0).slice(0,26).map(w=>`<div class="lrow"><div><div class="t">${fmtD(parseD(w.k))} 주</div><div class="s">원금 ${man(w.pr||pn.v)}만 · ${won(w.amt)}</div></div><div class="r"><div class="p ${base>0&&w.rate!=null?(w.rate>=base?"up":"down"):""}">${w.rate!=null?p2(w.rate):"-"}</div></div></div>`).join("");
    body=`<section class="card"><h2>주별 배당률 ${base>0?`<small>점선 = 기준 ${base}%</small>`:""}</h2>${lineChart({labels:sh.map(w=>fmtD(parseD(w.k))),series,fmt:p2,labelEvery:Math.max(1,Math.ceil(sh.length/6))})}</section>
      <section class="card" style="padding:4px 16px">${rows||`<div class="empty">아직 기록이 없어요</div>`}</section>`;
  } else if(rateMode==="month"){
    const first=S.entries.map(e=>e.date).sort()[0].slice(0,7), last=ymOf(cy,now.getMonth()), wr=new Map(monthRates().map(m=>[m.ym,m])), ms=[];
    let yy=+first.slice(0,4), mm=+first.slice(5,7)-1;
    while(ymOf(yy,mm)<=last){ const ym=ymOf(yy,mm), y=yy; if(++mm>11){ mm=0; yy++; } const amt=actualYm(ym,b), pr=principalOn(ym+"-31")||pn.v; ms.push({ym,y,amt,pr,rate:amt/pr*100,wk:wr.get(ym)}); }
    const yrs=[...new Set(ms.map(m=>m.y))].reverse().map(y=>{ const r=ms.filter(m=>m.y===y), amt=r.reduce((a,m)=>a+m.amt,0), pr=r[r.length-1].pr;
      return `<div class="lrow"><div><div class="t">${y}년</div><div class="s">${won(amt)} · ${r.length}개월</div></div><div class="r"><div class="p">${p2(amt/pr*100)}</div></div></div>`; }).join("");
    const rows=[...ms].reverse().map(m=>`<div class="lrow"><div><div class="t">${ymLabel(m.ym)}</div><div class="s">원금 ${man(m.pr)}만 · ${won(m.amt)}${m.wk&&m.wk.rate!=null?` · 주평균 ${p2(m.wk.rate)}`:""}</div></div><div class="r"><div class="p">${p2(m.rate)}</div></div></div>`).join("");
    body=`<section class="card" style="padding:4px 16px"><h2 style="padding-top:12px">연도별 배당률</h2>${yrs}</section><section class="card" style="padding:4px 16px"><h2 style="padding-top:12px">월별 배당률 <small>월 배당 ÷ 원금</small></h2>${rows}</section>`;
  } else {
    const tot2={}, byT={}; for(const e of S.entries){ (byT[e.ticker]=byT[e.ticker]||[]).push(e); tot2[e.ticker]=(tot2[e.ticker]||0)+amtOf(e,b); }
    const pctOf=e=>{ const a=avgOf(e.ticker,e.currency); return a>0?e.perShare*(b==="gross"?1:1-(+e.taxRate||0)/100)/a*100:null; };
    const items=Object.keys(byT).sort((x,y)=>tot2[y]-tot2[x]).map(t=>{ const es=byT[t].sort((x,y)=>y.date.localeCompare(x.date)), h=S.holdings.find(x=>x.ticker===t), c=h?holdCalc(h):null, kr=es[0].currency==="KRW";
      const pc=es.map(pctOf), sum=pc.reduce((a,v)=>a+(v||0),0), has=pc.some(v=>v!=null), avgTxt=c&&(kr?c.aK:c.aU)>0?(kr?won(c.aK):usd(c.aU)):"평단 미입력";
      const rows=es.slice(0,26).map((e,i)=>`<div class="lrow"><div><div class="t">${fmtD(parseD(e.date))}</div><div class="s">${kr?won(e.perShare):"$"+fmtPs(e.perShare)}</div></div><div class="r"><div class="p" style="font-size:15px">${pc[i]!=null?p2(pc[i]):"-"}</div></div></div>`).join("");
      return `<details class="tkd"><summary><div><div class="t">${esc(t)}</div><div class="s">매입가 ${avgTxt} · 받은 배당 ${won(tot2[t])}</div></div><div class="r"><div class="p">${has?p2(sum):"-"}</div><div class="s">누적</div></div></summary><div class="tkb">${rows}</div></details>`; }).join("");
    body=`<section class="card" style="padding:4px 16px"><h2 style="padding-top:12px">종목별 배당률 <small>주당 배당 ÷ 산 가격(평단)</small></h2>${items}</section>`;
  }
  return hero+seg+body+`<p class="muted" style="font-size:12px;margin:0 2px 12px">원금은 보유 탭에 넣은 평단 × 수량의 합이에요(평단이 없으면 계획 탭의 월 원금). 종목별은 산 가격 대비라 달러 종목은 달러 평단 기준이에요. 세전/세후는 계획 탭에서 바꿔요.</p>`;
}
