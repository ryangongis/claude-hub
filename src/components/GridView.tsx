import { useStore } from '../store';
import TerminalView from './TerminalView';

export default function GridView() {
  const openTabs = useStore(s => s.openTabs);
  const sessions = useStore(s => s.sessions);
  const setActiveSession = useStore(s => s.setActiveSession);
  const activeSessionId = useStore(s => s.activeSessionId);

  if (openTabs.length === 0) {
    return <div className="empty-state"><p>No open sessions</p></div>;
  }

  return (
    <div className="grid-view" style={{
      gridTemplateColumns: `repeat(${Math.min(openTabs.length, 3)}, 1fr)`,
    }}>
      {openTabs.map(id => {
        const session = sessions.find(s => s.id === id);
        const isActive = id === activeSessionId;
        return (
          <div
            key={id}
            className={`grid-cell ${isActive ? 'active' : ''}`}
            onClick={() => setActiveSession(id)}
          >
            <div className="grid-cell-header">
              <span className="grid-cell-name">{session?.name || id}</span>
              <span className={`grid-cell-status status-${session?.status}`}>
                {session?.status}
              </span>
            </div>
            <div className="grid-cell-terminal">
              <TerminalView sessionId={id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
