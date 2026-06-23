// ============ MC风格像素贴图绘制 ============

const Renderer = {
    // 方块大小
    TILE_SIZE: 16,

    // 颜色定义
    colors: {
        // 草方块
        grassTop: ['#5D9B3A', '#4E8B2F', '#6DAB4A', '#5A9638', '#4C8530'],
        grassSide: ['#8B6B3E', '#7A5C33', '#6B5230', '#9B7B4E'],
        // 水
        water: ['#2848B5', '#3155C8', '#1F3D8A', '#2550A0', '#3A62D0'],
        // 史蒂夫
        steveSkin: '#B78B60',
        steveHair: '#382B1A',
        steveShirt: '#3C8BC7',
        stevePants: '#2B2B5E',
        steveEyes: '#FFFFFF',
        steveEyePupil: '#382B1A',
        // 僵尸
        zombieSkin: '#5A8B4C',
        zombieShirt: '#32694E',
        zombiePants: '#2B4C3F',
        zombieEyes: '#000000',
        // 骷髅
        skeletonBone: '#C8C8C8',
        skeletonDark: '#6B6B6B',
        skeletonEyes: '#1A1A1A',
        // 苦力怕
        creeperGreen: ['#43A047', '#2E7D32', '#388E3C', '#4CAF50'],
        creeperFace: '#1A1A1A',
        // 鱼
        fishBody: '#8B7355',
        fishBelly: '#C8B78B',
        fishFin: '#6B5A3E',
        // 物品
        ironSword: '#D8D8D8',
        swordHandle: '#6B5230',
        bowWood: '#8B5E3C',
        bowString: '#E8E8E8',
        arrowHead: '#808080',
        arrowShaft: '#6B5230',
        potionBottle: '#3E3E6B',
        potionLiquid: '#C83232',
    },

    // 创建离屏canvas缓存贴图
    cache: {},

    init() {
        this.createGrassTile();
        this.createWaterTiles();
        this.createSteve();
        this.createZombie();
        this.createSkeleton();
        this.createCreeper();
        this.createFish();
        this.createSword();
        this.createArrow();
        this.createPotion();
        this.createSupplyPoint();
    },

    createCanvas(width, height) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        return c;
    },

    // 草方块贴图
    createGrassTile() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 棕色泥土底
        ctx.fillStyle = '#8B6B3E';
        ctx.fillRect(0, 0, 16, 16);
        // 绿色草顶
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 6; y++) {
                ctx.fillStyle = this.colors.grassTop[Math.floor(Math.random() * this.colors.grassTop.length)];
                ctx.fillRect(x, y, 1, 1);
            }
        }
        // 泥土噪点
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = this.colors.grassSide[Math.floor(Math.random() * this.colors.grassSide.length)];
            ctx.fillRect(Math.floor(Math.random() * 16), 6 + Math.floor(Math.random() * 10), 1, 1);
        }
        this.cache.grass = c;
    },

    // 水方块贴图（多帧动画）
    createWaterTiles() {
        this.cache.water = [];
        for (let frame = 0; frame < 4; frame++) {
            const c = this.createCanvas(16, 16);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#2848B5';
            ctx.fillRect(0, 0, 16, 16);
            for (let x = 0; x < 16; x++) {
                for (let y = 0; y < 16; y++) {
                    if (Math.random() < 0.3) {
                        ctx.fillStyle = this.colors.water[(x + y + frame) % this.colors.water.length];
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
            // 水面高光
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            for (let x = 0; x < 16; x++) {
                let wy = Math.sin((x + frame * 4) * 0.5) * 2 + 3;
                ctx.fillRect(x, Math.floor(wy), 1, 1);
            }
            this.cache.water.push(c);
        }
    },

    // 史蒂夫贴图（俯视角）
    createSteve() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 身体（蓝色衬衫）
        ctx.fillStyle = this.colors.steveShirt;
        ctx.fillRect(4, 6, 8, 7);
        // 裤子
        ctx.fillStyle = this.colors.stevePants;
        ctx.fillRect(4, 13, 8, 3);
        // 头
        ctx.fillStyle = this.colors.steveSkin;
        ctx.fillRect(4, 0, 8, 6);
        // 头发
        ctx.fillStyle = this.colors.steveHair;
        ctx.fillRect(4, 0, 8, 2);
        ctx.fillRect(4, 0, 1, 4);
        ctx.fillRect(11, 0, 1, 4);
        // 眼睛
        ctx.fillStyle = this.colors.steveEyes;
        ctx.fillRect(5, 3, 2, 1);
        ctx.fillRect(9, 3, 2, 1);
        ctx.fillStyle = this.colors.steveEyePupil;
        ctx.fillRect(6, 3, 1, 1);
        ctx.fillRect(10, 3, 1, 1);
        // 嘴
        ctx.fillStyle = '#8B5E3C';
        ctx.fillRect(7, 5, 2, 1);
        this.cache.steve = c;
    },

    // 僵尸贴图
    createZombie() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 身体
        ctx.fillStyle = this.colors.zombieShirt;
        ctx.fillRect(4, 6, 8, 7);
        // 裤子
        ctx.fillStyle = this.colors.zombiePants;
        ctx.fillRect(4, 13, 8, 3);
        // 头（绿色皮肤）
        ctx.fillStyle = this.colors.zombieSkin;
        ctx.fillRect(4, 0, 8, 6);
        // 头发（深绿）
        ctx.fillStyle = '#2E5230';
        ctx.fillRect(4, 0, 8, 2);
        // 眼睛（黑色空洞）
        ctx.fillStyle = this.colors.zombieEyes;
        ctx.fillRect(5, 3, 2, 2);
        ctx.fillRect(9, 3, 2, 2);
        this.cache.zombie = c;
    },

    // 骷髅贴图
    createSkeleton() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 身体（骨头色）
        ctx.fillStyle = this.colors.skeletonBone;
        ctx.fillRect(5, 6, 6, 7);
        ctx.fillStyle = this.colors.skeletonDark;
        ctx.fillRect(6, 7, 1, 5);
        ctx.fillRect(9, 7, 1, 5);
        // 腿
        ctx.fillStyle = this.colors.skeletonBone;
        ctx.fillRect(5, 13, 2, 3);
        ctx.fillRect(9, 13, 2, 3);
        // 头
        ctx.fillStyle = this.colors.skeletonBone;
        ctx.fillRect(4, 0, 8, 6);
        // 眼睛（黑洞）
        ctx.fillStyle = this.colors.skeletonEyes;
        ctx.fillRect(5, 2, 2, 2);
        ctx.fillRect(9, 2, 2, 2);
        // 鼻子
        ctx.fillRect(7, 3, 2, 2);
        // 嘴
        ctx.fillRect(5, 5, 6, 1);
        this.cache.skeleton = c;
    },

    // 苦力怕贴图
    createCreeper() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 身体（绿色方块）
        for (let x = 3; x < 13; x++) {
            for (let y = 0; y < 16; y++) {
                ctx.fillStyle = this.colors.creeperGreen[Math.floor(Math.random() * 4)];
                ctx.fillRect(x, y, 1, 1);
            }
        }
        // 标志性脸
        ctx.fillStyle = this.colors.creeperFace;
        // 眼睛
        ctx.fillRect(5, 3, 2, 2);
        ctx.fillRect(9, 3, 2, 2);
        // 嘴（倒T形）
        ctx.fillRect(7, 5, 2, 1);
        ctx.fillRect(6, 6, 4, 2);
        ctx.fillRect(6, 8, 1, 2);
        ctx.fillRect(9, 8, 1, 2);
        this.cache.creeper = c;
    },

    // 鱼贴图
    createFish() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 身体
        ctx.fillStyle = this.colors.fishBody;
        ctx.fillRect(3, 5, 10, 6);
        // 肚子
        ctx.fillStyle = this.colors.fishBelly;
        ctx.fillRect(4, 8, 8, 3);
        // 尾巴
        ctx.fillStyle = this.colors.fishFin;
        ctx.fillRect(1, 6, 2, 4);
        // 鱼鳍
        ctx.fillRect(7, 4, 3, 1);
        ctx.fillRect(7, 11, 3, 1);
        // 眼睛
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(10, 6, 2, 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(11, 6, 1, 1);
        this.cache.fish = c;
    },

    // 铁剑贴图
    createSword() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 剑刃
        ctx.fillStyle = this.colors.ironSword;
        ctx.fillRect(7, 1, 2, 9);
        ctx.fillRect(6, 2, 1, 2);
        ctx.fillRect(9, 2, 1, 2);
        // 护手
        ctx.fillStyle = '#3E3E3E';
        ctx.fillRect(5, 10, 6, 1);
        // 剑柄
        ctx.fillStyle = this.colors.swordHandle;
        ctx.fillRect(7, 11, 2, 4);
        this.cache.sword = c;
    },

    // 箭贴图
    createArrow() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 箭杆
        ctx.fillStyle = this.colors.arrowShaft;
        ctx.fillRect(7, 3, 2, 10);
        // 箭头
        ctx.fillStyle = this.colors.arrowHead;
        ctx.fillRect(7, 1, 2, 3);
        ctx.fillRect(6, 2, 1, 1);
        ctx.fillRect(9, 2, 1, 1);
        // 箭羽
        ctx.fillStyle = '#F0F0F0';
        ctx.fillRect(6, 12, 1, 2);
        ctx.fillRect(9, 12, 1, 2);
        this.cache.arrow = c;
    },

    // 药水贴图
    createPotion() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 瓶口
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(6, 1, 4, 2);
        // 瓶身
        ctx.fillStyle = this.colors.potionBottle;
        ctx.fillRect(5, 3, 6, 3);
        ctx.fillRect(4, 6, 8, 7);
        ctx.fillRect(5, 13, 6, 2);
        // 液体
        ctx.fillStyle = this.colors.potionLiquid;
        ctx.fillRect(5, 7, 6, 5);
        this.cache.potion = c;
    },

    // 补给点贴图
    createSupplyPoint() {
        const c = this.createCanvas(16, 16);
        const ctx = c.getContext('2d');
        // 箱子
        ctx.fillStyle = '#8B5E3C';
        ctx.fillRect(2, 4, 12, 10);
        ctx.fillStyle = '#6B4226';
        ctx.fillRect(2, 4, 12, 1);
        ctx.fillRect(2, 8, 12, 1);
        // 锁扣
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(7, 7, 2, 3);
        this.cache.supply = c;
    },

    // 爆炸效果
    createExplosion() {
        const c = this.createCanvas(32, 32);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(16, 16, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFCC00';
        ctx.beginPath();
        ctx.arc(16, 16, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(16, 16, 3, 0, Math.PI * 2);
        ctx.fill();
        this.cache.explosion = c;
    },

    // 绘制贴图到游戏画布
    drawTile(ctx, type, x, y, size, frame) {
        let img;
        if (type === 'grass') {
            img = this.cache.grass;
        } else if (type === 'water') {
            img = this.cache.water[frame % 4];
        }
        if (img) {
            ctx.drawImage(img, x, y, size, size);
        }
    },

    drawEntity(ctx, type, x, y, size) {
        const img = this.cache[type];
        if (img) {
            ctx.drawImage(img, x, y, size, size);
        }
    }
};

