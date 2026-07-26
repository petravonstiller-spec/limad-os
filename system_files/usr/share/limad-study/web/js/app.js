import{get,post,del,upload}from'./api.js';
import{icon}from'./icons.js';
import{esc,empty,formatBytes,modal,publicationCard,skeleton,toast}from'./ui.js';


const storageMemory=new Map();
function storageGet(key,fallback=''){
 try{
  const value=window.localStorage.getItem(key);
  return value===null?fallback:value;
 }catch(error){
  window.__LIMAD_STUDY_STORAGE_ERROR=(error&&error.message)||String(error);
  return storageMemory.has(key)?storageMemory.get(key):fallback;
 }
}
function storageSet(key,value){
 const text=String(value);
 storageMemory.set(key,text);
 try{window.localStorage.setItem(key,text);return true}catch(error){window.__LIMAD_STUDY_STORAGE_ERROR=(error&&error.message)||String(error);return false}
}

const main=document.querySelector('#main-content');
const modalRoot=document.querySelector('#modal-root');
const state={route:'home',status:null,home:null,library:[],languageIndex:Number(storageGet('limad-language','2')),languageName:'Deutsch',selectedPublication:null,selectedDocument:null,studyTab:'notes',selection:null,meetingOffset:0,pendingBlockIdentifier:null};
const UI_TEXT={de:{home:'Startseite',publications:'Publikationen',bible:'Bibel',video:'Video',audio:'Audio',playlists:'Playlists',downloads:'Downloads',meetings:'Zusammenkünfte',notes:'Notizen',bookmarks:'Lesezeichen',highlights:'Markierungen',tags:'Tags',backups:'Backups',settings:'Einstellungen',help:'Hilfe',dailyText:'Täglicher Text',quickAccess:'Schnellzugriff',read:'Lesen',favorites:'Favoriten',more:'Mehr anzeigen',newServer:'Neu vom Server',meetingsWeek:'Zusammenkünfte diese Woche',fullProgram:'Vollständiges Programm anzeigen',recent:'Zuletzt verwendet',publicationsTitle:'Publikationen',catalogSubtitle:'Offizieller Katalog und lokale Bibliothek',bibleTitle:'Bibel',bibleSubtitle:'Verfügbare Übersetzungen und Bibelteile',availableBibles:'Verfügbare Bibeln',searchBible:'Bibel suchen',downloaded:'Heruntergeladen',importJwpub:'.jwpub importieren'},en:{home:'Home',publications:'Publications',bible:'Bible',video:'Video',audio:'Audio',playlists:'Playlists',downloads:'Downloads',meetings:'Meetings',notes:'Notes',bookmarks:'Bookmarks',highlights:'Highlights',tags:'Tags',backups:'Backups',settings:'Settings',help:'Help',dailyText:'Daily Text',quickAccess:'Quick access',read:'Read',favorites:'Favorites',more:'Show more',newServer:'New from server',meetingsWeek:'Meetings this week',fullProgram:'View full program',recent:'Recently used',publicationsTitle:'Publications',catalogSubtitle:'Official catalog and local library',bibleTitle:'Bible',bibleSubtitle:'Available translations and Bible content',availableBibles:'Available Bibles',searchBible:'Search Bible',downloaded:'Downloaded',importJwpub:'Import .jwpub'}};
function uiLocale(){return Number(state.languageIndex)===0?'en':'de'}
function tr(key,fallback=''){return UI_TEXT[uiLocale()]?.[key]||UI_TEXT.de[key]||fallback||key}
function dailyParts(daily){const fallback=String(daily.text||'').trim();if(!daily.html)return{scripture:'',comment:fallback};try{const doc=new DOMParser().parseFromString(String(daily.html),'text/html');const blocks=[...doc.querySelectorAll('p')].map(node=>node.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);if(blocks.length>=2)return{scripture:blocks[0],comment:blocks.slice(1).join('\n\n')};if(blocks.length===1)return{scripture:'',comment:blocks[0]}}catch(error){}const split=fallback.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);return split.length>1?{scripture:split[0],comment:split.slice(1).join('\n\n')}:{scripture:'',comment:fallback}}
const nav=[
 ['home','Startseite','home'],['publications','Publikationen','publications'],['bible','Bibel','bible'],['video','Video','video'],['audio','Audio','audio'],['playlists','Playlists','playlists'],['downloads','Downloads','download'],['sep','',null],['meetings','Zusammenkünfte','meetings'],['notes','Notizen','notes'],['bookmarks','Lesezeichen','bookmark'],['highlights','Markierungen','highlight'],['tags','Tags','tags'],['backups','Backups','backup'],['sep','',null],['settings','Einstellungen','settings'],['help','Hilfe','help']
];

function installChrome(){
 document.querySelector('#main-nav').innerHTML=nav.map(([route,label,name])=>route==='sep'?'<div class="nav-separator"></div>':`<button class="nav-item" data-route="${route}">${icon(name)}<span>${esc(tr(route,label))}</span></button>`).join('');
 let languageButton=document.querySelector('#global-language-button');
 if(!languageButton){
  languageButton=document.createElement('button');
  languageButton.id='global-language-button';
  languageButton.className='button app-bar-language';
  document.querySelector('#global-search').before(languageButton);
 }
 languageButton.innerHTML=`${icon('people',16)} <span>${esc(state.languageName)}</span>`;
 languageButton.onclick=openLanguage;
 document.querySelector('#global-search').innerHTML=icon('search');
 document.querySelector('#global-bookmark').innerHTML=icon('bookmark');
 document.querySelector('#global-history').innerHTML=icon('history');
 document.querySelector('#global-sync').innerHTML=icon('cloud');
 document.querySelector('#global-menu').innerHTML=icon('more');
 document.querySelector('#global-search').onclick=openSearch;
 document.querySelector('#global-bookmark').onclick=()=>navigate('bookmarks');
 document.querySelector('#global-history').onclick=()=>navigate('home');
 document.querySelector('#global-sync').onclick=syncCatalog;
 document.querySelector('#global-menu').onclick=openGlobalMenu;
 document.querySelector('#jwpub-input').onchange=event=>importFile(event.target.files[0],'jwpub');
 document.querySelector('#jwlibrary-input').onchange=event=>importFile(event.target.files[0],'jwlibrary');
 document.querySelector('#jwlplaylist-input').onchange=event=>importFile(event.target.files[0],'jwlplaylist');
}

function setActive(){document.querySelectorAll('[data-route]').forEach(node=>node.classList.toggle('active',node.dataset.route===state.route))}
async function navigate(route,params={}){state.route=route;Object.assign(state,params);setActive();main.scrollTop=0;main.innerHTML='<div class="page">'+skeleton(6)+'</div>';try{await render()}catch(error){main.innerHTML=`<div class="page">${empty('Ansicht konnte nicht geladen werden',error.message,`<button class="button" data-route="home">Zur Startseite</button>`)}</div>`;toast(error.message,'error')}}
async function render(){
 if(state.route==='home')return renderHome();
 if(state.route==='publications')return renderCatalogPage('publications');
 if(state.route==='bible')return renderBible();
 if(state.route==='video')return renderMedia('video');
 if(state.route==='audio')return renderMedia('audio');
 if(state.route==='playlists')return renderPlaylists();
 if(state.route==='downloads')return renderDownloads();
 if(state.route==='meetings')return renderMeetings();
 if(state.route==='notes')return renderNotes();
 if(state.route==='bookmarks')return renderBookmarks();
 if(state.route==='highlights')return renderHighlights();
 if(state.route==='tags')return renderTags();
 if(state.route==='backups')return renderBackups();
 if(state.route==='settings')return renderSettings();
 if(state.route==='help')return renderHelp();
 if(state.route==='library')return renderLibrary();
 if(state.route==='reader')return renderReader();
 return renderHome();
}
function pageHeader(title,subtitle='',actions=''){return`<header class="page-header"><div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><div class="page-header-spacer"></div><button class="button global-language" data-action="language">${icon('people',18)} ${esc(state.languageName)}</button>${actions}</header>`}
function cover(item){return item.cover_url?`<img src="${esc(item.cover_url)}" alt="">`:`<span class="recent-cover"></span>`}

async function renderHome(){
 const data=await get(`/api/home?language=${state.languageIndex}`);state.home=data;
 const daily=data.daily_text||{};const day=new Date(`${daily.date}T12:00:00`);const formatted=new Intl.DateTimeFormat(uiLocale()==='en'?'en-US':'de-DE',{weekday:'long',day:'numeric',month:'long'}).format(day);const parts=dailyParts(daily);
 const fav=(data.favorites||[]).slice(0,6);
 const tools=(data.ministry_tools||[]).slice(0,6);
 const newest=(data.newest||[]).slice(0,6);
 const primary=data.meetings?.primary||{};
 const meetings=[primary.life_and_ministry,primary.watchtower].filter(Boolean);
 const dailyBody=daily.available
  ?`<div class="daily-copy"><p class="daily-scripture">${esc(parts.scripture||daily.caption||'')}</p>${parts.comment?`<p class="daily-comment">${esc(parts.comment)}</p>`:''}</div>`
  :`<div class="daily-copy unavailable"><p>${esc(daily.text||'Der Tagestext ist noch nicht lokal verfügbar.')}</p></div>`;
 const dailyAction=daily.available
  ?''
  :daily.download?.catalog_id
   ?`<button class="button primary daily-download" data-download-catalog="${daily.download.catalog_id}">${icon('download',18)} ${esc(daily.download.label||`Tagestext ${daily.download.year||''} herunterladen`)}</button>`
   :`<button class="button daily-download" data-action="sync">${icon('refresh',18)} Katalog aktualisieren</button>`;
 main.innerHTML=`<div class="page home-page">
  <section class="daily-hero daily-hero-full"><div class="calendar-icon">${icon('meetings',22)}</div><h1>${esc(formatted)}</h1>${dailyBody}${dailyAction}</section>
  <section class="section"><div class="section-heading"><h2>${esc(tr('favorites','Favoriten'))}</h2><button data-route="library">${esc(tr('more','Mehr anzeigen'))}</button></div><div class="publication-row favorites-compact">${fav.length?fav.map(item=>publicationCard({...item,cover_url:`/api/publications/${encodeURIComponent(item.id)}/cover`})).join(''):emptyInline('Noch keine Favoriten','Öffne eine Publikation und markiere sie bewusst mit dem Stern.')}</div></section>
  <section class="section ministry-tools-section"><div class="section-heading"><h2>Tools für den Predigtdienst</h2><button data-route="publications">Mehr anzeigen</button></div><div class="publication-row ministry-tools-row">${tools.length?tools.map(item=>publicationCard({...item,cover_url:`/api/publications/${encodeURIComponent(item.id)}/cover`})).join(''):emptyInline('Noch keine Predigtdienst-Tools','Passende Publikationen herunterladen oder importieren.')}</div></section>
  <section class="section"><div class="section-heading"><h2>${esc(tr('newServer','Neu vom Server'))}</h2><button data-action="show-new">${esc(tr('more','Mehr anzeigen'))}</button></div><div class="server-row">${newest.length?newest.map(item=>publicationCard(item,{catalog:true,compact:true})).join(''):emptyInline('Katalog nicht verfügbar','Aktualisiere den offiziellen Katalog.')}</div></section>
  <section class="panel home-meetings-compact"><div class="panel-title"><h2>${esc(tr('meetingsWeek','Zusammenkünfte diese Woche'))}</h2><button data-route="meetings">${esc(tr('fullProgram','Vollständiges Programm anzeigen'))}</button></div><div class="meeting-grid compact">${meetings.length?meetings.map(meetingItem).join(''):`<p class="unavailable">Arbeitsheft oder Wachtturm importieren beziehungsweise herunterladen.</p>`}</div></section>
 </div>`;
}
function quick(name,label,route){return`<button class="quick-card" data-route="${route}">${icon(name,30)}<span>${label}</span></button>`}
function emptyInline(title,text){return`<div class="empty-state" style="grid-column:1/-1;min-height:150px"><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`}
function meetingItem(item,index){const title=cleanLabel(item.article_title||item.title||'Zusammenkunft');const detail=cleanLabel(item.article_subtitle||item.text||item.subtitle||'');const short=detail.length>150?`${detail.slice(0,147).trim()}…`:detail;return`<button class="meeting-item compact" ${item.document_id?`data-document-id="${item.document_id}"`:'data-route="publications"'}><span class="meeting-thumb">${icon(index%2?'people':'publications',25)}</span><span><strong>${esc(title)}</strong>${short?`<small>${esc(short)}</small>`:''}</span><span class="meeting-chevron">›</span></button>`}
function recentItem(item){const url=`/api/publications/${encodeURIComponent(item.id)}/cover`;return`<button class="recent-item" data-publication-id="${esc(item.id)}">${url?`<img src="${url}" alt="">`:'<span class="recent-cover"></span>'}<span><strong>${esc(item.title)}</strong><small>${esc(item.publication_type||'Publikation')}</small></span></button>`}

async function renderCatalogPage(kind){
 const isBible=kind==='bibles';
 const title=isBible?tr('bibleTitle','Bibel'):tr('publicationsTitle','Publikationen');
 const actions=`<div class="toolbar"><button class="button" data-action="import-jwpub">${icon('folder',18)} ${esc(tr('importJwpub','.jwpub importieren'))}</button></div>`;
 if(kind==='publications'){
  main.innerHTML=`<div class="page">${pageHeader(title,tr('catalogSubtitle','Offizieller Katalog und lokale Bibliothek'),actions)}<div class="tabs"><button class="tab active">PUBLIKATIONEN</button><button class="tab" data-route="video">VIDEO</button><button class="tab" data-route="audio">AUDIO</button><button class="tab" data-route="downloads">HERUNTERGELADEN</button></div><div class="category-grid">${categories().map(([name,label,ico])=>`<button class="category-card" data-catalog-kind="${name}">${icon(ico,39)}<span>${label}</span></button>`).join('')}</div><section class="section" style="margin-top:25px"><div class="section-heading"><h2>Aktuelle Publikationen</h2><button data-action="catalog-search">Alle anzeigen</button></div><div id="catalog-results" class="catalog-grid">${skeleton(6)}</div></section></div>`;
  const items=await get(`/api/catalog/publications?language=${state.languageIndex}&newest=1&limit=12`);fillCatalog(items);
 }else{
  main.innerHTML=`<div class="page">${pageHeader(title,tr('bibleSubtitle','Verfügbare Übersetzungen und Bibelteile'),actions)}<div class="tabs"><button class="tab active">${esc(tr('bibleTitle','Bibel').toUpperCase())}</button><button class="tab" data-route="library">${esc(tr('downloaded','Heruntergeladen').toUpperCase())}</button></div><div class="section-heading"><h2>${esc(tr('availableBibles','Verfügbare Bibeln'))}</h2><div class="page-header-spacer"></div><div class="search-field">${icon('search',19)}<input id="catalog-filter" placeholder="${esc(tr('searchBible','Bibel suchen'))}"></div></div><div id="catalog-results" class="catalog-grid">${skeleton(8)}</div></div>`;
  const items=await get(`/api/catalog/publications?language=${state.languageIndex}&kind=bibles&limit=300`);fillCatalog(items);
 }
}
function categories(){return[['books','Bücher','publications'],['brochures','Broschüren und Booklets','notes'],['tracts','Traktate und Einladungen','notes'],['series','Artikelserien','publications'],['watchtower','Wachtturm','publications'],['awake','Erwachet!','warning'],['meeting','Zusammenkunftsarbeitshefte','meetings'],['ministry','Königreichsdienst','people'],['programs','Programme','clock'],['index','Index','publications'],['guidelines','Richtlinien','notes'],['releases','Kongressfreigaben','people']]}
function fillCatalog(items){const root=document.querySelector('#catalog-results');if(root)root.innerHTML=items.length?items.map(item=>publicationCard(item,{catalog:true})).join(''):empty('Keine Inhalte','Für diese Sprache und Kategorie wurden keine Inhalte gefunden.')}

function libraryGroups(items){
 const categories=new Map();
 for(const item of items){
  const key=item.library_category||'other';
  if(!categories.has(key))categories.set(key,{key,label:item.library_category_label||'Weitere Publikationen',order:Number(item.library_category_order||999),years:new Map(),count:0});
  const category=categories.get(key);const yearKey=String(Number(item.library_year||item.year||0));
  if(!category.years.has(yearKey))category.years.set(yearKey,{key:yearKey,label:item.library_year_label||(yearKey==='0'?'Ohne Jahrgang':yearKey),items:[]});
  category.years.get(yearKey).items.push(item);category.count+=1;
 }
 return[...categories.values()].sort((a,b)=>a.order-b.order||a.label.localeCompare(b.label,'de')).map(category=>({...category,years:[...category.years.values()].sort((a,b)=>Number(b.key)-Number(a.key)||a.label.localeCompare(b.label,'de')).map(year=>({...year,items:year.items.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'de',{numeric:true,sensitivity:'base'}))}))}));
}
function libraryTree(groups,selected){
 return`<div class="library-tree" id="library-tree">${groups.map((category,categoryIndex)=>{const categorySelected=category.years.some(year=>year.items.some(item=>String(item.id)===String(selected?.id)));return`<details class="library-category" data-library-category="${esc(category.key)}" ${(categorySelected||categoryIndex===0)?'open':''}><summary><span>${esc(category.label)}</span><b>${category.count}</b></summary><div class="library-category-body">${category.years.map((year,yearIndex)=>{const yearSelected=year.items.some(item=>String(item.id)===String(selected?.id));return`<details class="library-year" data-library-year="${esc(year.key)}" ${(yearSelected||(categoryIndex===0&&yearIndex===0))?'open':''}><summary><span>${esc(year.label)}</span><b>${year.items.length}</b></summary><div class="library-year-items">${year.items.map(item=>libraryListItem(item,String(selected?.id)===String(item.id))).join('')}</div></details>`}).join('')}</div></details>`}).join('')}</div><p class="library-filter-empty" id="library-filter-empty" hidden>Keine passende Publikation gefunden.</p>`;
}
function libraryDocumentGroups(documents){
 const groups=new Map();
 for(const item of documents){const section=Number(item.section_number||0);if(!groups.has(section))groups.set(section,[]);groups.get(section).push(item)}
 return[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([section,items])=>({section,items}));
}
function libraryToc(documents){
 const groups=libraryDocumentGroups(documents);let position=0;
 return groups.map(group=>{const showHeading=groups.length>1||group.section>0;const items=group.items.map(item=>{position+=1;const chapter=Number(item.chapter_number||0);const number=chapter>0?String(chapter).padStart(2,'0'):String(position).padStart(2,'0');const subtitle=item.subtitle||`${Number(item.paragraph_count||0)} Absätze`;return`<button class="book-toc-item" data-document-id="${item.id}"><span>${esc(number)}</span><div><strong>${esc(item.toc_title||item.title||`Kapitel ${position}`)}</strong><small>${esc(subtitle)}</small></div>${icon('arrow',18)}</button>`}).join('');return`${showHeading?`<h3 class="book-toc-section">${group.section>0?`Teil ${group.section}`:'Einleitung'}</h3>`:''}${items}`}).join('');
}
function libraryMeta(item){
 const values=[item.library_category_label,item.library_edition_label,item.language_vernacular||item.language_name,item.key_symbol?String(item.key_symbol).toUpperCase():''].filter(Boolean);
 return`<div class="book-meta">${values.map(value=>`<span>${esc(value)}</span>`).join('')}</div>`;
}
function bindLibraryFilter(){
 const input=document.querySelector('#library-filter');if(!input)return;
 input.oninput=event=>{const query=String(event.target.value||'').trim().toLocaleLowerCase('de');let visible=0;document.querySelectorAll('.library-list-item').forEach(item=>{const matches=!query||String(item.dataset.librarySearch||'').includes(query);item.hidden=!matches;if(matches)visible+=1});document.querySelectorAll('.library-year').forEach(group=>{const matches=[...group.querySelectorAll('.library-list-item')].some(item=>!item.hidden);group.hidden=!matches;if(query&&matches)group.open=true});document.querySelectorAll('.library-category').forEach(group=>{const matches=[...group.querySelectorAll('.library-list-item')].some(item=>!item.hidden);group.hidden=!matches;if(query&&matches)group.open=true});const emptyNode=document.querySelector('#library-filter-empty');if(emptyNode)emptyNode.hidden=visible>0};
}

async function renderLibrary(selectedId=null){
 state.library=await get('/api/library');
 const wanted=selectedId||state.selectedPublication;const selected=state.library.find(item=>String(item.id)===String(wanted))||state.library[0];state.selectedPublication=selected?.id||null;
 const documents=selected?await get(`/api/publications/${encodeURIComponent(selected.id)}/documents`):[];const groups=libraryGroups(state.library);const categoryCount=groups.length;
 const actions=`<button class="button" data-action="import-jwpub">${icon('folder',18)} Publikation importieren</button>`;
 const readerActions=selected?`<div class="book-pane-actions">${documents[0]?`<button class="button primary" data-document-id="${documents[0].id}">${icon('read',18)} Lesen</button>`:''}<button class="button ${selected.favorite?'favorite-active':''}" data-action="favorite" data-id="${esc(selected.id)}" data-value="${selected.favorite?0:1}">${icon('star',18)} ${selected.favorite?'Favorit entfernen':'Als Favorit'}</button><button class="button" data-remove-publication="${esc(selected.id)}">Entfernen</button></div>`:'';
 const toc=documents.length?`<div class="book-toc">${libraryToc(documents)}</div>`:empty('Kein Inhaltsverzeichnis','Diese Publikation enthält noch keine lesbaren Dokumente.');
 main.innerHTML=`<div class="page">${pageHeader('Meine Bibliothek',`${state.library.length} installierte Publikationen in ${categoryCount} Bereichen`,actions)}${state.library.length?`<div class="library-layout"><aside class="library-list"><div class="library-list-header"><div class="search-field">${icon('search',18)}<input id="library-filter" placeholder="Titel, Jahrgang oder Kategorie suchen"></div></div>${libraryTree(groups,selected)}</aside><section class="document-pane book-pane"><header class="book-pane-header">${selected?.cover_url?`<img src="${esc(selected.cover_url)}" alt="Cover von ${esc(selected.title||'Publikation')}">`:'<span class="book-pane-cover"></span>'}<div class="book-pane-title"><small>Inhaltsverzeichnis</small><h2>${esc(selected?.title||'')}</h2><p>${documents.length} ${documents.length===1?'Kapitel':'Kapitel und Themen'}</p>${selected?libraryMeta(selected):''}</div>${readerActions}</header>${toc}</section></div>`:empty('Die Bibliothek ist leer','Importiere eine .jwpub-Datei oder lade eine Publikation aus dem Katalog herunter.',`<button class="button primary" data-action="import-jwpub">.jwpub importieren</button>`)}</div>`;
 bindLibraryFilter();
}

function libraryListItem(item,active){const url=item.cover_url;const edition=item.library_edition_label||item.library_year_label||'';const details=[edition,item.language_vernacular||item.language_name||''].filter(Boolean).join(' · ');const search=String(item.library_search||[item.title,item.short_title,item.key_symbol,item.library_category_label,details].filter(Boolean).join(' ')).toLocaleLowerCase('de');return`<button class="library-list-item ${active?'active':''}" data-publication-id="${esc(item.id)}" data-library-search="${esc(search)}">${url?`<img src="${esc(url)}" alt="">`:'<span class="library-mini-cover"></span>'}<span><strong>${esc(item.title)}</strong><small>${esc(details||item.publication_type||'Publikation')}</small></span></button>`}

function documentItem(item){return`<button class="document-item" data-document-id="${item.id}"><strong>${esc(item.toc_title||item.title)}</strong><small>${esc(item.subtitle||`${item.paragraph_count||0} Absätze`)}</small></button>`}

async function renderReader(){
 const data=await get(`/api/documents/${state.selectedDocument}/study`);const doc=data.document;
 await post('/api/open-document',{document_id:state.selectedDocument});state.readerData=data;
 const index=data.navigation.findIndex(item=>Number(item.id)===Number(doc.id));const prev=data.navigation[index-1],next=data.navigation[index+1];
 main.innerHTML=`<div class="reader-page"><section class="reader-main"><header class="reader-toolbar"><button class="icon-button" data-route="library">${icon('arrow',21)}</button><div class="reader-title"><strong>${esc(doc.publication_title)}</strong><small>${esc(doc.toc_title||doc.title)}</small></div><span class="spacer"></span><button class="icon-button" ${prev?`data-document-id="${prev.id}"`:''} title="Vorheriges Kapitel" ${prev?'':'disabled'}>${icon('arrow',18)}</button><button class="icon-button" ${next?`data-document-id="${next.id}"`:''} title="Nächstes Kapitel" ${next?'':'disabled'} style="transform:rotate(180deg)">${icon('arrow',18)}</button><button class="icon-button" data-action="reader-font" title="Schriftgröße">Aa</button><button class="icon-button" data-action="new-note" title="Notiz">${icon('notes')}</button><button class="icon-button" data-action="reader-bookmark" title="Lesezeichen">${icon('bookmark')}</button><button class="icon-button" data-action="reader-toc" title="Inhalt">${icon('publications')}</button></header><iframe class="reader-frame" id="reader-frame" src="/api/documents/${doc.id}/render" title="${esc(doc.title)}"></iframe></section><aside class="study-panel"><div class="study-tabs"><button class="study-tab active" data-study-tab="notes">Notizen <b>${data.notes.length}</b></button><button class="study-tab" data-study-tab="highlights">Markierungen <b>${data.marks.length}</b></button><button class="study-tab" data-study-tab="questions">Fragen <b>${data.questions.length}</b></button><button class="study-tab" data-study-tab="bookmarks">Lesezeichen <b>${data.bookmarks.length}</b></button><button class="study-tab" data-study-tab="fields">Antworten <b>${data.input_fields?.length||0}</b></button></div><div class="study-content" id="study-content">${studyPanel('notes',data)}</div></aside></div>`;
}
function studyPanel(tab,data=state.readerData){if(!data)return'';if(tab==='notes')return data.notes.length?data.notes.map(noteCardMini).join(''):empty('Keine Notizen','Markiere Text oder erstelle eine Notiz.',`<button class="button" data-action="new-note">Notiz erstellen</button>`);if(tab==='highlights')return data.marks.length?data.marks.map(item=>`<article class="study-note"><div class="mark-swatch mark-${Number(item.color_index||0)%5}"></div><h4>Markierung</h4><p>Absatz ${item.block_identifier??'–'}${item.start_token!=null?` · Token ${item.start_token}–${item.end_token}`:''}</p>${String(item.id).includes(':')?'':`<button class="text-button" data-delete-mark="${item.id}">Entfernen</button>`}</article>`).join(''):empty('Keine Markierungen','Wähle Text im Reader aus und lege eine Farbe fest.');if(tab==='questions')return data.questions.length?data.questions.map(item=>`<article class="study-note question-card">${item.content_html||''}</article>`).join(''):empty('Keine Studienfragen','Dieses Dokument enthält keine Fragen.');if(tab==='fields')return (data.input_fields||[]).length?data.input_fields.map(item=>`<article class="study-note"><h4>${esc(item.text_tag)}</h4><textarea data-input-field="${esc(item.text_tag)}">${esc(item.value||'')}</textarea></article>`).join(''):empty('Keine Studienantworten','Antwortfelder in unterstützten Publikationen werden automatisch gespeichert.');if(tab==='bookmarks')return data.bookmarks.length?data.bookmarks.map(item=>`<article class="study-note bookmark-card"><button class="bookmark-open" data-open-bookmark="${item.document_id||''}" data-bookmark-block="${item.block_identifier??''}"><h4>${esc(item.title||'Lesezeichen')}</h4><p>${esc(item.snippet||'')}</p></button>${item.source==='local'?`<button class="text-button" data-delete-bookmark="${item.id}">Entfernen</button>`:''}</article>`).join(''):empty('Keine Lesezeichen','Setze oben ein Lesezeichen für diese Stelle.');return''}
function noteCardMini(note){return`<article class="study-note"><h4>${esc(note.title||'Notiz')}</h4><p>${esc(note.content||'')}</p>${note.tags?`<small>${esc(note.tags)}</small>`:''}${note.source==='local'?`<button class="text-button" data-delete-note="${note.id}">Löschen</button>`:''}</article>`}

async function renderMedia(type){
 const title=type==='video'?'Video':'Audio';
 const media=await get(`/api/media?type=${type}`);
 main.innerHTML=`<div class="page">${pageHeader(title,`${media.length} lokal verfügbare Mediendateien`,'')}<div class="tabs"><button class="tab" data-route="publications">PUBLIKATIONEN</button><button class="tab ${type==='video'?'active':''}" data-route="video">VIDEO</button><button class="tab ${type==='audio'?'active':''}" data-route="audio">AUDIO</button><button class="tab" data-route="downloads">HERUNTERGELADEN</button></div>${media.length?`<div class="catalog-grid">${media.map(item=>`<article class="publication-card"><button class="cover-button" data-media-url="${esc(item.url)}" data-media-key="${esc(item.media_key||item.url)}" data-publication-id-media="${esc(item.publication_id||'')}" data-file-path="${esc(item.file_path||'')}">${item.preview?`<img src="${esc(item.preview)}" alt="">`:`<span class="cover-placeholder">${icon(type,40)}</span>`}</button><div class="publication-card-body"><strong>${esc(item.label||item.file_path)}</strong><small>${esc(item.publication_title||item.mime_type)}</small></div></article>`).join('')}</div>`:empty(`Keine ${title}-Dateien`,`Importierte Publikationen mit ${title}-Inhalten werden hier automatisch angezeigt.`)}</div>`;
}


const BIBLE_UI_KEY='limad-bible-workspace-v2';
function bibleUiState(){
 const fallback={tabs:[],activeTab:0,section:'books',query:'',notesOpen:false,focus:false,split:false,comparePublicationId:'',favoriteBooks:[],recent:[]};
 try{return {...fallback,...JSON.parse(storageGet(BIBLE_UI_KEY,'{}'))}}catch{return fallback}
}
function saveBibleUi(next){storageSet(BIBLE_UI_KEY,JSON.stringify(next));return next}
function bibleTabKey(tab){return `${tab.publicationId}:${tab.book}:${tab.chapter}`}
function normalizeBibleTabs(ui,primary,bookNumber,chapterNumber,bookTitle){
 const current={publicationId:primary.id,publicationTitle:primary.title,book:Number(bookNumber),chapter:Number(chapterNumber),bookTitle:String(bookTitle||'Bibel')};
 let tabs=Array.isArray(ui.tabs)?ui.tabs.filter(x=>x&&x.publicationId&&Number(x.book)>0&&Number(x.chapter)>0):[];
 if(!tabs.length)tabs=[current];
 let active=Math.min(Math.max(Number(ui.activeTab)||0,0),tabs.length-1);
 const activeItem=tabs[active];
 if(!activeItem||activeItem.publicationId!==current.publicationId||Number(activeItem.book)!==current.book||Number(activeItem.chapter)!==current.chapter){
  tabs[active]=current;
 }
 return {...ui,tabs,activeTab:active};
}
function bibleLocationLabel(tab){return `${tab.bookTitle||'Buch '+tab.book} ${tab.chapter}`}
function bibleRecentPush(ui,tab){
 const item={...tab,openedAt:new Date().toISOString()};
 const recent=[item,...(Array.isArray(ui.recent)?ui.recent:[]).filter(x=>bibleTabKey(x)!==bibleTabKey(item))].slice(0,12);
 return {...ui,recent};
}
function bibleBookFromSearch(item,books){
 const text=`${item.title||''} ${item.snippet||''}`.toLowerCase();
 const book=[...books].sort((a,b)=>String(b.title).length-String(a.title).length).find(x=>text.includes(String(x.title||'').toLowerCase()));
 if(!book)return null;
 const patterns=[new RegExp(`${String(book.title).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+(\\d{1,3})`,'i'),/kapitel\s+(\d{1,3})/i];
 let chapter=Number(item.chapter_number||0);
 for(const pattern of patterns){const match=text.match(pattern);if(match){chapter=Number(match[1]);break}}
 if(!book.chapters?.some(x=>Number(x.chapter_number)===chapter))chapter=Number(book.chapters?.[0]?.chapter_number||1);
 return {book:Number(book.book_number),chapter,bookTitle:book.title};
}
function bibleSidebarBookList(books,bookNumber,favorites){
 return books.map(book=>`<button class="bible-v2-book ${Number(book.book_number)===Number(bookNumber)?'active':''}" data-bible-book="${book.book_number}"><span>${esc(book.title)}</span><small>${book.chapter_count||book.chapters?.length||0}</small><i class="bible-v2-favorite ${favorites.includes(Number(book.book_number))?'active':''}" data-bible-favorite="${book.book_number}" title="Favorit">★</i></button>`).join('')
}
function bibleNotesPanel(study){
 if(!study)return '<div class="bible-v2-empty">Studieninformationen werden geladen.</div>';
 const notes=(study.notes||[]).map(note=>`<article><strong>${esc(note.title||'Notiz')}</strong><p>${esc(note.content||'')}</p></article>`).join('');
 const marks=(study.marks||[]).map(mark=>`<article><span class="mark-swatch mark-${Number(mark.color_index||0)%5}"></span><strong>Markierung</strong><p>Vers/Absatz ${mark.block_identifier??'–'}</p></article>`).join('');
 const bookmarks=(study.bookmarks||[]).map(item=>`<article><strong>${esc(item.title||'Lesezeichen')}</strong><p>${esc(item.snippet||'')}</p></article>`).join('');
 return `${notes||'<div class="bible-v2-empty">Noch keine Notizen in diesem Kapitel.</div>'}${marks}${bookmarks}`
}
function ensureBibleMessageBridge(){
 if(window.__LIMAD_BIBLE_BRIDGE)return;
 window.__LIMAD_BIBLE_BRIDGE=true;
 window.addEventListener('message',async event=>{
  if(event.origin!==location.origin)return;
  const data=event.data||{};
  if(data.type!=='limad-bible-verse-action')return;
  const documentId=Number(data.documentId||state.selectedDocument||0);if(!documentId)return;
  const blockIdentifier=Number(data.blockIdentifier||0)||null;
  const text=String(data.text||'').trim();
  try{
   if(data.action==='note'){openNoteDialog({document_id:documentId,block_identifier:blockIdentifier,content:text});return}
   if(data.action==='bookmark'){await post('/api/bookmarks',{document_id:documentId,title:data.reference||state.readerData?.document?.title||'Bibelstelle',snippet:text,block_identifier:blockIdentifier});toast('Bibelstelle als Lesezeichen gespeichert.');await renderBible();return}
   if(data.action==='highlight'){await post('/api/marks',{document_id:documentId,block_identifier:blockIdentifier,start_token:null,end_token:null,color_index:Number(data.colorIndex||0)});toast('Vers markiert.');await renderBible();return}
   const shareText=`${data.reference||state.readerData?.document?.title||'Bibelstelle'}\n${text}`.trim();
   if(data.action==='share'&&navigator.share){await navigator.share({title:data.reference||'Bibelstelle',text:shareText});return}
   if(data.action==='copy'||data.action==='share'){await navigator.clipboard.writeText(shareText);toast('Bibelstelle kopiert.');return}
  }catch(error){toast(error.message||String(error),'error')}
 });
}

async function renderBible(){
 ensureBibleMessageBridge();
 const installed=await get(`/api/bibles?language=${state.languageIndex}`);
 const catalog=await get(`/api/catalog/publications?language=${state.languageIndex}&kind=bibles&limit=300`);
 const actions=`<div class="toolbar"><button class="button" data-action="import-jwpub">${icon('folder',18)} .jwpub importieren</button><button class="button" data-action="bible-catalog">${icon('plus',18)} Bibel hinzufügen</button></div>`;
 if(!installed.length){main.innerHTML=`<div class="page">${pageHeader('Bibel','Bibelübersetzung auswählen und herunterladen',actions)}<div class="catalog-grid">${catalog.map(item=>publicationCard(item,{catalog:true})).join('')||empty('Keine Bibel gefunden','Für diese Sprache ist keine Bibel im Katalog vorhanden.')}</div></div>`;return}
 const view=await get(`/api/bibles/view-state?language=${state.languageIndex}`);
 let ui=bibleUiState();
 const storedTab=ui.tabs?.[Math.min(Math.max(Number(ui.activeTab)||0,0),Math.max((ui.tabs?.length||1)-1,0))];
 const primary=installed.find(x=>x.id===(storedTab?.publicationId||view.primary_publication_id))||installed[0];
 const navigation=await get(`/api/bibles/${encodeURIComponent(primary.id)}/navigation`);
 const books=navigation.books||[];
 const requestedBook=Number(storedTab?.book||view.book_number);
 const bookNumber=books.some(x=>Number(x.book_number)===requestedBook)?requestedBook:Number(books[0]?.book_number||1);
 const selectedBook=books.find(x=>Number(x.book_number)===bookNumber)||books[0];
 const requestedChapter=Number(storedTab?.chapter||view.chapter_number);
 const chapterNumber=selectedBook?.chapters?.some(x=>Number(x.chapter_number)===requestedChapter)?requestedChapter:Number(selectedBook?.chapters?.[0]?.chapter_number||1);
 const selectedChapter=selectedBook?.chapters?.find(x=>Number(x.chapter_number)===chapterNumber);
 let chapterData=null,studyData=null;
 if(primary&&selectedChapter?.available!==false){
  chapterData=await get(`/api/bibles/${encodeURIComponent(primary.id)}/chapter/${bookNumber}/${chapterNumber}`);
  state.selectedDocument=Number(chapterData.document_id);
  state.readerData={document:{id:state.selectedDocument,title:chapterData.title,toc_title:chapterData.title,publication_title:primary.title},position:{scroll_ratio:0,block_identifier:null}};
  try{studyData=await get(`/api/documents/${state.selectedDocument}/study`);state.readerData=studyData}catch{}
 }
 ui=normalizeBibleTabs(ui,primary,bookNumber,chapterNumber,selectedBook?.title);
 ui=bibleRecentPush(ui,ui.tabs[ui.activeTab]);
 ui.split=Boolean(view.split_enabled)||Boolean(ui.split);
 ui.comparePublicationId=installed.some(x=>x.id===ui.comparePublicationId)?ui.comparePublicationId:(view.compare_publication_id||installed.find(x=>x.id!==primary.id)?.id||'');
 saveBibleUi(ui);
 const hebrew=books.filter(x=>x.testament==='hebrew'),greek=books.filter(x=>x.testament==='greek');
 const chapterButtons=(selectedBook?.chapters||[]).map(x=>`<button class="bible-v2-chapter ${Number(x.chapter_number)===chapterNumber?'active':''} ${x.available===false?'unavailable':''}" data-bible-chapter="${x.chapter_number}">${x.chapter_number}</button>`).join('');
 const tabs=ui.tabs.map((tab,index)=>`<button class="bible-v2-tab ${index===ui.activeTab?'active':''}" data-bible-tab="${index}"><span>${esc(bibleLocationLabel(tab))}</span>${ui.tabs.length>1?`<i data-bible-tab-close="${index}">×</i>`:''}</button>`).join('');
 const favorites=(ui.favoriteBooks||[]).map(number=>books.find(x=>Number(x.book_number)===Number(number))).filter(Boolean);
 const recent=(ui.recent||[]).slice(0,6);
 const bookmarks=(studyData?.bookmarks||[]);
 const prevChapter=chapterNumber>Number(selectedBook?.chapters?.[0]?.chapter_number||1)?chapterNumber-1:null;
 const nextChapter=selectedBook?.chapters?.some(x=>Number(x.chapter_number)===chapterNumber+1)?chapterNumber+1:null;
 const compareId=ui.comparePublicationId;
 const compareFrame=ui.split&&compareId?`<iframe class="reader-frame bible-frame bible-v2-frame" src="/api/bibles/${encodeURIComponent(compareId)}/chapter/${bookNumber}/${chapterNumber}/render" title="Vergleichsansicht"></iframe>`:'';
 main.innerHTML=`<div class="page bible-v2 bible-columns-layout ${ui.focus?'focus':''}" data-bible-layout="columns">
  ${pageHeader('Bibel','Lesen, vergleichen und persönlich studieren',actions)}
  <div class="bible-v2-tabs">${tabs}<button class="bible-v2-tab-add" data-bible-tab-add title="Neue Bibelstelle öffnen">+</button></div>
  <div class="bible-v2-toolbar glass-panel">
   <button class="icon-button" data-bible-prev ${prevChapter?'':'disabled'} title="Vorheriges Kapitel">${icon('back',18)}</button>
   <div class="bible-v2-crumb"><strong>${esc(selectedBook?.title||'Bibel')} ${chapterNumber}</strong><small>${esc(primary.title)}</small></div>
   <button class="icon-button" data-bible-next ${nextChapter?'':'disabled'} title="Nächstes Kapitel">${icon('forward',18)}</button>
   <span class="spacer"></span>
   <button class="button secondary" data-bible-focus>${ui.focus?'Navigation zeigen':'Lesemodus'}</button>
   <button class="button secondary" data-bible-notes>${ui.notesOpen?'Notizen schließen':'Notizen'}</button>
   <label class="bible-v2-split-toggle"><input type="checkbox" id="bible-split" ${ui.split?'checked':''}> Split View</label>
  </div>
  <div class="bible-v2-grid">
   <aside class="bible-v2-sidebar glass-panel">
    <div class="bible-v2-side-tabs"><button class="${ui.section==='books'?'active':''}" data-bible-section="books">Bücher</button><button class="${ui.section==='favorites'?'active':''}" data-bible-section="favorites">Favoriten</button><button class="${ui.section==='recent'?'active':''}" data-bible-section="recent">Zuletzt</button><button class="${ui.section==='bookmarks'?'active':''}" data-bible-section="bookmarks">Lesezeichen</button></div>
    <div class="bible-v2-side-content">
     ${ui.section==='books'?`<h3>Hebräisch-Aramäisch</h3>${bibleSidebarBookList(hebrew,bookNumber,ui.favoriteBooks||[])}<h3>Christlich-Griechisch</h3>${bibleSidebarBookList(greek,bookNumber,ui.favoriteBooks||[])}`:''}
     ${ui.section==='favorites'?(favorites.length?bibleSidebarBookList(favorites,bookNumber,ui.favoriteBooks||[]):'<div class="bible-v2-empty">Noch keine Lieblingsbücher. Klicke bei einem Buch auf ★.</div>'):''}
     ${ui.section==='recent'?(recent.length?recent.map((item,index)=>`<button class="bible-v2-location" data-bible-recent="${index}"><strong>${esc(bibleLocationLabel(item))}</strong><small>${esc(item.publicationTitle||'')}</small></button>`).join(''):'<div class="bible-v2-empty">Noch keine zuletzt geöffneten Stellen.</div>'):''}
     ${ui.section==='bookmarks'?(bookmarks.length?bookmarks.map(item=>`<button class="bible-v2-location" data-bible-bookmark-block="${item.block_identifier??''}"><strong>${esc(item.title||'Lesezeichen')}</strong><small>${esc(item.snippet||'')}</small></button>`).join(''):'<div class="bible-v2-empty">In diesem Kapitel gibt es noch keine Lesezeichen.</div>'):''}
    </div>
   </aside>
   <aside class="bible-v2-chapters glass-panel">
    <div class="bible-v2-search"><span>${icon('search',18)}</span><input id="bible-v2-search" value="${esc(ui.query||'')}" placeholder="Bibelstelle oder Begriff suchen"></div>
    <div id="bible-v2-search-results" class="bible-v2-search-results"></div>
    <div class="bible-v2-chapter-head"><div><strong>${esc(selectedBook?.title||'')}</strong><small>${selectedBook?.chapters?.length||0} Kapitel</small></div><select id="bible-primary" class="select">${installed.map(x=>`<option value="${esc(x.id)}" ${primary.id===x.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></div>
    <div class="bible-v2-chapter-grid">${chapterButtons}</div>
    ${ui.split?`<div class="bible-v2-compare"><label>Vergleichsübersetzung</label><select id="bible-compare" class="select"><option value="">Auswählen</option>${installed.filter(x=>x.id!==primary.id).map(x=>`<option value="${esc(x.id)}" ${compareId===x.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></div>`:''}
   </aside>
   <section class="bible-v2-reader glass-panel ${ui.notesOpen?'with-notes':''}">
    ${primary&&selectedChapter?.available!==false?`<div class="bible-v2-reading-panes ${ui.split&&compareId?'split':''}"><iframe class="reader-frame bible-frame bible-v2-frame" id="reader-frame" src="/api/bibles/${encodeURIComponent(primary.id)}/chapter/${bookNumber}/${chapterNumber}/render" title="${esc(selectedBook.title)} ${chapterNumber}"></iframe>${compareFrame}</div>`:empty('Bibeltext für dieses Kapitel noch nicht verfügbar','Das Kapitel ist in dieser Bibelübersetzung nicht vorhanden.')}
    <aside class="bible-v2-notes"><header><strong>Notizen & Markierungen</strong><button class="icon-button" data-bible-notes>×</button></header><div>${bibleNotesPanel(studyData)}</div><button class="button primary" data-action="new-note">Notiz erstellen</button></aside>
   </section>
  </div>
 </div>`;
 const go=async values=>{
  const targetPrimary=values.primary??primary.id,targetBook=Number(values.book??bookNumber),targetChapter=Number(values.chapter??chapterNumber);
  let nextUi=bibleUiState();const active=Math.min(Math.max(Number(nextUi.activeTab)||0,0),Math.max((nextUi.tabs?.length||1)-1,0));
  const book=books.find(x=>Number(x.book_number)===targetBook);
  nextUi.tabs=Array.isArray(nextUi.tabs)&&nextUi.tabs.length?nextUi.tabs:[{}];
  nextUi.tabs[active]={publicationId:targetPrimary,publicationTitle:installed.find(x=>x.id===targetPrimary)?.title||primary.title,book:targetBook,chapter:targetChapter,bookTitle:book?.title||selectedBook?.title};
  nextUi.activeTab=active;saveBibleUi(nextUi);
  await post('/api/bibles/view-state',{language_index:state.languageIndex,primary_publication_id:targetPrimary,compare_publication_id:nextUi.comparePublicationId||null,book_number:targetBook,chapter_number:targetChapter,split_enabled:Boolean(nextUi.split)});
  renderBible()
 };
 document.querySelector('#bible-primary')?.addEventListener('change',event=>go({primary:event.target.value,book:1,chapter:1}));
 document.querySelectorAll('[data-bible-book]').forEach(button=>button.addEventListener('click',event=>{if(event.target.closest('[data-bible-favorite]'))return;const book=books.find(x=>Number(x.book_number)===Number(button.dataset.bibleBook));go({book:Number(button.dataset.bibleBook),chapter:Number(book?.chapters?.[0]?.chapter_number||1)})}));
 document.querySelectorAll('[data-bible-chapter]').forEach(button=>button.addEventListener('click',()=>go({chapter:Number(button.dataset.bibleChapter)})));
 document.querySelector('[data-bible-prev]')?.addEventListener('click',()=>prevChapter&&go({chapter:prevChapter}));
 document.querySelector('[data-bible-next]')?.addEventListener('click',()=>nextChapter&&go({chapter:nextChapter}));
 document.querySelectorAll('[data-bible-section]').forEach(button=>button.addEventListener('click',()=>{const next=bibleUiState();next.section=button.dataset.bibleSection;saveBibleUi(next);renderBible()}));
 document.querySelectorAll('[data-bible-favorite]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const number=Number(button.dataset.bibleFavorite),next=bibleUiState(),list=new Set((next.favoriteBooks||[]).map(Number));list.has(number)?list.delete(number):list.add(number);next.favoriteBooks=[...list];saveBibleUi(next);renderBible()}));
 document.querySelectorAll('[data-bible-recent]').forEach(button=>button.addEventListener('click',()=>{const item=bibleUiState().recent?.[Number(button.dataset.bibleRecent)];if(item)go({primary:item.publicationId,book:item.book,chapter:item.chapter})}));
 document.querySelectorAll('[data-bible-bookmark-block]').forEach(button=>button.addEventListener('click',()=>{state.pendingBlockIdentifier=button.dataset.bibleBookmarkBlock||null;document.querySelector('#reader-frame')?.contentWindow?.postMessage({type:'limad-restore',scrollRatio:0,blockIdentifier:state.pendingBlockIdentifier},location.origin)}));
 document.querySelector('[data-bible-focus]')?.addEventListener('click',()=>{const next=bibleUiState();next.focus=!next.focus;saveBibleUi(next);renderBible()});
 document.querySelectorAll('[data-bible-notes]').forEach(button=>button.addEventListener('click',()=>{const next=bibleUiState();next.notesOpen=!next.notesOpen;saveBibleUi(next);renderBible()}));
 document.querySelector('#bible-split')?.addEventListener('change',async event=>{const next=bibleUiState();next.split=event.target.checked;saveBibleUi(next);await post('/api/bibles/view-state',{language_index:state.languageIndex,primary_publication_id:primary.id,compare_publication_id:next.comparePublicationId||null,book_number:bookNumber,chapter_number:chapterNumber,split_enabled:next.split});renderBible()});
 document.querySelector('#bible-compare')?.addEventListener('change',async event=>{const next=bibleUiState();next.comparePublicationId=event.target.value;saveBibleUi(next);await post('/api/bibles/view-state',{language_index:state.languageIndex,primary_publication_id:primary.id,compare_publication_id:next.comparePublicationId||null,book_number:bookNumber,chapter_number:chapterNumber,split_enabled:next.split});renderBible()});
 document.querySelectorAll('[data-bible-tab]').forEach(button=>button.addEventListener('click',event=>{if(event.target.closest('[data-bible-tab-close]'))return;const next=bibleUiState();next.activeTab=Number(button.dataset.bibleTab);saveBibleUi(next);renderBible()}));
 document.querySelectorAll('[data-bible-tab-close]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const next=bibleUiState(),index=Number(button.dataset.bibleTabClose);next.tabs.splice(index,1);next.activeTab=Math.max(0,Math.min(next.activeTab,next.tabs.length-1));saveBibleUi(next);renderBible()}));
 document.querySelector('[data-bible-tab-add]')?.addEventListener('click',()=>{const next=bibleUiState();next.tabs=[...(next.tabs||[]),{publicationId:primary.id,publicationTitle:primary.title,book:bookNumber,chapter:chapterNumber,bookTitle:selectedBook.title}];next.activeTab=next.tabs.length-1;saveBibleUi(next);renderBible()});
 const searchInput=document.querySelector('#bible-v2-search'),results=document.querySelector('#bible-v2-search-results');
 const runSearch=debounce(async()=>{const query=searchInput.value.trim(),next=bibleUiState();next.query=query;saveBibleUi(next);if(query.length<2){results.innerHTML='';return}results.innerHTML='<div class="bible-v2-empty">Suche läuft …</div>';try{const items=await get(`/api/bibles/search?q=${encodeURIComponent(query)}&language=${state.languageIndex}&publication_id=${encodeURIComponent(primary.id)}`);results.innerHTML=items.length?items.slice(0,40).map((item,index)=>{const location=bibleBookFromSearch(item,books);return `<button class="bible-v2-search-result" data-bible-search-index="${index}"><strong>${esc(item.title||location?.bookTitle||'Fundstelle')}</strong><span>${item.snippet||''}</span></button>`}).join(''):'<div class="bible-v2-empty">Keine Treffer gefunden.</div>';results.__items=items}catch(error){results.innerHTML=`<div class="bible-v2-empty">${esc(error.message)}</div>`}},260);
 searchInput?.addEventListener('input',runSearch);if((ui.query||'').length>=2)runSearch();
 results?.addEventListener('click',event=>{const button=event.target.closest('[data-bible-search-index]');if(!button)return;const item=results.__items?.[Number(button.dataset.bibleSearchIndex)],location=item&&bibleBookFromSearch(item,books);if(location)go(location);else if(item?.document_id)openDocument(item.document_id)});
 document.querySelector('[data-bible-remove]')?.addEventListener('click',async event=>{const publicationId=event.currentTarget.dataset.bibleRemove;if(!window.confirm(`Bibel wirklich entfernen?\n\n${primary.title}\n\nDie lokale Bibel und ihre importierten Inhalte werden gelöscht.`))return;await del(`/api/publications/${encodeURIComponent(publicationId)}`);toast('Bibel entfernt.');await renderBible()});
}

async function renderMediaPageFallback(){}
function formatDate(value){if(!value)return'';const date=new Date(value.length===10?`${value}T12:00:00`:value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date)}
function cleanLabel(value){const node=document.createElement('textarea');node.innerHTML=String(value||'').replace(/<[^>]*>/g,' ');return node.value.replace(/\s+/g,' ').trim()}

async function openPublication(id){state.selectedPublication=id;await navigate('library',{selectedPublication:id})}
async function openDocument(id){state.selectedDocument=Number(id);await navigate('reader',{selectedDocument:Number(id)})}
async function renderDownloads(){
 const jobs=await get('/api/downloads');
 main.innerHTML=`<div class="page">${pageHeader('Downloads','Heruntergeladene Publikationen direkt öffnen',`<button class="button primary" data-route="publications">${icon('plus',18)} Inhalte suchen</button>`)}${jobs.length?`<div class="download-list">${jobs.map(job=>{const progress=Number(job.progress||0);const speed=Number(job.speed_bps||0);return`<article class="download-card"><div class="download-main"><strong>${esc(job.title)}</strong><small>${formatBytes(job.received_size)} von ${formatBytes(job.expected_size)}${speed?` · ${formatBytes(speed)}/s`:''}</small><div class="progress"><span style="width:${Math.min(100,progress)}%"></span></div></div><div class="download-status"><span class="status ${esc(job.status)}">${esc(job.status_label||job.status)}</span>${job.error?`<small>${esc(job.error)}</small>`:''}</div><div class="download-actions">${job.can_open?`<button class="button primary" data-publication-id="${esc(job.installed_id)}">${icon('read',18)} Öffnen</button>`:''}${job.can_retry?`<button class="button" data-retry-download="${job.id}">Erneut</button>`:''}${job.can_cancel?`<button class="button" data-cancel-download="${job.id}">Abbrechen</button>`:''}${job.can_remove?`<button class="button danger" data-remove-download="${job.id}">Entfernen</button>`:''}</div></article>`}).join('')}</div>`:empty('Keine Downloads','Wähle eine Publikation im offiziellen Katalog aus.')}</div>`;
 if(jobs.some(job=>['queued','downloading','verifying','importing'].includes(job.status)))setTimeout(()=>state.route==='downloads'&&renderDownloads(),900)
}
async function renderMeetings(){
 const data=await get(`/api/meetings?offset=${state.meetingOffset||0}&language=${state.languageIndex}`);
 const actions=`<div class="toolbar"><button class="button" data-meeting-offset="${data.offset-1}">${icon('back',18)} Vorherige Woche</button><button class="button" data-meeting-offset="0">Diese Woche</button><button class="button" data-meeting-offset="${data.offset+1}">Nächste Woche ${icon('forward',18)}</button></div>`;
 const primary=data.primary||{},life=primary.life_and_ministry||null,watchtower=primary.watchtower||null;
 const primaryCard=(item,label,kind)=>{if(!item)return`<article class="meeting-primary-card missing"><div class="meeting-primary-cover">${icon(kind==='watchtower'?'publications':'meetings',34)}</div><div><span class="meeting-primary-label">${esc(label)}</span><strong>Für diese Woche nicht gefunden</strong><small>Katalog aktualisieren oder passende Publikation importieren.</small></div></article>`;const attrs=item.document_id?`data-document-id="${item.document_id}"`:item.installed_id?`data-publication-id="${esc(item.installed_id)}"`:`data-meeting-download="${item.catalog_id}"`;return`<article class="meeting-primary-card" ${attrs} role="button" tabindex="0"><div class="meeting-primary-cover">${item.cover_url?`<img src="${esc(item.cover_url)}" alt="">`:icon(kind==='watchtower'?'publications':'meetings',34)}</div><div class="meeting-primary-copy"><span class="meeting-primary-label">${esc(label)}</span><small>${esc(formatDate(data.week_start))} – ${esc(formatDate(data.week_end))}</small><strong>${esc(cleanLabel(item.article_title||item.title||item.short_title||label))}</strong>${item.article_subtitle?`<p>${esc(cleanLabel(item.article_subtitle))}</p>`:''}</div><button class="icon-button meeting-more" aria-label="Weitere Optionen">•••</button></article>`};
 const additional=(data.additional_materials||[]).map(item=>{const attrs=item.installed?`data-publication-id="${esc(item.id)}"`:`data-meeting-download="${item.catalog_id}"`;return`<article class="meeting-material-row" ${attrs} role="button" tabindex="0"><div class="meeting-material-cover">${item.cover_url?`<img src="${esc(item.cover_url)}" alt="">`:icon('publications',28)}</div><div><strong>${esc(item.display_label||item.title||item.short_title)}</strong><small>${esc(item.title&&item.title!==item.display_label?item.title:(item.installed?'Lokal verfügbar':'Zum Herunterladen verfügbar'))}</small></div><span class="meeting-material-state">${item.installed?'Öffnen':icon('download',22)}</span><button class="icon-button meeting-more" aria-label="Weitere Optionen">•••</button></article>`}).join('');
 const sections=(data.sections||[]).filter(section=>section.key!=='watchtower').map(section=>`<section class="meeting-section"><header><div><span class="meeting-section-kicker">${esc(cleanLabel(section.title))}</span><h2>${section.items.length} Programmpunkte</h2></div></header><div class="meeting-program">${section.items.map(item=>`<article class="meeting-program-item"><button class="meeting-open" ${item.document_id?`data-document-id="${item.document_id}"`:'data-route="publications"'}><span class="meeting-dot"></span><span><strong>${esc(cleanLabel(item.title))}</strong><small>${esc(cleanLabel(item.subtitle||item.publication||''))}</small>${item.text?`<p>${esc(cleanLabel(item.text))}</p>`:''}</span></button><div class="meeting-item-actions">${item.document_id?`<button class="icon-button" data-meeting-note="${item.document_id}" data-meeting-title="${esc(cleanLabel(item.title))}" title="Notiz">${icon('notes',18)}</button>`:''}${item.note_count?`<span class="note-badge">${item.note_count}</span>`:''}</div></article>`).join('')}</div></section>`).join('');
 main.innerHTML=`<div class="page meetings-page">${pageHeader('Zusammenkünfte',`${formatDate(data.week_start)} – ${formatDate(data.week_end)}`,actions)}<section class="meeting-overview"><div class="meeting-week-heading"><button class="icon-button" data-meeting-offset="${data.offset-1}" aria-label="Vorherige Woche">${icon('back',22)}</button><h2>${formatDate(data.week_start)} – ${formatDate(data.week_end)}${data.offset===0?' · Aktuelle Woche':''}</h2><button class="icon-button" data-meeting-offset="${data.offset+1}" aria-label="Nächste Woche">${icon('forward',22)}</button></div><div class="meeting-primary-list">${primaryCard(life,'Leben und Dienst','life')}${primaryCard(watchtower,'Wachtturm-Studium','watchtower')}</div><div class="meeting-material-divider"></div><h2 class="meeting-material-title">Andere Publikationen für die Zusammenkünfte</h2><div class="meeting-material-list">${additional||emptyInline('Keine Zusatzpublikationen gefunden','Katalog aktualisieren oder Publikationen importieren.')}</div></section>${sections?`<details class="meeting-program-details"><summary>Wochenprogramm anzeigen</summary><div>${sections}</div></details>`:''}</div>`;
}

async function renderNotes(){const items=await get('/api/notes');main.innerHTML=`<div class="page">${pageHeader('Notizen',`${items.length} persönliche Notizen`,`<button class="button primary" data-action="new-note">${icon('plus',18)} Neue Notiz</button>`)}<div class="search-field" style="margin-bottom:18px">${icon('search',18)}<input id="notes-filter" placeholder="Notizen durchsuchen"></div>${items.length?`<div class="note-grid">${items.map(note=>`<article class="note-card"><h3>${esc(note.title||'Notiz')}</h3><p>${esc(note.content||'')}</p><footer><span>${esc(note.publication_title||note.location_title||note.key_symbol||'Persönliche Notiz')}</span>${note.source==='local'?`<button class="icon-button" data-delete-note="${note.id}">${icon('close',17)}</button>`:''}</footer></article>`).join('')}</div>`:empty('Keine Notizen','Erstelle im Reader eine Notiz oder importiere ein .jwlibrary-Backup.')}</div>`}
async function renderBookmarks(){const items=await get('/api/bookmarks');main.innerHTML=`<div class="page">${pageHeader('Lesezeichen',`${items.length} importierte Lesezeichen`)}${items.length?`<div class="note-grid">${items.map(item=>`<article class="note-card bookmark-card"><button class="bookmark-open" ${item.source==='local'&&item.document_id?`data-open-bookmark="${item.document_id}" data-bookmark-block="${item.block_identifier??''}"`:''}><h3>${esc(item.title||'Lesezeichen')}</h3><p>${esc(item.snippet||item.location_title||'')}</p><footer><span>${esc(item.key_symbol||'Publikation')} · Platz ${item.slot??''}</span></footer></button></article>`).join('')}</div>`:empty('Keine Lesezeichen','Importiere ein .jwlibrary-Backup oder setze neue Lesezeichen im Reader.')}</div>`}
async function renderHighlights(){const stats=await get('/api/status');main.innerHTML=`<div class="page">${pageHeader('Markierungen','Persönliche Textmarkierungen')}<div class="panel"><h2>Importierte und lokale Markierungen</h2><p>Die Markierungen werden beim Öffnen der passenden Publikation automatisch an den gespeicherten Absätzen dargestellt.</p><div class="form-row"><div class="setting-row"><div><strong>Gesamt</strong><small>Aus Backup und LiMaD Study</small></div><b>${state.home?.stats?.marks??'–'}</b></div></div></div></div>`}
async function renderTags(){const items=await get('/api/tags');main.innerHTML=`<div class="page">${pageHeader('Tags',`${items.length} Kategorien`)}${items.length?`<div class="note-grid">${items.map(item=>`<article class="note-card"><h3>${esc(item.name)}</h3><p>${item.usage||0} zugeordnete Einträge</p></article>`).join('')}</div>`:empty('Keine Tags','Tags aus einem .jwlibrary-Backup werden hier angezeigt.')}</div>`}
async function renderBackups(){const items=await get('/api/backups');main.innerHTML=`<div class="page">${pageHeader('Backups','Persönliche Daten importieren, zuordnen und kompatibel exportieren',`<button class="button" data-action="import-jwlibrary">${icon('folder',18)} Backup importieren</button><button class="button" data-action="reconcile-backups">${icon('refresh',18)} Quellen neu zuordnen</button><a class="button primary" href="/api/export/jwlibrary">${icon('backup',18)} Exportieren</a>`)}${items.length?`<div class="backup-grid">${items.map(item=>`<article class="backup-card"><div><strong>${esc(item.filename)}</strong><small>${formatDate(item.imported_at)}</small></div><div class="backup-stats"><span>${item.notes_count} Notizen</span><span>${item.marks_count} Markierungen</span><span>${item.tags_count} Tags</span><span>${item.bookmarks_count} Lesezeichen</span></div><div class="resolution-line"><span class="status-ok">${item.resolved_count||0} zugeordnet</span><span class="status-warn">${item.missing_count||0} Quellen fehlen</span></div><div class="card-actions"><button class="button" data-action="backup-details" data-id="${esc(item.id)}">Details</button><a class="button" href="/api/export/jwlibrary?backup_id=${encodeURIComponent(item.id)}">Export</a></div></article>`).join('')}</div>`:empty('Kein Backup importiert','Importiere eine .jwlibrary-Datei. Notizen, Markierungen, Tags, Lesezeichen und Eingabefelder werden danach automatisch zugeordnet.',`<button class="button primary" data-action="import-jwlibrary">Backup importieren</button>`)}</div>`}
async function showBackupDetails(id){const r=await get(`/api/backups/resolution?backup_id=${encodeURIComponent(id)}`);modalRoot.innerHTML=modal({title:'Backup-Zuordnung',body:`<div class="backup-stats large"><span>${r.resolved} zugeordnet</span><span>${r.missing} fehlen</span></div>${r.missing_items.length?`<div class="missing-list">${r.missing_items.slice(0,100).map(x=>`<div><strong>${esc(x.key_symbol||'Unbekannt')}</strong><span>${esc(x.reason||'Quelle fehlt')}</span></div>`).join('')}</div>`:'<p>Alle bekannten Quellen sind zugeordnet.</p>'}`})}
async function renderSettings(){const settings=await get('/api/settings');main.innerHTML=`<div class="page">${pageHeader('Einstellungen','LiMaD Study konfigurieren')}<div class="settings-grid"><nav class="settings-nav"><button class="active">Allgemein</button><button>Darstellung</button><button>Katalog und Downloads</button><button>Daten und Backup</button></nav><section class="settings-panel"><div class="setting-row"><div><strong>Inhaltssprache</strong><small>Bestimmt Katalog, Startseite und neue Inhalte.</small></div><button class="button" data-action="language">${esc(state.languageName)}</button></div><div class="setting-row"><div><strong>Katalog automatisch aktualisieren</strong><small>Beim Start aktuelle Publikationen und Covers laden.</small></div><select class="select" id="autosync"><option value="1" ${settings.catalog_autosync!=='0'?'selected':''}>Aktiv</option><option value="0" ${settings.catalog_autosync==='0'?'selected':''}>Aus</option></select></div><div class="setting-row"><div><strong>Lokaler Datenspeicher</strong><small>Publikationen und persönliche Daten bleiben auf diesem Gerät.</small></div><button class="button" data-route="backups">Backups</button></div><div class="setting-row"><div><strong>Offizieller Katalog</strong><small>${state.status?.counts?.catalog||0} Publikationen im lokalen Katalog.</small></div><button class="button" data-action="sync">Jetzt aktualisieren</button></div></section></div></div>`}
function renderHelp(){const version=state.status?.version||'Version nicht verfügbar';main.innerHTML=`<div class="page">${pageHeader('Hilfe',`LiMaD Study ${version}`)}<div class="panel" style="max-width:820px"><h2>Lokale Bibliothek und Studienumgebung</h2><p>LiMaD Study verarbeitet JWPUB-Publikationen, JWL-Library-Backups, persönliche Notizen, Markierungen, Tags und Lesezeichen lokal. Installierte Publikationen werden nach Kategorie und Jahrgang geordnet und mit einem buchähnlichen Inhaltsverzeichnis geöffnet.</p><h3>Dateien importieren</h3><p>Verwende „Publikationen“ für .jwpub-Dateien und „Backups“ für .jwlibrary- oder .jwlplaylist-Dateien.</p><h3>Offline-Nutzung</h3><p>Importierte Inhalte, Covers und persönliche Daten stehen ohne Internetverbindung zur Verfügung.</p></div></div>`}
function formatDate(value){if(!value)return'';const date=new Date(value.length===10?`${value}T12:00:00`:value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date)}
function cleanLabel(value){const node=document.createElement('textarea');node.innerHTML=String(value||'').replace(/<[^>]*>/g,' ');return node.value.replace(/\s+/g,' ').trim()}

async function openPublication(id){state.selectedPublication=id;await navigate('library',{selectedPublication:id})}
async function openDocument(id){state.selectedDocument=Number(id);await navigate('reader',{selectedDocument:Number(id)})}
async function openCatalog(id){
 let item;
 try{item=await get(`/api/catalog/${id}/detail`)}catch(error){toast(error.message,'error');return}
 const cover=item.cover_url?`<img src="${esc(item.cover_url)}" class="catalog-detail-cover" alt="Originalcover" onerror="this.closest('.catalog-cover-wrap').classList.add('cover-error');this.remove()">`:`<span class="cover-placeholder large">${icon('publications',52)}</span>`;
 const status=item.offline_available?'<span class="status-ok">Offline verfügbar</span>':'<span class="status-info">Online-Katalog</span>';
 const body=`<div class="catalog-dialog"><div class="catalog-detail-grid"><div class="catalog-cover-wrap">${cover}<span class="cover-fallback">Originalcover nicht verfügbar</span></div><div><div class="catalog-status-row">${status}</div><h3>${esc(item.title||'Publikation')}</h3><p>${esc(item.short_title||'')}</p><dl class="catalog-meta"><div><dt>Sprache</dt><dd>${esc(item.language_vernacular||item.language_name||state.languageName)}</dd></div><div><dt>Ausgabe</dt><dd>${esc(item.year||'—')}${item.issue_tag?` · ${esc(item.issue_tag)}`:''}</dd></div><div><dt>Größe</dt><dd>${formatBytes(item.size)}</dd></div><div><dt>Publikation</dt><dd>${esc(item.key_symbol||item.symbol||'—')}</dd></div></dl><div class="preview-note"><strong>Ansicht</strong><p>${esc(item.preview_message)}</p></div><p class="download-option-note" id="catalog-option-status">${item.offline_available?'Lokal importiert und lesebereit.':'Offizielle JWPUB-Downloadoption wird geprüft …'}</p></div></div></div>`;
 const actions=item.offline_available?`<button class="button" data-close-modal>Schließen</button><button class="button primary" data-publication-id="${esc(item.installed_id)}">${icon('read',18)} Öffnen</button>`:`<button class="button" data-close-modal>Schließen</button><button class="button primary" id="catalog-offline-button" disabled>${icon('download',18)} Offline speichern</button>`;
 modalRoot.innerHTML=modal({title:'Publikationsdetails',body,actions,wide:true});
 if(!item.offline_available){
  const statusNode=document.querySelector('#catalog-option-status'),button=document.querySelector('#catalog-offline-button');
  try{const options=await get(`/api/catalog/${id}/options`);if(!document.body.contains(button))return;if(options.length){statusNode.textContent=`${options.length} offizielle JWPUB-Downloadoption${options.length===1?'':'en'} verfügbar.`;button.disabled=false;button.dataset.downloadCatalog=id;button.onclick=event=>{event.preventDefault();event.stopPropagation();startCatalogDownload(id,button)}}else{statusNode.textContent='Keine offizielle JWPUB-Downloadoption gefunden. Eine lokale JWPUB-Datei kann weiterhin importiert werden.';button.disabled=false;button.dataset.action='import-jwpub';button.innerHTML='JWPUB importieren'}}catch(error){if(document.body.contains(statusNode)){statusNode.textContent=`Abruf fehlgeschlagen: ${error.message}`;button.disabled=false;button.dataset.action='import-jwpub';button.innerHTML='JWPUB importieren'}}
 }
}

async function openLanguage(){
 modalRoot.innerHTML=modal({title:'Sprache auswählen',wide:true,body:`<div class="search-field" style="margin-bottom:14px">${icon('search',18)}<input id="language-search" placeholder="Über 1.000 Sprachen durchsuchen"></div><div id="language-list" class="language-list">${skeleton(8)}</div>`});
 await loadLanguages('');document.querySelector('#language-search').oninput=debounce(event=>loadLanguages(event.target.value),250)
}
async function loadLanguages(query){const items=await get(`/api/languages?q=${encodeURIComponent(query)}&limit=2000`);document.querySelector('#language-list').innerHTML=items.map(item=>`<button class="language-item" data-language-id="${item.id}" data-language-name="${esc(item.vernacular_name||item.english_name)}"><strong>${esc(item.vernacular_name||item.english_name)}</strong><small>${esc(item.english_name)} · ${item.publication_count||0} Publikationen${item.is_sign?' · Gebärdensprache':''}</small></button>`).join('')||empty('Keine Sprache gefunden','Suche nach Name, Code oder Sprachsymbol.')}
function openSearch(){modalRoot.innerHTML=modal({title:'Bibliothek durchsuchen',wide:true,body:`<div class="search-field" style="width:100%;margin-bottom:15px">${icon('search',18)}<input id="global-search-input" autofocus placeholder="Suchbegriff eingeben"></div><div id="search-results">${empty('Lokale Volltextsuche','Suche in allen importierten Publikationen.')}</div>`});const input=document.querySelector('#global-search-input');setTimeout(()=>input.focus(),30);input.oninput=debounce(async event=>{const q=event.target.value.trim();const root=document.querySelector('#search-results');if(q.length<2){root.innerHTML=empty('Lokale Volltextsuche','Mindestens zwei Zeichen eingeben.');return}const results=await get(`/api/search?q=${encodeURIComponent(q)}`);root.innerHTML=results.length?`<div class="document-list">${results.map(item=>`<button class="document-item" data-document-id="${item.document_id}"><strong>${esc(item.title)}</strong><small>${esc(item.publication_title)}</small><p>${item.snippet||''}</p></button>`).join('')}</div>`:empty('Keine Treffer',`Für „${q}“ wurden keine Treffer gefunden.`)},250)}
function openGlobalMenu(){modalRoot.innerHTML=modal({title:'Weitere Aktionen',body:`<div style="display:grid;gap:8px"><button class="category-card" style="height:70px;border:1px solid var(--line)" data-action="import-jwpub">${icon('publications')}<span>JWPUB-Publikation importieren</span></button><button class="category-card" style="height:70px;border:1px solid var(--line)" data-action="import-jwlibrary">${icon('backup')}<span>JWL-Library-Backup importieren</span></button><button class="category-card" style="height:70px;border:1px solid var(--line)" data-action="import-jwlplaylist">${icon('playlists')}<span>JWL-Playlist importieren</span></button><button class="category-card" style="height:70px;border:1px solid var(--line)" data-action="sync">${icon('refresh')}<span>Offiziellen Katalog aktualisieren</span></button></div>`})}
function openNoteDialog(prefill={}){if(!state.selectedDocument&&!prefill.document_id){toast('Öffne zuerst ein Dokument.','error');return}modalRoot.innerHTML=modal({title:'Notiz erstellen',body:`<div class="form-field"><label>Titel</label><input id="note-title" value="${esc(prefill.title||'')}"></div><div class="form-field"><label>Notiz</label><textarea id="note-content">${esc(prefill.content||state.selection?.text||'')}</textarea></div><div class="form-field"><label>Tags</label><input id="note-tags" placeholder="z. B. Familie, Nachforschen"></div>`,actions:`<button class="button" data-close-modal>Abbrechen</button><button class="button primary" id="save-note">Speichern</button>`});const noteContent=document.querySelector('#note-content');setTimeout(()=>{noteContent?.focus();noteContent?.setSelectionRange(noteContent.value.length,noteContent.value.length)},30);document.querySelector('#save-note').onclick=async()=>{await post('/api/notes',{document_id:prefill.document_id||state.selectedDocument,title:document.querySelector('#note-title').value,content:document.querySelector('#note-content').value,block_identifier:prefill.block_identifier??state.selection?.blockIdentifier,tags:document.querySelector('#note-tags').value.split(',').map(x=>x.trim()).filter(Boolean)});closeModal();toast('Notiz gespeichert.');if(state.route==='reader')renderReader()}}
async function startCatalogDownload(catalogId,button){
 const originRoute=state.route;
 try{
  await post('/api/frontend/event',{state:'catalog-download-click',stage:'button',message:String(catalogId)}).catch(()=>{});
  if(button){button.disabled=true;button.textContent='Download wird vorbereitet …'}
  const item=await get(`/api/catalog/${catalogId}/detail`);
  const response=await post('/api/downloads',{catalog_id:Number(catalogId),option_index:0});
  await post('/api/frontend/event',{state:'catalog-download-started',stage:'backend',message:String(response?.job?.id||'')}).catch(()=>{});
  await monitorDownload(response.job.id,item.title||'Publikation',originRoute);
 }catch(error){
  await post('/api/frontend/event',{state:'catalog-download-failed',stage:'error',message:error.message||String(error)}).catch(()=>{});
  if(button){button.disabled=false;button.innerHTML=icon('download',18)+' Offline speichern'}
  const node=document.querySelector('#catalog-option-status');if(node)node.textContent='Download fehlgeschlagen: '+error.message;
  toast('Download fehlgeschlagen: '+error.message,'error');
 }
}
async function monitorDownload(jobId,title='Publikation',returnRoute='library'){
 modalRoot.innerHTML=modal({title:'Offline speichern',body:`<p><strong>${esc(title)}</strong></p><div class="progress"><span id="catalog-download-progress" style="width:0"></span></div><p id="catalog-download-status">Download wird gestartet …</p><p id="catalog-download-detail">0 Bytes</p>`,actions:`<button class="button" data-close-modal>Im Hintergrund weiter</button><button class="button" data-route="downloads" data-close-modal>Downloads öffnen</button>`});
 const progress=document.querySelector('#catalog-download-progress'),status=document.querySelector('#catalog-download-status'),detail=document.querySelector('#catalog-download-detail');
 for(let attempt=0;attempt<3600;attempt++){
  await new Promise(resolve=>setTimeout(resolve,700));
  let jobs;try{jobs=await get('/api/downloads')}catch(error){if(status)status.textContent='Statusabruf fehlgeschlagen: '+error.message;continue}
  const job=jobs.find(item=>item.id===jobId);if(!job)continue;
  const value=Math.min(100,Number(job.progress||0));if(progress)progress.style.width=`${value}%`;
  if(status)status.textContent=job.status_label||job.status;
  if(detail)detail.textContent=`${formatBytes(job.received_size)} von ${formatBytes(job.expected_size)} · ${value.toFixed(1)} %${job.speed_bps?` · ${formatBytes(job.speed_bps)}/s`:''}`;
  if(job.status==='completed'){if(progress)progress.style.width='100%';if(status)status.textContent='Download, Prüfung und Import abgeschlossen.';if(detail)detail.textContent='Die Publikation ist jetzt offline verfügbar.';toast('Publikation wurde vollständig heruntergeladen und importiert.');setTimeout(()=>{closeModal();navigate(returnRoute==='meetings'?'meetings':returnRoute==='bible'?'bible':returnRoute==='home'?'home':'library')},900);return}
  if(job.status==='failed'||job.status==='cancelled'){if(status)status.textContent=job.status==='failed'?'Download fehlgeschlagen':'Download abgebrochen';if(detail)detail.textContent=job.error||'Unbekannter Fehler';toast(job.error||'Download fehlgeschlagen.','error');return}
 }
 if(status)status.textContent='Zeitüberschreitung bei der Statusüberwachung.'
}

async function syncCatalog(){toast('Katalogaktualisierung gestartet.');try{const response=await post('/api/catalog/sync',{}),result=response.result;if(result.degraded)toast(`Offline-Katalog bleibt verfügbar. ${result.errors.map(e=>e.component).join(', ')} konnte nicht aktualisiert werden.`,'error');else toast(`${result.catalog.count} Katalogeinträge und ${result.languages.count} Sprachen aktualisiert.`);state.status=await get('/api/status');
 const persistedLanguage=Number(state.status?.settings?.language_index);
 if(Number.isFinite(persistedLanguage)&&persistedLanguage>0)state.languageIndex=persistedLanguage;render()}catch(error){toast(error.message,'error')}}
async function importFile(file,type){if(!file)return;const title=type==='jwpub'?'Publikation importieren':type==='jwlplaylist'?'Playlist importieren':'Backup importieren';modalRoot.innerHTML=modal({title,body:`<p>${esc(file.name)}</p><div class="progress"><span id="upload-progress" style="width:0"></span></div><p id="upload-status">Datei wird übertragen …</p>`});try{const result=await upload(`/api/import/${type}`,file,value=>{document.querySelector('#upload-progress').style.width=`${value}%`;document.querySelector('#upload-status').textContent=`Übertragen: ${value} %`});closeModal();toast(type==='jwpub'?'Publikation wurde importiert.':type==='jwlplaylist'?'Playlist wurde importiert.':'Backup wurde importiert.');await navigate(type==='jwpub'?'library':'backups')}catch(error){closeModal();toast(error.message,'error')}finally{const input=document.querySelector(`#${type}-input`);if(input)input.value=''}}

async function openMeetingNote(documentId,title){
 const notes=await get(`/api/meetings/notes?document_id=${documentId}`),existing=notes[0]||{};
 modalRoot.innerHTML=modal({title:'Notiz zum Programmpunkt',body:`<div class="form-field"><label>Titel</label><input id="meeting-note-title" value="${esc(existing.title||title)}"></div><div class="form-field"><label>Notiz</label><textarea id="meeting-note-content">${esc(existing.content||'')}</textarea></div>`,actions:'<button class="button" data-close-modal>Abbrechen</button><button class="button primary" id="save-meeting-note">Speichern</button>'});
 document.querySelector('#save-meeting-note').onclick=async()=>{await post('/api/meetings/notes',{document_id:documentId,title:document.querySelector('#meeting-note-title').value,content:document.querySelector('#meeting-note-content').value});closeModal();toast('Zusammenkunftsnotiz gespeichert.');renderMeetings()}
}

function closeModal(){modalRoot.innerHTML=''}
function debounce(fn,delay){let timer;return(...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay)}}

main.addEventListener('click',async event=>{
 const route=event.target.closest('[data-route]')?.dataset.route;if(route){closeModal();navigate(route);return}
 const pub=event.target.closest('[data-publication-id]')?.dataset.publicationId;if(pub){closeModal();openPublication(pub);return}
 const doc=event.target.closest('[data-document-id]')?.dataset.documentId;if(doc){closeModal();openDocument(doc);return}
 const catalog=event.target.closest('[data-catalog-id],[data-action="catalog-open"]');if(catalog){openCatalog(catalog.dataset.catalogId||catalog.dataset.id);return}
 const meetingOffset=event.target.closest('[data-meeting-offset]')?.dataset.meetingOffset;if(meetingOffset!==undefined){state.meetingOffset=Number(meetingOffset);renderMeetings();return}
 const meetingDownload=event.target.closest('[data-meeting-download]')?.dataset.meetingDownload;if(meetingDownload){await startCatalogDownload(meetingDownload,event.target.closest('[data-meeting-download]'));return}
 const meetingNote=event.target.closest('[data-meeting-note]');if(meetingNote){openMeetingNote(Number(meetingNote.dataset.meetingNote),meetingNote.dataset.meetingTitle||'Programmpunkt');return}
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(action==='language')openLanguage();
 if(action==='bible-catalog')renderCatalogPage('bibles');
 if(action==='import-jwpub')document.querySelector('#jwpub-input').click();
 if(action==='import-jwlibrary')document.querySelector('#jwlibrary-input').click();
 if(action==='import-jwlplaylist')document.querySelector('#jwlplaylist-input').click();
 if(action==='sync')syncCatalog();
 if(action==='show-new'){navigate('publications');}
 if(action==='catalog-search')navigate('publications');
 if(action==='new-note')openNoteDialog();
 if(action==='favorite'){const node=event.target.closest('[data-action="favorite"]');await post('/api/favorite',{publication_id:node.dataset.id,favorite:Number(node.dataset.value)});toast(Number(node.dataset.value)?'Zu Favoriten hinzugefügt.':'Aus Favoriten entfernt.');render()}
 if(action==='reader-bookmark'){const data=state.readerData;await post('/api/bookmarks',{document_id:state.selectedDocument,title:data.document.toc_title||data.document.title,snippet:state.selection?.text||'',block_identifier:state.selection?.blockIdentifier});toast('Lesezeichen gespeichert.');renderReader()}
 if(action==='reader-toc'){const data=state.readerData;modalRoot.innerHTML=modal({title:'Inhaltsverzeichnis',wide:true,body:`<div class="document-list">${data.navigation.map(item=>`<button class="document-item ${Number(item.id)===Number(state.selectedDocument)?'active':''}" data-document-id="${item.id}"><strong>${esc(item.toc_title||item.title)}</strong></button>`).join('')}</div>`})}
 if(action==='new-playlist'){modalRoot.innerHTML=modal({title:'Neue Playlist',body:'<div class="form-field"><label>Name</label><input id="playlist-title"></div>',actions:'<button class="button" data-close-modal>Abbrechen</button><button class="button primary" id="save-playlist">Erstellen</button>'});document.querySelector('#save-playlist').onclick=async()=>{await post('/api/playlists',{title:document.querySelector('#playlist-title').value});closeModal();renderPlaylists()}}
 const dp=event.target.closest('[data-delete-playlist]')?.dataset.deletePlaylist;if(dp){await del(`/api/playlists/${dp}`);toast('Playlist gelöscht.');renderPlaylists();return}
 if(action==='reader-font'){const frame=document.querySelector('#reader-frame');const current=Number(storageGet('limad-reader-scale','1'));const scale=current>=1.25?.9:Math.round((current+.1)*10)/10;storageSet('limad-reader-scale',scale);frame?.contentWindow?.postMessage({type:'limad-font',scale},location.origin);toast(`Schriftgröße ${Math.round(scale*100)} %`)}
 const studyTab=event.target.closest('[data-study-tab]')?.dataset.studyTab;if(studyTab){state.studyTab=studyTab;document.querySelectorAll('[data-study-tab]').forEach(x=>x.classList.toggle('active',x.dataset.studyTab===studyTab));document.querySelector('#study-content').innerHTML=studyPanel(studyTab)}
 const dm=event.target.closest('[data-delete-mark]')?.dataset.deleteMark;if(dm){await del(`/api/marks/${dm}`);toast('Markierung entfernt.');renderReader()}
 const openBookmark=event.target.closest('[data-open-bookmark]');if(openBookmark&&openBookmark.dataset.openBookmark){state.pendingBlockIdentifier=openBookmark.dataset.bookmarkBlock||null;closeModal();openDocument(openBookmark.dataset.openBookmark);return}
 const dbm=event.target.closest('[data-delete-bookmark]')?.dataset.deleteBookmark;if(dbm){await del(`/api/bookmarks/${dbm}`);toast('Lesezeichen entfernt.');renderReader()}
 const kind=event.target.closest('[data-catalog-kind]')?.dataset.catalogKind;if(kind){const items=await get(`/api/catalog/publications?language=${state.languageIndex}&kind=${encodeURIComponent(kind)}&limit=300`);document.querySelector('.category-grid').replaceWith(Object.assign(document.createElement('div'),{id:'catalog-results',className:'catalog-grid',innerHTML:items.map(item=>publicationCard(item,{catalog:true})).join('')||empty('Keine Inhalte','Keine passenden Publikationen gefunden.')}))}
 const mediaNode=event.target.closest('[data-media-url]');if(mediaNode){openMediaPlayer(mediaNode)}
 const retry=event.target.closest('[data-retry-download]')?.dataset.retryDownload;if(retry){await post(`/api/downloads/${retry}/retry`,{});renderDownloads()} const cancel=event.target.closest('[data-cancel-download]')?.dataset.cancelDownload;if(cancel){await post(`/api/downloads/${cancel}/cancel`,{});renderDownloads()} const removeDownload=event.target.closest('[data-remove-download]')?.dataset.removeDownload;if(removeDownload){if(confirm('Download und unvollständige Restdateien wirklich entfernen?')){await post(`/api/downloads/${removeDownload}/remove`,{});renderDownloads()}}
 const remove=event.target.closest('[data-delete-note]')?.dataset.deleteNote;if(remove){await del(`/api/notes/${remove}`);toast('Notiz gelöscht.');renderNotes()}
});
modalRoot.addEventListener('click',async event=>{
 if(event.target.matches('.modal-backdrop[data-close-modal]')||event.target.closest('button[data-close-modal]')){closeModal();return}
 const lang=event.target.closest('[data-language-id]');if(lang){state.languageIndex=Number(lang.dataset.languageId);state.languageName=lang.dataset.languageName;storageSet('limad-language',String(state.languageIndex));await post('/api/settings',{language_index:state.languageIndex});closeModal();document.documentElement.lang=uiLocale();installChrome();toast(`Sprache: ${state.languageName}`);render();return}
 const doc=event.target.closest('[data-document-id]')?.dataset.documentId;if(doc){closeModal();openDocument(doc);return}
 const pub=event.target.closest('[data-publication-id]')?.dataset.publicationId;if(pub){closeModal();openPublication(pub);return}
 const download=event.target.closest('[data-download-catalog]')?.dataset.downloadCatalog;if(download){await startCatalogDownload(download,event.target.closest('[data-download-catalog]'));return}
 const action=event.target.closest('[data-action]')?.dataset.action;if(action==='import-jwpub'){closeModal();document.querySelector('#jwpub-input').click()}if(action==='import-jwlibrary'){closeModal();document.querySelector('#jwlibrary-input').click()}if(action==='import-jwlplaylist'){closeModal();document.querySelector('#jwlplaylist-input').click()}if(action==='reconcile-backups'){await post('/api/backups/reconcile',{});toast('Quellen wurden neu zugeordnet.');return navigate('backups')}if(action==='backup-details'){return showBackupDetails(target.dataset.id)}if(action==='sync'){closeModal();syncCatalog()}
});
window.addEventListener('message',async event=>{if(event.origin!==location.origin)return;const d=event.data||{};if(d.type==='limad-link'){const result=await get(`/api/resolve?link=${encodeURIComponent(d.href)}`);if(result.resolved)openDocument(result.document.id);else window.open(result.external,'_blank')}if(d.type==='limad-selection'){state.selection=d;openNoteDialog({document_id:d.documentId,block_identifier:d.blockIdentifier,content:d.text})}if(d.type==='limad-mark'){state.selection=d;await post('/api/marks',{document_id:d.documentId,block_identifier:d.blockIdentifier,start_token:d.startToken,end_token:d.endToken,color_index:d.colorIndex});toast('Markierung gespeichert.');state.route==='bible'?renderBible():renderReader()}if(d.type==='limad-position'){post('/api/reading-position',{document_id:d.documentId,scroll_ratio:d.scrollRatio,block_identifier:d.blockIdentifier}).catch(()=>{})}if(d.type==='limad-reader-ready'){const frame=document.querySelector('#reader-frame');let pos=state.readerData?.position||{};if(state.route==='bible'&&state.selectedDocument){try{pos=await get(`/api/reading-position?document_id=${state.selectedDocument}`)}catch{}}const restoreBlock=state.pendingBlockIdentifier||pos.block_identifier;frame?.contentWindow?.postMessage({type:'limad-restore',scrollRatio:state.pendingBlockIdentifier?0:(pos.scroll_ratio||0),blockIdentifier:restoreBlock},location.origin);state.pendingBlockIdentifier=null;frame?.contentWindow?.postMessage({type:'limad-font',scale:Number(storageGet('limad-reader-scale','1'))},location.origin)}if(d.type==='limad-note-open'){openNoteDialog({document_id:state.selectedDocument,block_identifier:d.note.block_identifier,title:d.note.title,content:d.note.content})}});
document.addEventListener('click',event=>{const route=event.target.closest('[data-route]')?.dataset.route;if(route&&!main.contains(event.target)){navigate(route)}});

async function bootstrap(){installChrome();state.status=await get('/api/status');const persistedLanguage=Number(state.status?.settings?.language_index);if(Number.isFinite(persistedLanguage)&&persistedLanguage>0)state.languageIndex=persistedLanguage;const languages=await get(`/api/languages?q=&limit=20`);const current=languages.find(item=>Number(item.id)===state.languageIndex);if(current)state.languageName=current.vernacular_name||current.english_name;document.documentElement.lang=uiLocale();installChrome();await navigate('home')}
bootstrap().catch(error=>{main.innerHTML=`<div class="page">${empty('LiMaD Study konnte nicht gestartet werden',error.message)}</div>`;toast(error.message,'error')});
