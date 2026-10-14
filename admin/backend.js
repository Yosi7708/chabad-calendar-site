'use strict';
window.adsBackend=(()=>{
 const sessionKey='chabad-calendar-admin-session-v1';
 const verifierKey='chabad-calendar-admin-pkce-verifier-v1';
 let session=loadSession();
 function config(){const c=window.ADS_CONFIG;if(!c?.key||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.url))throw Error('טרם הוגדר חיבור Supabase באתר');return c;}
 function loadSession(){try{const c=window.ADS_CONFIG,raw=localStorage.getItem(sessionKey+':'+(c?.url||''));if(!raw)return null;const value=JSON.parse(raw);return typeof value?.access_token==='string'&&typeof value?.refresh_token==='string'&&Number.isFinite(Number(value.expires_at))?value:null;}catch{return null;}}
 function setSession(value){try{if(value)localStorage.setItem(sessionKey+':'+config().url,JSON.stringify(value));else localStorage.removeItem(sessionKey+':'+(window.ADS_CONFIG?.url||''));}catch{if(value)throw Error('לא ניתן לשמור את ההתחברות בדפדפן. אפשרו אחסון אתר ונסו שוב.');}session=value;}
 function clearSession(){session=null;try{localStorage.removeItem(sessionKey+':'+(window.ADS_CONFIG?.url||''));sessionStorage.removeItem(verifierKey);}catch{}}
 async function request(path,method='GET',body,signal){const c=config();if(session&&Date.now()>session.expires_at*1000-60000&&path.indexOf('/auth/')!==0){const r=await fetch(c.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok){clearSession();throw Error('פג תוקף ההתחברות — יש להתחבר מחדש');}setSession(await r.json());}
 const r=await fetch(c.url+path,{method,signal,headers:{apikey:c.key,...(session?{Authorization:'Bearer '+session.access_token}:{}),...(body instanceof File?{'Content-Type':body.type}:{'Content-Type':'application/json'}),Prefer:'return=representation'},...(body!==undefined?{body:body instanceof File?body:JSON.stringify(body)}:{})});const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('תגובה לא תקינה מהשרת');}if(!r.ok)throw Error(data?.message||data?.msg||data?.error_description||'הפעולה נכשלה');return data;}
 function row(a){return {...a,starts:a.starts||'',ends:a.ends||'',displayStatus:a.status!=='active'?a.status:a.ends&&Date.parse(a.ends)<=Date.now()?'expired':a.starts&&Date.parse(a.starts)>Date.now()?'scheduled':'live'};}
 async function list(){return (await request('/rest/v1/ad_campaigns?order=updated_at.desc')).map(row);}
 async function requireAdmin(){if(!session)throw Error('Sign in required');if(!await request('/rest/v1/rpc/is_ad_admin','POST',{})){clearSession();throw Error('לחשבון Google זה אין הרשאת ניהול');}}
 async function signInWithGoogle(){const c=config();if(!globalThis.crypto?.subtle)throw Error('הדפדפן אינו תומך בהתחברות מאובטחת עם Google');const random=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');};const verifier=random(),challengeBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)),challenge=btoa(String.fromCharCode(...new Uint8Array(challengeBytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');sessionStorage.setItem(verifierKey,verifier);const redirectTo=location.origin+location.pathname,authorize=new URL(c.url+'/auth/v1/authorize');authorize.search=new URLSearchParams({provider:'google',redirect_to:redirectTo,code_challenge:challenge,code_challenge_method:'s256',apikey:c.key}).toString();location.assign(authorize.href);}
 async function completeGoogleSignIn(){const params=new URLSearchParams(location.search),code=params.get('code');if(!code){if(params.has('error')){const detail=params.get('error_description')||params.get('error');history.replaceState({},document.title,location.pathname);try{sessionStorage.removeItem(verifierKey);}catch{}throw Error('התחברות Google נכשלה: '+detail);}return false;}const verifier=sessionStorage.getItem(verifierKey);history.replaceState({},document.title,location.pathname);if(!verifier){clearSession();throw Error('פג תוקף תהליך ההתחברות. נסו להתחבר שוב.');}const c=config();sessionStorage.removeItem(verifierKey);const response=await fetch(c.url+'/auth/v1/token?grant_type=pkce',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({auth_code:code,code_verifier:verifier})});let data;try{data=await response.json();}catch{data=null;}if(!response.ok)throw Error(data?.msg||data?.message||data?.error_description||'לא ניתן להשלים התחברות Google');setSession(data);try{await requireAdmin();}catch(error){try{await request('/auth/v1/logout','POST',{});}catch{}clearSession();throw error;}return true;}
 async function api(path,method,data){
  if(path==='login'){const value=await request('/auth/v1/token?grant_type=password','POST',data);setSession(value);try{await requireAdmin();}catch(e){clearSession();throw Error(e.message==='לחשבון Google זה אין הרשאת ניהול'?'לחשבון זה אין הרשאת ניהול':e.message);}return {};}
  if(path==='logout'){try{await request('/auth/v1/logout','POST',{});}finally{clearSession();}return {};}
  if(!session)throw Error('Sign in required');
  if(path==='session'){await requireAdmin();const c=config();return {feedUrl:c.url+'/rest/v1/rpc/ad_feed?apikey='+encodeURIComponent(c.key)};}
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
 async function upload(file,signal){
  if(!session)throw Error('Sign in required');
  const allowed=['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'];
  if(!allowed.includes(file.type)||!file.size||file.size>(file.type.startsWith('image/')?8:30)*1024*1024)throw Error('סוג או גודל קובץ לא נתמך');
  if(file.type==='image/gif'){const header=String.fromCharCode(...new Uint8Array(await file.slice(0,6).arrayBuffer()));if(file.size<14||!['GIF87a','GIF89a'].includes(header))throw Error('תוכן הקובץ אינו GIF תקין');}
  return request('/functions/v1/upload-ad-media','POST',file,signal);
 }

 return {api,upload,signInWithGoogle,completeGoogleSignIn,hasSession:()=>!!session};
})();
