# -*- coding: utf-8 -*-
#
# このコードは、CHaser Server on Ruby (unofficial)のコードおよびアルゴリズムを参考にしています。
#
# オリジナルの著作権表示：
# Copyright (c) 2018 Tadakatsu Akisato
#
# オリジナルのライセンス：
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php
#
# public/javascripts/python/local-runner.js から Pyodide の仮想ファイルシステムに
# lib/pyCHaser.py として書き込まれ、モード③（オフライン練習）専用に使われる。
# サーバーには一切接続しない: プレイヤー・対戦AI双方のコードが同一Pyodide内で
# この Client を介して単一の共有 Game インスタンスを動かす。
import re
import sys
import time
import json

import random

from js import updateGameDisplay  # JavaScriptの関数をインポート

# マップ用の定数を定義
M_FLOOR = 0  # 床
M_CHARA = 1  # キャラクター
M_BLOCK = 2  # ブロック
M_ITEM = 3   # アイテム（ハート）

# アップロードされたカスタムマップデータ。Noneならランダムマップを生成する。
_custom_map_data = None


def set_custom_map(map_data_str):
    """アップロードされたマップデータを設定する。Noneまたは空文字ならランダム生成に戻す。"""
    global _custom_map_data
    _custom_map_data = map_data_str if map_data_str else None


def generate_random_map_data(size_x=15, size_y=17, block_num=20, item_num=35, turn=150, mirror=True):
    """ランダムなマップデータ（N:/T:/S:/D:/H: 形式の文字列）を生成する。"""
    # 一様ノルム
    def uniform_norm(pos, center):
        return max(abs(pos[0] - center[0]), abs(pos[1] - center[1]))

    def mirror_point(pos, size_x, size_y):
        return (size_x - 1 - pos[0], size_y - 1 - pos[1])

    # プレイヤー初期位置決定
    center = (size_x // 2, size_y // 2)
    while True:
        pos0 = (random.randrange(size_x), random.randrange(size_y))
        if uniform_norm(pos0, center) <= 1:
            continue
        if pos0[0] < size_x // 2 or (pos0[0] == size_x // 2 and pos0[1] < size_y // 2):
            break
    if mirror:
        pos1 = mirror_point(pos0, size_x, size_y)
    else:
        while True:
            pos1 = (random.randrange(size_x), random.randrange(size_y))
            if uniform_norm(pos1, center) <= 1:
                continue
            if pos1[0] > size_x // 2 or (pos1[0] == size_x // 2 and pos1[1] > size_y // 2):
                break

    # フィールド初期化
    field = [[0 for _ in range(size_x)] for _ in range(size_y)]

    # プレイヤー初期位置をフィールドに明示的に記録（値は0のまま、他と区別しない）
    # ただし、他の配置と重複しないようにするため、以降の配置でチェックする

    # ブロック配置
    i = 0
    while i < block_num:
        pos = (random.randrange(size_x), random.randrange(size_y))
        mirrorPos = mirror_point(pos, size_x, size_y)
        # ブロック配置条件
        if (pos != pos0 and pos != pos1 and field[pos[1]][pos[0]] != 2 and pos != center):
            field[pos[1]][pos[0]] = 2
            if mirror:
                if mirrorPos != pos0 and mirrorPos != pos1 and field[mirrorPos[1]][mirrorPos[0]] != 2 and mirrorPos != center:
                    field[mirrorPos[1]][mirrorPos[0]] = 2
                    i += 1
        else:
            i -= 1 if i > 0 else 0
        i += 1

    # アイテム配置
    i = 0
    while i < item_num:
        pos = (random.randrange(size_x), random.randrange(size_y))
        mirrorPos = mirror_point(pos, size_x, size_y)
        around_item_flag = True
        if uniform_norm(pos0, pos) <= 1 or uniform_norm(pos1, pos) <= 1:
            around_item_flag = False
        if (around_item_flag and
            pos != pos0 and pos != pos1 and
            field[pos[1]][pos[0]] != 3 and field[pos[1]][pos[0]] != 2 and pos != center):
            field[pos[1]][pos[0]] = 3
            if mirror:
                if (mirrorPos != pos0 and mirrorPos != pos1 and
                    field[mirrorPos[1]][mirrorPos[0]] != 3 and field[mirrorPos[1]][mirrorPos[0]] != 2 and mirrorPos != center):
                    field[mirrorPos[1]][mirrorPos[0]] = 3
                    i += 1
        else:
            i -= 1 if i > 0 else 0
        i += 1
    if mirror:
        field[center[1]][center[0]] = 3

    # マップJSON生成(行文字列グリッド形式。public/javascripts/map_format.jsと同一スキーマ)
    cell_to_symbol = {0: ".", 2: "#", 3: "*"}
    rows = ["".join(cell_to_symbol.get(cell, ".") for cell in row) for row in field]
    map_obj = {
        "name": "RandomMap",
        "turnMax": turn,
        "width": size_x,
        "height": size_y,
        "legend": {".": "floor", "#": "block", "*": "item"},
        "rows": rows,
        # プレイヤー初期位置を明示的に2つとも出力
        "cool": {"x": pos0[0], "y": pos0[1]},
        "hot": {"x": pos1[0], "y": pos1[1]},
    }
    return json.dumps(map_obj)


class Game:
    """CHaserゲームのロジックを管理するクラス。"""

    def __init__(self):
        """ゲームの初期化を行う。"""
        if _custom_map_data:
            # アップロードされたマップデータを使用
            self.map_data_str = _custom_map_data
        else:
            # ランダムマップ生成
            self.map_data_str = generate_random_map_data()
        # print(self.map_data_str)  # デバッグ用にマップデータを出力
        # ゲームの初期化
        self.initialize_game()

    def initialize_game(self):
        """ゲームに必要な変数を初期化する。"""
        self.game_map = []  # マップデータ
        self.names = ["プレイヤ", "対戦AI"]  # プレイヤー名
        self.chara_x = []  # 各プレイヤーのX座標
        self.chara_y = []  # 各プレイヤーのY座標
        self.score = [0, 0]  # スコア
        self.turn = 0  # 現在のターン数
        self.life = [1, 1]  # 各プレイヤーの生存フラグ（1:生存、0:死亡）
        self.put_winner = 0  # 'put'による勝者の判定用
        self.turn_max = 150  # 最大ターン数
        self._ready_call_count = 0  # get_ready()の呼び出し回数（プレイヤー・対戦AI合算）

        # マップデータの解析とゲームの準備
        self.parse_map_data()

    def parse_map_data(self):
        """マップデータ(行文字列グリッドJSON)を解析してゲームマップを構築する。"""
        map_obj = json.loads(self.map_data_str)

        self.map_name = map_obj.get("name", "CustomMap")  # マップ名
        self.turn_max = map_obj.get("turnMax", 150)  # 最大ターン数

        width = map_obj["width"]
        height = map_obj["height"]
        self.map_size_x = width + 2  # マップの横サイズ（両端に壁を追加）
        self.map_size_y = height + 2  # マップの縦サイズ（上下に壁を追加）
        self.game_map = [[] for _ in range(self.map_size_y)]  # マップデータの初期化

        legend = map_obj.get("legend", {".": "floor", "#": "block", "*": "item"})
        type_to_value = {"floor": M_FLOOR, "block": M_BLOCK, "item": M_ITEM}
        symbol_to_value = {sym: type_to_value.get(t, M_FLOOR) for sym, t in legend.items()}

        rows = map_obj.get("rows", [])
        for i, row_str in enumerate(rows):
            # マップの各行のデータ。左右に壁（ブロック）を追加
            map_row = [M_BLOCK] + [symbol_to_value.get(ch, M_FLOOR) for ch in row_str] + [M_BLOCK]
            self.game_map[i + 1] = map_row

        cool = map_obj.get("cool")
        if cool:
            # COOLプレイヤーの初期位置
            self.chara_x.insert(0, cool["x"] + 1)
            self.chara_y.insert(0, cool["y"] + 1)
        hot = map_obj.get("hot")
        if hot:
            # HOTプレイヤーの初期位置
            self.chara_x.insert(1, hot["x"] + 1)
            self.chara_y.insert(1, hot["y"] + 1)

        # マップの上下に壁（ブロック）の行を追加
        block_row = [M_BLOCK] * self.map_size_x
        self.game_map[0] = block_row
        self.game_map[self.map_size_y - 1] = block_row

    def get_map_value(self, x, y, c):
        """指定した座標のマップの値を取得する。"""
        if x < 0 or y < 0 or x >= self.map_size_x or y >= self.map_size_y:
            return M_BLOCK  # 範囲外はブロックとする
        if x == self.chara_x[1 - c] and y == self.chara_y[1 - c] and self.game_map[y][x] != M_BLOCK:
            return M_CHARA  # 敵キャラクターがいる場合
        return self.game_map[y][x]

    # コマンド方向文字(u/d/r/l)を(dx, dy)に変換する対応表
    _DIRECTION_DELTA = {"u": (0, -1), "d": (0, 1), "r": (1, 0), "l": (-1, 0)}

    def _get_area_info(self, x, y, player_id):
        """(x, y)を中心とした3x3マスの情報を取得する。"""
        values = [1]  # 生存フラグをセット
        for j in range(9):
            values.append(
                self.get_map_value(
                    x + (j % 3) - 1,
                    y + (j // 3) - 1,
                    player_id,
                )
            )
        return values

    def get_nearby_information(self, player_id):
        """プレイヤーの周囲9マスの情報を取得する。"""
        return self._get_area_info(self.chara_x[player_id], self.chara_y[player_id], player_id)

    def process_walk(self, player_id, direction):
        """移動の処理を行う。"""
        old_x = self.chara_x[player_id]
        old_y = self.chara_y[player_id]
        dx, dy = self._DIRECTION_DELTA[direction]
        self.chara_x[player_id] += dx
        self.chara_y[player_id] += dy

        # アイテム（ハート）を取得した場合の処理
        if (
            self.get_map_value(self.chara_x[player_id], self.chara_y[player_id], player_id)
            == M_ITEM
        ):
            self.score[player_id] += 1
            self.game_map[self.chara_y[player_id]][self.chara_x[player_id]] = M_FLOOR
            self.game_map[old_y][old_x] = M_BLOCK  # 移動元にブロックを置く
        else:
            self.game_map[old_y][old_x] = M_FLOOR  # 移動元を床にする

    def process_put(self, player_id, direction):
        """ブロック設置の処理を行う。"""
        dx, dy = self._DIRECTION_DELTA[direction]
        x = self.chara_x[player_id] + dx
        y = self.chara_y[player_id] + dy
        self.game_map[y][x] = M_BLOCK

    def process_look(self, player_id, direction):
        """Lookコマンドの処理を行う。指定した方向の2マス先を中心とした9マスの情報を取得する。"""
        if direction not in self._DIRECTION_DELTA:
            raise ValueError("無効な方向が指定されました: {}".format(direction))
        dx, dy = self._DIRECTION_DELTA[direction]
        x = self.chara_x[player_id] + dx * 2
        y = self.chara_y[player_id] + dy * 2
        return self._get_area_info(x, y, player_id)

    def process_search(self, player_id, direction):
        """Searchコマンドの処理を行う。指定した方向に9マス先までの情報を取得する。"""
        if direction not in self._DIRECTION_DELTA:
            raise ValueError("無効な方向が指定されました: {}".format(direction))
        dx, dy = self._DIRECTION_DELTA[direction]
        x = self.chara_x[player_id]
        y = self.chara_y[player_id]
        values = [1]  # 生存フラグ
        for d in range(1, 10):
            values.append(self.get_map_value(x + dx * d, y + dy * d, player_id))
        return values

    def process_action(self, player_id, code):
        """プレイヤーの行動を処理し、結果を返す。"""
        result_values = [1]  # 初期値として生存フラグを設定

        # コマンドの形式をチェック
        if not re.match(r"^[wpls][udrl]$", code):
            raise ValueError("無効なコマンドが入力されました: {}".format(code))

        action = code[0]
        direction = code[1]

        if action == "w":
            # Walk（移動）
            self.process_walk(player_id, direction)
            result_values = self.get_nearby_information(player_id)
        elif action == "p":
            # Put（ブロック設置）
            self.process_put(player_id, direction)
            result_values = self.get_nearby_information(player_id)
        elif action == "s":
            # Search（サーチ）
            result_values = self.process_search(player_id, direction)
        elif action == "l":
            # Look（ルック）
            result_values = self.process_look(player_id, direction)
        else:
            result_values = self.get_nearby_information(player_id)

        # 生死判定
        self.check_player_status()

        result_values[0] = self.life[player_id]  # 生存フラグを更新
        return result_values

    def check_player_status(self):
        """プレイヤーの生死を判定する。"""
        for j in range(2):
            x, y = self.chara_x[j], self.chara_y[j]
            # プレイヤーがブロックに埋まっている場合は死亡
            if self.get_map_value(x, y, j) == M_BLOCK:
                self.life[j] = 0
                self.put_winner = 1 - j  # 相手の勝利
            # 四方がブロックで囲まれている場合は死亡
            if all(
                self.get_map_value(x + dx, y + dy, j) == M_BLOCK
                for dx, dy in self._DIRECTION_DELTA.values()
            ):
                self.life[j] = 0
                self.put_winner = 1 - j  # 相手の勝利

    def advance_turn_on_ready(self):
        """get_ready()が呼ばれるたびに呼び出す。
        プレイヤー・対戦AIの両方が1回ずつget_ready()を呼び終えるごとに
        ターン数を1つ進める（呼び出し順序には依存しない）。"""
        self._ready_call_count += 1
        self.turn = (self._ready_call_count + 1) // 2

    def is_game_over(self):
        """ゲーム終了の判定を行う。"""
        return self.life[0] == 0 or self.life[1] == 0 or self.turn >= self.turn_max

    def judge_winner(self):
        """勝者の判定を行う。"""
        if self.life[0] == 0 and self.life[1] == 0:
            winner = self.put_winner  # 両者死亡なら'put'した方が勝ち
        elif self.life[0] == 0 and self.life[1] == 1:
            winner = 1  # 相手の勝ち
        elif self.life[0] == 1 and self.life[1] == 0:
            winner = 0  # プレイヤーの勝ち
        elif self.score[0] == self.score[1]:
            winner = 2  # 引き分け
        elif self.score[0] > self.score[1]:
            winner = 0  # スコアでプレイヤーの勝ち
        else:
            winner = 1  # スコアで相手の勝ち
        return winner

    def get_game_state(self):
        """現在のゲーム状態を取得する（表示用）。"""
        # ゲームマップのコピーを作成
        map_d = [row[:] for row in self.game_map]

        # プレイヤーの位置を更新
        # 同じマスに重なった場合は、chaser/server.js と同じ規約(常に45)で表す。
        if self.chara_x[0] == self.chara_x[1] and self.chara_y[0] == self.chara_y[1]:
            map_d[self.chara_y[0]][self.chara_x[0]] = 45
        else:
            for i in range(2):
                map_d[self.chara_y[i]][self.chara_x[i]] = i + 4  # 4がplayer0、5がplayer1

        return map_d

    def disp(self):
        """ゲーム画面を更新する。"""
        game_state = self.get_game_state()
        # ターン数を減少させて表示
        remaining_turns = self.turn_max - self.turn
        # スコアをリストに変換
        scores = list(self.score)
        updateGameDisplay(game_state, remaining_turns, scores)  # JavaScriptの関数を呼び出し

COOL = 2009
HOT  = 2010

Floor = 0
Enemy = 1
Block = 2
Item  = 3

UpLeft = 0
Up = 1
UpRight = 2
Left = 3
Center = 4
Right = 5
DownLeft = 6
Down = 7
DownRight = 8

UL = UpLeft
U  = Up
UR = UpRight
L  = Left
C  = Center
R  = Right
DL = DownLeft
D  = Down
DR = DownRight

F = Floor
E = Enemy
B = Block
I = Item

# プレイヤー・対戦AIの2つのClientで共有する、単一のGameインスタンス。
# それぞれ別々の名前空間で実行されるプログラムから生成されるClient同士でも
# 同じ対戦を進行できるよう、モジュールレベルで保持する。
_shared_game = None


def get_shared_game():
    """共有のGameインスタンスを取得する（未生成なら生成する）。"""
    global _shared_game
    if _shared_game is None:
        _shared_game = Game()
    return _shared_game


class Client:
    """ユーザーのクライアントを表現するクラス。

    公開API（クラス名/コンストラクタ引数/メソッド名/定数）は実物のpyCHaser
    (CHaser-Server同梱)と同一シグネチャを保つ。port/host は実際の接続先
    としては使わず、ローカル共有Gameインスタンスに委譲する。
    """

    def __init__(self, port=None, name=None, host=None, player_id=0):
        """クライアントの初期化を行う。

        player_id: 0ならプレイヤ（COOL）、1なら対戦AI（HOT）としてゲームに参加する。
        """
        self.game = get_shared_game()  # プレイヤー・対戦AIで共有するゲームインスタンス
        self.player_id = player_id
        self.turn = 0  # 現在のターン
        self.game_over = False  # ゲーム終了フラグ

    def __order(self, order_str, gr_flag=False):
        """プレイヤーの行動を処理し、結果を取得する。"""
        if self.game_over:
            return None

        if gr_flag:
            # プレイヤー・対戦AIの両方が呼び終えるごとにターンを1つ進める
            self.game.advance_turn_on_ready()
            self.turn += 1
            self.game.disp()  # ゲーム画面を更新
            values = self.game.get_nearby_information(self.player_id)
            if self.game.life[self.player_id] == 0:
                # 直前の相手の行動などで死亡していた場合でも、このターンの
                # get_readyでは（moot ではあるが）正しい情報を返し、
                # 次回以降の呼び出しから確実に打ち切る。
                print("ゲーム終了")
                self.game_over = True
            return values[1:]  # [0]は生存フラグなので除外
        else:
            try:
                values = self.game.process_action(self.player_id, order_str)
            except Exception as e:
                print(f"エラーが発生しました: {e}")
                self.game_over = True
                return None

            self.game.disp()  # ゲーム画面を更新

            if self.game.is_game_over():
                print("\nゲーム終了")
                winner = self.game.judge_winner()
                my_name = self.game.names[self.player_id]
                if winner == self.player_id:
                    print(f"{my_name}の勝ちです！")
                elif winner == 2:
                    print("引き分けです。")
                else:
                    print(f"{my_name}の負けです。")
                self.game_over = True
                return values[1:]  # [0]は生存フラグなので除外

            return values[1:]  # [0]は生存フラグなので除外

    # サーバーとの通信で使用されるメソッド群
    def get_ready(self):
        return self.__order("gr", True)

    def walk_right(self):
        return self.__order("wr")

    def walk_up(self):
        return self.__order("wu")

    def walk_left(self):
        return self.__order("wl")

    def walk_down(self):
        return self.__order("wd")

    def look_right(self):
        return self.__order("lr")

    def look_up(self):
        return self.__order("lu")

    def look_left(self):
        return self.__order("ll")

    def look_down(self):
        return self.__order("ld")

    def search_right(self):
        return self.__order("sr")

    def search_up(self):
        return self.__order("su")

    def search_left(self):
        return self.__order("sl")

    def search_down(self):
        return self.__order("sd")

    def put_right(self):
        return self.__order("pr")

    def put_up(self):
        return self.__order("pu")

    def put_left(self):
        return self.__order("pl")

    def put_down(self):
        return self.__order("pd")

    ### action ###

    # 指定方向に移動
    def walk(self, direction):
        action = {
            Up    : self.walk_up,
            Down  : self.walk_down,
            Right : self.walk_right,
            Left  : self.walk_left
        }
        return action[direction]()

    # 指定方向を近隣探査
    def look(self, direction):
        action = {
            Up    : self.look_up,
            Down  : self.look_down,
            Right : self.look_right,
            Left  : self.look_left
        }
        return action[direction]()

    # 指定方向を遠方探査
    def search(self, direction):
        action = {
            Up    : self.search_up,
            Down  : self.search_down,
            Right : self.search_right,
            Left  : self.search_left
        }
        return action[direction]()

    # 指定方向に設置
    def put(self, direction):
        action = {
            Up    : self.put_up,
            Down  : self.put_down,
            Right : self.put_right,
            Left  : self.put_left
        }
        return action[direction]()

    ### direction ###

    # 指定方向の反対方向
    def backward(self, direction):
        backward = {
            Up    : Down,
            Down  : Up,
            Right : Left,
            Left  : Right
        }
        return backward[direction]

    # 指定方向の右方向
    def rightward(self, direction):
        rightward = {
            Up    : Right,
            Down  : Left,
            Right : Down,
            Left  : Up
        }
        return rightward[direction]

    # 指定方向の左方向
    def leftward(self, direction):
        leftward = {
            Up    : Left,
            Down  : Right,
            Right : Up,
            Left  : Down
        }
        return leftward[direction]

    # 指定方向の右前方向
    def forwardRight(self, direction):
        forwardRight = {
            Up    : UpRight,
            Down  : DownLeft,
            Right : DownRight,
            Left  : UpLeft
        }
        return forwardRight[direction]

    # 指定方向の左前方向
    def fowardLeft(self, direction):
        fowardLeft = {
            Up    : UpLeft,
            Down  : DownRight,
            Right : UpRight,
            Left  : DownLeft
        }
        return fowardLeft[direction]

    # 指定方向の右後方向
    def backRight(self, direction):
        backRight = {
            Up    : DownRight,
            Down  : UpLeft,
            Right : DownLeft,
            Left  : UpRight
        }
        return backRight[direction]

    # 指定方向の左前方向
    def backLeft(self, direction):
        backLeft = {
            Up    : DownLeft,
            Down  : UpRight,
            Right : UpLeft,
            Left  : DownRight
        }
        return backLeft[direction]


    # ブロックのない方向にランダム移動
    def randomWalk(self, map_info, direction = None):
        # 可能な移動のリスト
        legalMove  = []

        # 上下左右のブロックを確認
        for dir in [Up, Down, Left, Right]:
            # 移動方向にブロックなし & 後退じゃない
            if map_info[dir] != Block and direction != self.backward(dir):
                legalMove.append(dir) # 移動方向を追加

        if len(legalMove) > 0:
            # 移動可能な中からランダムに選択
            selectedMove = random.choice(legalMove)
        else:
            # 迂回できないときは後退を選択
            selectedMove = self.backward(direction)

        # 選んだ方向に移動
        return self.walk(selectedMove), selectedMove


    # ブロックを避けて指定方向に移動
    def safetyWalk(self, map_info, direction):
        # 指定方向にブロックがなければそのまま移動
        if map_info[direction] != Block:
            selectedMove = direction
        else:
            # 指定方向にブロックがある時は左右に迂回
            # 可能な移動のリスト
            legalMove  = []
            for dir in [self.rightward(direction), self.leftward(direction)]:
                # 移動方向にブロックなし
                if map_info[dir] != Block:
                    # 移動方向を追加
                    legalMove.append(dir)

            if len(legalMove) > 0:
                # 左右に迂回可能ならランダムに選択
                selectedMove = random.choice(legalMove)
            else:
                # 迂回できないときは後退を選択
                selectedMove = self.backward(direction)

        # 選んだ方向に移動
        return self.walk(selectedMove), selectedMove

    # 壁沿いに移動
    def alongRightHandWalk(self, map_info, direction):
        # 右、指定方向、左、後ろの順にブロックがなければ移動
        if map_info[self.rightward(direction)] != Block and map_info[self.backRight(direction)] == Block:
            selectedMove = self.rightward(direction)
        elif map_info[direction] != Block:
            selectedMove = direction
        elif map_info[self.rightward(direction)] != Block:
            selectedMove = self.rightward(direction)
        elif map_info[self.leftward(direction)] != Block:
            selectedMove = self.leftward(direction)
        else:
            selectedMove = self.backward(direction)

        # 選んだ方向に移動
        return self.walk(selectedMove), selectedMove
