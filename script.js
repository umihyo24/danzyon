const CONFIG = {
  tileSize: 60,
  viewport: { w: 12, h: 9 },
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
  pressureEveryTurns: 8,
  projectileEffectMs: 420,
  damageEffectMs: 550,
  effectTickMs: 80,
};

const ASSETS = {
  floor: "assets/floor.png",
  wall: "assets/wall.png",
  floor_cave: "assets/floor_cave.png",
  wall_cave: "assets/wall_cave.png",
  floor_ice: "assets/floor_ice.png",
  wall_ice: "assets/wall_ice.png",
  player: "assets/player.png",
  enemy: "assets/enemy.png",
  item: "assets/item.png",
  heal: "assets/heal.png",
  oxygen: "assets/oxygen.png",
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

const DUNGEON_THEMES = {
  cave: {
    floor: "floor_cave",
    wall: "wall_cave",
  },
  ice: {
    floor: "floor_ice",
    wall: "wall_ice",
  },
};

const DUNGEON_DEFS = {
  urayama: {
    id: "urayama",
    name: "裏山",
    maxDepth: 5,
    theme: "ice",
    mission: "裏山の主を倒して商人を救出する",
    events: {
      bossFloor: 5,
    },
    fov: {
      corridorRadius: 2,
      corridorMax: 3,
      roomPadding: 1,
    },
  },
  forest: {
    id: "forest",
    name: "ちかくのもり",
    maxDepth: 5,
    theme: "cave",
    mission: "倒れている訓練教官を救助する",
    events: {
      downedNpcFloor: 3,
    },
    fov: {
      corridorRadius: Number.POSITIVE_INFINITY,
      corridorMax: Number.POSITIVE_INFINITY,
      roomPadding: Number.POSITIVE_INFINITY,
    },
  },
};

const DEFAULT_DISCOVERY_FOV = {
  corridorRadius: 2,
  corridorMax: 3,
  roomPadding: 1,
};

const ENEMY_TYPES = {
  penguin: { id: "penguin", name: "ペンギン", emoji: "🐧", maxHp: 2, attack: 1, behavior: "ranged", range: 5, exp: 2, swimmer: true },
  penguinBoss: { id: "penguinBoss", name: "裏山の主", emoji: "👑", maxHp: 10, attack: 2, behavior: "ranged", range: 6, exp: 12, swimmer: true },
  cheetah: { id: "cheetah", name: "チーター", emoji: "🐆", maxHp: 3, attack: 1, behavior: "fast", speed: 2, exp: 4 },
  elephant: { id: "elephant", name: "ゾウ", emoji: "🦣", maxHp: 6, attack: 1, behavior: "slow", actEvery: 2, exp: 6 },
  hippo: { id: "hippo", name: "カバ", emoji: "🦛", maxHp: 4, attack: 2, behavior: "heavy", exp: 5, swimmer: true },
};

const OBJECT_TYPES = {
  T: {
    label: "トレーニング",
    hint: "E: トレーニング",
    symbol: "🏋️",
    renderType: "train",
    interact() {
      if (!gameState.meta.unlocked.trainingFacility) {
        addLog("訓練所はまだ使えない。");
        return;
      }
      gameState.player.maxHp += 1;
      gameState.player.hp = gameState.player.maxHp;
      addLog("トレーニングした。");
    },
  },
  R: {
    label: "休憩所",
    hint: "E: 休む",
    symbol: "🍖",
    renderType: "rest",
    interact() {
      gameState.player.hp = gameState.player.maxHp;
      gameState.player.pp = gameState.player.maxPp;
      addLog("腹ごしらえして休んだ。");
    },
  },
  B: {
    label: "依頼板",
    hint: "E: 依頼を見る",
    symbol: "📜",
    renderType: "board",
    interact() {
      gameState.mission.accepted = true;
      const urayamaDone = !!gameState.meta.clearedDungeons.urayama;
      const forestDone = !!gameState.meta.clearedDungeons.forest;
      if (!urayamaDone || !forestDone) {
        const targets = [];
        if (!urayamaDone) targets.push("裏山: 商人救出");
        if (!forestDone) targets.push("もり: 教官救助");
        addLog(`依頼板: ${targets.join(" / ")}`);
      } else {
        addLog("依頼板: 追加の探索依頼あり。");
      }
    },
  },
  D: {
    label: "ダンジョン入口",
    hint: "入口: 踏み込んで探索開始",
    symbol: "🕳️",
    renderType: "gate",
    autoTriggerOnStep: true,
    interact(_, obj) {
      startDungeonRun(obj?.destinationDungeonId || "urayama");
    },
    getSymbol(obj) {
      if (obj?.destinationDungeonId === "forest") return "🌲";
      return "🕳️";
    },
  },
  S: {
    label: "看板",
    hint: "S: カンバンを読む",
    symbol: "🪧",
    renderType: "board",
    interact() {
      addLog("ペンギン村へようこそ！");
    },
  },
  V: {
    label: "渦",
    hint: "渦: 深く潜る",
    symbol: "🌀",
    renderType: "gate",
    autoTriggerOnStep: true,
    interact() {
      descendDepth();
    },
  },
  N: {
    label: "倒れている教官",
    hint: "E: 薬草で手当て",
    symbol: "🧑‍🏫",
    renderType: "board",
    interact(_, obj) {
      if (!obj || obj.rescued) return;
      onNpcRescued(obj);
    },
    getSymbol(obj) {
      return obj && obj.rescued ? "🙂" : "🧑‍🏫";
    },
  },
  C: {
    label: "宝箱",
    hint: "E: 宝箱を開ける",
    symbol: "🎁",
    renderType: "item",
    interact(_, obj) {
      if (obj.opened) return;
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
    },
    getSymbol(obj) {
      return obj && obj.opened ? "🧰" : "🎁";
    },
  },
};

const gameState = {
  phase: "town", // town | playing | gameover
  assets: { images: {}, missing: {}, loaded: false },
  ui: {
    messages: ["ようこそ。"],
    effects: [],
    hoverEnemy: null,
    statusOpen: false,
    lookCursor: null,
    lastDeathReason: "",
    effectTimerId: null,
  },
  input: {
    lookMode: false,
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
    facing: { x: 1, y: 0 },
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
  meta: {
    unlocked: {
      shopkeeper: false,
      trainerNpc: false,
      trainingFacility: false,
    },
    clearedDungeons: {},
  },
  dungeon: null,
};

const TEMP_ALLOW_DIRECT_DUNGEON_START = true;
const DEBUG_UI = false;
const DEBUG_FLOW = false;

const hudEl = document.querySelector("#hud");
const viewEl = document.querySelector("#view");
const logEl = document.querySelector("#log");

function hasRequiredUiRoots() {
  if (!viewEl) {
    console.error("[render] #view not found");
    return false;
  }
  if (!hudEl) {
    console.error("[render] #hud not found");
    return false;
  }
  if (!logEl) {
    console.error("[render] #log not found");
    return false;
  }
  return true;
}

function debugUi(...args) {
  if (!DEBUG_UI) return;
  console.debug("[ui-debug]", ...args);
}

function debugFlow(...args) {
  if (!DEBUG_FLOW) return;
  console.debug("[flow-debug]", ...args);
}

function addLog(msg) {
  gameState.ui.messages.unshift(msg);
  gameState.ui.messages = gameState.ui.messages.slice(0, CONFIG.logLimit);
}

function setGameOver(message) {
  gameState.phase = "gameover";
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
    expiresAt: Date.now() + CONFIG.projectileEffectMs,
  });
}

function addDamageEffect(x, y, text) {
  gameState.ui.effects.push({
    id: Date.now() + Math.random(),
    kind: "damage",
    x,
    y,
    text,
    expiresAt: Date.now() + CONFIG.damageEffectMs,
  });
}

function updateEffects(now = Date.now()) {
  const before = gameState.ui.effects.length;
  if (!before) return false;
  gameState.ui.effects = gameState.ui.effects.filter((e) => e && e.expiresAt > now);
  return gameState.ui.effects.length !== before;
}

function startEffectLoop() {
  if (gameState.ui.effectTimerId) return;
  gameState.ui.effectTimerId = setInterval(() => {
    dispatch("TICK", { now: Date.now() });
  }, CONFIG.effectTickMs);
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
    floor_cave: makePlaceholder("·", "#1d3f4b"),
    wall_cave: makePlaceholder("■", "#0b1d28"),
    floor_ice: makePlaceholder("·", "#2f5268"),
    wall_ice: makePlaceholder("■", "#173246"),
    player: makePlaceholder("@", "#355f2f"),
    enemy: makePlaceholder("M", "#6a2f2f"),
    item: makePlaceholder("🐟", "#6b5d1f"),
    heal: makePlaceholder("+", "#2f5f5f"),
    oxygen: makePlaceholder("O2", "#2f4f6f"),
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
      gameState.assets.missing[key] = false;
      remain -= 1;
      if (remain === 0) gameState.assets.loaded = true;
      render();
    };
    img.onerror = () => {
      gameState.assets.images[key] = fallback[key];
      gameState.assets.missing[key] = true;
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

function playerRoomIndex(area) {
  if (!area?.playerPos) return -1;
  return roomIndexAt(area, area.playerPos.x, area.playerPos.y);
}

function isPlayerRoomTile(area, x, y) {
  const currentRoomIndex = playerRoomIndex(area);
  if (currentRoomIndex < 0) return false;
  return roomIndexAt(area, x, y) === currentRoomIndex;
}

function canSpawnEnemy(area, x, y, options = {}) {
  const { excludePlayerRoom = false } = options;
  if (tileAt(area, x, y) !== "floor") return false;
  if (enemyAt(area, x, y)) return false;
  if (objectAt(area, x, y)) return false;
  if (excludePlayerRoom && isPlayerRoomTile(area, x, y)) return false;
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
  const spawnOptions = { excludePlayerRoom: true };
  if (canSpawnEnemy(area, pos.x, pos.y, spawnOptions)) {
    area.enemies.push({ typeId: type.id, x: pos.x, y: pos.y, hp, facing: Math.random() < 0.5 ? -1 : 1, turnCounter: 0 });
    return;
  }
  for (let r = 1; r < 8; r++) {
    for (let yy = pos.y - r; yy <= pos.y + r; yy++) {
      for (let xx = pos.x - r; xx <= pos.x + r; xx++) {
        if (!inBounds(area, xx, yy)) continue;
        if (canSpawnEnemy(area, xx, yy, spawnOptions)) {
          area.enemies.push({ typeId: type.id, x: xx, y: yy, hp, facing: Math.random() < 0.5 ? -1 : 1, turnCounter: 0 });
          return;
        }
      }
    }
  }
}

function canPlaceItem(area, x, y) {
  if (tileAt(area, x, y) !== "floor") return false;
  if (itemAt(area, x, y)) return false;
  if (objectAt(area, x, y)) return false;
  if (enemyAt(area, x, y)) return false;
  return true;
}

function nearestFreeFloorTile(area, startX, startY) {
  const origin = nearestFloorTile(area, startX, startY);
  if (!origin) return null;
  if (canPlaceItem(area, origin.x, origin.y)) return origin;
  for (let r = 1; r < 8; r++) {
    for (let y = origin.y - r; y <= origin.y + r; y++) {
      for (let x = origin.x - r; x <= origin.x + r; x++) {
        if (!inBounds(area, x, y)) continue;
        if (canPlaceItem(area, x, y)) return { x, y };
      }
    }
  }
  return null;
}

function addItemSafe(area, type, x, y) {
  const pos = nearestFreeFloorTile(area, x, y);
  if (!pos) return false;
  area.items.push({ type, x: pos.x, y: pos.y });
  return true;
}

function centerOfRoom(room) {
  return { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
}

function pickFloorTemplate(depth) {
  if (depth === 20 || depth === 30) return "treasure";
  const templates = ["standard", "compact", "treasure"];
  return templates[Math.floor(Math.random() * templates.length)];
}

function getTemplateConfig(template) {
  if (template === "compact") return { minRooms: 5, maxRooms: 7, minW: 5, maxW: 8, minH: 4, maxH: 7, spacing: 2 };
  if (template === "treasure") return { minRooms: 6, maxRooms: 8, minW: 6, maxW: 10, minH: 5, maxH: 8, spacing: 2 };
  return { minRooms: 5, maxRooms: 8, minW: 6, maxW: 10, minH: 5, maxH: 9, spacing: 2 };
}

function generateRoomsFromTemplate(template, areaWidth, areaHeight) {
  const cfg = getTemplateConfig(template);
  const target = cfg.minRooms + Math.floor(Math.random() * (cfg.maxRooms - cfg.minRooms + 1));
  const rooms = [];
  let tries = 0;
  while (rooms.length < target && tries < 220) {
    tries++;
    const w = cfg.minW + Math.floor(Math.random() * (cfg.maxW - cfg.minW + 1));
    const h = cfg.minH + Math.floor(Math.random() * (cfg.maxH - cfg.minH + 1));
    const x = 1 + Math.floor(Math.random() * Math.max(1, areaWidth - w - 2));
    const y = 1 + Math.floor(Math.random() * Math.max(1, areaHeight - h - 2));
    const room = { x, y, w, h };
    const overlap = rooms.some((r) => !(
      room.x + room.w + cfg.spacing <= r.x ||
      r.x + r.w + cfg.spacing <= room.x ||
      room.y + room.h + cfg.spacing <= r.y ||
      r.y + r.h + cfg.spacing <= room.y
    ));
    if (!overlap) rooms.push(room);
  }
  if (rooms.length < cfg.minRooms) return null;
  rooms.sort((a, b) => (a.x - b.x) || (a.y - b.y));
  return rooms;
}

function buildRoomEdges(rooms) {
  const edges = [];
  for (let i = 0; i < rooms.length - 1; i++) edges.push([i, i + 1]);
  const extraEdgeCount = 1 + Math.floor(Math.random() * 2);
  const edgeExists = (a, b) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  let attempts = 0;
  while (edges.length < (rooms.length - 1) + extraEdgeCount && attempts < 30) {
    attempts++;
    const a = Math.floor(Math.random() * rooms.length);
    const b = Math.floor(Math.random() * rooms.length);
    if (a === b) continue;
    if (Math.abs(a - b) <= 1) continue;
    if (edgeExists(a, b)) continue;
    edges.push([a, b]);
  }
  return edges;
}

function assignRoomRoles(rooms, template) {
  const centers = rooms.map(centerOfRoom);
  const leftMostX = Math.min(...centers.map((c) => c.x));
  const startCandidates = centers.map((c, i) => ({ i, c })).filter(({ c }) => c.x <= leftMostX + 2);
  const startIndex = startCandidates[Math.floor(Math.random() * startCandidates.length)].i;
  let goalIndex = startIndex;
  let farDist = -1;
  for (let i = 0; i < centers.length; i++) {
    if (i === startIndex) continue;
    const d = Math.abs(centers[i].x - centers[startIndex].x) + Math.abs(centers[i].y - centers[startIndex].y);
    if (d > farDist) {
      farDist = d;
      goalIndex = i;
    }
  }
  let treasureIndex = null;
  if (template === "treasure") {
    const minTreasureDist = Math.max(8, Math.floor(CONFIG.viewport.w * 0.75));
    for (let i = 0; i < centers.length; i++) {
      if (i === startIndex || i === goalIndex) continue;
      if (treasureIndex === null) {
        treasureIndex = i;
        continue;
      }
      const dNew = Math.abs(centers[i].x - centers[startIndex].x) + Math.abs(centers[i].y - centers[startIndex].y);
      const dOld = Math.abs(centers[treasureIndex].x - centers[startIndex].x) + Math.abs(centers[treasureIndex].y - centers[startIndex].y);
      if (dNew > dOld) treasureIndex = i;
    }
    if (treasureIndex !== null) {
      const treasureDist = Math.abs(centers[treasureIndex].x - centers[startIndex].x) + Math.abs(centers[treasureIndex].y - centers[startIndex].y);
      if (treasureDist < minTreasureDist) {
        const fallback = centers
          .map((c, i) => ({ i, dist: Math.abs(c.x - centers[startIndex].x) + Math.abs(c.y - centers[startIndex].y) }))
          .filter((entry) => entry.i !== startIndex && entry.i !== goalIndex && entry.dist >= minTreasureDist)
          .sort((a, b) => b.dist - a.dist)[0];
        if (fallback) treasureIndex = fallback.i;
      }
    }
  }
  return { startIndex, goalIndex, treasureIndex };
}

function spreadPlacement(base, idx) {
  const offsets = [
    { x: -1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -1 },
    { x: 2, y: 0 },
    { x: -2, y: 1 },
    { x: 1, y: -1 },
  ];
  const offset = offsets[idx % offsets.length];
  return { x: base.x + offset.x, y: base.y + offset.y };
}

function ensureInterestingSlices(area, centers, depth) {
  const sliceWidth = CONFIG.viewport.w;
  const sliceCount = Math.max(1, Math.ceil(area.width / sliceWidth));
  for (let s = 0; s < sliceCount; s++) {
    const xMin = s * sliceWidth;
    const xMax = Math.min(area.width - 1, xMin + sliceWidth - 1);
    const hasEnemy = area.enemies.some((e) => e.x >= xMin && e.x <= xMax && e.hp > 0);
    const hasItem = area.items.some((i) => i.x >= xMin && i.x <= xMax);
    if (hasEnemy || hasItem) continue;
    const center = centers
      .filter((c) => c.x >= xMin && c.x <= xMax)
      .sort((a, b) => Math.abs((xMin + xMax) / 2 - a.x) - Math.abs((xMin + xMax) / 2 - b.x))[0];
    if (!center) continue;
    const spot = nearestFreeFloorTile(area, center.x, center.y) || center;
    if (s % 2 === 0) {
      addItemSafe(area, depth > 2 ? "F_SMALL" : "H", spot.x, spot.y);
    } else {
      spawnEnemyOfType(area, spot.x, spot.y, "penguin", ENEMY_TYPES.penguin.maxHp + depth - 1);
    }
  }
}

function placeDungeonContent(area, rooms, roles, depth, template) {
  const centers = rooms.map(centerOfRoom);
  const start = centers[roles.startIndex];
  const goal = centers[roles.goalIndex];
  area.playerPos = { x: start.x, y: start.y };
  area.startPos = { x: start.x, y: start.y };

  const stairsPos = nearestFloorTile(area, goal.x - 1, goal.y + (goal.y >= start.y ? 1 : -1)) || goal;
  area.objects.push({ type: "V", x: stairsPos.x, y: stairsPos.y });
  if (template === "treasure" && roles.treasureIndex !== null) {
    const t = centers[roles.treasureIndex];
    const chestPos = nearestFloorTile(area, t.x + 2, t.y - 1) || nearestFloorTile(area, t.x + 1, t.y - 1) || t;
    area.objects.push({ type: "C", x: chestPos.x, y: chestPos.y, opened: false });
  }

  const contentCenters = centers.filter((_, i) => i !== roles.startIndex);
  const nearStartCenters = contentCenters
    .slice()
    .sort((a, b) => distance(a, start) - distance(b, start))
    .slice(0, 2);
  nearStartCenters.forEach((c, i) => {
    const pos = spreadPlacement(c, i);
    addItemSafe(area, i % 2 === 0 ? "H" : "OXY", pos.x, pos.y);
  });

  contentCenters.slice(0, 2).forEach((c, i) => {
    const pos = spreadPlacement(c, i + 2);
    addItemSafe(area, "H", pos.x, pos.y);
  });
  contentCenters.slice(2, 4).forEach((c, i) => {
    const pos = spreadPlacement(c, i + 4);
    addItemSafe(area, "OXY", pos.x, pos.y);
  });

  const fishBases = contentCenters.slice(0, 4);
  fishBases.forEach((c, i) => {
    const pos = spreadPlacement(c, i + 1);
    addItemSafe(area, i % 3 === 0 && depth > 1 ? "F_BIG" : "F_SMALL", pos.x, pos.y);
  });
  if (contentCenters[2]) addItemSafe(area, "TENGU", contentCenters[2].x - 2, contentCenters[2].y + 1);
  if (contentCenters[1]) addItemSafe(area, "MIZU", contentCenters[1].x - 1, contentCenters[1].y + 2);

  const enemyCycle = ["penguin", "cheetah", "elephant", "hippo", "penguin", "cheetah"];
  const enemySpawns = contentCenters.slice(0, 6).map((pos, i) => ({ pos: spreadPlacement(pos, i), typeId: enemyCycle[i % enemyCycle.length] }));
  enemySpawns.forEach((s) => spawnEnemyOfType(area, s.pos.x, s.pos.y, s.typeId, ENEMY_TYPES[s.typeId].maxHp + depth - 1));
  for (let i = 0; i < gameState.town.level && enemySpawns.length; i++) {
    const s = enemySpawns[i % enemySpawns.length];
    spawnEnemyOfType(area, s.pos.x + (i % 2), s.pos.y + ((i + 1) % 2), s.typeId, ENEMY_TYPES[s.typeId].maxHp + depth - 1);
  }

  const pathMidX = Math.floor((start.x + stairsPos.x) / 2);
  const hasMidInterest = area.items.some((it) => Math.abs(it.x - pathMidX) <= 2) || area.enemies.some((e) => Math.abs(e.x - pathMidX) <= 2);
  if (!hasMidInterest) {
    const mid = nearestFreeFloorTile(area, pathMidX, start.y) || nearestFloorTile(area, pathMidX, start.y) || start;
    addItemSafe(area, "F_SMALL", mid.x, mid.y);
  }
  ensureInterestingSlices(area, centers, depth);
}

function makeFixedDungeonFloor(dungeonId, depth = 1) {
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
  const centers = rooms.map(centerOfRoom);
  buildRoomEdges(rooms).forEach(([a, b]) => carveCorridor(area, centers[a], centers[b]));

  area.playerPos = { x: centers[0].x, y: centers[0].y };
  area.startPos = { x: centers[0].x, y: centers[0].y };
  area.objects.push({ type: "V", x: centers[5].x, y: centers[5].y });
  area.objects.push({ type: "C", x: centers[2].x + 1, y: centers[2].y - 1, opened: false });
  [centers[2], centers[3]].forEach((c, i) => addItemSafe(area, "H", c.x + (i - 1), c.y));
  [centers[1], centers[4]].forEach((c, i) => addItemSafe(area, "OXY", c.x - 1 + i, c.y + 1));
  [centers[1], centers[4], centers[5], { x: 24, y: 18 }].forEach((c, i) => {
    addItemSafe(area, i % 3 === 0 && depth > 1 ? "F_BIG" : "F_SMALL", c.x + (i % 2), c.y);
  });
  addItemSafe(area, "TENGU", centers[3].x - 2, centers[3].y + 1);
  addItemSafe(area, "MIZU", centers[2].x - 1, centers[2].y + 2);

  const enemySpawns = [
    { pos: centers[1], typeId: "penguin" },
    { pos: centers[2], typeId: "cheetah" },
    { pos: centers[3], typeId: "elephant" },
    { pos: centers[4], typeId: "hippo" },
    { pos: centers[5], typeId: "penguin" },
    { pos: { x: 25, y: 10 }, typeId: "cheetah" },
  ];
  enemySpawns.forEach((s) => spawnEnemyOfType(area, s.pos.x, s.pos.y, s.typeId, ENEMY_TYPES[s.typeId].maxHp + depth - 1));
  for (let i = 0; i < gameState.town.level; i++) {
    const s = enemySpawns[i % enemySpawns.length];
    spawnEnemyOfType(area, s.pos.x + (i % 2), s.pos.y + ((i + 1) % 2), s.typeId, ENEMY_TYPES[s.typeId].maxHp + depth - 1);
  }
  area.rooms = rooms;
  decorateDungeonTiles(area, centers);
  placeDungeonEvents(area, dungeonId, depth);
  return area;
}

function makeDungeonFloor(dungeonId, depth = 1) {
  const template = pickFloorTemplate(depth);
  const maxRetries = 8;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const area = createArea(CONFIG.floor.w, CONFIG.floor.h);
    const rooms = generateRoomsFromTemplate(template, area.width, area.height);
    if (!rooms || rooms.length < 5) continue;
    rooms.forEach((r) => carveRoom(area, r));
    const centers = rooms.map(centerOfRoom);
    buildRoomEdges(rooms).forEach(([a, b]) => carveCorridor(area, centers[a], centers[b]));
    const roles = assignRoomRoles(rooms, template);
    placeDungeonContent(area, rooms, roles, depth, template);
    area.rooms = rooms;
    decorateDungeonTiles(area, centers);
    placeDungeonEvents(area, dungeonId, depth);
    if (hasRouteToStairs(area)) return area;
  }
  return makeFixedDungeonFloor(dungeonId, depth);
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

function isRoomInteriorTile(area, x, y) {
  const roomIdx = roomIndexAt(area, x, y);
  if (roomIdx < 0 || !area.rooms || !area.rooms[roomIdx]) return false;
  const room = area.rooms[roomIdx];
  return x > room.x && x < room.x + room.w - 1 && y > room.y && y < room.y + room.h - 1;
}

function decorateDungeonTiles(area, centers) {
  const poisonSpots = [
    { x: centers[1].x - 1, y: centers[1].y + 1 },
    { x: centers[4].x + 1, y: centers[4].y - 1 },
  ];
  poisonSpots.forEach((p) => {
    if (tileAt(area, p.x, p.y) !== "floor") return;
    if (!isRoomInteriorTile(area, p.x, p.y)) return;
    if (objectAt(area, p.x, p.y) || itemAt(area, p.x, p.y) || enemyAt(area, p.x, p.y)) return;
    area.tiles[p.y][p.x] = "poison";
  });
  const waterSpots = [
    { x: centers[2].x, y: centers[2].y + 1 },
    { x: centers[3].x + 1, y: centers[3].y },
  ];
  waterSpots.forEach((p) => {
    if (tileAt(area, p.x, p.y) !== "floor") return;
    if (!isRoomInteriorTile(area, p.x, p.y)) return;
    if (objectAt(area, p.x, p.y) || itemAt(area, p.x, p.y) || enemyAt(area, p.x, p.y)) return;
    area.tiles[p.y][p.x] = "water";
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
      if (!isRoomInteriorTile(area, p.x, p.y)) return;
      if (objectAt(area, p.x, p.y) || itemAt(area, p.x, p.y) || enemyAt(area, p.x, p.y)) return;
      const isStart = area.startPos && area.startPos.x === p.x && area.startPos.y === p.y;
      if (isStart) return;
      area.tiles[p.y][p.x] = chain.type;
      if (!hasRouteToStairs(area)) area.tiles[p.y][p.x] = "floor";
    });
  });
}

function getDungeonDef(dungeonId) {
  if (!dungeonId) return DUNGEON_DEFS.urayama;
  return DUNGEON_DEFS[dungeonId] || DUNGEON_DEFS.urayama;
}

function getCurrentFovConfig() {
  const dungeonId = gameState.dungeon?.id;
  const def = getDungeonDef(dungeonId);
  return def.fov || {
    corridorRadius: Number.POSITIVE_INFINITY,
    corridorMax: Number.POSITIVE_INFINITY,
    roomPadding: 0,
  };
}

function getScanRange(area, corridorMax) {
  if (Number.isFinite(corridorMax)) return corridorMax;
  return Math.max(area.width, area.height);
}

function isWithinFov(area, origin, x, y, fov) {
  const originRoomIndex = roomIndexAt(area, origin.x, origin.y);
  if (originRoomIndex >= 0) {
    const room = area.rooms[originRoomIndex];
    if (Number.isFinite(fov.roomPadding)) {
      return (
        x >= room.x - fov.roomPadding &&
        x <= room.x + room.w + fov.roomPadding &&
        y >= room.y - fov.roomPadding &&
        y <= room.y + room.h + fov.roomPadding
      );
    }
  }
  const dist = Math.abs(x - origin.x) + Math.abs(y - origin.y);
  const isRoomTile = roomIndexAt(area, x, y) >= 0;
  return dist <= fov.corridorRadius || (isRoomTile && dist <= fov.corridorMax);
}


function hasInventoryItemType(type) {
  return gameState.player.inventory.some((slot) => slot && slot.type === type);
}

function consumeInventoryItemType(type) {
  const idx = gameState.player.inventory.findIndex((slot) => slot && slot.type === type);
  if (idx < 0) return false;
  gameState.player.inventory[idx] = null;
  reorderInventoryByEquipment();
  return true;
}

function onNpcRescued(obj) {
  if (!obj || obj.rescued) return;
  if (!hasInventoryItemType("H")) {
    addLog("薬草が必要だ。");
    return;
  }
  consumeInventoryItemType("H");
  obj.rescued = true;
  if (gameState.dungeon?.run) gameState.dungeon.run.trainerRescued = true;
  gameState.meta.unlocked.trainerNpc = true;
  gameState.meta.unlocked.trainingFacility = true;
  addLog("教官を手当てした。訓練所が使えるようになった。");
  endPlayerTurn("interact");
}

function onBossDefeated(enemy) {
  if (!enemy || enemy.typeId !== "penguinBoss") return;
  if (gameState.dungeon?.run) gameState.dungeon.run.bossDefeated = true;
  gameState.meta.unlocked.shopkeeper = true;
  addLog("裏山の主を倒した！商人が村に戻れるようになった。");
}

function isDungeonClearConditionMet(dungeonId) {
  const run = gameState.dungeon?.run;
  if (!run) return false;
  if (dungeonId === "urayama") return !!run.bossDefeated;
  if (dungeonId === "forest") return !!run.trainerRescued && !!run.forestExitReached;
  return false;
}

function completeDungeonRun(dungeonId) {
  if (!gameState.meta.clearedDungeons[dungeonId]) {
    gameState.meta.clearedDungeons[dungeonId] = true;
    addLog(`${getDungeonDef(dungeonId).name}を踏破した。`);
  }
}

function placeDungeonEvents(area, dungeonId, depth) {
  if (dungeonId === "urayama" && depth === getDungeonDef("urayama").events.bossFloor) {
    const goal = area.objects.find((o) => o.type === "V");
    const spawn = goal ? nearestFloorTile(area, goal.x - 1, goal.y) || goal : area.playerPos;
    if (!enemyAt(area, spawn.x, spawn.y)) {
      spawnEnemyOfType(area, spawn.x, spawn.y, "penguinBoss", ENEMY_TYPES.penguinBoss.maxHp + gameState.town.level);
    }
  }
  if (dungeonId === "forest" && depth === getDungeonDef("forest").events.downedNpcFloor) {
    const safe = nearestFloorTile(area, area.playerPos.x + 3, area.playerPos.y + 1) || area.playerPos;
    if (!objectAt(area, safe.x, safe.y)) area.objects.push({ type: "N", id: "trainer", x: safe.x, y: safe.y, rescued: false });
  }
}

function makeTownMap() {
  const area = createArea(CONFIG.town.w, CONFIG.town.h);
  for (let y = 1; y < area.height - 1; y++) {
    for (let x = 1; x < area.width - 1; x++) area.tiles[y][x] = "floor";
  }

  for (let x = 4; x < 20; x++) area.tiles[8][x] = "wall";
  area.tiles[8][11] = "floor";

  area.playerPos = { x: 17, y: 11 };
  if (gameState.meta.unlocked.trainingFacility) area.objects.push({ type: "T", x: 3, y: 3 }); // training is distant
  area.objects.push({ type: "R", x: 16, y: 11 });
  area.objects.push({ type: "B", x: 18, y: 11 }); // quest board close to loop
  area.objects.push({ type: "D", x: 20, y: 10, destinationDungeonId: "urayama" });
  area.objects.push({ type: "D", x: 20, y: 12, destinationDungeonId: "forest" });
  area.objects.push({ type: "S", x: 21, y: 11 });
  return area;
}

function startTown() {
  resetLookMode();
  gameState.phase = "town";
  ensureInventorySize();
  gameState.town.map = makeTownMap();
  gameState.town.map.playerPos = { x: 17, y: 11 };
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  gameState.player.facing = { x: 0, y: 1 };
  gameState.ui.lastDeathReason = "";
  gameState.ui.statusOpen = false;
  updateHint();
}

function startRun(dungeonId = "urayama") {
  startDungeonRun(dungeonId);
}

function startDungeonRun(dungeonId = "urayama") {
  if (!TEMP_ALLOW_DIRECT_DUNGEON_START && !gameState.mission.accepted) {
    addLog("依頼板で任務を受けよう。");
    return;
  }
  const def = getDungeonDef(dungeonId);
  gameState.phase = "playing";
  gameState.player.hp = gameState.player.maxHp;
  gameState.player.pp = gameState.player.maxPp;
  gameState.player.oxygen = gameState.player.maxOxygen;
  gameState.player.breathSteps = 0;
  gameState.player.fishThisRun = 0;
  gameState.player.reviveUsed = false;
  gameState.mission.retrieved = false;
  gameState.dungeon = {
    id: def.id,
    floor: makeDungeonFloor(def.id, 1),
    theme: def.theme,
    hint: "",
    turn: 1,
    unstable: false,
    depth: 1,
    maxDepth: def.maxDepth,
    run: {
      bossDefeated: false,
      trainerRescued: false,
      forestExitReached: false,
    },
    discovered: {},
    visible: {},
    lastPressureTurn: 0,
    visitedRooms: {},
  };
  gameState.player.facing = { x: 0, y: 1 };
  gameState.ui.statusOpen = false;
  gameState.ui.lastDeathReason = "";
  resetLookMode();
  updateFov();
  updateHint();
  addLog(`${def.name}へ出発。${def.mission}`);
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

function canMoveDiagonally(area, fromX, fromY, toX, toY) {
  const isDiagonal = Math.abs(toX - fromX) === 1 && Math.abs(toY - fromY) === 1;
  if (!isDiagonal) return true;
  const sideA = tileAt(area, toX, fromY);
  const sideB = tileAt(area, fromX, toY);
  return sideA !== "wall" && sideB !== "wall";
}

function enemyBehaviorText(typeId) {
  const texts = {
    penguin: "低HP・直線氷弾",
    penguinBoss: "高耐久・強力な氷弾",
    cheetah: "高速2歩移動",
    elephant: "遅いが硬い",
    hippo: "一撃が重い",
  };
  return texts[typeId] || "";
}

function getObjectTypeDef(type) {
  return OBJECT_TYPES[type] || null;
}

function currentDungeonThemeDef() {
  const themeName = gameState.dungeon?.theme || "cave";
  return DUNGEON_THEMES[themeName] || DUNGEON_THEMES.cave;
}

function tileAssetKey(type) {
  if (gameState.phase === "playing" && (type === "floor" || type === "wall")) {
    const theme = currentDungeonThemeDef();
    return type === "floor" ? theme.floor : theme.wall;
  }
  return type;
}

function getNaturalRecoveryAmount(level) {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}

function recoverOxygen(amount, reason = "") {
  if (gameState.phase !== "playing") return;
  if (amount <= 0) return;
  const before = gameState.player.oxygen;
  gameState.player.oxygen = Math.min(gameState.player.maxOxygen, gameState.player.oxygen + amount);
  if (reason && gameState.player.oxygen > before) addLog(reason);
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

function applyInteraction(obj) {
  if (!obj) return;
  const def = getObjectTypeDef(obj.type);
  if (def && def.interact) def.interact(gameState, obj);
}

function shouldAutoTriggerObjectOnStep(obj) {
  if (!obj) return false;
  const def = getObjectTypeDef(obj.type);
  return !!def?.autoTriggerOnStep;
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
      OXY: { emoji: "🫧", name: "酸素ボンベ" },
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
  if (dx !== 0) gameState.player.facing = { x: Math.sign(dx), y: 0 };
  if (dy !== 0) gameState.player.facing = { x: 0, y: Math.sign(dy) };
}

function facingToVector() {
  const f = gameState.player.facing;
  if (!f) return { x: 1, y: 0 };
  if (f.x === 1) return { x: 1, y: 0 };
  if (f.x === -1) return { x: -1, y: 0 };
  if (f.y === 1) return { x: 0, y: 1 };
  if (f.y === -1) return { x: 0, y: -1 };
  return { x: 1, y: 0 };
}

function useInventoryItem(index, consumeTurn = true) {
  const item = gameState.player.inventory[index];
  if (!item) {
    addLog("アイテムがない。");
    return { success: false, consumedTurn: false };
  }
  if (isEquipItemType(item.type)) {
    if (isEquipped(item.type)) {
      gameState.player.equipment = gameState.player.equipment.filter((t) => t !== item.type);
      addLog(`${item.name}の装備を外した。`);
    } else {
      if (gameState.player.equipment.length >= 2) {
        addLog("装備は2つまで。");
        return { success: false, consumedTurn: false };
      }
      gameState.player.equipment.push(item.type);
      addLog(`${item.name}を装備した。`);
    }
    reorderInventoryByEquipment();
    return { success: true, consumedTurn: false };
  }

  if (item.type === "H") {
    gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + 2);
    recoverOxygen(4, "呼吸が落ち着き、酸素が少し回復した。");
    addLog("薬草を使って回復した。");
  }
  if (item.type === "OXY") {
    recoverOxygen(20, "酸素ボンベを使って酸素を回復した。");
  }
  gameState.player.inventory[index] = null;
  const consumedTurn = consumeTurn && gameState.phase === "playing";
  if (consumedTurn) endPlayerTurn("item");
  reorderInventoryByEquipment();
  return { success: true, consumedTurn };
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
  if (gameState.phase === "playing" && gameState.input.lookMode) resetLookMode();
  const p = area.playerPos;
  const nx = p.x + dx;
  const ny = p.y + dy;
  updateFacing(dx, dy);

  if (!canMoveDiagonally(area, p.x, p.y, nx, ny)) {
    addLog("壁の角はすり抜けられない。");
    return false;
  }

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

  const stepObj = objectAt(area, nx, ny);
  if (shouldAutoTriggerObjectOnStep(stepObj)) {
    applyInteraction(stepObj);
    updateHint();
    return true;
  }

  if (gameState.phase === "playing") {
    onEnterRoom(area, nx, ny);
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
    onBossDefeated(enemy);
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
    onBossDefeated(target);
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
  const dx = Math.sign(playerPos.x - enemy.x);
  const dy = Math.sign(playerPos.y - enemy.y);
  const options = [];
  if (dx !== 0 && dy !== 0) options.push({ x: enemy.x + dx, y: enemy.y + dy });
  if (Math.abs(playerPos.x - enemy.x) >= Math.abs(playerPos.y - enemy.y)) {
    if (dx !== 0) options.push({ x: enemy.x + dx, y: enemy.y });
    if (dy !== 0) options.push({ x: enemy.x, y: enemy.y + dy });
  } else {
    if (dy !== 0) options.push({ x: enemy.x, y: enemy.y + dy });
    if (dx !== 0) options.push({ x: enemy.x + dx, y: enemy.y });
  }
  const next = options.find(
    (c) =>
      canMoveDiagonally(area, enemy.x, enemy.y, c.x, c.y) &&
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
  return Math.max(Math.abs(enemy.x - playerPos.x), Math.abs(enemy.y - playerPos.y)) === 1;
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
  if (actionType === "wait") recoverOxygen(2, "深呼吸して酸素を回復した。");
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
      if (!canSpawnEnemy(area, x, y, { excludePlayerRoom: true })) continue;
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
  if (gameState.phase === "playing") {
    const dungeonId = gameState.dungeon?.id;
    if (dungeonId && isDungeonClearConditionMet(dungeonId)) completeDungeonRun(dungeonId);
  }
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
  const dungeonId = gameState.dungeon?.id;
  const def = getDungeonDef(dungeonId);
  if (!dungeonId || !def) return;
  if (gameState.dungeon.depth >= def.maxDepth) {
    if (dungeonId === "forest" && gameState.dungeon.run?.trainerRescued) {
      gameState.dungeon.run.forestExitReached = true;
    }
    if (dungeonId === "forest" && isDungeonClearConditionMet(dungeonId)) {
      completeDungeonRun(dungeonId);
      addLog(`${def.name}を踏破して帰還した。`);
      onReturnRun();
    } else if (dungeonId === "forest") {
      addLog("教官の救助が完了していない。");
    } else {
      addLog("これ以上は潜れない。");
    }
    return;
  }
  resetLookMode();
  gameState.dungeon.depth += 1;
  gameState.dungeon.floor = makeDungeonFloor(dungeonId, gameState.dungeon.depth);
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

  const nearbyDef = nearbyObj ? getObjectTypeDef(nearbyObj.type) : null;
  const text = nearbyObj ? nearbyDef?.hint || "" : "";
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
  const fov = getCurrentFovConfig();
  const visible = {};
  const inRoomIndex = roomIndexAt(area, area.playerPos.x, area.playerPos.y);
  const lookActive = gameState.input.lookMode && !!gameState.ui.lookCursor;
  const shouldDiscover = (x, y) => isWithinFov(area, area.playerPos, x, y, DEFAULT_DISCOVERY_FOV);
  const markVisible = (x, y) => {
    const key = tileKey(x, y);
    visible[key] = true;
    if (!lookActive && shouldDiscover(x, y)) gameState.dungeon.discovered[key] = true;
  };
  if (inRoomIndex >= 0 && Number.isFinite(fov.roomPadding)) {
    const room = area.rooms[inRoomIndex];
    for (let y = room.y - fov.roomPadding; y <= room.y + room.h + fov.roomPadding; y++) {
      for (let x = room.x - fov.roomPadding; x <= room.x + room.w + fov.roomPadding; x++) {
        if (!inBounds(area, x, y)) continue;
        markVisible(x, y);
      }
    }
  } else {
    const scanRange = getScanRange(area, fov.corridorMax);
    for (let y = p.y - scanRange; y <= p.y + scanRange; y++) {
      for (let x = p.x - scanRange; x <= p.x + scanRange; x++) {
        if (!inBounds(area, x, y)) continue;
        if (!isWithinFov(area, p, x, y, fov)) continue;
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

function roomIndexAt(area, x, y) {
  if (!area.rooms) return -1;
  return area.rooms.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

function resetLookMode() {
  gameState.input.lookMode = false;
  gameState.ui.lookCursor = null;
}

function lookOrigin(area) {
  if (gameState.phase !== "playing" || !gameState.input.lookMode || !gameState.ui.lookCursor) return area.playerPos;
  return gameState.ui.lookCursor;
}

function toggleLookMode() {
  if (gameState.phase !== "town" && gameState.phase !== "playing") return;
  if (gameState.input.lookMode) {
    resetLookMode();
  } else {
    gameState.input.lookMode = true;
  }
  if (gameState.phase === "playing") updateFov();
}

function setLookMode(active) {
  const enabled = !!active;
  if (gameState.phase !== "town" && gameState.phase !== "playing") return;
  if (gameState.input.lookMode === enabled) return;
  gameState.input.lookMode = enabled;
  updateFov();
}

function moveLookCursor(dx, dy) {
  if (gameState.phase !== "playing" || !gameState.input.lookMode || !gameState.ui.lookCursor) return false;
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

function update(action, payload = {}) {
  if (action === "RESTART") {
    debugUi("update", action, { phase: gameState.phase, payload });
  }
  switch (action) {
    case "MOVE":
      if (gameState.phase === "town" || gameState.phase === "playing") tryMovePlayer(payload.dx, payload.dy);
      break;
    case "INTERACT":
      if (gameState.phase === "town" || gameState.phase === "playing") interactNearest();
      break;
    case "SPECIAL":
      if (gameState.phase === "playing") {
        if (gameState.input.lookMode) resetLookMode();
        useSpecial();
      }
      break;
    case "WAIT":
      if (gameState.phase === "playing") {
        if (gameState.input.lookMode) resetLookMode();
        performWait();
      }
      break;
    case "ATTACK":
      if (gameState.phase === "playing") {
        if (gameState.input.lookMode) resetLookMode();
        performForwardAttack();
      }
      break;
    case "TOGGLE_LOOK":
      if (gameState.phase === "playing") toggleLookMode();
      break;
    case "SET_LOOK_MODE":
      if (gameState.phase === "town" || gameState.phase === "playing") setLookMode(payload.active);
      break;
    case "LOOK_FACE":
      if (gameState.input.lookMode && (gameState.phase === "town" || gameState.phase === "playing")) {
        updateFacing(payload.dx, payload.dy);
      }
      break;
    case "USE_ITEM":
      useInventoryItem(Number(payload.index), payload.consumeTurn !== false);
      break;
    case "RESTART":
      gameState.mission.retrieved = false;
      startTown();
      addLog("村へ戻った。準備して再挑戦しよう。");
      break;
    case "TOGGLE_STATUS":
      if (gameState.phase === "town" || gameState.phase === "playing") gameState.ui.statusOpen = !gameState.ui.statusOpen;
      break;
    case "TICK":
      break;
    default:
      break;
  }

  updateEffects(payload.now);
}

function dispatch(action, payload = {}) {
  if (action === "RESTART") {
    debugUi("dispatch", action, payload);
  }
  update(action, payload);
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
    floor: tileAssetKey("floor"),
    wall: tileAssetKey("wall"),
    player: "player",
    enemy: "enemy",
    item: "item",
    heal: "heal",
    oxygen: "oxygen",
    stairs: "stairs",
    train: "train",
    rest: "rest",
    gate: "gate",
    board: "board",
  };
  const key = map[type] || tileAssetKey("floor");
  const src = gameState.assets.images[key] || "";
  const hasImageAsset = !gameState.assets.missing[key];
  return { src, symbol, hasImageAsset };
}

function shouldShowTileSymbol(vis, sprite) {
  return !!vis.symbol && !sprite.hasImageAsset;
}

function getTileClassNames({ vis, x, y, focusEnemy, area, objHere, itemHere }) {
  const classes = ["tile"];
  if (vis.type === "player") classes.push("player-tile");
  classes.push(isVisible(x, y) ? "tile-visible" : "tile-memory");
  if (vis.type === "hidden") classes.push("tile-hidden");
  if (focusEnemy && focusEnemy.x === x && focusEnemy.y === y) classes.push("tile-focus");
  if ((objHere && distance(objHere, area.playerPos) <= 1) || (itemHere && distance(itemHere, area.playerPos) <= 1)) classes.push("tile-interact");
  if (gameState.input.lookMode && gameState.ui.lookCursor?.x === x && gameState.ui.lookCursor?.y === y) classes.push("tile-look-cursor");
  return classes.join(" ");
}

function buildTileHtml({ className, x, y, sprite, tip, vis }) {
  const facingRight = vis.facing === 1 || vis.facing?.x === 1;
  const entityFlipClass = sprite.hasImageAsset && (vis.type === "player" || vis.type === "enemy") && facingRight ? "entity-flip-x" : "";
  const symbolFlipClass = facingRight ? "flip-x" : "";
  const symbolHtml = shouldShowTileSymbol(vis, sprite) ? `<span class="${symbolFlipClass} sym-${vis.type}">${vis.symbol}</span>` : "";
  const facingHtml = vis.type === "player" ? renderFacingIndicator() : "";
  return `<div class="${className} ${entityFlipClass}" data-map-x="${x}" data-map-y="${y}" style="background-image:url('${sprite.src}')"${tip}>${symbolHtml}${facingHtml}</div>`;
}

function renderFacingIndicator() {
  if (!gameState.input.lookMode) return "";
  const f = facingToVector();
  let arrow = "→";
  if (f.x === -1) arrow = "←";
  if (f.y === -1) arrow = "↑";
  if (f.y === 1) arrow = "↓";
  return `<span class="facing-indicator">${arrow}</span>`;
}

function tileVisual(area, x, y) {
  const temporarilyVisibleInLook = gameState.phase === "playing" && gameState.input.lookMode && isVisible(x, y);
  if (!isDiscovered(x, y) && !temporarilyVisibleInLook) return { type: "hidden", symbol: "" };
  const p = area.playerPos;
  if (p.x === x && p.y === y) return { type: "player", symbol: "🦭", facing: gameState.player.facing };

  const e = isEnemyVisibleAt(area, x, y) ? enemyAt(area, x, y) : null;
  if (e) return { type: "enemy", symbol: getEnemyType(e).emoji, facing: e.facing || -1 };

  const it = itemAt(area, x, y);
  if (it) {
    if (it.type === "H") return { type: "heal", symbol: "🌿" };
    if (it.type === "OXY") return { type: "oxygen", symbol: "🫧" };
    if (it.type === "F_SMALL") return { type: "item", symbol: "🐟" };
    if (it.type === "F_BIG") return { type: "item", symbol: "🐠" };
    if (it.type === "TENGU" || it.type === "MIZU") return { type: "item", symbol: "💪" };
  }

  const obj = objectAt(area, x, y);
  if (obj) {
    const def = getObjectTypeDef(obj.type);
    if (def) {
      const symbol = typeof def.getSymbol === "function" ? def.getSymbol(obj) : def.symbol;
      return { type: def.renderType, symbol };
    }
  }

  const tile = tileAt(area, x, y);
  if (tile === "wall") return { type: "wall", symbol: "", facing: "right" };
  if (tile === "poison") return { type: "floor", symbol: "☣️", facing: "right" };
  if (tile === "hole") return { type: "floor", symbol: "🕳️", facing: "right" };
  if (tile === "water") return { type: "floor", symbol: "💧", facing: "right" };
  return { type: "floor", symbol: "", facing: "right" };
}

function renderEnemyCompact() {
  const hover = gameState.ui.hoverEnemy;
  if (!hover) return `<div class="enemy-compact empty">敵: -</div>`;
  return `<div class="enemy-compact"><strong>${hover.name}</strong><span>HP ${hover.hp} / ATK ${hover.attack}</span></div>`;
}

function renderInventoryEntry(slot, idx) {
  const slotLabel = String(idx + 1).padStart(2, "0");
  if (!slot) {
    return `
      <div class="inventory-entry empty" data-slot-index="${idx}">
        <span class="slot-index">#${slotLabel}</span>
        <span class="slot-icon">—</span>
        <span class="slot-label">空きスロット</span>
      </div>
    `;
  }
  const equipped = isEquipped(slot.type);
  return `
    <button data-slot-index="${idx}" class="inventory-entry" title="アイテムを使う">
      <span class="slot-index">#${slotLabel}</span>
      <span class="slot-icon">${slot.emoji || "🎒"}</span>
      <span class="slot-label">${slot.name}</span>
      <span class="slot-state">${equipped ? "装備中" : ""}</span>
    </button>
  `;
}

function renderInventoryBox() {
  const slots = gameState.player.inventory.slice(0, CONFIG.inventorySlots);
  while (slots.length < CONFIG.inventorySlots) slots.push(null);
  const slotsHtml = slots.map((slot, idx) => renderInventoryEntry(slot, idx)).join("");
  const carryCount = slots.filter(Boolean).length;
  return `
    <div class="inventory-box">
      <div class="inventory-head">
        <span class="inventory-label">インベントリ</span>
        <span class="inventory-count">${carryCount}/${CONFIG.inventorySlots}</span>
      </div>
      <div class="inventory-list">${slotsHtml}</div>
    </div>
  `;
}

function renderBoardSupport(area, cam, hint) {
  return `
    <aside class="stage-corner-panel">
      ${renderMiniMap(area, cam)}
      ${renderEnemyCompact()}
      <div class="hint-side">${hint || ""}</div>
      ${renderInventoryBox()}
    </aside>
  `;
}

function renderBoardStage(area, cam, hint) {
  return `
    <div class="dungeon-stage">
      <div class="stage-main">
        ${renderBoard(area, cam)}
      </div>
      ${renderBoardSupport(area, cam, hint)}
    </div>
  `;
}

function renderBoard(area, cam) {
  const focusEnemy = findNearest(area, area.playerPos, area.enemies.filter((e) => e.hp > 0 && isEnemyVisibleAt(area, e.x, e.y)));
  let html = `<div class="board-pane"><div class="grid-wrap"><div class="grid" style="grid-template-columns: repeat(${cam.w}, ${CONFIG.tileSize}px)">`;

  for (let y = cam.y0; y < cam.y0 + cam.h; y++) {
    for (let x = cam.x0; x < cam.x0 + cam.w; x++) {
      const vis = tileVisual(area, x, y);
      const sprite = spriteForTile(vis.type, vis.symbol);
      let tip = "";
      if (vis.type === "enemy") {
        const enemy = enemyAt(area, x, y);
        if (enemy) {
          const t = getEnemyType(enemy);
          tip = ` title="${t.name} HP ${enemy.hp} / ATK ${t.attack}"`;
        }
      }
      const objHere = objectAt(area, x, y);
      const itemHere = itemAt(area, x, y);
      const className = getTileClassNames({ vis, x, y, focusEnemy, area, objHere, itemHere });
      html += buildTileHtml({ className, x, y, sprite, tip, vis });
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

function renderArea(area, hint, overlays = "") {
  const cam = cameraFor(area);
  return `
    <div class="field-shell">
      ${renderBoardStage(area, cam, hint)}
      ${overlays}
    </div>
  `;
}

function renderHudBar() {
  if (!hudEl) {
    console.error("[render] #hud not found");
    return;
  }
  const hpRatio = Math.max(0, Math.min(1, gameState.player.hp / gameState.player.maxHp));
  const oxygenRatio = Math.max(0, Math.min(1, gameState.player.oxygen / gameState.player.maxOxygen));
  const hpState = hpRatio > 0.6 ? "safe" : hpRatio > 0.3 ? "mid" : "low";
  const dungeonName = gameState.phase === "playing" ? getDungeonDef(gameState.dungeon?.id).name : "拠点";
  const floorLabel = gameState.phase === "playing" ? `${gameState.dungeon.depth}F` : "-";
  hudEl.innerHTML = `
    <div class="hud-bar">
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
  if (!logEl) {
    console.error("[render] #log not found");
    return;
  }
  const msgs = gameState.ui.messages.slice(0, CONFIG.logLimit);
  const [latest = "..."] = msgs;
  if (gameState.phase === "gameover") {
    logEl.innerHTML = `<div class="message-fixed latest">${latest}</div>`;
    return;
  }
  logEl.innerHTML = msgs
    .map((msg, idx) => `<div class="message-fixed ${idx === 0 ? "latest" : "older"}">${msg || ""}</div>`)
    .join("");
}

function renderStatusPanel() {
  if (!gameState.ui.statusOpen) return "";
  return `
    <div class="status-overlay">
      <h3>STATUS</h3>
      <div>LV ${gameState.player.level}</div>
      <div>EXP ${gameState.player.exp}/${gameState.player.nextExp}</div>
      <div>Lung ${gameState.player.breathSteps}/${CONFIG.lungCapacity}</div>
      <div class="meta">P: 閉じる</div>
    </div>
  `;
}

function missionHintText() {
  const cleared = gameState.meta.clearedDungeons;
  if (!cleared.urayama || !cleared.forest) {
    const list = [];
    if (!cleared.urayama) list.push("裏山: 商人救出");
    if (!cleared.forest) list.push("もり: 教官救助");
    return `依頼: ${list.join(" / ")}`;
  }
  return "依頼: 追加探索で魚を集めよう";
}

function render() {
  if (!hasRequiredUiRoots()) return;
  debugFlow("render", { phase: gameState.phase });
  renderHudBar();

  if (gameState.phase === "town") {
    viewEl.className = gameState.town.upgradedVisual ? "town-upgraded" : "";
    const townHint = [missionHintText(), gameState.town.hint].filter(Boolean).join(" / ");
    viewEl.innerHTML = renderArea(gameState.town.map, townHint, renderStatusPanel());
  }

  if (gameState.phase === "playing") {
    viewEl.className = gameState.dungeon.unstable ? "floor-unstable" : "";
    viewEl.innerHTML = renderArea(gameState.dungeon.floor, gameState.dungeon.hint, renderStatusPanel());
  }

  if (gameState.phase === "gameover") {
    viewEl.className = "";
    viewEl.innerHTML = `<div class="field-shell"><h2>ゲームオーバー</h2><p>再挑戦しますか？</p><div class="phase-actions"><button data-action='RESTART'>町へ戻る</button></div></div>`;
  }

  renderMessageBox();
}

function findInteractiveTarget(e, selector) {
  const direct = e.target instanceof Element ? e.target.closest(selector) : null;
  debugUi("click target", {
    selector,
    type: e.type,
    targetTag: e.target && e.target.nodeName ? e.target.nodeName : typeof e.target,
    hasDirect: !!direct,
    client: [e.clientX, e.clientY],
  });
  if (direct) return direct;
  if (typeof e.clientX !== "number" || typeof e.clientY !== "number") return null;
  const stack = document.elementsFromPoint(e.clientX, e.clientY);
  debugUi(
    "elementsFromPoint",
    stack.slice(0, 5).map((el) => {
      const tag = el.tagName ? el.tagName.toLowerCase() : "unknown";
      const id = el.id ? `#${el.id}` : "";
      const cls = el.className ? `.${String(el.className).trim().replace(/\s+/g, ".")}` : "";
      return `${tag}${id}${cls}`;
    })
  );
  return stack.find((el) => el instanceof HTMLElement && el.matches(selector)) || null;
}

document.addEventListener("click", (e) => {
  const btn = findInteractiveTarget(e, "button[data-action]");
  debugUi("action click resolved", { found: !!btn, action: btn?.dataset?.action || null });
  if (!btn) return;
  dispatch(btn.dataset.action, { style: btn.dataset.style, dungeon: btn.dataset.dungeon });
  return true;
});

document.addEventListener("click", (e) => {
  const slotBtn = findInteractiveTarget(e, "[data-slot-index]");
  if (!slotBtn) return;
  dispatch("USE_ITEM", { index: Number(slotBtn.dataset.slotIndex), consumeTurn: true });
});

if (viewEl) {
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
} else {
  console.error("[ui] #view not found; pointer interactions are disabled");
}

window.addEventListener("keydown", (e) => {
  if (DIRS[e.key] && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    if (gameState.input.lookMode) {
      dispatch("LOOK_FACE", { dx: DIRS[e.key].x, dy: DIRS[e.key].y });
      return;
    }
    dispatch("MOVE", { dx: DIRS[e.key].x, dy: DIRS[e.key].y });
  }
  if (e.key === "Shift" && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    dispatch("SET_LOOK_MODE", { active: true });
  }
  if ((e.key === "e" || e.key === "E") && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    dispatch("INTERACT");
  }
  if ((e.key === "z" || e.key === "Z") && gameState.phase === "playing") {
    e.preventDefault();
    dispatch("ATTACK");
  }
  if ((e.key === "x" || e.key === "X") && gameState.phase === "playing") {
    e.preventDefault();
    dispatch("SPECIAL");
  }
  if ((e.key === " " || e.code === "Space") && gameState.phase === "playing") {
    e.preventDefault();
    dispatch("WAIT");
  }
  if ((e.key === "p" || e.key === "P") && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    dispatch("TOGGLE_STATUS");
  }
  if ((e.key === "c" || e.key === "C") && gameState.phase === "playing") {
    e.preventDefault();
    dispatch("TOGGLE_LOOK");
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "Shift" && (gameState.phase === "town" || gameState.phase === "playing")) {
    e.preventDefault();
    dispatch("SET_LOOK_MODE", { active: false });
  }
});

loadAssets();
startEffectLoop();
startTown();
addLog("村に着いた。入口に入って探索を始めよう。");
render();
