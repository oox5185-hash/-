// ============ Firebase 联机网络管理 ============

const NetworkManager = {
    roomRef: null,
    playersRef: null,
    eventsRef: null,
    dropsRef: null,
    aiRef: null,
    fishRef: null,
    myRef: null,
    isHost: false,
    aiSpawnInterval: null,
    aiBehaviorInterval: null,
    fishCheckInterval: null,
    syncThrottle: 0,

    // 鱼的配置
    FISH_TOTAL: 50,
    FISH_AGGRO_RANGE: 10,
    FISH_WANDER_SPEED: 3,

    // 怪物配置
    MONSTER_SPAWN_INTERVAL: 30,  // 30秒一波
    MONSTER_SPAWN_COUNT: 5,      // 每个史蒂夫周围5个
    MONSTER_SPAWN_MIN: 30,       // 最近30格
    MONSTER_SPAWN_MAX: 60,       // 最远60格
    MONSTER_AGGRO_RANGE: 60,     // 60格内追踪
    MONSTER_WANDER_SPEED: 2,     // 自由移动速度

    // ===== 自动匹配房间 =====
    autoJoin(playerData) {
        let roomsRef = db.ref('rooms');

        roomsRef.once('value', snapshot => {
            let rooms = snapshot.val() || {};
            let bestRoom = null;
            let bestCount = 0;

            Object.entries(rooms).forEach(([roomId, roomData]) => {
                if (!roomData.players) return;
                let playerCount = Object.keys(roomData.players).length;

                if (playerCount >= CONFIG.MAX_PLAYERS) return;
                if (roomData.state === 'ended') return;

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
        this.fishRef = this.roomRef.child('fish');

        let seed = Math.floor(Math.random() * 999999);
        let now = Date.now();

        this.roomRef.set({
            seed: seed,
            state: 'playing',
            startTime: now,
            createdAt: now,
            host: gameState.myId,
        });

        this.addPlayer(playerData);
        this.setupListeners();
        enterGame(seed, CONFIG.GAME_DURATION);

        // Host职责：刷怪 + AI行为 + 鱼群管理
        this.startAISpawner();
        this.startAIBehavior();
        this.initFish();
        this.startFishManager();
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
        this.fishRef = this.roomRef.child('fish');

        this.addPlayer(playerData);

        this.roomRef.once('value', snapshot => {
            let data = snapshot.val();
            if (!data) {
                this.createRoom(roomId, playerData);
                return;
            }

            let seed = data.seed;
            let startTime = data.startTime;
            let elapsed = (Date.now() - startTime) / 1000;
            let timeLeft = CONFIG.GAME_DURATION - elapsed;

            if (timeLeft <= 0) {
                let newId = this.generateRoomId();
                this.createRoom(newId, playerData);
                return;
            }

            this.setupListeners();
            enterGame(seed, timeLeft);
            this.checkHostDuty();
        });
    },

    // ===== 添加玩家 =====
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
        this.myRef.onDisconnect().remove();
    },

    // ===== 监听器 =====
    setupListeners() {
        // 玩家列表
        this.playersRef.on('value', snapshot => {
            let players = snapshot.val() || {};
            gameState.players = players;
            if (gameState.phase === 'playing') {
                this.checkSteveStatus();
            }
        });

        // 事件
        this.eventsRef.on('child_added', snapshot => {
            let event = snapshot.val();
            if (event) this.handleEvent(event);
            setTimeout(() => snapshot.ref.remove(), 500);
        });

        // 掉落物
        this.dropsRef.on('value', snapshot => {
            gameState.droppedItems = [];
            let drops = snapshot.val() || {};
            Object.entries(drops).forEach(([id, item]) => {
                item.id = id;
                gameState.droppedItems.push(item);
            });
        });

        // AI怪物
        this.aiRef.on('value', snapshot => {
            let monsters = snapshot.val() || {};
            gameState.aiMonsters = Object.values(monsters).filter(m => m && m.alive);
        });

        // 鱼群
        this.fishRef.on('value', snapshot => {
            let fishData = snapshot.val() || {};
            gameState.aiFish = Object.values(fishData).filter(f => f && f.alive);
        });

        // 游戏结束
        this.roomRef.child('winner').on('value', snapshot => {
            let winner = snapshot.val();
            if (winner && gameState.phase === 'playing') {
                endGame(winner);
            }
        });

        // Host监控
        this.roomRef.child('host').on('value', snapshot => {
            let hostId = snapshot.val();
            if (!hostId) this.tryBecomeHost();
        });
    },

    // ===== 同步玩家 =====
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

    // ===== 发送事件 =====
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

    sendExplosion(x, y) {
        this.eventsRef.push({
            type: 'explosion',
            x: x, y: y,
            from: gameState.myId,
            t: Date.now(),
        });
    },

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

    removeDroppedItem(itemId) {
        if (this.dropsRef) this.dropsRef.child(itemId).remove();
    },

    sendPermaDeath() {
        if (this.myRef) {
            this.myRef.update({ alive: false, lives: 0, permaDead: true });
        }
    },

    sendGameOver(winner) {
        if (this.roomRef) {
            this.roomRef.child('winner').set(winner);
            this.roomRef.child('state').set('ended');
        }
    },

    // ===== 事件处理 =====
    handleEvent(event) {
        if (!event || !event.type) return;
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
        if (event.target === gameState.myId && event.from !== gameState.myId) {
            takeDamage(event.damage, event.angle);
        }
        // AI怪物受伤
        if (this.isHost && event.target && event.target.startsWith('ai_')) {
            this.damageAI(event.target, event.damage, event.angle);
        }
        // 鱼受伤
        if (this.isHost && event.target && event.target.startsWith('fish_')) {
            this.damageFish(event.target, event.damage, event.angle);
        }
    },

    onProjectileEvent(event) {
        if (event.owner === gameState.myId) return;
        gameState.projectiles.push({
            id: event.owner + '_' + event.t,
            x: event.x, y: event.y,
            dirX: event.dirX, dirY: event.dirY,
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
        gameState.effects.push({
            type: 'explosion',
            x: event.x, y: event.y,
            timer: 0.5, maxTimer: 0.5,
        });
        if (localPlayer.alive) {
            let dist = distBetween(localPlayer.x, localPlayer.y, event.x, event.y);
            let gridDist = Math.ceil(dist);
            if (gridDist <= 5 && CREEPER_DMG[gridDist]) {
                let angle = angleBetween(event.x, event.y, localPlayer.x, localPlayer.y);
                takeDamage(CREEPER_DMG[gridDist], angle);
            }
        }
    },

    // ===== 怪物刷新（每30秒，在每个史蒂夫周围30~60格）=====
    startAISpawner() {
        if (this.aiSpawnInterval) clearInterval(this.aiSpawnInterval);

        this.aiSpawnInterval = setInterval(() => {
            if (gameState.phase !== 'playing' || !this.isHost) return;
            this.spawnMonstersAroundSteves();
        }, this.MONSTER_SPAWN_INTERVAL * 1000);

        // 首次3秒后刷
        setTimeout(() => {
            if (this.isHost) this.spawnMonstersAroundSteves();
        }, 3000);
    },

    spawnMonstersAroundSteves() {
        let steves = Object.values(gameState.players).filter(p => p.team === 'steve' && p.alive);
        if (steves.length === 0) return;

        let types = ['zombie', 'skeleton', 'creeper'];

        steves.forEach(steve => {
            for (let i = 0; i < this.MONSTER_SPAWN_COUNT; i++) {
                let type = types[Math.floor(Math.random() * types.length)];
                let pos = this.getRandomPosAround(steve.x, steve.y, this.MONSTER_SPAWN_MIN, this.MONSTER_SPAWN_MAX, false);
                if (!pos) continue;

                let hp = 20;
                let id = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

                this.aiRef.child(id).set({
                    id: id,
                    type: type,
                    x: pos.x,
                    y: pos.y,
                    hp: hp,
                    maxHp: hp,
                    alive: true,
                    wanderAngle: Math.random() * Math.PI * 2,
                    wanderTimer: 0,
                    spawnTime: Date.now(),
                });
            }
        });
    },

    // 在指定位置周围随机生成位置
    getRandomPosAround(cx, cy, minDist, maxDist, requireWater) {
        let attempts = 0;
        while (attempts < 50) {
            let angle = Math.random() * Math.PI * 2;
            let dist = minDist + Math.random() * (maxDist - minDist);
            let x = Math.floor(cx + Math.cos(angle) * dist);
            let y = Math.floor(cy + Math.sin(angle) * dist);

            if (x < 0 || x >= CONFIG.MAP_SIZE || y < 0 || y >= CONFIG.MAP_SIZE) {
                attempts++;
                continue;
            }

            let tile = gameState.map[y] && gameState.map[y][x];
            if (requireWater && tile !== 1) { attempts++; continue; }
            if (!requireWater && tile === 1) { attempts++; continue; }

            return {x, y};
            attempts++;
        }
        return null;
    },

    // ===== 鱼群管理 =====

    // 初始化50条鱼，分散在水域
    initFish() {
        let fishData = {};
        for (let i = 0; i < this.FISH_TOTAL; i++) {
            let pos = getRandomWaterPos();
            let id = 'fish_' + i;
            fishData[id] = {
                id: id,
                type: 'fish',
                x: pos.x,
                y: pos.y,
                hp: CONFIG.FISH_HP,
                maxHp: CONFIG.FISH_HP,
                alive: true,
                wanderAngle: Math.random() * Math.PI * 2,
                wanderTimer: Math.random() * 3,
            };
        }
        this.fishRef.set(fishData);
    },

    // 定时检查鱼数量，不够就补
    startFishManager() {
        if (this.fishCheckInterval) clearInterval(this.fishCheckInterval);

        this.fishCheckInterval = setInterval(() => {
            if (gameState.phase !== 'playing' || !this.isHost) return;
            this.replenishFish();
        }, 5000); // 每5秒检查一次
    },

    replenishFish() {
        let aliveFish = (gameState.aiFish || []).filter(f => f.alive);
        let needed = this.FISH_TOTAL - aliveFish.length;
        if (needed <= 0) return;

        // 找最近的史蒂夫来确定刷新位置
        let steves = Object.values(gameState.players).filter(p => p.team === 'steve' && p.alive);

        for (let i = 0; i < needed; i++) {
            let pos = null;

            if (steves.length > 0) {
                // 在随机一个史蒂夫周围30~60格水域刷新
                let steve = steves[Math.floor(Math.random() * steves.length)];
                pos = this.getRandomPosAround(steve.x, steve.y, 30, 60, true);
            }

            // 如果没找到合适位置，随机水域
            if (!pos) pos = getRandomWaterPos();

            let id = 'fish_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            this.fishRef.child(id).set({
                id: id,
                type: 'fish',
                x: pos.x,
                y: pos.y,
                hp: CONFIG.FISH_HP,
                maxHp: CONFIG.FISH_HP,
                alive: true,
                wanderAngle: Math.random() * Math.PI * 2,
                wanderTimer: Math.random() * 3,
            });
        }
    },

    // 鱼受伤
    damageFish(fishId, damage, angle) {
        let fish = (gameState.aiFish || []).find(f => f.id === fishId);
        if (!fish || !fish.alive) return;

        fish.hp -= damage;

        // 击退
        if (angle !== undefined) {
            let newX = fish.x + Math.cos(angle) * CONFIG.KNOCKBACK_DIST;
            let newY = fish.y + Math.sin(angle) * CONFIG.KNOCKBACK_DIST;
            // 鱼只能在水里
            let tx = Math.floor(newX), ty = Math.floor(newY);
            if (gameState.map[ty] && gameState.map[ty][tx] === 1) {
                fish.x = newX;
                fish.y = newY;
            }
        }

        if (fish.hp <= 0) {
            fish.alive = false;
            this.fishRef.child(fishId).update({alive: false, hp: 0});
            setTimeout(() => this.fishRef.child(fishId).remove(), 2000);
        } else {
            this.fishRef.child(fishId).update({
                hp: fish.hp,
                x: Math.round(fish.x * 10) / 10,
                y: Math.round(fish.y * 10) / 10,
            });
        }
    },

    // ===== AI怪物受伤 =====
    damageAI(aiId, damage, angle) {
        let monster = gameState.aiMonsters.find(m => m.id === aiId);
        if (!monster || !monster.alive) return;

        monster.hp -= damage;

        // 击退
        if (angle !== undefined) {
            let newX = monster.x + Math.cos(angle) * CONFIG.KNOCKBACK_DIST;
            let newY = monster.y + Math.sin(angle) * CONFIG.KNOCKBACK_DIST;
            newX = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, newX));
            newY = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, newY));
            monster.x = newX;
            monster.y = newY;
        }

        if (monster.hp <= 0) {
            monster.alive = false;
            this.aiRef.child(aiId).update({alive: false, hp: 0});
            setTimeout(() => this.aiRef.child(aiId).remove(), 2000);
        } else {
            this.aiRef.child(aiId).update({
                hp: monster.hp,
                x: Math.round(monster.x * 10) / 10,
                y: Math.round(monster.y * 10) / 10,
            });
        }
    },

    // ===== AI行为循环 =====
    startAIBehavior() {
        if (this.aiBehaviorInterval) clearInterval(this.aiBehaviorInterval);

        this.aiBehaviorInterval = setInterval(() => {
            if (gameState.phase !== 'playing' || !this.isHost) return;

            // 更新怪物
            gameState.aiMonsters.forEach(monster => {
                if (!monster.alive) return;
                this.updateMonsterBehavior(monster);
            });

            // 更新鱼
            (gameState.aiFish || []).forEach(fish => {
                if (!fish.alive) return;
                this.updateFishBehavior(fish);
            });

        }, 500);
    },

    // ===== 怪物AI行为 =====
    updateMonsterBehavior(monster) {
        let dt = 0.5;

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

        // 速度
        let speed;
        switch (monster.type) {
            case 'zombie': speed = CONFIG.ZOMBIE_SPEED; break;
            case 'skeleton': speed = CONFIG.SKELETON_SPEED; break;
            case 'creeper': speed = CONFIG.CREEPER_SPEED; break;
            default: speed = 5;
        }

        // 水中减速
        let tileX = Math.floor(monster.x);
        let tileY = Math.floor(monster.y);
        let inWater = gameState.map[tileY] && gameState.map[tileY][tileX] === 1;
        if (inWater) speed *= CONFIG.WATER_SLOW;

        let moveAngle;
        let isChasing = false;

        // 60格内追踪史蒂夫
        if (nearestSteve && nearestDist <= this.MONSTER_AGGRO_RANGE) {
            moveAngle = angleBetween(monster.x, monster.y, nearestSteve.x, nearestSteve.y);
            isChasing = true;
        } else {
            // 自由漫游
            monster.wanderTimer = (monster.wanderTimer || 0) - dt;
            if (monster.wanderTimer <= 0) {
                monster.wanderAngle = Math.random() * Math.PI * 2;
                monster.wanderTimer = 2 + Math.random() * 3;
            }
            moveAngle = monster.wanderAngle || 0;
            speed = this.MONSTER_WANDER_SPEED;
            if (inWater) speed *= CONFIG.WATER_SLOW;
        }

        // 移动
        let newX = monster.x + Math.cos(moveAngle) * speed * dt;
        let newY = monster.y + Math.sin(moveAngle) * speed * dt;
        newX = Math.max(1, Math.min(CONFIG.MAP_SIZE - 2, newX));
        newY = Math.max(1, Math.min(CONFIG.MAP_SIZE - 2, newY));

        monster.x = newX;
        monster.y = newY;

        // 攻击判定
        if (isChasing && nearestSteve) {
            let attackRange, attackDamage;
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
                    if (nearestDist < 2) {
                        this.aiCreeperExplode(monster);
                        return;
                    }
                    attackRange = 0;
                    break;
                default:
                    attackRange = 3;
                    attackDamage = 4;
            }

            if (attackRange > 0 && nearestDist <= attackRange) {
                let atkAngle = angleBetween(monster.x, monster.y, nearestSteve.x, nearestSteve.y);

                // 骷髅远程射箭
                if (monster.type === 'skeleton' && nearestDist > 3) {
                    this.eventsRef.push({
                        type: 'projectile',
                        x: monster.x, y: monster.y,
                        dirX: Math.round(Math.cos(atkAngle) * 100) / 100,
                        dirY: Math.round(Math.sin(atkAngle) * 100) / 100,
                        damage: attackDamage,
                        speed: CONFIG.ARROW_SPEED,
                        owner: monster.id,
                        ownerTeam: 'monster',
                        t: Date.now(),
                    });
                } else if (monster.type !== 'skeleton') {
                    // 近战攻击
                    this.eventsRef.push({
                        type: 'damage',
                        target: nearestSteve.id,
                        damage: attackDamage,
                        angle: atkAngle,
                        from: monster.id,
                        t: Date.now(),
                    });
                }
            }
        }

        // 更新到数据库
        this.aiRef.child(monster.id).update({
            x: Math.round(monster.x * 10) / 10,
            y: Math.round(monster.y * 10) / 10,
            wanderAngle: monster.wanderAngle,
            wanderTimer: monster.wanderTimer,
        });
    },

    // ===== 鱼AI行为 =====
    updateFishBehavior(fish) {
        let dt = 0.5;

        // 找最近的史蒂夫
        let nearestSteve = null;
        let nearestDist = 999;

        Object.values(gameState.players).forEach(p => {
            if (p.team !== 'steve' || !p.alive) return;
            let d = distBetween(fish.x, fish.y, p.x, p.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearestSteve = p;
            }
        });

        let speed = CONFIG.FISH_SPEED;
        let moveAngle;
        let isChasing = false;

        // 10格内才追踪
        if (nearestSteve && nearestDist <= this.FISH_AGGRO_RANGE) {
            moveAngle = angleBetween(fish.x, fish.y, nearestSteve.x, nearestSteve.y);
            isChasing = true;
        } else {
            // 自由游动
            fish.wanderTimer = (fish.wanderTimer || 0) - dt;
            if (fish.wanderTimer <= 0) {
                fish.wanderAngle = Math.random() * Math.PI * 2;
                fish.wanderTimer = 1 + Math.random() * 3;
            }
            moveAngle = fish.wanderAngle || 0;
            speed = this.FISH_WANDER_SPEED;
        }

        // 移动（只能在水里）
        let newX = fish.x + Math.cos(moveAngle) * speed * dt;
        let newY = fish.y + Math.sin(moveAngle) * speed * dt;
        newX = Math.max(1, Math.min(CONFIG.MAP_SIZE - 2, newX));
        newY = Math.max(1, Math.min(CONFIG.MAP_SIZE - 2, newY));

        let ntx = Math.floor(newX), nty = Math.floor(newY);
        if (gameState.map[nty] && gameState.map[nty][ntx] === 1) {
            fish.x = newX;
            fish.y = newY;
        } else {
            // 碰到岸边，换方向
            fish.wanderAngle = Math.random() * Math.PI * 2;
            fish.wanderTimer = 1;
        }

        // 攻击（3格内，10伤害）
        if (isChasing && nearestSteve && nearestDist <= CONFIG.FISH_RANGE) {
            let atkAngle = angleBetween(fish.x, fish.y, nearestSteve.x, nearestSteve.y);
            this.eventsRef.push({
                type: 'damage',
                target: nearestSteve.id,
                damage: CONFIG.FISH_DAMAGE,
                angle: atkAngle,
                from: fish.id,
                t: Date.now(),
            });
        }

        // 更新数据库
        this.fishRef.child(fish.id).update({
            x: Math.round(fish.x * 10) / 10,
            y: Math.round(fish.y * 10) / 10,
            wanderAngle: fish.wanderAngle,
            wanderTimer: fish.wanderTimer,
        });
    },

    // ===== 苦力怕AI爆炸 =====
    aiCreeperExplode(monster) {
        this.eventsRef.push({
            type: 'explosion',
            x: monster.x, y: monster.y,
            from: monster.id,
            t: Date.now(),
        });

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

        monster.alive = false;
        this.aiRef.child(monster.id).update({alive: false, hp: 0});
        setTimeout(() => this.aiRef.child(monster.id).remove(), 2000);
    },

    // ===== Host管理 =====
    checkHostDuty() {
        this.roomRef.child('host').once('value', snapshot => {
            let hostId = snapshot.val();
            if (hostId && gameState.players[hostId]) {
                this.isHost = false;
            } else {
                this.tryBecomeHost();
            }
        });
    },

    tryBecomeHost() {
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
                this.startFishManager();
                console.log('成为房间Host');
            }
        });
    },

    // ===== 检查史蒂夫 =====
    checkSteveStatus() {
        let anySteveLives = false;
        Object.values(gameState.players).forEach(p => {
            if (p.team === 'steve' && (p.lives > 0 || p.alive) && !p.permaDead) {
                anySteveLives = true;
            }
        });

        if (!anySteveLives) {
            let hasStevePlayer = Object.values(gameState.players).some(p => p.team === 'steve');
            if (hasStevePlayer) {
                endGame('monster');
            }
        }
    },

    // ===== 清理 =====
    cleanup() {
        if (this.aiSpawnInterval) clearInterval(this.aiSpawnInterval);
        if (this.aiBehaviorInterval) clearInterval(this.aiBehaviorInterval);
        if (this.fishCheckInterval) clearInterval(this.fishCheckInterval);
        if (this.roomRef) {
            this.playersRef.off();
            this.eventsRef.off();
            this.dropsRef.off();
            this.aiRef.off();
            this.fishRef.off();
            this.roomRef.child('winner').off();
            this.roomRef.child('host').off();
        }
    },
};

window.addEventListener('beforeunload', () => {
    NetworkManager.cleanup();
});

