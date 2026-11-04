/* Minimal notification worker. It does not intercept fetches or cache site content. */
self.addEventListener('notificationclick',function(event){
 event.notification.close();
 event.waitUntil((async function(){
  const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const app=all.find(client=>new URL(client.url).origin===self.location.origin);
  if(app){await app.focus();return;}
  await self.clients.openWindow('/');
 })());
});
