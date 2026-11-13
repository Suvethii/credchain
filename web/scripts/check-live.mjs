// Run on your laptop:  node scripts/check-live.mjs [rpcUrl]
// Checks the deployed contract, finds its deploy block (for VITE_DEPLOY_BLOCK), reads sample tokens.
import { createPublicClient, http, keccak256, toBytes } from 'viem';
import { sepolia } from 'viem/chains';
import { readFileSync } from 'node:fs';

const dep = JSON.parse(readFileSync(new URL('../src/abi/CredChain.json', import.meta.url)));
const rpc = process.argv[2] || process.env.VITE_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const c = createPublicClient({ chain: sepolia, transport: http(rpc, { retryCount: 2 }) });
const address = dep.address;
const short = (e) => (e.details || e.shortMessage || e.message || String(e)).split('\n')[0];
const step = async (label, fn) => { try { await fn(); } catch (e) { console.log(`⚠️  ${label}: ${short(e)}`); } };
const read = (functionName, args = []) => c.readContract({ address, abi: dep.abi, functionName, args });

console.log('RPC:', rpc);
const code = await c.getCode({ address });
if (!code || code === '0x') { console.log(`❌ no contract at ${address} on Sepolia`); process.exit(1); }
console.log(`✅ contract code found on Sepolia (${(code.length - 2) / 2} bytes)`);

await step('basic reads', async () => {
  console.log('name/symbol   :', await read('name'), '/', await read('symbol'));
  console.log('ISSUER_ROLE ok:', (await read('ISSUER_ROLE')) === keccak256(toBytes('ISSUER_ROLE')));
  console.log('ERC-5192 iface:', await read('supportsInterface', ['0xb45a3c0e']));
  console.log('MAX_BATCH     :', (await read('MAX_BATCH')).toString());
});

// Deploy block = block of the contract's FIRST log (constructor emits RoleGranted in the deploy tx).
// Uses eth_getLogs (works on non-archive RPCs). Walks back in chunks, shrinks chunk on range errors.
let deployBlock = null;
await step('deploy block', async () => {
  const head = await c.getBlockNumber();
  const maxBack = 500_000n; // ~10 weeks of Sepolia
  const floor = head > maxBack ? head - maxBack : 0n;
  let chunk = 50_000n, to = head, earliest = null, calls = 0;
  process.stdout.write('scanning logs ');
  while (to >= floor && calls < 400) {
    const from = to - chunk + 1n > floor ? to - chunk + 1n : floor;
    try {
      calls++;
      const logs = await c.getLogs({ address, fromBlock: from, toBlock: to });
      process.stdout.write('.');
      if (logs.length) earliest = logs.reduce((m, l) => (l.blockNumber < m ? l.blockNumber : m), logs[0].blockNumber);
      if (from === floor) break;
      to = from - 1n;
    } catch (e) {
      if (chunk <= 500n) throw e;
      chunk /= 5n; // range too large → smaller window
    }
  }
  console.log('');
  if (earliest === null) { console.log('⚠️  no logs found in the last', maxBack.toString(), 'blocks'); return; }
  const blk = await c.getBlock({ blockNumber: earliest, includeTransactions: true });
  const deployTx = blk.transactions.find((t) => !t.to);
  deployBlock = earliest;
  console.log('deploy block  :', earliest.toString(), deployTx ? '(contract-creation tx found in this block ✅)' : '(first event; creation tx not seen in this block, may be earlier)');
  console.log('              → put in .env.local:  VITE_DEPLOY_BLOCK=' + earliest);
});

await step('issuers', async () => {
  const fromBlock = deployBlock ?? (await c.getBlockNumber()) - 50_000n;
  const ev = dep.abi.find((x) => x.type === 'event' && x.name === 'IssuerAdded');
  const logs = await c.getLogs({ address, event: ev, fromBlock, toBlock: 'latest' });
  for (const l of logs) console.log('issuer        :', l.args.account, `"${l.args.name}"`);
  if (!logs.length) console.log('issuer        : none found');
});

const NAMES = ['NotFound', 'Valid', 'Revoked', 'Expired'];
let misses = 0;
for (let id = 1n; id <= 20n && misses < 2; id++) {
  await step(`verify(${id})`, async () => {
    try {
      const r = await read('verify', [id]);
      if (r.status === 0) { misses++; console.log(`verify(${id})`.padEnd(14), ': status 0 (NotFound, no revert)'); return; }
      console.log(`verify(${id})`.padEnd(14), ':', `status ${r.status} = ${NAMES[r.status]}`.padEnd(20), `issuer "${r.issuerName}"`, `holder ${r.holder.slice(0, 8)}…`, r.revokeReason ? `reason "${r.revokeReason}"` : '', r.expiresAt ? `expires ${new Date(Number(r.expiresAt) * 1000).toISOString().slice(0, 10)}` : '');
    } catch (e) {
      misses++;
      console.log(`verify(${id})`.padEnd(14), ': reverted →', short(e));
    }
  });
}
console.log('\nCheck: Revoked rows have a reason, Expired rows have a past date → then the enum order NotFound/Valid/Revoked/Expired is right.');
