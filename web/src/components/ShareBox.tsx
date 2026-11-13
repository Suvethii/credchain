import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

export const verifyUrl = (id: bigint | string) => `${window.location.origin}/verify/${id.toString()}`;

export function ShareBox({ tokenId }: { tokenId: bigint }) {
  const url = verifyUrl(tokenId);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this link', url);
    }
  };
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200"><QRCodeSVG value={url} size={112} /></div>
      <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
        <div className="mono rounded bg-slate-100 p-2">{url}</div>
        <div className="flex justify-center gap-2 sm:justify-start">
          <button className="btn-secondary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
          <a className="btn-secondary" href={url} target="_blank" rel="noreferrer">Open</a>
        </div>
      </div>
    </div>
  );
}
