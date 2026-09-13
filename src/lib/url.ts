/** Baut Links relativ zur Basis-URL (GitHub Pages liegt unter /Tiny-Johnny/). */
export function u(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let p = path.replace(/^\//, '');
  // Seiten mit Schrägstrich enden lassen – GitHub Pages leitet sonst jedes Mal um
  if (p && !p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return `${base}/${p}`;
}

export function isActive(current: string, href: string): boolean {
  const norm = (s: string) => s.replace(/\/$/, '');
  const c = norm(current);
  const h = norm(href);
  return c === h || (h !== norm(u('')) && c.startsWith(h + '/'));
}
