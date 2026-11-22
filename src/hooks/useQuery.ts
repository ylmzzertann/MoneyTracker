import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useEffectEvent, useState } from 'react';

import { useDataVersion } from '@/store/dataVersion';

type QueryState<T> = { data: T | undefined; error: unknown; loading: boolean };

/**
 * Runs an async database read. It re-runs when `key` changes (put every input
 * of `fn` into the key) and whenever the data version is bumped after a write.
 */
export function useQuery<T>(key: string, fn: (db: SQLiteDatabase) => Promise<T>): QueryState<T> {
  const db = useSQLiteContext();
  const version = useDataVersion((s) => s.version);
  const [state, setState] = useState<QueryState<T>>({ data: undefined, error: null, loading: true });
  const run = useEffectEvent(() => fn(db));

  useEffect(() => {
    let alive = true;
    run().then(
      (data) => {
        if (alive) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (alive) setState((s) => ({ ...s, error, loading: false }));
      },
    );
    return () => {
      alive = false;
    };
  }, [db, key, version]);

  return state;
}
