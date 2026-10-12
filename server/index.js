import express from 'express';
import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Try to setup HTTPS, fallback to HTTP
let server;
const certPath = path.join(__dirname, '..', 'certs', 'server.crt');
const keyPath = path.join(__dirname, '..', 'certs', 'server.key');
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

if (useHttps) {
  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  server = https.createServer({ cert, key }, app);
  console.log('HTTPS mode enabled');
} else {
  server = http.createServer(app);
  console.log('HTTP mode (no HTTPS certificate found)');
  console.log('For network access, run: npm run generate-cert');
}

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory maps and logs
const labsMap = new Map(); // labId -> socketId
const socketToLab = new Map(); // socketId -> labId
const activityLog = [];

// Utility: push activity
function pushActivity(entry) {
  const item = { ts: new Date().toISOString(), ...entry };
  activityLog.unshift(item);
  if (activityLog.length > 200) activityLog.pop();
}

// Static files
app.use(express.json());
// Silence Chrome DevTools automatic probe (prevents CSP 404 console noise)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});
// Root -> control panel (prevents 404 + CSP 'blocked' confusion on /)
app.get('/', (req, res) => {
  res.redirect('/control.html');
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// Config endpoints
app.get('/api/labs', (req, res) => {
  const cfgPath = path.join(__dirname, '..', 'config', 'labs.json');
  try {
    const data = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    // annotate online status
    const annotated = data.map(l => ({
      ...l,
      online: labsMap.has(l.id)
    }));
    res.json(annotated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read labs config' });
  }
});

app.post('/api/auth', (req, res) => {
  const { username, password } = req.body || {};
  const cfgPath = path.join(__dirname, '..', 'config', 'admin.json');
  try {
    const admin = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    console.log('Auth attempt for user:', username);
    if (username === admin.username && password === admin.password) {
      pushActivity({ type: 'auth', msg: `Admin ${username} logged in` });
      res.json({ ok: true, user: { username } });
    } else {
      pushActivity({ type: 'auth-failed', msg: `Failed login for ${username}` });
      res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Auth error', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/activity', (req, res) => {
  res.json(activityLog.slice(0, 200));
});

// Socket.IO signaling
io.on('connection', socket => {
  // Lab registers itself
  socket.on('lab:init', ({ labId, meta } = {}) => {
    if (!labId) return;
    labsMap.set(labId, socket.id);
    socketToLab.set(socket.id, labId);
    socket.join(`lab:${labId}`);
    pushActivity({ type: 'lab-connect', labId, socketId: socket.id, meta });
    io.emit('lab-status', { labId, online: true });
    socket.emit('connection-status', { status: 'connected' });
  });

  // Viewer asks to join a lab - callback returns lab socket id or failure
  socket.on('viewer:join', async ({ labId } = {}, cb) => {
    const labSocketId = labsMap.get(labId);
    if (!labSocketId) {
      if (cb) cb({ success: false, reason: 'lab-offline' });
      return;
    }
    // notify lab that a viewer is attempting to connect
    io.to(labSocketId).emit('viewer-connected', { viewerId: socket.id });
    pushActivity({ type: 'viewer-join', labId, viewerId: socket.id });
    if (cb) cb({ success: true, labSocketId });
  });

  // Offer from viewer -> lab
  socket.on('offer', ({ to, sdp } = {}) => {
    if (!to || !sdp) return;
    io.to(to).emit('offer', { from: socket.id, sdp });
    pushActivity({ type: 'offer', from: socket.id, to });
  });

  // Answer from lab -> viewer
  socket.on('answer', ({ to, sdp } = {}) => {
    if (!to || !sdp) return;
    io.to(to).emit('answer', { from: socket.id, sdp });
    pushActivity({ type: 'answer', from: socket.id, to });
  });

  // ICE candidate relay
  socket.on('ice-candidate', ({ to, candidate } = {}) => {
    if (!to || !candidate) return;
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // Disconnect handling
  socket.on('disconnect', reason => {
    const labId = socketToLab.get(socket.id);
    if (labId) {
      labsMap.delete(labId);
      socketToLab.delete(socket.id);
      pushActivity({ type: 'lab-disconnect', labId, socketId: socket.id, reason });
      io.emit('lab-status', { labId, online: false });
    } else {
      pushActivity({ type: 'socket-disconnect', socketId: socket.id, reason });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const protocol = useHttps ? 'https' : 'http';
  console.log(`\n${useHttps ? '🔐 SECURE' : '🔓 INSECURE'} Server running on ${protocol}://0.0.0.0:${PORT}`);
  console.log(`Local access: ${protocol}://localhost:${PORT}`);
  
  try {
    const interfaces = os.networkInterfaces();
    const addrs = Object.values(interfaces).flat().filter(a => a.family === 'IPv4' && !a.internal).map(a => a.address);
    if (addrs.length > 0) {
      console.log(`Network access: ${protocol}://${addrs[0]}:${PORT}`);
    }
  } catch(e) {}
  
  if (!useHttps) {
    console.log('\n⚠️  WARNING: Running on HTTP without HTTPS certificate');
    console.log('For secure network access, run: npm run generate-cert\n');
  }
});
