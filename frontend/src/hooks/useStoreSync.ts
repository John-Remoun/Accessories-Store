import { useEffect, useState } from 'react';
import { store } from '../services/store';

export function useStoreSync() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick(prev => prev + 1);
    });
    return unsubscribe;
  }, []);
}
