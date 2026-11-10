'use client';

export default function WorkspaceError({ reset }) {
  return <main className="workspace-error">
    <img src="/mark.svg" width="42" height="42" alt="" />
    <h1>Your workspace is unavailable.</h1>
    <p>Check your connection and try again.</p>
    <button className="button primary" type="button" onClick={reset}>Try again</button>
  </main>;
}
