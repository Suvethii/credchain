import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/useApi';

export function useRevoke() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tokenId, reason }: { tokenId: bigint; reason: string }) => {
      if (!reason.trim()) throw new Error('A reason is required');
      return api.revoke(tokenId, reason.trim());
    },
    onSettled: () => qc.invalidateQueries(),
  });
}
