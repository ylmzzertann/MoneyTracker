import { usePathname } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';

import { RadialMenu } from '@/features/nav/RadialMenu';
import { SectionNav, type Section } from '@/features/nav/SectionNav';
import { groupRows } from '@/features/reports/aggregate';
import { categoryUsage } from '@/db/repos/categories';
import { useCategories } from '@/hooks/useCatalog';
import { usePeriodRows } from '@/hooks/usePeriodRows';
import { useQuery } from '@/hooks/useQuery';
import { addDays, periodRange, toLocalISO } from '@/lib/dates';
import { useSettings } from '@/store/settings';

/**
 * The three main sections (Activity ‹ Home › Reports) share one bottom orb
 * instead of a tab bar. The headless tab router keeps each section's state.
 */
export default function SectionsLayout() {
  const pathname = usePathname();
  const section: Section = pathname.startsWith('/activity') ? 'activity' : pathname.startsWith('/reports') ? 'reports' : 'home';
  const weekStart = useSettings((s) => s.weekStart);
  const catalog = useCategories();
  const since = toLocalISO(addDays(new Date(), -90)).slice(0, 10);
  const usage = useQuery(`usage:${since}`, (db) => categoryUsage(db, since)).data;
  const month = usePeriodRows(periodRange('month', new Date(), weekStart));

  // The seven most used expense categories, most used first.
  const items = catalog
    ? catalog
        .topLevel('expense')
        .map((c) => ({
          c,
          n: (usage?.[c.id] ?? 0) + c.children.reduce((acc, ch) => acc + (usage?.[ch.id] ?? 0), 0),
        }))
        .sort((a, b) => b.n - a.n || a.c.sortOrder - b.c.sortOrder)
        .slice(0, 7)
        .map((x) => x.c)
    : [];
  const spentById = new Map(
    month && catalog
      ? groupRows(month.rows, 'expense', 'category', (id) => catalog.rootOf(id)?.id ?? null).map((g) => [g.key, g.total] as const)
      : [],
  );

  return (
    <View style={styles.flex}>
      <Tabs style={styles.flex}>
        <TabSlot />
        <TabList style={styles.hidden}>
          <TabTrigger name="activity" href="/activity" />
          <TabTrigger name="index" href="/" />
          <TabTrigger name="reports" href="/reports" />
        </TabList>
      </Tabs>
      <SectionNav section={section} items={items} />
      <RadialMenu items={items} spentById={spentById} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
});
