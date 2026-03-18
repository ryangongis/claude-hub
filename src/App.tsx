import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useKeyboard } from './hooks/useKeyboard';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import Toolbar from './components/Toolbar';
import TerminalView from './components/TerminalView';
import ChatPanel from './components/ChatPanel';
import GridView from './components/GridView';
import SplitPane from './components/SplitPane';
import CreateSessionModal from './components/CreateSessionModal';
import ApprovalQueue from './components/ApprovalQueue';
import OutputSearch from './components/OutputSearch';
import NotificationToast from './components/NotificationToast';
import ActivityTimeline from './components/ActivityTimeline';
import StatusBar from './components/StatusBar';

export default function App() {
  const connected = useSocket();
  const activeSessionId = useStore(s => s.activeSessionId);
  const openTabs = useStore(s => s.openTabs);
  const viewMode = useStore(s => s.viewMode);
  const searchOpen = useStore(s => s.searchOpen);
  const approvalQueueOpen = useStore(s => s.approvalQueueOpen);

  const [showCreate, setShowCreate] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useKeyboard(() => setShowCreate(true));

  // Request desktop notification permission on mount
  const enableNotifications = useStore(s => s.enableNotifications);
  useEffect(() => { enableNotifications(); }, []);

  return (
    <div className={`app ${chatCollapsed ? 'chat-collapsed' : ''}`}>
      <Sidebar onNewSession={() => setShowCreate(true)} />

      <div className="main-area">
        <Toolbar
          onToggleChat={() => setChatCollapsed(!chatCollapsed)}
          chatCollapsed={chatCollapsed}
          onToggleTimeline={() => setTimelineOpen(!timelineOpen)}
          timelineOpen={timelineOpen}
        />
        <TabBar />

        {timelineOpen && <ActivityTimeline />}

        {searchOpen && <OutputSearch />}

        <div className="content-area">
          <div className="terminal-area">
            {viewMode === 'grid' ? (
              <GridView />
            ) : viewMode === 'split' ? (
              <SplitPane />
            ) : (
              <>
                {openTabs.map(id => (
                  <div
                    key={id}
                    className="terminal-wrapper"
                    style={{ display: id === activeSessionId ? 'flex' : 'none' }}
                  >
                    <TerminalView sessionId={id} />
                  </div>
                ))}
                {!activeSessionId && (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h2>Claude Hub</h2>
                    <p>Multi-session Claude Code manager</p>
                    <div className="empty-shortcuts">
                      <span><kbd>Ctrl+N</kbd> New session</span>
                      <span><kbd>Ctrl+1-9</kbd> Switch tabs</span>
                      <span><kbd>Ctrl+Shift+G</kbd> Grid view</span>
                      <span><kbd>Ctrl+F</kbd> Search</span>
                    </div>
                    <button className="btn-primary" onClick={() => setShowCreate(true)}>
                      New Session
                    </button>
                    {!connected && <p className="status-disconnected">Connecting to server...</p>}
                  </div>
                )}
              </>
            )}
          </div>

          {!chatCollapsed && <ChatPanel />}
        </div>

        <StatusBar />
      </div>

      {approvalQueueOpen && <ApprovalQueue />}
      {showCreate && <CreateSessionModal onClose={() => setShowCreate(false)} />}
      <NotificationToast />
    </div>
  );
}
