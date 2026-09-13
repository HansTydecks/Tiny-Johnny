<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Johnny from '../simulator/Johnny.svelte';
  import Quiz from './Quiz.svelte';
  import Predict from './Predict.svelte';
  import { Sim } from '../../lib/johnny/sim.svelte';
  import { goalMet, goalProgram, runTests } from '../../lib/johnny/checker';
  import { ramFromShare } from '../../lib/johnny/fileio';
  import { markLevel } from '../../lib/progress';
  import type { LevelView, Prep, StepView } from '../../lib/tutorial';

  interface Props {
    level: LevelView;
    nextHref?: string;
    nextTitle?: string;
    overviewHref: string;
  }
  let { level, nextHref, nextTitle, overviewHref }: Props = $props();

  const sim = new Sim({ mode: untrack(() => level.modus), ram: ramFromShare(untrack(() => level.startRam)) });
  const steps = untrack(() => level.schritte);
  let index = $state(0);
  let done = $state<boolean[]>(steps.map((s) => s.typ === 'info'));
  let visited = $state<boolean[]>(steps.map(() => false));
  let startVersion = 0;
  let showTip = $state(false);
  let testFeedback = $state<string[] | null>(null);
  let finished = $state(false);
  let panel: HTMLElement | undefined = $state();

  const step = $derived(steps[index]);
  const allDone = $derived(done.every(Boolean));

  function applyPrep(p: Prep | undefined) {
    if (!p) return;
    if (p.reset) sim.reset();
    if (p.ramLeeren) sim.clearRam();
    if (p.programm !== undefined) sim.loadRam(ramFromShare(p.programm));
    if (p.ram) for (const [k, v] of Object.entries(p.ram)) sim.engine.writeRam(Number(k), v);
    if (p.register) sim.setRegisters(p.register);
    sim.sync(false);
  }

  function enter(i: number) {
    index = i;
    showTip = false;
    testFeedback = null;
    if (!visited[i]) {
      visited[i] = true;
      applyPrep(steps[i].prep);
      sim.markUsed();
      startVersion = sim.version;
    }
    panel?.scrollTo({ top: 0 });
  }

  function complete(i: number) {
    if (done[i]) return;
    done[i] = true;
    if (done.every(Boolean)) {
      markLevel(level.id);
    }
  }

  onMount(() => {
    enter(0);
    return () => sim.destroy();
  });

  // Ziele laufend prüfen (außer bei Test-Zielen – die werden per Knopf geprüft)
  $effect(() => {
    const v = sim.version;
    const s = step;
    untrack(() => {
      if (s.typ !== 'aktion' || done[index] || s.ziel.tests) return;
      if (v <= startVersion) return;
      if (goalMet(s.ziel, sim.s, { used: sim.usedSince })) complete(index);
    });
  });

  function checkProgram(s: Extract<StepView, { typ: 'aktion' }>) {
    const results = runTests(goalProgram(s.ziel, sim.s), s.ziel.tests ?? [], {
      microcode: sim.s.microcode,
      names: sim.s.names,
      requireHalt: s.ziel.requireHalt,
    });
    const failed = results.filter((r) => !r.passed);
    if (!failed.length && goalMet({ ...s.ziel, tests: undefined }, sim.s, { used: sim.usedSince })) {
      testFeedback = [];
      complete(index);
    } else {
      testFeedback = failed.flatMap((r) => r.problems.map((p) => `${r.name}: ${p}`)).slice(0, 5);
      if (!failed.length) testFeedback = ['Die Tests laufen, aber das Ziel ist noch nicht ganz erfüllt.'];
    }
  }

  function next() {
    if (index < steps.length - 1) enter(index + 1);
    else finished = true;
  }

  const goalItems = (s: Extract<StepView, { typ: 'aktion' }>) => {
    const z = s.ziel;
    const items: string[] = [];
    for (const [k, v] of Object.entries(z.ram ?? {})) items.push(`Zelle ${k.padStart(3, '0')} = ${v}`);
    for (const [k, v] of Object.entries(z.ramMin ?? {})) items.push(`Zelle ${k.padStart(3, '0')} ≥ ${v}`);
    if (z.acc !== undefined) items.push(`Akkumulator = ${z.acc}`);
    if (z.ab !== undefined) items.push(`Adressbus = ${String(z.ab).padStart(3, '0')}`);
    if (z.db !== undefined) items.push(`Datenbus = ${z.db}`);
    if (z.pc !== undefined) items.push(`Programmzähler = ${String(z.pc).padStart(3, '0')}`);
    if (z.ins !== undefined) items.push(`Befehlsregister = ${String(Math.floor(z.ins / 1000)).padStart(2, '0')}.${String(z.ins % 1000).padStart(3, '0')}`);
    if (z.mc !== undefined) items.push(`Mikroprogrammzähler = ${String(z.mc).padStart(3, '0')}`);
    if (z.halted) items.push('Johnny hat angehalten');
    if (z.benutzt?.length) items.push(`benutzt: ${z.benutzt.join(', ')}`);
    if (z.befehl) items.push(`eigener Befehl ${z.befehl.name}`);
    if (z.tests) items.push(`Programm besteht ${z.tests.length} Test${z.tests.length > 1 ? 's' : ''}`);
    return items;
  };
</script>

<div class="mission">
  <aside class="panel" bind:this={panel}>
    <div class="top">
      <div class="progress" aria-label={`Schritt ${index + 1} von ${steps.length}`}>
        {#each steps as s, i}
          <button
            type="button"
            class="seg"
            class:done={done[i] && visited[i]}
            class:current={i === index && !finished}
            disabled={!visited[i] && i !== index}
            onclick={() => {
              finished = false;
              enter(i);
            }}
            aria-label={`Schritt ${i + 1}${done[i] ? ' (erledigt)' : ''}`}
          ></button>
        {/each}
      </div>
      <span class="count">{finished ? 'geschafft' : `Schritt ${index + 1} / ${steps.length}`}</span>
    </div>

    {#if finished}
      <div class="finish">
        <div class="trophy" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="30" fill="var(--ok-soft)" /><path d="M20 33l8 8 16-18" fill="none" stroke="var(--ok)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </div>
        <h2>Mission {level.nummer} geschafft!</h2>
        <p>Du kannst jetzt die Leitfrage beantworten:</p>
        <blockquote>{level.leitfrage}</blockquote>
        <p class="muted">Formuliere eine Antwort in eigenen Worten – z. B. im Heft oder im Gespräch mit deinem Nachbarn.</p>
        <div class="finish-actions">
          {#if nextHref}
            <a class="btn primary" href={nextHref}>Weiter: {nextTitle} →</a>
          {:else}
            <a class="btn primary" href={overviewHref}>Zur Übersicht</a>
          {/if}
          <button class="btn ghost" type="button" onclick={() => (finished = false)}>Noch einmal ansehen</button>
        </div>
      </div>
    {:else}
      {#key index}
        <div class="step">
          {#if step.titel}<h2 class="step-title">{step.titel}</h2>{/if}
          {#if step.typ === 'info'}
            <div class="text">{@html step.html}</div>
          {:else if step.typ === 'aktion'}
            <span class="tag">Deine Aufgabe</span>
            <div class="text">{@html step.html}</div>
            <ul class="goals" class:met={done[index]}>
              {#each goalItems(step) as g}
                <li><span class="check" aria-hidden="true"></span>{g}</li>
              {/each}
            </ul>
            {#if step.ziel.tests && !done[index]}
              <button class="btn primary small" type="button" onclick={() => checkProgram(step)}>
                {step.ziel.befehl ? 'Befehl prüfen' : 'Programm prüfen'}
              </button>
              {#if testFeedback?.length}
                <ul class="problems">
                  {#each testFeedback as p}<li>{p}</li>{/each}
                </ul>
              {/if}
            {/if}
            {#if done[index]}
              <div class="success" role="status">
                <b>Geschafft!</b>
                {#if step.erfolg}{@html step.erfolg}{/if}
              </div>
            {:else if step.tipp}
              {#if showTip}
                <div class="tip">{@html step.tipp}</div>
              {:else}
                <button class="btn small ghost tip-btn" type="button" onclick={() => (showTip = true)}>💡 Tipp anzeigen</button>
              {/if}
            {/if}
          {:else if step.typ === 'quiz'}
            <span class="tag">Kurz nachgedacht</span>
            <Quiz frage={step.frage} optionen={step.optionen} richtig={step.richtig} erklaerung={step.erklaerung} ondone={() => complete(index)} />
          {:else if step.typ === 'vorhersage'}
            <span class="tag">Vorhersage</span>
            <Predict frage={step.frage} antwort={step.antwort} einheit={step.einheit} erklaerung={step.erklaerung} ondone={() => complete(index)} />
          {/if}
        </div>
      {/key}

      <div class="nav">
        <button class="btn ghost" type="button" disabled={index === 0} onclick={() => enter(index - 1)}>← Zurück</button>
        <button class="btn primary" type="button" disabled={!done[index]} onclick={next}>
          {index === steps.length - 1 ? 'Mission abschließen' : 'Weiter →'}
        </button>
      </div>
    {/if}
  </aside>

  <div class="sim">
    <Johnny {sim} show={level.sichtbar} micro={level.mikro} features={level.funktionen} labels={level.zellen} ramHeight={372} />
  </div>
</div>

<style>
  .mission {
    display: grid;
    grid-template-columns: minmax(300px, 390px) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  .panel {
    position: sticky;
    top: calc(var(--header-h) + 12px);
    max-height: calc(100vh - var(--header-h) - 24px);
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow);
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .progress {
    display: flex;
    gap: 4px;
    flex: 1;
  }
  .seg {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    border: 0;
    padding: 0;
    background: var(--surface-3);
    cursor: pointer;
  }
  .seg:disabled {
    cursor: default;
  }
  .seg.done {
    background: color-mix(in srgb, var(--ok) 70%, var(--surface));
  }
  .seg.current {
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }
  .count {
    font-size: 0.78rem;
    color: var(--text-3);
    white-space: nowrap;
    font-weight: 600;
  }
  .step {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: in 0.25s ease-out;
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .step-title {
    margin: 0;
    font-size: 1.2rem;
  }
  .text :global(p:last-child) {
    margin-bottom: 0;
  }
  .text :global(ul),
  .text :global(ol) {
    padding-left: 1.2em;
    margin: 0 0 0.8em;
  }
  .text :global(blockquote) {
    margin: 0.8em 0;
    padding: 8px 12px;
    border-left: 3px solid var(--accent);
    background: var(--accent-soft);
    border-radius: 0 8px 8px 0;
  }
  .text :global(blockquote p) {
    margin: 0;
  }
  .tag {
    align-self: flex-start;
    font-size: 0.7rem;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--accent-soft);
    padding: 2px 8px;
    border-radius: 6px;
  }
  .goals {
    list-style: none;
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface-2);
    border: 1px dashed var(--border-strong);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.88rem;
    font-family: var(--font-mono);
  }
  .goals li {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .check {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    flex: none;
  }
  .goals.met {
    border-style: solid;
    border-color: color-mix(in srgb, var(--ok) 50%, transparent);
    background: var(--ok-soft);
  }
  .goals.met .check {
    border-color: var(--ok);
    background: var(--ok);
    box-shadow: inset 0 0 0 2px var(--ok-soft);
  }
  .success {
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--ok-soft);
    border-left: 3px solid var(--ok);
    font-size: 0.93rem;
  }
  .success :global(p) {
    margin: 4px 0 0;
  }
  .tip {
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--warn-soft);
    border-left: 3px solid var(--warn);
    font-size: 0.93rem;
  }
  .tip :global(p:last-child) {
    margin-bottom: 0;
  }
  .tip-btn {
    align-self: flex-start;
  }
  .problems {
    margin: 0;
    padding: 8px 12px 8px 28px;
    background: var(--err-soft);
    border-radius: 10px;
    font-size: 0.85rem;
  }
  .nav {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    margin-top: auto;
  }
  .finish {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .finish h2 {
    margin: 4px 0;
  }
  .finish blockquote {
    margin: 0;
    padding: 10px 14px;
    background: var(--accent-soft);
    border-radius: 10px;
    font-weight: 600;
  }
  .finish-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
    width: 100%;
  }
  @media (max-width: 980px) {
    .mission {
      grid-template-columns: minmax(0, 1fr);
    }
    .panel {
      position: static;
      max-height: none;
    }
  }
</style>
