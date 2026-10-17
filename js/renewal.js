"use strict";
// ===== v5 리뉴얼: 포트폴리오 · 배당 · 분석(자산·비중) =====
// 참고: divflow(상단 TOTAL ASSET, 4개 분석 탭, 빈 화면 미리보기, 자산 구성, 보유 종목 표),
//       디어나 주식로그(계좌별 관리, 종목 비중 트리맵, 유형 도넛, 계좌별 원금 vs 평가)

// ---------- 종목 분류 ----------
const TYPES = ["국내주식","국내ETF","해외주식","해외ETF","채권·현금","기타"], REGIONS = ["미국","국내","글로벌","기타"], ACC0 = ["일반","ISA","연금저축","IRP"];
const ETF_KR = /^(KODEX|TIGER|ACE|SOL|KBSTAR|ARIRANG|HANARO|KOSEF|RISE|PLUS|TIMEFOLIO|WOORI|KIWOOM)/i;
const ETF_US = new Set("SPY QQQ VOO VTI SCHD JEPI JEPQ SPYI QQQI XDTE QDTE RDTE DIVO QYLD XYLD RYLD SPYD VYM VIG DGRO HDV TLT IVV VNQ NUSI GPIX GPIQ IWM DIA TQQQ SOXL QLD SSO BND AGG HYG SVOL YMAX YMAG TSLY NVDY CONY MSTY FEPI AIPI BALI DJIA SDIV DIVS JEPY QDVO USOY".split(" "));
function typeOf(h){ if(h.assetType) return h.assetType; const t=String(h.ticker||"");
  if(h.currency==="KRW") return ETF_KR.test(t)||/ETF/i.test(t)?"국내ETF":"국내주식";
  return ETF_US.has(t.toUpperCase())||/ETF/i.test(t)?"해외ETF":"해외주식"; }
const regionOf = h => h.region || (h.currency==="KRW"?"국내":"미국");
const accountOf = h => h.account || "일반";
const accountsAll = () => [...new Set([...ACC0,...liveHoldings().map(accountOf)])];

// 종목 하나의 예상 연 배당(세후, 원): 최근 지급 평균 × 주기 횟수
function perPayOf(h){
  const es=S.entries.filter(e=>e.ticker===h.ticker).sort((a,c)=>c.date.localeCompare(a.date)); if(!es.length) return null;
  const k=Math.min(4,es.length), ps=es.slice(0,k).reduce((a,e)=>a+e.perShare,0)/k;
  return {net:calc({ticker:h.ticker,perShare:ps,shares:h.shares,taxRate:taxFor(h.currency),fx:h.currency==="KRW"?1:S.settings.fx,currency:h.currency,price:0}).netKRW, lastM:parseD(es[0].date).getMonth()};
}
function annualDivOf(h){ const f=isDivStock(h)?freqN(h.ticker):0; if(!f) return 0; const p=perPayOf(h); return p?p.net*f:0; }
// 올해(또는 지정 연도) 월별 예상 배당(세후, 원)
function forecastMonths(year){
  const out=new Array(12).fill(0);
  for(const h of S.holdings){ if(!isDivStock(h)) continue; const p=perPayOf(h); if(!p) continue; const f=h.freq||"주배당";
    for(let m=0;m<12;m++){ const dim=new Date(year,m+1,0).getDate();
      if(f==="주배당") out[m]+=p.net*dim/7; else if(f==="월배당") out[m]+=p.net;
      else if(f==="분기배당"){ if(((m-p.lastM)%3+3)%3===0) out[m]+=p.net; }
      else if(f==="반기배당"){ if(((m-p.lastM)%6+6)%6===0) out[m]+=p.net; }
      else if(f==="연배당"){ if(m===p.lastM) out[m]+=p.net; } } }
  return out;
}

// ---------- 포트폴리오 데이터 ----------
function portRows(){
  const P=portfolio(), tot=P.rows.reduce((a,r)=>a+(r.val!=null?r.val:r.cost),0)||1;
  return P.rows.map(r=>{ const h=r.h, v=r.val!=null?r.val:r.cost, pl=r.val!=null&&r.cost?r.val-r.cost:null, plp=pl!=null?pl/r.cost*100:null, da=annualDivOf(h), d=r.d, totp=pl!=null&&r.cost>0?(pl+d)/r.cost*100:null;
    return {h,r,v,pl,plp,da,d,totp,type:typeOf(h),region:regionOf(h),account:accountOf(h),freq:h.freq||"주배당",weight:v/tot*100,yld:v>0&&da>0?da/v*100:null,est:r.val==null}; });
}

// ---------- 상단 TOTAL ASSET 카드 ----------
// full: 홈에서만 자산 그래프까지 보여줘요. 다른 탭에서는 한 줄로 줄여서 공간을 아껴요.
let topRange = "6m";
const ICO_PLUS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>', ICO_CAL='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
function miniAsset(){
  const R=[["1m","1달"],["6m","6달"],["1y","1년"],["all","전체"]];
  const chips=`<div class="rchips" id="toprange">${R.map(([k,l])=>`<button data-r="${k}" aria-pressed="${topRange===k}">${l}</button>`).join("")}</div>`;
  const pts=assetData(topRange).pts.map(p=>({ms:p.ms,t:p.val,c:p.cost})).filter(p=>p.t>0||p.c>0);
  if(pts.length<2||pts[pts.length-1].ms===pts[0].ms) return `<div class="spark none">매수 기록과 주가가 쌓이면 자산 그래프가 나와요</div>${chips}`;
  const W=360,H=112,pt=8,pb=6, t0=pts[0].ms, t1=pts[pts.length-1].ms, vs=pts.flatMap(p=>[p.t,p.c]).filter(v=>v>0), hi0=Math.max(...vs), lo0=Math.min(...vs), pd=(hi0-lo0)*.12||hi0*.05, hi=hi0+pd, lo=Math.max(0,lo0-pd);
  const X=ms=>2+(W-4)*(ms-t0)/(t1-t0), Y=v=>pt+(H-pt-pb)*(1-(v-lo)/((hi-lo)||1));
  const line=pts.map(p=>`${X(p.ms).toFixed(1)},${Y(p.t).toFixed(1)}`).join(" "), last=pts[pts.length-1], up=last.t>=last.c, col=up?"var(--red)":"var(--blue)";
  let cp="",pv=null; for(const p of pts){ if(!(p.c>0)) continue; cp+=pv==null?`M${X(p.ms).toFixed(1)},${Y(p.c).toFixed(1)}`:`H${X(p.ms).toFixed(1)}V${Y(p.c).toFixed(1)}`; pv=p; }
  return `<div class="spark" data-goasset role="button" aria-label="자산 추이 그래프, 누르면 자세히"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"><defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${X(t0).toFixed(1)},${H-pb} ${line} ${X(t1).toFixed(1)},${H-pb}" fill="url(#spg)"/>
    ${cp?`<path d="${cp}" fill="none" stroke="var(--muted)" stroke-width="1.4" stroke-dasharray="3 3" opacity=".7" vector-effect="non-scaling-stroke"/>`:""}
    <polyline points="${line}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
    <span class="sdot" style="background:${col}"></span></div>
    <div class="slg"><span><i style="background:${col}"></i>평가금액</span><span><i class="dash"></i>투자원금</span></div>${chips}`;
}
// 돈 계산은 증권사 앱(토스·미래에셋 등)과 같은 기준으로 통일해요
//   투자원금 = 산 금액 · 평가손익 = 평가금액 − 투자원금 · 총 수익 = 평가손익 + 받은 배당 · 총 수익률 = 총 수익 ÷ 투자원금
function money(){ const P=portfolio(), cost=P.tCost, val=P.tVal, div=P.tDivP, pl=val-cost, tot=pl+div; return {P,cost,val,div,pl,plp:cost>0?pl/cost*100:null,tot,totp:cost>0?tot/cost*100:null}; }
function moneyRow(m){
  if(!(m.cost>0)) return "";
  return `<div class="mrow"><div><div class="k">투자원금</div><div class="v num">${won(m.cost)}</div></div>
    <div><div class="k">평가손익</div><div class="v num ${cls(m.pl)}">${wonS(m.pl)}</div>${m.plp!=null?`<div class="s num ${cls(m.pl)}">${pct(m.plp,1)}</div>`:""}</div>
    <div><div class="k">받은 배당</div><div class="v num up">${m.div>0?"+":""}${won(m.div)}</div></div></div>`;
}
function calcInfoSheet(){
  openSheet(`<h3>계산 기준</h3><p class="hint">모든 화면이 이 한 가지 기준을 써요.</p>
    ${[["총 평가금액","지금 가격으로 계산한 보유 주식의 가치"],["투자원금","산 금액의 합계"],["평가손익","평가금액 − 투자원금 (주가가 오르내린 몫)"],["받은 배당","세금을 뺀 배당 합계"],["총 수익","평가손익 + 받은 배당"],["총 수익률","총 수익 ÷ 투자원금"]].map(([t,d])=>`<div class="lrow"><div><div class="t">${t}</div><div class="s">${d}</div></div></div>`).join("")}
    <p class="hint" style="margin-top:10px">달러 종목은 오늘 환율(${S.settings.fx.toLocaleString()}원)로 평가해요. 가격이 없는 종목은 합계에서 빠져요.</p>
    <div class="btnrow" style="margin-top:8px"><button class="primary" id="cix">확인</button></div>`,()=>{ $("#cix").onclick=closeSheet; });
}
function topCard(full){
  const m=money(), has=m.cost>0;
  const td=has?`<span>총 수익</span> <b class="${cls(m.tot)}">${wonS(m.tot)}${m.totp!=null?` (${pct(m.totp,1)})`:""}</b>`:`<span>종목을 추가하면 자산이 계산돼요</span>`;
  const btns=`<div class="tic">${has||!full?`<button class="ci" id="addHold" aria-label="종목 추가">${ICO_PLUS}</button>`:""}<button class="ci" id="goCal" aria-label="배당 달력">${ICO_CAL}</button></div>`;
  const lab=`<div class="tl">총 평가금액 <button class="info" id="calcInfo" aria-label="계산 기준">ⓘ</button></div>`;
  if(!full) return `<section class="card topcard cp"><div class="tm">${lab}<div class="tv num">${won(m.val)}</div><div class="td num">${td}</div></div>${btns}</section>`;
  return `<section class="card topcard"><div class="thead"><div class="tm">${lab}<div class="tv num">${won(m.val)}</div><div class="td num">${td}</div></div>${btns}</div>
    ${has?miniAsset()+moneyRow(m):`<div class="tbtns"><button class="primary bigbtn" id="addHold">+ 종목 추가</button></div>`}</section>`;
}

// ---------- 빈 화면: 설명 + 샘플 미리보기 (divflow 참고) ----------
function emptyCard(kicker,title,desc,btn,preview){
  return `<section class="card emptyhero"><div class="ek">${kicker}</div><div class="et">${title}</div><p class="ed">${desc}</p>${btn||""}<div class="ep"><div class="epl">예시</div>${preview||""}</div></section>`;
}
const SAMPLE_BARS = `<div class="sbars">${[5,62,4,18,75,4,12,58,4,15,68,4].map((v,i)=>`<div><i style="height:${Math.max(6,v)}%" class="${[1,4,7,10].includes(i)?"hi":""}"></i><span>${i+1}</span></div>`).join("")}</div>`;
const SAMPLE_DONUT = `<svg viewBox="0 0 120 120" width="120" height="120" style="display:block;margin:0 auto"><circle cx="60" cy="60" r="40" fill="none" stroke="#E1E6F7" stroke-width="22"/><circle cx="60" cy="60" r="40" fill="none" stroke="#4E69CF" stroke-width="22" stroke-dasharray="90 250" transform="rotate(-90 60 60)"/><circle cx="60" cy="60" r="40" fill="none" stroke="#8FA2E4" stroke-width="22" stroke-dasharray="60 250" stroke-dashoffset="-90" transform="rotate(-90 60 60)"/></svg>`;
const SAMPLE_ROWS = `<div class="srows">${["K","U","E"].map(c=>`<div><b>${c}</b><span></span><i></i></div>`).join("")}</div>`;

// ---------- 주간 배당 흐름 (주마다 등락 표시) ----------
// 주마다 받은 금액만 (옆으로 밀면 이전 주가 보여요)
function weekFlow(){
  const wk=byWeek(), keys=[...wk.keys()].sort(); if(!keys.length) return `<div class="spark none" style="margin-top:12px">배당을 기록하면 주마다 받은 금액이 그래프로 나와요</div>`;
  const cur=isoOf(monday(new Date())), ks=[], vals=[], tg=[];
  for(let k=keys[0]; k<=cur; k=addDays(k,7)){ ks.push(k); vals.push(wk.get(k)||0); tg.push(weekGoal(k)); }
  const labels=ks.map(k=>k===cur?"이번 주":fmtD(parseD(k)));
  return `<div class="wfh"><div><span class="k">이번 주</span> <b class="wfv num">${won(vals[vals.length-1])}</b></div><span class="k">옆으로 밀면 이전 주</span></div>`+scrollBars({labels,values:vals,target:tg.some(t=>t>0)?tg:0,H:170,keys:ks});
}

// ---------- 포트폴리오 ----------
let holdComp = "region", holdSort = "weight", holdFilter = "all", holdQ = "", holdGroup = "none", holdCompact = false; const holdShut = new Set();
function bars(entries,total){
  return entries.map(([k,v])=>`<div class="cb"><span>${esc(k)}</span><div class="cbt"><i style="width:${Math.min(100,v/total*100).toFixed(1)}%"></i></div><b class="num">${(v/total*100).toFixed(1)}%</b></div>`).join("");
}
function tally(rows,fn){ const m={}; for(const r of rows){ const k=fn(r); m[k]=(m[k]||0)+r.v; } return Object.entries(m).sort((a,b)=>b[1]-a[1]); }
function viewHold(){
  const banner=holdBanner(); if(holdMode==="cash") holdMode="list";
  if(holdMode==="trade") return banner+topCard()+holdSeg("trade")+viewTrades();
  if(!liveHoldings().length) return banner+topCard()+holdSeg("list")+emptyCard("GET STARTED","배당 포트폴리오를<br>시작해보세요","첫 종목을 추가하면 평가손익·배당·재투자 분석이 자동으로 시작돼요.",`<button class="primary bigbtn" id="addHold2">+ 첫 종목 추가</button>`,SAMPLE_ROWS+`<ol class="steps"><li>종목명 또는 종목코드로 추가</li><li>수량·평단·계좌(일반/ISA/연금) 입력</li><li>매주 주당 배당만 기록하면 분석 시작</li></ol>`);
  const rows=portRows(), tot=rows.reduce((a,r)=>a+r.v,0)||1, P=portfolio(), many=rows.length>=6;
  const hqs=holdQ.trim().toLowerCase(), view=rows.filter(r=>!hqs||r.h.ticker.toLowerCase().includes(hqs));
  const key={weight:r=>r.weight,plp:r=>r.plp,yld:r=>r.yld,v:r=>r.v}[holdSort];
  view.sort((a,b)=>(key(b)??-1e18)-(key(a)??-1e18));
  const ctl=many?`<div class="hctl"><input id="hq" type="search" value="${esc(holdQ)}" placeholder="종목 검색" autocomplete="off" aria-label="종목 검색"><select id="hsortsel" aria-label="정렬">${[["weight","비중순"],["plp","수익률순"],["yld","배당률순"],["v","평가금순"]].map(([k,l])=>`<option value="${k}" ${holdSort===k?"selected":""}>${l}</option>`).join("")}</select><select id="hgrp" aria-label="묶어 보기"><option value="none">묶지 않기</option>${[["account","계좌별"],["freq","주기별"],["type","유형별"]].map(([k,l])=>`<option value="${k}" ${holdGroup===k?"selected":""}>${l}</option>`).join("")}</select></div>`:"";
  const avgTxt=r=>{ const h=r.h, c=r.r; return h.currency==="KRW"?(c.aK?won(c.aK):"-"):(c.aU?`${won(c.aK||c.aU*S.settings.fx)}<small>${usd(c.aU)}</small>`:"-"); };
  const priceTxt=r=>{ const h=r.h; return r.r.p?(h.currency==="KRW"?won(r.r.p):`${won(r.r.p*S.settings.fx)}<small>${usd(r.r.p)}</small>`):"-"; };
  const gfn={none:null,account:r=>r.account,freq:r=>r.freq==="배당 없음"?"일반 주식":r.freq,type:r=>r.type}[holdGroup];
  const groups=gfn?[...view.reduce((m,r)=>{ const k=gfn(r); if(!m.has(k)) m.set(k,[]); m.get(k).push(r); return m; },new Map())].sort((x,y)=>y[1].reduce((a,r)=>a+r.v,0)-x[1].reduce((a,r)=>a+r.v,0)):[["",view]];
  const gsum=rs=>{ const v=rs.reduce((a,r)=>a+r.v,0), c=rs.reduce((a,r)=>a+(r.r.val!=null?r.r.cost:0),0), pl=rs.reduce((a,r)=>a+(r.pl||0),0); return {v,w:v/tot*100,pp:c>0?pl/c*100:null}; };
  const ghd=(k,rs)=>{ const g=gsum(rs), shut=holdShut.has(k); return {shut,html:`<div class="ghd" data-gt="${esc(k)}" role="button" aria-expanded="${!shut}"><b>${shut?"▸":"▾"} ${esc(k)}</b><span class="num">${rs.length}종목 · ${won(g.v)} · ${g.w.toFixed(0)}%${g.pp!=null?` · <i class="${cls(g.pp)}" style="font-style:normal">${pct(g.pp,1)}</i>`:""}</span></div>`}; };
  const ftag=r=>`<span class="ftag">${r.freq==="배당 없음"?"일반":r.freq.replace("배당","")}</span>`;
  const rowM=r=>`<div class="hl" data-hold="${r.h.id}"><div class="m"><div class="t">${esc(r.h.ticker)}${ftag(r)}</div><div class="s num">${qty(r.h.shares)}주 · 비중 ${r.weight.toFixed(1)}%${r.yld!=null?` · 배당률 ${r.yld.toFixed(1)}%`:""}</div></div>
    <div class="rt"><div class="t num">${won(r.v)}</div>${r.plp!=null?`<div class="s num ${cls(r.pl)}">${pct(r.plp,1)}</div>`:`<div class="s">${r.est?"매입금액":""}</div>`}</div></div>`;
  const rowT=r=>`<tr data-hold="${r.h.id}"><td class="l"><b>${esc(r.h.ticker)}</b> ${ftag(r)}</td><td><b>${r.weight.toFixed(1)}%</b></td><td>${qty(r.h.shares)}</td><td>${avgTxt(r)}</td><td>${priceTxt(r)}</td><td>${won(r.v)}${r.est?`<div class="s">매입금액</div>`:""}</td><td class="${cls(r.pl||0)}">${r.plp!=null?pct(r.plp,1):"-"}</td><td>${r.yld!=null?r.yld.toFixed(1)+"%":"-"}</td></tr>`;
  let list;
  if(!view.length) list=`<section class="card"><div class="empty">조건에 맞는 종목이 없어요</div></section>`;
  else if(isWide()){
    list=`<section class="card full" style="padding:0"><div class="tbl ptbl"><table><thead><tr><th class="l">종목</th><th>비중</th><th>수량</th><th>평단가</th><th>현재가</th><th>평가금</th><th>수익률</th><th>배당률</th></tr></thead><tbody>${groups.map(([k,rs])=>{ if(!gfn) return rs.map(rowT).join(""); const g=ghd(k,rs); return `<tr class="grow" data-gt="${esc(k)}"><td colspan="8">${g.html}</td></tr>`+(g.shut?"":rs.map(rowT).join("")); }).join("")}</tbody></table></div></section>`;
  } else {
    list=`<section class="card" style="padding:4px 16px">${groups.map(([k,rs])=>{ if(!gfn) return rs.map(rowM).join(""); const g=ghd(k,rs); return g.html+(g.shut?"":rs.map(rowM).join("")); }).join("")}</section>`;
  }
  const note=P.missing?`가격이 없는 종목 ${P.missing}개는 매입금액으로 표시돼요.`:!S.settings.tdKey?"설정에서 주가 키를 넣으면 현재가가 자동으로 들어와요.":"";
  return `${banner}${topCard()}${holdSeg("list")}
    <div class="listhead full"><h2 style="margin:0">보유 종목 <small>${view.length}개</small></h2><button class="small ghost" id="refQ" ${S.settings.tdKey?"":"disabled"}>새로고침</button></div>
    ${ctl}${list}
    ${note?`<p class="muted full" style="font-size:12px;margin:0 4px 14px">${note}</p>`:""}`;
}

// ---------- 배당 탭 ----------
let divMode = "now", trendMode = "week";
function divSeg(active){
  const items=[["div","now","현황"],["div","flow","흐름"],["log","","기록"],["plan","","계획"]], on=(t,m)=>t==="div"?active==="div"&&divMode===m:active===t;
  return `<div class="pills" id="pillseg">${items.map(([t,m,l])=>`<button data-goto="${t}" ${m?`data-dm="${m}"`:""} aria-pressed="${on(t,m)}">${l}</button>`).join("")}</div>`;
}
// 배당 탭 맨 위: 올해 받은 배당 한 줄
function divHead(){
  const now=new Date(), y=now.getFullYear(), ytd=S.entries.reduce((a,e)=>a+(parseD(e.date).getFullYear()===y?calc(e).netKRW:0),0), mo=actualYm(ymOf(y,now.getMonth()),basis()), annual=S.holdings.reduce((a,h)=>a+annualDivOf(h),0);
  return `<section class="card topcard cp"><div class="tm"><div class="tl">${y}년 받은 배당 (세후)</div><div class="tv num">${won(ytd)}</div><div class="td num"><span>이번 달</span> <b>${won(mo)}</b>${annual?` <span>· 연 예상</span> <b>${won(annual)}</b>`:""}</div></div><div class="tic"><button class="ci" id="goCal" aria-label="배당 달력">${ICO_CAL}</button></div></section>`;
}
function monthBars(act,fc,cm){
  const W=400,H=200,pl=40,pr=6,pt=12,pb=24,n=12, vals=act.map((v,i)=>i<=cm?v:fc[i]), mx=Math.max(1,...vals,...fc)*1.1, bw=(W-pl-pr)/n, y=v=>pt+(H-pt-pb)*(1-v/mx);
  let g=""; for(let i=0;i<=3;i++){ const v=mx*i/3; g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/><text x="${pl-6}" y="${y(v)+4}" font-size="11" text-anchor="end" fill="var(--muted)">${kfmt(v)}</text>`; }
  const bs=vals.map((v,i)=>{ const x=pl+i*bw+bw*.2, w=bw*.6, h=Math.max(0,H-pb-y(v)), fut=i>cm;
    return `<rect x="${x}" y="${y(v)}" width="${w}" height="${h}" rx="4" fill="var(--red)" opacity="${fut?.32:.9}"${fut?` stroke="var(--red)" stroke-dasharray="3 2"`:""}><title>${i+1}월 ${fut?"예상 ":""}${won(v)}</title></rect><text x="${x+w/2}" y="${H-7}" font-size="11" text-anchor="middle" fill="${i===cm?"var(--ink)":"var(--muted)"}" font-weight="${i===cm?700:400}">${i+1}</text>`; }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}${bs}</svg></div>`;
}
function monthGrid(){
  const now=new Date(), y=now.getFullYear(), cm=now.getMonth(), b=basis(), act=Array.from({length:12},(_,i)=>actualYm(ymOf(y,i),b)), fc=forecastMonths(y);
  if(!(S.entries.length>0||S.holdings.length>0)) return emptyCard("MONTHLY FLOW","매달 들어오는<br>현금 흐름","배당주를 추가하면 12개월 분포와 세후 수령액이 계산돼요.",`<button class="primary bigbtn" id="addHold2">+ 배당주 추가</button>`,SAMPLE_BARS);
  const cells=Array.from({length:12},(_,i)=>{ const on=act[i]>0, ex=!on&&fc[i]>0&&i>=cm; return `<div class="mc${on?" on":""}${ex?" ex":""}${i===cm?" cur":""}"${on?` data-month="${ymOf(y,i)}" role="button"`:""}><b>${i+1}</b><span>${on?kfmt(act[i]):ex?"~"+kfmt(fc[i]):""}</span></div>`; }).join("");
  return `<section class="card"><h2>${y}년 월별 배당 <small>진한 칸 = 받은 달 · 점선 = 예상</small></h2><div class="mgrid">${cells}</div></section>`;
}
function viewDiv(){
  if(divMode!=="now"&&divMode!=="flow") divMode="now";
  let body;
  if(divMode==="flow") body=`<div class="seg" id="dtseg" style="margin-bottom:14px">${[["week","주별"],["month","월별"],["cum","누적"],["rate","배당률"]].map(([k,l])=>`<button data-m="${k}" aria-pressed="${trendMode===k}">${l}</button>`).join("")}</div>`+(trendMode==="rate"?rateView():viewChart(trendMode,true));
  else body=alertCard()+monthGrid();
  return divHead()+divSeg("div")+body;
}

// ---------- 분석: 비중 (트리맵 · 도넛 · 계좌별 · 집중 경고) ----------
let mixDim = "ticker";
function top5(entries){ const t=entries.slice(0,5), rest=entries.slice(5).reduce((a,x)=>a+x[1],0); return rest>0?[...t,["기타",rest]]:t; }
function treemap(items,W=400,H=230){
  const tot=items.reduce((a,b)=>a+b[1],0)||1, rects=[];
  (function lay(arr,x,y,w,h){ if(!arr.length) return; if(arr.length===1){ rects.push({k:arr[0],x,y,w,h}); return; }
    const s=arr.reduce((a,b)=>a+b[1],0); let acc=0,i=0; while(i<arr.length-1&&acc+arr[i][1]<s/2){ acc+=arr[i][1]; i++; } if(i===0){ i=1; acc=arr[0][1]; }
    const a=arr.slice(0,i), b=arr.slice(i), f=acc/s;
    if(w>=h){ lay(a,x,y,w*f,h); lay(b,x+w*f,y,w*(1-f),h); } else { lay(a,x,y,w,h*f); lay(b,x,y+h*f,w,h*(1-f)); } })(items,0,0,W,H);
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="종목 비중 트리맵">${rects.map((r,i)=>{ const p=r.k[1]/tot*100, big=r.w>54&&r.h>34;
    return `<g><rect x="${r.x+1}" y="${r.y+1}" width="${Math.max(0,r.w-2)}" height="${Math.max(0,r.h-2)}" rx="6" fill="hsl(222,${72-Math.min(30,i*3)}%,${30+Math.min(40,i*4.2)}%)"><title>${esc(r.k[0])} ${p.toFixed(1)}%</title></rect>${big?`<text x="${r.x+9}" y="${r.y+20}" font-size="12.5" font-weight="700" fill="#fff">${esc(String(r.k[0]).slice(0,r.w>90?10:5))}</text><text x="${r.x+9}" y="${r.y+36}" font-size="11.5" fill="rgba(255,255,255,.85)">${p.toFixed(1)}%</text>`:""}</g>`; }).join("")}</svg></div>`;
}
function warnings(rows){
  const out=[], tot=rows.reduce((a,r)=>a+r.v,0)||1, srt=[...rows].sort((a,b)=>b.v-a.v);
  if(srt.length&&srt[0].v/tot>.3) out.push(`<b>${esc(srt[0].h.ticker)}</b> 한 종목이 전체의 ${(srt[0].v/tot*100).toFixed(0)}%예요. 한 종목에 쏠려 있어요.`);
  const t3=srt.slice(0,3).reduce((a,r)=>a+r.v,0)/tot; if(srt.length>3&&t3>.6) out.push(`상위 3개 종목이 ${(t3*100).toFixed(0)}%를 차지해요.`);
  if(rows.length<3) out.push(`종목이 ${rows.length}개뿐이라 분산이 부족해요.`);
  const reg=tally(rows,r=>r.region); if(reg.length&&reg[0][1]/tot>.85&&rows.length>1) out.push(`${reg[0][0]} 비중이 ${(reg[0][1]/tot*100).toFixed(0)}%로 한 지역에 몰려 있어요.`);
  return out;
}
function mixView(){
  const rows=portRows();
  if(rows.length<1) return emptyCard("PORTFOLIO MIX","분산은 잘<br>되어있을까요?","2개 이상 종목을 추가하면 구성을 도넛과 트리맵으로 분석해요.",`<button class="primary bigbtn" id="addHold2">+ 종목 추가</button>`,SAMPLE_DONUT);
  const dims=[["ticker","종목"],["type","유형"],["region","지역"],["account","계좌"],["freq","주기"]], fn={ticker:r=>r.h.ticker,type:r=>r.type,region:r=>r.region,account:r=>r.account,freq:r=>r.freq}[mixDim];
  const seg=`<div class="seg" id="mixseg" style="margin-bottom:12px">${dims.map(([k,l])=>`<button data-m="${k}" aria-pressed="${mixDim===k}">${l}</button>`).join("")}</div>`;
  const items=tally(rows,fn), warn=warnings(rows);
  const accs=tally(rows,r=>r.account).map(([a])=>{ const rs=rows.filter(r=>r.account===a), v=rs.reduce((x,r)=>x+r.v,0), c0=rs.reduce((x,r)=>x+r.r.cost,0), c=c0; return {a,v,c}; }), mx=Math.max(...accs.map(x=>Math.max(x.v,x.c)),1);
  return `${warn.length?`<section class="card warn full"><h2>집중 위험 점검</h2>${warn.map(w=>`<div class="wl">⚠ ${w}</div>`).join("")}</section>`:""}
    <section class="card"><h2>종목 비중 <small>트리맵 · 평가금액</small></h2>${isWide()?treemap(items.length&&mixDim==="ticker"?items:tally(rows,r=>r.h.ticker),400,430):treemap(items.length&&mixDim==="ticker"?items:tally(rows,r=>r.h.ticker))}</section>
    <section class="card"><h2>구성 분석 <small>Top 5 + 기타</small></h2>${seg}${donut(top5(items))}</section>
    <section class="card full"><h2>계좌별 <small>원금과 평가금액</small></h2>${accs.map(x=>{ const gain=x.v-x.c; return `<div class="acc"><div class="ah"><b>${esc(x.a)}</b><span class="num">${won(x.v)} <small class="${cls(gain)}">${x.c?pct(gain/x.c*100,1):""}</small></span></div>
      <div class="ab"><i class="c" style="width:${Math.min(100,Math.min(x.c,x.v)/mx*100)}%"></i><i class="g ${gain<0?"l":""}" style="width:${Math.min(100,Math.abs(gain)/mx*100)}%"></i></div></div>`; }).join("")}<div class="legend"><span><i style="background:#6b7384"></i>투자원금</span><span><i style="background:var(--red)"></i>수익</span><span><i style="background:var(--blue)"></i>손실</span></div></section>`;
}
