import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/useApi';

/** tokenId as string from the URL. Invalid → error, missing → NotFound status from the contract. */
export function parseTokenId(id?: string): bigint | null {
  if (!id || !/^\d{1,78}$/.test(id)) return null;
  return BigInt(id);
}

export function useVerify(id?: string) {
  const tokenId = parseTokenId(id);
  return useQuery({
    queryKey: ['verify', id],
    enabled: tokenId !== null,
    queryFn: () => api.verify(tokenId!),
    refetchOnWindowFocus: true, // revoke → verifier updates on the next focus/refresh
  });
}
