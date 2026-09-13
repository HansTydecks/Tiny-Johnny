<script lang="ts">
  import { MACRO_INFO, MICRO_BY_CODE } from '../../lib/johnny/microcode';

  interface Props {
    names: string[];
    microcode: number[];
    open?: boolean;
  }
  let { names, microcode, open = false }: Props = $props();

  const rows = $derived(
    names
      .map((name, op) => ({
        op,
        name,
        ops: microcode.slice(op * 10, op * 10 + 10).filter((c) => c !== 0),
        info: MACRO_INFO[name],
      }))
      .filter((r) => r.op > 0 && r.name),
  );
</script>

<details class="ref" {open}>
  <summary>Befehlsübersicht <span class="muted">– alle Makrobefehle mit ihren Mikrobefehlen</span></summary>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Opcode</th><th>Befehl</th><th>Bedeutung</th><th>Mikroprogramm</th></tr>
      </thead>
      <tbody>
        {#each rows as r (r.op)}
          <tr>
            <td class="mono">{String(r.op).padStart(2, '0')}</td>
            <td class="mono"><b>{r.name}</b> <span class="muted">xxx</span></td>
            <td>
              {r.info?.de ?? 'Eigener Befehl'}
              {#if r.info?.hinweis}<br /><span class="warn">⚠ {r.info.hinweis}</span>{/if}
            </td>
            <td class="ops">
              {#each r.ops as c}<code>{MICRO_BY_CODE[c]?.label}</code>{/each}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</details>

<style>
  .ref {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px 16px;
  }
  summary {
    cursor: pointer;
    font-weight: 650;
  }
  .table-wrap {
    overflow-x: auto;
    margin-top: 10px;
  }
  table {
    font-size: 0.88rem;
    min-width: 640px;
  }
  .ops {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .ops code {
    font-size: 0.75rem;
  }
  .warn {
    color: var(--warn);
    font-size: 0.82rem;
    font-weight: 600;
  }
</style>
