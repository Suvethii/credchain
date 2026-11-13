import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("SoulboundBadge", function () {
  // Fresh contract for each test. The admin gives the "issuer" wallet the ISSUER_ROLE.
  async function deployFixture() {
    const [admin, issuer, student, other] = await hre.ethers.getSigners();
    const Badge = await hre.ethers.getContractFactory("SoulboundBadge");
    const badge = await Badge.deploy();
    const ISSUER_ROLE = await badge.ISSUER_ROLE();
    await badge.grantRole(ISSUER_ROLE, issuer.address);
    return { badge, admin, issuer, student, other, ISSUER_ROLE };
  }

  it("lets an issuer give a badge to a student", async function () {
    const { badge, issuer, student } = await loadFixture(deployFixture);
    await badge.connect(issuer).issue(student.address);
    expect(await badge.ownerOf(1)).to.equal(student.address);
    expect(await badge.balanceOf(student.address)).to.equal(1n);
  });

  it("numbers badges 1, 2, 3 ...", async function () {
    const { badge, issuer, student, other } = await loadFixture(deployFixture);
    await badge.connect(issuer).issue(student.address);
    await badge.connect(issuer).issue(other.address);
    expect(await badge.ownerOf(2)).to.equal(other.address);
  });

  it("blocks a wallet without ISSUER_ROLE", async function () {
    const { badge, student, other, ISSUER_ROLE } = await loadFixture(deployFixture);
    await expect(badge.connect(other).issue(student.address))
      .to.be.revertedWithCustomError(badge, "AccessControlUnauthorizedAccount")
      .withArgs(other.address, ISSUER_ROLE);
  });

  it("blocks the student from transferring the badge (soulbound)", async function () {
    const { badge, issuer, student, other } = await loadFixture(deployFixture);
    await badge.connect(issuer).issue(student.address);
    await expect(
      badge.connect(student).transferFrom(student.address, other.address, 1)
    ).to.be.revertedWithCustomError(badge, "Soulbound");
  });

  it("blocks safeTransferFrom too", async function () {
    const { badge, issuer, student, other } = await loadFixture(deployFixture);
    await badge.connect(issuer).issue(student.address);
    await expect(
      badge
        .connect(student)
        ["safeTransferFrom(address,address,uint256)"](student.address, other.address, 1)
    ).to.be.revertedWithCustomError(badge, "Soulbound");
  });

  it("blocks a transfer even after the student approves someone else", async function () {
    const { badge, issuer, student, other } = await loadFixture(deployFixture);
    await badge.connect(issuer).issue(student.address);
    await badge.connect(student).approve(other.address, 1);
    await expect(
      badge.connect(other).transferFrom(student.address, other.address, 1)
    ).to.be.revertedWithCustomError(badge, "Soulbound");
  });

  it("stops an issuer after the admin removes the role", async function () {
    const { badge, issuer, student, ISSUER_ROLE } = await loadFixture(deployFixture);
    await badge.revokeRole(ISSUER_ROLE, issuer.address);
    await expect(badge.connect(issuer).issue(student.address))
      .to.be.revertedWithCustomError(badge, "AccessControlUnauthorizedAccount");
  });

  it("reports support for ERC-721", async function () {
    const { badge } = await loadFixture(deployFixture);
    expect(await badge.supportsInterface("0x80ac58cd")).to.equal(true);
  });
});
