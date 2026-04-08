const CONFIG = {
  tileSize: 54,
  viewport: { w: 9, h: 9 },
  town: { w: 24, h: 16 },
  floor: { w: 40, h: 28 },
  baseEnemyHp: 3,
  enemyAttack: 1,
  meleeDamage: 0, // uses player.atk
  specialCost: 1,
  specialRange: 4,
  reviveHp: 2,
  logLimit: 6,
  lungCapacity: 10,
  inventorySlots: 12,
  fishUpgradeBase: 8,
  levelUpHpGain: 1,
  levelUpAtkEvery: 3,
  expBaseNext: 5,
  autoTurnMs: 260,
  pressureEveryTurns: 8,
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

const ENEMY_TYPES = {
  penguin: { id: "penguin", name: "ペンギン", emoji: "🐧", maxHp: 2, attack: 1, behavior: "ranged", range: 5, exp: 2, swimmer: true },
  cheetah: { id: "cheetah", name: "チーター", emoji: "🐆", maxHp: 3, attack: 1, behavior: "fast", speed: 2, exp: 4 },
  elephant: { id: "elephant", name: "ゾウ", emoji: "🦣", maxHp: 6, attack: 1, behavior: "slow", actEvery: 2, exp: 6 },
  hippo: { id: "hippo", name: "カバ", emoji: "🦛", maxHp: 4, attack: 2, behavior: "heavy", exp: 5, swimmer: true },
};

const gameState = {
  phase: "start", // start | town | playing | gameover
  assets: { images: {}, loaded: false },
  ui: {
    messages: ["ようこそ。"],
    effects: [],
    hoverEnemy: null,
    statusOpen: false,
    lookMode: false,
    lookCursor: null,
    lastDeathReason: "",
  },
  town: {
    level: 0,
    upgradedVisual: false,
    map: null,
    hint: "",
    oxygenUpgradeLevel: 0,
  },
  player: {
    maxHp: 8,
    hp: 8,
    atk: 2,
    maxPp: 3,
    pp: 3,
    reviveUsed: false,
    facing: "right",
    inventory: [],
    maxOxygen: 100,
    oxygen: 100,
    breathSteps: 0,
    fishThisRun: 0,
    totalFish: 0,
    level: 1,
    exp: 0,
    nextExp: CONFIG.expBaseNext,
    equipment: [],
  },
  mission: {
    targetItemName: "魚",
    retrieved: false,
    accepted: false,
  },
  dungeon: null,
  auto: {
    enabled: false,
    style: "balanced", // aggressive | balanced | cautious
    timerId: null,
    stuckTurns: 0,
    targetKey: "",
    lastPos: null,
  },
};

const hudEl = document.querySelector("#hud");
const viewEl = document.querySelector("#view");
const controlsEl = document.querySelector("#controls");
const logEl = document.querySelector("#log");

function addLog(msg) {
  gameState.ui.messages.unshift(msg);
  gameState.ui.messages = gameState.ui.messages.slice(0, 2);
}

function setGameOver(message) {
  gameState.phase = "gameover";
  stopAutoLoop();
  gameState.auto.enabled = false;
  gameState.ui.messages = [message];
}

function ensureInventorySize() {
  while (gameState.player.inventory.length < CONFIG.inventorySlots) gameState.player.inventory.push(null);
}

function addProjectileEffect(fromX, fromY, toX, toY, emoji = "🧊") {
  gameState.ui.effects.push({
    id: Date.now() + Math.random(),
    kind: "projectile",
    fromX,
    fromY,
    toX,
    toY,
    emoji,
    expiresAt: Date.now() + 420,
  });
  setTimeout(() => {
    gameState.ui.effects = gameState.ui.effects.filter((e) => e.expiresAt > Date.now());
    render();
  }, 430);
}

function addDamageEffect(x, y, text) {
  gameState.ui.effects.push({
    id: Date.now() + Math.random(),
    kind: "damage",
    x,
    y,
    text,
    expiresAt: Date.now() + 550,
  });
  setTimeout(() => {
    gameState.ui.effects = gameState.ui.effects.filter((e) => e.expiresAt > Date.now());
    render();
  }, 560);
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
    floor: makePlaceholder("·", "#1d3f4b"),
    wall: makePlaceholder("■", "#0b1d28"),
    player: makePlaceholder("@", "#355f2f"),
    enemy: makePlaceholder("M", "#6a2f2f"),
    item: makePlaceholder("🐟", "#6b5d1f"),
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
  const defaultType = "hippo";
  return spawnEnemyOfType(area, x, y, defaultType, hp);
}

function spawnEnemyOfType(area, x, y, typeId, hpOverride = null) {
  const pos = nearestFloorTile(area, x, y);
  if (!pos) return;
  const type = ENEMY_TYPES[typeId] || ENEMY_TYPES.hippo;
  const hp = hpOverride ?? type.maxHp;
  if (canSpawnEnemy(area, pos.x, pos.y)) {
    area.enemies.push({ typeId: type.id, x: pos.x, y: pos.y, hp, facing: Math.random() < 0.5 ? -1 : 1, turnCounter: 0 });
    return;
  }
  for (let r = 1; r < 8; r++) {
    for (let yy = pos.y - r; yy <= pos.y + r; yy++) {
      for (let xx = pos.x - r; xx <= pos.x + r; xx++) {
        if (!inBounds(area, xx, yy)) continue;
        if (canSpawnEnemy(area, xx, yy)) {
          area.enemies.push({ typeId: type.id, x: xx, y: yy, hp, facing: Math.random() < 0.5 ? -1 : 1, turnCounter: 0 });
          return;
        }
      }
    }
  }
}

function makeDungeonFloor(depth = 1) {
  const area = createArea(CONFIG.floor.w, CONFIG.floor.h);
  const rooms = [
    { x: 2, y: 2, w: 8, h: 6 },
    { x: 13, y: 2, w: 12, h: 10 },
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
  area.startPos = { x: centers[0].x, y: centers[0].y };
  area.objects.push({ type: "X", x: centers[0].x + 1, y: centers[0].y + 1 }); // return point
  area.objects.push({ type: "V", x: centers[5].x, y: centers[5].y }); // vortex
  area.objects.push({ type: "C", x: centers[2].x + 1, y: centers[2].y - 1, opened: false }); // chest

  const healSpots = [centers[2], centers[3]].map((c, i) => ({ type: "H", x: c.x + (i - 1), y: c.y }));
  area.items.push(...healSpots);
  const fishSpots = [centers[1], centers[4], centers[5], { x: 24, y: 18 }].map((c, i) => ({
    type: i % 3 === 0 && depth > 1 ? "F_BIG" : "F_SMALL",
    x: c.x + (i % 2),
    y: c.y,
  }));
  area.items.push(...fishSpots);
  area.items.push({ type: "TENGU", x: centers[3].x - 2, y: centers[3].y + 1 });
  area.items.push({ type: "MIZU", x: centers[2].x - 1, y: centers[2].y + 2 });

  const enemySpawns = [
    { pos: centers[1], typeId: "penguin" },
    { pos: centers[2], typeId: "cheetah" },
    { pos: centers[3], typeId: "elephant" },
    { pos: centers[4], typeId: "hippo" },
    { pos: centers[5], typeId: "penguin" },
    { pos: { x: 25, y: 10 }, typeId: "cheetah" },
  ];
  enemySpawns.forEach((s) => spawnEnemyOfType(area, s.pos.x, s.pos.y, s.typeId, (ENEMY_TYPES[s.typeId].maxHp + depth - 1)));

  for (let i = 0; i < gameState.town.level; i++) {
    const s = enemySpawns[i % enemySpawns.length];
    spawnEnemyOfType(area, s.pos.x + (i % 2), s.pos.y + ((i + 1) % 2), s.typeId, (ENEMY_TYPES[s.typeId].maxHp + depth - 1));
  }

  area.rooms = rooms;
  decorateDungeonTiles(area, centers);

  return area;
}

function hasRouteToStairs(area) {
  const start = area.startPos || area.playerPos;
  const goal = area.objects.find((o) => o.type === "V");
  if (!start || !goal) return true;
  const seen = new Set([tileKey(start.x, start.y)]);
  const q = [{ x: start.x, y: start.y }];
  while (q.length) {
    const cur = q.shift();
    if (cur.x === goal.x && cur.y === goal.y) return true;
    for (const d of Object.values(DIRS)) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const key = tileKey(nx, ny);
      if (seen.has(key)) continue;
      const tile = tileAt(area, nx, ny);
      if (tile === "wall" || tile === "hole" || tile === "water") continue;
      seen.add(key);
      q.push({ x: nx, y: ny });
    }
  }
  return false;
}

function decorateDungeonTiles(area, centers) {
  const poisonSpots = [
    { x: centers[1].x - 1, y: centers[1].y + 1 },
    { x: centers[4].x + 1, y: centers[4].y - 1 },
  ];
  poisonSpots.forEach((p) => {
    if (tileAt(area, p.x, p.y) === "floor" && !objectAt(area, p.x, p.y)) area.tiles[p.y][p.x] = "poison";
  });
  const waterSpots = [
    { x: centers[2].x, y: centers[2].y + 1 },
    { x: centers[3].x + 1, y: centers[3].y },
  ];
  waterSpots.forEach((p) => {
    if (tileAt(area, p.x, p.y) === "floor" && !objectAt(area, p.x, p.y)) area.tiles[p.y][p.x] = "water";
  });

  const terrainChains = [
    { type: "hole", points: [{ x: 6, y: 16 }, { x: 7, y: 16 }, { x: 8, y: 16 }, { x: 8, y: 17 }] },
    { type: "hole", points: [{ x: 22, y: 19 }, { x: 23, y: 19 }, { x: 24, y: 19 }] },
    { type: "water", points: [{ x: 15, y: 6 }, { x: 16, y: 6 }, { x: 17, y: 6 }, { x: 17, y: 7 }] },
    { type: "water", points: [{ x: 33, y: 19 }, { x: 34, y: 19 }, { x: 35, y: 19 }, { x: 35, y: 20 }] },
  ];
  terrainChains.forEach((chain) => {
    chain.points.forEach((p) => {
      if (!inBounds(area, p.x, p.y)) return;
      if (tileAt(area, p.x, p.y) !== "floor") return;
      if (objectAt(area, p.x, p.y)) return;
      const isStart = area.startPos && area.startPos.x === p.x && area.startPos.y === p.y;
      if (isStart) return;
      area.tiles[p.y][p.x] = chain.type;
      if (!hasRouteToStairs(area)) area.tiles[p.y][p.x] = "floor";
    });
  });
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
  stopAutoLoop();
  resetLookMode();
  gameState.auto.enabled = false;
  gameState.auto.stuckTurns = 0;
  gameState.auto.targetKey = "";
  gameState.auto.lastPos = null;
  gameState.phase = "town";
  ensureInventorySize();
  if (!gameState.town.map) gameState.town.map = makeTownMap();
  gameState.town.map.playerPos = { x: 17, y: 11 };
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  gameState.player.facing = "down";
  gameState.ui.lastDeathReason = "";
  gameState.ui.statusOpen = false;
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
  gameState.player.oxygen = gameState.player.maxOxygen;
  gameState.player.breathSteps = 0;
  gameState.player.fishThisRun = 0;
  gameState.player.reviveUsed = false;
  gameState.mission.retrieved = false;
  gameState.dungeon = {
    floor: makeDungeonFloor(1),
    hint: "",
    turn: 1,
    unstable: false,
    depth: 1,
    discovered: {},
    visible: {},
    lastPressureTurn: 0,
    visitedRooms: {},
  };
  gameState.player.facing = "down";
  gameState.ui.statusOpen = false;
  gameState.ui.lastDeathReason = "";
  resetLookMode();
  updateFov();
  updateHint();
  addLog("潜水開始。魚を集めて帰還しよう。");
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

function getEnemyType(enemy) {
  return ENEMY_TYPES[enemy.typeId] || ENEMY_TYPES.hippo;
}

function isEquipItemType(type) {
  return type === "TENGU" || type === "MIZU";
}

function isEquipped(type) {
  return gameState.player.equipment.includes(type);
}

function playerCanTraverse(tile) {
  if (tile === "hole") return isEquipped("TENGU");
  if (tile === "water") return isEquipped("TENGU") || isEquipped("MIZU");
  return true;
}

function enemyCanTraverse(type, tile) {
  if (tile === "hole") return !!type.flying;
  if (tile === "water") return !!type.flying || !!type.swimmer;
  return true;
}

function enemyBehaviorText(typeId) {
  const texts = {
    penguin: "低HP・直線氷弾",
    cheetah: "高速2歩移動",
    elephant: "遅いが硬い",
    hippo: "一撃が重い",
  };
  return texts[typeId] || "";
}

function getNaturalRecoveryAmount(level) {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}

function gainExp(amount) {
  if (amount <= 0) return;
  gameState.player.exp += amount;
  checkLevelUp();
}

function checkLevelUp() {
  while (gameState.player.exp >= gameState.player.nextExp) {
    gameState.player.exp -= gameState.player.nextExp;
    gameState.player.level += 1;
    gameState.player.maxHp += CONFIG.levelUpHpGain;
    if (gameState.player.level % CONFIG.levelUpAtkEvery === 0) gameState.player.atk += 1;
    gameState.player.hp = gameState.player.maxHp;
    gameState.player.nextExp = Math.floor(gameState.player.nextExp * 1.5) + 2;
    addLog("レベルが上がった！");
    addLog("最大HPが上がった！");
  }
}

function startAutoLoop() {
  stopAutoLoop();
  gameState.auto.timerId = setInterval(() => {
    performAutoTurn();
  }, CONFIG.autoTurnMs);
}

function stopAutoLoop() {
  if (gameState.auto.timerId) clearInterval(gameState.auto.timerId);
  gameState.auto.timerId = null;
}

function toggleAutoMode(nextEnabled = null, reason = "") {
  const next = nextEnabled === null ? !gameState.auto.enabled : !!nextEnabled;
  if (next === gameState.auto.enabled) return;
  gameState.auto.enabled = next;
  if (next) {
    gameState.auto.stuckTurns = 0;
    gameState.auto.targetKey = "";
    gameState.auto.lastPos = null;
    startAutoLoop();
    addLog("AUTO開始");
  } else {
    stopAutoLoop();
    gameState.auto.stuckTurns = 0;
    gameState.auto.targetKey = "";
    gameState.auto.lastPos = null;
    addLog(reason || "AUTOを解除した");
  }
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
      addLog("依頼板で『魚獲り』を受注した。");
    }
  }

  if (gameState.phase === "playing") {
    if (obj.type === "X") {
      onReturnRun();
    }
    if (obj.type === "V") {
      descendDepth();
    }
    if (obj.type === "C" && !obj.opened) {
      obj.opened = true;
      const rewardRoll = Math.random();
      if (rewardRoll < 0.4) {
        gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + 3);
        addLog("宝箱から回復薬。HPが3回復した。");
      } else if (rewardRoll < 0.75) {
        gameState.player.pp = Math.min(gameState.player.maxPp, gameState.player.pp + 1);
        addLog("宝箱から集中薬。PPが1回復した。");
      } else {
        gameState.player.fishThisRun += 1;
        gameState.mission.retrieved = true;
        addLog("宝箱から魚を見つけた。");
      }
      endPlayerTurn("interact");
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
    if (it.type === "F_SMALL" || it.type === "F_BIG") {
      gameState.player.fishThisRun += it.type === "F_BIG" ? 2 : 1;
      gameState.mission.retrieved = true;
      area.items.splice(idx, 1);
      addLog("魚を捕まえた");
      return;
    }
    const emptyIdx = gameState.player.inventory.findIndex((s) => s === null);
    if (emptyIdx === -1) {
      addLog("持ち物がいっぱいだ。");
      return;
    }
    const itemDefs = {
      H: { emoji: "🌿", name: "薬草" },
      TENGU: { emoji: "💪", name: "テングのチカラ" },
      MIZU: { emoji: "💪", name: "みずぐものちから" },
    };
    const def = itemDefs[it.type] || { emoji: "❔", name: it.type };
    gameState.player.inventory[emptyIdx] = { type: it.type, emoji: def.emoji, name: def.name };
    reorderInventoryByEquipment();
    area.items.splice(idx, 1);
    addLog("アイテムを拾った。");
  }
}

function tileEffectOnStep(area) {
  const p = area.playerPos;
  const t = tileAt(area, p.x, p.y);
  if (t === "poison") {
    gameState.player.hp = Math.max(1, gameState.player.hp - 1);
    addLog("毒の床でHPが1減った。");
    addDamageEffect(p.x, p.y, "-1");
  }
  if (t === "water") {
    gameState.player.breathSteps += 8;
    addLog("水流に足を取られ、酸素消費が増えた。");
  }
}

function updateFacing(dx, dy) {
  if (dx === 0 && dy === 0) return;
  if (dx === 1) gameState.player.facing = "right";
  if (dx === -1) gameState.player.facing = "left";
  if (dy === 1) gameState.player.facing = "down";
  if (dy === -1) gameState.player.facing = "up";
}

function facingToVector() {
  const map = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  return map[gameState.player.facing] || map.right;
}

function useInventoryItem(index, consumeTurn = true) {
  const item = gameState.player.inventory[index];
  if (!item) {
    addLog("アイテムがない。");
    render();
    return;
  }
  if (isEquipItemType(item.type)) {
    if (isEquipped(item.type)) {
      gameState.player.equipment = gameState.player.equipment.filter((t) => t !== item.type);
      addLog(`${item.name}の装備を外した。`);
    } else {
      if (gameState.player.equipment.length >= 2) {
        addLog("装備は2つまで。");
        render();
        return;
      }
      gameState.player.equipment.push(item.type);
      addLog(`${item.name}を装備した。`);
    }
    reorderInventoryByEquipment();
    render();
    return;
  }

  if (item.type === "H") {
    gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + 2);
    addLog("薬草を使って回復した。");
  }
  gameState.player.inventory[index] = null;
  if (consumeTurn && gameState.phase === "playing") endPlayerTurn("item");
  reorderInventoryByEquipment();
  render();
}

function reorderInventoryByEquipment() {
  const equippedSlots = [];
  const others = [];
  gameState.player.equipment.forEach((type) => {
    const slot = gameState.player.inventory.find((it) => it && it.type === type);
    if (slot) equippedSlots.push(slot);
  });
  gameState.player.inventory.forEach((slot) => {
    if (!slot) return;
    if (gameState.player.equipment.includes(slot.type)) return;
    others.push(slot);
  });
  const next = [...equippedSlots, ...others];
  while (next.length < CONFIG.inventorySlots) next.push(null);
  gameState.player.inventory = next.slice(0, CONFIG.inventorySlots);
}

function tryMovePlayer(dx, dy) {
  const area = currentArea();
  if (!area) return false;
  if (gameState.phase === "playing" && gameState.ui.lookMode) resetLookMode();
  const p = area.playerPos;
  const nx = p.x + dx;
  const ny = p.y + dy;
  updateFacing(dx, dy);

  const targetTile = tileAt(area, nx, ny);
  if (targetTile === "wall") {
    addLog("壁で進めない。");
    return false;
  }
  if (!playerCanTraverse(targetTile)) {
    addLog(targetTile === "hole" ? "穴を越えられない。" : "水に入れない。");
    return false;
  }

  if (gameState.phase === "playing") {
    const enemy = enemyAt(area, nx, ny);
    if (enemy) {
      addLog("そこには敵がいる");
      return false;
    }
  }

  p.x = nx;
  p.y = ny;

  if (gameState.phase === "playing") {
    onEnterRoom(area, nx, ny);
    const stepObj = objectAt(area, nx, ny);
    if (stepObj?.type === "V") {
      descendDepth();
      return true;
    }
    if (stepObj?.type === "X" && gameState.mission.retrieved) {
      onReturnRun();
      return true;
    }
    pickupIfAny(area);
    tileEffectOnStep(area);
    endPlayerTurn("move");
  }

  updateHint();
  return true;
}

function performWhiffAttack() {
  addLog("素振りした。");
  endPlayerTurn("whiff");
}

function performPlayerAttack(dx, dy) {
  const area = currentArea();
  if (!area || gameState.phase !== "playing") return;
  updateFacing(dx, dy);
  const p = area.playerPos;
  const tx = p.x + dx;
  const ty = p.y + dy;
  const enemy = enemyAt(area, tx, ty);
  if (!enemy) {
    performWhiffAttack();
    return;
  }
  const enemyName = getEnemyType(enemy).name;
  enemy.hp -= gameState.player.atk;
  addDamageEffect(enemy.x, enemy.y, `-${gameState.player.atk}`);
  addLog(`${enemyName}に${gameState.player.atk}ダメージ`);
  if (enemy.hp <= 0) {
    addLog(`${enemyName}を倒した。`);
    gainExp(getEnemyType(enemy).exp || 0);
  }
  endPlayerTurn("hit");
}

function performForwardAttack() {
  const forward = facingToVector();
  performPlayerAttack(forward.x, forward.y);
}

function performWait() {
  if (gameState.phase !== "playing") return;
  addLog("その場で息を整えた。");
  endPlayerTurn("wait");
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

  const enemyName = getEnemyType(target).name;
  gameState.player.pp -= CONFIG.specialCost;
  target.hp -= gameState.player.atk + 1;
  addDamageEffect(target.x, target.y, `-${gameState.player.atk + 1}`);
  addLog(`${enemyName}に${gameState.player.atk + 1}ダメージ`);
  if (target.hp <= 0) {
    addLog(`${enemyName}を倒した。`);
    gainExp(getEnemyType(target).exp || 0);
  }
  endPlayerTurn("special");
}

function enemyTurn() {
  const area = currentArea();
  if (!area) return;
  const p = area.playerPos;
  const active = area.enemies.filter((e) => e.hp > 0);
  area.enemies = active;

  area.enemies.forEach((enemy) => performEnemyTurn(enemy, area, p));

  if (gameState.player.hp <= 0) {
    if (!gameState.player.reviveUsed) {
      gameState.player.reviveUsed = true;
      gameState.player.hp = CONFIG.reviveHp;
      addLog(`復活! HP${CONFIG.reviveHp}`);
      return;
    }
    const reason = gameState.ui.lastDeathReason || "力尽きた…。";
    setGameOver(reason);
  }
}

function applyEnemyAttack(enemy, damage, text = null) {
  gameState.player.hp -= damage;
  const combatText = text || `${getEnemyType(enemy).name}の攻撃で${damage}ダメージ`;
  addLog(combatText);
  const cause = combatText.replace(/で\d+ダメージ.*/, "");
  gameState.ui.lastDeathReason = `${cause}で倒れた。`;
}

function moveEnemyTowardPlayer(enemy, area, playerPos) {
  const options = [
    { x: enemy.x + Math.sign(playerPos.x - enemy.x), y: enemy.y },
    { x: enemy.x, y: enemy.y + Math.sign(playerPos.y - enemy.y) },
  ];
  const next = options.find(
    (c) =>
      tileAt(area, c.x, c.y) !== "wall" &&
      enemyCanTraverse(getEnemyType(enemy), tileAt(area, c.x, c.y)) &&
      !enemyAt(area, c.x, c.y) &&
      !(c.x === playerPos.x && c.y === playerPos.y)
  );
  if (!next) return false;
  if (next.x !== enemy.x) enemy.facing = next.x < enemy.x ? -1 : 1;
  enemy.x = next.x;
  enemy.y = next.y;
  return true;
}

function isStraightLineWithin(enemy, playerPos, range) {
  return (enemy.x === playerPos.x || enemy.y === playerPos.y) && distance(enemy, playerPos) <= range;
}

function isLineBlockedByWall(area, enemy, playerPos) {
  if (enemy.x === playerPos.x) {
    const minY = Math.min(enemy.y, playerPos.y);
    const maxY = Math.max(enemy.y, playerPos.y);
    for (let y = minY + 1; y < maxY; y++) {
      if (tileAt(area, enemy.x, y) === "wall") return true;
      const blocker = enemyAt(area, enemy.x, y);
      if (blocker && blocker !== enemy) return true;
    }
  }
  if (enemy.y === playerPos.y) {
    const minX = Math.min(enemy.x, playerPos.x);
    const maxX = Math.max(enemy.x, playerPos.x);
    for (let x = minX + 1; x < maxX; x++) {
      if (tileAt(area, x, enemy.y) === "wall") return true;
      const blocker = enemyAt(area, x, enemy.y);
      if (blocker && blocker !== enemy) return true;
    }
  }
  return false;
}

function canUsePenguinRanged(enemy, area, playerPos) {
  const type = getEnemyType(enemy);
  if (type.id !== "penguin") return false;
  if (roomIndexAt(area, enemy.x, enemy.y) < 0) return false;
  if (!isStraightLineWithin(enemy, playerPos, type.range)) return false;
  return !isLineBlockedByWall(area, enemy, playerPos);
}

function canAttackNow(enemy, playerPos) {
  return distance(enemy, playerPos) === 1;
}

function performStandardMeleeTurn(enemy, area, playerPos) {
  if (canAttackNow(enemy, playerPos)) {
    applyEnemyAttack(enemy, getEnemyType(enemy).attack);
    return;
  }
  moveEnemyTowardPlayer(enemy, area, playerPos);
}

function performRangedTurn(enemy, area, playerPos) {
  const type = getEnemyType(enemy);
  if (canUsePenguinRanged(enemy, area, playerPos)) {
    addProjectileEffect(enemy.x, enemy.y, playerPos.x, playerPos.y, "🧊");
    applyEnemyAttack(enemy, type.attack, `${type.name}の氷つぶてで${type.attack}ダメージ`);
    return;
  }
  if (canAttackNow(enemy, playerPos)) {
    applyEnemyAttack(enemy, type.attack, `${type.name}の近接攻撃で${type.attack}ダメージ`);
    return;
  }
  moveEnemyTowardPlayer(enemy, area, playerPos);
}

function performFastTurn(enemy, area, playerPos) {
  const type = getEnemyType(enemy);
  if (canAttackNow(enemy, playerPos)) {
    applyEnemyAttack(enemy, type.attack);
    return;
  }
  moveEnemyTowardPlayer(enemy, area, playerPos);
  if (canAttackNow(enemy, playerPos)) {
    applyEnemyAttack(enemy, type.attack, `${type.name}の素早い一撃で${type.attack}ダメージ`);
    return;
  }
  moveEnemyTowardPlayer(enemy, area, playerPos);
  if (canAttackNow(enemy, playerPos)) applyEnemyAttack(enemy, type.attack, `${type.name}の一撃で${type.attack}ダメージ`);
}

function performEnemyTurn(enemy, area, playerPos) {
  const type = getEnemyType(enemy);
  enemy.turnCounter = (enemy.turnCounter || 0) + 1;

  if (type.behavior === "slow" && enemy.turnCounter % type.actEvery !== 0) return;

  if (type.behavior === "ranged") return performRangedTurn(enemy, area, playerPos);
  if (type.behavior === "fast") return performFastTurn(enemy, area, playerPos);
  return performStandardMeleeTurn(enemy, area, playerPos);
}

function applyNaturalRecovery(actionType) {
  if (gameState.phase !== "playing") return;
  let heal = 0;
  if (actionType === "move" || actionType === "wait" || actionType === "whiff") {
    heal = getNaturalRecoveryAmount(gameState.player.level);
  }
  if (heal > 0) gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + heal);
}

function endPlayerTurn(actionType = "") {
  consumeOxygen();
  if (gameState.phase !== "playing") return;
  applyNaturalRecovery(actionType);
  enemyTurn();
  if (gameState.phase === "playing") {
    gameState.dungeon.turn += 1;
    applyEnemyPressure();
    updateFov();
  }
  updateHint();
}

function applyEnemyPressure() {
  if (gameState.phase !== "playing") return;
  const nowTurn = gameState.dungeon.turn;
  if (nowTurn - gameState.dungeon.lastPressureTurn < CONFIG.pressureEveryTurns) return;
  const area = currentArea();
  const p = area.playerPos;
  const spawnCandidates = [];
  for (let y = 1; y < area.height - 1; y++) {
    for (let x = 1; x < area.width - 1; x++) {
      if (!canSpawnEnemy(area, x, y)) continue;
      if (distance({ x, y }, p) < 6) continue;
      spawnCandidates.push({ x, y });
    }
  }
  if (!spawnCandidates.length) return;
  const spot = spawnCandidates[Math.floor(Math.random() * spawnCandidates.length)];
  const types = ["penguin", "cheetah", "hippo"];
  const typeId = types[Math.floor(Math.random() * types.length)];
  spawnEnemyOfType(area, spot.x, spot.y, typeId, ENEMY_TYPES[typeId].maxHp + Math.max(0, gameState.dungeon.depth - 1));
  gameState.dungeon.lastPressureTurn = nowTurn;
  addLog("奥で敵の気配が増した…。");
}

function consumeOxygen() {
  if (gameState.phase !== "playing") return;
  const stepGain = 1 + Math.max(0, gameState.dungeon.depth - 1);
  gameState.player.breathSteps += stepGain;
  while (gameState.player.breathSteps >= CONFIG.lungCapacity) {
    gameState.player.breathSteps -= CONFIG.lungCapacity;
    gameState.player.oxygen = Math.max(0, gameState.player.oxygen - 1);
  }
  if (gameState.player.oxygen <= 0) {
    const p = currentArea().playerPos;
    gameState.player.hp -= 1;
    addDamageEffect(p.x, p.y, "-1");
    addLog("酸素欠乏でHPが1減った。");
    if (gameState.player.hp <= 0) {
      gameState.ui.lastDeathReason = "酸素が尽きて倒れた。";
      setGameOver(gameState.ui.lastDeathReason);
    }
  } else if (gameState.player.oxygen <= Math.floor(gameState.player.maxOxygen * 0.25)) {
    addLog("酸素が減っている");
  }
}

function onReturnRun() {
  gameState.town.level += 1;
  gameState.town.upgradedVisual = true;
  if (Math.random() < 0.5) gameState.player.maxHp += 1;
  else gameState.player.maxPp += 1;
  gameState.player.totalFish += gameState.player.fishThisRun;
  const nextReq = CONFIG.fishUpgradeBase * (gameState.town.oxygenUpgradeLevel + 1);
  if (gameState.player.totalFish >= nextReq) {
    gameState.town.oxygenUpgradeLevel += 1;
    gameState.player.maxOxygen += 5;
    gameState.player.oxygen = gameState.player.maxOxygen;
    addLog("村の酸素タンクが強化された。");
  }
  addLog(`帰還成功。魚を${gameState.player.fishThisRun}匹持ち帰った。`);
  startTown();
}

function descendDepth() {
  if (gameState.phase !== "playing") return;
  resetLookMode();
  gameState.dungeon.depth += 1;
  gameState.dungeon.floor = makeDungeonFloor(gameState.dungeon.depth);
  gameState.dungeon.discovered = {};
  gameState.dungeon.visible = {};
  gameState.dungeon.lastPressureTurn = gameState.dungeon.turn;
  gameState.dungeon.visitedRooms = {};
  updateFov();
  addLog("渦に飲まれた。深く潜る");
  updateHint();
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
    V: "渦: 深く潜る",
    X: "E: 帰還する",
    C: "E: 宝箱を開ける",
  };

  const text = nearbyObj ? hintMap[nearbyObj.type] || "E: 調べる" : "";
  if (gameState.phase === "town") gameState.town.hint = text;
  if (gameState.phase === "playing") gameState.dungeon.hint = text;
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function isVisible(x, y) {
  if (gameState.phase !== "playing") return true;
  return !!gameState.dungeon.visible[tileKey(x, y)];
}

function isDiscovered(x, y) {
  if (gameState.phase !== "playing") return true;
  return !!gameState.dungeon.discovered[tileKey(x, y)];
}

function updateFov() {
  if (gameState.phase !== "playing") return;
  const area = currentArea();
  const p = lookOrigin(area);
  const visible = {};
  const inRoomIndex = roomIndexAt(area, p.x, p.y);
  const lookActive = gameState.ui.lookMode && !!gameState.ui.lookCursor;
  const markVisible = (x, y) => {
    const key = tileKey(x, y);
    visible[key] = true;
    if (!lookActive) gameState.dungeon.discovered[key] = true;
  };
  if (inRoomIndex >= 0) {
    const room = area.rooms[inRoomIndex];
    for (let y = room.y - 1; y <= room.y + room.h; y++) {
      for (let x = room.x - 1; x <= room.x + room.w; x++) {
        if (!inBounds(area, x, y)) continue;
        if (lookActive) {
          const dist = Math.abs(x - p.x) + Math.abs(y - p.y);
          if (dist > 4) continue;
        }
        markVisible(x, y);
      }
    }
  } else {
    for (let y = p.y - 3; y <= p.y + 3; y++) {
      for (let x = p.x - 3; x <= p.x + 3; x++) {
        if (!inBounds(area, x, y)) continue;
        const dist = Math.abs(x - p.x) + Math.abs(y - p.y);
        const isRoomTile = roomIndexAt(area, x, y) >= 0;
        if (dist > 2 && !(isRoomTile && dist <= 3)) continue;
        markVisible(x, y);
      }
    }
  }
  gameState.dungeon.visible = visible;
}

function isEnemyVisibleAt(area, x, y) {
  if (gameState.phase !== "playing") return true;
  if (!isVisible(x, y)) return false;
  const p = lookOrigin(area);
  const playerRoomIndex = roomIndexAt(area, p.x, p.y);
  if (playerRoomIndex >= 0) {
    const enemyRoomIndex = roomIndexAt(area, x, y);
    if (enemyRoomIndex === playerRoomIndex) return true;
  }
  return distance(p, { x, y }) <= 1;
}

function findNearest(area, from, list) {
  const valid = list.filter(Boolean);
  valid.sort((a, b) => distance(a, from) - distance(b, from));
  return valid[0] || null;
}

function autoTargetKey(action, area, p) {
  if (action.type === "move") return `move:${p.x + action.dir.x},${p.y + action.dir.y}`;
  if (action.type === "attack") return `attack:${p.x + action.dir.x},${p.y + action.dir.y}`;
  if (action.type === "special") {
    const nearestEnemy = findNearest(area, p, area.enemies.filter((e) => e.hp > 0));
    if (nearestEnemy) return `special:${nearestEnemy.x},${nearestEnemy.y}`;
  }
  return action.type;
}

function roomIndexAt(area, x, y) {
  if (!area.rooms) return -1;
  return area.rooms.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

function resetLookMode() {
  gameState.ui.lookMode = false;
  gameState.ui.lookCursor = null;
}

function lookOrigin(area) {
  if (gameState.phase !== "playing" || !gameState.ui.lookMode || !gameState.ui.lookCursor) return area.playerPos;
  return gameState.ui.lookCursor;
}

function toggleLookMode() {
  if (gameState.phase !== "playing") return;
  const area = currentArea();
  const p = area.playerPos;
  const roomIndex = roomIndexAt(area, p.x, p.y);
  if (roomIndex < 0) {
    addLog("通路では見渡しできない。");
    resetLookMode();
    updateFov();
    render();
    return;
  }
  if (gameState.ui.lookMode) {
    resetLookMode();
    addLog("見渡しを終了。");
    updateFov();
    render();
    return;
  }
  gameState.ui.lookMode = true;
  gameState.ui.lookCursor = { x: p.x, y: p.y };
  addLog("見渡し開始。矢印で視点移動");
  updateFov();
  render();
}

function moveLookCursor(dx, dy) {
  if (gameState.phase !== "playing" || !gameState.ui.lookMode || !gameState.ui.lookCursor) return false;
  const area = currentArea();
  const cursor = gameState.ui.lookCursor;
  const nx = cursor.x + dx;
  const ny = cursor.y + dy;
  const currentRoom = roomIndexAt(area, cursor.x, cursor.y);
  if (currentRoom < 0) return false;
  if (roomIndexAt(area, nx, ny) !== currentRoom) return false;
  cursor.x = nx;
  cursor.y = ny;
  updateFov();
  render();
  return true;
}

function onEnterRoom(area, x, y) {
  if (gameState.phase !== "playing") return;
  const idx = roomIndexAt(area, x, y);
  if (idx < 0) return;
  const key = `r${idx}`;
  if (gameState.dungeon.visitedRooms[key]) return;
  gameState.dungeon.visitedRooms[key] = true;
  addLog("新しい部屋に入った。");
}

function stepToward(area, from, target) {
  if (!target) return null;
  const dx = Math.sign(target.x - from.x);
  const dy = Math.sign(target.y - from.y);
  const candidates = [
    { dx, dy: 0 },
    { dx: 0, dy },
    { dx, dy },
    { dx: -dx, dy: 0 },
    { dx: 0, dy: -dy },
  ];
  return candidates.find((c) => {
    const nx = from.x + c.dx;
    const ny = from.y + c.dy;
    const tile = tileAt(area, nx, ny);
    return tile !== "wall" && playerCanTraverse(tile) && !enemyAt(area, nx, ny);
  }) || null;
}

function getFallbackAutoMove(area, from, failedDir = null) {
  const dirs = Object.values(DIRS).filter((d) => !failedDir || d.x !== failedDir.x || d.y !== failedDir.y);
  const candidates = dirs
    .map((d) => ({ dir: d, x: from.x + d.x, y: from.y + d.y }))
    .filter((c) => {
      const tile = tileAt(area, c.x, c.y);
      return tile !== "wall" && playerCanTraverse(tile) && !enemyAt(area, c.x, c.y);
    });
  candidates.sort((a, b) => {
    const aScore = (itemAt(area, a.x, a.y) ? 3 : 0) + (!isDiscovered(a.x, a.y) ? 2 : 0) + (objectAt(area, a.x, a.y) ? 1 : 0);
    const bScore = (itemAt(area, b.x, b.y) ? 3 : 0) + (!isDiscovered(b.x, b.y) ? 2 : 0) + (objectAt(area, b.x, b.y) ? 1 : 0);
    return bScore - aScore;
  });
  return candidates[0]?.dir || null;
}

function handleAutoStuck(progressed) {
  if (progressed) {
    gameState.auto.stuckTurns = 0;
    return;
  }
  gameState.auto.stuckTurns += 1;
  if (gameState.auto.stuckTurns > 3) {
    toggleAutoMode(false, "進めないためAUTOを停止した");
  }
}

function adjacentEnemyDirection(area, p) {
  for (const dir of Object.values(DIRS)) {
    const e = enemyAt(area, p.x + dir.x, p.y + dir.y);
    if (e) return dir;
  }
  return null;
}

function decideAutoAction() {
  if (gameState.phase !== "playing") return { type: "none" };
  const area = currentArea();
  const p = area.playerPos;
  const style = gameState.auto.style;

  const adjDir = adjacentEnemyDirection(area, p);
  if (adjDir) return { type: "attack", dir: adjDir };

  const nearestEnemy = findNearest(area, p, area.enemies.filter((e) => e.hp > 0));
  if ((style === "aggressive" || style === "balanced") && gameState.player.pp > 0 && nearestEnemy && distance(nearestEnemy, p) <= CONFIG.specialRange) {
    return { type: "special" };
  }

  if (style !== "aggressive" && gameState.player.hp <= Math.floor(gameState.player.maxHp * 0.4)) {
    const idx = gameState.player.inventory.findIndex((s) => s && s.type === "H");
    if (idx >= 0) return { type: "item", index: idx };
  }

  if (!gameState.mission.retrieved) {
    const fishTarget = findNearest(area, p, area.items.filter((i) => i.type === "F_SMALL" || i.type === "F_BIG"));
    const step = stepToward(area, p, fishTarget);
    if (step) return { type: "move", dir: step };
  } else {
    const returnTile = area.objects.find((o) => o.type === "X");
    const step = stepToward(area, p, returnTile);
    if (step) return { type: "move", dir: step };
  }

  const utility = findNearest(area, p, [...area.items, ...area.objects.filter((o) => o.type === "V")]);
  const utilStep = stepToward(area, p, utility);
  if (utilStep) return { type: "move", dir: utilStep };

  if (nearestEnemy) {
    const step = stepToward(area, p, nearestEnemy);
    if (step) return { type: "move", dir: step };
  }

  return { type: "wait" };
}

function performAutoTurn() {
  if (!gameState.auto.enabled || gameState.phase !== "playing") return;
  const area = currentArea();
  const beforePos = { x: area.playerPos.x, y: area.playerPos.y };
  const beforeEnemyHp = area.enemies.reduce((sum, e) => sum + Math.max(0, e.hp), 0);
  const beforeItems = area.items.length;
  const beforeFish = gameState.player.fishThisRun;
  const beforeRetrieved = gameState.mission.retrieved;
  const action = decideAutoAction();
  const key = autoTargetKey(action, area, beforePos);
  if (key !== gameState.auto.targetKey) gameState.auto.stuckTurns = 0;
  gameState.auto.targetKey = key;
  if (action.type === "attack") performPlayerAttack(action.dir.x, action.dir.y);
  if (action.type === "special") useSpecial();
  if (action.type === "item") useInventoryItem(action.index, true);
  if (action.type === "move") {
    const moved = tryMovePlayer(action.dir.x, action.dir.y);
    if (!moved) {
      const fallback = getFallbackAutoMove(area, beforePos, action.dir);
      if (fallback) {
        const fallbackMoved = tryMovePlayer(fallback.x, fallback.y);
        if (!fallbackMoved) performWait();
      } else {
        performWait();
      }
    }
  }
  if (action.type === "wait") performWait();
  const afterArea = currentArea();
  if (!afterArea || gameState.phase !== "playing") return render();
  const afterPos = afterArea.playerPos;
  const afterEnemyHp = afterArea.enemies.reduce((sum, e) => sum + Math.max(0, e.hp), 0);
  const progressed =
    beforePos.x !== afterPos.x ||
    beforePos.y !== afterPos.y ||
    afterEnemyHp < beforeEnemyHp ||
    afterArea.items.length < beforeItems ||
    gameState.player.fishThisRun > beforeFish ||
    (!beforeRetrieved && gameState.mission.retrieved);
  handleAutoStuck(progressed);
  gameState.auto.lastPos = { x: afterPos.x, y: afterPos.y };
  render();
}

function update(action, payload = {}) {
  if (gameState.phase === "playing" && gameState.auto.enabled && ["MOVE", "INTERACT", "SPECIAL", "WAIT", "ATTACK"].includes(action)) {
    return render();
  }

  if (action === "START_GAME") {
    gameState.town.map = makeTownMap();
    startTown();
    addLog("村に着いた。依頼板で任務を受けよう。");
  }

  if (action === "MOVE" && (gameState.phase === "town" || gameState.phase === "playing")) {
    tryMovePlayer(payload.dx, payload.dy);
  }
  if (action === "INTERACT" && (gameState.phase === "town" || gameState.phase === "playing")) interactNearest();
  if (action === "SPECIAL" && gameState.phase === "playing") {
    if (gameState.ui.lookMode) resetLookMode();
    useSpecial();
  }
  if (action === "WAIT" && gameState.phase === "playing") {
    if (gameState.ui.lookMode) resetLookMode();
    performWait();
  }
  if (action === "ATTACK" && gameState.phase === "playing") {
    if (gameState.ui.lookMode) resetLookMode();
    performForwardAttack();
  }
  if (action === "TOGGLE_LOOK" && gameState.phase === "playing") toggleLookMode();

  if (action === "RESTART") {
    gameState.mission.retrieved = false;
    startTown();
    addLog("村へ戻った。準備して再挑戦しよう。");
  }
  if (action === "TOGGLE_STATUS" && (gameState.phase === "town" || gameState.phase === "playing")) {
    gameState.ui.statusOpen = !gameState.ui.statusOpen;
  }

  if (action === "TOGGLE_AUTO") {
    toggleAutoMode();
  }
  if (action === "AUTO_STYLE" && ["aggressive", "balanced", "cautious"].includes(payload.style)) {
    gameState.auto.style = payload.style;
    addLog(`AUTO方針: ${payload.style}`);
  }

  render();
}

function cameraFor(area) {
  const p = gameState.phase === "playing" ? lookOrigin(area) : area.playerPos;
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
  const temporarilyVisibleInLook = gameState.phase === "playing" && gameState.ui.lookMode && isVisible(x, y);
  if (!isDiscovered(x, y) && !temporarilyVisibleInLook) return { type: "hidden", symbol: "" };
  const p = area.playerPos;
  if (p.x === x && p.y === y) return { type: "player", symbol: "🦭", facing: gameState.player.facing };

  const e = isEnemyVisibleAt(area, x, y) ? enemyAt(area, x, y) : null;
  if (e) return { type: "enemy", symbol: getEnemyType(e).emoji, facing: e.facing || -1 };

  const it = itemAt(area, x, y);
  if (it) {
    if (it.type === "H") return { type: "heal", symbol: "🌿" };
    if (it.type === "F_SMALL") return { type: "item", symbol: "🐟" };
    if (it.type === "F_BIG") return { type: "item", symbol: "🐠" };
  }

  const obj = objectAt(area, x, y);
  if (obj) {
    const map = { V: "gate", X: "stairs", T: "train", R: "rest", D: "gate", B: "board" };
    const symbols = {
      X: "🚪",
      V: "🌀",
      T: "🏋️",
      R: "🍖",
      D: "🕳️",
      B: "📜",
      C: obj.opened ? "🧰" : "🎁",
    };
    if (obj.type === "C") return { type: "item", symbol: symbols[obj.type] };
    return { type: map[obj.type], symbol: symbols[obj.type] };
  }

  const tile = tileAt(area, x, y);
  if (tile === "wall") return { type: "wall", symbol: "", facing: "right" };
  if (tile === "poison") return { type: "floor", symbol: "☣️", facing: "right" };
  if (tile === "hole") return { type: "floor", symbol: "🕳️", facing: "right" };
  if (tile === "water") return { type: "floor", symbol: "💧", facing: "right" };
  return { type: "floor", symbol: "", facing: "right" };
}

function renderLeftPanel(area, cam, hint) {
  const hover = gameState.ui.hoverEnemy;
  return `
    <aside class="side-panel left-panel">
      ${renderMiniMap(area, cam)}
      <div class="hint-side">${hint || ""}</div>
      <div class="enemy-info-fixed">
        ${
          hover
            ? `<strong>${hover.name}</strong><br>HP ${hover.hp} / ATK ${hover.attack}<br>${hover.desc}`
            : `<span class="meta">敵情報: カーソルを敵に合わせる</span>`
        }
      </div>
    </aside>
  `;
}

function renderRightPanel() {
  const slotsHtml = gameState.player.inventory
    .map(
      (slot, idx) =>
        `<button data-slot-index="${idx}" class="item-slot-btn" title="アイテムを使う"><span class="item-equip">${slot && isEquipped(slot.type) ? "E" : ""}</span><span class="item-icon">${slot ? slot.emoji : "・"}</span><span class="item-name">${slot ? slot.name : "空き"}</span></button>`
    )
    .join("");
  return `<aside class="side-panel right-panel"><div class="slot-list">${slotsHtml}</div></aside>`;
}

function renderBoard(area, cam) {
  gameState.ui.effects = gameState.ui.effects.filter((e) => e.expiresAt > Date.now());
  const focusEnemy = findNearest(area, area.playerPos, area.enemies.filter((e) => e.hp > 0 && isEnemyVisibleAt(area, e.x, e.y)));
  let html = `<div class="board-pane"><div class="grid-wrap"><div class="grid" style="grid-template-columns: repeat(${cam.w}, ${CONFIG.tileSize}px)">`;

  for (let y = cam.y0; y < cam.y0 + cam.h; y++) {
    for (let x = cam.x0; x < cam.x0 + cam.w; x++) {
      const vis = tileVisual(area, x, y);
      const sprite = spriteForTile(vis.type, vis.symbol);
      const flipClass = vis.facing === "left" || vis.facing === -1 ? "flip-x" : "";
      let tip = "";
      if (vis.type === "enemy") {
        const enemy = enemyAt(area, x, y);
        if (enemy) {
          const t = getEnemyType(enemy);
          tip = ` title="${t.name} HP ${enemy.hp} / ATK ${t.attack}"`;
        }
      }
      const playerTileClass = vis.type === "player" ? " player-tile" : "";
      const visibilityClass = isVisible(x, y) ? " tile-visible" : " tile-memory";
      const hiddenClass = vis.type === "hidden" ? " tile-hidden" : "";
      const enemyHere = isEnemyVisibleAt(area, x, y) ? enemyAt(area, x, y) : null;
      const objHere = objectAt(area, x, y);
      const itemHere = itemAt(area, x, y);
      const focusClass = focusEnemy && focusEnemy.x === x && focusEnemy.y === y ? " tile-focus" : "";
      const interactClass = (objHere && distance(objHere, area.playerPos) <= 1) || (itemHere && distance(itemHere, area.playerPos) <= 1) ? " tile-interact" : "";
      const lookClass = gameState.ui.lookMode && gameState.ui.lookCursor?.x === x && gameState.ui.lookCursor?.y === y ? " tile-look-cursor" : "";
      html += `<div class="tile${playerTileClass}${visibilityClass}${hiddenClass}${focusClass}${interactClass}${lookClass}" data-map-x="${x}" data-map-y="${y}" style="background-image:url('${sprite.src}')"${tip}><span class="${flipClass} sym-${vis.type}">${vis.symbol}</span></div>`;
    }
  }

  html += `</div>`;
  if (gameState.phase === "playing") {
    const projectiles = gameState.ui.effects
      .map((e) => {
        if (e.kind === "damage") {
          const dx = e.x - cam.x0;
          const dy = e.y - cam.y0;
          if (dx < 0 || dy < 0 || dx >= cam.w || dy >= cam.h) return "";
          return `<div class="damage-float" style="--dx:${dx};--dy:${dy};">${e.text}</div>`;
        }
        const sx = e.fromX - cam.x0;
        const sy = e.fromY - cam.y0;
        const tx = e.toX - cam.x0;
        const ty = e.toY - cam.y0;
        if (sx < 0 || sy < 0 || tx < 0 || ty < 0 || sx >= cam.w || tx >= cam.w || sy >= cam.h || ty >= cam.h) return "";
        return `<div class="projectile" style="--sx:${sx};--sy:${sy};--tx:${tx};--ty:${ty};">${e.emoji}</div>`;
      })
      .join("");
    html += `<div class="projectile-layer">${projectiles}</div>`;
  }
  html += `</div>`;
  html += `</div>`;
  return html;
}

function renderMiniMap(area, cam) {
  if (gameState.phase !== "playing") return "";
  let dots = "";
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const discovered = isDiscovered(x, y);
      const t = tileAt(area, x, y);
      const kind = !discovered ? "unknown" : t === "wall" ? "wall" : t === "water" ? "water" : t === "hole" ? "hole" : "floor";
      const current = x === area.playerPos.x && y === area.playerPos.y ? " player" : "";
      dots += `<span class="mini-dot ${kind}${current}"></span>`;
    }
  }
  return `<div class="minimap" style="grid-template-columns:repeat(${area.width},5px)">${dots}</div>`;
}

function renderArea(area, hint) {
  const cam = cameraFor(area);
  return `
    <div class="field-shell">
      <div class="battle-layout">
        ${renderLeftPanel(area, cam, hint)}
        ${renderBoard(area, cam)}
        ${renderRightPanel()}
      </div>
    </div>
  `;
}

function renderHudBar() {
  const hpRatio = Math.max(0, Math.min(1, gameState.player.hp / gameState.player.maxHp));
  const oxygenRatio = Math.max(0, Math.min(1, gameState.player.oxygen / gameState.player.maxOxygen));
  const hpState = hpRatio > 0.6 ? "safe" : hpRatio > 0.3 ? "mid" : "low";
  const dungeonName = gameState.phase === "playing" ? "蛇頭山 低層" : "拠点";
  const floorLabel = gameState.phase === "playing" ? `${gameState.dungeon.depth}F` : "-";
  hudEl.innerHTML = `
    <div class="hud-bar">
      ${gameState.auto.enabled ? '<span class="hud-auto-dot">AUTO</span>' : ""}
      <div class="hud-left">
        <div class="hud-dungeon">${dungeonName}</div>
        <div class="hud-floor">${floorLabel}</div>
      </div>
      <div class="hud-center">
        <div class="hp-wrap">
          <div class="hp-bar"><div class="hp-fill ${hpState}" style="width:${Math.round(hpRatio * 100)}%"></div></div>
          <span class="hud-hp">${gameState.player.hp}/${gameState.player.maxHp}</span>
        </div>
        <div class="oxy-wrap">
          <div class="oxy-bar"><div class="oxy-fill" style="width:${Math.round(oxygenRatio * 100)}%"></div></div>
          <span class="hud-oxy">${gameState.player.oxygen}/${gameState.player.maxOxygen}</span>
        </div>
      </div>
      <div class="hud-right">💰 ${gameState.player.totalFish}</div>
    </div>
  `;
}

function renderMessageBox() {
  const [latest = "...", prev = ""] = gameState.ui.messages;
  if (gameState.phase === "gameover") {
    logEl.innerHTML = `<div class="message-fixed latest">${latest}</div>`;
    return;
  }
  logEl.innerHTML = `
    <div class="message-fixed latest">${latest}</div>
    <div class="message-fixed older">${prev}</div>
  `;
}

function renderActionBar() {
  if (gameState.phase === "town") {
    return `<div class='controls-row compact'><div class="control-group"><button data-action='INTERACT'>E: 調べる</button></div><div class="control-group subtle"><button data-action='TOGGLE_STATUS'>P: STATUS</button></div></div>`;
  }
  if (gameState.phase !== "playing") return "";
  return `
    <div class='controls-row compact'>
      <div class="control-group">
        <button data-action='INTERACT'>E</button>
        <button data-action='ATTACK'>Z</button>
        <button data-action='SPECIAL'>X</button>
        <button data-action='WAIT'>Space</button>
        <button data-action='TOGGLE_LOOK'>C</button>
      </div>
      <div class="control-group auto-group">
        <button data-action='TOGGLE_AUTO'>Q</button>
      </div>
      <div class="control-group subtle">
        <button data-action='AUTO_STYLE' data-style='aggressive'>1</button>
        <button data-action='AUTO_STYLE' data-style='balanced'>2</button>
        <button data-action='AUTO_STYLE' data-style='cautious'>3</button>
        <button data-action='TOGGLE_STATUS'>P</button>
      </div>
    </div>
  `;
}

function renderStatusPanel() {
  if (!gameState.ui.statusOpen) return "";
  return `
    <div class="status-overlay">
      <h3>STATUS</h3>
      <div>LV ${gameState.player.level}</div>
      <div>EXP ${gameState.player.exp}/${gameState.player.nextExp}</div>
      <div>Lung ${gameState.player.breathSteps}/${CONFIG.lungCapacity}</div>
      <div>AUTO ${gameState.auto.enabled ? gameState.auto.style : "off"}</div>
      <div class="meta">P: 閉じる</div>
    </div>
  `;
}

function render() {
  renderHudBar();

  if (gameState.phase === "start") {
    viewEl.className = "";
    viewEl.innerHTML = `<div class="field-shell"><h2>開始</h2><p>村で準備を整え、海へ潜って魚を持ち帰ろう。</p></div>`;
    controlsEl.innerHTML = `<div class='controls-row'><button data-action='START_GAME'>ゲーム開始</button></div>`;
  }

  if (gameState.phase === "town") {
    viewEl.className = gameState.town.upgradedVisual ? "town-upgraded" : "";
    viewEl.innerHTML = renderArea(gameState.town.map, gameState.town.hint) + renderStatusPanel();
    controlsEl.innerHTML = renderActionBar();
  }

  if (gameState.phase === "playing") {
    viewEl.className = gameState.dungeon.unstable ? "floor-unstable" : "";
    viewEl.innerHTML = renderArea(gameState.dungeon.floor, gameState.dungeon.hint) + renderStatusPanel();
    controlsEl.innerHTML = renderActionBar();
  }

  if (gameState.phase === "gameover") {
    viewEl.className = "";
    viewEl.innerHTML = `<div class="field-shell"><h2>ゲームオーバー</h2><p>再挑戦しますか？</p></div>`;
    controlsEl.innerHTML = `<div class='controls-row'><button data-action='RESTART'>町へ戻る</button></div>`;
  }

  renderMessageBox();
}

controlsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  update(btn.dataset.action, { style: btn.dataset.style });
});

document.addEventListener("click", (e) => {
  const slotBtn = e.target.closest("[data-slot-index]");
  if (!slotBtn) return;
  useInventoryItem(Number(slotBtn.dataset.slotIndex), true);
});

viewEl.addEventListener("mousemove", (e) => {
  if (gameState.phase !== "playing") return;
  const tile = e.target.closest(".tile[data-map-x][data-map-y]");
  if (!tile) {
    if (gameState.ui.hoverEnemy) {
      gameState.ui.hoverEnemy = null;
      render();
    }
    return;
  }
  const x = Number(tile.dataset.mapX);
  const y = Number(tile.dataset.mapY);
  const enemy = isEnemyVisibleAt(gameState.dungeon.floor, x, y) ? enemyAt(gameState.dungeon.floor, x, y) : null;
  if (!enemy) {
    if (gameState.ui.hoverEnemy) {
      gameState.ui.hoverEnemy = null;
      render();
    }
    return;
  }
  const t = getEnemyType(enemy);
  const nextInfo = { name: t.name, hp: enemy.hp, attack: t.attack, desc: enemyBehaviorText(t.id) };
  if (JSON.stringify(gameState.ui.hoverEnemy) !== JSON.stringify(nextInfo)) {
    gameState.ui.hoverEnemy = nextInfo;
    render();
  }
});

viewEl.addEventListener("mouseleave", () => {
  if (!gameState.ui.hoverEnemy) return;
  gameState.ui.hoverEnemy = null;
  render();
});

window.addEventListener("keydown", (e) => {
  if (DIRS[e.key] && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    if (gameState.phase === "playing" && gameState.ui.lookMode) {
      moveLookCursor(DIRS[e.key].x, DIRS[e.key].y);
      return;
    }
    update("MOVE", { dx: DIRS[e.key].x, dy: DIRS[e.key].y });
  }
  if ((e.key === "e" || e.key === "E") && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    update("INTERACT");
  }
  if ((e.key === "z" || e.key === "Z") && gameState.phase === "playing") {
    e.preventDefault();
    update("ATTACK");
  }
  if ((e.key === "x" || e.key === "X") && gameState.phase === "playing") {
    e.preventDefault();
    update("SPECIAL");
  }
  if ((e.key === " " || e.code === "Space") && gameState.phase === "playing") {
    e.preventDefault();
    update("WAIT");
  }
  if ((e.key === "q" || e.key === "Q") && gameState.phase === "playing") {
    e.preventDefault();
    update("TOGGLE_AUTO");
  }
  if ((e.key === "1") && gameState.phase === "playing") {
    e.preventDefault();
    update("AUTO_STYLE", { style: "aggressive" });
  }
  if ((e.key === "2") && gameState.phase === "playing") {
    e.preventDefault();
    update("AUTO_STYLE", { style: "balanced" });
  }
  if ((e.key === "3") && gameState.phase === "playing") {
    e.preventDefault();
    update("AUTO_STYLE", { style: "cautious" });
  }
  if ((e.key === "p" || e.key === "P") && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    update("TOGGLE_STATUS");
  }
  if ((e.key === "c" || e.key === "C") && gameState.phase === "playing") {
    e.preventDefault();
    update("TOGGLE_LOOK");
  }
});

loadAssets();
render();
