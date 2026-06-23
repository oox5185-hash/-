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

    FISH_TOTAL: 50,
    FISH_AGGRO_RANGE: 10,
    FISH_WANDER_SPEED: 3,

    MONSTER_SPAWN_INTERVAL: 30,
    MONSTER_SPAWN_COUNT: 5,
    MONSTER_SPAWN_MIN: 30,
    MONSTER_SPAWN_MAX: 60,
    MONSTER_AGGRO_RANGE: 60,
    MONSTER_WANDER_SPEED: 2,

    // ===== 自动匹配 =====
    autoJoin(playerData) {
        let roomsRef = db.ref('rooms');
        roomsRef.once('value', snapshot => {
            let rooms = snapshot.val() || {};
            let bestRoom = null, bestCount = 0;

            Object.entries(rooms).forEach(([roomId, roomData]) => {
                if (!roomData.players) return;
                let count = Object.keys(roomData.players).length;
                if (count >= CONFIG.MAX_PLAYERS) return;
                if (roomData.state === 'ended') return;
                if (count > bestCount) { bestCount = count; bestRoom = roomId; }
            });

            if (bestRoom) this.joinRoom(bestRoom, playerData);
            else this.createRoom(this.genId(), playerData);
        });
    },

    genId() { return 'R' + Math.random().toString(36).substr(2, 5).toUpperCase(); },

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

        this.roomRef.set({
            seed: seed,
            state: 'playing',
            startTime: Date.now(),
            host: gameState.myId,
        });

        this.addPlayer(playerData);
        this.setupListeners();
        enterGame(seed, CONFIG.GAME_DURATION);

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
            if (!data) { this.createRoom(roomId, playerData); return; }

            let seed = data.seed;
            let elapsed = (Date.now() - data.startTime) / 1000;
            let timeLeft = CONFIG.GAME_DURATION - elapsed;

            if (timeLeft <= 0) { this.createRoom(this.genId(), playerData); return; }

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

    updateMonsterType(type) {
        if (this.myRef) {
            this.myRef.update({ monster: type });
        }
    },

    // ===== 监听 =====
    setupListeners() {
        this.playersRef.on('value', snapshot => {
            let players = snapshot.val() || {};
            let currentIds = Object.keys(players);
            let previousIds = gameState.previousPlayerIds || [];

            currentIds.forEach(id => {
                if (!previousIds.includes(id) && id !== gameState.myId) {
                    let p = players[id];
                    if (p && p.name) {
                        showJoinToast(p.name);
                    }
                }
            });

            gameState.previousPlayerIds = currentIds;
            gameState.players = players;
            updatePlayerCount();
            if (gameState.phase === 'playing') this.checkSteveStatus();
        });

        this.eventsRef.on('child_added', snapshot => {
            let event = snapshot.val();
            if (event) this.handleEvent(event);
            setTimeout(() => snapshot.ref.remove(), 500);
        });

        this.dropsRef.on('value', snapshot => {
            gameState.droppedItems = [];
            let drops = snapshot.val() || {};
            Object.entries(drops).forEach(([id, item]) => {
                item.id = id;
                gameState.droppedItems.push(item);
            });
        });

        this.aiRef.on('value', snapshot => {
            let monsters = snapshot.val() || {};
            gameState.aiMonsters = Object.values(monsters).filter(m => m && m.alive);
        });

        this.fishRef.on('value', snapshot => {
            let fishData = snapshot.val() || {};
            gameState.aiFish = Object.values(fishData).filter(f => f && f.alive);
        });

        this.roomRef.child('winner').on('value', snapshot => {
            let winner = snapshot.val();
            if (winner && gameState.phase === 'playing') endGame(winner);
        });

        this.roomRef.child('host').on('value', snapshot => {
            let hostId = snapshot.val();
            if (!hostId) this.tryBecomeHost();
        });
    },

    // ===== 同步 =====
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

    // ===== 事件发送 =====
    sendDamage(targetId, damage, angle) {
        this.eventsRef.push({
            type: 'damage', target: targetId,
            damage, angle: angle || 0,
            from: gameState.myId, t: Date.now(),
        });
    },

    sendProjectile(arrow) {
        this.eventsRef.push({
            type: 'projectile',
            x: Math.round(arrow.x * 10) / 10,
            y: Math.round(arrow.y * 10) / 10,
            dirX: Math.round(arrow.dirX * 100) / 100,
            dirY: Math.round(arrow.dirY * 100) / 100,
            damage: arrow.damage, speed: arrow.speed,
            owner: arrow.owner, ownerTeam: arrow.ownerTeam,
            t: Date.now(),
        });
    },

    sendExplosion(x, y) {
        this.eventsRef.push({ type: 'explosion', x, y, from: gameState.myId, t: Date.now() });
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

    removeDroppedItem(itemId) { if (this.dropsRef) this.dropsRef.child(itemId).remove(); },

    sendPermaDeath() {
        if (this.myRef) this.myRef.update({ alive: false, lives: 0, permaDead: true });
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
            case 'damage': this.onDamage(event); break;
            case 'projectile': this.onProjectile(event); break;
            case 'explosion': this.onExplosion(event); break;
        }
    },

    onDamage(event) {
        if (event.target === gameState.myId && event.from !== gameState.myId) {
            takeDamage(event.damage, event.angle);
        }
        if (this.isHost && event.target && event.target.startsWith('ai_')) {
            this.damageAI(event.target, event.damage, event.angle);
        }
        if (this.isHost && event.target && event.target.startsWith('fish_')) {
            this.damageFish(event.target, event.damage, event.angle);
        }
    },

    onProjectile(event) {
        if (event.owner === gameState.myId) return;
        gameState.projectiles.push({
            id: event.owner + '_' + event.t,
            x: event.x, y: event.y,
            dirX: event.dirX, dirY: event.dirY,
            damage: event.damage, speed: event.speed,
            owner: event.owner, ownerTeam: event.ownerTeam,
            trail: [{x: event.x, y: event.y}],
            distTraveled: 0,
        });
    },

    onExplosion(event) {
        if (event.from === gameState.myId) return;
        gameState.effects.push({ type: 'explosion', x: event.x, y: event.y, timer: 0.5, maxTimer: 0.5 });
        if (localPlayer.alive) {
            let d = dist(localPlayer.x, localPlayer.y, event.x, event.y);
            let g = Math.ceil(d);
            if (g <= 5 && CREEPER_DMG[g]) {
                let a = angle(event.x, event.y, localPlayer.x, localPlayer.y);
                takeDamage(CREEPER_DMG[g], a);
            }
        }
    },

    // ===== 怪物刷新 =====
    startAISpawner() {
        if (this.aiSpawnInterval) clearInterval(this.aiSpawnInterval);
        this.aiSpawnInterval = setInterval(() => {
            if (gameState.phase !== 'playing' || !this.isHost) return;
            this.spawnMonstersAroundSteves();
        }, this.MONSTER_SPAWN_INTERVAL * 1000);

        setTimeout(() => { if (this.isHost) this.spawnMonstersAroundSteves(); }, 3000);
    },

    spawnMonstersAroundSteves() {
        let steves = Object.values(gameState.players).filter(p => p.team === 'steve' && p.alive);
        if (steves.length === 0) return;

        let currentAI = (gameState.aiMonsters || []).filter(m => m.alive).length;
        if (currentAI >= CONFIG.AI_MAX) return;

        let types = ['zombie', 'skeleton', 'creeper'];

        steves.forEach(steve => {
            for (let i = 0; i < this.MONSTER_SPAWN_COUNT; i++) {
                if (currentAI >= CONFIG.AI_MAX) return;
                let type = types[Math.floor(Math.random() * types.length)];
                let pos = this.getPosAround(steve.x, steve.y, this.MONSTER_SPAWN_MIN, this.MONSTER_SPAWN_MAX, false);
                if (!pos) continue;
                let id = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                this.aiRef.child(id).set({
                    id, type, x: pos.x, y: pos.y,
                    hp: 20, maxHp: 20, alive: true,
                    wanderAngle: Math.random() * Math.PI * 2,
                    wanderTimer: 0,
                });
                currentAI++;
            }
        });
    },

    getPosAround(cx, cy, minD, maxD, wantWater) {
        let attempts = 0;
        while (attempts < 50) {
            let a = Math.random() * Math.PI * 2;
            let d = minD + Math.random() * (maxD - minD);
            let x = Math.floor(cx + Math.cos(a) * d);
            let y = Math.floor(cy + Math.sin(a) * d);
            if (x < 0 || x >= CONFIG.MAP_SIZE || y < 0 || y >= CONFIG.MAP_SIZE) { attempts++; continue; }
            let tile = gameState.map[y] && gameState.map[y][x];
            if (wantWater && tile !== 1) { attempts++; continue; }
            if (!wantWater && tile === 1) { attempts++; continue; }
            return {x, y};
        }
        return null;
    },

    // ===== 鱼群 =====
    initFish() {
        let data = {};
        for (let i = 0; i < this.FISH_TOTAL; i++) {
            let pos = getRandomWaterPos();
            let id = 'fish_' + i;
            data[id] = {
                id, type: 'fish', x: pos.x, y: pos.y,
                hp: CONFIG.FISH_HP, maxHp: CONFIG.FISH_HP,
                alive: true,
                wanderAngle: Math.random() * Math.PI * 2,
                wanderTimer: Math.random() * 3,
            };
        }
        this.fishRef.set(data);
    },

    startFishManager() {
        if (this.fishCheckInterval) clearInterval(this.fishCheckInterval);
        this.fishCheckInterval = setInterval(() => {
            if (gameState.phase !== 'playing' || !this.isHost) return;
            this.replenishFish();
        }, 5000);
    },

    replenishFish() {
        let alive = (gameState.aiFish || []).filter(f => f.alive).length;
        let needed = this.FISH_TOTAL - alive;
        if (needed <= 0) return;

        let steves = Object.values(gameState.players).filter(p => p.team === 'steve' && p.alive);

        for (let i = 0; i < needed; i++) {
            let pos = null;
            if (steves.length > 0) {
                let s = steves[Math.floor(Math.random() * steves.length)];
                pos = this.getPosAround(s.x, s.y, 30, 60, true);
            }
            if (!pos) pos = getRandomWaterPos();

            let id = 'fish_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            this.fishRef.child(id).set({
                id, type: 'fish', x: pos.x, y: pos.y,
                hp: CONFIG.FISH_HP, maxHp: CONFIG.FISH_HP,
                alive: true,
                wanderAngle: Math.random() * Math.PI * 2,
                wanderTimer: Math.random() * 3,
            });
        }
    },

    damageFish(fishId, damage, fromAngle) {
        let fish = (gameState.aiFish || []).find(f => f.id === fishId);
        if (!fish || !fish.alive) return;
        fish.hp -= damage;
        if (fromAngle !== undefined) {
            let nx = fish.x + Math.cos(fromAngle) * CONFIG.KNOCKBACK_DIST;
            let ny = fish.y + Math.sin(fromAngle) * CONFIG.KNOCKBACK_DIST;
            let tx = Math.floor(nx), ty = Math.floor(ny);
            if (gameState.map[ty] && gameState.map[ty][tx] === 1) { fish.x = nx; fish.y = ny; }
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

    damageAI(aiId, damage, fromAngle) {
        let m = gameState.aiMonsters.find(x => x.id === aiId);
        if (!m || !m.alive) return;
        m.hp -= damage;
        if (fromAngle !== undefined) {
            m.x += Math.cos(fromAngle) * CONFIG.KNOCKBACK_DIST;
            m.y += Math.sin(fromAngle) * CONFIG.KNOCKBACK_DIST;
            m.x = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, m.x));
            m.y = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, m.y));
        }
        if (m.hp <= 0) {
            m.alive = false;
            this.aiRef.child(aiId).update({alive: false, hp: 0});
            setTimeout(() => this.aiRef.child(aiId).remove(), 2000);
        } else {
            this.aiRef.child(aiId).update({
                hp: m.hp,
                x: Math.round(m.x * 10) / 10,
                y: Math.round(m.y * 10) / 10,
            });
        }
    },

    // ===== AI行为 =====
    startAIBehavior() {
        if (this.aiBehaviorInterval) clearInterval(this.aiBehaviorInterval);
        this.aiBehaviorInterval = setInterval(() => {
            if (gameState.phase !== 'playing' || !this.isHost) return;
            gameState.aiMonsters.forEach(m => { if (m.alive) this.updateMonster(m); });
            (gameState.aiFish || []).forEach(f => { if (f.alive) this.updateFish(f); });
        }, 500);
    },

    updateMonster(m) {
        let dt = 0.5;
        let nearSteve = null, nearDist = 999;
        Object.values(gameState.players).forEach(p => {
            if (p.team !== 'steve' || !p.alive) return;
            let d = dist(m.x, m.y, p.x, p.y);
            if (d < nearDist) { nearDist = d; nearSteve = p; }
        });

        let speed;
        switch (m.type) {
            case 'zombie': speed = CONFIG.ZOMBIE_SPEED; break;
            case 'skeleton': speed = CONFIG.SKELETON_SPEED; break;
            case 'creeper': speed = CONFIG.CREEPER_SPEED; break;
            default: speed = 4;
        }

        let tx = Math.floor(m.x), ty = Math.floor(m.y);
        let inWater = gameState.map[ty] && gameState.map[ty][tx] === 1;
        if (inWater) speed *= CONFIG.WATER_SLOW;

        let moveAngle, chasing = false;

        if (nearSteve && nearDist <= this.MONSTER_AGGRO_RANGE) {
            moveAngle = angle(m.x, m.y, nearSteve.x, nearSteve.y);
            chasing = true;
        } else {
            m.wanderTimer = (m.wanderTimer || 0) - dt;
            if (m.wanderTimer <= 0) {
                m.wanderAngle = Math.random() * Math.PI * 2;
                m.wanderTimer = 2 + Math.random() * 3;
            }
            moveAngle = m.wanderAngle || 0;
            speed = this.MONSTER_WANDER_SPEED;
            if (inWater) speed *= CONFIG.WATER_SLOW;
        }

        let nx = m.x + Math.cos(moveAngle) * speed * dt;
        let ny = m.y + Math.sin(moveAngle) * speed * dt;
        nx = Math.max(1, Math.min(CONFIG.MAP_SIZE - 2, nx));
        ny = Math.max(1, Math.min(CONFIG.MAP_SIZE - 2, ny));
        m.x = nx; m.y = ny;

        // 攻击
        if (chasing && nearSteve) {
            let atkRange, atkDmg;
            switch (m.type) {
                case 'zombie': atkRange = CONFIG.ZOMBIE_RANGE; atkDmg = CONFIG.ZOMBIE_DAMAGE; break;
                case 'skeleton': atkRange = CONFIG.SKELETON_RANGE; atkDmg = CONFIG.SKELETON_DAMAGE; break;
                case 'creeper':
                    if (nearDist < 2) { this.aiCreeperExplode(m); return; }
                    atkRange = 0; break;
                default: atkRange = 3; atkDmg = 4;
            }

            if (atkRange > 0 && nearDist <= atkRange) {
                let atkAngle = angle(m.x, m.y, nearSteve.x, nearSteve.y);
                if (m.type === 'skeleton' && nearDist > 3) {
                    this.eventsRef.push({
                        type: 'projectile',
                        x: m.x, y: m.y,
                        dirX: Math.round(Math.cos(atkAngle) * 100) / 100,
                        dirY: Math.round(Math.sin(atkAngle) * 100) / 100,
                        damage: atkDmg, speed: CONFIG.ARROW_SPEED,
                        owner: m.id, ownerTeam: 'monster', t: Date.now(),
                    });
                } else if (m.type !== 'skeleton') {
                    this.eventsRef.push({
                        type: 'damage', target: nearSteve.id,
                        damage: atkDmg, angle: atkAngle,
                        from: m.id, t: Date.now(),
                    });
                }
            }
        }

        this.aiRef.child(m.id).update({
            x: Math.round(m.x * 10) / 10,
            y: Math.round(m.y * 10) / 10,
            wanderAngle: m.wanderAngle,
            wanderTimer: m.wanderTimer,
        });
    },

    updateFish(f) {
        let dt = 0.5;
        let nearSteve = null, nearDist = 999;
        Object.values(gameState.players).forEach(p => {
            if (p.team !== 'steve' || !p.alive) return;
            let d = dist(f.x, f.y, p.x, p.y);
            if (d < nearDist) { nearDist = d; nearSteve = p; }
        });

        let speed = CONFIG.FISH_SPEED;
        let moveAngle, chasing = false;

        if (nearSteve && nearDist <= this.FISH_AGGRO_RANGE) {
            moveAngle = angle(f.x, f.y, nearSteve.x, nearSteve.y);
            chasing = true;
        } else {
            f.wanderTimer = (f.wanderTimer || 0) - dt;
            if (f.wanderTimer <= 0) {
                f.wanderAngle = Math.random() * Math.PI * 2;
                f.wanderTimer = 1 + Math.random() * 3;
            }
            moveAngle = f.wanderAngle || 0;
            speed = this.FISH_WANDER_SPEED;
        }

        let nx = f.x + Math.cos(moveAngle) * speed * dt;
        let ny = f.y + Math.sin(moveAngle) * speed * dt;
        nx = Math.max(1, Math.min(CONFIG.MAP_SIZE - 2, nx));
        ny = Math.max(1, Math.min(CONFIG.MAP_SIZE - 2, ny));

        let ntx = Math.floor(nx), nty = Math.floor(ny);
        if (gameState.map[nty] && gameState.map[nty][ntx] === 1) {
            f.x = nx; f.y = ny;
        } else {
            f.wanderAngle = Math.random() * Math.PI * 2;
            f.wanderTimer = 1;
        }

        if (chasing && nearSteve && nearDist <= CONFIG.FISH_RANGE) {
            let atkAngle = angle(f.x, f.y, nearSteve.x, nearSteve.y);
            this.eventsRef.push({
                type: 'damage', target: nearSteve.id,
                damage: CONFIG.FISH_DAMAGE, angle: atkAngle,
                from: f.id, t: Date.now(),
            });
        }

        this.fishRef.child(f.id).update({
            x: Math.round(f.x * 10) / 10,
            y: Math.round(f.y * 10) / 10,
            wanderAngle: f.wanderAngle,
            wanderTimer: f.wanderTimer,
        });
    },

    aiCreeperExplode(m) {
        this.eventsRef.push({ type: 'explosion', x: m.x, y: m.y, from: m.id, t: Date.now() });
        Object.values(gameState.players).forEach(p => {
            if (p.team !== 'steve' || !p.alive) return;
            let d = dist(m.x, m.y, p.x, p.y);
            let g = Math.ceil(d);
            if (g <= 5 && CREEPER_DMG[g]) {
                let a = angle(m.x, m.y, p.x, p.y);
                this.eventsRef.push({
                    type: 'damage', target: p.id,
                    damage: CREEPER_DMG[g], angle: a,
                    from: m.id, t: Date.now(),
                });
            }
        });
        m.alive = false;
        this.aiRef.child(m.id).update({alive: false, hp: 0});
        setTimeout(() => this.aiRef.child(m.id).remove(), 2000);
    },

    // ===== Host管理 =====
    checkHostDuty() {
        this.roomRef.child('host').once('value', snapshot => {
            let hostId = snapshot.val();
            if (hostId && gameState.players[hostId]) this.isHost = false;
            else this.tryBecomeHost();
        });
    },

    tryBecomeHost() {
        this.roomRef.child('host').transaction(cur => {
            if (!cur || !gameState.players[cur]) return gameState.myId;
            return cur;
        }, (err, committed) => {
            if (committed) {
                this.isHost = true;
                this.startAISpawner();
                this.startAIBehavior();
                this.startFishManager();
            }
        });
    },

    checkSteveStatus() {
        let any = false;
        Object.values(gameState.players).forEach(p => {
            if (p.team === 'steve' && (p.lives > 0 || p.alive) && !p.permaDead) any = true;
        });
        if (!any) {
            let has = Object.values(gameState.players).some(p => p.team === 'steve');
            if (has) endGame('monster');
        }
    },

    // ===== 清理 =====
    cleanup() {
        if (this.aiSpawnInterval) clearInterval(this.aiSpawnInterval);
        if (this.aiBehaviorInterval) clearInterval(this.aiBehaviorInterval);
        if (this.fishCheckInterval) clearInterval(this.fishCheckInterval);
        if (this.myRef) this.myRef.remove();
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

window.addEventListener('beforeunload', () => NetworkManager.cleanup());

