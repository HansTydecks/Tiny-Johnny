/**
 * Spielt die Mikrobefehle des letzten Schritts nacheinander ab – nur für die Anzeige.
 * Die Simulation ist dabei längst fertig; gezeigt wird ein rekonstruierter Zwischenzustand.
 */
import type { JohnnyState, MicroEvent } from './engine';
import { signature, stateBefore, stepDuration } from './flow';
import type { Sim } from './sim.svelte';

export class FlowPlayer {
  /** Index des Mikrobefehls, dessen Paket gerade unterwegs ist; −1 = keine Wiedergabe */
  index = $state(-1);
  events: MicroEvent[] = $state.raw([]);
  /** Dauer pro Paket in ms (0 = ohne Animation) */
  dur = $state(0);
  /** Laufende Nummer des aktuellen Pakets */
  seq = $state(0);
  /** Erhöht sich bei jeder Ankunft – startet Aufleucht-Animationen neu */
  arrival = $state(0);
  /** Gerade angekommene Mikrobefehle (ohne Animation: alle auf einmal) */
  arrived: MicroEvent[] = $state.raw([]);

  readonly active: MicroEvent | null = $derived(this.index >= 0 ? (this.events[this.index] ?? null) : null);
  /** Zustand, der angezeigt wird */
  readonly view: JohnnyState;

  private sim: Sim;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sig = '';

  constructor(sim: Sim) {
    this.sim = sim;
    this.view = $derived(this.index >= 0 ? stateBefore(sim.s, this.events, this.index) : sim.s);
  }

  get playing() {
    return this.index >= 0;
  }
  get animated() {
    return this.dur > 0;
  }

  /** Neue Mikrobefehle aus der Simulation anzeigen. `runSpeed`: Zeit pro Makroschritt beim Ausführen. */
  play(events: MicroEvent[], opts: { animate: boolean; quiet?: boolean; runSpeed?: number }) {
    this.clear();
    const dur = opts.animate ? stepDuration(events.length, opts.runSpeed) : 0;
    this.dur = dur;
    if (!dur || !events.length) {
      this.index = -1;
      this.events = [];
      this.arrived = opts.quiet ? [] : events;
      this.arrival++;
      return;
    }
    this.events = events;
    this.sig = signature(this.sim.s);
    this.arrived = [];
    this.seq++;
    this.index = 0;
    this.timer = setTimeout(this.step, dur);
  }

  private step = () => {
    this.arrived = [this.events[this.index]];
    this.arrival++;
    if (this.index + 1 >= this.events.length) {
      this.index = -1;
      this.timer = null;
      return;
    }
    this.seq++;
    this.index++;
    this.timer = setTimeout(this.step, this.dur);
  };

  /** Wurde der Zustand von außen verändert (z. B. Reset), springt die Anzeige sofort zum echten Zustand. */
  check() {
    if (this.index >= 0 && signature(this.sim.s) !== this.sig) this.finish();
  }

  finish() {
    this.clear();
    this.index = -1;
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  destroy() {
    this.clear();
  }
}
