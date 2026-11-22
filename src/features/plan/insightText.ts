import type { Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { Catalog } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import type { Insight, Tone } from './insights';

export type InsightView = { key: string; icon: IconName; color: string; title: string; body: string; href: Href };

/** Words, icon, colour and destination for each kind of insight. */
export function useInsightText(catalog: Catalog | undefined) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { money } = useFormat();
  const m = (v: number) => money(v, undefined, { trimZeroCents: true });
  const toneColor: Record<Tone, string> = { bad: colors.danger, warn: colors.warning, good: '#34D399', info: '#38BDF8' };
  const cat = (id: string | null) => (id ? catalog?.byId.get(id) : undefined);

  return (i: Insight, index: number): InsightView => {
    const color = toneColor[i.tone];
    switch (i.kind) {
      case 'budget': {
        const c = cat(i.categoryId);
        const name = c?.label ?? t('budgets.monthly');
        return {
          key: `budget:${i.categoryId ?? 'total'}`,
          icon: c?.iconName ?? 'pie_chart',
          color,
          title: i.pct >= 100 ? t('insights.budgetOver', { name }) : t('insights.budgetWarn', { name }),
          body: t('insights.budgetBody', { pct: i.pct }),
          href: '/plan/budgets',
        };
      }
      case 'pace': {
        let body = t('insights.paceNone');
        if (i.budget !== null) {
          const diff = i.projected - i.budget;
          body = diff > 0 ? t('insights.paceOver', { amount: m(diff) }) : t('insights.paceUnder', { amount: m(-diff) });
        } else if (i.average !== null) {
          body = t('insights.paceAverage', { amount: m(i.average) });
        }
        return { key: 'pace', icon: 'trending_up', color, title: t('insights.paceTitle', { amount: m(i.projected) }), body, href: '/plan/budgets' };
      }
      case 'categoryChange': {
        const c = cat(i.categoryId);
        const name = c?.label ?? '?';
        const up = i.pct > 0;
        return {
          key: `change:${i.categoryId}`,
          icon: c?.iconName ?? (up ? 'trending_up' : 'trending_down'),
          color,
          title: up ? t('insights.upTitle', { name }) : t('insights.downTitle', { name }),
          body: up
            ? t('insights.upBody', { pct: i.pct, amount: m(i.diff) })
            : t('insights.downBody', { pct: Math.abs(i.pct), amount: m(-i.diff) }),
          href: { pathname: '/activity', params: { categoryId: i.categoryId } },
        };
      }
      case 'unusual': {
        const c = cat(i.categoryId);
        return {
          key: `unusual:${index}`,
          icon: 'warning',
          color,
          title: t('insights.unusualTitle', { amount: m(i.amount) }),
          body: t('insights.unusualBody', { name: i.merchant ?? c?.label ?? '?', typical: m(i.typical) }),
          href: { pathname: '/activity', params: { categoryId: i.categoryId } },
        };
      }
      case 'priceUp':
        return {
          key: `price:${i.name}`,
          icon: 'trending_up',
          color,
          title: t('insights.priceTitle', { name: i.name }),
          body: t('insights.priceBody', {
            from: money(i.from, i.currency, { trimZeroCents: true }),
            to: money(i.to, i.currency, { trimZeroCents: true }),
            pct: i.pct,
          }),
          href: '/plan/recurring',
        };
      case 'fixedCosts':
        return {
          key: 'fixed',
          icon: 'autorenew',
          color,
          title: t('insights.fixedTitle', { amount: m(i.monthly) }),
          body: t('insights.fixedBody', { count: i.count, amount: m(i.monthly * 12) }),
          href: '/plan/recurring',
        };
    }
  };
}
