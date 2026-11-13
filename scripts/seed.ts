// seed.ts: fills MiniCredChain with sample (TEST) data for testing and the demo:
// 2 issuers, 5 credentials (3 valid, 1 revoked, 1 expired). All fake test data.
//  - Local:   npx hardhat run scripts/seed.ts
//  - Sepolia: SEED_ISSUER2=0x... npx hardhat run scripts/seed.ts --network sepolia
import hre from "hardhat";
import fs from "fs";

const STUDENT = process.env.SEED_STUDENT ?? "0xCd8004fB047cF74c3c3434366469E3869F87Ce04";
const hashOf = (s: string) => hre.ethers.sha256(hre.ethers.toUtf8Bytes(s));
const STATUS = ["NotFound", "Valid", "Revoked", "Expired"];

async function main() {
  const signers = await hre.ethers.getSigners();
  const admin = signers[0];
  const net = hre.network.name;
  const local = net === "hardhat";

  let cred;
  if (local) {
    cred = await (await hre.ethers.getContractFactory("MiniCredChain")).deploy();
    await cred.waitForDeployment();
  } else {
    const { address } = JSON.parse(fs.readFileSync(`deployments/${net}.json`, "utf8"));
    cred = await hre.ethers.getContractAt("MiniCredChain", address);
  }
  console.log(`Network: ${net}  Contract: ${await cred.getAddress()}`);
  const ROLE = await cred.ISSUER_ROLE();

  // ---- 2 issuers ----
  // Issuer 1 = the admin wallet. Issuer 2 = a second wallet (locally a test wallet; on Sepolia SEED_ISSUER2).
  const issuer2Addr = local ? signers[1].address : process.env.SEED_ISSUER2;
  if (!issuer2Addr) throw new Error("Set SEED_ISSUER2 to the second issuer's address");
  for (const [addr, name] of [[admin.address, "Raxwo Practice Institute"], [issuer2Addr, "Sample Training Academy"]]) {
    if (!(await cred.hasRole(ROLE, addr))) {
      await (await cred.addIssuer(addr, name)).wait();
      console.log("Added issuer:", name);
    } else console.log("Already an issuer:", await cred.issuerName(addr));
  }
  // Locally the second issuer can sign; on Sepolia we only hold the admin key, so the admin issues.
  const issuer2 = local ? cred.connect(signers[1]) : cred;

  const now = (await hre.ethers.provider.getBlock("latest"))!.timestamp;
  const oneYear = BigInt(now + 365 * 24 * 3600);
  const inTwoMin = BigInt(now + 120);
  const before = (await cred.tokensOf(STUDENT)).length;

  // ---- 5 credentials ----
  const samples = [
    { title: "Valid, never expires", by: cred, uri: "ipfs://sample-web-basics", exp: 0n },
    { title: "Valid, expires in 1 year", by: cred, uri: "ipfs://sample-react-intro", exp: oneYear },
    { title: "Valid, from issuer 2", by: issuer2, uri: "ipfs://sample-cloud-basics", exp: 0n },
    { title: "Revoked", by: cred, uri: "ipfs://sample-git-basics", exp: 0n },
    { title: "Expired (2 minutes)", by: cred, uri: "ipfs://sample-short-workshop", exp: inTwoMin },
  ];
  for (const s of samples) {
    await (await s.by.issue(STUDENT, s.uri, hashOf(`TEST DATA: ${s.title}`), s.exp)).wait();
    console.log("Issued:", s.title);
  }
  const ids = (await cred.tokensOf(STUDENT)).slice(before);
  await (await cred.revoke(ids[3], "Sample: issued by mistake")).wait();
  console.log("Revoked token", ids[3].toString());

  if (local) {
    await hre.network.provider.send("evm_increaseTime", [180]);
    await hre.network.provider.send("evm_mine");
  }

  console.log("\nTokenId  Status    Issuer                     Title");
  for (let i = 0; i < ids.length; i++) {
    const r = await cred.verify(ids[i]);
    console.log(`${ids[i].toString().padEnd(8)} ${STATUS[Number(r.status)].padEnd(9)} ${r.issuerName.padEnd(26)} ${samples[i].title}`);
  }
  if (!local) console.log("\n(The 2-minute one will show Expired after about 2 minutes.)");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
