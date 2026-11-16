import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/useApi';
import { useWallet } from './useWallet';

export function useMyCredentials() {
  const { address } = useWallet();
  return useQuery({
    queryKey: ['mine', address],
    enabled: !!address,
    queryFn: async () => {
      const ids = await api.tokensOf(address!);
      return Promise.all([...ids].reverse().map((id) => api.verify(id))); // newest first
    },
  });
}
