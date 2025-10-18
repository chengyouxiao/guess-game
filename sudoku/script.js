const board = document.getElementById('board');
const message = document.getElementById('message');
const difficultySel = document.getElementById('difficulty');
const newGameBtn = document.getElementById('newGameBtn');
const checkBtn = document.getElementById('checkBtn');

let cells = [];
let given = new Set(); // indices that are fixed
let selectedIndex = -1;

// Simple puzzle bank (0=empty, use '.' for blanks)
// Each difficulty: array of strings length 81
const puzzles = {
  low: [
    // Easy puzzle
    '53..7....6..195....98....6.8...6...34..8.3..17...2...6....28....419..5....8..79',
    '1.3.5.7.9.7..3..5.5.9.1.3.9.1.7.5.1.5.9.3.7.3.7.1.9.2.4.6.8.8.6.4.2.5.3.1.7.9.5.3',
  ],
  medium: [
    '6..874..2..4..5....3.2....1.2..5..8....9....7..8..4.9....3.5....1..2..5..684..3',
    '.2.6.8..3..3..2..8.8..3..2..7.9..1..1..5..7..4..6.3..3..2..7.7..8..5..5.1.7..4.',
  ],
  high: [
    '.....7..1..8..9.....4..2..9..5.....5..1..3..6.....8..2..6..4.....1..2..8..9.....',
    '...2...6.6.....1...1...8...3..6..4.....9.....9..2..7...4...1...8.....9.2...3...',
  ]
};

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
  const list = puzzles[diff] || puzzles.medium;
  const pick = list[Math.floor(Math.random()*list.length)];
  setFromString(pick);
  message.textContent = `New ${diff} puzzle loaded.`;
}

function setFromString(s){
  // s length 81; digits 1-9 or '.'
  given.clear();
  selectedIndex = -1;
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
}

function selectCell(i){
  if(i<0 || i>=81) return;
  if(given.has(i)) { selectedIndex = -1; return; }
  cells.forEach(c=> c.classList.remove('active'));
  cells[i].classList.add('active');
  selectedIndex = i;
}

function onCellKey(e, i){
  if(e.key === 'Enter' || e.key === ' '){
    e.preventDefault(); selectCell(i); return;
  }
  if(selectedIndex !== i) return;
  if(given.has(i)) return;
  if(/^[1-9]$/.test(e.key)){
    setCell(i, e.key);
    checkConflicts();
  } else if(e.key === 'Backspace' || e.key === 'Delete' || e.key === '0'){
    setCell(i, '');
    checkConflicts();
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
  if(!isComplete()){ message.textContent = 'Looks good so far. Not complete yet.'; return; }
  message.textContent = 'Great job! Puzzle solved (no conflicts and full).';
}

function onNewGame(){
  const diff = difficultySel.value || 'medium';
  createBoard();
  loadPuzzle(diff);
}

document.addEventListener('DOMContentLoaded', () => {
  createBoard();
  loadPuzzle('medium');
});

newGameBtn.addEventListener('click', onNewGame);
checkBtn.addEventListener('click', onCheck);

// Allow typing numbers when a cell is selected
document.addEventListener('keydown', (e)=>{
  if(selectedIndex < 0) return;
  onCellKey(e, selectedIndex);
});
