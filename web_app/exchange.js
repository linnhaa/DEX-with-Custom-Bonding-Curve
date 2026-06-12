// DEX Web App Connection Logic

const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
let defaultAccount;

const $ = (selector) => document.querySelector(selector);

function setText(selector, value) {
    $(selector).textContent = value;
}

function setButtonLoading(button, text, disabled) {
    button.textContent = text;
    button.disabled = disabled;
}

function formatTokenAmount(value, maxDigits = 8) {
    return parseFloat(value).toLocaleString(undefined, {maximumFractionDigits: maxDigits});
}

function formatEstimate(value) {
    if (!Number.isFinite(value) || value <= 0) return "0";
    return value.toLocaleString(undefined, {maximumFractionDigits: 8});
}

async function updateSwapEstimate() {
    const amtIn = parseFloat($("#swap-amount").value);
    if(!amtIn || isNaN(amtIn)) {
        setText("#receive-amount", "0");
        return;
    }

    const choice = $("#swap-token-in").value;
    const isT1 = choice === "token1";
    setText("#receive-asset", isT1 ? "Y" : "X");

    const reserve0 = parseFloat(ethers.utils.formatEther(await amm_contract.reserve0()));
    const reserve1 = parseFloat(ethers.utils.formatEther(await amm_contract.reserve1()));
    let est;

    if (isT1) {
        est = ((reserve0 + amtIn) ** 3 - reserve0 ** 3) / 3;
        if (est >= reserve1) {
            setText("#receive-amount", "Insufficient pool");
            return;
        }
    } else {
        const nextX3 = reserve0 ** 3 - 3 * amtIn;
        if (nextX3 <= 0) {
            setText("#receive-amount", "Insufficient pool");
            return;
        }
        est = reserve0 - Math.cbrt(nextX3);
    }

    setText("#receive-amount", formatEstimate(est));
}

// Hardcoded default deterministic Hardhat addresses based on our deployment script
const TOKEN1_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TOKEN2_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const AMM_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

let token1_contract;
let token2_contract;
let amm_contract;

async function init() {
    try {
        const accounts = await provider.listAccounts();
        if(accounts.length === 0) return;
        
        defaultAccount = accounts[0];
        
        // Populate Accounts Dropdown
        const opts = accounts.map(a => `<option value="${a}">${a}</option>`);
        $("#myaccount").innerHTML = opts;
        
        setupContracts();
        await updateUI();
    } catch (e) {
        console.error("Local network not running. Run npx hardhat node first.");
    }
}

function setupContracts() {
    const signer = provider.getSigner(defaultAccount);
    token1_contract = new ethers.Contract(TOKEN1_ADDRESS, token_abi, signer);
    token2_contract = new ethers.Contract(TOKEN2_ADDRESS, token_abi, signer);
    amm_contract = new ethers.Contract(AMM_ADDRESS, amm_abi, signer);
}

// Update the entire UI state
async function updateUI() {
    if(!amm_contract) return;

    try {
        // Pool Reserves
        const res0 = await amm_contract.reserve0();
        const res1 = await amm_contract.reserve1();
        
        const ethRes0 = ethers.utils.formatEther(res0);
        const ethRes1 = ethers.utils.formatEther(res1);

        setText("#reserve0", formatTokenAmount(ethRes0) + " X");
        setText("#reserve1", formatTokenAmount(ethRes1) + " Y");

        // Price Estimates (Power Curve: Price X = A * X^2)
        // Let's assume A = 1 for the frontend just like the contract
        if (parseFloat(ethRes0) > 0) {
            const x = parseFloat(ethRes0);
            const px = x * x; // Since A=1
            setText("#price0", formatEstimate(px) + " Y");
            setText("#price1", formatEstimate(1/px) + " X");
        }

        // User Balances
        const bal0 = await token1_contract.balanceOf(defaultAccount);
        const bal1 = await token2_contract.balanceOf(defaultAccount);
        const lpBal = await amm_contract.balanceOf(defaultAccount);
        setText("#balance0", formatTokenAmount(ethers.utils.formatEther(bal0)));
        setText("#balance1", formatTokenAmount(ethers.utils.formatEther(bal1)));
        setText("#lp-balance", formatTokenAmount(ethers.utils.formatEther(lpBal)));
        
    } catch(e) {
        console.error("Error reading from contracts", e);
    }
}

// Interacting via Swap
$("#btn-swap").addEventListener("click", async function() {
    const tokenInChoice = $("#swap-token-in").value; // 'token1' or 'token2'
    const amtIn = $("#swap-amount").value;
    
    if(!amtIn || isNaN(amtIn) || parseFloat(amtIn) <= 0) return alert("Enter valid amount");

    const amtInWei = ethers.utils.parseEther(amtIn);
    
    try {
        setButtonLoading(this, "Swapping...", true);
        
        let tokenInAddress = tokenInChoice === "token1" ? TOKEN1_ADDRESS : TOKEN2_ADDRESS;
        let tokenInContract = tokenInChoice === "token1" ? token1_contract : token2_contract;

        // Approve
        const txApprove = await tokenInContract.approve(AMM_ADDRESS, amtInWei);
        await txApprove.wait();

        // Swap(address tokenIn, uint256 amountIn, uint256 minAmountOut)
        const txSwap = await amm_contract.swap(tokenInAddress, amtInWei, 0);
        await txSwap.wait();
        
        alert("Swap Successful!");
        $("#swap-amount").value = "";
        await updateUI();
    } catch(e) {
        console.error(e);
        alert("Swap failed: " + (e.reason || e.data?.message || e.message));
    } finally {
        setButtonLoading(this, "Swap", false);
    }
});

// Liquidity
$("#btn-add-liq").addEventListener("click", async function() {
    const amt0 = $("#add-liq-amount0").value;
    
    if(!amt0 || isNaN(amt0)) return alert("Enter valid X amount");

    const amt0Wei = ethers.utils.parseEther(amt0);
    
    try {
        setButtonLoading(this, "Adding...", true);
        
        await (await token1_contract.approve(AMM_ADDRESS, amt0Wei)).wait();
        await (await token2_contract.approve(AMM_ADDRESS, ethers.constants.MaxUint256)).wait();

        const tx = await amm_contract.addLiquidity(amt0Wei, 0);
        await tx.wait();
        
        alert("Liquidity Added!");
        $("#add-liq-amount0").value = "";
        await updateUI();
    } catch(e) {
        console.error(e);
        alert("Add liquidity failed: " + (e.reason || e.data?.message || e.message));
    } finally {
        setButtonLoading(this, "Add Liquidity", false);
    }
});

// Remove Liquidity
$("#btn-remove-liq").addEventListener("click", async function() {
    const shares = $("#remove-liq-shares").value;

    if(!shares || isNaN(shares) || parseFloat(shares) <= 0) return alert("Enter valid LP amount");

    const sharesWei = ethers.utils.parseEther(shares);

    try {
        setButtonLoading(this, "Removing...", true);

        const tx = await amm_contract.removeLiquidity(sharesWei, 0, 0);
        await tx.wait();

        alert("Liquidity Removed!");
        $("#remove-liq-shares").value = "";
        await updateUI();
    } catch(e) {
        console.error(e);
        alert("Remove liquidity failed: " + (e.reason || e.data?.message || e.message));
    } finally {
        setButtonLoading(this, "Remove Liquidity", false);
    }
});

// Account Switch
$("#myaccount").addEventListener("change", function() {
    defaultAccount = this.value;
    setupContracts();
    updateUI();
});

// Auto-fill estimated received dynamically locally (Optional frontend math)
$("#swap-amount").addEventListener("input", updateSwapEstimate);
$("#swap-token-in").addEventListener("change", updateSwapEstimate);

init();
