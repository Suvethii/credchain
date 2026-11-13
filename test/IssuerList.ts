import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("IssuerList", function () {
  // Deploys a fresh contract for each test, with 3 test wallets
  async function deployFixture() {
    const [admin, issuer, other] = await hre.ethers.getSigners();
    const IssuerList = await hre.ethers.getContractFactory("IssuerList");
    const list = await IssuerList.deploy();
    return { list, admin, issuer, other };
  }

  it("sets the deployer as admin", async function () {
    const { list, admin } = await loadFixture(deployFixture);
    expect(await list.admin()).to.equal(admin.address);
  });

  it("lets the admin add an issuer with a name", async function () {
    const { list, issuer } = await loadFixture(deployFixture);
    await expect(list.addIssuer(issuer.address, "Example Institute"))
      .to.emit(list, "IssuerAdded")
      .withArgs(issuer.address, "Example Institute");
    expect(await list.isIssuer(issuer.address)).to.equal(true);
    expect(await list.issuerName(issuer.address)).to.equal("Example Institute");
  });

  it("blocks a non-admin from adding an issuer", async function () {
    const { list, issuer, other } = await loadFixture(deployFixture);
    await expect(
      list.connect(other).addIssuer(issuer.address, "Fake Uni")
    ).to.be.revertedWith("Only admin");
  });

  it("blocks adding the same issuer twice", async function () {
    const { list, issuer } = await loadFixture(deployFixture);
    await list.addIssuer(issuer.address, "Example Institute");
    await expect(
      list.addIssuer(issuer.address, "Example Institute")
    ).to.be.revertedWith("Already an issuer");
  });

  it("blocks an empty name", async function () {
    const { list, issuer } = await loadFixture(deployFixture);
    await expect(list.addIssuer(issuer.address, "")).to.be.revertedWith("Name required");
  });

  it("blocks the zero address", async function () {
    const { list } = await loadFixture(deployFixture);
    await expect(
      list.addIssuer(hre.ethers.ZeroAddress, "Nobody")
    ).to.be.revertedWith("Zero address");
  });

  it("lets the admin remove an issuer", async function () {
    const { list, issuer } = await loadFixture(deployFixture);
    await list.addIssuer(issuer.address, "Example Institute");
    await expect(list.removeIssuer(issuer.address))
      .to.emit(list, "IssuerRemoved")
      .withArgs(issuer.address);
    expect(await list.isIssuer(issuer.address)).to.equal(false);
  });

  it("blocks removing someone who is not an issuer", async function () {
    const { list, other } = await loadFixture(deployFixture);
    await expect(list.removeIssuer(other.address)).to.be.revertedWith("Not an issuer");
  });

  it("blocks a non-admin from removing an issuer", async function () {
    const { list, issuer, other } = await loadFixture(deployFixture);
    await list.addIssuer(issuer.address, "Example Institute");
    await expect(
      list.connect(other).removeIssuer(issuer.address)
    ).to.be.revertedWith("Only admin");
  });
});
