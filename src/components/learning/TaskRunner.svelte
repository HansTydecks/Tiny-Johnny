<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Johnny from '../simulator/Johnny.svelte';
  import CommandReference from '../simulator/CommandReference.svelte';
  import { Sim, type Feature } from '../../lib/johnny/sim.svelte';
  import { prepareProgram, runTests, toEntries, type TestResult } from '../../lib/johnny/checker';
  import { ramFromShare, ramToShare } from '../../lib/johnny/fileio';
  import { formatAddr } from '../../lib/johnny/assembler';
  import { loadProgress, updateTask } from '../../lib/progress';
  import type { TaskView } from '../../lib/tasks';

  interface Props {
    task: TaskView;
    nextHref?: string;
    overviewHref: string;
  }
  let { task, nextHref, overviewHref }: Props = $props();
  const t = untrack(() => task);

  const sim = new Sim({ mode: t.modus, ram: ramFromShare(t.start) });
  const features: Feature[] = ['ramEdit', 'asm', 'microStep', 'macroStep', 'run', 'reset'];

  let tipsShown = $state(0);
  let solutionShown = $state(false);
  let results = $state<TestResult[] | null>(null);
  let solved = $state(false);
  let restored = $state(false);
  let answers = $state<string[]>(t.fragen.map(() => ''));
  let answerResult = $state<(boolean | null)[]>(t.fragen.map(() => null));
  let traceChecked = $state(false);

  const label = (addr: number) => t.zellen[String(addr)] ?? formatAddr(addr);
  const fmtCells = (m: Record<string, number> | undefined) =>
    toEntries(m).map(([a, v]) => ({ name: label(a), addr: formatAddr(a), v }));

  onMount(() => {
    const p = loadProgress().aufgaben[t.id];
    if (p) {
      tipsShown = Math.min(p.tipps ?? 0, t.tipps.length);
      solutionShown = !!p.loesungGesehen;
      solved = !!p.geloest;
      if (p.programm && t.typ !== 'trace') {
        sim.loadRam(ramFromShare(p.programm));
        restored = true;
      }
    }
    let timer: ReturnType<typeof setTimeout>;
    const off = sim.onChange(() => {
      if (t.typ === 'trace' || sim.running) return;
      clearTimeout(timer);
      timer = setTimeout(() => updateTask(t.id, { programm: ramToShare(sim.s.ram) }), 500);
    });
    return () => {
      off();
      sim.destroy();
    };
  });

  function check() {
    sim.pause();
    const program = prepareProgram(sim.s.ram, ramFromShare(t.start), Object.keys(t.zellen).map(Number));
    results = runTests(program, t.tests, { microcode: sim.s.microcode, names: sim.s.names });
    if (results.every((r) => r.passed)) {
      solved = true;
      updateTask(t.id, { geloest: true });
    }
  }

  function showTip() {
    tipsShown++;
    updateTask(t.id, { tipps: tipsShown });
  }

  function revealSolution() {
    solutionShown = true;
    updateTask(t.id, { loesungGesehen: true, tipps: tipsShown });
  }

  function loadSolution() {
    if (!confirm('Die Musterlösung ersetzt dein Programm im Speicher. Fortfahren?')) return;
    sim.reset();
    sim.loadRam(ramFromShare(t.loesung));
    sim.info('Musterlösung geladen. Geh sie mit Makroschritten durch!');
    results = null;
  }

  function resetTask() {
    if (!confirm('Speicher auf den Anfangszustand der Aufgabe zurücksetzen? Dein Programm geht verloren.')) return;
    sim.reset();
    sim.loadRam(ramFromShare(t.start));
    results = null;
    restored = false;
  }

  function checkAnswers(e: SubmitEvent) {
    e.preventDefault();
    answerResult = t.fragen.map((f, i) => Number(answers[i].trim()) === f.antwort && answers[i].trim() !== '');
    traceChecked = true;
    if (answerResult.every(Boolean)) {
      solved = true;
      updateTask(t.id, { geloest: true });
    }
  }

  const passedCount = $derived(results?.filter((r) => r.passed).length ?? 0);
</script>

<div class="task">
  <aside class="panel">
    <div class="desc">{@html t.html}</div>

    {#if Object.keys(t.zellen).length}
      <div class="block">
        <h3>Speicherzellen</h3>
        <ul class="cells">
          {#each Object.entries(t.zellen) as [addr, name]}
            <li><span class="mono">{addr.padStart(3, '0')}</span><span>{name}</span></li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if t.typ === 'trace'}
      <form class="block trace" onsubmit={checkAnswers}>
        <h3>Deine Vorhersage</h3>
        <p class="muted small">Erst im Kopf (oder auf Papier) durchspielen – dann prüfen. Danach darfst du im Simulator nachsehen.</p>
        {#each t.fragen as f, i}
          <label class="q" class:ok={answerResult[i] === true} class:bad={answerResult[i] === false}>
            <span class="q-text">{@html f.html}</span>
            <input class="input mono" bind:value={answers[i]} inputmode="numeric" aria-label="Antwort" />
            {#if answerResult[i] === true}<span class="mark ok-t">✓</span>{:else if answerResult[i] === false}<span class="mark bad-t">✗</span>{/if}
          </label>
        {/each}
        <button class="btn primary" type="submit">Antworten prüfen</button>
      </form>
    {:else}
      <div class="block">
        <h3>Testfälle</h3>
        <p class="muted small">Dein Programm wird mit diesen Werten gestartet (ab Adresse 000) und muss mit HLT enden.</p>
        <div class="tests">
          {#each t.tests as test, i}
            {@const r = results?.[i]}
            <div class="test" class:pass={r?.passed} class:fail={r && !r.passed}>
              <span class="t-name">{test.name ?? `Test ${i + 1}`}</span>
              <span class="t-io">
                {#each fmtCells(test.ein) as c}<span class="io in" title={`Zelle ${c.addr}`}>{c.name} = {c.v}</span>{/each}
                <span class="arrow" aria-hidden="true">→</span>
                {#each fmtCells(test.aus) as c}<span class="io out" title={`Zelle ${c.addr}`}>{c.name} = {c.v}</span>{/each}
                {#if test.akku !== undefined}<span class="io out">Akku = {test.akku}</span>{/if}
              </span>
              {#if r && !r.passed}
                <ul class="problems">{#each r.problems as p}<li>{p}</li>{/each}</ul>
              {/if}
            </div>
          {/each}
        </div>
        <div class="check-row">
          <button class="btn primary" type="button" onclick={check}>Programm prüfen</button>
          {#if results}
            <span class="summary" class:all={passedCount === results.length}>
              {passedCount} / {results.length} Tests bestanden
              {#if passedCount === results.length} · {results[0].macros} Befehle, {results[0].ticks} Takte (Test 1){/if}
            </span>
          {/if}
        </div>
      </div>
    {/if}

    {#if solved}
      <div class="solved" role="status">
        <b>🎉 Aufgabe gelöst!</b>
        {#if t.erklaerung}<div>{@html t.erklaerung}</div>{/if}
        <div class="solved-actions">
          {#if nextHref}<a class="btn primary small" href={nextHref}>Nächste Aufgabe →</a>{/if}
          <a class="btn small" href={overviewHref}>Alle Aufgaben</a>
        </div>
      </div>
    {/if}

    {#if t.tipps.length || t.loesungText}
      <div class="block hints">
        <h3>Hilfe</h3>
        {#each t.tipps.slice(0, tipsShown) as tip, i}
          <div class="tip"><span class="tip-n">Tipp {i + 1}</span>{@html tip}</div>
        {/each}
        <div class="hint-actions">
          {#if tipsShown < t.tipps.length}
            <button class="btn small" type="button" onclick={showTip}>💡 Tipp {tipsShown + 1} von {t.tipps.length} anzeigen</button>
          {/if}
          {#if t.loesungText && tipsShown >= t.tipps.length && !solutionShown}
            <button class="btn small" type="button" onclick={revealSolution}>Musterlösung anzeigen</button>
          {/if}
        </div>
        {#if solutionShown && t.loesungText}
          <div class="solution">
            <span class="tip-n">Musterlösung</span>
            <pre>{t.loesungText}</pre>
            {#if t.typ !== 'trace'}
              <button class="btn small" type="button" onclick={loadSolution}>In den Simulator laden</button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <div class="foot">
      {#if restored}<span class="muted small">Dein letzter Stand wurde wiederhergestellt.</span>{/if}
      {#if t.typ !== 'trace'}
        <button class="btn small ghost" type="button" onclick={resetTask}>Aufgabe zurücksetzen</button>
      {/if}
    </div>
  </aside>

  <div class="sim">
    <div class="sim-wrap" class:locked={t.typ === 'trace' && !traceChecked}>
      <Johnny {sim} show={['ram', 'ab', 'db', 'acc', 'ins', 'pc', 'mc', 'log']} {features} labels={t.zellen} ramHeight={440} />
      {#if t.typ === 'trace' && !traceChecked}
        <div class="lock">
          <b>Erst vorhersagen!</b>
          <span>Schau dir das Programm in der Tabelle an und spiele es im Kopf durch. Nach dem Prüfen deiner Antworten kannst du hier nachsehen.</span>
          <button class="btn small" type="button" onclick={() => (traceChecked = true)}>Trotzdem öffnen</button>
        </div>
      {/if}
    </div>
    <CommandReference names={sim.s.names} microcode={sim.s.microcode} />
  </div>
</div>

<style>
  .task {
    display: grid;
    grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
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
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .desc :global(p:last-child) {
    margin-bottom: 0;
  }
  .desc :global(ul) {
    padding-left: 1.2em;
  }
  .block {
    border-top: 1px solid var(--border);
    padding-top: 14px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
  }
  .small {
    font-size: 0.82rem;
    margin: 0 0 8px;
  }
  .cells {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cells li {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 3px 10px 3px 4px;
    background: var(--mem-soft);
    border-radius: 8px;
    font-size: 0.85rem;
  }
  .cells .mono {
    background: var(--surface);
    border-radius: 5px;
    padding: 0 5px;
    font-size: 0.78rem;
    color: var(--mem);
    font-weight: 700;
  }
  .tests {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .test {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    font-size: 0.85rem;
  }
  .test.pass {
    border-color: color-mix(in srgb, var(--ok) 50%, transparent);
    background: var(--ok-soft);
  }
  .test.fail {
    border-color: color-mix(in srgb, var(--err) 50%, transparent);
    background: var(--err-soft);
  }
  .t-name {
    font-weight: 650;
    margin-right: 8px;
  }
  .t-io {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .io {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    padding: 0 6px;
    border-radius: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .io.out {
    border-color: color-mix(in srgb, var(--mem) 40%, var(--border));
  }
  .arrow {
    color: var(--text-3);
  }
  .problems {
    margin: 6px 0 0;
    padding-left: 18px;
    font-size: 0.8rem;
  }
  .check-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  .summary {
    font-size: 0.85rem;
    font-weight: 650;
    color: var(--err);
  }
  .summary.all {
    color: var(--ok);
  }
  .solved {
    padding: 14px;
    border-radius: 12px;
    background: var(--ok-soft);
    border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent);
    font-size: 0.93rem;
  }
  .solved :global(p) {
    margin: 6px 0;
  }
  .solved-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .tip,
  .solution {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--warn-soft);
    border-left: 3px solid var(--warn);
    margin-bottom: 8px;
    font-size: 0.92rem;
  }
  .solution {
    background: var(--accent-soft);
    border-left-color: var(--accent);
  }
  .tip :global(p:last-child) {
    margin-bottom: 0;
  }
  .tip :global(pre),
  .solution pre {
    margin: 6px 0;
    font-size: 0.82rem;
    background: var(--surface);
  }
  .tip-n {
    display: block;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
    margin-bottom: 2px;
  }
  .hint-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .trace {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .q {
    display: grid;
    grid-template-columns: 1fr 110px 20px;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid var(--border);
  }
  .q.ok {
    background: var(--ok-soft);
  }
  .q.bad {
    background: var(--err-soft);
  }
  .q-text :global(p) {
    margin: 0;
    font-size: 0.9rem;
  }
  .q .input {
    min-height: 34px;
  }
  .mark {
    font-weight: 800;
  }
  .ok-t {
    color: var(--ok);
  }
  .bad-t {
    color: var(--err);
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .sim {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .sim-wrap {
    position: relative;
  }
  .sim-wrap.locked > :global(.johnny) {
    filter: blur(0px);
  }
  .sim-wrap.locked :global(.cpu),
  .sim-wrap.locked :global(.buses),
  .sim-wrap.locked :global(.toolbar) {
    opacity: 0.25;
    pointer-events: none;
    filter: grayscale(1);
  }
  .lock {
    position: absolute;
    top: 80px;
    right: 24px;
    width: min(360px, calc(100% - 48px));
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow-l);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.92rem;
    z-index: 5;
  }
  @media (max-width: 1000px) {
    .task {
      grid-template-columns: minmax(0, 1fr);
    }
    .panel {
      position: static;
      max-height: none;
    }
    .lock {
      position: static;
      width: auto;
      margin-top: 12px;
    }
  }
</style>
