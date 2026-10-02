import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
const config = JSON.parse(await readFile(new URL('../public/links.json', import.meta.url), 'utf8'));
const icons = {
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 columns:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16M5.5 8h1M11.5 8h1M17.5 8h1"/>',
 record:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 7v6M9 10h6M9 17h6"/>',
 message:'<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/><path d="M7 10h10M7 14h6"/>',
 person:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M20 8v6M17 11h6"/>',
 ticket:'<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6ZM15 6v3M15 11v2M15 15v3"/>',
 book:'<path d="M12 5v16M12 5C9 3 6 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 1Z"/>',
 check:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 3h6v3H9zM8 13l3 3 5-6"/>'
};
const escape = text => String(text).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids = new Set();
const sections = config.groups.map((group,index) => `<section class="system-group" aria-labelledby="group-${index}"><div class="section-heading"><h2 id="group-${index}">${escape(group.name)}</h2><p>${escape(group.description)}</p></div><div class="cards">${group.links.map(link=>{
 if(ids.has(link.id)) throw new Error('Duplicate link id: '+link.id);
 ids.add(link.id);
 if(link.url && new URL(link.url).protocol !== 'https:') throw new Error('HTTPS URL required: '+link.id);
 const tag=link.url?'a':'article';
 const attrs=link.url?`href="${escape(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(link.name)}, opens in a new tab"`:'';
 return `<${tag} class="card${link.featured?' featured':''}${link.url?'':' pending'}" ${attrs} data-system="${escape(link.id)}"><div class="card-top"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[link.icon]||icons.grid}</svg></span><span class="card-label">${escape(link.label)}</span></div><h3>${escape(link.name)}</h3><p>${escape(link.description)}</p><span class="card-action">${link.url?'Open system':'Link to be added'}</span></${tag}>`;
 }).join('')}</div></section>`).join('\n');
const template=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/index.html',import.meta.url),template.replace('<!-- SYSTEMS -->',sections));
await copyFile(new URL('../public/styles.css',import.meta.url),new URL('../dist/styles.css',import.meta.url));
await copyFile(new URL('../public/_headers',import.meta.url),new URL('../dist/_headers',import.meta.url));
console.log(`Built ${ids.size} systems, ${config.groups.flatMap(g=>g.links).filter(l=>l.url).length} configured links.`);
