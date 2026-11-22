import { create } from 'zustand';

/**
 * Bumped after every database write. Query hooks depend on it so that every
 * screen refreshes after an insert/update/delete without manual wiring.
 */
type DataVersionState = { version: number; bump: () => void };

export const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export const bumpData = () => useDataVersion.getState().bump();
