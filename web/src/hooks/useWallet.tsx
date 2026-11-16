import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Address } from 'viem';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { targetChain, useMock } from '../lib/config';
import { MOCK_ACCOUNTS, setMockAccount } from '../mock/mockApi';

interface WalletState {
  address?: Address;
  isConnected: boolean;
  wrongNetwork: boolean;
  switchNetwork: () => void;
  isMock: boolean;
  setMock?: (a: Address) => void;
}

const MockCtx = createContext<{ a: Address; set: (a: Address) => void } | null>(null);

export function MockWalletProvider({ children }: { children: ReactNode }) {
  const [a, setA] = useState<Address>(MOCK_ACCOUNTS.admin);
  const set = (x: Address) => {
    setMockAccount(x);
    setA(x);
  };
  return <MockCtx.Provider value={{ a, set }}>{children}</MockCtx.Provider>;
}

/** One wallet hook for the whole app: real wagmi account, or the mock account switcher. */
export function useWallet(): WalletState {
  const mock = useContext(MockCtx);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { chain } = useAccount();
  if (useMock && mock) return { address: mock.a, isConnected: true, wrongNetwork: false, switchNetwork: () => {}, isMock: true, setMock: mock.set };
  const onChain = chain?.id ?? chainId;
  return {
    address,
    isConnected,
    wrongNetwork: isConnected && onChain !== targetChain.id,
    switchNetwork: () => switchChain({ chainId: targetChain.id }),
    isMock: false,
  };
}
