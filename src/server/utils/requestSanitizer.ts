export const FORBIDDEN_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function stripPrototypePollution(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripPrototypePollution);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_PROTO_KEYS.has(k)) continue;
      clean[k] = stripPrototypePollution(v);
    }
    return clean;
  }
  return value;
}

export function omitKeys<T extends Record<string, any>>(obj: T, keys: string[]): Record<string, any> {
  const copy = stripPrototypePollution(obj || {});
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

export function sanitizeStringList(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return Array.from(
    new Set(
      input
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0 && v.length <= 64)
    )
  );
}
