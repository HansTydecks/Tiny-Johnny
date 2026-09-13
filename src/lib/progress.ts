/**
 * Lernfortschritt – nur lokal im Browser gespeichert (keine Anmeldung, keine Daten an Server).
 */

export interface TaskProgress {
  geloest?: boolean;
  tipps?: number;
  loesungGesehen?: boolean;
  /** Programm als Teilen-Code (nur belegte Zellen) */
  programm?: string;
}

export interface Progress {
  kapitel: Record<string, boolean>;
  level: Record<string, boolean>;
  aufgaben: Record<string, TaskProgress>;
}

const KEY = 'tinyjohnny:progress:v1';
const EVENT = 'tj-progress';

const empty = (): Progress => ({ kapitel: {}, level: {}, aufgaben: {} });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw);
    return { ...empty(), ...p };
  } catch {
    return empty();
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* privater Modus o. Ä. – dann eben ohne Speichern */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: p }));
}

export function update(fn: (p: Progress) => void) {
  const p = loadProgress();
  fn(p);
  save(p);
}

export function markKapitel(slug: string, done = true) {
  update((p) => {
    p.kapitel[slug] = done;
  });
}

export function markLevel(id: string) {
  update((p) => {
    p.level[id] = true;
  });
}

export function updateTask(id: string, patch: Partial<TaskProgress>) {
  update((p) => {
    p.aufgaben[id] = { ...p.aufgaben[id], ...patch };
  });
}

export function onProgress(fn: (p: Progress) => void): () => void {
  const handler = () => fn(loadProgress());
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function resetProgress() {
  save(empty());
}

// Kleine Helfer für lokale Speicherung anderer Dinge (Sandbox, Programme)
export function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignorieren */
  }
}
