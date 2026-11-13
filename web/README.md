# CredChain — web (Dev B)

Vite + React + TS + Tailwind · wagmi v2 + viem + RainbowKit · React Query · papaparse · qrcode.react

## Pages

| Route | Who | What |
|---|---|---|
| `/verify`, `/verify/:id` | anyone | Valid / Revoked / Expired / NotFound · 3 checks (status, issuer still approved, PDF hash) · QR |
| `/me` | holder | credential cards, share link + QR, "Try transfer" (shows Soulbound revert) |
| `/issuer` | ISSUER_ROLE | single issue with PDF · CSV batch (≤ 50) · issued list + revoke with reason |
| `/admin` | DEFAULT_ADMIN_ROLE | add issuer with name · issuer list · remove |

Nav hides Issuer/Admin for wallets without the role; pages show "Not authorised". The contract enforces the real rule.

## Data flow

```
page → hook (useVerify, useIssue, useMyCredentials, usePin, useRevoke, useAdmin)
         → lib/useApi.ts → realApi (wagmi → contract)   or   mockApi (in-browser fake, same rules)
         → lib/pin.ts    → POST /api/pin (Dev A)        or   fake CID
```

Interface change after freeze → edit `src/lib/realApi.ts` + `src/abi/CredChain.json` only.

## Run

```bash
npm ci
cp .env.example .env.local      # edit
npm run dev:mock                 # no contract needed: account switcher top-right (admin / issuer / student)
npm run dev                      # real mode: needs VITE_CONTRACT_ADDRESS
npm test && npm run build        # 16 unit tests + type-check + build
```

Local Hardhat node: `VITE_CHAIN=local`, `VITE_CONTRACT_ADDRESS=<local deploy>`, `VITE_RPC_URL=http://127.0.0.1:8545`.

E2E smoke (demo script, mock mode):
```bash
VITE_USE_MOCK=true npx vite build --outDir dist-mock && npx vite preview --outDir dist-mock --port 4173 &
node e2e/smoke.cjs /tmp
```

## Env (all public, go into the bundle)

| Var | Example |
|---|---|
| `VITE_CHAIN` | `sepolia` / `baseSepolia` / `local` |
| `VITE_CONTRACT_ADDRESS` | from `shared/deployments/sepolia.json` |
| `VITE_DEPLOY_BLOCK` | deploy block (event scans start here) |
| `VITE_RPC_URL` | Alchemy/Infura Sepolia URL |
| `VITE_WC_PROJECT_ID` | WalletConnect Cloud id |
| `VITE_PIN_URL` | `/api/pin` (default) |
| `VITE_USE_MOCK` | `true` for demo without chain |

`PINATA_JWT` is **never** a `VITE_` var. It lives only in Vercel (server) for `/api/pin`.
Check before demo: `grep -r "eyJ" dist/` must return nothing.

## Deploy (Vercel)

1. Import repo, root dir = `web`, framework = Vite.
2. Set the `VITE_*` vars above (Production + Preview).
3. `vercel.json` rewrites every non-`/api` path to `index.html` (so `/verify/5` works on refresh).
4. Dev A's `api/pin.ts` sits in `web/api/` → same Vercel project, same domain, no CORS.
