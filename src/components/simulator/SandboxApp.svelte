<script lang="ts">
  import { onMount } from 'svelte';
  import Johnny from './Johnny.svelte';
  import CommandReference from './CommandReference.svelte';
  import { Sim, type Example } from '../../lib/johnny/sim.svelte';
  import { ramFromShare, ramToShare } from '../../lib/johnny/fileio';
  import { loadJSON, saveJSON } from '../../lib/progress';

  interface Props {
    examples: Example[];
  }
  let { examples }: Props = $props();

  const KEY = 'tinyjohnny:sandbox:v1';
  interface Saved {
    ram: string;
    mode: 'normal' | 'bonsai';
    microcode: number[];
    names: string[];
  }

  const sim = new Sim();
  let ready = $state(false);

  onMount(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    const saved = loadJSON<Saved>(KEY);
    if (hash.get('p') !== null) {
      sim.setMode(hash.get('m') === 'bonsai' ? 'bonsai' : 'normal');
      sim.loadRam(ramFromShare(hash.get('p') ?? ''));
      sim.log = [];
      sim.info('Programm aus dem Link geladen.');
      history.replaceState(null, '', location.pathname);
    } else if (saved) {
      sim.loadMicroprogram(saved.microcode, saved.names);
      sim.engine.mode = saved.mode;
      sim.loadRam(ramFromShare(saved.ram));
      sim.log = [];
    }
    ready = true;

    let t: ReturnType<typeof setTimeout>;
    const off = sim.onChange(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (sim.running) return;
        saveJSON(KEY, {
          ram: ramToShare(sim.s.ram),
          mode: sim.s.mode,
          microcode: sim.s.microcode,
          names: sim.s.names,
        } satisfies Saved);
      }, 400);
    });
    return () => {
      off();
      sim.destroy();
    };
  });
</script>

<div class="sandbox" class:ready>
  <Johnny {sim} {examples} share />
  <CommandReference names={sim.s.names} microcode={sim.s.microcode} />
</div>

<style>
  .sandbox {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
</style>
