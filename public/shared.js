export const icons = {
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
export const VERSION = '1.4.0';
export const CARD_COLORS = [
  {id:'white',name:'White',hex:'#ffffff'}, {id:'ivory',name:'Ivory',hex:'#f7f6f2'}, {id:'rose',name:'Rose',hex:'#c77975'},
  {id:'blush',name:'Blush',hex:'#d2a1a8'}, {id:'orange',name:'Orange',hex:'#dd7929'}, {id:'chocolate',name:'Chocolate',hex:'#5d3727'},
];
export const cardColor = card => (card.color==='custom'||CARD_COLORS.some(c=>c.id===card.color)) ? card.color : card.featured ? 'chocolate' : 'white';
export const isHexColor = value => typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value);
export const cardBackground = card => cardColor(card)==='custom' && isHexColor(card.backgroundColor) ? card.backgroundColor.toLowerCase() : CARD_COLORS.find(c=>c.id===cardColor(card))?.hex||'#ffffff';
export function cardTextColor(card) {
  if(isHexColor(card.textColor))return card.textColor.toLowerCase();
  const color=cardColor(card);
  if(color==='custom') {
    const bg=cardBackground(card);
    const channels=[1,3,5].map(i=>parseInt(bg.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
    const luminance=channels.reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
    return luminance>.179?'#000000':'#ffffff';
  }
  return color==='chocolate'?'#f7f6f2':['rose','orange'].includes(color)?'#2d1b17':'#5d3727';
}
export function cardColourCss(card) {
  const rules=[];
  if(cardColor(card)==='custom') {
    const bg=cardBackground(card);rules.push(`--card-bg:${bg}`,`--card-border:${bg}`,'--card-icon-bg:transparent');
  }
  if(cardColor(card)==='custom'||isHexColor(card.textColor)) {
    const ink=cardTextColor(card);for(const name of ['ink','muted','accent'])rules.push(`--card-${name}:${ink}`);
    rules.push('--card-icon-bg:transparent');
  }
  return rules.join(';');
}
export function renderBoardStyles(board) {
  return (board?.groups||[]).flatMap(g=>g.links).filter(c=>/^[a-zA-Z0-9_-]{1,80}$/.test(c.id)).map(card=>{
    const css=cardColourCss(card);return css?`[data-system="${card.id}"]{${css}}`:'';
  }).join('\n');
}
export const GROUPS = [
  {id:'daily',name:'Daily operations',description:'The working day'},
  {id:'bar',name:'The Confidence Bar',description:'Patients and communication'},
  {id:'lab',name:'The Confidence Lab',description:'Training and events'},
];
export const escape = text => String(text ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateBoard(board) {
  if (!board || !Array.isArray(board.groups) || board.groups.length !== GROUPS.length) throw new Error('Invalid board sections.');
  const seen = new Set(); let count = 0;
  const text = (value,max,required=false) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Invalid card text.');
    return value.trim();
  };
  const groups = GROUPS.map((meta,index) => {
    const group = board.groups[index];
    if (group.id !== meta.id || !Array.isArray(group.links)) throw new Error('Invalid board section.');
    return {...meta, links:group.links.map(card => {
      if (++count > 60) throw new Error('Invalid board: maximum 60 cards.');
      if (!card || typeof card.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(card.id) || seen.has(card.id)) throw new Error('Invalid or duplicate card ID.');
      seen.add(card.id);
      let url = card.url;
      if (url === null || url === '') url = null;
      else {
        if (typeof url !== 'string' || url.length > 2000) throw new Error('Invalid website link.');
        let parsed; try { parsed = new URL(url); } catch { throw new Error('Invalid website link. Use a full https:// address.'); }
        if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) throw new Error('Invalid website link. Use a full https:// address without passwords.');
        url = parsed.href;
      }
      if (!Object.hasOwn(icons,card.icon) || (card.featured !== undefined && typeof card.featured !== 'boolean')) throw new Error('Invalid card appearance.');
      if (card.color !== undefined && card.color!=='custom' && !CARD_COLORS.some(c=>c.id===card.color)) throw new Error('Invalid card colour.');
      const color = cardColor(card);
      if(color==='custom'&&!isHexColor(card.backgroundColor))throw new Error('Invalid background colour. Use a six-digit hex code such as #c77975.');
      if(card.textColor!==undefined&&card.textColor!==null&&!isHexColor(card.textColor))throw new Error('Invalid text colour. Use a six-digit hex code such as #ffffff.');
      const backgroundColor=color==='custom'?card.backgroundColor.toLowerCase():null;
      const textColor=isHexColor(card.textColor)?card.textColor.toLowerCase():null;
      return {id:card.id,name:text(card.name,80,true),description:text(card.description,240),label:text(card.label,32),icon:card.icon,url,color,backgroundColor,textColor,featured:color==='chocolate'};
    })};
  });
  return {version:VERSION,groups};
}
export function renderGroups(board, editing=false) {
  return board.groups.map(group => `<section class="system-group" aria-labelledby="group-${escape(group.id)}"><div class="section-heading"><div><h2 id="group-${escape(group.id)}">${escape(group.name)}</h2><p>${escape(group.description)}</p></div>${editing?`<button class="button small" data-add="${escape(group.id)}">Add card</button>`:''}</div><div class="cards">${group.links.map(card => {
    const tag=card.url?'a':'article';
    const attrs=card.url?`href="${escape(card.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(card.name)}, opens in a new tab"`:'';
    return `<div class="card-shell"><${tag} class="card color-${cardColor(card)}${card.url?'':' pending'}" ${attrs} data-system="${escape(card.id)}"><div class="card-top"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[card.icon]||icons.grid}</svg></span><span class="card-label">${escape(card.label)}</span></div><h3>${escape(card.name)}</h3><p>${escape(card.description)}</p><span class="card-action">${card.url?'Open system':'Link to be added'}</span></${tag}>${editing?`<button class="button card-edit" data-edit="${escape(card.id)}" aria-label="Edit ${escape(card.name)}">Edit card</button>`:''}</div>`;
  }).join('') || '<p class="note">No cards in this section.</p>'}</div></section>`).join('\n');
}
