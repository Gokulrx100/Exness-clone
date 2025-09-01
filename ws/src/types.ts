import WebSocket from 'ws';

export interface TradeData {
    tradeId: string;
    tradeTime: Date;
    symbol: string;
    price: bigint;
    priceDecimals: number;
    quantity: bigint;
    quantityDecimals: number;
    side: string;
    bid: bigint;
    bidDecimals: number;
    ask: bigint;
    askDecimals: number;
}

export interface ClientSubscription {
    symbol: string;
    timeframe: string;
}

export interface ExtendedWebSocket extends WebSocket {
    subscription?: ClientSubscription;
    clientId: string;
}

// Internal storage types (only for candles - they need accumulation)
export interface CandleData {
    symbol: string;
    timeframe: string;
    timestamp: number;
    open: bigint;
    high: bigint;
    low: bigint;
    close: bigint;
    volume: bigint;
    decimals: number;
}

// Frontend response formats
export interface FrontendCandle {
    timestamp: number;
    open: number;
    close: number;
    high: number;
    low: number;
    decimals: number;
}

export interface FrontendPriceUpdate {
    symbol: string;
    buyPrice: number;
    sellPrice: number;
    decimals: number;
}