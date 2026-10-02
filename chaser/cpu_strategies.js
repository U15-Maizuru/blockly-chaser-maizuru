// CPU の行動決定ロジック。
// server_store/io/socket に依存しない。周囲9マスを受け取り、行動を返す。
//   マス: 0=床, 1=敵, 2=壁, 3=アイテム
//   9マスの添字: 0 1 2 / 3 4 5 / 6 7 8 (1=上, 3=左, 5=右, 7=下, 4=自分)

const FLOOR = 0;
const ENEMY = 1;
const BLOCK = 2;
const ITEM = 3;

const UP = 1;
const LEFT = 3;
const RIGHT = 5;
const DOWN = 7;
const CENTER = 4;

const DIR_NAME = { [UP]: 'top', [LEFT]: 'left', [RIGHT]: 'right', [DOWN]: 'bottom' };
const OPPOSITE = { [UP]: DOWN, [DOWN]: UP, [LEFT]: RIGHT, [RIGHT]: LEFT };
const ORTH_DELTA = { [UP]: [0, -1], [DOWN]: [0, 1], [LEFT]: [-1, 0], [RIGHT]: [1, 0] };

// 斜めに敵がいるときの回避先 (敵と反対側を優先)
const DIAGONAL_ESCAPES = [
    [0, [DOWN, RIGHT]],
    [2, [DOWN, LEFT]],
    [6, [UP, RIGHT]],
    [8, [UP, LEFT]],
];
// 斜めにアイテムがあるときの接近先
const DIAGONAL_APPROACHES = [
    [0, [UP, LEFT]],
    [2, [UP, RIGHT]],
    [6, [DOWN, LEFT]],
    [8, [DOWN, RIGHT]],
];
const NEIGHBOR_OFFSET = {};
for (let i = 0; i < 9; i++) {
    if (i !== CENTER) {
        NEIGHBOR_OFFSET[i] = [(i % 3) - 1, Math.floor(i / 3) - 1];
    }
}

const key = (x, y) => x + ',' + y;

// 動き方ごとの設定
//   pursuitRange: 記憶しているアイテムを追う距離の上限
//   pickupGate: 両隣が壁のアイテムを見送る(自縛回避)か
//   peekAfterEnemy: 敵を見た直後に進行方向を look するか
//   enemyMargin: 探索の経路計算で、直近に見た敵の周囲1マスを通行不可として扱うか
//   enemyGoal: 敵を見て間もないとき、探索の目標を敵の最後の位置にするか
//   bfsExplore: 探索に幅優先探索を使うか
const PROFILES = {
    p1: { pursuitRange: 8, pickupGate: false, peekAfterEnemy: false, enemyMargin: false, enemyGoal: false, bfsExplore: false },
    p2: { pursuitRange: 2, pickupGate: true, peekAfterEnemy: true, enemyMargin: true, enemyGoal: false, bfsExplore: true },
    p3: { pursuitRange: 2, pickupGate: true, peekAfterEnemy: true, enemyMargin: false, enemyGoal: true, bfsExplore: true },
};

function createStrategy(profileName) {
    const profile = PROFILES[profileName];
    if (!profile) {
        throw new Error('unknown strategy profile: ' + profileName);
    }

    let myX = 0;
    let myY = 0;
    let currentDir = LEFT;
    let turn = 0;
    const memory = new Map();
    const lastVisitTurn = new Map();
    let gateLookTurn = -999;
    let gateLookDir = null;
    let lastEnemyPos = null;
    let lastEnemyTurn = -999;
    let lastLookTurn = -999;

    let mapInfo = null;

    function remember(x, y, value) {
        // 敵は一時的な情報なので、床の記憶を上書きしない
        if (value !== ENEMY) {
            memory.set(key(x, y), value);
        }
    }

    function move(direction) {
        const [dx, dy] = ORTH_DELTA[direction];
        lastVisitTurn.set(key(myX + dx, myY + dy), turn);
        myX += dx;
        myY += dy;
        currentDir = direction;
        return { type: 'move', dir: DIR_NAME[direction] };
    }

    // 2マス先を中心とした3x3を look で観測し、結果を記憶に反映する
    function lookAction(direction, isGate) {
        const [dx, dy] = ORTH_DELTA[direction];
        const cx = myX + dx * 2;
        const cy = myY + dy * 2;
        if (!isGate) {
            lastLookTurn = turn;
        }
        return {
            type: 'look',
            dir: DIR_NAME[direction],
            onResult(readings) {
                readings.forEach((value, index) => {
                    const [ox, oy] = index === CENTER ? [0, 0] : NEIGHBOR_OFFSET[index];
                    remember(cx + ox, cy + oy, value);
                    if (value === ENEMY) {
                        lastEnemyPos = [cx + ox, cy + oy];
                        lastEnemyTurn = turn;
                    }
                });
            },
        };
    }

    // アイテムを取ると元の位置が壁になるため、両隣と先がすべて壁だと詰む。
    // "go" 取る / "skip" 見送る / "look" 先を確かめる
    function pickupVerdict(direction) {
        if (mapInfo[direction] !== ITEM) {
            return 'go';
        }
        const [dx, dy] = ORTH_DELTA[direction];
        const sideA = mapInfo[(dy + dx + 1) * 3 + (dx - dy + 1)];
        const sideB = mapInfo[(dy - dx + 1) * 3 + (dx + dy + 1)];
        if (sideA === BLOCK && sideB === BLOCK) {
            const beyond = memory.get(key(myX + dx * 2, myY + dy * 2));
            if (beyond === undefined) {
                // 直前に look しても見えなかったなら、敵がそこにいる
                if (gateLookTurn !== turn - 1 || gateLookDir !== direction) {
                    return 'look';
                }
            } else if (beyond === BLOCK) {
                return 'skip';
            }
        }
        return 'go';
    }

    function canEnter(direction) {
        if (mapInfo[direction] === BLOCK) {
            return false;
        }
        return !profile.pickupGate || mapInfo[direction] !== ITEM || pickupVerdict(direction) === 'go';
    }

    function stepToward(tx, ty) {
        const dx = tx - myX;
        const dy = ty - myY;
        let horizontalFirst;
        if (Math.abs(dx) > Math.abs(dy)) {
            horizontalFirst = true;
        } else if (Math.abs(dy) > Math.abs(dx)) {
            horizontalFirst = false;
        } else {
            horizontalFirst = currentDir === LEFT || currentDir === RIGHT;
        }
        const horizontal = dx > 0 ? RIGHT : dx < 0 ? LEFT : null;
        const vertical = dy > 0 ? DOWN : dy < 0 ? UP : null;
        const order = horizontalFirst ? [horizontal, vertical] : [vertical, horizontal];
        for (const direction of order) {
            if (direction !== null) {
                const cell = mapInfo[direction];
                if (cell === FLOOR || (cell === ITEM && (!profile.pickupGate || pickupVerdict(direction) === 'go'))) {
                    return move(direction);
                }
            }
        }
        return null;
    }

    // 記憶を地図に幅優先探索し、目標への最短経路の1歩目の方向を返す。
    // goal が null なら最も近い未探索マス、座標なら そのマスを目指す。
    function bfsFirstStep(goal, maxNodes = 600) {
        let enemyZone = null;
        if (profile.enemyMargin && lastEnemyPos !== null && turn - lastEnemyTurn <= 3) {
            enemyZone = lastEnemyPos;
        }
        const startKey = key(myX, myY);
        const firstDir = new Map([[startKey, null]]);
        const queue = [[myX, myY]];
        let head = 0;
        let found = null;
        while (found === null && head < queue.length && head < maxNodes) {
            const [cx, cy] = queue[head];
            head += 1;
            for (const direction of [UP, DOWN, LEFT, RIGHT]) {
                const [ddx, ddy] = ORTH_DELTA[direction];
                const nx = cx + ddx;
                const ny = cy + ddy;
                const nkey = key(nx, ny);
                if (!firstDir.has(nkey)) {
                    let stepDir = firstDir.get(key(cx, cy));
                    if (stepDir === null) {
                        stepDir = direction;
                    }
                    let cell = memory.get(nkey);
                    if (enemyZone !== null && Math.max(Math.abs(nx - enemyZone[0]), Math.abs(ny - enemyZone[1])) <= 1) {
                        cell = BLOCK;
                    }
                    if (cell === undefined) {
                        firstDir.set(nkey, stepDir);
                        if (found === null && goal === null) {
                            found = stepDir;
                        }
                    } else if (cell !== BLOCK) {
                        firstDir.set(nkey, stepDir);
                        queue.push([nx, ny]);
                        if (found === null && goal !== null && nx === goal[0] && ny === goal[1]) {
                            found = stepDir;
                        }
                    }
                }
            }
        }
        return found;
    }

    function attackAdjacentEnemy() {
        for (const direction of [UP, DOWN, RIGHT, LEFT]) {
            if (mapInfo[direction] === ENEMY) {
                return { type: 'attack', dir: DIR_NAME[direction] };
            }
        }
        return null;
    }

    function evadeDiagonalEnemy() {
        for (const [diagonal, escapes] of DIAGONAL_ESCAPES) {
            if (mapInfo[diagonal] === ENEMY) {
                for (const direction of escapes) {
                    const ok = canEnter(direction);
                    if (ok) {
                        return move(direction);
                    }
                }
            }
        }
        return null;
    }

    function grabVisibleItem() {
        for (const direction of [UP, DOWN, RIGHT, LEFT]) {
            if (mapInfo[direction] === ITEM) {
                const verdict = profile.pickupGate ? pickupVerdict(direction) : 'go';
                if (verdict === 'look') {
                    gateLookTurn = turn;
                    gateLookDir = direction;
                    return lookAction(direction, true);
                }
                if (verdict === 'go') {
                    return move(direction);
                }
            }
        }
        for (const [diagonal, approaches] of DIAGONAL_APPROACHES) {
            if (mapInfo[diagonal] === ITEM) {
                for (const direction of approaches) {
                    const ok = canEnter(direction);
                    if (ok) {
                        return move(direction);
                    }
                }
            }
        }
        return null;
    }

    function pursueRememberedItem() {
        let nearest = null;
        let nearestKey = null;
        for (const [k, value] of memory) {
            if (value === ITEM) {
                const [x, y] = k.split(',').map(Number);
                const manhattan = Math.abs(x - myX) + Math.abs(y - myY);
                if (manhattan <= profile.pursuitRange) {
                    const rank = [manhattan, Math.max(Math.abs(x - myX), Math.abs(y - myY)), y, x];
                    if (nearestKey === null || compareRank(rank, nearestKey) < 0) {
                        nearestKey = rank;
                        nearest = [x, y];
                    }
                }
            }
        }
        return nearest === null ? null : stepToward(nearest[0], nearest[1]);
    }

    function compareRank(a, b) {
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return a[i] - b[i];
            }
        }
        return 0;
    }

    function wander() {
        const legalMoves = [UP, DOWN, LEFT, RIGHT].filter((direction) => {
            return canEnter(direction) && currentDir !== OPPOSITE[direction];
        });
        if (legalMoves.length === 0) {
            const back = OPPOSITE[currentDir];
            if (mapInfo[back] !== BLOCK) {
                return move(back);
            }
            // 歩くと壁に入って負けるので、移動しない行動で1ターン消費する
            return { type: 'look', dir: DIR_NAME[currentDir] };
        }
        if (profile.bfsExplore) {
            const enemySeen = lastEnemyPos !== null && turn - lastEnemyTurn <= 3;
            const goal = profile.enemyGoal && enemySeen ? lastEnemyPos : null;
            const bfsDir = bfsFirstStep(goal);
            if (bfsDir !== null && legalMoves.includes(bfsDir)) {
                return move(bfsDir);
            }
        }
        const recentEnemy = lastEnemyPos !== null && turn - lastEnemyTurn <= 3;
        const rank = (direction) => {
            const [dx, dy] = ORTH_DELTA[direction];
            const nx = myX + dx;
            const ny = myY + dy;
            let combat = 0;
            if (profile.bfsExplore && recentEnemy) {
                combat = Math.max(Math.abs(nx - lastEnemyPos[0]), Math.abs(ny - lastEnemyPos[1]));
            }
            const visited = lastVisitTurn.has(key(nx, ny)) ? lastVisitTurn.get(key(nx, ny)) : -1;
            return [combat, visited];
        };
        let best = null;
        let bestMoves = [];
        for (const direction of legalMoves) {
            const r = rank(direction);
            const c = best === null ? -1 : compareRank(r, best);
            if (c < 0) {
                best = r;
                bestMoves = [direction];
            } else if (c === 0) {
                bestMoves.push(direction);
            }
        }
        return move(bestMoves[Math.floor(Math.random() * bestMoves.length)]);
    }

    // 周囲9マスを受け取り、行動 { type: 'move'|'attack'|'look', dir, onResult? } を返す
    function decide(map) {
        mapInfo = map;
        turn += 1;

        for (const index of Object.keys(NEIGHBOR_OFFSET)) {
            const [dx, dy] = NEIGHBOR_OFFSET[index];
            remember(myX + dx, myY + dy, map[index]);
            if (map[index] === ENEMY) {
                lastEnemyPos = [myX + dx, myY + dy];
                lastEnemyTurn = turn;
            }
        }

        const immediate = attackAdjacentEnemy() || evadeDiagonalEnemy() || grabVisibleItem() || pursueRememberedItem();
        if (immediate) {
            return immediate;
        }

        // 敵を見て間もないとき、進行方向を look して先の様子を確かめる
        if (profile.peekAfterEnemy && lastEnemyPos !== null && turn - lastEnemyTurn <= 4 && turn - lastLookTurn >= 3) {
            return lookAction(currentDir, false);
        }
        return wander();
    }

    return { decide };
}

const PROFILE_NAMES = Object.keys(PROFILES);

exports.createStrategy = createStrategy;
exports.PROFILE_NAMES = PROFILE_NAMES;
