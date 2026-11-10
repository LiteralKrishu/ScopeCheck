import { z } from 'zod';

const emailSchema = z.email().max(254);

export function normalizedEmail(value) {
  const result = emailSchema.safeParse(typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : null);
  if (!result.success) throw new Error('Enter a valid email address.');
  return result.data;
}
