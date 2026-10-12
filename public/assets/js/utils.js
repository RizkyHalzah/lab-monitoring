// utils.js - small UI helpers

/**
 * Format time HH:MM:SS
 */
export function formatTime(d = new Date()) {
  return d.toLocaleTimeString();
}

/**
 * Format date
 */
export function formatDate(d = new Date()) {
  return d.toLocaleDateString();
}

/**
 * Simple toast using Bootstrap classes
 */
export function showToast(message, type = 'info') {
  const containerId = 'toastWrap';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'toast-wrap';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${type} border-0 mb-2`;
  el.setAttribute('role','alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(el);
  setTimeout(()=>{el.classList.add('show')},10);
  setTimeout(()=>{el.remove()},5000);
}
