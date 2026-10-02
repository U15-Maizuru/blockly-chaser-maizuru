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
#
# transform_tutorial_tree / compile_tutorial: チュートリアル(Pythonで解く)専用。
#   トップレベルに書かれたスクリプト全体をジェネレータ関数に包む(下部のセクション参照)。
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

    def _is_direct_action(self, func):
        """行動呼び出しの判定。既定は <obj>.walk(...) のような属性呼び出し。
        チュートリアル用の変換では、walk(...) のような名前呼び出しに差し替える。"""
        return isinstance(func, ast.Attribute) and func.attr in _ACTION_METHODS

    def visit_Call(self, call_node):
        func = call_node.func
        scope = self._stack[-1]
        if self._is_direct_action(func):
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

    def _is_direct_action(self, func):
        return isinstance(func, ast.Attribute) and func.attr in _ACTION_METHODS

    def visit_Call(self, call_node):
        self.generic_visit(call_node)
        func = call_node.func
        if self._is_direct_action(func):
            return ast.copy_location(ast.YieldFrom(value=call_node), call_node)
        if isinstance(func, ast.Name):
            target = self.resolved_calls.get(func.id)
            if target is not None and target.needs_yield:
                return ast.copy_location(ast.YieldFrom(value=call_node), call_node)
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


def _wrap_action_calls(statements, collector=None, wrapper_class=None):
    """do_turn本体(トップレベル文の列、continue変換済み)に対し、ネスト関数を
    跨いだ行動呼び出しのyield from化を行う。

    ラムダの中に(直接・間接に)行動呼び出しがある場合、Python言語仕様上ラムダは
    yieldを含められないため変換不可能。その場合はSyntaxErrorを送出し、
    生徒に(サイレントなタイムアウトではなく)分かりやすいエラーを提示する。

    collector / wrapper_class は、行動呼び出しの判定方法を差し替えるための引数
    (省略時は <obj>.walk(...) 形式。チュートリアルでは walk(...) 形式を渡す)。"""
    collector = collector or _ScopeCollector()
    wrapper_class = wrapper_class or ActionCallWrapper
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

    wrapper = wrapper_class(resolved_calls, yielding_nodes)
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


# ---------------------------------------------------------------------------
# チュートリアル(Pythonで解く)専用の変換
#
# 生徒のコードはトップレベルに walk(Up) などを直接書く(main() も Client も無い)。
# そこでスクリプト全体を、ジェネレータ関数 _tutorial_main() の本体に包む。
#   - walk/look/search/put/get_ready の呼び出しを yield from に変換する
#     (これらを直接・間接に呼ぶ def の呼び出しも同様)。呼び出し元(ページ側)が
#     ジェネレータを1歩ずつ進め、yield された命令コードを実際の操作に対応付ける。
#   - 関数に包むとトップレベルの変数がローカルになってしまうため、モジュール直下で
#     束縛される名前は先頭の global 宣言で本来のグローバル変数のままにする
#     (def の中の global 宣言と食い違わないようにするため)。
#   - yield / await / async はホストの想定しない値を返せてしまうので受け付けない。
# エラー行番号が生徒のコードと一致するよう、文字列に戻さず AST のまま compile する。
# ---------------------------------------------------------------------------

STUDENT_FILENAME = '<student>'
TUTORIAL_MAIN_NAME = '_tutorial_main'

_TUTORIAL_ACTIONS = {'get_ready', 'walk', 'look', 'search', 'put'}


class _TutorialScopeCollector(_ScopeCollector):
    def __init__(self, actions):
        super().__init__()
        self.actions = actions

    def _is_direct_action(self, func):
        return isinstance(func, ast.Name) and func.id in self.actions


def _make_tutorial_wrapper(actions):
    class _TutorialActionCallWrapper(ActionCallWrapper):
        def _is_direct_action(self, func):
            return isinstance(func, ast.Name) and func.id in actions
    return _TutorialActionCallWrapper


def _student_syntax_error(message, node):
    err = SyntaxError(message)
    err.lineno = getattr(node, 'lineno', None)
    err.offset = getattr(node, 'col_offset', 0) + 1
    err.filename = STUDENT_FILENAME
    err.tutorial_message = True
    return err


class _ForbiddenFinder(ast.NodeVisitor):
    """生徒コードに含めてはいけない構文を探す。"""

    def __init__(self):
        self._function_depth = 0

    def visit_Yield(self, node):
        raise _student_syntax_error('yield は使えません', node)

    def visit_YieldFrom(self, node):
        raise _student_syntax_error('yield は使えません', node)

    def visit_Await(self, node):
        raise _student_syntax_error('await は使えません', node)

    def visit_AsyncFunctionDef(self, node):
        raise _student_syntax_error('async は使えません', node)

    def visit_AsyncFor(self, node):
        raise _student_syntax_error('async は使えません', node)

    def visit_AsyncWith(self, node):
        raise _student_syntax_error('async は使えません', node)

    def visit_FunctionDef(self, node):
        self._function_depth += 1
        self.generic_visit(node)
        self._function_depth -= 1

    def visit_Lambda(self, node):
        self._function_depth += 1
        self.generic_visit(node)
        self._function_depth -= 1

    def visit_Return(self, node):
        # トップレベルの return は、関数に包むと有効になってしまうため先に弾く
        if self._function_depth == 0:
            raise _student_syntax_error('return は def(関数)の中でしか使えません', node)
        self.generic_visit(node)


class _BoundNameCollector(ast.NodeVisitor):
    """モジュール直下(関数・ラムダの外)で束縛される名前を集める。
    内包表記の変数はその内側だけのものなので、代入式(:=)の対象だけを拾う。"""

    def __init__(self):
        self.names = set()

    def visit_FunctionDef(self, node):
        self.names.add(node.name)

    def visit_AsyncFunctionDef(self, node):
        self.names.add(node.name)

    def visit_ClassDef(self, node):
        self.names.add(node.name)

    def visit_Lambda(self, node):
        pass

    def visit_Name(self, node):
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self.names.add(node.id)

    def visit_Import(self, node):
        for alias in node.names:
            self.names.add((alias.asname or alias.name).split('.')[0])

    def visit_ImportFrom(self, node):
        for alias in node.names:
            if alias.name != '*':
                self.names.add(alias.asname or alias.name)

    def visit_ExceptHandler(self, node):
        if node.name:
            self.names.add(node.name)
        self.generic_visit(node)

    def visit_MatchAs(self, node):
        if node.name:
            self.names.add(node.name)
        self.generic_visit(node)

    def visit_MatchStar(self, node):
        if node.name:
            self.names.add(node.name)

    def visit_MatchMapping(self, node):
        if node.rest:
            self.names.add(node.rest)
        self.generic_visit(node)

    def _visit_comprehension(self, node):
        for child in ast.walk(node):
            if isinstance(child, ast.NamedExpr) and isinstance(child.target, ast.Name):
                self.names.add(child.target.id)

    visit_ListComp = _visit_comprehension
    visit_SetComp = _visit_comprehension
    visit_DictComp = _visit_comprehension
    visit_GeneratorExp = _visit_comprehension


def _module_bound_names(statements):
    collector = _BoundNameCollector()
    for stmt in statements:
        collector.visit(stmt)
    return collector.names


def transform_tutorial_tree(source_code):
    """生徒のスクリプトを、_tutorial_main() ジェネレータ関数だけを持つ Module(AST)にして返す。
    構文エラーは SyntaxError として送出する(行番号は元のコードのまま)。"""
    tree = ast.parse(source_code, filename=STUDENT_FILENAME)
    _ForbiddenFinder().visit(tree)

    module_names = _module_bound_names(tree.body)
    defined_names = {
        n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef))
    }
    # 生徒が walk などと同じ名前の関数・変数を自分で作った場合は、その名前を行動として扱わない
    actions = _TUTORIAL_ACTIONS - module_names - defined_names

    # walk などを呼び出さずに値として使う書き方(f = walk など)は、行動が実行されないまま
    # 何も起きずに終わってしまうため、分かりやすいエラーにする
    called_funcs = {id(n.func) for n in ast.walk(tree) if isinstance(n, ast.Call)}
    for n in ast.walk(tree):
        if (isinstance(n, ast.Name) and n.id in actions
                and isinstance(n.ctx, ast.Load) and id(n) not in called_funcs):
            raise _student_syntax_error(
                '%s は %s(...) のように ( ) をつけて使ってください' % (n.id, n.id), n)

    body = _wrap_action_calls(
        tree.body,
        collector=_TutorialScopeCollector(actions),
        wrapper_class=_make_tutorial_wrapper(actions),
    )

    prologue = []
    if module_names:
        prologue.append(ast.Global(names=sorted(module_names)))
    # 行動呼び出しが1つも無くても、必ずジェネレータ関数になるようにする
    prologue.append(ast.If(
        test=ast.Constant(value=False),
        body=[ast.Expr(value=ast.Yield(value=None))],
        orelse=[],
    ))

    func_kwargs = dict(
        name=TUTORIAL_MAIN_NAME,
        args=ast.arguments(
            posonlyargs=[], args=[], vararg=None, kwonlyargs=[],
            kw_defaults=[], kwarg=None, defaults=[]
        ),
        body=prologue + body,
        decorator_list=[],
        returns=None,
    )
    if 'type_params' in ast.FunctionDef._fields:
        func_kwargs['type_params'] = []
    func = ast.FunctionDef(**func_kwargs)
    if tree.body:
        ast.copy_location(func, tree.body[0])
    else:
        func.lineno = 1
        func.col_offset = 0

    tree.body = [func]
    ast.fix_missing_locations(tree)
    return tree


def compile_tutorial(source_code):
    """変換して compile する。エラー行番号は生徒のコードと一致する。"""
    return compile(transform_tutorial_tree(source_code), STUDENT_FILENAME, 'exec')


def transform_code_tutorial(source_code):
    """変換結果を文字列で返す(確認・テスト用。実行には compile_tutorial を使う)。"""
    return ast.unparse(transform_tutorial_tree(source_code))


def _has_japanese(text):
    return any(ord(ch) > 0x7f for ch in text)


def _explain_syntax_error(exc):
    msg = exc.msg or ''
    if getattr(exc, 'tutorial_message', False):
        return msg
    if isinstance(exc, IndentationError):
        if 'expected an indented block' in msg:
            return '字下げ(インデント)が必要です'
        if 'unexpected indent' in msg:
            return '余分な字下げがあります'
        if 'unindent' in msg:
            return '字下げの位置がそろっていません'
        return '字下げ(インデント)がそろっていません'
    if 'was never closed' in msg:
        return 'カッコが閉じられていません'
    if "expected ':'" in msg:
        return '行の終わりに : が必要です'
    if 'invalid character' in msg or 'invalid non-printable character' in msg:
        return '全角の文字や記号がまじっています。半角で入力してください'
    if 'inside list comprehension' in msg or 'inside generator expression' in msg \
            or 'inside set comprehension' in msg or 'inside dict comprehension' in msg:
        return '[ ... for ... ] の中では walk や look を使えません。for 文で書いてみましょう'
    if 'outside loop' in msg:
        return 'break や continue は for や while の中でしか使えません'
    if 'unterminated string' in msg:
        return '文字列の引用符が閉じられていません'
    if 'unmatched' in msg or 'does not match' in msg:
        return 'カッコの数が合っていません'
    return '書き方がまちがっています'


def _student_line(exc):
    line = None
    tb = exc.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == STUDENT_FILENAME:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def format_tutorial_error(exc):
    """生徒向けのエラーメッセージ(日本語の説明 + 行番号 + 元の英文)を返す。"""
    if isinstance(exc, SyntaxError):
        line = exc.lineno
        explanation = _explain_syntax_error(exc)
        original = exc.msg or ''
    else:
        line = _student_line(exc)
        original = str(exc)
        name = getattr(exc, 'name', None)
        if isinstance(exc, UnboundLocalError):
            explanation = ('関数の中で、代入する前に %s を使っています。'
                           '関数の外の変数を書きかえるなら、関数の先頭に global %s と書きます') % (name, name)
        elif isinstance(exc, NameError):
            explanation = '%s という名前はまだ決まっていません。つづりや大文字・小文字を確認しましょう' % name
        elif isinstance(exc, RecursionError):
            explanation = '関数が自分自身を呼び出し続けています'
        elif isinstance(exc, IndexError):
            explanation = 'リストの番号が範囲の外です'
        elif isinstance(exc, ZeroDivisionError):
            explanation = '0 で割ることはできません'
        elif isinstance(exc, TypeError) and 'not callable' in original:
            explanation = '関数ではないものに ( ) をつけて呼び出しています'
        elif isinstance(exc, TypeError):
            explanation = '数字・文字・リストなどの使い方がまちがっています'
        elif _has_japanese(original):
            explanation = original
        else:
            explanation = 'エラーが起きました'
    prefix = ('%s行目: ' % line) if line else ''
    kind = type(exc).__name__
    if explanation == original:
        return prefix + explanation
    return '%s%s\n(%s: %s)' % (prefix, explanation, kind, original)


# ---------------------------------------------------------------------------
# チュートリアル用の読み込み・1歩実行(Web Worker から呼ばれる)
#   tutorial_load      : 生徒のコードを変換して読み込む
#   tutorial_new_turn  : 実行の開始(ジェネレータを作る)
#   tutorial_step      : ジェネレータを1歩進める。戻り値はJSON文字列
#       [False, "<2文字の命令コード>"]  : 行動を1つ要求した
#       [True, {"finished": True}]      : プログラムが最後まで終わった
#       [True, {"error": "<メッセージ>"}] : 実行時エラー
# ---------------------------------------------------------------------------
import json as _json

_tutorial_state = {'main': None, 'gen': None}


def _tutorial_json(payload):
    return _json.dumps(payload, ensure_ascii=False)


def tutorial_load(source_code, lib_source, initial_map_info_json):
    """戻り値: JSON文字列 {"ok": true} または {"ok": false, "message": "..."}"""
    _tutorial_state['main'] = None
    _tutorial_state['gen'] = None
    try:
        code = compile_tutorial(source_code)
    except SyntaxError as exc:
        return _tutorial_json({'ok': False, 'message': format_tutorial_error(exc)})

    ns = {'__name__': '__tutorial_player__'}
    exec(compile(lib_source, '<tutorial-lib>', 'exec'), ns)
    initial_map_info = _json.loads(initial_map_info_json) if initial_map_info_json else None
    ns['map_info'] = list(initial_map_info) if initial_map_info else [0] * 9
    ns['look_info'] = [0] * 9
    ns['search_info'] = [0] * 9
    exec(code, ns)

    _tutorial_state['main'] = ns[TUTORIAL_MAIN_NAME]
    return _tutorial_json({'ok': True})


def tutorial_new_turn():
    _tutorial_state['gen'] = _tutorial_state['main']()


def tutorial_step(value):
    gen = _tutorial_state['gen']
    try:
        code = gen.send(value)
    except StopIteration:
        _tutorial_state['gen'] = None
        return _tutorial_json([True, {'finished': True}])
    except Exception as exc:
        _tutorial_state['gen'] = None
        return _tutorial_json([True, {'error': format_tutorial_error(exc)}])
    return _tutorial_json([False, code])
