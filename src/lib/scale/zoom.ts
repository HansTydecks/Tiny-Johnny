/**
 * Reine Mathematik für den Zoom – ohne three.js, damit sie getestet werden kann.
 *
 * Der Zoom wird als z = log10(Sichtfeld in Metern) beschrieben. Ein Schritt um 1 entspricht immer
 * einem Faktor 10 – so fühlt sich der Flug von 30 cm bis 0,3 nm überall gleich schnell an.
 */
export type Lang = 'de' | 'en';
export type I18n = { de: string; en: string };
export const t = (de: string, en: string = de): I18n => ({ de, en });

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Weicher Übergang 0 → 1, wenn x von e0 nach e1 läuft (e0 > e1 ist erlaubt). */
export function smoothstep(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const k = clamp((x - e0) / (e1 - e0), 0, 1);
  return k * k * (3 - 2 * k);
}

/** Abstand der Kamera, damit das Sichtfeld (kürzere Bildschirmseite) genau `w` breit ist. */
export function fovToDistance(w: number, vfovDeg: number, aspect: number): number {
  const tv = Math.tan((vfovDeg * Math.PI) / 360);
  return aspect >= 1 ? w / (2 * tv) : w / (2 * tv * aspect);
}

/** Bremsfaktor: in der Nähe interessanter Stellen (Enthüllungen) wird der Zoom langsamer. */
export function density(z: number, landmarks: readonly number[], width = 0.16, depth = 0.55): number {
  let m = 0;
  for (const l of landmarks) {
    const d = (z - l) / width;
    m = Math.max(m, Math.exp(-d * d));
  }
  return 1 - depth * m;
}

/** Mausrad/Trackpad → Impuls für die Zoomgeschwindigkeit (Dekaden pro Sekunde). */
export function wheelImpulse(deltaY: number, deltaMode: number, zVel: number): number {
  // deltaMode 1 = Zeilen (Firefox), 2 = Seiten
  const px = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 800 : deltaY;
  const p = clamp(px, -240, 240);
  // Wer weiterscrollt, wird schneller: der Zoom nimmt Schwung auf
  const boost = 1 + Math.min(2.2, Math.abs(zVel) * 0.9);
  // Rad nach vorne (deltaY < 0) = hineinzoomen = z wird kleiner
  return p * 0.0068 * boost;
}

/** Einen Schritt der Zoom-Physik: Schwung, Reibung und weiche Grenzen. */
export function stepZoom(
  z: number,
  vel: number,
  dt: number,
  floor: number,
  ceil: number,
  friction: number,
): { z: number; vel: number } {
  let v = vel * Math.exp(-friction * dt);
  let nz = z + v * dt;
  // weiche Grenzen: federnd zurück, statt hart anzuhalten
  if (nz < floor) {
    const over = floor - nz;
    nz = floor - over * Math.exp(-14 * dt);
    if (v < 0) v *= Math.exp(-20 * dt);
  } else if (nz > ceil) {
    const over = nz - ceil;
    nz = ceil + over * Math.exp(-14 * dt);
    if (v > 0) v *= Math.exp(-20 * dt);
  }
  if (Math.abs(v) < 1e-4) v = 0;
  return { z: nz, vel: v };
}

/** Kritisch gedämpfte Feder: bewegt `x` sanft auf `target` zu (für Autopilot und Blickwinkel). */
export function damp(x: number, target: number, lambda: number, dt: number): number {
  return lerp(x, target, 1 - Math.exp(-lambda * dt));
}

export function dampAngle(a: number, target: number, lambda: number, dt: number): number {
  let d = target - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * (1 - Math.exp(-lambda * dt));
}

const UNITS: { f: number; u: string }[] = [
  { f: 1, u: 'm' },
  { f: 1e-2, u: 'cm' },
  { f: 1e-3, u: 'mm' },
  { f: 1e-6, u: 'µm' },
  { f: 1e-9, u: 'nm' },
  { f: 1e-12, u: 'pm' },
];

/** Länge in Metern → „340 µm“ bzw. „0,54 nm“ (mit deutschem Komma). */
export function formatLength(m: number, lang: Lang = 'de', digits = 3): string {
  if (!isFinite(m) || m <= 0) return '–';
  let unit = UNITS[UNITS.length - 1];
  for (const u of UNITS) {
    if (u.u === 'cm' && (m >= 0.1 || m < 0.01)) continue; // cm nur für 1–9,9 cm
    if (m >= u.f * 0.9999) {
      unit = u;
      break;
    }
  }
  const v = m / unit.f;
  const dec = v >= 100 ? 0 : v >= 10 ? Math.max(0, digits - 2) : Math.max(0, digits - 1);
  let s = v.toFixed(dec);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (lang === 'de') s = s.replace('.', ',');
  return `${s} ${unit.u}`;
}

/** Größte „runde“ Länge (1·2·5 × 10ⁿ), die höchstens `max` Meter lang ist – für den Maßstabsbalken. */
export function niceLength(max: number): number {
  if (!(max > 0)) return 0;
  const e = Math.floor(Math.log10(max));
  const base = Math.pow(10, e);
  const r = max / base;
  const m = r >= 5 ? 5 : r >= 2 ? 2 : 1;
  return m * base;
}

/** Wie viele Male größer/kleiner? „1 Million ×“ – für Vergleiche im HUD. */
export function formatFactor(f: number, lang: Lang = 'de'): string {
  const words =
    lang === 'de'
      ? [
          [1e12, 'Billion'],
          [1e9, 'Milliarde'],
          [1e6, 'Million'],
          [1e3, 'Tausend'],
        ]
      : [
          [1e12, 'trillion'],
          [1e9, 'billion'],
          [1e6, 'million'],
          [1e3, 'thousand'],
        ];
  for (const [v, w] of words as [number, string][]) {
    if (f >= v) {
      const n = Math.round(f / v);
      const plural = lang === 'de' && n !== 1 && w !== 'Tausend' ? (w.endsWith('e') ? w + 'n' : w + 'en') : w;
      return `${n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')} ${plural}`;
    }
  }
  return Math.round(f).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
}

/** Sichtbarkeit einer Ebene: blendet ab `zIn` über `fade` Dekaden ein. */
export function fadeIn(z: number, zIn: number, fade = 0.3): number {
  return smoothstep(zIn, zIn - fade, z);
}
