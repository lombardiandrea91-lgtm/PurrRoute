export const brand = {
  teal: '#12B5A3',
  orange: '#FFB067',
  ink: '#14202B',
  font: 'Plus Jakarta Sans',
} as const;

export const themes = {
  light: {
    background: '#F5F3EF',
    surface: '#FFFFFF',
    chip: '#EEF1F4',
    text: '#14202B',
    kitMuted: '#6B7683',
    textSecondary: '#596674',
    action: '#076A61',
  },
  dark: {
    background: '#0E151C',
    surface: '#17212B',
    chip: '#233140',
    text: '#EEF3F7',
    kitMuted: '#92A1AF',
    textSecondary: '#A7B4C1',
    action: '#12B5A3',
  },
} as const;

export type Theme = 'system' | keyof typeof themes;
export type Cat = 'rosso' | 'cipria';
export type PinState = 'tappa' | 'opzionale' | 'preferito' | 'visitato';

export const stateLabels = {
  tappa: { it: 'Tappa', en: 'Stop' },
  opzionale: { it: 'Opzionale', en: 'Optional' },
  preferito: { it: 'Preferito', en: 'Favourite' },
  visitato: { it: 'Visitato', en: 'Visited' },
} as const;