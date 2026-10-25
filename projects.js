(function () {
  "use strict";
  const KEY = "myspace.project-lab.v1";
  const MAIN_KEY = "myspace.dashboard.v1";
  const TYPE_NAMES = { web: "웹페이지", simulation: "시뮬레이션", github: "GitHub", drive: "Google Drive", chatgpt: "ChatGPT", other: "기타 자료" };
  const CATEGORY_NAMES = { robotics: "로봇", mechanical: "기구설계", simulation: "시뮬레이션", web: "웹 · 데이터", other: "기타" };
  const defaults = () => [
    { id:"f1", name:"F1 Dashboard", category:"web", summary:"F1 경기 결과, 드라이버와 컨스트럭터 순위를 살펴보는 대시보드", notes:"API 갱신과 데이터 수집 상태 점검", links:[{type:"github",label:"GitHub 저장소",url:"https://github.com/hsh3167/f1-dashboard"}] },
    { id:"lifting", name:"리프팅 모듈", category:"mechanical", summary:"리프팅 구조 설계, 부품 선정 및 구동 시뮬레이션", notes:"모터 토크, 하중, 속도와 제작 원가 검토", links:[{type:"github",label:"GitHub 저장소",url:"https://github.com/hsh3167/lifting-module-new-carti-"}] },
    { id:"cruze", name:"Cruze Mechanical Lab", category:"mechanical", summary:"크루즈 차량 모델링과 내부 기계 부품 시각화", notes:"형상 완성도와 부품 정확도 보강", links:[{type:"github",label:"GitHub 저장소",url:"https://github.com/hsh3167/cruze-mechanical-lab"}] },
    { id:"myspace", name:"My Space 대시보드", category:"web", summary:"개인·업무·자산·프로젝트를 모은 맞춤형 대시보드", notes:"개인 프로젝트 허브 기능 확대", links:[{type:"web",label:"배포된 웹페이지",url:"https://hsh3167.github.io/my-space-dashboard/"},{type:"github",label:"GitHub 저장소",url:"https://github.com/hsh3167/my-space-dashboard"}] },
    { id:"robot-arm", name:"로봇 암 설계", category:"robotics", summary:"로봇 암 구조·관절 구동·설계 자료 모음", notes:"설계 자료와 구현 결과 링크 추가 예정", links:[] },
    { id:"amr-sim", name:"AMR 동역학 시뮬레이션", category:"simulation", summary:"모바일 로봇 구동·단차·마찰·회전 동역학 실험", notes:"시뮬레이터 실행 주소 또는 자료 폴더 연결 예정", links:[] }
  ];
  const el = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
  const safe = value => {
    try {
      const u = new URL(String(value).trim());
      return u.protocol === "https:" || (u.protocol === "http:" && ["localhost","127.0.0.1"].includes(u.hostname));
    } catch { return false; }
  };
  const clean = raw => {
    if (!raw || typeof raw !== "object" || typeof raw.name !== "string") return null;
    return {
      id: typeof raw.id === "string" ? raw.id.slice(0,90) : "p-"+Date.now(),
      name: raw.name.trim().slice(0,80),
      category: Object.hasOwn(CATEGORY_NAMES,raw.category) ? raw.category : "other",
      summary: String(raw.summary || "").slice(0,400),
      notes: String(raw.notes || "").slice(0,3000),
      links: Array.isArray(raw.links) ? raw.links.slice(0,20).filter(x => x && safe(x.url)).map(x => ({
        type:Object.hasOwn(TYPE_NAMES,x.type) ? x.type : "other",
        label:String(x.label || TYPE_NAMES[x.type] || "자료").slice(0,75),
        url:String(x.url).trim().slice(0,1500)
      })) : []
    };
  };
  function initial() {
    const base = defaults();
    try {
      const legacy = JSON.parse(localStorage.getItem(MAIN_KEY) || "{}");
      const saved = Array.isArray(legacy.office) ? legacy.office : [];
      for (const row of saved) {
        if (!row || !safe(row.url) || typeof row.name !== "string") continue;
        base.push({id:"legacy-"+String(row.id || base.length).slice(0,70),name:row.name.slice(0,80),category:"other",summary:"기존 AI 사무실 링크에서 가져온 프로젝트",notes:"",links:[{type:"web",label:"기존 링크",url:row.url}]});
      }
    } catch { /* Default projects remain available. */ }
    return base;
  }
  function read() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed.slice(0,100).map(clean).filter(x => x && x.name);
      }
    } catch { /* Fall back to the starter collection. */ }
    return initial();
  }
  let items = read(), selected = null, editing = null, filter = "all";
  let cloud = null, ready = false, busy = false, cloudPromise = null, cloudMessage = "";
  const authDialog = document.createElement("dialog");
  authDialog.id = "lab-auth"; authDialog.className = "lab-dialog";
  document.body.append(authDialog);
  const hasSession = () => ready && cloud?.state === "authorized";
  const isSeed = id => defaults().some(p => p.id === id);
  const same = (a,b) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));
  async function ensureCloud() {
    if (cloud) return cloud;
    if (!cloudPromise) cloudPromise = Promise.all([
      import("./assets/project-cloud.mjs"), import("./assets/public-config.mjs")
    ]).then(([module,config]) => {
      let connection = config.default;
      try {
        const saved = localStorage.getItem("myspace.assets.public-config.v1");
        if (saved) connection = JSON.parse(saved);
      } catch { /* Invalid saved config will be rejected by the shared validator. */ }
      cloud = new module.ProjectCloud(connection);
      cloud.subscribe(state => {
        if (state === "locked") {
          ready = false; items = defaults();
          if (editDialog.open) editDialog.close();
          if (detailDialog.open) detailDialog.close();
          refresh();
        }
      });
      return cloud;
    }).catch(err => { cloudPromise = null; throw err; });
    return await cloudPromise;
  }
  // First successful login migrates locally saved projects without replacing newer
  // cloud records. Only confirmed uploads remove the old localStorage data.
  async function migrate() {
    const remote = (await cloud.list()).map(clean).filter(Boolean);
    const remoteById = new Map(remote.map(p => [p.id,p]));
    const staged = read();
    const legacyPresent = localStorage.getItem(KEY) !== null;
    const tasks = [];
    for (const p of staged) {
      const existing = remoteById.get(p.id), seed = defaults().find(x => x.id === p.id);
      if (!existing) {
        // Do not resurrect defaults deleted on another device.
        if (!seed || (legacyPresent && !same(p,seed))) tasks.push({type:"create",p});
      } else if (legacyPresent && seed && !same(p,seed) && same(existing,seed)) {
        // Preserve customized local starter projects if the cloud is still pristine.
        tasks.push({type:"update",p});
      }
    }
    for (const job of tasks) {
      await (job.type === "create" ? cloud.create(job.p) : cloud.update(job.p));
    }
    const synced = (await cloud.list()).map(clean).filter(Boolean);
    if (legacyPresent) localStorage.removeItem(KEY);
    return synced;
  }
  function promptLogin() {
    if (authDialog.open) return;
    authDialog.innerHTML = '<form id="lab-login-form"><div class="lab-dialog-top"><span class="lab-overline">PRIVATE PROJECT SYNC</span><button class="lab-x" type="button" data-project-action="close-auth" aria-label="닫기">×</button></div>' +
      '<h2>개인 프로젝트 로그인</h2><p class="lab-muted">자산관리와 같은 본인 계정으로 로그인하세요. 등록한 프로젝트·링크·메모를 모든 PC에서 동기화합니다. 로그인 후 20분이 지나면 자동 로그아웃됩니다.</p>' +
      '<label>이메일<input name="email" type="email" autocomplete="username" required></label>' +
      '<label>비밀번호<input name="password" type="password" autocomplete="current-password" required></label>' +
      '<p role="alert" class="lab-error" id="lab-auth-error"></p><div class="lab-dialog-actions"><button type="button" class="lab-secondary" data-project-action="close-auth">취소</button><button type="submit" class="lab-add">로그인 및 동기화</button></div></form>';
    authDialog.showModal();
  }
  async function login(event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const form = event.target, button = form.querySelector('[type="submit"]');
    button.disabled = true; form.querySelector('#lab-auth-error').textContent = "";
    const email=form.elements.email.value,password=form.elements.password.value;
    form.elements.password.value = "";
    try {
      const client = await ensureCloud();
      await client.login(email,password);
      items = await migrate();
      ready = true; cloudMessage = "Supabase 동기화 완료";
      if (authDialog.open) authDialog.close();
      refresh();
    } catch(e) {
      cloudMessage = "동기화 실패";
      form.querySelector('#lab-auth-error').textContent = e.message || "로그인 또는 동기화를 완료하지 못했습니다.";
      if (cloud?.state === "authorized") cloud.lock();
    } finally { busy = false; button.disabled = false; refresh(); }
  }
  async function reloadCloud() {
    if (!hasSession() || busy) return;
    busy = true;
    try { items = (await cloud.list()).map(clean).filter(Boolean); cloudMessage = "Supabase 최신 데이터"; }
    catch(e) {cloudMessage="새로고침 실패: "+e.message;}
    finally {busy=false;refresh();}
  }
  const byId = id => items.find(p => p.id === id);
  const jump = item => item.links.find(l => l.type === "simulation" || l.type === "web");
  function anchor(link, className, title) {
    return '<a class="'+className+'" href="'+el(link.url)+'" target="_blank" rel="noopener noreferrer">'+el(title || link.label)+' <span aria-hidden="true">↗</span></a>';
  }
  function card(item) {
    const live = jump(item), category = CATEGORY_NAMES[item.category];
    const icon = {robotics:"♧",mechanical:"⚙",simulation:"⌁",web:"▦",other:"✧"}[item.category];
    return '<article class="lab-card"><div class="lab-card-top"><span class="lab-card-icon" aria-hidden="true">'+icon+'</span><span class="lab-kind">'+el(category)+'</span></div>'+
      '<div class="lab-card-copy"><h3>'+el(item.name)+'</h3><p>'+el(item.summary || "설명을 추가해 주세요.")+'</p></div>'+
      '<div class="lab-card-footer"><button type="button" class="lab-secondary" data-project-action="detail" data-project-id="'+el(item.id)+'">상세보기</button>'+
      (live ? anchor(live,"lab-launch","실행 / 웹페이지") : '<button type="button" class="lab-launch missing" data-project-action="edit" data-project-id="'+el(item.id)+'">+ 실행 링크 등록</button>')+
      '</div></article>';
  }
  function render(search) {
    const q = String(search || "").trim().toLocaleLowerCase();
    const display = items.filter(p => (filter === "all" || p.category === filter) &&
      (!q || [p.name,p.category,p.summary,p.notes,...p.links.map(l => l.label+" "+l.url)].join(" ").toLocaleLowerCase().includes(q)));
    const chips = Object.entries({all:"전체",...CATEGORY_NAMES}).map(([key,name]) => '<button type="button" class="lab-chip'+(filter===key?" active":"")+'" data-project-action="filter" data-project-filter="'+key+'" aria-pressed="'+(filter===key)+'">'+el(name)+'</button>').join("");
    const signedIn=hasSession();
    const authBar='<div class="lab-sync"><div><strong>'+ (signedIn ? "● Supabase 동기화 중" : "○ 클라우드 로그인 필요") + '</strong><p>'+ (signedIn ? "본인 계정에 프로젝트 정보가 저장됩니다. 로그인 후 20분 자동 로그아웃됩니다." : "다른 PC에서도 동일한 프로젝트를 보려면 본인 계정으로 로그인하세요. 수정·추가도 로그인 후 가능합니다.") + '</p></div><div class="lab-sync-actions">'+
      (signedIn ? '<button class="lab-secondary" type="button" data-project-action="refresh-cloud">동기화</button><button class="lab-secondary" type="button" data-project-action="logout">로그아웃</button>' : '<button class="lab-add" type="button" data-project-action="login">Supabase 로그인</button>')+'</div></div>';
    return '<div class="lab-board">'+authBar+'<div class="lab-intro"><div><span class="lab-overline">PERSONAL DEVELOPMENT LAB</span><h2>내가 만든 프로젝트를 한곳에.</h2><p>GitHub · Google Drive · ChatGPT · 웹 시뮬레이터를 프로젝트 단위로 관리합니다.</p></div><button type="button" class="lab-add" data-project-action="add">+ 프로젝트 추가</button></div>'+
      '<div class="lab-stats"><span><b>'+items.length+'</b> 전체 프로젝트</span><span><b>'+items.filter(p=>p.links.some(l=>l.type==="github")).length+'</b> GitHub 연결</span><span><b>'+items.filter(p=>jump(p)).length+'</b> 실행 링크</span></div>'+
      '<div class="lab-chips" aria-label="프로젝트 분류">'+chips+'</div>'+
      '<div class="lab-grid">'+(display.map(card).join("") || '<p class="lab-empty">일치하는 프로젝트가 없습니다. 검색어 또는 분류를 변경해 보세요.</p>')+'</div>'+
      '<p class="lab-privacy">로그인 시 개인 프로젝트의 이름·주소·메모가 본인 전용 Supabase에 저장됩니다. 로그인 세션과 비밀번호는 브라우저 저장소에 보관되지 않습니다. 회사 기밀이나 비밀번호를 입력하지 마세요.</p></div>';
  }
  const detailDialog = document.createElement("dialog"); detailDialog.id = "lab-detail"; detailDialog.className = "lab-dialog";
  const editDialog = document.createElement("dialog"); editDialog.id = "lab-editor"; editDialog.className = "lab-dialog";
  document.body.append(detailDialog,editDialog);
  function detail(id) {
    const p = byId(id); if (!p) return;
    selected = id; const live = jump(p);
    const list = p.links.map(l => '<div class="lab-resource"><span><strong>'+el(l.label)+'</strong><small>'+el(TYPE_NAMES[l.type])+'</small></span>'+anchor(l,"lab-resource-link","열기")+'</div>').join("");
    detailDialog.innerHTML = '<div class="lab-dialog-top"><span class="lab-overline">'+el(CATEGORY_NAMES[p.category])+' / PROJECT DETAIL</span><button type="button" class="lab-x" data-project-action="close-detail" aria-label="닫기">×</button></div>'+
      '<h2>'+el(p.name)+'</h2><p class="lab-desc">'+el(p.summary)+'</p>'+
      (live ? '<div class="lab-primary-row">'+anchor(live,"lab-launch","웹페이지 / 시뮬레이션 실행")+'</div>' : '<div class="lab-primary-row"><button type="button" class="lab-launch missing" data-project-action="edit" data-project-id="'+el(p.id)+'">+ 웹페이지 / 시뮬레이션 링크 등록</button></div>')+
      '<h3>관련 자료</h3>'+(list || '<p class="lab-muted">등록한 자료 링크가 없습니다.</p>')+
      '<h3>작업 메모</h3><p class="lab-notes">'+el(p.notes || "메모가 없습니다.")+'</p>'+
      '<div class="lab-dialog-actions"><button type="button" class="lab-secondary" data-project-action="close-detail">닫기</button><button type="button" class="lab-add" data-project-action="edit" data-project-id="'+el(p.id)+'">프로젝트 수정</button></div>';
    if (!detailDialog.open) detailDialog.showModal();
  }
  function linkRow(l={type:"github",label:"",url:""}) {
    const opts = Object.entries(TYPE_NAMES).map(([type,name])=>'<option value="'+type+'"'+(l.type===type?" selected":"")+'>'+el(name)+'</option>').join("");
    return '<div class="lab-link-row"><select class="lab-type" aria-label="링크 유형">'+opts+'</select><input class="lab-label" maxlength="75" placeholder="버튼 이름" value="'+el(l.label)+'"><input class="lab-url" type="url" maxlength="1500" placeholder="https://..." value="'+el(l.url)+'"><button type="button" class="lab-remove" data-project-action="remove-link" aria-label="링크 삭제">×</button></div>';
  }
  function edit(id) {
    if (!hasSession()) {promptLogin();return;}
    editing = id || null; const p = byId(id) || {name:"",category:"mechanical",summary:"",notes:"",links:[]};
    if (detailDialog.open) detailDialog.close();
    const categories=Object.entries(CATEGORY_NAMES).map(([key,name])=>'<option value="'+key+'"'+(key===p.category?" selected":"")+'>'+el(name)+'</option>').join("");
    editDialog.innerHTML = '<form id="lab-form"><div class="lab-dialog-top"><span class="lab-overline">PROJECT EDITOR</span><button type="button" class="lab-x" data-project-action="close-edit" aria-label="닫기">×</button></div>'+
      '<h2>'+(editing?"프로젝트 수정":"새 프로젝트")+'</h2>'+
      '<label>프로젝트 이름<input name="name" maxlength="80" required value="'+el(p.name)+'"></label>'+
      '<label>카테고리<select name="category">'+categories+'</select></label>'+
      '<label>프로젝트 설명<textarea name="summary" rows="2" maxlength="400">'+el(p.summary)+'</textarea></label>'+
      '<label>작업 메모<textarea name="notes" rows="4" maxlength="3000">'+el(p.notes)+'</textarea></label>'+
      '<div class="lab-link-title"><strong>관련 자료 및 실행 링크</strong><button type="button" class="lab-secondary" data-project-action="add-link">+ 링크 추가</button></div>'+
      '<p class="lab-muted">웹페이지 또는 시뮬레이션 유형을 선택하면 카드에 실행 버튼이 표시됩니다.</p>'+
      '<div id="lab-link-rows">'+(p.links.length?p.links.map(linkRow).join(""):linkRow({type:"web",label:"",url:""}))+'</div>'+
      '<p id="lab-form-error" role="alert" class="lab-error"></p>'+
      '<div class="lab-dialog-actions">'+(editing?'<button type="button" class="lab-delete" data-project-action="delete" data-project-id="'+el(editing)+'">삭제</button>':"")+
      '<button type="button" class="lab-secondary" data-project-action="close-edit">취소</button><button type="submit" class="lab-add">저장</button></div></form>';
    editDialog.showModal();
    editDialog.querySelector('[name="name"]').focus();
  }
  function closeEdit() { if(editDialog.open) editDialog.close(); }
  async function save(event) {
    event.preventDefault(); const form=event.target; if (form.id!=="lab-form") return;
    const name=form.elements.name.value.trim(), category=form.elements.category.value;
    if (!name) return;
    const links=[]; let error="";
    for (const row of form.querySelectorAll(".lab-link-row")) {
      const url=row.querySelector(".lab-url").value.trim(), label=row.querySelector(".lab-label").value.trim(), type=row.querySelector(".lab-type").value;
      if (!url && !label) continue;
      if (!url || !safe(url)) {error="올바른 HTTPS 링크를 입력하세요. 로컬 시뮬레이터에 한해 http://localhost 주소를 허용합니다.";break;}
      links.push({type,label:label||TYPE_NAMES[type],url});
    }
    if (links.length>20) error="자료 링크는 최대 20개까지 등록할 수 있습니다.";
    if (error) {form.querySelector("#lab-form-error").textContent=error;return;}
    if (!hasSession() || busy) {form.querySelector("#lab-form-error").textContent="로그인이 필요합니다.";return;}
    const id=editing || "project-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
    const record=clean({id,name,category,summary:form.elements.summary.value,notes:form.elements.notes.value,links});
    busy=true; const button=form.querySelector('[type="submit"]');button.disabled=true;
    try {
      await (editing ? cloud.update(record) : cloud.create(record));
      items = (await cloud.list()).map(clean).filter(Boolean);
      closeEdit();selected=id;refresh();detail(id);
    } catch(e) {form.querySelector("#lab-form-error").textContent="저장 실패: "+e.message;}
    finally {busy=false;button.disabled=false;refresh();}
  }
  function refresh() { if(typeof window.mySpaceRerender==="function") window.mySpaceRerender(); }
  document.addEventListener("click",event=>{
    const btn=event.target.closest("[data-project-action]"); if (!btn) return;
    const action=btn.dataset.projectAction, id=btn.dataset.projectId;
    if (action==="filter") {filter=btn.dataset.projectFilter;refresh();}
    else if (action==="detail") detail(id);
    else if (action==="edit") edit(id);
    else if (action==="add") edit(null);
    else if (action==="login") promptLogin();
    else if (action==="close-auth") authDialog.close();
    else if (action==="logout") {ready=false;items=defaults();void cloud?.logout();refresh();}
    else if (action==="refresh-cloud") void reloadCloud();
    else if (action==="close-detail") detailDialog.close();
    else if (action==="close-edit") closeEdit();
    else if (action==="add-link") {const rows=editDialog.querySelector("#lab-link-rows");if(rows.children.length<20)rows.insertAdjacentHTML("beforeend",linkRow({type:"web"}));}
    else if (action==="remove-link") btn.closest(".lab-link-row").remove();
    else if (action==="delete") {
      if (!hasSession()) {promptLogin();return;}
      if (window.confirm("Supabase의 프로젝트와 연결된 메모·링크를 삭제하시겠습니까?")) {
        void (async()=>{if(busy)return;busy=true;try {
          await cloud.remove(id);
          items=items.filter(p=>p.id!==id);closeEdit();refresh();
        }catch(e){editDialog.querySelector("#lab-form-error").textContent="삭제 실패: "+e.message;}
        finally{busy=false;refresh();}})();
      }
    }
  });
  editDialog.addEventListener("submit",save);
  authDialog.addEventListener("submit",event=>{if(event.target.id==="lab-login-form")void login(event);});
  window.ProjectHub={
    render,
    count:()=>items.length,
    add:()=>edit(null),
    exportData:()=>items.map(clean),
    importData:async raw=>{
      if(!Array.isArray(raw))return;
      const incoming=raw.slice(0,100).map(clean).filter(x=>x&&x.name);
      if(!hasSession()) {
        // Legacy backup can be migrated at the next login, but not silently marked cloud-saved.
        localStorage.setItem(KEY,JSON.stringify(incoming));
        cloudMessage="프로젝트 백업을 이 브라우저에 임시로 보관했습니다. Supabase 로그인 후 동기화됩니다.";
        window.alert(cloudMessage);
        return;
      }
      if(busy)throw Error("동기화 중입니다.");
      busy=true;
      try {
        const currentIds=new Set(items.map(p=>p.id));
        for(const p of incoming) await (currentIds.has(p.id)?cloud.update(p):cloud.create(p));
        items=(await cloud.list()).map(clean).filter(Boolean);
        refresh();
      }finally{busy=false;}
    },
    reset:()=>{
      // Global link reset must never silently delete synchronized projects.
      localStorage.removeItem(KEY);
      if(!hasSession()){items=defaults();refresh();}
    },
    signedIn:hasSession
  };
})();
