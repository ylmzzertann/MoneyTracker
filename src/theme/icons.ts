import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/**
 * Every icon the app draws. Keys are Material Symbols names (used on Android
 * and web); values are the closest Apple SF Symbol (used on iOS). Both sides
 * are type-checked against the symbol lists that ship with expo-symbols.
 * Category and account icons are stored in the database by these keys.
 */
export const ICONS = {
  // Categories
  shopping_cart: 'cart',
  restaurant: 'fork.knife',
  local_cafe: 'cup.and.saucer',
  receipt_long: 'doc.text',
  bolt: 'bolt',
  water_drop: 'drop',
  local_fire_department: 'flame',
  wifi: 'wifi',
  smartphone: 'iphone',
  package_2: 'shippingbox',
  home: 'house',
  key: 'key',
  apartment: 'building.2',
  handyman: 'hammer',
  directions_car: 'car',
  local_gas_station: 'fuelpump',
  directions_bus: 'bus',
  local_taxi: 'car.side',
  local_parking: 'parkingsign',
  stethoscope: 'stethoscope',
  spa: 'leaf',
  cleaning_services: 'bubbles.and.sparkles',
  apparel: 'tshirt',
  movie: 'film',
  subscriptions: 'repeat',
  school: 'graduationcap',
  flight: 'airplane',
  fitness_center: 'dumbbell',
  redeem: 'gift',
  child_care: 'figure.and.child.holdinghands',
  pets: 'pawprint',
  account_balance: 'building.columns',
  request_quote: 'doc.text.magnifyingglass',
  more_horiz: 'ellipsis',
  payments: 'banknote',
  work: 'briefcase',
  trending_up: 'chart.line.uptrend.xyaxis',
  currency_exchange: 'arrow.uturn.backward',
  savings: 'dollarsign.circle',
  storefront: 'storefront',
  language: 'globe',
  sports_esports: 'gamecontroller',
  local_florist: 'camera.macro',
  favorite: 'heart',
  // Accounts
  credit_card: 'creditcard',
  account_balance_wallet: 'wallet.pass',
  // Interface
  add: 'plus',
  close: 'xmark',
  check: 'checkmark',
  check_circle: 'checkmark.circle',
  search: 'magnifyingglass',
  delete: 'trash',
  content_copy: 'doc.on.doc',
  edit: 'pencil',
  calendar_month: 'calendar',
  visibility: 'eye',
  visibility_off: 'eye.slash',
  expand_more: 'chevron.down',
  chevron_left: 'chevron.left',
  chevron_right: 'chevron.right',
  format_list_bulleted: 'list.bullet',
  donut_large: 'chart.pie',
  table_rows: 'tablecells',
  trending_down: 'arrow.down.right',
  dialpad: 'circle.grid.3x3',
  keyboard_double_arrow_up: 'chevron.up.2',
  backspace: 'delete.left',
  settings: 'gearshape',
  lock: 'lock',
  ios_share: 'square.and.arrow.up',
  category: 'square.grid.2x2',
  palette: 'paintpalette',
  archive: 'archivebox',
  unarchive: 'tray.and.arrow.up',
  // Planning
  notifications: 'bell',
  autorenew: 'arrow.triangle.2.circlepath',
  flag: 'flag',
  lightbulb: 'lightbulb',
  warning: 'exclamationmark.triangle',
  schedule: 'clock',
  skip_next: 'forward.end',
  auto_awesome: 'sparkles',
  arrow_forward: 'arrow.right',
  remove: 'minus',
  add_circle: 'plus.circle',
  event_upcoming: 'calendar.badge.clock',
  pie_chart: 'chart.pie.fill',
} as const satisfies Partial<Record<AndroidSymbol, SFSymbol>>;

export type IconName = keyof typeof ICONS;

export function isIconName(name: string): name is IconName {
  return name in ICONS;
}

/** Icon for a stored name; unknown names (e.g. from an older version) fall back to "more". */
export function iconOrDefault(name: string | null | undefined): IconName {
  return name && isIconName(name) ? name : 'more_horiz';
}
