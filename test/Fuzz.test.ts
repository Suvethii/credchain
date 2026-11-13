// Fuzz tests: run the same rule many times with random inputs, to check it ALWAYS holds.
// The random numbers come from a fixed seed, so a failure can be repeated exactly.
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const RUNS = 25;
const Valid = 1n, Revoked = 2n;

// Small repeatable random number generator (mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];

describe("Fuzz: soulbound and revoke rules", function () {
  async function deployFixture() {
    const signers = await hre.ethers.getSigners();
    const [admin, issuer] = signers;
    const cred = await (await hre.ethers.getContractFactory("MiniCredChain")).deploy();
    await cred.addIssuer(issuer.address, "Fuzz Institute");
    return { cred, admin, issuer, people: signers.slice(2, 10) };
  }

  it(`a credential can never be transferred, by anyone, in any way (${RUNS} random tries)`, async function () {
    const { cred, admin, issuer, people } = await loadFixture(deployFixture);
    const r = rng(12345);
    for (let i = 0; i < RUNS; i++) {
      const holder = pick(r, people);
      await cred.connect(issuer).issue(holder.address, `ipfs://fuzz-${i}`, hre.ethers.id(`doc-${i}`), 0);
      const id = BigInt(i + 1);
      const caller = pick(r, [holder, admin, issuer, ...people]);
      const to = pick(r, [admin, issuer, ...people]).address;
      const way = Math.floor(r() * 3);

      if (way === 2) await cred.connect(holder).approve(caller.address, id).catch(() => {});
      const attempt =
        way === 0 ? cred.connect(caller).transferFrom(holder.address, to, id)
        : way === 1 ? cred.connect(caller)["safeTransferFrom(address,address,uint256)"](holder.address, to, id)
        : cred.connect(caller).transferFrom(holder.address, to, id);

      await expect(attempt).to.be.reverted; // Soulbound, or not approved
      expect(await cred.ownerOf(id)).to.equal(holder.address); // still with the original holder
    }
  });

  it(`a revoked credential never shows Valid again (${RUNS} random tries)`, async function () {
    const { cred, admin, issuer, people } = await loadFixture(deployFixture);
    const r = rng(67890);
    for (let i = 0; i < RUNS; i++) {
      const now = await time.latest();
      const expiry = r() < 0.5 ? 0 : now + 1 + Math.floor(r() * 30 * 24 * 3600); // never, or within 30 days
      await cred.connect(issuer).issue(pick(r, people).address, `ipfs://r-${i}`, hre.ethers.id(`r-${i}`), expiry);
      const id = BigInt(i + 1);
      await cred.connect(pick(r, [admin, issuer])).revoke(id, `reason ${i}`);

      // Random things happen afterwards: time passes, the issuer is removed or added again, revoke is retried
      for (let step = 0; step < 3; step++) {
        const action = Math.floor(r() * 4);
        if (action === 0) await time.increase(1 + Math.floor(r() * 400 * 24 * 3600));
        if (action === 1) await cred.removeIssuer(issuer.address);
        if (action === 2) await cred.addIssuer(issuer.address, "Fuzz Institute");
        if (action === 3) await expect(cred.connect(admin).revoke(id, "again")).to.be.reverted;
        const status = (await cred.verify(id)).status;
        expect(status).to.equal(Revoked);
        expect(status).to.not.equal(Valid);
      }
      if (!(await cred.hasRole(await cred.ISSUER_ROLE(), issuer.address))) await cred.addIssuer(issuer.address, "Fuzz Institute");
    }
  });
});
