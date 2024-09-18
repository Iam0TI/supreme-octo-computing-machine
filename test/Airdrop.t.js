const {
  time,
  loadFixture,
  helpers,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { generateProof } = require("../script/createMerkleProof");

const ONE_WEEK = 7 * 24 * 3600;
// Define the expected total supply (1 million tokens with 18 decimals)
const tokenTotalSupply = ethers.parseUnits("1000000", 18);
describe("Airdrop", function () {
  // Fixture for deploying the Web3CXI token contract
  async function deployTokenFixture() {
    // Get the first signer (account) as the owner
    const [owner] = await hre.ethers.getSigners();

    // Deploy the ERC20 token contract (Web3CXI)
    const erc20Token = await hre.ethers.getContractFactory("Web3CXI");
    const token = await erc20Token.deploy();

    // Return the deployed token contract and owner
    return { token, owner };
  }

  // Fixture for deploying the MerkleDrop contract
  async function delpoymerkleDropFixture() {
    // Load the token fixture to get the deployed token contract
    const { token } = await loadFixture(deployTokenFixture);

    // Get three signers: owner, other, and acct1
    const [owner, other, acct1] = await hre.ethers.getSigners();

    // Predefined Merkle root to use in the MerkleDrop contract generated using the createMerkleproof.js
    const merkleRoot =
      "0x271f3bd61ea1309ee07a21a036a78e24e0547d0502c6ffb7348e7b2d66fa6aa8";

    // Deploy the MerkleDrop contract with the token address and Merkle root
    const merkleDrop = await hre.ethers.getContractFactory("MerkleDrop");
    const merkleDropAddress = await merkleDrop.deploy(token, merkleRoot, 3);

    // Return the deployed contracts and other relevant data
    return { token, owner, other, merkleDropAddress, merkleRoot, acct1 };
  }

  // Tests for the ADT token deployment
  describe("ADT Deployment", function () {
    it("Should mint the right 1 Million tokens", async function () {
      // Load the token fixture
      const { token } = await loadFixture(deployTokenFixture);

      // Assert that the total supply is correct
      await expect(await token.totalSupply()).to.equal(tokenTotalSupply);
    });
    it("Should have the right name", async function () {
      // Load the token fixture
      const { token } = await loadFixture(deployTokenFixture);

      // Define the expected total supply (1 million tokens with 18 decimals)
      const tokenName = "Airdrop Token";

      // Assert that the total supply is correct
      await expect(await token.name()).to.equal(tokenName);
    });
    it("Should have the right symbol", async function () {
      // Load the token fixture
      const { token } = await loadFixture(deployTokenFixture);

      // Define the expected total supply (1 million tokens with 18 decimals)
      const tokenSymbol = "ADT";

      // Assert that the total supply is correct
      await expect(await token.symbol()).to.equal(tokenSymbol);
    });
  });

  // Tests for the MerkleDrop contract deployment
  describe("MerkleDrop Deployment", function () {
    it("Should set the correct Merkle root", async function () {
      // Load the MerkleDrop fixture
      const { merkleDropAddress, merkleRoot } = await loadFixture(
        delpoymerkleDropFixture
      );

      // Assert that the Merkle root is set correctly in the contract
      await expect(await merkleDropAddress.merkleRoot()).to.equal(merkleRoot);
    });

    it("Should set the correct token address", async function () {
      // Load the MerkleDrop fixture
      const { token, merkleDropAddress } = await loadFixture(
        delpoymerkleDropFixture
      );

      // Assert that the token address is correctly set in the MerkleDrop contract
      await expect(token).to.equal(await merkleDropAddress.tokenAddress());
    });

    it("Should have the correct owner", async function () {
      // Load the MerkleDrop fixture
      const { owner, merkleDropAddress } = await loadFixture(
        delpoymerkleDropFixture
      );

      // Assert that the owner address is correctly set in the MerkleDrop contract
      await expect(owner.address).to.equal(await merkleDropAddress.owner());
    });

    it("Should have the correct ending time", async function () {
      // Load the MerkleDrop fixture
      const { merkleDropAddress } = await loadFixture(delpoymerkleDropFixture);

      // Assert that the owner address is correctly set in the MerkleDrop contract
      const newBlock = await ethers.provider.getBlock("latest");
      await expect(newBlock.timestamp + 3 * ONE_WEEK).to.equal(
        await merkleDropAddress.endingTime()
      );
    });
  });

  // Tests for the airdrop function in the MerkleDrop contract
  describe(" Claim Airdrop ", function () {
    describe("Validation", function () {
      it("Should revert if claim is not active", async function () {
        const { token, owner, merkleDropAddress, merkleRoot, acct1 } =
          await loadFixture(delpoymerkleDropFixture);

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);

        // generating Merkle proof for  0xa53cf9e377334e7da7550e644b815cc5cb74af23
        const address = "0xa53cf9e377334e7da7550e644b815cc5cb74af23";
        const { value, proof } = generateProof(address);
        const amount = ethers.parseUnits("10", 18);

        await time.increaseTo((await time.latest()) + 4 * ONE_WEEK);
        await expect(
          merkleDropAddress.connect(acct1).claimAirDrop(proof, 0n, amount)
        ).to.be.revertedWithCustomError(merkleDropAddress, "ClaimingEnded");
      });

      it.only("Should revert if user has claimed already", async function () {
        const { token, other, merkleDropAddress, merkleRoot } =
          await loadFixture(delpoymerkleDropFixture);

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);
        const address = "0xa53cf9e377334e7da7550e644b815cc5cb74af23";
        // await hre.network.provider.request({
        //   method: "hardhat_impersonateAccount",
        //   params: ["0xa53cf9e377334e7da7550e644b815cc5cb74af23"],
        // });
        // const provider = ethers.getDefaultProvider("http://localhost:8545");
        // const signer = await provider.getSigner(
        //   "0xa53cf9e377334e7da7550e644b815cc5cb74af23"
        // );
        let provider;
        if (network.config.url !== undefined) {
          provider = new ethers.providers.JsonRpcProvider(network.config.url);
        } else {
          // if network.config.url is undefined, then this is the hardhat network
          provider = hre.ethers.provider;
        }

        await provider.send("hardhat_impersonateAccount", [address]);
        const signer = provider.getSigner(address);
        // await helpers.impersonateAccount(address);
        // const impersonatedSigner = await ethers.getSigner(address);

        // generating Merkle proof for  0xa53cf9e377334e7da7550e644b815cc5cb74af23

        const { value, proof } = generateProof(address);
        const amount = ethers.parseUnits("10", 18);

        await merkleDropAddress.connect(signer).claimAirDrop(proof, 0n, amount);
        await expect(
          merkleDropAddress.connect(signer).claimAirDrop(proof, 0n, amount)
        ).to.be.revertedWithCustomError(merkleDropAddress, "AlreadyClaimed");

        // await hre.network.provider.request({
        //   method: "hardhat_stopImpersonatingAccount",
        //   params: [address],
        // });
      });

      it("Should revert if caller is not in the claim list", async function () {
        const { token, other, merkleDropAddress, merkleRoot, owner } =
          await loadFixture(delpoymerkleDropFixture);

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);

        // generating Merkle proof for  0x383f7adecd735684563af9c2a8e2f5c79808fc83
        const address = "0x383f7adecd735684563af9c2a8e2f5c79808fc83";
        const { value, proof } = generateProof(address);
        const amount = ethers.parseUnits("60", 18);

        // we are using the owner to call the function since the  owner is not in the claim it should revert  hopefully
        await expect(
          merkleDropAddress.claimAirDrop(proof, 0n, amount)
        ).to.be.revertedWithCustomError(merkleDropAddress, "InvalidProof");
      });
    });
    describe("Transfer", function () {
      it("Should transfer token to user", async function () {
        const { token, merkleDropAddress, acct1 } = await loadFixture(
          delpoymerkleDropFixture
        );

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);

        // generating Merkle proof for  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
        const address = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
        const { value, proof } = generateProof(address);
        const amount = ethers.parseUnits("20", 18);
        // Claim the airdrop using the proof and amount
        await merkleDropAddress.connect(acct1).claimAirDrop(proof, 1n, amount);

        // Assert that the account has received the correct amount of tokens
        await expect(await token.balanceOf(acct1.address)).to.equal(amount);
      });
    });
    describe("Events", function () {
      it("Should emit an event on claimed AirDrop", async function () {
        const { token, other, merkleDropAddress, merkleRoot, owner } =
          await loadFixture(delpoymerkleDropFixture);

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);

        // generating Merkle proof for  0x47ad7b5f38d184491b28b716718e4987f70c9820
        const address = "0x47ad7b5f38d184491b28b716718e4987f70c9820";
        const { value, proof } = generateProof(address);
        const amount = ethers.parseUnits("80", 18);

        await expect(
          await merkleDropAddress.connect(other).claimAirDrop(proof, 7n, amount)
        )
          .to.emit(merkleDropAddress, "claimedAirDrop")
          .withArgs(address, amount); // We accept any value as `when` arg
      });
    });
  });

  describe("Withdraw Token", function () {
    describe("Validations", function () {
      it("Should revert with the right error if called too soon", async function () {
        const { token, merkleDropAddress } = await loadFixture(
          delpoymerkleDropFixture
        );

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);
        await expect(
          merkleDropAddress.withdrawToken()
        ).to.be.revertedWithCustomError(merkleDropAddress, "AirdropIsActive");
      });

      it("Should revert with the right error if called from another account", async function () {
        const { token, merkleDropAddress, other } = await loadFixture(
          delpoymerkleDropFixture
        );

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);
        // We can increase the time in Hardhat Network

        await time.increaseTo((await time.latest()) + 4 * ONE_WEEK);

        // We use lock.connect() to send a transaction from another account
        await expect(
          merkleDropAddress.connect(other).withdrawToken()
        ).to.be.revertedWithCustomError(merkleDropAddress, "NotOwner");
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { token, merkleDropAddress } = await loadFixture(
          delpoymerkleDropFixture
        );

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);
        // We can increase the time in Hardhat Network

        await time.increaseTo((await time.latest()) + 4 * ONE_WEEK);
        await expect(merkleDropAddress.withdrawToken()).not.to.be.reverted;
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { token, merkleDropAddress } = await loadFixture(
          delpoymerkleDropFixture
        );

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);
        // We can increase the time in Hardhat Network

        await time.increaseTo((await time.latest()) + 4 * ONE_WEEK);
        await expect(merkleDropAddress.withdrawToken()).to.emit(
          merkleDropAddress,
          "OwnerWithdraw"
        ); // We accept any value as `when` arg
      });
    });

    describe("Transfers", function () {
      it("Should transfer the funds to the owner", async function () {
        const { token, merkleDropAddress, owner } = await loadFixture(
          delpoymerkleDropFixture
        );

        // Transfer the tokens to the MerkleDrop contract to fund the airdrop
        await token.transfer(merkleDropAddress, tokenTotalSupply);
        // We can increase the time in Hardhat Network

        // We can increase the time in Hardhat Network

        await time.increaseTo((await time.latest()) + 4 * ONE_WEEK);
        await merkleDropAddress.withdrawToken();
        await expect(await token.balanceOf(owner.address)).to.equal(
          tokenTotalSupply
        );
      });
    });
  });
});
