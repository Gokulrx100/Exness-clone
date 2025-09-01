import dotenv from "dotenv";
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET!;
console.log(JWT_SECRET);
export const saltRounds = parseInt(process.env.SALT_ROUNDS || "10");
export const USD_DECIMAL = 2;
export const INITIAL_BALANCE = BigInt(500000);
export const ALLOWED_LEVERAGE = [1, 5, 10, 20, 100];
export const ALLOWED_SLIPPAGE_BPS = [5, 10, 50, 100]; 
export const DEFAULT_SLIPPAGE_BPS = BigInt(5);
export const LIQUIDATION_THRESHOLD_PERCENT = BigInt(90);

export const ASSET_CONFIG = {
  BTC: {
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 8,
    binanceSymbol: "BTCUSDT",
  },
  ETH: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 8,
    binanceSymbol: "ETHUSDT",
  },
  SOL: {
    name: "Solana",
    symbol: "SOL",
    decimals: 6,
    binanceSymbol: "SOLUSDT",
  },
  BNB: {
    name: "BNB",
    symbol: "BNB",
    decimals: 8,
    binanceSymbol: "BNBUSDT",
  },
};