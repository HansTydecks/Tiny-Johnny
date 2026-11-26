<script lang="ts">
  /**
   * „Scale of Things“: unendlicher Zoom vom Mainboard bis zu den Atomen.
   * three.js wird erst hier (im Browser) nachgeladen, damit der Rest der Website schlank bleibt.
   */
  import { onMount } from 'svelte';
  import type { HudState } from '../../lib/scale/engine';
  import { formatLength, formatFactor, type Lang } from '../../lib/scale/zoom';
  import { PATH_BUTTONS, UI } from '../../lib/scale/ui';

  let canvas: HTMLCanvasElement;
  let stage: HTMLDivElement;
  let hud = $state<HudState | null>(null);
  let lang = $state<Lang>('de');
  let error = $state('');
  let loading = $state(true);
  let engine: import('../../lib/scale/engine').ScaleEngine | null = null;

  const tr = (k: keyof typeof UI) => UI[k][lang];

  onMount(() => {
    try {
      const saved = localStorage.getItem('tinyjohnny:scale-lang');
      if (saved === 'de' || saved === 'en') lang = saved;
    } catch {}
    let ro: ResizeObserver | null = null;
    let disposed = false;
    (async () => {
      try {
        const test = document.createElement('canvas').getContext('webgl2');
        if (!test) throw new Error('webgl');
        const [{ ScaleEngine }, { LEVELS }] = await Promise.all([import('../../lib/scale/engine'), import('../../lib/scale/levels')]);
        if (disposed) return;
        engine = new ScaleEngine(canvas, LEVELS);
        engine.setLang(lang);
        engine.onState = (s) => {
          hud = s;
          loading = false;
        };
        const fit = () => engine?.resize(stage.clientWidth, stage.clientHeight);
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(stage);
        engine.start();
        (window as unknown as { __scale?: unknown }).__scale = engine;
      } catch (e) {
        console.error(e);
        error = (e as Error).message === 'webgl' ? tr('noWebgl') : tr('failed');
        loading = false;
      }
    })();
    return () => {
      disposed = true;
      ro?.disconnect();
      engine?.dispose();
      engine = null;
    };
  });

  function setLang(l: Lang) {
    lang = l;
    engine?.setLang(l);
    try {
      localStorage.setItem('tinyjohnny:scale-lang', l);
    } catch {}
  }

  const magnification = $derived(hud ? 0.45 / hud.fov : 1);
</script>

<div class="stage" bind:this={stage}>
  <canvas bind:this={canvas} tabindex="0" aria-label={tr('canvasLabel')}></canvas>

  {#if loading}
    <div class="center-msg">
      <div class="spinner" aria-hidden="true"></div>
      <span>{tr('loading')}</span>
    </div>
  {/if}
  {#if error}
    <div class="center-msg err">{error}</div>
  {/if}

  {#if hud}
    <!-- Beschriftungen im Raum -->
    <div class="labels" aria-hidden="true">
      {#each hud.labels as l (l.key)}
        <div class="lab {l.kind}" style="transform: translate({l.x}px, {l.y}px); opacity: {l.alpha}">
          <span class="dot"></span>
          <span class="txt">
            {l.text[lang]}{#if l.size}<em> · {formatLength(l.size, lang)}</em>{/if}
          </span>
        </div>
      {/each}
    </div>

    <!-- oben: Pfad und Sprache -->
    <div class="top">
      <nav class="crumbs" aria-label={tr('pathLabel')}>
        {#each hud.chain as c, i (c.id)}
          {#if i > 0}<span class="sep" aria-hidden="true">›</span>{/if}
          <button type="button" class="crumb" class:cur={i === hud.chain.length - 1} onclick={() => engine?.flyTo(c.id)}>{c.title[lang]}</button>
        {/each}
      </nav>
      <div class="tools">
        <div class="seg" role="group" aria-label={tr('langLabel')}>
          <button type="button" class:on={lang === 'de'} onclick={() => setLang('de')}>DE</button>
          <button type="button" class:on={lang === 'en'} onclick={() => setLang('en')}>EN</button>
        </div>
        <button type="button" class="pill" onclick={() => engine?.reset()} title={tr('reset')}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span class="hide-s">{tr('reset')}</span>
        </button>
      </div>
    </div>

    <!-- unten: Maßstab, Text, Tauchgänge -->
    <div class="bottom">
      <div class="scale card">
        <div class="bar" style="width: {Math.max(8, hud.bar.px)}px"><span></span></div>
        <div class="bar-l">{formatLength(hud.bar.m, lang)}</div>
        <div class="fov">
          <span>{tr('fov')}</span> <b>{formatLength(hud.fov, lang)}</b>
        </div>
        <div class="mag">{tr('mag')} <b>{formatFactor(magnification, lang)} ×</b></div>
      </div>

      {#if hud.caption}
        {#key hud.captionKey + lang}
          <p class="caption card">{hud.caption[lang]}</p>
        {/key}
      {/if}

      <div class="dive card">
        <span class="dive-t">{tr('dive')}</span>
        <div class="dive-b">
          {#each PATH_BUTTONS as p (p.leaf)}
            <button
              type="button"
              class:on={hud.auto === p.leaf}
              style="--c: {p.color}"
              onclick={() => (hud?.auto === p.leaf ? engine?.reset() : engine?.dive(p.leaf))}
              title={p.title[lang]}>{p.label}</button
            >
          {/each}
        </div>
      </div>
    </div>

    {#if hud.hint}
      <div class="hint">
        <span><kbd>⇳</kbd> {tr('hintScroll')}</span>
        <span><kbd>⤧</kbd> {tr('hintDrag')}</span>
        <span class="hide-s"><kbd>⇧</kbd> {tr('hintPan')}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: calc(100dvh - var(--header-h));
    min-height: 420px;
    overflow: hidden;
    background:
      radial-gradient(120% 90% at 50% 40%, #182238 0%, #0b0f1a 55%, #05070c 100%);
    color: #e8ecf5;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    outline: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }
  .card {
    background: rgb(12 16 28 / 0.62);
    backdrop-filter: blur(10px) saturate(1.3);
    -webkit-backdrop-filter: blur(10px) saturate(1.3);
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: 12px;
  }
  .center-msg {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 14px;
    color: #b0b9cc;
    font-size: 0.95rem;
  }
  .center-msg.err {
    padding: 20px;
    text-align: center;
  }
  .spinner {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 3px solid rgb(255 255 255 / 0.15);
    border-top-color: #8b87ff;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .lab {
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    will-change: transform, opacity;
    transition: opacity 0.2s;
  }
  .lab .dot {
    width: 9px;
    height: 9px;
    margin-left: -4.5px;
    border-radius: 50%;
    background: #8fb4ff;
    box-shadow: 0 0 0 3px rgb(143 180 255 / 0.25);
    flex: none;
  }
  .lab .txt {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    padding: 3px 8px;
    border-radius: 7px;
    background: rgb(10 14 26 / 0.72);
    border: 1px solid rgb(143 180 255 / 0.25);
    color: #e8ecf5;
    transform: translateY(-1px);
  }
  .lab .txt em {
    font-style: normal;
    font-family: var(--font-mono);
    font-weight: 500;
    color: #9fb4d8;
    font-size: 0.76rem;
  }
  .lab.life .dot {
    background: #ffb35c;
    box-shadow: 0 0 0 3px rgb(255 179 92 / 0.25);
  }
  .lab.life .txt {
    border-color: rgb(255 179 92 / 0.35);
  }
  .lab.life .txt em {
    color: #ffcf9a;
  }

  .top {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    pointer-events: none;
  }
  .top > * {
    pointer-events: auto;
  }
  .crumbs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: rgb(12 16 28 / 0.62);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgb(255 255 255 / 0.09);
    max-width: min(760px, 100%);
  }
  .crumb {
    border: 0;
    background: transparent;
    color: #b0b9cc;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 5px 9px;
    border-radius: 8px;
    cursor: pointer;
  }
  .crumb:hover {
    background: rgb(255 255 255 / 0.07);
    color: #fff;
  }
  .crumb.cur {
    color: #fff;
    background: rgb(139 135 255 / 0.22);
  }
  .sep {
    color: #5a6480;
    font-size: 0.85rem;
  }
  .tools {
    display: flex;
    gap: 6px;
  }
  .seg {
    display: flex;
    padding: 3px;
    border-radius: 10px;
    background: rgb(12 16 28 / 0.62);
    border: 1px solid rgb(255 255 255 / 0.09);
  }
  .seg button,
  .pill {
    border: 0;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    color: #b0b9cc;
    background: transparent;
    padding: 5px 9px;
    border-radius: 7px;
    cursor: pointer;
  }
  .seg button.on {
    background: #8b87ff;
    color: #0b0d24;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgb(12 16 28 / 0.62);
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: 10px;
    padding: 7px 11px;
  }
  .pill:hover,
  .seg button:not(.on):hover {
    color: #fff;
  }
  button:focus-visible,
  canvas:focus-visible {
    outline: 2px solid #8b87ff;
    outline-offset: 2px;
  }

  .bottom {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: end;
    gap: 12px;
    pointer-events: none;
  }
  .bottom > * {
    pointer-events: auto;
  }
  .scale {
    padding: 10px 12px 9px;
    min-width: 170px;
  }
  .bar {
    height: 8px;
    border: 2px solid #fff;
    border-top: 0;
    transition: width 0.08s linear;
  }
  .bar-l {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.92rem;
    margin-top: 3px;
  }
  .fov,
  .mag {
    font-size: 0.76rem;
    color: #9aa5bf;
    margin-top: 2px;
  }
  .fov b,
  .mag b {
    color: #e8ecf5;
    font-family: var(--font-mono);
    font-weight: 600;
  }
  .caption {
    margin: 0 auto;
    max-width: 640px;
    padding: 11px 15px;
    font-size: 0.93rem;
    line-height: 1.5;
    color: #dfe5f2;
    animation: cap 0.5s ease;
  }
  @keyframes cap {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .dive {
    padding: 8px 10px;
  }
  .dive-t {
    display: block;
    font-size: 0.72rem;
    color: #9aa5bf;
    font-weight: 600;
    margin: 0 2px 5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .dive-b {
    display: flex;
    gap: 5px;
  }
  .dive-b button {
    border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
    background: color-mix(in srgb, var(--c) 14%, transparent);
    color: #fff;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 6px 9px;
    border-radius: 8px;
    cursor: pointer;
    min-width: 44px;
  }
  .dive-b button:hover {
    background: color-mix(in srgb, var(--c) 30%, transparent);
  }
  .dive-b button.on {
    background: var(--c);
    color: #0b0d18;
  }

  .hint {
    position: absolute;
    left: 50%;
    top: 74px;
    transform: translateX(-50%);
    display: flex;
    gap: 18px;
    padding: 10px 16px;
    border-radius: 12px;
    background: rgb(10 14 26 / 0.66);
    border: 1px solid rgb(255 255 255 / 0.1);
    font-size: 0.85rem;
    color: #cfd6e6;
    pointer-events: none;
    animation: hint 9s ease 0.6s both;
  }
  @keyframes hint {
    0% {
      opacity: 0;
    }
    12%,
    82% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  kbd {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 1px 6px;
    border-radius: 5px;
    background: rgb(255 255 255 / 0.12);
    margin-right: 4px;
  }

  @media (max-width: 860px) {
    .bottom {
      grid-template-columns: 1fr auto;
    }
    .caption {
      grid-column: 1 / -1;
      grid-row: 1;
      font-size: 0.86rem;
    }
  }
  @media (max-width: 560px) {
    .top {
      top: 8px;
      left: 8px;
      right: 8px;
    }
    .bottom {
      left: 8px;
      right: 8px;
      bottom: 8px;
      gap: 8px;
    }
    .hide-s {
      display: none;
    }
    .scale {
      min-width: 0;
      padding: 8px 10px;
    }
    .mag {
      display: none;
    }
    .dive-b button {
      min-width: 0;
      padding: 6px 7px;
      font-size: 0.74rem;
    }
    .crumb {
      font-size: 0.78rem;
      padding: 4px 6px;
    }
    .lab .txt {
      font-size: 0.72rem;
    }
    .hint {
      flex-direction: column;
      gap: 6px;
      top: 38%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .caption,
    .hint {
      animation: none;
    }
  }
</style>
