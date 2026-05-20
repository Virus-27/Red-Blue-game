import React from 'react';

export default function DiscussionRoom({
  handleStopDiscussion, chatMessages, playerColor, myAvatar,
  opponentAvatar, myName, opponentName, chatEndRef,
  typedMessage, setTypedMessage, sendChatMessage
}) {
  return (
    <div className="discussion-view-wrapper animate-fade-in">
      <div className="discussion-layout-grid">
        <div className="discussion-sidebar-panel">
          <h2 className="sidebar-title">DISCUSSION ROOM</h2>
          <div className="sidebar-profiles-stack">
            <div className="profile-node-card">
              <div className="node-avatar-orb mine">
                <span>{myAvatar.face}</span>
                {myAvatar.hat !== "❌" && <span className="node-avatar-hat">{myAvatar.hat}</span>}
              </div>
              <div className="node-details">
                <div className="node-name">{myName}</div>
                <div className="node-status-tag">CONNECTED</div>
              </div>
            </div>
            <div className="profile-node-card">
              <div className="node-avatar-orb opponents">
                <span>{opponentAvatar.face}</span>
                {opponentAvatar.hat !== "❌" && <span className="node-avatar-hat">{opponentAvatar.hat}</span>}
              </div>
              <div className="node-details">
                <div className="node-name">{opponentName}</div>
                <div className="node-status-tag">CONNECTED</div>
              </div>
            </div>
          </div>
          <button className="main-btn stop-discussion-trigger" onClick={handleStopDiscussion}>✕ STOP DISCUSSION</button>
        </div>
        <div className="discussion-chat-container">
          <div className="chat-messages-scroller">
            {chatMessages.map((msg, i) => {
              const isMe = msg.sender === playerColor;
              return (
                <div key={i} className={`chat-bubble-row ${isMe ? "me" : "them"}`}>
                  <div className="chat-bubble-bubble">{msg.text}</div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-bar-group">
            <input 
              value={typedMessage} 
              onChange={(e) => setTypedMessage(e.target.value)} 
              placeholder="Type your message..." 
              onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
            />
            <button className="main-btn chat-send-btn" onClick={sendChatMessage}>SEND</button>
          </div>
        </div>
      </div>
    </div>
  );
}