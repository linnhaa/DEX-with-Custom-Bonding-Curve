const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PowerCurveAMM - Power Curve P = A * x²", function () {
  let AMM, amm, Token, token0, token1, owner, user;
  const A = 1; // Giá trị A = 1 để test dễ tính toán

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy 2 token test (giả sử bạn có contract Token có hàm mint)
    Token = await ethers.getContractFactory("Token");
    token0 = await Token.deploy(); // Token0 (X)
    token1 = await Token.deploy(); // Token1 (Y)

    await token0.mint(ethers.utils.parseEther("10000"));
    await token1.mint(ethers.utils.parseEther("10000"));

    // Transfer cho user
    await token0.transfer(user.address, ethers.utils.parseEther("1000"));
    await token1.transfer(user.address, ethers.utils.parseEther("1000"));

    // Deploy AMM với A = 1
    AMM = await ethers.getContractFactory("PowerCurveAMM");
    amm = await AMM.deploy(token0.address, token1.address, A);
  });

  it("Should deploy correctly with correct parameters", async function () {
    expect(await amm.token0()).to.equal(token0.address);
    expect(await amm.token1()).to.equal(token1.address);
    expect(await amm.A()).to.equal(A);
    expect(await amm.totalSupply()).to.equal(0);
  });

  it("Should calculate correct spot price after initial liquidity (P = A * x²)", async function () {
    const x = ethers.utils.parseEther("100");
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // amount1 = A * x³ / 3 = 1 * 100³ / 3 ≈ 333333.333 ether
    await token1.mint(ethers.utils.parseEther("400000"));
    await token0.approve(amm.address, x);
    await token1.approve(amm.address, ethers.utils.parseEther("400000"));

    await amm.addLiquidity(x, 0, deadline);

    const spotPrice = await amm.getSpotPrice();
    // P = 1 * (100e18)² = 10.000 * 10³⁶ = 10⁴⁰
    const expectedPrice = ethers.BigNumber.from(10).pow(40);
    expect(spotPrice).to.equal(expectedPrice);
  });

  it("Should add initial liquidity and calculate amount1 correctly", async function () {
    const x = ethers.utils.parseEther("100");
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await token1.mint(ethers.utils.parseEther("400000"));
    await token0.approve(amm.address, x);
    await token1.approve(amm.address, ethers.utils.parseEther("400000"));

    const tx = await amm.addLiquidity(x, 0, deadline);
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "AddLiquidity");

    expect(event.args.amount0).to.equal(x);
    expect(event.args.amount1).to.be.gt(ethers.utils.parseEther("333000")); // ≈ 333333.33
    expect(await amm.totalSupply()).to.be.gt(0);
  });

  it("Should swap Token0 → Token1 correctly (Δy = A * (x_new³ - x_old³) / 3)", async function () {
    // Setup initial liquidity
    const x0 = ethers.utils.parseEther("100");
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    await token1.mint(ethers.utils.parseEther("400000"));
    await token0.approve(amm.address, x0);
    await token1.approve(amm.address, ethers.utils.parseEther("400000"));
    await amm.addLiquidity(x0, 0, deadline);

    // User swap 10 Token0
    const amountIn = ethers.utils.parseEther("10");
    await token0.connect(user).approve(amm.address, amountIn);

    const balanceBefore = await token1.balanceOf(user.address);
    await amm.connect(user).swap(token0.address, amountIn, 0, deadline);
    const balanceAfter = await token1.balanceOf(user.address);

    const received = balanceAfter.sub(balanceBefore);
    // Expected: (110³ - 100³)/3 = 331000 / 3 ≈ 110333.333 ether
    expect(received).to.be.gt(ethers.utils.parseEther("110000"));
    console.log(`✅ Received Token1: ${ethers.utils.formatEther(received)}`);
  });

  it("Should swap Token1 → Token0 correctly (cube root)", async function () {
    // Setup initial liquidity
    const x0 = ethers.utils.parseEther("100");
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    await token1.mint(ethers.utils.parseEther("400000"));
    await token0.approve(amm.address, x0);
    await token1.approve(amm.address, ethers.utils.parseEther("400000"));
    await amm.addLiquidity(x0, 0, deadline);

    const amountIn = ethers.utils.parseEther("100000"); // ~100k Token1
    await token1.mint(amountIn);
    await token1.transfer(user.address, amountIn);
    await token1.connect(user).approve(amm.address, amountIn);

    const balanceBefore = await token0.balanceOf(user.address);
    await amm.connect(user).swap(token1.address, amountIn, 0, deadline);
    const balanceAfter = await token0.balanceOf(user.address);

    const received = balanceAfter.sub(balanceBefore);
    expect(received).to.be.gt(0);
    console.log(`✅ Received Token0: ${ethers.utils.formatEther(received)}`);
  });

  it("Should remove liquidity correctly", async function () {
    // Add liquidity trước
    const x = ethers.utils.parseEther("100");
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    await token1.mint(ethers.utils.parseEther("400000"));
    await token0.approve(amm.address, x);
    await token1.approve(amm.address, ethers.utils.parseEther("400000"));
    await amm.addLiquidity(x, 0, deadline);

    const shares = await amm.balanceOf(owner.address);
    const minAmount0 = 0;
    const minAmount1 = 0;

    const tx = await amm.removeLiquidity(shares, minAmount0, minAmount1, deadline);
    await expect(tx).to.emit(amm, "RemoveLiquidity");
  });

  it("Should revert when slippage too high", async function () {
    // Add liquidity trước...
    const x = ethers.utils.parseEther("100");
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    await token1.mint(ethers.utils.parseEther("400000"));
    await token0.approve(amm.address, x);
    await token1.approve(amm.address, ethers.utils.parseEther("400000"));
    await amm.addLiquidity(x, 0, deadline);

    await token0.connect(user).approve(amm.address, ethers.utils.parseEther("10"));

    await expect(
      amm.connect(user).swap(token0.address, ethers.utils.parseEther("10"), ethers.utils.parseEther("200000"), deadline)
    ).to.be.revertedWith("Slippage on amountOut");
  });

  it("Should revert when deadline expired", async function () {
    const pastDeadline = Math.floor(Date.now() / 1000) - 3600;
    await expect(
      amm.swap(token0.address, ethers.utils.parseEther("1"), 0, pastDeadline)
    ).to.be.revertedWith("Expired");
  });

  it("Should preserve bonding curve invariant after swap", async function () {
    // Test này kiểm tra invariant y + A * x³ / 3 không thay đổi (chỉ approximate vì fixed-point)
    const x = ethers.utils.parseEther("100");
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    await token1.mint(ethers.utils.parseEther("400000"));
    await token0.approve(amm.address, x);
    await token1.approve(amm.address, ethers.utils.parseEther("400000"));
    await amm.addLiquidity(x, 0, deadline);

    const reserve0Before = await amm.reserve0();
    const reserve1Before = await amm.reserve1();

    await token0.connect(user).approve(amm.address, ethers.utils.parseEther("5"));
    await amm.connect(user).swap(token0.address, ethers.utils.parseEther("5"), 0, deadline);

    const reserve0After = await amm.reserve0();
    const reserve1After = await amm.reserve1();

    // Invariant nên gần như không đổi (chênh lệch chỉ do rounding)
    console.log("Invariant preserved (small rounding error expected)");
    const WAD = ethers.BigNumber.from("1000000000000000000");
    const x3Before = reserve0Before.mul(reserve0Before).div(WAD).mul(reserve0Before).div(WAD);
    const x3After = reserve0After.mul(reserve0After).div(WAD).mul(reserve0After).div(WAD);

    expect(reserve1After.add(x3After.div(3))).to.be.closeTo(
      reserve1Before.add(x3Before.div(3)),
      ethers.utils.parseEther("0.1") // tolerance nhỏ
    );
  });
});