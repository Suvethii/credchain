import { useMutation } from '@tanstack/react-query';
import { pinJson, pinPdf } from '../lib/pin';

export function usePin() {
  const pdf = useMutation({ mutationFn: (f: File) => pinPdf(f) });
  const json = useMutation({ mutationFn: (s: string) => pinJson(s) });
  return { pinPdf: pdf.mutateAsync, pinJson: json.mutateAsync, isPending: pdf.isPending || json.isPending };
}
