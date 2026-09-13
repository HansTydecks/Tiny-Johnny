<script lang="ts">
  import { MICRO_BY_CODE, SLOTS } from '../../lib/johnny/microcode';
  import type { Sim } from '../../lib/johnny/sim.svelte';

  interface Props {
    sim: Sim;
    record?: boolean;
  }
  let { sim, record = false }: Props = $props();

  const slots = $derived(
    Array.from({ length: SLOTS }, (_, slot) => ({
      slot,
      name: sim.s.names[slot],
      ops: sim.s.microcode.slice(slot * 10, slot * 10 + 10),
    })).filter((s) => s.name || s.ops.some((o) => o !== 0) || sim.recording?.slot === s.slot),
  );
  const currentSlot = $derived(Math.floor(sim.s.mc / 10));

  let recSlot = $state(11);
  let recName = $state('');
  const freeSlots = $derived(Array.from({ length: SLOTS - 1 }, (_, i) => i + 1));
  let listEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    void sim.pulse;
    const el = listEl?.querySelector<HTMLElement>(`[data-slot="${currentSlot}"]`);
    if (el && listEl) {
      const top = el.offsetTop - listEl.offsetTop;
      if (top < listEl.scrollTop || top + el.offsetHeight > listEl.scrollTop + listEl.clientHeight)
        listEl.scrollTop = Math.max(0, top - 8);
    }
  });
</script>

<div class="mc">
  <div class="list" bind:this={listEl}>
    {#each slots as s (s.slot)}
      <div class="slot" class:current={s.slot === currentSlot} data-slot={s.slot}>
        <div class="name">
          <span class="nr">{String(s.slot * 10).padStart(3, '0')}</span>
          <b>{s.name || '—'}</b>
          {#if s.slot > 0}<span class="op">Opcode {String(s.slot).padStart(2, '0')}</span>{/if}
        </div>
        <div class="ops">
          {#each s.ops as code, i}
            {#if code !== 0 || (sim.recording?.slot === s.slot && i === sim.recording.pos)}
              <span
                class="chip-op"
                class:now={s.slot * 10 + i === sim.s.mc}
                class:rec={sim.recording?.slot === s.slot && i === sim.recording.pos}
                title={code ? MICRO_BY_CODE[code]?.de : 'nächster aufgenommener Mikrobefehl'}
              >
                <small>{i}</small>{code ? MICRO_BY_CODE[code]?.label : '…'}
              </span>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if record}
    <div class="rec-box">
      {#if sim.recording}
        <div class="rec-live">
          <span class="rec-dot" aria-hidden="true"></span>
          <span>
            Aufnahme läuft für <b>{sim.s.names[sim.recording.slot]}</b> ({sim.recording.pos}/10). Klicke die Mikrobefehle in der
            richtigen Reihenfolge an. Denk an <code>pc++</code> und am Ende <code>mc:=0</code>!
          </span>
          <button class="btn small" type="button" onclick={() => sim.stopRecording()}>Aufnahme beenden</button>
        </div>
      {:else}
        <form
          class="rec-form"
          onsubmit={(e) => {
            e.preventDefault();
            if (recName.trim()) sim.startRecording(recSlot, recName.trim());
          }}
        >
          <span class="rec-title">Eigenen Befehl aufnehmen</span>
          <select class="input" bind:value={recSlot} aria-label="Opcode für den neuen Befehl">
            {#each freeSlots as n}
              <option value={n}>{String(n).padStart(2, '0')}{sim.s.names[n] ? ` (${sim.s.names[n]} überschreiben)` : ''}</option>
            {/each}
          </select>
          <input class="input mono" bind:value={recName} placeholder="Name, z. B. DBL" maxlength="8" aria-label="Name des Befehls" />
          <button class="btn small" type="submit" disabled={!recName.trim()}>● Aufnahme starten</button>
        </form>
      {/if}
    </div>
  {/if}
</div>

<style>
  .mc {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .list {
    max-height: 230px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    position: relative;
  }
  .slot {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    align-items: center;
  }
  .slot:last-child {
    border-bottom: 0;
  }
  .slot.current {
    background: color-mix(in srgb, var(--cu) 9%, transparent);
  }
  .name {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.85rem;
    min-width: 0;
  }
  .nr {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-3);
  }
  .name b {
    font-family: var(--font-mono);
  }
  .op {
    font-size: 0.68rem;
    color: var(--text-3);
    white-space: nowrap;
  }
  .ops {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip-op {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    padding: 1px 6px 1px 4px;
    border-radius: 6px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    white-space: nowrap;
  }
  .chip-op small {
    color: var(--text-3);
    font-size: 0.62rem;
    margin-right: 4px;
  }
  .chip-op.now {
    background: var(--cu);
    border-color: var(--cu);
    color: var(--surface);
    font-weight: 700;
  }
  .chip-op.now small {
    color: inherit;
    opacity: 0.8;
  }
  .chip-op.rec {
    border-style: dashed;
    border-color: var(--err);
    color: var(--err);
  }
  .rec-box {
    border: 1px dashed var(--border-strong);
    border-radius: 10px;
    padding: 10px;
  }
  .rec-form {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
    align-items: center;
  }
  .rec-title {
    grid-column: 1 / -1;
    font-size: 0.8rem;
    font-weight: 650;
    color: var(--text-2);
  }
  .rec-form .input {
    min-height: 34px;
    padding: 2px 8px;
    font-size: 0.85rem;
  }
  .rec-live {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 0.85rem;
    flex-wrap: wrap;
  }
  .rec-live span:nth-child(2) {
    flex: 1;
    min-width: 200px;
  }
  .rec-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--err);
    animation: blink 1s infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.25;
    }
  }
  @media (max-width: 520px) {
    .slot {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .rec-form {
      grid-template-columns: 1fr;
    }
  }
</style>
