import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { api } from '../lib/useApi';

export function useIssuers() {
  return useQuery({ queryKey: ['issuers'], queryFn: () => api.listIssuers() });
}

export function useIssuedBy(issuer?: Address) {
  return useQuery({ queryKey: ['issuedBy', issuer], enabled: !!issuer, queryFn: () => api.issuedBy(issuer!) });
}

export function useIssuerAdmin() {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: ({ account, name }: { account: Address; name: string }) => api.addIssuer(account, name),
    onSettled: () => qc.invalidateQueries(),
  });
  const remove = useMutation({
    mutationFn: (account: Address) => api.removeIssuer(account),
    onSettled: () => qc.invalidateQueries(),
  });
  return { add, remove };
}
