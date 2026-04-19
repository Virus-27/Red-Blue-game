import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [inputId, setInputId] = useState(""); 
  const [gameId, setGameId] = useState("");
  const [gameState, setGameState] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [socket, setSocket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [theme, setTheme] = useState('dark');
  const [mySelection, setMySelection] = useState(null);
  const [winner, setWinner] = useState(null);
  
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Timer logic for chat (Handled by messages from server in professional builds, 
  // but kept here for local sync)
  useEffect(() => {
    let timer;
    if (gameState?.chat_enabled && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [gameState?.chat_enabled, timeLeft]);

  useEffect(() => {
    if (gameState?.chat_enabled) setTimeLeft(60);
  }, [gameState?.chat_enabled]);
const handleWithdraw = async () => {
    if (window.confirm("Are you sure you want to withdraw? You will lose the game.")) {
      try {
        await fetch(`http://0.0.0.0:8000/game/withdraw/${gameId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player: playerColor }),
        });
      } catch (err) {
        console.error("Withdraw error:", err);
      }
    }
  };
  const createGame = async () => {
    try {
      const res = await fetch("http://0.0.0.0:8000/game/create", { method: "POST" });
      const data = await res.json();
      const id = data.game_id.toUpperCase();
      
      // 1. Set the identity first
      setPlayerColor("RED");
      setGameId(id);

      // 2. Connect the "phone line" (WebSocket)
      connectWebSocket(id);
      
      // 3. NOW fetch the state
      const stateRes = await fetch(`http://0.0.0.0:8000/game/state/${id}`);
      const stateData = await stateRes.json();
      setGameState(stateData);
      
    } catch (err) {
      console.error("Create error:", err);
    }
  };

  const joinGame = async () => {
    const idToJoin = inputId.trim().toUpperCase();
    if (!idToJoin) return;

    try {
      const res = await fetch(`http://0.0.0.0:8000/game/join/${idToJoin}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setGameId(idToJoin);
        setPlayerColor(data.color);
        connectWebSocket(idToJoin);
        
        const stateRes = await fetch(`http://0.0.0.0:8000/game/state/${idToJoin}`);
        setGameState(await stateRes.json());
      } else {
        alert("Invalid Game Code. Please check and try again.");
      }
    } catch (err) {
      console.error("Join error:", err);
    }
  };

  const connectWebSocket = (id) => {
    const ws = new WebSocket(`ws://0.0.0.0:8000/ws/${id}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "chat") {
        setChatMessages(prev => [...prev, data]);
      } 
      else if (data.type === "update") {
        setGameState(data);
        
        // --- ADD THIS LOGIC HERE ---
        if (data.reset_selection === true) {
          console.log("New round started - Unlocking buttons");
          setMySelection(null); // This clears the "LOCKED" state
        }
        // ---------------------------
      } 
      else if (data.type === "game_over") {
        setWinner(data.winner);
      }
    };
    setSocket(ws);
  };

  const makeMove = async (choice) => {
    if (mySelection) return; // Prevent double clicking
    setMySelection(choice);
    await fetch(`http://0.0.0.0:8000/game/move/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: playerColor, choice }),
    });
  };

  const sendChat = () => {
    if (msgInput.trim() && socket) {
      socket.send(JSON.stringify({ type: "chat", player: playerColor, text: msgInput }));
      setMsgInput("");
    }
  };

  const castVote = async (vote) => {
    await fetch(`http://0.0.0.0:8000/game/discussion/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: playerColor, vote }),
    });
  };

  const copyId = () => {
    if (!gameId) return;
    navigator.clipboard.writeText(gameId);
    alert("Game ID copied!");
  };

  // --- RENDER LOGIC ---

  if (!gameId) {
    return (
      <div className={`app-container ${theme}-mode`}>
        <header className="navbar">
          <h1 className="title">Red vs Blue</h1>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀ Light Mode' : '🌙 Dark Mode'}
          </button>
        </header>
        <div className="setup-view">
          <button className="main-btn" onClick={createGame}>Create Game</button>
          <div className="or-divider">OR</div>
          <div className="join-group">
            <input 
              value={inputId} 
              onChange={(e) => setInputId(e.target.value.toUpperCase())} 
              placeholder="Enter Game ID" 
            />
            <button onClick={joinGame}>Join</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${theme}-mode`}>
      {/* Game Over Overlay */}
      {winner && (
        <div className="game-over-overlay">
          <div className="winner-card">
            <div className="confetti-container">
              {[...Array(20)].map((_, i) => (
                <div key={i} className={`confetti piece-${i}`}></div>
              ))}
            </div>
            <h1>{winner === "DRAW" ? "IT'S A TIE!" : "GAME OVER"}</h1>
            {gameState?.reason && <p className="reason">{gameState.reason}</p>}
            {winner !== "DRAW" && <h2 className={winner}>{winner} WINS!</h2>}
            <div className="final-scores">
              <p>Final Standings</p>
              <h3>RED {gameState?.score?.RED} — {gameState?.score?.BLUE} BLUE</h3>
            </div>
            <button className="main-btn" onClick={() => window.location.reload()}>
              Play Again
            </button>
          </div>
        </div>
      )}

      <div className="id-corner-toast">
        <span>Room Code: <code>{gameId}</code></span>
        <button className="copy-btn-small" onClick={copyId}>Copy</button>
      </div>

      <header className="navbar">
        <h1 className="title">Red vs Blue</h1>
        <div className="nav-controls">
  <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
    {theme === 'dark' ? '☀' : '🌙'}
  </button>
  <button onClick={() => setShowHistory(!showHistory)}>History</button>
  
  {/* NEW WITHDRAW BUTTON */}
  {gameState?.status === "in_progress" && (
    <button className="withdraw-btn" onClick={handleWithdraw}>Withdraw</button>
  )}
</div>
      </header>

      <div className="game-view">
        <div className="scoreboard">
          <div className="score-box red">RED: {gameState?.score?.RED || 0}</div>
          <div className="round-count">Round {gameState?.round || 1}</div>
          <div className="score-box blue">BLUE: {gameState?.score?.BLUE || 0}</div>
        </div>

        <p className="role-indicator">You are <span className={playerColor}>{playerColor}</span></p>

        <div className="input-panel">
          {gameState?.status === "waiting" ? (
            <div className="waiting-inline">
              <div className="status-pulse"></div>
              <p>Waiting for an opponent to join...</p>
            </div>
          ) : (
            <div className="controls-active">
              {gameState?.status === "discussion" && !gameState?.chat_enabled ? (
                <div className="voting-section">
                  <p>Allow discussion this round?</p>
                  <div className="btn-row">
                    <button onClick={() => castVote(true)}>Accept</button>
                    <button onClick={() => castVote(false)}>Decline</button>
                  </div>
                </div>
              ) : (
                <div className="choice-section">
                  <p>{mySelection ? "Move Locked In" : "Select your move:"}</p>
                  <div className="btn-row">
                    <button 
                      className={`choice-red ${mySelection === 'RED' ? 'selected' : ''}`} 
                      onClick={() => makeMove("RED")}
                      disabled={!!mySelection}
                    >
                      {mySelection === 'RED' ? '✓ LOCKED' : 'RED'}
                    </button>
                    <button 
                      className={`choice-blue ${mySelection === 'BLUE' ? 'selected' : ''}`} 
                      onClick={() => makeMove("BLUE")}
                      disabled={!!mySelection}
                    >
                      {mySelection === 'BLUE' ? '✓ LOCKED' : 'BLUE'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {gameState?.chat_enabled && (
        <div className="chat-overlay">
          <div className="chat-box">
            <div className="chat-header">Discussion ({timeLeft}s)</div>
            <div className="chat-msgs">
              {chatMessages.map((m, i) => (
                <div key={i} className={`msg-line ${m.player}`}>
                  <strong>{m.player}:</strong> {m.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-row">
              <input 
                value={msgInput} 
                onChange={(e) => setMsgInput(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && sendChat()} 
                placeholder="Type a message..."
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* History Drawer */}
      {showHistory && (
        <div className="history-drawer">
          <h3>Game History</h3>
          <div className="history-list">
            {gameState?.history?.map((h, i) => (
              <div key={i} className="history-item">
                Round {h.round}: R:{h.RED} | B:{h.BLUE}
              </div>
            ))}
          </div>
          <button onClick={() => setShowHistory(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

export default App;