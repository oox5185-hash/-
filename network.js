// ============ Firebase 联机网络 ============

const NetworkManager = {
    roomRef: null,
    playersRef: null,
    syncInterval: null,
    lastSync: 0,

    // 加入/创建房间
    joinRoom(roomId, playerData) {
        if (!roomId) {
            // 创建新房间
            roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
        }

        gameState.roomId = roomId;
        gameState.myId = db.ref().push().key;

        this.roomRef = db.ref('rooms/' + roomId);
        this.playersRef = this.roomRef.child('players');

        // 写入玩家数据
        let playerRef = this.playersRef.child(gameState.myId);
        playerRef.set({
            id: gameState.myId,
            name: playerData.name,
            team: playerData.team,
            monster: playerData.monster || null,
            x: 250,
            y: 250,
            hp: playerData.team === 'steve' ? GAME_CONFIG.STEVE_HP : (playerData.monster === 'fish' ? GAME_CONFIG.FISH_HP : 20),
            maxHp: playerData.team === 'steve' ? GAME_CONFIG.STEVE_HP : (playerData.monster === 'fish' ? GAME_CONFIG.FISH_HP : 20),
            lives: playerData.team === 'steve' ? GAME_CONFIG.STEVE_LIVES : 999,
            alive: true,
            ready: true,
        });

        // 断开时移除
        playerRef.onDisconnect().remove();

        // 监听玩家列表变化
        this.playersRef.on('value', snapshot => {
            let players = snapshot.val() || {};
            gameState.players = players;
            this.updateWaitingScreen(players);
        });

        // 监听游戏状态
        this.roomRef.child('state').on('value', snapshot => {
            let state = snapshot.val();
            if (state === 'playing' && gameState.phase === 'waiting') {
                this.onGameStart();
            }
            if (state === 'ended') {
                let winner = snapshot.ref.parent.child('winner');
                // handled separately
            }
        });

        // 监听游戏开始的seed
        this.roomRef.child('seed').on('value', snapshot => {
            let seed = snapshot.val();
            if (seed && gameState.phase === 'playing') {
                gameState.map = generateMap(seed);
            }
        });

        // 监听攻击事件
        this.roomRef.child('events').on('child_added', snapshot => {
            let event = snapshot.val();
            this.handleEvent(event);
            snapshot.ref.remove(); // 处理后删除
        });

        // 监听掉落物
        this.roomRef.child('drops').on('value', snapshot => {
            gameState.droppedItems = [];
            let drops = snapshot.val() || {};
            Object.entries(drops).forEach(([id, item]) => {
                item.id = id;
                gameState.droppedItems.push(item);
            });
        });

        // 监听AI怪物
        this.roomRef.child('aiMonsters').on('value', snapshot => {
            let monsters = snapshot.val() || {};
            gameState.aiMonsters = Object.values(monsters);
        });

        // 监听游戏结束
        this.roomRef.child('winner').on('value', snapshot => {
            let winner = snapshot.val();
            if (winner) {
                endGame(winner);
            }
        });

        return roomId;
    },

    updateWaitingScreen(players) {
        if (gameState.phase !== 'waiting') return;

        let content = document.getElementById('player-list-content');
        content.innerHTML = '';

        let steveCount = 0;
        let monsterCount = 0;

        Object.values(players).forEach(p => {
            let div = document.createElement('div');
            div.className = 'player-item';
            let teamLabel = p.team === 'steve' ? '👤 史蒂夫' : `👾 ${p.monster || '怪物'}`;
            div.textContent = `${p.name} - ${teamLabel}`;
            content.appendChild(div);

            if (p.team === 'steve') steveCount++;
            else monsterCount++;
        });

        // 检查是否可以开始（至少1个史蒂夫）
        let startBtn = document.getElementById('start-btn');
        if (steveCount >= 1) {
            startBtn.style.display = 'block';
            document.getElementById('waiting-info').textContent = `史蒂夫: ${steveCount}/3 | 怪物: ${monsterCount} | 可以开始！`;
        } else {
            startBtn.style.display = 'none';
            document.getElementById('waiting-info').textContent = `等待史蒂夫加入... (当前: ${steveCount})`;
        }
    },

    // 开始游戏
    startGameNetwork() {
        let seed = Math.floor(Math.random() * 999999);
        this.roomRef.child('seed').set(seed);
        this.roomRef.child('state').set('playing');
        this.roomRef.child('startTime').set(Date.now());
    },

    onGameStart() {
        gameState.phase = 'playing';

        document.getElementById('waiting-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';

        // 获取seed生成地图
        this.roomRef.child('seed').once('value', snapshot => {
            let seed = snapshot.val();
            gameState.map = generateMap(seed);

            // 初始化玩家位置
            if (gameState.myTeam === 'steve') {
                localPlayer.x = 250;
                localPlayer.y = 250;
                localPlayer.hp = GAME_CONFIG.STEVE_HP;
                localPlayer.maxHp = GAME_CONFIG.STEVE_HP;
                localPlayer.lives = GAME_CONFIG.STEVE_LIVES;
                localPlayer.arrows = GAME_CONFIG.MAX_ARROWS;
                localPlayer.swordDurability = GAME_CONFIG.SWORD_DURABILITY;
                localPlayer.potions = 1;
            } else {
                let pos;
                if (gameState.myMonster === 'fish') {
                    pos = getRandomWaterPosition();
                    localPlayer.hp = GAME_CONFIG.FISH_HP;
                    localPlayer.maxHp = GAME_CONFIG.FISH_HP;
                } else {
                    pos = getRandomLandPosition();
                    localPlayer.hp = 20;
                    localPlayer.maxHp = 20;
                }
                localPlayer.x = pos.x;
                localPlayer.y = pos.y;
            }

            updateHUD();
            this.syncPlayer();

            // 如果是房主，负责刷怪
            this.startAISpawner();
        });

        // 定期同步
        this.syncInterval = setInterval(() => this.syncPlayer(), 100);
    },

    // 同步玩家状态
    syncPlayer() {
        if (!gameState.myId || !this.playersRef) return;

        let now = Date.now();
        if (now - this.lastSync < 80) return; // 限制同步频率
        this.lastSync = now;

        this.playersRef.child(gameState.myId).update({
            x: Math.round(localPlayer.x * 100) / 100,
            y: Math.round(localPlayer.y * 100) / 100,
            hp: localPlayer.hp,
            alive: localPlayer.alive,
            lives: localPlayer.lives,
        });
    },

    // 发送攻击事件
    sendAttack(type, targetId, damage) {
        this.roomRef.child('events').push({
            type: 'attack',
            attackType: type,
            from: gameState.myId,
            target: targetId,
            damage: damage,
            timestamp: Date.now(),
        });
    },

    sendDamage(targetId, damage) {
        this.roomRef.child('events').push({
            type: 'damage',
            target: targetId,
            damage: damage,
            from: gameState.myId,
            timestamp: Date.now(),
        });
    },

    sendProjectile(arrow) {
        this.roomRef.child('events').push({
            type: 'projectile',
            x: arrow.x,
            y: arrow.y,
            targetId: arrow.targetId,
            targetX: arrow.targetX,
            targetY: arrow.targetY,
            damage: arrow.damage,
            speed: arrow.speed,
            owner: arrow.owner,
            timestamp: Date.now(),
        });
    },

    sendExplosion(x, y) {
        this.roomRef.child('events').push({
            type: 'explosion',
            x: x,
            y: y,
            from: gameState.myId,
            timestamp: Date.now(),
        });
    },

    sendDrop(x, y, items) {
        this.roomRef.child('drops').push({
            x: x,
            y: y,
            arrows: items.arrows,
            swordDurability: items.swordDurability,
            potions: items.potions,
            timestamp: Date.now(),
        });
    },

    removeDroppedItem(itemId) {
        this.roomRef.child('drops/' + itemId).remove();
    },

    sendPermaDeath() {
        this.playersRef.child(gameState.myId).update({
            alive: false,
            lives: 0,
            permaDead: true,
        });
    },

    sendGameOver(winner) {
        this.roomRef.child('winner').set(winner);
        this.roomRef.child('state').set('ended');
    },

    // 处理网络事件
    handleEvent(event) {
        if (!event) return;

        // 不处理自己发的
        if (event.from === gameState.myId && event.type === 'damage') {
            // 伤害事件是发给目标的
        }

        switch (event.type) {
            case 'damage':
                if (event.target === gameState.myId) {
                    takeDamage(event.damage);
                }
                break;

            case 'projectile':
                if (event.owner !== gameState.myId) {
                    gameState.projectiles.push({
                        x: event.x,
                        y: event.y,
                        targetId: event.targetId,
                        targetX: event.targetX,
                        targetY: event.targetY,
                        damage: event.damage,
                        speed: event.speed,
                        owner: event.owner,
                    });
                }
                break;

            case 'explosion':
                if (event.from !== gameState.myId) {
                    gameState.effects.push({
                        type: 'explosion',
                        x: event.x,
                        y: event.y,
                        timer: 0.5,
                    });
                    // 计算自己是否受伤
                    if (gameState.myTeam === 'steve' && localPlayer.alive) {
                        let dist = Math.sqrt((localPlayer.x - event.x) ** 2 + (localPlayer.y - event.y) ** 2);
                        let gridDist = Math.ceil(dist);
                        if (gridDist <= 5 && CREEPER_DAMAGE[gridDist]) {
                            takeDamage(CREEPER_DAMAGE[gridDist]);
                        }
                    }
                }
                break;

            case 'gameOver':
                endGame(event.winner);
                break;
        }
    },

    // AI怪物刷新（只有房间第一个玩家执行）
    startAISpawner() {
        // 简单方案：每个客户端都尝试刷怪，用时间戳去重
        setInterval(() => {
            if (gameState.phase !== 'playing') return;

            // 只让第一个玩家负责刷怪
            let playerIds = Object.keys(gameState.players).sort();
            if (playerIds[0] !== gameState.myId) return;

            // 刷新5个AI怪物
            for (let i = 0; i < GAME_CONFIG.AI_SPAWN_COUNT; i++) {
                let types = ['zombie', 'skeleton', 'creeper', 'fish'];
                let type = types[Math.floor(Math.random() * types.length)];
                let pos;
                if (type === 'fish') {
                    pos = getRandomWaterPosition();
                } else {
                    pos = getRandomLandPosition();
                }

                let monsterId = 'ai_' + Date.now() + '_' + i;
                let hp = type === 'fish' ? GAME_CONFIG.FISH_HP : 20;

                this.roomRef.child('aiMonsters/' + monsterId).set({
                    id: monsterId,
                    type: type,
                    x: pos.x,
                    y: pos.y,
                    hp: hp,
                    maxHp: hp,
                    alive: true,
                });
            }
        }, GAME_CONFIG.AI_SPAWN_RATE * 1000);
    },
};

// ============ 界面交互函数 ============

function joinGame() {
    let roomId = document.getElementById('room-input').value.trim().toUpperCase();
    let name = document.getElementById('name-input').value.trim();

    if (!name) {
        alert('请输入名字！');
        return;
    }

    gameState.myTeam = selectedTeam;
    gameState.myMonster = selectedMonster;
    gameState.myName = name;

    // 设置本地玩家
    if (selectedTeam === 'steve') {
        localPlayer.maxHp = GAME_CONFIG.STEVE_HP;
        localPlayer.hp = GAME_CONFIG.STEVE_HP;
    } else {
        if (selectedMonster === 'fish') {
            localPlayer.maxHp = GAME_CONFIG.FISH_HP;
            localPlayer.hp = GAME_CONFIG.FISH_HP;
        } else {
            localPlayer.maxHp = 20;
            localPlayer.hp = 20;
        }
    }

    // 加入房间
    let finalRoomId = NetworkManager.joinRoom(roomId, {
        name: name,
        team: selectedTeam,
        monster: selectedMonster,
    });

    // 切换到等待界面
    gameState.phase = 'waiting';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'flex';
    document.getElementById('room-code-display').textContent = '房间号: ' + finalRoomId;
}

function startGame() {
    // 检查是否有史蒂夫
    let steveCount = Object.values(gameState.players).filter(p => p.team === 'steve').length;
    if (steveCount < 1) {
        alert('需要至少1个史蒂夫才能开始！');
        return;
    }

    NetworkManager.startGameNetwork();
}

