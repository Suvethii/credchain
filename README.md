# CredChain (Dev A): contract, API and tests

Soulbound credential issuance and verification. Approved institutions issue certificates as
**soulbound NFTs** (they cannot be transferred), and anyone can check a certificate in seconds.

> Learning project. **Sepolia test network and test data only.** Never put real personal data on IPFS: it is public and permanent.

## Live (Sepolia)

| Item | Value |
|---|---|
| Contract `MiniCredChain` | [`0x8774fc5f04a4F07A04C867A1a494cEABe27e4E83`](https://sepolia.etherscan.io/address/0x8774fc5f04a4F07A04C867A1a494cEABe27e4E83#code) (verified) |
| Network | Sepolia (chainId 11155111) |
| ABI + address | [`abi/MiniCredChain.json`](abi/MiniCredChain.json), [`deployments/sepolia.json`](deployments/sepolia.json) |
| Upload API | `POST https://credchain-practice.vercel.app/api/pin` |

## Project layout

```text
contracts/MiniCredChain.sol   the contract (ERC-721 + AccessControl + ERC-5192)
lib/metadata.ts               PDF fingerprint (SHA-256), metadata build/check, IPFS gateway fallback
lib/pin.ts, api/pin.ts        /api/pin: uploads a PDF or metadata JSON to IPFS via Pinata (Vercel function)
scripts/deploy.ts             deploys and writes deployments/<network>.json and abi/MiniCredChain.json
scripts/seed.ts               sample data: 2 issuers, 5 credentials (valid, revoked, expired)
scripts/pin-smoke.ts          real upload test with your own Pinata key
scripts/help-dev-b.ts         sets up a teammate's wallet (issuer + test certificates + test ETH)
test/                         contract, fuzz, gas, metadata, gateway and API tests
```

(`Lock.sol`, `IssuerList.sol` and `SoulboundBadge.sol` are early practice files and are not part of CredChain.)

## Contract

**Roles:** `DEFAULT_ADMIN_ROLE` (deployer) approves issuers. `ISSUER_ROLE` can issue.

| Function | Who | What it does |
|---|---|---|
| `addIssuer(account, name)` | admin | approve an institution and store its display name |
| `removeIssuer(account)` | admin | stop an issuer. Its old credentials stay valid, and `verify` flags `issuerStillApproved = false` |
| `issue(to, uri, docHash, expiresAt)` | issuer | mint one soulbound credential. `expiresAt = 0` means it never expires |
| `batchIssue(to[], uris[], docHashes[], expiresAt)` | issuer | up to 50 at once, all or none |
| `revoke(tokenId, reason)` | original issuer or admin | mark as revoked with a reason. The token stays with the holder |
| `verify(tokenId)` | anyone | status + issuer, issuer name, holder, docHash, uri, dates, revoke reason |
| `tokensOf(holder)` | anyone | a holder's token IDs |
| `locked(tokenId)` | anyone | always `true` (ERC-5192 soulbound) |

**Status values from `verify`:** `0` NotFound, `1` Valid, `2` Revoked, `3` Expired. Revoked overrides Expired.

**Soulbound rule:** `_update` allows only minting. Every transfer, safe transfer and burn reverts with `Soulbound()`.

**Events:** `IssuerAdded`, `IssuerRemoved`, `CredentialIssued`, `CredentialRevoked`, `Locked`.

## Upload API: `POST /api/pin`

| Request | Body | Checks |
|---|---|---|
| PDF | `multipart/form-data`, field `file` | PDF only (starts with `%PDF-`), max 5 MB |
| Metadata | `application/json` | validated by `lib/metadata.ts` (required fields, real dates, `ipfs://` link, SHA-256 hash), max 100 KB |

Response: `{ "cid": "...", "uri": "ipfs://...", "size": 123 }`. Use `uri` in `issue`.

Errors: `400` bad input, `405` not POST, `413` too big, `415` wrong type, `502` IPFS upload failed (Pinata details are hidden).

The Pinata key (`PINATA_JWT`) is a **server-only** Vercel secret. It is never sent to the browser.
`ALLOWED_ORIGINS` (comma-separated) limits which websites may call the API. Empty = any (testing only).

### Issue flow (for the web app)

1. `sha256Hex(pdfBytes)` → `docHash`
2. `POST /api/pin` with the PDF → `pdfUri`
3. `buildMetadata({..., documentUri: pdfUri, documentHash: docHash})`, then `POST /api/pin` with it → `metadataUri`
4. `issue(to, metadataUri, docHash, expiryToTimestamp(expiryDate))`
5. Verifier: `verify(id)`, load metadata with `fetchFromIpfs` (Pinata → ipfs.io → Cloudflare), and compare a dropped PDF with `pdfMatchesHash`

## Setup

```bash
npm install
npx hardhat test          # all tests
npx hardhat coverage      # coverage report
```

Secrets live **outside** the repo (for example `~/credchain-secrets.env`) and are loaded only when needed:

| Variable | Used for |
|---|---|
| `SEPOLIA_RPC_URL` | Alchemy (or other) Sepolia RPC URL |
| `DEPLOYER_PRIVATE_KEY` | test wallet that deploys and issues (test ETH only) |
| `ETHERSCAN_API_KEY` | contract verification |
| `PINATA_JWT` | `scripts/pin-smoke.ts` locally, and the Vercel secret |

```bash
set -a && . ~/credchain-secrets.env && set +a
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat verify --network sepolia <address>
SEED_ISSUER2=0x... npx hardhat run scripts/seed.ts --network sepolia
```

Deploy the API:

```bash
vercel link
printf '%s' "$PINATA_JWT" | vercel env add PINATA_JWT production
vercel deploy --prod
```

`.vercelignore` uploads only `api/`, `lib/`, `public/` and the config files.

## Test results

| Check | Result |
|---|---|
| Unit tests | 55 passing (contract 27, metadata 9, API 14, gateway 6, fuzz 2, gas 1) |
| Coverage (MiniCredChain) | 100% lines, 100% functions, 100% statements, 89% branches |
| Fuzz | 25 random runs each: never transferable; revoked never returns to Valid |
| Gas | `batchIssue` of 50 ≈ 10.7M gas, 35% of a 30M block |
| Slither | no high or medium findings. 3 low `timestamp` notes, accepted: expiry is measured in days, so a few seconds of block-time drift does not matter |
| Secrets | Pinata JWT not in Git history, repo files or the live site |

## Notes

- OpenZeppelin v5 needs `evmVersion: "cancun"` in `hardhat.config.ts`.
- On WSL, if Hardhat cannot download the compiler, use `NODE_OPTIONS=--dns-result-order=ipv4first`.
- The Sepolia sample credentials are tokens #1 to #13 (#11 to #13 belong to Dev B's test wallet).
