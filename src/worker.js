import seed from '../public/links.json';
import { renderGroups, validateBoard, VERSION } from '../public/shared.js';

const COOKIE = '__Host-hub_editor';
const MAX_BODY = 100_000;
const SESSION_MS = 8 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
} });
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const tokenFrom = request => (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
const cookie = (value, age) => `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
const configured = env => typeof env.HUB_ADMIN_PIN === 'string' && /^\d{4,12}$/.test(env.HUB_ADMIN_PIN);
async function readJson(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Error('Send JSON.');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw new Error('Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request is empty.');
  const chunks = []; let size = 0;
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error('Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ok:true, version:VERSION});
    try {
      if (url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== url.origin)
          return json({error:'Please make changes from the hub page.'}, 403);
        const headers = new Headers(request.headers);
        headers.set('X-Hub-Client-IP', request.headers.get('CF-Connecting-IP') || 'unknown');
        return env.HUB_STORE.get(env.HUB_STORE.idFromName('team-board')).fetch(new Request(request, {headers}));
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405});
        const stored = await env.HUB_STORE.get(env.HUB_STORE.idFromName('team-board')).fetch(new Request(url.origin + '/api/board'));
        if (!stored.ok) return new Response('The hub is temporarily unavailable. Please refresh shortly.', {status:503});
        const board = await stored.json();
        const asset = await env.ASSETS.fetch(new Request(url.origin + '/index.html'));
        const html = (await asset.text()).replace(/<!-- BOARD-START -->[\s\S]*?<!-- BOARD-END -->/, () => `<!-- BOARD-START -->${renderGroups(board)}<!-- BOARD-END -->`);
        const headers = new Headers(asset.headers);
        headers.set('Cache-Control', 'no-store'); headers.delete('ETag'); headers.delete('Content-Length');
        return new Response(request.method === 'HEAD' ? null : html, {headers});
      }
      return env.ASSETS.fetch(request);
    } catch {
      return url.pathname.startsWith('/api/') ? json({error:'The hub could not connect. Please try again.'},503) : new Response('The hub is temporarily unavailable. Please refresh shortly.',{status:503});
    }
  },
};

export class HubStore {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    ctx.blockConcurrencyWhile(async () => {
      if (!await ctx.storage.get('board')) await ctx.storage.put('board', {...validateBoard(seed), revision:1});
      if (!await ctx.storage.get('session-salt')) await ctx.storage.put('session-salt', crypto.randomUUID());
    });
  }
  async fingerprint() {
    return hash((await this.ctx.storage.get('session-salt')) + ':' + this.env.HUB_ADMIN_PIN);
  }
  async session(request) {
    const token = tokenFrom(request);
    if (!configured(this.env) || !/^[a-f0-9]{64}$/.test(token)) return null;
    const key = 'session:' + await hash(token);
    const session = await this.ctx.storage.get(key);
    if (!session || session.expires <= Date.now() || session.pin !== await this.fingerprint()) return null;
    return key;
  }
  async login(request) {
    if (!configured(this.env)) return json({error:'Editing is not set up yet. Ask Ian to set the editor PIN in Cloudflare.'},503);
    const body = await readJson(request);
    const now = Date.now();
    const ipKey = 'rate:' + await hash(request.headers.get('X-Hub-Client-IP') || 'unknown');
    const admitted = await this.ctx.storage.transaction(async tx => {
      const keys = [ipKey, 'rate:global'];
      const values = await tx.get(keys);
      const rates = keys.map(key => { const r = values.get(key); return r?.expires > now ? r : {count:0, expires:now+WINDOW_MS}; });
      if (rates[0].count >= 5 || rates[1].count >= 50) return false;
      await tx.put(Object.fromEntries(keys.map((key,i)=>[key,{...rates[i],count:rates[i].count+1}])));
      return true;
    });
    await this.ensureAlarm();
    if (!admitted) return json({error:'Too many PIN attempts. Please wait 15 minutes and try again.'},429,{'Retry-After':'900'});
    const supplied = typeof body.pin === 'string' && /^\d{4,12}$/.test(body.pin) ? body.pin : '';
    const [actual, expected] = await Promise.all([hash(supplied), hash(this.env.HUB_ADMIN_PIN)]);
    let diff = 0; for (let i=0;i<actual.length;i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return json({error:'That PIN is not correct.'},401);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    await this.ctx.storage.put('session:' + await hash(token), {expires:now+SESSION_MS, pin:await this.fingerprint()});
    await this.ctx.storage.delete(ipKey);
    return json({authenticated:true},200,{'Set-Cookie':cookie(token, SESSION_MS/1000)});
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/board' && request.method === 'GET') return json({...await this.ctx.storage.get('board'),version:VERSION});
      if (path === '/api/session' && request.method === 'GET') return json({authenticated:!!await this.session(request),configured:configured(this.env)});
      if (path === '/api/login' && request.method === 'POST') return await this.login(request);
      if (path === '/api/logout' && request.method === 'POST') {
        const key = await this.session(request); if (key) await this.ctx.storage.delete(key);
        return json({authenticated:false},200,{'Set-Cookie':cookie('',0)});
      }
      if (path === '/api/board' && request.method === 'PUT') {
        if (!await this.session(request)) return json({error:'Please enter your PIN again to edit the board.'},401);
        const body = await readJson(request);
        if (!Number.isSafeInteger(body.revision)) return json({error:'Reload the board before saving.'},400);
        const validated = validateBoard(body);
        const result = await this.ctx.storage.transaction(async tx => {
          const current = await tx.get('board');
          if (current.revision !== body.revision) return null;
          const next = {...validated, revision:current.revision+1,updatedAt:new Date().toISOString()};
          await tx.put('board',next); return next;
        });
        if (!result) return json({error:'Someone else changed the board. Close this form, refresh the board, then try again.'},409);
        return json(result);
      }
      return json({error:'Not found.'},404);
    } catch (error) {
      if (error instanceof SyntaxError || error.message?.startsWith('Invalid') || /Send JSON|Request is/.test(error.message)) return json({error:error.message},400);
      return json({error:'The change could not be saved. Please try again.'},503);
    }
  }
  async ensureAlarm() {
    if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now()+WINDOW_MS);
  }
  async alarm() {
    let remaining = false;
    for (const prefix of ['session:','rate:']) {
      const entries = await this.ctx.storage.list({prefix});
      for (const [key,value] of entries) {
        if (value.expires <= Date.now()) await this.ctx.storage.delete(key); else remaining = true;
      }
    }
    if (remaining) await this.ctx.storage.setAlarm(Date.now()+WINDOW_MS);
  }
}
