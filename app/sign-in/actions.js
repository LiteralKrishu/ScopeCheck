'use server';

import { redirect } from 'next/navigation';
import { signIn, signOut } from '../../auth.js';
import { appOrigin, authMethods } from '../../server/config.js';
import { normalizedEmail } from '../../server/email.js';

export async function googleSignIn() {
  appOrigin();
  if (!authMethods().google) redirect('/sign-in?error=Configuration');
  await signIn('google', { redirectTo: '/workspace' });
}

export async function emailSignIn(formData) {
  appOrigin();
  if (!authMethods().email) redirect('/sign-in?error=Configuration');
  let email;
  try {
    email = normalizedEmail(formData.get('email'));
  } catch {
    redirect('/sign-in?error=InvalidEmail');
  }
  await signIn('resend', { email, redirectTo: '/workspace' });
}

export async function leaveWorkspace() {
  appOrigin();
  await signOut({ redirectTo: '/sign-in' });
}
