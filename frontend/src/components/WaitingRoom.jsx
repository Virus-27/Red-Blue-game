import React from 'react';

export default function WaitingRoom({ handleCancelWaitingRoom, gameId, copyId, showCopyToast }) {
  return (
    <div className="setup-view">
      <button 
        className="main-btn back-corner-btn" 
        style={{ position: 'absolute', top: '4vh', left: '4vh', padding: '1vh 2.5vh', fontSize: '1.8vh' }} 
        onClick={handleCancelWaitingRoom}
      >
        ← LEAVE ROOM
      </button>
      <div className="id-display-card">
        <span className="label">GAME ID</span>
        <code className="game-id-text">{gameId}</code>
        <button className="main-btn" onClick={copyId}>COPY CODE</button>
        {showCopyToast && <div className="copy-toast-inline">✓ Code Saved to Clipboard</div>}
      </div>
      <div className="loading-spinner"></div>
      <p className="pulse-text">Waiting for opponent...</p>
    </div>
  );
}