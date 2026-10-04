<script lang="ts">
  /** Ein Bus als durchgehende Schiene, an die die Leitungen der Bauteile angeschlossen sind. */
  interface Props {
    kind: 'ab' | 'db';
    value: string;
    /** Zähler – ändert er sich (> 0), leuchtet der Bus auf: Ein neuer Wert wurde aufgelegt */
    hit?: number;
    focus?: boolean;
    /** Eingabefeld zum Anlegen von Hand */
    input?: boolean;
    onset?: (v: number) => void;
    style?: string;
  }
  let { kind, value, hit = 0, focus = false, input = false, onset, style = '' }: Props = $props();

  const isAb = $derived(kind === 'ab');
  let text = $state('');

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const v = parseInt(text.replace(/[.,]/g, ''), 10);
    if (Number.isFinite(v)) {
      onset?.(v);
      text = '';
    }
  }
</script>

<div
  class="bus {kind} {isAb ? 'c-abus' : 'c-dbus'}"
  class:focus
  {style}
  role="group"
  aria-label={isAb ? 'Adressbus' : 'Datenbus'}
  title={isAb ? 'Der Adressbus legt fest, welche Speicherzelle gemeint ist. Er führt nur von der CPU zum Speicher.' : 'Über den Datenbus wandern Zahlen zwischen Speicher und CPU – in beide Richtungen.'}
>
  {#key hit}
    {#if hit > 0}<span class="flash" aria-hidden="true"></span>{/if}
  {/key}
  <span class="name">
    <b>{isAb ? 'Adressbus' : 'Datenbus'}</b>
    <span class="abbr">{kind}</span>
  </span>
  {#key hit}
    <span class="val" class:pulse={hit > 0} aria-live="polite">{value}</span>
  {/key}
  <span class="hint">{isAb ? 'Welche Zelle?' : 'Welcher Wert?'}</span>
  {#if input}
    <form class="set" onsubmit={submit}>
      <input
        class="input mono"
        bind:value={text}
        inputmode="numeric"
        placeholder={isAb ? '000–999' : '0–19999'}
        aria-label={isAb ? 'Adresse von Hand auf den Adressbus legen' : 'Zahl von Hand auf den Datenbus legen'}
      />
      <button class="btn small" type="submit">anlegen</button>
    </form>
  {/if}
  <span class="dir" aria-hidden="true">{isAb ? 'CPU → Speicher' : 'Speicher ⇄ CPU'}</span>
</div>

<style>
  .bus {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 12px;
    min-height: 54px;
    padding: 7px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--c) 16%, var(--surface));
    border: 2px solid color-mix(in srgb, var(--c) 60%, var(--surface));
    overflow: hidden;
  }
  .flash {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--c) 45%, transparent);
    animation: fade 0.9s ease-out forwards;
    pointer-events: none;
  }
  @keyframes fade {
    to {
      opacity: 0;
    }
  }
  .name {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
  }
  .abbr {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--c);
    background: var(--surface);
    border-radius: 6px;
    padding: 0 6px;
  }
  .val {
    position: relative;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 750;
    font-size: 1.35rem;
    line-height: 1.3;
    padding: 1px 12px;
    border-radius: 10px;
    background: var(--surface);
    border: 1.5px solid color-mix(in srgb, var(--c) 55%, var(--border));
  }
  .val.pulse {
    animation: pulse 0.9s ease-out;
  }
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--c) 35%, transparent);
      background: color-mix(in srgb, var(--c) 30%, var(--surface));
    }
  }
  .hint {
    position: relative;
    font-size: 0.75rem;
    color: var(--text-3);
  }
  .set {
    position: relative;
    display: flex;
    gap: 6px;
  }
  .set .input {
    width: 96px;
    min-height: 32px;
    padding: 2px 8px;
  }
  .dir {
    position: relative;
    margin-left: auto;
    font-size: 0.72rem;
    font-weight: 600;
    color: color-mix(in srgb, var(--c) 75%, var(--text-3));
    white-space: nowrap;
  }
  .focus {
    animation: spot 1.6s ease-in-out infinite;
  }
  @keyframes spot {
    50% {
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 45%, transparent);
    }
  }
</style>
