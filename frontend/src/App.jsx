import React, { useState, useEffect, useRef } from 'react';
import MenuScreen from './components/MenuScreen';
import CharacterCreator from './components/CharacterCreator';
import WaitingRoom from './components/WaitingRoom';
import GameBoard from './components/GameBoard';
import DiscussionRoom from './components/DiscussionRoom';
import AdminPanel from './components/AdminPanel';
import './App.css';

export default function App() {
  
  const [currentScreen, setCurrentScreen] = useState("menu");
  const [transitionStage, setTransitionStage] = useState("ready");
  const [inputId, setInputId] = useState("");
  const [gameId, setGameId] = useState("");
  const [playerColor, setPlayerColor] = useState(null);
  const [myName, setMyName] = useState("");
  const [opponentName, setOpponentName] = useState("Waiting...");
  const [gameState, setGameState] = useState(null);
  const [mySelection, setMySelection] = useState(null);
  const [roundOutcome, setRoundOutcome] = useState(null);
  const [showRoundSplash, setShowRoundSplash] = useState(false);
  const [hasVotedDiscussion, setHasVotedDiscussion] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState("");
  const [refuserName, setRefuserName] = useState("");
  
  const facesList = ["🐱", "🐶", "🦊", "🦁", "🐸", "🐻", "🐼", "🤖"];
  const hatsList = ["🎩", "👑", "🧢", "🎓", "❌"];
  const [activeTab, setActiveTab] = useState("FACE");
  const [faceIdx, setFaceIdx] = useState(0);
  const [hatIdx, setHatIdx] = useState(0);
  const [myAvatar, setMyAvatar] = useState({ face: "🐱", hat: "❌" });
  const [opponentAvatar, setOpponentAvatar] = useState({ face: "🐱", hat: "❌" });
  
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [runningCrownOwner, setRunningCrownOwner] = useState(null);
  const [rematchStatus, setRematchStatus] = useState("IDLE");
  const [forcedGameWinner, setForcedGameWinner] = useState(null);
  const [showCopyToast, setShowCopyToast] = useState(false);
  
  const SERVER_IP = "127.0.0.1";
  const API_BASE = `http://${SERVER_IP}:8000`;
  const WS_BASE = `ws://${SERVER_IP}:8000`;
  
  const currentScreenRef = useRef(currentScreen);
  const chatEndRef = useRef(null);
  const lastAnimatedRoundRef = useRef(0);
  const socketRef = useRef(null);
  
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectTimeoutLeft, setDisconnectTimeoutLeft] = useState(120);

  const [showDiscussionStoppedModal, setShowDiscussionStoppedModal] = useState(false);
  const [discussionStopperName, setDiscussionStopperName] = useState("");

  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    let interval = null;
    if (opponentDisconnected && !forcedGameWinner) {
      interval = setInterval(() => {
        setDisconnectTimeoutLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setDisconnectTimeoutLeft(120);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [opponentDisconnected, forcedGameWinner]);

  const navigateWithTransition = (target) => {
    setTransitionStage("active");
    setTimeout(() => {
      setCurrentScreen(target);
    }, 800);
    setTimeout(() => {
      setTransitionStage("exit");
    }, 1000);
    setTimeout(() => {
      setTransitionStage("ready");
    }, 1800);
  };

  const getWinnerData = () => {
    if (forcedGameWinner) {
      return forcedGameWinner === playerColor 
        ? { color: playerColor, name: myName } 
        : { color: (playerColor === "RED" ? "BLUE" : "RED"), name: opponentName };
    }
    const redScore = gameState?.score?.RED || 0;
    const blueScore = gameState?.score?.BLUE || 0;
    if (redScore > blueScore) return { color: "RED", name: playerColor === "RED" ? myName : opponentName };
    if (blueScore > redScore) return { color: "BLUE", name: playerColor === "BLUE" ? myName : opponentName };
    return { color: "TIE", name: "Tie Game" };
  };

  const isGameOverState = () => {
    return !!forcedGameWinner || (gameState?.round > 10) || (gameState?.status === "finished");
  };

  useEffect(() => {
    if (isGameOverState()) {
      const winner = getWinnerData();
      if (winner.color !== "TIE") setRunningCrownOwner(winner.color);
    }
  }, [gameState, forcedGameWinner]);

  const connectWebSocket = (id, assumedColor, freshAvatar) => {
    const ws = new WebSocket(`${WS_BASE}/ws/${id}`);
    socketRef.current = ws;
    const activeAvatar = freshAvatar || myAvatar;
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ 
        type: "avatar_handshake", 
        sender: assumedColor, 
        face: activeAvatar.face, 
        hat: activeAvatar.hat ,
        name: myName
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "opponent_disconnected") {
        if (data.player !== assumedColor) {
          setOpponentDisconnected(true);
          setDisconnectTimeoutLeft(120);
        }
        return;
      }

      if (data.type === "avatar_handshake") {
        if (data.sender !== assumedColor) {
          setOpponentAvatar({ face: data.face, hat: data.hat });
          setOpponentDisconnected(false); 
          if (data.name) setOpponentName(data.name);
          
          ws.send(JSON.stringify({
            type: "avatar_handshake",
            sender: assumedColor,
            face: activeAvatar.face,
            hat: activeAvatar.hat,
            name: myName
          }));
        }
        return;
      }

      if (data.type === "chat_msg") {
        setChatMessages(prev => [...prev, data]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        return;
      }

      if (data.type === "discussion_stopped_by") {
        setDiscussionStopperName(data.stopper_name);
        setShowDiscussionStoppedModal(true);
        setTimeout(() => {
          setShowDiscussionStoppedModal(false);
        }, 4000);
        return;
      }

      if (data.type === "rematch_request" && data.sender !== assumedColor) {
        setRematchStatus("RECEIVED");
        return;
      }

      if (data.type === "rematch_decline") {
        setRematchStatus("IDLE");
        return;
      }

      if (data.type === "surrender_broadcast") {
        setForcedGameWinner(data.winnerColor);
        setOpponentDisconnected(false);
        return;
      }

      if (data.type === "update" || data.type === "game_over") {
        const activeColor = assumedColor || playerColor;
        if (data.players && activeColor) {
          const oppKey = activeColor === "RED" ? "BLUE" : "RED";
          if (data.players[oppKey]) setOpponentName(data.players[oppKey]);
        }
        if (data.status === "in_progress" && currentScreenRef.current === "waiting_room") {
            navigateWithTransition("board");
        }
        if (data.status === "in_progress" && currentScreenRef.current === "discussion_room") {
    navigateWithTransition("board");
  }
        
        if (data.status === "prompt_discussion") setHasVotedDiscussion(false);
        if (data.status === "discussion" && currentScreenRef.current !== "discussion_room") {
          setChatMessages([]);
          navigateWithTransition("discussion_room");
        }
        
        if (data.status === "discussion_refused") {
          const activeOpponentKey = activeColor === "RED" ? "BLUE" : "RED";
          const freshOpponentName = (data.players && data.players[activeOpponentKey]) ? data.players[activeOpponentKey] : opponentName;
          setRefuserName(freshOpponentName);
          setCurrentScreen("board");
        }
        
        if (data.reset_selection) setMySelection(null);
        if (data.choices) {
          const currentRound = data.history?.[data.history.length - 1]?.round || data.round;
          if (currentRound > lastAnimatedRoundRef.current) {
            lastAnimatedRoundRef.current = currentRound;
            setRoundOutcome(data.choices);
            setShowRoundSplash(true);
            setTimeout(() => {
              setShowRoundSplash(false);
              if (data.status === "prompt_discussion") {
                setGameState(data);
              } else if (data.status === "discussion_refused") {
                // validation logic sequence handled above
              } else {
                setGameState(data);
                if (currentScreenRef.current !== "board") navigateWithTransition("board");
              }
            }, 3800);
            return;
          }
        }
        setGameState(data);
      }
    };
  };

  const handleStartJoin = async () => {
    const idToJoin = inputId.trim().toUpperCase();
    if (!idToJoin) return;
    try {
      const res = await fetch(`${API_BASE}/game/state/${idToJoin}`);
      if (!res.ok) {
        alert("Game Room Not Found.");
        return;
      }
      const data = await res.json();
      if (data.status === "finished" || data.status === "game_over" || data.status === "abandoned") {
        alert("This match has already ended or been abandoned.");
        return;
      }

      if (data.status === "waiting") {
        setPlayerColor("BLUE");
        navigateWithTransition("creator");
      } else {
        const rejoinsRoute = `${API_BASE}/game/rejoin/${idToJoin}`;
        const rejoinRes = await fetch(rejoinsRoute, { method: "POST" });
        if (rejoinRes.ok) {
          const rejoinData = await rejoinRes.json();
          setGameId(idToJoin);
          setPlayerColor(rejoinData.color);
          setMyName(rejoinData.nickname);
          const restoredAvatar = { face: rejoinData.face, hat: rejoinData.hat };
          setMyAvatar(restoredAvatar);
          
          const oppColor = rejoinData.color === "RED" ? "BLUE" : "RED";
          setOpponentName(rejoinData.players[oppColor] || "Opponent");
          
          setGameState({
            status: rejoinData.game_status,
            score: rejoinData.score || { RED: 0, BLUE: 0 },
            round: rejoinData.round || 1,
            history: rejoinData.history || [],
            players: rejoinData.players
          });

          connectWebSocket(idToJoin, rejoinData.color, restoredAvatar);
          if (rejoinData.game_status === "discussion") {
            navigateWithTransition("discussion_room");
          } else {
            navigateWithTransition("board");
          }
        } else {
          alert("Rejoin Slot Occupied or Unavailable.");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartCreate = () => {
    setPlayerColor("RED");
    navigateWithTransition("creator");
  };

  const finalizeConnection = async () => {
    const chosenFace = facesList[faceIdx];
    const chosenHat = hatsList[hatIdx];
    const setupAvatar = { face: chosenFace, hat: chosenHat };
    setMyAvatar(setupAvatar);
    
    try {
      if (playerColor === "RED") {
        const res = await fetch(`${API_BASE}/game/create?nickname=${encodeURIComponent(myName)}`, { method: "POST" });
        const data = await res.json();
        setGameId(data.game_id.toUpperCase());
        connectWebSocket(data.game_id.toUpperCase(), "RED", setupAvatar);
        navigateWithTransition("waiting_room");
      } else {
        const idToJoin = inputId.trim().toUpperCase();
        const res = await fetch(`${API_BASE}/game/join/${idToJoin}?nickname=${encodeURIComponent(myName)}`, { method: "POST" });
        if (res.ok) {
          setGameId(idToJoin);
          connectWebSocket(idToJoin, "BLUE", setupAvatar);
          navigateWithTransition("board");
        } else {
          navigateWithTransition("menu");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const makeMove = async (choice) => {
    setMySelection(choice);
    try {
      await fetch(`${API_BASE}/game/move/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: playerColor, choice })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDiscussionVote = async (vote) => {
    setHasVotedDiscussion(true);
    try {
      await fetch(`${API_BASE}/game/discussion/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: playerColor, vote })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopDiscussion = async () => {
    try {
      await fetch(`${API_BASE}/game/discussion/stop/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: playerColor })
      });
    } catch (err) {
      console.error("Failed to stop discussion:", err);
    }
  };

  const sendChatMessage = async () => {
    if (!typedMessage.trim()) return;
    try {
      await fetch(`${API_BASE}/game/chat/send/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: playerColor, text: typedMessage })
      });
      setTypedMessage("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAbandonFromOverlay = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "surrender_broadcast", winnerColor: playerColor }));
    }
    setForcedGameWinner(playerColor);
    setOpponentDisconnected(false);
  };

  const handleConfirmSurrender = () => {
    const victoryColor = playerColor === "RED" ? "BLUE" : "RED";
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "surrender_broadcast", winnerColor: victoryColor }));
    }
    setForcedGameWinner(victoryColor);
    setOpponentDisconnected(false);
    navigateWithTransition("board");
  };

  const handleRequestRematch = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      setRematchStatus("SENT");
      socketRef.current.send(JSON.stringify({ type: "rematch_request", sender: playerColor }));
    }
  };

  const handleDeclineRematch = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "rematch_decline" }));
      setRematchStatus("IDLE");
    }
  };

  const handleAcceptRematch = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "rematch_commencing" }));
      executeGameResetState();
    }
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
      } catch (err) {
        console.error(err);
      }
    }, 800);
    setTimeout(() => setTransitionStage("exit"), 1800);
    setTimeout(() => setTransitionStage("ready"), 2600);
  };

  const handleReturnToMenu = () => {
    if (socketRef.current) socketRef.current.close();
    setGameId("");
    setGameState(null);
    setPlayerColor(null);
    setMySelection(null);
    setForcedGameWinner(null);
    setRematchStatus("IDLE");
    lastAnimatedRoundRef.current = 0;
    setOpponentDisconnected(false);
    navigateWithTransition("menu");
  };

  const handleCancelWaitingRoom = () => {
    if (socketRef.current) socketRef.current.close();
    setGameId("");
    setPlayerColor(null);
    navigateWithTransition("menu");
  };

  const copyId = () => {
    navigator.clipboard.writeText(gameId);
    setShowCopyToast(true);
    setTimeout(() => setShowCopyToast(false), 2000);
  };

  return (
    <div className="app-container">
      {/* 1. WARNING BANNER COMPONENT DISPLAY FOR STOPPED CHAT CHANNELS */}
      {showDiscussionStoppedModal && (
        <div style={{
          position: 'fixed', top: '4vh', left: '50%', transform: 'translateX(-50%)',
          background: '#ff4757', color: '#fff', padding: '14px 36px', borderRadius: '10px',
          zIndex: 110000, fontWeight: '900', fontSize: '1.9vh', boxShadow: '0 12px 24px rgba(255,71,87,0.35)',
          textTransform: 'uppercase', letterSpacing: '1px', animation: 'zoomBanner 0.3s ease-out forwards'
        }}>
          ⚠️ {discussionStopperName} closed the discussion panel! Resuming main match...
        </div>
      )}

      {currentScreen === "menu" && (
        <MenuScreen 
          inputId={inputId} setInputId={setInputId} 
          handleStartCreate={handleStartCreate} handleStartJoin={handleStartJoin} 
          openAdmin={() => setCurrentScreen("admin")}
        />
      )}
      {currentScreen === "creator" && (
        <CharacterCreator 
          navigateWithTransition={navigateWithTransition}
          activeTab={activeTab} setActiveTab={setActiveTab}
          facesList={facesList} faceIdx={faceIdx} setFaceIdx={setFaceIdx}
          hatsList={hatsList} hatIdx={hatIdx} setHatIdx={setHatIdx}
          myName={myName} setMyName={setMyName}
          finalizeConnection={finalizeConnection}
        />
      )}
      {currentScreen === "waiting_room" && (
        <WaitingRoom 
          handleCancelWaitingRoom={handleCancelWaitingRoom} 
          gameId={gameId} copyId={copyId} showCopyToast={showCopyToast} 
        />
      )}
      {currentScreen === "board" && (
        <GameBoard
          gameState={gameState} showRoundSplash={showRoundSplash}
          myAvatar={myAvatar} myName={myName}
          opponentAvatar={opponentAvatar} opponentName={opponentName}
          runningCrownOwner={runningCrownOwner} playerColor={playerColor}
          mySelection={mySelection} makeMove={makeMove}
          hasVotedDiscussion={hasVotedDiscussion} handleDiscussionVote={handleDiscussionVote}
          showRefusalModal={!!refuserName} refuserName={refuserName}
          closeRefusalModal={() => setRefuserName("")}
          roundOutcome={roundOutcome} isGameOver={isGameOverState()}
          winnerInfo={getWinnerData()} forcedGameWinner={forcedGameWinner}
          rematchStatus={rematchStatus} handleRequestRematch={handleRequestRematch}
          handleReturnToMenu={handleReturnToMenu} handleAcceptRematch={handleAcceptRematch}
          handleDeclineRematch={handleDeclineRematch} setShowWithdrawConfirm={setShowWithdrawConfirm}
          showWithdrawConfirm={showWithdrawConfirm} handleConfirmSurrender={handleConfirmSurrender}
        />
      )}
      {currentScreen === "discussion_room" && (
        <DiscussionRoom
          handleStopDiscussion={handleStopDiscussion} chatMessages={chatMessages}
          playerColor={playerColor} myAvatar={myAvatar} opponentAvatar={opponentAvatar}
          myName={myName} opponentName={opponentName} chatEndRef={chatEndRef}
          typedMessage={typedMessage} setTypedMessage={setTypedMessage} sendChatMessage={sendChatMessage}
        />
      )}
      {currentScreen === "admin" && (
        <AdminPanel API_BASE={API_BASE} onBack={() => setCurrentScreen("menu")} />
      )}

      {opponentDisconnected && (
        <div className="disconnect-overlay" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(20, 15, 38, 0.92)', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', zIndex: 10000, color: '#fff'
        }}>
          <div style={{ background: '#1a1a24', padding: '40px', borderRadius: '16px', border: '2px solid #ff4d4d', textAlign: 'center', boxShadow: '0 0 30px rgba(255, 77, 77, 0.3)', width: '450px' }}>
            <h2 style={{ fontSize: '3.5vh', margin: '0 0 10px 0', color: '#ff4d4d', fontWeight: '900', letterSpacing: '1px' }}>⚠️ OPPONENT DISCONNECTED</h2>
            <p style={{ fontSize: '2vh', opacity: 0.8, marginBottom: '30px', lineHeight: '1.5' }}>
              Waiting for them to rejoin... Match automatically ends in: <br />
              <strong style={{ fontSize: '3vh', color: '#ffa502', display: 'block', marginTop: '10px' }}>
                {Math.floor(disconnectTimeoutLeft / 60)}:{(disconnectTimeoutLeft % 60).toString().padStart(2, '0')}
              </strong>
            </p>
            <button
              className="main-btn"
              style={{ backgroundColor: '#ff4d4d', color: '#fff', border: 'none', padding: '14px 30px', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.8vh', width: '100%' }}
              onClick={handleAbandonFromOverlay}
            >
              ABANDON MATCH
            </button>
          </div>
        </div>
      )}

      <div className={`transition-overlay stage-${transitionStage}`} />
    </div>
  );
}