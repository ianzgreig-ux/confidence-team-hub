import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateBoard,renderGroups} from '../public/shared.js';

test('hub authentication, persistence, safe links and concurrent edits',async t=>{
 const tmp=await mkdtemp(join(tmpdir(),'confidence-hub-test-'));
 const bundle=join(tmp,'worker.mjs');
 await build({entryPoints:['src/worker.js'],outfile:bundle,bundle:true,format:'esm',platform:'browser',target:'es2022'});
 const pin=String(1000+Math.floor(Math.random()*9000));
 const opts={modules:true,modulesRoot:tmp,scriptPath:bundle,compatibilityDate:'2026-10-02',durableObjects:{HUB_STORE:{className:'HubStore',useSQLite:true}},resourcePersistencePath:join(tmp,'store'),bindings:{HUB_ADMIN_PIN:pin},serviceBindings:{ASSETS:async request=>new Response(await readFile('dist/index.html','utf8'),{headers:{'Content-Type':'text/html'}})}};
 let mf=new Miniflare(convertV4MiniflareOptions(opts));
 let cookie='';
 const call=(path,method='GET',body,auth=false,origin='https://hub.test',ip='192.0.2.1')=>mf.dispatchFetch('https://hub.test'+path,{method,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':ip,...(auth?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 try {
  let board=await (await call('/api/board')).json();
  await t.test('requested layout is seeded and unrelated cards remain',()=>{
   assert.deepEqual(board.groups.map(g=>g.links.map(l=>l.id)),[['schedule','huddle','ar'],['weave','patients'],['events','training','attendees']]);
   assert.match(board.groups[2].links[1].url,/quickbase/);
  });
  await t.test('anonymous writes and cross-origin requests are rejected',async()=>{
   assert.equal((await call('/api/board','PUT',board)).status,401);
   assert.equal((await call('/api/login','POST',{pin},false,'https://other.test')).status,403);
  });
  await t.test('PIN login creates a protected opaque cookie',async()=>{
   assert.equal((await call('/api/login','POST',{pin:'not-the-pin'})).status,401);
   const response=await call('/api/login','POST',{pin});assert.equal(response.status,200);
   const setCookie=response.headers.get('Set-Cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);cookie=setCookie.split(';')[0];
   assert.equal((await (await call('/api/session','GET',undefined,true)).json()).authenticated,true);
  });
  await t.test('add, edit, move, remove and reject stale saves',async()=>{
   const next=structuredClone(board);next.groups[1].links.push({id:'test-link',name:'Test card',description:'A test card',label:'Test',url:'https://example.com/',icon:'grid',featured:false});
   let res=await call('/api/board','PUT',next,true);assert.equal(res.status,200);board=await res.json();
   const move=structuredClone(board);const card=move.groups[1].links.pop();card.name='Updated test';move.groups[2].links.push(card);
   res=await call('/api/board','PUT',move,true);assert.equal(res.status,200);board=await res.json();assert.equal(board.groups[2].links.at(-1).name,'Updated test');
   assert.equal((await call('/api/board','PUT',next,true)).status,409);
   const a=structuredClone(board),b=structuredClone(board);a.groups[0].links[0].description='First concurrent write';b.groups[0].links[0].description='Second concurrent write';
   const statuses=await Promise.all([call('/api/board','PUT',a,true),call('/api/board','PUT',b,true)]);assert.deepEqual(statuses.map(r=>r.status).sort(),[200,409]);
   board=await (await call('/api/board')).json();board.groups[2].links=board.groups[2].links.filter(l=>l.id!=='test-link');
   res=await call('/api/board','PUT',board,true);assert.equal(res.status,200);board=await res.json();
  });
  await t.test('script URLs, credential URLs and invalid structures are rejected',async()=>{
   for(const url of ['javascript:alert(1)','data:text/html,test','https://user:pass@example.com']){
    const bad=structuredClone(board);bad.groups[0].links[0].url=url;assert.equal((await call('/api/board','PUT',bad,true)).status,400);
   }
   const bad=structuredClone(board);bad.groups[0].links[0].name='<img src=x onerror=alert(1)>';
   assert.match(renderGroups(validateBoard(bad)),/&lt;img/);assert.doesNotMatch(renderGroups(validateBoard(bad)),/<img src=x/);
  });
  await t.test('saved changes survive a runtime restart and render without JavaScript',async()=>{
   await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(opts));
   const saved=await(await call('/api/board')).json();assert.equal(saved.revision,board.revision);assert.deepEqual(saved.groups,board.groups);
   const html=await(await call('/')).text();assert.match(html,new RegExp(board.groups[0].links[0].description));assert.doesNotMatch(html,/The Bar Monday Board/);
  });
  await t.test('repeated wrong PINs are limited and logout revokes the session',async()=>{
   for(let i=0;i<5;i++)assert.equal((await call('/api/login','POST',{pin:'000000'},false,'https://hub.test','192.0.2.2')).status,401);
   assert.equal((await call('/api/login','POST',{pin},false,'https://hub.test','192.0.2.2')).status,429);
   assert.equal((await call('/api/logout','POST',{},true)).status,200);assert.equal((await call('/api/board','PUT',board,true)).status,401);
  });
  await t.test('changing or removing the secret disables previous sessions',async()=>{
   const res=await call('/api/login','POST',{pin});cookie=res.headers.get('Set-Cookie').split(';')[0];
   await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions({...opts,bindings:{HUB_ADMIN_PIN:pin+'1'}}));
   assert.equal((await call('/api/board','PUT',board,true)).status,401);
   await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions({...opts,bindings:{}}));
   assert.equal((await call('/api/login','POST',{pin})).status,503);
   assert.equal((await call('/api/board','PUT',board,true)).status,401);
   assert.equal((await call('/api/board')).status,200);
  });
 }finally{await mf.dispose();await rm(tmp,{recursive:true,force:true});}
});
