import type { AccountType, CategoryKind } from './defaults';

export type TxKind = CategoryKind; // 'expense' | 'income'
export type Channel = 'store' | 'online';
export type TxSource = 'manual' | 'receipt' | 'statement' | 'sms' | 'voice' | 'plaid' | 'recurring';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  icon: string;
  color: string;
  statementDay: number | null;
  dueDay: number | null;
  creditLimitMinor: number | null;
  isShared: boolean;
  sortOrder: number;
  archived: boolean;
};

export type AccountInput = Omit<Account, 'id' | 'sortOrder' | 'archived'>;

export type Category = {
  id: string;
  key: string | null;
  name: string | null;
  parentId: string | null;
  kind: CategoryKind;
  icon: string;
  color: string;
  channel: Channel | null;
  sortOrder: number;
  hidden: boolean;
};

export type CategoryInput = {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  parentId?: string | null;
};

export type SplitInput = { categoryId: string; amountMinor: number };

export type TransactionInput = {
  kind: TxKind;
  accountId: string;
  amountMinor: number;
  currency: string;
  occurredAt: string; // local ISO
  merchantName?: string | null;
  note?: string | null;
  channel?: Channel | null;
  source?: TxSource;
  externalId?: string | null;
  splits: SplitInput[];
};

export type Transaction = TransactionInput & {
  id: string;
  merchantName: string | null;
  note: string | null;
  channel: Channel | null;
  source: TxSource;
};

/** One row per transaction for lists; `categoryId` is the largest split. */
export type TransactionListRow = {
  id: string;
  kind: TxKind;
  accountId: string;
  accountName: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  merchantName: string | null;
  note: string | null;
  channel: Channel | null;
  source: TxSource;
  categoryId: string;
  splitCount: number;
};

/** One row per split, used by reports and charts. */
export type ReportRow = {
  transactionId: string;
  kind: TxKind;
  occurredAt: string;
  accountId: string;
  merchantName: string | null;
  channel: Channel | null;
  categoryId: string;
  amountMinor: number;
  currency: string;
};

export type TransactionFilter = {
  start: string;
  end: string;
  kind?: TxKind;
  categoryIds?: string[];
  accountId?: string;
  search?: string;
};
