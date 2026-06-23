// ============ MC风格像素贴图渲染器 ============

const Renderer = {
    cache: {},

    init() {
        this.createGrassTile();
        this.createSandTile();
        this.createWaterTiles();
        this.createSteve();
        this.createZombie();
        this.createSkeleton();
        this.createCreeper();
        this.createFish();
        this.createSword();
        this.createBow();
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

    createGrassTile() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        const greens = ['#4A8C2A','#5D9B3A','#4E8B2F','#6DAB4A','#3D7A25','#5A9638','#4C8530','#3F7E28','#58A040'];
        x.fillStyle = '#4E8B2F';
        x.fillRect(0, 0, 16, 16);
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                if (Math.random() < 0.65) {
                    x.fillStyle = greens[Math.floor(Math.random() * greens.length)];
                    x.fillRect(px, py, 1, 1);
                }
            }
        }
        for (let i = 0; i < 8; i++) {
            x.fillStyle = '#2D6B1A';
            x.fillRect(Math.floor(Math.random()*16), Math.floor(Math.random()*16), 1, 1);
        }
        for (let i = 0; i < 5; i++) {
            x.fillStyle = '#7EC850';
            x.fillRect(Math.floor(Math.random()*16), Math.floor(Math.random()*16), 1, 1);
        }
        this.cache.grass = c;
    },

    createSandTile() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        const sands = ['#E8D5A0','#DCC890','#F0E0B0','#D4BC80','#E0CFA0','#C8B070'];
        x.fillStyle = '#DCC890';
        x.fillRect(0, 0, 16, 16);
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                if (Math.random() < 0.5) {
                    x.fillStyle = sands[Math.floor(Math.random() * sands.length)];
                    x.fillRect(px, py, 1, 1);
                }
            }
        }
        for (let i = 0; i < 6; i++) {
            x.fillStyle = '#B8A060';
            x.fillRect(Math.floor(Math.random()*16), Math.floor(Math.random()*16), 1, 1);
        }
        this.cache.sand = c;
    },

    createWaterTiles() {
        this.cache.water = [];
        for (let frame = 0; frame < 4; frame++) {
            const c = this.newCanvas(16, 16);
            const x = c.getContext('2d');
            x.fillStyle = '#1E3A7A';
            x.fillRect(0, 0, 16, 16);
            const wc = ['#2848B5','#3155C8','#1F3D8A','#2550A0','#3A62D0','#264DA8'];
            for (let px = 0; px < 16; px++) {
                for (let py = 0; py < 16; py++) {
                    if (Math.random() < 0.4) {
                        x.fillStyle = wc[(px+py+frame) % wc.length];
                        x.fillRect(px, py, 1, 1);
                    }
                }
            }
            x.fillStyle = 'rgba(100,180,255,0.3)';
            for (let px = 0; px < 16; px++) {
                let wy = Math.floor(Math.sin((px+frame*3)*0.6)*1.5+4);
                x.fillRect(px, wy, 1, 1);
            }
            this.cache.water.push(c);
        }
    },

    createSteve() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        x.fillStyle='#3C8BC7'; x.fillRect(4,6,8,6);
        x.fillStyle='#2B2B5E'; x.fillRect(5,12,3,4); x.fillRect(8,12,3,4);
        x.fillStyle='#B78B60'; x.fillRect(2,7,2,5); x.fillRect(12,7,2,5);
        x.fillStyle='#B78B60'; x.fillRect(4,0,8,6);
        x.fillStyle='#382B1A'; x.fillRect(4,0,8,2); x.fillRect(4,2,1,2); x.fillRect(11,2,1,2);
        x.fillStyle='#FFFFFF'; x.fillRect(5,3,2,1); x.fillRect(9,3,2,1);
        x.fillStyle='#382B1A'; x.fillRect(6,3,1,1); x.fillRect(9,3,1,1);
        x.fillStyle='#8B5E3C'; x.fillRect(7,5,2,1);
        this.cache.steve = c;
    },

    createZombie() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        x.fillStyle='#32694E'; x.fillRect(4,6,8,6);
        x.fillStyle='#2B4C3F'; x.fillRect(5,12,3,4); x.fillRect(8,12,3,4);
        x.fillStyle='#5A8B4C'; x.fillRect(1,6,3,2); x.fillRect(12,6,3,2);
        x.fillStyle='#5A8B4C'; x.fillRect(4,0,8,6);
        x.fillStyle='#2E4A2E'; x.fillRect(4,0,8,2);
        x.fillStyle='#000000'; x.fillRect(5,3,2,2); x.fillRect(9,3,2,2);
        this.cache.zombie = c;
    },

    createSkeleton() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        x.fillStyle='#C8C8C8'; x.fillRect(6,6,4,6);
        x.fillStyle='#6B6B6B'; x.fillRect(7,7,2,4);
        x.fillStyle='#C8C8C8'; x.fillRect(6,12,2,4); x.fillRect(8,12,2,4);
        x.fillRect(3,6,3,1); x.fillRect(10,6,3,1);
        x.fillRect(3,6,1,4); x.fillRect(12,6,1,4);
        x.fillStyle='#D8D8D8'; x.fillRect(4,0,8,6);
        x.fillStyle='#1A1A1A'; x.fillRect(5,2,2,2); x.fillRect(9,2,2,2); x.fillRect(7,3,2,2);
        x.fillStyle='#C8C8C8'; x.fillRect(5,5,1,1); x.fillRect(7,5,1,1); x.fillRect(9,5,1,1);
        this.cache.skeleton = c;
    },

    createCreeper() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        const g = ['#43A047','#2E7D32','#388E3C','#4CAF50','#3B8C3F'];
        for (let px=3;px<13;px++) for (let py=0;py<16;py++) {
            x.fillStyle = g[Math.floor(Math.random()*g.length)];
            x.fillRect(px,py,1,1);
        }
        x.fillStyle='#1A1A1A';
        x.fillRect(5,3,2,2); x.fillRect(9,3,2,2);
        x.fillRect(7,5,2,1); x.fillRect(6,6,4,2);
        x.fillRect(6,8,1,2); x.fillRect(9,8,1,2);
        x.fillStyle='#2E7D32'; x.fillRect(4,13,3,3); x.fillRect(9,13,3,3);
        this.cache.creeper = c;
    },

    createFish() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        x.fillStyle='#8B7355'; x.fillRect(3,5,10,5);
        x.fillStyle='#C8B78B'; x.fillRect(4,8,8,2);
        x.fillStyle='#6B5A3E'; x.fillRect(1,5,2,2); x.fillRect(0,6,1,2); x.fillRect(1,8,2,2);
        x.fillRect(6,3,4,2); x.fillRect(7,10,3,1);
        x.fillStyle='#FFFFFF'; x.fillRect(11,5,2,2);
        x.fillStyle='#000000'; x.fillRect(12,5,1,1); x.fillRect(13,7,1,1);
        this.cache.fish = c;
    },

    createSword() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        x.fillStyle='#D8D8D8'; x.fillRect(7,1,2,8);
        x.fillStyle='#E8E8E8'; x.fillRect(8,1,1,8);
        x.fillStyle='#C0C0C0'; x.fillRect(7,0,2,1);
        x.fillStyle='#5A3E1E'; x.fillRect(5,9,6,1);
        x.fillStyle='#6B4226'; x.fillRect(7,10,2,4);
        this.cache.sword = c;
    },

    createBow() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        x.fillStyle='#8B5E3C';
        x.fillRect(4,2,1,12); x.fillRect(5,1,1,1); x.fillRect(5,13,1,1);
        x.fillRect(6,0,1,1); x.fillRect(6,14,1,1);
        x.fillStyle='#E8E8E8'; x.fillRect(8,1,1,14);
        x.fillStyle='#A0A0A0'; x.fillRect(7,0,1,1); x.fillRect(7,15,1,1);
        this.cache.bow = c;
    },

    createArrowProjectile() {
        const c = this.newCanvas(12, 4);
        const x = c.getContext('2d');
        x.fillStyle='#808080'; x.fillRect(0,1,3,2); x.fillRect(0,0,1,4);
        x.fillStyle='#6B5230'; x.fillRect(3,1,6,2);
        x.fillStyle='#F0F0F0'; x.fillRect(9,0,2,1); x.fillRect(9,3,2,1); x.fillRect(10,1,2,2);
        this.cache.arrowFlying = c;
    },

    createPotion() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        x.fillStyle='#8B7355'; x.fillRect(6,1,4,2); x.fillRect(7,0,2,1);
        x.fillStyle='#4A4A7A'; x.fillRect(6,3,4,2); x.fillRect(4,5,8,8); x.fillRect(5,13,6,2);
        x.fillStyle='#E03030'; x.fillRect(5,6,6,6);
        x.fillStyle='rgba(255,150,150,0.5)'; x.fillRect(5,6,2,2);
        this.cache.potion = c;
    },

    createChest() {
        const c = this.newCanvas(16, 16);
        const x = c.getContext('2d');
        x.fillStyle='#8B5E3C'; x.fillRect(1,4,14,10);
        x.fillStyle='#5A3E1E'; x.fillRect(1,4,14,1); x.fillRect(1,4,1,10);
        x.fillRect(14,4,1,10); x.fillRect(1,13,14,1); x.fillRect(1,8,14,1);
        x.fillStyle='#FFD700'; x.fillRect(7,7,2,3);
        x.fillStyle='#A07040'; x.fillRect(2,2,12,2);
        x.fillStyle='#7A5030'; x.fillRect(2,2,12,1);
        this.cache.chest = c;
    },

    createVillageHouse() {
        const c = this.newCanvas(48, 48);
        const x = c.getContext('2d');
        x.fillStyle='#B8944C'; x.fillRect(4,4,40,40);
        x.fillStyle='#808080';
        x.fillRect(4,4,40,3); x.fillRect(4,41,40,3);
        x.fillRect(4,4,3,40); x.fillRect(41,4,3,40);
        x.fillStyle='#6B6B6B';
        for(let i=0;i<8;i++){x.fillRect(4+i*5,4,2,3);x.fillRect(4+i*5,41,2,3);}
        x.fillStyle='#5A3E1E'; x.fillRect(20,41,8,3);
        x.fillStyle='#8B5E3C'; x.fillRect(21,41,6,3);
        x.fillStyle='#FFD700'; x.fillRect(25,42,1,1);
        x.fillStyle='#87CEEB'; x.fillRect(10,5,4,2); x.fillRect(34,5,4,2);
        x.fillStyle='#C8A050'; x.fillRect(7,7,34,34);
        if(this.cache.chest) x.drawImage(this.cache.chest,0,0,16,16,16,16,16,16);
        this.cache.villageHouse = c;
    },

    createExplosion() {
        this.cache.explosion = [];
        for (let frame = 0; frame < 5; frame++) {
            const c = this.newCanvas(32, 32);
            const x = c.getContext('2d');
            let size = 4 + frame * 5;
            x.fillStyle = `rgba(255,${50+frame*30},0,${1-frame*0.15})`;
            x.beginPath(); x.arc(16,16,size,0,Math.PI*2); x.fill();
            x.fillStyle = `rgba(255,${180+frame*15},0,${0.8-frame*0.1})`;
            x.beginPath(); x.arc(16,16,size*0.6,0,Math.PI*2); x.fill();
            if(frame<3){
                x.fillStyle=`rgba(255,255,255,${0.8-frame*0.2})`;
                x.beginPath();x.arc(16,16,size*0.25,0,Math.PI*2);x.fill();
            }
            this.cache.explosion.push(c);
        }
    },

    createHeart() {
        const c = this.newCanvas(9, 9);
        const x = c.getContext('2d');
        const h=[[0,1,1,0,0,0,1,1,0],[1,1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,0,0,0,0,0,0]];
        for(let py=0;py<9;py++)for(let px=0;px<9;px++)if(h[py][px]){x.fillStyle='#E03030';x.fillRect(px,py,1,1);}
        x.fillStyle='#FF6060';x.fillRect(2,1,1,1);x.fillRect(1,2,1,1);
        this.cache.heartFull = c;
    },

    createHalfHeart() {
        const c = this.newCanvas(9, 9);
        const x = c.getContext('2d');
        const h=[[0,1,1,0,0,0,1,1,0],[1,1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,0,0,0,0,0,0]];
        for(let py=0;py<9;py++)for(let px=0;px<9;px++)if(h[py][px]){x.fillStyle=px<5?'#E03030':'#444444';x.fillRect(px,py,1,1);}
        x.fillStyle='#FF6060';x.fillRect(2,1,1,1);
        this.cache.heartHalf = c;
    },

    createEmptyHeart() {
        const c = this.newCanvas(9, 9);
        const x = c.getContext('2d');
        const h=[[0,1,1,0,0,0,1,1,0],[1,1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,0,0,0,0,0,0]];
        for(let py=0;py<9;py++)for(let px=0;px<9;px++)if(h[py][px]){x.fillStyle='#333333';x.fillRect(px,py,1,1);}
        this.cache.heartEmpty = c;
    },

    // ===== 绘制方法 =====

    drawTile(ctx, type, sx, sy, size, frame) {
        let img;
        if (type === 'grass') img = this.cache.grass;
        else if (type === 'sand') img = this.cache.sand;
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
        ctx.drawImage(img, -size*0.15, -size*0.1, size*0.45, size*0.65);
        ctx.restore();
    },

    drawSlashEffect(ctx, sx, sy, size, angle, progress) {
        ctx.save();
        ctx.translate(sx + size/2, sy + size/2);
        ctx.rotate(angle);
        let radius = size * 3;
        let alpha = 1 - progress;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius * (0.5 + progress*0.5), -Math.PI/6, Math.PI/6);
        ctx.closePath();
        let grad = ctx.createRadialGradient(0,0,0,0,0,radius);
        grad.addColorStop(0, `rgba(255,255,255,${alpha*0.1})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${alpha*0.6})`);
        grad.addColorStop(1, `rgba(200,220,255,${alpha*0.2})`);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${alpha*0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius*(0.6+progress*0.4), -Math.PI/6, Math.PI/6);
        ctx.stroke();
        ctx.restore();
    },

    drawArrow(ctx, sx, sy, size, angle) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.cache.arrowFlying, -size*0.4, -size*0.1, size*0.8, size*0.25);
        ctx.restore();
    },

    drawArrowTrail(ctx, points, camX, camY, tileSize) {
        if (points.length < 2) return;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let first = true;
        for (let i = Math.max(0, points.length-15); i < points.length; i++) {
            let px = (points[i].x - camX) * tileSize;
            let py = (points[i].y - camY) * tileSize;
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    },

    drawHearts(ctx, hp, maxHp, startX, startY) {
        let total = Math.ceil(maxHp / 2);
        for (let i = 0; i < total; i++) {
            let hx = startX + i * 14;
            let heartHp = hp - i * 2;
            let img;
            if (heartHp >= 2) img = this.cache.heartFull;
            else if (heartHp === 1) img = this.cache.heartHalf;
            else img = this.cache.heartEmpty;
            ctx.drawImage(img, hx, startY, 13, 13);
        }
    },

    // 小地图（增加敌对生物方向箭头）
    drawMinimap(ctx, map, localPlayer, players, aiAll, drops, mapSize, range, isMonsterTeam) {
        const w = 110, h = 110;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, w, h);
        let scale = w / (range * 2);
        let cx = localPlayer.x, cy = localPlayer.y;

        // 地形
        let step = 3;
        for (let dx = -range; dx < range; dx += step) {
            for (let dy = -range; dy < range; dy += step) {
                let mx = Math.floor(cx+dx), my = Math.floor(cy+dy);
                if (mx<0||mx>=mapSize||my<0||my>=mapSize) continue;
                let sx = (dx+range)*scale, sy = (dy+range)*scale;
                let tile = map[my] && map[my][mx];
                ctx.fillStyle = tile===1?'#1E3A7A': tile===2?'#DCC890':'#3D7A25';
                ctx.fillRect(sx, sy, step*scale+1, step*scale+1);
            }
        }

        // 补给点
        let supDx=250-cx, supDy=250-cy;
        if(Math.abs(supDx)<range&&Math.abs(supDy)<range){
            let sx=(supDx+range)*scale, sy=(supDy+range)*scale;
            ctx.fillStyle='#FFD700'; ctx.fillRect(sx-3,sy-3,6,6);
            ctx.fillStyle='#8B5E3C'; ctx.fillRect(sx-2,sy-2,4,4);
        }

        // 掉落物
        if(drops) drops.forEach(d=>{
            let ddx=d.x-cx,ddy=d.y-cy;
            if(Math.abs(ddx)<range&&Math.abs(ddy)<range){
                let sx=(ddx+range)*scale,sy=(ddy+range)*scale;
                ctx.fillStyle='#DAA520'; ctx.fillRect(sx-2,sy-2,4,4);
            }
        });

        // 其他玩家
        Object.values(players).forEach(p=>{
            if(p.id===localPlayer.id||!p.alive) return;
            let pdx=p.x-cx,pdy=p.y-cy;
            let inRange = Math.abs(pdx)<range&&Math.abs(pdy)<range;

            if(inRange){
                let sx=(pdx+range)*scale,sy=(pdy+range)*scale;
                ctx.fillStyle = p.team===localPlayer.team?'#4ecca3':'#e74c3c';
                ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2); ctx.fill();
            }

            // 敌对生物玩家：显示Steve方向箭头（无论距离）
            if(isMonsterTeam && p.team==='steve' && !inRange){
                let ang = Math.atan2(pdy, pdx);
                let edgeX = w/2 + Math.cos(ang)*(w/2-8);
                let edgeY = h/2 + Math.sin(ang)*(h/2-8);
                // 画三角箭头
                ctx.save();
                ctx.translate(edgeX, edgeY);
                ctx.rotate(ang);
                ctx.fillStyle='#ff4444';
                ctx.beginPath();
                ctx.moveTo(6,0);
                ctx.lineTo(-4,-4);
                ctx.lineTo(-4,4);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        });

        // AI
        aiAll.forEach(m=>{
            if(!m.alive) return;
            let mdx=m.x-cx,mdy=m.y-cy;
            if(Math.abs(mdx)>=range||Math.abs(mdy)>=range) return;
            let sx=(mdx+range)*scale,sy=(mdy+range)*scale;
            ctx.fillStyle='#e74c3c'; ctx.fillRect(sx-2,sy-2,4,4);
        });

        // 自己
        ctx.fillStyle='#FFFFFF';
        ctx.beginPath(); ctx.arc(w/2,h/2,3,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#555'; ctx.lineWidth=1; ctx.strokeRect(0,0,w,h);
    },

    // 全图绘制
    drawFullMap(ctx, canvasW, canvasH, map, localPlayer, players, aiAll, mapSize, isMonsterTeam) {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvasW, canvasH);
        let scale = canvasW / mapSize;

        // 地形（大步长）
        let step = Math.max(2, Math.floor(mapSize / canvasW));
        for (let y = 0; y < mapSize; y += step) {
            for (let x = 0; x < mapSize; x += step) {
                let tile = map[y] && map[y][x];
                ctx.fillStyle = tile===1?'#1E3A7A': tile===2?'#DCC890':'#3D7A25';
                ctx.fillRect(x*scale, y*scale, step*scale+1, step*scale+1);
            }
        }

        // 补给点
        let ctr = mapSize/2;
        ctx.fillStyle='#FFD700';
        ctx.fillRect(ctr*scale-3,ctr*scale-3,6,6);

        // 玩家
        Object.values(players).forEach(p=>{
            if(!p.alive) return;
            let sx=p.x*scale, sy=p.y*scale;
            if(p.id===localPlayer.id){
                ctx.fillStyle='#FFFFFF';
                ctx.beginPath(); ctx.arc(sx,sy,4,0,Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = p.team===localPlayer.team?'#4ecca3':'#e74c3c';
                ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2); ctx.fill();
            }
        });

        // 自己（如果不在players里）
        let sx2=localPlayer.x*scale, sy2=localPlayer.y*scale;
        ctx.fillStyle='#FFFFFF';
        ctx.beginPath(); ctx.arc(sx2,sy2,4,0,Math.PI*2); ctx.fill();

        ctx.strokeStyle='#555'; ctx.lineWidth=1; ctx.strokeRect(0,0,canvasW,canvasH);
    },

    drawHitFlash(ctx, sx, sy, size, alpha) {
        ctx.fillStyle = `rgba(255,0,0,${alpha})`;
        ctx.fillRect(sx, sy, size, size);
    }
};

