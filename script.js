 // References (assumes index.html has the matching IDs)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const score1Span = document.getElementById('score1');
const score2Span = document.getElementById('score2');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const restartBtn = document.getElementById('restartBtn');

// Audio elements (optional — ensure files exist)
const eatSound = document.getElementById('eatSound');
const gameOverSound = document.getElementById('gameOverSound');
const startSound = document.getElementById('startSound');
const turnSound = document.getElementById('turnSound');
const crashSound = document.getElementById('crashSound');
const allSounds = [eatSound, gameOverSound, startSound, turnSound, crashSound].filter(Boolean);
allSounds.forEach(s => s.volume = 0.5);

// Sound control
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
function updateSoundButton(){ if(soundToggleBtn) soundToggleBtn.textContent = soundEnabled ? '🔊 Som' : '🔇 Som'; }
updateSoundButton();
function toggleSound(){ soundEnabled = !soundEnabled; localStorage.setItem('soundEnabled', soundEnabled); updateSoundButton(); }
function stopAllSounds(){ allSounds.forEach(s => { try{ s.pause(); s.currentTime = 0; } catch{} }); }
function playSound(sound, cutOthers = true){ if(!soundEnabled || !sound) return; if(cutOthers) stopAllSounds(); try{ sound.currentTime = 0; sound.play(); } catch{} }

// Canvas sizing (crisp on HiDPI)
function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game state
const grid = 20;
let snake1 = [], snake2 = [];
let dir1 = 'RIGHT', dir2 = 'LEFT';
let food = null;
let obstacles = [];
let score1 = 0, score2 = 0;
let speed = 100;
let isRunning = false;
let lastTime = 0;
let particles = [];

// Utilities
function randomGridPosition(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cols = Math.floor((canvas.width / dpr) / grid);
  const rows = Math.floor((canvas.height / dpr) / grid);
  return { x: Math.floor(Math.random() * cols) * grid, y: Math.floor(Math.random() * rows) * grid };
}
function posEqual(a,b){ return a && b && a.x === b.x && a.y === b.y; }
function occupied(pos){
  if(!pos) return false;
  for(const s of snake1) if(s.x===pos.x && s.y===pos.y) return true;
  for(const s of snake2) if(s.x===pos.x && s.y===pos.y) return true;
  for(const o of obstacles) if(o.x===pos.x && o.y===pos.y) return true;
  return false;
}

// Spawn safe
function spawnFood(){
  let p, attempts = 0;
  do { p = randomGridPosition(); attempts++; if(attempts>500) break; } while(occupied(p));
  food = p;
}
function spawnObstacles(count = 10){
  obstacles = [];
  let attempts = 0;
  while(obstacles.length < count && attempts < count * 30){
    const p = randomGridPosition();
    if(!occupied(p)) obstacles.push(p);
    attempts++;
  }
}

// Particles (visual) — simple and cheap
function spawnParticles(x,y,color='255,255,255'){
  for(let i=0;i<10;i++){
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*2,
      vy: (Math.random()-1.5)*2,
      life: 30 + Math.random()*20,
      color
    });
  }
}
function updateParticles(){
  for(let i = particles.length-1; i>=0; i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    ctx.fillStyle = `rgba(${p.color},${Math.max(0, p.life/50)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.life/10), 0, Math.PI*2); ctx.fill();
  }
}

// Drawing helpers
function clearAndBackground(){
  const w = canvas.width / Math.max(1, window.devicePixelRatio || 1);
  const h = canvas.height / Math.max(1, window.devicePixelRatio || 1);
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0, '#133a2f'); grad.addColorStop(1, '#0a2b20');
  ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
}
function drawGrid(){
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  const w = canvas.width / Math.max(1, window.devicePixelRatio || 1);
  const h = canvas.height / Math.max(1, window.devicePixelRatio || 1);
  for(let x=0;x<w;x+=grid){ ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,h); ctx.stroke(); }
  for(let y=0;y<h;y+=grid){ ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(w,y+0.5); ctx.stroke(); }
  ctx.restore();
}
function drawFood(){
  if(!food) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(food.x + grid/2, food.y + grid/2 + 4, grid/3, grid/7, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.arc(food.x + grid/2, food.y + grid/2 - 2, Math.max(4, grid/2 - 4), 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(food.x + grid/2 - 4, food.y + grid/2 - 6, 3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawObstacles(){
  ctx.save();
  for(const o of obstacles){
    ctx.fillStyle = '#5b2f0a'; ctx.fillRect(o.x + 6, o.y + 10, 8, 10);
    ctx.fillStyle = '#2e8b57'; ctx.beginPath(); ctx.ellipse(o.x + grid/2, o.y + grid/2 - 6, grid/2 + 4, grid/2 - 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3cb371'; ctx.beginPath(); ctx.ellipse(o.x + grid/2, o.y + grid/2 - 8, grid/2 - 1, grid/2 - 3, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function hexToRgb(hex){ const n = parseInt(hex.replace('#',''),16); return `${(n>>16)&255},${(n>>8)&255},${n&255}`; }
function drawSnake(snake, baseColor, headColor){
  if(!snake || snake.length === 0) return;
  for(let i = snake.length - 1; i >= 0; i--){
    const seg = snake[i];
    const t = i / Math.max(1, snake.length - 1);
    const alpha = 0.55 + 0.45 * (1 - t);
    ctx.fillStyle = i === 0 ? headColor : `rgba(${hexToRgb(baseColor)},${alpha})`;
    ctx.beginPath(); ctx.arc(seg.x + grid/2, seg.y + grid/2, grid/2 - 1, 0, Math.PI*2); ctx.fill();
    if(i === 0){
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(seg.x + grid/2, seg.y + grid/2, grid/2 - 1, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }
  }
}
function updateHUD(){ if(score1Span) score1Span.textContent = score1; if(score2Span) score2Span.textContent = score2; }

// Movement and collision
function moveSnake(snake, dir){
  const head = { ...snake[0] };
  if(dir === 'UP') head.y -= grid;
  if(dir === 'DOWN') head.y += grid;
  if(dir === 'LEFT') head.x -= grid;
  if(dir === 'RIGHT') head.x += grid;
  snake.unshift(head);
  return head;
}
function checkCollision(head, snake){
  if(!head) return false;
  const w = Math.floor((canvas.width / Math.max(1, window.devicePixelRatio || 1)));
  const h = Math.floor((canvas.height / Math.max(1, window.devicePixelRatio || 1)));
  if(head.x < 0 || head.y < 0 || head.x >= w || head.y >= h) return true;
  if(snake.slice(1).some(seg => seg.x === head.x && seg.y === head.y)) return true;
  if(obstacles.some(o => o.x === head.x && o.y === head.y)) return true;
  return false;
}

// Game loop
function loop(ts){
  if(!isRunning) return;
  if(!lastTime) lastTime = ts;
  if(ts - lastTime > speed){
    lastTime = ts;
    const head1 = moveSnake(snake1, dir1);
    const head2 = moveSnake(snake2, dir2);

    // eating
    if(posEqual(head1, food)){ score1++; playSound(eatSound, false); spawnFood(); spawnParticles(head1.x + grid/2, head1.y + grid/2); } else snake1.pop();
    if(posEqual(head2, food)){ score2++; playSound(eatSound, false); spawnFood(); spawnParticles(head2.x + grid/2, head2.y + grid/2, '255,220,100'); } else snake2.pop();

    // collisions
    if(checkCollision(head1, snake1) || snake2.some(s => s.x === head1.x && s.y === head1.y)){
      stopAllSounds(); playSound(crashSound, false); setTimeout(()=>{ playSound(gameOverSound, false); }, 300); endGame('Jogador 1 perdeu!'); return;
    }
    if(checkCollision(head2, snake2) || snake1.some(s => s.x === head2.x && s.y === head2.y)){
      stopAllSounds(); playSound(crashSound, false); setTimeout(()=>{ playSound(gameOverSound, false); }, 300); endGame('Jogador 2 perdeu!'); return;
    }
    if(head1.x === head2.x && head1.y === head2.y){
      stopAllSounds(); playSound(crashSound, false); setTimeout(()=>{ playSound(gameOverSound, false); }, 300); endGame('Empate! As cobras colidiram.'); return;
    }

    updateParticles();
    // draw
    clearAndBackground();
    drawGrid();
    drawObstacles();
    drawFood();
    drawSnake(snake1, '#0099cc', '#00e6ff');
    drawSnake(snake2, '#cc9900', '#fff000');
    drawParticles();
    updateHUD();
  }
  requestAnimationFrame(loop);
}

// Start / end / pause
function startGame(){
  if(isRunning) return;
  resizeCanvas();
  speed = parseInt(document.getElementById('difficulty')?.value) || 100;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cols = Math.floor((canvas.width / dpr) / grid);
  const rows = Math.floor((canvas.height / dpr) / grid);

  // safe initial snakes
  snake1 = [
    { x: Math.min(2*grid, (cols-1)*grid), y: Math.min(2*grid, (rows-1)*grid) },
    { x: Math.min(1*grid, (cols-1)*grid), y: Math.min(2*grid, (rows-1)*grid) },
    { x: Math.min(0*grid, (cols-1)*grid), y: Math.min(2*grid, (rows-1)*grid) },
    { x: Math.max(0, Math.min(-1*grid + grid, (cols-1)*grid)), y: Math.min(2*grid, (rows-1)*grid) }
  ];
  snake2 = [
    { x: Math.max(0, (cols-3)*grid), y: Math.max(0,(rows-3)*grid) },
    { x: Math.max(0, (cols-2)*grid), y: Math.max(0,(rows-3)*grid) },
    { x: Math.max(0, (cols-1)*grid), y: Math.max(0,(rows-3)*grid) },
    { x: Math.min((cols)*grid, (cols-1)*grid), y: Math.max(0,(rows-3)*grid) }
  ];
  dir1 = 'RIGHT'; dir2 = 'LEFT';
  score1 = 0; score2 = 0;
  spawnFood();
  spawnObstacles(10);
  particles = [];
  isRunning = true;
  lastTime = 0;
  stopAllSounds(); playSound(startSound, true);
  gameOverModal.style.display = 'none';
  updateHUD();
  requestAnimationFrame(loop);
}
function endGame(message){
  isRunning = false;
  lastTime = 0;
  gameOverMessage.textContent = message;
  gameOverModal.style.display = 'flex';
  stopAllSounds();
}
function togglePause(){
  if(!isRunning){ startGame(); return; }
  isRunning = !isRunning;
  if(isRunning){ lastTime = 0; requestAnimationFrame(loop); } else { stopAllSounds(); }
}

// Keyboard controls
document.addEventListener('keydown', e=>{
  const k = e.key;
  if((k === 'w' || k === 'W') && dir1 !== 'DOWN') { dir1 = 'UP'; playSound(turnSound, false); }
  if((k === 's' || k === 'S') && dir1 !== 'UP') { dir1 = 'DOWN'; playSound(turnSound, false); }
  if((k === 'a' || k === 'A') && dir1 !== 'RIGHT') { dir1 = 'LEFT'; playSound(turnSound, false); }
  if((k === 'd' || k === 'D') && dir1 !== 'LEFT') { dir1 = 'RIGHT'; playSound(turnSound, false); }

  if(k === 'ArrowUp' && dir2 !== 'DOWN') { dir2 = 'UP'; playSound(turnSound, false); }
  if(k === 'ArrowDown' && dir2 !== 'UP') { dir2 = 'DOWN'; playSound(turnSound, false); }
  if(k === 'ArrowLeft' && dir2 !== 'RIGHT') { dir2 = 'LEFT'; playSound(turnSound, false); }
  if(k === 'ArrowRight' && dir2 !== 'LEFT') { dir2 = 'RIGHT'; playSound(turnSound, false); }

  if(k === ' ') { e.preventDefault(); togglePause(); }
  if(k === 'r' || k === 'R'){ gameOverModal.style.display = 'none'; startGame(); }
});

// DOM buttons
if(startBtn) startBtn.addEventListener('click', ()=>{ gameOverModal.style.display = 'none'; startGame(); });
if(pauseBtn) pauseBtn.addEventListener('click', togglePause);
if(soundToggleBtn) soundToggleBtn.addEventListener('click', toggleSound);
if(restartBtn) restartBtn.addEventListener('click', ()=>{ gameOverModal.style.display = 'none'; startGame(); });

// Initial draw (visual only)
clearAndBackground();
drawGrid();
drawObstacles();
drawFood();
updateHUD();
