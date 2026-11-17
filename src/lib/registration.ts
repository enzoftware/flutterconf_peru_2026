/**
 * Sign-up validation shared by the form (src/components/launch/Register.astro) and the tests.
 * integrations/google-sheets/Code.gs mirrors these rules on the server. Code.test.mjs runs the
 * same cases against both, so a change here that is not copied there fails `npm test`.
 */

export const ROLES = ['estudiante', 'dev-flutter', 'dev-otro', 'diseno-producto', 'lider-empresa', 'otro'] as const;
export type Role = (typeof ROLES)[number];

export const LIMITS = { name: 80, email: 120, city: 60 } as const;
/** Submissions faster than this after the page loads are bots (people need to scroll and type). */
export const MIN_FILL_MS = 2500;

/** Throwaway inbox providers: sign-ups from them can't be reached later, and they are a spam signal. */
export const DISPOSABLE_DOMAINS = [
  '10minutemail.com', 'burnermail.io', 'dispostable.com', 'emailondeck.com', 'fakeinbox.com', 'getnada.com',
  'guerrillamail.com', 'guerrillamail.net', 'mailinator.com', 'maildrop.cc', 'mintemail.com', 'mohmal.com',
  'sharklasers.com', 'temp-mail.org', 'tempail.com', 'tempmail.com', 'tempmail.net', 'throwawaymail.com',
  'trashmail.com', 'yopmail.com',
];

export type ErrorCode = 'name' | 'email' | 'email_disposable' | 'role' | 'city' | 'consent';
export interface SignupInput { name?: unknown; email?: unknown; role?: unknown; city?: unknown; consent?: unknown }
export interface Signup { name: string; email: string; emailKey: string; role: Role; city: string }

// Letters (any language), combining accents, spaces, apostrophes, dots and hyphens: "María José", "O'Brien", "Jr."
const NAME_RE = /^\p{L}[\p{L}\p{M}' .-]*$/u;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const LINK_RE = /https?:|www\.|\.(com|net|org|io|xyz|ru)\b|[<>]/i;

const str = (v: unknown, max: number): string =>
  String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max + 1);

/** One key per inbox: lowercase, without "+tag", and Gmail ignores dots (ana.q+pe@gmail.com = anaq@gmail.com). */
export function emailKey(email: string): string {
  const [local = '', domain = ''] = email.trim().toLowerCase().split('@');
  let l = local.split('+')[0];
  let d = domain;
  if (d === 'googlemail.com') d = 'gmail.com';
  if (d === 'gmail.com') l = l.replace(/\./g, '');
  return `${l}@${d}`;
}

export function isDisposable(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return DISPOSABLE_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
}

export function validate(input: SignupInput): { ok: true; data: Signup } | { ok: false; error: ErrorCode } {
  const name = str(input.name, LIMITS.name);
  const email = str(input.email, LIMITS.email).toLowerCase();
  const role = str(input.role, 32);
  const city = str(input.city, LIMITS.city);

  if (name.length < 2 || name.length > LIMITS.name || !NAME_RE.test(name) || LINK_RE.test(name)) return { ok: false, error: 'name' };
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) return { ok: false, error: 'email' };
  if (isDisposable(email)) return { ok: false, error: 'email_disposable' };
  if (!(ROLES as readonly string[]).includes(role)) return { ok: false, error: 'role' };
  if (city && (city.length > LIMITS.city || !NAME_RE.test(city) || LINK_RE.test(city))) return { ok: false, error: 'city' };
  if (input.consent !== true) return { ok: false, error: 'consent' };
  return { ok: true, data: { name, email, emailKey: emailKey(email), role: role as Role, city } };
}
