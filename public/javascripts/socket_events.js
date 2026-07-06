// サーバー (chaser/server.js) とクライアント (public/javascripts/game_server_client.js 等) で
// 共有する Socket.io イベント名の定数。
// ブラウザでは <script> タグ経由で window.SOCKET_EVENTS として、
// Node.js では require() で module.exports として、同じ内容を参照できる。
(function (root) {
    var SOCKET_EVENTS = {
        // client -> server
        CREATE_NEW_MAP: 'create_new_map',
        PLAYER_JOIN: 'player_join',
        MATCH_INIT: 'match_init',
        MATCH_START_CHECK: 'match_start_check',
        MATCH_START: 'match_start',
        PLAYER_JOIN_MATCH: 'player_join_match',
        RELEASE: 'release',
        MOVE_PLAYER: 'move_player',
        GET_READY: 'get_ready',
        LOOK: 'look',
        SEARCH: 'search',
        PUT_WALL: 'put_wall',
        LOOKER_JOIN: 'looker_join',
        DISCONNECT: 'disconnect',
        LEAVE_ROOM: 'leave_room',
        MATCH_END: 'match_end',

        // server -> client
        MAP_CREATED: 'map_created',
        JOINED_ROOM: 'joined_room',
        NEW_BOARD: 'new_board',
        UPDATE_BOARD: 'updata_board', // サーバー実装の綴り (updata) をそのまま踏襲。変更すると通信が壊れるため修正しない
        GET_READY_REC: 'get_ready_rec',
        MOVE_REC: 'move_rec',
        LOOK_REC: 'look_rec',
        SEARCH_REC: 'search_rec',
        PUT_REC: 'put_rec',
        MATCH_START_CHECK_REC: 'match_start_check_rec',
        MATCH_INIT_REC: 'match_init_rec',
        GAME_RESULT: 'game_result',
        ERROR: 'error'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SOCKET_EVENTS;
    }
    else {
        root.SOCKET_EVENTS = SOCKET_EVENTS;
    }
})(typeof window !== 'undefined' ? window : this);
