<script lang="ts">
  /**
   * Die drei Busse bei der Arbeit: CPU liest bzw. schreibt eine Speicherzelle.
   * Speicher mit 8 Zellen (3 Adressleitungen) und 8-Bit-Datenwörtern – wie auf den Folien.
   */
  let mem = $state([0b00011100, 0b01011101, 0b11000000, 0b00010111, 0b00011100, 0b00101000, 0b00000000, 0b00000000]);
  let scenario = $state<'lesen' | 'schreiben'>('lesen');
  let addr = $state(3);
  let value = $state(0b00110101);
  let step = $state(0);
  let cpuReg = $state<number | null>(null);

  const bin = (v: number, n: number) => v.toString(2).padStart(n, '0');

  const STEPS = $derived(
    scenario === 'lesen'
      ? [
          { t: 'Die CPU möchte den Inhalt von Zelle ' + addr + ' lesen.', ab: false, sb: false, db: false },
          { t: `① Adressbus: Die CPU legt die Adresse ${bin(addr, 3)} (= ${addr}) an. Der Speicher weiß jetzt, welche Zelle gemeint ist.`, ab: true, sb: false, db: false },
          { t: '② Steuerbus: Die CPU signalisiert „lesen“.', ab: true, sb: true, db: false },
          { t: `③ Datenbus: Der Speicher legt den Inhalt ${bin(mem[addr], 8)} auf den Datenbus.`, ab: true, sb: true, db: true },
          { t: '④ Die CPU übernimmt den Wert in ein Register. Fertig – der Bus ist wieder frei.', ab: false, sb: false, db: false },
        ]
      : [
          { t: `Die CPU möchte den Wert ${bin(value, 8)} in Zelle ${addr} schreiben.`, ab: false, sb: false, db: false },
          { t: `① Adressbus: Die CPU legt die Adresse ${bin(addr, 3)} (= ${addr}) an.`, ab: true, sb: false, db: false },
          { t: `② Datenbus: Die CPU legt den Wert ${bin(value, 8)} auf den Datenbus.`, ab: true, sb: false, db: true },
          { t: '③ Steuerbus: Die CPU signalisiert „schreiben“ – der Speicher übernimmt den Wert.', ab: true, sb: true, db: true },
          { t: '④ Der alte Inhalt der Zelle ist überschrieben. Der Bus ist wieder frei.', ab: false, sb: false, db: false },
        ],
  );
  const cur = $derived(STEPS[step]);

  function next() {
    if (step >= STEPS.length - 1) return;
    step++;
    if (scenario === 'lesen' && step === 4) cpuReg = mem[addr];
    if (scenario === 'schreiben' && step === 3) mem[addr] = value;
  }
  function reset() {
    step = 0;
    cpuReg = null;
  }
  const abBits = $derived(bin(addr, 3).split(''));
  const dbValue = $derived(scenario === 'lesen' ? mem[addr] : value);
  const dbBits = $derived(bin(dbValue, 8).split(''));
</script>

<div class="bus">
  <div class="bar">
    <div class="seg" role="group" aria-label="Vorgang">
      <button type="button" class:on={scenario === 'lesen'} onclick={() => { scenario = 'lesen'; reset(); }}>CPU liest</button>
      <button type="button" class:on={scenario === 'schreiben'} onclick={() => { scenario = 'schreiben'; reset(); }}>CPU schreibt</button>
    </div>
    <label class="pick">Zelle
      <select class="input" bind:value={addr} onchange={reset}>
        {#each mem as _, i}<option value={i}>{i} ({bin(i, 3)})</option>{/each}
      </select>
    </label>
    {#if scenario === 'schreiben'}
      <label class="pick">Wert
        <input class="input mono" type="number" min="0" max="255" bind:value={value} oninput={reset} />
      </label>
    {/if}
  </div>

  <div class="stage">
    <div class="cpu">
      <b>CPU</b>
      <span class="reg mono">{cpuReg === null ? '········' : bin(cpuReg, 8)}</span>
      <small>Register</small>
    </div>

    <div class="lines">
      <div class="line ab" class:on={cur.ab}>
        <span class="name">Adressbus <small>3 Leitungen</small></span>
        <span class="wires">{#each abBits as b}<span class="w" class:hi={cur.ab && b === '1'}>{cur.ab ? b : ''}</span>{/each}</span>
        <span class="dir">CPU → Speicher</span>
      </div>
      <div class="line db" class:on={cur.db}>
        <span class="name">Datenbus <small>8 Leitungen</small></span>
        <span class="wires">{#each dbBits as b}<span class="w" class:hi={cur.db && b === '1'}>{cur.db ? b : ''}</span>{/each}</span>
        <span class="dir">in beide Richtungen</span>
      </div>
      <div class="line sb" class:on={cur.sb}>
        <span class="name">Steuerbus</span>
        <span class="signals">
          <span class="sig" class:hi={cur.sb && scenario === 'lesen'}>lesen</span>
          <span class="sig" class:hi={cur.sb && scenario === 'schreiben'}>schreiben</span>
          <span class="sig muted">Takt</span>
        </span>
        <span class="dir">Steuersignale</span>
      </div>
    </div>

    <div class="mem">
      <b>Speicher</b>
      <table>
        <tbody>
          {#each mem as v, i}
            <tr class:sel={cur.ab && i === addr} class:write={scenario === 'schreiben' && step >= 3 && i === addr}>
              <td class="mono">{i}</td>
              <td class="mono muted">{bin(i, 3)}</td>
              <td class="mono">{bin(v, 8)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <p class="explain" aria-live="polite">{cur.t}</p>
  <div class="actions">
    <button class="btn primary small" type="button" onclick={next} disabled={step >= STEPS.length - 1}>Nächster Schritt</button>
    <button class="btn small ghost" type="button" onclick={reset}>Von vorn</button>
    <span class="dots">{#each STEPS as _, i}<span class:on={i <= step}></span>{/each}</span>
  </div>
</div>

<style>
  .bus {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  .bar {
    display: flex;
    gap: 12px;
    align-items: end;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .seg {
    display: inline-flex;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .seg button {
    border: 0;
    background: transparent;
    padding: 6px 12px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    color: var(--text-2);
  }
  .seg button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-s);
  }
  .pick {
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    color: var(--text-3);
    font-weight: 650;
  }
  .pick .input {
    min-height: 34px;
    padding: 2px 8px;
    width: 120px;
  }
  .stage {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr) 190px;
    gap: 12px;
    align-items: center;
  }
  .cpu,
  .mem {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    border-radius: 12px;
  }
  .cpu {
    background: var(--cu-soft);
  }
  .cpu b {
    color: var(--cu);
  }
  .reg {
    background: var(--surface);
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 0.85rem;
  }
  .cpu small {
    font-size: 0.7rem;
    color: var(--text-3);
  }
  .mem {
    background: var(--mem-soft);
  }
  .mem b {
    color: var(--mem);
  }
  .mem table {
    font-size: 0.78rem;
  }
  .mem td {
    padding: 1px 6px;
    border: 0;
  }
  .mem tr.sel {
    background: var(--abus);
    color: var(--surface);
  }
  .mem tr.sel td {
    color: inherit;
  }
  .mem tr.write td:last-child {
    font-weight: 800;
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .line {
    --lc: var(--sbus);
    display: grid;
    grid-template-columns: 110px 1fr;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 2px 10px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1.5px solid color-mix(in srgb, var(--lc) 30%, var(--border));
    opacity: 0.6;
    transition: opacity 0.2s, background 0.2s;
  }
  .line.on {
    opacity: 1;
    background: color-mix(in srgb, var(--lc) 10%, var(--surface));
    border-color: var(--lc);
  }
  .ab {
    --lc: var(--abus);
  }
  .db {
    --lc: var(--dbus);
  }
  .name {
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--lc);
    grid-row: span 2;
  }
  .name small {
    display: block;
    font-weight: 500;
    color: var(--text-3);
  }
  .wires {
    display: flex;
    gap: 3px;
  }
  .w {
    flex: 1;
    height: 20px;
    border-radius: 4px;
    background: var(--surface-3);
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
  }
  .w.hi {
    background: var(--lc);
    color: var(--surface);
    box-shadow: 0 0 8px color-mix(in srgb, var(--lc) 60%, transparent);
  }
  .signals {
    display: flex;
    gap: 6px;
  }
  .sig {
    padding: 1px 8px;
    border-radius: 6px;
    background: var(--surface-3);
    font-size: 0.78rem;
    font-weight: 600;
  }
  .sig.hi {
    background: var(--text);
    color: var(--bg);
  }
  .dir {
    font-size: 0.7rem;
    color: var(--text-3);
  }
  .explain {
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
  }
  .dots {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
  .dots span {
    width: 18px;
    height: 5px;
    border-radius: 3px;
    background: var(--surface-3);
  }
  .dots span.on {
    background: var(--accent);
  }
  @media (max-width: 760px) {
    .stage {
      grid-template-columns: 1fr;
    }
  }
</style>
