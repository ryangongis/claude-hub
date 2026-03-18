import { useStore } from '../store';

export default function ApprovalQueue() {
  const approvals = useStore(s => s.approvals);
  const approveSession = useStore(s => s.approveSession);
  const denySession = useStore(s => s.denySession);
  const approveAll = useStore(s => s.approveAll);
  const setApprovalQueueOpen = useStore(s => s.setApprovalQueueOpen);
  const setActiveSession = useStore(s => s.setActiveSession);

  return (
    <div className="modal-overlay" onClick={() => setApprovalQueueOpen(false)}>
      <div className="approval-panel" onClick={e => e.stopPropagation()}>
        <div className="approval-header">
          <h2>Approval Queue</h2>
          <div className="approval-header-actions">
            {approvals.length > 0 && (
              <button className="btn-primary small" onClick={approveAll}>
                Approve All ({approvals.length})
              </button>
            )}
            <button className="btn-icon" onClick={() => setApprovalQueueOpen(false)}>&times;</button>
          </div>
        </div>

        <div className="approval-list">
          {approvals.length === 0 ? (
            <div className="approval-empty">
              <p>No pending approvals</p>
              <p className="text-muted">Approvals from all sessions appear here</p>
            </div>
          ) : (
            approvals.map(a => (
              <div key={a.id} className="approval-item">
                <div className="approval-info">
                  <div className="approval-session" onClick={() => { setActiveSession(a.sessionId); setApprovalQueueOpen(false); }}>
                    {a.sessionName}
                  </div>
                  <div className="approval-tool">{a.tool}</div>
                  {a.detail && <div className="approval-detail">{a.detail}</div>}
                  <div className="approval-time">
                    {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
                <div className="approval-actions">
                  <button className="quick-btn approve" onClick={() => approveSession(a.sessionId)}>
                    Approve
                  </button>
                  <button className="quick-btn deny" onClick={() => denySession(a.sessionId)}>
                    Deny
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
