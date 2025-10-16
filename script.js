 // script.js

// =====  DOM References  =====
const canvas      = document.getElementById('gameCanvas');
const ctx         = canvas.getContext('2d');
const score1El    = document.getElementById('score1');
const score2El    = document.getElementById('score2');
const startBtn    = document.getElementById('startBtn');
const pauseBtn    = document.getElementById('pauseBtn');
const soundBtn    = document.getElementById('soundToggleBtn');
const modeSel     = document.getElementById('playerMode');
const diffSel     = document.getElementById('difficulty');
const modal       = document.getElementById('gameOverModal');
const msgEl       = document.getElementById('gameOverMessage');
const restartBtn  = document.getElementById('restartBtn');

// =====  Audio Elements  =====
const eatSound      = document.getElementById('eatSound');
const gameOverSound = document.getElementById('gameOverSound');
const startSound    = document.getElementById('startSound');
const turnSound     = document.getElementById('turnSound');
let soundOn = true;

function toggleSound() {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? '🔊 Som' : '🔇 Sem Som';
}

function playSound(s) {
  if (!soundOn || !s) return;
  s.currentTime = 0;
  s.play().catch(() => {});
}

// =====  Constants  =====
const MAX_SCORE = 10;

// =====  Game State  =====
let grid, speed, players, running;
let snakes, dirs, food, trees, scores;

// =====  Setup & Resize Canvas  =====
function resizeCanvas() {
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// =====  Helpers  =====
function randPos() {
  const cols = Math.floor(canvas.width / grid);
  const rows = Math.floor(canvas.height / grid);
  return {
    x: Math.floor(Math.random() * cols) * grid,
    y: Math.floor(Math.random() * rows) * grid
  };
}

function occupied(x, y) {
  // check snake1
  if (snakes[0].some(s => s.x === x && s.y === y)) return true;
  // check snake2 only if in 2-player mode
  if (players === 2 && snakes[1].some(s => s.x === x && s.y === y)) return true;
  // check trees
  if (trees.some(t => t.x === x && t.y === y)) return true;
  // check food
  return food && food.x === x && food.y === y;
}

// =====  Spawn Obstacles & Food  =====
function placeTrees(count = 12) {
  trees = [];
  while (trees.length < count) {
    const p = randPos();
    if (!occupied(p.x, p.y)) trees.push(p);
  }
}

function placeFood() {
  let p;
  do {
    p = randPos();
  } while (occupied(p.x, p.y));
  food = p;
}

// =====  Draw Functions  =====
function drawBackground() {
  const w = canvas.width,
        h = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#04211a');
  grad.addColorStop(1, '#0a2b20');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(0,150,100,0.1)';
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * w,
          y = Math.random() * h;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrees() {
  for (const t of trees) {
    // trunk
    ctx.fillStyle = '#5b3a29';
    ctx.fillRect(t.x + grid/2 - 4, t.y + grid/2, 8, grid/2);
    // foliage
    ctx.fillStyle = '#2e8b57';
    ctx.beginPath();
    ctx.arc(t.x + grid/2, t.y + grid/2, grid/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3cb371';
    ctx.beginPath();
    ctx.arc(t.x + grid/2, t.y + grid/2 - 6, grid/3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFood() {
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(food.x + grid/2, food.y + grid/2, grid/2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake(snake, colorRGB) {
  snake.forEach((seg, i) => {
    const t = i / (snake.length - 1 || 1);
    const a = 0.6 + 0.4 * (1 - t);
    ctx.fillStyle = `rgba(${colorRGB[0]},${colorRGB[1]},${colorRGB[2]},${a})`;
    ctx.fillRect(seg.x + 2, seg.y + 2, grid - 4, grid - 4);
  });
}

// =====  Score Display  =====
function updateScores() {
  score1El.textContent = scores[0];
  score2El.textContent = players === 2 ? scores[1] : '-';
}

// =====  Movement & Collisions  =====
function moveSnake(snake, dir, idx) {
  const head = { ...snake[0] };
  if (dir === 'UP')    head.y -= grid;
  if (dir === 'DOWN')  head.y += grid;
  if (dir === 'LEFT')  head.x -= grid;
  if (dir === 'RIGHT') head.x += grid;
  snake.unshift(head);

  // eating
  if (head.x === food.x && head.y === food.y) {
    playSound(eatSound);
    scores[idx]++;
    if (scores[idx] >= MAX_SCORE) {
      endGame();
      return;
    }
    placeFood();
  } else {
    snake.pop();
  }

  // wall collision
  if (
    head.x < 0 ||
    head.y < 0 ||
    head.x >= canvas.width ||
    head.y >= canvas.height
  ) {
    endGame();
    return;
  }

  // self collision
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      endGame();
      return;
    }
  }

  // tree collision
  if (trees.some(t => t.x === head.x && t.y === head.y)) {
    endGame();
    return;
  }

  // opponent collision
  if (players === 2) {
    const other = snakes[1 - idx];
    if (other.some(o => o.x === head.x && o.y === head.y)) {
      endGame();
    }
  }
}

// =====  Game Loop  =====
function gameLoop() {
  if (!running) return;
  moveSnake(snakes[0], dirs[0], 0);
  if (players === 2) moveSnake(snakes[1], dirs[1], 1);

  drawBackground();
  drawTrees();
  drawFood();
  drawSnake(snakes[0], [0, 208, 179]);
  if (players === 2) drawSnake(snakes[1], [255, 77, 77]);
  updateScores();

  setTimeout(gameLoop, speed);
}

// =====  Controls  =====
function startGame() {
  grid   = 20;
  players= parseInt(modeSel.value, 10);
  speed  = parseInt(diffSel.value, 10);
  running= true;

  // initialize snakes
  snakes = [
    [{ x: grid * 5,  y: grid * 5 }],
    []
  ];
  if (players === 2) {
    snakes[1] = [{ x: grid * 15, y: grid * 15 }];
  }

  dirs   = ['RIGHT', 'LEFT'];
  scores = [0, 0];

  placeTrees();
  placeFood();
  updateScores();

  modal.style.display = 'none';
  playSound(startSound);
  gameLoop();
}

function resetGame() {
  if (running) {
    running = false;
  }
  startGame();
}

function togglePause() {
  running = !running;
  if (running) gameLoop();
}

function endGame() {
  if (!running) return;
  running = false;
  playSound(gameOverSound);

  if (players === 2) {
    if (scores[0] > scores[1]) msgEl.textContent = '🏆 Jogador 1 vence!';
    else if (scores[1] > scores[0]) msgEl.textContent = '🏆 Jogador 2 vence!';
    else msgEl.textContent = '🤝 Empate!';
  } else {
    msgEl.textContent = '🏁 Você alcançou 10 pontos!';
  }

  modal.style.display = 'flex';
}

// =====  Event Listeners  =====
startBtn.addEventListener('click', () => {
  if (!running) startGame();
});
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', resetGame);
soundBtn.addEventListener('click', toggleSound);

modeSel.addEventListener('change', () => {
  // just update mode; next start uses it
  players = parseInt(modeSel.value, 10);
});
diffSel.addEventListener('change', () => {
  speed = parseInt(diffSel.value, 10);
});

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ') {
    togglePause();
    return;
  }
  if (k === 'r') {
    resetGame();
    return;
  }
  // player 1 controls
  if (['w','a','s','d'].includes(k)) {
    dirs[0] = k === 'w' ? 'UP'
            : k === 's' ? 'DOWN'
            : k === 'a' ? 'LEFT'
            : 'RIGHT';
    playSound(turnSound);
  }
  // player 2 controls
  if (players === 2) {
    if (['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key)) {
      dirs[1] = e.key === 'ArrowUp'    ? 'UP'
              : e.key === 'ArrowDown'  ? 'DOWN'
              : e.key === 'ArrowLeft'  ? 'LEFT'
              : 'RIGHT';
      playSound(turnSound);
    }
  }
});
