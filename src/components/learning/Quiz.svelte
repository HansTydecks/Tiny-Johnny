<script lang="ts">
  interface Props {
    frage: string;
    optionen: string[];
    richtig: number | number[];
    erklaerung?: string;
    ondone?: () => void;
    compact?: boolean;
  }
  let { frage, optionen, richtig, erklaerung = '', ondone, compact = false }: Props = $props();

  const multi = $derived(Array.isArray(richtig));
  const correct = $derived(new Set(Array.isArray(richtig) ? richtig : [richtig]));
  let chosen = $state<Set<number>>(new Set());
  let attempts = $state(0);
  let result = $state<'none' | 'right' | 'wrong' | 'revealed'>('none');
  const name = `q${Math.random().toString(36).slice(2, 8)}`;

  function toggle(i: number) {
    if (result === 'right' || result === 'revealed') return;
    const next = new Set(multi ? chosen : []);
    if (multi && next.has(i)) next.delete(i);
    else next.add(i);
    chosen = next;
    if (result === 'wrong') result = 'none';
  }

  function check() {
    attempts++;
    const ok = chosen.size === correct.size && [...chosen].every((i) => correct.has(i));
    if (ok) {
      result = 'right';
      ondone?.();
    } else {
      result = 'wrong';
    }
  }

  function reveal() {
    chosen = new Set(correct);
    result = 'revealed';
    ondone?.();
  }
</script>

<div class="quiz" class:compact>
  <div class="frage">{@html frage}</div>
  {#if multi}<p class="muted hint">Mehrere Antworten können richtig sein.</p>{/if}
  <div class="opts" role={multi ? 'group' : 'radiogroup'}>
    {#each optionen as opt, i}
      {@const isChosen = chosen.has(i)}
      {@const show = result === 'right' || result === 'revealed'}
      <label
        class="opt"
        class:chosen={isChosen}
        class:ok={show && correct.has(i)}
        class:bad={result === 'wrong' && isChosen && !correct.has(i)}
      >
        <input
          type={multi ? 'checkbox' : 'radio'}
          {name}
          checked={isChosen}
          onchange={() => toggle(i)}
          disabled={show}
        />
        <span class="box" aria-hidden="true"></span>
        <span class="txt">{@html opt}</span>
      </label>
    {/each}
  </div>
  <div class="actions">
    {#if result !== 'right' && result !== 'revealed'}
      <button class="btn primary small" type="button" onclick={check} disabled={chosen.size === 0}>Antwort prüfen</button>
      {#if attempts >= 2}
        <button class="btn small ghost" type="button" onclick={reveal}>Lösung zeigen</button>
      {/if}
    {/if}
    {#if result === 'wrong'}
      <span class="fb bad-t">Noch nicht ganz – überleg noch einmal.</span>
    {:else if result === 'right'}
      <span class="fb ok-t">Richtig!</span>
    {/if}
  </div>
  {#if (result === 'right' || result === 'revealed') && erklaerung}
    <div class="erkl">{@html erklaerung}</div>
  {/if}
</div>

<style>
  .quiz {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .frage :global(p) {
    margin: 0 0 0.4em;
  }
  .frage {
    font-weight: 600;
  }
  .hint {
    margin: -6px 0 0;
    font-size: 0.8rem;
  }
  .opts {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .opt {
    position: relative;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .opt:hover {
    border-color: var(--accent);
  }
  .opt input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .opt:has(input:focus-visible) {
    box-shadow: var(--ring);
  }
  .box {
    flex: none;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    background: var(--surface);
  }
  .opt:has(input[type='checkbox']) .box {
    border-radius: 5px;
  }
  .chosen {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .chosen .box {
    border-color: var(--accent);
    background: var(--accent);
    box-shadow: inset 0 0 0 3px var(--surface);
  }
  .ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .ok .box {
    border-color: var(--ok);
    background: var(--ok);
  }
  .bad {
    border-color: var(--err);
    background: var(--err-soft);
  }
  .txt :global(code) {
    white-space: nowrap;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .fb {
    font-weight: 650;
    font-size: 0.9rem;
  }
  .ok-t {
    color: var(--ok);
  }
  .bad-t {
    color: var(--err);
  }
  .erkl {
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--surface-2);
    border-left: 3px solid var(--ok);
    font-size: 0.93rem;
  }
  .erkl :global(p:last-child) {
    margin-bottom: 0;
  }
  .compact .opt {
    padding: 7px 10px;
  }
</style>
