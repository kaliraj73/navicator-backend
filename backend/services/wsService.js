module.exports = function attachWs(wss) {
  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected', message: 'Navicator WS ready' }));

    socket.on('message', (raw) => {
      socket.send(JSON.stringify({ type: 'echo', payload: raw.toString() }));
    });
  });
};
