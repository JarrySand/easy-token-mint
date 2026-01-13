import { expect } from "chai";
import hre from "hardhat";
import { MintableToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const { ethers } = hre;

describe("MintableToken", function () {
  let token: MintableToken;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let user: SignerWithAddress;

  const TOKEN_NAME = "Test Token";
  const TOKEN_SYMBOL = "TEST";
  const DECIMALS = 18;
  const CAP = ethers.parseUnits("1000000", DECIMALS); // 1 million tokens
  const INITIAL_SUPPLY = ethers.parseUnits("1000", DECIMALS); // 1000 tokens

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();

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
  });

  describe("Deployment", function () {
    it("TC-SC-001: should deploy with correct parameters", async function () {
      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
      expect(await token.decimals()).to.equal(DECIMALS);
      expect(await token.cap()).to.equal(CAP);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const adminRole = await token.DEFAULT_ADMIN_ROLE();
      expect(await token.hasRole(adminRole, owner.address)).to.be.true;
    });

    it("should grant MINTER_ROLE to deployer", async function () {
      const minterRole = await token.MINTER_ROLE();
      expect(await token.hasRole(minterRole, owner.address)).to.be.true;
    });

    it("should deploy with no initial supply", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const noInitialToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        CAP,
        0, // No initial supply
        ethers.ZeroAddress
      );
      await noInitialToken.waitForDeployment();

      expect(await noInitialToken.totalSupply()).to.equal(0);
    });

    it("should deploy with unlimited cap (cap = 0)", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const unlimitedToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        0, // No cap (unlimited)
        INITIAL_SUPPLY,
        owner.address
      );
      await unlimitedToken.waitForDeployment();

      expect(await unlimitedToken.hasCap()).to.be.false;
    });

    it("should revert if initial supply with zero holder address", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");

      await expect(
        MintableTokenFactory.deploy(
          TOKEN_NAME,
          TOKEN_SYMBOL,
          DECIMALS,
          CAP,
          INITIAL_SUPPLY,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Initial holder is zero address");
    });

    it("TC-SC-007: should support custom decimals", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const customDecimalsToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        6, // 6 decimals like USDC
        0,
        0,
        ethers.ZeroAddress
      );
      await customDecimalsToken.waitForDeployment();

      expect(await customDecimalsToken.decimals()).to.equal(6);
    });
  });

  describe("Minting", function () {
    it("TC-SC-002: should allow MINTER_ROLE to mint", async function () {
      const mintAmount = ethers.parseUnits("100", DECIMALS);

      await token.mint(user.address, mintAmount);

      expect(await token.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("TC-SC-003: should revert when non-minter tries to mint", async function () {
      const mintAmount = ethers.parseUnits("100", DECIMALS);

      await expect(
        token.connect(user).mint(user.address, mintAmount)
      ).to.be.reverted;
    });

    it("TC-SC-004: should revert when minting exceeds cap", async function () {
      const remainingCap = CAP - INITIAL_SUPPLY;
      const exceedAmount = remainingCap + BigInt(1);

      await expect(
        token.mint(user.address, exceedAmount)
      ).to.be.revertedWithCustomError(token, "ERC20ExceededCap");
    });

    it("should mint to zero address and revert", async function () {
      const mintAmount = ethers.parseUnits("100", DECIMALS);

      await expect(
        token.mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });

    it("should emit Transfer event on mint", async function () {
      const mintAmount = ethers.parseUnits("100", DECIMALS);

      await expect(token.mint(user.address, mintAmount))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, mintAmount);
    });

    it("should allow multiple mints up to cap", async function () {
      const mintAmount = ethers.parseUnits("1000", DECIMALS);

      // Mint multiple times
      for (let i = 0; i < 10; i++) {
        await token.mint(user.address, mintAmount);
      }

      expect(await token.balanceOf(user.address)).to.equal(mintAmount * BigInt(10));
    });
  });

  describe("Role Management", function () {
    it("TC-SC-005: should allow admin to grant MINTER_ROLE", async function () {
      const minterRole = await token.MINTER_ROLE();

      await token.grantRole(minterRole, minter.address);

      expect(await token.hasRole(minterRole, minter.address)).to.be.true;
    });

    it("TC-SC-006: should allow admin to revoke MINTER_ROLE", async function () {
      const minterRole = await token.MINTER_ROLE();

      // Grant then revoke
      await token.grantRole(minterRole, minter.address);
      await token.revokeRole(minterRole, minter.address);

      expect(await token.hasRole(minterRole, minter.address)).to.be.false;
    });

    it("should emit RoleGranted event", async function () {
      const minterRole = await token.MINTER_ROLE();

      await expect(token.grantRole(minterRole, minter.address))
        .to.emit(token, "RoleGranted")
        .withArgs(minterRole, minter.address, owner.address);
    });

    it("should emit RoleRevoked event", async function () {
      const minterRole = await token.MINTER_ROLE();

      await token.grantRole(minterRole, minter.address);

      await expect(token.revokeRole(minterRole, minter.address))
        .to.emit(token, "RoleRevoked")
        .withArgs(minterRole, minter.address, owner.address);
    });

    it("should not allow non-admin to grant roles", async function () {
      const minterRole = await token.MINTER_ROLE();

      await expect(
        token.connect(user).grantRole(minterRole, user.address)
      ).to.be.reverted;
    });

    it("should not allow non-admin to revoke roles", async function () {
      const minterRole = await token.MINTER_ROLE();

      await expect(
        token.connect(user).revokeRole(minterRole, owner.address)
      ).to.be.reverted;
    });

    it("should allow minter with granted role to mint", async function () {
      const minterRole = await token.MINTER_ROLE();
      const mintAmount = ethers.parseUnits("100", DECIMALS);

      await token.grantRole(minterRole, minter.address);
      await token.connect(minter).mint(user.address, mintAmount);

      expect(await token.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("should not allow revoked minter to mint", async function () {
      const minterRole = await token.MINTER_ROLE();
      const mintAmount = ethers.parseUnits("100", DECIMALS);

      await token.grantRole(minterRole, minter.address);
      await token.revokeRole(minterRole, minter.address);

      await expect(
        token.connect(minter).mint(user.address, mintAmount)
      ).to.be.reverted;
    });
  });

  describe("ERC20 Standard Functions", function () {
    it("should transfer tokens", async function () {
      const transferAmount = ethers.parseUnits("100", DECIMALS);

      await token.transfer(user.address, transferAmount);

      expect(await token.balanceOf(user.address)).to.equal(transferAmount);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - transferAmount);
    });

    it("should approve and transferFrom", async function () {
      const approveAmount = ethers.parseUnits("100", DECIMALS);

      await token.approve(user.address, approveAmount);
      await token.connect(user).transferFrom(owner.address, minter.address, approveAmount);

      expect(await token.balanceOf(minter.address)).to.equal(approveAmount);
    });

    it("should return correct allowance", async function () {
      const approveAmount = ethers.parseUnits("100", DECIMALS);

      await token.approve(user.address, approveAmount);

      expect(await token.allowance(owner.address, user.address)).to.equal(approveAmount);
    });
  });

  describe("Edge Cases", function () {
    it("should handle mint of 0 tokens", async function () {
      await expect(token.mint(user.address, 0)).to.not.be.reverted;
      expect(await token.balanceOf(user.address)).to.equal(0);
    });

    it("should track total supply correctly", async function () {
      const mintAmount = ethers.parseUnits("500", DECIMALS);

      await token.mint(user.address, mintAmount);
      await token.mint(minter.address, mintAmount);

      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount * BigInt(2));
    });

    it("should have correct cap after multiple mints", async function () {
      // Cap should remain constant
      expect(await token.cap()).to.equal(CAP);

      await token.mint(user.address, ethers.parseUnits("100", DECIMALS));

      // Cap should still be the same
      expect(await token.cap()).to.equal(CAP);
    });
  });

  describe("Admin Role Management", function () {
    it("should allow admin to transfer admin role to another address", async function () {
      const adminRole = await token.DEFAULT_ADMIN_ROLE();

      // Grant admin role to minter
      await token.grantRole(adminRole, minter.address);
      expect(await token.hasRole(adminRole, minter.address)).to.be.true;

      // New admin can grant roles
      const minterRole = await token.MINTER_ROLE();
      await token.connect(minter).grantRole(minterRole, user.address);
      expect(await token.hasRole(minterRole, user.address)).to.be.true;
    });

    it("should allow role holder to renounce their own role", async function () {
      const minterRole = await token.MINTER_ROLE();

      // Owner renounces MINTER_ROLE
      await token.renounceRole(minterRole, owner.address);

      expect(await token.hasRole(minterRole, owner.address)).to.be.false;
    });

    it("should not allow renouncing role for another address", async function () {
      const minterRole = await token.MINTER_ROLE();

      await token.grantRole(minterRole, minter.address);

      // User cannot renounce minter's role
      await expect(
        token.connect(user).renounceRole(minterRole, minter.address)
      ).to.be.reverted;
    });

    it("should allow admin to grant admin role and then be revoked", async function () {
      const adminRole = await token.DEFAULT_ADMIN_ROLE();

      // Grant admin to minter
      await token.grantRole(adminRole, minter.address);

      // Minter revokes owner's admin role
      await token.connect(minter).revokeRole(adminRole, owner.address);

      expect(await token.hasRole(adminRole, owner.address)).to.be.false;
      expect(await token.hasRole(adminRole, minter.address)).to.be.true;
    });
  });

  describe("Supply Cap Edge Cases", function () {
    it("should revert when initial supply exceeds cap", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const smallCap = ethers.parseUnits("100", DECIMALS);
      const largeInitialSupply = ethers.parseUnits("200", DECIMALS);

      await expect(
        MintableTokenFactory.deploy(
          TOKEN_NAME,
          TOKEN_SYMBOL,
          DECIMALS,
          smallCap,
          largeInitialSupply,
          owner.address
        )
      ).to.be.revertedWithCustomError(token, "ERC20ExceededCap");
    });

    it("should allow minting exactly to cap", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const exactCap = ethers.parseUnits("1000", DECIMALS);
      const exactCapToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        exactCap,
        0,
        ethers.ZeroAddress
      );
      await exactCapToken.waitForDeployment();

      // Mint exactly to cap
      await exactCapToken.mint(user.address, exactCap);

      expect(await exactCapToken.totalSupply()).to.equal(exactCap);
      expect(await exactCapToken.balanceOf(user.address)).to.equal(exactCap);
    });

    it("should allow unlimited minting when cap is 0", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const unlimitedToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        0, // No cap
        0,
        ethers.ZeroAddress
      );
      await unlimitedToken.waitForDeployment();

      // Mint a very large amount
      const largeAmount = ethers.parseUnits("1000000000", DECIMALS); // 1 billion
      await unlimitedToken.mint(user.address, largeAmount);

      expect(await unlimitedToken.balanceOf(user.address)).to.equal(largeAmount);
    });

    it("should return max uint256 as cap when hasCap is false", async function () {
      const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
      const unlimitedToken = await MintableTokenFactory.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DECIMALS,
        0, // No cap
        0,
        ethers.ZeroAddress
      );
      await unlimitedToken.waitForDeployment();

      const maxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      expect(await unlimitedToken.cap()).to.equal(maxUint256);
    });
  });

  describe("Transfer Edge Cases", function () {
    it("should revert transfer to zero address", async function () {
      const transferAmount = ethers.parseUnits("100", DECIMALS);

      await expect(
        token.transfer(ethers.ZeroAddress, transferAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });

    it("should revert transfer exceeding balance", async function () {
      const exceedAmount = INITIAL_SUPPLY + BigInt(1);

      await expect(
        token.transfer(user.address, exceedAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("should revert transferFrom exceeding allowance", async function () {
      const approveAmount = ethers.parseUnits("100", DECIMALS);
      const exceedAmount = approveAmount + BigInt(1);

      await token.approve(user.address, approveAmount);

      await expect(
        token.connect(user).transferFrom(owner.address, minter.address, exceedAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("should allow self-transfer", async function () {
      const amount = ethers.parseUnits("100", DECIMALS);
      const initialBalance = await token.balanceOf(owner.address);

      await token.transfer(owner.address, amount);

      expect(await token.balanceOf(owner.address)).to.equal(initialBalance);
    });

    it("should handle transfer of 0 tokens", async function () {
      await expect(token.transfer(user.address, 0)).to.not.be.reverted;
      expect(await token.balanceOf(user.address)).to.equal(0);
    });
  });

  describe("Multiple Minters Scenario", function () {
    it("should allow multiple minters to mint independently", async function () {
      const minterRole = await token.MINTER_ROLE();
      const mintAmount = ethers.parseUnits("100", DECIMALS);

      // Grant MINTER_ROLE to minter
      await token.grantRole(minterRole, minter.address);

      // Both owner and minter mint
      await token.mint(user.address, mintAmount);
      await token.connect(minter).mint(user.address, mintAmount);

      expect(await token.balanceOf(user.address)).to.equal(mintAmount * BigInt(2));
    });

    it("should allow revoking one minter without affecting others", async function () {
      const minterRole = await token.MINTER_ROLE();
      const mintAmount = ethers.parseUnits("100", DECIMALS);

      // Grant MINTER_ROLE to minter
      await token.grantRole(minterRole, minter.address);

      // Revoke from minter
      await token.revokeRole(minterRole, minter.address);

      // Owner can still mint
      await expect(token.mint(user.address, mintAmount)).to.not.be.reverted;

      // Minter cannot mint
      await expect(
        token.connect(minter).mint(user.address, mintAmount)
      ).to.be.reverted;
    });
  });
});
