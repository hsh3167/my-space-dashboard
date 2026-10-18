'use strict';
// MY SPACE • v1.0.0 — GitHub Pages-ready, no build step or API keys.
const STORAGE_KEY = 'myspace.dashboard.v1';
const ICON_PATHS = {
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
 settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 8l-1 4 1 4 3 1 1 3 4 1 4-1 1-3 3-1 1-4-1-4-3-1-1-3-4-1-4 1-1 3z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 external:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',
 sparkles:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
 code:'<path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 4l-4 16"/>',
 layers:'<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-3c0-4 12-4 12 0v3M16 6a3 3 0 0 1 0 6M17 15c3 0 4 2 4 4v1"/>',
 play:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4z"/>',
 cloud:'<path d="M7 19a5 5 0 0 1-1-10 7 7 0 0 1 13 2 4 4 0 0 1 0 8z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
 message:'<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 1 1 19 0z"/>'
};
function icon(name) {return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]||ICON_PATHS.globe}</svg>`;}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function site(id,name,url,initial,color,bg){return {id,name,url,initial,color,bg};}
const CATEGORY_META = {
 portal:{label:'포털 사이트',sub:'빠른 검색과 웹 탐색',icon:'globe',accent:'blue'},
 ai:{label:'AI 도구',sub:'나의 AI 어시스턴트',icon:'sparkles',accent:'purple'},
 dev:{label:'개발 도구',sub:'Build, ship and scale',icon:'code',accent:'teal'},
 projects:{label:'개인 제작 사이트',sub:'나만의 프로젝트 바로가기',icon:'layers',accent:'purple'},
 social:{label:'소셜 & 커뮤니케이션',sub:'연결하고 소통하기',icon:'users',accent:'rose'},
 media:{label:'미디어',sub:'좋아하는 콘텐츠 즐기기',icon:'play',accent:'amber'},
 storage:{label:'클라우드 저장소',sub:'언제 어디서든 파일에 접근',icon:'cloud',accent:'blue'},
 workapps:{label:'업무 핵심 도구',sub:'업무에 필요한 사이트',icon:'briefcase',accent:'purple'}
};
const PERSONAL_IDS=['portal','ai','dev','projects','social','media','storage'];
const WORK_IDS=['workapps'];
function defaults(){return {
 portal:[site('naver','네이버','https://www.naver.com','N','#4cdb96','#203d34'),site('google','Google','https://www.google.com','G','#8ebeff','#263752')],
 ai:[site('chatgpt','ChatGPT','https://chatgpt.com','✳','#75dbc4','#1b3d3a'),site('claude','Claude','https://claude.ai','✺','#dda587','#402e2b'),site('gemini','Gemini','https://gemini.google.com','✦','#b6a5ff','#302949')],
 dev:[site('github','GitHub','https://github.com','⌘','#eaedfa','#303541'),site('supabase','Supabase','https://supabase.com/dashboard','S','#69dca1','#1f4138'),site('vercel','Vercel','https://vercel.com/dashboard','▲','#f2f2f7','#303542')],
 projects:Array.from({length:5},(_,i)=>site(`slot-${i+1}`,`사이트 ${String(i+1).padStart(2,'0')}`,'','+','#a7a6cb','#252b3a')),
 social:[site('gmail-personal','Gmail','https://mail.google.com','M','#e78a8a','#442b37'),site('linkedin','LinkedIn','https://www.linkedin.com','in','#7db9ef','#233a50'),site('navercafe','네이버 카페','https://cafe.naver.com','C','#75daa7','#234133')],
 media:[site('netflix','Netflix','https://www.netflix.com','N','#f17580','#48252e'),site('coupang','쿠팡플레이','https://www.coupangplay.com','C','#90a8ef','#293451'),site('youtube','YouTube','https://www.youtube.com','▶','#f38d89','#4b2c34')],
 storage:[site('gdrive-personal','Google Drive','https://drive.google.com','▲','#9bd3a5','#294035'),site('mybox','네이버 MYBOX','https://mybox.naver.com','☁','#8bc4ef','#293c4a')],
 workapps:[site('slack','Slack','https://app.slack.com/client','S','#cfacff','#392d4b'),site('gcal','Google Calendar','https://calendar.google.com','31','#91b8ff','#263855'),site('gmail-work','Gmail','https://mail.google.com','M','#e78a8a','#442b37'),site('gdrive-work','Google Drive','https://drive.google.com','▲','#9bd3a5','#294035')]
};}
function loadData(){try{const stored=JSON.parse(localStorage.getItem(STORAGE_KEY));if(stored && typeof stored==='object' && !Array.isArray(stored)){const base=defaults();Object.keys(base).forEach(k=>{if(Array.isArray(stored[k]))base[k]=stored[k].filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string').map(x=>({id:x.id.slice(0,80),name:x.name.slice(0,45),url:typeof x.url==='string'?x.url.slice(0,500):'',initial:typeof x.initial==='string'?x.initial.slice(0,3):'↗',color:typeof x.color==='string'&&/^#[0-9a-f]{6}$/i.test(x.color)?x.color:'#b7baff',bg:typeof x.bg==='string'&&/^#[0-9a-f]{6}$/i.test(x.bg)?x.bg:'#2b2e41'})).slice(0,100);});return base;}}catch(e){console.warn('Local data could not be loaded',e);}return defaults();}
let data=loadData(),currentTab=(new URLSearchParams(location.search).get('view')==='work'?'work':'personal'),query='',editing=null,toastTimer;
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true;}catch(err){notify('이 브라우저에서는 저장할 수 없습니다. JSON으로 백업해 주세요.');return false;}}
const $=s=>document.querySelector(s);
function isSafeUrl(url){try{let u=new URL(url);return ['https:','http:'].includes(u.protocol);}catch{return false;}}
function domain(url){if(!url)return '주소를 등록하세요';try{let d=new URL(url).hostname;return d.replace(/^www\./,'');}catch{return '주소를 확인하세요';}}
function iconLogo(item){const c=/^#[0-9a-f]{6}$/i.test(item.color)?item.color:'#c1c5e1',b=/^#[0-9a-f]{6}$/i.test(item.bg)?item.bg:'#2e3042';return `<span class="site-logo" style="--logo-bg:${b};--logo-fg:${c}">${esc(item.initial||item.name[0]||'↗')}</span>`;}
function siteRow(item,category){const url=isSafeUrl(item.url)?item.url:'';return `<div class="site-row"><a class="site-link" href="${esc(url||'#')}" ${url?'target="_blank" rel="noopener noreferrer"':'data-empty="true"'} data-id="${esc(item.id)}" data-cat="${category}" title="${esc(item.name)}">${iconLogo(item)}<span class="site-labels"><strong>${esc(item.name)}</strong><small>${esc(domain(item.url))}</small></span></a><span class="external">${icon('external')}</span><button class="site-edit" title="수정" aria-label="${esc(item.name)} 수정" data-action="edit" data-id="${esc(item.id)}" data-cat="${category}">···</button></div>`;}
function filteredItems(category){const list=data[category]||[];if(!query)return list;const m=CATEGORY_META[category];if((m.label+' '+m.sub).toLocaleLowerCase().includes(query))return list;return list.filter(x=>(x.name+' '+x.url).toLocaleLowerCase().includes(query));}
function cardHeader(category,count){let m=CATEGORY_META[category];return `<div class="card-heading"><span class="section-icon ${m.accent}">${icon(m.icon)}</span><span class="card-title"><h3>${esc(m.label)}</h3><p>${esc(m.sub)}</p></span><button class="section-add" type="button" data-action="add" data-cat="${category}" aria-label="${esc(m.label)} 링크 추가" title="링크 추가">+</button></div>`;}
function projectItem(item){const url=isSafeUrl(item.url)?item.url:null;if(!url)return `<button type="button" class="project-slot" data-action="edit" data-id="${esc(item.id)}" data-cat="projects" title="클릭해서 사이트 등록"><span class="project-icon">+</span><strong>${esc(item.name)}</strong><small>사이트 등록</small></button>`;return `<div class="project-slot filled" style="position:relative"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;flex-direction:column;gap:9px;max-width:100%" title="${esc(item.name)} 열기"><span class="project-icon">↗</span><strong>${esc(item.name)}</strong><small>사이트 열기</small></a><button type="button" data-action="edit" data-id="${esc(item.id)}" data-cat="projects" style="position:absolute;right:3px;top:3px;border:0;background:transparent;color:#a9a9bc" aria-label="${esc(item.name)} 수정">···</button></div>`;}
function card(category){let items=filteredItems(category);if(query && items.length===0)return '';
const type=category==='projects'?' projects':'';
let body=category==='projects'?`<div class="projects-list">${items.map(projectItem).join('')}</div>`:`<div class="site-list">${items.map(x=>siteRow(x,category)).join('')}</div>`;
return `<section class="section-card${type}">${cardHeader(category,items.length)}${body}</section>`;}
function workCard(item){const url=isSafeUrl(item.url)?item.url:null;return `<section class="section-card work-card">${cardHeader('workapps',data.workapps.length)}<a class="work-tile" href="${esc(url||'#')}" ${url?'target="_blank" rel="noopener noreferrer"':'data-empty="true"'} data-id="${esc(item.id)}" data-cat="workapps">${iconLogo(item)}<span><strong>${esc(item.name)}</strong><small>${esc(domain(item.url))}</small></span><span class="external">${icon('external')}</span></a><button style="margin-top:18px" class="site-edit" type="button" data-action="edit" data-id="${esc(item.id)}" data-cat="workapps" title="${esc(item.name)} 수정">··· 편집</button></section>`;}
function render(){const isWork=currentTab==='work';document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===currentTab);b.setAttribute('aria-pressed',String(b.dataset.tab===currentTab));});$('#breadcrumb-active').textContent=isWork?'Work':'Personal';$('#hero-view').textContent=isWork?'WORK':'PERSONAL';$('#hero-title').innerHTML=isWork?'오늘의 업무를, <em>더 간결하게.</em>':'모든 것을, <em>한 곳에.</em>';$('#hero-subtitle').innerHTML=isWork?'Slack부터 일정과 파일까지.<br class="desktop-break"> 업무에 필요한 도구에 바로 접근하세요.':'자주 가는 사이트부터 나만의 프로젝트까지.<br class="desktop-break"> 필요한 모든 링크를 가장 빠르게 찾아보세요.';$('#grid-heading').textContent=isWork?'업무용 워크스페이스':'즐겨찾기 라이브러리';$('#grid-subheading').textContent=isWork?'오늘의 업무를 위한 빠른 실행 도구입니다.':'필요한 도구를 카테고리별로 정리했습니다.';
const categories=isWork?WORK_IDS:PERSONAL_IDS;let allItems=categories.flatMap(cat=>data[cat]||[]),activeItems=allItems.filter(x=>isSafeUrl(x.url));$('#link-counter').textContent=`${activeItems.length} LINKS`;
let html=isWork?`<div class="work-grid dashboard-grid" style="display:contents">${filteredItems('workapps').map(workCard).join('')}</div>`:categories.map(card).join('');
if(!query&&!isWork)html+=`<section class="section-card nudge"><div class="nudge-icon">✧</div><h3>당신만의 공간으로<br>채워 보세요.</h3><p>사이트를 추가하거나 원하는 이름과<br>주소로 변경할 수 있습니다.</p><button type="button" data-action="add" data-cat="projects">개인 사이트 추가하기 →</button></section>`;
$('#dashboard-grid').classList.toggle('work-grid',isWork);$('#dashboard-grid').innerHTML=html||`<div class="empty-search"><h3>검색 결과가 없습니다.</h3><p>다른 검색어를 입력하거나 검색어를 지워보세요.</p></div>`;
$('#clear-search').classList.toggle('hidden',!query);}
function switchTab(tab){if(!['personal','work'].includes(tab))return;currentTab=tab;query='';$('#site-search').value='';render();window.scrollTo({top:0,behavior:'smooth'});}
function openEdit(category,id){if(!CATEGORY_META[category])return;editing={category,id};const item=(data[category]||[]).find(i=>i.id===id);$('#dialog-title').textContent=item?'링크 편집':'새 링크 추가';$('#edit-name').value=item?.name||'';$('#edit-url').value=item?.url||'';$('#edit-category').innerHTML=(currentTab==='work'?WORK_IDS:PERSONAL_IDS).map(k=>`<option value="${k}" ${k===category?'selected':''}>${CATEGORY_META[k].label}</option>`).join('');$('#delete-site').classList.toggle('hidden',!item);$('#site-dialog').showModal();$('#edit-name').focus();}
function closeEdit(){$('#site-dialog').close();editing=null;}
function notify(message){const toast=$('#toast');toast.textContent=message;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,3400);}
function submitEdit(ev){ev.preventDefault();if(!editing)return;const name=$('#edit-name').value.trim(),rawUrl=$('#edit-url').value.trim(),category=$('#edit-category').value;if(!name)return;let url=rawUrl;if(url&&!/^https?:\/\//i.test(url))url='https://'+url;if(url&&!isSafeUrl(url)){notify('올바른 http 또는 https 주소를 입력하세요.');return;}
const oldList=data[editing.category]||[],old=oldList.find(s=>s.id===editing.id);const next={id:old?.id||('site-'+Date.now()+'-'+Math.random().toString(36).slice(2,6)),name:name.slice(0,45),url,initial:old?.initial||name.slice(0,2).toUpperCase(),color:old?.color||'#b7baff',bg:old?.bg||'#293247'};if(old)data[editing.category]=oldList.filter(s=>s.id!==old.id);data[category].push(next);save();closeEdit();render();notify('사이트가 저장되었습니다.');}
function deleteEdit(){if(!editing?.id)return;if(!confirm('이 사이트를 삭제할까요?'))return;data[editing.category]=data[editing.category].filter(s=>s.id!==editing.id);save();closeEdit();render();notify('사이트가 삭제되었습니다.');}
function exportData(){const blob=new Blob([JSON.stringify({app:'myspace',version:1,exportedAt:new Date().toISOString(),links:data},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='myspace-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('JSON 백업을 내보냈습니다.');}
async function importData(file){if(!file)return;try{if(file.size>1_000_000)throw Error('파일 용량이 너무 큽니다.');const doc=JSON.parse(await file.text());if(doc.app!=='myspace'||doc.version!==1||!doc.links||typeof doc.links!=='object')throw Error('My Space 백업 형식이 아닙니다.');const backup=doc.links;const original=data;data=Object.assign(defaults(),backup);const clean=loadDataFromObject(data);data=clean;if(!save())data=original;render();notify('백업을 가져왔습니다.');}catch(e){notify('가져오기 실패: '+e.message);}finally{$('#import-file').value='';}}
function loadDataFromObject(input){const base=defaults();Object.keys(base).forEach(k=>{if(Array.isArray(input[k]))base[k]=input[k].filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string').slice(0,100).map(x=>({id:x.id.slice(0,80),name:x.name.slice(0,45),url:typeof x.url==='string'&&(!x.url||isSafeUrl(x.url))?x.url.slice(0,500):'',initial:typeof x.initial==='string'?x.initial.slice(0,3):'↗',color:typeof x.color==='string'&&/^#[0-9a-f]{6}$/i.test(x.color)?x.color:'#b7baff',bg:typeof x.bg==='string'&&/^#[0-9a-f]{6}$/i.test(x.bg)?x.bg:'#293247'}));});return base;}
function setDate(){const now=new Date();$('#header-date').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(now);$('#live-clock').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);}
function events(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
$('#site-search').addEventListener('input',e=>{query=e.target.value.trim().toLocaleLowerCase();render();});$('#clear-search').addEventListener('click',()=>{$('#site-search').value='';query='';render();$('#site-search').focus();});
$('#dashboard-grid').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(btn){e.preventDefault();openEdit(btn.dataset.cat,btn.dataset.action==='edit'?btn.dataset.id:null);return;}const empty=e.target.closest('[data-empty="true"]');if(empty){e.preventDefault();openEdit(empty.dataset.cat,empty.dataset.id);}});
$('#site-form').addEventListener('submit',submitEdit);$('#close-dialog').addEventListener('click',closeEdit);$('#cancel-dialog').addEventListener('click',closeEdit);$('#delete-site').addEventListener('click',deleteEdit);
$('#add-site-global').addEventListener('click',()=>openEdit(currentTab==='work'?'workapps':'projects',null));$('#show-all').addEventListener('click',()=>{query='';$('#site-search').value='';render();window.scrollTo({top:0,behavior:'smooth'});});
$('#export-json').addEventListener('click',exportData);$('#export-json-settings').addEventListener('click',exportData);$('#import-json-trigger').addEventListener('click',()=>$('#import-file').click());$('#import-file').addEventListener('change',e=>importData(e.target.files[0]));
$('#open-settings').addEventListener('click',()=>$('#settings-dialog').showModal());$('#close-settings').addEventListener('click',()=>$('#settings-dialog').close());$('#reset-data').addEventListener('click',()=>{if(!confirm('추가하거나 수정한 모든 링크를 초기화합니다. 계속할까요?'))return;data=defaults();save();render();$('#settings-dialog').close();notify('기본 링크가 복원되었습니다.');});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#site-search').focus();$('#site-search').select();}if(e.key==='Escape'&&!$('#site-dialog').open&&!$('#settings-dialog').open&&query){query='';$('#site-search').value='';render();}});
}
events();render();setDate();setInterval(setDate,30_000);
