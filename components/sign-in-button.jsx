'use client';

import { useFormStatus } from 'react-dom';

export function SignInButton({ children, className, pendingLabel }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-busy={pending}>
    {pending ? pendingLabel : children}
  </button>;
}
