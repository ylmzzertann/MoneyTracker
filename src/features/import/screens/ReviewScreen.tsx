import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { ProgressBar } from '@/components/Progress';
import { Sky } from '@/components/Sky';
import { AccentButton, Card, Eyebrow, GlassCircle, GlassPill, ScreenHeader, Segmented, Txt } from '@/components/ui';
import { getImportHints, importLookup, learnedMerchantCategories, saveImport } from '@/db/repos/imports';
import type { TransactionInput, TxKind } from '@/db/types';
import { checkBudgetAlerts } from '@/features/plan/usePlanRunner';
import { ChipChoice } from '@/features/settings/parts';
import { useAccounts, useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { useQuery } from '@/hooks/useQuery';
import { addDays, parseLocalISO, toLocalISO } from '@/lib/dates';
import { toMinor } from '@/lib/money';
import { bumpData } from '@/store/dataVersion';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';
import { useTheme } from '@/theme';

import { suggestCategory, type CategoryContext } from '../categorize';
import { CategorySheet } from '../CategorySheet';
import { CandidateFace, DeckCard, type Decision, type DeckCardHandle } from '../Deck';
import { classify, type ExistingTx } from '../dedupe';
import { useImportDraft } from '../draft';
import { fingerprint } from '../parse/fingerprint';
import { columnLabels, tableCandidates, type TableMapping } from '../parse/table';
import type { ImportCandidate } from '../types';

type Lookup = { importedKeys: Set<string>; existing: ExistingTx[] };

/** Swipe through what was found, then save the accepted rows in one go. */
export function ReviewScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { money, language } = useFormat();
  const catalog = useCategories();
  const accounts = useAccounts();
  const lastAccountId = useSettings((s) => s.lastAccountId);
  const draft = useImportDraft((s) => s.draft);

  const [mapping, setMapping] = useState<TableMapping | null>(draft?.mapping ?? null);
  const [signTouched, setSignTouched] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [history, setHistory] = useState<string[][]>([]);
  const [kindOf, setKindOf] = useState<Record<string, TxKind>>({});
  const [categoryOf, setCategoryOf] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Saving bumps the data version; keep the old duplicate check so the screen does not flip while it closes.
  const [frozenLookup, setFrozenLookup] = useState<Lookup | null>(null);
  const deck = useRef<DeckCardHandle>(null);

  const last4s = [...new Set((draft?.candidates ?? []).map((c) => c.last4).filter((l): l is string => !!l))];
  const hintKeys = [...last4s.map((l) => `last4:${l}`), ...(draft?.layout ? [`layout:${draft.layout}`, `sign:${draft.layout}`] : [])];
  const { data: learning } = useQuery(`import-learning:${hintKeys.join(',')}`, async (database) => {
    const [hints, learned] = await Promise.all([getImportHints(database, hintKeys), learnedMerchantCategories(database)]);
    return { hints, learned };
  });

  // The sign chosen for this statement layout last time wins over the guess, until the user changes it.
  const rememberedSign = draft?.layout ? learning?.hints.get(`sign:${draft.layout}`) : undefined;
  const applied: TableMapping | null =
    mapping && mapping.amount !== null && !signTouched && (rememberedSign === 'negative' || rememberedSign === 'positive')
      ? { ...mapping, expenseSign: rememberedSign }
      : mapping;
  const candidates: ImportCandidate[] = draft?.grid && applied ? tableCandidates(draft.grid, applied, language) : (draft?.candidates ?? []);
  const keys = candidates.map((c) => c.key);
  const dates = candidates.map((c) => c.occurredAt).sort();
  const windowStart = dates.length > 0 ? toLocalISO(addDays(parseLocalISO(dates[0]), -2)) : '';
  const windowEnd = dates.length > 0 ? toLocalISO(addDays(parseLocalISO(dates[dates.length - 1]), 2)) : '';
  const { data: liveLookup } = useQuery(`import-lookup:${fingerprint(keys.join(','))}:${windowStart}:${windowEnd}`, (database) =>
    importLookup(database, keys, windowStart, windowEnd),
  );
  const lookup = frozenLookup ?? liveLookup;
  const hints = learning?.hints;
  const learned = learning?.learned;

  if (!draft) {
    return (
      <View style={styles.flex}>
        <Sky />
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, gap: 16 }}>
          <ScreenHeader title={t('import.reviewTitle')} backLabel={t('common.back')} onBack={() => router.back()} />
          <Card>
            <Txt tone="soft" size={14}>
              {t('import.nothing')}
            </Txt>
          </Card>
        </View>
      </View>
    );
  }

  const hinted = (() => {
    if (!hints) return null;
    for (const c of candidates) {
      const id = c.last4 ? hints.get(`last4:${c.last4}`) : undefined;
      if (id) return id;
    }
    return draft.layout ? (hints.get(`layout:${draft.layout}`) ?? null) : null;
  })();
  // The user's pick, then the account learned for this card or file, then the last one used.
  const account =
    [accountId, hinted, lastAccountId].map((id) => accounts?.find((a) => a.id === id)).find((a) => a !== undefined) ?? accounts?.[0];
  const currencyOf = (c: ImportCandidate) => c.currency ?? account?.currency ?? 'USD';
  const kindFor = (c: ImportCandidate) => kindOf[c.key] ?? c.kind;

  const ctx: CategoryContext | null = catalog && learned ? { learned, categories: new Map(catalog.all.map((c) => [c.id, c])) } : null;
  const categoryFor = (c: ImportCandidate) => categoryOf[c.key] ?? (ctx ? suggestCategory({ ...c, kind: kindFor(c) }, ctx) : null);

  const status = lookup
    ? classify(
        candidates.map((c) => ({ key: c.key, kind: kindFor(c), amountMinor: toMinor(c.amount, currencyOf(c)), currency: currencyOf(c), occurredAt: c.occurredAt })),
        lookup.importedKeys,
        lookup.existing,
      )
    : null;
  const queue = status ? candidates.filter((c) => status.get(c.key) !== 'imported') : [];
  const importedCount = candidates.length - queue.length;
  const pending = queue.filter((c) => !decisions[c.key]);
  const top = pending[0];
  const next = pending[1];
  const flagged = (c: ImportCandidate) => status?.get(c.key) === 'similar' || c.hint !== null;
  const bulk = pending.filter((c) => !flagged(c)).map((c) => c.key);
  const ready = !!status && !!ctx && !!account;

  const decide = (decided: string[], decision: Decision) => {
    setDecisions((d) => ({ ...d, ...Object.fromEntries(decided.map((k) => [k, decision])) }));
    setHistory((h) => [...h, decided]);
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(history.slice(0, -1));
    setDecisions((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !last.includes(k))));
  };
  const changeMapping = (patch: Partial<TableMapping>) => {
    if (!applied) return;
    setMapping({ ...applied, ...patch });
    setSignTouched(true);
    setDecisions({});
    setHistory([]);
    setCategoryOf({});
    setKindOf({});
  };

  const save = async () => {
    if (!account || !ctx) return;
    setSaving(true);
    setFrozenLookup(lookup ?? null);
    try {
      const adds = queue.filter((c) => decisions[c.key] === 'add');
      const inputs: TransactionInput[] = adds.flatMap((c) => {
        const currency = currencyOf(c);
        const amountMinor = toMinor(c.amount, currency);
        const categoryId = categoryFor(c);
        if (amountMinor <= 0 || !categoryId) return [];
        return [
          {
            kind: kindFor(c),
            accountId: account.id,
            amountMinor,
            currency,
            occurredAt: c.occurredAt,
            merchantName: c.merchantName || null,
            note: c.merchantName ? null : c.description.slice(0, 140) || null,
            channel: catalog?.byId.get(categoryId)?.channel ?? null,
            source: draft.source,
            externalId: c.key,
            splits: [{ categoryId, amountMinor }],
          },
        ];
      });
      const learnedHints: [string, string][] = [...new Set(adds.map((c) => c.last4).filter((l): l is string => !!l))].map((l) => [`last4:${l}`, account.id]);
      if (draft.layout) {
        learnedHints.push([`layout:${draft.layout}`, account.id]);
        if (applied && applied.amount !== null) learnedHints.push([`sign:${draft.layout}`, applied.expenseSign]);
      }
      const count = await saveImport(db, inputs, learnedHints);
      bumpData();
      void checkBudgetAlerts(db);
      showToast({ message: t('import.saved', { count }) });
      router.dismissTo('/activity');
    } catch {
      setSaving(false);
      setFrozenLookup(null);
      showToast({ message: t('common.error') });
    }
  };

  const editingCandidate = editing ? candidates.find((c) => c.key === editing) : undefined;
  const editingCategory = editingCandidate ? categoryFor(editingCandidate) : null;
  const labels = draft.grid && applied ? columnLabels(draft.grid, applied).map((l, i) => l || t('import.column', { n: i + 1 })) : [];
  const columnOptions = labels.map((label, i) => ({ value: String(i), label }));

  const summaryParts = [t('import.found', { count: candidates.length })];
  if (importedCount > 0) summaryParts.push(t('import.alreadyIn', { count: importedCount }));
  if (draft.unread > 0) summaryParts.push(t('import.unread', { count: draft.unread }));

  const adds = queue.filter((c) => decisions[c.key] === 'add');
  const totals = new Map<string, { out: number; in: number }>();
  for (const c of adds) {
    const cur = currencyOf(c);
    const sum = totals.get(cur) ?? { out: 0, in: 0 };
    if (kindFor(c) === 'income') sum.in += toMinor(c.amount, cur);
    else sum.out += toMinor(c.amount, cur);
    totals.set(cur, sum);
  }

  const cardLabel = (c: ImportCandidate) => {
    const cat = catalog?.byId.get(categoryFor(c) ?? '');
    return [c.merchantName || c.description, money(toMinor(c.amount, currencyOf(c)), currencyOf(c)), t(`kind.${kindFor(c)}`), cat?.label].filter(Boolean).join(', ');
  };
  const face = (c: ImportCandidate) => (
    <CandidateFace
      candidate={c}
      kind={kindFor(c)}
      currency={currencyOf(c)}
      category={catalog?.byId.get(categoryFor(c) ?? '')}
      status={status?.get(c.key) ?? 'new'}
      onCategory={() => setEditing(c.key)}
    />
  );

  return (
    <View style={styles.flex}>
      <Sky />
      <View style={[styles.flex, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.pad}>
          <ScreenHeader
            title={t('import.reviewTitle')}
            backLabel={t('common.back')}
            onBack={() => router.back()}
            right={
              applied ? (
                <GlassCircle icon={columnsOpen ? 'close' : 'table_rows'} label={columnsOpen ? t('common.done') : t('import.columns')} onPress={() => setColumnsOpen(!columnsOpen)} />
              ) : undefined
            }
          />
          <Txt tone="muted" size={12.5} numberOfLines={2} style={styles.summary}>
            {[draft.fileName, summaryParts.join(' · ')].filter(Boolean).join('  ·  ')}
          </Txt>
        </View>

        {accounts && accounts.length > 1 && (
          <View style={styles.accounts}>
            <Eyebrow style={styles.eyebrow}>{t('import.account')}</Eyebrow>
            <ChipChoice
              options={accounts.map((a) => ({ value: a.id, label: a.name, icon: a.iconName }))}
              value={account?.id ?? ''}
              onChange={setAccountId}
            />
          </View>
        )}

        {columnsOpen && applied ? (
          <ScrollView contentContainerStyle={[styles.pad, styles.columns]}>
            <Card>
              <View style={styles.columnGroup}>
                <Eyebrow>{t('import.dateColumn')}</Eyebrow>
                <ChipChoice options={columnOptions} value={String(applied.date)} onChange={(v) => changeMapping({ date: Number(v) })} />
              </View>
              <View style={styles.columnGroup}>
                <Eyebrow>{t('import.descriptionColumn')}</Eyebrow>
                <ChipChoice options={columnOptions} value={String(applied.description)} onChange={(v) => changeMapping({ description: Number(v) })} />
              </View>
              {applied.amount !== null ? (
                <>
                  <View style={styles.columnGroup}>
                    <Eyebrow>{t('import.amountColumn')}</Eyebrow>
                    <ChipChoice options={columnOptions} value={String(applied.amount)} onChange={(v) => changeMapping({ amount: Number(v) })} />
                  </View>
                  <View style={styles.columnGroup}>
                    <Eyebrow>{t('import.signTitle')}</Eyebrow>
                    <Segmented
                      stretch
                      options={[
                        { value: 'negative', label: t('import.minusIsExpense') },
                        { value: 'positive', label: t('import.plusIsExpense') },
                      ]}
                      value={applied.expenseSign}
                      onChange={(expenseSign) => changeMapping({ expenseSign })}
                    />
                  </View>
                </>
              ) : (
                <Txt tone="muted" size={12.5} style={styles.columnGroup}>
                  {t('import.debitCredit', { out: labels[applied.debit ?? 0] ?? '', in: labels[applied.credit ?? 0] ?? '' })}
                </Txt>
              )}
            </Card>
            <AccentButton label={t('common.done')} icon="check" onPress={() => setColumnsOpen(false)} />
          </ScrollView>
        ) : !ready ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : candidates.length === 0 ? (
          <View style={[styles.pad, styles.endWrap]}>
            <Card>
              <View style={styles.end}>
                <CategoryTile icon="table_rows" color="#FBBF24" size={56} selected />
                <Txt tone="soft" size={14} style={styles.centerText}>
                  {t('import.problem.noRows')}
                </Txt>
                {applied && <GlassPill icon="table_rows" label={t('import.columns')} onPress={() => setColumnsOpen(true)} />}
              </View>
            </Card>
          </View>
        ) : queue.length === 0 ? (
          <View style={[styles.pad, styles.endWrap]}>
            <Card>
              <View style={styles.end}>
                <CategoryTile icon="check_circle" color="#34D399" size={56} selected />
                <Txt weight="bold" size={17} style={styles.centerText}>
                  {t('import.allKnownTitle')}
                </Txt>
                <Txt tone="muted" size={13} style={styles.centerText}>
                  {t('import.allKnownBody')}
                </Txt>
                <AccentButton label={t('common.close')} icon="check" onPress={() => router.back()} />
              </View>
            </Card>
          </View>
        ) : top ? (
          <>
            <View style={[styles.pad, styles.progress]}>
              <View style={styles.progressRow}>
                <Txt weight="semibold" size={12.5} tone="soft">
                  {t('import.progress', { done: queue.length - pending.length + 1, total: queue.length })}
                </Txt>
                <Txt tone="faint" size={11}>
                  {t('import.swipeHint')}
                </Txt>
              </View>
              <ProgressBar share={(queue.length - pending.length) / queue.length} color={colors.accent} height={4} />
            </View>
            <View style={[styles.deck, styles.pad]}>
              {/* An empty card edge under the top card says "more to come" without its text showing through. */}
              {next && (
                <View pointerEvents="none" style={styles.ghost} importantForAccessibility="no-hide-descendants">
                  <Card fill padded={false} />
                </View>
              )}
              <View style={styles.topSlot}>
                <DeckCard key={top.key} ref={deck} label={cardLabel(top)} onDecide={(d) => decide([top.key], d)} onCategory={() => setEditing(top.key)}>
                  {face(top)}
                </DeckCard>
              </View>
            </View>
            <View style={[styles.pad, styles.actions]}>
              {bulk.length > 1 && (
                <GlassPill icon="done_all" label={t('import.addRest', { count: bulk.length })} onPress={() => decide(bulk, 'add')} style={styles.bulk} />
              )}
              <View style={styles.buttons}>
                <GlassCircle icon="undo" label={t('common.undo')} onPress={history.length > 0 ? undo : undefined} style={history.length === 0 && styles.dim} />
                <GlassPill icon="close" label={t('import.skip')} onPress={() => deck.current?.fling('skip')} style={styles.flex} />
                <AccentButton icon="check" label={t('import.add')} onPress={() => deck.current?.fling('add')} style={styles.flex} />
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.pad, styles.endWrap]}>
            <Card>
              <View style={styles.end}>
                <CategoryTile icon="done_all" color="#A3E635" size={56} selected />
                <Txt display="light" size={24} style={styles.centerText}>
                  {adds.length > 0 ? t('import.readyTitle', { count: adds.length }) : t('import.noneTitle')}
                </Txt>
                {[...totals].map(([cur, sum]) => (
                  <Txt key={cur} tone="soft" size={13.5} style={styles.centerText}>
                    {[sum.out ? t('import.totalOut', { amount: money(sum.out, cur) }) : null, sum.in ? t('import.totalIn', { amount: money(sum.in, cur) }) : null]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </Txt>
                ))}
                <Txt tone="muted" size={12.5} style={styles.centerText}>
                  {account ? t('import.intoAccount', { name: account.name }) : ''}
                </Txt>
                <View style={styles.buttons}>
                  <GlassCircle icon="undo" label={t('common.undo')} onPress={undo} />
                  {adds.length > 0 ? (
                    <AccentButton
                      icon="check"
                      label={saving ? t('import.saving') : t('import.saveCount', { count: adds.length })}
                      disabled={saving}
                      onPress={() => void save()}
                      style={styles.flex}
                    />
                  ) : (
                    <AccentButton icon="close" label={t('common.close')} onPress={() => router.back()} style={styles.flex} />
                  )}
                </View>
              </View>
            </Card>
          </View>
        )}
      </View>

      {editingCandidate && catalog && editingCategory && (
        <CategorySheet
          title={editingCandidate.merchantName || t('import.category')}
          catalog={catalog}
          kind={kindFor(editingCandidate)}
          categoryId={editingCategory}
          onClose={() => setEditing(null)}
          onDone={(kind, categoryId) => {
            setKindOf((k) => ({ ...k, [editingCandidate.key]: kind }));
            setCategoryOf((c) => ({ ...c, [editingCandidate.key]: categoryId }));
            setEditing(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: 16 },
  summary: { marginTop: 2, marginLeft: 4 },
  accounts: { marginTop: 14, gap: 8 },
  eyebrow: { marginLeft: 22 },
  columns: { gap: 14, paddingTop: 14, paddingBottom: 20 },
  columnGroup: { gap: 8, marginBottom: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  progress: { marginTop: 16, gap: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  deck: { flex: 1, marginTop: 14, marginBottom: 14 },
  topSlot: { flex: 1, marginBottom: 12 },
  ghost: { position: 'absolute', top: 24, bottom: 0, left: 34, right: 34, opacity: 0.55 },
  actions: { gap: 10 },
  bulk: { alignSelf: 'center' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  endWrap: { flex: 1, justifyContent: 'center' },
  end: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  dim: { opacity: 0.4 },
});
