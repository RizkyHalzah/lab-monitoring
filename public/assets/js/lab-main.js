import { getSocket } from './socket.js';
import { startCamera, stopStream } from './camera.js';
import { createLabPC } from './webrtc.js';
import { formatTime, formatDate, showToast } from './utils.js';
import { createAudioAnalyzer, startLevelMonitor } from './audio-visualizer.js';

// Grab UI
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remoteAudioIndicator = document.getElementById('remoteAudioIndicator');
const remoteAudioLevel = document.getElementById('remoteAudioLevel');
const labNameEl = document.getElementById('lab-name');
const labInfoEl = document.getElementById('lab-info');
const connStatusEl = document.getElementById('conn-status');
const camStatusEl = document.getElementById('cam-status');
const micStatusEl = document.getElementById('mic-status');
const loadingEl = document.getElementById('loading');
const infoName = document.getElementById('info-name');
const infoId = document.getElementById('info-id');
const infoIp = document.getElementById('info-ip');
const infoConn = document.getElementById('info-conn');
const deviceInfo = document.getElementById('device-info');

let localStream = null;
let pcMap = new Map(); // viewerSocketId -> RTCPeerConnection
let remoteAudioAnalyzer = null;
let levelMonitorStop = null;
const socket = getSocket();

// diagnostic socket events
socket.on('connect', ()=>{ console.log('lab socket connected', socket.id); });
socket.on('connect_error', (err)=>{ console.error('lab socket connect_error', err); });
socket.on('reconnect_attempt', ()=>{ console.log('lab socket reconnect_attempt'); });

// notify when a viewer attempts to connect
socket.on('viewer-connected', ({ viewerId } = {}) => {
  console.log('Viewer attempting to connect:', viewerId);
  showToast('Viewer connecting: ' + (viewerId||''), 'info');
});

// Clock
function tick() {
  const now = new Date();
  document.getElementById('clock').textContent = formatTime(now);
  document.getElementById('date').textContent = formatDate(now);
}
setInterval(tick, 1000);
tick();

/**
 * Read labId from querystring ?id=LAB-B10
 */
function getLabId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || 'LAB-B10';
}

async function init() {
  const labId = getLabId();

  // fetch lab info
  try {
    const res = await fetch('/api/labs');
    const labs = await res.json();
    const lab = labs.find(l => l.id === labId) || labs[0] || { id: labId, name: labId };
    labNameEl.textContent = lab.name || labId;
    labInfoEl.textContent = `${lab.location || ''}`;
    infoName.textContent = lab.name || labId;
    infoId.textContent = lab.id || labId;
    infoIp.textContent = lab.ip || '--';
  } catch (err) {
    console.warn('Failed to load labs', err);
  }

  // start camera automatically
  try {
    const { stream, info } = await startCamera();
    localStream = stream;
    localVideo.srcObject = stream;
    localVideo.muted = true; // local preview muted
    loadingEl.style.display = 'none';
    camStatusEl.textContent = 'Camera: ON';
    micStatusEl.textContent = 'Mic: ON';
    deviceInfo.textContent = `Camera: ${info.videoDevice || 'unknown'} | Mic: ${info.audioDevice || 'unknown'}`;

    // announce to server
    socket.emit('lab:init', { labId, meta: { userAgent: navigator.userAgent } });

  } catch (err) {
    loadingEl.textContent = 'Camera permission denied or not available';
    camStatusEl.textContent = 'Camera: OFF';
    micStatusEl.textContent = 'Mic: OFF';
    showToast('Gagal mengakses kamera / mikrofon. Periksa izin browser.', 'danger');
  }

  // socket events
  socket.on('connect', () => {
    connStatusEl.textContent = 'Connected';
    connStatusEl.className = 'ms-2 badge bg-success';
  });
  socket.on('disconnect', () => {
    connStatusEl.textContent = 'Disconnected';
    connStatusEl.className = 'ms-2 badge bg-danger';
  });

  // Viewer -> lab offer handler
  socket.on('offer', async ({ from, sdp }) => {
    try {
      const pc = createLabPC(localStream, (stream) => {
        // remote video from control panel
        remoteVideo.srcObject = stream;
        console.log('Remote stream from control received');
        
        // setup audio analyzer untuk remote stream
        if (stream) {
          remoteAudioAnalyzer = createAudioAnalyzer(stream);
          if (levelMonitorStop) levelMonitorStop();
          levelMonitorStop = startLevelMonitor(remoteAudioLevel, () => {
            const level = remoteAudioAnalyzer.getLevel();
            // show audio indicator jika ada suara
            if (level > 5) {
              remoteAudioIndicator.classList.remove('d-none');
            } else {
              remoteAudioIndicator.classList.add('d-none');
            }
            return level;
          }, 100, {
            highThreshold: 60,
            lowColor: '#e9ecef',      // Rendah: Abu
            mediumColor: '#ffc107',   // Sedang: Kuning
            highColor: '#28a745'      // Keras: Hijau
          });
        }
      }, (candidate) => {
        socket.emit('ice-candidate', { to: from, candidate });
      });
      pcMap.set(from, pc);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { to: from, sdp: pc.localDescription });
      console.log('Answer sent to control');
    } catch (err) {
      console.error('Failed to handle offer', err);
    }
  });

  // ICE candidates from viewer
  socket.on('ice-candidate', ({ from, candidate }) => {
    const pc = pcMap.get(from);
    if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(()=>{});
  });

  // status updates
  socket.on('lab-status', ({ labId: id, online }) => {
    infoConn.textContent = online ? 'Online' : 'Offline';
  });

}

init();
