// ============ Firebase 联机网络管理 ============

const NetworkManager = {
    roomRef: null,
    playersRef: null,
    eventsRef: null,
    dropsRef: null,
    aiRef: null,
    myRef: null,
    isHost: false,
    aiSpawnInterval: null,
    syncThrottle: 0,

    // ===== 自动匹配房间 =====
    autoJoin(playerData) {
        let roomsRef = db.ref('rooms');

        roomsRef.once('value', snapshot => {
            let rooms = snapshot.val() || {};
            let bestRoom = null;
            let bestCount = 0;

            // 找人最多但没满的房间
            Object.entries(rooms).forEach(([roomId, roomData]) => {
                if (!roomData.players) return;
                let playerCount = Object.keys(roomData.players).length;
                let state = roomData.state;

                // 可以加入正在进行的游戏
                if (playerCount >= CONFIG.MAX_PLAYERS) return;

                // 检查史蒂夫名额
                if (playerData.team === 'steve') {
                    let steveCount = Object.values(roomData.players).filter(p => p.team === 'steve').length;
                    if (steveCount >= CONFIG.MAX_STEVE) return;
                }

                if (playerCount > bestCount) {
                    bestCount = playerCount;
                    bestRoom = roomId;
                }
            });

            if (bestRoom) {
                this.joinRoom(bestRoom, playerData);
            } else {
                // 创建新房间
                let newRoomId = this.generateRoomId();
                this.createRoom(newRoomId, playerData);
            }
        });
    },

    generateRoomId() {
        return 'R' + Math.random().toString(36).substr(2, 5).toUpperCase();
    },

    // ===== 创建房间 =====
    createRoom(roomId, playerData) {
        gameState.roomId = roomId;
        gameState.myId = 'P' + Math.random().toString(36).substr(2, 8);
        this.isHost = true;

        this.roomRef = db.ref('rooms/' + roomId);
        this.playersRef = this.roomRef.child('players');
        this.eventsRef = this.roomRef.child('events');
        this.dropsRef = this.roomRef.child('drops');
        this.aiRef = this.roomRef.child('ai');

        let seed = Math.floor(Math.random() * 999999);
        let now = Date.now();

        // 写入房间数据
        this.roomRef.set({
            seed: seed,
            state: 'playing',
            startTime: now,
            createdAt: now,
            host: gameState.myId,
        });

        // 写入自己
        this.addPlayer(playerData);

        // 监听
        this.setupListeners();

        // 开始游戏
        enterGame(seed, CONFIG.GAME_DURATION);

        // 刷怪
        this.startAISpawner();
    },

    // ===== 加入房间 =====
    joinRoom(roomId, playerData) {
        gameState.roomId = roomId;
        gameState.myId = 'P' + Math.random().toString(36).substr(2, 8);

        this.roomRef = db.ref('rooms/' + roomId);
        this.playersRef = this.roomRef.child('players');
        this.eventsRef = this.roomRef.child('events');
        this.dropsRef = this.roomRef.child('drops');
        this.aiRef = this.roomRef.child('ai');

        // 加入玩家
        this.addPlayer(playerData);

        // 获取房间数据后开始
        this.roomRef.once('value', snapshot => {
            let data = snapshot.val();
            if (!data) {
                // 房间不存在，创建新的
                this.createRoom(roomId, playerData);
                return;
            }

            let seed = data.seed;
            let startTime = data.startTime;
            let elapsed = (Date.now() - startTime) / 1000;
            let timeLeft = CONFIG.GAME_DURATION - elapsed;

            if (timeLeft <= 0) {
                // 游戏已结束，创建新房间
                let newId = this.generateRoomId();
                this.createRoom(newId, playerData);
                return;
            }

            // 监听
            this.setupListeners();

            // 中途加入
            enterGame(seed, timeLeft);

            // 检查是否需要接管刷怪
            this.checkHostDuty();
        });
    },

    // ===== 添加玩家到房间 =====
    addPlayer(playerData) {
        this.myRef = this.playersRef.child(gameState.myId);
        this.myRef.set({
            id: gameState.myId,
            name: playerData.name,
            team: playerData.team,
            monster: playerData.monster || null,
            x: localPlayer.x,
            y: localPlayer.y,
            hp: localPlayer.hp,
            maxHp: localPlayer.maxHp,
            lives: localPlayer.lives,
            alive: true,
            lastWeapon: 'sword',
            facingAngle: 0,
            joinedAt: Date.now(),
        });

        // 断线自动清除
        this.myRef.onDisconnect().remove();
    },

    // ===== 设置监听器 =====
    setupListeners() {
        // 监听玩家变化
        this.playersRef.on('value', snapshot => {
            let players = snapshot.val() || {};
            gameState.players = players;

            // 检查游戏结束
            if (gameState.phase === 'playing') {
                this.checkSteveStatus();
            }
        });

        // 监听伤害事件
        this.eventsRef.on('child_added', snapshot => {
            let event = snapshot.val();
            if (event) this.handleEvent(event);
            // 处理后删除（延迟删除防止多次读取）
            setTimeout(() => snapshot.ref.remove(), 500);
        });

        // 监听掉落物
        this.dropsRef.on('value', snapshot => {
            gameState.droppedItems = [];
            let drops = snapshot.val() || {};
            Object.entries(drops).forEach(([id, item]) => {
                item.id = id;
                gameState.droppedItems.push(item);
            });
        });

        // 监听AI怪物
        this.aiRef.on('value', snapshot => {
            let monsters = snapshot.val() || {};
            gameState.aiMonsters = Object.values(monsters).filter(m => m && m.alive);
        });

        // 监听游戏结束
        this.roomRef.child('winner').on('value', snapshot => {
            let winner = snapshot.val();
            if (winner && gameState.phase === 'playing') {
                endGame(winner);
            }
        });

        // 监听host变化（如果host掉线需要接管）
        this.roomRef.child('host').on('value', snapshot => {
            let hostId = snapshot.val();
            if (!hostId) {
                this.tryBecomeHost();
            }
        });
    },

    // ===== 同步本地玩家状态 =====
    syncPlayer() {
        if (!this.myRef || !gameState.myId) return;

        let now = Date.now();
        if (now - this.syncThrottle < 80) return;
        this.syncThrottle = now;

        this.myRef.update({
            x: Math.round(localPlayer.x * 10) / 10,
            y: Math.round(localPlayer.y * 10) / 10,
            hp: localPlayer.hp,
            alive: localPlayer.alive,
            lives: localPlayer.lives,
            lastWeapon: localPlayer.lastWeapon,
            facingAngle: Math.round(localPlayer.facingAngle * 100) / 100,
        });
    },

    // ===== 发送伤害 =====
    sendDamage(targetId, damage, angle) {
        this.eventsRef.push({
            type: 'damage',
            target: targetId,
            damage: damage,
            angle: angle || 0,
            from: gameState.myId,
            t: Date.now(),
        });
    },

    // ===== 发送箭矢 =====
    sendProjectile(arrow) {
        this.eventsRef.push({
            type: 'projectile',
            x: Math.round(arrow.x * 10) / 10,
            y: Math.round(arrow.y * 10) / 10,
            dirX: Math.round(arrow.dirX * 100) / 100,
            dirY: Math.round(arrow.dirY * 100) / 100,
            damage: arrow.damage,
            speed: arrow.speed,
            owner: arrow.owner,
            ownerTeam: arrow.ownerTeam,
            t: Date.now(),
        });
    },

    // ===== 发送爆炸 =====
    sendExplosion(x, y) {
        this.eventsRef.push({
            type: 'explosion',
            x: x,
            y: y,
            from: gameState.myId,
            t: Date.now(),
        });
    },

    // ===== 发送掉落物 =====
    sendDrop(x, y, items) {
        this.dropsRef.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            arrows: items.arrows || 0,
            swordDurability: items.swordDurability || 0,
            potions: items.potions || 0,
            t: Date.now(),
        });
    },

    // ===== 移除掉落物 =====
    removeDroppedItem(itemId) {
        if (this.dropsRef) {
            this.dropsRef.child(itemId).remove();
        }
    },

    // ===== 永久死亡 =====
    sendPermaDeath() {
        if (this.myRef) {
            this.myRef.update({
                alive: false,
                lives: 0,
                permaDead: true,
            });
        }
    },

    // ===== 游戏结束 =====
    sendGameOver(winner) {
        if (this.roomRef) {
            this.roomRef.child('winner').set(winner);
            this.roomRef.child('state').set('ended');
        }
    },

    // ===== 处理网络事件 =====
    handleEvent(event) {
        if (!event || !event.type) return;

        // 忽略过时事件（超过3秒）
        if (Date.now() - event.t > 3000) return;

        switch (event.type) {
            case 'damage':
                this.onDamageEvent(event);
                break;
            case 'projectile':
                this.onProjectileEvent(event);
                break;
            case 'explosion':
                this.onExplosionEvent(event);
                break;
        }
    },

    onDamageEvent(event) {
        // 是否打到自己
        if (event.target === gameState.myId && event.from !== gameState.myId) {
            takeDamage(event.damage, event.angle);
        }

        // 是否打到AI怪物（host处理）
        if (this.isHost && event.target && event.target.startsWith('ai_')) {
            this.damageAI(event.target, event.damage, event.angle);
        }
    },

    onProjectileEvent(event) {
        if (event.owner === gameState.myId) return;

        gameState.projectiles.push({
            id: event.owner + '_' + event.t,
            x: event.x,
            y: event.y,
            dirX: event.dirX,
            dirY: event.dirY,
            damage: event.damage,
            speed: event.speed,
            owner: event.owner,
            ownerTeam: event.ownerTeam,
            trail: [{x: event.x, y: event.y}],
            distTraveled: 0,
        });
    },

    onExplosionEvent(event) {
        if (event.from === gameState.myId) return;

        // 特效
        gameState.effects.push({
            type: 'explosion',
            x: event.x,
            y: event.y,
            timer: 0.5,
            maxTimer: 0.5,
        });

        // 自己是否受伤
        if (localPlayer.alive) {
            let dist = distBetween(localPlayer.x, localPlayer.y, event.x, event.y);
            let gridDist = Math.ceil(dist);
            if (gridDist <= 5 && CREEPER_DMG[gridDist]) {
                let angle = angleBetween(event.x, event.y, localPlayer.x, localPlayer.y);
                takeDamage(CREEPER_DMG[gridDist], angle);
            }
        }
    },

    // ===== AI怪物管理（只有host执行）=====

    startAISpawner() {
        if (this.aiSpawnInterval) clearInterval(this.aiSpawnInterval);

        this.aiSpawnInterval = setInterval(() => {
            if (gameState.phase !== 'playing') return;
            if (!this.isHost) return;

            this.spawnAIBatch();
        }, CONFIG.AI_SPAWN_INTERVAL * 1000);

        // 首次立刻刷一批
        setTimeout(() => this.spawnAIBatch(), 3000);
    },

    spawnAIBatch() {
        let types = ['zombie', 'skeleton', 'creeper', 'fish'];

        for (let i = 0; i < CONFIG.AI_SPAWN_COUNT; i++) {
            let type = types[Math.floor(Math.random() * types.length)];
            let pos;
            if (type === 'fish') {
                pos = getRandomWaterPos();
            } else {
                pos = getRandomLandPos();
            }

            let hp = type === 'fish' ? CONFIG.FISH_HP : 20;
            let id = 'ai_' + Date.now() + '_' + i;

            this.aiRef.child(id).set({
                id: id,
                type: type,
                x: pos.x,
                y: pos.y,
                hp: hp,
                maxHp: hp,
                alive: true,
                spawnTime: Date.now(),
            });
        }
    },

    damageAI(aiId, damage, angle) {
        let aiMonster = gameState.aiMonsters.find(m => m.id === aiId);
        if (!aiMonster || !aiMonster.alive) return;

        aiMonster.hp -= damage;

        // 击退AI
        if (angle !== undefined) {
            aiMonster.x += Math.cos(angle) * CONFIG.KNOCKBACK_DIST;
            aiMonster.y += Math.sin(angle) * CONFIG.KNOCKBACK_DIST;
            // 边界限制
            aiMonster.x = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, aiMonster.x));
            aiMonster.y = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, aiMonster.y));
        }

        if (aiMonster.hp <= 0) {
            aiMonster.alive = false;
            this.aiRef.child(aiId).update({alive: false, hp: 0});
            // 一段时间后移除
            setTimeout(() => {
                this.aiRef.child(aiId).remove();
            }, 2000);
        } else {
            this.aiRef.child(aiId).update({
                hp: aiMonster.hp,
                x: Math.round(aiMonster.x * 10) / 10,
                y: Math.round(aiMonster.y * 10) / 10,
            });
        }
    },

    // ===== AI简易行为（host运算）=====

    startAIBehavior() {
        setInterval(() => {
            if (gameState.phase !== 'playing' || !this.isHost) return;

            gameState.aiMonsters.forEach(monster => {
                if (!monster.alive) return;
                this.updateAIMonster(monster);
            });
        }, 500); // 每0.5秒更新AI
    },

    updateAIMonster(monster) {
        // 找最近的史蒂夫
        let nearestSteve = null;
        let nearestDist = 999;

        Object.values(gameState.players).forEach(p => {
            if (p.team !== 'steve' || !p.alive) return;
            let d = distBetween(monster.x, monster.y, p.x, p.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearestSteve = p;
            }
        });

        if (!nearestSteve) return;

        // 移动向史蒂夫
        let speed;
        switch (monster.type) {
            case 'fish': speed = CONFIG.FISH_SPEED; break;
            case 'zombie': speed = CONFIG.ZOMBIE_SPEED; break;
            case 'skeleton': speed = CONFIG.SKELETON_SPEED; break;
            case 'creeper': speed = CONFIG.CREEPER_SPEED; break;
            default: speed = 5;
        }

        // 水中减速
        let tileX = Math.floor(monster.x);
        let tileY = Math.floor(monster.y);
        let inWater = gameState.map[tileY] && gameState.map[tileY][tileX] === 1;
        if (inWater && monster.type !== 'fish') {
            speed *= CONFIG.WATER_SLOW;
        }

        let angle = angleBetween(monster.x, monster.y, nearestSteve.x, nearestSteve.y);
        let dt = 0.5; // 更新间隔

        let newX = monster.x + Math.cos(angle) * speed * dt;
        let newY = monster.y + Math.sin(angle) * speed * dt;

        // 鱼不能上岸
        if (monster.type === 'fish') {
            let ntx = Math.floor(newX);
            let nty = Math.floor(newY);
            if (gameState.map[nty] && gameState.map[nty][ntx] !== 1) {
                return; // 不移动
            }
        }

        newX = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, newX));
        newY = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, newY));

        monster.x = newX;
        monster.y = newY;

        // 攻击判定
        let attackRange;
        let attackDamage;
        switch (monster.type) {
            case 'zombie':
                attackRange = CONFIG.ZOMBIE_RANGE;
                attackDamage = CONFIG.ZOMBIE_DAMAGE;
                break;
            case 'skeleton':
                attackRange = CONFIG.SKELETON_RANGE;
                attackDamage = CONFIG.SKELETON_DAMAGE;
                break;
            case 'creeper':
                // 苦力怕靠近就爆炸
                if (nearestDist < 2) {
                    this.aiCreeperExplode(monster, nearestSteve);
                    return;
                }
                attackRange = 0;
                break;
            case 'fish':
                attackRange = CONFIG.FISH_RANGE;
                attackDamage = CONFIG.FISH_DAMAGE;
                break;
            default:
                attackRange = 3;
                attackDamage = 4;
        }

        if (nearestDist <= attackRange && monster.type !== 'creeper') {
            // AI攻击（通过事件发送）
            let atkAngle = angleBetween(monster.x, monster.y, nearestSteve.x, nearestSteve.y);
            this.eventsRef.push({
                type: 'damage',
                target: nearestSteve.id,
                damage: attackDamage,
                angle: atkAngle,
                from: monster.id,
                t: Date.now(),
            });
        }

        // 骷髅远程（射箭效果）
        if (monster.type === 'skeleton' && nearestDist <= CONFIG.SKELETON_RANGE && nearestDist > 5) {
            // 发射箭（视觉效果）
            this.eventsRef.push({
                type: 'projectile',
                x: monster.x,
                y: monster.y,
                dirX: Math.cos(angle),
                dirY: Math.sin(angle),
                damage: CONFIG.SKELETON_DAMAGE,
                speed: CONFIG.ARROW_SPEED,
                owner: monster.id,
                ownerTeam: 'monster',
                t: Date.now(),
            });
        }

        // 更新位置到数据库
        this.aiRef.child(monster.id).update({
            x: Math.round(monster.x * 10) / 10,
            y: Math.round(monster.y * 10) / 10,
        });
    },

    aiCreeperExplode(monster, target) {
        // 爆炸
        this.eventsRef.push({
            type: 'explosion',
            x: monster.x,
            y: monster.y,
            from: monster.id,
            t: Date.now(),
        });

        // 对附近史蒂夫造成伤害
        Object.values(gameState.players).forEach(p => {
            if (p.team !== 'steve' || !p.alive) return;
            let dist = distBetween(monster.x, monster.y, p.x, p.y);
            let gridDist = Math.ceil(dist);
            if (gridDist <= 5 && CREEPER_DMG[gridDist]) {
                let atkAngle = angleBetween(monster.x, monster.y, p.x, p.y);
                this.eventsRef.push({
                    type: 'damage',
                    target: p.id,
                    damage: CREEPER_DMG[gridDist],
                    angle: atkAngle,
                    from: monster.id,
                    t: Date.now(),
                });
            }
        });

        // 苦力怕死亡
        monster.alive = false;
        this.aiRef.child(monster.id).update({alive: false, hp: 0});
        setTimeout(() => this.aiRef.child(monster.id).remove(), 2000);
    },

    // ===== Host管理 =====

    checkHostDuty() {
        this.roomRef.child('host').once('value', snapshot => {
            let hostId = snapshot.val();
            // 检查host是否还在
            if (hostId && gameState.players[hostId]) {
                this.isHost = false;
            } else {
                this.tryBecomeHost();
            }
        });
    },

    tryBecomeHost() {
        // 尝试成为host（用transaction避免冲突）
        this.roomRef.child('host').transaction(currentHost => {
            if (!currentHost || !gameState.players[currentHost]) {
                return gameState.myId;
            }
            return currentHost;
        }, (error, committed) => {
            if (committed) {
                this.isHost = true;
                this.startAISpawner();
                this.startAIBehavior();
                console.log('成为房间Host');
            }
        });
    },

    // ===== 检查史蒂夫存活 =====
    checkSteveStatus() {
        let anySteveLives = false;
        Object.values(gameState.players).forEach(p => {
            if (p.team === 'steve' && (p.lives > 0 || p.alive) && !p.permaDead) {
                anySteveLives = true;
            }
        });

        if (!anySteveLives) {
            // 看看有没有史蒂夫（可能都是怪物）
            let hasStevePlayer = Object.values(gameState.players).some(p => p.team === 'steve');
            if (hasStevePlayer) {
                endGame('monster');
            }
        }
    },

    // ===== 清理 =====
    cleanup() {
        if (this.aiSpawnInterval) clearInterval(this.aiSpawnInterval);
        if (this.roomRef) {
            this.playersRef.off();
            this.eventsRef.off();
            this.dropsRef.off();
            this.aiRef.off();
            this.roomRef.child('winner').off();
            this.roomRef.child('host').off();
        }
    },
};

// 页面关闭时清理
window.addEventListener('beforeunload', () => {
    NetworkManager.cleanup();
});

