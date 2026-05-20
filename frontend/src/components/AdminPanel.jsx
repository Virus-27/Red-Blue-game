import { useState, useEffect } from 'react';

export default function AdminPanel({ API_BASE, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/game/admin/sessions`;
      if (statusFilter) url += `?status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter]);

  const getStatusBadgeStyles = (status) => {
    const normalStatus = status ? status.toUpperCase() : "";
    if (normalStatus === 'ABANDONED') {
      return { background: '#e74c3c22', color: '#e74c3c' }; 
    } else if (normalStatus === 'SURRENDERED') {
      return { background: '#e67e2222', color: '#e67e22' }; 
    } else if (normalStatus === 'FINISHED') {
      return { background: '#2ecc7122', color: '#2ecc71' }; 
    } else {
      return { background: '#3498db22', color: '#3498db' }; 
    }
  };

  return (
    <div style={{ color: '#fff', padding: '40px', fontFamily: 'sans-serif', height: '100vh', boxSizing: 'border-box', background: '#0e0b16', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #26262b', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '3.5vh', margin: 0, color: '#ffa502', fontWeight: '900' }}>CENTRAL CONTROL ADMIN PANEL</h1>
          <p style={{ opacity: 0.6, fontSize: '1.6vh', margin: '5px 0 0 0' }}>Real-time database session inspector metrics</p>
        </div>
        <button onClick={onBack} className="main-btn" style={{ padding: '10px 25px' }}>← MENU BACK</button>
      </div>

      <div style={{ display: 'flex', gap: '20px', background: '#13111c', padding: '20px', borderRadius: '10px', border: '1px solid #232033', marginBottom: '30px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '250px' }}>
          <label style={{ fontSize: '1.4vh', opacity: 0.7 }}>FILTER BY GAME STATUS</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ background: '#242132', color: '#fff', border: '1px solid #3a374c', padding: '8px', borderRadius: '6px' }}>
            <option value="">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="finished">Finished</option>
            <option value="abandoned">Abandoned</option>
            <option value="surrendered">Surrendered</option>
          </select>
        </div>
        <button onClick={fetchSessions} className="main-btn" style={{ alignSelf: 'flex-end', padding: '10px 20px' }}>REFRESH DATA Grid</button>
      </div>

      <div style={{ background: '#13111c', borderRadius: '12px', padding: '20px', border: '1px solid #232033' }}>
        {loading ? (
          <p>Loading centralized grids...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #232033', opacity: 0.7, fontSize: '1.6vh' }}>
                <th style={{ padding: '12px' }}>GAME ID</th>
                <th>PLAYERS</th>
                <th>CURRENT ROUND</th>
                <th>SCORE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const badgeStyles = getStatusBadgeStyles(session.status);
                return (
                  <tr key={session.game_id} style={{ borderBottom: '1px solid #232033', fontSize: '1.5vh' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 'bold', color: '#ffa502' }}>{session.game_id}</td>
                    <td>RED: {session.players?.RED || 'None'} | BLUE: {session.players?.BLUE || 'None'}</td>
                    <td>Round {session.round}</td>
                    <td>RED: {session.score?.RED} vs BLUE: {session.score?.BLUE}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '4px', 
                        fontSize: '1.3vh', 
                        fontWeight: 'bold',
                        ...badgeStyles
                      }}>
                        {session.status ? session.status.toUpperCase() : "UNKNOWN"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}