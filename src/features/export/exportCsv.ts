import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { TFunction } from 'i18next';

import { allTransactionsForExport } from '@/db/repos/transactions';
import type { CategoryView } from '@/hooks/useCatalog';
import { buildCsv, csvNumber, csvOptionsForLocale } from '@/lib/csv';
import { currencyDecimals, fromMinor } from '@/lib/money';

/**
 * Writes one CSV row per category split for the range and opens the share
 * sheet. Separators follow the locale so the file opens cleanly in Excel.
 */
export async function exportCsv(
  db: SQLiteDatabase,
  opts: {
    start: string;
    end: string;
    locale: string;
    t: TFunction;
    categoryById: Map<string, CategoryView>;
    fileName: string;
  },
): Promise<boolean> {
  const { t, locale } = opts;
  const rows = await allTransactionsForExport(db, opts.start, opts.end);
  const csv = csvOptionsForLocale(locale);
  const header = [
    t('csv.date'),
    t('csv.type'),
    t('csv.amount'),
    t('csv.currency'),
    t('csv.account'),
    t('csv.merchant'),
    t('csv.category'),
    t('csv.categoryAmount'),
    t('csv.channel'),
    t('csv.note'),
  ];
  const body = rows.map((r) => {
    const decimals = currencyDecimals(r.currency);
    return [
      r.occurred_at.replace('T', ' ').slice(0, 16),
      t(`kind.${r.kind}`),
      csvNumber(fromMinor(r.amount_minor, r.currency), decimals, csv),
      r.currency,
      r.account_name,
      r.merchant_name,
      opts.categoryById.get(r.category_id)?.label ?? '',
      csvNumber(fromMinor(r.split_amount_minor, r.currency), decimals, csv),
      r.channel ? t(`channel.${r.channel}`) : '',
      r.note,
    ];
  });
  const file = new File(Paths.cache, opts.fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(buildCsv(header, body, csv));
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: opts.fileName });
  return true;
}
