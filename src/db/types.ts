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
  recurringRuleId: string | null;
  installmentNo: number | null;
  installmentCount: number | null;
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

/** Links a transaction to the plan that produced it (recurring rule or installment purchase). */
export type TransactionLinks = {
  recurringRuleId?: string | null;
  installmentPlanId?: string | null;
  installmentNo?: number | null;
};

export type Frequency = 'week' | 'month' | 'year';

/** A monthly spending limit; `categoryId` null is the limit for the whole month. */
export type Budget = { id: string; categoryId: string | null; amountMinor: number; currency: string };

export type RecurringRule = {
  id: string;
  kind: TxKind;
  name: string;
  accountId: string;
  categoryId: string;
  amountMinor: number;
  currency: string;
  frequency: Frequency;
  interval: number;
  /** Day of month the rule was set to, so the 31st comes back after a short month. */
  anchorDay: number | null;
  /** Next date it is due, "YYYY-MM-DD". */
  nextDue: string;
  /** Add the transaction automatically on the due date instead of asking. */
  autoPost: boolean;
  /** Remind this many days before; null = no reminder. */
  remindDays: number | null;
  isSubscription: boolean;
  active: boolean;
};

export type RecurringRuleInput = Omit<RecurringRule, 'id'>;

export type InstallmentPlan = {
  id: string;
  accountId: string;
  categoryId: string;
  merchantName: string | null;
  totalMinor: number;
  currency: string;
  count: number;
  firstDate: string;
  /** Installments dated today or earlier. */
  paidCount: number;
  /** Amount of the installments still ahead. */
  remainingMinor: number;
  nextDate: string | null;
};

export type Goal = {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetMinor: number;
  currency: string;
  /** "YYYY-MM-DD" or null for no deadline. */
  targetDate: string | null;
  archived: boolean;
  savedMinor: number;
};

export type GoalInput = Pick<Goal, 'name' | 'icon' | 'color' | 'targetMinor' | 'currency' | 'targetDate'>;

export type GoalContribution = { id: string; goalId: string; amountMinor: number; occurredAt: string; note: string | null };
