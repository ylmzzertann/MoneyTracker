import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';

import type { Grid } from './parse/delimited';
import { gridFromBytes, ImportError } from './parse/source';

const MAX_BYTES = 10 * 1024 * 1024;

/** Text the user copied (a bank SMS, a notification, rows from a spreadsheet). */
export async function readClipboardText(): Promise<string> {
  return (await Clipboard.getStringAsync()).trim();
}

/** Opens the system file picker; null when the user cancels. */
export async function pickStatementFile(): Promise<{ name: string; grid: Grid } | null> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return null;
  const file = picked.result;
  if (file.size > MAX_BYTES) throw new ImportError('tooLarge');
  return { name: file.name, grid: gridFromBytes(await file.bytes()) };
}
