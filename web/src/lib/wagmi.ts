import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { rpcUrl, targetChain, wcProjectId } from './config';

export const wagmiConfig = getDefaultConfig({
  appName: 'CredChain',
  projectId: wcProjectId,
  chains: [targetChain],
  transports: { [targetChain.id]: http(rpcUrl) } as Record<number, ReturnType<typeof http>>,
});
