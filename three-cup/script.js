// Copied from root script.js to keep this game self-contained
/*
Three-Cup Shell Game
- Place ball under a random cup
- Show ball briefly
- Cover (cups down)
- Shuffle cups with increasing speed
- Player guesses -> reveal
*/

const table = document.getElementById('table');
const ballEl = document.getElementById('ball');
let cups = [
  document.getElementById('cup0'),
  document.getElementById('cup1'),
  document.getElementById('cup2'),
];

const startBtn = document.getElementById('startBtn');
const againBtn = document.getElementById('againBtn');
const message = document.getElementById('message');
const winsEl = document.getElementById('wins');
const lossesEl = document.getElementById('losses');
const difficultyEl = document.getElementById('difficulty');
const sfxToggleBtn = document.getElementById('sfxToggle');

let ballCupEl = null; // the actual cup DOM element with the ball
let canGuess = false;
let running = false;
let wins = 0;
let losses = 0;
let lockingReveal = false; // prevents ball repositioning during reveal
let sfxEnabled = true;

function randInt(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function placeBallAtCup(cupEl){
  if(!cupEl) return;
  const tableRect = table.getBoundingClientRect();
  const cupRect = cupEl.getBoundingClientRect();
  const centerX = cupRect.left + cupRect.width / 2 - tableRect.left; // px within table
  ballEl.style.left = centerX + 'px';
}

function setMessage(text, kind = 'info'){
  pulseMessage(text);
  message.style.color = kind === 'win' ? 'var(--accent)' : kind === 'lose' ? 'var(--danger)' : 'var(--muted)';
}

function coverCups(cover=true){
  cups.forEach(c => {
    c.classList.toggle('lifted', !cover); // lifted=false means down covering the ball
  });
}

function enableCups(enabled){
  cups.forEach(c => {
    c.classList.toggle('hidden', !enabled);
    c.tabIndex = enabled ? 0 : -1;
  });
}

function layout(){
  // Ensure ball sits centered under the current cup
  if(!lockingReveal){
    placeBallAtCup(ballCupEl);
  }
}

window.addEventListener('resize', layout);

document.addEventListener('DOMContentLoaded', () => {
  // Initial state
  coverCups(false); // show cups lifted so player can see where the ball starts
  ballCupEl = cups[randInt(0, 2)];
  layout();
  enableCups(false);
  setMessage('Press Start to begin. Watch closely!');
});

function swapPositions(i, j){
  // Swap cups[i] and cups[j] "left" values
  const leftI = cups[i].style.left || window.getComputedStyle(cups[i]).left;
  const leftJ = cups[j].style.left || window.getComputedStyle(cups[j]).left;

  cups[i].style.setProperty('--t', currentSpeed + 'ms');
  cups[j].style.setProperty('--t', currentSpeed + 'ms');
  cups[i].classList.add('swap');
  cups[j].classList.add('swap');

  cups[i].style.left = leftJ;
  cups[j].style.left = leftI;
  // Do NOT swap the array references; keep element identities stable
}

function randomSwapIndex(){
  let i = randInt(0, 2);
  let j = randInt(0, 2);
  while(j === i){ j = randInt(0, 2); }
  // Normalize to ensure i < j for simpler reasoning in callers (not required)
  if(j < i){ const t = i; i = j; j = t; }
  return [i, j];
}

function wait(ms){ return new Promise(res => setTimeout(res, ms)); }

let currentSpeed = 600; // ms per swap, will accelerate

async function revealBallBriefly(){
  coverCups(false); // lift cups so ball is visible
  setMessage('Memorize the ball position...');
  await wait(1000);
  coverCups(true); // cover the ball
  setMessage('Shuffling...');
  await wait(400);
}

function getShufflePlan(difficulty){
  // Number of swaps grows with difficulty; speed accelerates during run
  const baseSwaps = { 1: 6, 2: 9, 3: 12, 4: 16, 5: 22 }[difficulty] || 12;
  const minSpeed = { 1: 420, 2: 360, 3: 300, 4: 240, 5: 180 }[difficulty] || 300;
  const accel = { 1: 16, 2: 20, 3: 24, 4: 28, 5: 34 }[difficulty] || 24;
  return { baseSwaps, minSpeed, accel };
}

async function shuffle(){
  const difficulty = parseInt(difficultyEl.value, 10) || 3;
  const { baseSwaps, minSpeed, accel } = getShufflePlan(difficulty);

  let swaps = baseSwaps;
  currentSpeed = 650 - difficulty * 60; // initial speed based on difficulty
  if(currentSpeed < minSpeed) currentSpeed = minSpeed;

  for(let s=0; s<swaps; s++){
    const [i, j] = randomSwapIndex();
    swapPositions(i, j);
    // Keep ball attached to the same cup element; just re-center under it
    placeBallAtCup(ballCupEl);
    await wait(currentSpeed);

    // accelerate a bit each step but clamp to minSpeed
    currentSpeed = Math.max(minSpeed, currentSpeed - accel);
  }

  setMessage('Pick a cup.');
}

function onCupGuess(e){
  if(!canGuess || !running) return;
  const el = e.currentTarget;
  canGuess = false;
  revealByElement(el);
}

function getCupsByVisualOrder(){
  // Sort cups by current on-screen left position
  return [...cups].sort((a,b)=> a.getBoundingClientRect().left - b.getBoundingClientRect().left);
}

async function revealByElement(guessedCup){
  lockingReveal = true;
  enableCups(false);
  // Lift the guessed cup first
  guessedCup.classList.add('lifted');
  await wait(350);

  // Then lift the rest
  cups.forEach(c => c.classList.add('lifted'));

  await wait(200);

  // Determine the actual cup by where the ball currently is on screen (no repositioning)
  const ballRect = ballEl.getBoundingClientRect();
  const ballCenterX = ballRect.left + ballRect.width / 2;
  let actualCup = cups[0];
  let bestDist = Infinity;
  for(const c of cups){
    const r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const d = Math.abs(cx - ballCenterX);
    if(d < bestDist){ bestDist = d; actualCup = c; }
  }
  // Align internal state to this cup for subsequent rounds
  ballCupEl = actualCup;
  // Compute visual index (left-to-right = 1..3)
  const ordered = getCupsByVisualOrder();
  const actualIdx = ordered.indexOf(actualCup); // 0-based
  if(guessedCup === actualCup){
    wins++;
    winsEl.textContent = `Wins: ${wins}`;
    setMessage('Correct! You found the ball!', 'win');
    actualCup.classList.add('correct');
    winTone();
    launchConfetti(1400, 160);
  } else {
    losses++;
    lossesEl.textContent = `Losses: ${losses}`;
    setMessage(`Miss! The ball was under Cup ${actualIdx+1}.`, 'lose');
    actualCup.classList.add('correct');
    missTone();
  }

  running = false;
  againBtn.hidden = false;
  startBtn.disabled = false;
  lockingReveal = false;
}

async function start(){
  if(running) return;
  running = true;
  againBtn.hidden = true;
  startBtn.disabled = true;
  setMessage('');

  // Choose new position and reset visuals
  ballCupEl = cups[randInt(0,2)];
  // Reset array order to match DOM ids for a clean round start
  cups.sort((a,b) => parseInt(a.id.replace('cup',''), 10) - parseInt(b.id.replace('cup',''), 10));
  cups.forEach(c => {
    c.classList.remove('swap', 'correct');
  });
  ['25%','50%','75%'].forEach((pos, i)=>{
    const c = document.getElementById('cup'+i);
    c.style.left = pos;
  });
  layout();
  coverCups(false); // show for a moment so user can memorize

  await revealBallBriefly();
  await shuffle();

  // Ready for guess
  canGuess = true;
  enableCups(true);
}

function resetForNext(){
  canGuess = false;
  running = false;
  startBtn.disabled = false;
  againBtn.hidden = true;
  setMessage('Press Start to play again.');
  cups.forEach(c => c.classList.add('lifted'));
}

cups.forEach(cup => {
  cup.addEventListener('click', onCupGuess);
  cup.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      onCupGuess({ currentTarget: cup });
    }
  });
});

startBtn.addEventListener('click', start);
againBtn.addEventListener('click', () => {
  resetForNext();
  start();
});

// --- Celebration: Lightweight confetti ---
function launchConfetti(durationMs = 1200, particleCount = 140){
  if(document.getElementById('confetti-canvas')) return;
  const c = document.createElement('canvas');
  c.id = 'confetti-canvas';
  c.style.position = 'fixed';
  c.style.inset = '0';
  c.style.pointerEvents = 'none';
  c.style.zIndex = '9999';
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const resize = ()=>{ c.width = window.innerWidth; c.height = window.innerHeight; };
  resize();
  const onResize = ()=> resize();
  window.addEventListener('resize', onResize);
  const colors = ['#60a5fa','#f59e0b','#22c55e','#ef4444','#a78bfa','#f472b6'];
  const parts = [];
  for(let i=0;i<particleCount;i++){
    const angle = Math.random()*Math.PI - Math.PI/2;
    const speed = 6 + Math.random()*6;
    parts.push({
      x: c.width/2 + (Math.random()*120 - 60),
      y: c.height/4,
      vx: Math.cos(angle)*speed,
      vy: Math.sin(angle)*speed - 2,
      g: 0.15 + Math.random()*0.2,
      w: 6 + Math.random()*6,
      h: 2 + Math.random()*3,
      rot: Math.random()*Math.PI,
      vr: (Math.random()-0.5)*0.2,
      color: colors[Math.floor(Math.random()*colors.length)],
      alpha: 1
    });
  }
  const start = performance.now();
  function frame(t){
    const dt = 16/1000; // approx
    ctx.clearRect(0,0,c.width,c.height);
    for(const p of parts){
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.alpha = Math.max(0, 1 - (t-start)/durationMs);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }
    if(t - start < durationMs){
      requestAnimationFrame(frame);
    } else {
      window.removeEventListener('resize', onResize);
      c.remove();
    }
  }
  requestAnimationFrame(frame);
}

// --- SFX & message pop helpers ---
function pulseMessage(text){
  message.textContent = text;
  message.classList.remove('pop');
  // Force reflow to restart animation
  void message.offsetWidth;
  message.classList.add('pop');
}

const winTone = (()=>{
  let ctx; let playing=false;
  return ()=>{
    if(!sfxEnabled || playing) return;
    playing = true;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const freqs=[587.33, 739.99, 880.00]; // D5 F#5 A5
    freqs.forEach((f,i)=>{
      const o=ctx.createOscillator();
      const g=ctx.createGain();
      o.type='sine'; o.frequency.value=f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.16, now+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now+0.32+i*0.03);
      o.connect(g).connect(ctx.destination);
      o.start(now+i*0.01);
      o.stop(now+0.5+i*0.03);
    });
    setTimeout(()=> playing=false, 600);
  };
})();

const missTone = (()=>{
  let ctx; let playing=false;
  return ()=>{
    if(!sfxEnabled || playing) return;
    playing=true;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.type='sine'; o.frequency.value=220; // A3
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.25);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now+0.3);
    setTimeout(()=> playing=false, 350);
  };
})();

if(sfxToggleBtn){
  sfxToggleBtn.addEventListener('click', ()=>{
    sfxEnabled = !sfxEnabled;
    sfxToggleBtn.setAttribute('aria-pressed', String(sfxEnabled));
    sfxToggleBtn.textContent = sfxEnabled ? '🔊' : '🔇';
  });
}
