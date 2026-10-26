export type Locale = 'it' | 'en';
export type Preferences = {
  locale: Locale;
  theme: 'system' | 'light' | 'dark';
  cat: 'rosso' | 'cipria';
};

export const preferencesKey = 'purrroute.preferences.v1';
export const defaults: Preferences = { locale: 'it', theme: 'system', cat: 'rosso' };

export function parsePreferences(value: string | null): Preferences {
  if (!value) return { ...defaults };
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || !parsed || Array.isArray(parsed)) return { ...defaults };
    const record = parsed as Record<string, unknown>;
    return {
      locale: record['locale'] === 'en' ? 'en' : 'it',
      theme: record['theme'] === 'light' || record['theme'] === 'dark' ? record['theme'] : 'system',
      cat: record['cat'] === 'cipria' ? 'cipria' : 'rosso',
    };
  } catch { return { ...defaults }; }
}

export function loadPreferences(): Preferences {
  try { return parsePreferences(localStorage.getItem(preferencesKey)); }
  catch { return { ...defaults }; }
}

export function savePreferences(preferences: Preferences): boolean {
  try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); return true; }
  catch { return false; }
}