initEncodeRuntime({
  outputArea: null,
  runButton: null,
  joinEvent: SOCKET_EVENTS.PLAYER_JOIN_MATCH,
  buildUser: function (id, name) {
    return {
      room_id: (query_list.room_id && query_list.room_token)
        ? query_list.room_id + '?' + query_list.room_token
        : id,
      name: name,
      chara: query_list.chara,
      key: query_list.key,
    };
  },
  getReadyPollMs: 200,
  enableHighlightPrefix: false,
  logGeneratedCode: false,
  removeReadyPlayerOnStop: false,
  enableFileIO: false,
  enableDataLoad: false,
  enableDebugTabToggle: false,
  onError: function (e) {
    if (typeof setStatus === 'function') {
      setStatus('エラー: ' + (e && e.message ? e.message : String(e)));
    }
  },
});
