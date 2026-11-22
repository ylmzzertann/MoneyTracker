import { create } from 'zustand';

export type Toast = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastState = {
  toast: Toast | null;
  show: (t: Omit<Toast, 'id'>) => void;
  hide: () => void;
};

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (t) => set({ toast: { ...t, id: nextId++ } }),
  hide: () => set({ toast: null }),
}));

export const showToast = (t: Omit<Toast, 'id'>) => useToast.getState().show(t);
