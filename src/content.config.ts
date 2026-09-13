import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const farbe = z.enum(['mem', 'abus', 'dbus', 'alu', 'cu', 'io', 'sbus', 'accent']);

/** Kapitel des Von-Neumann-Teils (MDX, damit interaktive Bausteine eingebettet werden können). */
const kapitel = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/kapitel' }),
  schema: z.object({
    titel: z.string(),
    kurz: z.string(),
    leitfrage: z.string(),
    reihenfolge: z.number(),
    farbe: farbe.default('accent'),
    dauer: z.string().optional(),
    vertiefung: z.boolean().default(false),
  }),
});

const zellwerte = z.record(z.string(), z.number());

const ziel = z.object({
  ram: zellwerte.optional(),
  ramMin: zellwerte.optional(),
  acc: z.number().optional(),
  ab: z.number().optional(),
  db: z.number().optional(),
  ins: z.number().optional(),
  pc: z.number().optional(),
  mc: z.number().optional(),
  halted: z.boolean().optional(),
  benutzt: z.array(z.string()).optional(),
  befehl: z.object({ name: z.string(), mikro: z.array(z.string()).optional() }).optional(),
  modus: z.enum(['normal', 'bonsai']).optional(),
  tests: z
    .array(z.object({ name: z.string().optional(), ein: zellwerte.optional(), aus: zellwerte.optional(), akku: z.number().optional() }))
    .optional(),
  requireHalt: z.boolean().optional(),
  /** Tests mit diesem festen Programm statt mit dem Speicherinhalt ausführen */
  programm: z.string().optional(),
});

const vorbereitung = z
  .object({
    reset: z.boolean().optional(),
    ramLeeren: z.boolean().optional(),
    ram: zellwerte.optional(),
    programm: z.string().optional(),
    register: z
      .object({ acc: z.number(), ab: z.number(), db: z.number(), ins: z.number(), pc: z.number(), mc: z.number() })
      .partial()
      .optional(),
  })
  .optional();

const schritt = z.discriminatedUnion('typ', [
  z.object({ typ: z.literal('info'), titel: z.string().optional(), text: z.string(), vorbereitung }),
  z.object({
    typ: z.literal('aktion'),
    titel: z.string().optional(),
    text: z.string(),
    ziel,
    tipp: z.string().optional(),
    erfolg: z.string().optional(),
    loesung: z.array(z.string()).default([]),
    vorbereitung,
  }),
  z.object({
    typ: z.literal('quiz'),
    titel: z.string().optional(),
    frage: z.string(),
    optionen: z.array(z.string()).min(2),
    richtig: z.union([z.number(), z.array(z.number())]),
    erklaerung: z.string(),
    vorbereitung,
  }),
  z.object({
    typ: z.literal('vorhersage'),
    titel: z.string().optional(),
    frage: z.string(),
    antwort: z.number(),
    einheit: z.string().optional(),
    erklaerung: z.string(),
    vorbereitung,
  }),
]);

const simSichtbar = z.enum(['ram', 'ab', 'db', 'acc', 'ins', 'pc', 'mc', 'microcode', 'log']);
const simFunktion = z.enum([
  'ramEdit',
  'asm',
  'abInput',
  'dbInput',
  'microStep',
  'macroStep',
  'run',
  'reset',
  'clearRam',
  'files',
  'controlToggle',
  'bonsai',
  'record',
]);

/** Tutorial-Missionen */
const tutorial = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/tutorial' }),
  schema: z.object({
    nummer: z.number(),
    titel: z.string(),
    kurz: z.string(),
    leitfrage: z.string(),
    vertiefung: z.boolean().default(false),
    modus: z.enum(['normal', 'bonsai']).default('normal'),
    sichtbar: z.array(simSichtbar),
    mikro: z.union([z.literal('alle'), z.array(z.string())]).default([]),
    funktionen: z.array(simFunktion).default([]),
    startRam: zellwerte.default({}),
    programm: z.string().optional(),
    zellen: z.record(z.string(), z.string()).default({}),
    schritte: z.array(schritt).min(1),
  }),
});

const testfall = z.object({
  name: z.string().optional(),
  ein: zellwerte.optional(),
  aus: zellwerte.optional(),
  akku: z.number().optional(),
});

/** Aufgaben mit Tipps, Musterlösung und automatischer Prüfung */
const aufgaben = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/aufgaben' }),
  schema: z.object({
    titel: z.string(),
    kontext: z.enum(['mathe', 'spiele', 'klassiker']),
    sterne: z.number().min(1).max(3),
    reihenfolge: z.number().default(100),
    typ: z.enum(['programm', 'trace', 'fehlersuche']).default('programm'),
    modus: z.enum(['normal', 'bonsai']).default('normal'),
    kurz: z.string(),
    leitfrage: z.string(),
    text: z.string(),
    zellen: z.record(z.string(), z.string()).default({}),
    /** Vorgegebener Speicherinhalt (Assembler-Text), z. B. Daten oder ein fehlerhaftes Programm */
    start: z.string().default(''),
    tests: z.array(testfall).default([]),
    /** Nur bei Trace-Aufgaben: gefragte Zellen und richtige Antworten */
    fragen: z.array(z.object({ text: z.string(), zelle: z.number().optional(), akku: z.boolean().optional(), antwort: z.number() })).default([]),
    tipps: z.array(z.string()).default([]),
    loesung: z.string().default(''),
    erklaerung: z.string().default(''),
  }),
});

/** Beispielprogramme für die Sandbox */
const beispiele = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/beispiele' }),
  schema: z.object({
    titel: z.string(),
    beschreibung: z.string(),
    modus: z.enum(['normal', 'bonsai']).default('normal'),
    reihenfolge: z.number().default(100),
    programm: z.string(),
  }),
});

export const collections = { kapitel, tutorial, aufgaben, beispiele };
