import jwt from "jsonwebtoken";
import type { User, Trade, AssetPrice } from "../types/interfaces.js";
import { JWT_SECRET, ASSET_CONFIG, LIQUIDATION_THRESHOLD_PERCENT, USD_DECIMAL } from "../config/constants.js";

// In-memory stores 
export const users: User[] = [];
export const trades: Trade[] = [];
export const assetPrices = new Map<string, AssetPrice>();

// Utility functions
export const findUserById = (id: string): User | undefined => {
  return users.find((user) => user.id === id);
};

export const findUserByEmail = (email: string): User | undefined => {
  return users.find((user) => user.email === email);
};

export const getUserIdFromToken = (token: string): string | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch (error) {
    return null;
  }
};

// Trading calculations
export const calculatePnL = (trade: Trade, currentPrice: bigint): bigint => {
  const assetConfig = ASSET_CONFIG[trade.asset as keyof typeof ASSET_CONFIG];
  
  // Convert prices to USD with 2 decimals for easier calculation
  const openPriceUSD = trade.openPrice / BigInt(10 ** (assetConfig.decimals - USD_DECIMAL));
  const currentPriceUSD = currentPrice / BigInt(10 ** (assetConfig.decimals - USD_DECIMAL));
  
  let priceChangeUSD: bigint;
  if (trade.type === "buy") {
    priceChangeUSD = currentPriceUSD - openPriceUSD;
  } else {
    priceChangeUSD = openPriceUSD - currentPriceUSD;
  }

  const exposure = trade.margin * BigInt(trade.leverage);
  const pnl = (priceChangeUSD * exposure) / openPriceUSD;
  
  return pnl;
};

export const calculateLiquidationPrice = (trade: Trade): bigint => {
  const maxLossUsd = (trade.margin * LIQUIDATION_THRESHOLD_PERCENT) / BigInt(100);
  const exposure = trade.margin * BigInt(trade.leverage);
  const priceChangeRatio = (maxLossUsd * trade.openPrice) / exposure;
  
  if (trade.type === "buy") {
    return trade.openPrice - priceChangeRatio;
  } else {
    return trade.openPrice + priceChangeRatio;
  }
};

export const applySlippage = (price: bigint, slippageBps: bigint, tradeType: "buy" | "sell"): bigint => {
  const slippageAmount = (price * slippageBps) / BigInt(10000);
  
  if (tradeType === "buy") {
    return price + slippageAmount;
  } else {
    return price - slippageAmount;
  }
};

export const checkTradeConditions = (trade: Trade, currentPrice: bigint): string | null => {
  const currentPnL = calculatePnL(trade, currentPrice);
  
  // Check liquidation
  if (currentPnL <= -((trade.margin * LIQUIDATION_THRESHOLD_PERCENT) / BigInt(100))) {
    return "liquidated";
  }
  
  // Check stop loss
  if (trade.stopLoss) {
    if (trade.type === "buy" && currentPrice <= trade.stopLoss) {
      return "stopped";
    }
    if (trade.type === "sell" && currentPrice >= trade.stopLoss) {
      return "stopped";
    }
  }
  
  // Check take profit
  if (trade.takeProfit) {
    if (trade.type === "buy" && currentPrice >= trade.takeProfit) {
      return "closed";
    }
    if (trade.type === "sell" && currentPrice <= trade.takeProfit) {
      return "closed";
    }
  }
  
  return null;
};