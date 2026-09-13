<script lang="ts">
  interface Props {
    frage: string;
    antwort: number;
    einheit?: string;
    erklaerung?: string;
    ondone?: () => void;
  }
  let { frage, antwort, einheit = '', erklaerung = '', ondone }: Props = $props();

  let value = $state('');
  let attempts = $state(0);
  let result = $state<'none' | 'right' | 'wrong' | 'revealed'>('none');

  function check(e: SubmitEvent) {
    e.preventDefault();
    const n = Number(value.replace(/[.\s]/g, ''));
    if (value.trim() === '' || !Number.isFinite(n)) return;
    attempts++;
    if (n === antwort) {
      result = 'right';
      ondone?.();
    } else result = 'wrong';
  }
  function reveal() {
    value = String(antwort);
    result = 'revealed';
    ondone?.();
  }
</script>

<div class="predict">
  <div class="frage">{@html frage}</div>
  <form class="row" onsubmit={check}>
    <input
      class="input mono"
      bind:value
      inputmode="numeric"
      placeholder="Deine Vorhersage"
      disabled={result === 'right' || result === 'revealed'}
      oninput={() => result === 'wrong' && (result = 'none')}
      aria-label="Vorhersage eingeben"
    />
    {#if einheit}<span class="muted">{einheit}</span>{/if}
    {#if result !== 'right' && result !== 'revealed'}
      <button class="btn primary small" type="submit">Prüfen</button>
      {#if attempts >= 2}<button class="btn small ghost" type="button" onclick={reveal}>Auflösen</button>{/if}
    {/if}
  </form>
  {#if result === 'wrong'}
    <p class="fb bad">Nicht ganz. Geh die Schritte noch einmal im Kopf durch.</p>
  {:else if result === 'right'}
    <p class="fb ok">Genau richtig!</p>
  {:else if result === 'revealed'}
    <p class="fb">Richtig wäre <b class="mono">{antwort}</b>.</p>
  {/if}
  {#if (result === 'right' || result === 'revealed') && erklaerung}
    <div class="erkl">{@html erklaerung}</div>
  {/if}
</div>

<style>
  .predict {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .frage {
    font-weight: 600;
  }
  .frage :global(p) {
    margin: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .row .input {
    width: 150px;
    min-height: 36px;
  }
  .fb {
    margin: 0;
    font-weight: 650;
    font-size: 0.9rem;
  }
  .ok {
    color: var(--ok);
  }
  .bad {
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
</style>
