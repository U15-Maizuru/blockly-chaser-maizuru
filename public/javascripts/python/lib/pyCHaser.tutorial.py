# チュートリアル(Pythonで解く)専用の API。
# pyCHaser.net.py と同じ作りで、各行動関数は2文字の命令コード
# (gr/wr/wu/wl/wd/lr/lu/ll/ld/sr/su/sl/sd/pr/pu/pl/pd)を yield するジェネレータ。
# ページ側(tutorial-bridge.js)が、コードに対応する操作をチュートリアルの盤面で実行し、
# 結果(周辺の9マス)を次の send() で返す。
#
# 生徒のコードと同じ名前空間に exec されるため、結果は Blockly のブロックと同じように
# グローバル変数(map_info / look_info / search_info)にも自動で入る。
# 生徒のコードでは transformer.py の transform_tutorial_tree が walk(...) などの
# 呼び出しを yield from に変換するので、生徒は yield を書かなくてよい。

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


def _order(code):
    rec = yield code
    return rec


_DIRECTION_LETTER = {Up: 'u', Down: 'd', Left: 'l', Right: 'r'}


def _direction_letter(direction):
    try:
        return _DIRECTION_LETTER[direction]
    except (KeyError, TypeError):
        raise ValueError('walk / look / search / put には Up, Down, Left, Right のどれかを指定してください')


# 準備・周辺の探査
def get_ready():
    global map_info
    rec = yield from _order('gr')
    map_info = rec
    return rec


# 指定方向に移動
def walk(direction):
    global map_info
    rec = yield from _order('w' + _direction_letter(direction))
    map_info = rec
    return rec


# 指定方向を近隣探査
def look(direction):
    global look_info
    rec = yield from _order('l' + _direction_letter(direction))
    look_info = rec
    return rec


# 指定方向を遠方探査
def search(direction):
    global search_info
    rec = yield from _order('s' + _direction_letter(direction))
    search_info = rec
    return rec


# 指定方向にブロックを設置
def put(direction):
    global map_info
    rec = yield from _order('p' + _direction_letter(direction))
    map_info = rec
    return rec
