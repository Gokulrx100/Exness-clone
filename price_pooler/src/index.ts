import WebSocket = require("ws");
import Redis = require("ioredis");
const { Pool } = require("pg");

const pool = new Pool({
  user: "gokul",
  host: "localhost",
  database: "tradingdb",
  password: "gokupass",
  port: 5432,
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
  host: "localhost",
  port: 6379,
});

interface BinanceTrade {
  t: string;
  T: number;
  s: string;
  p: string;
  q: string;
  m: boolean;
}

interface TradeData {
  tradeId: string;
  tradeTime: Date;
  symbol: string;
  priceValue: bigint;
  priceDecimals: number;
  quantityValue: bigint;
  quantityDecimals: number;
  side: string;
}

let trades: TradeData[] = [];
const BATCH_SIZE = 50;

function convertToInteger(value: string, decimals: number): bigint {
  const num = parseFloat(value);
  return BigInt(Math.round(num * Math.pow(10, decimals)));
}

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
  
  const redisData = {
    tradeId: trade.t,
    tradeTime: new Date(trade.T),
    symbol: trade.s,
    price: parseFloat(trade.p),
    quantity: parseFloat(trade.q),
    side: trade.m ? "SELL" : "BUY",
  };
  redis.publish("trades", JSON.stringify(redisData));

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

console.log("Application started - fetching trade data...");