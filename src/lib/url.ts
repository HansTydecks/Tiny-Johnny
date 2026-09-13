/** Baut Links relativ zur Basis-URL (GitHub Pages liegt unter /Tiny-Johnny/). */
export function u(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
}

export function isActive(current: string, href: string): boolean {
  const norm = (s: string) => s.replace(/\/$/, '');
  const c = norm(current);
  const h = norm(href);
  return c === h || (h !== norm(u('')) && c.startsWith(h + '/'));
}
