import { useStore } from '../store';

export default function StatusBar() {
  const sessions = useStore(s => s.sessions);
  const connected = useStore(s => s.connected);
  const approvals = useStore(s => s.approvals);
  const viewMode = useStore(s => s.viewMode);
  const activeSessionId = useStore(s => s.activeSessionId);

  const active = sessions.filter(s => s.status === 'active' || s.status === 'idle').length;
  const waiting = sessions.filter(s => s.status === 'waiting').length;
  const totalCost = sessions.reduce((sum, s) => sum + (s.costInfo?.estimatedCost || 0), 0);
  const totalTokens = sessions.reduce((sum, s) => sum + (s.costInfo?.inputTokens || 0) + (s.costInfo?.outputTokens || 0), 0);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const git = activeSession?.gitInfo;

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`status-conn ${connected ? 'on' : ''}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="status-sep" />
        <span>{active} active</span>
        {waiting > 0 && <span className="status-warning">{waiting} waiting</span>}
        {approvals.length > 0 && (
          <span className="status-warning">{approvals.length} pending approvals</span>
        )}
      </div>

      <div className="status-center">
        {git && (
          <span className="status-git">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            {git.branch}
            {git.changes > 0 && <span className="git-changes">+{git.changes}</span>}
          </span>
        )}
      </div>

      <div className="status-right">
        {totalTokens > 0 && (
          <span className="status-cost" title={`${totalTokens.toLocaleString()} tokens`}>
            {totalCost > 0 ? `$${totalCost.toFixed(3)}` : `${(totalTokens / 1000).toFixed(1)}k tok`}
          </span>
        )}
        <span className="status-view">{viewMode}</span>
        <span className="status-kbd" title="Ctrl+N: New | Ctrl+1-9: Switch | Ctrl+F: Search">
          <kbd>?</kbd>
        </span>
      </div>
    </div>
  );
}
