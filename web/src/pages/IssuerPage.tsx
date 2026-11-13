import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getAddress, isAddress, type Hex } from 'viem';
import { RevokeDialog } from '../components/RevokeDialog';
import { RoleGate } from '../components/RoleGate';
import { ShareBox } from '../components/ShareBox';
import { Empty, ErrorBox, Field, Spinner, StatusBadge, TxLink } from '../components/ui';
import { useIssuedBy } from '../hooks/useAdmin';
import { useBatchIssue, useIssue, type IssueStep } from '../hooks/useIssue';
import { useRoles } from '../hooks/useRoles';
import { useVerify } from '../hooks/useVerify';
import { useWallet } from '../hooks/useWallet';
import { MAX_BATCH } from '../lib/config';
import { CSV_TEMPLATE, parseRecipientsCsv, type CsvResult } from '../lib/csv';
import { sha256File } from '../lib/hash';
import { checkPdf } from '../lib/pin';
import { dateToExpiry, expiryError, shortAddr, todayIso } from '../lib/time';

interface Template {
  name: string;
  description: string;
  course: string;
  issuedDate: string;
  expiry: string;
}
const emptyTemplate = (): Template => ({ name: 'Certificate of Completion', description: '', course: '', issuedDate: todayIso(), expiry: '' });

function TemplateFields({ t, set }: { t: Template; set: (t: Template) => void }) {
  const exp = (() => { try { return expiryError(dateToExpiry(t.expiry)); } catch { return 'Bad date'; } })();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Credential title"><input className="input" value={t.name} onChange={(e) => set({ ...t, name: e.target.value })} /></Field>
      <Field label="Course / programme"><input className="input" value={t.course} onChange={(e) => set({ ...t, course: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Field label="Description"><input className="input" value={t.description} onChange={(e) => set({ ...t, description: e.target.value })} /></Field></div>
      <Field label="Issued date"><input type="date" className="input" value={t.issuedDate} onChange={(e) => set({ ...t, issuedDate: e.target.value })} /></Field>
      <Field label="Expires (optional)" hint={exp ? <span className="text-red-600">{exp}</span> : 'Empty = never expires'}>
        <input type="date" className="input" min={todayIso()} value={t.expiry} onChange={(e) => set({ ...t, expiry: e.target.value })} />
      </Field>
    </div>
  );
}

const STEP_LABEL: Record<IssueStep, string> = {
  idle: '', hashing: '1/4 Hashing PDF…', 'pinning-pdf': '2/4 Pinning PDF to IPFS…', 'pinning-json': '3/4 Pinning metadata…', tx: '4/4 Confirm in wallet, then wait for the block…', done: 'Done',
};

function SingleIssue() {
  const roles = useRoles();
  const [to, setTo] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [grade, setGrade] = useState('');
  const [t, setT] = useState<Template>(emptyTemplate);
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfHash, setPdfHash] = useState<Hex | null>(null);
  const [pdfErr, setPdfErr] = useState<string | null>(null);
  const [step, setStep] = useState<IssueStep>('idle');
  const issue = useIssue(setStep);

  const pick = async (f?: File | null) => {
    setPdf(null); setPdfHash(null); setPdfErr(null);
    if (!f) return;
    const err = checkPdf(f);
    if (err) return setPdfErr(err);
    setPdf(f);
    setPdfHash(await sha256File(f));
  };

  let expiresAt = 0n;
  let expErr: string | null = null;
  try { expiresAt = dateToExpiry(t.expiry); expErr = expiryError(expiresAt); } catch { expErr = 'Bad date'; }
  const toOk = isAddress(to.trim(), { strict: false });
  const ready = toOk && recipientName.trim() && t.name.trim() && t.course.trim() && t.issuedDate && pdf && !expErr && !issue.isPending;

  if (issue.isSuccess) {
    const id = issue.data.tokenIds[0];
    return (
      <div className="card space-y-3" data-testid="issued">
        <h2 className="text-lg font-semibold text-green-700">Credential issued{id !== undefined ? ` — token #${id}` : ''}</h2>
        <p className="text-sm">Tx: <TxLink hash={issue.data.hash} /></p>
        <p className="mono text-slate-600">docHash {issue.data.docHash}</p>
        {id !== undefined && <ShareBox tokenId={id} />}
        <div className="flex gap-2">
          {id !== undefined && <Link className="btn" to={`/verify/${id}`}>Open verifier</Link>}
          <button className="btn-secondary" onClick={() => { issue.reset(); setStep('idle'); setTo(''); setRecipientName(''); setGrade(''); setPdf(null); setPdfHash(null); }}>Issue another</button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || !pdf) return;
        issue.mutate({
          to: getAddress(to.trim()),
          pdf,
          expiresAt,
          meta: { name: t.name, description: t.description, recipientName, course: t.course, grade, issuerName: roles.issuerName, issuedDate: t.issuedDate, expiryDate: t.expiry || undefined },
        });
      }}
    >
      <h2 className="font-semibold">Issue one credential</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Recipient wallet address" hint={to && !toOk ? <span className="text-red-600">Not a valid address</span> : undefined}>
            <input className="input mono" placeholder="0x…" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="Recipient name"><input className="input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></Field>
        <Field label="Grade (optional)"><input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} /></Field>
      </div>
      <TemplateFields t={t} set={setT} />
      <Field label="Certificate PDF (max 5 MB)" hint={pdfErr ? <span className="text-red-600">{pdfErr}</span> : undefined}>
        <input type="file" accept="application/pdf,.pdf" className="input" data-testid="issue-pdf" onChange={(e) => pick(e.target.files?.[0])} />
      </Field>
      {pdfHash && <div className="rounded bg-slate-100 p-2 text-xs"><b>SHA-256 preview:</b> <span className="mono" data-testid="sha-preview">{pdfHash}</span></div>}
      <ErrorBox error={issue.error} title={`Issue failed at "${STEP_LABEL[step] || 'start'}"`} />
      {issue.isPending && <Spinner label={STEP_LABEL[step]} />}
      <button className="btn w-full sm:w-auto" disabled={!ready}>{issue.isPending ? 'Issuing…' : 'Issue credential'}</button>
    </form>
  );
}

function BatchIssue() {
  const roles = useRoles();
  const [t, setT] = useState<Template>(emptyTemplate);
  const [csv, setCsv] = useState<CsvResult | null>(null);
  const [progress, setProgress] = useState({ pinned: 0, total: 0, stage: '' });
  const batch = useBatchIssue((pinned, total, stage) => setProgress({ pinned, total, stage }));

  let expiresAt = 0n;
  let expErr: string | null = null;
  try { expiresAt = dateToExpiry(t.expiry); expErr = expiryError(expiresAt); } catch { expErr = 'Bad date'; }

  const load = async (f?: File | null) => { if (f) setCsv(parseRecipientsCsv(await f.text())); };
  const canIssue = csv && csv.fileErrors.length === 0 && csv.valid.length > 0 && csv.valid.length === csv.rows.length && t.name.trim() && t.course.trim() && !expErr && !batch.isPending;

  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
    a.download = 'credchain-recipients.csv';
    a.click();
  };

  if (batch.isSuccess)
    return (
      <div className="card space-y-3" data-testid="batch-done">
        <h2 className="text-lg font-semibold text-green-700">{batch.data.tokenIds.length} credentials issued</h2>
        <p className="text-sm">Tx: <TxLink hash={batch.data.hash} /></p>
        <div className="flex flex-wrap gap-2">
          {batch.data.tokenIds.map((id) => <Link key={id.toString()} className="rounded bg-slate-100 px-2 py-1 text-xs text-indigo-700" to={`/verify/${id}`}>#{id.toString()}</Link>)}
        </div>
        <button className="btn-secondary" onClick={() => { batch.reset(); setCsv(null); }}>New batch</button>
      </div>
    );

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Batch issue from CSV (max {MAX_BATCH})</h2>
        <button className="btn-secondary py-1" onClick={downloadTemplate}>Download CSV template</button>
      </div>
      <p className="text-xs text-slate-500">Columns: <code>address, recipientName, grade</code>. Shared fields below apply to every row. No PDF per row: each docHash = SHA-256 of that row's metadata JSON.</p>
      <TemplateFields t={t} set={setT} />
      <Field label="Recipients CSV"><input type="file" accept=".csv,text/csv" className="input" data-testid="csv-input" onChange={(e) => load(e.target.files?.[0])} /></Field>
      {csv && (
        <div className="space-y-2">
          {csv.fileErrors.map((e) => <div key={e} className="rounded bg-red-50 p-2 text-sm text-red-800">{e}</div>)}
          <p className="text-sm"><b>{csv.valid.length}</b> valid / {csv.rows.length} rows{csv.valid.length < csv.rows.length && <span className="text-red-700"> — fix the red rows and re-upload</span>}</p>
          <div className="max-h-72 overflow-auto rounded border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Line</th><th className="p-2">Address</th><th className="p-2">Name</th><th className="p-2">Grade</th><th className="p-2">Problem</th></tr></thead>
              <tbody>
                {csv.rows.map((r) => (
                  <tr key={r.line} className={r.errors.length ? 'bg-red-50' : ''}>
                    <td className="p-2">{r.line}</td>
                    <td className="mono p-2">{r.address ? shortAddr(r.address) : '—'}</td>
                    <td className="p-2">{r.recipientName}</td>
                    <td className="p-2">{r.grade}</td>
                    <td className="p-2 text-red-700">{r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ErrorBox error={batch.error} title="Batch failed (nothing was minted if the tx reverted)" />
      {batch.isPending && <Spinner label={progress.stage === 'pin' ? `Pinning metadata ${progress.pinned}/${progress.total}…` : 'Confirm in wallet, then wait for the block…'} />}
      <button
        className="btn"
        disabled={!canIssue}
        onClick={() =>
          csv &&
          batch.mutate({
            expiresAt,
            items: csv.valid.map((r) => ({
              to: r.address!,
              meta: { name: t.name, description: t.description, recipientName: r.recipientName, course: t.course, grade: r.grade, issuerName: roles.issuerName, issuedDate: t.issuedDate, expiryDate: t.expiry || undefined, documentUri: '', documentSha256: '' as Hex },
            })),
          })
        }
      >
        Issue {csv?.valid.length ?? 0} credentials in one transaction
      </button>
    </div>
  );
}

function IssuedRow({ id, to, onRevoke }: { id: bigint; to: string; onRevoke: () => void }) {
  const v = useVerify(id.toString());
  return (
    <tr className="border-t border-slate-100">
      <td className="p-2"><Link className="text-indigo-700 underline" to={`/verify/${id}`}>#{id.toString()}</Link></td>
      <td className="mono p-2">{shortAddr(to)}</td>
      <td className="p-2">{v.data ? <StatusBadge status={v.data.status} /> : '…'}</td>
      <td className="p-2 text-right">{v.data?.status !== 'Revoked' && <button className="btn-danger px-2 py-1 text-xs" onClick={onRevoke}>Revoke</button>}</td>
    </tr>
  );
}

function Issued() {
  const w = useWallet();
  const q = useIssuedBy(w.address);
  const [revoking, setRevoking] = useState<bigint | null>(null);
  const [manual, setManual] = useState('');
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Issued by this wallet</h2>
        <button className="btn-secondary py-1" onClick={() => q.refetch()}>↻</button>
      </div>
      {q.isLoading && <Spinner label="Scanning CredentialIssued events…" />}
      <ErrorBox error={q.error} title="Could not list issued credentials (use the token ID box below)" />
      {q.data?.length === 0 && <Empty>Nothing issued yet.</Empty>}
      {!!q.data?.length && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs text-slate-500"><th className="p-2">Token</th><th className="p-2">Holder</th><th className="p-2">Status</th><th /></tr></thead>
            <tbody>{[...q.data].reverse().map((i) => <IssuedRow key={i.tokenId.toString()} id={i.tokenId} to={i.to} onRevoke={() => setRevoking(i.tokenId)} />)}</tbody>
          </table>
        </div>
      )}
      <form className="flex gap-2 border-t border-slate-100 pt-3" onSubmit={(e) => { e.preventDefault(); if (/^\d+$/.test(manual)) setRevoking(BigInt(manual)); }}>
        <input className="input" inputMode="numeric" placeholder="Revoke by token ID" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn-danger" disabled={!/^\d+$/.test(manual)}>Revoke…</button>
      </form>
      {revoking !== null && <RevokeDialog tokenId={revoking} onClose={() => setRevoking(null)} />}
    </div>
  );
}

export function IssuerPage() {
  const [tab, setTab] = useState<'single' | 'batch' | 'issued'>('single');
  const roles = useRoles();
  const tabBtn = (k: typeof tab, label: string) => (
    <button className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-white shadow text-indigo-700' : 'text-slate-600'}`} onClick={() => setTab(k)}>{label}</button>
  );
  return (
    <RoleGate role="issuer">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Issuer: {roles.issuerName}</h1>
        <div className="flex rounded-lg bg-slate-100 p-1">{tabBtn('single', 'Issue')}{tabBtn('batch', 'Batch CSV')}{tabBtn('issued', 'Issued / Revoke')}</div>
      </div>
      {tab === 'single' && <SingleIssue />}
      {tab === 'batch' && <BatchIssue />}
      {tab === 'issued' && <Issued />}
    </RoleGate>
  );
}
