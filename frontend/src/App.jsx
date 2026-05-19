import { useState, useEffect, useRef } from 'react'
import './App.css'
import AdminPanel from './AdminPanel';

function App() {
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
  const [roundOutcome, setRoundOutcome] = useState(null);

  const [hasVotedDiscussion, setHasVotedDiscussion] = useState(false);
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState("");
  const [refuserName, setRefuserName] = useState("");

  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [runningCrownOwner, setRunningCrownOwner] = useState(null); 
  const [rematchStatus, setRematchStatus] = useState("IDLE"); 
  const [forcedGameWinner, setForcedGameWinner] = useState(null); 
  const [showCopyToast, setShowCopyToast] = useState(false);

  const SERVER_IP = "192.168.1.7";
  const API_BASE = `http://${SERVER_IP}:8000`;
  const WS_BASE = `ws://${SERVER_IP}:8000`;

  const currentScreenRef = useRef(currentScreen);
  const chatEndRef = useRef(null);
  const lastAnimatedRoundRef = useRef(0);

  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const navigateWithTransition = (screen) => {
    setTransitionStage("active");
    setTimeout(() => { setCurrentScreen(screen); }, 800);
    setTimeout(() => { setTransitionStage("exit"); }, 1800);
    setTimeout(() => { setTransitionStage("ready"); }, 2600);
  };

  const copyId = () => {
    if (!gameId) return;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(gameId)
        .then(() => { triggerCopyToast(); })
        .catch(() => { fallbackCopy(gameId); });
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
      document.execCommand('copy');
      triggerCopyToast();
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const triggerCopyToast = () => {
    setShowCopyToast(true);
    setTimeout(() => {
      setShowCopyToast(false);
    }, 2000);
  };

  useEffect(() => {
    if (gameState?.round && gameState.status === "in_progress" && currentScreen === "board") {
      setShowRoundSplash(true);
      const timer = setTimeout(() => {
        setShowRoundSplash(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [gameState?.round, gameState?.status, currentScreen]);
  
  const getWinnerData = () => {
    if (forcedGameWinner) {
      return forcedGameWinner === playerColor ? { color: playerColor, name: myName } : { color: (playerColor === "RED" ? "BLUE" : "RED"), name: opponentName };
    }
    const redScore = gameState?.score?.RED || 0;
    const blueScore = gameState?.score?.BLUE || 0;
    
    if (redScore > blueScore) {
      return { color: "RED", name: (playerColor === "RED" ? myName : opponentName) };
    }
    if (blueScore > redScore) {
      return { color: "BLUE", name: (playerColor === "BLUE" ? myName : opponentName) };
    }
    return { color: "TIE", name: "Tie Game" };
  };

  const isGameOverState = () => {
    return !!forcedGameWinner || (gameState?.round > 10) || (gameState?.type === "game_over");
  };

  useEffect(() => {
    if (isGameOverState()) {
      const winner = getWinnerData();
      if (winner.color !== "TIE") {
        setRunningCrownOwner(winner.color);
      }
    }
  }, [gameState, forcedGameWinner]);

  const connectWebSocket = (id, assumedColor) => {
    const ws = new WebSocket(`${WS_BASE}/ws/${id}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "chat_msg") {
        setChatMessages(prev => [...prev, { sender: data.sender, text: data.text }]);
        return;
      }

      if (data.type === "discussion_stopped_by") {
        navigateWithTransition("board");
        return;
      }

      if (data.type === "rematch_request" && data.sender !== assumedColor) {
        setRematchStatus("RECEIVED");
        return;
      }

      if (data.type === "rematch_commencing") {
        setTransitionStage("active");
        
        setTimeout(() => {
          setMySelection(null);
          setForcedGameWinner(null);
          setRematchStatus("IDLE");
          lastAnimatedRoundRef.current = 0;
          setCurrentScreen("board");
        }, 800);

        setTimeout(() => { setTransitionStage("exit"); }, 1800);
        setTimeout(() => { setTransitionStage("ready"); }, 2600);
        return;
      }

      if (data.type === "rematch_decline") {
        setRematchStatus("IDLE");
        return;
      }

      if (data.type === "surrender_broadcast") {
        setForcedGameWinner(data.winnerColor);
        return;
      }

      if (data.type === "update" || data.type === "game_over") {
        const activeColor = assumedColor || playerColor;
        
        if (data.players && activeColor) {
          const oppKey = activeColor === "RED" ? "BLUE" : "RED";
          if (data.players[oppKey]) setOpponentName(data.players[oppKey]);
        }

        if (data.status === "prompt_discussion") {
          setHasVotedDiscussion(false);
        }

        if (data.status === "discussion" && currentScreenRef.current !== "discussion_room") {
          setChatMessages([]); 
          navigateWithTransition("discussion_room");
        }

        if (data.status === "discussion_refused") {
          const activeOpponentKey = activeColor === "RED" ? "BLUE" : "RED";
          const freshOpponentName = (data.players && data.players[activeOpponentKey]) ? data.players[activeOpponentKey] : opponentName;
          
          setRefuserName(freshOpponentName); 
          setShowRefusalModal(true);
          
          setTimeout(async () => {
            setShowRefusalModal(false);
            setRefuserName("");
            if (activeColor === "RED") {
              await fetch(`${API_BASE}/game/discussion/close/${id}`, { method: "POST" });
            }
          }, 4000);
        }

        if (data.status === "in_progress" && currentScreenRef.current === "discussion_room") {
          navigateWithTransition("board");
        }

        const serverRound = data.round || 1;
        const incomingHistory = data.history || [];
        
        if (incomingHistory.length > 0) {
          const latestRecord = incomingHistory[incomingHistory.length - 1];
          const recordRound = latestRecord.round;

          if (lastAnimatedRoundRef.current < recordRound) {
            lastAnimatedRoundRef.current = recordRound;

            const finalRed = latestRecord.RED;
            const finalBlue = latestRecord.BLUE;

            if (finalRed === "BLUE" && finalBlue === "BLUE") {
              setRoundOutcome("HANDSHAKE");
            } else if (finalRed === "RED" && finalBlue === "RED") {
              setRoundOutcome("DUEL");
            } else if (finalRed === "RED" && finalBlue === "BLUE") {
              setRoundOutcome("BETRAY_RED");
            } else if (finalRed === "BLUE" && finalBlue === "RED") {
              setRoundOutcome("BETRAY_BLUE");
            }

            setMySelection("LOCKED_SYSTEM");

            setTimeout(() => {
              setRoundOutcome(null);
              setGameState(data);
              setMySelection(null);
            }, 2000);

            return;
          }
        }

        if (lastAnimatedRoundRef.current !== serverRound || data.type === "game_over" || data.status !== "in_progress") {
          setGameState(data);
          if (data.status === "in_progress") {
            setMySelection(null);
          }
        }

        if (data.status === "in_progress" && currentScreenRef.current !== "board" && currentScreenRef.current !== "discussion_room") {
          navigateWithTransition("board"); 
        }
      }
    };
    setSocket(ws);
  };

  const handleConfirmSurrender = () => {
    const victoryColor = playerColor === "RED" ? "BLUE" : "RED";
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "surrender_broadcast", winnerColor: victoryColor }));
    }
    setForcedGameWinner(victoryColor);
    setShowWithdrawConfirm(false);
  };

  const handleRequestRematch = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    setRematchStatus("SENT");
    socket.send(JSON.stringify({ type: "rematch_request", sender: playerColor }));
  };

  const handleDeclineRematch = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "rematch_decline" }));
    setRematchStatus("IDLE");
  };

  const handleAcceptRematch = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    
    socket.send(JSON.stringify({ type: "rematch_commencing" }));
    
    executeGameResetState();
  };

  const executeGameResetState = async () => {
    setTransitionStage("active");

    setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/game/reset/${gameId}`, { method: "POST" });
        
        setMySelection(null);
        setForcedGameWinner(null);
        setRematchStatus("IDLE");
        lastAnimatedRoundRef.current = 0;
        setCurrentScreen("board");
      } catch(err) { 
        console.error("Backend rematch reset failed:", err); 
      }
    }, 800);
    setTimeout(() => { setTransitionStage("exit"); }, 1800);
    setTimeout(() => { setTransitionStage("ready"); }, 2600);
  };

  const handleReturnToMenu = () => {
    if (socket) socket.close();
    setGameId("");
    setGameState(null);
    setPlayerColor(null);
    setMySelection(null);
    setForcedGameWinner(null);
    setRematchStatus("IDLE");
    lastAnimatedRoundRef.current = 0;
    navigateWithTransition("menu");
  };

  const handleStartCreate = () => {
    setPlayerColor("RED");
    navigateWithTransition("char_create");
  };

  const handleStartJoin = () => {
    if (!inputId.trim()) return;
    if (inputId.trim() === "ADMIN123") {
      navigateWithTransition("admin");
      return;
    }
    setPlayerColor("BLUE");
    navigateWithTransition("char_create");
  };

  const finalizeConnection = async () => {
    if (!myName.trim()) return;

    try {
      if (playerColor === "RED") {
        const res = await fetch(`${API_BASE}/game/create?nickname=${encodeURIComponent(myName)}`, { method: "POST" });
        const data = await res.json();
        setGameId(data.game_id.toUpperCase());
        connectWebSocket(data.game_id.toUpperCase(), "RED");
        navigateWithTransition("waiting_room");
      } else {
        const idToJoin = inputId.trim().toUpperCase();
        const res = await fetch(`${API_BASE}/game/join/${idToJoin}?nickname=${encodeURIComponent(myName)}`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setGameId(idToJoin);
          if (data.players && data.players["RED"]) {
            setOpponentName(data.players["RED"]);
          }
          connectWebSocket(idToJoin, "BLUE");
          navigateWithTransition("board");
        } else {
          navigateWithTransition("menu");
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

  const handleDiscussionVote = async (voteValue) => {
    setHasVotedDiscussion(true);
    await fetch(`${API_BASE}/game/discussion/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: playerColor, vote: voteValue }),
    });
  };

  const handleStopDiscussion = async () => {
    await fetch(`${API_BASE}/game/discussion/stop/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: playerColor }),
    });
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;
    await fetch(`${API_BASE}/game/chat/send/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: playerColor, text: typedMessage.trim() }),
    });
    setTypedMessage("");
  };

  const winnerInfo = getWinnerData();

  return (
    <div className="app-container">
      <div className={`transition-overlay stage-${transitionStage}`} />

      {(currentScreen === "board" || currentScreen === "discussion_room") && !isGameOverState() && (
        <div className="withdraw-container">
          {showWithdrawConfirm && (
            <div className="withdraw-confirm-box animate-pop">
              <span>ARE YOU SURE?</span>
              <button className="w-btn yes" onClick={handleConfirmSurrender}>YES</button>
              <button className="w-btn no" onClick={() => setShowWithdrawConfirm(false)}>NO</button>
            </div>
          )}
          <button className="flag-btn" onClick={() => setShowWithdrawConfirm(!showWithdrawConfirm)}>🏳️</button>
        </div>
      )}

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
            {showCopyToast && <div className="copy-toast-inline">✓ Code Saved to Clipboard</div>}
          </div>
          <div className="loading-spinner"></div>
          <p className="pulse-text">Waiting for opponent...</p>
        </div>
      )}

      {currentScreen === "board" && (
        <div className={`game-hud ${showRoundSplash || (gameState?.status === "prompt_discussion") ? 'dimmed' : ''}`}>
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
            <div className="scoreboard-player-wrapper">
              {runningCrownOwner === "RED" && <div className="crown-badge">👑</div>}
              <div className="flip-card red">
                <div className="flip-inner" key={gameState?.score?.RED}>{gameState?.score?.RED || 0}</div>
              </div>
              <span className="player-identity-tag mine">{playerColor === "RED" ? "Mine" : "Opponent"}</span>
            </div>
            
            <div className="score-divider">:</div>
            
            <div className="scoreboard-player-wrapper">
              {runningCrownOwner === "BLUE" && <div className="crown-badge">👑</div>}
              <div className="flip-card blue">
                <div className="flip-inner" key={gameState?.score?.BLUE}>{gameState?.score?.BLUE || 0}</div>
              </div>
              <span className="player-identity-tag opponents">{playerColor === "BLUE" ? "Mine" : "Opponent"}</span>
            </div>

            {(gameState?.round === 9 || gameState?.round === 10) && (
              <div className="double-points-ticker">🔥 DOUBLE POINTS ROUND 🔥</div>
            )}
          </div>

          <div className="choice-circle-container">
            <button 
              className={`circle-half left red ${mySelection === 'RED' ? 'locked' : ''} ${mySelection && mySelection !== 'RED' ? 'dimmed' : ''}`} 
              onClick={() => makeMove("RED")}
              disabled={!!mySelection || gameState?.status === "prompt_discussion"}
            >
              <span>{mySelection === 'RED' ? 'LOCKED' : 'RED'}</span>
            </button>
            
            <button 
              className={`circle-half right blue ${mySelection === 'BLUE' ? 'locked' : ''} ${mySelection && mySelection !== 'BLUE' ? 'dimmed' : ''}`} 
              onClick={() => makeMove("BLUE")}
              disabled={!!mySelection || gameState?.status === "prompt_discussion"}
            >
              <span>{mySelection === 'BLUE' ? 'LOCKED' : 'BLUE'}</span>
            </button>
          </div>

          {gameState?.status === "prompt_discussion" && (
            <div className="bottom-dock-panel animate-slide-up">
              {!hasVotedDiscussion ? (
                <div className="dock-panel-inner">
                  <h3>Would you like to discuss with your opponent?</h3>
                  <div className="dock-panel-buttons">
                    <button className="vote-btn yes" onClick={() => handleDiscussionVote(true)}>YES</button>
                    <button className="vote-btn no" onClick={() => handleDiscussionVote(false)}>NO</button>
                  </div>
                </div>
              ) : (
                <div className="dock-panel-inner horizontal-align">
                  <div className="small-spinner"></div>
                  <p className="pulse-text">Waiting for your opponent to vote...</p>
                </div>
              )}
            </div>
          )}

          {showRefusalModal && (
            <div className="discussion-prompt-overlay">
              <div className="refusal-text-banner animate-pop">
                <span className="refusal-cross">✕</span>
                <h2>DISCUSSION CANCELLED</h2>
                <p><span className="highlight-name">{refuserName}</span> refused to discuss.</p>
              </div>
            </div>
          )}

          {roundOutcome && (
            <div className="outcome-banner-container">
              {roundOutcome === "HANDSHAKE" && (
                <div className="outcome-stage handshake-anim">
                  <span className="emoji-left">🤝</span>
                  <div className="outcome-text">MUTUAL TRUST</div>
                  <span className="emoji-right">🤝</span>
                </div>
              )}

              {roundOutcome === "DUEL" && (
                <div className="outcome-stage duel-anim">
                  <span className="emoji-left">⚔️</span>
                  <div className="outcome-text" style={{color: 'var(--red)'}}>MUTUAL DESTRUCTION</div>
                  <span className="emoji-right">⚔️</span>
                </div>
              )}

              {roundOutcome === "BETRAY_RED" && (
                <div className="outcome-stage betray-left-anim">
                  <span className="emoji-left">⚔️</span>
                  <div className="outcome-text">
                    {playerColor === "RED" ? myName : opponentName} BETRAYED!
                  </div>
                  <span className="emoji-right">🛡️</span>
                </div>
              )}

              {roundOutcome === "BETRAY_BLUE" && (
                <div className="outcome-stage betray-right-anim">
                  <span className="emoji-left">🛡️</span>
                  <div className="outcome-text">
                    {playerColor === "BLUE" ? myName : opponentName} BETRAYED!
                  </div>
                  <span className="emoji-right">⚔️</span>
                </div>
              )}
            </div>
          )}

          {showRoundSplash && (
            <div className="round-overlay-container">
              <div className="round-content-box">
                <h2 className="round-title">ROUND {gameState?.round}</h2>
              </div>
            </div>
          )}
        </div>
      )}

      {currentScreen === "discussion_room" && (
        <div className="chat-view-container app-themed">
          <div className="chat-header">
            <div className="chat-partner-info">
              <div className="status-dot-active"></div>
              <h2>Discussion Room</h2>
            </div>
            <button className="chat-close-btn stop-red" onClick={handleStopDiscussion}>
              STOP DISCUSSION
            </button>
          </div>

          <div className="chat-scroller">
            {chatMessages.map((msg, index) => {
              const isMe = msg.sender === playerColor;
              return (
                <div key={index} className={`chat-row ${isMe ? 'right-aligned' : 'left-aligned'}`}>
                  <div className={`chat-bubble ${isMe ? 'my-bubble' : 'their-bubble'}`}>
                    <span className="bubble-sender-title">{isMe ? myName : opponentName}</span>
                    <p className="bubble-text">{msg.text}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form className="chat-input-bar" onSubmit={sendChatMessage}>
            <input 
              value={typedMessage} 
              onChange={(e) => setTypedMessage(e.target.value)} 
              placeholder="Type your message..." 
              maxLength={250}
            />
            <button type="submit" className="chat-send-btn">
              <span>SEND</span>
            </button>
          </form>
        </div>
      )}

      {isGameOverState() && (
        <div className="game-over-overlay">
          <div className="victory-card animate-pop">
            <div className="big-crown">👑</div>
            
            <h1 className="winner-announcement">
              {winnerInfo.color === "TIE" ? "IT'S A DRAW" : "WINNER"}
              <span className="winner-name-highlight">{winnerInfo.name}</span>
            </h1>

            {window.forcedGameWinner || !!forcedGameWinner ? (
              <div className="surrender-subtitle">(By Withdrawal)</div>
            ) : null}

            <div className="final-scoreboard-summary">
              <div className="final-score-node">
                {myName} (You)
                <strong>{playerColor === "RED" ? (gameState?.score?.RED || 0) : (gameState?.score?.BLUE || 0)} PTS</strong>
              </div>
              <div className="final-score-node">
                {opponentName}
                <strong>{playerColor === "RED" ? (gameState?.score?.BLUE || 0) : (gameState?.score?.RED || 0)} PTS</strong>
              </div>
            </div>

            <div className="game-over-actions">
              {rematchStatus !== "RECEIVED" && (
                <button 
                  className="game-over-btn rematch" 
                  onClick={handleRequestRematch}
                  disabled={rematchStatus === "SENT"}
                >
                  {rematchStatus === "SENT" ? "WAITING FOR OPPONENT..." : "REMATCH"}
                </button>
              )}
              <button className="game-over-btn main-menu" onClick={handleReturnToMenu}>
                BACK TO MAIN MENU
              </button>
            </div>

            {rematchStatus === "RECEIVED" && (
              <div className="rematch-dialog-panel animate-slide-up">
                <h3>Would you like a rematch?</h3>
                <div className="rematch-panel-buttons">
                  <button className="v-btn yes" onClick={handleAcceptRematch}>YES</button>
                  <button className="v-btn no" onClick={handleDeclineRematch}>NO</button>
                </div>
              </div>
            )}

            {rematchStatus === "SENT" && (
              <div className="rematch-status-alert">Rematch invitation sent to player...</div>
            )}
          </div>
        </div>
      )}
{currentScreen === "admin" && (
  <AdminPanel 
    API_BASE={API_BASE} 
    onBack={() => navigateWithTransition("menu")} 
  />
)}
    </div>
  )
}

export default App;