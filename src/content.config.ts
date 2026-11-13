/**
 * Content collections: everything the organizing teams edit lives in src/content/*.json.
 * Each file is an array; `id` sets the display order (entries are sorted by id).
 * The schemas below validate every entry at build time, so a typo fails `npm run build`.
 */
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const link = z.string(); // absolute URL, "#anchor" or "" while it is not defined yet

/* Sponsor decks: one JSON file per sponsor in src/content/decks/. `slides` is an ordered list,
 * and `type` picks the layout (src/components/deck/). Titles are set in Monchila: "\n" breaks lines. */
const accentColor = z.enum(['yellow', 'green', 'red', 'sky', 'paper']);
const deckSlide = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('cover'), kicker: z.string(), title: z.string(), subtitle: z.string(),
    ribbon: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('stats'), kicker: z.string(), title: z.string(), note: z.string().optional(),
    items: z.array(z.object({ value: z.string(), label: z.string(), color: accentColor })).min(1).max(3),
  }),
  z.object({
    type: z.literal('agenda'), kicker: z.string(), title: z.string(), note: z.string().optional(),
    slots: z.array(z.object({
      time: z.string().regex(/^\d{1,2}:\d{2}$/), label: z.string(), tag: z.string().optional(), highlight: z.boolean().default(false),
    })).min(2).max(7),
  }),
  z.object({
    type: z.literal('spotlight'), kicker: z.string(), title: z.string(), text: z.string(),
    badge: z.string().optional(), points: z.array(z.string()).min(1).max(4),
  }),
  z.object({
    type: z.literal('benefits'), kicker: z.string(), title: z.string(),
    items: z.array(z.string()).min(1).max(6),
    price: z.object({ label: z.string(), value: z.string(), note: z.string().optional() }).optional(),
  }),
  z.object({
    type: z.literal('closing'), kicker: z.string(), title: z.string(), text: z.string(),
    contacts: z.array(z.object({ label: z.string(), value: z.string() })).max(3).default([]),
  }),
]);

export const collections = {
  /** Big numbers under the hero (counted up when they appear). */
  stats: defineCollection({
    loader: file('src/content/stats.json'),
    schema: z.object({ value: z.number(), suffix: z.string(), label: z.string() }),
  }),
  /** "¿Qué vas a aprender?" cards. Team: Speakers. */
  topics: defineCollection({
    loader: file('src/content/topics.json'),
    schema: z.object({ title: z.string(), text: z.string() }),
  }),
  /** Speaker fan cards. Team: Speakers. `photo` is a path under public/ or null (shows Dash). */
  speakers: defineCollection({
    loader: file('src/content/speakers.json'),
    schema: z.object({ name: z.string(), role: z.string(), place: z.string(), talk: z.string(), photo: z.string().nullable() }),
  }),
  /** Agenda slots, 9:00–15:00. `plenary` marks slots for everyone (no parallel rooms). Team: Speakers. */
  agenda: defineCollection({
    loader: file('src/content/agenda.json'),
    schema: z.object({
      time: z.string().regex(/^\d{1,2}:\d{2}$/),
      items: z.array(z.object({ title: z.string(), meta: z.string() })).min(1),
      plenary: z.boolean(),
    }),
  }),
  /** Ticket types (prices in soles). Team: Logística y Sponsors. Only one should be `featured`. */
  tickets: defineCollection({
    loader: file('src/content/tickets.json'),
    schema: z.object({
      name: z.string(), price: z.number(), note: z.string(), includes: z.array(z.string()),
      featured: z.boolean(), badge: z.string().nullable(), url: link,
    }),
  }),
  /** Social networks. Team: Comunicaciones. */
  social: defineCollection({
    loader: file('src/content/social.json'),
    schema: z.object({ short: z.string().max(3), network: z.string(), handle: z.string(), description: z.string(), url: link }),
  }),
  /** Sample posts shown as polaroids. Team: Comunicaciones. */
  posts: defineCollection({
    loader: file('src/content/posts.json'),
    schema: z.object({ kicker: z.string(), text: z.string() }),
  }),
  /** Sponsor tiers. Empty `sponsors` shows "Tu logo aquí" placeholders. Team: Logística y Sponsors. */
  sponsorTiers: defineCollection({
    loader: file('src/content/sponsorTiers.json'),
    schema: z.object({
      name: z.string(), slots: z.number().int().min(1), logoHeight: z.number(),
      sponsors: z.array(z.object({ name: z.string(), logo: z.string(), url: link })),
    }),
  }),
  /**
   * Sponsor decks, one file per sponsor (the file name is the URL slug: /decks/<slug>/).
   * `publish: false` keeps a deck out of the production build; `npm run dev` always shows it.
   * Team: Logística y Sponsors.
   */
  decks: defineCollection({
    loader: glob({ pattern: '*.json', base: './src/content/decks' }),
    schema: z.object({
      sponsor: z.object({ name: z.string(), logo: z.string().optional() }),
      title: z.string(),
      publish: z.boolean().default(false),
      slides: z.array(deckSlide).min(1),
    }),
  }),
  /** Frequently asked questions. Team: Logística y Sponsors. */
  faq: defineCollection({
    loader: file('src/content/faq.json'),
    schema: z.object({ question: z.string(), answer: z.string() }),
  }),
};
