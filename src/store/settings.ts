import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { WeekStart } from '@/lib/dates';

export type LanguagePref = 'system' | 'en' | 'tr';
export type ThemePref = 'system' | 'light' | 'dark';
export type Region = 'US' | 'TR' | 'OTHER';

export type SettingsState = {
  onboarded: boolean;
  language: LanguagePref;
  region: Region;
  baseCurrency: string;
  theme: ThemePref;
  weekStart: WeekStart;
  biometricLock: boolean;
  hideAmounts: boolean;
  lastAccountId: string | null;
  lastExpenseCategoryId: string | null;
  lastIncomeCategoryId: string | null;
  fabHintSeen: boolean;
  /** Monthly spending budget in the main currency's minor units; null = not set. */
  monthlyBudgetMinor: number | null;
};

type SettingsActions = {
  set: (patch: Partial<SettingsState>) => void;
};

export const DEFAULT_SETTINGS: SettingsState = {
  onboarded: false,
  language: 'system',
  region: 'US',
  baseCurrency: 'USD',
  theme: 'system',
  weekStart: 0,
  biometricLock: false,
  hideAmounts: false,
  lastAccountId: null,
  lastExpenseCategoryId: null,
  lastIncomeCategoryId: null,
  fabHintSeen: false,
  monthlyBudgetMinor: null,
};

/** Synchronous SQLite-backed storage so settings are ready on the very first render. */
const syncStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => Storage.setItemSync(name, value),
  removeItem: (name) => {
    Storage.removeItemSync(name);
  },
};

export const useSettings = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
      partialize: ({ set: _set, ...state }) => state,
    },
  ),
);

export const regionDefaults = (region: Region): Pick<SettingsState, 'baseCurrency' | 'weekStart'> => {
  if (region === 'TR') return { baseCurrency: 'TRY', weekStart: 1 };
  if (region === 'US') return { baseCurrency: 'USD', weekStart: 0 };
  return { baseCurrency: 'EUR', weekStart: 1 };
};
