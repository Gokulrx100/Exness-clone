import WebSocket from "ws";
import Redis from "ioredis";
import {Pool} from "pg";
import dotenv from "dotenv";
import type { BinanceTrade, TradeData, redisTradeData } from "./types.js";

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || "gokul",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "tradingDB",
  password: process.env.DB_PASSWORD || "gokupass",
  port: parseInt(process.env.DB_PORT || "5432"),
});

const SYMBOLS: string[] = ["btcusdt", "ethusdt", "solusdt", "bnbusdt"];
const symbols = SYMBOLS.map((s) => `${s}@trade`).join("/");
const url: string = `wss://stream.binance.com:9443/stream?streams=${symbols}`;

const SYMBOL_CONFIG = {
  'BTCUSDT': { priceDecimals: 8, quantityDecimals: 8 },
  'ETHUSDT': { priceDecimals: 8, quantityDecimals: 8 },
  'SOLUSDT': { priceDecimals: 6, quantityDecimals: 6 },
  'BNBUSDT': { priceDecimals: 8, quantityDecimals: 8 }
};

//@ts-ignore
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

let trades: TradeData[] = [];
const BATCH_SIZE = 50;

function convertToInteger(value: string, decimals: number): bigint {
  const num = parseFloat(value);
  return BigInt(Math.round(num * Math.pow(10, decimals)));
}

const serializeForRedis = (obj: any): string => {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  });
};

redis.on("connect", (): void => console.log("Connected to Redis (publisher)"));
redis.on("error", (err: Error): void => console.error("Redis Error:", err));

const binanceSocket = new WebSocket(url);

binanceSocket.on("open", (): void => {
  console.log("Connected to Binance WebSocket");
});

binanceSocket.on("message", async (raw: any): Promise<void> => {
  const msg = JSON.parse(raw.toString());

  const trade: BinanceTrade = msg.data ?? msg;

  const config = SYMBOL_CONFIG[trade.s as keyof typeof SYMBOL_CONFIG];
  if (!config) {
    console.warn(`Unknown symbol: ${trade.s}`);
    return;
  }

  const t: TradeData = {
    tradeId: trade.t,
    tradeTime: new Date(trade.T),
    symbol: trade.s,
    priceValue: convertToInteger(trade.p, config.priceDecimals),
    priceDecimals: config.priceDecimals,
    quantityValue: convertToInteger(trade.q, config.quantityDecimals),
    quantityDecimals: config.quantityDecimals,
    side: trade.m ? "SELL" : "BUY",
  };

  trades.push(t);
  
  const redisData: redisTradeData = {
    tradeId: trade.t,
    tradeTime: new Date(trade.T),
    symbol: trade.s,
    price: convertToInteger(trade.p, config.priceDecimals),
    priceDecimals: config.priceDecimals,
    quantity: convertToInteger(trade.q, config.quantityDecimals),
    quantityDecimals: config.quantityDecimals,
    side: trade.m ? "SELL" : "BUY",
    bid: convertToInteger((parseFloat(trade.p) * (1 - 0.005)).toString(), config.priceDecimals),
    bidDecimals: config.priceDecimals,
    ask: convertToInteger((parseFloat(trade.p) * (1 + 0.005)).toString(), config.priceDecimals),
    askDecimals: config.priceDecimals
  };

  redis.publish("trades", serializeForRedis(redisData));

  if (trades.length >= BATCH_SIZE) {
    const batch = [...trades];
    trades = [];
    try {
      const client = await pool.connect();
      await client.query("BEGIN");

      for (const t of batch) {
        await client.query(
          `INSERT INTO trades (symbol, price_value, price_decimals, quantity_value, quantity_decimals, side, trade_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            t.symbol,
            t.priceValue.toString(), 
            t.priceDecimals,
            t.quantityValue.toString(),
            t.quantityDecimals,
            t.side,
            t.tradeTime,
          ]
        );
      }

      await client.query("COMMIT");
      client.release();
      console.log(`Inserted ${batch.length} trades`);
    } catch (err: any) {
      console.error("DB Insert Error:", err);
    }
  }
});

binanceSocket.on("error", (error: Error): void => {
  console.error("Binance WebSocket error:", error);
});

binanceSocket.on("close", (): void => {
  console.log("Binance WebSocket connection closed");
});

console.log("Fetching trade data...");