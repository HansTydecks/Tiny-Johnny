import { describe, expect, it } from 'vitest';
import { density, fadeIn, formatFactor, formatLength, fovToDistance, niceLength, smoothstep, stepZoom, wheelImpulse } from './zoom';

describe('Zoom-Mathematik', () => {
  it('formatiert Längen mit passender Einheit', () => {
    expect(formatLength(0.305)).toBe('305 mm');
    expect(formatLength(0.05)).toBe('5 cm');
    expect(formatLength(340e-6)).toBe('340 µm');
    expect(formatLength(0.543e-9)).toBe('543 pm');
    expect(formatLength(2.5e-9)).toBe('2,5 nm');
    expect(formatLength(2.5e-9, 'en')).toBe('2.5 nm');
    expect(formatLength(7.8e-6)).toBe('7,8 µm');
    expect(formatLength(1)).toBe('1 m');
  });

  it('wählt runde Maßstablängen (1 · 2 · 5)', () => {
    expect(niceLength(0.0037)).toBeCloseTo(0.002);
    expect(niceLength(0.0099)).toBeCloseTo(0.005);
    expect(niceLength(1.2e-9)).toBeCloseTo(1e-9);
    expect(niceLength(0)).toBe(0);
  });

  it('smoothstep läuft in beide Richtungen', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothstep(-1, -2, -1.5)).toBeCloseTo(0.5);
    expect(smoothstep(-1, -2, 0)).toBe(0);
    expect(smoothstep(-1, -2, -3)).toBe(1);
    expect(fadeIn(-2, -1.5)).toBe(1);
    expect(fadeIn(-1, -1.5)).toBe(0);
  });

  it('Kameraabstand wächst linear mit dem Sichtfeld', () => {
    const a = fovToDistance(1, 38, 1.6);
    expect(fovToDistance(1e-9, 38, 1.6) / a).toBeCloseTo(1e-9);
    // Hochformat: das schmale Sichtfeld bestimmt den Abstand
    expect(fovToDistance(1, 38, 0.5)).toBeCloseTo(a * 2);
  });

  it('Mausrad nach oben zoomt hinein, Schwung beschleunigt', () => {
    expect(wheelImpulse(-100, 0, 0)).toBeLessThan(0);
    expect(wheelImpulse(100, 0, 0)).toBeGreaterThan(0);
    expect(Math.abs(wheelImpulse(-100, 0, 2))).toBeGreaterThan(Math.abs(wheelImpulse(-100, 0, 0)));
    // Firefox liefert Zeilen statt Pixel
    expect(wheelImpulse(-3, 1, 0)).toBeCloseTo(wheelImpulse(-99, 0, 0));
  });

  it('bremst in der Nähe von Enthüllungen', () => {
    expect(density(-2, [-2])).toBeCloseTo(0.45);
    expect(density(-4, [-2])).toBeCloseTo(1);
  });

  it('Physik: Schwung klingt ab, Grenzen federn', () => {
    let s = { z: 0, vel: -1 };
    for (let i = 0; i < 300; i++) s = stepZoom(s.z, s.vel, 1 / 60, -10, 1, 5);
    expect(s.vel).toBe(0);
    expect(s.z).toBeCloseTo(-0.2, 1);
    let f = { z: -2.9, vel: -5 };
    for (let i = 0; i < 400; i++) f = stepZoom(f.z, f.vel, 1 / 60, -3, 1, 5);
    expect(f.z).toBeGreaterThan(-3.01);
  });

  it('nennt Vergrößerungen in Worten', () => {
    expect(formatFactor(1.2e9)).toBe('1 Milliarde');
    expect(formatFactor(3e6)).toBe('3 Millionen');
    expect(formatFactor(3e6, 'en')).toBe('3 million');
    expect(formatFactor(45)).toBe('45');
  });
});
