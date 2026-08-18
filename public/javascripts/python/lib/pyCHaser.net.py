# モード①（オンライン対戦）専用のネットワーク版Client。
# 公開API（クラス名/コンストラクタ引数/メソッド名/定数）は、CHaser-Server同梱の
# 実物 pyCHaser.py と1文字違わず同一シグネチャを保つ(B-1''の絶対条件)。
# 内部実装だけが異なる: 実ソケット通信の代わりに、各アクションメソッドが
# 2文字の命令コード（実物pyCHaserがそのまま\r\nを付けて送信する文字列と同一の
# 語彙: gr/wr/wu/wl/wd/lr/lu/ll/ld/sr/su/sl/sd/pr/pu/pl/pd）をyieldし、
# public/javascripts/python/py-bridge.js がジェネレータを駆動して実際に
# Socket.IOでchaser/server.jsと通信する。
#
# port/host は実際の接続先としては使わない（このモードで接続すべき部屋は
# ページ側のアンビエントなコンテキストが既に把握しているため、B-1'参照）。
# Client(...)の呼び出し自体はASTトランスフォーマ(transformer.py)によって
# 一切書き換えられない — 生徒が書いたコードの意味論を変更しないことで
# pyCHaser互換性を保つ。

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

import random


class Client:
    """ネットワーク対戦用クライアント。各メソッドはジェネレータとして動作し、
    py-bridge.js が gen.next(rec_data) でジェネレータを駆動することで
    実際のSocket.IO通信を行う。"""

    def __init__(self, port=None, name=None, host=None):
        self.port = port
        self.name = name
        self.host = host
        self.turn = 0
        self.game_over = False

    def __order(self, order_str):
        """2文字の命令コードをyieldし、py-bridge.jsから返された
        9要素の周辺情報配列(rec_data)を受け取る。"""
        if self.game_over:
            return None
        rec_data = yield order_str
        if rec_data is not None:
            self.turn += 1
        else:
            self.game_over = True
        return rec_data

    # サーバーとの通信で使用されるメソッド群（実物pyCHaserと同一の命令コード）
    def get_ready(self):
        return (yield from self.__order("gr"))

    def walk_right(self):
        return (yield from self.__order("wr"))

    def walk_up(self):
        return (yield from self.__order("wu"))

    def walk_left(self):
        return (yield from self.__order("wl"))

    def walk_down(self):
        return (yield from self.__order("wd"))

    def look_right(self):
        return (yield from self.__order("lr"))

    def look_up(self):
        return (yield from self.__order("lu"))

    def look_left(self):
        return (yield from self.__order("ll"))

    def look_down(self):
        return (yield from self.__order("ld"))

    def search_right(self):
        return (yield from self.__order("sr"))

    def search_up(self):
        return (yield from self.__order("su"))

    def search_left(self):
        return (yield from self.__order("sl"))

    def search_down(self):
        return (yield from self.__order("sd"))

    def put_right(self):
        return (yield from self.__order("pr"))

    def put_up(self):
        return (yield from self.__order("pu"))

    def put_left(self):
        return (yield from self.__order("pl"))

    def put_down(self):
        return (yield from self.__order("pd"))

    ### action ###

    # 指定方向に移動
    def walk(self, direction):
        action = {
            Up    : self.walk_up,
            Down  : self.walk_down,
            Right : self.walk_right,
            Left  : self.walk_left
        }
        return (yield from action[direction]())

    # 指定方向を近隣探査
    def look(self, direction):
        action = {
            Up    : self.look_up,
            Down  : self.look_down,
            Right : self.look_right,
            Left  : self.look_left
        }
        return (yield from action[direction]())

    # 指定方向を遠方探査
    def search(self, direction):
        action = {
            Up    : self.search_up,
            Down  : self.search_down,
            Right : self.search_right,
            Left  : self.search_left
        }
        return (yield from action[direction]())

    # 指定方向に設置
    def put(self, direction):
        action = {
            Up    : self.put_up,
            Down  : self.put_down,
            Right : self.put_right,
            Left  : self.put_left
        }
        return (yield from action[direction]())

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
    def randomWalk(self, map_info, direction=None):
        legalMove = []
        for dir in [Up, Down, Left, Right]:
            if map_info[dir] != Block and direction != self.backward(dir):
                legalMove.append(dir)

        if len(legalMove) > 0:
            selectedMove = random.choice(legalMove)
        else:
            selectedMove = self.backward(direction)

        result = yield from self.walk(selectedMove)
        return result, selectedMove

    # ブロックを避けて指定方向に移動
    def safetyWalk(self, map_info, direction):
        if map_info[direction] != Block:
            selectedMove = direction
        else:
            legalMove = []
            for dir in [self.rightward(direction), self.leftward(direction)]:
                if map_info[dir] != Block:
                    legalMove.append(dir)

            if len(legalMove) > 0:
                selectedMove = random.choice(legalMove)
            else:
                selectedMove = self.backward(direction)

        result = yield from self.walk(selectedMove)
        return result, selectedMove

    # 壁沿いに移動
    def alongRightHandWalk(self, map_info, direction):
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

        result = yield from self.walk(selectedMove)
        return result, selectedMove
