'use strict';

/*
 * Yoyo Scoring Server
 * -------------------
 * One Node process that provides:
 *   /              entry page: enter the event code once, pick a page
 *   /score         scoring page (judges' laptop + controllers)
 *   /music         music page (queues competitors, plays their music, sets the overlay name)
 *   /overlay/KEY   stream overlay (OBS Browser Source)
 *   /timer/KEY     big performance timer for a screen judges or the audience can see
 *   /overlay/KEY?replay=1   replay overlay: plays back a recorded routine's clicks (for post)
 *   /broadcast     Broadcast page (producer: run of show, countdown, logos, which graphic is on air)
 *   /gfx/KEY       broadcast graphics (OBS Browser Source, transparent): the full Starting Soon scene,
 *                  or one piece with ?piece=logo|headline|countdown|runofshow|eventbar|sponsors
 *   /admin         event management page (password-protected API)
 *   /ws            WebSocket endpoint used by all the pages
 *   /health        plain "ok" for uptime monitors
 *
 * Live scores are held in memory by the server; each scoring laptop also keeps
 * its own judges' totals and sends them back if the server restarts. Event records (name, judge count, codes,
 * expiry, public judge numbers, overlay look) are saved to DATA_DIR/events.json, and
 * each routine's recorded clicks to DATA_DIR/recordings.json (both lost on a free-tier restart).
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
const RECORDINGS_FILE = path.join(DATA_DIR, 'recordings.json');
const MAX_RECORDINGS_PER_EVENT = 500;
const EPOCH = crypto.randomBytes(4).toString('hex'); // changes every process start

const MAX_SCORERS_PER_EVENT = 4; // minimum; the real cap is max(this, judges + 2)
const CLAIM_GRACE_MS = 20000;    // a dropped laptop keeps its judge slots this long
const MAX_VIEWERS_PER_EVENT = 10;
const MAX_MUSIC_PER_EVENT = 3;
const MAX_PRODUCERS_PER_EVENT = 3;
const MAX_LOGO_CHARS = 600 * 1024;    // client logo as a data URL, held in memory only
const MAX_SPONSOR_CHARS = 200 * 1024; // each sponsor logo
const MAX_ASSET_CHARS = 950 * 1024;   // all logos together (must fit one WebSocket message)
const MAX_SCORE = 999;
const TICK_MS = 3000;   // app-level heartbeat so browsers can detect dead connections
const PING_MS = 15000;  // protocol-level ping so the server can drop dead sockets
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = { admin: 10, ws: 30 }; // ws is higher: a whole venue shares one public IP
const BLOCK_MS = 10 * 60 * 1000;

const PAGES = { '/score': 'score.html', '/music': 'music.html', '/broadcast': 'broadcast.html', '/admin': 'admin.html' };
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
  // timer: set by the music page; at = server time of the reading, so every screen ticks in step.
  // performer: who is up, for the timer display.
  return { v: 0, judges, label: '', timer: null, performer: null };
}

function getRuntime(ev) {
  let rt = runtimes.get(ev.id);
  if (!rt) {
    // bcast / bcastAssets: what the Broadcast page last sent (memory only; the producer's laptop re-sends after a restart).
    rt = { state: blankState(ev.judges), scorers: new Set(), viewers: new Set(), music: new Set(), displays: new Set(), replays: new Set(),
      producers: new Set(), gfx: new Set(), claims: new Map(), recording: null, replay: null, bcast: null, bcastAssets: null };
    runtimes.set(ev.id, rt);
    syncEventState(rt, ev);
  }
  return rt;
}

// Public judge numbers: aliases[i] is what judge slot i+1 appears as on stream. Kept on the
// event (saved) so a restart can't reveal the real order.
function identity(n) { return Array.from({ length: n }, (_, i) => i + 1); }
function validAliases(a, n) {
  return Array.isArray(a) && a.length === n && identity(n).every((v) => a.indexOf(v) >= 0);
}
function syncEventState(rt, ev) {
  if (!validAliases(ev.aliases, ev.judges)) ev.aliases = identity(ev.judges);
  rt.state.aliases = ev.aliases.slice();
  rt.state.overlay = ev.overlay || null;
}
// Every judge gets a number other than their own seat (so no seat can be read off the
// stream), and a new press changes the mapping when more than one such mapping exists.
function shuffledAliases(n, current) {
  if (n < 2) return identity(n);
  let a;
  do {
    a = identity(n);
    for (let i = n - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  } while (a.some((v, i) => v === i + 1) || (n > 2 && current && a.every((v, i) => v === current[i])));
  return a;
}

// Overlay look, set live from the music page (wins over the overlay link's own options).
const OVERLAY_PARTS = ['label', 'judges', 'avg', 'timer'];
function cleanOverlay(o) {
  if (!o || typeof o !== 'object') return null;
  const order = Array.isArray(o.order) ? o.order.filter((k, i, a) => OVERLAY_PARTS.indexOf(k) >= 0 && a.indexOf(k) === i) : [];
  OVERLAY_PARTS.forEach((k) => { if (order.indexOf(k) < 0) order.push(k); });
  const show = {};
  OVERLAY_PARTS.forEach((k) => { show[k] = !(o.show && o.show[k] === false); });
  const size = Math.round(Number(o.size));
  return {
    font: typeof o.font === 'string' && /^[A-Za-z0-9 ]{1,40}$/.test(o.font.trim()) ? o.font.trim() : 'Share Tech Mono',
    size: size >= 50 && size <= 250 ? size : 100,
    pos: o.pos === 'top' ? 'top' : 'bottom',
    order, show,
  };
}

// Broadcast graphics, set from the Broadcast page. Countdown is stamped with server time like the timer.
const SCENES = ['off', 'starting'];
// Graphics pieces and how the producer laid them out (position on the 1920x1080 scene, size, font, colours).
const GFX_PIECES = ['logo', 'headline', 'countdown', 'runofshow', 'eventbar', 'sponsors'];
function cleanLayout(l) {
  if (!l || typeof l !== 'object') return null;
  const hex = (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : '');
  const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const out = {};
  GFX_PIECES.forEach((k) => {
    const p = l[k];
    if (!p || typeof p !== 'object') return;
    const c = p.colors && typeof p.colors === 'object' ? p.colors : {};
    out[k] = {
      x: Math.round(num(p.x, -1920, 3840, 0)),
      y: Math.round(num(p.y, -1080, 2160, 0)),
      scale: Math.round(num(p.scale, 0.2, 3, 1) * 100) / 100,
      show: p.show !== false,
      font: typeof p.font === 'string' && /^[A-Za-z0-9 ]{1,40}$/.test(p.font.trim()) ? p.font.trim() : '',
      colors: { panel: hex(c.panel), accent: hex(c.accent), text: hex(c.text) },
      z: Math.round(num(p.z, -20, 20, 0)),
      plate: p.plate !== false,
    };
  });
  return out;
}
function cleanBcast(b, from) {
  if (!b || typeof b !== 'object') return null;
  const run = (Array.isArray(b.run) ? b.run : []).slice(0, 40).map((r) => ({
    id: /^[A-Za-z0-9_-]{1,24}$/.test(r && r.id) ? r.id : crypto.randomBytes(4).toString('hex'),
    time: cleanText(r && r.time, 8),
    title: cleanText(r && r.title, 60),
  }));
  const nowIdx = Number.isInteger(b.nowIdx) && b.nowIdx >= 0 && b.nowIdx < run.length ? b.nowIdx : -1;
  let countdown = null;
  if (b.countdown && typeof b.countdown === 'object' && Number.isFinite(b.countdown.remainingMs)) {
    countdown = {
      running: !!b.countdown.running,
      remainingMs: Math.max(0, Math.min(Math.round(b.countdown.remainingMs), 24 * 3600000)),
      at: Date.now(),
    };
  }
  return {
    scene: SCENES.indexOf(b.scene) >= 0 ? b.scene : 'off',
    headline: cleanText(b.headline, 40),
    layout: cleanLayout(b.layout),
    title: cleanText(b.title, 80),
    place: cleanText(b.place, 80),
    date: cleanText(b.date, 40),
    label: cleanText(b.label, 40),
    run, nowIdx, countdown,
    from: from || '',
  };
}
const IMAGE_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
function cleanAssets(a) {
  if (!a || typeof a !== 'object') return null;
  const logo = typeof a.logo === 'string' && a.logo.length <= MAX_LOGO_CHARS && IMAGE_URL.test(a.logo) ? a.logo : null;
  const sponsors = (Array.isArray(a.sponsors) ? a.sponsors : []).slice(0, 12)
    .filter((s) => typeof s === 'string' && s.length <= MAX_SPONSOR_CHARS && IMAGE_URL.test(s));
  const total = (logo ? logo.length : 0) + sponsors.reduce((n, s) => n + s.length, 0);
  if (total > MAX_ASSET_CHARS) return null;
  return { logo, sponsors, sig: cleanText(a.sig, 64) };
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
      music: rt ? rt.music.size : 0,
      displays: rt ? rt.displays.size : 0,
      replays: rt ? rt.replays.size : 0,
      producers: rt ? rt.producers.size : 0,
      gfx: rt ? gfxOnAir(rt) : 0,
      recordings: (recordings[ev.id] || []).length,
      claimed: rt ? [...rt.claims.keys()].sort((a, b) => a - b) : [],
      state: rt ? rt.state : blankState(ev.judges),
    },
  };
}

function clearClaims(rt) {
  for (const c of rt.claims.values()) clearTimeout(c.timer);
  rt.claims.clear();
}

function allSockets(rt) {
  return [...rt.scorers, ...rt.viewers, ...rt.music, ...rt.displays, ...rt.replays, ...rt.producers, ...rt.gfx];
}

// Graphics sources in OBS (the Broadcast page's own preview doesn't count).
function gfxOnAir(rt) {
  let n = 0;
  rt.gfx.forEach((w) => { if (!w.ctx.preview) n++; });
  return n;
}

function kickEvent(ev, message) {
  const rt = runtimes.get(ev.id);
  if (!rt) return;
  clearClaims(rt);
  for (const w of allSockets(rt)) {
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

function cleanText(s, max) {
  return String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

// { running, elapsedMs, durationMs, direction } from the music page, stamped with server time.
function cleanTimer(t) {
  if (!t || typeof t !== 'object') return null;
  const ms = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(Math.round(v), 6 * 3600000)) : 0);
  return {
    running: !!t.running,
    elapsedMs: ms(t.elapsedMs),
    durationMs: ms(t.durationMs),
    direction: t.direction === 'up' ? 'up' : 'down',
    at: Date.now(),
  };
}

// -------------------------------------------------------- click recordings
// A routine is recorded while its track plays: the music page's timer marks the start
// and end, and each judge press carries the time it happened (server clock), so presses
// made during a connection drop still land at the right moment.
let recordings = {}; // eventId -> [recording]
function loadRecordings() {
  try { recordings = JSON.parse(fs.readFileSync(RECORDINGS_FILE, 'utf8')).recordings || {}; }
  catch (err) { recordings = {}; if (err.code !== 'ENOENT') console.error('Could not read recordings:', err.message); }
}
let recSaveTimer = null;
function saveRecordingsSoon() {
  clearTimeout(recSaveTimer);
  recSaveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(RECORDINGS_FILE + '.tmp', JSON.stringify({ recordings }));
      fs.renameSync(RECORDINGS_FILE + '.tmp', RECORDINGS_FILE);
    } catch (err) { console.error('Could not save recordings:', err.message); }
  }, 1500);
}
function publicRecording(r) {
  return { id: r.id, name: r.name, division: r.division, label: r.label, startAt: r.startAt, endAt: r.endAt,
    durationMs: r.durationMs, direction: r.direction, aliases: r.aliases, start: r.start, timeline: r.timeline, presses: r.presses };
}
function trackRecording(ev, rt, perf, t, ws) {
  if (typeof perf.id !== 'string' || !/^[A-Za-z0-9_-]{4,40}$/.test(perf.id)) return;
  const list = recordings[ev.id] || (recordings[ev.id] = []);
  let rec = list.find((r) => r.id === perf.id);
  if (!rec) {
    // Normally created when the track starts; a laptop that was offline for the whole
    // track creates it from its own start time when it reconnects.
    const late = perf.final && Number.isFinite(perf.startAt);
    if (!t.running && !late) return;
    const start = {};
    Object.keys(rt.state.judges).forEach((k) => { start[k] = { pos: rt.state.judges[k].pos, neg: rt.state.judges[k].neg }; });
    rec = { id: perf.id, name: cleanText(perf.name, 60), division: cleanText(perf.division, 40), label: rt.state.label,
      startAt: t.running ? t.at - t.elapsedMs : Math.round(perf.startAt), endAt: null, durationMs: t.durationMs, direction: t.direction,
      aliases: (rt.state.aliases || []).slice(), start, timeline: [], presses: [], ids: [] };
    list.push(rec);
    if (list.length > MAX_RECORDINGS_PER_EVENT) list.splice(0, list.length - MAX_RECORDINGS_PER_EVENT);
  }
  if (rec.endAt) return;
  rec.timeline.push({ at: t.at, running: t.running, elapsedMs: t.elapsedMs });
  if (perf.final) {
    // The music laptop says when the track really ended (it may be reporting late after an outage).
    rec.endAt = Number.isFinite(perf.endAt) && perf.endAt > rec.startAt && perf.endAt <= t.at ? perf.endAt : t.at;
    saveRecordingsSoon();
    sendRecording(rt, rec);
  }
}
function sendRecording(rt, rec) {
  const out = JSON.stringify({ type: 'recording', rec: publicRecording(rec) });
  rt.music.forEach((w) => sendSafe(w, out));
}
function recordPresses(ev, rt, ws, judge, presses) {
  const list = recordings[ev.id] || [];
  const ack = [];
  const touched = new Set();
  presses.slice(0, 500).forEach((p) => {
    if (!p || typeof p.id !== 'string' || p.id.length > 60 || !Number.isFinite(p.at)) return;
    ack.push(p.id);
    // Only presses while a track was playing (from its start to its end) are kept.
    for (let i = list.length - 1; i >= 0 && i >= list.length - 50; i--) {
      const r = list[i];
      if (p.at < r.startAt || (r.endAt && p.at > r.endAt)) continue;
      if (r.ids.indexOf(p.id) >= 0) break;
      r.ids.push(p.id);
      r.presses.push({ at: Math.round(p.at), judge, pos: clampScore(Math.round(Number(p.pos) || 0)), neg: clampScore(Math.round(Number(p.neg) || 0)) });
      touched.add(r);
      break;
    }
  });
  if (ack.length) sendJson(ws, { type: 'pressAck', judge, ids: ack });
  touched.forEach((r) => { if (r.endAt) { saveRecordingsSoon(); sendRecording(rt, r); } });
  if (touched.size) saveRecordingsSoon();
}
// What the replay overlay needs from a recording (sent by the music laptop).
function cleanReplay(r) {
  const num = (v) => (Number.isFinite(v) ? v : 0);
  return {
    id: String(r.id || '').slice(0, 40), label: cleanLabel(r.label), startAt: num(r.startAt), endAt: num(r.endAt),
    durationMs: num(r.durationMs), direction: r.direction === 'up' ? 'up' : 'down',
    aliases: Array.isArray(r.aliases) ? r.aliases.slice(0, 16).map((a) => Math.round(num(a))) : [],
    start: r.start && typeof r.start === 'object' ? r.start : {},
    timeline: Array.isArray(r.timeline) ? r.timeline.slice(0, 2000).map((x) => ({ at: num(x.at), running: !!x.running, elapsedMs: num(x.elapsedMs) })) : [],
    presses: Array.isArray(r.presses) ? r.presses.slice(0, 20000).map((p) => ({ at: num(p.at), judge: Math.round(num(p.judge)), pos: num(p.pos), neg: num(p.neg) })) : [],
  };
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
  const s = JSON.stringify({ type: 'state', state: rt.state, now: Date.now() });
  rt.scorers.forEach((w) => sendSafe(w, s));
  rt.viewers.forEach((w) => sendSafe(w, s));
  rt.music.forEach((w) => sendSafe(w, s));
  rt.displays.forEach((w) => sendSafe(w, s));
  rt.replays.forEach((w) => sendSafe(w, s));
}

// Judge slots: "taken" = every claimed judge number, "mine" = the ones held by
// the recipient's device (matched by its clientId, so a reconnect keeps them).
function statusFor(rt, ws) {
  const taken = [...rt.claims.keys()].sort((a, b) => a - b);
  const cid = ws && ws.ctx ? ws.ctx.clientId : null;
  const mine = taken.filter((j) => rt.claims.get(j).clientId === cid);
  return { viewers: rt.viewers.size, scorers: rt.scorers.size, taken, mine };
}

function readyFor(ev, rt, ws) {
  const role = ws.ctx ? ws.ctx.role : '';
  const event = { id: ev.id, name: ev.name, judges: ev.judges, expiresAt: ev.expiresAt };
  // Code holders (judges, music) get the view key so they can open the timer display.
  if (role === 'scorer' || role === 'music' || role === 'producer') event.viewKey = ev.viewKey;
  const msg = { type: 'ready', epoch: EPOCH, event, status: statusFor(rt, ws), state: rt.state, now: Date.now() };
  if (role === 'replay' && rt.replay) msg.replay = rt.replay;
  if (role === 'music') { msg.status.replays = rt.replays.size; msg.recordings = (recordings[ev.id] || []).map(publicRecording); }
  if (role === 'producer' || role === 'gfx') { msg.bcast = rt.bcast; msg.assets = rt.bcastAssets; }
  if (role === 'producer') msg.status.gfx = gfxOnAir(rt);
  return msg;
}

function broadcastStatus(rt) {
  rt.scorers.forEach((w) => sendJson(w, Object.assign({ type: 'status' }, statusFor(rt, w))));
  rt.music.forEach((w) => sendJson(w, { type: 'status', viewers: rt.viewers.size, replays: rt.replays.size }));
  const g = gfxOnAir(rt);
  rt.producers.forEach((w) => sendJson(w, { type: 'status', gfx: g }));
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

function sendPage(res, file, extra) {
  fs.readFile(path.join(__dirname, file), (err, buf) => {
    if (err) return text(res, 500, 'Page missing on server: ' + file);
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, SEC_HEADERS, extra || {}));
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
    delete recordings[ev.id];
    saveRecordingsSoon();
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
      syncEventState(rt, ev);
      saveEvents();
      rt.state.v++;
      for (const [j, c] of [...rt.claims]) {
        if (j > judges) { clearTimeout(c.timer); rt.claims.delete(j); }
      }
      // Re-send "ready" so scoring pages rebuild their judge cards and overlays re-render.
      for (const w of allSockets(rt)) {
        sendJson(w, readyFor(ev, rt, w));
      }
    }
    return json(res, 200, { event: adminView(ev) });
  }

  if (method === 'GET' && action === 'recordings') {
    const rows = [['performance', 'division', 'competitor', 'track_started_at', 'judge_slot', 'appeared_as', 'ms_from_track_start', 'pos', 'neg']];
    (recordings[ev.id] || []).forEach((r, i) => {
      r.presses.slice().sort((a, b) => a.at - b.at).forEach((p) => {
        rows.push([i + 1, r.division, r.name, new Date(r.startAt).toISOString(), p.judge, r.aliases[p.judge - 1] || p.judge, Math.max(0, p.at - r.startAt), p.pos, p.neg]);
      });
    });
    const csv = rows.map((row) => row.map((v) => {
      const t = String(v == null ? '' : v);
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }).join(',')).join('\n') + '\n';
    res.writeHead(200, Object.assign({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clicks-' + ev.id + '.csv"',
    }, SEC_HEADERS));
    return res.end(csv);
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
    syncEventState(rt, ev);
    rt.state.v = v;
    broadcastState(rt);
    return json(res, 200, { event: adminView(ev) });
  }

  return json(res, 404, { error: 'Not found.' });
}

// Entry page: is this event code valid? Failures count toward the same block as bad codes on /ws.
function checkCode(req, res, url) {
  const ip = ipOf(req);
  if (isBlocked(ip, 'ws')) {
    return json(res, 429, { error: 'Too many wrong codes. Try again in about ' + blockedMinutes(ip, 'ws') + ' minute(s).' });
  }
  const ev = byCode.get(norm(url.searchParams.get('code')));
  if (!ev) { recordFailure(ip, 'ws'); return json(res, 404, { error: 'That code was not recognized.' }); }
  const status = eventStatus(ev);
  if (status === 'revoked') return json(res, 403, { error: 'This event has been disabled.' });
  if (status === 'expired') return json(res, 403, { error: 'This event has expired.' });
  return json(res, 200, { event: { name: ev.name, judges: ev.judges, viewKey: ev.viewKey } });
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

  if (p === '/') return sendPage(res, 'index.html');
  if (p === '/timer' || p.startsWith('/timer/')) return sendPage(res, 'timer.html');
  if (p === '/api/event') return checkCode(req, res, url);
  if (PAGES[p]) return sendPage(res, PAGES[p]);
  if (p === '/cues/startnoise.mp3' || p === '/cues/endnoise.mp3') {
    // Default start/end cues for the music page (it keeps its own copy once loaded).
    return fs.readFile(path.join(__dirname, p), (err, buf) => {
      if (err) return text(res, 404, 'Not found');
      res.writeHead(200, Object.assign({ 'Content-Type': 'audio/mpeg' }, SEC_HEADERS));
      res.end(buf);
    });
  }
  if (p === '/fonts/saira-latin.woff2') {
    // Broadcast graphics typeface (Saira, SIL Open Font License), served here so OBS never waits on a font CDN.
    return fs.readFile(path.join(__dirname, p), (err, buf) => {
      if (err) return text(res, 404, 'Not found');
      res.writeHead(200, Object.assign({}, SEC_HEADERS, { 'Content-Type': 'font/woff2', 'Cache-Control': 'public, max-age=604800' }));
      res.end(buf);
    });
  }
  if (p === '/score-sw.js') {
    // Lets the scoring and music pages reload while this server is down (see score-sw.js).
    return fs.readFile(path.join(__dirname, 'score-sw.js'), (err, buf) => {
      if (err) return text(res, 404, 'Not found');
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/javascript; charset=utf-8' }, SEC_HEADERS));
      res.end(buf);
    });
  }
  if (p === '/overlay' || p.startsWith('/overlay/')) return sendPage(res, 'overlay.html');
  // The Broadcast page shows the graphics in a preview frame, so allow framing by this site only.
  if (p === '/gfx' || p.startsWith('/gfx/')) return sendPage(res, 'gfx.html', { 'X-Frame-Options': 'SAMEORIGIN' });
  return text(res, 404, 'Not found');
});

// ------------------------------------------------------------ WebSocket part
// Replays carry a whole routine's clicks, so allow larger messages than scoring needs.
const wss = new WebSocket.Server({ server, perMessageDeflate: false, maxPayload: 1024 * 1024 });
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

function setFor(rt, role) {
  return role === 'scorer' ? rt.scorers : role === 'music' ? rt.music : role === 'display' ? rt.displays
    : role === 'replay' ? rt.replays : role === 'producer' ? rt.producers : role === 'gfx' ? rt.gfx : rt.viewers;
}

function handleHello(ws, msg) {
  if (isBlocked(ws.ip, 'ws')) {
    return fail(ws, 'rate_limited', 'Too many failed attempts. Try again in a few minutes.', 4029, false);
  }
  let ev = null;
  // The music and Broadcast pages use the event's scoring code but can't score.
  const byCodeRole = msg.role === 'scorer' || msg.role === 'music' || msg.role === 'producer';
  if (byCodeRole) ev = byCode.get(norm(msg.code));
  else if (msg.role === 'viewer' || msg.role === 'display' || msg.role === 'replay' || msg.role === 'gfx') ev = byKey.get(typeof msg.key === 'string' ? msg.key : '');
  else return fail(ws, 'bad_request', 'Unknown role.', 4000, true);

  if (!ev) {
    recordFailure(ws.ip, 'ws');
    return fail(ws, 'bad_code',
      byCodeRole ? 'That code was not recognized.'
        : msg.role === 'display' ? 'This timer display link is not valid.'
          : msg.role === 'gfx' ? 'This graphics link is not valid.' : 'This overlay link is not valid.', 4003, true);
  }
  const status = eventStatus(ev);
  if (status === 'revoked') return fail(ws, 'revoked', 'This event has been disabled.', 4003, true);
  if (status === 'expired') return fail(ws, 'expired', 'This event has expired.', 4003, true);

  const rt = getRuntime(ev);
  const set = setFor(rt, msg.role);
  const cap = msg.role === 'scorer' ? Math.max(MAX_SCORERS_PER_EVENT, ev.judges + 2)
    : msg.role === 'music' ? MAX_MUSIC_PER_EVENT : msg.role === 'producer' ? MAX_PRODUCERS_PER_EVENT : MAX_VIEWERS_PER_EVENT;
  if (set.size >= cap) return fail(ws, 'full', 'Too many connections for this event. Retrying…', 4009, false);

  const clientId = (typeof msg.clientId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(msg.clientId))
    ? msg.clientId : crypto.randomBytes(8).toString('hex');
  ws.ctx = { ev, rt, role: msg.role, clientId, preview: msg.role === 'gfx' && msg.preview === true };
  set.add(ws);
  if (msg.role === 'scorer') {
    // A returning device picks its judge slots back up.
    for (const c of rt.claims.values()) {
      if (c.clientId === clientId) { clearTimeout(c.timer); c.timer = null; c.ws = ws; }
    }
  }
  sendJson(ws, readyFor(ev, rt, ws));
  broadcastStatus(rt);
}

function handleMessage(ws, msg) {
  const { ev, rt, role } = ws.ctx;
  if (msg.type === 'ping') {
    return sendJson(ws, { type: 'pong', t: typeof msg.t === 'number' ? msg.t : 0 });
  }
  if (role === 'music') {
    if (msg.type === 'label') {
      rt.state.label = cleanLabel(msg.text);
      rt.state.performer = msg.name || msg.division
        ? { name: cleanText(msg.name, 60), division: cleanText(msg.division, 40) } : null;
      rt.state.v++;
      broadcastState(rt);
    } else if (msg.type === 'timer') {
      rt.state.timer = cleanTimer(msg.timer);
      rt.state.v++;
      broadcastState(rt);
      if (msg.perf && rt.state.timer) trackRecording(ev, rt, msg.perf, rt.state.timer, ws);
    } else if (msg.type === 'overlay') {
      ev.overlay = cleanOverlay(msg.overlay);
      saveEvents();
      syncEventState(rt, ev);
      rt.state.v++;
      broadcastState(rt);
    } else if (msg.type === 'replay') {
      // The music laptop sends the whole recording, so replays work even if the server lost it.
      rt.replay = msg.action === 'play' && msg.rec ? { rec: cleanReplay(msg.rec), startAt: Date.now() + 1500 } : null;
      const out = JSON.stringify({ type: 'replay', replay: rt.replay, now: Date.now() });
      rt.replays.forEach((w) => sendSafe(w, out));
      rt.music.forEach((w) => sendSafe(w, out));
    }
    return;
  }
  if (role === 'producer') {
    if (msg.type === 'bcast') {
      const b = cleanBcast(msg.b, ws.ctx.clientId);
      if (!b) return;
      rt.bcast = b;
      const out = JSON.stringify({ type: 'bcast', bcast: b, now: Date.now() });
      rt.gfx.forEach((w) => sendSafe(w, out));
      rt.producers.forEach((w) => sendSafe(w, out));
    } else if (msg.type === 'assets') {
      const a = cleanAssets(msg.assets);
      if (!a) { sendJson(ws, { type: 'error', code: 'too_large', message: 'Those logos are too large to send. Remove a sponsor logo or use a smaller file.', fatal: false }); return; }
      rt.bcastAssets = a;
      const out = JSON.stringify({ type: 'assets', assets: a, now: Date.now() });
      rt.gfx.forEach((w) => sendSafe(w, out));
      rt.producers.forEach((w) => sendSafe(w, out));
    }
    return;
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

    case 'set': {
      // The device holding a judge counts presses locally (so scoring survives
      // outages) and sends its totals. Idempotent: a repeat or late copy is harmless.
      const j = msg.judge;
      if (!Number.isInteger(j) || !Number.isFinite(msg.pos) || !Number.isFinite(msg.neg)) break;
      const c = rt.claims.get(j);
      if (!c || c.clientId !== ws.ctx.clientId) { sendJson(ws, { type: 'denied', judge: j }); break; }
      if (Array.isArray(msg.presses) && msg.presses.length) recordPresses(ev, rt, ws, j, msg.presses);
      const cur = rt.state.judges[j];
      if (!cur) break;
      const pos = clampScore(Math.round(msg.pos));
      const neg = clampScore(Math.round(msg.neg));
      if (cur.pos === pos && cur.neg === neg) { sendJson(ws, { type: 'state', state: rt.state }); break; }
      cur.pos = pos;
      cur.neg = neg;
      rt.state.v++;
      broadcastState(rt);
      break;
    }

    case 'shuffle': {
      // Spectators see shuffled judge numbers; the real slot stays on every score.
      ev.aliases = shuffledAliases(ev.judges, ev.aliases);
      saveEvents();
      syncEventState(rt, ev);
      rt.state.v++;
      broadcastState(rt);
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
    setFor(rt, role).delete(ws);
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
  const s = JSON.stringify({ type: 'tick', now: Date.now() });
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
loadRecordings();
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
