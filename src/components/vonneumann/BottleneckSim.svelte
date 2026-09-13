<script lang="ts">
  /**
   * Von-Neumann-Flaschenhals: Die CPU könnte viel schneller rechnen, als der Bus Daten liefern kann.
   * Ein Cache mildert das Problem.
   */
  let cpuSpeed = $state(100); // Befehle, die die CPU pro Zeiteinheit verarbeiten könnte
  let busSpeed = $state(25); // Datenwörter, die der Bus pro Zeiteinheit liefern kann
  let cacheHit = $state(0); // Anteil der Zugriffe, die aus dem Cache bedient werden (%)

  // Pro Befehl wird ein Datenwort benötigt. Treffer im Cache brauchen den Bus nicht (Cache ist 10× schneller als der Bus).
  const effectiveSupply = $derived.by(() => {
    const h = cacheHit / 100;
    // Zeit pro Datenwort: h * (1/(10*bus)) + (1-h) * (1/bus)
    const tPer = h / (10 * busSpeed) + (1 - h) / busSpeed;
    return 1 / tPer;
  });
  const done = $derived(Math.min(cpuSpeed, effectiveSupply));
  const util = $derived(Math.round((done / cpuSpeed) * 100));
</script>

<div class="bn">
  <div class="viz">
    <div class="bottle" aria-hidden="true">
      <div class="cpu-side">
        <b>CPU</b>
        <span>könnte {cpuSpeed} Befehle/s</span>
      </div>
      <div class="neck" style={`--neck:${Math.max(10, Math.min(100, busSpeed / 2))}`}>
        <span class="flow" style={`animation-duration:${Math.max(0.3, 3 - busSpeed / 40)}s`}></span>
        <span class="neck-l">Bus</span>
      </div>
      <div class="mem-side">
        <b>Speicher</b>
        <span>liefert über den Bus {busSpeed} Wörter/s</span>
      </div>
    </div>
    <div class="util">
      <span>Die CPU arbeitet zu <b>{util} %</b> – den Rest der Zeit <b>wartet</b> sie auf Daten.</span>
      <span class="ubar"><span style={`width:${util}%`}></span></span>
    </div>
  </div>

  <div class="sliders">
    <label>CPU-Geschwindigkeit <b>{cpuSpeed}</b>
      <input type="range" min="20" max="200" step="10" bind:value={cpuSpeed} />
    </label>
    <label>Bus-Geschwindigkeit <b>{busSpeed}</b>
      <input type="range" min="5" max="200" step="5" bind:value={busSpeed} />
    </label>
    <label>Cache-Trefferquote <b>{cacheHit} %</b>
      <input type="range" min="0" max="95" step="5" bind:value={cacheHit} />
    </label>
  </div>
  <p class="muted small">
    Wie beim Ausgießen einer Flasche: Egal wie groß die Flasche ist – schneller als durch den engen Hals geht es nicht.
    Heute rechnen Prozessoren viel schneller, als der Arbeitsspeicher Daten liefern kann. Deshalb gibt es <b>Caches</b>.
  </p>
</div>

<style>
  .bn {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  .bottle {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1fr;
    align-items: center;
  }
  .cpu-side,
  .mem-side {
    display: flex;
    flex-direction: column;
    padding: 18px 12px;
    border-radius: 14px;
    font-size: 0.8rem;
    color: var(--text-2);
    text-align: center;
    min-height: 110px;
    justify-content: center;
  }
  .cpu-side {
    background: var(--cu-soft);
  }
  .cpu-side b {
    color: var(--cu);
    font-size: 1rem;
  }
  .mem-side {
    background: var(--mem-soft);
  }
  .mem-side b {
    color: var(--mem);
    font-size: 1rem;
  }
  .neck {
    position: relative;
    height: calc(14px + var(--neck) * 0.86px);
    max-height: 100px;
    background: var(--dbus-soft);
    border-top: 2px solid var(--dbus);
    border-bottom: 2px solid var(--dbus);
    overflow: hidden;
    transition: height 0.3s;
  }
  .flow {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(90deg, transparent 0 14px, var(--dbus) 14px 22px);
    opacity: 0.55;
    animation: flow linear infinite reverse;
  }
  @keyframes flow {
    to {
      transform: translateX(44px);
    }
  }
  .neck-l {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-weight: 800;
    font-size: 0.8rem;
    color: var(--dbus);
    background: var(--surface);
    padding: 0 6px;
    border-radius: 6px;
  }
  .util {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 14px 0;
  }
  .ubar {
    height: 12px;
    border-radius: 6px;
    background: var(--err-soft);
    overflow: hidden;
  }
  .ubar span {
    display: block;
    height: 100%;
    background: var(--ok);
    transition: width 0.3s;
  }
  .sliders {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .sliders label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
  }
  .sliders input {
    accent-color: var(--accent);
  }
  .small {
    font-size: 0.85rem;
    margin: 12px 0 0;
  }
  @media (max-width: 700px) {
    .sliders {
      grid-template-columns: 1fr;
    }
  }
</style>
