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


class _Scope:
    """do_turn本体内のネストしたFunctionDef/AsyncFunctionDef/Lambdaひとつぶんの
    スコープ情報。root(do_turn自身の直下)はnode=Noneで表す。"""
    __slots__ = ('node', 'name', 'is_lambda', 'direct_action_call', 'calls_direct', 'needs_yield')

    def __init__(self, node, name, is_lambda):
        self.node = node
        self.name = name
        self.is_lambda = is_lambda
        self.direct_action_call = False
        self.calls_direct = set()
        self.needs_yield = False


class _ScopeCollector(ast.NodeVisitor):
    """do_turn本体(トップレベル文の列)を対象に、ネストした関数定義/ラムダごとに
    _Scopeを作る。各スコープについて、直接の行動呼び出し(<obj>.action(...))の
    有無(direct_action_call)と、そのスコープ直下で名前呼び出しされた関数名
    (calls_direct)を集める。これらは後段の不動点伝播(_propagate_needs_yield)で、
    「行動呼び出しを直接・間接に含む関数」を特定するために使う。

    名前解決は「関数名を直接呼ぶ(name(...))」形式のみサポートする。
    辞書/属性経由の呼び出し(action[direction]()等)や変数に代入してからの
    呼び出しは対象外(現状維持=素通し)。"""

    def __init__(self):
        self.root = _Scope(node=None, name=None, is_lambda=False)
        self.scopes = [self.root]
        self.scopes_by_name = {}
        self._stack = [self.root]

    def visit_Call(self, call_node):
        func = call_node.func
        scope = self._stack[-1]
        if isinstance(func, ast.Attribute) and func.attr in _ACTION_METHODS:
            scope.direct_action_call = True
        elif isinstance(func, ast.Name):
            scope.calls_direct.add(func.id)
        self.generic_visit(call_node)

    def _visit_function(self, node, name, is_lambda):
        scope = _Scope(node=node, name=name, is_lambda=is_lambda)
        self.scopes.append(scope)
        if name is not None:
            self.scopes_by_name.setdefault(name, []).append(scope)
        self._stack.append(scope)
        self.generic_visit(node)
        self._stack.pop()

    def visit_FunctionDef(self, node):
        self._visit_function(node, node.name, is_lambda=False)

    def visit_AsyncFunctionDef(self, node):
        self._visit_function(node, node.name, is_lambda=False)

    def visit_Lambda(self, node):
        self._visit_function(node, name=None, is_lambda=True)


def _propagate_needs_yield(collector):
    """「直接行動を呼ぶ関数」から「それを呼ぶ関数」へneeds_yieldを不動点まで
    伝播する。スコープ数は有限なので単調に収束する。再帰関数も特別扱い不要。

    同名関数が複数箇所に定義されている場合は名前解決を諦め(サポート対象外)、
    その名前への呼び出しは伝播に使わない。戻り値はその「一意に解決できる
    関数名 -> _Scope」の辞書で、後段の書き換え(ActionCallWrapper)でも使う。"""
    unique_by_name = {
        name: scopes[0] for name, scopes in collector.scopes_by_name.items()
        if len(scopes) == 1
    }
    changed = True
    while changed:
        changed = False
        for scope in collector.scopes:
            if scope.needs_yield:
                continue
            if scope.direct_action_call:
                scope.needs_yield = True
                changed = True
                continue
            for called_name in scope.calls_direct:
                target = unique_by_name.get(called_name)
                if target is not None and target.needs_yield:
                    scope.needs_yield = True
                    changed = True
                    break
    return unique_by_name


class ActionCallWrapper(ast.NodeTransformer):
    """<expr>.method(...) が _ACTION_METHODS に含まれる呼び出し、および
    (_ScopeCollector/_propagate_needs_yieldで判定した)行動呼び出しを
    直接・間接に含むネスト関数への呼び出しを、yield from でラップする。

    ネスト関数自身も、それがneeds_yield対象であれば内部を再帰的に書き換え
    (内部にyield fromを持つことで自動的にジェネレータ関数になる)、そうでなければ
    戻り値だけを使う純粋ヘルパー関数として素通しする(誤ってジェネレータ化しない)。"""
    def __init__(self, resolved_calls, yielding_nodes):
        self.resolved_calls = resolved_calls
        self.yielding_nodes = yielding_nodes

    def visit_Call(self, call_node):
        self.generic_visit(call_node)
        func = call_node.func
        if isinstance(func, ast.Attribute) and func.attr in _ACTION_METHODS:
            return ast.YieldFrom(value=call_node)
        if isinstance(func, ast.Name):
            target = self.resolved_calls.get(func.id)
            if target is not None and target.needs_yield:
                return ast.YieldFrom(value=call_node)
        return call_node

    def _visit_maybe_generator(self, node):
        if id(node) in self.yielding_nodes:
            self.generic_visit(node)
        return node

    def visit_FunctionDef(self, node):
        return self._visit_maybe_generator(node)

    def visit_AsyncFunctionDef(self, node):
        return self._visit_maybe_generator(node)

    def visit_Lambda(self, node):
        return node


def _wrap_action_calls(statements):
    """do_turn本体(トップレベル文の列、continue変換済み)に対し、ネスト関数を
    跨いだ行動呼び出しのyield from化を行う。

    ラムダの中に(直接・間接に)行動呼び出しがある場合、Python言語仕様上ラムダは
    yieldを含められないため変換不可能。その場合はSyntaxErrorを送出し、
    生徒に(サイレントなタイムアウトではなく)分かりやすいエラーを提示する。"""
    collector = _ScopeCollector()
    for s in statements:
        collector.visit(s)
    resolved_calls = _propagate_needs_yield(collector)

    yielding_nodes = set()
    for scope in collector.scopes:
        if not scope.needs_yield or scope.node is None:
            continue
        if scope.is_lambda:
            raise SyntaxError(
                'ラムダ式の中で対戦アクション(walk/put等)を(直接・間接に)呼び出しています。'
                'ラムダは yield を含められないため、通常の def を使う書き方に直してください。'
            )
        yielding_nodes.add(id(scope.node))

    wrapper = ActionCallWrapper(resolved_calls, yielding_nodes)
    return [wrapper.visit(s) for s in statements]


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

            continue_replaced = [ContinueReplacer().visit(s) for s in stmt.body]
            do_turn_body = _wrap_action_calls(continue_replaced) if wrap_actions else continue_replaced

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
