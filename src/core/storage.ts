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
  offside: boolean;
  icing: boolean;
  penalties: boolean;
  sound: boolean;
  music: boolean;
  shake: boolean;
}

export const settings: Settings = load<Settings>('ph.settings', {
  periodMin: 3,
  difficulty: 1,
  offside: true,
  icing: true,
  penalties: true,
  sound: true,
  music: true,
  shake: true,
});

export function saveSettings() {
  save('ph.settings', settings);
}

export const DIFFICULTY_NAMES = ['ROOKIE', 'PRO', 'ALL-STAR', 'LEGEND'];
