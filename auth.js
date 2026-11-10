import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { digest, redisAuth } from './server/auth-adapter.js';
import { appOrigin, authMethods } from './server/config.js';
import { normalizedEmail } from './server/email.js';
import { incrementWindow } from './server/redis.js';

const methods = authMethods();
const providers = [];

if (methods.google) {
  providers.push(Google({ checks: ['pkce', 'state', 'nonce'] }));
}

if (methods.email) {
  providers.push(Resend({
    from: process.env.AUTH_EMAIL_FROM,
    maxAge: 15 * 60,
    normalizeIdentifier: normalizedEmail,
    async sendVerificationRequest({ identifier, provider, url }) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: provider.from,
          to: identifier,
          subject: 'Sign in to ScopeCheck',
          text: `Open this link to sign in to ScopeCheck. It expires in 15 minutes.\n\n${url}`,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Email provider could not deliver the sign-in link.');
    },
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: redisAuth,
  providers,
  session: { strategy: 'database', maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: { signIn: '/sign-in', error: '/sign-in', verifyRequest: '/sign-in' },
  logger: { error: error => console.error('Authentication error', error.type ?? error.name) },
  callbacks: {
    async signIn({ account, profile, user, email }) {
      if (account?.provider === 'google') {
        // Google is authoritative for Gmail and Workspace mailboxes.
        if (profile?.email_verified !== true || typeof profile.email !== 'string'
          || !(profile.email.toLowerCase().endsWith('@gmail.com') || profile.hd)) return false;
        const session = await currentSession();
        if (session?.user && session.user.email !== profile.email.toLowerCase()) {
          return '/sign-in?error=GoogleAccountMismatch';
        }
      }
      if (email?.verificationRequest) {
        const perAddress = await incrementWindow(`email:${digest(user.email.toLowerCase())}`, 15 * 60);
        if (perAddress > 3) return '/sign-in?error=RateLimited';
        if (await incrementWindow('email:total', 60 * 60) > 60) return '/sign-in?error=RateLimited';
      }
      return true;
    },
    redirect({ url }) {
      const origin = appOrigin();
      const target = new URL(url, origin);
      return target.origin === origin ? target.href : origin;
    },
    session({ session, user }) {
      return { expires: session.expires, user: { id: user.id, name: user.name, email: user.email } };
    },
  },
});

export async function currentSession() {
  if (!methods.google && !methods.email) return null;
  appOrigin();
  return auth();
}
