import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

// Status numbers from the contract's enum
const NotFound = 0n, Valid = 1n, Revoked = 2n, Expired = 3n;
const URI = "ipfs://example-metadata-cid";
const HASH = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("sample pdf")); // any 32-byte value for tests

describe("MiniCredChain", function () {
  async function deployFixture() {
    const [admin, issuer, student, other, issuer2] = await hre.ethers.getSigners();
    const Cred = await hre.ethers.getContractFactory("MiniCredChain");
    const cred = await Cred.deploy();
    await cred.addIssuer(issuer.address, "Example Institute");
    await cred.addIssuer(issuer2.address, "Second Academy");
    return { cred, admin, issuer, student, other, issuer2 };
  }

  // Same as above, plus one credential (#1) already issued to the student
  async function issuedFixture() {
    const f = await deployFixture();
    await f.cred.connect(f.issuer).issue(f.student.address, URI, HASH, 0);
    return f;
  }

  // ---------- Issuers ----------

  it("lets the admin add an issuer with a name", async function () {
    const { cred, issuer } = await loadFixture(deployFixture);
    expect(await cred.hasRole(await cred.ISSUER_ROLE(), issuer.address)).to.equal(true);
    expect(await cred.issuerName(issuer.address)).to.equal("Example Institute");
  });

  it("blocks a non-admin from adding an issuer", async function () {
    const { cred, other } = await loadFixture(deployFixture);
    await expect(cred.connect(other).addIssuer(other.address, "Fake Uni"))
      .to.be.revertedWithCustomError(cred, "AccessControlUnauthorizedAccount");
  });

  it("blocks an empty issuer name", async function () {
    const { cred, other } = await loadFixture(deployFixture);
    await expect(cred.addIssuer(other.address, "")).to.be.revertedWithCustomError(cred, "EmptyName");
  });

  // ---------- Issuing ----------

  it("lets an issuer issue a credential", async function () {
    const { cred, issuer, student } = await loadFixture(deployFixture);
    await expect(cred.connect(issuer).issue(student.address, URI, HASH, 0))
      .to.emit(cred, "CredentialIssued").withArgs(1, issuer.address, student.address, HASH)
      .and.to.emit(cred, "Locked").withArgs(1);
    expect(await cred.ownerOf(1)).to.equal(student.address);
    expect(await cred.tokenURI(1)).to.equal(URI);
  });

  it("blocks a non-issuer from issuing", async function () {
    const { cred, student, other } = await loadFixture(deployFixture);
    await expect(cred.connect(other).issue(student.address, URI, HASH, 0))
      .to.be.revertedWithCustomError(cred, "AccessControlUnauthorizedAccount");
  });

  it("blocks issuing to the zero address", async function () {
    const { cred, issuer } = await loadFixture(deployFixture);
    await expect(cred.connect(issuer).issue(hre.ethers.ZeroAddress, URI, HASH, 0))
      .to.be.revertedWithCustomError(cred, "ZeroAddress");
  });

  it("blocks an expiry date in the past", async function () {
    const { cred, issuer, student } = await loadFixture(deployFixture);
    const past = (await time.latest()) - 10;
    await expect(cred.connect(issuer).issue(student.address, URI, HASH, past))
      .to.be.revertedWithCustomError(cred, "InvalidExpiry");
  });

  it("lists a student's credentials with tokensOf", async function () {
    const { cred, issuer, student } = await loadFixture(deployFixture);
    await cred.connect(issuer).issue(student.address, URI, HASH, 0);
    await cred.connect(issuer).issue(student.address, URI, HASH, 0);
    expect(await cred.tokensOf(student.address)).to.deep.equal([1n, 2n]);
  });

  // ---------- Batch issuing (Day 2) ----------

  it("batch issues to several students at once", async function () {
    const { cred, issuer, student, other, admin } = await loadFixture(deployFixture);
    const to = [student.address, other.address, admin.address];
    await cred.connect(issuer).batchIssue(to, [URI, URI, URI], [HASH, HASH, HASH], 0);
    expect(await cred.ownerOf(1)).to.equal(student.address);
    expect(await cred.ownerOf(2)).to.equal(other.address);
    expect(await cred.ownerOf(3)).to.equal(admin.address);
  });

  it("blocks a batch bigger than 50", async function () {
    const { cred, issuer, student } = await loadFixture(deployFixture);
    const n = 51;
    await expect(
      cred.connect(issuer).batchIssue(Array(n).fill(student.address), Array(n).fill(URI), Array(n).fill(HASH), 0)
    ).to.be.revertedWithCustomError(cred, "BatchTooLarge").withArgs(51);
  });

  it("blocks a batch when the lists have different lengths", async function () {
    const { cred, issuer, student, other } = await loadFixture(deployFixture);
    await expect(
      cred.connect(issuer).batchIssue([student.address, other.address], [URI], [HASH, HASH], 0)
    ).to.be.revertedWithCustomError(cred, "LengthMismatch");
  });

  it("issues nothing if one address in the batch is wrong (all or none)", async function () {
    const { cred, issuer, student } = await loadFixture(deployFixture);
    await expect(
      cred.connect(issuer).batchIssue([student.address, hre.ethers.ZeroAddress], [URI, URI], [HASH, HASH], 0)
    ).to.be.revertedWithCustomError(cred, "ZeroAddress");
    expect(await cred.tokensOf(student.address)).to.deep.equal([]);
  });

  it("blocks a non-issuer from batch issuing", async function () {
    const { cred, student, other } = await loadFixture(deployFixture);
    await expect(cred.connect(other).batchIssue([student.address], [URI], [HASH], 0))
      .to.be.revertedWithCustomError(cred, "AccessControlUnauthorizedAccount");
  });

  // ---------- Verify ----------

  it("verify shows Valid with issuer, holder and hash", async function () {
    const { cred, issuer, student } = await loadFixture(issuedFixture);
    const r = await cred.verify(1);
    expect(r.status).to.equal(Valid);
    expect(r.issuer).to.equal(issuer.address);
    expect(r.issuerName).to.equal("Example Institute");
    expect(r.holder).to.equal(student.address);
    expect(r.docHash).to.equal(HASH);
    expect(r.uri).to.equal(URI);
    expect(r.issuerStillApproved).to.equal(true);
  });

  it("verify shows NotFound for a token that does not exist", async function () {
    const { cred } = await loadFixture(deployFixture);
    expect((await cred.verify(99)).status).to.equal(NotFound);
  });

  it("verify shows Expired after the expiry time (time travel)", async function () {
    const { cred, issuer, student } = await loadFixture(deployFixture);
    const in1Day = (await time.latest()) + 24 * 60 * 60;
    await cred.connect(issuer).issue(student.address, URI, HASH, in1Day);
    expect((await cred.verify(1)).status).to.equal(Valid);
    await time.increaseTo(in1Day + 1); // jump forward in time on the test chain
    expect((await cred.verify(1)).status).to.equal(Expired);
  });

  it("keeps old credentials valid after the issuer is removed, but flags it", async function () {
    const { cred, issuer } = await loadFixture(issuedFixture);
    await cred.removeIssuer(issuer.address);
    const r = await cred.verify(1);
    expect(r.status).to.equal(Valid);
    expect(r.issuerStillApproved).to.equal(false);
  });

  // ---------- Revoke (Day 2) ----------

  it("lets the issuer revoke with a reason, and verify shows Revoked", async function () {
    const { cred, issuer } = await loadFixture(issuedFixture);
    await expect(cred.connect(issuer).revoke(1, "Issued by mistake"))
      .to.emit(cred, "CredentialRevoked").withArgs(1, issuer.address, "Issued by mistake");
    const r = await cred.verify(1);
    expect(r.status).to.equal(Revoked);
    expect(r.revokeReason).to.equal("Issued by mistake");
  });

  it("lets the admin revoke any credential", async function () {
    const { cred, admin } = await loadFixture(issuedFixture);
    await expect(cred.connect(admin).revoke(1, "Fraud report"))
      .to.emit(cred, "CredentialRevoked").withArgs(1, admin.address, "Fraud report");
  });

  it("blocks another issuer from revoking someone else's credential", async function () {
    const { cred, issuer2 } = await loadFixture(issuedFixture);
    await expect(cred.connect(issuer2).revoke(1, "Not mine"))
      .to.be.revertedWithCustomError(cred, "NotAllowedToRevoke");
  });

  it("blocks the student or a stranger from revoking", async function () {
    const { cred, student, other } = await loadFixture(issuedFixture);
    await expect(cred.connect(student).revoke(1, "x")).to.be.revertedWithCustomError(cred, "NotAllowedToRevoke");
    await expect(cred.connect(other).revoke(1, "x")).to.be.revertedWithCustomError(cred, "NotAllowedToRevoke");
  });

  it("blocks revoking twice, revoking without a reason, and revoking a missing token", async function () {
    const { cred, issuer } = await loadFixture(issuedFixture);
    await expect(cred.connect(issuer).revoke(1, "")).to.be.revertedWithCustomError(cred, "ReasonRequired");
    await cred.connect(issuer).revoke(1, "Issued by mistake");
    await expect(cred.connect(issuer).revoke(1, "again"))
      .to.be.revertedWithCustomError(cred, "AlreadyRevoked").withArgs(1);
    await expect(cred.connect(issuer).revoke(99, "x"))
      .to.be.revertedWithCustomError(cred, "TokenNotFound").withArgs(99);
  });

  it("shows Revoked (not Expired) when a revoked credential also expires", async function () {
    const { cred, issuer, student } = await loadFixture(deployFixture);
    const in1Day = (await time.latest()) + 24 * 60 * 60;
    await cred.connect(issuer).issue(student.address, URI, HASH, in1Day);
    await cred.connect(issuer).revoke(1, "Cancelled");
    await time.increaseTo(in1Day + 1);
    expect((await cred.verify(1)).status).to.equal(Revoked);
  });

  it("keeps a revoked credential in the student's wallet (still soulbound)", async function () {
    const { cred, issuer, student } = await loadFixture(issuedFixture);
    await cred.connect(issuer).revoke(1, "Issued by mistake");
    expect(await cred.ownerOf(1)).to.equal(student.address);
  });

  // ---------- Soulbound ----------

  it("blocks transfers (soulbound)", async function () {
    const { cred, student, other } = await loadFixture(issuedFixture);
    await expect(cred.connect(student).transferFrom(student.address, other.address, 1))
      .to.be.revertedWithCustomError(cred, "Soulbound");
  });

  it("locked() is true for issued tokens and reverts for missing ones", async function () {
    const { cred } = await loadFixture(issuedFixture);
    expect(await cred.locked(1)).to.equal(true);
    await expect(cred.locked(99)).to.be.revertedWithCustomError(cred, "TokenNotFound");
  });

  it("reports support for ERC-721 and ERC-5192", async function () {
    const { cred } = await loadFixture(deployFixture);
    expect(await cred.supportsInterface("0x80ac58cd")).to.equal(true); // ERC-721
    expect(await cred.supportsInterface("0xb45a3c0e")).to.equal(true); // ERC-5192
  });
});
