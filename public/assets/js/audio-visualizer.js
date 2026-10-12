// audio-visualizer.js - audio level detection dan visualization

/**
 * Create audio analyzer untuk detect level suara real-time
 * @param {MediaStream} stream
 * @returns {object} { analyzer, getLevel() }
 */
export function createAudioAnalyzer(stream) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  /**
   * Get current volume level (0-100)
   */
  function getLevel() {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    return Math.min(100, Math.round((avg / 255) * 100));
  }

  return { analyser, getLevel };
}

/**
 * Update visual indicator dengan level suara dan color coding
 * @param {element} element - elemen untuk display level
 * @param {function} getLevel - function yang return level 0-100
 * @param {object} options - { highThreshold, lowColor, mediumColor, highColor, interval }
 */
export function startLevelMonitor(element, getLevel, interval = 100, options = {}) {
  if (!element) return () => {};

  const opts = {
    highThreshold: 60,  // level > 60 = tinggi (hijau)
    lowColor: '#e9ecef',      // rendah: abu terang
    mediumColor: '#ffc107',   // sedang: kuning
    highColor: '#28a745',     // tinggi: hijau
    ...options
  };

  const updateInterval = setInterval(() => {
    const level = getLevel();
    element.style.width = level + '%';
    element.setAttribute('aria-valuenow', level);
    
    // Color coding based on level
    let color = opts.lowColor;
    if (level > opts.highThreshold) {
      color = opts.highColor; // Hijau - KERAS
    } else if (level > 20) {
      color = opts.mediumColor; // Kuning - Sedang
    }
    element.style.backgroundColor = color;
  }, interval);

  return () => clearInterval(updateInterval);
}
