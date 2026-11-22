/**
 * System categories. They have stable ids (`sys:<key>`) so every device and
 * every household member refers to the same category once sync arrives.
 * Display names come from i18n: `categories.<key>`.
 */

import type { IconName } from '@/theme/icons';

export type CategoryKind = 'expense' | 'income';

export type CategoryDef = {
  key: string;
  kind: CategoryKind;
  icon: IconName;
  color: string;
  parent?: string;
  channel?: 'store' | 'online';
};

/** Neon category colours (sub-categories use their parent's). Offered when a user creates a category. */
export const CATEGORY_COLORS = [
  '#34D399',
  '#FBBF24',
  '#FB923C',
  '#38BDF8',
  '#A78BFA',
  '#F472B6',
  '#E879F9',
  '#2DD4BF',
  '#818CF8',
  '#FB7185',
  '#22D3EE',
  '#A3E635',
  '#FACC15',
  '#60A5FA',
  '#C084FC',
  '#FDBA74',
  '#FDA4AF',
  '#94A3B8',
];

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { key: 'groceries', kind: 'expense', icon: 'shopping_cart', color: '#34D399' },
  { key: 'dining', kind: 'expense', icon: 'restaurant', color: '#FB923C' },
  { key: 'utilities', kind: 'expense', icon: 'receipt_long', color: '#FBBF24' },
  { key: 'utilities.electricity', parent: 'utilities', kind: 'expense', icon: 'bolt', color: '#FBBF24' },
  { key: 'utilities.water', parent: 'utilities', kind: 'expense', icon: 'water_drop', color: '#FBBF24' },
  { key: 'utilities.gas', parent: 'utilities', kind: 'expense', icon: 'local_fire_department', color: '#FBBF24' },
  { key: 'utilities.internet', parent: 'utilities', kind: 'expense', icon: 'wifi', color: '#FBBF24' },
  { key: 'utilities.phone', parent: 'utilities', kind: 'expense', icon: 'smartphone', color: '#FBBF24' },
  { key: 'online_shopping', kind: 'expense', icon: 'package_2', color: '#A78BFA', channel: 'online' },
  { key: 'housing', kind: 'expense', icon: 'home', color: '#818CF8' },
  { key: 'housing.rent', parent: 'housing', kind: 'expense', icon: 'key', color: '#818CF8' },
  { key: 'housing.dues', parent: 'housing', kind: 'expense', icon: 'apartment', color: '#818CF8' },
  { key: 'housing.maintenance', parent: 'housing', kind: 'expense', icon: 'handyman', color: '#818CF8' },
  { key: 'transport', kind: 'expense', icon: 'directions_car', color: '#38BDF8' },
  { key: 'transport.fuel', parent: 'transport', kind: 'expense', icon: 'local_gas_station', color: '#38BDF8' },
  { key: 'transport.public', parent: 'transport', kind: 'expense', icon: 'directions_bus', color: '#38BDF8' },
  { key: 'transport.taxi', parent: 'transport', kind: 'expense', icon: 'local_taxi', color: '#38BDF8' },
  { key: 'transport.parking', parent: 'transport', kind: 'expense', icon: 'local_parking', color: '#38BDF8' },
  { key: 'health', kind: 'expense', icon: 'stethoscope', color: '#F472B6' },
  { key: 'personal_care', kind: 'expense', icon: 'spa', color: '#FB7185' },
  { key: 'household', kind: 'expense', icon: 'cleaning_services', color: '#2DD4BF' },
  { key: 'clothing', kind: 'expense', icon: 'apparel', color: '#C084FC' },
  { key: 'entertainment', kind: 'expense', icon: 'movie', color: '#E879F9' },
  { key: 'subscriptions', kind: 'expense', icon: 'subscriptions', color: '#22D3EE', channel: 'online' },
  { key: 'education', kind: 'expense', icon: 'school', color: '#60A5FA' },
  { key: 'travel', kind: 'expense', icon: 'flight', color: '#22D3EE' },
  { key: 'sports', kind: 'expense', icon: 'fitness_center', color: '#A3E635' },
  { key: 'gifts', kind: 'expense', icon: 'redeem', color: '#FACC15' },
  { key: 'kids', kind: 'expense', icon: 'child_care', color: '#FDA4AF' },
  { key: 'pets', kind: 'expense', icon: 'pets', color: '#FDBA74' },
  { key: 'fees', kind: 'expense', icon: 'account_balance', color: '#94A3B8' },
  { key: 'taxes', kind: 'expense', icon: 'request_quote', color: '#94A3B8' },
  { key: 'other', kind: 'expense', icon: 'more_horiz', color: '#94A3B8' },

  { key: 'salary', kind: 'income', icon: 'payments', color: '#2DD4BF' },
  { key: 'freelance', kind: 'income', icon: 'work', color: '#A3E635' },
  { key: 'investment', kind: 'income', icon: 'trending_up', color: '#34D399' },
  { key: 'refund', kind: 'income', icon: 'currency_exchange', color: '#38BDF8' },
  { key: 'gift_income', kind: 'income', icon: 'redeem', color: '#FACC15' },
  { key: 'other_income', kind: 'income', icon: 'savings', color: '#94A3B8' },
];

export const systemCategoryId = (key: string) => `sys:${key}`;

/** Icons offered when the user creates a custom category or account. */
export const PICKABLE_ICONS: IconName[] = [
  'shopping_cart', 'restaurant', 'local_cafe', 'package_2', 'storefront', 'home', 'directions_car', 'directions_bus',
  'local_taxi', 'local_gas_station', 'flight', 'stethoscope', 'spa', 'favorite', 'apparel', 'movie', 'sports_esports',
  'school', 'fitness_center', 'redeem', 'pets', 'child_care', 'handyman', 'cleaning_services', 'bolt', 'water_drop',
  'local_fire_department', 'wifi', 'smartphone', 'subscriptions', 'local_florist', 'account_balance', 'credit_card',
  'account_balance_wallet', 'payments', 'savings', 'work', 'trending_up', 'language', 'more_horiz',
];

export type AccountType = 'cash' | 'bank' | 'credit_card' | 'wallet' | 'savings';

export const ACCOUNT_TYPE_ICONS: Record<AccountType, IconName> = {
  cash: 'payments',
  bank: 'account_balance',
  credit_card: 'credit_card',
  wallet: 'account_balance_wallet',
  savings: 'savings',
};
