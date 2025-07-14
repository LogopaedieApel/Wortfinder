document.addEventListener('DOMContentLoaded', () => {

  // --- Configuration ---
  const HITS_PER_LEVEL = 10;
  const MIN_WORDS_FOR_GAME = 5;
  const INITIAL_WORDS = 'Apfel, Banane, Kirsche, Weltraum, Tier, Haus, Sonne, Mond, Stern, Blume, Baum, Auto, Straße, Spiel, Spaß';

  // --- State Variables ---
  let gameState = 'setup'; // 'setup', 'running', 'gameOver'
  let gameSettings = {
    mode: 'cloud', // 'cloud' or 'reader'
    wordsShouldMove: true,
    wordCountRange: '5-10', // '2-5', '5-10', '10-15', '15-20'
    wordLifespan: 3000, // in ms
    scrollSpeed: 5, // Range 1-10
  };
  let wordList = [];
  let level = 0;
  let hits = 0;
  let targetWord = '';
  let usedTargetWords = [];
  let spawnedWords = new Map(); // Using Map to easily delete words by id
  let spawnIdCounter = 0;
  let spawnIntervalId = null;
  let isFullscreen = false;

  // --- DOM Elements ---
  const screens = {
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen'),
  };
  const wordInputArea = document.getElementById('word-input-area');
  const errorMessage = document.getElementById('error-message');
  const startGameButton = document.getElementById('start-game-button');
  const quitButton = document.getElementById('quit-button');
  const playAgainButton = document.getElementById('play-again-button');
  
  // Setup Screen Controls
  const gameModeSelector = document.getElementById('game-mode-selector');
  const cloudSettings = document.getElementById('cloud-settings');
  const readerSettings = document.getElementById('reader-settings');
  const wordCountSelector = document.getElementById('word-count-selector');
  const durationSelect = document.getElementById('duration-select');
  const moveToggle = document.getElementById('move-toggle');
  
  // Game Screen Elements
  const gameArea = document.getElementById('game-area');
  const levelDisplay = document.getElementById('level-display');
  const hitsDisplay = document.getElementById('hits-display');
  const cloudTargetWordDisplay = document.getElementById('cloud-target-word-display');
  const readerTrack = document.getElementById('reader-track');
  const readerHudControls = document.getElementById('reader-hud-controls');
  const hudTargetWordReader = document.getElementById('hud-target-word-reader');
  
  // Fullscreen Buttons
  const fullscreenButtonSetup = document.getElementById('fullscreen-button-setup');
  const fullscreenButtonGame = document.getElementById('fullscreen-button-game');

  // --- Initial Setup ---
  wordInputArea.value = INITIAL_WORDS;

  // --- View Management ---
  const updateView = () => {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    if (screens[gameState]) {
      screens[gameState].classList.add('active');
    }
  };
  
  // --- Game Logic ---
  const resetGame = () => {
      level = 0;
      hits = 0;
      targetWord = '';
      usedTargetWords = [];
      spawnedWords.clear();
      clearInterval(spawnIntervalId);
      spawnIntervalId = null;
      gameArea.innerHTML = ''; // Clear leftover words
      readerTrack.innerHTML = '';
      gameState = 'setup';
      updateView();
  };
  
  const startNewLevel = () => {
    const availableWords = wordList.filter(w => !usedTargetWords.includes(w));
    if (availableWords.length === 0) {
      gameState = 'gameOver';
      clearInterval(spawnIntervalId);
      updateView();
      return;
    }
    
    targetWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    usedTargetWords.push(targetWord);
    level++;
    hits = 0;
    
    updateHUD();
    startSpawning();
  };

  const handleStartGame = () => {
    const words = wordInputArea.value.split(/[\n,]+/).map(w => w.trim()).filter(Boolean);
    const uniqueWords = [...new Set(words)];

    if (uniqueWords.length < MIN_WORDS_FOR_GAME) {
      errorMessage.textContent = `Die Liste muss mindestens ${MIN_WORDS_FOR_GAME} verschiedene Wörter enthalten.`;
      errorMessage.style.display = 'block';
      return;
    }
    
    errorMessage.style.display = 'none';
    wordList = uniqueWords;
    gameState = 'running';
    
    // Reset stats for a new game
    level = 0;
    usedTargetWords = [];
    
    updateView();
    startNewLevel();
  };

  const updateHUD = () => {
      levelDisplay.textContent = `Level: ${level}`;
      hitsDisplay.textContent = `Treffer: ${hits} / ${HITS_PER_LEVEL}`;
      
      if (gameSettings.mode === 'cloud') {
          cloudTargetWordDisplay.textContent = targetWord;
          cloudTargetWordDisplay.style.display = 'block';
          readerHudControls.style.display = 'none';
          readerTrack.style.display = 'none';
          gameArea.prepend(cloudTargetWordDisplay);
      } else { // reader
          hudTargetWordReader.textContent = `Finde: ${targetWord}`;
          cloudTargetWordDisplay.style.display = 'none';
          readerHudControls.style.display = 'flex';
          readerTrack.style.display = 'flex';
      }
  };

  // --- Word Spawning & Handling ---

  const startSpawning = () => {
      clearInterval(spawnIntervalId);
      spawnedWords.clear();
      
      const spawnFn = gameSettings.mode === 'cloud' ? spawnWordCloud : spawnWordReader;
      const [min, max] = gameSettings.wordCountRange.split('-').map(Number);
      const targetWordCount = (min + max) / 2;
      const intervalTime = gameSettings.mode === 'cloud' 
        ? Math.max(150, gameSettings.wordLifespan / targetWordCount)
        : Math.random() * 1000 + 1500;
        
      spawnIntervalId = setInterval(spawnFn, intervalTime);
  };
  
  const spawnWordCloud = () => {
    const [min, max] = gameSettings.wordCountRange.split('-').map(Number);
    if(spawnedWords.size >= max) return;

    const isTarget = Math.random() < 0.25;
    const distractors = wordList.filter(w => w !== targetWord);
    if (distractors.length === 0) return;
    const text = isTarget ? targetWord : distractors[Math.floor(Math.random() * distractors.length)];
    
    const id = spawnIdCounter++;
    const wordEl = document.createElement('div');
    wordEl.className = 'spawned-word';
    if(gameSettings.wordsShouldMove) wordEl.classList.add('moving');
    wordEl.textContent = text;
    wordEl.dataset.id = id;
    wordEl.setAttribute('role', 'button');
    wordEl.tabIndex = 0;

    // Position finding logic
    const WORD_BOX_WIDTH = 15, WORD_BOX_HEIGHT = 8, TARGET_WORD_BOX_WIDTH = 40, TARGET_WORD_BOX_HEIGHT = 20;
    const targetRect = { left: 50 - TARGET_WORD_BOX_WIDTH / 2, top: 50 - TARGET_WORD_BOX_HEIGHT / 2, right: 50 + TARGET_WORD_BOX_WIDTH / 2, bottom: 50 + TARGET_WORD_BOX_HEIGHT / 2 };
    const existingRects = Array.from(spawnedWords.values()).map(w => ({ left: w.left, top: w.top, right: w.left + WORD_BOX_WIDTH, bottom: w.top + WORD_BOX_HEIGHT }));

    let attempts = 0;
    while(attempts < 20) {
        attempts++;
        const proposedLeft = Math.random() * (100 - WORD_BOX_WIDTH);
        const proposedTop = Math.random() * (100 - WORD_BOX_HEIGHT);
        const newWordRect = { left: proposedLeft, top: proposedTop, right: proposedLeft + WORD_BOX_WIDTH, bottom: proposedTop + WORD_BOX_HEIGHT };
        const isOverlapping = (rect1, rect2) => !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
        let hasOverlap = isOverlapping(newWordRect, targetRect) || existingRects.some(rect => isOverlapping(newWordRect, rect));

        if (!hasOverlap) {
            wordEl.style.left = `${proposedLeft}%`;
            wordEl.style.top = `${proposedTop}%`;
            spawnedWords.set(id, { text, el: wordEl, left: proposedLeft, top: proposedTop });
            gameArea.appendChild(wordEl);
            setTimeout(() => removeWord(id), gameSettings.wordLifespan);
            return;
        }
    }
  };

  const spawnWordReader = () => {
    const isTarget = Math.random() < 0.25;
    const distractors = wordList.filter(w => w !== targetWord);
    if (distractors.length === 0) return;
    const text = isTarget ? targetWord : distractors[Math.floor(Math.random() * distractors.length)];
    
    const id = spawnIdCounter++;
    const wordEl = document.createElement('div');
    wordEl.className = 'scrolling-word';
    wordEl.textContent = text;
    wordEl.dataset.id = id;
    wordEl.setAttribute('role', 'button');
    wordEl.tabIndex = 0;
    
    const scrollDurationMs = (11 - gameSettings.scrollSpeed) * 1200;
    readerTrack.style.setProperty('--scroll-duration', `${scrollDurationMs / 1000}s`);
    
    spawnedWords.set(id, { text, el: wordEl });
    readerTrack.appendChild(wordEl);
    
    setTimeout(() => removeWord(id), scrollDurationMs);
  };
  
  const removeWord = (id) => {
    const wordData = spawnedWords.get(id);
    if (wordData) {
      wordData.el.remove();
      spawnedWords.delete(id);
    }
  };

  const handleWordClick = (el) => {
    const id = parseInt(el.dataset.id, 10);
    const wordData = spawnedWords.get(id);

    if (!wordData) return;
    
    if (wordData.text === targetWord) {
        el.classList.add('feedback-correct');
        hits++;
        updateHUD();
        if (hits >= HITS_PER_LEVEL) {
          setTimeout(startNewLevel, 500);
        }
    } else {
        el.classList.add('feedback-wrong');
    }

    el.style.pointerEvents = 'none';
    setTimeout(() => removeWord(id), 300);
  };
  
  // --- Speed Controller ---
  const createSpeedController = (containerEl) => {
      const display = containerEl.querySelector('.speed-display');
      const slowerBtn = containerEl.querySelector('[data-action="slower"]');
      const fasterBtn = containerEl.querySelector('[data-action="faster"]');
      
      const update = () => {
        const speed = gameSettings.scrollSpeed;
        display.textContent = speed;
        slowerBtn.disabled = speed <= 1;
        fasterBtn.disabled = speed >= 10;
        if(readerTrack) readerTrack.style.setProperty('--scroll-duration', `${((11 - speed) * 1.2)}s`);
      };

      slowerBtn.addEventListener('click', () => {
        if(gameSettings.scrollSpeed > 1) {
            gameSettings.scrollSpeed--;
            update();
        }
      });
      fasterBtn.addEventListener('click', () => {
        if(gameSettings.scrollSpeed < 10) {
            gameSettings.scrollSpeed++;
            update();
        }
      });
      update(); // Initial state
  };

  createSpeedController(document.getElementById('reader-speed-controller'));
  const inGameSpeedController = createSpeedController(document.getElementById('in-game-speed-controller'));


  // --- Event Listeners ---
  startGameButton.addEventListener('click', handleStartGame);
  quitButton.addEventListener('click', resetGame);
  playAgainButton.addEventListener('click', resetGame);
  
  gameArea.addEventListener('click', (e) => {
    if (e.target.matches('.spawned-word, .scrolling-word')) {
        handleWordClick(e.target);
    }
  });
  gameArea.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.spawned-word, .scrolling-word')) {
        e.preventDefault();
        handleWordClick(e.target);
    }
  });
  
  // Settings listeners
  gameModeSelector.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON') {
        gameSettings.mode = e.target.dataset.mode;
        gameModeSelector.querySelectorAll('button').forEach(btn => {
            const isActive = btn.dataset.mode === gameSettings.mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-checked', isActive);
        });
        cloudSettings.style.display = gameSettings.mode === 'cloud' ? 'flex' : 'none';
        readerSettings.style.display = gameSettings.mode === 'reader' ? 'flex' : 'none';
        if (gameSettings.mode === 'reader') {
            cloudSettings.style.flexDirection = 'column';
            readerSettings.style.flexDirection = 'column';
        }
    }
  });

  wordCountSelector.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON') {
        gameSettings.wordCountRange = e.target.dataset.range;
        wordCountSelector.querySelectorAll('button').forEach(btn => {
            const isActive = btn.dataset.range === gameSettings.wordCountRange;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-checked', isActive);
        });
    }
  });

  durationSelect.addEventListener('change', e => gameSettings.wordLifespan = Number(e.target.value));
  moveToggle.addEventListener('change', e => gameSettings.wordsShouldMove = e.target.checked);

  // Fullscreen Logic
  const checkFullscreenSupport = () => {
      const doc = document.documentElement;
      const isApiAvailable = !!(doc.requestFullscreen || doc.webkitRequestFullscreen || doc.msRequestFullscreen);
      [fullscreenButtonSetup, fullscreenButtonGame].forEach(btn => btn.style.display = isApiAvailable ? 'inline-flex' : 'none');
  };
  
  const toggleFullscreen = () => {
    const element = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (element.requestFullscreen) element.requestFullscreen();
        else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  };

  document.addEventListener('fullscreenchange', () => {
    isFullscreen = !!document.fullscreenElement;
    fullscreenButtonGame.textContent = isFullscreen ? 'Vollbild verlassen' : 'Vollbild';
    fullscreenButtonSetup.style.display = isFullscreen ? 'none' : 'inline-flex';
  });
  document.addEventListener('webkitfullscreenchange', () => {
    isFullscreen = !!document.webkitFullscreenElement;
    fullscreenButtonGame.textContent = isFullscreen ? 'Vollbild verlassen' : 'Vollbild';
    fullscreenButtonSetup.style.display = isFullscreen ? 'none' : 'inline-flex';
  });
  
  fullscreenButtonSetup.addEventListener('click', toggleFullscreen);
  fullscreenButtonGame.addEventListener('click', toggleFullscreen);


  // --- Init ---
  checkFullscreenSupport();
  updateView();
});
