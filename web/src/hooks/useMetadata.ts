import { useQuery } from '@tanstack/react-query';
import { fetchIpfs, ipfsPath } from '../lib/ipfs';
import { fromWire } from '../lib/metadata';
import { mockJson } from '../lib/pin';
import type { CredentialMetadata } from '../lib/types';
import { SEED_METADATA } from '../mock/seedMetadata';

/** tokenURI → metadata JSON, with gateway fallback. Cached forever (IPFS content never changes). */
export function useMetadata(uri?: string) {
  return useQuery({
    queryKey: ['metadata', uri],
    enabled: !!uri,
    staleTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<CredentialMetadata> => {
      let json: unknown;
      if (uri!.startsWith('mock://')) json = SEED_METADATA[uri!];
      else {
        const cid = ipfsPath(uri!);
        const local = cid && cid.startsWith('bafkmock') ? mockJson(cid) : null;
        json = local ? JSON.parse(local) : await (await fetchIpfs(uri!)).json();
      }
      const meta = fromWire(json);
      if (!meta) throw new Error('Metadata JSON does not match the CredChain schema');
      return meta;
    },
  });
}
