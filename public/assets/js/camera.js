// camera.js - handles getUserMedia for lab panel

/**
 * Start camera + microphone automatically.
 * Returns MediaStream and device info.
 */
export async function startCamera(constraints = { video: { width: 1280, height: 720 }, audio: true }) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevice = devices.find(d => d.kind === 'videoinput');
    const audioDevice = devices.find(d => d.kind === 'audioinput');
    const info = {
      videoDevice: videoDevice ? videoDevice.label || videoDevice.deviceId : null,
      audioDevice: audioDevice ? audioDevice.label || audioDevice.deviceId : null,
      devices
    };
    return { stream, info };
  } catch (err) {
    throw err;
  }
}

/**
 * Stop all tracks of a MediaStream
 */
export function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach(t => t.stop());
}
