import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {renderGroups,validateBoard,VERSION} from '../public/shared.js';
const board=validateBoard(JSON.parse(await readFile(new URL('../public/links.json',import.meta.url),'utf8')));
const template=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/index.html',import.meta.url),template.replace('<!-- SYSTEMS -->',renderGroups(board)).replaceAll('{{VERSION}}',VERSION));
for (const name of ['styles.css','app.js','shared.js','_headers']) await copyFile(new URL('../public/'+name,import.meta.url),new URL('../dist/'+name,import.meta.url));
console.log(`Built Team Hub v${VERSION}, ${board.groups.flatMap(g=>g.links).length} cards.`);
