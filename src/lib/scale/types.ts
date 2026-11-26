import type * as THREE from 'three';
import type { I18n, Lang } from './zoom';

export type Vec3 = [number, number, number];

/** Eine Beschriftung im 3D-Raum, in Einheiten der Ebene. */
export interface LabelDef {
  pos: Vec3;
  text: I18n;
  /** echte Größe in Metern (wird als „· 7 µm“ angehängt) */
  size?: number;
  /** sichtbar, solange zMin ≤ z ≤ zMax */
  zMax: number;
  zMin: number;
  /** Bezugsobjekte (Bakterium, Haar …) bekommen eine eigene Farbe */
  kind?: 'part' | 'life';
  /** Position darf sich bewegen (z. B. die laufende Ameise) */
  live?: () => Vec3;
}

export interface Frame {
  t: number;
  dt: number;
  z: number;
  /** Deckkraft dieser Ebene (0–1) */
  alpha: number;
  /** Wie sehr ist die Kamera auf diese Ebene „eingerastet“? 0 = weit weg, 1 = mittendrin */
  near(id: string): number;
  /** Kamera in Einheiten dieser Ebene */
  cam: Vec3;
  /** Blickziel in Einheiten dieser Ebene */
  target: Vec3;
  reduced: boolean;
  lang: Lang;
}

export interface Built {
  root: THREE.Object3D;
  update?(f: Frame): void;
  labels?: LabelDef[];
  /** Objekte, auf die beim Zoomen zum Mauszeiger gezielt wird */
  pick?: THREE.Object3D[];
  dispose?(): void;
}

export interface BuildCtx {
  aniso: number;
  /** Für dynamisch verankerte Ebenen: Ankerpunkt im Elternraum */
  anchor: Vec3;
}

export interface LevelDef {
  id: string;
  parent: string | null;
  /** Meter pro Einheit der Ebene (Platine: mm, Kern: µm, Transistor: nm) */
  unit: number;
  /** Lage des Ursprungs im Elternraum (Einheiten der Elternebene) */
  anchor: Vec3;
  /** Drehung relativ zur Elternebene (Euler XYZ, Bogenmaß) */
  rot?: Vec3;
  /** Ab diesem z erscheint die Ebene (z = log10(Sichtfeld in m)) */
  zIn: number;
  /** Ab diesem z darf die Elternebene ausgeblendet werden (Kind füllt das Bild) */
  zCover: number;
  /** So tief darf man zoomen, wenn diese Ebene die tiefste ist */
  floor: number;
  /** Einrastradius (Meter) – innerhalb davon gehört das Blickziel zu dieser Ebene */
  catchR: number;
  /** Anziehungsradius (Meter) – innerhalb davon zieht der Zoom zur Ebene hin */
  pullR: number;
  /** Lieblingsblickwinkel beim Betreten (Grad); Neigung 90 = senkrecht von oben */
  view?: { pitch?: number; yaw?: number; minPitch?: number };
  /** Tiefenpuffer mit der Elternebene teilen (statt darüberzuzeichnen) – für Ausschnitte auf derselben Fläche */
  shareDepth?: boolean;
  /** Diese Ebene gibt die Orientierung vor (für senkrecht stehende Bauteile) */
  frame?: boolean;
  title: I18n;
  /** Untertitel, abhängig von der Zoomtiefe: der Eintrag mit dem kleinsten z ≥ aktuellem z gilt */
  captions: { z: number; text: I18n }[];
  /** Für die Schnellwahl-Knöpfe */
  path?: string;
  /** Dynamischer Anker (Platine überall): liefert den Anker im Elternraum oder null */
  dynamic?: (parentLocal: Vec3) => Vec3 | null;
  build(ctx: BuildCtx): Built;
}
