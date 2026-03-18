import { useState } from 'react';
import { useStore } from '../store';
import type { Session } from '../types';

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  waiting: '#f59e0b',
  idle: '#22d3ee',
  exited: '#6b7280',
  error: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'working',
  waiting: 'approval',
  idle: 'idle',
  exited: 'exited',
  error: 'error',
};

function SessionItem({ session, isActive }: { session: Session; isActive: boolean }) {
  const setActiveSession = useStore(s => s.setActiveSession);
  const openTab = useStore(s => s.openTab);
  const removeSession = useStore(s => s.removeSession);
  const killSession = useStore(s => s.killSession);
  const approveSession = useStore(s => s.approveSession);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(session.notes || '');
  const send = useStore(s => s.send);

  const dirName = session.cwd.split(/[/\\]/).filter(Boolean).pop() || session.cwd;

  const handleSaveNotes = () => {
    send({ type: 'set_notes', id: session.id, notes, tags: session.tags });
    setShowNotes(false);
  };

  return (
    <div className={`session-item ${isActive ? 'active' : ''}`}>
      <div
        className="session-main"
        onClick={() => { setActiveSession(session.id); openTab(session.id); }}
      >
        <span
          className="status-dot"
          style={{ backgroundColor: STATUS_COLORS[session.status] || '#6b7280' }}
        />
        <div className="session-info">
          <div className="session-name-row">
            <span className="session-name">{session.name}</span>
            <span className="badge" style={{ color: STATUS_COLORS[session.status] }}>
              {STATUS_LABELS[session.status] || session.status}
            </span>
          </div>
          <div className="session-detail">
            {session.gitInfo ? (
              <span className="session-git">
                <span className="git-branch">{session.gitInfo.branch}</span>
                {session.gitInfo.changes > 0 && <span className="git-changes">+{session.gitInfo.changes}</span>}
              </span>
            ) : (
              dirName
            )}
          </div>
          {session.tags?.length > 0 && (
            <div className="session-tags">
              {session.tags.map(t => <span key={t} className="session-tag">{t}</span>)}
            </div>
          )}
          {session.notes && <div className="session-notes-preview">{session.notes}</div>}
          {session.costInfo && session.costInfo.inputTokens > 0 && (
            <div className="session-cost">
              {((session.costInfo.inputTokens + session.costInfo.outputTokens) / 1000).toFixed(1)}k tokens
            </div>
          )}
        </div>
      </div>

      <div className="session-actions">
        {session.status === 'waiting' && (
          <button
            className="session-action-btn approve-small"
            onClick={e => { e.stopPropagation(); approveSession(session.id); }}
            title="Approve"
          >
            &#10003;
          </button>
        )}
        <button
          className="session-action-btn"
          onClick={e => { e.stopPropagation(); setShowNotes(!showNotes); }}
          title="Notes"
        >
          &#9998;
        </button>
        {session.status !== 'exited' && (
          <button
            className="session-action-btn danger"
            onClick={e => { e.stopPropagation(); killSession(session.id); }}
            title="Kill"
          >
            &#9632;
          </button>
        )}
        <button
          className="session-action-btn danger"
          onClick={e => { e.stopPropagation(); removeSession(session.id); }}
          title="Remove"
        >
          &times;
        </button>
      </div>

      {showNotes && (
        <div className="session-notes-edit" onClick={e => e.stopPropagation()}>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Session notes..."
            rows={3}
          />
          <div className="notes-actions">
            <button className="btn-small" onClick={handleSaveNotes}>Save</button>
            <button className="btn-small secondary" onClick={() => setShowNotes(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ onNewSession }: { onNewSession: () => void }) {
  const sessions = useStore(s => s.sessions);
  const activeSessionId = useStore(s => s.activeSessionId);
  const connected = useStore(s => s.connected);
  const approvals = useStore(s => s.approvals);

  const activeSessions = sessions.filter(s => s.status !== 'exited');
  const exitedSessions = sessions.filter(s => s.status === 'exited');

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className={`conn-dot ${connected ? 'on' : ''}`} />
          SESSIONS
          {approvals.length > 0 && (
            <span className="sidebar-approval-count">{approvals.length}</span>
          )}
        </div>
        <button className="btn-icon" onClick={onNewSession} title="New session (Ctrl+N)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="session-list">
        {activeSessions.map(s => (
          <SessionItem key={s.id} session={s} isActive={s.id === activeSessionId} />
        ))}

        {exitedSessions.length > 0 && (
          <>
            <div className="session-divider">Ended</div>
            {exitedSessions.map(s => (
              <SessionItem key={s.id} session={s} isActive={s.id === activeSessionId} />
            ))}
          </>
        )}

        {sessions.length === 0 && (
          <div className="session-empty">
            No sessions yet.<br />
            Click + or press Ctrl+N.
          </div>
        )}
      </div>
    </div>
  );
}
