// ============ 鼠鼠与鱼 - 游戏核心 ============

const CONFIG = {
    MAP_SIZE: 500,
    GAME_DURATION: 30 * 60,
    MAX_PLAYERS: 30,
    MAX_STEVE: 3,

    STEVE_SPEED: 5,
    ZOMBIE_SPEED: 4,
    SKELETON_SPEED: 4,
    CREEPER_SPEED: 4,
    FISH_SPEED: 10,
    WATER_SLOW: 0.3,

    STEVE_HP: 20,
    STEVE_LIVES: 3,
    STEVE_ARMOR: 0.5,
    STEVE_REGEN_INTERVAL: 10,

    SWORD_DAMAGE: 6,
    SWORD_DURABILITY: 200,
    SWORD_RANGE: 3,
    SWORD_COOLDOWN: 0.6,

    BOW_DAMAGE_MIN: 2,
    BOW_DAMAGE_MAX: 8,
    BOW_RANGE: 30,
    BOW_CHARGE_TIME: 1,
    BOW_COOLDOWN: 0.2,
    ARROW_SPEED: 20,
    MAX_ARROWS: 64,

    POTION_HEAL: 4,
    SUPPLY_COOLDOWN: 300,
    SUPPLY_RANGE: 3,

    ZOMBIE_HP: 20,
    ZOMBIE_DAMAGE: 4,
    ZOMBIE_RANGE: 3,
    SKELETON_HP: 20,
    SKELETON_DAMAGE: 4,
    SKELETON_RANGE: 30,
    SKELETON_COOLDOWN: 0.5,
    SKELETON_CHARGE_TIME: 1,
    CREEPER_HP: 20,
    FISH_HP: 10,
    FISH_DAMAGE: 10,
    FISH_RANGE: 3,

    KNOCKBACK_DIST: 1.5,
    KNOCKBACK_TIME: 0.2,
    HIT_FLASH_TIME: 0.3,

    MONSTER_RESPAWN: 5,
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
    playerLerp: {},
    showFullMap: false,
    previousPlayerIds: [],
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
    hitFlash: 0,
    lastWeapon: 'sword',
    slashActive: false,
    slashTimer: 0,
    slashAngle: 0,
    aimAngle: 0,
    facingAngle: 0,
    // 骷髅蓄力
    skeletonCharging: false,
    skeletonChargeStart: 0,
};

let input = {
    keys: {},
    joystickDir: {x: 0, y: 0},
    joystickActive: false,
    aimDir: {x: 1, y: 0},
};

let canvas, ctx, minimapCanvas, minimapCtx;
let screenW, screenH, viewTileSize;
let waterFrame = 0, waterTimer = 0;
let lastTime = 0, syncTimer = 0;

// ============ 地图生成 ============

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
    let targetWater = CONFIG.MAP_SIZE * CONFIG.MAP_SIZE * 0.45;

    let riverCount = 3 + Math.floor(rng() * 3);
    for (let r = 0; r < riverCount; r++) {
        let river = generateRiver(rng, CONFIG.MAP_SIZE);
        for (let point of river) {
            let cx = Math.floor(point.x), cy = Math.floor(point.y);
            let width = Math.floor(point.w);
            for (let dy = -width; dy <= width; dy++) {
                for (let dx = -width; dx <= width; dx++) {
                    let mx = cx+dx, my = cy+dy;
                    if (mx>=0 && mx<CONFIG.MAP_SIZE && my>=0 && my<CONFIG.MAP_SIZE) {
                        if (dx*dx+dy*dy <= width*width && map[my][mx]===0) {
                            map[my][mx] = 1;
                            totalWater++;
                        }
                    }
                }
            }
        }
    }

    let attempts = 0;
    while (totalWater < targetWater && attempts < 20) {
        let river = generateRiver(rng, CONFIG.MAP_SIZE);
        for (let point of river) {
            let cx = Math.floor(point.x), cy = Math.floor(point.y);
            let width = Math.floor(point.w);
            for (let dy=-width;dy<=width;dy++) {
                for (let dx=-width;dx<=width;dx++) {
                    let mx=cx+dx, my=cy+dy;
                    if (mx>=0&&mx<CONFIG.MAP_SIZE&&my>=0&&my<CONFIG.MAP_SIZE) {
                        if (dx*dx+dy*dy<=width*width&&map[my][mx]===0) {
                            map[my][mx]=1; totalWater++;
                        }
                    }
                }
            }
        }
        attempts++;
    }

    for (let y = 1; y < CONFIG.MAP_SIZE-1; y++) {
        for (let x = 1; x < CONFIG.MAP_SIZE-1; x++) {
            if (map[y][x] !== 0) continue;
            let nearWater = false;
            for (let dy=-2; dy<=2; dy++) {
                for (let dx=-2; dx<=2; dx++) {
                    let nx=x+dx, ny=y+dy;
                    if (nx>=0&&nx<CONFIG.MAP_SIZE&&ny>=0&&ny<CONFIG.MAP_SIZE) {
                        if (map[ny][nx]===1) { nearWater=true; break; }
                    }
                }
                if (nearWater) break;
            }
            if (nearWater) map[y][x] = 2;
        }
    }

    let center = Math.floor(CONFIG.MAP_SIZE/2);
    for (let dy=-6; dy<=6; dy++) {
        for (let dx=-6; dx<=6; dx++) {
            let mx=center+dx, my=center+dy;
            if (mx>=0&&mx<CONFIG.MAP_SIZE&&my>=0&&my<CONFIG.MAP_SIZE) {
                map[my][mx] = 0;
            }
        }
    }

    return map;
}

function generateRiver(rng, mapSize) {
    let points = [];
    let side = Math.floor(rng()*4);
    let sx,sy,baseAngle;
    switch(side){
        case 0: sx=0; sy=rng()*mapSize; baseAngle=0; break;
        case 1: sx=mapSize; sy=rng()*mapSize; baseAngle=Math.PI; break;
        case 2: sx=rng()*mapSize; sy=0; baseAngle=Math.PI/2; break;
        case 3: sx=rng()*mapSize; sy=mapSize; baseAngle=-Math.PI/2; break;
    }
    let x=sx, y=sy;
    let a=baseAngle+(rng()-0.5)*0.5;
    let width=8+rng()*15;
    let steps=200+Math.floor(rng()*300);
    for (let i=0;i<steps;i++) {
        points.push({x,y,w:width});
        a+=(rng()-0.5)*0.15;
        width+=(rng()-0.5)*1.5;
        width=Math.max(8,Math.min(30,width));
        x+=Math.cos(a)*3;
        y+=Math.sin(a)*3;
        if(x<-20||x>mapSize+20||y<-20||y>mapSize+20) break;
    }
    return points;
}

function seededRNG(seed) {
    let s=seed||12345;
    return function(){s=(s*1664525+1013904223)&0xFFFFFFFF;return(s>>>0)/4294967296;};
}

// ===== 工具 =====
function getRandomLandPos(){
    let x,y,a=0;
    do{x=Math.floor(Math.random()*CONFIG.MAP_SIZE);y=Math.floor(Math.random()*CONFIG.MAP_SIZE);a++;}
    while(gameState.map[y]&&gameState.map[y][x]===1&&a<1000);
    return{x,y};
}
function getRandomWaterPos(){
    let x,y,a=0;
    do{x=Math.floor(Math.random()*CONFIG.MAP_SIZE);y=Math.floor(Math.random()*CONFIG.MAP_SIZE);a++;}
    while(gameState.map[y]&&gameState.map[y][x]!==1&&a<1000);
    return{x,y};
}
function dist(x1,y1,x2,y2){return Math.sqrt((x2-x1)**2+(y2-y1)**2);}
function angle(x1,y1,x2,y2){return Math.atan2(y2-y1,x2-x1);}
function getMySpeed(){
    if(gameState.myTeam==='steve') return CONFIG.STEVE_SPEED;
    switch(gameState.myMonster){
        case'zombie':return CONFIG.ZOMBIE_SPEED;
        case'skeleton':return CONFIG.SKELETON_SPEED;
        case'creeper':return CONFIG.CREEPER_SPEED;
        case'fish':return CONFIG.FISH_SPEED;
        default:return 4;
    }
}

// ============ 初始化 ============

function initGame(){
    canvas=document.getElementById('game-canvas');
    ctx=canvas.getContext('2d');
    minimapCanvas=document.getElementById('minimap-canvas');
    minimapCtx=minimapCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize',resizeCanvas);
    Renderer.init();
    drawLoginIcons();
    setupInput();
    setupHearts();
    setupMinimap();
    document.getElementById('name-input').addEventListener('input',checkJoinBtn);
    checkJoinBtn();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas(){
    screenW=window.innerWidth; screenH=window.innerHeight;
    canvas.width=screenW; canvas.height=screenH;
    viewTileSize=Math.floor(Math.min(screenW/28,screenH/18));
    if(viewTileSize<16) viewTileSize=16;
}

function drawLoginIcons(){
    [['steve-icon','steve',45],['monster-icon','creeper',45],
     ['zombie-icon','zombie',35],['skeleton-icon','skeleton',35],
     ['creeper-icon','creeper',35],['fish-icon','fish',35]
    ].forEach(([id,type,size])=>{
        let el=document.getElementById(id);
        if(el&&Renderer.cache[type]){
            let c=el.getContext('2d');
            c.imageSmoothingEnabled=false;
            let o=(el.width-size)/2;
            c.drawImage(Renderer.cache[type],o,o,size,size);
        }
    });
}

function setupHearts(){
    let container=document.getElementById('hearts-container');
    container.innerHTML='';
    for(let i=0;i<10;i++){
        let h=document.createElement('canvas');
        h.width=13;h.height=13;h.className='heart';h.id='heart-'+i;
        container.appendChild(h);
    }
    updateHearts();
}

function updateHearts(){
    for(let i=0;i<10;i++){
        let hc=document.getElementById('heart-'+i);
        if(!hc)continue;
        let hx=hc.getContext('2d');
        hx.clearRect(0,0,13,13);
        hx.imageSmoothingEnabled=false;
        let hp=localPlayer.hp-i*2;
        let img;
        if(hp>=2)img=Renderer.cache.heartFull;
        else if(hp===1)img=Renderer.cache.heartHalf;
        else img=Renderer.cache.heartEmpty;
        if(img)hx.drawImage(img,0,0,13,13);
    }
}

// ===== 小地图点击全图 =====
function setupMinimap(){
    let minimap=document.getElementById('minimap');
    minimap.addEventListener('click',()=>{
        if(gameState.phase!=='playing') return;
        gameState.showFullMap=true;
        document.getElementById('fullmap-overlay').style.display='flex';
        renderFullMap();
    });
    document.getElementById('fullmap-overlay').addEventListener('click',()=>{
        gameState.showFullMap=false;
        document.getElementById('fullmap-overlay').style.display='none';
    });
}

function renderFullMap(){
    let fc=document.getElementById('fullmap-canvas');
    let fctx=fc.getContext('2d');
    let local={x:localPlayer.x,y:localPlayer.y,id:gameState.myId,team:gameState.myTeam};
    Renderer.drawFullMap(fctx,fc.width,fc.height,gameState.map,local,gameState.players,
        (gameState.aiMonsters||[]).concat(gameState.aiFish||[]),CONFIG.MAP_SIZE,gameState.myTeam==='monster');
}

// ============ 界面 ============

let selectedTeam=null, selectedMonster=null;

function selectTeam(team){
    selectedTeam=team;
    document.getElementById('btn-steve').classList.toggle('selected',team==='steve');
    document.getElementById('btn-monster').classList.toggle('selected',team==='monster');
    document.getElementById('monster-select').classList.toggle('show',team==='monster');
    if(team==='steve')selectedMonster=null;
    checkJoinBtn();
}

function selectMonster(monster){
    selectedMonster=monster;
    document.querySelectorAll('.monster-btn').forEach(b=>b.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    checkJoinBtn();
}

function checkJoinBtn(){
    let name=document.getElementById('name-input').value.trim();
    let can=selectedTeam&&(selectedTeam==='steve'||selectedMonster)&&name;
    document.getElementById('join-btn').disabled=!can;
}

function joinGame(){
    let name=document.getElementById('name-input').value.trim()||'鼠鼠';
    gameState.myTeam=selectedTeam;
    gameState.myMonster=selectedMonster;
    gameState.myName=name;

    if(selectedTeam==='steve'){
        localPlayer.maxHp=CONFIG.STEVE_HP; localPlayer.hp=CONFIG.STEVE_HP;
        localPlayer.lives=CONFIG.STEVE_LIVES;
        localPlayer.arrows=CONFIG.MAX_ARROWS;
        localPlayer.swordDurability=CONFIG.SWORD_DURABILITY;
        localPlayer.potions=1;
    } else {
        localPlayer.maxHp=selectedMonster==='fish'?CONFIG.FISH_HP:20;
        localPlayer.hp=localPlayer.maxHp;
        localPlayer.lives=999;
    }
    NetworkManager.autoJoin({name,team:selectedTeam,monster:selectedMonster});
}

function switchMonster(type){
    gameState.myMonster=type;
    localPlayer.maxHp=type==='fish'?CONFIG.FISH_HP:20;
    document.querySelectorAll('#switch-panel .switch-btn').forEach(b=>b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    NetworkManager.updateMonsterType(type);
}

function exitToLobby(){
    NetworkManager.cleanup();
    location.reload();
}

// ===== 玩家加入提示 =====
let joinToastTimer=null;
function showJoinToast(name){
    let el=document.getElementById('join-toast');
    el.textContent=name+' 加入了房间';
    el.style.display='block';
    el.style.opacity='1';
    if(joinToastTimer) clearTimeout(joinToastTimer);
    joinToastTimer=setTimeout(()=>{
        el.style.opacity='0';
        setTimeout(()=>{el.style.display='none';},300);
    },2500);
}

function updatePlayerCount(){
    let count=Object.keys(gameState.players).length;
    document.getElementById('player-count').textContent='玩家: '+count;
}

// ============ 输入 ============

function setupInput(){
    window.addEventListener('keydown',e=>{
        input.keys[e.key.toLowerCase()]=true;
        if(gameState.phase!=='playing')return;
        if(e.key==='j'||e.key==='J') doAttack();
        if(e.key==='k'||e.key==='K') startBowCharge();
        if(e.key==='l'||e.key==='L') usePotion();
    });
    window.addEventListener('keyup',e=>{
        input.keys[e.key.toLowerCase()]=false;
        if(e.key==='k'||e.key==='K') releaseBow();
    });

    window.addEventListener('mousemove',e=>{
        if(gameState.phase!=='playing')return;
        let cx=screenW/2, cy=screenH/2;
        let dx=e.clientX-cx, dy=e.clientY-cy;
        let d=Math.sqrt(dx*dx+dy*dy);
        if(d>0){
            input.aimDir={x:dx/d,y:dy/d};
            localPlayer.aimAngle=Math.atan2(dy,dx);
        }
    });

    setupJoystick();
    setupActionButtons();
}

function setupActionButtons(){
    let atk=document.getElementById('attack-btn');
    atk.addEventListener('touchstart',e=>{e.stopPropagation();e.preventDefault();doAttack();},{passive:false});
    atk.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();doAttack();});

    let bow=document.getElementById('bow-btn');
    bow.addEventListener('touchstart',e=>{e.stopPropagation();e.preventDefault();startBowCharge();},{passive:false});
    bow.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();startBowCharge();});
    bow.addEventListener('touchend',e=>{e.stopPropagation();releaseBow();},{passive:false});
    bow.addEventListener('mouseup',e=>{e.stopPropagation();releaseBow();});

    let pot=document.getElementById('potion-btn');
    pot.addEventListener('touchstart',e=>{e.stopPropagation();e.preventDefault();usePotion();},{passive:false});
    pot.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();usePotion();});

    let matk=document.getElementById('monster-attack-btn');
    matk.addEventListener('touchstart',e=>{e.stopPropagation();e.preventDefault();doAttack();},{passive:false});
    matk.addEventListener('mousedown',e=>{e.stopPropagation();e.preventDefault();doAttack();});
}

function setupJoystick(){
    const base=document.getElementById('joystick-base');
    const stick=document.getElementById('joystick-stick');
    let touching=false, baseRect, touchId=null;

    function start(e){
        e.preventDefault();
        e.stopPropagation();
        touching=true;
        input.joystickActive=true;
        baseRect=base.getBoundingClientRect();
        if(e.touches) touchId=e.touches[0].identifier;
    }
    function move(e){
        if(!touching)return;
        let cx2,cy2;
        if(e.touches){
            let t=null;
            for(let i=0;i<e.touches.length;i++){
                if(e.touches[i].identifier===touchId){t=e.touches[i];break;}
            }
            if(!t) return;
            cx2=t.clientX;cy2=t.clientY;
        } else {
            cx2=e.clientX;cy2=e.clientY;
        }
        let cX=baseRect.left+baseRect.width/2;
        let cY=baseRect.top+baseRect.height/2;
        let dx=cx2-cX, dy=cy2-cY;
        let d=Math.sqrt(dx*dx+dy*dy);
        let max=baseRect.width/2-20;
        if(d>max){dx=(dx/d)*max;dy=(dy/d)*max;}
        stick.style.left=(50+(dx/baseRect.width)*100)+'%';
        stick.style.top=(50+(dy/baseRect.height)*100)+'%';
        input.joystickDir={x:dx/max,y:dy/max};
    }
    function end(e){
        if(e.changedTouches){
            let found=false;
            for(let i=0;i<e.changedTouches.length;i++){
                if(e.changedTouches[i].identifier===touchId){found=true;break;}
            }
            if(!found) return;
        }
        touching=false;input.joystickActive=false;
        input.joystickDir={x:0,y:0};
        stick.style.left='50%';stick.style.top='50%';
        touchId=null;
    }

    base.addEventListener('touchstart',start,{passive:false});
    base.addEventListener('mousedown',start);
    document.addEventListener('touchmove',e=>{if(touching)move(e);},{passive:false});
    document.addEventListener('mousemove',e=>{if(touching)move(e);});
    document.addEventListener('touchend',end,{passive:false});
    document.addEventListener('mouseup',end);
}

// ============ 战斗 ============

function doAttack(){
    if(!localPlayer.alive||gameState.phase!=='playing')return;

    if(gameState.myTeam==='steve'){
        if(localPlayer.swordCooldown>0)return;
        attackSword();
    } else {
        monsterAttack();
    }
}

function attackSword(){
    if(localPlayer.swordDurability<=0)return;
    localPlayer.swordCooldown=CONFIG.SWORD_COOLDOWN;
    localPlayer.lastWeapon='sword';
    localPlayer.swordDurability--;

    let target=findNearestEnemy(CONFIG.SWORD_RANGE);
    let slashDir=localPlayer.facingAngle;
    if(target){
        slashDir=angle(localPlayer.x,localPlayer.y,target.x,target.y);
        NetworkManager.sendDamage(target.id,CONFIG.SWORD_DAMAGE,slashDir);
    }
    triggerSlash(slashDir);
    updateHUD();
}

function monsterAttack(){
    switch(gameState.myMonster){
        case 'zombie':
        case 'fish':{
            if(localPlayer.swordCooldown>0)return;
            localPlayer.swordCooldown=CONFIG.SWORD_COOLDOWN;
            let range=gameState.myMonster==='fish'?CONFIG.FISH_RANGE:CONFIG.ZOMBIE_RANGE;
            let dmg=gameState.myMonster==='fish'?CONFIG.FISH_DAMAGE:CONFIG.ZOMBIE_DAMAGE;
            let target=findNearestSteve(range);
            let dir=localPlayer.facingAngle;
            if(target){
                dir=angle(localPlayer.x,localPlayer.y,target.x,target.y);
                NetworkManager.sendDamage(target.id,dmg,dir);
            }
            triggerSlash(dir);
            break;
        }
        case 'skeleton':{
            if(localPlayer.swordCooldown>0) return;
            localPlayer.swordCooldown=CONFIG.SKELETON_COOLDOWN;

            let target=findNearestSteve(CONFIG.SKELETON_RANGE);
            let dirX, dirY;
            if(target){
                let dir=angle(localPlayer.x,localPlayer.y,target.x,target.y);
                dirX=Math.cos(dir);
                dirY=Math.sin(dir);
            } else {
                dirX=Math.cos(localPlayer.facingAngle);
                dirY=Math.sin(localPlayer.facingAngle);
            }

            let arrow={
                id:gameState.myId+'_'+Date.now(),
                x:localPlayer.x,y:localPlayer.y,
                dirX:dirX,dirY:dirY,
                damage:CONFIG.SKELETON_DAMAGE,
                speed:CONFIG.ARROW_SPEED,
                owner:gameState.myId,ownerTeam:'monster',
                trail:[{x:localPlayer.x,y:localPlayer.y}],
                distTraveled:0,
            };
            gameState.projectiles.push(arrow);
            NetworkManager.sendProjectile(arrow);
            break;
        }
        case 'creeper':{
            if(localPlayer.swordCooldown>0)return;
            localPlayer.swordCooldown=CONFIG.SWORD_COOLDOWN;
            creeperExplode();
            break;
        }
    }
}

function skeletonAutoShoot(){}

function triggerSlash(a){
    localPlayer.slashActive=true;
    localPlayer.slashTimer=0.2;
    localPlayer.slashAngle=a;
}

// 弓箭：自动锁定
function startBowCharge(){
    if(!localPlayer.alive||gameState.phase!=='playing')return;
    if(gameState.myTeam!=='steve')return;
    if(localPlayer.arrows<=0||localPlayer.bowCooldown>0)return;

    localPlayer.bowCharging=true;
    localPlayer.bowChargeStart=Date.now();
    localPlayer.lastWeapon='bow';
    document.getElementById('bow-charge-bar').style.display='block';
}

function releaseBow(){
    if(!localPlayer.bowCharging)return;
    localPlayer.bowCharging=false;

    document.getElementById('bow-charge-bar').style.display='none';
    document.getElementById('bow-charge-fill').style.width='0%';

    if(localPlayer.arrows<=0)return;
    localPlayer.arrows--;
    localPlayer.bowCooldown=CONFIG.BOW_COOLDOWN;

    let charge=(Date.now()-localPlayer.bowChargeStart)/1000;
    charge=Math.min(charge,CONFIG.BOW_CHARGE_TIME);
    let ratio=charge/CONFIG.BOW_CHARGE_TIME;
    let dmg=Math.round(CONFIG.BOW_DAMAGE_MIN+(CONFIG.BOW_DAMAGE_MAX-CONFIG.BOW_DAMAGE_MIN)*ratio);

    // 自动锁定最近敌人
    let target=findNearestEnemy(CONFIG.BOW_RANGE);
    let dirX, dirY;
    if(target){
        let dir=angle(localPlayer.x,localPlayer.y,target.x,target.y);
        dirX=Math.cos(dir);
        dirY=Math.sin(dir);
    } else {
        dirX=Math.cos(localPlayer.facingAngle);
        dirY=Math.sin(localPlayer.facingAngle);
    }

    let arrow={
        id:gameState.myId+'_'+Date.now(),
        x:localPlayer.x,y:localPlayer.y,
        dirX,dirY,damage:dmg,
        speed:CONFIG.ARROW_SPEED,
        owner:gameState.myId,ownerTeam:'steve',
        trail:[{x:localPlayer.x,y:localPlayer.y}],
        distTraveled:0,
    };
    gameState.projectiles.push(arrow);
    NetworkManager.sendProjectile(arrow);
    updateHUD();
}

function creeperExplode(){
    let px=localPlayer.x,py=localPlayer.y;
    let all=getAllEntities();
    all.forEach(t=>{
        if(t.id===gameState.myId)return;
        if(t.team==='monster'&&gameState.myTeam==='monster')return;
        let d=dist(px,py,t.x,t.y);
        let g=Math.ceil(d);
        if(g<=5&&CREEPER_DMG[g]){
            let a=angle(px,py,t.x,t.y);
            NetworkManager.sendDamage(t.id,CREEPER_DMG[g],a);
        }
    });
    gameState.effects.push({type:'explosion',x:px,y:py,timer:0.5,maxTimer:0.5});
    NetworkManager.sendExplosion(px,py);
    localPlayer.hp=0;localPlayer.alive=false;
    handleDeath();
}

function usePotion(){
    if(!localPlayer.alive||gameState.phase!=='playing')return;
    if(gameState.myTeam!=='steve')return;
    if(localPlayer.potions<=0||localPlayer.hp>=localPlayer.maxHp)return;
    localPlayer.potions--;
    localPlayer.hp=Math.min(localPlayer.hp+CONFIG.POTION_HEAL,localPlayer.maxHp);
    updateHUD();
    NetworkManager.syncPlayer();
}

// ===== 查找目标 =====
function findNearestEnemy(range){
    let nearest=null, nd=range+0.1;
    Object.values(gameState.players).forEach(p=>{
        if(!p.alive||p.id===gameState.myId)return;
        if(gameState.myTeam==='steve'&&p.team==='steve')return;
        if(gameState.myTeam==='monster'&&p.team==='monster')return;
        let d2=dist(localPlayer.x,localPlayer.y,p.x,p.y);
        if(d2<nd){nd=d2;nearest=p;}
    });
    if(gameState.myTeam==='steve'){
        gameState.aiMonsters.forEach(m=>{
            if(!m.alive)return;
            let d2=dist(localPlayer.x,localPlayer.y,m.x,m.y);
            if(d2<nd){nd=d2;nearest=m;}
        });
        (gameState.aiFish||[]).forEach(f=>{
            if(!f.alive)return;
            let d2=dist(localPlayer.x,localPlayer.y,f.x,f.y);
            if(d2<nd){nd=d2;nearest=f;}
        });
    }
    return nearest;
}

function findNearestSteve(range){
    let nearest=null,nd=range+0.1;
    Object.values(gameState.players).forEach(p=>{
        if(!p.alive||p.team!=='steve')return;
        let d2=dist(localPlayer.x,localPlayer.y,p.x,p.y);
        if(d2<nd){nd=d2;nearest=p;}
    });
    return nearest;
}

function getAllEntities(){
    let e=[];
    Object.values(gameState.players).forEach(p=>{if(p.alive&&p.id!==gameState.myId)e.push(p);});
    gameState.aiMonsters.forEach(m=>{if(m.alive)e.push(m);});
    (gameState.aiFish||[]).forEach(f=>{if(f.alive)e.push(f);});
    return e;
}

// ============ 受伤/击退/死亡 ============

function takeDamage(amount, fromAngle) {
    if (!localPlayer.alive) return;

    if (gameState.myTeam === 'steve') {
        amount = Math.round(amount * (1 - CONFIG.STEVE_ARMOR));
        if (amount < 1) amount = 1;
    }

    localPlayer.hp -= amount;
    localPlayer.hitFlash = CONFIG.HIT_FLASH_TIME;
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
    // 取消骷髅蓄力
    localPlayer.skeletonCharging = false;
    document.getElementById('skeleton-charge-bar').style.display='none';

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
            showDeath(false);
        } else {
            NetworkManager.sendPermaDeath();
            showDeath(false);
            checkGameOver();
        }
    } else {
        localPlayer.respawnTimer = CONFIG.MONSTER_RESPAWN;
        showDeath(true);
    }
    NetworkManager.syncPlayer();
}

function showDeath(showSwitch) {
    document.getElementById('death-overlay').style.display = 'flex';
    let switchPanel = document.getElementById('switch-panel');
    if (showSwitch) {
        switchPanel.style.display = 'flex';
        document.querySelectorAll('#switch-panel .switch-btn').forEach(b => b.classList.remove('active'));
    } else {
        switchPanel.style.display = 'none';
    }
}

function hideDeath() {
    document.getElementById('death-overlay').style.display = 'none';
}

function respawn() {
    localPlayer.alive = true;
    localPlayer.hp = localPlayer.maxHp;
    localPlayer.knockback = false;
    localPlayer.knockbackTimer = 0;
    localPlayer.hitFlash = 0;
    localPlayer.skeletonCharging = false;

    if (gameState.myTeam === 'steve') {
        localPlayer.x = CONFIG.MAP_SIZE / 2;
        localPlayer.y = CONFIG.MAP_SIZE / 2;
        localPlayer.swordDurability = CONFIG.SWORD_DURABILITY;
        localPlayer.arrows = CONFIG.MAX_ARROWS;
        localPlayer.potions = 1;
    } else {
        localPlayer.maxHp = gameState.myMonster === 'fish' ? CONFIG.FISH_HP : 20;
        localPlayer.hp = localPlayer.maxHp;
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

// ============ 补给/拾取 ============

function checkSupply() {
    if (gameState.myTeam !== 'steve' || !localPlayer.alive || !gameState.supplyReady) return;
    let center = CONFIG.MAP_SIZE / 2;
    if (dist(localPlayer.x, localPlayer.y, center, center) <= CONFIG.SUPPLY_RANGE) {
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
    if (gameState.myTeam !== 'steve' || !localPlayer.alive) return;
    gameState.droppedItems = gameState.droppedItems.filter(item => {
        if (dist(localPlayer.x, localPlayer.y, item.x, item.y) < 1.5) {
            localPlayer.arrows = Math.min(localPlayer.arrows + (item.arrows || 0), CONFIG.MAX_ARROWS);
            if ((item.swordDurability || 0) > localPlayer.swordDurability) localPlayer.swordDurability = item.swordDurability;
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
    if (!localPlayer.alive) {
        if (localPlayer.respawnTimer > 0) {
            localPlayer.respawnTimer -= dt;
            document.getElementById('respawn-timer').textContent =
                Math.ceil(localPlayer.respawnTimer) + '秒后复活...';
            if (localPlayer.respawnTimer <= 0) {
                if (gameState.myTeam === 'steve' && localPlayer.lives <= 0) {
                    // 永久死亡
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

    if (localPlayer.hitFlash > 0) localPlayer.hitFlash -= dt;

    // 击退
    if (localPlayer.knockback) {
        localPlayer.knockbackTimer -= dt;
        let mx = localPlayer.knockbackDirX * localPlayer.knockbackSpeed * dt;
        let my = localPlayer.knockbackDirY * localPlayer.knockbackSpeed * dt;
        let nx = localPlayer.x + mx;
        let ny = localPlayer.y + my;
        nx = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, nx));
        ny = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, ny));

        if (gameState.myMonster === 'fish') {
            let tx = Math.floor(nx), ty = Math.floor(ny);
            if (!(gameState.map[ty] && gameState.map[ty][tx] === 1)) { nx = localPlayer.x; ny = localPlayer.y; }
        }
        localPlayer.x = nx; localPlayer.y = ny;

        if (localPlayer.knockbackTimer <= 0) localPlayer.knockback = false;
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
        if (mag > 0.1) localPlayer.facingAngle = Math.atan2(moveY, moveX);

        let speed = getMySpeed();
        let tileX = Math.floor(localPlayer.x), tileY = Math.floor(localPlayer.y);
        localPlayer.inWater = gameState.map[tileY] && gameState.map[tileY][tileX] === 1;
        if (localPlayer.inWater && gameState.myMonster !== 'fish') speed *= CONFIG.WATER_SLOW;

        let nx = localPlayer.x + moveX * speed * dt;
        let ny = localPlayer.y + moveY * speed * dt;
        nx = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, nx));
        ny = Math.max(0, Math.min(CONFIG.MAP_SIZE - 1, ny));

        if (gameState.myMonster === 'fish') {
            let tx = Math.floor(nx), ty = Math.floor(ny);
            if (!(gameState.map[ty] && gameState.map[ty][tx] === 1)) { nx = localPlayer.x; ny = localPlayer.y; }
        }
        localPlayer.x = nx; localPlayer.y = ny;
    }

    // 冷却
    if (localPlayer.swordCooldown > 0) localPlayer.swordCooldown -= dt;
    if (localPlayer.bowCooldown > 0) localPlayer.bowCooldown -= dt;

    // 刀光
    if (localPlayer.slashActive) {
        localPlayer.slashTimer -= dt;
        if (localPlayer.slashTimer <= 0) localPlayer.slashActive = false;
    }

    // 骷髅自动蓄力射击
    skeletonAutoShoot();

    // 回血
    if (gameState.myTeam === 'steve' && localPlayer.hp < localPlayer.maxHp) {
        localPlayer.regenTimer += dt;
        if (localPlayer.regenTimer >= CONFIG.STEVE_REGEN_INTERVAL) {
            localPlayer.regenTimer = 0;
            localPlayer.hp = Math.min(localPlayer.hp + 1, localPlayer.maxHp);
            updateHUD();
        }
    }

    // 弓蓄力条
    if (localPlayer.bowCharging) {
        let charge = (Date.now() - localPlayer.bowChargeStart) / 1000 / CONFIG.BOW_CHARGE_TIME;
        charge = Math.min(charge, 1);
        document.getElementById('bow-charge-fill').style.width = (charge * 100) + '%';
    }

    checkSupply();
    checkPickup();

    if (!gameState.supplyReady) {
        gameState.supplyTimer -= dt;
        if (gameState.supplyTimer <= 0) gameState.supplyReady = true;
    }

    updateProjectiles(dt);
    updateEffects(dt);
    updateTimer(dt);
    interpolateEntities(dt);

    syncTimer += dt;
    if (syncTimer > 0.08) { syncTimer = 0; NetworkManager.syncPlayer(); }

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

        if (arrow.owner === gameState.myId) {
            let entities = getAllEntities();
            for (let e of entities) {
                if (arrow.ownerTeam === e.team) continue;
                if (dist(arrow.x, arrow.y, e.x, e.y) < 0.8) {
                    let a = Math.atan2(arrow.dirY, arrow.dirX);
                    NetworkManager.sendDamage(e.id, arrow.damage, a);
                    gameState.effects.push({type: 'hit', x: arrow.x, y: arrow.y, timer: 0.15, maxTimer: 0.15});
                    return false;
                }
            }
        }
        return true;
    });
}

function updateEffects(dt) {
    gameState.effects = gameState.effects.filter(fx => { fx.timer -= dt; return fx.timer > 0; });
}

function updateTimer(dt) {
    gameState.timeLeft -= dt;
    if (gameState.timeLeft <= 0) { gameState.timeLeft = 0; endGame('steve'); }
    let m = Math.floor(gameState.timeLeft / 60);
    let s = Math.floor(gameState.timeLeft % 60);
    document.getElementById('timer').textContent = m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
}

// ===== AI平滑插值 =====
function interpolateEntities(dt) {
    let lerp = gameState.playerLerp;
    let allRemote = Object.values(gameState.players).filter(p => p.id !== gameState.myId);

    allRemote.forEach(p => {
        if (!lerp[p.id]) lerp[p.id] = {x: p.x, y: p.y};
        let l = lerp[p.id];
        let speed = 12 * dt;
        l.x += (p.x - l.x) * speed;
        l.y += (p.y - l.y) * speed;
    });

    gameState.aiMonsters.forEach(m => {
        if (!lerp[m.id]) lerp[m.id] = {x: m.x, y: m.y};
        let l = lerp[m.id];
        l.x += (m.x - l.x) * 8 * dt;
        l.y += (m.y - l.y) * 8 * dt;
    });

    (gameState.aiFish || []).forEach(f => {
        if (!lerp[f.id]) lerp[f.id] = {x: f.x, y: f.y};
        let l = lerp[f.id];
        l.x += (f.x - l.x) * 8 * dt;
        l.y += (f.y - l.y) * 8 * dt;
    });
}

function getLerpPos(id, fallbackX, fallbackY) {
    let l = gameState.playerLerp[id];
    if (l) return {x: l.x, y: l.y};
    return {x: fallbackX, y: fallbackY};
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
    let startX = Math.floor(camX), startY = Math.floor(camY);

    // 地图
    for (let dy = 0; dy < tilesY; dy++) {
        for (let dx = 0; dx < tilesX; dx++) {
            let mx = startX + dx, my = startY + dy;
            let sx = (mx - camX) * viewTileSize, sy = (my - camY) * viewTileSize;
            if (mx < 0 || mx >= CONFIG.MAP_SIZE || my < 0 || my >= CONFIG.MAP_SIZE) {
                ctx.fillStyle = '#111'; ctx.fillRect(sx, sy, viewTileSize + 1, viewTileSize + 1);
                continue;
            }
            let tile = gameState.map[my][mx];
            let type = tile === 1 ? 'water' : tile === 2 ? 'sand' : 'grass';
            Renderer.drawTile(ctx, type, sx, sy, viewTileSize + 1, waterFrame);
        }
    }

    // 补给点
    let center = CONFIG.MAP_SIZE / 2;
    let hs = viewTileSize * 3;
    let hsx = (center - 1.5 - camX) * viewTileSize, hsy = (center - 1.5 - camY) * viewTileSize;
    if (Renderer.cache.villageHouse) ctx.drawImage(Renderer.cache.villageHouse, hsx, hsy, hs, hs);
    if (gameState.myTeam === 'steve') {
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        if (!gameState.supplyReady) {
            let tl = Math.ceil(gameState.supplyTimer);
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(hsx + hs / 2 - 22, hsy - 16, 44, 14);
            ctx.fillStyle = '#f39c12';
            ctx.fillText(Math.floor(tl / 60) + ':' + (tl % 60).toString().padStart(2, '0'), hsx + hs / 2, hsy - 5);
        } else {
            ctx.fillStyle = '#4ecca3';
            ctx.fillText('可补给', hsx + hs / 2, hsy - 5);
        }
    }

    // 掉落物
    gameState.droppedItems.forEach(item => {
        let sx = (item.x - camX) * viewTileSize - viewTileSize * 0.3;
        let sy = (item.y - camY) * viewTileSize - viewTileSize * 0.3;
        Renderer.drawEntity(ctx, 'chest', sx, sy, viewTileSize * 0.8);
    });

    // 其他玩家
    Object.values(gameState.players).forEach(p => {
        if (p.id === gameState.myId || !p.alive) return;
        let pos = getLerpPos(p.id, p.x, p.y);
        let sx = (pos.x - camX) * viewTileSize, sy = (pos.y - camY) * viewTileSize;
        let sprite = p.team === 'steve' ? 'steve' : (p.monster || 'zombie');
        Renderer.drawEntity(ctx, sprite, sx, sy, viewTileSize);

        if (p.team === 'steve') Renderer.drawHeldWeapon(ctx, sx, sy, viewTileSize, p.lastWeapon || 'sword', p.facingAngle || 0);

        ctx.fillStyle = p.team === 'steve' ? '#4ecca3' : '#ff6b6b';
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(p.name || '', sx + viewTileSize / 2, sy - 5);
        drawEntityHP(ctx, sx, sy, viewTileSize, p.hp, p.maxHp);
    });

    // AI怪物
    gameState.aiMonsters.forEach(m => {
        if (!m.alive) return;
        let pos = getLerpPos(m.id, m.x, m.y);
        let sx = (pos.x - camX) * viewTileSize, sy = (pos.y - camY) * viewTileSize;
        Renderer.drawEntity(ctx, m.type, sx, sy, viewTileSize);
        drawEntityHP(ctx, sx, sy, viewTileSize, m.hp, m.maxHp);
    });

    // 鱼
    (gameState.aiFish || []).forEach(f => {
        if (!f.alive) return;
        let pos = getLerpPos(f.id, f.x, f.y);
        let sx = (pos.x - camX) * viewTileSize, sy = (pos.y - camY) * viewTileSize;
        Renderer.drawEntity(ctx, 'fish', sx, sy, viewTileSize);
        drawEntityHP(ctx, sx, sy, viewTileSize, f.hp, f.maxHp);
    });

    // 箭矢+轨迹
    gameState.projectiles.forEach(arrow => {
        Renderer.drawArrowTrail(ctx, arrow.trail, camX, camY, viewTileSize);
        let sx = (arrow.x - camX) * viewTileSize, sy = (arrow.y - camY) * viewTileSize;
        Renderer.drawArrow(ctx, sx, sy, viewTileSize, Math.atan2(arrow.dirY, arrow.dirX));
    });

    // 特效
    gameState.effects.forEach(fx => {
        let sx = (fx.x - camX) * viewTileSize, sy = (fx.y - camY) * viewTileSize;
        if (fx.type === 'explosion') {
            let progress = 1 - fx.timer / fx.maxTimer;
            let fi = Math.min(4, Math.floor(progress * 5));
            let size = viewTileSize * 5 * (0.5 + progress * 0.5);
            ctx.globalAlpha = fx.timer / fx.maxTimer;
            if (Renderer.cache.explosion && Renderer.cache.explosion[fi])
                ctx.drawImage(Renderer.cache.explosion[fi], sx - size / 2, sy - size / 2, size, size);
            ctx.globalAlpha = 1;
        } else if (fx.type === 'hit') {
            ctx.globalAlpha = fx.timer / fx.maxTimer;
            ctx.fillStyle = '#FFF';
            ctx.beginPath(); ctx.arc(sx, sy, viewTileSize * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    });

    // 本地玩家
    if (localPlayer.alive) {
        let sx = (localPlayer.x - camX) * viewTileSize;
        let sy = (localPlayer.y - camY) * viewTileSize;
        let sprite = gameState.myTeam === 'steve' ? 'steve' : (gameState.myMonster || 'zombie');
        Renderer.drawEntity(ctx, sprite, sx, sy, viewTileSize);

        if (gameState.myTeam === 'steve')
            Renderer.drawHeldWeapon(ctx, sx, sy, viewTileSize, localPlayer.lastWeapon, localPlayer.facingAngle);

        // 名字
        ctx.fillStyle = gameState.myTeam === 'steve' ? '#4ecca3' : '#ff6b6b';
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(gameState.myName, sx + viewTileSize / 2, sy - 5);

        // 刀光
        if (localPlayer.slashActive) {
            let progress = 1 - localPlayer.slashTimer / 0.2;
            Renderer.drawSlashEffect(ctx, sx, sy, viewTileSize, localPlayer.slashAngle, progress);
        }

        // 受击红闪
        if (localPlayer.hitFlash > 0) {
            let alpha = localPlayer.hitFlash / CONFIG.HIT_FLASH_TIME * 0.4;
            Renderer.drawHitFlash(ctx, sx, sy, viewTileSize, alpha);
        }

        // 击退闪烁
        if (localPlayer.knockback) {
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.03) * 0.3;
            Renderer.drawHitFlash(ctx, sx, sy, viewTileSize, 0.15);
            ctx.globalAlpha = 1;
        }
    }
}

function drawEntityHP(ctx, sx, sy, size, hp, maxHp) {
    if (hp >= maxHp) return;
    let r = hp / maxHp;
    ctx.fillStyle = '#333'; ctx.fillRect(sx, sy - 3, size, 3);
    ctx.fillStyle = r > 0.5 ? '#4ecca3' : r > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(sx, sy - 3, size * r, 3);
}

// ============ 小地图 ============

function renderMinimap() {
    let local = {x: localPlayer.x, y: localPlayer.y, id: gameState.myId, team: gameState.myTeam};
    let allAI = (gameState.aiMonsters || []).concat(gameState.aiFish || []);
    let isMonster = gameState.myTeam === 'monster';
    Renderer.drawMinimap(minimapCtx, gameState.map, local, gameState.players, allAI, gameState.droppedItems, CONFIG.MAP_SIZE, CONFIG.MINIMAP_RANGE, isMonster);
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
    let rs = document.getElementById('result-screen');
    let rt = document.getElementById('result-text');
    let rd = document.getElementById('result-detail');
    rs.style.display = 'flex';

    if (winner === 'steve') {
        rt.className = gameState.myTeam === 'steve' ? 'win' : 'lose';
        rt.textContent = gameState.myTeam === 'steve' ? '🎉 胜利！' : '💀 失败...';
        rd.textContent = gameState.myTeam === 'steve' ? '成功存活30分钟！' : '未能消灭史蒂夫';
    } else {
        rt.className = gameState.myTeam === 'monster' ? 'win' : 'lose';
        rt.textContent = gameState.myTeam === 'monster' ? '🎉 胜利！' : '💀 失败...';
        rd.textContent = gameState.myTeam === 'monster' ? '消灭了所有史蒂夫！' : '所有史蒂夫被消灭了...';
    }
    NetworkManager.sendGameOver(winner);
}

function checkGameOver() {
    let alive = 0;
    Object.values(gameState.players).forEach(p => {
        if (p.team === 'steve' && (p.lives > 0 || p.alive) && !p.permaDead) alive++;
    });
    if (gameState.myTeam === 'steve' && localPlayer.lives > 0) alive++;
    if (alive === 0) endGame('monster');
}

// ============ 进入游戏 ============

function enterGame(seed, timeLeft) {
    gameState.phase = 'playing';
    gameState.map = generateMap(seed);
    gameState.timeLeft = timeLeft || CONFIG.GAME_DURATION;

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    if (gameState.myTeam === 'steve') {
        document.getElementById('attack-btn').style.display = 'flex';
        document.getElementById('bow-btn').style.display = 'flex';
        document.getElementById('potion-btn').style.display = 'flex';
        document.getElementById('monster-attack-btn').style.display = 'none';
    } else {
        document.getElementById('attack-btn').style.display = 'none';
        document.getElementById('bow-btn').style.display = 'none';
        document.getElementById('potion-btn').style.display = 'none';
        document.getElementById('monster-attack-btn').style.display = 'flex';
    }

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
    updatePlayerCount();
    NetworkManager.syncPlayer();
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', initGame);
