/**
 * Staff / internal tooling gates.
 * Regular users never see Staff Access, Testing, or Development sections.
 * Access is limited to: DB is_admin, role=admin, @dripn.* emails, allowlisted owners,
 * and optional EXPO_PUBLIC_STAFF_EMAILS (comma-separated).
 */

const BUILTIN_STAFF_EMAILS = new Set([
  'sheni_sampson@yahoo.co.uk',
]);

function envStaffEmails(): Set<string> {
  const raw = process.env.EXPO_PUBLIC_STAFF_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export type StaffUserLike = {
  email?: string | null;
  isAdmin?: boolean | null;
  role?: string | null;
} | null | undefined;

export function isStaffUser(user: StaffUserLike): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  if (String(user.role || '').toLowerCase() === 'admin') return true;

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return false;
  if (email.endsWith('@dripn.io') || email.endsWith('@dripn.dev')) return true;
  if (BUILTIN_STAFF_EMAILS.has(email)) return true;
  if (envStaffEmails().has(email)) return true;
  return false;
}
