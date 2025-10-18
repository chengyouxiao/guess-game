const board = document.getElementById('board');
const message = document.getElementById('message');
const difficultySel = document.getElementById('difficulty');
const newGameBtn = document.getElementById('newGameBtn');
const checkBtn = document.getElementById('checkBtn');

let cells = [];
let given = new Set(); // indices that are fixed
let selectedIndex = -1;
let currentSolution = null; // 81-char string for the loaded puzzle

// Curated Sudoku bank with puzzle+solution pairs ('.' = blank)
// Sources: common public examples (e.g., Wikipedia and widely used test sets)
const puzzles = {
  low: [
    {
      puzzle: '53..7....6..195....98....6.8...6...34..8.3..17...2...6....28....419..5....8..79',
      solution:'534678912672195348198342567859761423342589671713924856961537284287419635425863179'
    },
    {
      puzzle: '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
      solution:'417369825239845761865271943521736498974582136368914257192653874586427319743198652'
    }
  ],
  medium: [
    {
      puzzle: '..9748...7...........2.1.9..1.9..3.8....8.2....7.3..6.4..3.6.9...........5...2..',
      solution:'619748235724935861853261497195674328346582719278319654432156978961827543587493126'
    },
    {
      puzzle: '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....',
      solution:'523416789894257631167398245942581376718639524356742918481975362679123854235864197'
    }
  ],
  high: [
    {
      puzzle: '8...........36....7..9.2...5...7.......457....1...3...1....68..85...1..9....4..',
      solution:'812753649945861327376492185537289461268145793149376852123974568684523971795618234'
    },
    {
      puzzle: '1..9.7..3.8...6...9..3.....2..1.9..7.....2.....7..3.4.....8..6...2...9.5..6.3..1',
      solution:'126947853583216479974385162231594687498672531765831294319758246642123795857469312'
    }
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
  currentSolution = pick.solution;
  setFromString(pick.puzzle);
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
  message.textContent = 'Great job! Puzzle solved!';
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
