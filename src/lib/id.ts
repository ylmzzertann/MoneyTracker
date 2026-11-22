import * as Crypto from 'expo-crypto';

export function newId(): string {
  return Crypto.randomUUID();
}

export function nowUtc(): string {
  return new Date().toISOString();
}
