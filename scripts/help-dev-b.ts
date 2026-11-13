// help-dev-b.ts: sets up a teammate's wallet for testing the issuer and holder pages.
//  1) adds the wallet as an issuer, 2) issues 3 test certificates to it, 3) sends some Sepolia ETH for gas.
// Run: DEV_B=0x... npx hardhat run scripts/help-dev-b.ts --network sepolia
import hre from "hardhat";
import fs from "fs";

const ETH_TO_SEND = "0.05";
const STATUS = ["NotFound", "Valid", "Revoked", "Expired"];

async function main() {
  const [admin] = await hre.ethers.getSigners();
  const devB = process.env.DEV_B ?? "";
  if (!hre.ethers.isAddress(devB)) throw new Error("Set DEV_B to the teammate's wallet address");
  const net = hre.network.name;

  let cred;
  if (net === "hardhat") {
    cred = await (await hre.ethers.getContractFactory("MiniCredChain")).deploy();
    await (await cred.addIssuer(admin.address, "Raxwo Practice Institute")).wait();
  } else {
    const { address } = JSON.parse(fs.readFileSync(`deployments/${net}.json`, "utf8"));
    cred = await hre.ethers.getContractAt("MiniCredChain", address);
  }
  console.log(`Network: ${net}  Contract: ${await cred.getAddress()}`);

  // 1) Add as issuer
  if (await cred.hasRole(await cred.ISSUER_ROLE(), devB)) console.log("Already an issuer");
  else { await (await cred.addIssuer(devB, "Dev B Test Institute")).wait(); console.log("Added as issuer: Dev B Test Institute"); }

  // 2) Issue 3 test certificates to the wallet (from the admin's institute)
  const now = (await hre.ethers.provider.getBlock("latest"))!.timestamp;
  const before = (await cred.tokensOf(devB)).length;
  const samples = [
    { title: "Holder test: never expires", uri: "ipfs://sample-holder-1", exp: 0n },
    { title: "Holder test: expires in 1 year", uri: "ipfs://sample-holder-2", exp: BigInt(now + 365 * 24 * 3600) },
    { title: "Holder test: expires in 1 day", uri: "ipfs://sample-holder-3", exp: BigInt(now + 24 * 3600) },
  ];
  for (const s of samples) {
    await (await cred.issue(devB, s.uri, hre.ethers.sha256(hre.ethers.toUtf8Bytes(`TEST DATA: ${s.title}`)), s.exp)).wait();
    console.log("Issued:", s.title);
  }
  const ids = (await cred.tokensOf(devB)).slice(before);

  // 3) Send test ETH for gas
  const tx = await admin.sendTransaction({ to: devB, value: hre.ethers.parseEther(ETH_TO_SEND) });
  await tx.wait();
  console.log(`Sent ${ETH_TO_SEND} ETH. Tx: ${tx.hash}`);

  console.log("\nTokenId  Status");
  for (const id of ids) console.log(`${id.toString().padEnd(8)} ${STATUS[Number((await cred.verify(id)).status)]}`);
  console.log("Teammate balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(devB)), "ETH");
  console.log("Admin balance:   ", hre.ethers.formatEther(await hre.ethers.provider.getBalance(admin.address)), "ETH");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
