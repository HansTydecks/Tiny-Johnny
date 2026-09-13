<script lang="ts">
  /**
   * Vom Tastendruck zum Zeichen: Tastenmatrix → Controller → Scancode (USB-HID) → Betriebssystem → Zeichen.
   */
  // Deutsche Beschriftung, dazu die physische Position auf einer US-Tastatur (danach richtet sich der HID-Code)
  const ROWS: { de: string; us: string }[][] = [
    'QWERTZUIOP'.split('').map((de, i) => ({ de, us: 'QWERTYUIOP'[i] })),
    'ASDFGHJKL'.split('').map((de) => ({ de, us: de })),
    'YXCVBNM'.split('').map((de, i) => ({ de, us: 'ZXCVBNM'[i] })),
  ];
  const hid = (us: string) => 0x04 + (us.charCodeAt(0) - 65);
  const hex = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');
  const bin = (n: number, len = 8) => n.toString(2).padStart(len, '0');

  let pressed = $state<{ row: number; col: number; de: string; us: string } | null>(null);
  let step = $state(0);
  let down = $state(false);
  let shift = $state(false);
  let buffer = $state<string[]>([]);
  let timers: ReturnType<typeof setTimeout>[] = [];

  function press(row: number, col: number) {
    timers.forEach(clearTimeout);
    const k = ROWS[row][col];
    pressed = { row, col, ...k };
    down = true;
    step = 1;
    timers = [1, 2, 3, 4].map((s, i) =>
      setTimeout(() => {
        step = s + 1;
        if (s === 4) {
          const ch = shift ? k.de : k.de.toLowerCase();
          buffer = [...buffer.slice(-11), ch];
        }
      }, 650 * (i + 1)),
    );
    setTimeout(() => (down = false), 400);
  }

  function onKey(e: KeyboardEvent) {
    const m = /^Key([A-Z])$/.exec(e.code);
    if (!m) return;
    for (let r = 0; r < ROWS.length; r++) {
      const c = ROWS[r].findIndex((k) => k.us === m[1]);
      if (c >= 0) {
        e.preventDefault();
        shift = e.shiftKey;
        press(r, c);
        return;
      }
    }
  }

  const code = $derived(pressed ? hid(pressed.us) : 0);
  const char = $derived(pressed ? (shift ? pressed.de : pressed.de.toLowerCase()) : '');
  const ascii = $derived(char ? char.charCodeAt(0) : 0);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="kb" tabindex="0" role="application" aria-label="Tastatur-Simulation: Tasten anklicken oder hier hineinklicken und tippen" onkeydown={onKey}>
  <div class="top">
    <p class="muted hint">Tippe eine Taste an – oder klicke hier hinein und tippe auf deiner echten Tastatur.</p>
    <label class="shift"><input type="checkbox" bind:checked={shift} /> Umschalt (⇧)</label>
  </div>

  <div class="grid">
    <div class="keyboard" aria-hidden="false">
      {#each ROWS as row, r}
        <div class="row" style={`padding-left:${r * 12}px; padding-right:${(2 - r) * 6}px`}>
          <span class="rowline" class:on={pressed?.row === r && step >= 1}>Z{r}</span>
          {#each row as k, c}
            <button
              type="button"
              class="key"
              class:down={down && pressed?.row === r && pressed?.col === c}
              class:colOn={pressed?.col === c && step >= 1}
              class:rowOn={pressed?.row === r && step >= 1}
              onclick={() => press(r, c)}
            >
              {k.de}
            </button>
          {/each}
        </div>
      {/each}
    </div>

    <ol class="pipeline">
      <li class:on={step >= 1} class:now={step === 1}>
        <b>1 · Tastenmatrix</b>
        <span>
          {#if pressed}Zeile {pressed.row} und Spalte {pressed.col} werden verbunden. Der Controller fragt die Matrix
            ständig ab („scannt“) und bemerkt den Kontakt.{:else}Die Tasten liegen an Kreuzungen von Zeilen- und Spaltenleitungen.{/if}
        </span>
      </li>
      <li class:on={step >= 2} class:now={step === 2}>
        <b>2 · Scancode</b>
        <span>
          Der Tastatur-Controller erzeugt den Code für die <em>Position</em> der Taste:
          <code>{pressed ? hex(code) : '–'}</code>{#if pressed} = <code>{bin(code)}</code>{/if}
          {#if pressed && pressed.de !== pressed.us}<br /><small>Die Taste „{pressed.de}“ liegt dort, wo auf einer US-Tastatur „{pressed.us}“ ist – deshalb dieser Code!</small>{/if}
        </span>
      </li>
      <li class:on={step >= 3} class:now={step === 3}>
        <b>3 · Übertragung (USB)</b>
        <span>Der Computer fragt die Tastatur bis zu 1000-mal pro Sekunde ab (Polling) und erhält das Datenpaket mit dem Scancode.</span>
      </li>
      <li class:on={step >= 4} class:now={step === 4}>
        <b>4 · Betriebssystem</b>
        <span>
          Der Treiber übersetzt den Code mit dem eingestellten <em>Tastaturlayout</em> (Deutsch) in ein Zeichen:
          {#if pressed && step >= 4}<code>„{char}“</code> = Unicode {ascii} = <code>{bin(ascii)}</code>{/if}
        </span>
      </li>
      <li class:on={step >= 5} class:now={step === 5}>
        <b>5 · Speicher</b>
        <span>Das Zeichen landet im Tastaturpuffer im Arbeitsspeicher – von dort holt es sich das Programm.</span>
        <span class="buffer mono" aria-label="Tastaturpuffer">
          {#each buffer as b}<span>{b}</span>{:else}<span class="muted">leer</span>{/each}
        </span>
      </li>
    </ol>
  </div>
</div>

<style>
  .kb {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
    outline: none;
  }
  .kb:focus-visible {
    box-shadow: var(--ring);
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
  }
  .shift {
    font-size: 0.85rem;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 20px;
    margin-top: 12px;
  }
  .keyboard {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 12px;
    border-radius: 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    align-self: start;
    overflow-x: auto;
  }
  .row {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .rowline {
    width: 20px;
    flex: none;
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--text-3);
  }
  .rowline.on {
    color: var(--io);
  }
  .key {
    flex: 1 1 0;
    min-width: 0;
    max-width: 40px;
    aspect-ratio: 1;
    padding: 0;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    border-bottom-width: 3px;
    background: var(--surface);
    font-weight: 650;
    cursor: pointer;
    transition: transform 0.06s, background 0.2s;
    touch-action: manipulation;
  }
  .key.rowOn,
  .key.colOn {
    background: color-mix(in srgb, var(--io) 10%, var(--surface));
  }
  .key.rowOn.colOn {
    background: var(--io);
    color: var(--surface);
    border-color: var(--io);
  }
  .key.down {
    transform: translateY(2px);
    border-bottom-width: 1px;
  }
  .pipeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pipeline li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    opacity: 0.55;
    font-size: 0.88rem;
    transition: opacity 0.3s, background 0.3s, border-color 0.3s;
  }
  .pipeline li.on {
    opacity: 1;
  }
  .pipeline li.now {
    border-color: var(--io);
    background: var(--io-soft);
  }
  .pipeline small {
    color: var(--text-2);
  }
  .buffer {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .buffer span {
    min-width: 22px;
    text-align: center;
    padding: 1px 4px;
    border-radius: 5px;
    background: var(--mem-soft);
    color: var(--mem);
    font-weight: 700;
  }
  .buffer span.muted {
    background: none;
    color: var(--text-3);
    font-weight: 400;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
