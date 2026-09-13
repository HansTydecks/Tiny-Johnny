<script lang="ts">
  /** Speicherhierarchie – mit „menschlicher Zeitskala“: Wie lange würde ein Zugriff dauern, wenn 1 ns eine Sekunde wäre? */
  interface Level {
    name: string;
    ort: string;
    groesse: string;
    zugriff: string;
    ns: number;
    preis: string;
    fluechtig: boolean;
    text: string;
  }
  const LEVELS: Level[] = [
    { name: 'Register', ort: 'im Rechen- und Steuerwerk', groesse: 'wenige Bytes', zugriff: '< 1 ns', ns: 0.3, preis: '–', fluechtig: true, text: 'Einzelne Speicherzellen direkt in der CPU, z. B. Befehlszähler, Befehlsregister, Datenregister (Akkumulator).' },
    { name: 'L1-Cache', ort: 'im Prozessorkern', groesse: '32–64 KB je Kern', zugriff: '≈ 1 ns', ns: 1, preis: '–', fluechtig: true, text: 'Winziger, extrem schneller SRAM direkt neben dem Rechenwerk – oft getrennt für Befehle und Daten.' },
    { name: 'L2-Cache', ort: 'im Prozessorkern', groesse: '0,25–2 MB je Kern', zugriff: '≈ 4 ns', ns: 4, preis: '–', fluechtig: true, text: 'Etwas größer und etwas langsamer als L1.' },
    { name: 'L3-Cache', ort: 'auf dem Prozessorchip', groesse: '8–64 MB', zugriff: '≈ 15 ns', ns: 15, preis: '–', fluechtig: true, text: 'Wird von allen Kernen gemeinsam genutzt.' },
    { name: 'Arbeitsspeicher (RAM)', ort: 'auf dem Mainboard, über den Bus', groesse: '8–64 GB', zugriff: '≈ 80 ns', ns: 80, preis: '≈ 3 €/GB', fluechtig: true, text: 'DRAM: enthält die gerade laufenden Programme und ihre Daten. Direkter Zugriff auf jede Zelle, aber flüchtig.' },
    { name: 'SSD', ort: 'Laufwerk, über PCIe/SATA', groesse: '0,5–4 TB', zugriff: '≈ 0,1 ms', ns: 1e5, preis: '≈ 0,06 €/GB', fluechtig: false, text: 'Flash-Speicher: nicht flüchtig, keine beweglichen Teile, deutlich langsamer als RAM.' },
    { name: 'Festplatte (HDD)', ort: 'Laufwerk', groesse: '1–24 TB', zugriff: '≈ 10 ms', ns: 1e7, preis: '≈ 0,02 €/GB', fluechtig: false, text: 'Magnetische Scheiben mit Schreib-/Lesekopf – der Kopf muss sich erst mechanisch bewegen.' },
    { name: 'Optische Disc', ort: 'Laufwerk / Archiv', groesse: '0,7–100 GB je Disc', zugriff: '≈ 100 ms', ns: 1e8, preis: '≈ 0,02 €/GB', fluechtig: false, text: 'CD, DVD, Blu-ray: Laser liest Pits und Lands. Heute vor allem zur Archivierung und Verteilung.' },
  ];

  let sel = $state(4);
  const human = (ns: number) => {
    const s = ns; // 1 ns → 1 s
    const unit = (n: number, one: string, many: string) => `etwa ${n.toLocaleString('de-DE')} ${n === 1 ? one : many}`;
    if (s < 1) return 'weniger als eine Sekunde';
    if (s < 120) return unit(s, 'Sekunde', 'Sekunden');
    if (s < 7200) return unit(Math.round(s / 60), 'Minute', 'Minuten');
    if (s < 86400 * 2) return unit(Math.round(s / 3600), 'Stunde', 'Stunden');
    if (s < 86400 * 60) return unit(Math.round(s / 86400), 'Tag', 'Tage');
    if (s < 86400 * 365 * 2) return unit(Math.round(s / 86400 / 30), 'Monat', 'Monate');
    return unit(Math.round(s / 86400 / 365), 'Jahr', 'Jahre');
  };
  const level = $derived(LEVELS[sel]);
</script>

<div class="pyr">
  <div class="stack">
    <span class="axis up">schneller · teurer · kleiner · näher an der ALU</span>
    {#each LEVELS as l, i}
      <button
        type="button"
        class="lvl"
        class:sel={sel === i}
        class:nv={!l.fluechtig}
        style={`--w:${34 + i * 9.4}%`}
        onclick={() => (sel = i)}
      >
        {l.name}
      </button>
      {#if i === 4}<span class="divider">▲ flüchtig · nicht flüchtig ▼</span>{/if}
    {/each}
    <span class="axis down">langsamer · billiger · größer · weiter weg</span>
  </div>

  <div class="detail" aria-live="polite">
    <h4>{level.name}</h4>
    <p>{level.text}</p>
    <dl>
      <dt>Ort</dt><dd>{level.ort}</dd>
      <dt>Typische Größe</dt><dd>{level.groesse}</dd>
      <dt>Zugriffszeit</dt><dd>{level.zugriff}</dd>
      <dt>Preis</dt><dd>{level.preis}</dd>
      <dt>Flüchtig?</dt><dd>{level.fluechtig ? 'ja – ohne Strom sind die Daten weg' : 'nein – Daten bleiben erhalten'}</dd>
    </dl>
    <div class="human">
      <span class="muted">Wäre 1 Nanosekunde eine Sekunde, dann dauerte ein Zugriff</span>
      <b>{human(level.ns)}</b>
    </div>
  </div>
</div>

<style>
  .pyr {
    margin: 1.6em 0;
    padding: 18px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 22px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .axis {
    font-size: 0.72rem;
    color: var(--text-3);
    font-weight: 600;
    text-align: center;
  }
  .axis.up::before {
    content: '▲ ';
  }
  .axis.down::after {
    content: ' ▼';
  }
  .lvl {
    width: var(--w);
    min-height: 34px;
    border: 1px solid color-mix(in srgb, var(--mem) 30%, var(--border));
    border-radius: 8px;
    background: var(--mem-soft);
    font-weight: 650;
    font-size: 0.86rem;
    cursor: pointer;
    transition: transform 0.15s, background 0.15s;
    padding: 4px 8px;
  }
  .lvl.nv {
    background: var(--abus-soft);
    border-color: color-mix(in srgb, var(--abus) 30%, var(--border));
  }
  .lvl:hover {
    transform: scale(1.02);
  }
  .lvl.sel {
    background: var(--mem);
    color: var(--surface);
    border-color: var(--mem);
  }
  .lvl.nv.sel {
    background: var(--abus);
    border-color: var(--abus);
  }
  .divider {
    font-size: 0.7rem;
    color: var(--text-3);
    border-top: 1px dashed var(--border-strong);
    width: 100%;
    text-align: center;
    padding-top: 2px;
    margin: 2px 0;
  }
  .detail h4 {
    margin: 0 0 6px;
    font-size: 1.2rem;
  }
  .detail p {
    color: var(--text-2);
    font-size: 0.93rem;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 14px;
    font-size: 0.9rem;
    margin: 0 0 12px;
  }
  dt {
    color: var(--text-3);
  }
  dd {
    margin: 0;
    font-weight: 600;
  }
  .human {
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 0.85rem;
  }
  .human b {
    font-size: 1.3rem;
  }
  @media (max-width: 760px) {
    .pyr {
      grid-template-columns: 1fr;
    }
  }
</style>
