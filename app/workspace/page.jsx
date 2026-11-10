import { redirect } from 'next/navigation';
import { currentSession } from '../../auth.js';
import { Workspace } from '../../components/workspace.jsx';
import { authMethods } from '../../server/config.js';
import { getProject, listProjects, ProjectError } from '../../server/projects.js';
import { googleSignIn, leaveWorkspace } from '../sign-in/actions.js';

export const metadata = { title: 'Workspace' };
export const dynamic = 'force-dynamic';

export default async function WorkspacePage({ searchParams }) {
  const session = await currentSession();
  if (!session?.user?.id) redirect('/sign-in');
  const userId = session.user.id;
  const { project: selection } = await searchParams;
  const projects = await listProjects(userId);
  const selected = projects.find(project => project.id === selection) ?? projects[0];
  let snapshot = null;
  if (selected) {
    try {
      snapshot = await getProject(userId, selected.id);
    } catch (error) {
      if (!(error instanceof ProjectError) || error.status !== 404) throw error;
    }
  }
  return <Workspace projects={projects} snapshot={snapshot} ai={Boolean(process.env.OPENAI_API_KEY?.trim())} account={
    <details className="account">
      <summary aria-label="Account"><span className="avatar">{(session.user.name || session.user.email)[0].toUpperCase()}</span><span>Account</span></summary>
      <div className="account-menu">
        {session.user.name && <strong>{session.user.name}</strong>}
        <p>{session.user.email}</p>
        {authMethods().google && <form action={googleSignIn}><button className="button quiet" type="submit">Connect Google</button></form>}
        <form action={leaveWorkspace}><button className="button quiet" type="submit">Sign out</button></form>
      </div>
    </details>
  } />;
}
