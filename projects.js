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
  let items = read(), selected = null, editing = null, filter = "all", feedback = null;
  function persist() {
    try { localStorage.setItem(KEY,JSON.stringify(items)); return true; }
    catch { window.alert("저장할 수 없습니다. 이 브라우저의 저장 공간을 확인하세요."); return false; }
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
    return '<div class="lab-board"><div class="lab-intro"><div><span class="lab-overline">PERSONAL DEVELOPMENT LAB</span><h2>내가 만든 프로젝트를 한곳에.</h2><p>GitHub · Google Drive · ChatGPT · 웹 시뮬레이터를 프로젝트 단위로 관리합니다.</p></div><button type="button" class="lab-add" data-project-action="add">+ 프로젝트 추가</button></div>'+
      '<div class="lab-stats"><span><b>'+items.length+'</b> 전체 프로젝트</span><span><b>'+items.filter(p=>p.links.some(l=>l.type==="github")).length+'</b> GitHub 연결</span><span><b>'+items.filter(p=>jump(p)).length+'</b> 실행 링크</span></div>'+
      '<div class="lab-chips" aria-label="프로젝트 분류">'+chips+'</div>'+
      '<div class="lab-grid">'+(display.map(card).join("") || '<p class="lab-empty">일치하는 프로젝트가 없습니다. 검색어 또는 분류를 변경해 보세요.</p>')+'</div>'+
      '<p class="lab-privacy">프로젝트 메모와 링크는 이 브라우저에 저장됩니다. 민감한 회사 자료나 접근용 비밀번호를 등록하지 마세요.</p></div>';
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
  function save(event) {
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
    const previous = items.slice(), id=editing || "project-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
    const record=clean({id,name,category,summary:form.elements.summary.value,notes:form.elements.notes.value,links});
    if (editing) items=items.map(p=>p.id===id?record:p); else items.push(record);
    if (!persist()) {items=previous;return;}
    closeEdit(); selected=id; refresh();detail(id);
  }
  function refresh() { if(typeof window.mySpaceRerender==="function") window.mySpaceRerender(); }
  document.addEventListener("click",event=>{
    const btn=event.target.closest("[data-project-action]"); if (!btn) return;
    const action=btn.dataset.projectAction, id=btn.dataset.projectId;
    if (action==="filter") {filter=btn.dataset.projectFilter;refresh();}
    else if (action==="detail") detail(id);
    else if (action==="edit") edit(id);
    else if (action==="add") edit(null);
    else if (action==="close-detail") detailDialog.close();
    else if (action==="close-edit") closeEdit();
    else if (action==="add-link") {const rows=editDialog.querySelector("#lab-link-rows");if(rows.children.length<20)rows.insertAdjacentHTML("beforeend",linkRow({type:"web"}));}
    else if (action==="remove-link") btn.closest(".lab-link-row").remove();
    else if (action==="delete") {
      if (window.confirm("프로젝트와 저장된 메모, 링크를 삭제하시겠습니까?")) {
        const prev=items;items=items.filter(p=>p.id!==id);if(!persist())items=prev;
        closeEdit();refresh();
      }
    }
  });
  editDialog.addEventListener("submit",save);
  window.ProjectHub={
    render,
    count:()=>items.length,
    add:()=>edit(null),
    exportData:()=>items.map(clean),
    importData:raw=>{if(!Array.isArray(raw))return;const next=raw.slice(0,100).map(clean).filter(x=>x&&x.name);const before=items;items=next;if(!persist())items=before;refresh();},
    reset:()=>{const before=items;items=defaults();if(!persist())items=before;refresh();}
  };
})();
