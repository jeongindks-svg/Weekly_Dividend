"use strict";
// ---------- 클라우드 동기화 (Supabase Auth 구글 로그인 + app_state 표) ----------
// 한 번 구글로 로그인하면 supabase-js 가 세션을 저장하고 토큰을 알아서 갱신해요. 이후에는 따로 로그인할 일이 없어요.
// 표: public.app_state(user_id, data jsonb, updated_at) — 행 단위 보안(RLS)으로 내 행만 읽고 쓸 수 있어요.
const SB_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
const SB_LS = "jb-sb";
const Cloud = {
  sb:null, session:null, busy:false, again:false, timer:null, poll:null, lastSync:0, lastDigest:"", status:"",
  cfg(){ let c={url:SB_CONFIG.url,key:SB_CONFIG.key};
    if(!c.url||!c.key){ try{ const o=JSON.parse(localStorage.getItem(SB_LS)||"null"); if(o&&o.url&&o.key) c=o; }catch(e){} }
    return c.url&&c.key?c:null; },
  configured(){ return !!this.cfg(); },
  fromFile(){ return !!(SB_CONFIG.url&&SB_CONFIG.key); },
  // 키 확인: service_role / secret 키는 거절해요
  checkKey(url,key){
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) return "프로젝트 주소는 https://○○○.supabase.co 형태예요";
    if(/^sb_secret_/.test(key)) return "secret 키는 앱에 넣으면 안 돼요. publishable 키를 넣어 주세요";
    if(/^eyJ/.test(key)){ try{ const p=JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))); if(p.role==="service_role") return "service_role 키는 앱에 넣으면 안 돼요. publishable(anon) 키를 넣어 주세요"; }catch(e){} }
    else if(!/^sb_publishable_/.test(key)) return "publishable(anon) 키가 맞는지 확인해 주세요";
    return "";
  },
  saveCfg(url,key){ try{ localStorage.setItem(SB_LS,JSON.stringify({url:url.replace(/\/$/,""),key})); }catch(e){} this.sb=null; this._p=null; },
  ready(){ return !!this.session; },
  linked(){ return this.configured() && !!(this.session||S.settings.gLinked); },
  loadLib(){
    if(window.supabase&&window.supabase.createClient) return Promise.resolve();
    if(this._p) return this._p;
    this._p=new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=SB_LIB; s.async=true; s.onload=()=>res(); s.onerror=()=>{ this._p=null; rej(new Error("lib")); }; document.head.appendChild(s); });
    return this._p;
  },
  async init(){
    if(this.sb) return true; const c=this.cfg(); if(!c) return false;
    try{ await this.loadLib(); }catch(e){ this.status="err"; this.setChip(); return false; }
    this.sb=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    // 콜백 안에서는 supabase 호출을 기다리지 않아요 (멈춤 방지) — 다음 턴에 동기화
    this.sb.auth.onAuthStateChange((ev,ses)=>{
      this.session=ses||null;
      if(ses){ if(!S.settings.gLinked){ S.settings.gLinked=true; saveLocal(); } if(ev!=="TOKEN_REFRESHED") setTimeout(()=>this.sync(false),0); }
      else if(ev==="SIGNED_OUT"){ S.settings.gLinked=false; saveLocal(); }
      this.setChip(); if(ev==="SIGNED_IN"||ev==="SIGNED_OUT") softRender();
    });
    return true;
  },
  async login(){
    if(!/^https?:/.test(location.protocol)){ toast("웹 주소(https)로 열었을 때 로그인할 수 있어요"); return; }
    if(!(await this.init())){ toast("로그인 모듈을 불러오지 못했어요 (인터넷 확인)"); return; }
    const {error}=await this.sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
    if(error) toast("로그인을 시작하지 못했어요: "+error.message);
  },
  async logout(){
    try{ if(this.sb) await this.sb.auth.signOut(); }catch(e){}
    this.session=null; S.settings.gLinked=false; this.lastSync=0; this.lastDigest=""; saveLocal(); this.setChip(); render();
  },
  email(){ return this.session&&this.session.user?this.session.user.email||"":""; },
  async sync(interactive){
    if(this.busy){ this.again=true; return; }
    if(!this.configured()){ if(interactive) toast("설정에서 Supabase 주소와 키를 먼저 넣어 주세요"); return; }
    if(!online()){ if(interactive) toast("인터넷 연결 후 동기화할 수 있어요"); return; }
    if(!(await this.init())){ if(interactive) toast("로그인 모듈을 불러오지 못했어요 (인터넷 확인)"); return; }
    if(!this.session){ // 저장된 세션 확인 (새로고침 직후)
      try{ const {data}=await this.sb.auth.getSession(); this.session=data&&data.session||null; }catch(e){}
      if(!this.session){ this.status="needs"; this.setChip(); if(interactive) this.login(); return; } }
    this.busy=true; this.setChip("동기화 중…");
    try{
      const uid=this.session.user.id, before=digest(S);
      const {data:row,error}=await this.sb.from("app_state").select("data").eq("user_id",uid).maybeSingle();
      if(error) throw error;
      let added=0, remoteD="";
      if(row&&row.data&&typeof row.data==="object"&&Object.keys(row.data).length){ remoteD=digest(normalize(row.data)); added=mergeIn(row.data); }
      saveLocal();
      const now=digest(S);
      // 내용이 달라졌을 때만 올려요
      if(!row || (now!==remoteD && now!==this.lastDigest)){
        const {error:e2}=await this.sb.from("app_state").upsert({user_id:uid,data:JSON.parse(exportJSON()),updated_at:new Date().toISOString()});
        if(e2) throw e2; }
      this.lastDigest=now; this.lastSync=Date.now(); this.status="ok";
      if(interactive){ toast(added?`동기화 완료 · 새 기록 ${added}건`:"동기화 완료"); render(); }
      else if(now!==before) softRender();
    }catch(e){
      const m=String(e&&(e.code||e.message)||e); this.status="err";
      if(/JWT|401|invalid.*token|refresh/i.test(m)){ this.status="needs"; try{ await this.sb.auth.signOut(); }catch(_){} this.session=null; }
      if(interactive) toast(/42P01|app_state|schema cache|relation/i.test(m)?"Supabase에 app_state 표를 먼저 만들어 주세요 (설정의 안내 참고)":/42501|row-level|permission/i.test(m)?"표 접근 권한(RLS 정책)을 확인해 주세요":`동기화 실패 (${m.slice(0,60)})`);
    }finally{
      this.busy=false; this.setChip();
      if(this.again){ this.again=false; if(this.ready()) this.schedulePush(); }
    }
  },
  schedulePush(){
    this.setChip();
    if(!this.linked()) return;
    clearTimeout(this.timer); this.timer=setTimeout(()=>this.sync(false),20000); // 변경 후 20초 모아서 한 번에 올려요
  },
  startAuto(){
    if(this.poll) return;
    this.poll=setInterval(()=>{ if(document.visibilityState==="visible" && this.ready()) this.sync(false); },3*60000); // 3분마다 다른 기기 변경 확인
  },
  setChip(t){
    const c=$("#syncChip"); if(!c) return;
    if(t){ c.textContent=t; return; }
    if(!this.configured()) c.textContent="이 기기에 저장됨";
    else if(!this.session && !S.settings.gLinked) c.textContent="☁ 구글로 로그인";
    else if(this.status==="err") c.textContent="☁ 동기화 오류 · 눌러서 재시도";
    else if(!this.session && this.status==="needs") c.textContent="☁ 다시 로그인";
    else if(this.lastSync) c.textContent="☁ 동기화됨 "+new Date(this.lastSync).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
    else c.textContent="☁ 동기화 준비 중…";
  }
};
