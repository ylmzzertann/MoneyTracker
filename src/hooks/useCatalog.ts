import { useTranslation } from 'react-i18next';

import { listAccounts } from '@/db/repos/accounts';
import { listCategories } from '@/db/repos/categories';
import type { Account, Category } from '@/db/types';
import { categoryKey } from '@/i18n';
import { iconOrDefault, type IconName } from '@/theme/icons';

import { useQuery } from './useQuery';

export type CategoryView = Category & {
  label: string;
  iconName: IconName;
  children: CategoryView[];
};

export type Catalog = {
  all: CategoryView[];
  byId: Map<string, CategoryView>;
  /** Visible top-level categories of one kind, in sort order. */
  topLevel: (kind: 'expense' | 'income') => CategoryView[];
  /** The top-level category a (sub-)category rolls up into. */
  rootOf: (id: string) => CategoryView | undefined;
};

/** Categories with their display names, icons and children, refreshed after every write. */
export function useCategories(): Catalog | undefined {
  const { t } = useTranslation();
  const { data } = useQuery('categories', listCategories);
  if (!data) return undefined;

  const all: CategoryView[] = data.map((c) => ({
    ...c,
    label: c.name ?? (c.key ? t(categoryKey(c.key)) : '?'),
    iconName: iconOrDefault(c.icon),
    children: [],
  }));
  const byId = new Map(all.map((c) => [c.id, c]));
  for (const c of all) {
    if (c.parentId && !c.hidden) byId.get(c.parentId)?.children.push(c);
  }
  return {
    all,
    byId,
    topLevel: (kind) => all.filter((c) => c.kind === kind && !c.parentId && !c.hidden),
    rootOf: (id) => {
      const c = byId.get(id);
      return c?.parentId ? byId.get(c.parentId) : c;
    },
  };
}

export type AccountView = Account & { iconName: IconName };

export function useAccounts(includeArchived = false): AccountView[] | undefined {
  const { data } = useQuery(`accounts:${includeArchived}`, (db) => listAccounts(db, includeArchived));
  return data?.map((a) => ({ ...a, iconName: iconOrDefault(a.icon) }));
}
