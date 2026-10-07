"use strict";
// ---------- Google Drive 동기화 ----------
const Drive = {
  token:null, exp:0, fileId:null, client:null, busy:false, again:false, timer:null, poll:null, lastSync:0, lastDigest:"", status:"", noSilentUntil:0, gestureAt:0,
  FILE:"jubaedang.json",
  ready(){ return !!(this.token && Date.now()<this.exp-60000); },
  // 구글 토큰은 1시간짜리라, 새로고침해도 유지되게 저장해 두고 다시 써요 (그래야 새로고침 때 로그인 팝업이 안 떠요)
  restore(){ try{ const o=JSON.parse(localStorage.getItem("jb-gtok")||"null"); if(o&&o.t&&o.exp>Date.now()+60000){ this.token=o.t; this.exp=o.exp; } else localStorage.removeItem("jb-gtok"); }catch(e){} },
  keep(){ try{ if(this.token) localStorage.setItem("jb-gtok",JSON.stringify({t:this.token,exp:this.exp})); else localStorage.removeItem("jb-gtok"); }catch(e){} },
  linked(){ return !!(S.settings.gLinked && S.settings.gClientId); },
  loadGIS(){
    if(window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if(this._p) return this._p;
    this._p = new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://accounts.google.com/gsi/client"; s.async=true;
      s.onload=()=>res(); s.onerror=()=>{ this._p=null; rej(new Error("gis")); }; document.head.appendChild(s); });
    return this._p;
  },
  async auth(silent){
    if(!S.settings.gClientId) throw new Error("noclient");
    if(!(window.google && google.accounts && google.accounts.oauth2)) await this.loadGIS(); // 이미 불러왔으면 바로 진행 (화면을 누른 순간에 로그인 창이 열려야 막히지 않아요)
    return new Promise((res,rej)=>{
      const to=setTimeout(()=>rej(new Error(silent?"silent_timeout":"timeout")), silent?12000:180000);
      const fin=(f,v)=>{ clearTimeout(to); f(v); };
      this.client = google.accounts.oauth2.initTokenClient({
        client_id:S.settings.gClientId.trim(),
        scope:"https://www.googleapis.com/auth/drive.appdata",
        callback:(r)=>{ if(r && r.access_token){ this.token=r.access_token; this.exp=Date.now()+(+r.expires_in||3600)*1000; this.keep(); fin(res); } else fin(rej,new Error(r&&r.error||"auth")); },
        error_callback:(e)=>fin(rej,new Error(e&&e.type||"auth"))
      });
      this.client.requestAccessToken({prompt: silent ? "none" : (S.settings.gLinked ? "" : "consent")});
    });
  },
  async api(url, opts={}){
    const o=Object.assign({},opts); o.headers=Object.assign({Authorization:"Bearer "+this.token},opts.headers||{});
    const r=await fetch(url,o); if(r.status===401){ this.token=null; this.keep(); throw new Error("expired"); }
    if(!r.ok){ let t=""; try{ t=await r.text(); }catch(e){}
      if(r.status===403 && /has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(t)) throw new Error("driveoff");
      if(r.status===403 && /insufficient|scope/i.test(t)) throw new Error("scope");
      throw new Error("HTTP "+r.status); }
    const ct=r.headers.get("content-type")||""; return ct.includes("json")? r.json() : r.text();
  },
  async findFile(){
    if(this.fileId) return this.fileId;
    const q=encodeURIComponent(`name='${this.FILE}'`);
    const j=await this.api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`);
    this.fileId = j.files && j.files[0] ? j.files[0].id : null; return this.fileId;
  },
  payload(){ return exportJSON(); },
  async upload(){
    const body=this.payload();
    if(this.fileId){
      await this.api(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,{method:"PATCH",headers:{"Content-Type":"application/json"},body});
    } else {
      const b="jb"+Date.now(), meta=JSON.stringify({name:this.FILE,parents:["appDataFolder"]});
      const multi=`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
      const j=await this.api(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`,{method:"POST",headers:{"Content-Type":"multipart/related; boundary="+b},body:multi});
      this.fileId=j.id;
    }
  },
  async sync(interactive){
    if(this.busy){ this.again=true; return; }
    if(!online()){ if(interactive) toast("인터넷 연결 후 동기화할 수 있어요"); return; }
    if(!interactive){ if(!this.linked()) return; if(!this.ready() && Date.now()<this.noSilentUntil){ this.status="needs"; this.setChip(); return; } }
    this.busy=true; this.setChip("동기화 중…");
    try{
      if(!this.ready()){
        try{ await this.auth(!interactive); }
        catch(e){ if(interactive) throw e; this.noSilentUntil=Date.now()+10*60000; this.status="needs"; return; }
      } else if(!interactive && this.exp-Date.now()<5*60000 && Date.now()>=this.noSilentUntil){
        // 곧 만료되면 미리 조용히 갱신해요 (실패해도 아직 쓸 수 있는 토큰으로 계속)
        try{ await this.auth(true); }catch(e){ this.noSilentUntil=Date.now()+10*60000; }
      }
      if(!S.settings.gLinked){ S.settings.gLinked=true; }
      const before=digest(S), id=await this.findFile();
      let added=0, remoteD="";
      if(id){ const remote=await this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`); const data=typeof remote==="string"?JSON.parse(remote):remote; remoteD=digest(normalize(data)); added=mergeIn(data); }
      saveLocal();
      const now=digest(S);
      // 내용이 달라졌을 때만 올려요 (1분마다 확인해도 불필요한 업로드가 생기지 않게)
      if(!id || (now!==remoteD && now!==this.lastDigest)) await this.upload();
      this.lastDigest=now; this.lastSync=Date.now(); this.status="ok";
      if(interactive){ toast(added?`동기화 완료 · 새 기록 ${added}건`:"동기화 완료"); render(); }
      else if(now!==before) softRender();
    }catch(e){
      this.status = e.message==="expired" ? "needs" : "err";
      if(interactive){
        const m=e.message;
        toast(m==="noclient"?"설정에서 구글 클라이언트 ID를 먼저 넣어 주세요": m==="gis"?"구글 로그인을 불러오지 못했어요 (인터넷 확인)": m==="popup_closed"||m==="access_denied"?"구글 로그인이 취소됐어요":
          m==="driveoff"?"구글 클라우드에서 Google Drive API를 ‘사용’으로 켜 주세요": m==="scope"?"로그인할 때 드라이브 접근 허용에 체크해 주세요": m==="expired"?"다시 한 번 눌러 로그인해 주세요": m==="popup_failed_to_open"?"팝업이 막혔어요. 브라우저에서 팝업을 허용해 주세요": `동기화 실패 (${m})`);
      }
    }finally{
      this.busy=false; this.setChip();
      if(this.again){ this.again=false; if(this.ready()) this.schedulePush(); }
    }
  },
  schedulePush(){
    this.setChip();
    if(!this.linked()) return;
    clearTimeout(this.timer); this.timer=setTimeout(()=>this.sync(false),2500);
  },
  // 앱이 열려 있는 동안 1분마다 다른 기기의 변경을 가져와요
  startAuto(){
    if(this.poll) return;
    this.poll=setInterval(()=>{ if(document.visibilityState==="visible" && this.linked()) this.sync(false); },60000);
    // 토큰이 만료돼 있으면 화면을 처음 누르는 순간 조용히 다시 로그인해요 (로그인 창은 누른 순간에만 열 수 있어서)
    document.addEventListener("pointerdown",()=>{
      if(this.linked() && !this.busy && (!this.ready() || this.exp-Date.now()<5*60000) && Date.now()-this.gestureAt>20000){ this.gestureAt=Date.now(); this.noSilentUntil=0; this.sync(false); }
    },true);
  },
  setChip(t){
    const c=$("#syncChip"); if(!c) return;
    if(t){ c.textContent=t; return; }
    if(!S.settings.gLinked) c.textContent = "이 기기에 저장됨";
    else if(this.status==="err") c.textContent = "☁ 동기화 오류 · 눌러서 재시도";
    else if(this.ready() && this.lastSync) c.textContent = "☁ 동기화됨 "+new Date(this.lastSync).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
    else c.textContent = "☁ 눌러서 동기화";
  }
};
