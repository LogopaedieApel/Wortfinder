
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// --- Configuration ---
const HITS_PER_LEVEL = 10;
const MIN_WORDS_FOR_GAME = 5;
const WORD_COUNT_RANGES = ['2-5', '5-10', '10-15', '15-20'];
const DURATION_OPTIONS = [
    { value: 2000, label: '2.0s' },
    { value: 2500, label: '2.5s' },
    { value: 3000, label: '3.0s' },
    { value: 3500, label: '3.5s' },
    { value: 4000, label: '4.0s' },
    { value: 4500, label: '4.5s' },
    { value: 5000, label: '5.0s' }
];
const INITIAL_WORDS = 'Apfel, Banane, Kirsche, Weltraum, Tier, Haus, Sonne, Mond, Stern, Blume, Baum, Auto, Straße, Spiel, Spaß';

// --- Helper Functions ---
const isOverlapping = (rect1, rect2) => {
    return !(rect1.right < rect2.left ||
             rect1.left > rect2.right ||
             rect1.bottom < rect2.top ||
             rect1.top > rect2.bottom);
};

// --- Components ---
const SpeedController = ({ speed, setSpeed, min = 1, max = 10 }) => {
  const handleSlower = () => setSpeed(prev => Math.max(min, prev - 1));
  const handleFaster = () => setSpeed(prev => Math.min(max, prev + 1));

  return (
    <div className="speed-controller">
      <button onClick={handleSlower} disabled={speed <= min} className="speed-button" aria-label="Langsamer">-</button>
      <span className="speed-display" aria-live="polite" aria-atomic="true">{speed}</span>
      <button onClick={handleFaster} disabled={speed >= max} className="speed-button" aria-label="Schneller">+</button>
    </div>
  );
};


const WordHunterGame = () => {
  const [gameState, setGameState] = useState('setup');
  
  const [wordInput, setWordInput] = useState(INITIAL_WORDS);
  const [wordList, setWordList] = useState([]);
  
  const [error, setError] = useState(null);

  // Settings
  const [gameMode, setGameMode] = useState('cloud');
  const [wordsShouldMove, setWordsShouldMove] = useState(true);
  const [wordCountRange, setWordCountRange] = useState('5-10');
  const [wordLifespan, setWordLifespan] = useState(3000);
  const [scrollSpeed, setScrollSpeed] = useState(5); // Range 1-10

  // Fullscreen State
  const [isFullScreenApiAvailable, setIsFullScreenApiAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);


  // Game state
  const [level, setLevel] = useState(0);
  const [hits, setHits] = useState(0);
  const [targetWord, setTargetWord] = useState('');
  const [spawnedWords, setSpawnedWords] = useState([]);
  const [usedTargetWords, setUsedTargetWords] = useState([]);


  const spawnIdCounter = useRef(0);
  
  useEffect(() => {
    const checkSupport = () => {
      const doc = document;
      return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled || doc.mozFullScreenEnabled || doc.msFullscreenEnabled);
    };
    setIsFullScreenApiAvailable(checkSupport());
    const handleFullscreenChange = () => {
        const doc = document;
        setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const element = document.documentElement;
    const doc = document;
    const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    if (!isFs) {
        if (element.requestFullscreen) element.requestFullscreen();
        else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
        else if (element.msRequestFullscreen) element.msRequestFullscreen();
    } else {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
    }
  };

  const backToSetup = () => {
      setGameState('setup');
      setLevel(0);
      setHits(0);
      setTargetWord('');
      setSpawnedWords([]);
      setUsedTargetWords([]);
  };
  
  const startNewLevel = useCallback((words, usedWords) => {
      const availableWords = words.filter(w => !usedWords.includes(w));
      if (availableWords.length === 0) {
        setGameState('gameOver');
        return;
      }
      const newTarget = availableWords[Math.floor(Math.random() * availableWords.length)];
      setTargetWord(newTarget);
      setUsedTargetWords(prev => [...prev, newTarget]);
      setLevel(prev => prev + 1);
      setHits(0);
      setSpawnedWords([]);
  }, []);

  const handleStartGame = () => {
    const words = wordInput.split(/[\n,]+/).map(w => w.trim()).filter(Boolean);
    const uniqueWords = [...new Set(words)];

    if (uniqueWords.length < MIN_WORDS_FOR_GAME) {
        setError(`Die Liste muss mindestens ${MIN_WORDS_FOR_GAME} verschiedene Wörter enthalten.`);
        return;
    }

    setError(null);
    setWordList(uniqueWords);
    setGameState('running');
    startNewLevel(uniqueWords, []);
  };
  
  useEffect(() => {
    if (gameState !== 'running' || gameMode !== 'cloud') return;
    const [minWords, maxWords] = wordCountRange.split('-').map(Number);
    const targetWordCount = (minWords + maxWords) / 2;
    const spawnInterval = Math.max(150, wordLifespan / targetWordCount);
    const spawnWord = () => {
        setSpawnedWords(currentWords => {
            if (currentWords.length >= maxWords) return currentWords;
            const WORD_BOX_WIDTH = 15, WORD_BOX_HEIGHT = 8, TARGET_WORD_BOX_WIDTH = 40, TARGET_WORD_BOX_HEIGHT = 20;
            const targetRect = { left: 50 - TARGET_WORD_BOX_WIDTH / 2, top: 50 - TARGET_WORD_BOX_HEIGHT / 2, right: 50 + TARGET_WORD_BOX_WIDTH / 2, bottom: 50 + TARGET_WORD_BOX_HEIGHT / 2 };
            const existingRects = currentWords.map(word => ({ left: word.left, top: word.top, right: word.left + WORD_BOX_WIDTH, bottom: word.top + WORD_BOX_HEIGHT }));
            let attempts = 0;
            const MAX_ATTEMPTS = 20;
            while (attempts < MAX_ATTEMPTS) {
                attempts++;
                const proposedLeft = Math.random() * (100 - WORD_BOX_WIDTH);
                const proposedTop = Math.random() * (100 - WORD_BOX_HEIGHT);
                const newWordRect = { left: proposedLeft, top: proposedTop, right: proposedLeft + WORD_BOX_WIDTH, bottom: proposedTop + WORD_BOX_HEIGHT };
                let hasOverlap = isOverlapping(newWordRect, targetRect) || existingRects.some(rect => isOverlapping(newWordRect, rect));
                if (!hasOverlap) {
                    const isTarget = Math.random() < 0.25;
                    const distractors = wordList.filter(w => w !== targetWord);
                    if (distractors.length === 0) return currentWords;
                    const text = isTarget ? targetWord : distractors[Math.floor(Math.random() * distractors.length)];
                    const newWord = { id: spawnIdCounter.current++, text, top: proposedTop, left: proposedLeft };
                    setTimeout(() => setSpawnedWords(prev => prev.filter(w => w.id !== newWord.id)), wordLifespan);
                    return [...currentWords, newWord];
                }
            }
            return currentWords;
        });
    };
    const interval = setInterval(spawnWord, spawnInterval);
    return () => clearInterval(interval);
  }, [gameState, gameMode, targetWord, wordList, wordCountRange, wordLifespan]);

  useEffect(() => {
    if (gameState !== 'running' || gameMode !== 'reader') return;
    const scrollDurationMs = (11 - scrollSpeed) * 1200;
    const spawnInterval = Math.random() * 1000 + 1500;
    const spawnWord = () => {
        const isTarget = Math.random() < 0.25;
        const distractors = wordList.filter(w => w !== targetWord);
        if (distractors.length === 0) return;
        const text = isTarget ? targetWord : distractors[Math.floor(Math.random() * distractors.length)];
        const newWord = { id: spawnIdCounter.current++, text };
        setSpawnedWords(currentWords => [...currentWords, newWord]);
        setTimeout(() => setSpawnedWords(prev => prev.filter(w => w.id !== newWord.id)), scrollDurationMs);
    };
    const intervalId = setInterval(spawnWord, spawnInterval);
    return () => clearInterval(intervalId);
  }, [gameState, gameMode, targetWord, wordList, scrollSpeed]);
  
  const handleWordClick = (clickedWord, event) => {
      const element = event.currentTarget;
      if (clickedWord.text === targetWord) {
        element.classList.add('feedback-correct');
        const newHits = hits + 1;
        setHits(newHits);
        if (newHits >= HITS_PER_LEVEL) {
          setTimeout(() => startNewLevel(wordList, [...usedTargetWords, targetWord]), 500);
        }
      } else {
        element.classList.add('feedback-wrong');
      }
      element.style.pointerEvents = 'none';
      setTimeout(() => setSpawnedWords(prev => prev.filter(w => w.id !== clickedWord.id)), 300);
  };
  
  // RENDER LOGIC
  const renderContent = () => {
    switch (gameState) {
      case 'setup':
        return (
          <div className="container">
            <h1>Wort-Jäger: Setup</h1>
            <p>Gib deine Wortliste hier ein. Trenne die Wörter durch Kommas oder Zeilenumbrüche.</p>
            
            <textarea
                className="word-input-area"
                placeholder="Apfel, Banane, Kirsche..."
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                aria-label="Wortliste"
            />

            <div className="settings-box">
                <h2>Einstellungen</h2>
                <div className="setting-item">
                    <label id="game-mode-label">Spielmodus</label>
                    <div className="range-selector" role="radiogroup" aria-labelledby="game-mode-label">
                        <button role="radio" aria-checked={gameMode === 'cloud'} className={`range-button ${gameMode === 'cloud' ? 'active' : ''}`} onClick={() => setGameMode('cloud')}>Wortwolke</button>
                        <button role="radio" aria-checked={gameMode === 'reader'} className={`range-button ${gameMode === 'reader' ? 'active' : ''}`} onClick={() => setGameMode('reader')}>Lesemodus</button>
                    </div>
                </div>
                {gameMode === 'cloud' ? (
                    <>
                        <div className="setting-item">
                            <label id="word-count-label">Wörter auf dem Schirm</label>
                            <div className="range-selector" role="radiogroup" aria-labelledby="word-count-label">
                                {WORD_COUNT_RANGES.map(range => ( <button role="radio" aria-checked={wordCountRange === range} key={range} className={`range-button ${wordCountRange === range ? 'active' : ''}`} onClick={() => setWordCountRange(range)}>{range}</button>))}
                            </div>
                        </div>
                        <div className="setting-item">
                        <label htmlFor="duration-select">Sichtbarkeitsdauer</label>
                        <select id="duration-select" className="settings-select" value={wordLifespan} onChange={(e) => setWordLifespan(Number(e.target.value))}>
                            {DURATION_OPTIONS.map(opt => ( <option key={opt.value} value={opt.value}>{opt.label}</option> ))}
                        </select>
                        </div>
                        <div className="setting-item">
                        <label htmlFor="move-toggle">Wörter animieren</label>
                        <label className="toggle-switch">
                            <input id="move-toggle" type="checkbox" checked={wordsShouldMove} onChange={(e) => setWordsShouldMove(e.target.checked)} />
                            <span className="slider"></span>
                        </label>
                        </div>
                    </>
                ) : (
                    <div className="setting-item">
                        <label>Laufgeschwindigkeit</label>
                        <SpeedController speed={scrollSpeed} setSpeed={setScrollSpeed} />
                    </div>
                )}
            </div>
            <div className="button-group">
                <button className="primary-button" onClick={handleStartGame}>
                  Wortliste verwenden
                </button>
                {isFullScreenApiAvailable && !isFullscreen && (
                    <button onClick={toggleFullscreen} className="secondary-button">
                        Vollbild aktivieren
                    </button>
                )}
            </div>
            {error && <p role="alert" className="error-message">{error}</p>}
          </div>
        );

      case 'running':
        return (
            <>
                <header className="game-header">
                    <div className="game-hud">
                        <div className="game-stats" aria-live="polite">
                            <span>Level: {level}</span>
                            <span>Treffer: {hits} / {HITS_PER_LEVEL}</span>
                        </div>
                        {gameMode === 'reader' && (
                            <div className="in-game-controls">
                                <span className="hud-target-word">Finde: {targetWord}</span>
                                <div className="speed-controller-wrapper"><label>Geschwindigkeit</label><SpeedController speed={scrollSpeed} setSpeed={setScrollSpeed} /></div>
                            </div>
                        )}
                        <div className="hud-actions">
                            <button className="quit-button" onClick={backToSetup}>Beenden</button>
                            {isFullScreenApiAvailable && (
                                <button onClick={toggleFullscreen} className="fullscreen-button" aria-label="Vollbild umschalten">
                                    {isFullscreen ? 'Vollbild verlassen' : 'Vollbild'}
                                </button>
                             )}
                        </div>
                    </div>
                </header>
                <div className="game-area">
                {gameMode === 'cloud' && (
                    <>
                        <div className="target-word-display" aria-live="polite" aria-atomic="true">{targetWord}</div>
                        {spawnedWords.map(word => (
                            <div key={word.id} role="button" tabIndex={0} className={`spawned-word ${wordsShouldMove ? 'moving' : ''}`} style={{ top: `${word.top}%`, left: `${word.left}%`}} onClick={(e) => handleWordClick(word, e)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleWordClick(word, e)}>
                                {word.text}
                            </div>
                        ))}
                    </>
                )}
                {gameMode === 'reader' && (
                    <div className="reader-track" style={{ '--scroll-duration': `${(11 - scrollSpeed) * 1.2}s` }}>
                        {spawnedWords.map(word => ( <div key={word.id} role="button" tabIndex={0} className="scrolling-word" onClick={(e) => handleWordClick(word, e)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleWordClick(word, e)}>{word.text}</div> ))}
                    </div>
                )}
                </div>
            </>
        );
        
      case 'gameOver':
        return (
            <div className="game-over-overlay" role="dialog" aria-labelledby="gameOverHeading">
                <h1 id="gameOverHeading">Spiel vorbei!</h1>
                <p>Du hast alle Wörter der Liste gefunden!</p>
                <button className="primary-button" onClick={backToSetup}>Zurück zum Setup</button>
            </div>
        );
    }
  };

  return <main>{renderContent()}</main>;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <WordHunterGame />
    </React.StrictMode>
  );
}
