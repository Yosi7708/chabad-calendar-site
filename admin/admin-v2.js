'use strict';
const $=id=>document.getElementById(id),form=$('campaign-form');let campaigns=[],editing=null,busy=false,dirty=false,placement='banner';
const labels={draft:'טיוטה',live:'פעיל עכשיו',scheduled:'מתוזמן',paused:'מושהה',expired:'הסתיים'};
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
async function api(path,method='GET',data){return window.adsBackend.api(path,method,data);}
function lock(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);}
function node(tag,text,className){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
function safeUrl(value){try{const u=new URL(value);return (u.protocol==='https:'||(u.origin===location.origin&&location.hostname==='localhost'&&/^\/media\/[a-f0-9]{32}\.(png|jpg|webp|mp4|webm)$/.test(u.pathname)))&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function localDate(value){if(!value)return '';const d=new Date(value),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function read(){const d=Object.fromEntries(new FormData(form));return {...d,id:editing?.id,revision:editing?.revision,banner:editing?!!editing.banner:placement==='banner',popup:editing?!!editing.popup:placement==='popup',starts:d.starts?new Date(d.starts).toISOString():'',ends:d.ends?new Date(d.ends).toISOString():''};}
function renderList(){const list=$('list');list.replaceChildren();for(const type of ['banner','popup'])$('count-'+type).textContent=campaigns.filter(a=>a[type]).length;const filtered=campaigns.filter(a=>a[placement]&&($('filter').value==='all'||a.displayStatus===$('filter').value));if(!filtered.length)list.append(node('p',placement==='banner'?'אין באנרים במצב הזה. אפשר להוסיף באנר חדש.':'אין פופאפים במצב הזה. אפשר להוסיף פופאפ חדש.','hint'));for(const a of filtered){const b=node('button','',`campaign-row ${editing?.id===a.id?'selected':''}`);b.append(node('strong',a.title),node('span',labels[a.displayStatus],`badge ${a.displayStatus}`),node('small',[a.banner?'באנר':'',a.popup?'פופאפ':''].filter(Boolean).join(' · ')));b.onclick=()=>{if(dirty&&!confirm('לעזוב את השינויים שלא נשמרו?'))return;edit(a);};list.append(b);}}
function edit(item){editing=item?{...item}:null;form.reset();const values=item||{title:'',body:'',url:'',imageUrl:'',videoUrl:'',starts:'',ends:'',banner:placement==='banner',popup:placement==='popup',status:'draft'};for(const k of ['title','body','url','imageUrl','videoUrl','status'])form.elements[k].value=values[k]||'';for(const k of ['starts','ends'])form.elements[k].value=localDate(values[k]);$('editor-title').textContent=(item?'עריכת ':'יצירת ')+(placement==='banner'?'באנר':'פופאפ');$('shared-notice').hidden=!(item?.banner&&item?.popup);$('video-fields').hidden=!values.popup;$('media-help').textContent=values.popup?'תמונה: PNG/JPEG/WebP עד 8MB. וידאו: MP4/WebM עד 30MB, מומלץ עד 60 שניות. ניתן להעלות קובץ או להזין כתובת HTTPS. השינוי מתפרסם רק בשמירה; הסרטון מתחיל בלחיצה.':'תמונת באנר: PNG/JPEG/WebP עד 8MB. ניתן להעלות קובץ או להזין כתובת HTTPS. החלפת התמונה מתפרסמת רק בשמירת הבאנר.';$('status').textContent=item?labels[item.displayStatus]:'טרם נשמר';$('delete').hidden=!item;$('pause').hidden=!item;$('activate').hidden=!item;$('editor').hidden=false;dirty=false;renderList();preview();}
function preview(){let a;try{a=read();}catch{return;}$('media-warning').textContent='';for(const [id,isPopup,enabled] of [['banner-preview',false,a.banner],['popup-preview',true,a.popup]]){const box=$(id);box.replaceChildren();if(!enabled){box.append(node('p','מיקום זה אינו פעיל','hint'));continue;}const image=safeUrl(a.imageUrl),video=safeUrl(a.videoUrl);if(isPopup&&video){const v=document.createElement('video');v.src=video;v.controls=true;v.playsInline=true;v.preload='metadata';if(image)v.poster=image;v.onloadedmetadata=()=>{if(v.duration>60)$('media-warning').textContent='הסרטון ארוך מ־60 שניות. באפליקציה ההפעלה נעצרת אחרי דקה; מומלץ להעלות קטע קצר.';};v.ontimeupdate=()=>{if(v.currentTime>=60)v.pause();};v.onerror=()=>{$('media-warning').textContent='לא ניתן לטעון את הסרטון. בדקו קישור ציבורי ישיר ופורמט MP4/WebM.';};box.append(v);}else if(image){const img=document.createElement('img');img.src=image;img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();box.append(img);}const copy=node('div');copy.append(node('small','פרסומת'),node('strong',a.title||'כותרת הפרסומת'),node('p',a.body));if(safeUrl(a.url))copy.append(node('span','לפרטים ↖'));box.append(copy);}}
async function refresh(){campaigns=await api('campaigns');renderList();}
async function signedIn(){const session=await api('session');$('feed').href=session.feedUrl;$('feed').textContent='הפיד הציבורי: '+session.feedUrl;$('login-panel').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;await refresh();if(!$('editor').hidden&&editing){const current=campaigns.find(a=>a.id===editing.id);if(current)edit(current);}}
$('login-form').onsubmit=async e=>{e.preventDefault();lock(true);try{await api('login','POST',{email:$('email').value,password:$('password').value});$('password').value='';await signedIn();message('התחברתם בהצלחה');}catch(e){message(e.message,true);}finally{lock(false);}};
$('logout').onclick=async()=>{if(dirty&&!confirm('לצאת ללא שמירת השינויים?'))return;lock(true);try{await api('logout','POST',{});editing=null;campaigns=[];form.reset();$('list').replaceChildren();$('editor').hidden=true;$('workspace').hidden=true;$('login-panel').hidden=false;$('logout').hidden=true;dirty=false;message('יצאתם מהמערכת');}catch(e){message(e.message,true);}finally{lock(false);}};
$('create').onclick=()=>{if(dirty&&!confirm('לעזוב את השינויים שלא נשמרו?'))return;edit(null);form.elements.title.focus();};$('filter').onchange=renderList;form.oninput=()=>{dirty=true;preview();};form.onchange=()=>{dirty=true;preview();};
async function save(status){if(busy||!form.reportValidity())return;let data;try{data=read();if(status)data.status=status;if(!data.banner&&!data.popup)throw Error('בחרו באנר או פופאפ');if(data.videoUrl&&!data.popup)throw Error('וידאו דורש בחירה בפופאפ');}catch(e){message(e.message,true);return;}lock(true);try{const previous=new Set(campaigns.map(a=>a.id));campaigns=await api('campaigns','POST',data);const saved=editing?campaigns.find(a=>a.id===editing.id):campaigns.find(a=>!previous.has(a.id));edit(saved);message('הקמפיין נשמר. משתמשי האפליקציה יקבלו את הפיד המעודכן בפתיחה הבאה.');}catch(e){message(e.message,true);}finally{lock(false);}}
form.onsubmit=e=>{e.preventDefault();save();};$('pause').onclick=()=>save('paused');$('activate').onclick=()=>save('active');$('delete').onclick=async()=>{if(!editing||!confirm('למחוק את הקמפיין לצמיתות? הפעולה אינה ניתנת לביטול.'))return;lock(true);try{await api('campaigns/'+editing.id,'DELETE',{revision:editing.revision});editing=null;dirty=false;$('editor').hidden=true;$('banner-preview').replaceChildren();$('popup-preview').replaceChildren();await refresh();message('הקמפיין נמחק');}catch(e){message(e.message,true);}finally{lock(false);}};
$('timezone').textContent='התזמון מוזן לפי אזור הזמן של מחשב זה: '+Intl.DateTimeFormat().resolvedOptions().timeZone+'. שדה ריק = ללא הגבלה. השרת שומר זמן מוחלט.';
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
signedIn().catch(e=>{if(e.message!=='Sign in required')message(e.message,true);});

async function uploadMedia(input,field,kind){
 const file=input.files[0];if(!file||busy)return;if(kind==='video'&&!read().popup){message('וידאו זמין לפופאפים בלבד.',true);return;}const limit=(kind==='image'?8:30)*1024*1024;
 const types=kind==='image'?['image/png','image/jpeg','image/webp']:['video/mp4','video/webm'];
 if(!types.includes(file.type)||file.size>limit||!file.size){message(kind==='image'?'בחרו PNG/JPEG/WebP עד 8MB':'בחרו MP4/WebM עד 30MB',true);input.value='';return;}
 lock(true);message('מעלה את הקובץ…');const c=new AbortController(),timeout=setTimeout(()=>c.abort(),120000);
 try{const data=await window.adsBackend.upload(file,c.signal);form.elements[field].value=data.url;dirty=true;preview();message('הקובץ הועלה ונוסף לתצוגה המקדימה. שמרו את הקמפיין כדי לפרסם.');}
 catch(e){message(e.name==='AbortError'?'ההעלאה ארכה מדי. נסו שוב עם קובץ קטן יותר.':e.message,true);}finally{clearTimeout(timeout);input.value='';lock(false);}
}
$('image-file').onchange=()=>uploadMedia($('image-file'),'imageUrl','image');$('video-file').onchange=()=>uploadMedia($('video-file'),'videoUrl','video');
for(const [id,field] of [['clear-image','imageUrl'],['clear-video','videoUrl']])$(id).onclick=()=>{form.elements[field].value='';dirty=true;preview();};

function switchPlacement(next){
 if(busy||next===placement)return;
 if(dirty&&!confirm('לעזוב את השינויים שלא נשמרו?'))return;
 placement=next;editing=null;dirty=false;form.reset();$('editor').hidden=true;
 for(const type of ['banner','popup']){
  $('tab-'+type).setAttribute('aria-pressed',String(type===placement));
  $(type+'-preview-section').hidden=type!==placement;
  $(type+'-preview').querySelectorAll('video').forEach(video=>video.pause());
  $(type+'-preview').replaceChildren();
 }
 $('section-title').textContent=next==='banner'?'באנרים מתחלפים':'פופאפים בפתיחה';
 $('create').textContent=next==='banner'?'＋ הוספת באנר':'＋ הוספת פופאפ';
 $('placement-help').textContent=next==='banner'?'הוסיפו מספר באנרים נפרדים. כל באנר נשמר עם מדיה, קישור ותזמון משלו.':'פרסומות המופיעות בפתיחת האפליקציה. ניתן להוסיף תמונה או וידאו קצר ולתזמן כל קמפיין בנפרד.';
 $('rotation-panel').hidden=next!=='banner';renderList();
}
for(const type of ['banner','popup'])$('tab-'+type).onclick=()=>switchPlacement(type);
const rotation=window.adsManagerSettings;
$('rotation-seconds').value=rotation.load();
$('rotation-form').onsubmit=e=>{
 e.preventDefault();try{const seconds=rotation.save($('rotation-seconds').value);$('rotation-status').textContent='נשמר בדפדפן זה: '+seconds+' שניות. עדיין לא משפיע על האפליקציה.';}
 catch(error){$('rotation-status').textContent=error.name==='QuotaExceededError'||error.name==='SecurityError'?'הדפדפן לא מאפשר שמירה מקומית. אפשר לייצא את ההגדרה לקובץ.':error.message;}
};
$('rotation-seconds').oninput=()=>{$('rotation-status').textContent='השינוי טרם נשמר.';};
$('export-rotation').onclick=()=>{
 try{const config=rotation.exportConfig($('rotation-seconds').value),url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='banner-rotation-plan.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('rotation-status').textContent='יוצא קובץ תכנון. הוא אינו משנה את הפיד או את האפליקציה.';}
 catch(error){$('rotation-status').textContent=error.message;}
};

