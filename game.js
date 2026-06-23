// ============ 游戏核心逻辑 ============

// ===== 常量配置 =====
const CONFIG = {
    MAP_SIZE: 500,
    TILE_SIZE: 16,
    GAME_DURATION: 30 * 60,
    MAX_PLAYERS: 30,
    MAX_STEVE: 3,

    // 速度（格/秒）
    STEVE_SPEED: 5,
    ZOMBIE_SPEED: 6,
    SKELETON_SPEED: 6,
    CREEPER_SPEED: 6,
    FISH_SPEED: 10,
    WATER_SLOW: 0.3,

    // 史蒂夫
    STEVE_HP: 20,
    STEVE_LIVES: 3,
    STEVE_ARMOR: 0.2,
    STEVE_REGEN_INTERVAL: 10,

    // 铁剑
    SWORD_DAMAGE: 6,
    SWORD_DURABILITY: 200,
    SWORD_RANGE: 3,
    SWORD_COOLDOWN: 0.6,
    SLASH_ANGLE: Math.PI / 3,

    // 弓箭
    BOW_DAMAGE_MIN: 2,
    BOW_DAMAGE_MAX: 8,
    BOW_RANGE: 30,
    BOW_CHARGE_TIME: 1,
    BOW_COOLDOWN: 0.2,
    ARROW_SPEED: 20,
    MAX_ARROWS: 64,

    // 药水
    POTION_HEAL: 4,

    // 补给
    SUPPLY_COOLDOWN: 300,
    SUPPLY_RANGE: 3,

    // 怪物
    ZOMBIE_HP: 20,
    ZOMBIE_DAMAGE: 4,
    ZOMBIE_RANGE: 3,
    SKELETON_HP: 20,
    SKELETON_DAMAGE: 4,
    SKELETON_RANGE: 30,
    CREEPER_HP: 20,
    FISH_HP: 10,
    FISH_DAMAGE: 10,
    FISH_RANGE: 3,

    // 击退
    KNOCKBACK_DIST: 1.5,
    KNOCKBACK_TIME: 0.2,

    // 复活
    MONSTER_RESPAWN: 5,

    // 小地图
    MINIMAP_RANGE: 60,
};

const CREEPER_DMG = {1: 20, 2: 15, 3: 8, 4: 3, 5: 1};

// ===== 游戏状态 =====
let gameState = {
    phase: 'login',
    myId: null,
    myTeam: null,
    myMonster: null,
    myName: '鼠鼠',
    roomId: null,
    map: [],
    players: {},
    projectiles: [],
    aiMonsters: [],
    aiFish: [],
    effects: [],
    droppedItems: [],
    timeLeft: CONFIG.GAME_DURATION,
    camera: {x: 0, y: 0},
    supplyTimer: 0,
    supplyReady: true,
};

// ===== 本地玩家 =====
let localPlayer = {
    x: 250, y: 250,
    hp: 20, maxHp: 20,
    lives: 3,
    arrows: 64,
    potions: 1,
    swordDurability: 200,
    alive: true,
    respawnTimer: 0,
    swordCooldown: 0,
    bowCooldown: 0,
    bowCharging: false,
    bowChargeStart: 0,
    regenTimer: 0,
    inWater: false,
    knockback: false,
    knockbackTimer: 0,
    knockbackDirX: 0,
    knockbackDirY: 0,
    knockbackSpeed: 0,
    lastWeapon: 'sword',
    slashActive: false,
    slashTimer: 0,
    slashAngle: 0,
    aimAngle: 0,
    facingAngle: 0,
};

// ===== 输入 =====
let input = {
    keys: {},
    joystickDir: {x: 0, y: 0},
    joystickActive: false,
    aimDir: {x: 0, y: 0},
    aimActive: false,
};

// ===== Canvas变量 =====
let canvas, ctx, minimapCanvas, minimapCtx;
let screenW, screenH;
let viewTileSize;
let waterFrame = 0, waterTimer = 0;
let lastTime = 0;
let syncTimer = 0;

// ============ 地图生成（大河流）============

function generateMap(seed) {
    const map = [];
    for (let y = 0; y < CONFIG.MAP_SIZE; y++) {
        map[y] = [];
        for (let x = 0; x < CONFIG.MAP_SIZE; x++) {
            map[y][x] = 0;
        }
    }

    const rng = seededRNG(seed);
    let totalWater = 0;
    let targetWater = CONFIG.MAP_SIZE * CONFIG.MAP_SIZE * 0.5;

    // 生成3~5条主河流
    let riverCount = 3 + Math.floor(rng() * 3);
    for (let r = 0; r < riverCount; r++) {
        let river = generateRiver(rng, CONFIG.MAP_SIZE);
        for (let point of river) {
            let cx = Math.floor(point.x);
            let cy = Math.floor(point.y);
            let width = Math.floor(point.w);
            for (let dy = -width; dy <= width; dy++) {
                for (let dx = -width; dx <= width; dx++) {
                    let mx = cx + dx;
                    let my = cy + dy;
                    if (mx >= 0 && mx < CONFIG.MAP_SIZE && my >= 0 && my < CONFIG.MAP_SIZE) {
                        if (dx * dx + dy * dy <= width * width && map[my][mx] === 0) {
                            map[my][mx] = 1;
                            totalWater++;
                        }
                    }
                }
            }
        }
    }

    // 补充水域到50%
    let attempts = 0;
    while (totalWater < targetWater && attempts < 20) {
        let river = generateRiver(rng, CONFIG.MAP_SIZE);
        for (let point of river) {
            let cx = Math.floor(point.x);
            let cy = Math.floor(point.y);
            let width = Math.floor(point.w);
            for (let dy = -width; dy <= width; dy++) {
                for (let dx = -width; dx <= width; dx++) {
                    let mx = cx + dx;
                    let my = cy + dy;
                    if (mx >= 0 && mx < CONFIG.MAP_SIZE && my >= 0 && my < CONFIG.MAP_SIZE) {
                        if (dx * dx + dy * dy <= width * width && map[my][mx] === 0) {
                            map[my][mx] = 1;
                            totalWater++;
                        }
                    }
                }
            }
        }
        attempts++;
    }

    // 中心区域保证是陆地
    let center = Math.floor(CONFIG.MAP_SIZE / 2);
    for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
            let mx = center + dx;
            let my = center + dy;
            if (mx >= 0 && mx < CONFIG.MAP_SIZE && my >= 0 && my < CONFIG.MAP_SIZE) {
                map[my][mx] = 0;
            }
        }
    }

    return map;
}

function generateRiver(rng, mapSize) {
    let points = [];
    let side = Math.floor(rng() * 4);
    let sx, sy, baseAngle;

    switch (side) {
        case 0: sx = 0; sy = rng() * mapSize; baseAngle = 0; break;
        case 1: sx = mapSize; sy = rng() * mapSize; baseAngle = Math.PI; break;
        case 2: sx = rng() * mapSize; sy = 0; baseAngle = Math.PI / 2; break;
        case 3: sx = rng() * mapSize; sy = mapSize; baseAngle = -Math.PI / 2; break;
    }

    let x = sx, y = sy;
    let angle = baseAngle + (rng() - 0.5) * 0.5;
    let width = 8 + rng() * 15;

    let steps = 200 + Math.floor(rng() * 300);
    for (let i = 0; i < steps; i++) {
        points.push({x: x, y: y, w: width});
        angle += (rng() - 0.5) * 0.15;
        width += (rng() - 0.5) * 1.5;
        width = Math.max(8, Math.min(30, width));
        x += Math.cos(angle) * 3;
        y += Math.sin(angle) * 3;
        if (x < -20 || x > mapSize + 20 || y < -20 || y > mapSize + 20) break;
    }
    return points;
}

function seededRNG(seed) {
    let s = seed || 12345;
    return function() {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (s >>> 0) / 4294967296;
    };
}

// ===== 工具函数 =====

function getRandomLandPos() {
    let x, y, attempts = 0;
    do {
        x = Math.floor(Math.random() * CONFIG.MAP_SIZE);
        y = Math.floor(Math.random() * CONFIG.MAP_SIZE);
        attempts++;
    } while (gameState.map[y] && gameState.map[y][x] === 1 && attempts < 1000);
    return {x, y};
}

function getRandomWaterPos() {
    let x, y, attempts = 0;
    do {
        x = Math.floor(Math.random() * CONFIG.MAP_SIZE);
        y = Math.floor(Math.random() * CONFIG.MAP_SIZE);
        attempts++;
    } while (gameState.map[y] && gameState.map[y][x] === 0 && attempts < 1000);
    return {x, y};
}

function distBetween(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function angleBetween(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

function getMySpeed() {
    if (gameState.myTeam === 'steve') return CONFIG.STEVE_SPEED;
    switch (gameState.myMonster) {
        case 'zombie': return CONFIG.ZOMBIE_SPEED;
        case 'skeleton': return CONFIG.SKELETON_SPEED;
        case 'creeper': return CONFIG.CREEPER_SPEED;
        case 'fish': return CONFIG.FISH_SPEED;
        default: return 5;
    }
}

// ============ 初始化 ============

function initGame() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    minimapCanvas = document.getElementById('minimap-canvas');
    minimapCtx = minimapCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    Renderer.init();
    drawLoginIcons();
    setupInput();
    setupHearts();

    document.getElementById('name-input').addEventListener('input', checkJoinBtn);
    checkJoinBtn();

    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    canvas.width = screenW;
    canvas.height = screenH;
    viewTileSize = Math.floor(Math.min(screenW / 28, screenH / 18));
    if (viewTileSize < 16) viewTileSize = 16;
}

function drawLoginIcons() {
    let pairs = [
        ['steve-icon', 'steve', 45],
        ['monster-icon', 'creeper', 45],
        ['zombie-icon', 'zombie', 35],
        ['skeleton-icon', 'skeleton', 35],
        ['creeper-icon', 'creeper', 35],
        ['fish-icon', 'fish', 35],
    ];
    pairs.forEach(([id, type, size]) => {
        let el = document.getElementById(id);
        if (el && Renderer.cache[type]) {
            let c = el.getContext('2d');
            c.imageSmoothingEnabled = false;
            let offset = (el.width - size) / 2;
            c.drawImage(Renderer.cache[type], offset, offset, size, size);
        }
    });
}

function setupHearts() {
    let container = document.getElementById('hearts-container');
    container.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        let heart = document.createElement('canvas');
        heart.width = 13;
        heart.height = 13;
        heart.className = 'heart';
        heart.id = 'heart-' + i;
        container.appendChild(heart);
    }
    updateHearts();
}

function updateHearts() {
    for (let i = 0; i < 10; i++) {
        let heartCanvas = document.getElementById('heart-' + i);
        if (!heartCanvas) continue;
        let hctx = heartCanvas.getContext('2d');
        hctx.clearRect(0, 0, 13, 13);
        hctx.imageSmoothingEnabled = false;

        let heartHp = localPlayer.hp - i * 2;
        let img;
        if (heartHp >= 2) img = Renderer.cache.heartFull;
        else if (heartHp === 1) img = Renderer.cache.heartHalf;
        else img = Renderer.cache.heartEmpty;

        if (img) hctx.drawImage(img, 0, 0, 13, 13);
    }
}

// ============ 界面逻辑 ============

let selectedTeam = null;
let selectedMonster = null;

function selectTeam(team) {
    selectedTeam = team;
    document.getElementById('btn-steve').classList.toggle('selected', team === 'steve');
    document.getElementById('btn-monster').classList.toggle('selected', team === 'monster');
    document.getElementById('monster-select').classList.toggle('show', team === 'monster');
    if (team === 'steve') selectedMonster = null;
    checkJoinBtn();
}

function selectMonster(monster) {
    selectedMonster = monster;
    document.querySelectorAll('.monster-btn').forEach(b => b.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    checkJoinBtn();
}

function checkJoinBtn() {
    let name = document.getElementById('name-input').value.trim();
    let canJoin = selectedTeam && (selectedTeam === 'steve' || selectedMonster) && name;
    document.getElementById('join-btn').disabled = !canJoin;
}

function joinGame() {
    let name = document.getElementById('name-input').value.trim() || '鼠鼠';
    gameState.myTeam = selectedTeam;
    gameState.myMonster = selectedMonster;
    gameState.myName = name;

    if (selectedTeam === 'steve') {
        localPlayer.maxHp = CONFIG.STEVE_HP;
        localPlayer.hp = CONFIG.STEVE_HP;
        localPlayer.lives = CONFIG.STEVE_LIVES;
        localPlayer.arrows = CONFIG.MAX_ARROWS;
        localPlayer.swordDurability = CONFIG.SWORD_DURABILITY;
        localPlayer.potions = 1;
    } else {
        switch (selectedMonster) {
            case 'fish':
                localPlayer.maxHp = CONFIG.FISH_HP;
                localPlayer.hp = CONFIG.FISH_HP;
                break;
            default:
                localPlayer.maxHp = 20;
                localPlayer.hp = 20;
        }
        localPlayer.lives = 999;
    }

    NetworkManager.autoJoin({
        name: name,
        team: selectedTeam,
        monster: selectedMonster,
    });
}

// ============ 输入处理 ============

function setupInput() {
    window.addEventListener('keydown', e => {
        input.keys[e.key.toLowerCase()] = true;
        if (gameState.phase !== 'playing') return;
        if (e.key === 'j' || e.key === 'J') attackSword();
        if (e.key === 'k' || e.key === 'K') startBowCharge();
        if (e.key === 'l' || e.key === 'L') usePotion();
    });
    window.addEventListener('keyup', e => {
        input.keys[e.key.toLowerCase()] = false;
        if (e.key === 'k' || e.key === 'K') releaseBow();
    });

    window.addEventListener('mousemove', e => {
        if (!localPlayer.bowCharging) return;
        let cx = screenW / 2;
        let cy = screenH / 2;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            input.aimDir = {x: dx / dist, y: dy / dist};
            localPlayer.aimAngle = Math.atan2(dy, dx);
        }
    });

    setupJoystick();

    let atkBtn = document.getElementById('attack-btn');
    atkBtn.addEventListener('touchstart', e => { e.preventDefault(); attackSword(); });
    atkBtn.addEventListener('mousedown', e => { e.preventDefault(); attackSword(); });

    let bowBtn = document.getElementById('bow-btn');
    bowBtn.addEventListener('touchstart', e => { e.preventDefault(); startBowCharge(); showAimJoystick(); });
    bowBtn.addEventListener('mousedown', e => { e.preventDefault(); startBowCharge(); });
    bowBtn.addEventListener('touchend', e => { releaseBow(); hideAimJoystick(); });
    bowBtn.addEventListener('mouseup', e => { releaseBow(); });

    let potBtn = document.getElementById('potion-btn');
    potBtn.addEventListener('touchstart', e => { e.preventDefault(); usePotion(); });
    potBtn.addEventListener('mousedown', e => { e.preventDefault(); usePotion(); });

    setupAimJoystick();
}

function setupJoystick() {
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    let touching = false;
    let baseRect;

    function handleStart(e) {
        e.preventDefault();
        touching = true;
        input.joystickActive = true;
        baseRect = base.getBoundingClientRect();
    }
    function handleMove(e) {
        if (!touching) return;
        let clientX, clientY;
        if (e.touches) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
        else { clientX = e.clientX; clientY = e.clientY; }
        let centerX = baseRect.left + baseRect.width / 2;
        let centerY = baseRect.top + baseRect.height / 2;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        let dist = Math.sqrt(dx * dx + dy * dy);
        let maxDist = baseRect.width / 2 - 20;
        if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
        stick.style.left = (50 + (dx / baseRect.width) * 100) + '%';
        stick.style.top = (50 + (dy / baseRect.height) * 100) + '%';
        input.joystickDir = {x: dx / maxDist, y: dy / maxDist};
    }
    function handleEnd() {
        touching = false;
        input.joystickActive = false;
        input.joystickDir = {x: 0, y: 0};
        stick.style.left = '50%';
        stick.style.top = '50%';
    }

    base.addEventListener('touchstart', handleStart);
    base.addEventListener('mousedown', handleStart);
    document.addEventListener('touchmove', e => { if (touching) handleMove(e); });
    document.addEventListener('mousemove', e => { if (touching) handleMove(e); });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mouseup', handleEnd);
}

function setupAimJoystick() {
    const base = document.getElementById('aim-base');
    const stick = document.getElementById('aim-stick');
    let touching = false;
    let baseRect;

    function handleStart(e) {
        e.preventDefault();
        touching = true;
        input.aimActive = true;
        baseRect = base.getBoundingClientRect();
    }
    function handleMove(e) {
        if (!touching) return;
        let clientX, clientY;
        if (e.touches) {
            for (let t of e.touches) {
                if (t.clientX > screenW / 2) { clientX = t.clientX; clientY = t.clientY; break; }
            }
            if (!clientX) return;
        } else { clientX = e.clientX; clientY = e.clientY; }
        let centerX = baseRect.left + baseRect.width / 2;
        let centerY = baseRect.top + baseRect.height / 2;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        let dist = Math.sqrt(dx * dx + dy * dy);
        let maxDist = 40;
        if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
        stick.style.left = (50 + (dx / baseRect.width) * 100) + '%';
        stick.style.top = (50 + (dy / baseRect.height) * 100) + '%';
        if (dist > 5) {
            input.aimDir = {x: dx / dist, y: dy / dist};
            localPlayer.aimAngle = Math.atan2(dy, dx);
        }
    }
    function handleEnd() {
        touching = false;
        input.aimActive = false;
        stick.style.left = '50%';
        stick.style.top = '50%';
    }

    base.addEventListener('touchstart', handleStart);
    document.addEventListener('touchmove', e => { if (touching) handleMove(e); });
    document.addEventListener('touchend', e => {
        if (touching) { handleEnd(); releaseBow(); hideAimJoystick(); }
    });
}

function showAimJoystick() {
    document.getElementById('aim-area').style.display = 'block';
    document.getElementById('bow-btn').style.display = 'none';
}
function hideAimJoystick() {
    document.getElementById('aim-area').style.display = 'none';
    document.getElementById('bow-btn').style.display = 'flex';
}

// ============ 战斗系统 ============

function attackSword() {
    if (!localPlayer.alive || gameState.phase !== 'playing') return;
    if (localPlayer.swordCooldown > 0) return;

    localPlayer.swordCooldown = CONFIG.SWORD_COOLDOWN;
    localPlayer.lastWeapon = 'sword';

    if (gameState.myTeam === 'steve') {
        if (localPlayer.swordDurability <= 0) return;
        localPlayer.swordDurability--;

        let target = findNearestEnemy(CONFIG.SWORD_RANGE);
        if (target) {
            let angle = angleBetween(localPlayer.x, localPlayer.y, target.x, target.y);
            triggerSlash(angle);
            sendDamageToTarget(target, CONFIG.SWORD_DAMAGE, angle);
        } else {
            triggerSlash(localPlayer.facingAngle);
        }
    } else {
        if (gameState.myMonster === 'creeper') { creeperExplode(); return; }
        if (gameState.myMonster === 'skeleton') { shootSkeletonArrow(); return; }

        let range = gameState.myMonster === 'fish' ? CONFIG.FISH_RANGE : CONFIG.ZOMBIE_RANGE;
        let damage = gameState.myMonster === 'fish' ? CONFIG.FISH_DAMAGE : CONFIG.ZOMBIE_DAMAGE;
        let target = findNearestSteve(range);
        if (target) {
            let angle = angleBetween(localPlayer.x, localPlayer.y, target.x, target.y);
            triggerSlash(angle);
            sendDamageToTarget(target, damage, angle);
        } else {
            triggerSlash(localPlayer.facingAngle);
        }
    }
    updateHUD();
}

function triggerSlash(angle) {
    localPlayer.slashActive = true;
    localPlayer.slashTimer = 0.2;
    localPlayer.slashAngle = angle;
}

function startBowCharge() {
    if (!localPlayer.alive || gameState.phase !== 'playing') return;
    if (gameState.myTeam !== 'steve') return;
    if (localPlayer.arrows <= 0) return;
    if (localPlayer.bowCooldown > 0) return;

    localPlayer.bowCharging = true;
    localPlayer.bowChargeStart = Date.now();
    localPlayer.lastWeapon = 'bow';
}

function releaseBow() {
    if (!localPlayer.bowCharging) return;
    localPlayer.bowCharging = false;

    if (localPlayer.arrows <= 0) return;
    localPlayer.arrows--;
    localPlayer.bowCooldown = CONFIG.BOW_COOLDOWN;

    let chargeTime = (Date.now() - localPlayer.bowChargeStart) / 1000;
    chargeTime = Math.min(chargeTime, CONFIG.BOW_CHARGE_TIME);
    let ratio = chargeTime / CONFIG.BOW_CHARGE_TIME;
    let damage = Math.round(CONFIG.BOW_DAMAGE_MIN + (CONFIG.BOW_DAMAGE_MAX - CONFIG.BOW_DAMAGE_MIN) * ratio);

    let dirX = input.aimDir.x || Math.cos(localPlayer.aimAngle);
    let dirY = input.aimDir.y || Math.sin(localPlayer.aimAngle);
    if (Math.abs(dirX) < 0.01 && Math.abs(dirY) < 0.01) {
        dirX = Math.cos(localPlayer.facingAngle);
        dirY = Math.sin(localPlayer.facingAngle);
    }

    let arrow = {
        id: gameState.myId + '_' + Date.now(),
        x: localPlayer.x, y: localPlayer.y,
        dirX: dirX, dirY: dirY,
        damage: damage,
        speed: CONFIG.ARROW_SPEED,
        owner: gameState.myId,
        ownerTeam: gameState.myTeam,
        trail: [{x: localPlayer.x, y: localPlayer.y}],
        distTraveled: 0,
    };

    gameState.projectiles.push(arrow);
    NetworkManager.sendProjectile(arrow);
    updateHUD();
}

function shootSkeletonArrow() {
    if (localPlayer.swordCooldown > 0) return;
    localPlayer.swordCooldown = CONFIG.SWORD_COOLDOWN;

    let target = findNearestSteve(CONFIG.SKELETON_RANGE);
    if (!target) return;

    let angle = angleBetween(localPlayer.x, localPlayer.y, target.x, target.y);
    let arrow = {
        id: gameState.myId + '_' + Date.now(),
        x: localPlayer.x, y: localPlayer.y,
        dirX: Math.cos(angle), dirY: Math.sin(angle),
        damage: CONFIG.SKELETON_DAMAGE,
        speed: CONFIG.ARROW_SPEED,
        owner: gameState.myId,
        ownerTeam: 'monster',
        trail: [{x: localPlayer.x, y: localPlayer.y}],
        distTraveled: 0,
    };
    gameState.projectiles.push(arrow);
    NetworkManager.sendProjectile(arrow);
}

function creeperExplode() {
    let px = localPlayer.x, py = localPlayer.y;

    let allTargets = getAllEntities();
    allTargets.forEach(target => {
        if (target.id === gameState.myId) return;
        if (target.team === 'monster' && gameState.myTeam === 'monster') return;
        let dist = distBetween(px, py, target.x, target.y);
        let gridDist = Math.ceil(dist);
        if (gridDist <= 5 && CREEPER_DMG[gridDist]) {
            let angle = angleBetween(px, py, target.x, target.y);
            NetworkManager.sendDamage(target.id, CREEPER_DMG[gridDist], angle);
        }
    });

    gameState.effects.push({type: 'explosion', x: px, y: py, timer: 0.5, maxTimer: 0.5});
    NetworkManager.sendExplosion(px, py);

    localPlayer.hp = 0;
    localPlayer.alive = false;
    handleDeath();
}

function usePotion() {
    if (!localPlayer.alive || gameState.phase !== 'playing') return;
    if (localPlayer.potions <= 0) return;
    if (localPlayer.hp >= localPlayer.maxHp) return;

    localPlayer.potions--;
    localPlayer.hp = Math.min(localPlayer.hp + CONFIG.POTION_HEAL, localPlayer.maxHp);
    updateHUD();
    NetworkManager.syncPlayer();
}
// ============ 查找目标 ============

function findNearestEnemy(range) {
    let nearest = null;
    let nearestDist = range + 0.1;

    Object.values(gameState.players).forEach(p => {
        if (!p.alive || p.id === gameState.myId) return;
        if (gameState.myTeam === 'steve' && p.team === 'steve') return;
        if (gameState.myTeam === 'monster' && p.team === 'monster') return;
        let d = distBetween(localPlayer.x, localPlayer.y, p.x, p.y);
        if (d < nearestDist) { nearestDist = d; nearest = p; }
    });

    // AI怪物（对史蒂夫）
    if (gameState.myTeam === 'steve') {
        gameState.aiMonsters.forEach(m => {
            if (!m.alive) return;
            let d = distBetween(localPlayer.x, localPlayer.y, m.x, m.y);
            if (d < nearestDist) { nearestDist = d; nearest = m; }
        });
        // 鱼群（对史蒂夫）
        (gameState.aiFish || []).forEach(fish => {
            if (!fish.alive) return;
            let d = distBetween(localPlayer.x, localPlayer.y, fish.x, fish.y);
            if (d < nearestDist) { nearestDist = d; nearest = fish; }
        });
    }

    return nearest;
}

function findNearestSteve(range) {
    let nearest = null;
    let nearestDist = range + 0.1;
    Object.values(gameState.players).forEach(p => {
        if (!p.alive || p.team !== 'steve') return;
        let d = distBetween(localPlayer.x, localPlayer.y, p.x, p.y);
        if (d < nearestDist) { nearestDist = d; nearest = p; }
    });
    return nearest;
}

function getAllEntities() {
    let entities = [];
    Object.values(gameState.players).forEach(p => {
        if (p.alive && p.id !== gameState.myId) entities.push(p);
    });
    gameState.aiMonsters.forEach(m => { if (m.alive) entities.push(m); });
    (gameState.aiFish || []).forEach(f => { if (f.alive) entities.push(f); });
    return entities;
}

function sendDamageToTarget(target, damage, angle) {
    NetworkManager.sendDamage(target.id, damage, angle);
}

// ============ 受伤/击退/死亡 ============

function takeDamage(amount, fromAngle) {
    if (!localPlayer.alive) return;

    if (gameState.myTeam === 'steve') {
        amount = Math.round(amount * (1 - CONFIG.STEVE_ARMOR));
        if (amount < 1) amount = 1;
    }

    localPlayer.hp -= amount;
    applyKnockback(fromAngle);

    if (localPlayer.hp <= 0) {
        localPlayer.hp = 0;
        localPlayer.alive = false;
        handleDeath();
    }

    updateHUD();
    NetworkManager.syncPlayer();
}

function applyKnockback(fromAngle) {
    if (fromAngle === undefined || fromAngle === null) return;
    localPlayer.knockback = true;
    localPlayer.knockbackTimer = CONFIG.KNOCKBACK_TIME;
    localPlayer.knockbackDirX = Math.cos(fromAngle);
    localPlayer.knockbackDirY = Math.sin(fromAngle);
    localPlayer.knockbackSpeed = CONFIG.KNOCKBACK_DIST / CONFIG.KNOCKBACK_TIME;
}

function handleDeath() {
    if (gameState.myTeam === 'steve') {
        localPlayer.lives--;
        NetworkManager.sendDrop(localPlayer.x, localPlayer.y, {
            arrows: localPlayer.arrows,
            swordDurability: localPlayer.swordDurability,
            potions: localPlayer.potions,
        });
        localPlayer.arrows = 0;
        localPlayer.swordDurability = 0;
        localPlayer.potions = 0;

        if (localPlayer.lives > 0) {
            localPlayer.respawnTimer = 5;
            showDeath();
        } else {
            NetworkManager.sendPermaDeath();
            showDeath();
            checkGameOver();
        }
    } else {
        localPlayer.respawnTimer = CONFIG.MONSTER_RESPAWN;
        showDeath();
    }
    NetworkManager.syncPlayer();
}

function respawn() {
    localPlayer.alive = true;
    localPlayer.hp = localPlayer.maxHp;
    localPlayer.knockback = false;
    localPlayer.knockbackTimer = 0;

    if (gameState.myTeam === 'steve') {
        localPlayer.x = CONFIG.MAP_SIZE / 2;
        localPlayer.y = CONFIG.MAP_SIZE / 2;
        localPlayer.swordDurability = CONFIG.SWORD_DURABILITY;
        localPlayer.arrows = CONFIG.MAX_ARROWS;
        localPlayer.potions = 1;
    } else {
        let pos;
        if (gameState.myMonster === 'fish') pos = getRandomWaterPos();
        else pos = getRandomLandPos();
        localPlayer.x = pos.x;
        localPlayer.y = pos.y;
    }

    hideDeath();
    updateHUD();
    NetworkManager.syncPlayer();
}

function showDeath() { document.getElementById('death-overlay').style.display = 'flex'; }
function hideDeath() { document.getElementById('death-overlay').style.display = 'none'; }

// ============ 补给/拾取 ============

function checkSupply() {
    if (gameState.myTeam !== 'steve') return;
    if (!localPlayer.alive) return;
    if (!gameState.supplyReady) return;

    let center = CONFIG.MAP_SIZE / 2;
    let dist = distBetween(localPlayer.x, localPlayer.y, center, center);

    if (dist <= CONFIG.SUPPLY_RANGE) {
        gameState.supplyReady = false;
        gameState.supplyTimer = CONFIG.SUPPLY_COOLDOWN;
        localPlayer.arrows = CONFIG.MAX_ARROWS;
        localPlayer.swordDurability = CONFIG.SWORD_DURABILITY;
        localPlayer.potions++;
        updateHUD();
        NetworkManager.syncPlayer();
    }
}

function checkPickup() {
    if (gameState.myTeam !== 'steve') return;
    if (!localPlayer.alive) return;

    gameState.droppedItems = gameState.droppedItems.filter(item => {
        let dist = distBetween(localPlayer.x, localPlayer.y, item.x, item.y);
        if (dist < 1.5) {
            localPlayer.arrows = Math.min(localPlayer.arrows + (item.arrows || 0), CONFIG.MAX_ARROWS);
            if ((item.swordDurability || 0) > localPlayer.swordDurability) {
                localPlayer.swordDurability = item.swordDurability;
            }
            localPlayer.potions += (item.potions || 0);
            NetworkManager.removeDroppedItem(item.id);
            updateHUD();
            return false;
        }
        return true;
    });
}

// ============ 游戏循环 ============

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = timestamp;

    if (gameState.phase === 'playing') {
        update(dt);
        render();
        renderMinimap();
    }

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // 复活倒计时
    if (!localPlayer.alive) {
        if (localPlayer.respawnTimer > 0) {
            localPlayer.respawnTimer -= dt;
            document.getElementById('respawn-timer').textContent =
                Math.ceil(localPlayer.respawnTimer) + '秒后复活...';
            if (localPlayer.respawnTimer <= 0) {
                if (gameState.myTeam === 'steve' && localPlayer.lives <= 0) {
                    // 永久死亡，不复活
                } else {
                    respawn();
                }
            }
        }
        updateProjectiles(dt);
        updateEffects(dt);
        updateTimer(dt);
        return;
    }

    // 击退
    if (localPlayer.knockback) {
        localPlayer.knockbackTimer -= dt;
        let moveX = localPlayer.knockbackDirX * localPlayer.knockbackSpeed * dt;
        let moveY = localPlayer.knockbackDirY * localPlayer.knockbackSpeed * dt;
        let newX = localPlayer.x + moveX;
        let newY = localPlayer.y + moveY;
        newX = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, newX));
        newY = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, newY));

        if (gameState.myMonster === 'fish') {
            let tx = Math.floor(newX), ty = Math.floor(newY);
            if (!(gameState.map[ty] && gameState.map[ty][tx] === 1)) {
                newX = localPlayer.x;
                newY = localPlayer.y;
            }
        }

        localPlayer.x = newX;
        localPlayer.y = newY;

        if (localPlayer.knockbackTimer <= 0) {
            localPlayer.knockback = false;
        }
    }

    // 正常移动
    if (!localPlayer.knockback) {
        let moveX = 0, moveY = 0;

        if (input.keys['w'] || input.keys['arrowup']) moveY -= 1;
        if (input.keys['s'] || input.keys['arrowdown']) moveY += 1;
        if (input.keys['a'] || input.keys['arrowleft']) moveX -= 1;
        if (input.keys['d'] || input.keys['arrowright']) moveX += 1;

        if (input.joystickActive) {
            moveX = input.joystickDir.x;
            moveY = input.joystickDir.y;
        }

        let mag = Math.sqrt(moveX * moveX + moveY * moveY);
        if (mag > 1) { moveX /= mag; moveY /= mag; }

        if (mag > 0.1) {
            localPlayer.facingAngle = Math.atan2(moveY, moveX);
        }

        let speed = getMySpeed();
        let tileX = Math.floor(localPlayer.x);
        let tileY = Math.floor(localPlayer.y);
        localPlayer.inWater = gameState.map[tileY] && gameState.map[tileY][tileX] === 1;

        if (localPlayer.inWater && gameState.myMonster !== 'fish') {
            speed *= CONFIG.WATER_SLOW;
        }

        let newX = localPlayer.x + moveX * speed * dt;
        let newY = localPlayer.y + moveY * speed * dt;
        newX = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, newX));
        newY = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, newY));

        if (gameState.myMonster === 'fish') {
            let ntx = Math.floor(newX), nty = Math.floor(newY);
            if (!(gameState.map[nty] && gameState.map[nty][ntx] === 1)) {
                newX = localPlayer.x;
                newY = localPlayer.y;
            }
        }

        localPlayer.x = newX;
        localPlayer.y = newY;
    }

    // 冷却
    if (localPlayer.swordCooldown > 0) localPlayer.swordCooldown -= dt;
    if (localPlayer.bowCooldown > 0) localPlayer.bowCooldown -= dt;

    // 刀光
    if (localPlayer.slashActive) {
        localPlayer.slashTimer -= dt;
        if (localPlayer.slashTimer <= 0) localPlayer.slashActive = false;
    }

    // 回血
    if (gameState.myTeam === 'steve' && localPlayer.hp < localPlayer.maxHp) {
        localPlayer.regenTimer += dt;
        if (localPlayer.regenTimer >= CONFIG.STEVE_REGEN_INTERVAL) {
            localPlayer.regenTimer = 0;
            localPlayer.hp = Math.min(localPlayer.hp + 1, localPlayer.maxHp);
            updateHUD();
        }
    }

    // 蓄力UI
    if (localPlayer.bowCharging) {
        let charge = (Date.now() - localPlayer.bowChargeStart) / 1000 / CONFIG.BOW_CHARGE_TIME;
        charge = Math.min(charge, 1);
        document.getElementById('aim-charge-fill').style.width = (charge * 100) + '%';
    }

    checkSupply();
    checkPickup();

    // 补给计时
    if (!gameState.supplyReady) {
        gameState.supplyTimer -= dt;
        if (gameState.supplyTimer <= 0) gameState.supplyReady = true;
    }

    updateProjectiles(dt);
    updateEffects(dt);
    updateTimer(dt);

    // 网络同步
    syncTimer += dt;
    if (syncTimer > 0.08) {
        syncTimer = 0;
        NetworkManager.syncPlayer();
    }

    // 水动画
    waterTimer += dt;
    if (waterTimer > 0.4) { waterTimer = 0; waterFrame++; }
}

function updateProjectiles(dt) {
    gameState.projectiles = gameState.projectiles.filter(arrow => {
        arrow.x += arrow.dirX * arrow.speed * dt;
        arrow.y += arrow.dirY * arrow.speed * dt;
        arrow.distTraveled += arrow.speed * dt;

        arrow.trail.push({x: arrow.x, y: arrow.y});
        if (arrow.trail.length > 20) arrow.trail.shift();

        if (arrow.distTraveled > CONFIG.BOW_RANGE) return false;
        if (arrow.x < 0 || arrow.x >= CONFIG.MAP_SIZE || arrow.y < 0 || arrow.y >= CONFIG.MAP_SIZE) return false;

        // 碰撞（自己的箭才判定）
        if (arrow.owner === gameState.myId) {
            let entities = getAllEntities();
            for (let e of entities) {
                if (arrow.ownerTeam === e.team) continue;
                let d = distBetween(arrow.x, arrow.y, e.x, e.y);
                if (d < 0.8) {
                    let angle = Math.atan2(arrow.dirY, arrow.dirX);
                    NetworkManager.sendDamage(e.id, arrow.damage, angle);
                    gameState.effects.push({type: 'hit', x: arrow.x, y: arrow.y, timer: 0.15, maxTimer: 0.15});
                    return false;
                }
            }
        }

        return true;
    });
}

function updateEffects(dt) {
    gameState.effects = gameState.effects.filter(fx => {
        fx.timer -= dt;
        return fx.timer > 0;
    });
}

function updateTimer(dt) {
    gameState.timeLeft -= dt;
    if (gameState.timeLeft <= 0) {
        gameState.timeLeft = 0;
        endGame('steve');
    }
    let m = Math.floor(gameState.timeLeft / 60);
    let s = Math.floor(gameState.timeLeft % 60);
    document.getElementById('timer').textContent =
        m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
}

// ============ 渲染 ============

function render() {
    ctx.clearRect(0, 0, screenW, screenH);
    ctx.imageSmoothingEnabled = false;

    let camX = localPlayer.x - (screenW / viewTileSize) / 2;
    let camY = localPlayer.y - (screenH / viewTileSize) / 2;
    gameState.camera = {x: camX, y: camY};

    let tilesX = Math.ceil(screenW / viewTileSize) + 2;
    let tilesY = Math.ceil(screenH / viewTileSize) + 2;
    let startX = Math.floor(camX);
    let startY = Math.floor(camY);

    // 地图
    for (let dy = 0; dy < tilesY; dy++) {
        for (let dx = 0; dx < tilesX; dx++) {
            let mx = startX + dx;
            let my = startY + dy;
            let sx = (mx - camX) * viewTileSize;
            let sy = (my - camY) * viewTileSize;
            if (mx < 0 || mx >= CONFIG.MAP_SIZE || my < 0 || my >= CONFIG.MAP_SIZE) {
                ctx.fillStyle = '#111';
                ctx.fillRect(sx, sy, viewTileSize + 1, viewTileSize + 1);
                continue;
            }
            let type = gameState.map[my][mx] === 1 ? 'water' : 'grass';
            Renderer.drawTile(ctx, type, sx, sy, viewTileSize + 1, waterFrame);
        }
    }

    // 补给点（村庄房子）
    let center = CONFIG.MAP_SIZE / 2;
    let houseSize = viewTileSize * 3;
    let houseSX = (center - 1.5 - camX) * viewTileSize;
    let houseSY = (center - 1.5 - camY) * viewTileSize;
    if (Renderer.cache.villageHouse) {
        ctx.drawImage(Renderer.cache.villageHouse, houseSX, houseSY, houseSize, houseSize);
    }
    // 补给倒计时文字
    if (gameState.myTeam === 'steve') {
        if (!gameState.supplyReady) {
            let tl = Math.ceil(gameState.supplyTimer);
            let mm = Math.floor(tl / 60);
            let ss = tl % 60;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(houseSX + houseSize / 2 - 22, houseSY - 16, 44, 14);
            ctx.fillStyle = '#f39c12';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(mm + ':' + ss.toString().padStart(2, '0'), houseSX + houseSize / 2, houseSY - 5);
        } else {
            ctx.fillStyle = '#4ecca3';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('可补给', houseSX + houseSize / 2, houseSY - 5);
        }
    }

    // 掉落物箱子
    gameState.droppedItems.forEach(item => {
        let sx = (item.x - camX) * viewTileSize - viewTileSize * 0.3;
        let sy = (item.y - camY) * viewTileSize - viewTileSize * 0.3;
        Renderer.drawEntity(ctx, 'chest', sx, sy, viewTileSize * 0.8);
    });

    // 其他玩家
    Object.values(gameState.players).forEach(p => {
        if (p.id === gameState.myId || !p.alive) return;
        let sx = (p.x - camX) * viewTileSize;
        let sy = (p.y - camY) * viewTileSize;
        let sprite = p.team === 'steve' ? 'steve' : (p.monster || 'zombie');
        Renderer.drawEntity(ctx, sprite, sx, sy, viewTileSize);

        if (p.team === 'steve') {
            Renderer.drawHeldWeapon(ctx, sx, sy, viewTileSize, p.lastWeapon || 'sword', p.facingAngle || 0);
        }

        ctx.fillStyle = p.team === 'steve' ? '#4ecca3' : '#ff6b6b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name || '', sx + viewTileSize / 2, sy - 5);

        drawEntityHP(ctx, sx, sy, viewTileSize, p.hp, p.maxHp);
    });

    // AI怪物
    gameState.aiMonsters.forEach(m => {
        if (!m.alive) return;
        let sx = (m.x - camX) * viewTileSize;
        let sy = (m.y - camY) * viewTileSize;
        Renderer.drawEntity(ctx, m.type, sx, sy, viewTileSize);
        drawEntityHP(ctx, sx, sy, viewTileSize, m.hp, m.maxHp);
    });

    // 鱼群
    (gameState.aiFish || []).forEach(fish => {
        if (!fish.alive) return;
        let sx = (fish.x - camX) * viewTileSize;
        let sy = (fish.y - camY) * viewTileSize;
        Renderer.drawEntity(ctx, 'fish', sx, sy, viewTileSize);
        drawEntityHP(ctx, sx, sy, viewTileSize, fish.hp, fish.maxHp);
    });

    // 飞行箭矢+轨迹
    gameState.projectiles.forEach(arrow => {
        Renderer.drawArrowTrail(ctx, arrow.trail, camX, camY, viewTileSize);
        let sx = (arrow.x - camX) * viewTileSize;
        let sy = (arrow.y - camY) * viewTileSize;
        let arrowAngle = Math.atan2(arrow.dirY, arrow.dirX);
        Renderer.drawArrow(ctx, sx, sy, viewTileSize, arrowAngle);
    });

    // 特效
    gameState.effects.forEach(fx => {
        if (fx.type === 'explosion') {
            let sx = (fx.x - camX) * viewTileSize;
            let sy = (fx.y - camY) * viewTileSize;
            let progress = 1 - fx.timer / fx.maxTimer;
            let frameIdx = Math.min(4, Math.floor(progress * 5));
            let size = viewTileSize * 5 * (0.5 + progress * 0.5);
            ctx.globalAlpha = fx.timer / fx.maxTimer;
            if (Renderer.cache.explosion && Renderer.cache.explosion[frameIdx]) {
                ctx.drawImage(Renderer.cache.explosion[frameIdx], sx - size / 2, sy - size / 2, size, size);
            }
            ctx.globalAlpha = 1;
        } else if (fx.type === 'hit') {
            let sx = (fx.x - camX) * viewTileSize;
            let sy = (fx.y - camY) * viewTileSize;
            ctx.globalAlpha = fx.timer / fx.maxTimer;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(sx, sy, viewTileSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    });

    // 本地玩家
    if (localPlayer.alive) {
        let sx = (localPlayer.x - camX) * viewTileSize;
        let sy = (localPlayer.y - camY) * viewTileSize;
        let sprite = gameState.myTeam === 'steve' ? 'steve' : (gameState.myMonster || 'zombie');
        Renderer.drawEntity(ctx, sprite, sx, sy, viewTileSize);

        // 手持武器
        if (gameState.myTeam === 'steve') {
            Renderer.drawHeldWeapon(ctx, sx, sy, viewTileSize, localPlayer.lastWeapon, localPlayer.facingAngle);
        }

        // 名字
        ctx.fillStyle = gameState.myTeam === 'steve' ? '#4ecca3' : '#ff6b6b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(gameState.myName, sx + viewTileSize / 2, sy - 5);

        // 刀光
        if (localPlayer.slashActive) {
            let progress = 1 - localPlayer.slashTimer / 0.2;
            Renderer.drawSlashEffect(ctx, sx, sy, viewTileSize, localPlayer.slashAngle, progress);
        }

        // 蓄力指示
        if (localPlayer.bowCharging) {
            let charge = (Date.now() - localPlayer.bowChargeStart) / 1000 / CONFIG.BOW_CHARGE_TIME;
            charge = Math.min(charge, 1);
            ctx.strokeStyle = `rgba(52,152,219,${0.5 + charge * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx + viewTileSize / 2, sy + viewTileSize / 2, viewTileSize * 0.8, 0, Math.PI * 2 * charge);
            ctx.stroke();
            // 瞄准线
            let aimLen = viewTileSize * 2;
            let ax = Math.cos(localPlayer.aimAngle) * aimLen;
            let ay = Math.sin(localPlayer.aimAngle) * aimLen;
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(sx + viewTileSize / 2, sy + viewTileSize / 2);
            ctx.lineTo(sx + viewTileSize / 2 + ax, sy + viewTileSize / 2 + ay);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 击退闪烁
        if (localPlayer.knockback) {
            ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
            ctx.fillStyle = 'rgba(255,0,0,0.2)';
            ctx.fillRect(sx, sy, viewTileSize, viewTileSize);
            ctx.globalAlpha = 1;
        }
    }
}

function drawEntityHP(ctx, sx, sy, size, hp, maxHp) {
    if (hp >= maxHp) return;
    let barW = size;
    let barH = 3;
    let barY = sy - 3;
    let ratio = hp / maxHp;
    ctx.fillStyle = '#333';
    ctx.fillRect(sx, barY, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? '#4ecca3' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(sx, barY, barW * ratio, barH);
}

// ============ 小地图 ============

function renderMinimap() {
    let localData = {
        x: localPlayer.x,
        y: localPlayer.y,
        id: gameState.myId,
        team: gameState.myTeam,
    };

    // 合并AI怪物和鱼群给小地图显示
    let allAI = (gameState.aiMonsters || []).concat(gameState.aiFish || []);

    Renderer.drawMinimap(
        minimapCtx,
        gameState.map,
        localData,
        gameState.players,
        allAI,
        gameState.droppedItems,
        CONFIG.MAP_SIZE,
        CONFIG.MINIMAP_RANGE
    );
}

// ============ HUD ============

function updateHUD() {
    updateHearts();

    if (gameState.myTeam === 'steve') {
        document.getElementById('weapon-info').textContent =
            `🗡️ 耐久:${localPlayer.swordDurability} | 🏹 箭:${localPlayer.arrows} | 🧪 药水:${localPlayer.potions}`;
        document.getElementById('lives-info').textContent = `❤️ 复活:${localPlayer.lives}`;
    } else {
        let names = {zombie: '僵尸', skeleton: '骷髅', creeper: '苦力怕', fish: '鱼'};
        document.getElementById('weapon-info').textContent = `👾 ${names[gameState.myMonster] || '怪物'}`;
        document.getElementById('lives-info').textContent = '♾️ 无限复活';
    }
}

// ============ 游戏结束 ============

function endGame(winner) {
    if (gameState.phase === 'ended') return;
    gameState.phase = 'ended';

    let resultScreen = document.getElementById('result-screen');
    let resultText = document.getElementById('result-text');
    let resultDetail = document.getElementById('result-detail');
    resultScreen.style.display = 'flex';

    if (winner === 'steve') {
        if (gameState.myTeam === 'steve') {
            resultText.className = 'win';
            resultText.textContent = '🎉 胜利！';
            resultDetail.textContent = '史蒂夫成功存活30分钟！';
        } else {
            resultText.className = 'lose';
            resultText.textContent = '💀 失败...';
            resultDetail.textContent = '未能在30分钟内消灭史蒂夫';
        }
    } else {
        if (gameState.myTeam === 'monster') {
            resultText.className = 'win';
            resultText.textContent = '🎉 胜利！';
            resultDetail.textContent = '成功消灭了所有史蒂夫！';
        } else {
            resultText.className = 'lose';
            resultText.textContent = '💀 失败...';
            resultDetail.textContent = '所有史蒂夫被消灭了...';
        }
    }

    NetworkManager.sendGameOver(winner);
}

function checkGameOver() {
    let stevesAlive = 0;
    Object.values(gameState.players).forEach(p => {
        if (p.team === 'steve' && (p.lives > 0 || p.alive) && !p.permaDead) stevesAlive++;
    });
    if (gameState.myTeam === 'steve' && localPlayer.lives > 0) stevesAlive++;
    if (stevesAlive === 0) endGame('monster');
}

// ============ 进入游戏 ============

function enterGame(seed, timeLeft) {
    gameState.phase = 'playing';
    gameState.map = generateMap(seed);
    gameState.timeLeft = timeLeft || CONFIG.GAME_DURATION;

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    if (gameState.myTeam === 'steve') {
        localPlayer.x = CONFIG.MAP_SIZE / 2;
        localPlayer.y = CONFIG.MAP_SIZE / 2;
    } else {
        let pos;
        if (gameState.myMonster === 'fish') pos = getRandomWaterPos();
        else pos = getRandomLandPos();
        localPlayer.x = pos.x;
        localPlayer.y = pos.y;
    }

    resizeCanvas();
    updateHUD();
    NetworkManager.syncPlayer();
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', initGame);

