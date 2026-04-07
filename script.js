const MAP = [
  "#######",
  "#P..E.#",
  "#..#..#",
  "#..I..#",
  "#.....#",
  "#..X..#",
  "#######",
];

const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const gameState = {
  phase: "start", // start | town | playing | gameover
  town: {
    level: 0,
    trainedToday: false,
    upgradedVisual: false,
    bonusApplied: false,
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
  logs: ["ようこそ。まずは町で準備しよう。"],
};

const hudEl = document.querySelector("#hud");
const viewEl = document.querySelector("#view");
const controlsEl = document.querySelector("#controls");
const logEl = document.querySelector("#log");

function addLog(message) {
  gameState.logs.unshift(message);
  gameState.logs = gameState.logs.slice(0, 4);
}

function parseMap(baseMap, extraEnemies) {
  const tiles = [];
  const enemies = [];
  let playerPos = { x: 1, y: 1 };
  let itemPos = null;
  let exitPos = null;

  baseMap.forEach((row, y) => {
    tiles[y] = [];
    row.split("").forEach((ch, x) => {
      if (ch === "#") tiles[y][x] = "wall";
      else tiles[y][x] = "floor";

      if (ch === "P") playerPos = { x, y };
      if (ch === "E") enemies.push({ x, y, hp: 3 + gameState.town.level });
      if (ch === "I") itemPos = { x, y };
      if (ch === "X") exitPos = { x, y };
    });
  });

  for (let i = 0; i < extraEnemies; i++) {
    const candidates = [
      { x: 4, y: 4 },
      { x: 2, y: 5 },
      { x: 5, y: 2 },
    ];
    const spot = candidates[i % candidates.length];
    enemies.push({ x: spot.x, y: spot.y, hp: 3 + gameState.town.level });
  }

  return { tiles, enemies, playerPos, itemPos, exitPos, width: 7, height: 7 };
}

function startRun() {
  gameState.phase = "playing";
  gameState.town.trainedToday = false;
  gameState.mission.retrieved = false;
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  gameState.player.reviveUsed = false;

  const extraEnemies = gameState.town.level;
  gameState.dungeon = {
    ...parseMap(MAP, extraEnemies),
    turn: 1,
  };
  updateDangerPreview();
  addLog("ダンジョンへ出発。目的は古代のコア回収！");
}

function inBounds(x, y) {
  return y >= 0 && y < gameState.dungeon.height && x >= 0 && x < gameState.dungeon.width;
}

function tileAt(x, y) {
  if (!inBounds(x, y)) return "wall";
  return gameState.dungeon.tiles[y][x];
}

function enemyAt(x, y) {
  return gameState.dungeon.enemies.find((e) => e.x === x && e.y === y && e.hp > 0);
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function updateDangerPreview() {
  if (gameState.phase !== "playing") {
    gameState.dangerPreview = "-";
    return;
  }
  const p = gameState.dungeon.playerPos;
  const near = gameState.dungeon.enemies.filter((e) => e.hp > 0 && distance(e, p) <= 2).length;
  gameState.dangerPreview = near === 0 ? "安全" : `危険: 近くに敵${near}体`;
}

function tryMove(dx, dy) {
  if (gameState.phase !== "playing") return;
  const p = gameState.dungeon.playerPos;
  const nx = p.x + dx;
  const ny = p.y + dy;
  if (tileAt(nx, ny) === "wall") {
    addLog("壁にぶつかった。");
    return;
  }

  const enemy = enemyAt(nx, ny);
  if (enemy) {
    enemy.hp -= gameState.player.atk;
    addLog(`近接攻撃！敵に${gameState.player.atk}ダメージ。`);
    if (enemy.hp <= 0) addLog("敵を倒した。");
    endPlayerTurn();
    return;
  }

  p.x = nx;
  p.y = ny;

  if (!gameState.mission.retrieved && nx === gameState.dungeon.itemPos.x && ny === gameState.dungeon.itemPos.y) {
    gameState.mission.retrieved = true;
    addLog("古代のコアを回収した！出口へ戻れ。");
  }

  if (nx === gameState.dungeon.exitPos.x && ny === gameState.dungeon.exitPos.y) {
    if (gameState.mission.retrieved) {
      onWinRun();
      return;
    }
    addLog("出口だが、まだ目的アイテムがない。");
  }

  endPlayerTurn();
}

function useSpecial() {
  if (gameState.phase !== "playing") return;
  if (gameState.player.pp <= 0) {
    addLog("PPが足りない。");
    return;
  }

  const p = gameState.dungeon.playerPos;
  const target = gameState.dungeon.enemies
    .filter((e) => e.hp > 0)
    .sort((a, b) => distance(a, p) - distance(b, p))[0];

  if (!target || distance(target, p) > 3) {
    addLog("射程内に敵がいない。");
    return;
  }

  gameState.player.pp -= 1;
  target.hp -= gameState.player.atk + 1;
  addLog(`遠隔スキル！敵に${gameState.player.atk + 1}ダメージ。`);
  if (target.hp <= 0) addLog("敵を撃破した。");
  endPlayerTurn();
}

function endPlayerTurn() {
  enemyTurn();
  updateDangerPreview();
  gameState.dungeon.turn += 1;
}

function enemyTurn() {
  const p = gameState.dungeon.playerPos;
  const aggression = 1 + Math.min(gameState.town.level, 1); // 成功後に少しだけ積極化

  gameState.dungeon.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    if (distance(enemy, p) === 1) {
      gameState.player.hp -= 1;
      addLog("敵の攻撃で1ダメージ。");
      return;
    }

    for (let step = 0; step < aggression; step++) {
      const options = [
        { x: enemy.x + Math.sign(p.x - enemy.x), y: enemy.y },
        { x: enemy.x, y: enemy.y + Math.sign(p.y - enemy.y) },
      ];

      const next = options.find(
        (o) => tileAt(o.x, o.y) !== "wall" && !enemyAt(o.x, o.y) && !(o.x === p.x && o.y === p.y)
      );
      if (next) {
        enemy.x = next.x;
        enemy.y = next.y;
      }
      if (distance(enemy, p) === 1) {
        gameState.player.hp -= 1;
        addLog("敵が接近して攻撃。1ダメージ。");
        break;
      }
    }
  });

  if (gameState.player.hp <= 0) {
    if (!gameState.player.reviveUsed) {
      gameState.player.reviveUsed = true;
      gameState.player.hp = 2;
      addLog("やられた…が、一度だけ復活！(HP2)");
      return;
    }
    gameState.phase = "gameover";
    addLog("力尽きた…。ゲームオーバー。");
  }
}

function onWinRun() {
  gameState.phase = "town";
  gameState.town.level += 1;

  if (!gameState.town.upgradedVisual) {
    gameState.town.upgradedVisual = true;
  }

  if (!gameState.town.bonusApplied) {
    gameState.town.bonusApplied = true;
    gameState.player.atk += 1;
    addLog("町が発展し、鍛冶屋の祝福で攻撃+1！");
  }

  if (Math.random() < 0.5) gameState.player.maxHp += 1;
  else gameState.player.maxPp += 1;

  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  addLog("帰還成功！次の遠征は敵が少し増える。 ");
}

function trainAtTown() {
  if (gameState.phase !== "town") return;
  if (gameState.town.trainedToday) {
    addLog("今日はもう訓練した。");
    return;
  }
  gameState.player.maxHp += 1;
  gameState.player.hp = gameState.player.maxHp;
  gameState.town.trainedToday = true;
  addLog("訓練完了。最大HP+1。");
}

function recoverAtTown() {
  if (gameState.phase !== "town") return;
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  addLog("休息してHP/PPを回復した。");
}

function update(action, payload = {}) {
  if (action === "START_GAME") {
    gameState.phase = "town";
    addLog("町に到着。準備してから出発しよう。");
  }

  if (action === "TOWN_TRAIN") trainAtTown();
  if (action === "TOWN_RECOVER") recoverAtTown();
  if (action === "START_RUN" && gameState.phase === "town") startRun();

  if (action === "MOVE") tryMove(payload.dx, payload.dy);
  if (action === "SPECIAL") useSpecial();

  if (action === "RESTART") {
    gameState.phase = "town";
    gameState.player.hp = gameState.player.maxHp;
    gameState.player.pp = gameState.player.maxPp;
    addLog("再挑戦。町からやり直し。");
  }

  render();
}

function renderHud() {
  hudEl.innerHTML = `
    <strong>Phase:</strong> ${gameState.phase}
    <br><strong>HP</strong> ${gameState.player.hp}/${gameState.player.maxHp}
    | <strong>ATK</strong> ${gameState.player.atk}
    | <strong>PP</strong> ${gameState.player.pp}/${gameState.player.maxPp}
    <br><strong>Mission:</strong> ${gameState.mission.targetItemName} 回収 ${
      gameState.mission.retrieved ? "✅" : "❌"
    }
    <br><strong>Danger Preview:</strong> ${gameState.dangerPreview}
  `;
}

function renderTown() {
  viewEl.className = gameState.town.upgradedVisual ? "town-upgraded" : "";
  viewEl.innerHTML = `
    <h2>町</h2>
    <p>準備してダンジョンに入ろう。</p>
    <p class="${gameState.town.upgradedVisual ? "ok" : ""}">
      町レベル: ${gameState.town.level}
      ${gameState.town.upgradedVisual ? "(見た目が少し発展した)" : ""}
    </p>
  `;
  controlsEl.innerHTML = `
    <div class="controls-row">
      <button data-action="TOWN_TRAIN">訓練(最大HP+1)</button>
      <button data-action="TOWN_RECOVER">休息(HP/PP全回復)</button>
      <button data-action="START_RUN">ダンジョンへ</button>
    </div>
  `;
}

function renderDungeon() {
  viewEl.className = "";
  const { width, height, playerPos, itemPos, exitPos, enemies } = gameState.dungeon;
  let html = `<h2>ダンジョン</h2><div class="grid">`;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let symbol = "·";
      const cls = ["tile", tileAt(x, y)];

      if (tileAt(x, y) === "wall") symbol = "■";
      if (x === exitPos.x && y === exitPos.y) {
        cls.push("exit");
        symbol = "⇧";
      }
      if (!gameState.mission.retrieved && x === itemPos.x && y === itemPos.y) {
        cls.push("item");
        symbol = "◆";
      }

      const e = enemies.find((enemy) => enemy.x === x && enemy.y === y && enemy.hp > 0);
      if (e) {
        cls.push("enemy");
        symbol = "M";
      }

      if (x === playerPos.x && y === playerPos.y) {
        cls.push("player");
        symbol = "@";
      }

      html += `<div class="${cls.join(" ")}">${symbol}</div>`;
    }
  }

  html += `</div><p class="warn">矢印キーで移動。敵に隣接して移動すると近接攻撃。</p>`;
  viewEl.innerHTML = html;

  controlsEl.innerHTML = `
    <div class="controls-row">
      <button data-action="SPECIAL">遠隔スキル(消費PP1)</button>
    </div>
  `;
}

function renderGameOver() {
  viewEl.className = "";
  viewEl.innerHTML = `<h2>ゲームオーバー</h2><p>古代のコアを持ち帰れなかった。</p>`;
  controlsEl.innerHTML = `<button data-action="RESTART">町へ戻る</button>`;
}

function renderStart() {
  viewEl.className = "";
  viewEl.innerHTML = `<h2>開始</h2><p>育成して潜り、コアを持ち帰れ。</p>`;
  controlsEl.innerHTML = `<button data-action="START_GAME">ゲーム開始</button>`;
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
  if (!DIRS[e.key]) return;
  if (gameState.phase !== "playing") return;
  e.preventDefault();
  update("MOVE", { dx: DIRS[e.key].x, dy: DIRS[e.key].y });
});

render();
