const CACHE='questlog-v1',ASSETS=['./','index.html','css/styles.css','js/app.js','js/store.js','js/audio.js','manifest.webmanifest','icons/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});
const ACTIONS=[{action:'complete',title:'✅ Mark Complete'},{action:'snooze',title:'💤 Snooze 10m'}];
// Server-sent Web Push (optional upgrade): payload {title, body, id}
self.addEventListener('push',e=>{const d=e.data?.json()||{};e.waitUntil(self.registration.showNotification(d.title||'⏰ Quest reminder',{body:d.body,data:{id:d.id},actions:ACTIONS,icon:'icons/icon.svg'}))});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const id=(e.notification.data||{}).id,action=e.action||'open';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    if(list.length){list[0].focus();list[0].postMessage({action,id})}
    else return clients.openWindow(`./?action=${action}&id=${id}`);
  }));
});
