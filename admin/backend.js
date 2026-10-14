'use strict';
// Access and refresh tokens stay in memory; reloading requires signing in again.
window.adsBackend=(()=>{
 let session=null;
 function config(){const c=window.ADS_CONFIG;if(!c?.key||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.url))throw Error('טרם הוגדר חיבור Supabase באתר');return c;}
 async function request(path,method='GET',body,signal){const c=config();if(session&&Date.now()>session.expires_at*1000-60000&&path.indexOf('/auth/')!==0){const r=await fetch(c.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok){session=null;throw Error('פג תוקף ההתחברות — יש להתחבר מחדש');}session=await r.json();}
 const r=await fetch(c.url+path,{method,signal,headers:{apikey:c.key,...(session?{Authorization:'Bearer '+session.access_token}:{}),...(body instanceof File?{'Content-Type':body.type}:{'Content-Type':'application/json'}),Prefer:'return=representation'},...(body!==undefined?{body:body instanceof File?body:JSON.stringify(body)}:{})});const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('תגובה לא תקינה מהשרת');}if(!r.ok)throw Error(data?.message||data?.msg||data?.error_description||'הפעולה נכשלה');return data;}
 function row(a){return {...a,starts:a.starts||'',ends:a.ends||'',displayStatus:a.status!=='active'?a.status:a.ends&&Date.parse(a.ends)<=Date.now()?'expired':a.starts&&Date.parse(a.starts)>Date.now()?'scheduled':'live'};}
 async function list(){return (await request('/rest/v1/ad_campaigns?order=updated_at.desc')).map(row);}
 async function api(path,method,data){
  if(path==='login'){session=await request('/auth/v1/token?grant_type=password','POST',data);try{if(!await request('/rest/v1/rpc/is_ad_admin','POST',{}))throw Error('לחשבון זה אין הרשאת ניהול');}catch(e){session=null;throw e;}return {};}
  if(path==='logout'){try{await request('/auth/v1/logout','POST',{});}finally{session=null;}return {};}
  if(!session)throw Error('Sign in required');
  if(path==='session'){const c=config();return {feedUrl:c.url+'/rest/v1/rpc/ad_feed?apikey='+encodeURIComponent(c.key)};}
  if(path==='display-settings'&&method==='GET'){const rows=await request('/rest/v1/ad_settings?id=eq.true&select=banner_rotation_seconds');if(!rows.length)throw Error('Missing ad settings migration');return {bannerRotationSeconds:rows[0].banner_rotation_seconds};}
  if(path==='display-settings'&&method==='POST'){const seconds=Number(data.bannerRotationSeconds);if(!Number.isInteger(seconds)||seconds<5||seconds>300)throw Error('Rotation must be 5–300 whole seconds');const rows=await request('/rest/v1/ad_settings?id=eq.true','PATCH',{banner_rotation_seconds:seconds});if(!rows.length)throw Error('Missing ad settings migration');return {bannerRotationSeconds:rows[0].banner_rotation_seconds};}
  if(path==='clicks'&&method==='GET'){const since=new Date();since.setUTCDate(since.getUTCDate()-29);const day=since.toISOString().slice(0,10);return request('/rest/v1/ad_click_counts?select=campaign_id,placement,day,clicks&day=gte.'+day+'&order=day.desc');}
  if(path==='campaigns'&&method==='GET')return list();
  if(path==='campaigns'&&method==='POST'){const value={};for(const k of ['title','body','url','imageUrl','videoUrl','banner','popup','status'])value[k]=data[k];value.starts=data.starts||null;value.ends=data.ends||null;
   if(data.id){const result=await request('/rest/v1/ad_campaigns?id=eq.'+encodeURIComponent(data.id)+'&revision=eq.'+Number(data.revision),'PATCH',value);if(!result.length)throw Error('הקמפיין השתנה בלשונית אחרת. רעננו לפני שמירה');}
   else await request('/rest/v1/ad_campaigns','POST',value);return list();}
  if(path.startsWith('campaigns/')&&method==='DELETE'){const result=await request('/rest/v1/ad_campaigns?id=eq.'+encodeURIComponent(path.slice(10))+'&revision=eq.'+Number(data.revision),'DELETE');if(!result.length)throw Error('הקמפיין השתנה. רעננו לפני מחיקה');return {};}
  throw Error('פעולה לא נתמכת');
 }
 async function upload(file,signal){const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[file.type];if(!ext||!file.size||file.size>(file.type.startsWith('image/')?8:30)*1024*1024)throw Error('סוג או גודל קובץ לא נתמך');const name=crypto.randomUUID()+'.'+ext;await request('/storage/v1/object/ad-media/'+name,'POST',file,signal);return {url:config().url+'/storage/v1/object/public/ad-media/'+name};}
 return {api,upload};
})();

