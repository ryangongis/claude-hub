import { useEffect } from 'react';
import { useStore } from '../store';
import TerminalView from './TerminalView';

export default function SplitPane() {
  const openTabs = useStore(s => s.openTabs);
  const sessions = useStore(s => s.sessions);
  const splitIds = useStore(s => s.splitIds);
  const setSplitId = useStore(s => s.setSplitId);
  const setActiveSession = useStore(s => s.setActiveSession);

  // Auto-assign split panes if not set
  useEffect(() => {
    if (!splitIds[0] && openTabs.length > 0) setSplitId(0, openTabs[0]);
    if (!splitIds[1] && openTabs.length > 1) setSplitId(1, openTabs[1]);
  }, [openTabs]);

  const renderPane = (slot: 0 | 1) => {
    const sessionId = splitIds[slot];
    const session = sessions.find(s => s.id === sessionId);

    return (
      <div className="split-pane" onClick={() => sessionId && setActiveSession(sessionId)}>
        <div className="split-pane-header">
          <select
            className="split-select"
            value={sessionId || ''}
            onChange={e => setSplitId(slot, e.target.value || null)}
          >
            <option value="">-- Select session --</option>
            {openTabs.map(id => {
              const s = sessions.find(s => s.id === id);
              return <option key={id} value={id}>{s?.name || id}</option>;
            })}
          </select>
          {session && (
            <span className={`split-status status-${session.status}`}>
              {session.status}
            </span>
          )}
        </div>
        {sessionId ? (
          <div className="split-terminal">
            <TerminalView sessionId={sessionId} />
          </div>
        ) : (
          <div className="split-empty">Select a session</div>
        )}
      </div>
    );
  };

  return (
    <div className="split-view">
      {renderPane(0)}
      <div className="split-divider" />
      {renderPane(1)}
    </div>
  );
}
