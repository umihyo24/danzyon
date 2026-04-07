const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const TOWN_MAP = [
  "#######",
  "#P..T.#",
  "#.....#",
  "#..R..#",
  "#.....#",
  "#..D..#",
  "#######",
];

const DUNGEON_ROOMS = [
  [
    "#######",
    "#P....#",
    "#..#..#",
    "#..E..#",
    "#.....#",
    "#..N..#",
    "#######",
  ],
  [
    "#######",
    "#..B..#",
    "#..#..#",
    "#..E..#",
    "#.....#",
    "#..N..#",
    "#######",
  ],
  [
    "#######",
    "#..B..#",
    "#..#..#",
    "#..E..#",
    "#..I..#",
    "#..X..#",
    "#######",
  ],
];

const gameState = {
  phase: "start", // start | town | playing | gameover
  town: {
    level: 0,
    upgradedVisual: false,
    bonusApplied: false,
    map: null,
    hint: "",
  },
  player: {
    maxHp: 8,
    hp: 8,
    atk: 2,
    maxPp: 3,
    pp: 3,
    reviveUsed: false,
  },
  mission: {
    targetItemName: "古代のコア",
    retrieved: false,
  },
  dungeon: null,
  dangerPreview: "-",
  logs: ["ようこそ。まずは町を歩いて準備しよう。"],
};

const hudEl = document.querySelector("#hud");
const viewEl = document.querySelector("#view");
const controlsEl = document.querySelector("#controls");
const logEl = document.querySelector("#log");

function addLog(message) {
  gameState.logs.unshift(message);
  gameState.logs = gameState.logs.slice(0, 5);
}

function parseMap(rows) {
  const tiles = [];
  const objects = [];
  const enemies = [];
  let playerPos = { x: 1, y: 1 };

  rows.forEach((row, y) => {
    tiles[y] = [];
    row.split("").forEach((ch, x) => {
      if (ch === "#") {
        tiles[y][x] = "wall";
      } else {
        tiles[y][x] = "floor";
      }

      if (ch === "P") playerPos = { x, y };
      if (["T", "R", "D", "N", "B", "X", "I"].includes(ch)) objects.push({ type: ch, x, y });
      if (ch === "E") enemies.push({ x, y, hp: 3 + gameState.town.level });
    });
  });

  return {
    width: rows[0].length,
    height: rows.length,
    tiles,
    objects,
    enemies,
    playerPos,
  };
}

function inBounds(area, x, y) {
  return y >= 0 && y < area.height && x >= 0 && x < area.width;
}

function tileAt(area, x, y) {
  if (!inBounds(area, x, y)) return "wall";
  return area.tiles[y][x];
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function objectAt(area, x, y) {
  return area.objects.find((o) => o.x === x && o.y === y);
}

function enemyAt(area, x, y) {
  return area.enemies?.find((e) => e.x === x && e.y === y && e.hp > 0);
}

function buildTown() {
  gameState.town.map = parseMap(TOWN_MAP);
}

function startRun() {
  gameState.phase = "playing";
  gameState.mission.retrieved = false;
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  gameState.player.reviveUsed = false;

  const rooms = DUNGEON_ROOMS.map((layout, idx) => {
    const room = parseMap(layout);
    const extraEnemies = gameState.town.level;
    for (let i = 0; i < extraEnemies; i++) {
      room.enemies.push({ x: 4 + (i % 2), y: 4 - (i % 2), hp: 3 + gameState.town.level });
    }
    room.index = idx;
    return room;
  });

  gameState.dungeon = {
    rooms,
    roomIndex: 0,
    hint: "",
    turn: 1,
  };

  updateDangerPreview();
  updateHint();
  addLog("ダンジョン突入。3部屋先のコアを回収して帰還せよ。");
}

function currentArea() {
  if (gameState.phase === "town") return gameState.town.map;
  if (gameState.phase === "playing") return gameState.dungeon.rooms[gameState.dungeon.roomIndex];
  return null;
}

function startTownPhase() {
  gameState.phase = "town";
  if (!gameState.town.map) buildTown();
  gameState.town.map.playerPos = { x: 1, y: 1 };
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  updateHint();
}

function transitionRoom(type) {
  if (type === "N" && gameState.dungeon.roomIndex < gameState.dungeon.rooms.length - 1) {
    gameState.dungeon.roomIndex += 1;
    gameState.dungeon.rooms[gameState.dungeon.roomIndex].playerPos = { x: 1, y: 1 };
    addLog(`次の部屋へ移動 (${gameState.dungeon.roomIndex + 1}/${gameState.dungeon.rooms.length})`);
  }

  if (type === "B" && gameState.dungeon.roomIndex > 0) {
    gameState.dungeon.roomIndex -= 1;
    gameState.dungeon.rooms[gameState.dungeon.roomIndex].playerPos = { x: 5, y: 5 };
    addLog(`前の部屋へ戻った (${gameState.dungeon.roomIndex + 1}/${gameState.dungeon.rooms.length})`);
  }

  updateDangerPreview();
}

function applyInteraction(targetObject) {
  if (!targetObject) return;

  if (gameState.phase === "town") {
    if (targetObject.type === "T") {
      gameState.player.maxHp += 1;
      gameState.player.hp = gameState.player.maxHp;
      addLog("訓練スポット: 最大HP+1");
    }
    if (targetObject.type === "R") {
      gameState.player.hp = gameState.player.maxHp;
      gameState.player.pp = gameState.player.maxPp;
      addLog("休息スポット: HP/PP全回復");
    }
    if (targetObject.type === "D") {
      startRun();
      return;
    }
  }

  if (gameState.phase === "playing") {
    if (targetObject.type === "I" && !gameState.mission.retrieved) {
      gameState.mission.retrieved = true;
      addLog("古代のコアを回収した！入口(X)へ戻れ。");
      return;
    }

    if (targetObject.type === "N" || targetObject.type === "B") {
      transitionRoom(targetObject.type);
      return;
    }

    if (targetObject.type === "X") {
      if (gameState.mission.retrieved) {
        onWinRun();
      } else {
        addLog("コア未回収。先に最終部屋で回収しよう。");
      }
      return;
    }
  }

  updateHint();
}

function moveActor(dx, dy) {
  const area = currentArea();
  if (!area) return;

  const p = area.playerPos;
  const nx = p.x + dx;
  const ny = p.y + dy;

  if (tileAt(area, nx, ny) === "wall") {
    addLog("壁だ。別ルートへ。");
    return false;
  }

  if (gameState.phase === "playing") {
    const enemy = enemyAt(area, nx, ny);
    if (enemy) {
      enemy.hp -= gameState.player.atk;
      addLog(`近接攻撃！${gameState.player.atk}ダメージ。`);
      if (enemy.hp <= 0) addLog("敵を倒した。");
      endPlayerTurn();
      return true;
    }
  }

  p.x = nx;
  p.y = ny;

  if (gameState.phase === "playing") {
    const stepObject = objectAt(area, nx, ny);
    if (stepObject && ["N", "B"].includes(stepObject.type)) {
      applyInteraction(stepObject);
      return true;
    }
    endPlayerTurn();
  }

  updateHint();
  return true;
}

function updateHint() {
  const area = currentArea();
  if (!area) return;
  const p = area.playerPos;

  const adjacent = area.objects.find((o) => distance(o, p) === 1 || (o.x === p.x && o.y === p.y));
  if (!adjacent) {
    if (gameState.phase === "town") gameState.town.hint = "";
    if (gameState.phase === "playing") gameState.dungeon.hint = "";
    return;
  }

  const messageMap = {
    T: "訓練スポット: Eで最大HP+1",
    R: "休息スポット: EでHP/PP回復",
    D: "ダンジョン入口: Eで出発",
    I: "目的アイテム: Eで回収",
    X: "帰還ポイント: Eで脱出",
    N: "通路: 踏むと次の部屋へ",
    B: "通路: 踏むと前の部屋へ",
  };

  if (gameState.phase === "town") gameState.town.hint = messageMap[adjacent.type] || "Eで調べる";
  if (gameState.phase === "playing") gameState.dungeon.hint = messageMap[adjacent.type] || "Eで調べる";
}

function interactNearest() {
  const area = currentArea();
  if (!area) return;
  const p = area.playerPos;
  const target = area.objects.find((o) => distance(o, p) === 1 || (o.x === p.x && o.y === p.y));
  if (!target) {
    addLog("近くに使えるものがない。");
    return;
  }
  applyInteraction(target);
}

function useSpecial() {
  if (gameState.phase !== "playing") return;
  if (gameState.player.pp <= 0) {
    addLog("PP不足。");
    return;
  }

  const room = currentArea();
  const p = room.playerPos;
  const target = room.enemies
    .filter((e) => e.hp > 0)
    .sort((a, b) => distance(a, p) - distance(b, p))[0];

  if (!target || distance(target, p) > 3) {
    addLog("射程内に敵がいない。");
    return;
  }

  gameState.player.pp -= 1;
  target.hp -= gameState.player.atk + 1;
  addLog(`遠隔スキルで${gameState.player.atk + 1}ダメージ。`);
  if (target.hp <= 0) addLog("敵を撃破。");
  endPlayerTurn();
}

function endPlayerTurn() {
  enemyTurn();
  updateDangerPreview();
  updateHint();
  gameState.dungeon.turn += 1;
}

function enemyTurn() {
  if (gameState.phase !== "playing") return;
  const room = currentArea();
  const p = room.playerPos;
  const aggression = 1 + Math.min(gameState.town.level, 1);

  room.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    if (distance(enemy, p) === 1) {
      gameState.player.hp -= 1;
      addLog("敵の攻撃で1ダメージ。");
      return;
    }

    for (let s = 0; s < aggression; s++) {
      const options = [
        { x: enemy.x + Math.sign(p.x - enemy.x), y: enemy.y },
        { x: enemy.x, y: enemy.y + Math.sign(p.y - enemy.y) },
      ];
      const next = options.find(
        (o) => tileAt(room, o.x, o.y) !== "wall" && !enemyAt(room, o.x, o.y) && !(o.x === p.x && o.y === p.y)
      );
      if (next) {
        enemy.x = next.x;
        enemy.y = next.y;
      }
      if (distance(enemy, p) === 1) {
        gameState.player.hp -= 1;
        addLog("敵が接近して1ダメージ。");
        break;
      }
    }
  });

  if (gameState.player.hp <= 0) {
    if (!gameState.player.reviveUsed) {
      gameState.player.reviveUsed = true;
      gameState.player.hp = 2;
      addLog("一度だけ復活！HP2で再起。");
      return;
    }
    gameState.phase = "gameover";
    addLog("力尽きた…。ゲームオーバー。");
  }
}

function updateDangerPreview() {
  if (gameState.phase !== "playing") {
    gameState.dangerPreview = "-";
    return;
  }

  const room = currentArea();
  const p = room.playerPos;
  const near = room.enemies.filter((e) => e.hp > 0 && distance(e, p) <= 2).length;
  gameState.dangerPreview = near ? `危険: 近くに敵${near}体` : "安全";
}

function onWinRun() {
  gameState.town.level += 1;
  if (!gameState.town.upgradedVisual) gameState.town.upgradedVisual = true;

  if (!gameState.town.bonusApplied) {
    gameState.town.bonusApplied = true;
    gameState.player.atk += 1;
    addLog("町の発展ボーナス: 攻撃+1");
  }

  if (Math.random() < 0.5) gameState.player.maxHp += 1;
  else gameState.player.maxPp += 1;

  addLog("帰還成功！次回は敵が少し増える。");
  startTownPhase();
}

function update(action, payload = {}) {
  if (action === "START_GAME") {
    buildTown();
    startTownPhase();
    addLog("町に到着。歩いて施設を使おう。Eで操作。");
  }

  if (action === "MOVE") {
    if (gameState.phase === "town" || gameState.phase === "playing") moveActor(payload.dx, payload.dy);
  }

  if (action === "INTERACT") {
    if (gameState.phase === "town" || gameState.phase === "playing") interactNearest();
  }

  if (action === "SPECIAL" && gameState.phase === "playing") useSpecial();

  if (action === "RESTART") {
    gameState.mission.retrieved = false;
    startTownPhase();
    addLog("町から再挑戦。");
  }

  render();
}

function tileVisual(area, x, y) {
  const p = area.playerPos;
  if (p.x === x && p.y === y) return { symbol: "@", className: "player" };

  const e = area.enemies?.find((enemy) => enemy.x === x && enemy.y === y && enemy.hp > 0);
  if (e) return { symbol: "M", className: "enemy" };

  const o = objectAt(area, x, y);
  if (!o) return { symbol: tileAt(area, x, y) === "wall" ? "■" : "·", className: "" };

  const visuals = {
    T: { symbol: "T", className: "train" },
    R: { symbol: "+", className: "rest" },
    D: { symbol: "D", className: "gate" },
    N: { symbol: ">", className: "exit" },
    B: { symbol: "<", className: "exit" },
    X: { symbol: "X", className: "exit" },
    I: { symbol: gameState.mission.retrieved ? "·" : "◆", className: "item" },
  };
  return visuals[o.type] || { symbol: "?", className: "" };
}

function renderGrid(area, title, extraText = "") {
  let html = `<h2>${title}</h2><div class="grid">`;

  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const base = tileAt(area, x, y);
      const vis = tileVisual(area, x, y);
      html += `<div class="tile ${base} ${vis.className}">${vis.symbol}</div>`;
    }
  }

  html += `</div>${extraText}`;
  return html;
}

function renderHud() {
  hudEl.innerHTML = `
    <strong>Phase:</strong> ${gameState.phase}
    <br><strong>HP</strong> ${gameState.player.hp}/${gameState.player.maxHp}
    | <strong>ATK</strong> ${gameState.player.atk}
    | <strong>PP</strong> ${gameState.player.pp}/${gameState.player.maxPp}
    <br><strong>Mission:</strong> ${gameState.mission.targetItemName} 回収 ${gameState.mission.retrieved ? "✅" : "❌"}
    <br><strong>Danger:</strong> ${gameState.dangerPreview}
  `;
}

function renderStart() {
  viewEl.className = "";
  viewEl.innerHTML = `<h2>開始</h2><p>町を歩いて準備し、3部屋ダンジョンでコアを回収して帰還せよ。</p>`;
  controlsEl.innerHTML = `<div class="controls-row"><button data-action="START_GAME">ゲーム開始</button></div>`;
}

function renderTown() {
  viewEl.className = gameState.town.upgradedVisual ? "town-upgraded" : "";
  viewEl.innerHTML = renderGrid(
    gameState.town.map,
    "町フィールド",
    `<p class="ok">町レベル: ${gameState.town.level}${gameState.town.upgradedVisual ? " (発展済み)" : ""}</p>
     <p class="warn">${gameState.town.hint || "施設の近くでE"}</p>`
  );

  controlsEl.innerHTML = `
    <div class="controls-row">
      <button data-action="INTERACT">E: 調べる</button>
    </div>
  `;
}

function renderDungeon() {
  const roomNo = gameState.dungeon.roomIndex + 1;
  const hint = gameState.dungeon.hint || "移動: 矢印 / 近くでE / 通路は踏むと移動";
  viewEl.className = "";
  viewEl.innerHTML = renderGrid(
    currentArea(),
    `ダンジョン ${roomNo}/${gameState.dungeon.rooms.length}`,
    `<p class="warn">${hint}</p>`
  );

  controlsEl.innerHTML = `
    <div class="controls-row">
      <button data-action="INTERACT">E: 調べる</button>
      <button data-action="SPECIAL">遠隔スキル(PP1)</button>
    </div>
  `;
}

function renderGameOver() {
  viewEl.className = "";
  viewEl.innerHTML = `<h2>ゲームオーバー</h2><p>再挑戦しよう。</p>`;
  controlsEl.innerHTML = `<div class="controls-row"><button data-action="RESTART">町へ戻る</button></div>`;
}

function renderLog() {
  logEl.innerHTML = gameState.logs.map((l) => `<div>${l}</div>`).join("");
}

function render() {
  renderHud();
  if (gameState.phase === "start") renderStart();
  if (gameState.phase === "town") renderTown();
  if (gameState.phase === "playing") renderDungeon();
  if (gameState.phase === "gameover") renderGameOver();
  renderLog();
}

controlsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  update(btn.dataset.action);
});

window.addEventListener("keydown", (e) => {
  if (DIRS[e.key] && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    update("MOVE", { dx: DIRS[e.key].x, dy: DIRS[e.key].y });
  }
  if ((e.key === "e" || e.key === "E") && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    update("INTERACT");
  }
});

render();
