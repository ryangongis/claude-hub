import { useStore } from '../store';

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  waiting: '#f59e0b',
  idle: '#22d3ee',
  exited: '#6b7280',
  error: '#ef4444',
};

export default function TabBar() {
  const sessions = useStore(s => s.sessions);
  const openTabs = useStore(s => s.openTabs);
  const activeSessionId = useStore(s => s.activeSessionId);
  const setActiveSession = useStore(s => s.setActiveSession);
  const closeTab = useStore(s => s.closeTab);

  if (openTabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {openTabs.map((id, idx) => {
        const session = sessions.find(s => s.id === id);
        if (!session) return null;
        const isActive = id === activeSessionId;
        return (
          <div
            key={id}
            className={`tab ${isActive ? 'active' : ''} ${session.status === 'waiting' ? 'tab-waiting' : ''}`}
            onClick={() => setActiveSession(id)}
          >
            <span className="tab-dot" style={{ backgroundColor: STATUS_COLORS[session.status] || '#6b7280' }} />
            <span className="tab-name">{session.name}</span>
            <span className="tab-idx">{idx + 1}</span>
            <button className="tab-close" onClick={e => { e.stopPropagation(); closeTab(id); }}>
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
