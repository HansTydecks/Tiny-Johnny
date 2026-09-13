<script lang="ts">
  /**
   * Datenverarbeitung in zwei Phasen an einer kleinen Binärmaschine:
   * 8-Bit-Befehle = 4 Bit Opcode + 4 Bit Adresse. LOAD 0001 · ADD 0010 · STORE 0011 · HALT 1111
   */
  const OPS: Record<number, string> = { 1: 'LOAD', 2: 'ADD', 3: 'STORE', 15: 'HALT' };
  const START = [0b00010100, 0b00100101, 0b00110110, 0b11110000, 0b00000011, 0b00000100, 0b00000000, 0b00000000];

  let mem = $state([...START]);
  let bz = $state(0);
  let br = $state<number | null>(null);
  let acc = $state(0);
  let dr = $state<number | null>(null);
  let zero = $state(true);
  let phaseIdx = $state(0);
  let halted = $state(false);
  let ab = $state<number | null>(null);
  let db = $state<number | null>(null);
  let sb = $state<'lesen' | 'schreiben' | null>(null);

  const bin = (v: number, n = 8) => v.toString(2).padStart(n, '0');
  const PHASES = [
    { key: 'laden', phase: 1, name: 'Befehl laden' },
    { key: 'decode', phase: 1, name: 'Befehl decodieren' },
    { key: 'daten', phase: 1, name: 'Daten holen' },
    { key: 'alu', phase: 2, name: 'ALU führt Befehl aus' },
    { key: 'ergebnis', phase: 2, name: 'Ergebnis speichern / weiterverwenden' },
  ] as const;

  let text = $state('Drücke „Nächster Schritt“. Der Befehlszähler zeigt auf Zelle 0.');
  const op = $derived(br === null ? null : br >> 4);
  const adr = $derived(br === null ? null : br & 15);

  function step() {
    if (halted) return;
    const k = PHASES[phaseIdx].key;
    ab = null;
    db = null;
    sb = null;
    if (k === 'laden') {
      ab = bz;
      sb = 'lesen';
      db = mem[bz];
      br = mem[bz];
      text = `Befehlszähler ${bz} → Adressbus, Steuerbus „lesen“, Speicher liefert ${bin(mem[bz])} über den Datenbus ins Befehlsregister. Befehlszähler wird auf ${bz + 1} erhöht.`;
      bz = bz + 1;
    } else if (k === 'decode') {
      const name = OPS[op!] ?? '???';
      text = `Der Befehlsdecodierer zerlegt ${bin(br!)}: Opcode ${bin(op!, 4)} = ${name}, Adresse ${bin(adr!, 4)} = ${adr}.`;
      if (name === 'HALT') {
        text += ' → Die Maschine hält an.';
        halted = true;
        phaseIdx = 2;
        return;
      }
    } else if (k === 'daten') {
      if (OPS[op!] === 'STORE') {
        text = 'STORE braucht keine Daten aus dem Speicher – der Wert steht schon im Akkumulator.';
        dr = null;
      } else {
        ab = adr;
        sb = 'lesen';
        db = mem[adr!];
        dr = mem[adr!];
        text = `Adressteil ${adr} → Adressbus, „lesen“: Der Operand ${bin(mem[adr!])} (= ${mem[adr!]}) kommt ins Datenregister.`;
      }
    } else if (k === 'alu') {
      const name = OPS[op!];
      if (name === 'LOAD') {
        acc = dr!;
        text = `LOAD: Die ALU übernimmt den Operanden in den Akkumulator: ${acc}.`;
      } else if (name === 'ADD') {
        const before = acc;
        acc = (acc + dr!) & 255;
        text = `ADD: Die ALU rechnet ${before} + ${dr} = ${acc}.`;
      } else {
        text = 'STORE: Keine Rechnung nötig – das Ergebnis liegt bereit.';
      }
      zero = acc === 0;
    } else if (k === 'ergebnis') {
      if (OPS[op!] === 'STORE') {
        ab = adr;
        db = acc;
        sb = 'schreiben';
        mem[adr!] = acc;
        text = `Adresse ${adr} → Adressbus, Akkumulator ${bin(acc)} → Datenbus, „schreiben“: Das Ergebnis steht jetzt in Zelle ${adr}.`;
      } else {
        text = `Das Ergebnis bleibt im Akkumulator (${acc}) und wird vom nächsten Befehl weiterverwendet. Weiter mit dem nächsten Befehl!`;
      }
    }
    phaseIdx = (phaseIdx + 1) % PHASES.length;
  }

  function reset() {
    mem = [...START];
    bz = 0;
    br = null;
    acc = 0;
    dr = null;
    zero = true;
    phaseIdx = 0;
    halted = false;
    ab = db = null;
    sb = null;
    text = 'Drücke „Nächster Schritt“. Der Befehlszähler zeigt auf Zelle 0.';
  }

  const lastPhase = $derived((phaseIdx + PHASES.length - 1) % PHASES.length);
  const started = $derived(br !== null);
</script>

<div class="fde">
  <div class="phases">
    <div class="ph p1" class:on={started && PHASES[lastPhase].phase === 1}>
      <b>1 · Interpretationsphase</b> <span>Fetch + Decode</span>
      <ol>
        {#each PHASES.slice(0, 3) as p, i}<li class:now={started && lastPhase === i}>{p.name}</li>{/each}
      </ol>
    </div>
    <div class="ph p2" class:on={started && PHASES[lastPhase].phase === 2}>
      <b>2 · Ausführungsphase</b> <span>Execute</span>
      <ol start="4">
        {#each PHASES.slice(3) as p, i}<li class:now={started && lastPhase === i + 3}>{p.name}</li>{/each}
      </ol>
    </div>
  </div>

  <div class="machine">
    <div class="cpu">
      <span class="lbl">CPU</span>
      <div class="sw">
        <span class="wt">Steuerwerk</span>
        <div class="reg"><span>Befehlszähler</span><b class="mono">{bz}</b></div>
        <div class="reg"><span>Befehlsregister</span><b class="mono">{br === null ? '––––––––' : bin(br)}</b></div>
        <div class="reg"><span>Befehlsdecodierer</span><b class="mono">{op === null ? '–' : `${OPS[op] ?? '???'} ${OPS[op] === 'HALT' ? '' : adr}`}</b></div>
        <div class="reg"><span>Statusregister</span><b class="mono">Z={zero ? 1 : 0}</b></div>
      </div>
      <div class="rw">
        <span class="wt">Rechenwerk</span>
        <div class="reg"><span>Datenregister</span><b class="mono">{dr === null ? '––––––––' : bin(dr)}</b></div>
        <div class="reg"><span>Akkumulator</span><b class="mono">{bin(acc)} <small>= {acc}</small></b></div>
      </div>
    </div>

    <div class="buses">
      <div class="bl ab" class:on={ab !== null}><span>Adressbus</span><b class="mono">{ab === null ? '' : bin(ab, 4)}</b></div>
      <div class="bl sbl" class:on={sb !== null}><span>Steuerbus</span><b>{sb ?? ''}</b></div>
      <div class="bl db" class:on={db !== null}><span>Datenbus</span><b class="mono">{db === null ? '' : bin(db)}</b></div>
    </div>

    <div class="mem">
      <span class="lbl">Speicher</span>
      <table>
        <tbody>
          {#each mem as v, i}
            <tr class:pc={i === bz && !halted} class:sel={ab === i}>
              <td class="mono">{i}</td>
              <td class="mono">{bin(v)}</td>
              <td class="mean">{i < 4 ? `${OPS[v >> 4] ?? ''} ${OPS[v >> 4] === 'HALT' ? '' : v & 15}` : `= ${v}`}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <p class="text" aria-live="polite">{text}</p>
  <div class="actions">
    <button class="btn primary small" type="button" onclick={step} disabled={halted}>Nächster Schritt</button>
    <button class="btn small ghost" type="button" onclick={reset}>Zurücksetzen</button>
    {#if halted}<span class="done">✓ Programm beendet: In Zelle 6 steht {mem[6]} (3 + 4).</span>{/if}
  </div>
</div>

<style>
  .fde {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  .phases {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .ph {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1.5px solid var(--border);
    font-size: 0.88rem;
    opacity: 0.75;
  }
  .ph span {
    color: var(--text-3);
  }
  .ph ol {
    margin: 6px 0 0;
    padding-left: 1.3em;
  }
  .ph li.now {
    font-weight: 750;
  }
  .p1.on {
    border-color: var(--cu);
    background: var(--cu-soft);
    opacity: 1;
  }
  .p2.on {
    border-color: var(--alu);
    background: var(--alu-soft);
    opacity: 1;
  }
  .machine {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  .lbl {
    display: block;
    font-weight: 800;
    font-size: 0.85rem;
    margin-bottom: 6px;
  }
  .cpu {
    padding: 10px;
    border-radius: 14px;
    border: 2px dashed var(--border-strong);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sw,
  .rw {
    padding: 8px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sw {
    background: var(--cu-soft);
  }
  .rw {
    background: var(--alu-soft);
  }
  .wt {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-2);
  }
  .reg {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.8rem;
    background: var(--surface);
    padding: 3px 8px;
    border-radius: 6px;
  }
  .reg b small {
    color: var(--text-3);
    font-weight: 500;
  }
  .buses {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 26px;
  }
  .bl {
    --lc: var(--sbus);
    display: flex;
    flex-direction: column;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1.5px solid color-mix(in srgb, var(--lc) 35%, var(--border));
    font-size: 0.78rem;
    min-height: 48px;
    opacity: 0.6;
  }
  .bl.on {
    opacity: 1;
    border-color: var(--lc);
    background: color-mix(in srgb, var(--lc) 12%, var(--surface));
  }
  .bl span {
    color: var(--lc);
    font-weight: 700;
  }
  .bl.ab {
    --lc: var(--abus);
  }
  .bl.db {
    --lc: var(--dbus);
  }
  .mem {
    padding: 10px;
    border-radius: 14px;
    background: var(--mem-soft);
  }
  .mem table {
    font-size: 0.8rem;
  }
  .mem td {
    padding: 2px 6px;
    border: 0;
  }
  .mem .mean {
    color: var(--text-2);
    font-size: 0.75rem;
  }
  .mem tr.pc td:first-child {
    color: var(--cu);
    font-weight: 800;
  }
  .mem tr.sel {
    background: var(--abus);
  }
  .mem tr.sel td {
    color: var(--surface);
  }
  .text {
    margin: 14px 0 10px;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--surface-2);
    font-weight: 550;
    min-height: 3em;
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .done {
    color: var(--ok);
    font-weight: 700;
    font-size: 0.9rem;
  }
  @media (max-width: 800px) {
    .machine,
    .phases {
      grid-template-columns: 1fr;
    }
    .buses {
      padding-top: 0;
    }
  }
</style>
