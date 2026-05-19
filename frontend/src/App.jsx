import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  // --- STATE ---
  const [inputId, setInputId] = useState(""); 
  const [gameId, setGameId] = useState("");
  const [gameState, setGameState] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [socket, setSocket] = useState(null);
  const [mySelection, setMySelection] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("menu");
  const [transitionStage, setTransitionStage] = useState("ready"); 
  const [myName, setMyName] = useState("");
  const [opponentName, setOpponentName] = useState("Waiting...");
  const [showRoundSplash, setShowRoundSplash] = useState(false);
  const [hasGameStarted, setHasGameStarted] = useState(false);

  const SERVER_IP = "192.168.1.7";
  const API_BASE = `http://${SERVER_IP}:8000`;
  const WS_BASE = `ws://${SERVER_IP}:8000`;

  // --- TRANSITION ENGINE ---
 const navigateTo = (screen) => {
    if (currentScreen !== "board" || screen === "menu") {
      setTransitionStage("active");
      setTimeout(() => { setCurrentScreen(screen); }, 800);
      setTimeout(() => { setTransitionStage("exit"); }, 1800);
      setTimeout(() => { setTransitionStage("ready"); }, 2600);
    } else {
      setCurrentScreen(screen);
    }
  };

  // --- UTILS ---
  const copyId = () => {
  console.log("Attempting to copy ID:", gameId);
  
  if (!gameId) {
    alert("No code found to copy!");
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(gameId)
      .then(() => {
        alert("Code Copied: " + gameId);
      })
      .catch((err) => {
        console.error("Clipboard API failed, trying fallback...", err);
        fallbackCopy(gameId);
      });
  } else {

    fallbackCopy(gameId);
  }
};

const fallbackCopy = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) alert("Code Copied (Fallback): " + text);
  } catch (err) {
    console.error('Fallback copy failed', err);
  }
  
  document.body.removeChild(textArea);
};
useEffect(() => {
    if (gameState?.round && currentScreen === "board") {
      setShowRoundSplash(true);
      const timer = setTimeout(() => {
        setShowRoundSplash(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [gameState?.round, currentScreen]);
  
 const connectWebSocket = (id) => {
    const ws = new WebSocket(`${WS_BASE}/ws/${id}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "update") {
        setGameState(data);
        if (data.reset_selection) setMySelection(null);

        if (data.players) {
          const oppKey = playerColor === "RED" ? "BLUE" : "RED";
          if (data.players[oppKey]) setOpponentName(data.players[oppKey]);
        }

        // ONLY trigger the heavy navigateTo once to move from Waiting -> Board
        if (data.status === "in_progress" && currentScreen !== "board") {
          navigateTo("board"); 
        }
        
        // Note: We do NOT call navigateTo here for round updates. 
        // The Round Splash useEffect handles the animation instead.
      }
    };
    setSocket(ws);
  };

  // --- CORE GAME FLOW ---
  const handleStartCreate = () => {
    setPlayerColor("RED");
    navigateTo("char_create");
  };

  const handleStartJoin = () => {
    if (!inputId.trim()) return alert("Enter a code first!");
    setPlayerColor("BLUE");
    navigateTo("char_create");
  };

  const finalizeConnection = async () => {
    if (!myName.trim()) return alert("Enter a nickname!");

    try {
      if (playerColor === "RED") {
        const res = await fetch(`${API_BASE}/game/create?nickname=${encodeURIComponent(myName)}`, { method: "POST" });
        const data = await res.json();
        setGameId(data.game_id.toUpperCase());
        connectWebSocket(data.game_id.toUpperCase());
        navigateTo("waiting_room");
      } else {
        const idToJoin = inputId.trim().toUpperCase();
        const res = await fetch(`${API_BASE}/game/join/${idToJoin}?nickname=${encodeURIComponent(myName)}`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setGameId(idToJoin);
          connectWebSocket(idToJoin);
          navigateTo("board");
        } else {
          alert("Game full or not found!");
          navigateTo("menu");
        }
      }
    } catch (err) { console.error(err); }
  };

  const makeMove = async (choice) => {
    if (mySelection) return;
    setMySelection(choice);
    await fetch(`${API_BASE}/game/move/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: playerColor, choice }),
    });
  };

  return (
    <div className="app-container">
      <div className={`transition-overlay stage-${transitionStage}`} />


      {currentScreen === "menu" && (
        <div className="setup-view">
    <div className="title-container">
      <div className="main-title-line">
        <span className="red-text-anim">Red</span> 
        <span className="and-text-anim"> & </span> 
        <span className="blue-text-anim">Blue</span>
      </div>
      <div className="sub-title-line">Game</div>
            
          </div>
          <div className="menu-actions">
            <button className="main-btn" onClick={handleStartCreate}>CREATE GAME</button>
            <div className="join-group">
              <input value={inputId} onChange={(e) => setInputId(e.target.value.toUpperCase())} placeholder="CODE" />
              <button className="main-btn" onClick={handleStartJoin}>JOIN</button>
            </div>
          </div>
        </div>
      )}

      {currentScreen === "char_create" && (
        <div className="setup-view">
          <div className="title-container" style={{fontSize: '8vh'}}>Identity</div>
          <div className="menu-actions">
            <input 
              placeholder="Enter Nickname..." 
              className="char-input"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              autoFocus
            />
            <button className="main-btn" onClick={finalizeConnection}>CONFIRM</button>
          </div>
        </div>
      )}

      {currentScreen === "waiting_room" && (
        <div className="setup-view">
          <div className="id-display-card">
            <span className="label">GAME ID</span>
            <code className="game-id-text">{gameId}</code>
            <button className="main-btn" onClick={copyId}>COPY CODE</button>
          </div>
          <div className="loading-spinner"></div>
          <p className="pulse-text">Waiting for opponent...</p>
        </div>
      )}

      {currentScreen === "board" && (
        <div className={`game-hud ${showRoundSplash ? 'dimmed' : ''}`}>
          <div className="corner-avatar top-left">
            <div className="avatar-content">
              <span className="label">YOU</span>
              <span className="name">{myName}</span>
            </div>
          </div>
          <div className="corner-avatar bottom-right">
            <div className="avatar-content-reversed">
              <span className="label">OPPONENT</span>
              <span className="name">{opponentName}</span>
            </div>
          </div>

          <div className="flip-scoreboard">
            <div className="flip-card red"><div className="flip-inner" key={gameState?.score?.RED}>{gameState?.score?.RED || 0}</div></div>
            <div className="score-divider">:</div>
            <div className="flip-card blue"><div className="flip-inner" key={gameState?.score?.BLUE}>{gameState?.score?.BLUE || 0}</div></div>
          </div>

          <div className="choice-circle-container">
            <button className="circle-half left red" onClick={() => makeMove("RED")} disabled={!!mySelection}><span>RED</span></button>
            <button className="circle-half right blue" onClick={() => makeMove("BLUE")} disabled={!!mySelection}><span>BLUE</span></button>
          </div>
          <div className="choice-circle-container">
  <button 
    className={`circle-half left red ${mySelection === 'RED' ? 'locked' : ''} ${mySelection && mySelection !== 'RED' ? 'dimmed' : ''}`} 
    onClick={() => makeMove("RED")}
    disabled={!!mySelection}
  >
    <span>{mySelection === 'RED' ? 'LOCKED' : 'RED'}</span>
  </button>
  
  <button 
    className={`circle-half right blue ${mySelection === 'BLUE' ? 'locked' : ''} ${mySelection && mySelection !== 'BLUE' ? 'dimmed' : ''}`} 
    onClick={() => makeMove("BLUE")}
    disabled={!!mySelection}
  >
    <span>{mySelection === 'BLUE' ? 'LOCKED' : 'BLUE'}</span>
  </button>
</div>

          {showRoundSplash && (
  <div className="round-overlay-container">
    <div className="round-content-box">
      <h2 className="round-title">ROUND {gameState?.round}</h2>
      {gameState?.double_points && (
        <div className="double-points-badge">
          DOUBLE POINTS!
        </div>
      )}
    </div>
  </div>
)}
        </div>
      )}
    </div>
  )
}

export default App;