const CONFIG = {
  tileSize: 40,
  viewport: { w: 15, h: 11 },
  town: { w: 24, h: 16 },
  floor: { w: 40, h: 28 },
  baseEnemyHp: 3,
  enemyAttack: 1,
  meleeDamage: 0, // uses player.atk
  specialCost: 1,
  specialRange: 4,
  reviveHp: 2,
  dangerRadius: 3,
  logLimit: 6,
};

const ASSETS = {
  floor: "assets/floor.png",
  wall: "assets/wall.png",
  player: "assets/player.png",
  enemy: "assets/enemy.png",
  item: "assets/item.png",
  heal: "assets/heal.png",
  stairs: "assets/stairs.png",
  train: "assets/train.png",
  rest: "assets/rest.png",
  gate: "assets/gate.png",
  board: "assets/board.png",
};

const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const gameState = {
  phase: "start", // start | town | playing | gameover
  assets: { images: {}, loaded: false },
  town: {
    level: 0,
    upgradedVisual: false,
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
    targetItemName: "コア",
    retrieved: false,
    accepted: false,
  },
  dungeon: null,
  dangerPreview: "-",
  logs: ["開始: 村で準備しよう。"],
};

const hudEl = document.querySelector("#hud");
const viewEl = document.querySelector("#view");
const controlsEl = document.querySelector("#controls");
const logEl = document.querySelector("#log");

function addLog(msg) {
  gameState.logs.unshift(msg);
  gameState.logs = gameState.logs.slice(0, CONFIG.logLimit);
}

function makePlaceholder(char, bg) {
  const canvas = document.createElement("canvas");
  canvas.width = CONFIG.tileSize;
  canvas.height = CONFIG.tileSize;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL();
}

function loadAssets() {
  const fallback = {
    floor: makePlaceholder("·", "#3a344e"),
    wall: makePlaceholder("■", "#100f16"),
    player: makePlaceholder("@", "#355f2f"),
    enemy: makePlaceholder("M", "#6a2f2f"),
    item: makePlaceholder("◆", "#635317"),
    heal: makePlaceholder("+", "#2f5f5f"),
    stairs: makePlaceholder("X", "#244863"),
    train: makePlaceholder("T", "#355f2f"),
    rest: makePlaceholder("R", "#2f5f5f"),
    gate: makePlaceholder("D", "#5a3d1f"),
    board: makePlaceholder("!", "#5e5a22"),
  };

  const keys = Object.keys(ASSETS);
  let remain = keys.length;

  keys.forEach((key) => {
    const img = new Image();
    img.onload = () => {
      gameState.assets.images[key] = img.src;
      remain -= 1;
      if (remain === 0) gameState.assets.loaded = true;
      render();
    };
    img.onerror = () => {
      gameState.assets.images[key] = fallback[key];
      remain -= 1;
      addLog(`画像不足: ${key} は代替表示を使用`);
      if (remain === 0) gameState.assets.loaded = true;
      render();
    };
    img.src = ASSETS[key];
  });
}

function createArea(width, height) {
  const tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => "wall"));
  return {
    width,
    height,
    tiles,
    objects: [],
    enemies: [],
    items: [],
    playerPos: { x: 1, y: 1 },
  };
}

function carveRoom(area, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) area.tiles[y][x] = "floor";
  }
}

function carveCorridor(area, a, b) {
  let x = a.x;
  let y = a.y;
  while (x !== b.x) {
    area.tiles[y][x] = "floor";
    x += Math.sign(b.x - x);
  }
  while (y !== b.y) {
    area.tiles[y][x] = "floor";
    y += Math.sign(b.y - y);
  }
  area.tiles[y][x] = "floor";
}

function nearestFloorTile(area, startX, startY) {
  if (tileAt(area, startX, startY) === "floor") return { x: startX, y: startY };
  for (let r = 1; r < Math.max(area.width, area.height); r++) {
    for (let y = startY - r; y <= startY + r; y++) {
      for (let x = startX - r; x <= startX + r; x++) {
        if (!inBounds(area, x, y)) continue;
        if (tileAt(area, x, y) === "floor") return { x, y };
      }
    }
  }
  return null;
}

function canSpawnEnemy(area, x, y) {
  if (tileAt(area, x, y) !== "floor") return false;
  if (enemyAt(area, x, y)) return false;
  if (objectAt(area, x, y)) return false;
  return true;
}

function spawnEnemySafe(area, x, y, hp) {
  const pos = nearestFloorTile(area, x, y);
  if (!pos) return;
  if (canSpawnEnemy(area, pos.x, pos.y)) {
    area.enemies.push({ x: pos.x, y: pos.y, hp });
    return;
  }
  for (let r = 1; r < 8; r++) {
    for (let yy = pos.y - r; yy <= pos.y + r; yy++) {
      for (let xx = pos.x - r; xx <= pos.x + r; xx++) {
        if (!inBounds(area, xx, yy)) continue;
        if (canSpawnEnemy(area, xx, yy)) {
          area.enemies.push({ x: xx, y: yy, hp });
          return;
        }
      }
    }
  }
}

function makeDungeonFloor() {
  const area = createArea(CONFIG.floor.w, CONFIG.floor.h);
  const rooms = [
    { x: 2, y: 2, w: 8, h: 6 },
    { x: 14, y: 3, w: 9, h: 7 },
    { x: 28, y: 2, w: 9, h: 6 },
    { x: 4, y: 13, w: 10, h: 8 },
    { x: 19, y: 14, w: 8, h: 8 },
    { x: 30, y: 16, w: 8, h: 7 },
  ];

  rooms.forEach((r) => carveRoom(area, r));

  const centers = rooms.map((r) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) }));
  for (let i = 0; i < centers.length - 1; i++) carveCorridor(area, centers[i], centers[i + 1]);
  carveCorridor(area, centers[1], centers[4]);

  area.playerPos = { x: centers[0].x, y: centers[0].y };
  area.objects.push({ type: "X", x: centers[0].x + 1, y: centers[0].y + 1 }); // extraction
  area.objects.push({ type: "I", x: centers[5].x, y: centers[5].y }); // mission item deep

  const healSpots = [centers[2], centers[3], centers[4]].map((c, i) => ({ type: "H", x: c.x + (i - 1), y: c.y }));
  area.items.push(...healSpots);

  const enemySpawns = [centers[1], centers[2], centers[3], centers[4], centers[5], { x: 25, y: 10 }];
  enemySpawns.forEach((s) => spawnEnemySafe(area, s.x, s.y, CONFIG.baseEnemyHp + gameState.town.level));

  for (let i = 0; i < gameState.town.level; i++) {
    const s = enemySpawns[i % enemySpawns.length];
    spawnEnemySafe(area, s.x + (i % 2), s.y + ((i + 1) % 2), CONFIG.baseEnemyHp + gameState.town.level);
  }

  return area;
}

function makeTownMap() {
  const area = createArea(CONFIG.town.w, CONFIG.town.h);
  for (let y = 1; y < area.height - 1; y++) {
    for (let x = 1; x < area.width - 1; x++) area.tiles[y][x] = "floor";
  }

  for (let x = 4; x < 20; x++) area.tiles[8][x] = "wall";
  area.tiles[8][11] = "floor";

  area.playerPos = { x: 17, y: 11 };
  area.objects.push({ type: "T", x: 3, y: 3 }); // training is distant
  area.objects.push({ type: "R", x: 16, y: 11 });
  area.objects.push({ type: "B", x: 18, y: 11 }); // quest board close to loop
  area.objects.push({ type: "D", x: 20, y: 11 }); // dungeon entrance close to loop
  return area;
}

function startTown() {
  gameState.phase = "town";
  if (!gameState.town.map) gameState.town.map = makeTownMap();
  gameState.town.map.playerPos = { x: 17, y: 11 };
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  updateHint();
}

function startRun() {
  if (!gameState.mission.accepted) {
    addLog("依頼板で任務を受けよう。");
    return;
  }
  gameState.phase = "playing";
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  gameState.player.reviveUsed = false;
  gameState.mission.retrieved = false;
  gameState.dungeon = { floor: makeDungeonFloor(), hint: "", turn: 1, unstable: false };
  updateDangerPreview();
  updateHint();
  addLog("ダンジョンへ向かう。コアを持って帰還しよう。");
}

function currentArea() {
  if (gameState.phase === "town") return gameState.town.map;
  if (gameState.phase === "playing") return gameState.dungeon.floor;
  return null;
}

function inBounds(area, x, y) {
  return x >= 0 && x < area.width && y >= 0 && y < area.height;
}

function tileAt(area, x, y) {
  if (!inBounds(area, x, y)) return "wall";
  return area.tiles[y][x];
}

function objectAt(area, x, y) {
  return area.objects.find((o) => o.x === x && o.y === y);
}

function itemAt(area, x, y) {
  return area.items.find((it) => it.x === x && it.y === y);
}

function enemyAt(area, x, y) {
  return area.enemies.find((e) => e.x === x && e.y === y && e.hp > 0);
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function applyInteraction(obj) {
  if (!obj) return;

  if (gameState.phase === "town") {
    if (obj.type === "T") {
      gameState.player.maxHp += 1;
      gameState.player.hp = gameState.player.maxHp;
      addLog("トレーニングした。");
    }
    if (obj.type === "R") {
      gameState.player.hp = gameState.player.maxHp;
      gameState.player.pp = gameState.player.maxPp;
      addLog("腹ごしらえして休んだ。");
    }
    if (obj.type === "D") startRun();
    if (obj.type === "B") {
      gameState.mission.accepted = true;
      addLog("依頼板で『コア回収』を受注した。");
    }
  }

  if (gameState.phase === "playing") {
    if (obj.type === "I" && !gameState.mission.retrieved) {
      gameState.mission.retrieved = true;
      gameState.dungeon.unstable = true;
      addLog("コアを回収した。足場が揺らぐ。");
    }
    if (obj.type === "X") {
      if (!gameState.mission.retrieved) addLog("まだコアを見つけていない。");
      else onWinRun();
    }
  }
}

function interactNearest() {
  const area = currentArea();
  if (!area) return;
  const p = area.playerPos;
  const obj = area.objects.find((o) => distance(o, p) <= 1);
  if (!obj) {
    addLog("近くに調べる対象がない。");
    return;
  }
  applyInteraction(obj);
  updateHint();
}

function pickupIfAny(area) {
  const p = area.playerPos;
  const idx = area.items.findIndex((it) => it.x === p.x && it.y === p.y);
  if (idx >= 0) {
    const it = area.items[idx];
    if (it.type === "H") {
      gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + 2);
      addLog("薬草でHPが回復した。");
    }
    area.items.splice(idx, 1);
  }
}

function moveActor(dx, dy) {
  const area = currentArea();
  if (!area) return;
  const p = area.playerPos;
  const nx = p.x + dx;
  const ny = p.y + dy;

  if (tileAt(area, nx, ny) === "wall") {
    addLog("壁で進めない。");
    return;
  }

  if (gameState.phase === "playing") {
    const enemy = enemyAt(area, nx, ny);
    if (enemy) {
      enemy.hp -= gameState.player.atk;
      addLog(`近接攻撃 ${gameState.player.atk}ダメージ`);
      if (enemy.hp <= 0) addLog("魔物を倒した。");
      endPlayerTurn();
      return;
    }
  }

  p.x = nx;
  p.y = ny;

  if (gameState.phase === "playing") {
    pickupIfAny(area);
    endPlayerTurn();
  }

  updateHint();
}

function useSpecial() {
  if (gameState.phase !== "playing") return;
  if (gameState.player.pp < CONFIG.specialCost) {
    addLog("PP不足。");
    return;
  }

  const area = currentArea();
  const p = area.playerPos;
  const target = area.enemies.filter((e) => e.hp > 0).sort((a, b) => distance(a, p) - distance(b, p))[0];
  if (!target || distance(target, p) > CONFIG.specialRange) {
    addLog("射程内に敵がいない。");
    return;
  }

  gameState.player.pp -= CONFIG.specialCost;
  target.hp -= gameState.player.atk + 1;
  addLog(`遠隔スキル ${gameState.player.atk + 1}ダメージ`);
  if (target.hp <= 0) addLog("魔物を倒した。");
  endPlayerTurn();
}

function enemyTurn() {
  const area = currentArea();
  if (!area) return;
  const p = area.playerPos;
  const active = area.enemies.filter((e) => e.hp > 0);
  area.enemies = active;

  area.enemies.forEach((enemy) => {
    if (distance(enemy, p) === 1) {
      gameState.player.hp -= CONFIG.enemyAttack;
      addLog(`魔物の攻撃で${CONFIG.enemyAttack}ダメージ`);
      return;
    }

    const candidates = [
      { x: enemy.x + Math.sign(p.x - enemy.x), y: enemy.y },
      { x: enemy.x, y: enemy.y + Math.sign(p.y - enemy.y) },
    ];
    const next = candidates.find(
      (c) => tileAt(area, c.x, c.y) !== "wall" && !enemyAt(area, c.x, c.y) && !(c.x === p.x && c.y === p.y)
    );
    if (next) {
      enemy.x = next.x;
      enemy.y = next.y;
    }

    if (distance(enemy, p) === 1) {
      gameState.player.hp -= CONFIG.enemyAttack;
      addLog(`魔物が接近攻撃: ${CONFIG.enemyAttack}ダメージ`);
    }
  });

  if (gameState.player.hp <= 0) {
    if (!gameState.player.reviveUsed) {
      gameState.player.reviveUsed = true;
      gameState.player.hp = CONFIG.reviveHp;
      addLog(`復活! HP${CONFIG.reviveHp}`);
      return;
    }
    gameState.phase = "gameover";
    addLog("力尽きた…。");
  }
}

function endPlayerTurn() {
  enemyTurn();
  if (gameState.phase === "playing") gameState.dungeon.turn += 1;
  updateDangerPreview();
  updateHint();
}

function updateDangerPreview() {
  if (gameState.phase !== "playing") {
    gameState.dangerPreview = "-";
    return;
  }
  const area = currentArea();
  const p = area.playerPos;
  const near = area.enemies.filter((e) => e.hp > 0 && distance(e, p) <= CONFIG.dangerRadius).length;
  gameState.dangerPreview = near ? `危険: ${near}体接近` : "安全";
}

function onWinRun() {
  gameState.town.level += 1;
  gameState.town.upgradedVisual = true;
  if (Math.random() < 0.5) gameState.player.maxHp += 1;
  else gameState.player.maxPp += 1;
  addLog("帰還成功。次は敵が少し増える。");
  startTown();
}

function updateHint() {
  const area = currentArea();
  if (!area) return;
  const p = area.playerPos;
  const nearbyObj = area.objects.find((o) => distance(o, p) <= 1);

  const hintMap = {
    T: "E: トレーニング",
    R: "E: 休んで回復",
    D: "E: ダンジョンへ向かう",
    B: "E: 依頼板を見る",
    I: "E: コア回収",
    X: "E: 帰還する",
  };

  const text = nearbyObj ? hintMap[nearbyObj.type] || "E: 調べる" : "";
  if (gameState.phase === "town") gameState.town.hint = text;
  if (gameState.phase === "playing") gameState.dungeon.hint = text;
}

function update(action, payload = {}) {
  if (action === "START_GAME") {
    gameState.town.map = makeTownMap();
    startTown();
    addLog("村に着いた。依頼板で任務を受けよう。");
  }

  if (action === "MOVE" && (gameState.phase === "town" || gameState.phase === "playing")) moveActor(payload.dx, payload.dy);
  if (action === "INTERACT" && (gameState.phase === "town" || gameState.phase === "playing")) interactNearest();
  if (action === "SPECIAL" && gameState.phase === "playing") useSpecial();

  if (action === "RESTART") {
    gameState.mission.retrieved = false;
    startTown();
    addLog("村へ戻った。準備して再挑戦しよう。");
  }

  render();
}

function cameraFor(area) {
  const p = area.playerPos;
  const halfW = Math.floor(CONFIG.viewport.w / 2);
  const halfH = Math.floor(CONFIG.viewport.h / 2);
  let x0 = p.x - halfW;
  let y0 = p.y - halfH;
  x0 = Math.max(0, Math.min(x0, area.width - CONFIG.viewport.w));
  y0 = Math.max(0, Math.min(y0, area.height - CONFIG.viewport.h));
  return { x0, y0, w: CONFIG.viewport.w, h: CONFIG.viewport.h };
}

function spriteForTile(type, symbol) {
  const map = {
    floor: "floor",
    wall: "wall",
    player: "player",
    enemy: "enemy",
    item: "item",
    heal: "heal",
    stairs: "stairs",
    train: "train",
    rest: "rest",
    gate: "gate",
    board: "board",
  };
  const key = map[type] || "floor";
  const src = gameState.assets.images[key] || "";
  return { src, symbol };
}

function tileVisual(area, x, y) {
  const p = area.playerPos;
  if (p.x === x && p.y === y) return { type: "player", symbol: "🦭" };

  const e = enemyAt(area, x, y);
  if (e) return { type: "enemy", symbol: "M" };

  const it = itemAt(area, x, y);
  if (it) {
    if (it.type === "H") return { type: "heal", symbol: "🌿" };
  }

  const obj = objectAt(area, x, y);
  if (obj) {
    if (obj.type === "I" && gameState.mission.retrieved) return { type: "floor", symbol: "·" };
    const map = { I: "item", X: "stairs", T: "train", R: "rest", D: "gate", B: "board" };
    const symbols = {
      I: "💎",
      X: "🚪",
      T: "🏋️",
      R: "🍖",
      D: "🕳️",
      B: "📜",
    };
    return { type: map[obj.type], symbol: symbols[obj.type] };
  }

  return tileAt(area, x, y) === "wall" ? { type: "wall", symbol: "■" } : { type: "floor", symbol: "·" };
}

function renderArea(area, title, hint) {
  const cam = cameraFor(area);
  let html = `<h2>${title}</h2><div class="grid" style="grid-template-columns: repeat(${cam.w}, ${CONFIG.tileSize}px)">`;

  for (let y = cam.y0; y < cam.y0 + cam.h; y++) {
    for (let x = cam.x0; x < cam.x0 + cam.w; x++) {
      const vis = tileVisual(area, x, y);
      const sprite = spriteForTile(vis.type, vis.symbol);
      html += `<div class="tile" style="background-image:url('${sprite.src}')"><span>${vis.symbol}</span></div>`;
    }
  }

  html += `</div><p class="meta">座標: (${area.playerPos.x},${area.playerPos.y}) / カメラ: (${cam.x0},${cam.y0})</p>`;
  html += `<p class="warn">${hint || "周囲を探索しよう"}</p>`;
  return html;
}

function renderHud() {
  hudEl.innerHTML = `
    <strong>Phase:</strong> ${gameState.phase}
    <br><strong>HP</strong> ${gameState.player.hp}/${gameState.player.maxHp}
    | <strong>ATK</strong> ${gameState.player.atk}
    | <strong>PP</strong> ${gameState.player.pp}/${gameState.player.maxPp}
    <br><strong>Mission:</strong> ${gameState.mission.targetItemName} 回収 ${gameState.mission.retrieved ? "✅" : "❌"}
    | 受注 ${gameState.mission.accepted ? "✅" : "❌"}
    <br><strong>Danger:</strong> ${gameState.dangerPreview}
  `;
}

function render() {
  renderHud();

  if (gameState.phase === "start") {
    viewEl.className = "";
    viewEl.innerHTML = `<h2>開始</h2><p>村で準備を整え、ダンジョンでコアを探そう。</p>`;
    controlsEl.innerHTML = `<div class='controls-row'><button data-action='START_GAME'>ゲーム開始</button></div>`;
  }

  if (gameState.phase === "town") {
    viewEl.className = gameState.town.upgradedVisual ? "town-upgraded" : "";
    viewEl.innerHTML = renderArea(gameState.town.map, "村", gameState.town.hint);
    controlsEl.innerHTML = `<div class='controls-row'><button data-action='INTERACT'>E: 調べる</button></div>`;
  }

  if (gameState.phase === "playing") {
    viewEl.className = gameState.dungeon.unstable ? "floor-unstable" : "";
    viewEl.innerHTML = renderArea(gameState.dungeon.floor, "ダンジョン", gameState.dungeon.hint);
    controlsEl.innerHTML = `
      <div class='controls-row'>
        <button data-action='INTERACT'>E: 調べる</button>
        <button data-action='SPECIAL'>遠隔スキル(PP1)</button>
      </div>
    `;
  }

  if (gameState.phase === "gameover") {
    viewEl.className = "";
    viewEl.innerHTML = `<h2>ゲームオーバー</h2><p>再挑戦しますか？</p>`;
    controlsEl.innerHTML = `<div class='controls-row'><button data-action='RESTART'>町へ戻る</button></div>`;
  }

  logEl.innerHTML = gameState.logs.map((l) => `<div>${l}</div>`).join("");
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

loadAssets();
render();
