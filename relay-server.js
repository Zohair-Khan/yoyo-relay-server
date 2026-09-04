// relay-server.js
// Minimal low-latency WebSocket relay for Yoyo Judge Scoring
// Pipes raw messages between the Android app (judge side) and the PC Bridge (OBS side)
// Deploy this on Fly.io, Railway, Render, etc.

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// Simple shared-secret auth so random people can't connect to your event channel.
// Set this via environment variable on your host (e.g. Fly.io secrets).
// Both the PC Bridge and the Android app must send this token on connect.
const AUTH_TOKEN = process.env.RELAY_AUTH_TOKEN || 'change-me-before-deploying';

// Basic HTTP server (needed for the WS upgrade + a health check endpoint)
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

// WebSocket server with compression disabled (perMessageDeflate: false)
// Compression adds CPU + latency overhead that isn't worth it for small messages.
const wss = new WebSocket.Server({
  server,
  perMessageDeflate: false,
});

// Rooms: one PC Bridge + one or more Android apps per "room" (keyed by room ID)
// This lets you reuse the same relay for multiple events/venues without collisions.
const rooms = new Map(); // roomId -> { bridge: ws|null, clients: Set<ws> }

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { bridge: null, clients: new Set() });
  }
  return rooms.get(roomId);
}

wss.on('connection', (ws, req) => {
  // Disable Nagle's algorithm on the underlying TCP socket.
  // This forces small packets (like our score updates) to be sent immediately
  // instead of being buffered/coalesced, which is the single biggest
  // real-world latency win for this kind of low-volume, latency-sensitive traffic.
  if (ws._socket && ws._socket.setNoDelay) {
    ws._socket.setNoDelay(true);
  }

  let identified = false;
  let role = null; // 'bridge' or 'client'
  let roomId = null;
  let isAlive = true;

  // Heartbeat: detect dead connections fast instead of waiting on TCP timeout.
  ws.on('pong', () => { isAlive = true; });

  ws.on('message', (data) => {
    // First message from any connection must be an identification frame:
    // { "type": "identify", "role": "bridge"|"client", "room": "yoyo-comp-2026", "token": "..." }
    if (!identified) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type !== 'identify') {
          ws.close(4000, 'First message must be identify');
          return;
        }
        if (msg.token !== AUTH_TOKEN) {
          ws.close(4001, 'Invalid token');
          return;
        }
        if (msg.role !== 'bridge' && msg.role !== 'client') {
          ws.close(4002, 'Invalid role');
          return;
        }

        role = msg.role;
        roomId = msg.room || 'default';
        identified = true;

        const room = getRoom(roomId);

        if (role === 'bridge') {
          // Only one bridge (PC) per room — replace if a new one connects
          if (room.bridge) {
            room.bridge.close(4003, 'Replaced by new bridge connection');
          }
          room.bridge = ws;
          console.log(`[room ${roomId}] Bridge connected`);
        } else {
          room.clients.add(ws);
          console.log(`[room ${roomId}] Client connected (${room.clients.size} total)`);
        }

        ws.send(JSON.stringify({ type: 'identified' }));
      } catch (e) {
        ws.close(4004, 'Malformed identify message');
      }
      return;
    }

    // After identification: pure pass-through, no parsing/re-serializing.
    // Client (Android app) -> Bridge (PC), or Bridge -> all Clients.
    //
    // Force forwarding as text (not binary). Our whole protocol is JSON text,
    // but Node's ws library can deliver "data" as a raw Buffer, and re-sending
    // a Buffer directly makes the outgoing frame binary. Binary frames show up
    // as an opaque Blob on browser WebSocket clients instead of readable text,
    // so we explicitly convert to a string before forwarding.
    const text = data.toString();

    const room = rooms.get(roomId);
    if (!room) return;

    if (role === 'client') {
      if (room.bridge && room.bridge.readyState === WebSocket.OPEN) {
        room.bridge.send(text);
      }
    } else if (role === 'bridge') {
      for (const client of room.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(text);
        }
      }
    }
  });

  ws.on('close', () => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (role === 'bridge' && room.bridge === ws) {
      room.bridge = null;
      console.log(`[room ${roomId}] Bridge disconnected`);
    } else if (role === 'client') {
      room.clients.delete(ws);
      console.log(`[room ${roomId}] Client disconnected (${room.clients.size} remaining)`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  // Track liveness for the heartbeat interval below
  ws._isAliveGetter = () => isAlive;
  ws._isAliveSetter = (v) => { isAlive = v; };
});

// Heartbeat interval: ping every 15s, terminate dead connections.
// This catches silently-dropped connections (e.g. phone loses signal)
// far faster than relying on TCP's own timeout, so reconnect logic
// on the client kicks in quickly instead of leaving a "zombie" connection.
const HEARTBEAT_INTERVAL_MS = 15000;
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._isAliveGetter && ws._isAliveGetter() === false) {
      return ws.terminate();
    }
    if (ws._isAliveSetter) ws._isAliveSetter(false);
    ws.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`Relay server listening on port ${PORT}`);
});
