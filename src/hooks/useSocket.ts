import { useEffect } from 'react';
import { useStore } from '../store';

export function useSocket() {
  const connect = useStore(s => s.connect);
  const connected = useStore(s => s.connected);

  useEffect(() => {
    if (!connected) {
      connect();
    }
  }, []);

  return connected;
}
