// ============ MC风格像素贴图渲染器 ============

const Renderer = {
    cache: {},
    TILE: 16,

    init() {
        this.createGrassTile();
        this.createWaterTiles();
        this.createSteve();
        this.createZombie();
        this.createSkeleton();
        this.createCreeper();
        this.createFish();
        this.createSword();
        this.createBow();
        this.createArrowItem();
        this.createArrowProjectile();
        this.createPotion();
        this.createChest();
        this.createVillageHouse();
        this.createExplosion();
        this.createHeart();
        this.createHalfHeart();
        this.createEmptyHeart();
    },

    newCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
    },

    // ===== 草方块 =====
    createGrassTile() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 泥土层
        x.fillStyle = '#8B6B3E';
        x.fillRect(0, 0, 16, 16);
        // 随机泥土纹理
        const dirtColors = ['#7A5C33', '#6B5230', '#9B7B4E', '#8B6B3E'];
        for (let i = 0; i < 30; i++) {
            x.fillStyle = dirtColors[Math.floor(Math.random() * 4)];
            x.fillRect(Math.floor(Math.random() * 16), 4 + Math.floor(Math.random() * 12), 1, 1);
        }
        // 草顶层
        const grassColors = ['#5D9B3A', '#4E8B2F', '#6DAB4A', '#5A9638', '#4C8530', '#3D7A25'];
        for (let px = 0; px < 16; px++) {
            for (let py = 0; py < 5; py++) {
                x.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
                x.fillRect(px, py, 1, 1);
            }
        }
        // 草地过渡
        for (let px = 0; px < 16; px++) {
            if (Math.random() > 0.5) {
                x.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
                x.fillRect(px, 5, 1, 1);
            }
        }
        this.cache.grass = c;
    },

    // ===== 水方块（4帧动画）=====
    createWaterTiles() {
        this.cache.water = [];
        for (let frame = 0; frame < 4; frame++) {
            const c = this.newCanvas(16, 16);
            const x = c.getContext('2d');
            // 深水底色
            x.fillStyle = '#1E3A7A';
            x.fillRect(0, 0, 16, 16);
            // 水面纹理
            const waterColors = ['#2848B5', '#3155C8', '#1F3D8A', '#2550A0', '#3A62D0', '#264DA8'];
            for (let px = 0; px < 16; px++) {
                for (let py = 0; py < 16; py++) {
                    if (Math.random() < 0.4) {
                        x.fillStyle = waterColors[(px + py + frame) % waterColors.length];
                        x.fillRect(px, py, 1, 1);
                    }
                }
            }
            // 波光
            x.fillStyle = 'rgba(100,180,255,0.3)';
            for (let px = 0; px < 16; px++) {
                let wy = Math.floor(Math.sin((px + frame * 3) * 0.6) * 1.5 + 4);
                x.fillRect(px, wy, 1, 1);
            }
            x.fillStyle = 'rgba(200,230,255,0.2)';
            for (let px = 0; px < 16; px++) {
                let wy = Math.floor(Math.cos((px + frame * 2) * 0.4) * 1.5 + 10);
                x.fillRect(px, wy, 1, 1);
            }
            this.cache.water.push(c);
        }
    },

    // ===== 史蒂夫（俯视角）=====
    createSteve() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 身体-蓝色衬衫
        x.fillStyle = '#3C8BC7';
        x.fillRect(4, 6, 8, 6);
        // 裤子
        x.fillStyle = '#2B2B5E';
        x.fillRect(5, 12, 3, 4);
        x.fillRect(8, 12, 3, 4);
        // 手臂
        x.fillStyle = '#B78B60';
        x.fillRect(2, 7, 2, 5);
        x.fillRect(12, 7, 2, 5);
        // 头
        x.fillStyle = '#B78B60';
        x.fillRect(4, 0, 8, 6);
        // 头发
        x.fillStyle = '#382B1A';
        x.fillRect(4, 0, 8, 2);
        x.fillRect(4, 2, 1, 2);
        x.fillRect(11, 2, 1, 2);
        // 眼睛
        x.fillStyle = '#FFFFFF';
        x.fillRect(5, 3, 2, 1);
        x.fillRect(9, 3, 2, 1);
        x.fillStyle = '#382B1A';
        x.fillRect(6, 3, 1, 1);
        x.fillRect(9, 3, 1, 1);
        // 嘴
        x.fillStyle = '#8B5E3C';
        x.fillRect(7, 5, 2, 1);
        this.cache.steve = c;
    },

    // ===== 僵尸 =====
    createZombie() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 身体
        x.fillStyle = '#32694E';
        x.fillRect(4, 6, 8, 6);
        // 裤子
        x.fillStyle = '#2B4C3F';
        x.fillRect(5, 12, 3, 4);
        x.fillRect(8, 12, 3, 4);
        // 手臂（伸出来）
        x.fillStyle = '#5A8B4C';
        x.fillRect(1, 6, 3, 2);
        x.fillRect(12, 6, 3, 2);
        // 头
        x.fillStyle = '#5A8B4C';
        x.fillRect(4, 0, 8, 6);
        // 深色头发
        x.fillStyle = '#2E4A2E';
        x.fillRect(4, 0, 8, 2);
        // 眼睛（黑色空洞）
        x.fillStyle = '#000000';
        x.fillRect(5, 3, 2, 2);
        x.fillRect(9, 3, 2, 2);
        this.cache.zombie = c;
    },

    // ===== 骷髅 =====
    createSkeleton() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 身体骨架
        x.fillStyle = '#C8C8C8';
        x.fillRect(6, 6, 4, 6);
        x.fillStyle = '#6B6B6B';
        x.fillRect(7, 7, 2, 4);
        // 腿骨
        x.fillStyle = '#C8C8C8';
        x.fillRect(6, 12, 2, 4);
        x.fillRect(8, 12, 2, 4);
        // 手臂骨
        x.fillRect(3, 6, 3, 1);
        x.fillRect(10, 6, 3, 1);
        x.fillRect(3, 6, 1, 4);
        x.fillRect(12, 6, 1, 4);
        // 头骨
        x.fillStyle = '#D8D8D8';
        x.fillRect(4, 0, 8, 6);
        // 眼窝
        x.fillStyle = '#1A1A1A';
        x.fillRect(5, 2, 2, 2);
        x.fillRect(9, 2, 2, 2);
        // 鼻子
        x.fillRect(7, 3, 2, 2);
        // 牙齿
        x.fillStyle = '#C8C8C8';
        x.fillRect(5, 5, 1, 1);
        x.fillRect(7, 5, 1, 1);
        x.fillRect(9, 5, 1, 1);
        this.cache.skeleton = c;
    },

    // ===== 苦力怕 =====
    createCreeper() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        const greens = ['#43A047', '#2E7D32', '#388E3C', '#4CAF50', '#3B8C3F'];
        // 身体（像素噪点绿色）
        for (let px = 3; px < 13; px++) {
            for (let py = 0; py < 16; py++) {
                x.fillStyle = greens[Math.floor(Math.random() * greens.length)];
                x.fillRect(px, py, 1, 1);
            }
        }
        // 脸（标志性）
        x.fillStyle = '#1A1A1A';
        // 眼睛
        x.fillRect(5, 3, 2, 2);
        x.fillRect(9, 3, 2, 2);
        // 嘴（倒T）
        x.fillRect(7, 5, 2, 1);
        x.fillRect(6, 6, 4, 2);
        x.fillRect(6, 8, 1, 2);
        x.fillRect(9, 8, 1, 2);
        // 短腿
        x.fillStyle = '#2E7D32';
        x.fillRect(4, 13, 3, 3);
        x.fillRect(9, 13, 3, 3);
        this.cache.creeper = c;
    },

    // ===== 鱼（鳕鱼）=====
    createFish() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 身体
        x.fillStyle = '#8B7355';
        x.fillRect(3, 5, 10, 5);
        // 肚皮
        x.fillStyle = '#C8B78B';
        x.fillRect(4, 8, 8, 2);
        // 尾巴
        x.fillStyle = '#6B5A3E';
        x.fillRect(1, 5, 2, 2);
        x.fillRect(0, 6, 1, 2);
        x.fillRect(1, 8, 2, 2);
        // 背鳍
        x.fillStyle = '#6B5A3E';
        x.fillRect(6, 3, 4, 2);
        // 腹鳍
        x.fillRect(7, 10, 3, 1);
        // 眼睛
        x.fillStyle = '#FFFFFF';
        x.fillRect(11, 5, 2, 2);
        x.fillStyle = '#000000';
        x.fillRect(12, 5, 1, 1);
        // 嘴
        x.fillRect(13, 7, 1, 1);
        this.cache.fish = c;
    },

    // ===== 铁剑（手持）=====
    createSword() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 剑刃
        x.fillStyle = '#D8D8D8';
        x.fillRect(7, 1, 2, 8);
        x.fillStyle = '#E8E8E8';
        x.fillRect(8, 1, 1, 8);
        // 剑尖
        x.fillStyle = '#C0C0C0';
        x.fillRect(7, 0, 2, 1);
        // 护手
        x.fillStyle = '#5A3E1E';
        x.fillRect(5, 9, 6, 1);
        // 剑柄
        x.fillStyle = '#6B4226';
        x.fillRect(7, 10, 2, 4);
        // 柄底
        x.fillStyle = '#5A3E1E';
        x.fillRect(7, 14, 2, 1);
        this.cache.sword = c;
    },

    // ===== 弓 =====
    createBow() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 弓身
        x.fillStyle = '#8B5E3C';
        x.fillRect(4, 2, 1, 12);
        x.fillRect(5, 1, 1, 1);
        x.fillRect(5, 13, 1, 1);
        x.fillRect(6, 0, 1, 1);
        x.fillRect(6, 14, 1, 1);
        // 弓弦
        x.fillStyle = '#E8E8E8';
        x.fillRect(8, 1, 1, 14);
        // 连接
        x.fillStyle = '#A0A0A0';
        x.fillRect(7, 0, 1, 1);
        x.fillRect(7, 15, 1, 1);
        this.cache.bow = c;
    },

    // ===== 箭（物品）=====
    createArrowItem() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 箭杆
        x.fillStyle = '#6B5230';
        x.fillRect(7, 4, 2, 9);
        // 箭头
        x.fillStyle = '#808080';
        x.fillRect(7, 1, 2, 3);
        x.fillStyle = '#606060';
        x.fillRect(6, 2, 1, 2);
        x.fillRect(9, 2, 1, 2);
        // 箭羽
        x.fillStyle = '#F0F0F0';
        x.fillRect(6, 12, 1, 2);
        x.fillRect(9, 12, 1, 2);
        x.fillStyle = '#E0E0E0';
        x.fillRect(5, 13, 1, 1);
        x.fillRect(10, 13, 1, 1);
        this.cache.arrowItem = c;
    },

    // ===== 箭（飞行中）=====
    createArrowProjectile() {
        const c = this.newCanvas(12, 4);
        const x = c.getContext('2d');
        // 箭头
        x.fillStyle = '#808080';
        x.fillRect(0, 1, 3, 2);
        x.fillRect(0, 0, 1, 4);
        // 箭杆
        x.fillStyle = '#6B5230';
        x.fillRect(3, 1, 6, 2);
        // 箭羽
        x.fillStyle = '#F0F0F0';
        x.fillRect(9, 0, 2, 1);
        x.fillRect(9, 3, 2, 1);
        x.fillRect(10, 1, 2, 2);
        this.cache.arrowFlying = c;
    },

    // ===== 药水 =====
    createPotion() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 瓶口
        x.fillStyle = '#8B7355';
        x.fillRect(6, 1, 4, 2);
        x.fillStyle = '#A08060';
        x.fillRect(7, 0, 2, 1);
        // 瓶颈
        x.fillStyle = '#5A5A8B';
        x.fillRect(6, 3, 4, 2);
        // 瓶身
        x.fillStyle = '#4A4A7A';
        x.fillRect(4, 5, 8, 8);
        x.fillRect(5, 13, 6, 2);
        // 液体
        x.fillStyle = '#E03030';
        x.fillRect(5, 6, 6, 6);
        // 高光
        x.fillStyle = 'rgba(255,150,150,0.5)';
        x.fillRect(5, 6, 2, 2);
        this.cache.potion = c;
    },

    // ===== 箱子（掉落物/补给）=====
    createChest() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        // 箱体
        x.fillStyle = '#8B5E3C';
        x.fillRect(1, 4, 14, 10);
        // 深色边框
        x.fillStyle = '#5A3E1E';
        x.fillRect(1, 4, 14, 1);
        x.fillRect(1, 4, 1, 10);
        x.fillRect(14, 4, 1, 10);
        x.fillRect(1, 13, 14, 1);
        // 箱盖线
        x.fillStyle = '#5A3E1E';
        x.fillRect(1, 8, 14, 1);
        // 锁扣
        x.fillStyle = '#FFD700';
        x.fillRect(7, 7, 2, 3);
        x.fillStyle = '#DAA520';
        x.fillRect(7, 7, 2, 1);
        // 顶部
        x.fillStyle = '#A07040';
        x.fillRect(2, 2, 12, 2);
        x.fillStyle = '#7A5030';
        x.fillRect(2, 2, 12, 1);
        this.cache.chest = c;
    },

    // ===== 村庄房子（补给点俯视图）=====
    createVillageHouse() {
        const c = this.newCanvas(48, 48);
        const x = c.getContext('2d');
        // 地基/地板（橡木板）
        x.fillStyle = '#B8944C';
        x.fillRect(4, 4, 40, 40);
        // 墙壁（圆石）
        x.fillStyle = '#808080';
        x.fillRect(4, 4, 40, 3); // 上墙
        x.fillRect(4, 41, 40, 3); // 下墙
        x.fillRect(4, 4, 3, 40); // 左墙
        x.fillRect(41, 4, 3, 40); // 右墙
        // 墙壁纹理
        x.fillStyle = '#6B6B6B';
        for (let i = 0; i < 8; i++) {
            x.fillRect(4 + i * 5, 4, 2, 3);
            x.fillRect(4 + i * 5, 41, 2, 3);
        }
        // 门（下方中间）
        x.fillStyle = '#5A3E1E';
        x.fillRect(20, 41, 8, 3);
        x.fillStyle = '#8B5E3C';
        x.fillRect(21, 41, 6, 3);
        // 门把
        x.fillStyle = '#FFD700';
        x.fillRect(25, 42, 1, 1);
        // 窗户
        x.fillStyle = '#87CEEB';
        x.fillRect(10, 5, 4, 2);
        x.fillRect(34, 5, 4, 2);
        // 窗框
        x.fillStyle = '#5A3E1E';
        x.fillRect(12, 5, 1, 2);
        x.fillRect(36, 5, 1, 2);
        // 屋内地板
        x.fillStyle = '#C8A050';
        x.fillRect(7, 7, 34, 34);
        // 箱子在中间
        x.drawImage(this.cache.chest, 0, 0, 16, 16, 16, 16, 16, 16);
        this.cache.villageHouse = c;
    },

    // ===== 爆炸特效 =====
    createExplosion() {
        this.cache.explosion = [];
        for (let frame = 0; frame < 5; frame++) {
            const c = this.newCanvas(32, 32);
            const x = c.getContext('2d');
            let size = 4 + frame * 5;
            // 外圈
            x.fillStyle = `rgba(255,${50 + frame * 30},0,${1 - frame * 0.15})`;
            x.beginPath();
            x.arc(16, 16, size, 0, Math.PI * 2);
            x.fill();
            // 内圈
            x.fillStyle = `rgba(255,${180 + frame * 15},0,${0.8 - frame * 0.1})`;
            x.beginPath();
            x.arc(16, 16, size * 0.6, 0, Math.PI * 2);
            x.fill();
            // 中心白色
            if (frame < 3) {
                x.fillStyle = `rgba(255,255,255,${0.8 - frame * 0.2})`;
                x.beginPath();
                x.arc(16, 16, size * 0.25, 0, Math.PI * 2);
                x.fill();
            }
            this.cache.explosion.push(c);
        }
    },

    // ===== 心（满）=====
    createHeart() {
        const c = this.newCanvas(9, 9);
        const x = c.getContext('2d');
        // MC心形像素图案
        const heart = [
            [0,1,1,0,0,0,1,1,0],
            [1,1,1,1,0,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,1,0],
            [0,0,1,1,1,1,1,0,0],
            [0,0,0,1,1,1,0,0,0],
            [0,0,0,0,1,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
        ];
        for (let py = 0; py < 9; py++) {
            for (let px = 0; px < 9; px++) {
                if (heart[py][px]) {
                    x.fillStyle = '#E03030';
                    x.fillRect(px, py, 1, 1);
                }
            }
        }
        // 高光
        x.fillStyle = '#FF6060';
        x.fillRect(2, 1, 1, 1);
        x.fillRect(1, 2, 1, 1);
        this.cache.heartFull = c;
    },

    // ===== 半心 =====
    createHalfHeart() {
        const c = this.newCanvas(9, 9);
        const x = c.getContext('2d');
        const heart = [
            [0,1,1,0,0,0,1,1,0],
            [1,1,1,1,0,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,1,0],
            [0,0,1,1,1,1,1,0,0],
            [0,0,0,1,1,1,0,0,0],
            [0,0,0,0,1,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
        ];
        // 右半灰色
        for (let py = 0; py < 9; py++) {
            for (let px = 0; px < 9; px++) {
                if (heart[py][px]) {
                    x.fillStyle = px < 5 ? '#E03030' : '#444444';
                    x.fillRect(px, py, 1, 1);
                }
            }
        }
        x.fillStyle = '#FF6060';
        x.fillRect(2, 1, 1, 1);
        this.cache.heartHalf = c;
    },

    // ===== 空心 =====
    createEmptyHeart() {
        const c = this.newCanvas(9, 9);
        const x = c.getContext('2d');
        const heart = [
            [0,1,1,0,0,0,1,1,0],
            [1,1,1,1,0,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,1,0],
            [0,0,1,1,1,1,1,0,0],
            [0,0,0,1,1,1,0,0,0],
            [0,0,0,0,1,0,0,0,0],
            [0,0,0,0,0,0,0,0,0],
        ];
        for (let py = 0; py < 9; py++) {
            for (let px = 0; px < 9; px++) {
                if (heart[py][px]) {
                    x.fillStyle = '#333333';
                    x.fillRect(px, py, 1, 1);
                }
            }
        }
        this.cache.heartEmpty = c;
    },

    // ===== 绘制方法 =====

    drawTile(ctx, type, sx, sy, size, frame) {
        let img;
        if (type === 'grass') img = this.cache.grass;
        else if (type === 'water') img = this.cache.water[frame % 4];
        if (img) ctx.drawImage(img, sx, sy, size, size);
    },

    drawEntity(ctx, type, sx, sy, size) {
        const img = this.cache[type];
        if (img) ctx.drawImage(img, sx, sy, size, size);
    },

    drawHeldWeapon(ctx, sx, sy, size, weapon, angle) {
        const img = this.cache[weapon];
        if (!img) return;
        ctx.save();
        ctx.translate(sx + size * 0.8, sy + size * 0.5);
        ctx.rotate(angle || 0.3);
        ctx.drawImage(img, -size * 0.2, -size * 0.1, size * 0.5, size * 0.7);
        ctx.restore();
    },

    // 刀光效果（60度扇形）
    drawSlashEffect(ctx, sx, sy, size, angle, progress) {
        ctx.save();
        ctx.translate(sx + size / 2, sy + size / 2);
        ctx.rotate(angle);

        let radius = size * 3;
        let alpha = 1 - progress;

        // 扇形刀光
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, -Math.PI / 6, Math.PI / 6);
        ctx.closePath();

        let gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, `rgba(255,255,255,${alpha * 0.1})`);
        gradient.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.6})`);
        gradient.addColorStop(0.8, `rgba(200,220,255,${alpha * 0.8})`);
        gradient.addColorStop(1, `rgba(150,200,255,${alpha * 0.3})`);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 边缘线
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * (0.6 + progress * 0.4), -Math.PI / 6, Math.PI / 6);
        ctx.stroke();

        ctx.restore();
    },

    // 箭飞行（带旋转）
    drawArrow(ctx, sx, sy, size, angle) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.cache.arrowFlying, -size * 0.4, -size * 0.1, size * 0.8, size * 0.25);
        ctx.restore();
    },

    // 箭轨迹（白色虚线）
    drawArrowTrail(ctx, points, camX, camY, tileSize) {
        if (points.length < 2) return;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let first = true;
        for (let i = Math.max(0, points.length - 15); i < points.length; i++) {
            let px = (points[i].x - camX) * tileSize;
            let py = (points[i].y - camY) * tileSize;
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    },

    // 绘制心形血量
    drawHearts(ctx, hp, maxHp, startX, startY) {
        let totalHearts = Math.ceil(maxHp / 2);
        for (let i = 0; i < totalHearts; i++) {
            let hx = startX + i * 14;
            let heartHp = hp - i * 2;
            let img;
            if (heartHp >= 2) img = this.cache.heartFull;
            else if (heartHp === 1) img = this.cache.heartHalf;
            else img = this.cache.heartEmpty;
            ctx.drawImage(img, hx, startY, 13, 13);
        }
    },

    // 小地图
    drawMinimap(ctx, map, localPlayer, players, aiMonsters, drops, mapSize, range) {
        const w = 120, h = 120;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, w, h);

        let scale = w / (range * 2);
        let cx = localPlayer.x;
        let cy = localPlayer.y;

        // 地形
        let step = 3;
        for (let dx = -range; dx < range; dx += step) {
            for (let dy = -range; dy < range; dy += step) {
                let mx = Math.floor(cx + dx);
                let my = Math.floor(cy + dy);
                if (mx < 0 || mx >= mapSize || my < 0 || my >= mapSize) continue;
                let sx = (dx + range) * scale;
                let sy = (dy + range) * scale;
                let tile = map[my] && map[my][mx];
                ctx.fillStyle = tile === 1 ? '#1E3A7A' : '#3D7A25';
                ctx.fillRect(sx, sy, step * scale + 1, step * scale + 1);
            }
        }

        // 补给点（中心箱子）
        let supDx = 250 - cx;
        let supDy = 250 - cy;
        if (Math.abs(supDx) < range && Math.abs(supDy) < range) {
            let sx = (supDx + range) * scale;
            let sy = (supDy + range) * scale;
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(sx - 3, sy - 3, 6, 6);
            ctx.fillStyle = '#8B5E3C';
            ctx.fillRect(sx - 2, sy - 2, 4, 4);
        }

        // 掉落物
        if (drops) {
            drops.forEach(d => {
                let ddx = d.x - cx, ddy = d.y - cy;
                if (Math.abs(ddx) < range && Math.abs(ddy) < range) {
                    let sx = (ddx + range) * scale;
                    let sy = (ddy + range) * scale;
                    ctx.fillStyle = '#DAA520';
                    ctx.fillRect(sx - 2, sy - 2, 4, 4);
                }
            });
        }

        // 其他玩家
        Object.values(players).forEach(p => {
            if (p.id === localPlayer.id) return;
            if (!p.alive) return;
            let pdx = p.x - cx, pdy = p.y - cy;
            if (Math.abs(pdx) >= range || Math.abs(pdy) >= range) return;
            let sx = (pdx + range) * scale;
            let sy = (pdy + range) * scale;
            ctx.fillStyle = p.team === localPlayer.team ? '#4ecca3' : '#e74c3c';
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // AI怪物
        aiMonsters.forEach(m => {
            if (!m.alive) return;
            let mdx = m.x - cx, mdy = m.y - cy;
            if (Math.abs(mdx) >= range || Math.abs(mdy) >= range) return;
            let sx = (mdx + range) * scale;
            let sy = (mdy + range) * scale;
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(sx - 2, sy - 2, 4, 4);
        });

        // 自己（白点）
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // 边框
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w, h);
    }
};

