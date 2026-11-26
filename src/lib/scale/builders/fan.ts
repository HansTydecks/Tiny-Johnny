/**
 * Grafikkarten-Lüfter (Einheit: mm): sichelförmige, verdrehte Flügel mit Dicke, Außenring an den Flügelspitzen,
 * Nabe mit Aufkleber, Haltestreben und Motor. Dreht mit leichter Bewegungsunschärfe.
 * Achse = lokale z-Achse (Luft strömt in −z-Richtung zur Platine).
 */
import { THREE, canvasTex, makeCanvas, phys, std } from './kit';

const BLADES = 11;

/** Ein Flügel als geschlossene Fläche (Ober- und Unterseite plus Kanten). */
function bladeGeometry(r0: number, r1: number): THREE.BufferGeometry {
  const NU = 22;
  const NV = 12;
  const pos: number[] = [];
  const idx: number[] = [];
  const point = (u: number, v: number, side: number) => {
    const r = r0 + (r1 - r0) * u;
    // Sehne wird nach außen breiter, an der Spitze abgerundet
    const tip = u > 0.86 ? Math.sqrt(Math.max(0, 1 - ((u - 0.86) / 0.14) ** 2)) : 1;
    const chord = (12 + 15 * u) * (0.35 + 0.65 * tip);
    const beta = ((36 - 15 * u) * Math.PI) / 180; // Anstellwinkel: an der Nabe steiler
    const sweep = 0.55 * u * u; // Sichelform: Flügel biegt sich nach vorne
    const s = v - 0.5;
    const th = sweep + (s * chord * Math.cos(beta)) / r;
    const camber = Math.sin(Math.PI * v) * chord * 0.07;
    const thick = (0.9 - 0.45 * u) * Math.sin(Math.PI * Math.min(1, v * 1.15 + 0.03)) + 0.08;
    const z = s * chord * Math.sin(beta) + camber + side * thick * 0.5;
    return [r * Math.cos(th), r * Math.sin(th), z];
  };
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) pos.push(...point(i / NU, j / NV, side));
    for (let i = 0; i < NU; i++)
      for (let j = 0; j < NV; j++) {
        const a = base + i * (NV + 1) + j;
        const b = a + NV + 1;
        if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
        else idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
  }
  // Kanten (Vorder-, Hinterkante, Spitze) schließen
  const top = 0;
  const bot = (NU + 1) * (NV + 1);
  const at = (b: number, i: number, j: number) => b + i * (NV + 1) + j;
  for (let i = 0; i < NU; i++)
    for (const j of [0, NV]) {
      const a1 = at(top, i, j);
      const a2 = at(top, i + 1, j);
      const b1 = at(bot, i, j);
      const b2 = at(bot, i + 1, j);
      if (j === 0) idx.push(a1, b1, a2, a2, b1, b2);
      else idx.push(a1, a2, b1, a2, b2, b1);
    }
  for (let j = 0; j < NV; j++) {
    const a1 = at(top, NU, j);
    const a2 = at(top, NU, j + 1);
    const b1 = at(bot, NU, j);
    const b2 = at(bot, NU, j + 1);
    idx.push(a1, a2, b1, a2, b2, b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let hubCanvas: HTMLCanvasElement | null = null;
function hubTexture(aniso: number) {
  if (!hubCanvas) {
    const { cv, g } = makeCanvas(256, 256);
    const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    gr.addColorStop(0, '#2c2f35');
    gr.addColorStop(1, '#16181c');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(128, 128, 128, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8fb4ff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(128, 128, 104, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#e8ecf5';
    g.font = '800 64px "Inter Variable", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TJ', 128, 124);
    g.font = '600 18px "JetBrains Mono Variable", monospace';
    g.fillStyle = '#9aa5bf';
    g.fillText('12V · 0.45A', 128, 176);
    hubCanvas = cv;
  }
  return canvasTex(hubCanvas, aniso);
}

let blurCanvas: HTMLCanvasElement | null = null;
function blurTexture(aniso: number) {
  if (!blurCanvas) {
    const { cv, g } = makeCanvas(256, 256);
    const gr = g.createRadialGradient(128, 128, 40, 128, 128, 126);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.92, 'rgba(255,255,255,0.75)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    blurCanvas = cv;
  }
  return canvasTex(blurCanvas, aniso, false);
}

export interface Fan {
  obj: THREE.Group;
  /** Material der Unschärfescheibe – ihre Deckkraft setzt der Aufrufer über userData.fade */
  blur: THREE.Material;
  /** 0 = steht, 1 = volle Drehzahl */
  blurK: number;
  /** dreht den Rotor; speed in Umdrehungen pro Sekunde */
  update(dt: number, speed: number): void;
}

export function buildFan(R: number, aniso: number, frameMat: THREE.Material): Fan {
  const obj = new THREE.Group();
  const rotor = new THREE.Group();
  obj.add(rotor);
  const plastic = phys({ color: 0x17191d, roughness: 0.38, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  const hubR = 15;
  const tipR = R - 1.6;
  const geo = bladeGeometry(hubR - 1, tipR);
  for (let i = 0; i < BLADES; i++) {
    const b = new THREE.Mesh(geo, plastic);
    b.rotation.z = (i / BLADES) * Math.PI * 2;
    rotor.add(b);
  }
  // Außenring verbindet die Flügelspitzen (wie bei modernen Grafikkarten)
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(tipR + 0.6, tipR + 0.6, 4.2, 96, 1, true), plastic);
  ring.rotation.x = Math.PI / 2;
  rotor.add(ring);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(tipR + 0.6, 0.55, 8, 96), plastic);
  lip.position.z = 2.1;
  rotor.add(lip);
  // Nabe mit gewölbtem Deckel und Aufkleber
  const hubSide = std({ color: 0x1b1d22, roughness: 0.45 });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, 7, 64), hubSide);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.5;
  rotor.add(hub);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(hubR, 48, 12, 0, Math.PI * 2, 0, 0.42), hubSide);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 3 - hubR * Math.cos(0.42);
  rotor.add(cap);
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(hubR * 0.82, 48), std({ map: hubTexture(aniso), roughness: 0.35 }));
  sticker.position.z = 3.05;
  rotor.add(sticker);
  // Bewegungsunschärfe
  const blur = new THREE.Mesh(
    new THREE.RingGeometry(hubR, tipR + 0.4, 96),
    new THREE.MeshBasicMaterial({ color: 0x2a2e36, alphaMap: blurTexture(aniso), transparent: true, opacity: 0.32, depthWrite: false }),
  );
  blur.position.z = 0.2;
  obj.add(blur);
  // Motor und Haltestreben (stehen still)
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(hubR * 0.9, hubR * 0.9, 5, 48), frameMat);
  motor.rotation.x = Math.PI / 2;
  motor.position.z = -6.5;
  obj.add(motor);
  for (let i = 0; i < 3; i++) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(R - hubR + 2, 2.2, 1.6), frameMat);
    const a = (i / 3) * Math.PI * 2 + 0.3;
    strut.position.set(Math.cos(a) * (hubR + (R - hubR) / 2), Math.sin(a) * (hubR + (R - hubR) / 2), -7.5);
    strut.rotation.z = a;
    obj.add(strut);
  }
  let spin = 0;
  const fan: Fan = {
    obj,
    blur: blur.material as THREE.Material,
    blurK: 0,
    update(dt, speed) {
      spin += dt * speed;
      rotor.rotation.z = -spin * Math.PI * 2;
      fan.blurK = Math.min(1, speed / 2);
    },
  };
  return fan;
}
