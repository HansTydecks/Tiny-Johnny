<script lang="ts">
  import { disassembleValue, formatAddr, formatValue, parseValue } from '../../lib/johnny/assembler';
  import type { Sim } from '../../lib/johnny/sim.svelte';

  interface Props {
    sim: Sim;
    asm?: boolean;
  }
  let { sim, asm = true }: Props = $props();

  let command = $state(0); // 0 = Zahl direkt eingeben
  let text = $state('');
  let error = $state('');
  let input: HTMLInputElement | undefined = $state();

  const commands = $derived(sim.s.names.map((n, i) => ({ n, i })).filter((c) => c.i > 0 && c.n));

  const parsed = $derived.by(() => {
    if (command > 0) {
      const t = text.trim() === '' ? '0' : text.trim();
      if (!/^\d{1,3}$/.test(t)) return 'Adresse: Zahl von 000 bis 999';
      return command * 1000 + Number(t);
    }
    if (text.trim() === '') return null;
    return parseValue(text, sim.s.names);
  });

  function write() {
    if (parsed === null) return;
    if (typeof parsed === 'string') {
      error = parsed;
      return;
    }
    error = '';
    const addr = sim.selected;
    sim.writeRam(addr, parsed);
    sim.info(`Zelle ${formatAddr(addr)} ← ${formatValue(parsed)}`);
    sim.select(addr + 1);
    text = '';
    input?.focus();
  }

  function onAddr(e: Event) {
    const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
    if (Number.isFinite(v)) sim.select(v);
  }

  const preview = $derived.by(() => {
    if (parsed === null || typeof parsed === 'string') return '';
    const d = disassembleValue(parsed, sim.s.names);
    return `${formatValue(parsed)}${d ? ` · ${d.mnemonic} ${formatAddr(d.operand)}` : ''}`;
  });
</script>

<form
  class="editor"
  onsubmit={(e) => {
    e.preventDefault();
    write();
  }}
>
  <label class="cell">
    <span>Zelle</span>
    <input class="input mono addr" type="number" min="0" max="999" value={sim.selected} oninput={onAddr} aria-label="Adresse der Zelle" />
  </label>
  {#if asm}
    <label class="cmd">
      <span>Befehl</span>
      <select class="input" bind:value={command} aria-label="Befehl auswählen">
        <option value={0}>Zahl</option>
        {#each commands as c (c.i)}
          <option value={c.i}>{String(c.i).padStart(2, '0')} {c.n}</option>
        {/each}
      </select>
    </label>
  {/if}
  <label class="val">
    <span>{command > 0 ? 'Adresse' : 'Inhalt'}</span>
    <input
      bind:this={input}
      class="input mono"
      bind:value={text}
      placeholder={command > 0 ? 'z. B. 100' : 'z. B. 7, 01.100 oder TAKE 100'}
      oninput={() => (error = '')}
      aria-label="Neuer Inhalt"
      inputmode={command > 0 ? 'numeric' : 'text'}
      autocomplete="off"
    />
  </label>
  <button class="btn primary write" type="submit" disabled={parsed === null}>Schreiben</button>
  <div class="status" aria-live="polite">
    {#if error}<span class="err">{error}</span>
    {:else if typeof parsed === 'string'}<span class="err">{parsed}</span>
    {:else if preview}<span class="muted">→ {preview}</span>
    {:else}<span class="muted">Zelle anklicken, Wert eingeben, mit Enter schreiben.</span>{/if}
  </div>
</form>

<style>
  .editor {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
    align-items: end;
    margin-top: 10px;
  }
  .editor:not(:has(.cmd)) {
    grid-template-columns: 72px minmax(0, 1fr);
  }
  .write {
    grid-column: 1 / -1;
  }
  @container (min-width: 470px) {
    .editor {
      grid-template-columns: 72px minmax(0, 0.9fr) minmax(0, 1.2fr) auto;
    }
    .editor:not(:has(.cmd)) {
      grid-template-columns: 72px minmax(0, 1fr) auto;
    }
    .write {
      grid-column: auto;
    }
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  label span {
    font-size: 0.7rem;
    font-weight: 650;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .input {
    min-height: 38px;
    padding: 4px 8px;
  }
  .addr {
    text-align: center;
  }
  .write {
    min-height: 38px;
  }
  .status {
    grid-column: 1 / -1;
    font-size: 0.8rem;
    min-height: 1.3em;
  }
  .err {
    color: var(--err);
  }
</style>
