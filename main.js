const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let width = 1200, height = 800, scale = 1;
function resize() { const w = Math.min(window.innerWidth, 1200); const h = Math.min(window.innerHeight, 800); width = w; height = h; canvas.width = width; canvas.height = height; scale = window.devicePixelRatio || 1; }
resize();
window.addEventListener('resize', resize);

const menu = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const difficultySel = document.getElementById('difficulty');
const volumeRange = document.getElementById('volume');
const hud = {
  healthFill: document.getElementById('healthFill'),
  lives: document.getElementById('lives'),
  level: document.getElementById('level'),
  enemies: document.getElementById('enemies'),
  score: document.getElementById('score')
};

const mobile = {
  root: document.getElementById('mobile'),
  joystick: document.getElementById('joystick'),
  stick: document.getElementById('stick'),
  fireBtn: document.getElementById('fireBtn')
};

let audioCtx = null; let masterGain = null; let audioVolume = 0.7; let audioReady = false;
function ensureAudio() { if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); masterGain = audioCtx.createGain(); masterGain.gain.value = audioVolume; masterGain.connect(audioCtx.destination); audioReady = true; } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }
function sfx(freq, type = 'square', time = 0.08, vol = 0.15) { if (!audioReady) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol; const now = audioCtx.currentTime; g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + time); o.connect(g); g.connect(masterGain); o.start(now); o.stop(now + time); }
function burst(f, n = 4) { for (let i = 0; i < n; i++) sfx(f * (0.9 + Math.random() * 0.2), 'square', 0.05 + Math.random() * 0.08, 0.12); }

const keys = new Set();
window.addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (e.key === ' ') e.preventDefault(); });
window.addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); });

const pointer = { active: false, x: 0, y: 0, valid: false };
canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.valid = true; });
canvas.addEventListener('mousedown', e => { pointer.active = true; });
canvas.addEventListener('mouseup', e => { pointer.active = false; });

let joyActive = false, joyBase = {x:0,y:0}; let joyStick = {x:0,y:0};
mobile.joystick.addEventListener('touchstart', e => { const t = e.touches[0]; const r = mobile.joystick.getBoundingClientRect(); joyActive = true; joyBase.x = r.left + r.width/2; joyBase.y = r.top + r.height/2; joyStick.x = t.clientX; joyStick.y = t.clientY; mobile.stick.style.left = `${t.clientX - r.left}px`; mobile.stick.style.top = `${t.clientY - r.top}px`; }, {passive:false});
mobile.joystick.addEventListener('touchmove', e => { const t = e.touches[0]; const r = mobile.joystick.getBoundingClientRect(); joyStick.x = t.clientX; joyStick.y = t.clientY; let dx = t.clientX - joyBase.x; let dy = t.clientY - joyBase.y; const rad = r.width/2 - 8; const len = Math.hypot(dx,dy); if (len > rad) { dx *= rad/len; dy *= rad/len; } mobile.stick.style.left = `${dx + r.width/2}px`; mobile.stick.style.top = `${dy + r.height/2}px`; }, {passive:false});
mobile.joystick.addEventListener('touchend', () => { joyActive = false; mobile.stick.style.left = '50%'; mobile.stick.style.top = '50%'; });
let tapFire = false;
mobile.fireBtn.addEventListener('touchstart', e => { tapFire = true; });
mobile.fireBtn.addEventListener('touchend', e => { tapFire = false; });

function rand(a=1,b=0){ if(b===0){b=a;a=0;} return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t){ return a + (b-a)*t; }
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function angle(ax,ay,bx,by){ return Math.atan2(by-ay,bx-ax); }

const TILE = 32;
const T_EMPTY = 0, T_WALL = 1, T_BRICK = 2, T_WATER = 3, T_GRASS = 4, T_SPAWN = 5;

function TileMap(w,h){ this.w=w; this.h=h; this.data=new Array(w*h).fill(T_EMPTY); this.bricks=new Map(); this.spawns=[]; }
TileMap.prototype.idx = function(x,y){ return y*this.w+x; };
TileMap.prototype.get = function(x,y){ if(x<0||y<0||x>=this.w||y>=this.h) return T_WALL; return this.data[this.idx(x,y)]; };
TileMap.prototype.set = function(x,y,v){ if(x<0||y<0||x>=this.w||y>=this.h) return; this.data[this.idx(x,y)]=v; if(v===T_BRICK) this.bricks.set(this.idx(x,y), 2); if(v===T_SPAWN) this.spawns.push({x,y}); };
TileMap.prototype.gen = function(level){ for(let y=0;y<this.h;y++){ for(let x=0;x<this.w;x++){ const e = (x===0||y===0||x===this.w-1||y===this.h-1)?T_WALL:T_EMPTY; this.set(x,y,e); } }
  const density=level<3?0.08:level<6?0.12:0.16; for(let i=0;i<this.w*this.h*density;i++){ const x=Math.floor(rand(2,this.w-2)); const y=Math.floor(rand(2,this.h-2)); const t=[T_BRICK,T_WATER,T_GRASS][Math.floor(rand(0,3))]; this.set(x,y,t); }
  const s = [[2,2],[this.w-3,2],[2,this.h-3],[this.w-3,this.h-3]]; this.spawns=[]; s.forEach(p=>this.set(p[0],p[1],T_SPAWN)); this.set(Math.floor(this.w/2), Math.floor(this.h/2), T_EMPTY);
};
TileMap.prototype.hitSolid = function(x,y){ const t=this.get(x,y); return t===T_WALL||t===T_BRICK; };
TileMap.prototype.draw = function(cam){ for(let y=0;y<this.h;y++){ for(let x=0;x<this.w;x++){ const t=this.get(x,y); const sx=x*TILE-cam.x; const sy=y*TILE-cam.y; if(sx+TILE<0||sy+TILE<0||sx>width||sy>height) continue; if(t===T_WALL){ ctx.fillStyle='#3a445a'; ctx.fillRect(sx,sy,TILE,TILE); }
      else if(t===T_BRICK){ ctx.fillStyle='#a54e3a'; ctx.fillRect(sx,sy,TILE,TILE); ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(sx+2,sy+2,TILE-4,TILE-4); }
      else if(t===T_WATER){ ctx.fillStyle='#1a5b8a'; ctx.fillRect(sx,sy,TILE,TILE); }
      else if(t===T_GRASS){ ctx.fillStyle='#245b39'; ctx.fillRect(sx,sy,TILE,TILE); }
    }
  }
};

function Entity(x,y){ this.x=x; this.y=y; this.vx=0; this.vy=0; this.radius=14; this.dead=false; }
Entity.prototype.update = function(dt){};
Entity.prototype.draw = function(cam){};

function Bullet(x,y,dir,speed,owner){ Entity.call(this,x,y); this.speed=speed; this.dir=dir; this.owner=owner; this.life=2.2; this.damage= owner && owner.ai ? world.enemyBulletDamage : world.playerBulletDamage; }
Bullet.prototype = Object.create(Entity.prototype); Bullet.prototype.constructor = Bullet;
Bullet.prototype.update = function(dt){ this.x+=Math.cos(this.dir)*this.speed*dt; this.y+=Math.sin(this.dir)*this.speed*dt; this.life-=dt; if(this.life<=0) this.dead=true; const tx=Math.floor(this.x/TILE), ty=Math.floor(this.y/TILE); if(world.map.hitSolid(tx,ty)){ const id=world.map.idx(tx,ty); if(world.map.get(tx,ty)===T_BRICK){ const hp=world.map.bricks.get(id)||2; const nhp=hp-1; if(nhp<=0){ world.map.bricks.delete(id); world.map.set(tx,ty,T_EMPTY); } else { world.map.bricks.set(id,nhp); } } this.dead=true; spawnExplosion(this.x,this.y,12); applyExplosionDamage(this.x,this.y,120,this.owner); burst(180,3); }
  for(let e of world.entities){ if(e!==this.owner && e instanceof Tank && !e.dead){ const d=dist(this.x,this.y,e.x,e.y); if(d<e.radius+3){ this.dead=true; if(this.owner && !this.owner.ai){ e.hit(999); } else { e.hit(this.damage); } spawnExplosion(this.x,this.y,10); applyExplosionDamage(this.x,this.y,120,this.owner); burst(160,3); break; } } }
};
Bullet.prototype.draw = function(cam){ const sx=this.x-cam.x, sy=this.y-cam.y; ctx.fillStyle='#ffd06e'; ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2); ctx.fill(); };

function Tank(x,y,color){ Entity.call(this,x,y); this.color=color; this.angle=0; this.speed=0; this.maxSpeed=140; this.turn=0; this.cool=0; this.hp=6; this.maxHp=6; this.fireRate=0.38; this.reloadBoost=0; this.speedBoost=0; this.shield=0; this.invuln=0; this.ai=false; }
Tank.prototype = Object.create(Entity.prototype); Tank.prototype.constructor = Tank;
Tank.prototype.control = function(input, dt){ const fric=0.85; let ax=0, ay=0; if(input.up) ay-=1; if(input.down) ay+=1; if(input.left) ax-=1; if(input.right) ax+=1; if(joyActive){ const dx=joyStick.x-joyBase.x; const dy=joyStick.y-joyBase.y; const len=Math.hypot(dx,dy); if(len>6){ ax+=dx/len; ay+=dy/len; } }
  if(ax||ay){ const sp=this.maxSpeed*(this.speedBoost>0?1.5:1); const nx=ax, ny=ay; const l=Math.hypot(nx,ny)||1; this.vx=nx/l*sp; this.vy=ny/l*sp; } else { this.vx*=fric; this.vy*=fric; }
  const px=input.aimX, py=input.aimY;
  const hasMouseAim = pointer.valid && !('ontouchstart' in window);
  const rotating = (input.aimLeft || input.aimRight);
  if(rotating){
    const rotSpeed = 2.8; // 每秒转动弧度
    if(input.aimLeft) this.angle -= rotSpeed * (dt||0);
    if(input.aimRight) this.angle += rotSpeed * (dt||0);
  } else if(hasMouseAim){ this.angle=Math.atan2(py-this.y, px-this.x); }
  else { const mvLen=Math.hypot(this.vy,this.vx); if(mvLen>0.01){ this.angle=Math.atan2(this.vy,this.vx); } }
  if(input.fire) this.tryFire(); if(tapFire) this.tryFire(); };
Tank.prototype.tryFire = function(){ if(this.cool>0) return; const sp=360; const b=new Bullet(this.x+Math.cos(this.angle)*16, this.y+Math.sin(this.angle)*16, this.angle, sp, this); world.bullets.push(b); sfx(220,'square',0.07,0.1); this.cool=(this.fireRate)*(this.reloadBoost>0?0.6:1); };
Tank.prototype.hit = function(d){ if(this.invuln>0) return; if(this.shield>0){ this.shield-=d; sfx(500,'sine',0.06,0.08); return; } this.hp-=d; if(this.hp<=0){ this.dead=true; world.score+=50; spawnExplosion(this.x,this.y,24); burst(90,6); } };
Tank.prototype.update = function(dt){
  if(this.cool>0) this.cool-=dt; if(this.reloadBoost>0) this.reloadBoost-=dt; if(this.speedBoost>0) this.speedBoost-=dt; if(this.shield>0) this.shield-=dt*0.5; if(this.invuln>0){ this.invuln-=dt; if(this.invuln<0) this.invuln=0; }
  // 玩家自动回血（按难度设定速度）
  if(!this.ai && this.hp>0 && this.hp < this.maxHp){ this.hp = Math.min(this.maxHp, this.hp + (world.playerRegenRate||0)*dt); }
  // 直接积分位移
  this.x += this.vx * dt;
  this.y += this.vy * dt;
  // 使用圆形对AABB的精确分离，迭代处理以彻底脱离固体
  let adjusted = false;
  for(let i=0;i<5;i++){ if(resolveSolid(this)){ adjusted = true; } else break; }
  if(adjusted){ this.vx *= 0.7; this.vy *= 0.7; }
};
Tank.prototype.draw = function(cam){ const sx=this.x-cam.x, sy=this.y-cam.y; ctx.save(); ctx.translate(sx,sy); ctx.rotate(this.angle); ctx.fillStyle=this.color; ctx.beginPath(); const rx=-16, ry=-12, rw=32, rh=24, rr=8; ctx.moveTo(rx+rr,ry); ctx.lineTo(rx+rw-rr,ry); ctx.arcTo(rx+rw,ry,rx+rw,ry+rr,rr); ctx.lineTo(rx+rw,ry+rh-rr); ctx.arcTo(rx+rw,ry+rh,rx+rw-rr,ry+rh,rr); ctx.lineTo(rx+rr,ry+rh); ctx.arcTo(rx,ry+rh,rx,ry+rh-rr,rr); ctx.lineTo(rx,ry+rr); ctx.arcTo(rx,ry,rx+rr,ry,rr); ctx.closePath(); ctx.fill(); ctx.fillStyle='#1b2030'; ctx.fillRect(0,-5,20,10); ctx.fillStyle='#e0e6f3'; ctx.fillRect(10,-3,12,6); ctx.restore(); if(this.shield>0){ ctx.strokeStyle='rgba(120,200,255,0.6)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx,sy,this.radius+6,0,Math.PI*2); ctx.stroke(); } if(this.invuln>0){ ctx.strokeStyle='rgba(255,220,120,0.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx,sy,this.radius+10,0,Math.PI*2); ctx.stroke(); } };

function Enemy(x,y){ Tank.call(this,x,y,'#ff6b6b'); this.ai=true; this.maxSpeed=120; this.fireRate=0.55; this.activeChase=false; }
Enemy.prototype = Object.create(Tank.prototype); Enemy.prototype.constructor = Enemy;
Enemy.prototype.update = function(dt){ const p=world.player; if(!p) return; const dx=p.x-this.x, dy=p.y-this.y; const d=Math.hypot(dx,dy); const t=Math.atan2(dy,dx);
  const steerTo = {x:Math.cos(t), y:Math.sin(t)};
  const avoid = avoidance(this);
  let sx = steerTo.x + avoid.ax*0.9;
  let sy = steerTo.y + avoid.ay*0.9;
  const len=Math.hypot(sx,sy)||1;
  const arrive = clamp((d-40)/220, 0.35, 1);
  if(this.activeChase){
    this.vx = (sx/len) * this.maxSpeed * arrive;
    this.vy = (sy/len) * this.maxSpeed * arrive;
    this.angle = Math.atan2(this.vy, this.vx);
    const los = lineOfSight(this.x,this.y,p.x,p.y); if(los && d<380) this.tryFire();
  } else {
    const roamSpeed = this.maxSpeed * 0.4;
    this.vx = (steerTo.x*0.25 + avoid.ax*0.9) * roamSpeed * arrive;
    this.vy = (steerTo.y*0.25 + avoid.ay*0.9) * roamSpeed * arrive;
    this.angle = Math.atan2(this.vy, this.vx);
  }
  Tank.prototype.update.call(this,dt); };

function PowerUp(x,y,type){ Entity.call(this,x,y); this.type=type; this.radius=12; this.ttl=20; }
PowerUp.prototype = Object.create(Entity.prototype); PowerUp.prototype.constructor = PowerUp;
PowerUp.prototype.apply = function(t){ if(this.type==='heal'){ t.hp=Math.min(t.maxHp, t.hp+3); sfx(620,'sine',0.12,0.12); }
  else if(this.type==='speed'){ t.speedBoost=6; sfx(440,'triangle',0.1,0.12); }
  else if(this.type==='rapid'){ t.reloadBoost=6; sfx(520,'sawtooth',0.1,0.12); }
  else if(this.type==='shield'){ t.shield=6; sfx(380,'triangle',0.12,0.12); } };
PowerUp.prototype.update = function(dt){ this.ttl-=dt; if(this.ttl<=0) this.dead=true; if(dist(this.x,this.y,world.player.x,world.player.y)<this.radius+world.player.radius){ this.apply(world.player); this.dead=true; world.score+=20; } };
PowerUp.prototype.draw = function(cam){ const sx=this.x-cam.x, sy=this.y-cam.y; const colors={heal:'#2bffb3',speed:'#29ccff',rapid:'#ffd06e',shield:'#9bd2ff'}; ctx.fillStyle=colors[this.type]||'#fff'; ctx.beginPath(); ctx.arc(sx,sy,12,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fillRect(sx-6,sy-6,12,12); };

const particles=[];
function spawnExplosion(x,y,n){ for(let i=0;i<n;i++){ const a=rand(0,Math.PI*2), sp=rand(50,240); particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(0.2,0.6),r:rand(2,4)}); } }
function applyExplosionDamage(x,y,r,owner){ if(!owner || owner.ai) return; // 仅玩家子弹爆炸产生范围伤害
  for(const e of world.entities){ if(e instanceof Enemy && !e.dead){ const d = Math.hypot(e.x-x, e.y-y); if(d < r){ e.hit(999); } } }
}
function updateParticles(dt){ for(const p of particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.96; p.vy*=0.96; p.life-=dt; } for(let i=particles.length-1;i>=0;i--){ if(particles[i].life<=0) particles.splice(i,1); } }
function drawParticles(cam){ ctx.fillStyle='rgba(255,200,80,0.8)'; for(const p of particles){ const sx=p.x-cam.x, sy=p.y-cam.y; if(sx<-10||sy<-10||sx>width+10||sy>height+10) continue; ctx.beginPath(); ctx.arc(sx,sy,p.r,0,Math.PI*2); ctx.fill(); }
}

function avoidance(e){ let ax=0, ay=0; for(const o of world.entities){ if(o===e|| !(o instanceof Tank)) continue; const d=dist(e.x,e.y,o.x,o.y); if(d<70){ ax += (e.x-o.x)/(d*d); ay += (e.y-o.y)/(d*d); } }
  // 复活安全半径：在玩家复活或无敌期间对敌人施加强推斥
  if(world.player && (world.player.invuln>0 || world.respawnMsg>0)){
    const dx = e.x - world.player.x; const dy = e.y - world.player.y; const d = Math.hypot(dx,dy);
    const R = 140;
    if(d < R){ const factor = (R - d)/R; const denom = d*d + 1; ax += (dx/denom) * 12 * factor; ay += (dy/denom) * 12 * factor; }
  }
  return {ax, ay}; }
// 限制同时追击的敌人数（仅最近的若干个主动追击并开火）
function markActiveEnemies(){ const enemies=world.entities.filter(e=> e instanceof Enemy && !e.dead); if(!world.player) { enemies.forEach(e=> e.activeChase=false); return; } let cap=2; if(world.difficulty==='normal') cap=4; else if(world.difficulty==='hard') cap=6; enemies.forEach(e=> e.activeChase=false); enemies.sort((a,b)=>{ const da=(a.x-world.player.x)**2+(a.y-world.player.y)**2; const db=(b.x-world.player.x)**2+(b.y-world.player.y)**2; return da-db; }); let assigned=0; for(const e of enemies){ const d2=(e.x-world.player.x)**2+(e.y-world.player.y)**2; if(d2<=600*600 && assigned<cap){ e.activeChase=true; assigned++; } }
}
function lineOfSight(x1,y1,x2,y2){ const steps=20; for(let i=1;i<=steps;i++){ const x=lerp(x1,x2,i/steps), y=lerp(y1,y2,i/steps); const tx=Math.floor(x/TILE), ty=Math.floor(y/TILE); const t=world.map.get(tx,ty); if(t===T_WALL||t===T_BRICK) return false; } return true; }

const world = { state:'menu', level:1, score:0, lives:3, map:null, player:null, entities:[], bullets:[], powerups:[], cam:{x:0,y:0}, respawnMsg:0, difficulty:'normal', playerBulletDamage:1, enemyBulletDamage:1, playerRegenRate:0, waveTime:0 };

function resolveSolid(e){
  const r=e.radius; let changed=false;
  const x0=Math.floor((e.x-r)/TILE), y0=Math.floor((e.y-r)/TILE);
  const x1=Math.floor((e.x+r)/TILE), y1=Math.floor((e.y+r)/TILE);
  const EPS=0.001;
  for(let ty=y0; ty<=y1; ty++){
    for(let tx=x0; tx<=x1; tx++){
      if(!world.map.hitSolid(tx,ty)) continue;
      const left=tx*TILE, top=ty*TILE, right=left+TILE, bottom=top+TILE;
      const nearestX = clamp(e.x, left, right);
      const nearestY = clamp(e.y, top, bottom);
      let dx = e.x - nearestX, dy = e.y - nearestY;
      const d = Math.hypot(dx,dy);
      if(d === 0){
        // 在盒子边或角的正切位置：按最小轴向穿透推出
        const toLeft = Math.abs(e.x - left);
        const toRight = Math.abs(right - e.x);
        const toTop = Math.abs(e.y - top);
        const toBottom = Math.abs(bottom - e.y);
        if(Math.min(toLeft,toRight) < Math.min(toTop,toBottom)){
          const dir = toLeft < toRight ? -1 : 1;
          e.x = (dir<0 ? left - r - EPS : right + r + EPS);
        } else {
          const dir = toTop < toBottom ? -1 : 1;
          e.y = (dir<0 ? top - r - EPS : bottom + r + EPS);
        }
        changed = true;
      } else if(d < r){
        const pen = r - d;
        dx /= d; dy /= d;
        e.x += dx * pen;
        e.y += dy * pen;
        changed = true;
      }
    }
  }
  return changed;
}

function separateTanks(){
  const tanks = world.entities.filter(e=> e instanceof Tank && !e.dead);
  // 进行多轮分离，确保复杂拥挤场景稳定
  for(let pass=0; pass<4; pass++){
    for(let i=0;i<tanks.length;i++){
      for(let j=i+1;j<tanks.length;j++){
        const a=tanks[i], b=tanks[j];
        let dx=b.x-a.x, dy=b.y-a.y; let d=Math.hypot(dx,dy);
        const md=a.radius+b.radius;
        if(d < md){
          if(d === 0){ const ang = Math.random()*Math.PI*2; dx=Math.cos(ang); dy=Math.sin(ang); d=1; }
          else { dx/=d; dy/=d; }
          const overlap = (md - d);
          a.x -= dx*overlap*0.5; a.y -= dy*overlap*0.5;
          b.x += dx*overlap*0.5; b.y += dy*overlap*0.5;
          // 给予轻微速度排斥，打破再次重叠的对称状态
          const impulse = overlap*6;
          a.vx -= dx*impulse; a.vy -= dy*impulse;
          b.vx += dx*impulse; b.vy += dy*impulse;
          resolveSolid(a); resolveSolid(b);
        }
      }
    }
  }
}

function newLevel(){ const w=38, h=26; world.map=new TileMap(w,h); world.map.gen(world.level); world.entities=[]; world.bullets=[]; world.powerups=[]; const px=Math.floor(w/2)*TILE+TILE/2, py=(h-3)*TILE+TILE/2; world.player=new Tank(px,py,'#29cc9f'); world.entities.push(world.player); world.cam.x = clamp(world.player.x - width/2, 0, world.map.w*TILE - width); world.cam.y = clamp(world.player.y - height/2, 0, world.map.h*TILE - height); world.waveTime=0; spawnWave(); updateHud(); }
function getTargetEnemyCount(){ const d=world.difficulty; const L=world.level; if(d==='easy') return L<3?2: L<6?3:4; if(d==='hard') return L<3?7: L<6?10:14; return L<3?5: L<6?8:11; }
function enemyHpForDifficulty(){ const d=world.difficulty; return d==='easy'?1: d==='hard'?7:6; }
function spawnWave(){
  const n = getTargetEnemyCount();
  const spawns=world.map.spawns.slice();
  for(let i=0;i<n;i++){
    const s=spawns[i%spawns.length];
    // 在出生格附近尝试多次寻找不重叠且不贴墙的位置
    let ex = s.x*TILE+TILE/2, ey = s.y*TILE+TILE/2;
    for(let t=0;t<12;t++){
      const ang = rand(0,Math.PI*2), rad = rand(0,20);
      const tx = ex + Math.cos(ang)*rad, ty = ey + Math.sin(ang)*rad;
      if(positionFree(tx,ty,14)) { ex=tx; ey=ty; break; }
    }
    const e=new Enemy(ex,ey);
    const ehp = enemyHpForDifficulty(); e.maxHp=ehp; e.hp=ehp;
    if(world.difficulty==='easy'){ e.maxSpeed=90; e.fireRate=0.9; } else if(world.difficulty==='hard'){ e.maxSpeed=140; e.fireRate=0.5; } else { e.maxSpeed=120; e.fireRate=0.65; }
    resolveSolid(e);
    world.entities.push(e);
  }
}
function spawnExtraEnemy(){ const spawns=world.map.spawns.slice(); const s=spawns[Math.floor(rand(0,spawns.length))]; let ex = s.x*TILE+TILE/2, ey = s.y*TILE+TILE/2; for(let t=0;t<12;t++){ const ang = rand(0,Math.PI*2), rad = rand(0,20); const tx = ex + Math.cos(ang)*rad, ty = ey + Math.sin(ang)*rad; if(positionFree(tx,ty,14)) { ex=tx; ey=ty; break; } } const e=new Enemy(ex,ey); const ehp=enemyHpForDifficulty(); e.maxHp=ehp; e.hp=ehp; if(world.difficulty==='easy'){ e.maxSpeed=90; e.fireRate=0.9; } else if(world.difficulty==='hard'){ e.maxSpeed=140; e.fireRate=0.5; } else { e.maxSpeed=120; e.fireRate=0.65; } resolveSolid(e); world.entities.push(e); }
function positionFree(x,y,r){
  // 不在固体中且与现有坦克保持最小距离
  if(world.map.hitSolid(Math.floor(x/TILE), Math.floor(y/TILE))) return false;
  for(const ent of world.entities){
    if(ent instanceof Tank && !ent.dead){
      if(Math.hypot(x-ent.x, y-ent.y) < (r + ent.radius + 6)) return false;
    }
  }
  return true;
}
function maybeDrop(x,y){ const types=['heal','speed','rapid','shield']; if(Math.random()<0.18){ const t=types[Math.floor(rand(0,types.length))]; world.powerups.push(new PowerUp(x,y,t)); } }

function updateHud(){ hud.score.textContent = world.score; hud.lives.textContent = world.lives; hud.level.textContent = world.level; const enemies = world.entities.filter(e=>e instanceof Enemy && !e.dead).length; hud.enemies.textContent = enemies; const hp = world.player? (world.player.hp/world.player.maxHp)*100: 100; hud.healthFill.style.width = hp+'%'; }

let last=performance.now();
function loop(now){ const dt=Math.min(0.033,(now-last)/1000); last=now; if(world.state==='playing'){ const input={ up:keys.has('w')||keys.has('arrowup'), down:keys.has('s')||keys.has('arrowdown'), left:keys.has('a')||keys.has('arrowleft'), right:keys.has('d')||keys.has('arrowright'), fire:keys.has(' ')||keys.has('j')||pointer.active, aimX:pointer.x + world.cam.x, aimY:pointer.y + world.cam.y, aimLeft:keys.has('q'), aimRight:keys.has('e') };
    world.player.control(input, dt); markActiveEnemies(); for(const e of world.entities){ if(e.dead) continue; e.update(dt); }
    separateTanks();
    for(const b of world.bullets){ b.update(dt); }
    for(const p of world.powerups){ p.update(dt); }
    for(let i=world.entities.length-1;i>=0;i--){ const e=world.entities[i]; if(e.dead){ if(e instanceof Enemy) maybeDrop(e.x,e.y); if(e!==world.player) world.entities.splice(i,1); } }
    for(let i=world.bullets.length-1;i>=0;i--){ if(world.bullets[i].dead) world.bullets.splice(i,1); }
    for(let i=world.powerups.length-1;i>=0;i--){ if(world.powerups[i].dead) world.powerups.splice(i,1); }
    updateParticles(dt);
    world.waveTime += dt;
    if(world.respawnMsg>0){ world.respawnMsg-=dt; if(world.respawnMsg<0) world.respawnMsg=0; }
    world.cam.x = clamp(world.player.x - width/2, 0, world.map.w*TILE - width);
    world.cam.y = clamp(world.player.y - height/2, 0, world.map.h*TILE - height);
    const remaining = world.entities.filter(e=>e instanceof Enemy && !e.dead).length;
    if(remaining===0){ world.level++; world.score+=200; sfx(880,'square',0.2,0.12); newLevel(); }
    else {
      // 在中高难度下，若敌人数量低于目标且时间达到阈值，增援一个敌人
      const target = getTargetEnemyCount();
      if(world.difficulty!=='easy' && world.waveTime>12 && remaining<target){ spawnExtraEnemy(); world.waveTime=0; }
    }
    if(world.player.dead){ world.lives--; world.score=Math.max(0,world.score-150); if(world.lives<=0){ world.state='gameover'; menu.style.display='flex'; startBtn.textContent='再来一局'; } else { const rx=Math.floor(world.map.w/2)*TILE+TILE/2; const ry=(world.map.h-3)*TILE+TILE/2; world.player.dead=false; world.player.hp=world.player.maxHp; world.player.x=rx; world.player.y=ry; world.player.invuln=2.0; world.respawnMsg=1.5; world.cam.x = clamp(world.player.x - width/2, 0, world.map.w*TILE - width); world.cam.y = clamp(world.player.y - height/2, 0, world.map.h*TILE - height); } }
    updateHud();
  }
  draw(); requestAnimationFrame(loop); }

function draw(){ ctx.clearRect(0,0,width,height); if(!world.map) return; world.map.draw(world.cam); drawParticles(world.cam); for(const e of world.entities){ if(e.dead) continue; e.draw(world.cam); } for(const b of world.bullets){ b.draw(world.cam); } for(const p of world.powerups){ p.draw(world.cam); } if(world.respawnMsg>0){ const a=Math.min(1, world.respawnMsg/1.5); ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#e6f3ff'; ctx.font='bold 22px sans-serif'; ctx.textAlign='center'; ctx.fillText('复活！短暂无敌', width/2, 60); ctx.restore(); }
}

function start(){ ensureAudio(); audioVolume = parseFloat(volumeRange.value); if(masterGain) masterGain.gain.value = audioVolume; world.state='playing'; world.score=0; world.lives=3; world.difficulty = difficultySel.value || 'normal'; world.level= world.difficulty==='easy'?1: world.difficulty==='normal'?2:3; if(world.difficulty==='easy'){ world.playerBulletDamage=3; world.enemyBulletDamage=0.6; world.playerRegenRate=0.7; } else if(world.difficulty==='hard'){ world.playerBulletDamage=1; world.enemyBulletDamage=1.2; world.playerRegenRate=0.15; } else { world.playerBulletDamage=1; world.enemyBulletDamage=1; world.playerRegenRate=0.3; } newLevel(); menu.style.display='none'; sfx(440,'sawtooth',0.18,0.12); }

startBtn.addEventListener('click', start);
volumeRange.addEventListener('input', e => { audioVolume=parseFloat(e.target.value); if(masterGain) masterGain.gain.value=audioVolume; });

window.addEventListener('keydown', e=>{ if(e.key.toLowerCase()==='p'){ if(world.state==='playing'){ world.state='paused'; menu.style.display='flex'; startBtn.textContent='继续游戏'; startBtn.onclick=()=>{ world.state='playing'; menu.style.display='none'; startBtn.onclick=start; }; } else if(world.state==='paused'){ world.state='playing'; menu.style.display='none'; startBtn.textContent='开始游戏'; startBtn.onclick=start; } } });

if('ontouchstart' in window){ mobile.root.style.display='block'; }

requestAnimationFrame(loop);