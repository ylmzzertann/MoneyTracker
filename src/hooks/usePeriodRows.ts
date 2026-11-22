import { loadRates } from '@/db/repos/fx';
import { reportRows } from '@/db/repos/transactions';
import { convertRows, type Converted } from '@/features/reports/aggregate';
import { toLocalISO, type DateRange } from '@/lib/dates';
import { useSettings } from '@/store/settings';

import { useQuery } from './useQuery';

export type PeriodRows = { rows: Converted[]; missing: number };

/** Report rows for a date range, converted to the main currency. */
export function usePeriodRows(range: DateRange): PeriodRows | undefined {
  const baseCurrency = useSettings((s) => s.baseCurrency);
  const start = toLocalISO(range.start);
  const end = toLocalISO(range.end);
  const raw = useQuery(`rows:${start}:${end}`, (db) => reportRows(db, start, end)).data;
  const fx = useQuery('fx', loadRates).data;
  if (!raw || !fx) return undefined;
  return convertRows(raw, baseCurrency, fx.rates);
}
