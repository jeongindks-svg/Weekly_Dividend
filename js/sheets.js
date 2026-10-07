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
      $("#sheet").addEventListener("input",upd); upd();
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
  const hadLots=lots.length>0, prevFx=h&&+h.buyFx>0?+h.buyFx:0; // 환율을 안 적은 매수는 이 종목의 기존 평균 매수 환율로 계산해요
  const derive=()=>{ const fxOf=l=>+l.fx||prevFx, sh=lots.reduce((a,l)=>a+l.shares,0), cp=lots.reduce((a,l)=>a+lotBase(l),0), allFx=lots.every(l=>fxOf(l)>0), ck=lots.reduce((a,l)=>a+lotBase(l)*fxOf(l),0);
    return {sh, cp, avg:sh?cp/sh:0, avgK:allFx&&sh?ck/sh:0}; };
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
        <div><label class="f" for="ltp">총 매수금액 <span class="hcur"></span></label><input id="ltp" type="number" inputmode="decimal" step="any" placeholder="수량 전체 가격"></div></div>
      <div id="ltfw"><label class="f" for="ltf">매수 환율 (원/$, 선택)</label><input id="ltf" type="number" inputmode="decimal" step="any" placeholder="모르면 비워 두기"></div>
      <div class="btnrow" style="margin-top:8px"><button type="button" class="small" id="ladd">+ 매수 추가</button></div>
      <div class="calc num" id="hlsum" style="margin-top:8px"></div>
      <p class="calc" style="margin:6px 0 0">총 매수금액은 그 수량을 산 전체 가격이에요. 1주 평단은 자동으로 계산돼요. 추가로 산 날짜별로 적으면 그 시점의 원금으로 배당률을 계산해요. 배당으로 재투자해서 산 것도 매수로 적어 주세요.</p></div>
    <div class="preview num" id="hpv" style="font-size:13px"></div>
    <div class="grid2"><div><label class="f" for="hm">현재가 직접 입력 <span class="hcur"></span></label><input id="hm" type="number" inputmode="decimal" step="any" value="${h&&h.manualPrice?h.manualPrice:""}" placeholder="자동이면 비워 두기"></div>
    <div><label class="f" for="hf">지급 주기</label><select id="hf">${["주배당","월배당","분기배당"].map(f=>`<option ${h&&h.freq===f?"selected":""}>${f}</option>`).join("")}</select></div></div>
    <label class="f" for="hp">지급 요일 (선택)</label><input id="hp" value="${esc(h?h.payday||"":"")}" placeholder="예: 금요일">
    <div class="btnrow" style="margin-top:14px">${h?`<button class="danger" id="hdel">삭제</button>`:""}<button class="ghost" id="hcx">취소</button><button class="primary" id="hsv">저장</button></div>`, ()=>{
      const r4=(n,d)=>Math.round(n*10**d)/10**d, mine=["#hs","#hau","#hak","#haw"];
      const drawLots=()=>{ const us=cur!=="KRW"; $("#ltfw").hidden=!us;
        $("#hlots").innerHTML=[...lots].sort((a,c)=>a.date.localeCompare(c.date)).map(l=>`<div class="lrow" style="padding:8px 0"><div><div class="t">${l.date}</div><div class="s num">${qty(l.shares)}주 · 총 ${us?"$"+fmtPs(lotBase(l)):won(lotBase(l))} (1주 ${us?"$"+fmtPs(lotBase(l)/l.shares):won(lotBase(l)/l.shares)})${us&&+l.fx?` · 환율 ${(+l.fx).toLocaleString()}원`:""}</div></div><div style="display:flex;gap:6px"><button type="button" class="small ghost" data-le="${l.id}">수정</button><button type="button" class="small ghost" data-ld="${l.id}">삭제</button></div></div>`).join("");
        const ds=derive(); $("#hlsum").innerHTML=lots.length?`매수 ${lots.length}회 · 합계 ${qty(ds.sh)}주 · 총 ${us?"$"+fmtPs(+ds.cp.toFixed(2)):won(ds.cp)} · 1주 평단 ${us?"$"+fmtPs(+ds.avg.toFixed(4)):won(ds.avg)}<br>저장하면 보유 수량과 평단이 이 기록으로 계산돼요.`:"";
        const d=derive(), on=lots.length>0; mine.forEach(i=>$(i).readOnly=on);
        if(on){ $("#hs").value=r4(d.sh,6); if(us){ $("#hau").value=r4(d.avg,4); $("#hak").value=d.avgK?r4(d.avgK,2):""; } else $("#haw").value=r4(d.avg,2); } };
      $("#hlots").onclick=ev=>{ const b=ev.target.closest("[data-ld]"), e=ev.target.closest("[data-le]");
        if(b){ lots=lots.filter(l=>l.id!==b.dataset.ld); drawLots(); upd(); }
        else if(e){ const l=lots.find(x=>x.id===e.dataset.le); if(!l) return; lots=lots.filter(x=>x!==l);
          $("#ltd").value=l.date; $("#lts").value=l.shares; $("#ltp").value=lotBase(l); $("#ltf").value=+l.fx||""; drawLots(); upd(); toast("위 칸에서 고친 뒤 ‘+ 매수 추가’를 눌러 주세요"); } };
      $("#ladd").onclick=()=>{ const d=$("#ltd").value, s=+$("#lts").value, t=+$("#ltp").value, f=+$("#ltf").value||0;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!(s>0)||!(t>0)){ toast("매수일·수량·총 매수금액을 입력해 주세요"); return; }
        lots.push({id:uid(),date:d,shares:s,total:t,price:t/s,fx:cur!=="KRW"?f:0}); $("#lts").value=""; $("#ltp").value=""; $("#ltf").value=""; drawLots(); upd(); };
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
      $("#sheet").addEventListener("input",upd); drawLots(); upd();
      $("#hcx").onclick=closeSheet;
      if(h) $("#hdel").onclick=()=>{ if(!confirm("종목을 삭제할까요? 지난 배당 기록은 남아 있어요.")) return; S.holdings=S.holdings.filter(x=>x.id!==h.id); markDeleted(h.id); persist(); closeSheet(); };
      $("#hsv").onclick=()=>{
        // 칸에 적어 놓고 ‘+ 매수 추가’를 안 눌렀다면 대신 넣어요
        const pd=$("#ltd").value, ps=+$("#lts").value, pt=+$("#ltp").value;
        if(ps>0&&pt>0&&/^\d{4}-\d{2}-\d{2}$/.test(pd)) $("#ladd").click();
        else if(ps>0||pt>0){ toast("적고 있던 매수 기록이 있어요. 수량과 총 매수금액을 모두 넣고 ‘+ 매수 추가’를 눌러 주세요"); return; }
        const d0=derive(), t=$("#ht").value.trim().toUpperCase(), sh=lots.length?d0.sh:+$("#hs").value;
        if(!t||!(sh>0)){ toast("티커와 수량을 입력해 주세요"); return; }
        if(h&&lots.length&&!hadLots&&Math.abs(d0.sh-h.shares)>1e-6&&!confirm(`매수 기록의 합계는 ${d0.sh}주인데 지금 보유 수량은 ${h.shares}주예요.\n저장하면 보유 수량이 ${d0.sh}주로 바뀌어요. 계속할까요?`)) return;
        const rec={ticker:t,shares:sh,lots,currency:cur,manualPrice:+$("#hm").value||0,freq:$("#hf").value,payday:$("#hp").value.trim(),updated:Date.now(),krwOk:cur==="KRW"};
        if(cur==="KRW"){ Object.assign(rec,{avgCost:lots.length?d0.avg:(+$("#haw").value||0),avgCostKRW:0,buyFx:0,avgCur:"KRW"}); }
        else { const aU=lots.length?d0.avg:(+$("#hau").value||0), aK=lots.length?d0.avgK:(+$("#hak").value||0); Object.assign(rec,{avgCost:aU,avgCostKRW:aK,buyFx:aU&&aK?Math.round(aK/aU*100)/100:0,avgCur:aK&&!aU?"KRW":"USD"}); }
        if(h) Object.assign(h,rec); else S.holdings.push(Object.assign({id:uid()},rec));
        persist(); closeSheet(); tab="hold"; toast("저장했어요"); refreshQuotes(true);
      };
    });
}

// ---------- plan (월별 계획) ----------
const planId=ym=>"plan-"+ym;
function upsertPlan(rec){
  const id=planId(rec.ym); S.deleted=S.deleted.filter(x=>x!==id);
  const i=S.plan.findIndex(p=>p.ym===rec.ym), full=Object.assign({principal:0,invest:"",memo:""},rec,{updated:Date.now()});
  if(i>=0) S.plan[i]=Object.assign(S.plan[i],full,{id:S.plan[i].id}); else S.plan.push(Object.assign({id},full));
}
const autoExpected=pr=>Math.floor(pr*(+S.settings.baseYield||0)/100*4);
function splitCsv(line){ const out=[]; let cur="", q=false;
  for(let i=0;i<line.length;i++){ const ch=line[i];
    if(q){ if(ch==='"'&&line[i+1]==='"'){ cur+='"'; i++; } else if(ch==='"') q=false; else cur+=ch; }
    else if(ch==='"') q=true; else if(ch===","){ out.push(cur); cur=""; } else cur+=ch; }
  out.push(cur); return out; }
// 한 줄 = 월, 원금(만), 투자, 예상 배당(만), 메모  (쉼표·탭 구분, 맨 윗줄 제목은 알아서 건너뛰어요)
function parsePlanText(text){
  const rows=[]; let skipped=0;
  for(const raw of String(text).split(/\r?\n/)){ const line=raw.trim(); if(!line) continue;
    const unq=x=>/^".*"$/.test(x)?x.slice(1,-1).replace(/""/g,'"'):x, c=(line.includes("\t")?line.split("\t").map(unq):splitCsv(line)).map(x=>x.trim());
    const m=c[0].match(/^(\d{2,4})\s*[-./년]\s*(\d{1,2})/);
    if(!m){ if(rows.length||skipped) skipped++; else skipped=0; continue; }
    const y=+m[1]<100?2000+ +m[1]:+m[1], mo=+m[2]; if(mo<1||mo>12){ skipped++; continue; }
    const num=v=>+String(v||"").replace(/[^\d.]/g,"")||0, principal=num(c[1]);
    let expected=num(c[3]); if(!expected&&principal) expected=autoExpected(principal);
    if(!expected){ skipped++; continue; }
    rows.push({ym:ymOf(y,mo-1),principal,invest:c[2]||"",expected,memo:c.slice(4).join(", ")});
  }
  return {rows,skipped};
}
function exportPlanCSV(){
  const q=v=>{ const t=String(v??""); return /[",\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t; };
  const rows=[...S.plan].sort((a,c)=>a.ym.localeCompare(c.ym)).map(p=>[p.ym,p.principal,p.invest||"",p.expected,p.memo||""].map(q).join(","));
  saveFile(`배당계획_${todayStr()}.csv`,"\uFEFF"+["월,원금(만원),투자,예상 배당(만원),메모",...rows].join("\n"),"text/csv;charset=utf-8");
}
function planImportSheet(){
  openSheet(`<h3>계획 불러오기</h3><p class="hint">엑셀·메모에서 복사해 붙여 넣거나 CSV 파일을 고르세요. 한 줄에 한 달, 순서는 <b>월, 원금(만원), 투자, 예상 배당(만원), 메모</b>예요. 예상 배당을 비우면 원금 × 기준 주배당 × 4로 계산해요.</p>
    <textarea id="pit" rows="8" placeholder="2026-10, 670, 110+10, 22, 메모&#10;2026-11, 812, 130+12, 27" style="font-size:14px"></textarea>
    <div class="btnrow" style="margin-top:8px"><button type="button" id="pif">CSV 파일 고르기</button></div><input type="file" id="pifile" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden>
    <div class="calc" id="pipv" style="margin-top:8px"></div>
    <div class="btnrow" style="margin-top:14px"><button class="ghost" id="picx">취소</button><button class="primary" id="pisv">불러오기</button></div>`,()=>{
    const upd=()=>{ const r=parsePlanText($("#pit").value), dup=r.rows.filter(x=>S.plan.some(p=>p.ym===x.ym)).length;
      $("#pipv").textContent=r.rows.length?`${r.rows.length}개월을 읽었어요${dup?` · 이미 있는 ${dup}개월은 덮어써요`:""}${r.skipped?` · ${r.skipped}줄은 건너뛰었어요`:""}`:($("#pit").value.trim()?"읽을 수 있는 줄이 없어요. 월(예: 2026-10)부터 적어 주세요.":""); };
    $("#pit").addEventListener("input",upd);
    $("#pif").onclick=()=>$("#pifile").click();
    $("#pifile").onchange=ev=>{ const f=ev.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ $("#pit").value=String(r.result).replace(/^\uFEFF/,""); upd(); }; r.readAsText(f); };
    $("#picx").onclick=closeSheet;
    $("#pisv").onclick=()=>{ const r=parsePlanText($("#pit").value); if(!r.rows.length){ toast("읽을 수 있는 줄이 없어요"); return; }
      r.rows.forEach(upsertPlan); persist(); closeSheet(); toast(`${r.rows.length}개월 계획을 불러왔어요`); };
  });
}
function planGenSheet(){
  const now=new Date(), last=[...S.plan].sort((a,c)=>a.ym.localeCompare(c.ym)).pop(), pn=principalNow();
  const startYm=last?(()=>{ const [y,m]=last.ym.split("-").map(Number); return m===12?ymOf(y+1,0):ymOf(y,m); })():ymOf(now.getFullYear(),now.getMonth());
  const pr0=last?last.principal:(pn.v>0?Math.round(pn.v/10000):"");
  openSheet(`<h3>계획 자동으로 만들기</h3><p class="hint">시작 원금과 매달 넣을 돈만 정하면 월별 계획을 만들어요. 금액은 만원이에요.</p>
    <div class="grid2"><div><label class="f" for="gym">시작 월</label><input id="gym" type="month" value="${startYm}"></div>
    <div><label class="f" for="gn">개월 수</label><input id="gn" type="number" inputmode="numeric" value="12" min="1" max="60"></div></div>
    <div class="grid2"><div><label class="f" for="gpr">시작 원금</label><input id="gpr" type="number" inputmode="decimal" step="any" value="${pr0}"></div>
    <div><label class="f" for="gin">매달 추가 투자</label><input id="gin" type="number" inputmode="decimal" step="any" value="0"></div></div>
    <div class="grid2"><div><label class="f" for="gy">기준 주배당 (%)</label><input id="gy" type="number" inputmode="decimal" step="0.01" value="${S.settings.baseYield}"></div>
    <div><label class="f" for="gre">배당 재투자 비율 (%)</label><input id="gre" type="number" inputmode="decimal" step="1" min="0" max="100" value="${S.settings.reinvestPct}"></div></div>
    <div class="preview num" id="gpv" style="font-size:13px"></div>
    <div class="btnrow" style="margin-top:14px"><button class="ghost" id="gcx">취소</button><button class="primary" id="gsv">만들기</button></div>`,()=>{
    const rows=()=>{ const ym0=$("#gym").value, n=Math.min(60,Math.max(1,+$("#gn").value||0)), inv=+$("#gin").value||0, y=+$("#gy").value||0, re=Math.min(100,Math.max(0,+$("#gre").value||0))/100;
      let pr=+$("#gpr").value||0; if(!/^\d{4}-\d{2}$/.test(ym0)||!(pr>0)||!(y>0)) return [];
      let [yy,mm]=ym0.split("-").map(Number); mm--; const out=[]; let prevEx=0;
      for(let i=0;i<n;i++){ const ex=Math.floor(pr*y/100*4), add=inv+(i?prevEx*re:0);
        out.push({ym:ymOf(yy,mm),principal:Math.round(pr),expected:ex,invest:i?(inv?`${inv}`:"")+(prevEx*re>0?`${inv?"+":""}${Math.round(prevEx*re)}(배당금)`:""):(inv?`${inv}`:""),memo:""});
        pr+=add; prevEx=ex; if(++mm>11){ mm=0; yy++; } }
      return out; };
    const upd=()=>{ const r=rows(), dup=r.filter(x=>S.plan.some(p=>p.ym===x.ym)).length, pv=$("#gpv");
      pv.innerHTML=r.length?`${ymLabel(r[0].ym)} 원금 ${r[0].principal.toLocaleString()}만 → 예상 ${r[0].expected}만<br>${ymLabel(r[r.length-1].ym)} 원금 ${r[r.length-1].principal.toLocaleString()}만 → 예상 ${r[r.length-1].expected}만${dup?`<br>이미 있는 ${dup}개월은 덮어써요`:""}`:"시작 월·시작 원금·기준 주배당을 넣어 주세요"; };
    $("#sheet").addEventListener("input",upd); upd();
    $("#gcx").onclick=closeSheet;
    $("#gsv").onclick=()=>{ const r=rows(); if(!r.length){ toast("시작 월·시작 원금·기준 주배당을 넣어 주세요"); return; }
      const y=+$("#gy").value; if(y!==+S.settings.baseYield){ S.settings.baseYield=y; touchSettings(); }
      r.forEach(upsertPlan); persist(); closeSheet(); toast(`${r.length}개월 계획을 만들었어요`); };
  });
}
function planSheet(id){
  const p=id?S.plan.find(x=>x.id===id):null;
  const nextYm=(()=>{ const last=[...S.plan].map(x=>x.ym).sort().pop(); if(!last) return ymOf(new Date().getFullYear(),new Date().getMonth()); const [y,m]=last.split("-").map(Number); return m===12?ymOf(y+1,0):ymOf(y,m); })();
  const lastP=[...S.plan].sort((a,c)=>a.ym.localeCompare(c.ym)).pop(), prevPr=lastP?lastP.principal:(principalNow().v>0?Math.round(principalNow().v/10000):"");
  openSheet(`<h3>${p?ymLabel(p.ym)+" 계획 수정":"월 계획 추가"}</h3><p class="hint">금액 단위는 만원이에요.${p?"":" 직전 달 원금으로 미리 채워 뒀어요."}</p>
    <label class="f" for="pym">월</label><input id="pym" type="month" value="${p?p.ym:nextYm}">
    <div class="grid2"><div><label class="f" for="ppr">원금 (만원)</label><input id="ppr" type="number" inputmode="numeric" value="${p?p.principal:prevPr}"></div>
    <div><label class="f" for="pex">예상 배당 (만원)</label><input id="pex" type="number" inputmode="decimal" step="any" value="${p?p.expected:(prevPr?autoExpected(prevPr):"")}"></div></div>
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
