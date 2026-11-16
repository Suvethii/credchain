import { useState } from 'react';
import { CredentialCard } from '../components/CredentialCard';
import { ShareBox } from '../components/ShareBox';
import { Empty, ErrorBox, Spinner } from '../components/ui';
import { useMyCredentials } from '../hooks/useMyCredentials';
import { useWallet } from '../hooks/useWallet';
import { api } from '../lib/useApi';
import { friendlyError } from '../lib/errors';

export function MyCredentialsPage() {
  const w = useWallet();
  const q = useMyCredentials();
  const [share, setShare] = useState<bigint | null>(null);
  const [transferMsg, setTransferMsg] = useState<Record<string, string>>({});

  if (!w.isConnected) return <div className="card text-center text-sm">Connect your wallet to see your credentials.</div>;
  if (w.wrongNetwork) return <div className="card text-center text-sm">Switch to the right network first (banner above).</div>;

  const tryTransfer = async (id: bigint) => {
    try {
      await api.tryTransfer(w.address!, '0x000000000000000000000000000000000000dEaD', id);
      setTransferMsg((m) => ({ ...m, [id.toString()]: 'Unexpected: transfer succeeded!' }));
    } catch (e) {
      setTransferMsg((m) => ({ ...m, [id.toString()]: friendlyError(e) }));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My credentials</h1>
      {q.isLoading && <Spinner />}
      <ErrorBox error={q.error} title="Could not load your credentials" />
      {q.data?.length === 0 && <Empty>No credentials for this wallet yet. When an institution issues one to you, it appears here.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {q.data?.map((v) => (
          <div key={v.tokenId.toString()} className="space-y-2">
            <CredentialCard v={v}>
              <button className="btn-secondary" onClick={() => setShare(share === v.tokenId ? null : v.tokenId)}>Share / QR</button>
              <button className="btn-secondary" title="Demo: soulbound tokens cannot move" onClick={() => tryTransfer(v.tokenId)}>Try transfer</button>
            </CredentialCard>
            {transferMsg[v.tokenId.toString()] && <p className="rounded bg-slate-100 p-2 text-xs" data-testid="transfer-msg">{transferMsg[v.tokenId.toString()]}</p>}
            {share === v.tokenId && <div className="card"><ShareBox tokenId={v.tokenId} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
