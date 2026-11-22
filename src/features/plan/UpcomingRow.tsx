import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/CategoryTile';
import { SwipeRow, type SwipeAction } from '@/components/SwipeRow';
import { Txt } from '@/components/ui';
import type { Catalog } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { parseLocalISO } from '@/lib/dates';
import { tint, useTheme } from '@/theme';
import { iconOrDefault } from '@/theme/icons';

import type { Upcoming } from './upcoming';

/** "in 3 days" / "today" / "2 days late" chip for a due date. */
export function DueChip({ days }: { days: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const color = days < 0 ? colors.danger : days <= 1 ? colors.warning : colors.textSoft;
  const label = days < 0 ? t('recurring.overdue', { count: -days }) : days === 0 ? t('common.today') : days === 1 ? t('common.tomorrow') : t('recurring.inDays', { count: days });
  return (
    <View style={[styles.chip, { backgroundColor: tint(days <= 1 ? color : colors.text, days <= 1 ? 0.14 : 0.06), boxShadow: `inset 0 0 0 1px ${tint(days <= 1 ? color : colors.text, 0.25)}` }]}>
      <Txt weight="bold" size={10.5} style={{ color }}>
        {label}
      </Txt>
    </View>
  );
}

/** One due payment: a recurring rule's occurrence or a credit-card statement. */
export function UpcomingRow({
  item,
  catalog,
  onPress,
  paid,
  skip,
}: {
  item: Upcoming;
  catalog: Catalog | undefined;
  onPress?: () => void;
  paid?: SwipeAction;
  skip?: SwipeAction;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { money, date } = useFormat();
  const when = date(parseLocalISO(item.due), { weekday: 'short', day: 'numeric', month: 'short' });

  let icon = iconOrDefault('credit_card');
  let color: string = '#A78BFA';
  let title: string;
  let sub: string;
  let amount: string;
  let income = false;
  if (item.type === 'rule') {
    const c = catalog?.byId.get(item.rule.categoryId);
    icon = c?.iconName ?? 'autorenew';
    color = c?.color ?? '#94A3B8';
    title = item.rule.name;
    sub = [when, item.rule.autoPost ? t('recurring.auto') : null].filter(Boolean).join(' · ');
    income = item.rule.kind === 'income';
    amount = money(income ? item.rule.amountMinor : -item.rule.amountMinor, item.rule.currency, { showPlus: income, trimZeroCents: true });
  } else {
    color = item.card.account.color;
    title = t('recurring.cardDue', { card: item.card.account.name });
    sub = [when, item.closed ? null : t('recurring.cardOpen')].filter(Boolean).join(' · ');
    amount = money(-item.amount, item.card.account.currency, { trimZeroCents: true });
  }
  const dim = item.type === 'rule' && !item.actionable;

  return (
    <SwipeRow
      onPress={onPress}
      accessibilityLabel={`${title}, ${sub}, ${amount}`}
      right={dim ? undefined : paid}
      left={dim ? undefined : skip}
      style={dim ? styles.dim : undefined}>
      <CategoryTile icon={icon} color={color} size={36} soft />
      <View style={styles.texts}>
        <Txt weight="semibold" size={14.5} numberOfLines={1}>
          {title}
        </Txt>
        <Txt tone="muted" size={12} numberOfLines={1}>
          {sub}
        </Txt>
      </View>
      <View style={styles.right}>
        <Txt display="regular" size={13} style={income ? { color: colors.income } : null}>
          {amount}
        </Txt>
        <DueChip days={item.days} />
      </View>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  texts: { flex: 1, minWidth: 0, gap: 3 },
  right: { alignItems: 'flex-end', gap: 5 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  dim: { opacity: 0.55 },
});
