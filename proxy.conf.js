const PROXY_CONFIG = {
  "/api": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
    logLevel: "debug"
  }
  // Note: Socket.IO connects directly to backend via environment.socketUrl
  // This avoids Vite proxy WebSocket errors during development
};

module.exports = PROXY_CONFIG;
