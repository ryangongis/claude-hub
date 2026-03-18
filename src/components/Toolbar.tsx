import { useStore } from '../store';
import type { ViewMode } from '../types';

const VIEW_ICONS: Record<ViewMode, string> = {
  tabs: '\u2630',   // hamburger
  grid: '\u2637',   // grid
  split: '\u2503',  // vertical split
};

interface Props {
  onToggleChat: () => void;
  chatCollapsed: boolean;
  onToggleTimeline: () => void;
  timelineOpen: boolean;
}

export default function Toolbar({ onToggleChat, chatCollapsed, onToggleTimeline, timelineOpen }: Props) {
  const viewMode = useStore(s => s.viewMode);
  const setViewMode = useStore(s => s.setViewMode);
  const approvals = useStore(s => s.approvals);
  const setApprovalQueueOpen = useStore(s => s.setApprovalQueueOpen);
  const approvalQueueOpen = useStore(s => s.approvalQueueOpen);
  const setSearchOpen = useStore(s => s.setSearchOpen);
  const searchOpen = useStore(s => s.searchOpen);

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-group">
          {(['tabs', 'grid', 'split'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              className={`toolbar-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => setViewMode(mode)}
              title={`${mode} view`}
            >
              {VIEW_ICONS[mode]}
            </button>
          ))}
        </div>

        <button
          className={`toolbar-btn ${timelineOpen ? 'active' : ''}`}
          onClick={onToggleTimeline}
          title="Activity timeline"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h4l3-9 4 18 3-9h4" />
          </svg>
        </button>
      </div>

      <div className="toolbar-right">
        <button
          className={`toolbar-btn ${searchOpen ? 'active' : ''}`}
          onClick={() => setSearchOpen(!searchOpen)}
          title="Search (Ctrl+F)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </button>

        <button
          className={`toolbar-btn approval-btn ${approvalQueueOpen ? 'active' : ''}`}
          onClick={() => setApprovalQueueOpen(!approvalQueueOpen)}
          title="Approval queue (Ctrl+Shift+A)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          {approvals.length > 0 && <span className="approval-badge">{approvals.length}</span>}
        </button>

        <button
          className={`toolbar-btn ${chatCollapsed ? '' : 'active'}`}
          onClick={onToggleChat}
          title="Toggle chat panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
