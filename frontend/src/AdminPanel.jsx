import { useState, useEffect } from 'react';

export default function AdminPanel({ API_BASE, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/game/admin/sessions?`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (dateFilter) url += `date=${dateFilter}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed fetching admin logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter, dateFilter]);

  return (
    // FIX: Added height restriction and auto vertical scrolling to the main panel container
    <div className="admin-container" style={{ 
      padding: '4vh', 
      color: '#fff', 
      background: '#121214', 
      height: '100vh',        // Constrains the viewport height exactly to the screen window
      boxSizing: 'border-box',
      overflowY: 'auto'       // Spawns a clean global scrollbar if content overflows vertically
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4vh' }}>
        <h1 style={{ fontSize: '4vh', margin: 0, fontWeight: 800 }}>🛡️ System Administration</h1>
        <button onClick={onBack} className="main-btn" style={{ padding: '1vh 3vh', fontSize: '2vh' }}>EXIT PANEL</button>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '4vh', background: '#1a1a1e', padding: '20px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '1.4vh', opacity: 0.7 }}>GAME STATUS</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: '#26262b', color: '#fff', border: '1px solid #3a3a42', padding: '10px', borderRadius: '6px' }}
          >
            <option value="">All Statuses</option>
            <option value="in_progress">Ongoing</option>
            <option value="finished">Finalized</option>
            <option value="prompt_discussion">In Discussion</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '1.4vh', opacity: 0.7 }}>FILTER BY DATE</label>
          <input 
            type="date" 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ background: '#26262b', color: '#fff', border: '1px solid #3a3a42', padding: '8px', borderRadius: '6px' }}
          />
        </div>
        
        <button onClick={fetchSessions} className="main-btn" style={{ alignSelf: 'flex-end', padding: '10px 20px' }}>REFRESH</button>
      </div>

      {/* SYSTEM DATA LAYOUT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedGame ? '1fr 1fr' : '1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* SESSIONS TABLE CONTAINER */}

        <div style={{ 
          background: '#1a1a1e', 
          borderRadius: '12px', 
          padding: '20px', 
          maxHeight: '70vh', 
          overflowY: 'auto' 
        }}>
          {loading ? <p>Loading centralized grid...</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #26262b', opacity: 0.7, fontSize: '1.6vh', position: 'sticky', top: 0, background: '#1a1a1e' }}>
                  <th style={{ padding: '12px' }}>GAME ID</th>
                  <th>PLAYERS</th>
                  <th>CURRENT ROUND</th>
                  <th>SCORE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr 
                    key={session.game_id} 
                    onClick={() => setSelectedGame(session)}
                    style={{ 
                      borderBottom: '1px solid #26262b', 
                      cursor: 'pointer', 
                      background: selectedGame?.game_id === session.game_id ? '#26262b' : 'transparent'
                    }}
                    className="admin-table-row"
                  >
                    <td style={{ padding: '16px', fontWeight: 'bold', color: '#2ecc71' }}>{session.game_id}</td>
                    <td>{session.players?.RED || "RED"} vs {session.players?.BLUE || "BLUE"}</td>
                    <td>Round {session.round}</td>
                    <td>{session.score?.RED ?? 0} : {session.score?.BLUE ?? 0}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '1.2vh',
                        background: session.status === 'finished' ? '#2ecc7133' : '#f1c40f33',
                        color: session.status === 'finished' ? '#2ecc71' : '#f1c40f'
                      }}>
                        {session.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* METRICS DISSECTOR SIDE-WINDOW */}
        {selectedGame && (
          <div style={{ 
            background: '#1a1a1e', 
            borderRadius: '12px', 
            padding: '25px', 
            borderLeft: '4px solid #2ecc71',
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0, fontSize: '2.5vh' }}>Game Analytics: {selectedGame.game_id}</h2>
            <p style={{ opacity: 0.6, fontSize: '1.4vh' }}>Created: {selectedGame.created_at}</p>
            
            <hr style={{ borderColor: '#26262b', margin: '20px 0' }} />
            
            <h3 style={{ fontSize: '2vh' }}>Round History Timeline</h3>
            {selectedGame.history && selectedGame.history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedGame.history.map((roundData, idx) => (
                  <div key={idx} style={{ background: '#26262b', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: '#bbb' }}>ROUND {roundData.round}</span>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <span style={{ color: '#e74c3c' }}>{selectedGame.players?.RED}: <strong>{roundData.RED}</strong></span>
                      <span style={{ color: '#3498db' }}>{selectedGame.players?.BLUE}: <strong>{roundData.BLUE}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ opacity: 0.5, fontStyle: 'italic' }}>No rounds recorded or completed yet.</p>
            )}

            <div style={{ marginTop: '25px', padding: '15px', background: '#c0392b22', borderRadius: '6px', color: '#e74c3c', fontSize: '1.3vh', fontWeight: 'bold' }}>
              ⚠️ INFORMATION PRESERVATION DETECTED: Chat logs and voice discussion protocols are structurally locked away from administrative visibility parameters.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}