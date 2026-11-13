// Plan requirement: "batchIssue at 50 items stays under the block gas limit with margin".
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const BLOCK_GAS_LIMIT = 30_000_000n; // Ethereum / Sepolia block gas limit (about 30-36 million)
const MAX_SHARE = 50n;               // we want at most 50% of a block, to leave a safe margin

describe("batchIssue gas (50 items)", function () {
  async function deployFixture() {
    const [admin, issuer, ...rest] = await hre.ethers.getSigners();
    const cred = await (await hre.ethers.getContractFactory("MiniCredChain")).deploy();
    await cred.addIssuer(issuer.address, "Gas Test Institute");
    return { cred, issuer, rest };
  }

  it("issues the maximum batch of 50 well under the block gas limit", async function () {
    const { cred, issuer, rest } = await loadFixture(deployFixture);
    const n = 50;
    const to = Array.from({ length: n }, (_, i) => rest[i % rest.length].address);
    // Realistic link length: a real ipfs:// CID is about 66 characters
    const uris = Array.from({ length: n }, (_, i) => `ipfs://bafkreidxsb3qim2gqqgv7c5ognvnzhmmj5xe7jv3lksem4ngnb5uad${String(i).padStart(4, "0")}`);
    const hashes = Array.from({ length: n }, (_, i) => hre.ethers.id(`doc-${i}`));

    const receipt = await (await cred.connect(issuer).batchIssue(to, uris, hashes, 0)).wait();
    const gas = receipt!.gasUsed;
    const share = (gas * 100n) / BLOCK_GAS_LIMIT;
    console.log(`      gas used: ${gas.toLocaleString()} (${share}% of a 30M block, ~${(gas / 50n).toLocaleString()} per certificate)`);

    expect(await cred.ownerOf(50)).to.equal(to[49]);
    expect(share).to.be.lessThan(MAX_SHARE);
  });
});
