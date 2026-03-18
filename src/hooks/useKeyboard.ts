import { useEffect } from 'react';
import { useStore } from '../store';

export function useKeyboard(onNewSession: () => void) {
  const openTabs = useStore(s => s.openTabs);
  const setActiveSession = useStore(s => s.setActiveSession);
  const closeTab = useStore(s => s.closeTab);
  const activeSessionId = useStore(s => s.activeSessionId);
  const setViewMode = useStore(s => s.setViewMode);
  const viewMode = useStore(s => s.viewMode);
  const searchOpen = useStore(s => s.searchOpen);
  const setSearchOpen = useStore(s => s.setSearchOpen);
  const approvalQueueOpen = useStore(s => s.approvalQueueOpen);
  const setApprovalQueueOpen = useStore(s => s.setApprovalQueueOpen);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Ctrl+N: New session
      if (ctrl && !shift && e.key === 'n') {
        e.preventDefault();
        onNewSession();
        return;
      }

      // Ctrl+W: Close tab
      if (ctrl && !shift && e.key === 'w') {
        e.preventDefault();
        if (activeSessionId) closeTab(activeSessionId);
        return;
      }

      // Ctrl+1-9: Switch to tab by position
      if (ctrl && !shift && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < openTabs.length) setActiveSession(openTabs[idx]);
        return;
      }

      // Ctrl+F: Search
      if (ctrl && !shift && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
        return;
      }

      // Ctrl+Shift+G: Grid view toggle
      if (ctrl && shift && e.key === 'G') {
        e.preventDefault();
        setViewMode(viewMode === 'grid' ? 'tabs' : 'grid');
        return;
      }

      // Ctrl+Shift+S: Split view toggle
      if (ctrl && shift && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setViewMode(viewMode === 'split' ? 'tabs' : 'split');
        return;
      }

      // Ctrl+Shift+A: Approval queue
      if (ctrl && shift && e.key === 'A') {
        e.preventDefault();
        setApprovalQueueOpen(!approvalQueueOpen);
        return;
      }

      // Escape: Close panels
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); return; }
        if (approvalQueueOpen) { setApprovalQueueOpen(false); return; }
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: Cycle sessions
      if (ctrl && e.key === 'Tab') {
        e.preventDefault();
        const idx = openTabs.indexOf(activeSessionId || '');
        if (shift) {
          const prev = idx <= 0 ? openTabs.length - 1 : idx - 1;
          if (openTabs[prev]) setActiveSession(openTabs[prev]);
        } else {
          const next = idx >= openTabs.length - 1 ? 0 : idx + 1;
          if (openTabs[next]) setActiveSession(openTabs[next]);
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openTabs, activeSessionId, viewMode, searchOpen, approvalQueueOpen]);
}
