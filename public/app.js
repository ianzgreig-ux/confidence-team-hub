import {renderGroups,validateBoard,GROUPS,icons,CARD_COLORS,cardColor} from './shared.js';
const $=id=>document.getElementById(id);
let board=null,editing=false,currentId=null,editRevision=null,saving=false,refreshing=false;
let editReady=true;
const status=(message,error=false)=>{$('board-status').textContent=message;$('board-status').classList.toggle('error',error);};
async function api(path,options={}) {
  let response;
  try { response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...options.headers}}); }
  catch { throw new Error('Could not connect. Check your connection and try again.'); }
  const data=await response.json().catch(()=>({error:'The hub returned an unexpected response. Please refresh.'}));
  if (!response.ok) {
    if(response.status===401 && path!=='/api/login') {editing=false;render();}
    const error=new Error(data.error||'The change could not be saved.');error.status=response.status;throw error;
  }
  return data;
}
function render() {
  if(board) $('board').innerHTML=renderGroups(board,editing);
  $('edit-board').textContent=editing?'Done editing':'Edit board';
}
async function refresh({initial=false}={}) {
  if(refreshing||saving||$('card-dialog').open||$('remove-dialog').open||$('pin-dialog').open)return;
  refreshing=true;
  try {
    const [next,session]=await Promise.all([api('/api/board'),api('/api/session')]);
    board=next;editing=session.authenticated;editReady=session.configured;render();
    if(!initial)status('Board refreshed.');
  }catch(error){status(error.message,true);}
  finally{refreshing=false;$('edit-board').hidden=false;$('refresh-board').hidden=false;}
}
$('edit-board').addEventListener('click',async()=>{
  if(editing){
    try{await api('/api/logout',{method:'POST'});editing=false;render();status('Editing locked.');}
    catch(error){status(error.message,true);}return;
  }
  if(!editReady){status('Editing is not set up yet. Ask Ian to set the editor PIN in Cloudflare.',true);return;}
  $('pin-form').reset();$('pin-error').textContent='';$('pin-dialog').showModal();$('pin').focus();
});
$('refresh-board').addEventListener('click',()=>refresh());
$('pin-form').addEventListener('submit',async event=>{
  event.preventDefault();$('unlock').disabled=true;$('pin-error').textContent='';
  const pin=$('pin').value;
  try{await api('/api/login',{method:'POST',body:JSON.stringify({pin})});$('pin').value='';board=await api('/api/board');editing=true;render();$('pin-dialog').close();status('Editing unlocked. Each saved change is shared with the team.');}
  catch(error){$('pin-error').textContent=error.message;$('pin').value='';$('pin').focus();}
  finally{$('unlock').disabled=false;}
});
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>{if(!saving)$(button.dataset.close).close();});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
$('pin-dialog').addEventListener('close',()=>{$('pin').value='';});
for(const group of GROUPS){const option=new Option(group.name,group.id);$('card-section').add(option);}
const iconNames={calendar:'Calendar',sun:'Sun',grid:'Grid',columns:'Board',record:'Patient record',message:'Message',person:'Person',ticket:'Ticket',book:'Training',check:'Checklist'};
for(const key of Object.keys(icons))$('card-icon').add(new Option(iconNames[key],key));
for(const color of CARD_COLORS) {
  const label=document.createElement('label');label.className='colour-choice';
  const input=document.createElement('input');input.type='radio';input.name='card-color';input.value=color.id;input.required=true;
  const swatch=document.createElement('span');swatch.className='colour-swatch color-'+color.id;swatch.setAttribute('aria-hidden','true');
  label.append(input,swatch,document.createTextNode(color.name));$('card-colors').append(label);
}
const selectedColor=()=>document.querySelector('input[name="card-color"]:checked')?.value||'white';
function updateColorPreview() {
  $('card-colour-preview').className='colour-preview color-'+selectedColor();
  $('preview-name').textContent=$('card-name').value||'Card name';
  $('preview-description').textContent=$('card-description').value||'Your card description';
}
$('card-form').addEventListener('input',updateColorPreview);
$('card-colors').addEventListener('change',updateColorPreview);
function positions(selected) {
  const links=board.groups.find(g=>g.id===$('card-section').value).links.filter(l=>l.id!==currentId);
  $('card-position').replaceChildren(...Array.from({length:links.length+1},(_,i)=>new Option(i===0?'1 · First':`${i+1} · After ${links[i-1].name}`,String(i))));
  $('card-position').value=String(selected??links.length);
}
$('card-section').addEventListener('change',()=>positions());
function openCard(groupId,id=null) {
  if(!editing||!board||saving)throw new Error('Unlock editing first.');
  const group=id?board.groups.find(g=>g.links.some(l=>l.id===id)):board.groups.find(g=>g.id===groupId);
  if(!group)throw new Error('Card or section not found.');
  const card=id?group.links.find(l=>l.id===id):{name:'',description:'',url:'',label:'',icon:'grid',featured:false};
  currentId=id;editRevision=board.revision;
  $('card-title').textContent=id?'Edit card':'Add card';$('card-form').reset();$('card-error').textContent='';
  for(const field of ['name','description','url','label','icon'])$('card-'+field).value=card[field]||'';
  for(const input of document.querySelectorAll('input[name="card-color"]'))input.checked=input.value===cardColor(card);
  updateColorPreview();$('card-section').value=group.id;
  positions(id?group.links.findIndex(l=>l.id===id):undefined);$('remove-card').hidden=!id;
  $('card-dialog').showModal();$('card-name').focus();
}
$('board').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.edit)openCard(null,button.dataset.edit);else if(button.dataset.add)openCard(button.dataset.add);
});
function setSaving(value){saving=value;for(const element of document.querySelectorAll('dialog button,dialog input,dialog textarea,dialog select'))element.disabled=value;}
async function save(next,revision) {
  validateBoard(next);
  const result=await api('/api/board',{method:'PUT',body:JSON.stringify({...next,revision})});
  board=result;render();return result;
}
$('card-form').addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;$('card-error').textContent='';
  const next=structuredClone(board);
  for(const group of next.groups)group.links=group.links.filter(l=>l.id!==currentId);
  const card={id:currentId||crypto.randomUUID(),name:$('card-name').value,description:$('card-description').value,url:$('card-url').value.trim()||null,label:$('card-label').value,icon:$('card-icon').value,color:selectedColor(),featured:selectedColor()==='chocolate'};
  const group=next.groups.find(g=>g.id===$('card-section').value);
  group.links.splice(Number($('card-position').value),0,card);setSaving(true);
  try{await save(next,editRevision);$('card-dialog').close();status('Card saved for everyone.');}
  catch(error){$('card-error').textContent=error.message;}
  finally{setSaving(false);}
});
$('remove-card').addEventListener('click',()=>{
  $('remove-message').textContent=`Remove “${$('card-name').value}” from the team hub?`;
  $('remove-error').textContent='';$('remove-dialog').showModal();
});
$('confirm-remove').addEventListener('click',async()=>{
  if(saving)return;const next=structuredClone(board);for(const group of next.groups)group.links=group.links.filter(l=>l.id!==currentId);setSaving(true);
  try{await save(next,editRevision);$('remove-dialog').close();$('card-dialog').close();status('Card removed from the hub.');}
  catch(error){$('remove-error').textContent=error.message;}
  finally{setSaving(false);}
});
window.addEventListener('focus',()=>refresh({initial:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh({initial:true});});
const refreshTimer=setInterval(()=>{if(!document.hidden)refresh({initial:true});},60000);
window.addEventListener('pagehide',()=>clearInterval(refreshTimer),{once:true});
// Agent tools open the same editor. Saving still requires the PIN session and explicit UI save.
const modelContext=document.modelContext;
if(modelContext?.registerTool){
  const lifecycle=new AbortController();
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const tools=[
    {name:'read_hub_cards',description:'Read the currently displayed hub sections and cards.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({revision:board?.revision,groups:board?.groups||[]})},
    {name:'open_card_editor',description:'Open the visible card editor for an existing card, or start a new card in a section. Does not save. Requires editing to be unlocked with the PIN.',inputSchema:{type:'object',properties:{cardId:{type:'string'},sectionId:{type:'string',enum:GROUPS.map(g=>g.id)}},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input!=='object'||(!input.cardId&&!input.sectionId))throw new Error('Specify cardId or sectionId.');openCard(input.sectionId,input.cardId||null);return {opened:true,saved:false};}},
  ];
  for(const tool of tools){try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
}
await refresh({initial:true});
