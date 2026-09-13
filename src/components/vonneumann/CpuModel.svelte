<script lang="ts">
  import { untrack } from 'svelte';
  /** CPU-Aufbau (Modell nach den Folien) – optional mit den Entsprechungen bei Johnny. */
  interface Props {
    johnny?: boolean;
  }
  let { johnny = false }: Props = $props();

  type Key = 'decoder' | 'bz' | 'br' | 'status' | 'alu' | 'datareg' | 'cache';
  const PARTS: Record<Key, { name: string; werk: 'sw' | 'rw' | 'cache'; text: string; johnny: string; jabbr?: string }> = {
    bz: {
      name: 'Befehlszähler',
      werk: 'sw',
      text: 'Program Counter (PC): enthält die Adresse des nächsten auszuführenden Befehls – nicht den Befehl selbst. Nach jedem Befehl wird er erhöht, bei Sprüngen neu gesetzt.',
      johnny: 'Programmzähler',
      jabbr: 'pc',
    },
    br: {
      name: 'Befehlsregister',
      werk: 'sw',
      text: 'Instruction Register (IR): speichert den aktuell ausgeführten Befehl, nachdem er aus dem Speicher geladen wurde, während er verarbeitet wird.',
      johnny: 'Befehlsregister (Opcode + Adresse)',
      jabbr: 'ins',
    },
    decoder: {
      name: 'Befehlsdecodierer',
      werk: 'sw',
      text: 'Übersetzt den Befehl im Befehlsregister in die Steuersignale, die Rechenwerk, Register und Busse brauchen.',
      johnny: 'Mikroprogrammzähler + Mikrocode',
      jabbr: 'mc',
    },
    status: {
      name: 'Statusregister',
      werk: 'sw',
      text: 'Speichert Informationen über das letzte Rechenergebnis in einzelnen Bits („Flags“): z. B. Ergebnis war 0, negativ, oder es gab einen Überlauf. Bedingte Sprünge werten diese Flags aus.',
      johnny: 'nur die Anzeige „=0?“',
      jabbr: '=0?',
    },
    alu: {
      name: 'ALU',
      werk: 'rw',
      text: 'Arithmetic Logic Unit: führt Rechenoperationen (Addition, Subtraktion …) und logische Operationen (UND, ODER …) aus.',
      johnny: 'plus, minus, acc++, acc--, acc:=0',
    },
    datareg: {
      name: 'Datenregister',
      werk: 'rw',
      text: 'Enthalten die Operanden und Ergebnisse der aktuellen Berechnung. Ein besonderes Datenregister ist der Akkumulator.',
      johnny: 'Akkumulator',
      jabbr: 'acc',
    },
    cache: {
      name: 'Cache',
      werk: 'cache',
      text: 'Schneller Zwischenspeicher direkt im Prozessor. Enthält die Teile des Arbeitsspeichers, die wahrscheinlich als Nächstes gebraucht werden (L1, L2, L3).',
      johnny: 'fehlt bei Johnny',
    },
  };
  let sel = $state<Key>('bz');
  let showJohnny = $state(untrack(() => johnny));
  const p = $derived(PARTS[sel]);
  const inWerk = (w: 'sw' | 'rw' | 'cache') => (Object.keys(PARTS) as Key[]).filter((k) => PARTS[k].werk === w);
</script>

<div class="cpu">
  <div class="bar">
    <b>CPU – Aufbau (Modell)</b>
    <label class="toggle"><input type="checkbox" bind:checked={showJohnny} /> Entsprechung bei Johnny zeigen</label>
  </div>
  <div class="layout">
    <div class="chip-outline">
      <div class="werk sw">
        <span class="wt">Steuerwerk</span>
        <div class="parts">
          {#each inWerk('sw') as k}
            <button type="button" class="part" class:sel={sel === k} onclick={() => (sel = k)}>
              {PARTS[k].name}
              {#if showJohnny && PARTS[k].jabbr}<span class="jb mono">{PARTS[k].jabbr}</span>{/if}
            </button>
          {/each}
        </div>
      </div>
      <div class="werk rw">
        <span class="wt">Rechenwerk</span>
        <div class="parts">
          {#each inWerk('rw') as k}
            <button type="button" class="part" class:sel={sel === k} onclick={() => (sel = k)}>
              {PARTS[k].name}
              {#if showJohnny && PARTS[k].jabbr}<span class="jb mono">{PARTS[k].jabbr}</span>{/if}
            </button>
          {/each}
        </div>
      </div>
      <div class="werk ca">
        <button type="button" class="part" class:sel={sel === 'cache'} onclick={() => (sel = 'cache')}>
          Cache (Zwischenspeicher)
          {#if showJohnny}<span class="jb none">–</span>{/if}
        </button>
      </div>
    </div>
    <div class="info">
      <span class="kick">{p.werk === 'sw' ? 'Steuerwerk' : p.werk === 'rw' ? 'Rechenwerk' : 'Prozessor'}</span>
      <h4>{p.name}</h4>
      <p>{p.text}</p>
      {#if showJohnny}
        <div class="jm">
          <span>Bei Johnny:</span>
          <b>{p.johnny}</b>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .cpu {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .toggle {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 0.88rem;
    font-weight: 600;
  }
  .toggle input {
    accent-color: var(--accent);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 16px;
  }
  .chip-outline {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 14px;
    border-radius: 16px;
    border: 2px dashed var(--border-strong);
    background: var(--surface-2);
  }
  .werk {
    padding: 10px;
    border-radius: 12px;
  }
  .sw {
    background: var(--cu-soft);
    --wc: var(--cu);
  }
  .rw {
    background: var(--alu-soft);
    --wc: var(--alu);
  }
  .ca {
    grid-column: 1 / -1;
    background: var(--mem-soft);
    --wc: var(--mem);
    padding: 8px;
  }
  .wt {
    display: block;
    font-weight: 800;
    color: var(--wc);
    font-size: 0.85rem;
    margin-bottom: 8px;
  }
  .parts {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .part {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 9px;
    border: 1px solid color-mix(in srgb, var(--wc) 30%, var(--border));
    background: var(--surface);
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    text-align: left;
  }
  .part.sel {
    border-color: var(--wc);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--wc) 30%, transparent);
  }
  .jb {
    font-size: 0.72rem;
    padding: 0 6px;
    border-radius: 5px;
    background: var(--wc);
    color: var(--surface);
  }
  .jb.none {
    background: var(--surface-3);
    color: var(--text-3);
  }
  .info {
    padding: 14px;
    border-radius: 14px;
    background: var(--surface-2);
  }
  .kick {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .info h4 {
    margin: 2px 0 6px;
    font-size: 1.15rem;
  }
  .info p {
    font-size: 0.93rem;
    margin: 0;
  }
  .jm {
    margin-top: 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--accent-soft);
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
  }
  @media (max-width: 760px) {
    .layout,
    .chip-outline {
      grid-template-columns: 1fr;
    }
  }
</style>
