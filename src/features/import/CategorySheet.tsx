import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sky } from '@/components/Sky';
import { AccentButton, Segmented, Txt } from '@/components/ui';
import type { TxKind } from '@/db/types';
import { CategoryPicker } from '@/features/add/CategoryPicker';
import type { Catalog } from '@/hooks/useCatalog';
import { useTheme } from '@/theme';

/**
 * Bottom sheet to change one imported row's category, and its direction when
 * the bank's sign was misleading. Mount it only while it is open.
 */
export function CategorySheet({
  title,
  catalog,
  kind: initialKind,
  categoryId,
  onDone,
  onClose,
}: {
  title: string;
  catalog: Catalog;
  kind: TxKind;
  categoryId: string;
  onDone: (kind: TxKind, categoryId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const start = catalog.byId.get(categoryId);
  const [kind, setKind] = useState<TxKind>(initialKind);
  const [rootId, setRootId] = useState<string | null>(start ? (start.parentId ?? start.id) : null);
  const [subId, setSubId] = useState<string | null>(start?.parentId ? start.id : null);
  const chosen = subId ?? rootId;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={[styles.flex, { backgroundColor: colors.overlay }]} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 10, boxShadow: `inset 0 1px 0 ${colors.hairlineStrong}, 0 -24px 60px ${colors.shadow}` }]}>
          <Sky />
          <View style={[styles.grabber, { backgroundColor: colors.hairlineStrong }]} />
          <View style={styles.head}>
            <Txt display="light" size={20} numberOfLines={1} style={styles.flex}>
              {title}
            </Txt>
            <Segmented
              options={[
                { value: 'expense', label: t('kind.expense') },
                { value: 'income', label: t('kind.income') },
              ]}
              value={kind}
              onChange={(k) => {
                setKind(k);
                setRootId(null);
                setSubId(null);
              }}
            />
          </View>
          <CategoryPicker
            categories={catalog.topLevel(kind)}
            rootId={rootId}
            subId={subId}
            onChange={(root, sub) => {
              setRootId(root);
              setSubId(sub);
            }}
          />
          <View style={styles.actions}>
            <AccentButton label={t('common.done')} icon="check" disabled={!chosen} onPress={() => chosen && onDone(kind, chosen)} style={styles.flex} />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', paddingTop: 10, gap: 16 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  actions: { flexDirection: 'row', paddingHorizontal: 20 },
});
