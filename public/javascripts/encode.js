initEncodeRuntime({
  outputArea: document.getElementById('output'),
  runButton: document.getElementById('runButton'),
  joinEvent: SOCKET_EVENTS.PLAYER_JOIN,
  buildUser: function (id, name) {
    return { room_id: id, name: name };
  },
  getReadyPollMs: 100,
  enableHighlightPrefix: true,
  logGeneratedCode: true,
  removeReadyPlayerOnStop: true,
  enableFileIO: true,
  enableDataLoad: true,
  enableDebugTabToggle: true,
});
