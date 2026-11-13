import '@rainbow-me/rainbowkit/styles.css';
import './index.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import App from './App';
import { MockWalletProvider } from './hooks/useWallet';
import { wagmiConfig } from './lib/wagmi';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 10_000 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <MockWalletProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </MockWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
