import { useState } from 'react';
import { getAddress, isAddress, type Address } from 'viem';
import { RoleGate } from '../components/RoleGate';
import { Empty, ErrorBox, Field, Spinner, TxLink } from '../components/ui';
import { useIssuerAdmin, useIssuers } from '../hooks/useAdmin';

function AddIssuer() {
  const [addr, setAddr] = useState('');
  const [name, setName] = useState('');
  const { add } = useIssuerAdmin();
  const addrOk = isAddress(addr.trim(), { strict: false });
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate({ account: getAddress(addr.trim()), name: name.trim() }, { onSuccess: () => { setAddr(''); setName(''); } });
      }}
    >
      <h2 className="font-semibold">Approve an issuer</h2>
      <Field label="Issuer wallet address" hint={addr && !addrOk ? <span className="text-red-600">Not a valid address</span> : undefined}>
        <input className="input mono" placeholder="0x…" value={addr} onChange={(e) => setAddr(e.target.value)} />
      </Field>
      <Field label="Display name (shown on the verifier page)">
        <input className="input" placeholder="Example Institute" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <ErrorBox error={add.error} title="Add failed" />
      {add.isSuccess && <p className="text-sm text-green-700">Issuer added. Tx: <TxLink hash={add.data.hash} /></p>}
      <button className="btn" disabled={!addrOk || !name.trim() || add.isPending}>{add.isPending ? 'Confirm in wallet…' : 'Add issuer'}</button>
    </form>
  );
}

function IssuerList() {
  const q = useIssuers();
  const { remove } = useIssuerAdmin();
  const [busy, setBusy] = useState<Address | null>(null);
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Issuers</h2>
        <button className="btn-secondary py-1" onClick={() => q.refetch()} disabled={q.isFetching}>↻</button>
      </div>
      {q.isLoading && <Spinner label="Reading IssuerAdded events…" />}
      <ErrorBox error={q.error} title="Could not load the issuer list (RPC log limit?)" />
      <ErrorBox error={remove.error} title="Remove failed" />
      {q.data && q.data.length === 0 && <Empty>No issuers yet.</Empty>}
      <ul className="divide-y divide-slate-100">
        {q.data?.map((i) => (
          <li key={i.account} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-medium">{i.name} {!i.active && <span className="ml-1 rounded bg-slate-200 px-1.5 text-xs text-slate-600">removed</span>}</div>
              <div className="mono text-slate-500">{i.account}</div>
            </div>
            {i.active && (
              <button
                className="btn-danger py-1"
                disabled={remove.isPending}
                onClick={() => {
                  if (!confirm(`Remove ${i.name}? Their existing credentials stay valid, but the verifier will show "issuer no longer approved".`)) return;
                  setBusy(i.account);
                  remove.mutate(i.account, { onSettled: () => setBusy(null) });
                }}
              >
                {busy === i.account ? 'Removing…' : 'Remove'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminPage() {
  return (
    <RoleGate role="admin">
      <h1 className="mb-4 text-2xl font-semibold">Admin</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <AddIssuer />
        <IssuerList />
      </div>
    </RoleGate>
  );
}
