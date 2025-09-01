// routes/tradeRoutes.ts
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  trades,
  assetPrices,
  findUserById,
  calculatePnL,
  calculateLiquidationPrice,
  applySlippage,
} from "../services/dataStore.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { emailQueue } from "../services/emailServices.js";
import {
  ALLOWED_LEVERAGE,
  ALLOWED_SLIPPAGE_BPS,
  ASSET_CONFIG,
  USD_DECIMAL,
} from "../config/constants.js";
import type { Trade } from "../types/interfaces.js";

export const tradeRoutes = Router();

const closeTrade = async (trade: Trade, closePrice: bigint, reason: string) => {
  const executionPrice = applySlippage(
    closePrice,
    trade.slippageBps,
    trade.type === "buy" ? "sell" : "buy"
  );
  const pnl = calculatePnL(trade, executionPrice);

  trade.closePrice = executionPrice;
  trade.pnl = pnl;
  trade.status = reason as any;
  trade.closedAt = new Date();
  trade.executionPrice = executionPrice;

  const user = findUserById(trade.userId);
  if (user) {
    user.balance += trade.margin + pnl;
  }

  await emailQueue.add("trade-closed", {
    userId: trade.userId,
    userEmail: user?.email,
    trade: {
      orderId: trade.orderId,
      asset: trade.asset,
      type: trade.type,
      margin: Number(trade.margin) / 10 ** USD_DECIMAL,
      leverage: trade.leverage,
      openPrice:
        Number(trade.openPrice) /
        10 ** ASSET_CONFIG[trade.asset as keyof typeof ASSET_CONFIG].decimals,
      closePrice:
        Number(executionPrice) /
        10 ** ASSET_CONFIG[trade.asset as keyof typeof ASSET_CONFIG].decimals,
      pnl: Number(pnl) / 10 ** USD_DECIMAL,
      reason: reason,
    },
  });
};

tradeRoutes.post("/trade", authenticateToken, async (req: any, res) => {
  try {
    const { asset, type, margin, leverage, stopLoss, takeProfit, slippageBps } =
      req.body;
    const userId = req.userId;

    if (!asset || !type || !margin || !leverage) {
      return res
        .status(400)
        .json({ message: "Required fields cannot be empty" });
    }

    if (type !== "buy" && type !== "sell") {
      return res.status(401).json({ message: "Type must be 'buy' or 'sell'" });
    }

    if (!ALLOWED_LEVERAGE.includes(leverage)) {
      return res.status(401).json({ message: "Invalid leverage" });
    }

    const userSlippageBps = BigInt(slippageBps || 5);
    if (!ALLOWED_SLIPPAGE_BPS.includes(Number(userSlippageBps))) {
      return res.status(401).json({ message: "Invalid slippage" });
    }

    if (!ASSET_CONFIG[asset as keyof typeof ASSET_CONFIG]) {
      return res.status(401).json({ message: "Invalid asset" });
    }

    const user = findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const marginBigInt = BigInt(Math.floor(margin * 100));
    if (marginBigInt <= 0 || user.balance < marginBigInt) {
      return res.status(411).json({ message: "Insufficient margin" });
    }

    const assetPrice = assetPrices.get(asset);
    if (!assetPrice) {
      return res.status(400).json({ error: "Asset price not available" });
    }

    const basePrice =
      type === "buy" ? assetPrice.buyPrice : assetPrice.sellPrice;
    const executionPrice = applySlippage(basePrice, userSlippageBps, type);

    user.balance -= marginBigInt;

    const orderId = uuidv4();
    const assetConfig = ASSET_CONFIG[asset as keyof typeof ASSET_CONFIG];

    const newTrade: Trade = {
      orderId,
      userId,
      asset,
      type,
      margin: marginBigInt,
      leverage,
      openPrice: executionPrice,
      slippageBps: userSlippageBps,
      status: "open",
      liquidationPrice: BigInt(0),
      createdAt: new Date(),
      executionPrice: executionPrice,
    };

    if (stopLoss) {
      newTrade.stopLoss = BigInt(
        Math.floor(stopLoss * 10 ** assetConfig.decimals)
      );
    }
    if (takeProfit) {
      newTrade.takeProfit = BigInt(
        Math.floor(takeProfit * 10 ** assetConfig.decimals)
      );
    }

    newTrade.liquidationPrice = calculateLiquidationPrice(newTrade);
    trades.push(newTrade);

    // Queue email notification
    await emailQueue.add("trade-opened", {
      userId: userId,
      userEmail: user.email,
      trade: {
        orderId: orderId,
        asset: asset,
        type: type,
        margin: Number(marginBigInt) / 10 ** USD_DECIMAL, 
        leverage: leverage,
        openPrice: Number(executionPrice) / 10 ** assetConfig.decimals,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
      },
    });

    res.status(200).json({
      orderId: orderId,
      executionPriceValue: executionPrice.toString(),
      executionPriceDecimals: assetConfig.decimals,
      liquidationPriceValue: newTrade.liquidationPrice.toString(),
      liquidationPriceDecimals: assetConfig.decimals,
      slippageAppliedValue: (executionPrice - basePrice).toString(),
      slippageAppliedDecimals: assetConfig.decimals,
    });
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

tradeRoutes.post(
  "/trade/:orderId/close",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.userId;

      const trade = trades.find(
        (t) =>
          t.orderId === orderId && t.userId === userId && t.status === "open"
      );
      if (!trade) {
        return res
          .status(404)
          .json({ error: "Trade not found or already closed" });
      }

      const assetPrice = assetPrices.get(trade.asset);
      if (!assetPrice) {
        return res.status(400).json({ error: "Asset price not available" });
      }

      const currentPrice =
        trade.type === "buy" ? assetPrice.sellPrice : assetPrice.buyPrice;
      await closeTrade(trade, currentPrice, "closed");

      res.status(200).json({
        message: "Trade closed successfully",
        executionPrice: Number(trade.executionPrice),
        pnl: Number(trade.pnl),
      });
    } catch (err) {
      console.error("Close trade error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

tradeRoutes.get("/trades/open", authenticateToken, (req: any, res) => {
  try {
    const userId = req.userId;
    const userOpenTrades = trades.filter(
      (t) => t.userId === userId && t.status === "open"
    );

    const formattedTrades = userOpenTrades.map((trade) => {
      const assetPrice = assetPrices.get(trade.asset);
      const currentPrice = assetPrice
        ? trade.type === "buy"
          ? assetPrice.sellPrice
          : assetPrice.buyPrice
        : BigInt(0);
      const currentPnL =
        currentPrice > 0 ? calculatePnL(trade, currentPrice) : BigInt(0);
      const assetConfig =
        ASSET_CONFIG[trade.asset as keyof typeof ASSET_CONFIG];

      return {
        orderId: trade.orderId,
        asset: trade.asset,
        type: trade.type,
        marginValue: trade.margin.toString(),
        marginDecimals: USD_DECIMAL,
        leverage: trade.leverage,
        openPriceValue: trade.openPrice.toString(),
        openPriceDecimals: assetConfig.decimals,
        currentPnLValue: currentPnL.toString(),
        currentPnLDecimals: USD_DECIMAL,
        liquidationPriceValue: trade.liquidationPrice.toString(),
        liquidationPriceDecimals: assetConfig.decimals,
      };
    });

    res.status(200).json({ trades: formattedTrades });
  } catch (err) {
    console.error("Get open orders error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

tradeRoutes.get("/trades", authenticateToken, (req: any, res) => {
  try {
    const userId = req.userId;
    const userClosedTrades = trades.filter(
      (t) =>
        t.userId === userId &&
        (t.status === "closed" ||
          t.status === "liquidated" ||
          t.status === "stopped")
    );

    const formattedTrades = userClosedTrades.map((trade) => {
      const assetConfig =
        ASSET_CONFIG[trade.asset as keyof typeof ASSET_CONFIG];

      return {
        orderId: trade.orderId,
        asset: trade.asset,
        type: trade.type,
        marginValue: trade.margin.toString(),
        marginDecimals: USD_DECIMAL,
        leverage: trade.leverage,
        openPriceValue: trade.openPrice.toString(),
        openPriceDecimals: assetConfig.decimals,
        closePriceValue: trade.closePrice ? trade.closePrice.toString() : null,
        closePriceDecimals: trade.closePrice ? assetConfig.decimals : null,
        pnlValue: trade.pnl ? trade.pnl.toString() : null,
        pnlDecimals: trade.pnl ? USD_DECIMAL : null,
        status: trade.status,
        createdAt: trade.createdAt,
        closedAt: trade.closedAt,
        slippageValue: trade.slippageBps.toString(),
        slippageDecimals: 4,
      };
    });

    res.status(200).json({ trades: formattedTrades });
  } catch (err) {
    console.error("Get closed orders error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
