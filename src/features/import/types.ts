import type { TxKind } from '@/db/types';

export type ImportSource = 'sms' | 'statement';

/** Why a candidate deserves a second look before it is added. */
export type CandidateHint = 'cardPayment';

/** One transaction found in a pasted message or a statement row, before the user reviews it. */
export type ImportCandidate = {
  /** Stable fingerprint, saved as the transaction's external id so the same row is recognised next time. */
  key: string;
  kind: TxKind;
  /** Positive amount in major units (1234.56). */
  amount: number;
  /** null when the source does not say; the chosen account's currency is used. */
  currency: string | null;
  /** Local ISO date-time. */
  occurredAt: string;
  /** The text as the bank wrote it. */
  description: string;
  /** Cleaned-up merchant name; may be empty. */
  merchantName: string;
  /** Last four card digits mentioned in the text. */
  last4: string | null;
  hint: CandidateHint | null;
};
