/** Calendar file for "Agrégalo a tu calendario" (Apple Calendar, Outlook…), built at build time. */
import type { APIRoute } from 'astro';
import { ics } from '../lib/calendar';

export const GET: APIRoute = ({ site }) =>
  new Response(ics(new URL(import.meta.env.BASE_URL, site).href), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
