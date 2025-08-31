export interface BinanceTrade {
  t: string;
  T: number;
  s: string;
  p: string;
  q: string;
  m: boolean;
}

export interface TradeData {
  tradeId: string;
  tradeTime: Date;
  symbol: string;
  priceValue: bigint;
  priceDecimals: number;
  quantityValue: bigint;
  quantityDecimals: number;
  side: string;
}
