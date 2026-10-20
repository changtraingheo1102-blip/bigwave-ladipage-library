'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const storageKey = 'bigwave-ladi-library-v1';
let saved = {favorites:[],notes:{}};
try { const s = JSON.parse(localStorage.getItem(storageKey)); if (s && Array.isArray(s.favorites) && s.notes && typeof s.notes === 'object') saved = s; } catch {}
let data, toastTimer, activeDetail;
const state = {tab:'projects',category:'all',search:'',status:'all',archive:'all',sort:'category',view:'grid',page:1};
const icons = {all:'▦',profile:'♙',courses:'↗',teams:'◎',events:'✧',shop:'▧',music:'♪',services:'◈',utility:'⌘',favorites:'☆',archives:'▤'};
const palettes = {profile:['#e3ede2','#759b78'],courses:['#eee9de','#b49b69'],teams:['#e5e4f1','#9690b8'],events:['#f2e5df','#c69d8c'],shop:['#e7e9de','#9b9f6e'],music:['#dfece9','#78a698'],services:['#e3eaf0','#7d99ad'],utility:['#ecece6','#9c9b7f']};
const size = n => n >= 1e6 ? (n/1e6).toFixed(1)+' MB' : Math.round(n/1024)+' KB';
const favorite = id => saved.favorites.includes(id);
const categoryLabel = id => data.categories.find(c=>c.id===id)?.label || 'Khác';
const persist = () => { try { localStorage.setItem(storageKey,JSON.stringify(saved)); } catch { toast('Không lưu được trên trình duyệt. Hãy xuất ghi chú để giữ bản sao.'); } };
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,3300); }
function downloadJSON(value, name) { const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function setLocation() { const p=new URLSearchParams();if(state.tab!=='projects')p.set('tab',state.tab);if(state.category!=='all')p.set('category',state.category);if(state.search)p.set('q',state.search);if(state.status!=='all')p.set('status',state.status);if(state.archive!=='all')p.set('archive',state.archive);history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():'')); }
function change(values) { Object.assign(state,values,{page:1});setLocation();render(); }
function renderNavigation() {
  const rows=[{id:'all',label:'Tất cả dự án',count:data.stats.projects},...data.categories.map(c=>({...c,count:data.projects.filter(p=>p.category===c.id).length}))];
  $('navigation').innerHTML=rows.map(c=>`<button class="nav-item ${state.category===c.id?'active':''}" data-category="${esc(c.id)}" ${state.category===c.id?'aria-current="page"':''}><span class="nav-icon">${icons[c.id]}</span>${esc(c.label)}<span class="count">${c.count}</span></button>`).join('')+'<div class="nav-separator"></div>'+[{id:'favorites',label:'Đã yêu thích',count:saved.favorites.length},{id:'archives',label:'Bộ file gốc',count:2}].map(c=>`<button class="nav-item ${state.category===c.id?'active':''}" data-category="${c.id}"><span class="nav-icon">${icons[c.id]}</span>${c.label}<span class="count">${c.count}</span></button>`).join('');
}
function visibleItems() {
  let items=state.tab==='projects'?data.projects:data.webPages;
  if(state.category==='favorites')items=items.filter(p=>favorite(p.id));
  else if(state.category!=='all')items=items.filter(p=>p.category===state.category);
  if(state.search){const q=normalize(state.search);items=items.filter(p=>normalize([p.title,p.webTitle,p.filename,p.base,p.categoryLabel,p.slug,saved.notes[p.id]].filter(Boolean).join(' ')).includes(q));}
  if(state.status==='notes')items=items.filter(p=>String(saved.notes[p.id]||'').trim());
  else if(state.tab==='projects'&&state.status!=='all')items=items.filter(p=>p.status===state.status);
  if(state.tab==='projects'&&state.archive!=='all')items=items.filter(p=>p.groups.includes(state.archive));
  return [...items].sort((a,b)=>{
    if(state.sort==='favorite'){const d=Number(favorite(b.id))-Number(favorite(a.id));if(d)return d;}
    if(state.sort==='size'){const d=(b.size||0)-(a.size||0);if(d)return d;}
    if(state.sort==='category'){const d=data.categories.findIndex(c=>c.id===a.category)-data.categories.findIndex(c=>c.id===b.category);if(d)return d;}
    return (a.displayTitle||a.title).localeCompare(b.displayTitle||b.title,'vi',{numeric:true});
  });
}
function art(item) {
  const palette=palettes[item.category]||palettes.utility;
  const fallback=`<div class="fallback-art" style="--card-bg:${palette[0]};--card-ink:${palette[1]}"><span class="art-icon">${icons[item.category]||'▧'}</span><span class="art-label">${esc(item.categoryLabel)}</span></div>`;
  return item.thumbnail?`<img src="${esc(item.thumbnail)}" alt="" loading="lazy" decoding="async" data-fallback="${esc(item.category)}">`:fallback;
}
function card(item) {
  const project=state.tab==='projects',hasWeb=project?!!item.relatedSlug:true;
  const title=item.displayTitle||item.title;
  const group=project?'GÓI '+item.groups.join(' · '):item.relatedProjects.length+' FILE LIÊN QUAN';
  const metadata=project?`${item.id.toUpperCase()} <span>·</span> ${group}`:'TRANG WEB <span>·</span> '+group;
  const status=project?(hasWeb?'Có bản web liên quan':'Chỉ có file gốc'):'Bản web khôi phục';
  return `<article class="card" data-id="${esc(item.id)}"><div class="card-visual"><button class="visual-button" data-action="detail" data-id="${esc(item.id)}" aria-label="Chi tiết ${esc(title)}">${art(item)}</button><div class="card-top"><span class="category-pill">${esc(item.categoryLabel)}</span><button class="favorite ${favorite(item.id)?'on':''}" data-action="favorite" data-id="${esc(item.id)}" aria-label="${favorite(item.id)?'Bỏ yêu thích':'Yêu thích'} ${esc(title)}" aria-pressed="${favorite(item.id)}">${favorite(item.id)?'★':'☆'}</button></div></div><div class="card-info"><div class="card-meta">${metadata}${item.version?`<span class="version">${esc(item.version)}</span>`:''}</div><h2 class="card-title"><button data-action="detail" data-id="${esc(item.id)}">${esc(title)}</button></h2><div class="card-filename" title="${esc(item.filename||item.slug)}">${esc(project?item.filename:'/'+item.slug)}</div><div class="card-status ${!hasWeb?'source':''}">${status}${saved.notes[item.id]?'<span class="note-indicator" title="Có ghi chú">✎</span>':''}</div></div><div class="card-footer">${hasWeb?`<a href="${esc(item.viewPath||item.path)}" target="_blank" rel="noopener">Xem trang <span>↗</span></a>`:`<button data-action="detail" data-id="${esc(item.id)}">Chi tiết file →</button>`}${project?`<a href="${esc(item.download)}" download="${esc(item.filename)}" class="file-link">Tải gốc ↓</a>`:`<button class="file-link" data-action="copy" data-path="${esc(item.viewPath||item.path)}">Sao chép link</button>`}<button class="more" data-action="detail" data-id="${esc(item.id)}" aria-label="Chi tiết">···</button></div></article>`;
}
function renderArchives() {
  $('archivePanel').innerHTML='<div class="archive-grid">'+data.archives.map(a=>`<article class="archive-card"><div class="archive-icon">▤</div><h2>${esc(a.label)}</h2><p>${a.count} file .ladipage nguyên gốc, giữ nguyên tên và nội dung.</p><small>${esc(a.originalName)}</small><a href="${esc(a.download)}" class="primary-button" download>Tải ZIP gói ${a.id} ↓</a></article>`).join('')+'</div><div class="archive-note"><b>Đã gộp ZIP trùng:</b> “6a70581aab35210012370611 (1).zip” giống hoàn toàn gói B. Thư viện giữ đủ <b>199 nội dung khác nhau</b>; các bản nháp và phiên bản khác nội dung vẫn có mục riêng.</div><div class="detail-actions"><a href="/bigwave-ladipage-library/danh-muc.csv" class="secondary-button" download>Tải danh mục CSV ↓</a><button class="secondary-button" id="exportArchiveNotes">Xuất yêu thích & ghi chú ↓</button></div>';
  $('exportArchiveNotes').onclick=exportNotes;
}
function render() {
  renderNavigation();
  const archiveView=state.category==='archives';
  const heading=archiveView?'Bộ file gốc':state.category==='all'?(state.tab==='web'?'Trang web đã khôi phục':'Tất cả dự án'):state.category==='favorites'?'Đã yêu thích':categoryLabel(state.category);
  $('pageTitle').textContent=heading;$('breadcrumb').textContent=heading;
  $('pageSubtitle').textContent=archiveView?'Tải các gói dữ liệu đã nhập vào thư viện.':state.tab==='web'?'Các trang web liên quan đã được lưu trên hosting online.':'Một nơi để tìm, xem và quản lý các bản LadiPage.';
  $('workspace').hidden=archiveView;$('archivePanel').hidden=!archiveView;
  $('archivesButton').hidden=archiveView;
  if(archiveView){renderArchives();return;}
  $('projectsTab').classList.toggle('active',state.tab==='projects');$('webTab').classList.toggle('active',state.tab==='web');$('projectsTab').setAttribute('aria-selected',state.tab==='projects');$('webTab').setAttribute('aria-selected',state.tab==='web');
  $('statusFilter').value=state.status;$('archiveFilter').value=state.archive;$('sort').value=state.sort;$('search').value=state.search;$('archiveFilter').disabled=state.tab==='web';
  [...$('statusFilter').options].forEach(o=>{if(['source','related'].includes(o.value))o.disabled=state.tab==='web';});
  $('gridButton').classList.toggle('active',state.view==='grid');$('listButton').classList.toggle('active',state.view==='list');$('gridButton').setAttribute('aria-pressed',state.view==='grid');$('listButton').setAttribute('aria-pressed',state.view==='list');
  const all=visibleItems(),limit=24,total=all.length,pages=Math.max(1,Math.ceil(total/limit));state.page=Math.min(state.page,pages);const start=(state.page-1)*limit;
  $('resultCount').innerHTML=`<b>${total}</b> ${state.tab==='projects'?'dự án':'trang web'}${total?` <span>·</span> Hiển thị ${start+1}–${Math.min(start+limit,total)}`:''}`;
  $('resetButton').hidden=state.category==='all'&&!state.search&&state.status==='all'&&state.archive==='all';
  $('catalog').classList.toggle('list',state.view==='list');
  $('catalog').innerHTML=total?all.slice(start,start+limit).map(card).join(''):`<div class="empty-state"><strong>${state.category==='favorites'?'Chưa có mục yêu thích':'Không tìm thấy kết quả'}</strong><p>${state.category==='favorites'?'Nhấn ngôi sao trên một thẻ để lưu vào đây.':'Thử từ khóa khác hoặc xóa bộ lọc.'}</p><button class="secondary-button" data-action="reset">Xem tất cả dự án</button></div>`;
  $('catalog').querySelectorAll('img').forEach(img=>{img.onerror=()=>{const category=img.dataset.fallback;const span=document.createElement('div');span.className='fallback-art';span.style.setProperty('--card-ink',(palettes[category]||palettes.utility)[1]);span.innerHTML=`<span class="art-icon">${icons[category]||'▧'}</span><span class="art-label">${esc(categoryLabel(category))}</span>`;img.replaceWith(span);};});
  const range=new Set([1,pages,state.page-1,state.page,state.page+1].filter(p=>p>=1&&p<=pages));let last=0;
  $('pagination').innerHTML=total?`<span>Trang ${state.page} / ${pages}</span><div class="page-buttons"><button class="page-button" data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="Trang trước">←</button>${[...range].sort((a,b)=>a-b).map(p=>{const gap=last&&p-last>1?'<span>…</span>':'';last=p;return gap+`<button class="page-button ${p===state.page?'active':''}" data-page="${p}" ${p===state.page?'aria-current="page"':''}>${p}</button>`;}).join('')}<button class="page-button" data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="Trang sau">→</button></div>`:'';
}
function getItem(id){return [...data.projects,...data.webPages].find(p=>p.id===id);}
function showDetail(id) {
  const item=getItem(id);if(!item)return;activeDetail=id;
  const project=id.startsWith('p'),web=project?data.webPages.find(w=>w.slug===item.relatedSlug):item;
  const isFavorite=favorite(id);
  $('detailContent').innerHTML=`<button class="close-dialog" data-close="detailDialog" aria-label="Đóng">×</button><div class="dialog-eyebrow">${project?'FILE DỰ ÁN · '+id.toUpperCase():'BẢN WEB KHÔI PHỤC'}</div><h2 id="detailTitle">${esc(item.displayTitle||item.title)}</h2><div class="detail-summary"><span>${esc(item.categoryLabel)}</span>${project?`<span>Gói ${item.groups.join(' · ')}</span><span>${size(item.size)}</span>`:''}${item.version?`<span>${esc(item.version)}</span>`:''}</div>${project?`<div class="detail-file"><b>TÊN FILE GỐC</b>${esc(item.filename)}</div>`:''}<div class="detail-actions">${project?`<a class="primary-button" href="${esc(item.download)}" download="${esc(item.filename)}">Tải file gốc ↓</a>`:`<a class="primary-button" href="${esc(item.viewPath)}" target="_blank" rel="noopener">Mở trang web ↗</a>`}<button class="secondary-button" data-action="favorite" data-id="${id}">${isFavorite?'★ Đã yêu thích':'☆ Yêu thích'}</button></div>${web&&project?`<div class="detail-related"><h3>Bản web liên quan</h3><p>${esc(web.title)}</p><a class="secondary-button" href="${esc(web.viewPath)}" target="_blank" rel="noopener">Xem trang ↗</a> <button class="text-button" data-action="copy" data-path="${esc(web.viewPath)}">Sao chép link</button><p>Bản web được khôi phục từ trang đã xuất bản, có thể khác phiên bản file gốc trong ZIP.</p></div>`:project?'<div class="detail-related"><h3>Chưa có bản xem web</h3><p>File dự án LadiPage đang mã hóa và chưa đối chiếu được với một trang đã xuất bản. Bản gốc đã được lưu đầy đủ, có thể tải xuống.</p></div>':`<div class="detail-related"><h3>File gốc có liên quan</h3><p>${item.relatedProjects.map(pid=>{const p=getItem(pid);return `<a class="text-button related-file" href="${p.download}" download="${esc(p.filename)}">${pid.toUpperCase()} · ${esc(p.displayTitle||p.title)} ↓</a>`;}).join('<br>')}</p><p>Đã khôi phục giao diện và mã trang. Một số ảnh hoặc tích hợp từ nguồn ngoài có thể hết hạn.</p></div>`}<label class="detail-note"><span>Ghi chú của bạn</span><textarea id="noteText" placeholder="Thêm trạng thái, việc cần sửa, khách hàng…" maxlength="10000">${esc(saved.notes[id]||'')}</textarea></label><div class="save-note-row"><small>Lưu trên trình duyệt này.</small><button class="primary-button" id="saveNote">Lưu ghi chú</button></div>`;
  $('saveNote').onclick=()=>{const value=$('noteText').value.trim();if(value)saved.notes[id]=value;else delete saved.notes[id];persist();render();toast('Đã lưu ghi chú.');};
  if(!$('detailDialog').open)$('detailDialog').showModal();
}
function exportNotes(){downloadJSON({app:storageKey,exportedAt:new Date().toISOString(),favorites:saved.favorites,notes:saved.notes},'bigwave-yeu-thich-ghi-chu.json');toast('Đã xuất yêu thích và ghi chú.');}
async function handleAction(event) {
  const btn=event.target.closest('[data-action]');if(!btn)return;
  const {action,id}=btn.dataset;
  if(action==='detail')showDetail(id);
  if(action==='favorite'){
    saved.favorites=favorite(id)?saved.favorites.filter(x=>x!==id):[...saved.favorites,id];persist();render();
    if($('detailDialog').open&&activeDetail===id){const note=$('noteText')?.value;showDetail(id);if(note!==undefined)$('noteText').value=note;}
  }
  if(action==='copy'){
    const url=new URL(btn.dataset.path,location.origin).href;
    try{await navigator.clipboard.writeText(url);toast('Đã sao chép link.');}catch{toast('Link: '+url);}
  }
  if(action==='reset')change({category:'all',search:'',status:'all',archive:'all'});
}
document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');if(close)$(close.dataset.close).close();
  if(state.category!=='archives'&&event.target.closest('#archivesButton'))change({category:'archives'});
  if(!event.target.closest('#sidebar')&&!event.target.closest('#menuButton'))$('sidebar').classList.remove('open');
});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('menuButton').onclick=()=>$('sidebar').classList.toggle('open');
$('infoButton').onclick=()=>$('infoDialog').showModal();
$('exportButton').onclick=exportNotes;
$('navigation').onclick=e=>{const btn=e.target.closest('[data-category]');if(!btn)return;change({category:btn.dataset.category});$('sidebar').classList.remove('open');};
$('projectsTab').onclick=()=>change({tab:'projects',status:'all'});
$('webTab').onclick=()=>change({tab:'web',status:'all',archive:'all'});
$('gridButton').onclick=()=>{state.view='grid';render();};$('listButton').onclick=()=>{state.view='list';render();};
$('statusFilter').onchange=e=>change({status:e.target.value});$('archiveFilter').onchange=e=>change({archive:e.target.value});$('sort').onchange=e=>change({sort:e.target.value});
let searchTimer;$('search').addEventListener('input',e=>{const q=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>change({search:q}),180);});
$('resetButton').onclick=()=>change({category:'all',search:'',status:'all',archive:'all'});
$('catalog').addEventListener('click',handleAction);$('detailContent').addEventListener('click',handleAction);
$('pagination').onclick=e=>{const btn=e.target.closest('[data-page]');if(!btn||btn.disabled)return;state.page=Number(btn.dataset.page);render();$('workspace').scrollIntoView({behavior:'smooth',block:'start'});};
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('sidebar').classList.remove('open');if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('detailDialog').open&&!$('infoDialog').open){e.preventDefault();$('search').focus();}});
$('importFile').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;const value=JSON.parse(await file.text());if(value.app!==storageKey||!Array.isArray(value.favorites)||!value.notes||typeof value.notes!=='object')throw Error();const validIds=new Set([...data.projects,...data.webPages].map(p=>p.id));saved.favorites=[...new Set([...saved.favorites,...value.favorites.filter(id=>validIds.has(id))])];for(const[id,note]of Object.entries(value.notes))if(validIds.has(id)&&typeof note==='string')saved.notes[id]=note.slice(0,10000);persist();render();toast('Đã nhập yêu thích và ghi chú.');}catch{toast('File ghi chú không đúng định dạng.');}e.target.value='';});
(async()=>{try{const response=await fetch('/bigwave-ladipage-library/catalog.json');if(!response.ok)throw Error();data=await response.json();const validIds=new Set([...data.projects,...data.webPages].map(p=>p.id));saved.favorites=saved.favorites.filter(id=>validIds.has(id));$('projectCount').textContent=data.stats.projects;$('webCount').textContent=data.stats.webPages;$('relatedCount').textContent=data.stats.relatedProjects+' dự án có bản web liên quan';$('projectsTabCount').textContent=data.stats.projects;$('webTabCount').textContent=data.stats.webPages;const p=new URLSearchParams(location.search);if(p.get('tab')==='web')state.tab='web';if([...data.categories.map(c=>c.id),'all','favorites','archives'].includes(p.get('category')))state.category=p.get('category');state.search=p.get('q')||'';if(['related','source','notes'].includes(p.get('status')))state.status=p.get('status');if(['A','B'].includes(p.get('archive')))state.archive=p.get('archive');render();}catch{$('catalog').innerHTML='<div class="empty-state"><strong>Chưa tải được danh mục</strong><p>Hãy tải lại trang sau một lúc.</p><button class="secondary-button" onclick="location.reload()">Tải lại</button></div>';$('resultCount').textContent='Kết nối bị gián đoạn';}})();
