import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AlertLevel } from '@/features/plan/budget';

import { syncStorage } from './settings';

/** Per-device memory of what was already announced or dismissed, so nothing nags twice. */
type AlertsState = {
  /** "YYYY-MM:categoryId|total" → highest level announced that month. */
  budgetAlerts: Record<string, AlertLevel>;
  /** Normalised merchant names the user does not want suggested as recurring. */
  dismissedSuggestions: string[];
  /** The phase-1 monthly budget was moved into the budgets table. */
  budgetMigrated: boolean;
  markBudget: (key: string, level: AlertLevel) => void;
  dismissSuggestion: (key: string) => void;
  set: (patch: Partial<Pick<AlertsState, 'budgetMigrated'>>) => void;
};

export const budgetAlertKey = (month: string, categoryId: string | null) => `${month}:${categoryId ?? 'total'}`;

export const useAlerts = create<AlertsState>()(
  persist(
    (set) => ({
      budgetAlerts: {},
      dismissedSuggestions: [],
      budgetMigrated: false,
      markBudget: (key, level) =>
        set((s) => {
          // Keep only this and last month's entries.
          const month = key.slice(0, 7);
          const kept = Object.fromEntries(Object.entries(s.budgetAlerts).filter(([k]) => k.slice(0, 7) >= prevMonth(month)));
          return { budgetAlerts: { ...kept, [key]: level } };
        }),
      dismissSuggestion: (key) => set((s) => ({ dismissedSuggestions: [...new Set([...s.dismissedSuggestions, key])] })),
      set: (patch) => set(patch),
    }),
    {
      name: 'alerts',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
      partialize: ({ budgetAlerts, dismissedSuggestions, budgetMigrated }) => ({ budgetAlerts, dismissedSuggestions, budgetMigrated }),
    },
  ),
);

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
