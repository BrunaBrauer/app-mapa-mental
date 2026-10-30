import type { MovementMode } from '../types';

export type Preferences = { dark: boolean; grid: boolean; sidebar: boolean; alwaysToolbar: boolean; movementMode: MovementMode; avoidOverlap: boolean };
export const defaultPreferences: Preferences = { dark: false, grid: true, sidebar: true, alwaysToolbar: true, movementMode: 'hierarchical', avoidOverlap: true };
export function normalizePreferences(value: unknown): Preferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { ...defaultPreferences,
    dark: typeof input.dark === 'boolean' ? input.dark : defaultPreferences.dark,
    grid: typeof input.grid === 'boolean' ? input.grid : defaultPreferences.grid,
    sidebar: typeof input.sidebar === 'boolean' ? input.sidebar : defaultPreferences.sidebar,
    alwaysToolbar: typeof input.alwaysToolbar === 'boolean' ? input.alwaysToolbar : defaultPreferences.alwaysToolbar,
    movementMode: ['individual', 'hierarchical', 'automatic'].includes(String(input.movementMode)) ? input.movementMode as MovementMode : defaultPreferences.movementMode,
    avoidOverlap: typeof input.avoidOverlap === 'boolean' ? input.avoidOverlap : defaultPreferences.avoidOverlap,
  };
}
