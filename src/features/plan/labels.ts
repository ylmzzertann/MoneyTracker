import { useTranslation } from 'react-i18next';

import type { RecurringRule } from '@/db/types';
import { useFormat } from '@/hooks/useFormat';
import { parseLocalISO } from '@/lib/dates';

/** "Monthly · day 15", "Weekly · Monday", "Yearly · 3 March". */
export function useFrequencyLabel() {
  const { t } = useTranslation();
  const { date } = useFormat();
  return (r: Pick<RecurringRule, 'frequency' | 'interval' | 'anchorDay' | 'nextDue'>) => {
    const d = parseLocalISO(r.nextDue);
    if (r.frequency === 'week') {
      const day = date(d, { weekday: 'long' });
      return r.interval > 1 ? t('recurring.everyNWeeks', { count: r.interval, day }) : t('recurring.weekly', { day });
    }
    if (r.frequency === 'year') return t('recurring.yearly', { date: date(d, { day: 'numeric', month: 'long' }) });
    const day = r.anchorDay ?? d.getDate();
    return r.interval > 1 ? t('recurring.everyNMonths', { count: r.interval, day }) : t('recurring.monthly', { day });
  };
}
