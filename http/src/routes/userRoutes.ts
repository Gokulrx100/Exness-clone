import { Router } from "express";
import { trades, findUserById, calculatePnL, assetPrices } from "../services/dataStore.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { USD_DECIMAL } from "../config/constants.js";

export const userRoutes = Router();

userRoutes.get("/balance", authenticateToken, (req: any, res) => {
  try {
    const userId = req.userId;
    const user = findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const openTrades = trades.filter(t => t.userId === userId && t.status === "open");
    let unrealizedPnL = BigInt(0);
    
    for (const trade of openTrades) {
      const assetPrice = assetPrices.get(trade.asset);
      if (assetPrice) {
        const currentPrice = trade.type === "buy" ? assetPrice.sellPrice : assetPrice.buyPrice;
        unrealizedPnL += calculatePnL(trade, currentPrice);
      }
    }

    res.status(200).json({ 
      balanceValue: user.balance.toString(),
      balanceDecimals: USD_DECIMAL,
      unrealizedPnLValue: unrealizedPnL.toString(),
      unrealizedPnLDecimals: USD_DECIMAL,
      totalEquityValue: (user.balance + unrealizedPnL).toString(),
      totalEquityDecimals: USD_DECIMAL
    });
  } catch (err) {
    console.error("Get balance error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});