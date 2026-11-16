import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { sha256File, sha256Hex } from '../lib/hash';
import { buildMetadata, serializeMetadata, validateMetadata } from '../lib/metadata';
import { pinJson, pinPdf } from '../lib/pin';
import type { CredentialMetadata } from '../lib/types';
import { api } from '../lib/useApi';

export type IssueStep = 'idle' | 'hashing' | 'pinning-pdf' | 'pinning-json' | 'tx' | 'done';

export interface SingleIssue {
  to: Address;
  pdf: File;
  expiresAt: bigint;
  meta: Omit<CredentialMetadata, 'documentUri' | 'documentSha256'>;
}

/** Single issue: hash PDF → pin PDF → build + pin metadata → issue(to, ipfs://json, pdfHash, expiresAt). */
export function useIssue(onStep: (s: IssueStep) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: SingleIssue) => {
      onStep('hashing');
      const docHash = await sha256File(i.pdf);
      onStep('pinning-pdf');
      const pdfCid = await pinPdf(i.pdf);
      const meta = buildMetadata({ ...i.meta, documentUri: `ipfs://${pdfCid}`, documentSha256: docHash });
      const errs = validateMetadata(meta);
      if (errs.length) throw new Error(errs.join(', '));
      onStep('pinning-json');
      const jsonCid = await pinJson(serializeMetadata(meta));
      onStep('tx');
      const r = await api.issue({ to: i.to, uri: `ipfs://${jsonCid}`, docHash, expiresAt: i.expiresAt });
      onStep('done');
      return { ...r, docHash, pdfCid, jsonCid };
    },
    onSettled: () => qc.invalidateQueries(),
  });
}

export interface BatchItem {
  to: Address;
  meta: CredentialMetadata; // documentUri '' / shared, documentSha256 '' → filled per recipient
}

/** Pin with a small concurrency limit so 50 JSONs don't hit the function all at once. */
async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>, onDone: (k: number) => void) {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const k = next++;
        out[k] = await fn(items[k], k);
        onDone(++done);
      }
    }),
  );
  return out;
}

/** Batch: per recipient metadata JSON → docHash = SHA-256 of THAT JSON (plan Day 3) → one batchIssue tx. */
export function useBatchIssue(onProgress: (pinned: number, total: number, stage: 'pin' | 'tx' | 'done') => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ items, expiresAt }: { items: BatchItem[]; expiresAt: bigint }) => {
      const prepared = items.map((it) => {
        const json = serializeMetadata(buildMetadata(it.meta));
        return { to: it.to, json };
      });
      const hashes = await Promise.all(prepared.map((p) => sha256Hex(new TextEncoder().encode(p.json))));
      onProgress(0, items.length, 'pin');
      const cids = await pool(prepared, 4, (p) => pinJson(p.json), (k) => onProgress(k, items.length, 'pin'));
      onProgress(items.length, items.length, 'tx');
      const r = await api.batchIssue(prepared.map((p) => p.to), cids.map((c) => `ipfs://${c}`), hashes, expiresAt);
      onProgress(items.length, items.length, 'done');
      return { ...r, jsons: prepared.map((p) => p.json) };
    },
    onSettled: () => qc.invalidateQueries(),
  });
}
