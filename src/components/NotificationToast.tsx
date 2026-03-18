import { useStore } from '../store';

const TYPE_COLORS: Record<string, string> = {
  info: '#22d3ee',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

const TYPE_ICONS: Record<string, string> = {
  info: '\u2139',
  success: '\u2713',
  warning: '\u26A0',
  error: '\u2717',
};

export default function NotificationToast() {
  const toasts = useStore(s => s.toasts);
  const removeToast = useStore(s => s.removeToast);
  const setActiveSession = useStore(s => s.setActiveSession);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="toast"
          style={{ borderLeftColor: TYPE_COLORS[toast.type] }}
          onClick={() => {
            if (toast.sessionId) setActiveSession(toast.sessionId);
            removeToast(toast.id);
          }}
        >
          <span className="toast-icon" style={{ color: TYPE_COLORS[toast.type] }}>
            {TYPE_ICONS[toast.type]}
          </span>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            {toast.body && <div className="toast-body">{toast.body}</div>}
          </div>
          <button className="toast-close" onClick={e => { e.stopPropagation(); removeToast(toast.id); }}>
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
