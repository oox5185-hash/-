// ============ 游戏核心逻辑 ============

// 游戏常量
const GAME_CONFIG = {
    MAP_SIZE: 500,
    TILE_SIZE: 16,
    MOVE_SPEED: 5, // 格/秒
    WATER_SLOW: 0.4, // 水中速度倍率（减速60%）
    GAME_DURATION: 30 * 60, // 30分钟（秒）
    MAX_PLAYERS: 30,
    MAX_STEVE: 3,
    STEVE_HP: 20,
    STEVE_LIVES: 3,
    STEVE_REGEN: 10, // 每10秒回1血
    STEVE_ARMOR: 0.2, // 20%减伤
    SWORD_DAMAGE: 6,
    SWORD_DURABILITY: 200,
    SWORD_RANGE: 3,
    SWORD_COOLDOWN: 0.6,
    BOW_DAMAGE_MIN: 2,
    BOW_DAMAGE_MAX: 8,
    BOW_RANGE: 30,
    BOW_CHARGE_TIME: 1,
    BOW_COOLDOWN: 0.2,
    MAX_ARROWS: 64,
    POTION_HEAL: 4,
    SUPPLY_COOLDOWN: 300, // 5分钟
    ZOMBIE_HP: 20,
    ZOMBIE_DAMAGE: 4,
    ZOMBIE_RANGE: 3,
    SKELETON_HP: 20,
    SKELETON_DAMAGE: 4,
    SKELETON_RANGE: 30,
    CREEPER_HP: 20,
    FISH_HP: 10,
    FISH_DAMAGE: 5,
    FISH_RANGE: 3,
    MONSTER_RESPAWN: 5, // 5秒复活
    AI_SPAWN_RATE: 60, // 每60秒刷5个AI
    AI_SPAWN_COUNT: 5,
};

// 苦力怕爆炸伤害表
const CREEPER_DAMAGE = {1: 20, 2: 15, 3: 8, 4: 3, 5: 1};

// 游戏状态
let gameState = {
    phase: 'login', // login, waiting, playing, ended
    myId: null,
    myTeam: null,
    myMonster: null,
    myName: '',
    roomId: null,
    map: [],
    players: {},
    projectiles: [],
    aiMonsters: [],
    effects: [],
    timeLeft: GAME_CONFIG.GAME_DURATION,
    camera: {x: 0, y: 0},
    lastSupplyTime: 0,
};

// 本地玩家状态
let localPlayer = {
    x: 250,
    y: 250,
    hp: 20,
    maxHp: 20,
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
    moveDir: {x: 0, y: 0},
    inWater: false,
    droppedItems: [],
};

// 输入状态
let input = {
    keys: {},
    joystickDir: {x: 0, y: 0},
    joystickActive: false,
};

// Canvas 相关
let canvas, ctx;
let screenWidth, screenHeight;
let viewTileSize; // 实际渲染的每格像素大小
let waterFrame = 0;
let waterAnimTimer = 0;

// ============ 地图生成 ============

function generateMap(seed) {
    const map = [];
    // 使用简单的Perlin-like噪声生成地图
    // seed确保所有玩家生成相同地图
    const random = seededRandom(seed);

    for (let y = 0; y < GAME_CONFIG.MAP_SIZE; y++) {
        map[y] = [];
        for (let x = 0; x < GAME_CONFIG.MAP_SIZE; x++) {
            // 简单噪声：生成水域约50%
            let noise = simplexNoise(x * 0.05, y * 0.05, seed);
            map[y][x] = noise > 0 ? 0 : 1; // 0=草地, 1=水
        }
    }

    // 确保中心点是草地（复活点/补给点）
    for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
            let cx = 250 + dx;
            let cy = 250 + dy;
            if (cx >= 0 && cx < 500 && cy >= 0 && cy < 500) {
                map[cy][cx] = 0;
            }
        }
    }

    return map;
}

// 种子随机数
function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

// 简易噪声函数
function simplexNoise(x, y, seed) {
    let n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    n = n - Math.floor(n);
    // 加入多层噪声使地图更自然
    let n2 = Math.sin(x * 5.123 + y * 3.456 + seed * 2) * 12345.6789;
    n2 = n2 - Math.floor(n2);
    let n3 = Math.sin(x * 25.789 + y * 15.432 + seed * 3) * 67890.1234;
    n3 = n3 - Math.floor(n3);

    let combined = (n * 0.5 + n2 * 0.3 + n3 * 0.2) - 0.5;
    return combined;
}

// ============ 游戏初始化 ============

function initGame() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 初始化贴图
    Renderer.init();
    Renderer.createExplosion();

    // 初始化登录界面图标
    drawLoginIcons();

    // 输入事件
    setupInput();

    // 游戏循环
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    canvas.width = screenWidth;
    canvas.height = screenHeight;

    // 手机上0.5cm约等于19px，PC上我们适配屏幕
    // 设计让屏幕能看到约30x20格
    viewTileSize = Math.floor(Math.min(screenWidth / 30, screenHeight / 20));
    if (viewTileSize < 16) viewTileSize = 16;
}

function drawLoginIcons() {
    // 画史蒂夫图标
    let c = document.getElementById('steve-icon');
    let cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(Renderer.cache.steve, 0, 0, 16, 16, 15, 5, 50, 50);

    // 画怪物图标
    c = document.getElementById('monster-icon');
    cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(Renderer.cache.creeper, 0, 0, 16, 16, 15, 5, 50, 50);

    // 怪物选择图标
    let icons = ['zombie', 'skeleton', 'creeper', 'fish'];
    icons.forEach(name => {
        c = document.getElementById(name + '-icon');
        if (c) {
            cctx = c.getContext('2d');
            cctx.imageSmoothingEnabled = false;
            cctx.drawImage(Renderer.cache[name], 0, 0, 16, 16, 10, 5, 40, 40);
        }
    });
}

// ============ 界面逻辑 ============

let selectedTeam = null;
let selectedMonster = null;

function selectTeam(team) {
    selectedTeam = team;
    document.getElementById('btn-steve').classList.toggle('selected', team === 'steve');
    document.getElementById('btn-monster').classList.toggle('selected', team === 'monster');

    if (team === 'monster') {
        document.getElementById('monster-select').classList.add('show');
    } else {
        document.getElementById('monster-select').classList.remove('show');
        selectedMonster = null;
    }

    checkJoinButton();
}

function selectMonster(monster) {
    selectedMonster = monster;
    document.querySelectorAll('.monster-btn').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    checkJoinButton();
}

function checkJoinButton() {
    const nameInput = document.getElementById('name-input');
    const canJoin = selectedTeam && (selectedTeam === 'steve' || selectedMonster) && nameInput.value.trim();
    document.getElementById('join-btn').disabled = !canJoin;
}

// 监听名字输入
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    document.getElementById('name-input').addEventListener('input', checkJoinButton);
});

// ============ 输入处理 ============

function setupInput() {
    // 键盘
    window.addEventListener('keydown', e => {
        input.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
        input.keys[e.key.toLowerCase()] = false;
    });

    // 虚拟摇杆
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');
    let joystickTouch = null;

    joystickBase.addEventListener('touchstart', e => {
        e.preventDefault();
        joystickTouch = e.touches[0];
        input.joystickActive = true;
    });

    document.addEventListener('touchmove', e => {
        if (!input.joystickActive) return;
        const touch = Array.from(e.touches).find(t => t.identifier === joystickTouch?.identifier) || e.touches[0];
        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 50;

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }

        joystickStick.style.transform = `translate(${dx - 25}px, ${dy - 25}px)`;
        input.joystickDir = {x: dx / maxDist, y: dy / maxDist};
    });

    document.addEventListener('touchend', e => {
        if (e.touches.length === 0) {
            input.joystickActive = false;
            input.joystickDir = {x: 0, y: 0};
            joystickStick.style.transform = 'translate(-50%, -50%)';
        }
    });

    // 攻击按钮
    document.getElementById('attack-btn').addEventListener('touchstart', e => {
        e.preventDefault();
        attackSword();
    });
    document.getElementById('attack-btn').addEventListener('mousedown', e => {
        attackSword();
    });

    // 弓箭按钮
    document.getElementById('bow-btn').addEventListener('touchstart', e => {
        e.preventDefault();
        startBowCharge();
    });
    document.getElementById('bow-btn').addEventListener('mousedown', e => {
        startBowCharge();
    });
    document.getElementById('bow-btn').addEventListener('touchend', e => {
        releaseBow();
    });
    document.getElementById('bow-btn').addEventListener('mouseup', e => {
        releaseBow();
    });

    // 药水按钮
    document.getElementById('potion-btn').addEventListener('touchstart', e => {
        e.preventDefault();
        usePotion();
    });
    document.getElementById('potion-btn').addEventListener('mousedown', e => {
        usePotion();
    });

    // 键盘攻击（PC端）
    window.addEventListener('keydown', e => {
        if (gameState.phase !== 'playing') return;
        if (e.key === 'j' || e.key === 'J') attackSword();
        if (e.key === 'k' || e.key === 'K') startBowCharge();
        if (e.key === 'l' || e.key === 'L') usePotion();
    });
    window.addEventListener('keyup', e => {
        if (e.key === 'k' || e.key === 'K') releaseBow();
    });
}

// ============ 战斗系统 ============

function attackSword() {
    if (!localPlayer.alive) return;
    if (localPlayer.swordCooldown > 0) return;
    if (gameState.myTeam === 'steve' && localPlayer.swordDurability <= 0) return;

    localPlayer.swordCooldown = GAME_CONFIG.SWORD_COOLDOWN;

    if (gameState.myTeam === 'steve') {
        localPlayer.swordDurability--;
        // 找范围内最近敌人
        let target = findNearestEnemy(GAME_CONFIG.SWORD_RANGE);
        if (target) {
            dealDamage(target, GAME_CONFIG.SWORD_DAMAGE);
            NetworkManager.sendAttack('sword', target.id, GAME_CONFIG.SWORD_DAMAGE);
        }
    } else {
        // 怪物攻击
        let range = GAME_CONFIG.ZOMBIE_RANGE;
        let damage = GAME_CONFIG.ZOMBIE_DAMAGE;
        if (gameState.myMonster === 'fish') {
            damage = GAME_CONFIG.FISH_DAMAGE;
            range = GAME_CONFIG.FISH_RANGE;
        }
        if (gameState.myMonster === 'creeper') {
            // 苦力怕爆炸
            creeperExplode();
            return;
        }
        if (gameState.myMonster === 'skeleton') {
            // 骷髅射箭
            shootSkeletonArrow();
            return;
        }
        let target = findNearestSteve(range);
        if (target) {
            dealDamage(target, damage);
            NetworkManager.sendAttack('melee', target.id, damage);
        }
    }
    updateHUD();
}

function startBowCharge() {
    if (!localPlayer.alive) return;
    if (gameState.myTeam !== 'steve') return;
    if (localPlayer.arrows <= 0) return;
    if (localPlayer.bowCooldown > 0) return;

    localPlayer.bowCharging = true;
    localPlayer.bowChargeStart = Date.now();
}

function releaseBow() {
    if (!localPlayer.bowCharging) return;
    localPlayer.bowCharging = false;

    if (localPlayer.arrows <= 0) return;
    localPlayer.arrows--;
    localPlayer.bowCooldown = GAME_CONFIG.BOW_COOLDOWN;

    let chargeTime = (Date.now() - localPlayer.bowChargeStart) / 1000;
    chargeTime = Math.min(chargeTime, GAME_CONFIG.BOW_CHARGE_TIME);
    let damageRatio = chargeTime / GAME_CONFIG.BOW_CHARGE_TIME;
    let damage = Math.round(GAME_CONFIG.BOW_DAMAGE_MIN + (GAME_CONFIG.BOW_DAMAGE_MAX - GAME_CONFIG.BOW_DAMAGE_MIN) * damageRatio);

    // 找目标
    let target = findNearestEnemy(GAME_CONFIG.BOW_RANGE);
    if (target) {
        // 创建箭矢飞行
        let arrow = {
            x: localPlayer.x,
            y: localPlayer.y,
            targetId: target.id,
            targetX: target.x,
            targetY: target.y,
            damage: damage,
            speed: 15, // 格/秒
            owner: gameState.myId,
        };
        gameState.projectiles.push(arrow);
        NetworkManager.sendProjectile(arrow);
    }
    updateHUD();
}

function shootSkeletonArrow() {
    if (localPlayer.swordCooldown > 0) return;
    localPlayer.swordCooldown = GAME_CONFIG.SWORD_COOLDOWN;

    let target = findNearestSteve(GAME_CONFIG.SKELETON_RANGE);
    if (target) {
        let arrow = {
            x: localPlayer.x,
            y: localPlayer.y,
            targetId: target.id,
            targetX: target.x,
            targetY: target.y,
            damage: GAME_CONFIG.SKELETON_DAMAGE,
            speed: 12,
            owner: gameState.myId,
        };
        gameState.projectiles.push(arrow);
        NetworkManager.sendProjectile(arrow);
    }
}

function creeperExplode() {
    // 苦力怕自爆
    let px = localPlayer.x;
    let py = localPlayer.y;

    // 对范围内所有史蒂夫造成伤害
    Object.values(gameState.players).forEach(player => {
        if (player.team === 'steve' && player.alive) {
            let dist = Math.sqrt((player.x - px) ** 2 + (player.y - py) ** 2);
            let gridDist = Math.ceil(dist);
            if (gridDist <= 5) {
                let damage = CREEPER_DAMAGE[gridDist] || 0;
                NetworkManager.sendAttack('explode', player.id, damage);
            }
        }
    });

    // 爆炸特效
    gameState.effects.push({
        type: 'explosion',
        x: px,
        y: py,
        timer: 0.5,
    });

    NetworkManager.sendExplosion(px, py);

    // 自己死亡
    localPlayer.hp = 0;
    localPlayer.alive = false;
    handleDeath();
}

function usePotion() {
    if (!localPlayer.alive) return;
    if (localPlayer.potions <= 0) return;
    if (localPlayer.hp >= localPlayer.maxHp) return;

    localPlayer.potions--;
    localPlayer.hp = Math.min(localPlayer.hp + GAME_CONFIG.POTION_HEAL, localPlayer.maxHp);
    updateHUD();
    NetworkManager.syncPlayer();
}

function findNearestEnemy(range) {
    let nearest = null;
    let nearestDist = range + 1;

    Object.values(gameState.players).forEach(player => {
        if (!player.alive) return;
        if (player.id === gameState.myId) return;

        // 史蒂夫找怪物，怪物找史蒂夫
        if (gameState.myTeam === 'steve' && player.team === 'steve') return;
        if (gameState.myTeam === 'monster' && player.team === 'monster') return;

        let dist = Math.sqrt((player.x - localPlayer.x) ** 2 + (player.y - localPlayer.y) ** 2);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = player;
        }
    });

    // 也检查AI怪物（对于史蒂夫）
    if (gameState.myTeam === 'steve') {
        gameState.aiMonsters.forEach(monster => {
            if (!monster.alive) return;
            let dist = Math.sqrt((monster.x - localPlayer.x) ** 2 + (monster.y - localPlayer.y) ** 2);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = monster;
            }
        });
    }

    return nearest;
}

function findNearestSteve(range) {
    let nearest = null;
    let nearestDist = range + 1;

    Object.values(gameState.players).forEach(player => {
        if (!player.alive) return;
        if (player.team !== 'steve') return;

        let dist = Math.sqrt((player.x - localPlayer.x) ** 2 + (player.y - localPlayer.y) ** 2);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = player;
        }
    });

    return nearest;
}

function dealDamage(target, damage) {
    // 应用护甲减伤
    if (target.team === 'steve') {
        damage = Math.round(damage * (1 - GAME_CONFIG.STEVE_ARMOR));
    }
    // 网络发送伤害
    NetworkManager.sendDamage(target.id, damage);
}

function takeDamage(amount) {
    if (!localPlayer.alive) return;

    // 史蒂夫有护甲
    if (gameState.myTeam === 'steve') {
        amount = Math.round(amount * (1 - GAME_CONFIG.STEVE_ARMOR));
    }

    localPlayer.hp -= amount;
    if (localPlayer.hp <= 0) {
        localPlayer.hp = 0;
        localPlayer.alive = false;
        handleDeath();
    }
    updateHUD();
    NetworkManager.syncPlayer();
}

function handleDeath() {
    if (gameState.myTeam === 'steve') {
        localPlayer.lives--;
        // 掉落装备
        if (localPlayer.x && localPlayer.y) {
            NetworkManager.sendDrop(localPlayer.x, localPlayer.y, {
                arrows: localPlayer.arrows,
                swordDurability: localPlayer.swordDurability,
                potions: localPlayer.potions,
            });
        }
        localPlayer.arrows = 0;
        localPlayer.swordDurability = 0;
        localPlayer.potions = 0;

        if (localPlayer.lives > 0) {
            // 复活倒计时
            localPlayer.respawnTimer = 5;
            showDeathOverlay();
        } else {
            // 彻底死亡
            NetworkManager.sendPermaDeath();
            checkGameOver();
        }
    } else {
        // 怪物5秒后随机复活
        localPlayer.respawnTimer = GAME_CONFIG.MONSTER_RESPAWN;
        showDeathOverlay();
    }
    NetworkManager.syncPlayer();
}

function respawn() {
    localPlayer.alive = true;
    localPlayer.hp = localPlayer.maxHp;

    if (gameState.myTeam === 'steve') {
        // 中心点复活
        localPlayer.x = 250;
        localPlayer.y = 250;
        // 初始装备
        localPlayer.swordDurability = 200;
        localPlayer.arrows = 64;
        localPlayer.potions = 1;
    } else {
        // 随机位置复活
        let pos = getRandomLandPosition();
        if (gameState.myMonster === 'fish') {
            pos = getRandomWaterPosition();
        }
        localPlayer.x = pos.x;
        localPlayer.y = pos.y;
    }

    hideDeathOverlay();
    updateHUD();
    NetworkManager.syncPlayer();
}

function getRandomLandPosition() {
    let x, y;
    do {
        x = Math.floor(Math.random() * GAME_CONFIG.MAP_SIZE);
        y = Math.floor(Math.random() * GAME_CONFIG.MAP_SIZE);
    } while (gameState.map[y] && gameState.map[y][x] === 1);
    return {x, y};
}

function getRandomWaterPosition() {
    let x, y;
    do {
        x = Math.floor(Math.random() * GAME_CONFIG.MAP_SIZE);
        y = Math.floor(Math.random() * GAME_CONFIG.MAP_SIZE);
    } while (gameState.map[y] && gameState.map[y][x] === 0);
    return {x, y};
}

function showDeathOverlay() {
    document.getElementById('death-overlay').style.display = 'flex';
}

function hideDeathOverlay() {
    document.getElementById('death-overlay').style.display = 'none';
}

// ============ 补给系统 ============

function checkSupply() {
    if (gameState.myTeam !== 'steve') return;
    if (!localPlayer.alive) return;

    let dist = Math.sqrt((localPlayer.x - 250) ** 2 + (localPlayer.y - 250) ** 2);
    if (dist <= 2) {
        let now = Date.now() / 1000;
        if (now - gameState.lastSupplyTime >= GAME_CONFIG.SUPPLY_COOLDOWN) {
            // 补给！
            gameState.lastSupplyTime = now;
            localPlayer.arrows = GAME_CONFIG.MAX_ARROWS;
            localPlayer.swordDurability = GAME_CONFIG.SWORD_DURABILITY;
            localPlayer.potions++;
            updateHUD();
        }
    }
}

// ============ 游戏循环 ============

let lastTime = 0;

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // 限制最大帧间隔
    lastTime = timestamp;

    if (gameState.phase === 'playing') {
        update(dt);
        render();
    }

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (!localPlayer.alive) {
        // 复活倒计时
        if (localPlayer.respawnTimer > 0) {
            localPlayer.respawnTimer -= dt;
            document.getElementById('respawn-timer').textContent =
                Math.ceil(localPlayer.respawnTimer) + '秒后复活...';
            if (localPlayer.respawnTimer <= 0) {
                respawn();
            }
        }
        return;
    }

    // 移动
    let moveX = 0, moveY = 0;

    // 键盘输入
    if (input.keys['w'] || input.keys['arrowup']) moveY -= 1;
    if (input.keys['s'] || input.keys['arrowdown']) moveY += 1;
    if (input.keys['a'] || input.keys['arrowleft']) moveX -= 1;
    if (input.keys['d'] || input.keys['arrowright']) moveX += 1;

    // 摇杆输入
    if (input.joystickActive) {
        moveX = input.joystickDir.x;
        moveY = input.joystickDir.y;
    }

    // 标准化
    let moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveMag > 1) {
        moveX /= moveMag;
        moveY /= moveMag;
    }

    // 速度计算
    let speed = GAME_CONFIG.MOVE_SPEED;
    let tileX = Math.floor(localPlayer.x);
    let tileY = Math.floor(localPlayer.y);
    localPlayer.inWater = gameState.map[tileY] && gameState.map[tileY][tileX] === 1;

    if (localPlayer.inWater) {
        if (gameState.myMonster === 'fish') {
            // 鱼在水中不减速
        } else {
            speed *= GAME_CONFIG.WATER_SLOW;
        }
    }

    // 鱼不能上岸
    let newX = localPlayer.x + moveX * speed * dt;
    let newY = localPlayer.y + moveY * speed * dt;

    // 边界检查
    newX = Math.max(0, Math.min(GAME_CONFIG.MAP_SIZE - 1, newX));
    newY = Math.max(0, Math.min(GAME_CONFIG.MAP_SIZE - 1, newY));

    // 鱼的移动限制
    if (gameState.myMonster === 'fish') {
        let newTileX = Math.floor(newX);
        let newTileY = Math.floor(newY);
        if (gameState.map[newTileY] && gameState.map[newTileY][newTileX] !== 1) {
            // 不允许上岸
            newX = localPlayer.x;
            newY = localPlayer.y;
        }
    }

    localPlayer.x = newX;
    localPlayer.y = newY;

    // 冷却更新
    if (localPlayer.swordCooldown > 0) localPlayer.swordCooldown -= dt;
    if (localPlayer.bowCooldown > 0) localPlayer.bowCooldown -= dt;

    // 回血（史蒂夫）
    if (gameState.myTeam === 'steve') {
        localPlayer.regenTimer += dt;
        if (localPlayer.regenTimer >= GAME_CONFIG.STEVE_REGEN) {
            localPlayer.regenTimer = 0;
            if (localPlayer.hp < localPlayer.maxHp) {
                localPlayer.hp++;
                updateHUD();
            }
        }
    }

    // 拾取装备
    checkPickup();

    // 补给
    checkSupply();

    // 更新飞行箭矢
    updateProjectiles(dt);

    // 更新特效
    updateEffects(dt);

    // 更新计时器
    gameState.timeLeft -= dt;
    if (gameState.timeLeft <= 0) {
        // 史蒂夫获胜！
        endGame('steve');
    }
    updateTimer();

    // 网络同步
    NetworkManager.syncPlayer();

    // 水面动画
    waterAnimTimer += dt;
    if (waterAnimTimer > 0.5) {
        waterAnimTimer = 0;
        waterFrame++;
    }
}

function updateProjectiles(dt) {
    gameState.projectiles = gameState.projectiles.filter(arrow => {
        // 移动箭矢向目标
        let target = gameState.players[arrow.targetId] || gameState.aiMonsters.find(m => m.id === arrow.targetId);
        let tx = target ? target.x : arrow.targetX;
        let ty = target ? target.y : arrow.targetY;

        let dx = tx - arrow.x;
        let dy = ty - arrow.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.5) {
            // 命中
            if (target && target.alive && arrow.owner === gameState.myId) {
                NetworkManager.sendDamage(arrow.targetId, arrow.damage);
            }
            return false;
        }

        arrow.x += (dx / dist) * arrow.speed * dt;
        arrow.y += (dy / dist) * arrow.speed * dt;

        // 超出范围消失
        let travelDist = Math.sqrt((arrow.x - arrow.startX || 0) ** 2 + (arrow.y - arrow.startY || 0) ** 2);
        if (dist > 35) return false;

        return true;
    });
}

function updateEffects(dt) {
    gameState.effects = gameState.effects.filter(fx => {
        fx.timer -= dt;
        return fx.timer > 0;
    });
}

function checkPickup() {
    if (gameState.myTeam !== 'steve') return;

    // 检查掉落物
    gameState.droppedItems = gameState.droppedItems || [];
    gameState.droppedItems.forEach((item, index) => {
        let dist = Math.sqrt((item.x - localPlayer.x) ** 2 + (item.y - localPlayer.y) ** 2);
        if (dist < 1.5) {
            // 拾取
            localPlayer.arrows = Math.min(localPlayer.arrows + (item.arrows || 0), GAME_CONFIG.MAX_ARROWS);
            localPlayer.swordDurability = Math.max(localPlayer.swordDurability, item.swordDurability || 0);
            localPlayer.potions += (item.potions || 0);
            gameState.droppedItems.splice(index, 1);
            NetworkManager.removeDroppedItem(item.id);
            updateHUD();
        }
    });
}

// ============ 渲染 ============

function render() {
    ctx.clearRect(0, 0, screenWidth, screenHeight);
    ctx.imageSmoothingEnabled = false;

    // 相机跟随玩家
    gameState.camera.x = localPlayer.x - (screenWidth / viewTileSize) / 2;
    gameState.camera.y = localPlayer.y - (screenHeight / viewTileSize) / 2;

    let tilesX = Math.ceil(screenWidth / viewTileSize) + 2;
    let tilesY = Math.ceil(screenHeight / viewTileSize) + 2;

    let startX = Math.floor(gameState.camera.x);
    let startY = Math.floor(gameState.camera.y);

    // 绘制地图
    for (let dy = 0; dy < tilesY; dy++) {
        for (let dx = 0; dx < tilesX; dx++) {
            let mapX = startX + dx;
            let mapY = startY + dy;

            if (mapX < 0 || mapX >= GAME_CONFIG.MAP_SIZE || mapY < 0 || mapY >= GAME_CONFIG.MAP_SIZE) continue;

            let screenPosX = (mapX - gameState.camera.x) * viewTileSize;
            let screenPosY = (mapY - gameState.camera.y) * viewTileSize;

            let tileType = gameState.map[mapY][mapX] === 1 ? 'water' : 'grass';
            Renderer.drawTile(ctx, tileType, screenPosX, screenPosY, viewTileSize, waterFrame);
        }
    }

    // 绘制补给点
    let supplyScreenX = (250 - gameState.camera.x) * viewTileSize;
    let supplyScreenY = (250 - gameState.camera.y) * viewTileSize;
    Renderer.drawEntity(ctx, 'supply', supplyScreenX, supplyScreenY, viewTileSize * 2);

    // 绘制掉落物
    if (gameState.droppedItems) {
        gameState.droppedItems.forEach(item => {
            let sx = (item.x - gameState.camera.x) * viewTileSize;
            let sy = (item.y - gameState.camera.y) * viewTileSize;
            Renderer.drawEntity(ctx, 'sword', sx, sy, viewTileSize * 0.8);
        });
    }

    // 绘制其他玩家
    Object.values(gameState.players).forEach(player => {
        if (player.id === gameState.myId) return;
        if (!player.alive) return;

        let sx = (player.x - gameState.camera.x) * viewTileSize;
        let sy = (player.y - gameState.camera.y) * viewTileSize;

        let sprite = player.team === 'steve' ? 'steve' : (player.monster || 'zombie');
        Renderer.drawEntity(ctx, sprite, sx, sy, viewTileSize);

        // 血条
        drawHealthBar(ctx, sx, sy - 8, viewTileSize, player.hp, player.maxHp);

        // 名字
        ctx.fillStyle = player.team === 'steve' ? '#4ecca3' : '#e74c3c';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(player.name || '', sx + viewTileSize / 2, sy - 12);
    });

    // 绘制AI怪物
    gameState.aiMonsters.forEach(monster => {
        if (!monster.alive) return;
        let sx = (monster.x - gameState.camera.x) * viewTileSize;
        let sy = (monster.y - gameState.camera.y) * viewTileSize;
        Renderer.drawEntity(ctx, monster.type, sx, sy, viewTileSize);
        drawHealthBar(ctx, sx, sy - 8, viewTileSize, monster.hp, monster.maxHp);
    });

    // 绘制飞行箭矢
    gameState.projectiles.forEach(arrow => {
        let sx = (arrow.x - gameState.camera.x) * viewTileSize;
        let sy = (arrow.y - gameState.camera.y) * viewTileSize;
        Renderer.drawEntity(ctx, 'arrow', sx, sy, viewTileSize * 0.5);
    });

    // 绘制爆炸特效
    gameState.effects.forEach(fx => {
        if (fx.type === 'explosion') {
            let sx = (fx.x - gameState.camera.x) * viewTileSize;
            let sy = (fx.y - gameState.camera.y) * viewTileSize;
            let size = viewTileSize * 5 * (1 - fx.timer / 0.5);
            ctx.globalAlpha = fx.timer / 0.5;
            Renderer.drawEntity(ctx, 'explosion', sx - size / 2, sy - size / 2, size);
            ctx.globalAlpha = 1;
        }
    });

    // 绘制本地玩家
    if (localPlayer.alive) {
        let sx = (localPlayer.x - gameState.camera.x) * viewTileSize;
        let sy = (localPlayer.y - gameState.camera.y) * viewTileSize;
        let sprite = gameState.myTeam === 'steve' ? 'steve' : (gameState.myMonster || 'zombie');
        Renderer.drawEntity(ctx, sprite, sx, sy, viewTileSize);

        // 蓄力指示器
        if (localPlayer.bowCharging) {
            let charge = (Date.now() - localPlayer.bowChargeStart) / 1000 / GAME_CONFIG.BOW_CHARGE_TIME;
            charge = Math.min(charge, 1);
            ctx.fillStyle = `rgba(52, 152, 219, ${0.5 + charge * 0.5})`;
            ctx.fillRect(sx, sy + viewTileSize + 2, viewTileSize * charge, 3);
        }
    }
}

function drawHealthBar(ctx, x, y, width, hp, maxHp) {
    let ratio = hp / maxHp;
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = ratio > 0.5 ? '#4ecca3' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(x, y, width * ratio, 4);
}

// ============ HUD 更新 ============

function updateHUD() {
    let hpPercent = (localPlayer.hp / localPlayer.maxHp) * 100;
    document.getElementById('health-fill').style.width = hpPercent + '%';
    document.getElementById('health-text').textContent = `❤️ ${localPlayer.hp}/${localPlayer.maxHp}`;

    if (gameState.myTeam === 'steve') {
        document.getElementById('weapon-info').textContent =
            `🗡️ 铁剑 耐久:${localPlayer.swordDurability} | 🏹 箭:${localPlayer.arrows} | 🧪 药水:${localPlayer.potions}`;
        document.getElementById('lives-info').textContent = `复活次数: ${localPlayer.lives}`;
    } else {
        document.getElementById('weapon-info').textContent = `怪物: ${gameState.myMonster}`;
        document.getElementById('lives-info').textContent = '无限复活';
    }
}

function updateTimer() {
    let minutes = Math.floor(gameState.timeLeft / 60);
    let seconds = Math.floor(gameState.timeLeft % 60);
    document.getElementById('timer').textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============ 游戏结束 ============

function endGame(winner) {
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
            resultDetail.textContent = '史蒂夫存活了30分钟...';
        }
    } else {
        if (gameState.myTeam === 'monster') {
            resultText.className = 'win';
            resultText.textContent = '🎉 胜利！';
            resultDetail.textContent = '成功消灭了所有史蒂夫！';
        } else {
            resultText.className = 'lose';
            resultText.textContent = '💀 失败...';
            resultDetail.textContent = '所有史蒂夫都被消灭了...';
        }
    }
}

function checkGameOver() {
    // 检查是否所有史蒂夫都永久死亡
    let stevesAlive = Object.values(gameState.players).filter(p =>
        p.team === 'steve' && p.lives > 0
    ).length;

    if (gameState.myTeam === 'steve' && localPlayer.lives > 0) stevesAlive++;

    if (stevesAlive === 0) {
        endGame('monster');
        NetworkManager.sendGameOver('monster');
    }
}

