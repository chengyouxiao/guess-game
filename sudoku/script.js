const board = document.getElementById('board');

function createGrid(){
  const frag = document.createDocumentFragment();
  for(let i=0;i<81;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.textContent = '';
    cell.addEventListener('click', ()=>{
      cell.classList.toggle('active');
    });
    frag.appendChild(cell);
  }
  board.appendChild(frag);
}

document.addEventListener('DOMContentLoaded', createGrid);
