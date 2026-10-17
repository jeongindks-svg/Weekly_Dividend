"use strict";
// ===== v6: 매매일지(매수·매도·사유) · 실현손익 · 입출금(실투자원금) · 월 달력 =====
// 참고: 디어나 주식로그의 매매일지 / 입출금 시트
// 매수 기록은 종목의 lots(매수 기록)에서, 매도는 S.trades에서 가져와요.
// 매도하면 그 종목의 lots에 음수 수량(sell:true)을 한 줄 넣어서 수량·원금 계산이 그대로 맞아요(평균단가법).

let holdMode = "list", jFilter = "all", cashAcc = "all";
const holdSeg = a => `<div class="pills" id="hmode">${[["list","보유"],["trade","매매일지"],["cash","입출금"]].map(([k,l])=>`<button data-hm="${k}" aria-pressed="${a===k}">${l}</button>`).join("")}</div>`;
const groupYm = (items, fn) => { const m=new Map(); for(const x of items){ const k=fn(x).slice(0,7); if(!m.has(k)) m.set(k,[]); m.get(k).push(x); } return [...m]; };
const ymTitle = k => { const [y,m]=k.split("-"); return `${y}년 ${+m}월`; };

// ---------- 매매일지 ----------
function journalItems(){
  const out=[];
  for(const h of S.holdings) for(const l of (h.lots||[])){ if(l.sell||!(l.shares>0)) continue;
    out.push({k:"buy",date:l.date,h,ticker:h.ticker,shares:l.shares,krw:lotCostKRW(h,l),memo:l.memo||"",us:h.currency!=="KRW",unit:lotBase(l)/l.shares}); }
  for(const t of S.trades) out.push({k:"sell",date:t.date,t,ticker:t.ticker,shares:t.shares,krw:t.proceedsKRW,memo:t.memo||"",real:t.realized||0,pct:t.realizedPct||0,us:t.currency!=="KRW",unit:t.price});
  return out.sort((a,b)=>b.date.localeCompare(a.date)||(a.k<b.k?-1:1));
}
function realizedSum(){
  const y=String(new Date().getFullYear()); let all=0,yr=0,win=0;
  for(const t of S.trades){ const r=t.realized||0; all+=r; if(t.date.startsWith(y)) yr+=r; if(r>0) win++; }
  return {all,yr,win,n:S.trades.length};
}
function journalRow(x){
  const price=x.us?"$"+fmtPs(+x.unit.toFixed(4)):won(x.unit);
  return `<div class="lrow tap" ${x.k==="buy"?`data-hold="${x.h.id}"`:`data-trade="${x.t.id}"`}><div><div class="t"><span class="tag ${x.k}">${x.k==="buy"?"매수":"매도"}</span> ${esc(x.ticker)}</div>
    <div class="s num">${fmtD(parseD(x.date))} · ${qty(x.shares)}주 × ${price}</div>${x.memo?`<div class="memo">“${esc(x.memo)}”</div>`:""}</div>
    <div class="r"><div class="p num">${won(x.krw)}</div>${x.k==="sell"?`<div class="s num ${cls(x.real)}">${wonS(x.real)} (${pct(x.pct,1)})</div>`:""}</div></div>`;
}
// 한 달 안에서 종목별로 묶기: 매수 몇 주·얼마, 매도 몇 주·얼마
function tickerRows(rows){
  const m=new Map();
  for(const x of rows){ const o=m.get(x.ticker)||{t:x.ticker,bs:0,bk:0,ss:0,sk:0,real:0}; if(x.k==="buy"){ o.bs+=x.shares; o.bk+=x.krw; } else { o.ss+=x.shares; o.sk+=x.krw; o.real+=x.real; } m.set(x.ticker,o); }
  return [...m.values()].sort((a,b)=>(b.bk+b.sk)-(a.bk+a.sk));
}
function monthRow(ym,o){
  const sub=[o.bs?`${qty(+o.bs.toFixed(4))}주 매수`:"",o.ss?`${qty(+o.ss.toFixed(4))}주 매도`:""].filter(Boolean).join(" · ");
  return `<div class="lrow tap" data-jm="${esc(ym+"|"+encodeURIComponent(o.t))}"><div><div class="t">${esc(o.t)}</div><div class="s num">${sub}</div></div>
    <div class="r">${o.bs?`<div class="s num" style="font-size:13.5px"><span class="tag buy">매수</span> ${won(o.bk)}</div>`:""}${o.ss?`<div class="s num" style="font-size:13.5px"><span class="tag sell">매도</span> ${won(o.sk)} <b class="${cls(o.real)}">${wonS(o.real)}</b></div>`:""}</div></div>`;
}
function journalDetailSheet(key){
  const i=key.indexOf("|"), ym=key.slice(0,i), tk=decodeURIComponent(key.slice(i+1));
  const rows=journalItems().filter(x=>x.date.startsWith(ym)&&x.ticker===tk);
  openSheet(`<h3>${esc(tk)} · ${ymTitle(ym)}</h3><p class="hint">날짜별 내역이에요. 눌러서 수정할 수 있어요.</p>${rows.map(journalRow).join("")||`<div class="empty">내역이 없어요</div>`}
    <div class="btnrow" style="margin-top:12px"><button id="jdx">닫기</button></div>`,()=>{ $("#jdx").onclick=closeSheet;
      $("#sheet").querySelectorAll("[data-hold]").forEach(r=>r.onclick=()=>holdSheet(r.dataset.hold));
      $("#sheet").querySelectorAll("[data-trade]").forEach(r=>r.onclick=()=>tradeSheet(r.dataset.trade)); });
}
function viewTrades(){
  const items=journalItems();
  if(!items.length) return emptyCard("TRADE JOURNAL","언제, 왜 샀는지<br>기록해 보세요","매수 기록과 사유 메모를 남기면 내 판단을 돌아볼 수 있고, 매도를 기록하면 실현손익이 자동으로 계산돼요.",`<button class="primary bigbtn" id="addBuy">+ 매수 기록</button>`,SAMPLE_ROWS);
  const R=realizedSum(), list=items.filter(x=>jFilter==="all"||x.k===jFilter), nb=items.filter(x=>x.k==="buy").length;
  const seg=`<div class="seg" id="jseg" style="margin:0 0 6px">${[["all","전체"],["buy","매수"],["sell","매도"]].map(([k,l])=>`<button data-f="${k}" aria-pressed="${jFilter===k}">${l}</button>`).join("")}</div>`;
  return `<section class="stats3"><div><div class="k">누적 실현손익</div><div class="v num ${cls(R.all)}">${R.n?wonS(R.all):"-"}</div></div>
    <div><div class="k">올해 실현손익</div><div class="v num ${cls(R.yr)}">${R.n?wonS(R.yr):"-"}</div></div>
    <div><div class="k">매수 · 매도</div><div class="v num">${nb} · ${R.n}건</div>${R.n?`<div class="muted" style="font-size:11.5px">이익 ${R.win}건</div>`:""}</div></section>
    <div class="btnrow full" style="margin:0 0 12px"><button id="addBuy">+ 매수 기록</button><button class="primary" id="addSell">+ 매도 기록</button></div>
    ${seg}
    ${list.length?groupYm(list,x=>x.date).map(([k,rows])=>{ const bk=rows.filter(x=>x.k==="buy").reduce((a,x)=>a+x.krw,0), sk=rows.filter(x=>x.k==="sell").reduce((a,x)=>a+x.krw,0), real=rows.reduce((a,x)=>a+(x.k==="sell"?x.real:0),0), hasS=rows.some(x=>x.k==="sell");
      return `<section class="card" style="padding:4px 16px"><h2 style="padding-top:12px">${ymTitle(k)} <small>${bk?`매수 ${won(bk)}`:""}${bk&&sk?" · ":""}${sk?`매도 ${won(sk)}`:""}</small></h2>${tickerRows(rows).map(o=>monthRow(k,o)).join("")}${hasS?`<div class="lrow"><div class="s">실현손익</div><div class="r"><b class="num ${cls(real)}">${wonS(real)}</b></div></div>`:""}</section>`; }).join(""):`<section class="card"><div class="empty">해당하는 기록이 없어요</div></section>`}
    <p class="muted full" style="font-size:12px;margin:0 2px 12px">한 달에 종목별로 묶어서 보여줘요. 종목을 누르면 날짜별 내역이 열려요. 매도하면 보유 수량이 줄고, 평균 매수 단가(평균단가법) 기준으로 실현손익을 계산해요. 실현손익은 수수료·세금을 뺀 값이에요.</p>`;
}

function buyPick(){
  const hs=liveHoldings();
  if(!hs.length){ holdSheet(); return; }
  openSheet(`<h3>어떤 종목을 샀나요?</h3><p class="hint">종목을 고르면 매수 기록 칸으로 이동해요. 사유 메모도 남길 수 있어요.</p>
    ${hs.map(h=>`<div class="lrow tap" data-bp="${h.id}"><div><div class="t">${esc(h.ticker)}</div><div class="s num">${qty(h.shares)}주 · ${esc(accountOf(h))}</div></div><div class="r muted">›</div></div>`).join("")}
    <div class="btnrow" style="margin-top:12px"><button class="ghost" id="bpx">닫기</button><button id="bpn">새 종목</button></div>`,()=>{
      $("#bpx").onclick=closeSheet; $("#bpn").onclick=()=>holdSheet();
      $("#sheet").querySelectorAll("[data-bp]").forEach(r=>r.onclick=()=>{ holdSheet(r.dataset.bp); setTimeout(()=>{ const b=$("#hlotbox"); if(b){ b.scrollIntoView({block:"center"}); const q=$("#lts"); q&&q.focus(); } },60); }); });
}

// 매도: 보유 수량을 줄이고 실현손익을 기록해요
function sellSheet(hid){
  const hs=liveHoldings(); if(!hs.length){ toast("먼저 보유 종목을 추가해 주세요"); return; }
  const h0=hs.find(x=>x.id===hid)||hs[0], pick=()=>hs.find(x=>x.id===$("#sh").value)||h0;
  openSheet(`<h3>매도 기록</h3>
    <label class="f" for="sh">종목</label><select id="sh">${hs.map(h=>`<option value="${h.id}" ${h.id===h0.id?"selected":""}>${esc(h.ticker)} · ${(+h.shares).toLocaleString()}주</option>`).join("")}</select>
    <div class="grid2"><div><label class="f" for="sd">매도일</label><input id="sd" type="date" value="${todayStr()}"></div>
    <div><label class="f" for="sq">매도 수량 <button type="button" class="small ghost" id="sall" style="padding:2px 8px">전량</button></label><input id="sq" type="number" inputmode="decimal" step="any"></div></div>
    <div class="grid2"><div><label class="f" for="sp">매도 단가 <span id="scur"></span></label><input id="sp" type="number" inputmode="decimal" step="any"></div>
    <div id="sfxw"><label class="f" for="sf">매도 환율 (₩/$)</label><input id="sf" type="number" inputmode="decimal" step="0.01" value="${S.settings.fx}"></div></div>
    <div class="calc" id="sfn"></div>
    <label class="f" for="sfee">수수료·세금 합계 (원, 선택)</label><input id="sfee" type="number" inputmode="decimal" step="any" placeholder="0">
    <label class="f" for="sm">매도 사유 메모 (선택)</label><input id="sm" maxlength="80" placeholder="예: 목표 수익 달성, 비중 조절">
    <div class="preview num" id="spv"></div>
    <div class="btnrow" style="margin-top:14px"><button class="ghost" id="sx">취소</button><button class="primary" id="ssv">매도 기록 저장</button></div>`,()=>{
      const calcSell=()=>{ const h=pick(), n=+$("#sq").value||0, pr=+$("#sp").value||0, kr=h.currency==="KRW", fx=kr?1:(+$("#sf").value||S.settings.fx), fee=+$("#sfee").value||0;
        const c=holdCalc(h), per=h.shares>0?c.cost/h.shares:0, cost=per*n, gross=pr*n*fx, real=gross-fee-cost;
        return {h,n,pr,kr,fx,fee,cost,gross,real,pct:cost>0?real/cost*100:0}; };
      const upd=()=>{ const x=calcSell(); $("#scur").textContent=x.kr?"(원)":"($)"; $("#sfxw").hidden=x.kr; $("#sfn").hidden=x.kr;
        $("#spv").innerHTML=x.n>0&&x.pr>0?(x.cost>0?`매도금액 ${won(x.gross)} · 매수원가 ${won(x.cost)}<br>실현손익 <b class="${cls(x.real)}">${wonS(x.real)} (${pct(x.pct,1)})</b>${Math.abs(x.h.shares-x.n)<1e-9?`<br>전량 매도예요. 저장하면 보유 종목에서 빠져요(배당 기록은 남아요).`:""}`:"평단이 없어서 실현손익을 계산할 수 없어요. 종목에 평단을 먼저 입력해 주세요."):""; };
      const setDefaults=()=>{ const h=pick(), p=curPrice(h); $("#sp").value=p>0?p:""; upd(); };
      $("#sheet").addEventListener("input",upd); $("#sh").onchange=setDefaults; setDefaults();
      const fxs=autoFxInto("#sd","#sf","#sfn",upd);
      $("#sall").onclick=()=>{ $("#sq").value=pick().shares; upd(); };
      $("#sx").onclick=closeSheet;
      $("#ssv").onclick=()=>{ const x=calcSell(), h=x.h, date=$("#sd").value||todayStr();
        if(!(x.n>0)||x.n>h.shares+1e-9){ toast(`매도 수량은 0보다 크고 보유 수량(${h.shares}주) 이하여야 해요`); return; }
        if(!(x.pr>0)){ toast("매도 단가를 입력해 주세요"); return; }
        if(!(x.cost>0)){ toast("평단이 없어서 실현손익을 계산할 수 없어요"); return; }
        const id=uid(), full=Math.abs(h.shares-x.n)<1e-9;
        if(h.lots&&h.lots.length){ const sh0=h.lots.reduce((a,l)=>a+l.shares,0), raw=sh0>0?h.lots.reduce((a,l)=>a+lotBase(l),0)/sh0:0, c=holdCalc(h);
          h.lots.push({id:uid(),tid:id,sell:true,date,shares:-x.n,total:-x.n*raw,price:raw,fx:h.currency!=="KRW"?(c.buyFx||+h.buyFx||0):0});
          h.shares=h.lots.reduce((a,l)=>a+l.shares,0); }
        else h.shares=h.shares-x.n;
        if(full){ h.shares=0; h.closed=true; } else if(h.shares<0) h.shares=0;
        h.updated=Date.now();
        S.trades.push({id,created:Date.now(),updated:Date.now(),hid:h.id,date,ticker:h.ticker,currency:h.currency,shares:x.n,price:x.pr,fx:x.kr?0:x.fx,fee:x.fee,costKRW:x.cost,proceedsKRW:x.gross,realized:x.real,realizedPct:x.pct,memo:$("#sm").value.trim()});
        persist(); closeSheet(); tab="hold"; holdMode="trade"; render(); toast(`매도 기록 완료 · 실현손익 ${wonS(x.real)}`); };
    });
}
function undoSell(t){
  const h=S.holdings.find(x=>x.id===t.hid); if(!h) return;
  if(h.lots&&h.lots.some(l=>l.tid===t.id)){ h.lots=h.lots.filter(l=>l.tid!==t.id); h.shares=h.lots.reduce((a,l)=>a+l.shares,0); }
  else h.shares=(+h.shares||0)+t.shares;
  if(h.closed&&h.shares>0) h.closed=false;
  h.updated=Date.now();
}
function tradeSheet(id){
  const t=S.trades.find(x=>x.id===id); if(!t) return;
  const us=t.currency!=="KRW";
  openSheet(`<h3>${esc(t.ticker)} 매도</h3><p class="hint">${t.date} · ${qty(t.shares)}주 × ${us?"$"+fmtPs(t.price):won(t.price)}${us&&t.fx?` · 환율 ${(+t.fx).toLocaleString()}원`:""}</p>
    <div class="av2s num ${cls(t.realized)}" style="font-size:26px;font-weight:700;margin:4px 0 2px">${wonS(t.realized||0)}</div>
    <p class="hint">실현손익 ${pct(t.realizedPct||0,1)} · 매도금액 ${won(t.proceedsKRW)} · 매수원가 ${won(t.costKRW)}${t.fee?` · 수수료 ${won(t.fee)}`:""}</p>
    <label class="f" for="tm">매도 사유 메모</label><input id="tm" maxlength="80" value="${esc(t.memo||"")}" placeholder="왜 팔았는지 적어 두세요">
    <div class="btnrow" style="margin-top:14px"><button class="danger" id="tdel">삭제</button><button class="ghost" id="tx">닫기</button><button class="primary" id="tsv">메모 저장</button></div>`,()=>{
      $("#tx").onclick=closeSheet;
      $("#tsv").onclick=()=>{ t.memo=$("#tm").value.trim(); t.updated=Date.now(); persist(); closeSheet(); toast("저장했어요"); };
      $("#tdel").onclick=()=>{ if(!confirm("이 매도 기록을 삭제할까요?\n팔았던 수량은 보유 수량으로 되돌아와요.")) return; undoSell(t); S.trades=S.trades.filter(x=>x.id!==t.id); markDeleted(t.id); persist(); closeSheet(); toast("삭제하고 보유 수량을 되돌렸어요"); }; });
}

// ---------- 입출금 (실투자원금) ----------
const cashNet = acc => S.cash.reduce((a,c)=>(acc==="all"||c.account===acc)?a+(c.type==="out"?-c.amount:c.amount):a,0);
const cashAccs = () => [...new Set([...S.cash.map(c=>c.account||"일반"),...liveHoldings().map(accountOf)])];
function viewCash(){
  if(!S.cash.length) return emptyCard("DEPOSITS","내가 실제로 넣은 돈,<br>얼마인가요?","계좌에 입금하고 출금한 내역을 적으면 실투자원금과 계좌별 수익이 계산돼요.",`<button class="primary bigbtn" id="addCash">+ 입금 기록</button>`,SAMPLE_ROWS);
  const y=String(new Date().getFullYear()), inAll=S.cash.filter(c=>c.type!=="out").reduce((a,c)=>a+c.amount,0), outAll=S.cash.filter(c=>c.type==="out").reduce((a,c)=>a+c.amount,0), inY=S.cash.filter(c=>c.type!=="out"&&c.date.startsWith(y)).reduce((a,c)=>a+c.amount,0);
  const rows=portRows(), accs=cashAccs();
  if(cashAcc!=="all"&&!accs.includes(cashAcc)) cashAcc="all";
  const accCard=accs.map(a=>{ const net=cashNet(a), v=rows.filter(r=>r.account===a).reduce((s,r)=>s+r.v,0), has=S.cash.some(c=>(c.account||"일반")===a), gain=v-net;
    return `<div class="lrow"><div><div class="t">${esc(a)}</div><div class="s num">실투자원금 ${has?won(net):"-"} · 평가금 ${v?won(v):"-"}</div></div><div class="r">${has&&v?`<div class="p num ${cls(gain)}">${wonS(gain)}</div><div class="s num ${cls(gain)}">${net>0?pct(gain/net*100,1):""}</div>`:""}</div></div>`; }).join("");
  const filt=`<div class="chips" id="cfilter">${["all",...accs].map(a=>`<button data-a="${esc(a)}" aria-pressed="${cashAcc===a}">${a==="all"?"전체":esc(a)}</button>`).join("")}</div>`;
  const list=[...S.cash].filter(c=>cashAcc==="all"||(c.account||"일반")===cashAcc).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);
  return `<section class="stats3"><div><div class="k">실투자원금</div><div class="v num">${won(inAll-outAll)}</div></div>
    <div><div class="k">올해 입금</div><div class="v num">${won(inY)}</div></div>
    <div><div class="k">총 출금</div><div class="v num">${outAll?won(outAll):"-"}</div></div></section>
    <div class="btnrow full" style="margin:0 0 12px"><button class="primary" id="addCash">+ 입출금 기록</button></div>
    <section class="card" style="padding:4px 16px"><h2 style="padding-top:12px">계좌별 <small>실투자원금 vs 평가금액</small></h2>${accCard}</section>
    ${filt}
    ${groupYm(list,c=>c.date).map(([k,rs])=>{ const net=rs.reduce((a,c)=>a+(c.type==="out"?-c.amount:c.amount),0);
      return `<section class="card" style="padding:4px 16px"><h2 style="padding-top:12px">${ymTitle(k)} <small>순입금 <span class="${cls(net)}">${wonS(net)}</span></small></h2>${rs.map(c=>`<div class="lrow tap" data-cash="${c.id}"><div><div class="t"><span class="tag ${c.type==="out"?"sell":"buy"}">${c.type==="out"?"출금":"입금"}</span> ${esc(c.account||"일반")}</div><div class="s">${fmtD(parseD(c.date))}${c.memo?` · ${esc(c.memo)}`:""}</div></div><div class="r"><div class="p num">${c.type==="out"?"-":"+"}${won(c.amount)}</div></div></div>`).join("")}</section>`; }).join("")}
    <p class="muted full" style="font-size:12px;margin:0 2px 12px">실투자원금은 통장에 넣은 돈(입금−출금)이에요. 주식을 산 금액인 ‘투자원금’과는 따로 계산하고, 계좌 속 현금은 평가금액에 들어가지 않아요.</p>`;
}
function cashSheet(id){
  const c=id?S.cash.find(x=>x.id===id):null; let type=c?c.type:"in";
  const last=S.cash.length?[...S.cash].sort((a,b)=>b.created-a.created)[0].account:"일반";
  openSheet(`<h3>${c?"입출금 수정":"입출금 기록"}</h3>
    <div class="seg" id="cty" style="margin-bottom:6px"><button type="button" data-t="in" aria-pressed="${type==="in"}">입금</button><button type="button" data-t="out" aria-pressed="${type==="out"}">출금</button></div>
    <div class="grid2"><div><label class="f" for="cd">날짜</label><input id="cd" type="date" value="${c?c.date:todayStr()}"></div>
    <div><label class="f" for="ca">금액 (원)</label><input id="ca" type="number" inputmode="decimal" step="any" value="${c?c.amount:""}"></div></div>
    <label class="f" for="cac">계좌</label><input id="cac" list="cacl" value="${esc(c?c.account||"일반":last)}"><datalist id="cacl">${[...new Set([...accountsAll(),...S.cash.map(x=>x.account)])].map(a=>`<option value="${esc(a)}">`).join("")}</datalist>
    <label class="f" for="cm">메모 (선택)</label><input id="cm" maxlength="60" value="${esc(c?c.memo||"":"")}" placeholder="예: 월급 투자금, 생활비 인출">
    <div class="btnrow" style="margin-top:14px">${c?`<button class="danger" id="cdel">삭제</button>`:""}<button class="ghost" id="cx">취소</button><button class="primary" id="csv">저장</button></div>`,()=>{
      $("#cty").onclick=ev=>{ const b=ev.target.closest("button"); if(!b) return; type=b.dataset.t; $("#cty").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.t===type)); };
      $("#cx").onclick=closeSheet;
      if(c) $("#cdel").onclick=()=>{ if(!confirm("이 기록을 삭제할까요?")) return; S.cash=S.cash.filter(x=>x.id!==c.id); markDeleted(c.id); persist(); closeSheet(); toast("삭제했어요"); };
      $("#csv").onclick=()=>{ const amount=+$("#ca").value, date=$("#cd").value||todayStr();
        if(!(amount>0)){ toast("금액을 입력해 주세요"); return; }
        const rec={date,type,amount,account:$("#cac").value.trim()||"일반",memo:$("#cm").value.trim(),updated:Date.now()};
        if(c) Object.assign(c,rec); else S.cash.push(Object.assign({id:uid(),created:Date.now()},rec));
        persist(); closeSheet(); toast("저장했어요"); }; });
}

// ---------- 하루의 매매·입출금 (달력 · 하루 시트에서 같이 보여줘요) ----------
function dayEvents(D){
  const ev=[];
  for(const h of S.holdings) for(const l of (h.lots||[])) if(!l.sell&&l.date===D&&l.shares>0) ev.push({k:"buy",txt:`${esc(h.ticker)} ${qty(l.shares)}주 매수`,amt:lotCostKRW(h,l),memo:l.memo,h});
  for(const t of S.trades) if(t.date===D) ev.push({k:"sell",txt:`${esc(t.ticker)} ${qty(t.shares)}주 매도`,amt:t.proceedsKRW,memo:t.memo,real:t.realized,t});
  for(const c of S.cash) if(c.date===D) ev.push({k:"cash",txt:`${esc(c.account||"일반")} ${c.type==="out"?"출금":"입금"}`,amt:c.amount,memo:c.memo,out:c.type==="out",c});
  return ev;
}
function dayExtra(D){
  const ev=dayEvents(D); if(!ev.length) return "";
  return `<h3 style="margin:14px 0 2px;font-size:15px">이 날의 매매·입출금</h3>${ev.map(e=>`<div class="lrow"><div><div class="t"><span class="tag ${e.k==="cash"?(e.out?"sell":"buy"):e.k}">${e.k==="cash"?"입출금":e.k==="buy"?"매수":"매도"}</span> ${e.txt}</div>${e.memo?`<div class="memo">“${esc(e.memo)}”</div>`:""}</div><div class="r"><div class="p num" style="font-size:15px">${e.k==="cash"&&e.out?"-":""}${won(e.amt)}</div>${e.real!=null?`<div class="s num ${cls(e.real)}">${wonS(e.real)}</div>`:""}</div></div>`).join("")}`;
}

// ---------- 월 달력 ----------
let calFrom = null;
function monthCalSheet(ym){
  const now=new Date(); ym=ym||ymOf(now.getFullYear(),now.getMonth()); calFrom=ym;
  const [Y,M]=ym.split("-").map(Number), n=new Date(Y,M,0).getDate(), lead=new Date(Y,M-1,1).getDay(), today=todayStr(), b=basis();
  const prev=M===1?ymOf(Y-1,11):ymOf(Y,M-2), next=M===12?ymOf(Y+1,0):ymOf(Y,M);
  let recv=0, left=0, cells="";
  for(let i=0;i<lead;i++) cells+=`<span class="cday off"></span>`;
  for(let d=1; d<=n; d++){ const D=`${ym}-${String(d).padStart(2,"0")}`, x=dayInfo(D), ev=dayEvents(D);
    recv+=x.recv; if(D>=today) left+=x.expAmt;
    const dots=[...new Set(ev.map(e=>e.k))].map(k=>`<i class="${k}"></i>`).join("");
    cells+=`<button class="cday${D===today?" today":""}${x.recv?" got":""}" data-cd="${D}" aria-label="${M}월 ${d}일"><b>${d}</b><span class="ca${x.recv?" r":""}">${x.recv?kfmt(x.recv):(x.expAmt&&D>=today?"~"+kfmt(x.expAmt):"")}</span><span class="cm">${dots}</span></button>`; }
  openSheet(`<div class="calnav"><button type="button" class="small ghost" id="cprev" aria-label="이전 달">‹</button><h3 style="margin:0">${Y}년 ${M}월</h3><button type="button" class="small ghost" id="cnext" aria-label="다음 달">›</button></div>
    <div class="wsum" style="margin:6px 0 10px"><span>받은 배당 <b class="num">${won(recv)}</b></span>${left>0?`<span>남은 예정 <b class="num">~${won(left)}</b></span>`:""}</div>
    <div class="calgrid">${[...DOWN].map((c,i)=>`<span class="cdw${i===0?" su":""}">${c}</span>`).join("")}${cells}</div>
    <div class="legend" style="margin-top:10px"><span><i class="ld buy"></i>매수</span><span><i class="ld sell"></i>매도</span><span><i class="ld cash"></i>입출금</span><span class="muted">날짜를 누르면 내역이 보여요</span></div>
    <div class="btnrow" style="margin-top:12px"><button class="ghost" id="ccx">닫기</button><button class="primary" id="cgo">배당 기록하기</button></div>`,()=>{
      $("#cprev").onclick=()=>monthCalSheet(prev); $("#cnext").onclick=()=>monthCalSheet(next); $("#ccx").onclick=closeSheet; $("#cgo").onclick=()=>batchSheet();
      $("#sheet").querySelectorAll("[data-cd]").forEach(c=>c.onclick=()=>daySheet(c.dataset.cd)); });
}
