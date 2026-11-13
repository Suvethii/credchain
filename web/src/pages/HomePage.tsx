import { Link } from 'react-router-dom';
import { useRoles } from '../hooks/useRoles';

export function HomePage() {
  const r = useRoles();
  const steps = [
    ['1', 'Admin approves an issuer', 'University or training company wallet'],
    ['2', 'Issuer uploads PDF', 'Hashed in the browser, pinned to IPFS'],
    ['3', 'Soulbound token minted', 'To the student wallet, cannot be transferred'],
    ['4', 'Anyone verifies', 'Status, issuer, and PDF hash check'],
  ];
  return (
    <div className="space-y-8">
      <section className="py-6 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Tamper-proof credentials</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">Certificates as soulbound tokens. Verify one in seconds, without contacting the institution.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="btn" to="/verify">Verify a credential</Link>
          <Link className="btn-secondary" to="/me">My credentials</Link>
          {r.isIssuer && <Link className="btn-secondary" to="/issuer">Issue</Link>}
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-4">
        {steps.map(([n, t, d]) => (
          <div key={n} className="card">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{n}</div>
            <div className="mt-2 font-medium">{t}</div>
            <div className="text-sm text-slate-500">{d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
