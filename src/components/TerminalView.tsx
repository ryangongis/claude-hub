import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useStore, terminalEmitter, searchAddons } from '../store';
import '@xterm/xterm/css/xterm.css';

const THEME = {
  background: '#080b10',
  foreground: '#e6edf3',
  cursor: '#22d3ee',
  cursorAccent: '#080b10',
  selectionBackground: '#264f7880',
  selectionForeground: '#e6edf3',
  black: '#21262d',
  red: '#f85149',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39d2c0',
  white: '#e6edf3',
  brightBlack: '#484f58',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
};

interface Props {
  sessionId: string;
}

export default function TerminalView({ sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const send = useStore(s => s.send);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: THEME,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 15000,
      allowProposedApi: true,
      convertEol: false,
    });

    const fit = new FitAddon();
    const search = new SearchAddon();

    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);

    // Small delay to ensure DOM is ready for fit
    requestAnimationFrame(() => {
      try { fit.fit(); } catch {}
    });

    terminalRef.current = term;
    fitRef.current = fit;
    searchAddons.set(sessionId, search);

    // Input -> server
    term.onData((data) => {
      send({ type: 'input', id: sessionId, data });
    });

    // Subscribe to output
    const unsub = terminalEmitter.subscribe(sessionId, (data) => {
      term.write(data);
    });

    // Replay buffer
    const buffer = terminalEmitter.getBuffer(sessionId);
    if (buffer) term.write(buffer);

    // Request server replay too
    send({ type: 'replay', id: sessionId });

    // Initial size
    send({ type: 'resize', id: sessionId, cols: term.cols, rows: term.rows });

    // Resize observer
    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
        send({ type: 'resize', id: sessionId, cols: term.cols, rows: term.rows });
      } catch {}
    });
    observer.observe(containerRef.current);

    return () => {
      unsub();
      observer.disconnect();
      searchAddons.delete(sessionId);
      term.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  return <div ref={containerRef} className="terminal-container" />;
}
