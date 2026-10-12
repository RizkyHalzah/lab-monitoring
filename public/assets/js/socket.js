// socket.js - wrapper for Socket.IO client
import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

let socket = null;

/**
 * Create or return existing socket connection.
 * Auto reconnect enabled by socket.io default.
 */
export function getSocket() {
  if (!socket) {
    socket = io();
  }
  return socket;
}

/**
 * Cleanly close the socket.
 */
export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
