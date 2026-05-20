import React from 'react';

export default function MenuScreen({ inputId, setInputId, handleStartCreate, handleStartJoin, openAdmin }) {
  return (
    <div className="setup-view">
      <button 
        className="main-btn back-corner-btn" 
        style={{ position: 'absolute', top: '4vh', left: '4vh', padding: '1vh 2.5vh', fontSize: '1.6vh' }}
        onClick={openAdmin}
      >
        ⚙️ ADMIN
      </button>
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
  );
}