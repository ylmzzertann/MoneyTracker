import type { SQLiteDatabase } from 'expo-sqlite';

import type { RateTable } from '@/lib/fx';
import { nowUtc } from '@/lib/id';

export async function saveRates(db: SQLiteDatabase, date: string, rates: RateTable): Promise<void> {
  const now = nowUtc();
  await db.withTransactionAsync(async () => {
    for (const [quote, rate] of Object.entries(rates)) {
      await db.runAsync(
        `INSERT INTO fx_rates (quote, rate, date, fetched_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(quote) DO UPDATE SET rate = excluded.rate, date = excluded.date, fetched_at = excluded.fetched_at`,
        quote,
        rate,
        date,
        now,
      );
    }
  });
}

export async function loadRates(
  db: SQLiteDatabase,
): Promise<{ rates: RateTable; date: string | null; fetchedAt: string | null }> {
  const rows = await db.getAllAsync<{ quote: string; rate: number; date: string; fetched_at: string }>(
    'SELECT * FROM fx_rates',
  );
  const rates: RateTable = { EUR: 1 };
  let date: string | null = null;
  let fetchedAt: string | null = null;
  for (const r of rows) {
    rates[r.quote] = r.rate;
    date = r.date;
    fetchedAt = r.fetched_at;
  }
  return { rates, date, fetchedAt };
}
