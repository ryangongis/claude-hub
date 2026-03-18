import { useRef, useEffect } from 'react';
import { useStore, searchAddons } from '../store';

export default function OutputSearch() {
  const activeSessionId = useStore(s => s.activeSessionId);
  const searchQuery = useStore(s => s.searchQuery);
  const setSearchQuery = useStore(s => s.setSearchQuery);
  const setSearchOpen = useStore(s => s.setSearchOpen);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = (dir: 'next' | 'prev') => {
    if (!activeSessionId || !searchQuery) return;
    const addon = searchAddons.get(activeSessionId);
    if (!addon) return;
    if (dir === 'next') addon.findNext(searchQuery);
    else addon.findPrevious(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch(e.shiftKey ? 'prev' : 'next');
    }
    if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  return (
    <div className="search-bar">
      <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        ref={inputRef}
        className="search-input"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search terminal output... (Enter=next, Shift+Enter=prev)"
      />
      <button className="search-nav" onClick={() => doSearch('prev')} title="Previous (Shift+Enter)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
      <button className="search-nav" onClick={() => doSearch('next')} title="Next (Enter)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <button className="search-close" onClick={() => setSearchOpen(false)}>&times;</button>
    </div>
  );
}
