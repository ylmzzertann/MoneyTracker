import { systemCategoryId } from '@/db/defaults';
import type { Category, TxKind } from '@/db/types';
import { normalizeName } from '@/lib/text';

import type { ImportCandidate } from './types';

/** Well-known merchants and words (normalised, whole words) → system category key. */
const KEYWORDS: Record<string, string[]> = {
  groceries: [
    'migros', 'migros jet', 'bim', 'a101', 'sok market', 'sok marketler', 'carrefoursa', 'carrefour', 'file market', 'macrocenter',
    'hakmar', 'tarim kredi', 'onur market', 'kim market', 'happy center', 'mopas', 'getir buyuk', 'market', 'supermarket',
    'walmart', 'kroger', 'safeway', 'whole foods', 'trader joe', 'trader joes', 'aldi', 'lidl', 'costco', 'publix', 'wegmans',
    'food lion', 'albertsons', 'sprouts', 'grocery', 'groceries', 'h e b', 'heb', 'instacart',
  ],
  dining: [
    'starbucks', 'mcdonalds', 'mc donalds', 'burger king', 'kfc', 'dominos', 'pizza', 'cafe', 'kafe', 'kahve', 'coffee',
    'restaurant', 'restoran', 'lokanta', 'kebap', 'kebab', 'doner', 'yemeksepeti', 'trendyol yemek', 'getir yemek',
    'doordash', 'uber eats', 'grubhub', 'chipotle', 'subway', 'simit sarayi', 'espresso lab', 'kahve dunyasi', 'popeyes',
    'wendys', 'taco bell', 'dunkin', 'panera', 'chick fil a', 'baklava', 'pastane', 'firin', 'bakery',
  ],
  'transport.fuel': ['shell', 'opet', 'bp', 'petrol ofisi', 'total', 'totalenergies', 'aytemiz', 'lukoil', 'chevron', 'exxon', 'exxonmobil', 'valero', 'speedway', 'circle k', 'sunoco', 'akaryakit', 'benzin', 'gas station'],
  'transport.taxi': ['uber', 'bitaksi', 'lyft', 'taxi', 'taksi'],
  'transport.public': ['istanbulkart', 'iett', 'metro istanbul', 'ego', 'mta', 'bart', 'marmaray', 'izban', 'transit'],
  'transport.parking': ['otopark', 'ispark', 'parking', 'park et'],
  online_shopping: ['trendyol', 'hepsiburada', 'amazon', 'amzn', 'n11', 'ciceksepeti', 'aliexpress', 'temu', 'shein', 'ebay', 'etsy', 'pazarama'],
  subscriptions: [
    'netflix', 'spotify', 'youtube premium', 'youtube', 'disney', 'disney plus', 'apple com bill', 'itunes', 'google play',
    'google storage', 'icloud', 'exxen', 'blutv', 'tod', 'prime video', 'amazon prime', 'hbo', 'chatgpt', 'openai', 'anthropic',
    'claude ai', 'adobe', 'dropbox', 'microsoft', 'xbox game pass', 'playstation plus', 'hulu',
  ],
  'utilities.phone': ['turkcell', 'vodafone', 'turk telekom', 'verizon', 'at t', 'att', 't mobile', 'tmobile'],
  'utilities.internet': ['superonline', 'turknet', 'ttnet', 'comcast', 'xfinity', 'spectrum', 'kablonet', 'millenicom'],
  'utilities.electricity': ['enerjisa', 'ck enerji', 'aydem', 'gediz', 'bedas', 'ayedas', 'elektrik', 'con edison', 'duke energy', 'pg e', 'electric'],
  'utilities.water': ['iski', 'aski', 'izsu', 'buski', 'su idaresi', 'water'],
  'utilities.gas': ['igdas', 'baskentgaz', 'izmirgaz', 'dogalgaz', 'dogal gaz', 'socalgas'],
  health: ['eczane', 'pharmacy', 'cvs', 'walgreens', 'hastane', 'hospital', 'clinic', 'klinik', 'dis hekimi', 'dental', 'rite aid', 'optik'],
  personal_care: ['kuafor', 'berber', 'barber', 'gratis', 'watsons', 'rossmann', 'sephora', 'ulta', 'eve shop'],
  clothing: ['zara', 'h m', 'hm', 'lc waikiki', 'lcw', 'defacto', 'koton', 'mavi', 'boyner', 'mango', 'uniqlo', 'old navy', 'nike', 'adidas', 'flo', 'colins', 'pull bear', 'bershka', 'marks spencer'],
  entertainment: ['sinema', 'cinema', 'cinemaximum', 'biletix', 'passo', 'steam', 'playstation', 'nintendo', 'amc', 'ticketmaster', 'bowling'],
  travel: ['thy', 'turk hava yollari', 'turkish airlines', 'pegasus', 'ajet', 'anadolujet', 'sunexpress', 'airbnb', 'booking com', 'hotel', 'otel', 'delta', 'united airlines', 'american airlines', 'southwest', 'expedia', 'obilet', 'enuygun'],
  sports: ['gym', 'macfit', 'fitness', 'spor salonu', 'decathlon', 'planet fitness'],
  education: ['udemy', 'coursera', 'kitap', 'kirtasiye', 'd r', 'idefix', 'okul', 'universite', 'school', 'tuition'],
  pets: ['petshop', 'pet shop', 'petco', 'petsmart', 'veteriner', 'vet'],
  fees: ['komisyon', 'hesap isletim', 'kart aidati', 'yillik ucret', 'bsmv', 'kkdf', 'gecikme faizi', 'faiz', 'fee', 'interest charge', 'annual fee', 'late fee'],
  taxes: ['vergi', 'gib', 'mtv', 'irs', 'tax'],
  household: ['ikea', 'koctas', 'bauhaus', 'english home', 'madame coco', 'karaca', 'home depot', 'lowes', 'bed bath', 'bim ev'],
  'housing.rent': ['kira', 'rent'],
  'housing.dues': ['aidat', 'site aidati', 'yonetim', 'hoa'],
  salary: ['maas', 'maas odemesi', 'salary', 'payroll', 'direct deposit'],
  refund: ['iade', 'refund', 'reversal'],
  investment: ['temettu', 'dividend', 'kar payi'],
};

const PHRASES: [string, string][] = Object.entries(KEYWORDS)
  .flatMap(([key, words]) => words.map((w): [string, string] => [w, key]))
  .sort((a, b) => b[0].length - a[0].length);

/** The system category key a merchant name or bank description points to, if any. */
export function keywordCategory(text: string): string | null {
  const hay = ` ${normalizeName(text)} `;
  for (const [phrase, key] of PHRASES) if (hay.includes(` ${phrase} `)) return key;
  return null;
}

export type CategoryContext = {
  /** Normalised merchant name → the category last used with it. */
  learned: Map<string, string>;
  categories: Map<string, Pick<Category, 'kind' | 'parentId' | 'hidden'>>;
};

/** A category the candidate may use: same kind and visible; a hidden sub-category falls back to its parent. */
function usable(id: string | undefined, kind: TxKind, ctx: CategoryContext): string | null {
  const c = id ? ctx.categories.get(id) : undefined;
  if (!id || !c || c.kind !== kind) return null;
  if (!c.hidden) return id;
  return c.parentId ? usable(c.parentId, kind, ctx) : null;
}

/** Learned merchant category first, then known merchant words, then "Other". */
export function suggestCategory(c: Pick<ImportCandidate, 'kind' | 'merchantName' | 'description'>, ctx: CategoryContext): string {
  const learned = c.merchantName ? usable(ctx.learned.get(normalizeName(c.merchantName)), c.kind, ctx) : null;
  if (learned) return learned;
  const key = keywordCategory(`${c.merchantName} ${c.description}`);
  const known = key ? usable(systemCategoryId(key), c.kind, ctx) : null;
  if (known) return known;
  const other = usable(systemCategoryId(c.kind === 'income' ? 'other_income' : 'other'), c.kind, ctx);
  if (other) return other;
  for (const [id, cat] of ctx.categories) if (cat.kind === c.kind && !cat.hidden && !cat.parentId) return id;
  return systemCategoryId('other');
}
