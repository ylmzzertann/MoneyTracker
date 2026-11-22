import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { loadRates, saveRates } from '@/db/repos/fx';
import { fetchLatestRates } from '@/lib/fx';
import { bumpData } from '@/store/dataVersion';

const MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Quietly refreshes exchange rates once they are older than 12 hours. Offline is fine: old rates stay. */
export async function refreshRates(db: ReturnType<typeof useSQLiteContext>, force = false): Promise<boolean> {
  const { fetchedAt } = await loadRates(db);
  if (!force && fetchedAt && Date.now() - Date.parse(fetchedAt) < MAX_AGE_MS) return true;
  const { date, rates } = await fetchLatestRates();
  await saveRates(db, date, rates);
  bumpData();
  return true;
}

export function useFxRefresh() {
  const db = useSQLiteContext();
  useEffect(() => {
    refreshRates(db).catch(() => {
      // Offline or the service is down: keep using stored rates.
    });
  }, [db]);
}
