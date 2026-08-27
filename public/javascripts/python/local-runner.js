// モード③（オフライン練習）専用のPyodideブートストラップ+実行ループ。
// Python-CHaser-Webのローカルシミュレーション方式(yield from変換なし、
// プレイヤー・対戦AI双方を同一Pyodide内で動かす)をそのまま踏襲する。
// lib/pyCHaser.py には public/javascripts/python/lib/pyCHaser.local.py の内容を書き込む。
(function (root) {

    var DEFAULT_PLAYER_CODE = RUNNER_SHARED.DEFAULT_PLAYER_CODE;

    // Python-CHaser-Web本家のデフォルト対戦AI(index.html内のopponentEditor初期値)をそのまま移植。
    // 発見したものを記憶しながらアイテムを回収しつつ、隣接した相手にはputで応戦する。
    var DEFAULT_OPPONENT_CODE = `# opponent（デフォルトの対戦AI）
import argparse
from lib.pyCHaser import * # lib/pyCHaser.py

"""
デフォルトの対戦AI
発見したものを記憶しながら．アイテムを回収しつつ隣接した相手にはputで応戦する．
プレイヤー側と同じ形式のプログラムなので，このエディタの内容を書き換えたり，
ファイルをアップロードして別の対戦AIに差し替えたりできる．

get_ready() → 行動関数 → get_ready() → ... の順で必ず処理を行う．

マスの情報は
「Floor」:なにもない
「Enemy」:相手
「Block」:ブロック
「Item」 :アイテム（ハート）
"""

player = None
map_info = []  # 周辺情報を保存するリスト

# 自己位置（デッドレコニング。原点は任意で構わない）
my_x, my_y = 0, 0
current_dir = Left  # 直前の移動方向
memory = {}  # (x, y) -> Floor/Block/Item の実測記憶（Enemyは書かない）
last_visit_turn = {}  # (x, y) -> 最後に訪れたターン
turn_counter = 0

# 記憶を頼りに追いかけるアイテムの探索距離の上限（遠すぎる記憶は無視して探索を優先）
MEMORY_PURSUIT_RANGE = 8

opposite = {Up: Down, Down: Up, Left: Right, Right: Left}
orth_delta = {Up: (0, -1), Down: (0, 1), Left: (-1, 0), Right: (1, 0)}
# 斜め方向に敵がいる場合の回避先候補（敵と反対側の直交方向を優先順に）
diagonal_escapes = {
    UpLeft: (Down, Right),
    UpRight: (Down, Left),
    DownLeft: (Up, Right),
    DownRight: (Up, Left),
}
# 斜め方向にアイテムがある場合の接近先候補（アイテム側の直交方向を優先順に）
diagonal_approaches = {
    UpLeft: (Up, Left),
    UpRight: (Up, Right),
    DownLeft: (Down, Left),
    DownRight: (Down, Right),
}
# 周囲9マス配列のインデックス（UpLeft〜DownRight）から座標オフセットへの対応表
neighbor_offset = {i: (i % 3 - 1, i // 3 - 1) for i in range(9) if i != Center}


def main(port, name, host):
    global player, map_info

    # サーバーと接続
    player = Client(port=port, name=name, host=host)

    while True:
        """
        ここから下に戦略プログラムを書く
        """
        global my_x, my_y, current_dir, memory, last_visit_turn, turn_counter

        # 準備完了 & 周辺探査
        map_info = player.get_ready()
        turn_counter += 1

        def move(direction):
            global my_x, my_y, current_dir
            player.walk(direction)
            dx, dy = orth_delta[direction]
            last_visit_turn[(my_x + dx, my_y + dy)] = turn_counter
            my_x += dx
            my_y += dy
            current_dir = direction

        def remember(x, y, value):
            # Enemyは一時的な情報なので記憶に残さない（実際の床情報を失ってしまうため）
            if value != Enemy:
                memory[(x, y)] = value

        def step_toward(target):
            # targetへ向けて1歩進められればTrueを返す。
            # 安全性は必ず「このターンの実測値map_info」で判定し、記憶（古い情報）は使わない。
            tx, ty = target
            dx, dy = tx - my_x, ty - my_y
            if abs(dx) > abs(dy):
                primary, secondary = "h", "v"
            elif abs(dy) > abs(dx):
                primary, secondary = "v", "h"
            else:
                primary, secondary = ("h", "v") if current_dir in (Left, Right) else ("v", "h")

            def axis_dir(axis):
                if axis == "h":
                    return Right if dx > 0 else Left if dx < 0 else None
                return Down if dy > 0 else Up if dy < 0 else None

            for direction in (axis_dir(primary), axis_dir(secondary)):
                if direction is not None and map_info[direction] in (Floor, Item):
                    move(direction)
                    return True
            return False

        def attack_adjacent_enemy():
            for direction in (Up, Down, Right, Left):
                if map_info[direction] == Enemy:
                    player.put(direction)
                    return True
            return False

        def evade_diagonal_enemy():
            for diagonal, escapes in diagonal_escapes.items():
                if map_info[diagonal] == Enemy:
                    for escape_dir in escapes:
                        if map_info[escape_dir] != Block:
                            move(escape_dir)
                            return True
            return False

        def grab_visible_item():
            for direction in (Up, Down, Right, Left):
                if map_info[direction] == Item:
                    move(direction)
                    return True
            for diagonal, approaches in diagonal_approaches.items():
                if map_info[diagonal] == Item:
                    for approach_dir in approaches:
                        if map_info[approach_dir] != Block:
                            move(approach_dir)
                            return True
            return False

        def wander():
            # アイテムが無い場合はブロックがない方向に進む（直前の後退方向は避ける）
            legal_moves = [
                direction
                for direction in (Up, Down, Left, Right)
                if map_info[direction] != Block and current_dir != opposite[direction]
            ]
            if legal_moves:
                def visit_rank(direction):
                    dx, dy = orth_delta[direction]
                    return last_visit_turn.get((my_x + dx, my_y + dy), -1)

                best = min(visit_rank(direction) for direction in legal_moves)
                best_moves = [direction for direction in legal_moves if visit_rank(direction) == best]
                move(random.choice(best_moves))
            else:
                # 進めない場合は後退
                move(opposite[current_dir])

        # --- 記憶を更新（無料の観測データのみ使用） ---
        for index, (dx, dy) in neighbor_offset.items():
            remember(my_x + dx, my_y + dy, map_info[index])

        # プレイヤーが隣接している場合はput（最優先）
        if attack_adjacent_enemy():
            continue

        # 斜めに相手がいる場合は回避
        if evade_diagonal_enemy():
            continue

        # アイテム優先（直接見えているもの、直交・斜め）
        if grab_visible_item():
            continue

        # 既知のアイテムが無ければ探索
        wander()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('-p', '--port', default=2010)
    parser.add_argument('-n', '--name', default='opponent')
    parser.add_argument('-i', '--host', default='localhost')

    args = parser.parse_args()

    main(port=args.port, name=args.name, host=args.host)
`;

    function createLocalRunner(editorCore, mapEditorAdapter) {
        var pyodideReadyPromise = loadPyodide({ indexURL: '/javascripts/vendor/pyodide/' });
        var chaserCodePromise = RUNNER_SHARED.fetchText('/javascripts/python/lib/pyCHaser.local.py');
        var transformerCodePromise = RUNNER_SHARED.fetchText('/javascripts/python/transformer.py');

        var pyodide = null;
        var chaserCode = null;
        var transformerCode = null;
        var turnTimeout = null;
        var gameRunning = false;

        function updateGameDisplay(gameState, turn, scores) {
            if (scores.toJs) scores = scores.toJs();
            var built = GAME_DISPLAY.renderBoard('game_board', gameState, {});
            GAME_DISPLAY.renderInfoPanel('game_info', {
                turn: turn,
                coolName: 'プレイヤー',
                coolScore: scores[0],
                hotName: '対戦AI',
                hotScore: scores[1],
                itemCount: built.itemCount
            });
        }

        async function ready() {
            pyodide = await pyodideReadyPromise;
            chaserCode = await chaserCodePromise;
            transformerCode = await transformerCodePromise;

            editorCore.writeToConsole('読み込みが完了しました');

            root.writeToConsole = editorCore.writeToConsole;
            root.updateGameDisplay = updateGameDisplay;
            RUNNER_SHARED.installConsoleBridge(pyodide);
        }
        var readyPromise = ready();

        function stop() {
            if (turnTimeout) { clearTimeout(turnTimeout); turnTimeout = null; }
            gameRunning = false;
        }

        async function run() {
            await readyPromise;
            editorCore.clearConsole();
            stop();

            pyodide.globals.clear();

            var playerCode = editorCore.playerEditor.getValue();
            var opponentCode = editorCore.opponentEditor.getValue();
            var mapData = '';
            if (mapEditorAdapter.isCustomMapEnabled()) {
                mapData = mapEditorAdapter.getValue();
            }

            try {
                await pyodide.runPythonAsync(transformerCode);

                if (!pyodide.FS.analyzePath('lib').exists) pyodide.FS.mkdir('lib');
                pyodide.FS.writeFile('lib/pyCHaser.py', chaserCode);

                await pyodide.runPythonAsync(
                    "import sys\n" +
                    "sys.modules.pop('lib.pyCHaser', None)\n" +
                    "sys.modules.pop('lib', None)\n"
                );

                pyodide.globals.set('player_code', playerCode);
                pyodide.globals.set('opponent_code', opponentCode);
                await pyodide.runPythonAsync(
                    "player_transformed = transform_code_local(player_code, player_id=0, client_name='player')\n" +
                    "opponent_transformed = transform_code_local(opponent_code, player_id=1, client_name='opponent')\n"
                );

                pyodide.globals.set('map_data', mapData || null);
                await pyodide.runPythonAsync(
                    "player_ns = {'__name__': '__chaser_player__'}\n" +
                    "opponent_ns = {'__name__': '__chaser_opponent__'}\n" +
                    'exec(player_transformed, player_ns)\n' +
                    'exec(opponent_transformed, opponent_ns)\n\n' +
                    'import lib.pyCHaser as _chaser_mod\n' +
                    '_chaser_mod.set_custom_map(map_data)\n\n' +
                    "do_turn_player = player_ns['main']()\n" +
                    "do_turn_opponent = opponent_ns['main']()\n"
                );

                gameRunning = true;
                runTurn();
            } catch (err) {
                editorCore.writeToConsole(err.message || String(err));
            }
        }

        function runTurn() {
            if (!gameRunning) return;
            var doTurnOpponent = pyodide.globals.get('do_turn_opponent');
            var doTurnPlayer = pyodide.globals.get('do_turn_player');
            try {
                var continueOpponent = doTurnOpponent();
                var continuePlayer = doTurnPlayer();
                var isOver = pyodide.runPython('_chaser_mod.get_shared_game().is_game_over()');

                if (continueOpponent && continuePlayer && !isOver) {
                    turnTimeout = setTimeout(runTurn, 500);
                } else {
                    gameRunning = false;
                }
            } catch (err) {
                editorCore.writeToConsole(err.message || String(err));
                gameRunning = false;
            }
        }

        return {
            run: run,
            stop: stop,
            isRunning: function () { return gameRunning; }
        };
    }

    var LOCAL_RUNNER = {
        createLocalRunner: createLocalRunner,
        DEFAULT_PLAYER_CODE: DEFAULT_PLAYER_CODE,
        DEFAULT_OPPONENT_CODE: DEFAULT_OPPONENT_CODE
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LOCAL_RUNNER;
    } else {
        root.LOCAL_RUNNER = LOCAL_RUNNER;
    }
})(typeof window !== 'undefined' ? window : this);
