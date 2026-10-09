'use strict';

/*
 * Yoyo Scoring Server
 * -------------------
 * One Node process that provides:
 *   /score         scoring page (judges' laptop + controllers)
 *   /overlay/KEY   stream overlay (OBS Browser Source)
 *   /admin         event management page (password-protected API)
 *   /ws            WebSocket endpoint used by all three pages
 *   /health        plain "ok" for uptime monitors
 *
 * Live scores are held in memory by the server (the scoring page can restore
 * them if the server restarts). Event records (name, judge count, codes,
 * expiry) are saved to DATA_DIR/events.json.
 *
 * Legacy mode: if RELAY_AUTH_TOKEN is set, the old bridge/tester protocol
 * (identify + room pass-through) keeps working on the same WebSocket port.
 *
 * Environment variables:
 *   ADMIN_PASSWORD     required to use /admin (admin is disabled without it)
 *   MAX_JUDGES         max judges per event, default 8 (1-16)
 *   DATA_DIR           where events.json is stored, default ./data
 *   RELAY_AUTH_TOKEN   optional, enables the legacy relay protocol
 *   PORT               provided by the host
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

// ------------------------------------------------------------------ config
const PORT = parseInt(process.env.PORT, 10) || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const LEGACY_TOKEN = process.env.RELAY_AUTH_TOKEN || '';
const MAX_JUDGES = Math.min(Math.max(parseInt(process.env.MAX_JUDGES, 10) || 8, 1), 16);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const EPOCH = crypto.randomBytes(4).toString('hex'); // changes every process start

const MAX_SCORERS_PER_EVENT = 4; // minimum; the real cap is max(this, judges + 2)
const CLAIM_GRACE_MS = 20000;    // a dropped laptop keeps its judge slots this long
const MAX_VIEWERS_PER_EVENT = 10;
const MAX_SCORE = 999;
const TICK_MS = 3000;   // app-level heartbeat so browsers can detect dead connections
const PING_MS = 15000;  // protocol-level ping so the server can drop dead sockets
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = { admin: 10, ws: 30 }; // ws is higher: a whole venue shares one public IP
const BLOCK_MS = 10 * 60 * 1000;

const PAGES = { '/score': 'score.html', '/admin': 'admin.html' };
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', // overlay URLs contain a key; never leak it via Referer
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

// ------------------------------------------------------------------- words
const WORDS = [
  'amber', 'anchor', 'apple', 'arrow', 'aspen', 'atlas', 'badger', 'banjo', 'beacon', 'birch',
  'bison', 'blaze', 'bloom', 'bronze', 'cactus', 'canyon', 'castle', 'cedar', 'cherry', 'cider',
  'cobalt', 'comet', 'copper', 'coral', 'cosmos', 'crane', 'crater', 'crimson', 'crystal', 'dagger',
  'dingo', 'dolphin', 'dragon', 'eagle', 'ember', 'falcon', 'fern', 'ferret', 'fjord', 'flint',
  'forest', 'fossil', 'galaxy', 'garnet', 'geyser', 'ginger', 'glacier', 'granite', 'harbor', 'hazel',
  'heron', 'hickory', 'honey', 'indigo', 'island', 'jaguar', 'jasper', 'jungle', 'kayak', 'kestrel',
  'lagoon', 'lantern', 'lemon', 'lilac', 'lotus', 'lynx', 'magnet', 'mango', 'maple', 'marble',
  'meadow', 'mesa', 'meteor', 'mint', 'nectar', 'nickel', 'nomad', 'oasis', 'olive', 'onyx',
  'orbit', 'orchid', 'otter', 'panda', 'pebble', 'pepper', 'phoenix', 'pine', 'planet', 'poppy',
  'prairie', 'quartz', 'quill', 'rabbit', 'raven', 'ridge', 'river', 'robin', 'saddle', 'saffron',
  'sage', 'sparrow', 'spruce', 'summit', 'sunset', 'thistle', 'thunder', 'tiger', 'timber', 'topaz',
  'tundra', 'velvet', 'violet', 'walnut', 'willow', 'winter', 'yarrow', 'zephyr',
];

// ------------------------------------------------------------------ events
let events = {};            // id -> event record (persisted)
const byCode = new Map();   // normalized scorer code -> event
const byKey = new Map();    // overlay view key -> event
const runtimes = new Map(); // id -> { state, scorers:Set, viewers:Set } (memory only)

function norm(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function reindex() {
  byCode.clear();
  byKey.clear();
  for (const ev of Object.values(events)) {
    byCode.set(norm(ev.scorerCode), ev);
    byKey.set(ev.viewKey, ev);
  }
}

function loadEvents() {
  try {
    const parsed = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    events = (parsed && parsed.events) || {};
  } catch (err) {
    events = {};
    if (err.code !== 'ENOENT') {
      console.error('Could not read events file, starting empty:', err.message);
      try { fs.renameSync(EVENTS_FILE, EVENTS_FILE + '.corrupt-' + Date.now()); } catch (e) { /* ignore */ }
    }
  }
  reindex();
}

function saveEvents() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = EVENTS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ events }, null, 2));
    fs.renameSync(tmp, EVENTS_FILE);
  } catch (err) {
    console.error('Could not save events (they will be lost on restart):', err.message);
  }
}

function randomWord() {
  return WORDS[crypto.randomInt(WORDS.length)].toUpperCase();
}

function newScorerCode() {
  for (;;) {
    const code = [randomWord(), randomWord(), randomWord()].join('-')
      + '-' + String(crypto.randomInt(100)).padStart(2, '0');
    if (!byCode.has(norm(code))) return code;
  }
}

function newViewKey() {
  return crypto.randomBytes(15).toString('base64url');
}

function eventStatus(ev) {
  if (ev.revoked) return 'revoked';
  if (ev.expiresAt && Date.now() > ev.expiresAt) return 'expired';
  return 'active';
}

function blankState(n) {
  const judges = {};
  for (let i = 1; i <= n; i++) judges[i] = { pos: 0, neg: 0 };
  return { v: 0, judges, label: '' };
}

function getRuntime(ev) {
  let rt = runtimes.get(ev.id);
  if (!rt) {
    rt = { state: blankState(ev.judges), scorers: new Set(), viewers: new Set(), claims: new Map() };
    runtimes.set(ev.id, rt);
  }
  return rt;
}

function adminView(ev) {
  const rt = runtimes.get(ev.id);
  return {
    id: ev.id,
    name: ev.name,
    judges: ev.judges,
    scorerCode: ev.scorerCode,
    viewKey: ev.viewKey,
    createdAt: ev.createdAt,
    expiresAt: ev.expiresAt,
    revoked: !!ev.revoked,
    status: eventStatus(ev),
    live: {
      scorers: rt ? rt.scorers.size : 0,
      viewers: rt ? rt.viewers.size : 0,
      claimed: rt ? [...rt.claims.keys()].sort((a, b) => a - b) : [],
      state: rt ? rt.state : blankState(ev.judges),
    },
  };
}

function clearClaims(rt) {
  for (const c of rt.claims.values()) clearTimeout(c.timer);
  rt.claims.clear();
}

function kickEvent(ev, message) {
  const rt = runtimes.get(ev.id);
  if (!rt) return;
  clearClaims(rt);
  for (const w of [...rt.scorers, ...rt.viewers]) {
    sendJson(w, { type: 'error', code: 'revoked', message, fatal: true });
    try { w.close(4003, 'event closed'); } catch (e) { /* ignore */ }
  }
}

// ---------------------------------------------------------- abuse limiting
// Admin-password failures and scoring-code failures are tracked separately,
// so a mistyped judge code can never lock you out of /admin (and vice versa).
const failures = new Map(); // 'kind:ip' -> { count, first, blockedUntil }

function ipOf(req) {
  const xf = req.headers['x-forwarded-for'];
  const ip = xf ? String(xf).split(',')[0].trim() : req.socket.remoteAddress;
  return ip || '?';
}

function isBlocked(ip, kind) {
  const f = failures.get(kind + ':' + ip);
  return !!(f && f.blockedUntil > Date.now());
}

function blockedMinutes(ip, kind) {
  const f = failures.get(kind + ':' + ip);
  return f ? Math.max(1, Math.ceil((f.blockedUntil - Date.now()) / 60000)) : 1;
}

function recordFailure(ip, kind) {
  const now = Date.now();
  const key = kind + ':' + ip;
  let f = failures.get(key);
  if (!f || now - f.first > FAIL_WINDOW_MS) {
    f = { count: 0, first: now, blockedUntil: 0 };
    failures.set(key, f);
  }
  f.count++;
  if (f.count >= MAX_FAILS[kind]) f.blockedUntil = now + BLOCK_MS;
}

function sha(s) {
  return crypto.createHash('sha256').update(String(s)).digest();
}

function safeEqual(a, b) {
  return crypto.timingSafeEqual(sha(a), sha(b));
}

// -------------------------------------------------------- scoring helpers
const ACTIONS = new Map([
  ['pos+', ['pos', 1]],
  ['pos-', ['pos', -1]],
  ['neg+', ['neg', 1]],
  ['neg-', ['neg', -1]],
  ['pos-reset', ['pos', 0]],
  ['neg-reset', ['neg', 0]],
]);

function clampScore(n) {
  return Math.max(-MAX_SCORE, Math.min(MAX_SCORE, n));
}

function cleanLabel(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
}

function applyAction(rt, judge, action) {
  const j = rt.state.judges[judge];
  const a = ACTIONS.get(action);
  if (!j || !a) return false;
  const key = a[0];
  j[key] = action.endsWith('-reset') ? 0 : clampScore(j[key] + a[1]);
  rt.state.v++;
  return true;
}

// ------------------------------------------------------------------ sending
function sendSafe(ws, str) {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > 1e6) { ws.terminate(); return; }
  ws.send(str);
}

function sendJson(ws, obj) {
  sendSafe(ws, JSON.stringify(obj));
}

function broadcastState(rt) {
  const s = JSON.stringify({ type: 'state', state: rt.state });
  rt.scorers.forEach((w) => sendSafe(w, s));
  rt.viewers.forEach((w) => sendSafe(w, s));
}

// Judge slots: "taken" = every claimed judge number, "mine" = the ones held by
// the recipient's device (matched by its clientId, so a reconnect keeps them).
function statusFor(rt, ws) {
  const taken = [...rt.claims.keys()].sort((a, b) => a - b);
  const cid = ws && ws.ctx ? ws.ctx.clientId : null;
  const mine = taken.filter((j) => rt.claims.get(j).clientId === cid);
  return { viewers: rt.viewers.size, scorers: rt.scorers.size, taken, mine };
}

function broadcastStatus(rt) {
  rt.scorers.forEach((w) => sendJson(w, Object.assign({ type: 'status' }, statusFor(rt, w))));
}

// ---------------------------------------------------------------- HTTP part
function text(res, status, body) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SEC_HEADERS));
  res.end(body);
}

function json(res, status, obj) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, SEC_HEADERS));
  res.end(JSON.stringify(obj));
}

function sendPage(res, file) {
  fs.readFile(path.join(__dirname, file), (err, buf) => {
    if (err) return text(res, 500, 'Page missing on server: ' + file);
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, SEC_HEADERS));
    res.end(buf);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 10240) { reject(new Error('Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function adminOk(req) {
  if (!ADMIN_PASSWORD) return false;
  const h = req.headers.authorization || '';
  const pw = h.startsWith('Bearer ') ? h.slice(7) : '';
  return safeEqual(pw, ADMIN_PASSWORD);
}

async function handleApi(req, res, url) {
  const ip = ipOf(req);
  if (!ADMIN_PASSWORD) {
    return json(res, 503, { error: 'Admin is disabled. Set the ADMIN_PASSWORD environment variable.' });
  }
  if (isBlocked(ip, 'admin')) {
    return json(res, 429, { error: 'Too many failed attempts. Try again in about ' + blockedMinutes(ip, 'admin') + ' minute(s).' });
  }
  if (!adminOk(req)) {
    recordFailure(ip, 'admin');
    return json(res, 401, { error: 'Wrong password.' });
  }
  failures.delete('admin:' + ip); // a correct password clears earlier mistakes

  const p = url.pathname.replace(/^\/api\/admin/, '');
  const method = req.method;

  if (p === '/events' && method === 'GET') {
    const list = Object.values(events).sort((a, b) => b.createdAt - a.createdAt).map(adminView);
    return json(res, 200, { events: list, maxJudges: MAX_JUDGES, now: Date.now() });
  }

  if (p === '/events' && method === 'POST') {
    const body = await readJson(req);
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const judges = parseInt(body.judges, 10);
    const hours = Number(body.hours);
    if (!name) return json(res, 400, { error: 'Event name is required.' });
    if (!(judges >= 1 && judges <= MAX_JUDGES)) {
      return json(res, 400, { error: 'Judges must be between 1 and ' + MAX_JUDGES + '.' });
    }
    if (!(hours >= 1 && hours <= 720)) return json(res, 400, { error: 'Hours must be between 1 and 720.' });
    const id = crypto.randomBytes(4).toString('hex');
    const ev = {
      id, name, judges,
      scorerCode: newScorerCode(),
      viewKey: newViewKey(),
      createdAt: Date.now(),
      expiresAt: Date.now() + hours * 3600000,
      revoked: false,
    };
    events[id] = ev;
    reindex();
    saveEvents();
    return json(res, 200, { event: adminView(ev) });
  }

  const m = p.match(/^\/events\/([a-f0-9]{8})(?:\/([a-z]+))?$/);
  if (!m) return json(res, 404, { error: 'Not found.' });
  const ev = events[m[1]];
  if (!ev) return json(res, 404, { error: 'Event not found.' });
  const action = m[2];

  if (method === 'DELETE' && !action) {
    kickEvent(ev, 'This event was deleted.');
    delete events[ev.id];
    runtimes.delete(ev.id);
    reindex();
    saveEvents();
    return json(res, 200, { ok: true });
  }

  if (method === 'POST' && action === 'extend') {
    const body = await readJson(req);
    const hours = Number(body.hours);
    if (!(hours >= 1 && hours <= 720)) return json(res, 400, { error: 'Hours must be between 1 and 720.' });
    ev.expiresAt = Math.max(Date.now(), ev.expiresAt || 0) + hours * 3600000;
    saveEvents();
    return json(res, 200, { event: adminView(ev) });
  }

  if (method === 'POST' && action === 'judges') {
    const body = await readJson(req);
    const judges = parseInt(body.judges, 10);
    if (!(judges >= 1 && judges <= MAX_JUDGES)) {
      return json(res, 400, { error: 'Judges must be between 1 and ' + MAX_JUDGES + '.' });
    }
    if (judges !== ev.judges) {
      ev.judges = judges;
      saveEvents();
      const rt = getRuntime(ev);
      const old = rt.state.judges;
      const next = {};
      for (let i = 1; i <= judges; i++) next[i] = old[i] || { pos: 0, neg: 0 };
      rt.state.judges = next;
      rt.state.v++;
      for (const [j, c] of [...rt.claims]) {
        if (j > judges) { clearTimeout(c.timer); rt.claims.delete(j); }
      }
      // Re-send "ready" so scoring pages rebuild their judge cards and overlays re-render.
      for (const w of [...rt.scorers, ...rt.viewers]) {
        sendJson(w, {
          type: 'ready',
          epoch: EPOCH,
          event: { id: ev.id, name: ev.name, judges: ev.judges, expiresAt: ev.expiresAt },
          status: statusFor(rt, w),
          state: rt.state,
        });
      }
    }
    return json(res, 200, { event: adminView(ev) });
  }

  if (method === 'POST' && action === 'revoke') {
    const body = await readJson(req);
    ev.revoked = body.revoked !== false;
    if (ev.revoked) kickEvent(ev, 'This event has been disabled.');
    saveEvents();
    return json(res, 200, { event: adminView(ev) });
  }

  if (method === 'POST' && action === 'regenerate') {
    kickEvent(ev, 'The codes for this event were regenerated.');
    ev.scorerCode = newScorerCode();
    ev.viewKey = newViewKey();
    reindex();
    saveEvents();
    return json(res, 200, { event: adminView(ev) });
  }

  if (method === 'POST' && action === 'release') {
    const rt = getRuntime(ev);
    clearClaims(rt);
    broadcastStatus(rt);
    return json(res, 200, { event: adminView(ev) });
  }

  if (method === 'POST' && action === 'reset') {
    const rt = getRuntime(ev);
    const v = rt.state.v + 1;
    rt.state = blankState(ev.judges);
    rt.state.v = v;
    broadcastState(rt);
    return json(res, 200, { event: adminView(ev) });
  }

  return json(res, 404, { error: 'Not found.' });
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return text(res, 400, 'Bad request'); }
  const p = url.pathname;

  if (p === '/health') return text(res, 200, 'ok');

  if (p.startsWith('/api/admin/')) {
    handleApi(req, res, url).catch((err) => {
      const status = /too large|Invalid JSON/.test(err.message) ? 400 : 500;
      if (status === 500) console.error('API error:', err);
      if (!res.headersSent) json(res, status, { error: status === 500 ? 'Server error.' : err.message });
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return text(res, 405, 'Method not allowed');

  if (p === '/') {
    res.writeHead(302, Object.assign({ Location: '/score' }, SEC_HEADERS));
    return res.end();
  }
  if (PAGES[p]) return sendPage(res, PAGES[p]);
  if (p === '/overlay' || p.startsWith('/overlay/')) return sendPage(res, 'overlay.html');
  return text(res, 404, 'Not found');
});

// ------------------------------------------------------------ WebSocket part
const wss = new WebSocket.Server({ server, perMessageDeflate: false, maxPayload: 64 * 1024 });
const rooms = new Map(); // legacy rooms: roomId -> { bridge, clients:Set }

function takeToken(ws) {
  const now = Date.now();
  ws.tokens = Math.min(60, ws.tokens + ((now - ws.tokenAt) / 1000) * 30);
  ws.tokenAt = now;
  if (ws.tokens < 1) return false;
  ws.tokens -= 1;
  return true;
}

function fail(ws, code, message, closeCode, fatal) {
  sendJson(ws, { type: 'error', code, message, fatal: !!fatal });
  try { ws.close(closeCode, code); } catch (e) { /* ignore */ }
}

function handleHello(ws, msg) {
  if (isBlocked(ws.ip, 'ws')) {
    return fail(ws, 'rate_limited', 'Too many failed attempts. Try again in a few minutes.', 4029, false);
  }
  let ev = null;
  if (msg.role === 'scorer') ev = byCode.get(norm(msg.code));
  else if (msg.role === 'viewer') ev = byKey.get(typeof msg.key === 'string' ? msg.key : '');
  else return fail(ws, 'bad_request', 'Unknown role.', 4000, true);

  if (!ev) {
    recordFailure(ws.ip, 'ws');
    return fail(ws, 'bad_code',
      msg.role === 'scorer' ? 'That code was not recognized.' : 'This overlay link is not valid.', 4003, true);
  }
  const status = eventStatus(ev);
  if (status === 'revoked') return fail(ws, 'revoked', 'This event has been disabled.', 4003, true);
  if (status === 'expired') return fail(ws, 'expired', 'This event has expired.', 4003, true);

  const rt = getRuntime(ev);
  const set = msg.role === 'scorer' ? rt.scorers : rt.viewers;
  const cap = msg.role === 'scorer' ? Math.max(MAX_SCORERS_PER_EVENT, ev.judges + 2) : MAX_VIEWERS_PER_EVENT;
  if (set.size >= cap) return fail(ws, 'full', 'Too many connections for this event. Retrying…', 4009, false);

  const clientId = (typeof msg.clientId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(msg.clientId))
    ? msg.clientId : crypto.randomBytes(8).toString('hex');
  ws.ctx = { ev, rt, role: msg.role, clientId };
  set.add(ws);
  if (msg.role === 'scorer') {
    // A returning device picks its judge slots back up.
    for (const c of rt.claims.values()) {
      if (c.clientId === clientId) { clearTimeout(c.timer); c.timer = null; c.ws = ws; }
    }
  }
  sendJson(ws, {
    type: 'ready',
    epoch: EPOCH,
    event: { id: ev.id, name: ev.name, judges: ev.judges, expiresAt: ev.expiresAt },
    status: statusFor(rt, ws),
    state: rt.state,
  });
  broadcastStatus(rt);
}

function handleMessage(ws, msg) {
  const { ev, rt, role } = ws.ctx;
  if (msg.type === 'ping') {
    return sendJson(ws, { type: 'pong', t: typeof msg.t === 'number' ? msg.t : 0 });
  }
  if (role !== 'scorer') return;

  switch (msg.type) {
    case 'claim': {
      const j = msg.judge;
      if (!Number.isInteger(j) || j < 1 || j > ev.judges) return;
      const c = rt.claims.get(j);
      if (c && c.clientId !== ws.ctx.clientId) { sendJson(ws, { type: 'claimFailed', judge: j }); return; }
      if (c) { clearTimeout(c.timer); c.timer = null; c.ws = ws; }
      else rt.claims.set(j, { clientId: ws.ctx.clientId, ws, timer: null });
      broadcastStatus(rt);
      break;
    }

    case 'release': {
      const c = rt.claims.get(msg.judge);
      if (c && c.clientId === ws.ctx.clientId) {
        clearTimeout(c.timer);
        rt.claims.delete(msg.judge);
        broadcastStatus(rt);
      }
      break;
    }

    case 'action': {
      if (!Number.isInteger(msg.judge) || typeof msg.action !== 'string') break;
      const c = rt.claims.get(msg.judge);
      if (!c || c.clientId !== ws.ctx.clientId) { sendJson(ws, { type: 'denied', judge: msg.judge }); break; }
      if (applyAction(rt, msg.judge, msg.action)) broadcastState(rt);
      break;
    }

    case 'label':
      rt.state.label = cleanLabel(msg.text);
      rt.state.v++;
      broadcastState(rt);
      break;

    case 'restore': {
      // After a server restart a scoring page re-seeds the scores of the judges
      // it holds. Only judges the sender holds, and only if still 000/000.
      if (!msg.state || typeof msg.state.judges !== 'object' || !msg.state.judges) return;
      let changed = false;
      for (const [i, c] of rt.claims) {
        if (c.clientId !== ws.ctx.clientId) continue;
        const cur = rt.state.judges[i];
        const j = msg.state.judges[i];
        if (!cur || !j || cur.pos !== 0 || cur.neg !== 0) continue;
        if (Number.isFinite(j.pos) && Number.isFinite(j.neg)) {
          cur.pos = clampScore(Math.round(j.pos));
          cur.neg = clampScore(Math.round(j.neg));
          changed = true;
        }
      }
      if (!rt.state.label && typeof msg.state.label === 'string' && msg.state.label) {
        rt.state.label = cleanLabel(msg.state.label);
        changed = true;
      }
      if (changed) { rt.state.v++; broadcastState(rt); }
      break;
    }
    default:
      break;
  }
}

// Legacy relay (old bridge.js / relay tester) -------------------------------
function handleLegacyIdentify(ws, msg) {
  if (isBlocked(ws.ip, 'ws')) { ws.close(4029, 'Too many attempts'); return; }
  if (!LEGACY_TOKEN || typeof msg.token !== 'string' || !safeEqual(msg.token, LEGACY_TOKEN)) {
    recordFailure(ws.ip, 'ws');
    ws.close(4001, 'Invalid token');
    return;
  }
  if (msg.role !== 'bridge' && msg.role !== 'client') { ws.close(4002, 'Invalid role'); return; }
  const roomId = String(msg.room || 'default').slice(0, 64);
  let room = rooms.get(roomId);
  if (!room) { room = { bridge: null, clients: new Set() }; rooms.set(roomId, room); }
  ws.legacy = { role: msg.role, roomId };
  if (msg.role === 'bridge') {
    if (room.bridge && room.bridge !== ws) room.bridge.close(4003, 'Replaced by new bridge connection');
    room.bridge = ws;
  } else {
    room.clients.add(ws);
  }
  sendJson(ws, { type: 'identified' });
}

function legacyForward(ws, str) {
  const room = rooms.get(ws.legacy.roomId);
  if (!room) return;
  if (ws.legacy.role === 'client') {
    if (room.bridge && room.bridge.readyState === WebSocket.OPEN) room.bridge.send(str);
  } else {
    room.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(str); });
  }
}

function detach(ws) {
  if (ws.ctx) {
    const { rt, role } = ws.ctx;
    (role === 'scorer' ? rt.scorers : rt.viewers).delete(ws);
    // Keep this device's judge slots for a short grace period so a quick
    // reconnect (wifi blip, page refresh) doesn't lose them.
    for (const [j, c] of rt.claims) {
      if (c.ws !== ws) continue;
      c.ws = null;
      clearTimeout(c.timer);
      c.timer = setTimeout(() => {
        if (rt.claims.get(j) === c) { rt.claims.delete(j); broadcastStatus(rt); }
      }, CLAIM_GRACE_MS);
      if (c.timer.unref) c.timer.unref();
    }
    broadcastStatus(rt);
  }
  if (ws.legacy) {
    const room = rooms.get(ws.legacy.roomId);
    if (room) {
      if (room.bridge === ws) room.bridge = null;
      room.clients.delete(ws);
    }
  }
}

wss.on('connection', (ws, req) => {
  if (ws._socket && ws._socket.setNoDelay) ws._socket.setNoDelay(true); // send small frames immediately
  ws.isAlive = true;
  ws.ip = ipOf(req);
  ws.ctx = null;
  ws.legacy = null;
  ws.tokens = 60;
  ws.tokenAt = Date.now();
  const helloTimer = setTimeout(() => {
    if (!ws.ctx && !ws.legacy) ws.close(4008, 'No hello');
  }, 10000);

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    ws.isAlive = true;
    const str = data.toString();
    if (ws.legacy) return legacyForward(ws, str);
    let msg;
    try { msg = JSON.parse(str); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (!ws.ctx) {
      if (msg.type === 'hello') return handleHello(ws, msg);
      if (msg.type === 'identify') return handleLegacyIdentify(ws, msg);
      return;
    }
    if (!takeToken(ws)) return;
    handleMessage(ws, msg);
  });

  ws.on('close', () => { clearTimeout(helloTimer); detach(ws); });
  ws.on('error', (err) => { console.error('ws error:', err.message); });
});

// App-level tick: lets browsers notice a silently dead connection quickly.
// (Only sent to new-protocol sockets; legacy bridges forward everything to OBS.)
setInterval(() => {
  const s = JSON.stringify({ type: 'tick' });
  wss.clients.forEach((ws) => { if (ws.ctx) sendSafe(ws, s); });
}, TICK_MS);

// Protocol-level ping: drop sockets that stopped answering.
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  });
}, PING_MS);

setInterval(() => {
  const now = Date.now();
  for (const [key, f] of failures) {
    if (now - f.first > FAIL_WINDOW_MS && f.blockedUntil < now) failures.delete(key);
  }
}, 10 * 60 * 1000);

// ------------------------------------------------------------------- start
loadEvents();
server.listen(PORT, () => {
  console.log('Yoyo scoring server listening on port ' + PORT);
  console.log('Events loaded: ' + Object.keys(events).length + ' (stored in ' + EVENTS_FILE + ')');
  if (!ADMIN_PASSWORD) console.log('WARNING: ADMIN_PASSWORD is not set, so /admin is disabled.');
  if (LEGACY_TOKEN) console.log('Legacy relay protocol is enabled.');
});

function shutdown() {
  console.log('Shutting down…');
  saveEvents();
  wss.clients.forEach((c) => { try { c.close(1001, 'Server restarting'); } catch (e) { /* ignore */ } });
  server.close();
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
