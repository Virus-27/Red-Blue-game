import React from 'react';

export default function GameBoard({
  gameState, showRoundSplash, myAvatar, myName, opponentAvatar, opponentName,
  runningCrownOwner, playerColor, mySelection, makeMove, hasVotedDiscussion,
  handleDiscussionVote, showRefusalModal, refuserName, closeRefusalModal, roundOutcome,
  isGameOver, winnerInfo, forcedGameWinner, rematchStatus, handleRequestRematch,
  handleReturnToMenu, handleAcceptRematch, handleDeclineRematch, setShowWithdrawConfirm,
  showWithdrawConfirm, handleConfirmSurrender
}) {

  // Helper utility to resolve explicit choices to visual tags and dynamic text labels
  const getChoiceLabel = (choice) => {
    if (choice === "BLUE") return "🤝 COOPERATE";
    if (choice === "RED") return "⚔️ BETRAY";
    return "❌ NONE";
  };

  // Helper utility to get the correct emote visual variant dynamically
  const getChoiceEmote = (choice) => {
    if (choice === "BLUE") return "🤝";
    if (choice === "RED") return "⚔️";
    return "❌";
  };

  // Extract variables using the fixed data mapping system
  const currentRoundIndex = gameState?.round ? gameState.round : 1;
  
  // Directly pull details from the standalone real-time roundOutcome state object 
  const redChoice = roundOutcome?.RED || "NONE";
  const blueChoice = roundOutcome?.BLUE || "NONE";
  const completedRoundNum = roundOutcome?.round || (currentRoundIndex > 1 ? currentRoundIndex : 1);

  // Calculate scores using historical metrics to keep the visual splash matching the data
  const pointsMultiplier = completedRoundNum >= 9 ? 2 : 1;
  let redGained = 0;
  let blueGained = 0;

  if (redChoice !== "NONE" && blueChoice !== "NONE") {
    if (redChoice === "RED" && blueChoice === "RED") {
      redGained = -3 * pointsMultiplier;
      blueGained = -3 * pointsMultiplier;
    } else if (redChoice === "BLUE" && blueChoice === "BLUE") {
      redGained = 3 * pointsMultiplier;
      blueGained = 3 * pointsMultiplier;
    } else if (redChoice === "BLUE" && blueChoice === "RED") {
      redGained = -6 * pointsMultiplier;
      blueGained = 6 * pointsMultiplier;
    } else if (redChoice === "RED" && blueChoice === "BLUE") {
      redGained = 6 * pointsMultiplier;
      blueGained = -6 * pointsMultiplier;
    }
  }

  if (isGameOver) {
    return (
      <div className="game-over-overlay">
        <div className="victory-card animate-pop">
          <div className="big-crown">👑</div>
          <h2 className="victory-title">MATCH COMPLETED</h2>
          <p className="winner-declaration">
            {winnerInfo.color === "TIE" ? "IT'S A DRAW!" : `${winnerInfo.name} WINS THE GAME!`}
          </p>
          <div className="final-scoreboard-summary">
            <div className="final-score-node">RED<strong>{gameState?.score?.RED || 0}</strong></div>
            <div className="final-score-node">BLUE<strong>{gameState?.score?.BLUE || 0}</strong></div>
          </div>
          <div className="game-over-actions">
            {rematchStatus === "IDLE" && <button className="main-btn game-over-btn" onClick={handleRequestRematch}>REQUEST REMATCH</button>}
            {rematchStatus === "SENT" && <div className="rematch-status-alert">Waiting for opponent acceptance...</div>}
            {rematchStatus === "RECEIVED" && (
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button className="main-btn game-over-btn" style={{ background: '#2ecc71' }} onClick={handleAcceptRematch}>ACCEPT</button>
                <button className="main-btn game-over-btn" style={{ background: '#e74c3c' }} onClick={handleDeclineRematch}>DECLINE</button>
              </div>
            )}
            <button className="main-btn game-over-btn menu-back" onClick={handleReturnToMenu}>RETURN TO MENU</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="board-wrapper-container">
      
      {/* 1. OVERLAY SPLASH PANEL: REAL-TIME FIX */}
      {showRoundSplash && roundOutcome && (
        <div className="round-splash-overlay">
          <div className="splash-card-inner">
            <div className="splash-header-node">
              ROUND {completedRoundNum} SUMMARY
            </div>
            
            <div className="outcome-stage">
              {/* RED PLAYER CARD BLOCK */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5vh' }}>
                <span style={{ fontSize: '2.5vh', color: 'var(--red)', fontWeight: '900', margin: 0 }}>
                  {playerColor === "RED" ? "YOUR ACTION" : `${opponentName || "RED PLAYER"}`}
                </span>
                <div style={{ fontSize: '7vh' }}>{getChoiceEmote(redChoice)}</div>
                <div className="choice-badge-text" style={{ background: 'rgba(255,71,87,0.15)', color: 'var(--red)' }}>
                  {getChoiceLabel(redChoice)}
                </div>
                <div className="gained-score-text" style={{ color: redGained >= 0 ? '#2ecc71' : '#e74c3c' }}>
                  {redGained >= 0 ? `+${redGained}` : redGained} PTS
                </div>
              </div>
              
              <div className="versus-divider-txt">VS</div>
              
              {/* BLUE PLAYER CARD BLOCK */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5vh' }}>
                <span style={{ fontSize: '2.5vh', color: 'var(--blue)', fontWeight: '900', margin: 0 }}>
                  {playerColor === "BLUE" ? "YOUR ACTION" : `${opponentName || "BLUE PLAYER"}`}
                </span>
                <div style={{ fontSize: '7vh' }}>{getChoiceEmote(blueChoice)}</div>
                <div className="choice-badge-text" style={{ background: 'rgba(46,134,222,0.15)', color: 'var(--blue)' }}>
                  {getChoiceLabel(blueChoice)}
                </div>
                <div className="gained-score-text" style={{ color: blueGained >= 0 ? '#2ecc71' : '#e74c3c' }}>
                  {blueGained >= 0 ? `+${blueGained}` : blueGained} PTS
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRefusalModal && (
        <div className="refusal-modal-backdrop">
          <div className="refusal-card animate-pop">
            <h3>⚠️ CHAT REQUEST DENIED</h3>
            <p><strong>{refuserName}</strong> voted against launching the active discussion portal.</p>
            <button className="main-btn" onClick={closeRefusalModal}>CONTINUE GAME</button>
          </div>
        </div>
      )}

      {/* HUD HEADER STRUCTURAL CONTAINER */}
      <div className="hud-header-container">
        
        {/* 2. DOUBLE POINTS ROUND TICKER - POSITIONED SAFELY ABOVE THE SCOREBOARD FRAME */}
        {(gameState?.round === 9 || gameState?.round === 10) && (
          <div className="double-points-ticker">🔥 DOUBLE POINTS ROUND 🔥</div>
        )}

        <div className="hud-profile-card bottom-left">
          <div className="hud-avatar-frame mine">
            <span>{myAvatar.face}</span>
            {myAvatar.hat !== "❌" && <span className="hud-avatar-hat-layer">{myAvatar.hat}</span>}
          </div>
          <div className="hud-text-stack">
            <span className="hud-display-name">{myName}</span>
            <span className="hud-role-tag">YOU ({playerColor})</span>
          </div>
        </div>
        
        <div className="hud-profile-card bottom-right">
          <div className="hud-avatar-frame opponents">
            <span>{opponentAvatar.face}</span>
            {opponentAvatar.hat !== "❌" && <span className="hud-avatar-hat-layer">{opponentAvatar.hat}</span>}
          </div>
          <div className="hud-text-stack">
            <span className="hud-display-name">{opponentName}</span>
            <span className="hud-role-tag">OPPONENT</span>
          </div>
        </div>

        {/* MAIN SCOREBOARD HUB */}
        <div className="flip-scoreboard">
          <div className="scoreboard-player-wrapper">
            {runningCrownOwner === "RED" && <div className="crown-badge">👑</div>}
            <div className="flip-card red">
              <div className="flip-inner" key={gameState?.score?.RED}>
                {gameState?.score?.RED || 0}
              </div>
            </div>
            <span className="player-identity-tag mine">{playerColor === "RED" ? "You" : "Opponent"}</span>
          </div>

          <div className="score-divider">:</div>

          <div className="scoreboard-player-wrapper">
            {runningCrownOwner === "BLUE" && <div className="crown-badge">👑</div>}
            <div className="flip-card blue">
              <div className="flip-inner" key={gameState?.score?.BLUE}>
                {gameState?.score?.BLUE || 0}
              </div>
            </div>
            <span className="player-identity-tag opponents">{playerColor === "BLUE" ? "You" : "Opponent"}</span>
          </div>
        </div>

        {/* 3. PERSISTENT LIVE ROUND COUNTER - DOCKED CLEANLY UNDER SCOREBOARD CONTAINER */}
        <div className="round-counter-display">
          ROUND {gameState?.round || 1}
        </div>
      </div>

      <div className="choice-circle-container">
        <button 
          className={`circle-half left red ${mySelection === 'RED' ? 'locked' : ''} ${mySelection && mySelection !== 'RED' ? 'dimmed' : ''}`} 
          onClick={() => makeMove(mySelection === 'RED' ? null : "RED")} 
          disabled={gameState?.status === "prompt_discussion"}
        >
          <span>RED</span>
        </button>
        <button 
          className={`circle-half right blue ${mySelection === 'BLUE' ? 'locked' : ''} ${mySelection && mySelection !== 'BLUE' ? 'dimmed' : ''}`} 
          onClick={() => makeMove(mySelection === 'BLUE' ? null : "BLUE")} 
          disabled={gameState?.status === "prompt_discussion"}
        >
          <span>BLUE</span>
        </button>
      </div>

      {gameState?.status === "prompt_discussion" && (
        <div className="discussion-prompt-panel animate-pop">
          {!hasVotedDiscussion ? (
            <>
              <h3>DO YOU WANT TO GO TO THE DISCUSSION ROOM?</h3>
              <div style={{ display: 'flex', gap: '20px' }}>
                <button className="main-btn yes" onClick={() => handleDiscussionVote(true)}>✓ YES</button>
                <button className="main-btn no" onClick={() => handleDiscussionVote(false)}>✕ NO</button>
              </div>
            </>
          ) : (
            <p className="pulse-text" style={{ fontSize: '2.2vh', fontWeight: 'bold' }}>Waiting for opponent response parameters...</p>
          )}
        </div>
      )}

      {!isGameOver && (
        <div className="withdraw-container">
          {showWithdrawConfirm && (
            <div className="withdraw-confirm-box animate-pop">
              <span>ARE YOU SURE?</span>
              <button className="w-btn yes" onClick={handleConfirmSurrender}>YES</button>
              <button className="w-btn no" onClick={() => setShowWithdrawConfirm(false)}>NO</button>
            </div>
          )}
          <button className="withdraw-trigger-btn" onClick={() => setShowWithdrawConfirm(true)}>SURRENDER MATCH</button>
        </div>
      )}
    </div>
  );
}