import React from 'react';

export default function CharacterCreator({
  navigateWithTransition, activeTab, setActiveTab,
  facesList, faceIdx, setFaceIdx,
  hatsList, hatIdx, setHatIdx,
  myName, setMyName, finalizeConnection
}) {
  return (
    <div className="creator-screen-wrapper">
      <button className="main-btn back-corner-btn creator-back-btn" onClick={() => navigateWithTransition("menu")}>
        ← BACK
      </button>
      <div className="creator-sidebar-tabs">
        <button className={`main-btn creator-tab-btn ${activeTab === "FACE" ? "active-face" : ""}`} onClick={() => setActiveTab("FACE")}>🐶</button>
        <button className={`main-btn creator-tab-btn ${activeTab === "HAT" ? "active-hat" : ""}`} onClick={() => setActiveTab("HAT")}>🎩</button>
      </div>
      <div className="creator-center-stack">
        <div className="avatar-preview-orb">
          <span className="avatar-layer-face">{facesList[faceIdx]}</span>
          {hatsList[hatIdx] !== "❌" && <span className="avatar-layer-hat">{hatsList[hatIdx]}</span>}
        </div>
        <div className="creator-nav-row">
          <button className="main-btn creator-arrow-btn" onClick={() => {
            if (activeTab === "FACE") setFaceIdx(prev => prev === 0 ? facesList.length - 1 : prev - 1);
            else setHatIdx(prev => prev === 0 ? hatsList.length - 1 : prev - 1);
          }}>◀</button>
          <span className="creator-nav-label">{activeTab}</span>
          <button className="main-btn creator-arrow-btn" onClick={() => {
            if (activeTab === "FACE") setFaceIdx(prev => prev === facesList.length - 1 ? 0 : prev + 1);
            else setHatIdx(prev => prev === hatsList.length - 1 ? 0 : prev + 1);
          }}>▶</button>
        </div>
        <div className="menu-actions creator-identity-box">
          <input placeholder="NICKNAME" className="char-input creator-input-field" value={myName} onChange={(e) => setMyName(e.target.value)} autoFocus />
          <button className="main-btn creator-submit-btn" onClick={finalizeConnection}>CONFIRM IDENTITY</button>
        </div>
      </div>
    </div>
  );
}