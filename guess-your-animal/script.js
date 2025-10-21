(function(){
  const animals = [
    { key: 'rat', label: 'Rat', emoji: '🐭' },
    { key: 'ox', label: 'Ox', emoji: '🐮' },
    { key: 'tiger', label: 'Tiger', emoji: '🐯' },
    { key: 'rabbit', label: 'Rabbit', emoji: '🐰' },
    { key: 'dragon', label: 'Dragon', emoji: '🐲' },
    { key: 'snake', label: 'Snake', emoji: '🐍' },
    { key: 'horse', label: 'Horse', emoji: '🐴' },
    { key: 'goat', label: 'Goat', emoji: '🐐' },
    { key: 'monkey', label: 'Monkey', emoji: '🐵' },
    { key: 'rooster', label: 'Rooster', emoji: '🐔' },
    { key: 'dog', label: 'Dog', emoji: '🐶' },
    { key: 'pig', label: 'Pig', emoji: '🐷' }
  ];

  const board = document.getElementById('board');
  const promptEl = document.getElementById('prompt');
  const restartBtn = document.getElementById('restartBtn');
  const levelSel = document.getElementById('level');
  const memorizeSecondsEl = document.getElementById('memorizeSeconds');
  const tada = document.getElementById('tada');

  let target = null; // animal object
  let acceptingClicks = false;
  let flipTimer = null;

  function shuffle(array){
    for(let i=array.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [array[i],array[j]] = [array[j],array[i]];
    }
    return array;
  }

  function createCard(animal){
    const card = document.createElement('button');
    card.className = 'card';
    card.setAttribute('aria-label', animal.label);
    card.dataset.key = animal.key;
    card.innerHTML = `
      <div class="card-inner">
        <div class="face front">
          <div>
            <div style="font-size:44px">${animal.emoji}</div>
            <div><span>${animal.label}</span></div>
          </div>
        </div>
        <div class="face back">Click to guess!</div>
      </div>
    `;
    card.addEventListener('click', ()=> onCardClick(card, animal));
    return card;
  }

  function setPrompt(text){
    promptEl.textContent = text;
  }

  function drawBoard(){
    board.innerHTML = '';
    const order = shuffle(animals.slice());
    order.forEach(a=> board.appendChild(createCard(a)));
  }

  function flipAll(toBack){
    const cards = Array.from(board.querySelectorAll('.card'));
    for(const c of cards){
      c.classList.toggle('flipped', toBack);
    }
  }

  function pickTarget(){
    const idx = Math.floor(Math.random()*animals.length);
    target = animals[idx];
    setPrompt(`Find: ${target.label} ${target.emoji}`);
  }

  function celebrate(){
    try { tada.currentTime = 0; tada.play(); } catch {}
    confettiBurst();
  }

  function confettiBurst(){
    const duration = 1200;
    const end = Date.now() + duration;
    const colors = ['#fde047','#60a5fa','#34d399','#f472b6','#fca5a5'];
    const frame = ()=>{
      const now = Date.now();
      for(let i=0;i<16;i++){
        const piece = document.createElement('div');
        piece.style.position='fixed';
        piece.style.left = Math.random()*100 + 'vw';
        piece.style.top = '-10px';
        piece.style.width='8px'; piece.style.height='12px';
        piece.style.background = colors[Math.floor(Math.random()*colors.length)];
        piece.style.opacity='0.9';
        piece.style.transform = `rotate(${Math.random()*360}deg)`;
        piece.style.transition = 'transform 1.2s linear, top 1.2s linear, opacity 1.2s';
        document.body.appendChild(piece);
        requestAnimationFrame(()=>{
          piece.style.top = '100vh';
          piece.style.transform += ' translateY(100vh)';
          piece.style.opacity = '0';
        });
        setTimeout(()=> piece.remove(), 1300);
      }
      if(now < end) requestAnimationFrame(frame);
    };
    frame();
  }

  function onCardClick(card, animal){
    if(!acceptingClicks) return;
    if(!target) return;
    card.classList.remove('flipped');
    if(animal.key === target.key){
      acceptingClicks = false;
      setPrompt(`Correct! It was ${animal.label} ${animal.emoji}.`);
      celebrate();
      setTimeout(startRound, 1200);
    } else {
      setPrompt(`Try again… Not ${animal.label}.`);
      card.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(0)' },
      ], { duration: 250 });
      setTimeout(()=> card.classList.add('flipped'), 300);
    }
  }

  function startRound(){
    clearTimeout(flipTimer);
    acceptingClicks = false;
    drawBoard();
    const seconds = parseFloat(levelSel.value);
    memorizeSecondsEl.textContent = seconds.toString();
    setPrompt(`Memorize the animals! (${seconds}s)`);
    flipAll(false);
    flipTimer = setTimeout(()=>{
      flipAll(true);
      pickTarget();
      acceptingClicks = true;
    }, seconds * 1000);
  }

  restartBtn.addEventListener('click', startRound);
  levelSel.addEventListener('change', startRound);

  // Initialize defaults (Easy 20s)
  levelSel.value = '20';
  startRound();
})();
