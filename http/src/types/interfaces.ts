export interface User {
  id: string;
  email: string;
  password: string;
  balance: bigint;
}

export interface Trade {
  orderId: string;
  userId: string;
  asset: string;
  type: "buy" | "sell";
  margin: bigint; 
  leverage: number;
  openPrice: bigint; 
  closePrice?: bigint;
  stopLoss?: bigint; 
  takeProfit?: bigint; 
  slippageBps: bigint; 
  pnl?: bigint;
  status: "open" | "closed" | "liquidated" | "stopped";
  liquidationPrice: bigint; 
  createdAt: Date;
  closedAt?: Date;
  executionPrice?: bigint;
}

export interface AssetPrice {
  symbol: string;
  buyPrice: bigint;
  sellPrice: bigint;
  decimals: number;
}

export interface CandleData {
  timestamp: number;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  volume: bigint;
  decimals: number;
}

export interface RedisTradeData {
  price: bigint;
  bid: bigint;
  ask: bigint;
  symbol: string;
}