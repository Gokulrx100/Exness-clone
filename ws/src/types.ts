import WebSocket from 'ws';

export interface TradeData {
    tradeId: string;
    symbol: string;
    price: number;
    quantity: number;
    tradeTime: string; 
    side: string;
    bid: number;
    ask: number;
}

export interface ClientSubscription {
    symbol: string;
    timeframe: string;
}

export interface ExtendedWebSocket extends WebSocket {
    subscription?: ClientSubscription;
    clientId: string;
}

export interface CandleData {
    symbol: string;
    timeframe: string;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface BidAskData {
    symbol: string;
    bid: number;
    ask: number;
    timestamp: number;
}