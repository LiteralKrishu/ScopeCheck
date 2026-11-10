import { ArrowDownRight, ArrowRight, FileText, LockKeyhole, Mail } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentSession } from '../../auth.js';
import { authMethods } from '../../server/config.js';
import { Install } from '../../components/install.jsx';
import { SignInButton } from '../../components/sign-in-button.jsx';
import { emailSignIn, googleSignIn } from './actions.js';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const errors = {
  AccessDenied: 'Use a verified Gmail or Google Workspace account.',
  Configuration: 'Sign-in is temporarily unavailable. Contact your workspace administrator.',
  GoogleAccountMismatch: 'Choose a Google account with the same email address as your ScopeCheck account.',
  InvalidEmail: 'Enter a valid email address.',
  OAuthAccountNotLinked: 'This email already has a workspace. Sign in with an email link, then connect Google from your account menu.',
  RateLimited: 'Too many links were requested. Wait a few minutes and try again.',
  Verification: 'That link has expired or was already used. Request a new link.',
};

function GoogleMark() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
    <path fill="#4285f4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z" />
    <path fill="#34a853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z" />
    <path fill="#fbbc05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8z" />
    <path fill="#ea4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.3 19.3 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.3A12 12 0 0 1 24 12z" />
  </svg>;
}

export default async function SignIn({ searchParams }) {
  const { error, provider, type } = await searchParams;
  const session = await currentSession();
  if (session?.user?.id && !error) redirect('/workspace');
  const methods = authMethods();
  return <main className="signin">
    <section className="signin-story">
      <div className="brand"><img src="/mark.svg" alt="" width="36" height="36" /><span>ScopeCheck</span></div>
      <div className="story-copy">
        <h1>Put scope in writing.</h1>
        <p>Match client requests to the signed agreement. Keep the evidence, the decision, and the approval together.</p>
      </div>
      <figure className="scope-figure">
        <div className="paper agreement-paper">
          <div className="paper-header"><FileText size={18} /> Signed agreement</div>
          <p className="paper-ref">Clause C02 / Exclusion</p>
          <blockquote>“Online payments are excluded from this project.”</blockquote>
        </div>
        <ArrowDownRight className="paper-arrow" aria-hidden="true" size={45} strokeWidth={1.35} />
        <div className="paper request-paper">
          <div className="paper-header">Client request</div>
          <p>Could you add online payments?</p>
          <span className="badge out">Out of scope</span>
        </div>
        <figcaption>Example from a website project</figcaption>
      </figure>
    </section>
    <section className="signin-access" aria-labelledby="sign-in-heading">
      <div className="signin-tools"><Install /></div>
      <div className="signin-form">
        <div className="access-icon"><LockKeyhole size={22} strokeWidth={1.7} /></div>
        <h2 id="sign-in-heading">Sign in to ScopeCheck</h2>
        <p className="lede">Open your private project workspace.</p>
        {typeof error === 'string' && <p className="message error" role="alert">
          {Object.hasOwn(errors, error) ? errors[error] : 'Sign-in failed. Try again or choose another sign-in method.'}
        </p>}
        {session?.user?.id && <a href="/workspace" className="button secondary">Return to workspace <ArrowRight size={17} /></a>}
        {provider === 'resend' && type === 'email' && <p className="message success" role="status">Check your inbox. The sign-in link expires in 15 minutes and works once.</p>}
        {methods.google && <form action={googleSignIn}>
          <SignInButton className="button google-button" pendingLabel="Opening Google…"><GoogleMark /> Continue with Google <ArrowRight className="trailing" size={17} /></SignInButton>
        </form>}
        {methods.google && methods.email && <div className="signin-divider"><span>or use email</span></div>}
        {methods.email && <form action={emailSignIn} className="form-stack">
          <label>Email address<input type="email" name="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></label>
          <SignInButton className="button primary" pendingLabel="Sending link…"><Mail size={17} /> Email me a sign-in link</SignInButton>
        </form>}
        {!methods.google && !methods.email && !error && <p className="message" role="status">Sign-in is unavailable. Ask your workspace administrator to configure a sign-in method.</p>}
        <p className="signin-foot"><a href="/privacy">Privacy notice</a></p>
      </div>
    </section>
  </main>;
}
