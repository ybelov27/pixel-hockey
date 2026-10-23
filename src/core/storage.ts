export function load<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return { ...structuredClone(fallback), ...JSON.parse(raw) };
  } catch {
    return structuredClone(fallback);
  }
}

export function loadRaw<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode etc.) */
  }
}

export function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface Settings {
  periodMin: number;
  difficulty: number; // 0 Rookie, 1 Pro, 2 All-Star, 3 Legend
  icing: boolean;
  penalties: boolean;
  sound: boolean;
  music: boolean;
  shake: boolean;
  assist: boolean;
  autoSwitch: boolean;
  v: number;
}

export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  periodMin: 3,
  difficulty: 0,
  icing: false,
  penalties: true,
  sound: true,
  music: true,
  shake: true,
  assist: true,
  autoSwitch: true,
  v: SETTINGS_VERSION,
};

/** Upgrades saved settings from older versions; existing choices are kept. */
export function migrateSettings(raw: Partial<Settings> | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const s = { ...DEFAULT_SETTINGS, ...raw };
  if (!raw.v || raw.v < 2) {
    s.assist = true;
    s.autoSwitch = true;
  }
  s.v = SETTINGS_VERSION;
  return s;
}

export const settings: Settings = migrateSettings(loadRaw<Partial<Settings>>('ph.settings'));

export function saveSettings() {
  save('ph.settings', settings);
}

export const DIFFICULTY_NAMES = ['ROOKIE', 'PRO', 'ALL-STAR', 'LEGEND'];
