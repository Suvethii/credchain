import type { ReactNode } from 'react';
import { explorerTx } from '../lib/config';
import { friendlyError } from '../lib/errors';
import type { Status } from '../lib/types';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, title = 'Something went wrong' }: { error: unknown; title?: string }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <b>{title}:</b> {friendlyError(error)}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function TxLink({ hash }: { hash?: string }) {
  if (!hash) return null;
  const url = explorerTx(hash);
  return url ? (
    <a className="mono text-indigo-600 underline" href={url} target="_blank" rel="noreferrer">{hash}</a>
  ) : (
    <span className="mono">{hash}</span>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  Valid: 'bg-green-100 text-green-800 border-green-300',
  Revoked: 'bg-red-100 text-red-800 border-red-300',
  Expired: 'bg-amber-100 text-amber-800 border-amber-300',
  NotFound: 'bg-slate-100 text-slate-700 border-slate-300',
};
const STATUS_ICON: Record<Status, string> = { Valid: '✓', Revoked: '✕', Expired: '⏱', NotFound: '?' };

export function StatusBadge({ status, big }: { status: Status; big?: boolean }) {
  return (
    <span data-testid="status" className={`inline-flex items-center gap-1 rounded-full border font-semibold ${STATUS_STYLE[status]} ${big ? 'px-4 py-1.5 text-lg' : 'px-2.5 py-0.5 text-xs'}`}>
      {STATUS_ICON[status]} {status === 'NotFound' ? 'Not found' : status}
    </span>
  );
}

/** One green / red / grey line of the verifier's three checks. */
export function CheckLine({ ok, label, detail }: { ok: boolean | null; label: string; detail?: ReactNode }) {
  const style = ok === null ? 'border-slate-200 bg-slate-50 text-slate-600' : ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800';
  return (
    <div className={`flex gap-3 rounded-lg border p-3 text-sm ${style}`}>
      <span className="text-lg leading-none">{ok === null ? '○' : ok ? '✓' : '✕'}</span>
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {detail && <div className="mt-0.5 text-xs opacity-90">{detail}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
