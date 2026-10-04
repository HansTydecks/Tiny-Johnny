<script lang="ts">
  /**
   * Eine Leitung im Schaltbild: ein Pfeil, auf dem die Knöpfe der Mikrobefehle sitzen, die ihn benutzen.
   * Beim Ausführen wandert ein Paket mit dem transportierten Wert vom Anfang zur Spitze.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    /** Richtung der Pfeilspitze; `elbow` kommt von unten und biegt nach rechts ab */
    dir: 'up' | 'down' | 'left' | 'right' | 'elbow';
    tone: 'abus' | 'dbus' | 'cu' | 'sig';
    /** Paket, das gerade unterwegs ist */
    token?: { label: string; dur: number; key: number } | null;
    /** Zähler – jede Änderung > 0 lässt die Leitung kurz aufleuchten (ohne Paket, z. B. im Schnelllauf) */
    flash?: number;
    /** Der nächste Mikrobefehl benutzt diese Leitung */
    next?: boolean;
    /** Hervorhebung durch eine Tutorial-Mission */
    focus?: boolean;
    caption?: string;
    /** Erklärung beim Darüberfahren */
    hint?: string;
    style?: string;
    children?: Snippet;
  }
  let { dir, tone, token = null, flash = 0, next = false, focus = false, caption, hint, style = '', children }: Props = $props();

  let hot: HTMLSpanElement | undefined = $state();

  $effect(() => {
    if (flash > 0 && hot && !token) {
      hot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
    }
  });

  const vertical = $derived(dir === 'up' || dir === 'down');
</script>

<div
  class="wire {dir} t-{tone}"
  class:v={vertical}
  class:h={!vertical && dir !== 'elbow'}
  class:hot={!!token}
  class:next={next && !token}
  class:focus
  {style}
  title={hint}
>
  <span class="shape base" aria-hidden="true">
    <span class="shaft"></span>
    {#if dir === 'elbow'}<span class="shaft2"></span>{/if}
    <span class="head"></span>
  </span>
  <span class="shape glow" bind:this={hot} aria-hidden="true">
    <span class="shaft"></span>
    {#if dir === 'elbow'}<span class="shaft2"></span>{/if}
    <span class="head"></span>
  </span>
  {#if children}
    <div class="ops">{@render children()}</div>
  {/if}
  {#if caption}<span class="caption">{caption}</span>{/if}
  {#if token}
    {#key token.key}
      <span class="token" style="--dur:{token.dur}ms" aria-hidden="true">{token.label}</span>
    {/key}
  {/if}
</div>

<style>
  .wire {
    --w: 10px;
    --hl: 13px;
    --hw: calc(var(--w) * 2.5);
    --x: 50%;
    --y: 50%;
    --wc: var(--cu);
    --idle: color-mix(in srgb, var(--wc) 34%, var(--surface));
    position: relative;
    /* über den Register-Karten, damit Pakete beim Verlassen und Ankommen sichtbar bleiben */
    z-index: 4;
    min-width: 30px;
    min-height: 30px;
  }
  .t-abus { --wc: var(--abus); }
  .t-dbus { --wc: var(--dbus); }
  .t-cu { --wc: var(--cu); }
  .t-sig {
    --wc: var(--sbus);
    --w: 4px;
    --hl: 9px;
    --hw: 12px;
    --idle: color-mix(in srgb, var(--wc) 70%, var(--surface));
  }

  /* ---------------------------------------------------------------- Form */
  .shape {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .shape > span {
    position: absolute;
    background: var(--idle);
  }
  .glow {
    opacity: 0;
    transition: opacity 0.15s;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--wc) 60%, transparent));
  }
  .glow > span {
    background: var(--wc);
  }
  .hot .glow {
    opacity: 1;
  }

  .v .shaft {
    left: var(--x);
    width: var(--w);
    transform: translateX(-50%);
    top: 0;
    bottom: 0;
  }
  .up .shaft { top: calc(var(--hl) - 1px); }
  .down .shaft { bottom: calc(var(--hl) - 1px); }
  .v .head {
    left: var(--x);
    width: var(--hw);
    height: var(--hl);
    transform: translateX(-50%);
  }
  .up .head {
    top: 0;
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
  }
  .down .head {
    bottom: 0;
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }

  .h .shaft {
    top: var(--y);
    height: var(--w);
    transform: translateY(-50%);
    left: 0;
    right: 0;
  }
  .right .shaft { right: calc(var(--hl) - 1px); }
  .left .shaft { left: calc(var(--hl) - 1px); }
  .h .head,
  .elbow .head {
    top: var(--y);
    height: var(--hw);
    width: var(--hl);
    transform: translateY(-50%);
  }
  .right .head,
  .elbow .head {
    right: 0;
    clip-path: polygon(0 0, 100% 50%, 0 100%);
  }
  .left .head {
    left: 0;
    clip-path: polygon(100% 0, 0 50%, 100% 100%);
  }

  .elbow .shaft {
    left: var(--x);
    width: var(--w);
    transform: translateX(-50%);
    top: calc(var(--y) - var(--w) / 2);
    bottom: 0;
    border-radius: 4px 0 0 0;
  }
  .elbow .shaft2 {
    top: var(--y);
    height: var(--w);
    transform: translateY(-50%);
    left: calc(var(--x) - var(--w) / 2);
    right: calc(var(--hl) - 1px);
    border-radius: 4px 0 0 0;
  }

  /* ---------------------------------------------------------------- Knöpfe auf der Leitung */
  .ops {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .v {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(var(--hl) + 6px) 2px;
  }
  .h {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px calc(var(--hl) + 4px);
  }
  .elbow {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(var(--y) + var(--hw)) 2px 14px;
  }
  .caption {
    position: absolute;
    left: calc(var(--x) + var(--hw) / 2 + 8px);
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.72rem;
    line-height: 1.25;
    color: var(--text-3);
    white-space: nowrap;
    pointer-events: none;
  }

  /* ---------------------------------------------------------------- Paket */
  .token {
    position: absolute;
    z-index: 4;
    left: var(--x);
    top: var(--y);
    transform: translate(-50%, -50%);
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--wc);
    color: var(--surface);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    font-weight: 750;
    line-height: 1.35;
    white-space: nowrap;
    box-shadow:
      0 0 0 2px var(--surface),
      0 3px 10px color-mix(in srgb, var(--wc) 45%, transparent);
    pointer-events: none;
    animation: var(--dur) cubic-bezier(0.45, 0, 0.35, 1) forwards;
  }
  .up .token { animation-name: t-up; }
  .down .token { animation-name: t-down; }
  .right .token { animation-name: t-right; }
  .left .token { animation-name: t-left; }
  .elbow .token { animation-name: t-elbow; }
  @keyframes t-up {
    from { top: calc(100% - 4px); }
    to { top: 4px; }
  }
  @keyframes t-down {
    from { top: 4px; }
    to { top: calc(100% - 4px); }
  }
  @keyframes t-right {
    from { left: 4px; }
    to { left: calc(100% - 4px); }
  }
  @keyframes t-left {
    from { left: calc(100% - 4px); }
    to { left: 4px; }
  }
  @keyframes t-elbow {
    0% { top: calc(100% - 4px); left: var(--x); }
    72% { top: var(--y); left: var(--x); }
    100% { top: var(--y); left: calc(100% - 4px); }
  }

  /* ---------------------------------------------------------------- Vorschau: nächster Mikrobefehl */
  .next .base > span {
    background-color: var(--idle);
    background-image: repeating-linear-gradient(
      var(--stripe-dir, 0deg),
      color-mix(in srgb, var(--wc) 80%, var(--surface)) 0 6px,
      transparent 6px 12px
    );
    animation: march 0.7s linear infinite;
  }
  .next.down .base > span { animation-direction: reverse; }
  .next.h .base > span,
  .next .base .shaft2 {
    --stripe-dir: 90deg;
    animation-name: march-x;
  }
  .next.left .base > span { animation-direction: reverse; }
  @keyframes march {
    from { background-position: 0 12px; }
    to { background-position: 0 0; }
  }
  @keyframes march-x {
    from { background-position: 0 0; }
    to { background-position: 12px 0; }
  }

  /* ---------------------------------------------------------------- Hervorhebung im Tutorial */
  .focus .base > span {
    background: var(--wc);
  }
  .focus .base {
    animation: spot 1.6s ease-in-out infinite;
  }
  @keyframes spot {
    50% {
      filter: drop-shadow(0 0 7px var(--accent)) drop-shadow(0 0 2px var(--accent));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .token {
      display: none;
    }
  }
</style>
