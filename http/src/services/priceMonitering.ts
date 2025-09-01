import Redis from "ioredis";
import Bull from "bull";
import { trades, assetPrices, findUserById, checkTradeConditions, calculatePnL, applySlippage } from "./dataStore.js";
import { ASSET_CONFIG } from "../config/constants.js";
import type { Trade, RedisTradeData } from "../types/interfaces.js";

const closeTrade = async (trade: Trade, closePrice: bigint, reason: string, emailQueue: Bull.Queue) => {
  const executionPrice = applySlippage(closePrice, trade.slippageBps, trade.type === "buy" ? "sell" : "buy");
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
  
  await emailQueue.add('trade-closed', {
    userId: trade.userId,
    userEmail: user?.email,
    trade: {
      orderId: trade.orderId,
      asset: trade.asset,
      type: trade.type,
      margin: Number(trade.margin) / 100,
      leverage: trade.leverage,
      openPrice: Number(trade.openPrice) / (10 ** ASSET_CONFIG[trade.asset as keyof typeof ASSET_CONFIG].decimals),
      closePrice: Number(executionPrice) / (10 ** ASSET_CONFIG[trade.asset as keyof typeof ASSET_CONFIG].decimals),
      pnl: Number(pnl) / 100,
      reason: reason
    }
  });
};

//@ts-ignore
export const startPriceMonitoring = (redis: Redis, emailQueue: Bull.Queue) => {
  redis.subscribe("trades", (err: Error | null, count: number) => {
    if (err) {
      console.error("Failed to subscribe to Redis : ", err);
    } else {
      console.log(`Subscribe to ${count} channel(s)`);
    }
  });

  redis.on("message", async (channel: string, message: string) => {
    if (channel === "trades") {
      try {
        const data: RedisTradeData = JSON.parse(message, (key, value) => {
          if (key === "price" || key === "bid" || key === "ask") {
            return BigInt(value);
          }
          return value;
        });

        let assetSymbol = "";
        for (const [symbol, config] of Object.entries(ASSET_CONFIG)) {
          if (config.binanceSymbol === data.symbol) {
            assetSymbol = symbol;
            break;
          }
        }

        if (assetSymbol) {
          const assetConfig = ASSET_CONFIG[assetSymbol as keyof typeof ASSET_CONFIG];
          assetPrices.set(assetSymbol, {
            symbol: assetSymbol,
            buyPrice: data.ask,
            sellPrice: data.bid,
            decimals: assetConfig.decimals,
          });
          
          const openTrades = trades.filter(t => t.asset === assetSymbol && t.status === "open");
          
          for (const trade of openTrades) {
            const currentPrice = trade.type === "buy" ? data.bid : data.ask;
            const condition = checkTradeConditions(trade, currentPrice);
            
            if (condition) {
              await closeTrade(trade, currentPrice, condition, emailQueue);
              console.log(`Trade ${trade.orderId} ${condition} at price ${currentPrice}`);
            }
          }
        }
      } catch (error) {
        console.error("Error parsing Redis message : ", error);
      }
    }
  });
};