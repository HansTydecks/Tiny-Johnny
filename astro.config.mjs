// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://tinyjohnny.tinfo.space',
  trailingSlash: 'ignore',
  integrations: [svelte(), mdx()],
});
