import { useStore } from '../store';
import type { SessionStatus } from '../types';

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  waiting: '#f59e0b',
  idle: '#22d3ee',
  exited: '#6b7280',
  error: '#ef4444',
};

export default function ActivityTimeline() {
  const sessions = useStore(s => s.sessions);
  const setActiveSession = useStore(s => s.setActiveSession);

  if (sessions.length === 0) return null;

  // Find time range across all sessions
  const now = Date.now();
  const earliest = Math.min(...sessions.map(s => s.createdAt));
  const totalSpan = Math.max(now - earliest, 60000); // At least 1 minute

  return (
    <div className="timeline">
      <div className="timeline-header">
        <span className="timeline-label">Activity</span>
        <div className="timeline-legend">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              {status}
            </span>
          ))}
        </div>
      </div>
      <div className="timeline-body">
        {sessions.map(session => {
          const history = session.statusHistory || [];
          return (
            <div
              key={session.id}
              className="timeline-row"
              onClick={() => setActiveSession(session.id)}
              title={session.name}
            >
              <div className="timeline-name">{session.name}</div>
              <div className="timeline-bar">
                {history.map((entry, i) => {
                  const start = entry.timestamp - earliest;
                  const end = (history[i + 1]?.timestamp || now) - earliest;
                  const left = (start / totalSpan) * 100;
                  const width = Math.max(((end - start) / totalSpan) * 100, 0.5);
                  return (
                    <div
                      key={i}
                      className="timeline-segment"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: STATUS_COLORS[entry.status] || '#6b7280',
                      }}
                      title={`${entry.status} at ${new Date(entry.timestamp).toLocaleTimeString()}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
