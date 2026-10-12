import { getSocket } from './socket.js';
import { createControlPC } from './webrtc.js';
import { login } from './auth.js';
import { startCamera, stopStream } from './camera.js';
import { showToast } from './utils.js';
import { createAudioAnalyzer, startLevelMonitor } from './audio-visualizer.js';

const socket = getSocket();

// diagnostic socket events
socket.on('connect', ()=>{ console.log('control socket connected', socket.id); });
socket.on('connect_error', (err)=>{ console.error('control socket connect_error', err); });
socket.on('reconnect_attempt', ()=>{ console.log('control socket reconnect_attempt'); });

// UI refs
const loginBox = document.getElementById('loginBox');
const loginForm = document.getElementById('loginForm');
const dashboard = document.getElementById('dashboard');
const labsList = document.getElementById('labsList');
const countOnline = document.getElementById('count-online');
const countOffline = document.getElementById('count-offline');
const countDevice = document.getElementById('count-device');
const activityLog = document.getElementById('activityLog');
const monitoringView = document.getElementById('monitoringView');
const remoteVideo = document.getElementById('remoteVideo');
const mvLabName = document.getElementById('mv-labname');
const mvInfo = document.getElementById('mv-info');
const mvStatus = document.getElementById('mv-status');
const micLevelBar = document.getElementById('micLevelBar');
const btnMicToggle = document.getElementById('btn-mic-toggle');
const micIcon = document.getElementById('mic-icon');

let currentPC = null;
let currentLabSocketId = null;
let currentLab = null;
let mediaRecorder = null;
let recordedChunks = [];
let controlLocalStream = null;
let microphoneEnabled = true;
let audioAnalyzer = null;
let levelMonitorStop = null;

// login flow
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    await login(username, password);
    loginBox.classList.add('d-none');
    dashboard.classList.remove('d-none');
    showToast('Login berhasil', 'success');
    loadDashboard();
  } catch (err) {
    const msg = err && err.message ? err.message : 'Login gagal';
    showToast(msg, 'danger');
    console.error('Login error:', err);
  }
});

async function loadDashboard() {
  const res = await fetch('/api/labs');
  const labs = await res.json();
  renderLabs(labs);
  updateCounts(labs);
  const act = await fetch('/api/activity');
  const acts = await act.json();
  renderActivity(acts);
  
  // Initialize control camera/mic if not already initialized
  if (!controlLocalStream) {
    try {
      const { stream, info } = await startCamera();
      controlLocalStream = stream;
      const localVideoEl = document.getElementById('localControlVideo');
      if (localVideoEl) {
        localVideoEl.srcObject = stream;
        localVideoEl.muted = true;
      }
      // setup audio analyzer untuk monitoring level suara
      audioAnalyzer = createAudioAnalyzer(stream);
      if (levelMonitorStop) levelMonitorStop();
      levelMonitorStop = startLevelMonitor(micLevelBar, () => audioAnalyzer.getLevel(), 100, {
        highThreshold: 60,
        lowColor: '#e9ecef',      // Rendah: Abu
        mediumColor: '#ffc107',   // Sedang: Kuning
        highColor: '#28a745'      // Keras: Hijau
      });
    } catch (err) {
      console.warn('Failed to start control camera', err);
      showToast('Gagal mengakses kamera di control panel', 'warning');
    }
  }
}

function updateCounts(labs){
  const online = labs.filter(l=>l.online).length;
  const offline = labs.length - online;
  countOnline.textContent = online;
  countOffline.textContent = offline;
  countDevice.textContent = labs.length;
}

function renderActivity(list){
  activityLog.innerHTML = list.map(a=>`<div><strong>[${new Date(a.ts).toLocaleTimeString()}]</strong> ${a.type} ${a.labId||''} ${a.msg||''}</div>`).join('');
}

function renderLabs(labs){
  labsList.innerHTML = labs.map(l=>{
    const status = l.online ? '<span class="badge bg-success">Online</span>' : '<span class="badge bg-secondary">Offline</span>';
    return `<div class="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <div class="fw-bold">${l.name}</div>
        <div class="small text-muted">${l.id} • ${l.ip||''}</div>
      </div>
      <div>
        ${status}
        <button class="btn btn-sm btn-primary ms-2" data-lab='${l.id}'>View</button>
      </div>
    </div>`
  }).join('');

  // attach handlers
  labsList.querySelectorAll('button[data-lab]').forEach(btn=>{
    btn.addEventListener('click', () => startViewing(btn.getAttribute('data-lab')));
  });
}

async function startViewing(labId){
  mvStatus.textContent = 'Connecting...';
  // ask server for lab socket id
  socket.emit('viewer:join', { labId }, async (resp) => {
    if (!resp || !resp.success) {
      showToast('Lab offline atau tidak ditemukan', 'danger');
      mvStatus.textContent = 'Lab offline';
      return;
    }
    const labSocketId = resp.labSocketId;
    currentLabSocketId = labSocketId;
    currentLab = labId;
    mvLabName.textContent = labId;
    mvInfo.textContent = `Menghubungkan ke ${labId}`;

    // create bidirectional peer connection
    const pc = createControlPC(controlLocalStream, (stream)=>{
      remoteVideo.srcObject = stream;
      mvStatus.textContent = 'Streaming';
      // show monitoring view when stream arrives
      if (monitoringView.classList.contains('d-none')) monitoringView.classList.remove('d-none');
    }, (candidate)=>{
      socket.emit('ice-candidate', { to: labSocketId, candidate });
    });
    currentPC = pc;

    // create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { to: labSocketId, sdp: pc.localDescription });

    // wait answer
    socket.on('answer', async ({ from, sdp }) => {
      console.log('Received answer from', from);
      if (from !== labSocketId) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) { console.error('setRemoteDescription error', err); }
    });

    // ICE candidates from lab
    socket.on('ice-candidate', ({ from, candidate }) => {
      if (from !== labSocketId) return;
      if (candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e)=>{console.error('addIceCandidate',e)});
    });

    console.log('Offer sent to lab socket:', labSocketId);

  });
}

// controls: snapshot, record, fullscreen, mute, refresh
document.getElementById('btn-snapshot').addEventListener('click', ()=>{
  if (!remoteVideo.srcObject) return showToast('No stream', 'warning');
  const canvas = document.createElement('canvas');
  canvas.width = remoteVideo.videoWidth || 1280;
  canvas.height = remoteVideo.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(remoteVideo,0,0,canvas.width,canvas.height);
  const url = canvas.toDataURL('image/jpeg',0.9);
  const a = document.createElement('a'); a.href = url; a.download = `${currentLab||'snapshot'}.jpg`; a.click();
});

document.getElementById('btn-fullscreen').addEventListener('click', ()=>{
  const el = document.getElementById('videoWrap');
  if (el.requestFullscreen) el.requestFullscreen();
});

document.getElementById('btn-record').addEventListener('click', ()=>{
  if (!remoteVideo.srcObject) return showToast('No stream', 'warning');
  if (!mediaRecorder || mediaRecorder.state === 'inactive'){
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(remoteVideo.srcObject);
    mediaRecorder.ondataavailable = (e)=>{ if (e.data.size) recordedChunks.push(e.data); };
    mediaRecorder.onstop = ()=>{
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${currentLab||'record'}.webm`; a.click();
    };
    mediaRecorder.start();
    showToast('Recording started', 'success');
  } else {
    mediaRecorder.stop();
    showToast('Recording stopped', 'info');
  }
});

document.getElementById('btn-mute').addEventListener('click', ()=>{
  if (!remoteVideo.srcObject) return;
  remoteVideo.muted = !remoteVideo.muted;
  showToast(remoteVideo.muted ? 'Muted' : 'Unmuted', 'info');
});

document.getElementById('btn-refresh').addEventListener('click', ()=>{
  if (currentPC && currentLabSocketId){
    // tear down and reconnect
    currentPC.close();
    currentPC = null;
    startViewing(currentLab);
  }
});

// microphone toggle
btnMicToggle.addEventListener('click', ()=>{
  if (!controlLocalStream) return showToast('Microphone not available', 'warning');
  
  microphoneEnabled = !microphoneEnabled;
  const audioTracks = controlLocalStream.getAudioTracks();
  audioTracks.forEach(track => {
    track.enabled = microphoneEnabled;
  });
  
  btnMicToggle.classList.toggle('btn-outline-warning');
  btnMicToggle.classList.toggle('btn-warning');
  micIcon.textContent = microphoneEnabled ? '🎤' : '🔇';
  showToast(microphoneEnabled ? 'Microphone ON' : 'Microphone OFF', 'success');
});

// global refresh button
document.getElementById('refreshBtn').addEventListener('click', ()=>loadDashboard());

// logout
document.getElementById('logoutBtn').addEventListener('click', ()=>{
  location.reload();
});
