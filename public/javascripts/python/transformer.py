# 生徒コードの main(port, name, host) を、毎ターン呼び出せる do_turn() 関数に
# 変換するASTトランスフォーマ。while True: の外側（Client(...)の呼び出し等）は
# そのまま残し、while True: の中身だけを抽出する。continue は return True に変換する。
#
# transform_code_local: Python-CHaser-Web 原型のまま。Client(...)呼び出しの引数を
#   固定値(player_id含む)に置き換える。モード③（オフライン練習）専用。
#   do_turn は普通の関数（yieldなし、同期的に1ターン分を即座に実行する）。
#
# transform_code_net: モード①（オンライン対戦）専用。Client(...)呼び出しは
#   一切書き換えない（生徒が書いた意味論のまま — pyCHaser互換性の絶対条件）。
#   代わりに、while True: の中で呼ばれるClientのアクションメソッド呼び出しを
#   yield from で包む。これにより do_turn は自動的にジェネレータ関数になり、
#   py-bridge.js がジェネレータを駆動してSocket.IOの非同期往復を実現できる。
import ast

# yield from で包む対象（Clientの中でサーバー通信/共有状態更新を伴いうるメソッド）。
# backward/rightward/leftward等の純粋な方向計算ヘルパーは対象外。
_ACTION_METHODS = {
    'get_ready',
    'walk', 'walk_up', 'walk_down', 'walk_left', 'walk_right',
    'look', 'look_up', 'look_down', 'look_left', 'look_right',
    'search', 'search_up', 'search_down', 'search_left', 'search_right',
    'put', 'put_up', 'put_down', 'put_left', 'put_right',
    'randomWalk', 'safetyWalk', 'alongRightHandWalk',
}


def _extract_do_turn(node, wrap_actions, strip_args):
    """main()のFunctionDefノードを書き換え、while True:の中身をdo_turn関数として
    切り出す。wrap_actionsがTrueなら、do_turn内のClientアクション呼び出しを
    yield fromで包む(ネットワークモード用)。

    strip_args: Trueならmain()の引数を空にする(ローカルモード。Client(...)呼び出し
    自体を固定値へ書き換えるため、port/name/hostという名前はもう参照されない)。
    Falseならmain(port, name, host)の引数はそのまま残し、全てにNoneのデフォルト値を
    与える(ネットワークモード。Client(...)呼び出しを一切書き換えないため、
    port/name/hostという名前は本文中で引き続き参照される。呼び出し側がmain()を
    引数なしで呼べるようにNoneをデフォルトにしておく)。"""
    if strip_args:
        node.args.args = []
    else:
        node.args.defaults = [ast.Constant(value=None) for _ in node.args.args]
    new_body = []
    do_turn_func = None

    # main関数内でglobal宣言されている変数を収集
    global_vars = set()
    for stmt in node.body:
        if isinstance(stmt, ast.Global):
            for name in stmt.names:
                global_vars.add(name)
        if isinstance(stmt, ast.Assign):
            for target in stmt.targets:
                if isinstance(target, ast.Name):
                    global_vars.add(target.id)

    class ActionCallWrapper(ast.NodeTransformer):
        """<expr>.method(...) が _ACTION_METHODS に含まれる場合、
        呼び出し全体を yield from でラップする。
        ネストした関数定義/ラムダの中には踏み込まない
        (do_turn自身とは別スコープであり、そこでyield fromに書き換えると
        呼び出し元がyield fromしない限り実行されないジェネレータに
        意図せず変わってしまうため)。"""
        def visit_Call(self, call_node):
            self.generic_visit(call_node)
            func = call_node.func
            if isinstance(func, ast.Attribute) and func.attr in _ACTION_METHODS:
                return ast.YieldFrom(value=call_node)
            return call_node

        def visit_FunctionDef(self, node):
            return node

        def visit_AsyncFunctionDef(self, node):
            return node

        def visit_Lambda(self, node):
            return node

    for stmt in node.body:
        # while Trueループを探します
        if isinstance(stmt, ast.While) and isinstance(stmt.test, ast.Constant) and stmt.test.value == True:
            # while Trueの中身をdo_turnに

            # do_turn関数の先頭にglobal宣言を追加
            global_nodes = []
            if global_vars:
                global_nodes.append(ast.Global(list(global_vars)))

            # continueをreturn Trueに変換
            # ただし、ネストしたfor/whileループやネストした関数定義自身が持つ
            # continueはそのループ/関数に効く通常のcontinueなので書き換えない。
            class ContinueReplacer(ast.NodeTransformer):
                def visit_Continue(self, node):
                    return ast.Return(value=ast.Constant(value=True))

                def visit_For(self, node):
                    return node

                def visit_AsyncFor(self, node):
                    return node

                def visit_While(self, node):
                    return node

                def visit_FunctionDef(self, node):
                    return node

                def visit_AsyncFunctionDef(self, node):
                    return node

                def visit_Lambda(self, node):
                    return node

            do_turn_body = []
            for s in stmt.body:
                s = ContinueReplacer().visit(s)
                if wrap_actions:
                    s = ActionCallWrapper().visit(s)
                do_turn_body.append(s)

            # 'do_turn'関数を作成します
            do_turn_func = ast.FunctionDef(
                name='do_turn',
                args=ast.arguments(
                    posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]
                ),
                body=global_nodes +
                    # 'do_turn'の最初にgame_overチェックを追加します
                    [ast.If(
                        test=ast.Attribute(value=ast.Name(id='player', ctx=ast.Load()), attr='game_over', ctx=ast.Load()),
                        body=[ast.Return(value=ast.Constant(value=False))],
                        orelse=[]
                    )] +
                    do_turn_body +
                    [ast.Return(value=ast.Constant(value=True))],
                decorator_list=[]
            )
        else:
            new_body.append(stmt)

    if do_turn_func:
        new_body.append(do_turn_func)
        new_body.append(ast.Return(value=ast.Name(id='do_turn', ctx=ast.Load())))
    node.body = new_body
    return node


def transform_code_local(source_code, player_id=0, client_name='player'):
    """モード③（オフライン練習）用。Python-CHaser-Web原型のまま:
    Client(...)呼び出しの引数を固定値(player_id含む)に置き換える。"""
    tree = ast.parse(source_code)

    class CodeTransformer(ast.NodeTransformer):
        def visit_FunctionDef(self, node):
            if node.name == 'main':
                class ClientCallReplacer(ast.NodeTransformer):
                    def visit_Assign(self, assign_node):
                        if (isinstance(assign_node.value, ast.Call) and
                            isinstance(assign_node.value.func, ast.Name) and
                            assign_node.value.func.id == 'Client'):
                            assign_node.value.keywords = [
                                ast.keyword(arg='port', value=ast.Constant(value=2010)),
                                ast.keyword(arg='name', value=ast.Constant(value=client_name)),
                                ast.keyword(arg='host', value=ast.Constant(value='localhost')),
                                ast.keyword(arg='player_id', value=ast.Constant(value=player_id)),
                            ]
                        return assign_node

                node.body = [ClientCallReplacer().visit(stmt) for stmt in node.body]
                node = _extract_do_turn(node, wrap_actions=False, strip_args=True)
            return node

    new_tree = CodeTransformer().visit(tree)
    ast.fix_missing_locations(new_tree)
    return ast.unparse(new_tree)


def transform_code_net(source_code):
    """モード①（オンライン対戦）用。Client(...)呼び出しは一切書き換えない。
    do_turn内のアクション呼び出しをyield fromで包み、ジェネレータ化する。"""
    tree = ast.parse(source_code)

    class CodeTransformer(ast.NodeTransformer):
        def visit_FunctionDef(self, node):
            if node.name == 'main':
                node = _extract_do_turn(node, wrap_actions=True, strip_args=False)
            return node

    new_tree = CodeTransformer().visit(tree)
    ast.fix_missing_locations(new_tree)
    return ast.unparse(new_tree)
