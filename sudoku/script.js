const board = document.getElementById('board');
const message = document.getElementById('message');
const difficultySel = document.getElementById('difficulty');
const newGameBtn = document.getElementById('newGameBtn');
const checkBtn = document.getElementById('checkBtn');
const keypad = document.getElementById('keypad');
const notesToggleBtn = document.getElementById('notesToggle');
const autoCheckEl = document.getElementById('autoCheck');
const hintBtn = document.getElementById('hintBtn');
const timerEl = document.getElementById('timer');
const sfxToggleBtn = document.getElementById('sfxToggle');
const pauseBtn = document.getElementById('pauseBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsDrawer = document.getElementById('settingsDrawer');
const closeSettingsBtn = document.getElementById('closeSettings');
const prefSameNumberEl = document.getElementById('prefSameNumber');
const prefRowColBoxEl = document.getElementById('prefRowColBox');
const prefSmartNotesEl = document.getElementById('prefSmartNotes');

let cells = [];
let given = new Set(); // indices that are fixed
let selectedIndex = -1;
let currentSolution = null; // 81-char string for the loaded puzzle
let notesMode = false; // when true, inputs add/remove pencil marks
let notes = Array.from({length:81}, ()=> new Set());
let autoCheck = false;
let timerId = null;
let startTime = 0; // epoch ms
let elapsedMs = 0; // accumulated when paused
let sfxEnabled = true;
let prefSameNumber = false;
let prefRowColBox = true;
let prefSmartNotes = false;
let solved = false;
let paused = false;

// Optional curated bank retained as fallback if generation fails quickly
const curatedBank = {
  low: [
    { puzzle: '53..7....6..195....98....6.8...6...34..8.3..17...2...6....28....419..5....8..79', solution:'534678912672195348198342567859761423342589671713924856961537284287419635425863179' },
    { puzzle: '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......', solution:'417369825239845761865271943521736498974582136368914257192653874586427319743198652' }
  ],
  medium: [
    { puzzle: '..9748...7...........2.1.9..1.9..3.8....8.2....7.3..6.4..3.6.9...........5...2..', solution:'619748235724935861853261497195674328346582719278319654432156978961827543587493126' },
    { puzzle: '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....', solution:'523416789894257631167398245942581376718639524356742918481975362679123854235864197' }
  ],
  high: [
    { puzzle: '8...........36....7..9.2...5...7.......457....1...3...1....68..85...1..9....4..', solution:'812753649945861327376492185537289461268145793149376852123974568684523971795618234' },
    { puzzle: '1..9.7..3.8...6...9..3.....2..1.9..7.....2.....7..3.4.....8..6...2...9.5..6.3..1', solution:'126947853583216479974385162231594687498672531765831294319758246642123795857469312' }
  ]
};

// --- Solver helpers ---
const DIGITS = ['1','2','3','4','5','6','7','8','9'];
function cloneBoardStrToArr(str){ return (str || '.'.repeat(81)).split(''); }
function boardArrToStr(arr){ return arr.join(''); }
function row(i){ return Math.floor(i/9); }
function col(i){ return i%9; }
function boxStartIdx(i){ return (Math.floor(row(i)/3)*3)*9 + Math.floor(col(i)/3)*3; }
function canPlace(arr, idx, ch){
  const r = row(idx), c = col(idx);
  // row
  for(let j=r*9;j<r*9+9;j++){ if(arr[j]===ch) return false; }
  // col
  for(let j=c;j<81;j+=9){ if(arr[j]===ch) return false; }
  // box
  const bs = boxStartIdx(idx);
  for(let dr=0;dr<3;dr++){
    for(let dc=0;dc<3;dc++){
      const j = bs + dr*9 + dc;
      if(arr[j]===ch) return false;
    }
  }
  return true;
}
function findNextIdxMRV(arr){
  let bestIdx = -1; let bestCount = 10; let bestCands = null;
  for(let i=0;i<81;i++){
    if(arr[i]!=='.') continue;
    const cands = [];
    for(const d of DIGITS){ if(canPlace(arr, i, d)) cands.push(d); }
    if(cands.length===0) return {idx:i, cands:[]};
    if(cands.length < bestCount){ bestCount = cands.length; bestIdx=i; bestCands=cands; if(bestCount===1) break; }
  }
  return {idx: bestIdx, cands: bestCands};
}
function shuffleInPlace(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

// Count solutions up to a limit; optionally return one solution
function solveCount(arr, limit=2, randomize=true, outSolution=null){
  if(limit<=0) return 0;
  // find next empty via MRV
  const {idx, cands} = findNextIdxMRV(arr);
  if(idx===-1){ // solved
    if(outSolution){ for(let i=0;i<81;i++) outSolution[i]=arr[i]; }
    return 1;
  }
  const order = cands ? [...cands] : [];
  if(randomize) shuffleInPlace(order);
  let count = 0;
  for(const d of order){
    if(!canPlace(arr, idx, d)) continue; // guard even though cands checks
    arr[idx]=d;
    count += solveCount(arr, limit - count, randomize, outSolution);
    if(count>=limit){ arr[idx]='.'; return count; }
    arr[idx]='.';
  }
  return count;
}

function solveOne(str, randomize=true){
  const arr = cloneBoardStrToArr(str);
  const out = new Array(81).fill('.');
  const cnt = solveCount(arr, 1, randomize, out);
  return cnt===1 ? boardArrToStr(out) : null;
}

// Generate a full solved board
function generateFullSolution(){
  const empty = '.'.repeat(81);
  const arr = cloneBoardStrToArr(empty);
  const out = new Array(81).fill('.');
  // seed: place a few random digits to diversify
  const seedPositions = shuffleInPlace([...Array(81).keys()]).slice(0, 8);
  for(const i of seedPositions){
    const digits = shuffleInPlace([...DIGITS]);
    for(const d of digits){ if(canPlace(arr, i, d)){ arr[i]=d; break; } }
  }
  const cnt = solveCount(arr, 1, true, out);
  if(cnt!==1) return generateFullSolution();
  return boardArrToStr(out);
}

function generatePuzzleUnique(difficulty){
  const targets = { low: 40, medium: 32, high: 26 };
  const targetClues = targets[difficulty] || targets.medium;
  const solution = generateFullSolution();
  let puzzleArr = solution.split('');
  // positions for symmetric removal
  const positions = shuffleInPlace([...Array(81).keys()]);
  const startClues = 81;
  let clues = startClues;
  const timeStart = Date.now();
  const timeBudgetMs = 2000; // 2s budget
  for(const pos of positions){
    if(clues <= targetClues) break;
    if(Date.now() - timeStart > timeBudgetMs) break;
    const mirror = 80 - pos;
    const toRemove = mirror === pos ? [pos] : [pos, mirror];
    const backup = toRemove.map(i => puzzleArr[i]);
    // remove
    toRemove.forEach(i => { puzzleArr[i]='.'; });
    const testArr = [...puzzleArr];
    const count = solveCount(testArr, 2, false, null);
    if(count !== 1){
      // revert
      toRemove.forEach((i, k) => { puzzleArr[i] = backup[k]; });
    } else {
      clues -= toRemove.length;
      if(clues < targetClues) clues = targetClues; // clamp
    }
  }
  return { puzzle: boardArrToStr(puzzleArr), solution };
}

function createBoard(){
  board.innerHTML = '';
  cells = [];
  const frag = document.createDocumentFragment();
  for(let i=0;i<81;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role','button');
    cell.setAttribute('tabindex','0');
    cell.dataset.index = i;
    cell.addEventListener('click', ()=> selectCell(i));
    cell.addEventListener('keydown', (e)=> onCellKey(e, i));
    cells.push(cell);
    frag.appendChild(cell);
  }
  board.appendChild(frag);
}

function loadPuzzle(diff){
  // Prefer generated puzzle; fall back to curated if generation overruns time budget or fails
  try {
    const { puzzle, solution } = generatePuzzleUnique(diff);
    currentSolution = solution;
    setFromString(puzzle);
    message.textContent = `New ${diff} puzzle generated.`;
  } catch (e) {
    const list = curatedBank[diff] || curatedBank.medium;
    const pick = list[Math.floor(Math.random()*list.length)];
    currentSolution = pick.solution;
    setFromString(pick.puzzle);
    message.textContent = `New ${diff} puzzle loaded.`;
  }
}

function setFromString(s){
  // s length 81; digits 1-9 or '.'
  given.clear();
  selectedIndex = -1;
  notes = Array.from({length:81}, ()=> new Set());
  for(let i=0;i<81;i++){
    const ch = s[i] || '.';
    setCell(i, ch === '.' ? '' : ch, ch !== '.');
  }
}

function setCell(i, val, isGiven=false){
  const c = cells[i];
  c.textContent = val;
  c.classList.toggle('given', !!isGiven);
  c.classList.remove('conflict');
  if(isGiven){ given.add(i); }
  else { given.delete(i); }
  if(!val){ renderNotes(i); }
}

function selectCell(i){
  if(i<0 || i>=81) return;
  if(given.has(i)) { selectedIndex = -1; return; }
  cells.forEach(c=> c.classList.remove('active'));
  cells[i].classList.add('active');
  selectedIndex = i;
  applyHighlights(i);
  applySameNumberHighlight(i);
}

function onCellKey(e, i){
  if(e.key === 'Enter' || e.key === ' '){
    e.preventDefault(); selectCell(i); return;
  }
  if(selectedIndex !== i) return;
  if(given.has(i)) return;
  if(/^[1-9]$/.test(e.key)){
    handleInput(i, e.key);
  } else if(e.key === 'Backspace' || e.key === 'Delete' || e.key === '0'){
    handleInput(i, '0');
  } else if(e.key.toLowerCase() === 'n'){
    toggleNotes();
  }
}

function getRow(i){ return Math.floor(i/9); }
function getCol(i){ return i%9; }
function getBoxIndex(i){ return Math.floor(getRow(i)/3)*3 + Math.floor(getCol(i)/3); }

function checkConflicts(){
  // Clear
  cells.forEach(c=> c.classList.remove('conflict'));
  let hasConflict = false;
  // Rows
  for(let r=0;r<9;r++){
    const seen = {};
    for(let c=0;c<9;c++){
      const idx = r*9+c;
      const v = cells[idx].textContent;
      if(!v) continue;
      if(seen[v]){ cells[idx].classList.add('conflict'); cells[seen[v]-1].classList.add('conflict'); hasConflict = true; }
      else { seen[v] = idx+1; }
    }
  }
  // Cols
  for(let c=0;c<9;c++){
    const seen = {};
    for(let r=0;r<9;r++){
      const idx = r*9+c;
      const v = cells[idx].textContent;
      if(!v) continue;
      if(seen[v]){ cells[idx].classList.add('conflict'); cells[seen[v]-1].classList.add('conflict'); hasConflict = true; }
      else { seen[v] = idx+1; }
    }
  }
  // Boxes
  for(let br=0;br<3;br++){
    for(let bc=0;bc<3;bc++){
      const seen = {};
      for(let r=0;r<3;r++){
        for(let c=0;c<3;c++){
          const rr = br*3 + r; const cc = bc*3 + c;
          const idx = rr*9 + cc;
          const v = cells[idx].textContent;
          if(!v) continue;
          if(seen[v]){ cells[idx].classList.add('conflict'); cells[seen[v]-1].classList.add('conflict'); hasConflict = true; }
          else { seen[v] = idx+1; }
        }
      }
    }
  }
  return !hasConflict;
}

function isComplete(){
  for(const c of cells){ if(!c.textContent) return false; }
  return true;
}

function onCheck(){
  const ok = checkConflicts();
  if(!ok){ message.textContent = 'There are conflicts. Keep trying!'; return; }
  // If we have a known solution, mark any incorrect entries immediately
  if(currentSolution){
    let anyWrong = false;
    for(let i=0;i<81;i++){
      const v = cells[i].textContent;
      if(!v) continue;
      if(v !== currentSolution[i]){ cells[i].classList.add('conflict'); anyWrong = true; }
    }
    if(anyWrong){ message.textContent = 'Some numbers don\'t match the solution.'; return; }
  }
  if(!isComplete()){ message.textContent = 'Looks good so far. Not complete yet.'; return; }
  celebrateSolved();
}

function onNewGame(){
  const diff = difficultySel.value || 'medium';
  solved = false;
  paused = false;
  createBoard();
  loadPuzzle(diff);
  startTimer(true);
  saveState();
}

document.addEventListener('DOMContentLoaded', () => {
  if(!restoreState()){
    createBoard();
    loadPuzzle('medium');
    startTimer(true);
    saveState();
  }
});

newGameBtn.addEventListener('click', onNewGame);
checkBtn.addEventListener('click', onCheck);

// Allow typing numbers when a cell is selected
document.addEventListener('keydown', (e)=>{
  if(selectedIndex < 0) return;
  onCellKey(e, selectedIndex);
});

// --- Timer and best times ---
function formatTime(ms){
  const total = Math.floor(ms/1000);
  const m = Math.floor(total/60);
  const s = total%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function tick(){
  const now = Date.now();
  const ms = (now - startTime) + elapsedMs;
  timerEl.textContent = formatTime(ms);
}
function startTimer(reset=false){
  if(reset){ elapsedMs = 0; }
  startTime = Date.now();
  if(timerId) clearInterval(timerId);
  timerId = setInterval(tick, 1000);
  tick();
}
function stopTimer(final=false){
  if(timerId){ clearInterval(timerId); timerId=null; }
  if(final){
    const now = Date.now();
    elapsedMs += (now - startTime);
  }
}
function updateBestTime(){
  const diff = difficultySel.value || 'medium';
  const key = `sudoku_best_${diff}`;
  const totalMs = elapsedMs;
  const prev = Number(localStorage.getItem(key) || '0');
  if(!prev || totalMs < prev){
    localStorage.setItem(key, String(totalMs));
    message.textContent += ` New best for ${diff}: ${formatTime(totalMs)}.`;
  }
}

// --- Persistence ---
function saveState(){
  const diff = difficultySel.value || 'medium';
  const state = {
    diff,
    puzzle: getCurrentPuzzleString(),
    solution: currentSolution,
    given: Array.from(given),
    entries: cells.map(c=> c.textContent || ''),
    notes: notes.map(set=> Array.from(set)),
    autoCheck,
    notesMode,
    prefSameNumber,
    prefRowColBox,
    prefSmartNotes,
    elapsedMs: (timerId ? (Date.now()-startTime)+elapsedMs : elapsedMs)
  };
  localStorage.setItem('sudoku_state', JSON.stringify(state));
}
function clearSavedState(){ localStorage.removeItem('sudoku_state'); }
function restoreState(){
  const raw = localStorage.getItem('sudoku_state');
  if(!raw) return false;
  try{
    const st = JSON.parse(raw);
    if(!st || !st.puzzle || !st.solution) return false;
  solved = false;
  paused = false;
    difficultySel.value = st.diff || 'medium';
    currentSolution = st.solution;
    createBoard();
    setFromString(st.puzzle);
    // restore givens explicitly
    given = new Set(st.given || []);
    for(const i of given){ cells[i].classList.add('given'); }
    // restore entries and notes
    notes = Array.from({length:81}, ()=> new Set());
    for(let i=0;i<81;i++){
      const v = (st.entries && st.entries[i]) || '';
      if(v && !given.has(i)) setCell(i, v);
      const ns = (st.notes && st.notes[i]) || [];
      notes[i] = new Set(ns);
      renderNotes(i);
    }
    autoCheck = !!st.autoCheck; autoCheckEl.checked = autoCheck;
    notesMode = !!st.notesMode; notesToggleBtn.setAttribute('aria-pressed', String(notesMode)); notesToggleBtn.textContent = `Notes: ${notesMode ? 'On':'Off'}`;
  prefSameNumber = !!st.prefSameNumber; if(prefSameNumberEl) prefSameNumberEl.checked = prefSameNumber;
  const hasRowColBox = st.prefRowColBox !== undefined ? !!st.prefRowColBox : true; prefRowColBox = hasRowColBox; if(prefRowColBoxEl) prefRowColBoxEl.checked = prefRowColBox;
  prefSmartNotes = !!st.prefSmartNotes; if(prefSmartNotesEl) prefSmartNotesEl.checked = prefSmartNotes;
    elapsedMs = Number(st.elapsedMs||0);
  startTimer(false);
  pulseMessage('Restored previous game.');
    return true;
  }catch{}
  return false;
}

function getCurrentPuzzleString(){
  // Build puzzle string using givens from current board: given cells show number, others '.'
  let s = '';
  for(let i=0;i<81;i++){
    s += given.has(i) ? (cells[i].textContent||'.') : '.';
  }
  return s;
}

// --- Pause/Resume ---
function setPaused(state){
  if(solved) return;
  if(state && !paused){
    paused = true;
    stopTimer(true); // accumulate elapsed up to now
    if(pauseBtn){ pauseBtn.textContent = '▶️ Resume'; }
    pulseMessage('Paused. Move to resume.');
  } else if(!state && paused){
    paused = false;
    startTimer(false); // continue counting
    if(pauseBtn){ pauseBtn.textContent = '⏸️ Pause'; }
    pulseMessage('Resumed.');
  }
}

if(pauseBtn){
  pauseBtn.addEventListener('click', ()=> setPaused(!paused));
}

// Auto-resume only on meaningful input
// 1) Clicking a cell or any control button resumes
document.addEventListener('click', (e)=>{
  if(!paused) return;
  // Don't immediately resume due to the same click that just paused
  if(e.target && e.target.closest && e.target.closest('#pauseBtn')) return;
  const el = e.target;
  const isCell = el.classList && el.classList.contains('cell');
  const isButton = el.tagName === 'BUTTON' || el.closest('button');
  if(isCell || isButton){ setPaused(false); }
}, { passive: true });

// 2) Number key input resumes when a cell is selected
document.addEventListener('keydown', (e)=>{
  if(!paused) return;
  if(selectedIndex < 0) return;
  if(/^[1-9]$/.test(e.key) || e.key === '0' || e.key === 'Backspace' || e.key === 'Delete'){
    setPaused(false);
  }
});

// Settings drawer behavior
if(settingsBtn && settingsDrawer){
  settingsBtn.addEventListener('click', ()=>{ settingsDrawer.setAttribute('aria-hidden','false'); });
}
if(closeSettingsBtn && settingsDrawer){
  closeSettingsBtn.addEventListener('click', ()=>{ settingsDrawer.setAttribute('aria-hidden','true'); saveState(); });
  settingsDrawer.addEventListener('click', (e)=>{ if(e.target === settingsDrawer){ settingsDrawer.setAttribute('aria-hidden','true'); saveState(); } });
}

if(prefSameNumberEl){
  prefSameNumberEl.addEventListener('change', ()=>{ prefSameNumber = prefSameNumberEl.checked; if(selectedIndex>=0) applySameNumberHighlight(selectedIndex); saveState(); });
}
if(prefRowColBoxEl){
  prefRowColBoxEl.addEventListener('change', ()=>{ prefRowColBox = prefRowColBoxEl.checked; if(selectedIndex>=0) applyHighlights(selectedIndex); saveState(); });
}
if(prefSmartNotesEl){
  prefSmartNotesEl.addEventListener('change', ()=>{ prefSmartNotes = prefSmartNotesEl.checked; saveState(); });
}

// Smart notes prune
function pruneNotesAround(idx, digit){
  const r = Math.floor(idx/9), c = idx%9;
  // row
  for(let i=0;i<9;i++){ const j = r*9+i; if(j!==idx){ notes[j].delete(digit); renderNotes(j); } }
  // col
  for(let i=0;i<9;i++){ const j = i*9+c; if(j!==idx){ notes[j].delete(digit); renderNotes(j); } }
  // box
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let dr=0;dr<3;dr++){
    for(let dc=0;dc<3;dc++){
      const j = (br+dr)*9 + (bc+dc);
      if(j!==idx){ notes[j].delete(digit); renderNotes(j); }
    }
  }
}

// --- Keypad and input handling ---
function handleInput(i, key){
  if(solved) return;
  if(given.has(i)) return;
  if(notesMode){
    if(key==='0') { notes[i].clear(); renderNotes(i); saveState(); return; }
    if(/^[1-9]$/.test(key)){
      if(cells[i].textContent){ setCell(i, ''); }
      const set = notes[i];
      if(set.has(key)) set.delete(key); else set.add(key);
      renderNotes(i);
      if(autoCheck) checkConflicts();
      saveState();
    }
    return;
  }
  if(key==='0'){
    setCell(i, '');
    renderNotes(i);
  } else if(/^[1-9]$/.test(key)){
    setCell(i, key);
    notes[i].clear();
    renderNotes(i);
    if(prefSmartNotes) pruneNotesAround(i, key);
  }
  if(autoCheck) checkConflicts();
  saveState();
  if(selectedIndex>=0) applySameNumberHighlight(selectedIndex);
  if(!solved && currentSolution && isBoardEqualToSolution()){
    celebrateSolved();
  }
}

function renderNotes(i){
  const c = cells[i];
  const set = notes[i];
  // remove existing grid
  const old = c.querySelector('.notes-grid');
  if(old) old.remove();
  if(c.textContent){ c.classList.remove('notes'); return; }
  if(set.size===0){ c.classList.remove('notes'); return; }
  c.classList.add('notes');
  const grid = document.createElement('div');
  grid.className = 'notes-grid';
  for(let d=1; d<=9; d++){
    const span = document.createElement('span');
    span.textContent = set.has(String(d)) ? String(d) : '';
    grid.appendChild(span);
  }
  c.appendChild(grid);
}

if(keypad){
  keypad.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-key]');
    if(!btn) return;
    if(selectedIndex<0) return;
    const k = btn.dataset.key;
    handleInput(selectedIndex, k);
  });
}

function toggleNotes(){
  notesMode = !notesMode;
  notesToggleBtn.setAttribute('aria-pressed', String(notesMode));
  notesToggleBtn.textContent = `Notes: ${notesMode ? 'On' : 'Off'}`;
  saveState();
}
notesToggleBtn.addEventListener('click', toggleNotes);

autoCheckEl.addEventListener('change', ()=>{
  autoCheck = autoCheckEl.checked;
  if(autoCheck) checkConflicts(); else cells.forEach(c=> c.classList.remove('conflict'));
  saveState();
});

// --- Row/Col/Box highlighting ---
function applyHighlights(idx){
  cells.forEach(c=> c.classList.remove('same-row','same-col','same-box'));
  if(!prefRowColBox) return;
  const r = Math.floor(idx/9), c = idx%9;
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let i=0;i<9;i++){
    cells[r*9 + i].classList.add('same-row');
    cells[i*9 + c].classList.add('same-col');
  }
  for(let dr=0; dr<3; dr++){
    for(let dc=0; dc<3; dc++){
      const j = (br+dr)*9 + (bc+dc);
      cells[j].classList.add('same-box');
    }
  }
}

function applySameNumberHighlight(idx){
  cells.forEach(c=> c.classList.remove('same-number'));
  if(!prefSameNumber) return;
  const val = cells[idx].textContent;
  if(!val) return;
  for(let i=0;i<81;i++){
    if(cells[i].textContent === val){ cells[i].classList.add('same-number'); }
  }
}

// --- Hint ---
hintBtn.addEventListener('click', ()=>{
  const idxs = [];
  for(let i=0;i<81;i++){
    if(!given.has(i) && !cells[i].textContent) idxs.push(i);
  }
  if(idxs.length===0){ message.textContent = 'No empty cells to hint.'; return; }
  // Prefer singles by candidates
  let target = -1;
  const arr = readBoardToArr();
  for(const i of idxs){
    const cands = [];
    for(const d of DIGITS){ if(canPlace(arr, i, d)) cands.push(d); }
    if(cands.length===1){ target = i; break; }
  }
  if(target===-1){
    // fallback: random empty
    target = idxs[Math.floor(Math.random()*idxs.length)];
  }
  if(currentSolution){
    const val = currentSolution[target];
    setCell(target, val);
    notes[target].clear();
    renderNotes(target);
    if(prefSmartNotes) pruneNotesAround(target, val);
    if(autoCheck) checkConflicts();
    pulseMessage('Hint used.');
    saveState();
    if(!solved && currentSolution && isBoardEqualToSolution()){
      celebrateSolved();
    }
  }
});

function readBoardToArr(){
  const arr = new Array(81).fill('.');
  for(let i=0;i<81;i++){
    const t = cells[i].textContent;
    arr[i] = t && /^[1-9]$/.test(t) ? t : '.';
  }
  return arr;
}

function isBoardEqualToSolution(){
  if(!currentSolution || currentSolution.length !== 81) return false;
  for(let i=0;i<81;i++){
    if(cells[i].textContent !== currentSolution[i]) return false;
  }
  return true;
}

function celebrateSolved(){
  if(solved) return;
  solved = true;
  pulseMessage('Great job! Puzzle solved!');
  stopTimer(true);
  updateBestTime();
  clearSavedState();
  winTone();
  launchConfetti();
}

// --- Celebration: Lightweight confetti ---
function launchConfetti(durationMs = 1600, particleCount = 180){
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
const winTone = (()=>{
  // Ta‑da: two ascending major chords + a short high ping
  let ctx; let playing = false;
  return ()=>{
    if(!sfxEnabled) return;
    if(playing) return;
    playing = true;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const chord1 = [392.00, 493.88, 587.33];   // G4 B4 D5
    const chord2 = [523.25, 659.25, 783.99];   // C5 E5 G5
    const ping   = 1046.50;                    // C6

    function playChord(freqs, tStart, dur=0.28, detuneCents=4){
      freqs.forEach((f, i)=>{
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        // small detune spread for richness
        o.detune.value = (i-1) * detuneCents;
        g.gain.setValueAtTime(0.0001, tStart);
        g.gain.exponentialRampToValueAtTime(0.2, tStart + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, tStart + dur);
        o.connect(g).connect(ctx.destination);
        o.start(tStart + i*0.005);
        o.stop(tStart + dur + 0.05 + i*0.005);
      });
    }

    function playPing(tStart){
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(ping, tStart);
      g.gain.setValueAtTime(0.0001, tStart);
      g.gain.exponentialRampToValueAtTime(0.22, tStart + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, tStart + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(tStart);
      o.stop(tStart + 0.22);
    }

    const t1 = now;
    const t2 = t1 + 0.24;  // stagger second chord slightly later
    const t3 = t2 + 0.26;  // ping after chords
    playChord(chord1, t1);
    playChord(chord2, t2);
    playPing(t3);

    setTimeout(()=> playing=false, 700);
  };
})();

function pulseMessage(text){
  message.textContent = text;
  message.classList.remove('pop');
  // Force reflow to restart animation
  void message.offsetWidth;
  message.classList.add('pop');
}

// SFX toggle
if(sfxToggleBtn){
  sfxToggleBtn.addEventListener('click', ()=>{
    sfxEnabled = !sfxEnabled;
    sfxToggleBtn.setAttribute('aria-pressed', String(sfxEnabled));
    sfxToggleBtn.textContent = sfxEnabled ? '🔊' : '🔇';
  });
}
