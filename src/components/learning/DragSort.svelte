<script lang="ts">
  import { onMount, untrack } from 'svelte';
  /**
   * Zuordnungsübung: Karten in Kategorien einsortieren.
   * Funktioniert mit Maus (Ziehen) und Touch (Karte antippen, dann Kategorie antippen).
   */
  interface Item {
    text: string;
    /** Index der richtigen Kategorie */
    cat: number;
    info?: string;
  }
  interface Props {
    titel?: string;
    kategorien: string[];
    karten: Item[];
    farben?: string[];
  }
  let { titel, kategorien, karten, farben = [] }: Props = $props();

  const shuffle = () => karten.map((_, i) => i).sort(() => Math.random() - 0.5);
  // Erst im Browser mischen, damit Server- und Browser-Ausgabe beim Laden übereinstimmen
  let order = $state(untrack(() => karten.map((_, i) => i)));
  onMount(() => (order = shuffle()));
  let placed = $state<(number | null)[]>(untrack(() => karten.map(() => null)));
  let selected = $state<number | null>(null);
  let checked = $state(false);

  const pool = $derived(order.filter((i) => placed[i] === null));
  const allPlaced = $derived(placed.every((p) => p !== null));
  const correctCount = $derived(placed.filter((p, i) => p === karten[i].cat).length);

  function place(item: number, cat: number | null) {
    placed[item] = cat;
    selected = null;
    checked = false;
  }
  function onCat(cat: number) {
    if (selected !== null) place(selected, cat);
  }
  function drop(e: DragEvent, cat: number | null) {
    e.preventDefault();
    const i = Number(e.dataTransfer?.getData('text/plain'));
    if (Number.isInteger(i)) place(i, cat);
  }
  function reset() {
    placed = karten.map(() => null);
    checked = false;
    selected = null;
    order = shuffle();
  }
</script>

<div class="dragsort">
  {#if titel}<p class="titel">{titel}</p>{/if}
  <div
    class="pool"
    role="list"
    ondragover={(e) => e.preventDefault()}
    ondrop={(e) => drop(e, null)}
    aria-label="Noch nicht zugeordnete Karten"
  >
    {#each pool as i (i)}
      <button
        type="button"
        class="card-item"
        class:sel={selected === i}
        draggable="true"
        ondragstart={(e) => e.dataTransfer?.setData('text/plain', String(i))}
        onclick={() => (selected = selected === i ? null : i)}
      >
        {karten[i].text}
      </button>
    {:else}
      <span class="muted pool-empty">Alle Karten sind verteilt.</span>
    {/each}
  </div>
  {#if selected !== null}<p class="hint">Jetzt eine Kategorie antippen …</p>{/if}

  <div class="cats" style={`--n:${kategorien.length}`}>
    {#each kategorien as k, c}
      <div
        class="cat"
        class:target={selected !== null}
        style={farben[c] ? `--cc: var(--${farben[c]}); --cs: var(--${farben[c]}-soft)` : ''}
        role="button"
        tabindex="0"
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => drop(e, c)}
        onclick={() => onCat(c)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onCat(c)}
        aria-label={`Kategorie ${k}`}
      >
        <b>{k}</b>
        <div class="slot">
          {#each order.filter((i) => placed[i] === c) as i (i)}
            <button
              type="button"
              class="card-item placed"
              class:ok={checked && karten[i].cat === c}
              class:bad={checked && karten[i].cat !== c}
              draggable="true"
              ondragstart={(e) => e.dataTransfer?.setData('text/plain', String(i))}
              onclick={(e) => {
                e.stopPropagation();
                place(i, null);
              }}
              title="Zurücklegen"
            >
              {karten[i].text}
              {#if checked && karten[i].info}<small>{karten[i].info}</small>{/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="actions">
    <button class="btn primary small" type="button" disabled={!allPlaced} onclick={() => (checked = true)}>Überprüfen</button>
    <button class="btn small ghost" type="button" onclick={reset}>Neu mischen</button>
    {#if checked}
      <span class="result" class:all={correctCount === karten.length}>
        {correctCount === karten.length ? 'Alles richtig!' : `${correctCount} von ${karten.length} richtig – rote Karten antippen zum Zurücklegen.`}
      </span>
    {/if}
  </div>
</div>

<style>
  .dragsort {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  .titel {
    font-weight: 650;
    margin: 0 0 10px;
  }
  .pool {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 48px;
    padding: 10px;
    border-radius: 12px;
    background: var(--surface-2);
    border: 1px dashed var(--border-strong);
  }
  .pool-empty {
    align-self: center;
    font-size: 0.88rem;
  }
  .card-item {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 7px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    font-size: 0.9rem;
    font-weight: 550;
    cursor: grab;
    text-align: left;
    box-shadow: var(--shadow-s);
    touch-action: manipulation;
  }
  .card-item small {
    font-weight: 400;
    color: var(--text-2);
    font-size: 0.78rem;
    margin-top: 2px;
  }
  .card-item.sel {
    border-color: var(--accent);
    box-shadow: var(--ring);
  }
  .hint {
    font-size: 0.82rem;
    color: var(--accent);
    margin: 6px 0 0;
  }
  .cats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin-top: 12px;
  }
  .cat {
    --cc: var(--accent);
    --cs: var(--accent-soft);
    border-radius: 12px;
    border: 1.5px solid color-mix(in srgb, var(--cc) 35%, var(--border));
    background: color-mix(in srgb, var(--cs) 60%, var(--surface));
    padding: 10px;
    min-height: 110px;
    cursor: pointer;
  }
  .cat.target {
    border-style: dashed;
    border-color: var(--cc);
  }
  .cat b {
    display: block;
    color: var(--cc);
    font-size: 0.9rem;
    margin-bottom: 8px;
  }
  .slot {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .placed {
    width: 100%;
  }
  .ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .bad {
    border-color: var(--err);
    background: var(--err-soft);
  }
  .actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  .result {
    font-weight: 650;
    font-size: 0.9rem;
    color: var(--warn);
  }
  .result.all {
    color: var(--ok);
  }
</style>
