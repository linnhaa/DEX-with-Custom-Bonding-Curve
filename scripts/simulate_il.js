
function calculateIL(priceRatio, w) {
    // Initial State: Let's assume initially P0 = 1, X0 = 100, Y0 = 100
    // Weight w for Token X, (1-w) for Token Y.
    // For UniV2: w = 0.5
    
    // Actually, to make initial P = 1, Y0/X0 * (1-w)/w = 1.
    // So Y0/X0 = w/(1-w).
    // Let's set X0 = 100. Then Y0 = 100 * w / (1-w).
    // Let's rethink to be completely fair. A user provides $1000 of liquidity.
    // Token X is 1$, Token Y is 1$. 
    // They provide X0 tokens and Y0 tokens such that w value is in X and (1-w) is in Y.
    // X0 = 1000 * w
    // Y0 = 1000 * (1-w)
    // Initial Price calculation for AMM (Internal Price): 
    // P_initial = (1-w)/w * (Y0/X0) = (1-w)/w * ((1-w)/w) ... wait!
    // If the market price is 1:1, and the pool matches the market:
    // P_initial = 1.
    // 1 = (1-w)/w * (Y0/X0)  =>  Y0/X0 = w / (1-w).
    // If X0 = w, Y0 = 1-w. But wait, then value of X0 = w * 1 = w, value of Y0 = 1-w.
    // That means the value ratio exactly matches the weight ratio. This is perfectly correct!
    
    const X0 = w;
    const Y0 = 1 - w;
    const K = Math.pow(X0, w) * Math.pow(Y0, 1 - w);
    
    // New Price = P
    const P = priceRatio;
    
    // Find new X and Y
    // P = ((1-w)/w) * (Y/X) => Y = P * X * w / (1-w)
    // K = X^w * Y^(1-w) = X^w * (P * X * w / (1-w))^(1-w)
    // K = X * (P * w / (1-w))^(1-w)
    
    const X_new = K / Math.pow(P * w / (1 - w), 1 - w);
    const Y_new = P * X_new * w / (1 - w);
    
    const V_pool = X_new * P + Y_new;
    const V_hold = X0 * P + Y0;
    
    const IL = (V_pool / V_hold) - 1;
    return IL * 100; // as percentage
}

async function main() {
    console.log("=== Impermanent Loss Comparison ===");
    console.log("Price Ratio | Uniswap V2 (w=0.5) | Weighted AMM (w=0.8)");
    console.log("---------------------------------------------------------");
    
    const priceRatios = [0.25, 0.5, 0.8, 1.0, 1.25, 2.0, 4.0, 5.0];
    
    for (let p of priceRatios) {
        const il_uni = calculateIL(p, 0.5).toFixed(2);
        const il_weight = calculateIL(p, 0.8).toFixed(2);
        
        console.log(`${p.toFixed(2).padStart(11)} | ${il_uni.padStart(17)}% | ${il_weight.padStart(21)}%`);
    }
}

main().catch(console.error);
