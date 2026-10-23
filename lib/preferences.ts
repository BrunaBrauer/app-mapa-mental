export type Preferences = { dark: boolean; grid: boolean; sidebar: boolean; alwaysToolbar: boolean };
export const defaultPreferences: Preferences = { dark: false, grid: true, sidebar: true, alwaysToolbar: true };
export function normalizePreferences(value: unknown): Preferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaultPreferences).map(([key, fallback]) => [key, typeof input[key] === 'boolean' ? input[key] : fallback])) as Preferences;
}
