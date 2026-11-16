import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/useApi';
import { useWallet } from './useWallet';

export function useRoles() {
  const { address } = useWallet();
  const q = useQuery({
    queryKey: ['roles', address],
    enabled: !!address,
    queryFn: async () => {
      const [isAdmin, isIssuer, name] = await Promise.all([api.isAdmin(address!), api.isIssuer(address!), api.issuerName(address!)]);
      return { isAdmin, isIssuer, issuerName: name };
    },
  });
  return { ...q, isAdmin: !!q.data?.isAdmin, isIssuer: !!q.data?.isIssuer, issuerName: q.data?.issuerName ?? '' };
}
