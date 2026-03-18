import { useState, useRef, useEffect } from 'react';
import { useStore, terminalEmitter } from '../store';

const EVENT_ICONS: Record<string, string> = {
  status: '\u25CF',
  approval: '\u26A0',
  complete: '\u2713',
  error: '\u2717',
  info: '\u2139',
  auto_approved: '\u2713',
};

const EVENT_COLORS: Record<string, string> = {
  status: '#22d3ee',
  approval: '#f59e0b',
  complete: '#10b981',
  error: '#ef4444',
  info: '#8b949e',
  auto_approved: '#10b981',
};

export default function ChatPanel() {
  const activeSessionId = useStore(s => s.activeSessionId);
  const sessions = useStore(s => s.sessions);
  const messages = useStore(s => activeSessionId ? s.messages[activeSessionId] || [] : []);
  const events = useStore(s => activeSessionId ? s.events[activeSessionId] || [] : []);
  const send = useStore(s => s.send);
  const addChatMessage = useStore(s => s.addChatMessage);
  const getTranscript = useStore(s => s.getTranscript);
  const copySessionOutput = useStore(s => s.copySessionOutput);

  const [tab, setTab] = useState<'chat' | 'events'>('chat');
  const [input, setInput] = useState('');
  const [pasteFrom, setPasteFrom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const otherSessions = sessions.filter(s => s.id !== activeSessionId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, events, tab]);

  const handleSend = () => {
    if (!input.trim() || !activeSessionId) return;
    addChatMessage(activeSessionId, 'user', input.trim());
    send({ type: 'chat', id: activeSessionId, message: input.trim() });
    setInput('');
  };

  const handleQuickAction = (text: string) => {
    if (!activeSessionId) return;
    send({ type: 'input', id: activeSessionId, data: text + '\r' });
    addChatMessage(activeSessionId, 'system', text === 'y' ? 'Approved' : text === 'n' ? 'Denied' : 'Cancelled');
  };

  const handlePasteFrom = (sessionId: string) => {
    const output = copySessionOutput(sessionId);
    const name = sessions.find(s => s.id === sessionId)?.name || sessionId;
    setInput(prev => prev + `\n[From ${name}]:\n${output.slice(-2000)}`);
    setPasteFrom(false);
  };

  if (!activeSessionId) {
    return (
      <div className="chat-panel">
        <div className="chat-empty"><p>Select a session to see chat</p></div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-tabs">
          <button className={`chat-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
            Chat
          </button>
          <button className={`chat-tab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
            Events {events.length > 0 && <span className="event-count">{events.length}</span>}
          </button>
        </div>
        <div className="chat-actions">
          <button
            className="btn-icon small"
            onClick={() => activeSessionId && getTranscript(activeSessionId)}
            title="Export transcript"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {tab === 'chat' ? (
          messages.length > 0 ? (
            messages.map(msg => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <div className="bubble-header">
                  <span className="bubble-role">
                    {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Claude' : 'System'}
                  </span>
                  <span className="bubble-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="bubble-content">{msg.content}</div>
              </div>
            ))
          ) : (
            <div className="chat-hint">
              <p>Messages go directly to the Claude CLI session.</p>
              <p>You can also type in the terminal.</p>
            </div>
          )
        ) : (
          events.length > 0 ? (
            events.map(evt => (
              <div key={evt.id} className="event-item">
                <span className="event-icon" style={{ color: EVENT_COLORS[evt.type] || '#8b949e' }}>
                  {EVENT_ICONS[evt.type] || '\u25CF'}
                </span>
                <span className="event-content">{evt.content}</span>
                <span className="event-time">
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))
          ) : (
            <div className="chat-hint"><p>Session events will appear here.</p></div>
          )
        )}
      </div>

      <div className="quick-actions">
        <button className="quick-btn approve" onClick={() => handleQuickAction('y')}>Approve</button>
        <button className="quick-btn deny" onClick={() => handleQuickAction('n')}>Deny</button>
        <button className="quick-btn" onClick={() => handleQuickAction('\x03')}>Cancel</button>
        <div className="quick-spacer" />
        <div className="paste-from-wrapper">
          <button className="quick-btn" onClick={() => setPasteFrom(!pasteFrom)}>
            Paste from...
          </button>
          {pasteFrom && otherSessions.length > 0 && (
            <div className="paste-dropdown">
              {otherSessions.map(s => (
                <button key={s.id} className="paste-option" onClick={() => handlePasteFrom(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder="Send message..."
          rows={input.includes('\n') ? 3 : 1}
        />
        <button className="send-btn" onClick={handleSend} disabled={!input.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
