import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/ui';
import type { TransactionListRow } from '@/db/types';
import type { CategoryView } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { parseLocalISO } from '@/lib/dates';
import { categoryTone, tint, useTheme } from '@/theme';

const ACTION_W = 96;

/**
 * One transaction. Swipe left to delete, swipe right to copy it to today,
 * tap to edit. The actions are also reachable from the accessibility menu.
 */
export function TxRow({
  row,
  category,
  onDelete,
  onDuplicate,
  onEdit,
}: {
  row: TransactionListRow;
  category: CategoryView | undefined;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { money, date } = useFormat();
  const swipe = useRef<SwipeableMethods>(null);
  const color = category?.color ?? '#94A3B8';
  const tone = categoryTone(color);
  const title = row.merchantName ?? category?.label ?? '—';
  const time = date(parseLocalISO(row.occurredAt), { hour: '2-digit', minute: '2-digit' });
  const sub = [category?.label, row.accountName, time].filter(Boolean).join(' · ');
  const amount = money(row.kind === 'income' ? row.amountMinor : -row.amountMinor, row.currency, { showPlus: row.kind === 'income' });
  const tag =
    row.installmentNo && row.installmentCount
      ? t('transactions.installmentTag', { no: row.installmentNo, count: row.installmentCount })
      : row.recurringRuleId
        ? t('transactions.recurringTag')
        : row.splitCount > 1
          ? t('transactions.splitCount', { count: row.splitCount })
          : null;

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1.4}
      leftThreshold={ACTION_W * 0.7}
      rightThreshold={ACTION_W * 0.7}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        swipe.current?.close();
        if (direction === SwipeDirection.LEFT) onDelete();
        else onDuplicate();
      }}
      renderLeftActions={() => (
        <View style={[styles.action, styles.left, { backgroundImage: `linear-gradient(90deg, ${colors.accent}, ${colors.accentFrom})` }]}>
          <Icon name="content_copy" size={22} color={colors.onAccent} />
          <Txt weight="bold" size={11} style={{ color: colors.onAccent }}>
            {t('common.duplicate')}
          </Txt>
        </View>
      )}
      renderRightActions={() => (
        <View
          style={[
            styles.action,
            styles.right,
            { backgroundImage: 'linear-gradient(90deg, #FB7185, #F43F5E)', boxShadow: '0 0 24px rgba(244,63,94,0.45)' },
          ]}>
          <Icon name="delete" size={22} color="#FFFFFF" />
          <Txt weight="bold" size={11} style={styles.white}>
            {t('common.delete')}
          </Txt>
        </View>
      )}>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${sub}, ${amount}`}
        accessibilityActions={[
          { name: 'delete', label: t('common.delete') },
          { name: 'duplicate', label: t('common.duplicate') },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'delete') onDelete();
          if (e.nativeEvent.actionName === 'duplicate') onDuplicate();
        }}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceRaised : colors.bg }]}>
        <View style={[styles.tileGap, { backgroundColor: colors.bg }]}>
          <CategoryTile icon={category?.iconName ?? 'more_horiz'} color={color} size={36} soft />
        </View>
        <View style={styles.texts}>
          <Txt weight="semibold" size={15} numberOfLines={1}>
            {title}
          </Txt>
          <Txt tone="muted" size={12} numberOfLines={1}>
            {sub}
          </Txt>
        </View>
        <View style={styles.right2}>
          <Txt display="regular" size={14} style={row.kind === 'income' ? { color: colors.income } : null}>
            {amount}
          </Txt>
          {tag && (
            <View style={[styles.tag, { backgroundColor: tint(color, 0.12), boxShadow: `inset 0 0 0 1px ${tint(color, 0.4)}` }]}>
              <Txt size={10.5} weight="semibold" style={{ color: isDark ? tone.light : tone.deep }}>
                {tag}
              </Txt>
            </View>
          )}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 12, paddingRight: 18, borderRadius: 18, marginHorizontal: 4 },
  tileGap: { borderRadius: 14, padding: 2 },
  texts: { flex: 1, minWidth: 0, gap: 3 },
  right2: { alignItems: 'flex-end', gap: 4 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  action: { width: ACTION_W, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 18, marginVertical: 2 },
  left: { marginLeft: 4 },
  right: { marginRight: 4 },
  white: { color: '#FFFFFF' },
});
