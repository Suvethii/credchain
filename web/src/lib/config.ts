import type { Abi, Address } from 'viem';
import { sepolia, baseSepolia, hardhat } from 'wagmi/chains';
import deployment from '../abi/CredChain.json';

const env = import.meta.env;

const chains = { sepolia, baseSepolia, local: hardhat } as const;
type ChainKey = keyof typeof chains;

const chainKey = ((env.VITE_CHAIN as string) || 'sepolia') as ChainKey;
export const targetChain = chains[chainKey] ?? sepolia;

const ZERO = '0x0000000000000000000000000000000000000000';

// Env wins over the JSON file, so a redeploy only needs a Vercel env change.
export const contractAddress = ((env.VITE_CONTRACT_ADDRESS as string) || deployment.address) as Address;
export const deployBlock = BigInt((env.VITE_DEPLOY_BLOCK as string) || deployment.deployBlock || 0);
export const abi = deployment.abi as Abi;
export const rpcUrl = (env.VITE_RPC_URL as string) || undefined;
export const wcProjectId = (env.VITE_WC_PROJECT_ID as string) || 'credchain-dev-placeholder';
export const pinUrl = (env.VITE_PIN_URL as string) || '/api/pin';

/** Mock mode: no contract address set, or explicitly asked for. */
export const useMock = env.VITE_USE_MOCK === 'true' || contractAddress.toLowerCase() === ZERO;

/** Fake CIDs for /api/pin only (contract stays real). Implied by mock mode. */
export const mockPin = useMock || env.VITE_MOCK_PIN === 'true';

export const MAX_BATCH = 50;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export const explorerTx = (hash: string) =>
  targetChain.blockExplorers?.default ? `${targetChain.blockExplorers.default.url}/tx/${hash}` : undefined;
export const explorerAddr = (a: string) =>
  targetChain.blockExplorers?.default ? `${targetChain.blockExplorers.default.url}/address/${a}` : undefined;
