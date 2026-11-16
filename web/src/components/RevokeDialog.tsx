import { useState } from 'react';
import { useRevoke } from '../hooks/useRevoke';
import { ErrorBox, TxLink } from './ui';

export function RevokeDialog({ tokenId, onClose }: { tokenId: bigint; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const revoke = useRevoke();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Revoke credential">
        <h3 className="text-lg font-semibold">Revoke credential #{tokenId.toString()}</h3>
        <p className="mt-1 text-sm text-slate-600">This cannot be undone. The credential stays on-chain with status Revoked and this reason.</p>
        {revoke.isSuccess ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-green-700">Revoked. Tx: <TxLink hash={revoke.data.hash} /></p>
            <button className="btn w-full" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <textarea className="input mt-4" rows={3} maxLength={200} placeholder="Reason (shown on the verifier page)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-2"><ErrorBox error={revoke.error} title="Revoke failed" /></div>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn-danger flex-1" disabled={!reason.trim() || revoke.isPending} onClick={() => revoke.mutate({ tokenId, reason })}>
                {revoke.isPending ? 'Confirm in wallet…' : 'Revoke'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
