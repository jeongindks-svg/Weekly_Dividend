"use strict";
// ---------- sheets ----------
function monthSheet(ym){
  const es=S.entries.filter(e=>e.date.startsWith(ym)).sort((a,c)=>c.date.localeCompare(a.date)||a.ticker.localeCompare(c.ticker)), b=basis();
  const tot=es.reduce((a,e)=>a+amtOf(e,b),0), by={}; for(const e of es) by[e.ticker]=(by[e.ticker]||0)+amtOf(e,b);
  const [y,m]=ym.split("-");
  openSheet(`<h3>${y}년 ${+m}월 받은 배당</h3><p class="hint">${basisName()} ${won(tot)} · ${es.length}건</p>
    ${es.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 6px">${Object.entries(by).sort((a,c)=>c[1]-a[1]).map(([t,v])=>`<span class="tag" style="margin:0">${esc(t)} ${won(v)}</span>`).join("")}</div>
    ${es.map(e=>{ const d=parseD(e.date); return `<div class="lrow"><div><div class="t">${esc(e.ticker)}</div><div class="s">${fmtD(d)} (${"일월화수목금토"[d.getDay()]}) · ${e.currency==="KRW"?won(e.perShare):"$"+fmtPs(e.perShare)} × ${qty(e.shares)}주</div></div><div class="r"><div class="p amt">${won(amtOf(e,b))}</div></div></div>`; }).join("")}`:`<div class="empty">이 달에 받은 배당이 없어요</div>`}
    <div class="btnrow" style="margin-top:12px"><button id="msClose">닫기</button></div>`,()=>{ $("#msClose").onclick=closeSheet; });
}
function openSheet(html, bind){ const o=$("#sheet"), n=o.cloneNode(false); o.replaceWith(n); n.innerHTML=html; $("#sheetBg").classList.add("open"); bind&&bind(); }
function closeSheet(){ $("#sheetBg").classList.remove("open"); softRender(); }
$("#sheetBg").addEventListener("click", e=>{ if(e.target.id==="sheetBg") closeSheet(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeSheet(); });

function autoFxInto(dateSel, fxSel, noteSel, onDone){
  const st={manual:false,src:"saved"};
  $(fxSel).addEventListener("input",()=>{ st.manual=true; $(noteSel).textContent="직접 입력한 환율"; });
  const run=async()=>{ if(st.manual || !S.settings.autoFx){ if(!S.settings.autoFx) $(noteSel).textContent="환율 자동 연동 꺼짐"; return; }
    const d=$(dateSel).value||todayStr(); $(noteSel).textContent="환율 불러오는 중…";
    const r=await getFx(d); if(st.manual||!document.body.contains($(fxSel))) return;
    st.src=r.src; $(fxSel).value=r.rate;
    $(noteSel).textContent = r.src==="offline" ? "오프라인 · 인터넷 연결되면 입금일 환율로 자동 수정돼요" : `${fmtD(parseD(d))} 환율 자동 적용${r.base&&r.base!==d?` (${fmtD(parseD(r.base))} 영업일 기준)`:""}`;
    onDone&&onDone(); };
  const redo=()=>{ st.manual=false; run(); };
  $(dateSel).addEventListener("change",redo); $(dateSel).addEventListener("input",redo); run();
  st.reset=redo;
  return st;
}

function batchSheet(){
  if(!S.holdings.length){
    openSheet(`<h3>먼저 종목을 등록해 주세요</h3><p class="hint">보유 종목과 수량을 등록해 두면, 매주 주당 배당금만 입력해 한 번에 기록할 수 있어요.</p>
      <div class="btnrow"><button class="ghost" id="bx">닫기</button><button class="primary" id="bgo">종목 추가</button></div>`, ()=>{ $("#bx").onclick=closeSheet; $("#bgo").onclick=()=>holdSheet(); });
    return;
  }
  const items=S.holdings.map(h=>`<div class="batch-item" data-h="${h.id}">
    <div class="top"><label class="chk"><input type="checkbox" checked> ${esc(h.ticker)}</label><span class="muted num" style="font-size:12px">${qty(h.shares)}주</span></div>
    <div class="grid2"><div><label class="f">주당 배당 (${h.currency==="KRW"?"원":"$"})</label><input class="ps" type="number" inputmode="decimal" step="any" value="${lastPerShare(h.ticker)}" placeholder="0.00"></div>
    <div><label class="f">수량</label><input class="sh" type="number" inputmode="decimal" step="any" value="${h.shares}"></div></div>
    <div class="calc num"></div></div>`).join("");
  openSheet(`<h3>배당 기록</h3><p class="hint">입금일을 바꾸면 그날 환율과 주가가 자동으로 들어가요. 지난번 주당 배당금은 미리 채워 뒀어요.</p>
    <label class="f" for="bd">입금일 <b id="bdw" style="color:var(--ink)"></b></label>
    <div class="datebar"><button type="button" id="bprev" aria-label="하루 전">‹</button><input id="bd" type="date" value="${todayStr()}"><button type="button" id="bnext" aria-label="하루 뒤">›</button><button type="button" id="btoday">오늘</button></div>
    <label class="f" for="bfx">환율 (입금일 기준, $1 = ₩)</label>
    <div class="fxrow"><input id="bfx" type="number" inputmode="decimal" step="0.01" value="${S.settings.fx}"><button type="button" id="bfxauto">자동</button></div>
    <div class="calc" id="bfxn"></div>
    ${items}
    <div class="preview num" id="bsum"></div>
    <div class="btnrow" style="margin-top:14px"><button class="ghost" id="bx">취소</button><button class="primary" id="bsave">기록 저장</button></div>`, ()=>{
      const upd=()=>{ let tot=0; const fx=+$("#bfx").value||0;
        $("#sheet").querySelectorAll(".batch-item").forEach(el=>{ const h=S.holdings.find(x=>x.id===el.dataset.h), on=el.querySelector("input[type=checkbox]").checked;
          const ps=+el.querySelector(".ps").value||0, sh=+el.querySelector(".sh").value||0;
          const c=calc({ticker:h.ticker,perShare:ps,shares:sh,taxRate:taxFor(h.currency),fx,currency:h.currency,price:curPrice(h)});
          el.querySelector(".calc").textContent = ps? `세후 ${h.currency==="KRW"?"":usd(c.net)+" · "}${won(c.netKRW)}${c.yield!=null?` · ${c.yield.toFixed(2)}%`:""}` : "";
          el.style.opacity=on?1:.45; if(on) tot+=c.netKRW; });
        $("#bsum").textContent=`이번 주 세후 합계 ${won(tot)}`; };
      $("#sheet").addEventListener("input",upd); drawLots(); upd();
      const fxs=autoFxInto("#bd","#bfx","#bfxn",upd);
      const DOW="일월화수목금토", dw=()=>{ const v=$("#bd").value; $("#bdw").textContent=v?`· ${DOW[parseD(v).getDay()]}요일`:""; };
      const shift=n=>{ const v=$("#bd").value||todayStr(); $("#bd").value=addDays(v,n); $("#bd").dispatchEvent(new Event("change")); };
      $("#bprev").onclick=()=>shift(-1); $("#bnext").onclick=()=>shift(1);
      $("#btoday").onclick=()=>{ $("#bd").value=todayStr(); $("#bd").dispatchEvent(new Event("change")); };
      $("#bd").addEventListener("change",dw); $("#bd").addEventListener("input",dw); dw();
      $("#bfxauto").onclick=()=>{ if(!S.settings.autoFx){ toast("설정에서 환율 자동 연동을 켜 주세요"); return; } fxs.reset(); };
      $("#bx").onclick=closeSheet;
      $("#bsave").onclick=()=>{
        const date=$("#bd").value||todayStr(), fx=+$("#bfx").value||S.settings.fx; let n=0;
        $("#sheet").querySelectorAll(".batch-item").forEach(el=>{
          if(!el.querySelector("input[type=checkbox]").checked) return;
          const h=S.holdings.find(x=>x.id===el.dataset.h), ps=+el.querySelector(".ps").value, sh=+el.querySelector(".sh").value;
          if(!(ps>0)||!(sh>0)) return;
          const cached = S.priceCache[h.ticker] && S.priceCache[h.ticker][date];
          S.entries.push({id:uid(),created:Date.now(),updated:Date.now(),date,ticker:h.ticker,perShare:ps,shares:sh,taxRate:taxFor(h.currency),fx,currency:h.currency,memo:"",
            fxAuto:!fxs.manual&&S.settings.autoFx, fxPending:h.currency!=="KRW"&&!fxs.manual&&S.settings.autoFx&&fxs.src==="offline",
            price: h.currency==="KRW" ? (h.manualPrice||null) : (cached||null)});
          if(sh!==h.shares){ h.shares=sh; h.updated=Date.now(); } n++;
        });
        if(!n){ toast("주당 배당금을 입력해 주세요"); return; }
        persist(); closeSheet(); render(); toast(`${n}건 기록했어요`); backfillPrices();
      };
    });
}

function entrySheet(id){
  const e=id?S.entries.find(x=>x.id===id):null, h0=S.holdings[0];
  let cur=e?e.currency:(h0?h0.currency:"USD");
  const tickers=[...new Set([...S.holdings.map(h=>h.ticker),...S.entries.map(x=>x.ticker)])];
  openSheet(`<h3>${e?"기록 수정":"배당 기록"}</h3>
    <label class="f" for="et">종목</label><input id="et" list="tl" value="${esc(e?e.ticker:(h0?h0.ticker:""))}" placeholder="예: SPYI" autocapitalize="characters">
    <datalist id="tl">${tickers.map(t=>`<option value="${esc(t)}">`).join("")}</datalist>
    <div class="grid2"><div><label class="f" for="ed">입금일</label><input id="ed" type="date" value="${e?e.date:todayStr()}"></div>
    <div><label class="f">통화</label><div class="seg" id="ec"><button type="button" data-c="USD" aria-pressed="${cur==="USD"}">USD</button><button type="button" data-c="KRW" aria-pressed="${cur==="KRW"}">KRW</button></div></div></div>
    <div class="grid2"><div><label class="f" for="ep">주당 배당</label><input id="ep" type="number" inputmode="decimal" step="any" value="${e?e.perShare:""}"></div>
    <div><label class="f" for="es">수량</label><input id="es" type="number" inputmode="decimal" step="any" value="${e?e.shares:(h0?h0.shares:"")}"></div></div>
    <div class="grid2"><div><label class="f" for="ex">세율 (%)</label><input id="ex" type="number" inputmode="decimal" step="0.1" value="${e?e.taxRate:taxFor(cur)}"></div>
    <div><label class="f" for="ef">환율</label><input id="ef" type="number" inputmode="decimal" step="0.01" value="${e?e.fx:S.settings.fx}"></div></div>
    <div class="calc" id="efn">${e?(e.fxAuto?"입금일 환율 자동 적용":"저장된 환율"):""}</div>
    <label class="f" for="epr">입금일 주가 <span id="eprn">(비우면 자동)</span></label><input id="epr" type="number" inputmode="decimal" step="any" value="${e&&e.price?e.price:""}" placeholder="자동">
    <label class="f" for="em">메모</label><input id="em" value="${esc(e?e.memo:"")}" placeholder="선택">
    <div class="preview num" id="epv"></div>
    <div class="btnrow" style="margin-top:14px">${e?`<button class="danger" id="edel">삭제</button>`:""}<button class="ghost" id="ecx">취소</button><button class="primary" id="esv">저장</button></div>`, ()=>{
      const upd=()=>{ const r=calc({ticker:$("#et").value.trim().toUpperCase(),perShare:+$("#ep").value||0,shares:+$("#es").value||0,taxRate:+$("#ex").value||0,fx:+$("#ef").value||0,currency:cur,price:+$("#epr").value||null});
        $("#epv").textContent=`세전 ${cur==="KRW"?won(r.gross):usd(r.gross)} → 세후 ${won(r.netKRW)}${r.yield!=null?` · ${r.yield.toFixed(2)}%`:""}`; $("#ef").disabled=cur==="KRW"; };
      const setCur=c=>{ cur=c; $("#ec").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.c===c)); $("#ex").value=taxFor(c); upd(); };
      $("#ec").onclick=ev=>{ const b=ev.target.closest("button"); if(b) setCur(b.dataset.c); };
      $("#et").addEventListener("change",()=>{ const h=holdingOf($("#et").value.trim().toUpperCase()); if(h){ $("#es").value=h.shares; setCur(h.currency); if(!$("#ep").value) $("#ep").value=lastPerShare(h.ticker); upd(); } });
      $("#sheet").addEventListener("input",upd); upd();
      let fxs={manual:!!e&&!e.fxAuto, src:"saved"};
      if(!e) fxs=autoFxInto("#ed","#ef","#efn",upd);
      else { $("#ef").addEventListener("input",()=>{ fxs.manual=true; }); $("#ed").addEventListener("change",()=>{ if(S.settings.autoFx&&!fxs.manual) getFx($("#ed").value).then(r=>{ fxs.src=r.src; $("#ef").value=r.rate; $("#efn").textContent="입금일 환율 자동 적용"; upd(); }); }); }
      let priceTouched=false; $("#epr").addEventListener("input",()=>priceTouched=true);
      $("#ecx").onclick=closeSheet;
      if(e) $("#edel").onclick=()=>{ if(!confirm("이 기록을 삭제할까요?")) return; S.entries=S.entries.filter(x=>x.id!==e.id); markDeleted(e.id); persist(); closeSheet(); toast("삭제했어요"); };
      $("#esv").onclick=()=>{
        const t=$("#et").value.trim().toUpperCase(), ps=+$("#ep").value, sh=+$("#es").value, date=$("#ed").value||todayStr();
        if(!t||!(ps>0)||!(sh>0)){ toast("종목, 주당 배당, 수량을 입력해 주세요"); return; }
        const pr=+$("#epr").value||null, dateChanged = e && e.date!==date;
        const rec={date,ticker:t,perShare:ps,shares:sh,taxRate:+$("#ex").value||0,fx:+$("#ef").value||S.settings.fx,currency:cur,memo:$("#em").value.trim(),updated:Date.now(),
          fxAuto:!fxs.manual&&S.settings.autoFx, fxPending:cur!=="KRW"&&!fxs.manual&&S.settings.autoFx&&fxs.src==="offline",
          price: pr && !(dateChanged && !priceTouched) ? pr : null, priceFail:false};
        if(e) Object.assign(e,rec); else S.entries.push(Object.assign({id:uid(),created:Date.now()},rec));
        persist(); closeSheet(); toast("저장했어요"); backfillPrices(); backfillFx();
      };
    });
}

function holdSheet(id){
  const h=id?S.holdings.find(x=>x.id===id):null; let cur=h?h.currency:"USD";
  const c0=h&&h.currency!=="KRW"?holdCalc(h):null;
  const r2=(n,d)=>n?Math.round(n*10**d)/10**d:"";
  const vU=c0?r2(c0.aU,4):"", vK=c0?r2(c0.aK,2):"", vW=h&&h.currency==="KRW"?(h.avgCost||""):"";
  let lots=(h&&h.lots?h.lots:[]).map(x=>Object.assign({},x));
  const derive=()=>{ const sh=lots.reduce((a,l)=>a+l.shares,0), cp=lots.reduce((a,l)=>a+l.shares*l.price,0), allFx=lots.every(l=>+l.fx>0), ck=lots.reduce((a,l)=>a+l.shares*l.price*(+l.fx||0),0);
    return {sh, avg:sh?cp/sh:0, avgK:allFx&&sh?ck/sh:0}; };
  openSheet(`<h3>${h?"종목 수정":"종목 추가"}</h3>
    <label class="f" for="ht">티커 / 종목명</label><input id="ht" value="${esc(h?h.ticker:"")}" placeholder="예: SPYI, QQQI, YMAX" autocapitalize="characters">
    <div class="grid2"><div><label class="f" for="hs">보유 수량</label><input id="hs" type="number" inputmode="decimal" step="any" value="${h?h.shares:""}"></div>
    <div><label class="f">상장 시장</label><div class="seg" id="hc"><button type="button" data-c="USD" aria-pressed="${cur==="USD"}">미국 $</button><button type="button" data-c="KRW" aria-pressed="${cur==="KRW"}">국내 ₩</button></div></div></div>
    <div id="husd"><div class="grid2"><div><label class="f" for="hau">달러 평단 ($)</label><input id="hau" type="number" inputmode="decimal" step="any" value="${vU}" placeholder="예: 50.12"></div>
      <div><label class="f" for="hak">원화 평단 (₩, 1주)</label><input id="hak" type="number" inputmode="decimal" step="any" value="${vK}" placeholder="예: 68000"></div></div>
      <p class="calc" style="margin:4px 0 0">증권사 앱의 달러 평단과 원화 평단을 그대로 옮겨 적으세요. 여러 번 나눠 산 환율이 원화 평단에 이미 반영돼 있어서, 평균 매수 환율은 자동으로 계산돼요.</p></div>
    <div id="hkrw"><label class="f" for="haw">평균 매수가 (원)</label><input id="haw" type="number" inputmode="decimal" step="any" value="${vW}"></div>
    <div id="hlotbox" style="margin-top:12px"><label class="f">매수 기록 <span class="muted">(선택 · 넣으면 수량·평단이 자동 계산돼요)</span></label>
      <div id="hlots"></div>
      <div style="display:grid;grid-template-columns:1.3fr .8fr 1fr;gap:8px;align-items:end"><div><label class="f" for="ltd">매수일</label><input id="ltd" type="date" value="${todayStr()}"></div>
        <div><label class="f" for="lts">수량</label><input id="lts" type="number" inputmode="decimal" step="any"></div>
        <div><label class="f" for="ltp">가격 <span class="hcur"></span></label><input id="ltp" type="number" inputmode="decimal" step="any"></div></div>
      <div id="ltfw"><label class="f" for="ltf">매수 환율 (원/$, 선택)</label><input id="ltf" type="number" inputmode="decimal" step="any" placeholder="모르면 비워 두기"></div>
      <div class="btnrow" style="margin-top:8px"><button type="button" class="small" id="ladd">+ 매수 추가</button></div>
      <p class="calc" style="margin:6px 0 0">추가로 산 날짜별로 적으면 그 시점의 원금으로 배당률을 계산해요. 배당으로 재투자해서 산 것도 매수로 적어 주세요.</p></div>
    <div class="preview num" id="hpv" style="font-size:13px"></div>
    <div class="grid2"><div><label class="f" for="hm">현재가 직접 입력 <span class="hcur"></span></label><input id="hm" type="number" inputmode="decimal" step="any" value="${h&&h.manualPrice?h.manualPrice:""}" placeholder="자동이면 비워 두기"></div>
    <div><label class="f" for="hf">지급 주기</label><select id="hf">${["주배당","월배당","분기배당"].map(f=>`<option ${h&&h.freq===f?"selected":""}>${f}</option>`).join("")}</select></div></div>
    <label class="f" for="hp">지급 요일 (선택)</label><input id="hp" value="${esc(h?h.payday||"":"")}" placeholder="예: 금요일">
    <div class="btnrow" style="margin-top:14px">${h?`<button class="danger" id="hdel">삭제</button>`:""}<button class="ghost" id="hcx">취소</button><button class="primary" id="hsv">저장</button></div>`, ()=>{
      const r4=(n,d)=>Math.round(n*10**d)/10**d, mine=["#hs","#hau","#hak","#haw"];
      const drawLots=()=>{ const us=cur!=="KRW"; $("#ltfw").hidden=!us;
        $("#hlots").innerHTML=[...lots].sort((a,c)=>a.date.localeCompare(c.date)).map(l=>`<div class="lrow" style="padding:8px 0"><div><div class="t">${l.date}</div><div class="s num">${qty(l.shares)}주 × ${us?"$"+fmtPs(l.price):won(l.price)}${us&&+l.fx?` · 환율 ${(+l.fx).toLocaleString()}원`:""}</div></div><button type="button" class="small ghost" data-ld="${l.id}">삭제</button></div>`).join("");
        const d=derive(), on=lots.length>0; mine.forEach(i=>$(i).readOnly=on);
        if(on){ $("#hs").value=r4(d.sh,6); if(us){ $("#hau").value=r4(d.avg,4); $("#hak").value=d.avgK?r4(d.avgK,2):""; } else $("#haw").value=r4(d.avg,2); } };
      $("#hlots").onclick=ev=>{ const b=ev.target.closest("[data-ld]"); if(b){ lots=lots.filter(l=>l.id!==b.dataset.ld); drawLots(); upd(); } };
      $("#ladd").onclick=()=>{ const d=$("#ltd").value, s=+$("#lts").value, p=+$("#ltp").value, f=+$("#ltf").value||0;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!(s>0)||!(p>0)){ toast("매수일·수량·가격을 입력해 주세요"); return; }
        lots.push({id:uid(),date:d,shares:s,price:p,fx:cur!=="KRW"?f:0}); $("#lts").value=""; $("#ltp").value=""; $("#ltf").value=""; drawLots(); upd(); };
      const upd=()=>{ const us=cur!=="KRW", fx=S.settings.fx; $("#husd").hidden=!us; $("#hkrw").hidden=us;
        document.querySelectorAll(".hcur").forEach(x=>x.textContent=`(${us?"$":"원"})`);
        const aU=+$("#hau").value||0, aK=+$("#hak").value||0, sh=+$("#hs").value||0, t=$("#ht").value.trim().toUpperCase(), pv=$("#hpv");
        const p = us ? (S.quotes[t]?S.quotes[t].price:(+$("#hm").value||0)) : 0;
        let msg="";
        if(!us){ msg = /^[A-Z][A-Z0-9.\-]{0,6}$/.test(t) ? "국내 종목은 현재가를 직접 넣어야 해요. 미국 주식을 원화로 샀다면 시장은 ‘미국’을 고르고 원화 평단 칸에 넣으세요." : ""; }
        else if(aU&&aK){ const bf=aK/aU; msg=`평균 매수 환율 ${bf.toLocaleString("ko-KR",{maximumFractionDigits:1})}원 · 오늘 ${fx.toLocaleString()}원`;
          if(p) msg+=`<br>수익률 달러 ${pct((p-aU)/aU*100)} · 원화 ${pct((p*fx-aK)/aK*100)}`; }
        else if(aK) msg="달러 평단도 넣으면 환차손익과 달러 기준 수익률을 따로 볼 수 있어요.";
        else if(aU) msg=`원화 평단이 없으면 오늘 환율(${fx.toLocaleString()}원)로 원금을 계산해서 환차손익이 0으로 보여요.`;
        pv.innerHTML=msg; pv.hidden=!msg; };
      $("#hc").onclick=ev=>{ const b=ev.target.closest("button"); if(!b) return; cur=b.dataset.c; lots.forEach(l=>{ if(cur==="KRW") l.fx=0; }); $("#hc").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.c===cur)); drawLots(); upd(); };
      $("#sheet").addEventListener("input",upd); upd();
      $("#hcx").onclick=closeSheet;
      if(h) $("#hdel").onclick=()=>{ if(!confirm("종목을 삭제할까요? 지난 배당 기록은 남아 있어요.")) return; S.holdings=S.holdings.filter(x=>x.id!==h.id); markDeleted(h.id); persist(); closeSheet(); };
      $("#hsv").onclick=()=>{
        const d0=derive(), t=$("#ht").value.trim().toUpperCase(), sh=lots.length?d0.sh:+$("#hs").value;
        if(!t||!(sh>0)){ toast("티커와 수량을 입력해 주세요"); return; }
        const rec={ticker:t,shares:sh,lots,currency:cur,manualPrice:+$("#hm").value||0,freq:$("#hf").value,payday:$("#hp").value.trim(),updated:Date.now(),krwOk:cur==="KRW"};
        if(cur==="KRW"){ Object.assign(rec,{avgCost:lots.length?d0.avg:(+$("#haw").value||0),avgCostKRW:0,buyFx:0,avgCur:"KRW"}); }
        else { const aU=lots.length?d0.avg:(+$("#hau").value||0), aK=lots.length?d0.avgK:(+$("#hak").value||0); Object.assign(rec,{avgCost:aU,avgCostKRW:aK,buyFx:aU&&aK?Math.round(aK/aU*100)/100:0,avgCur:aK&&!aU?"KRW":"USD"}); }
        if(h) Object.assign(h,rec); else S.holdings.push(Object.assign({id:uid()},rec));
        persist(); closeSheet(); tab="hold"; toast("저장했어요"); refreshQuotes(true);
      };
    });
}

// ---------- plan (예상 배당금 PDF) ----------
const PDF_PLAN=[
 ["2026-09",550,"",18,"-8(변동값) · +10(재투자) · 실투자금 평가액 590"],
 ["2026-10",670,"110+10(배당금)",22,"-10(변동값) · +12(재투자)"],
 ["2026-11",812,"130+12(배당금)",27,"-10(변동값) · +17(재투자)"],
 ["2026-12",959,"130+17(배당금)",32,"-20(변동값) · +12(재투자)"],
 ["2027-01",1101,"130+12(배당금)",37,"-20(변동값) · +17(재투자)"],
 ["2027-02",1248,"130+17(배당금)",42,"-20(변동값) · +22(재투자)"],
 ["2027-03",1400,"130+22(배당금)",47,"-20(변동값) · +27(재투자)"],
 ["2027-04",1557,"130+27(배당금)",52,"-20(변동값) · +32(재투자)"],
 ["2027-05",1719,"130+32(배당금)",58,"-20(변동값) · +38(재투자)"],
 ["2027-06",1887,"130+38(배당금)",64,"-20(변동값) · +20(재투자) · +24(QLD)"],
 ["2027-07",2037,"130+20(배당금)",69,"-20(변동값) · +20(재투자) · +29(QLD)"],
 ["2027-08",2187,"130+20(배당금)",74,"-20(변동값) · +20(재투자) · +34(QLD)"],
 ["2027-09",2337,"130+20(배당금)",79,"-20(변동값) · +20(재투자) · +39(QLD)"],
 ["2027-10",2487,"130+20(배당금)",84,"-20(변동값) · +20(재투자) · +44(QLD)"],
 ["2027-11",2637,"130+20(배당금)",89,"-20(변동값) · +20(재투자) · +49(QLD)"],
 ["2027-12",2787,"130+20(배당금)",94,"-20(변동값) · +33(재투자) · +41(QLD 투자)"],
 ["2028-01",2950,"130+33(배당금)",100,"-20(변동값) · +20(재투자) · +60(QLD 투자)"],
 ["2028-02",3110,"140+20(배당금)",105,"-20(변동값) · +30(재투자) · +55(QLD 투자)"],
 ["2028-03",3280,"140+30(배당금)",111,"-20(변동값) · +40(재투자) · +51(QLD 투자)"],
 ["2028-04",3460,"140+40(배당금)",117,"-20(변동값) · +50(재투자) · +47(QLD)"],
 ["2028-05",3660,"150+50(배당금)",124,"-20(변동값) · +60(재투자) · +44(QLD)"],
 ["2028-06",3870,"150+60(배당금)",131,"-20(변동값) · +70(재투자) · +41(QLD)"],
 ["2028-07",4090,"160+70(배당금)",139,"-20(변동값) · +119(재투자)"],
 ["2028-08",4369,"160+119(배당금)",148,"-20(변동값) · +50(재투자) · +49(QLD)"],
 ["2028-09",4569,"150+50(배당금)",155,"FINISH · 포트폴리오 새로 구상"]
];
function loadPdfPlan(seed){
  const now=seed?0:Date.now();
  for(const [ym,principal,invest,expected,memo] of PDF_PLAN){
    const id="plan-"+ym; S.deleted=S.deleted.filter(x=>x!==id);
    const rec={id,ym,principal,invest,expected,memo,updated:now};
    const i=S.plan.findIndex(p=>p.ym===ym); if(i>=0) S.plan[i]=Object.assign(S.plan[i],rec,{id:S.plan[i].id}); else S.plan.push(rec);
  }
  S.settings.planSeeded=true;
}
function planSheet(id){
  const p=id?S.plan.find(x=>x.id===id):null;
  const nextYm=(()=>{ const last=[...S.plan].map(x=>x.ym).sort().pop(); if(!last) return ymOf(new Date().getFullYear(),new Date().getMonth()); const [y,m]=last.split("-").map(Number); return m===12?ymOf(y+1,0):ymOf(y,m); })();
  openSheet(`<h3>${p?ymLabel(p.ym)+" 계획 수정":"월 계획 추가"}</h3><p class="hint">금액 단위는 만원이에요.</p>
    <label class="f" for="pym">월</label><input id="pym" type="month" value="${p?p.ym:nextYm}">
    <div class="grid2"><div><label class="f" for="ppr">원금 (만원)</label><input id="ppr" type="number" inputmode="numeric" value="${p?p.principal:""}"></div>
    <div><label class="f" for="pex">예상 배당 (만원)</label><input id="pex" type="number" inputmode="decimal" step="any" value="${p?p.expected:""}"></div></div>
    <div class="btnrow" style="margin-top:8px"><button class="small ghost" id="pauto">원금 × ${S.settings.baseYield}% × 4로 계산</button></div>
    <div class="calc num" id="prate"></div>
    <label class="f" for="pin">투자 (예: 130+12(배당금))</label><input id="pin" value="${esc(p?p.invest:"")}">
    <label class="f" for="pme">메모 (변동값, 재투자, QLD 등)</label><input id="pme" value="${esc(p?p.memo:"")}">
    <div class="btnrow" style="margin-top:14px">${p?`<button class="danger" id="pdel">삭제</button>`:""}<button class="ghost" id="pcx">취소</button><button class="primary" id="psv">저장</button></div>`, ()=>{
      const updRate=()=>{ const pr=+$("#ppr").value||0, ex=+$("#pex").value||0; $("#prate").textContent = pr>0&&ex>0 ? `계획 주배당률 ${(ex/pr/4*100).toFixed(2)}% (원금 대비 한 주 기준)` : ""; };
      $("#sheet").addEventListener("input",updRate); updRate();
      $("#pauto").onclick=()=>{ const pr=+$("#ppr").value||0; $("#pex").value=Math.floor(pr*S.settings.baseYield/100*4); updRate(); };
      $("#pcx").onclick=closeSheet;
      if(p) $("#pdel").onclick=()=>{ if(!confirm("이 달 계획을 삭제할까요?")) return; S.plan=S.plan.filter(x=>x.id!==p.id); markDeleted(p.id); persist(); closeSheet(); };
      $("#psv").onclick=()=>{
        const ym=$("#pym").value, pr=+$("#ppr").value, ex=+$("#pex").value;
        if(!/^\d{4}-\d{2}$/.test(ym)||!(ex>0)){ toast("월과 예상 배당을 입력해 주세요"); return; }
        const dup=S.plan.find(x=>x.ym===ym && (!p||x.id!==p.id)); if(dup){ toast("이미 그 달 계획이 있어요"); return; }
        const rec={ym,principal:pr||0,expected:ex,invest:$("#pin").value.trim(),memo:$("#pme").value.trim(),updated:Date.now()};
        if(p) Object.assign(p,rec); else S.plan.push(Object.assign({id:"plan-"+ym},rec));
        S.deleted=S.deleted.filter(x=>x!=="plan-"+ym||(p&&p.id===x));
        persist(); closeSheet(); toast("저장했어요");
      };
    });
}

// ---------- files ----------
function saveFile(name,text,type){
  const blob=new Blob([text],{type}), url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000); toast("파일을 저장했어요");
}
function exportCSV(){
  const head=["입금일","주차(월요일)","종목","통화","주당배당","수량","세전","세율(%)","세금","세후","환율","세후(원)","입금일주가","주가대비(%)","연환산(%)","메모"];
  const rows=[...S.entries].sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{ const c=calc(e);
    return [e.date,weekKey(e.date),e.ticker,e.currency,e.perShare,e.shares,c.gross.toFixed(4),e.taxRate,c.tax.toFixed(4),c.net.toFixed(4),e.currency==="KRW"?1:e.fx,Math.round(c.netKRW),e.price||"",c.yield!=null?c.yield.toFixed(3):"",c.yieldAnnual!=null?c.yieldAnnual.toFixed(2):"",e.memo||""]; });
  const csv="\uFEFF"+[head,...rows].map(r=>r.map(v=>{ const s=String(v); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }).join(",")).join("\n");
  saveFile(`배당일지_${todayStr()}.csv`,csv,"text/csv;charset=utf-8");
}
