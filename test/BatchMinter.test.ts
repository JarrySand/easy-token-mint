import { expect } from "chai";
import hre from "hardhat";
import { MintableToken, BatchMinter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const { ethers } = hre;

describe("BatchMinter", function () {
  let token: MintableToken;
  let batchMinter: BatchMinter;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let recipient1: SignerWithAddress;
  let recipient2: SignerWithAddress;
  let recipient3: SignerWithAddress;
  let nonMinter: SignerWithAddress;

  const TOKEN_NAME = "Test Token";
  const TOKEN_SYMBOL = "TEST";
  const DECIMALS = 18;
  const CAP = ethers.parseUnits("1000000", DECIMALS);
  const INITIAL_SUPPLY = ethers.parseUnits("1000", DECIMALS);

  beforeEach(async function () {
    [owner, minter, recipient1, recipient2, recipient3, nonMinter] = await ethers.getSigners();

    // Deploy MintableToken
    const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
    token = await MintableTokenFactory.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      DECIMALS,
      CAP,
      INITIAL_SUPPLY,
      owner.address
    );
    await token.waitForDeployment();

    // Deploy BatchMinter
    const BatchMinterFactory = await ethers.getContractFactory("BatchMinter");
    batchMinter = await BatchMinterFactory.deploy();
    await batchMinter.waitForDeployment();

    // Grant MINTER_ROLE to minter
    const minterRole = await token.MINTER_ROLE();
    await token.grantRole(minterRole, minter.address);
  });

  describe("TC-SC-008: Batch Minting (within limits)", function () {
    it("should execute batch mint successfully", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
        { recipient: recipient2.address, amount: ethers.parseUnits("200", DECIMALS) },
        { recipient: recipient3.address, amount: ethers.parseUnits("300", DECIMALS) },
      ];

      // Grant MINTER_ROLE to BatchMinter so it can mint on behalf of minter
      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const tx = await batchMinter.connect(minter).batchMint(await token.getAddress(), requests);
      const receipt = await tx.wait();

      expect(await token.balanceOf(recipient1.address)).to.equal(requests[0].amount);
      expect(await token.balanceOf(recipient2.address)).to.equal(requests[1].amount);
      expect(await token.balanceOf(recipient3.address)).to.equal(requests[2].amount);
    });

    it("should return correct success count", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
        { recipient: recipient2.address, amount: ethers.parseUnits("200", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      // Use staticCall to get return values
      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await token.getAddress(), requests);

      expect(successCount).to.equal(2);
      expect(failedIndices).to.have.lengthOf(0);
    });

    it("should emit BatchMintExecuted event", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      await expect(batchMinter.connect(minter).batchMint(await token.getAddress(), requests))
        .to.emit(batchMinter, "BatchMintExecuted")
        .withArgs(
          await token.getAddress(),
          minter.address,
          1, // totalRecipients
          requests[0].amount // totalAmount
        );
    });

    it("should handle exactly 100 requests", async function () {
      const requests = Array.from({ length: 100 }, (_, i) => ({
        recipient: ethers.Wallet.createRandom().address,
        amount: ethers.parseUnits("1", DECIMALS),
      }));

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await token.getAddress(), requests);

      expect(successCount).to.equal(100);
      expect(failedIndices).to.have.lengthOf(0);
    });
  });

  describe("TC-SC-009: Batch Minting (exceeds limits)", function () {
    it("should revert when batch exceeds 100 requests", async function () {
      const requests = Array.from({ length: 101 }, (_, i) => ({
        recipient: ethers.Wallet.createRandom().address,
        amount: ethers.parseUnits("1", DECIMALS),
      }));

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      await expect(
        batchMinter.connect(minter).batchMint(await token.getAddress(), requests)
      ).to.be.revertedWith("Max 100 requests per batch");
    });

    it("should revert with empty requests", async function () {
      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      await expect(
        batchMinter.connect(minter).batchMint(await token.getAddress(), [])
      ).to.be.revertedWith("Empty requests");
    });
  });

  describe("TC-SC-010: Partial Failure Handling", function () {
    it("should emit MintFailed for failed mints and continue", async function () {
      // Deploy a token with small cap to trigger failures
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const smallCapToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        ethers.parseUnits("150", DECIMALS), // Small cap
        0,
        ethers.ZeroAddress
      );
      await smallCapToken.waitForDeployment();

      // Grant MINTER_ROLE to BatchMinter and minter
      const minterRole = await smallCapToken.MINTER_ROLE();
      await smallCapToken.grantRole(minterRole, minter.address);
      await smallCapToken.grantRole(minterRole, await batchMinter.getAddress());

      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) }, // Should succeed
        { recipient: recipient2.address, amount: ethers.parseUnits("100", DECIMALS) }, // Should fail (exceeds cap)
      ];

      const tx = await batchMinter.connect(minter).batchMint(await smallCapToken.getAddress(), requests);

      // First should succeed
      expect(await smallCapToken.balanceOf(recipient1.address)).to.equal(requests[0].amount);
      // Second should fail
      expect(await smallCapToken.balanceOf(recipient2.address)).to.equal(0);
    });

    it("should return correct failed indices", async function () {
      // Deploy a token with small cap
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const smallCapToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        ethers.parseUnits("100", DECIMALS),
        0,
        ethers.ZeroAddress
      );
      await smallCapToken.waitForDeployment();

      const minterRole = await smallCapToken.MINTER_ROLE();
      await smallCapToken.grantRole(minterRole, minter.address);
      await smallCapToken.grantRole(minterRole, await batchMinter.getAddress());

      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("50", DECIMALS) }, // Success
        { recipient: recipient2.address, amount: ethers.parseUnits("60", DECIMALS) }, // Fail
        { recipient: recipient3.address, amount: ethers.parseUnits("10", DECIMALS) }, // Success
      ];

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await smallCapToken.getAddress(), requests);

      expect(successCount).to.equal(2);
      expect(failedIndices).to.have.lengthOf(1);
      expect(failedIndices[0]).to.equal(1); // Index 1 failed
    });
  });

  describe("TC-SC-011: Authorization", function () {
    it("should revert when caller is not a minter", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
      ];

      await expect(
        batchMinter.connect(nonMinter).batchMint(await token.getAddress(), requests)
      ).to.be.revertedWith("Caller is not a minter");
    });

    it("should work when BatchMinter has MINTER_ROLE but caller is minter", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
      ];

      // Grant MINTER_ROLE to BatchMinter
      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      // Minter (who has MINTER_ROLE) calls BatchMinter
      await expect(
        batchMinter.connect(minter).batchMint(await token.getAddress(), requests)
      ).to.not.be.reverted;
    });

    it("should record failure when BatchMinter doesn't have MINTER_ROLE on token", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
      ];

      // minter has MINTER_ROLE, but BatchMinter contract doesn't
      // BatchMinter catches the error internally and records it as a failure
      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await token.getAddress(), requests);

      expect(successCount).to.equal(0);
      expect(failedIndices).to.have.lengthOf(1);
      expect(failedIndices[0]).to.equal(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle single request batch", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await token.getAddress(), requests);

      expect(successCount).to.equal(1);
      expect(failedIndices).to.have.lengthOf(0);
    });

    it("should handle zero amount mints", async function () {
      const requests = [
        { recipient: recipient1.address, amount: BigInt(0) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await token.getAddress(), requests);

      expect(successCount).to.equal(1);
    });

    it("should handle same recipient multiple times", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
        { recipient: recipient1.address, amount: ethers.parseUnits("200", DECIMALS) },
        { recipient: recipient1.address, amount: ethers.parseUnits("300", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      await batchMinter.connect(minter).batchMint(await token.getAddress(), requests);

      // Total should be 600
      expect(await token.balanceOf(recipient1.address)).to.equal(
        ethers.parseUnits("600", DECIMALS)
      );
    });

    it("should calculate correct total amount in event", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
        { recipient: recipient2.address, amount: ethers.parseUnits("200", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const expectedTotal = ethers.parseUnits("300", DECIMALS);

      await expect(batchMinter.connect(minter).batchMint(await token.getAddress(), requests))
        .to.emit(batchMinter, "BatchMintExecuted")
        .withArgs(
          await token.getAddress(),
          minter.address,
          2,
          expectedTotal
        );
    });
  });

  describe("Zero Address Handling", function () {
    it("should emit MintFailed for zero address recipient", async function () {
      const requests = [
        { recipient: ethers.ZeroAddress, amount: ethers.parseUnits("100", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await token.getAddress(), requests);

      expect(successCount).to.equal(0);
      expect(failedIndices).to.have.lengthOf(1);
      expect(failedIndices[0]).to.equal(0);
    });

    it("should continue processing after zero address failure", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
        { recipient: ethers.ZeroAddress, amount: ethers.parseUnits("100", DECIMALS) },
        { recipient: recipient2.address, amount: ethers.parseUnits("100", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await token.getAddress(), requests);

      expect(successCount).to.equal(2);
      expect(failedIndices).to.have.lengthOf(1);
      expect(failedIndices[0]).to.equal(1);
    });
  });

  describe("Multiple Failures", function () {
    it("should handle multiple consecutive failures", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const tinyCapToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        ethers.parseUnits("50", DECIMALS),
        0,
        ethers.ZeroAddress
      );
      await tinyCapToken.waitForDeployment();

      const minterRole = await tinyCapToken.MINTER_ROLE();
      await tinyCapToken.grantRole(minterRole, minter.address);
      await tinyCapToken.grantRole(minterRole, await batchMinter.getAddress());

      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("50", DECIMALS) },
        { recipient: recipient2.address, amount: ethers.parseUnits("10", DECIMALS) },
        { recipient: recipient3.address, amount: ethers.parseUnits("10", DECIMALS) },
      ];

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await tinyCapToken.getAddress(), requests);

      expect(successCount).to.equal(1);
      expect(failedIndices).to.have.lengthOf(2);
      expect(failedIndices[0]).to.equal(1);
      expect(failedIndices[1]).to.equal(2);
    });

    it("should handle all requests failing", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const fullCapToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        ethers.parseUnits("1", DECIMALS),
        ethers.parseUnits("1", DECIMALS),
        owner.address
      );
      await fullCapToken.waitForDeployment();

      const minterRole = await fullCapToken.MINTER_ROLE();
      await fullCapToken.grantRole(minterRole, minter.address);
      await fullCapToken.grantRole(minterRole, await batchMinter.getAddress());

      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("1", DECIMALS) },
        { recipient: recipient2.address, amount: ethers.parseUnits("1", DECIMALS) },
        { recipient: recipient3.address, amount: ethers.parseUnits("1", DECIMALS) },
      ];

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await fullCapToken.getAddress(), requests);

      expect(successCount).to.equal(0);
      expect(failedIndices).to.have.lengthOf(3);
    });
  });

  describe("Large Batch Operations", function () {
    it("should handle 50 requests efficiently", async function () {
      const requests = Array.from({ length: 50 }, () => ({
        recipient: ethers.Wallet.createRandom().address,
        amount: ethers.parseUnits("1", DECIMALS),
      }));

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await token.getAddress(), requests);

      expect(successCount).to.equal(50);
      expect(failedIndices).to.have.lengthOf(0);
    });

    it("should correctly track total amount for large batches", async function () {
      const numRequests = 20;
      const amountPerRequest = ethers.parseUnits("10", DECIMALS);
      const requests = Array.from({ length: numRequests }, () => ({
        recipient: ethers.Wallet.createRandom().address,
        amount: amountPerRequest,
      }));

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const expectedTotal = amountPerRequest * BigInt(numRequests);

      await expect(batchMinter.connect(minter).batchMint(await token.getAddress(), requests))
        .to.emit(batchMinter, "BatchMintExecuted")
        .withArgs(
          await token.getAddress(),
          minter.address,
          numRequests,
          expectedTotal
        );
    });
  });

  describe("Token State After Batch", function () {
    it("should correctly update total supply after batch mint", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
        { recipient: recipient2.address, amount: ethers.parseUnits("200", DECIMALS) },
        { recipient: recipient3.address, amount: ethers.parseUnits("300", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const initialSupply = await token.totalSupply();
      await batchMinter.connect(minter).batchMint(await token.getAddress(), requests);

      const expectedIncrease = ethers.parseUnits("600", DECIMALS);
      expect(await token.totalSupply()).to.equal(initialSupply + expectedIncrease);
    });

    it("should not affect token cap after batch mint", async function () {
      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", DECIMALS) },
      ];

      const minterRole = await token.MINTER_ROLE();
      await token.grantRole(minterRole, await batchMinter.getAddress());

      const capBefore = await token.cap();
      await batchMinter.connect(minter).batchMint(await token.getAddress(), requests);

      expect(await token.cap()).to.equal(capBefore);
    });
  });

  describe("Different Token Configurations", function () {
    it("should work with unlimited cap token", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const unlimitedToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        0,
        0,
        ethers.ZeroAddress
      );
      await unlimitedToken.waitForDeployment();

      const minterRole = await unlimitedToken.MINTER_ROLE();
      await unlimitedToken.grantRole(minterRole, minter.address);
      await unlimitedToken.grantRole(minterRole, await batchMinter.getAddress());

      const largeAmount = ethers.parseUnits("1000000", DECIMALS);
      const requests = [
        { recipient: recipient1.address, amount: largeAmount },
        { recipient: recipient2.address, amount: largeAmount },
      ];

      const [successCount, failedIndices] = await batchMinter
        .connect(minter)
        .batchMint.staticCall(await unlimitedToken.getAddress(), requests);

      expect(successCount).to.equal(2);
      expect(failedIndices).to.have.lengthOf(0);
    });

    it("should work with custom decimals token", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const customDecimalsToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        6,
        0,
        0,
        ethers.ZeroAddress
      );
      await customDecimalsToken.waitForDeployment();

      const minterRole = await customDecimalsToken.MINTER_ROLE();
      await customDecimalsToken.grantRole(minterRole, minter.address);
      await customDecimalsToken.grantRole(minterRole, await batchMinter.getAddress());

      const requests = [
        { recipient: recipient1.address, amount: ethers.parseUnits("100", 6) },
        { recipient: recipient2.address, amount: ethers.parseUnits("200", 6) },
      ];

      await batchMinter.connect(minter).batchMint(await customDecimalsToken.getAddress(), requests);

      expect(await customDecimalsToken.balanceOf(recipient1.address)).to.equal(
        ethers.parseUnits("100", 6)
      );
      expect(await customDecimalsToken.balanceOf(recipient2.address)).to.equal(
        ethers.parseUnits("200", 6)
      );
    });
  });
});
