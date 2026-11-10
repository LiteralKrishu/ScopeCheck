export const metadata = { title: 'Privacy notice' };

export default function Privacy() {
  return <main className="privacy-page">
    <a className="brand" href="/sign-in"><img src="/mark.svg" alt="" width="36" height="36" /> ScopeCheck</a>
    <h1>Privacy notice</h1>
    <p>ScopeCheck helps you review client requests against an agreement and record decisions.</p>
    <section>
      <h2>Sign-in and account data</h2>
      <p>When you sign in with Google, ScopeCheck uses your name, email address, and Google account identifier to create and protect your account. ScopeCheck requests basic profile information.</p>
      <p>The app keeps your session on the server and uses an HTTP-only cookie to identify it. Sign out to end the session.</p>
    </section>
    <section>
      <h2>Projects and files</h2>
      <p>ScopeCheck stores your project records, agreement text, requests, decisions, and written approvals in Redis. The app extracts text from PDF files in your browser and saves the extracted text when you save an agreement.</p>
      <p>Use <strong>Data and examples</strong> to download a project backup or delete a project from your workspace. A downloaded backup contains readable project data.</p>
    </section>
    <section>
      <h2>Service providers</h2>
      <p>Replit hosts this deployment at scope-check.replit.app. Upstash provides its Redis database. If AI checks are available and you opt in for a request, ScopeCheck sends that request and its reviewed agreement clauses to OpenAI for assessment.</p>
    </section>
    <section>
      <h2>Contact</h2>
      <p>For privacy questions or help with your account data, email <a href="mailto:sousnigdhodas@gmail.com">sousnigdhodas@gmail.com</a>.</p>
    </section>
  </main>;
}
