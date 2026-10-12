// webrtc.js - helpers for creating PeerConnections and handling SDP/ICE

/**
 * Create a bidirectional PeerConnection (sendrecv)
 * Used for Control panel to communicate with Lab
 * @param {MediaStream} localStream - local camera/mic stream from control
 * @param {function} onTrack callback when remote track arrives
 * @param {function} sendIce function to send ICE candidates (candidate)=>{}
 */
export function createControlPC(localStream, onTrack, sendIce) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // add local tracks from control
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  // receive remote tracks from lab
  pc.ontrack = (evt) => {
    if (onTrack) onTrack(evt.streams[0]);
  };

  pc.onicecandidate = (evt) => {
    if (evt.candidate && sendIce) sendIce(evt.candidate);
  };

  return pc;
}

/**
 * Create a bidirectional PeerConnection for lab (sendrecv)
 * @param {MediaStream} localStream - local camera/mic from lab
 * @param {function} onTrack callback when remote track arrives
 * @param {function} sendIce (candidate)=>{}
 */
export function createLabPC(localStream, onTrack, sendIce) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // add all local tracks from lab
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  // receive remote tracks from control
  pc.ontrack = (evt) => {
    if (onTrack) onTrack(evt.streams[0]);
  };

  pc.onicecandidate = (evt) => {
    if (evt.candidate && sendIce) sendIce(evt.candidate);
  };

  return pc;
}
