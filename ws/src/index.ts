import WebSocket = require('ws');
import Redis = require('ioredis');
import type { TradeData, ClientSubscription, ExtendedWebSocket, CandleData, BidAskData } from './types.js';

const port: number = 8080;

// Store current candle data for each symbol+timeframe combination
const currentCandles = new Map<string, CandleData>();

// Get timeframe in milliseconds
const getTimeframeMs = (timeframe: string): number => {
    switch (timeframe) {
        case '30s': return 30 * 1000;
        case '1m': return 60 * 1000;
        case '5m': return 5 * 60 * 1000;
        case '10m': return 10 * 60 * 1000;
        case '30m': return 30 * 60 * 1000;
        default: return 60 * 1000;
    }
};

const getCandleTimestamp = (timestamp: number, timeframe: string): number => {
    const timeframeMs = getTimeframeMs(timeframe);
    return Math.floor(timestamp / timeframeMs) * timeframeMs;
};

const updateCandle = (trade: TradeData, timeframe: string): CandleData | null => {
    const key = `${trade.symbol}-${timeframe}`;
    const tradeTime = new Date(trade.tradeTime).getTime(); 
    
    if (isNaN(tradeTime)) {
        console.error('Invalid trade time:', trade.tradeTime);
        return null;
    }
    
    const candleTimestamp = getCandleTimestamp(tradeTime, timeframe);
    
    const existingCandle = currentCandles.get(key);

    if (!existingCandle || existingCandle.timestamp !== candleTimestamp) {
        const newCandle: CandleData = {
            symbol: trade.symbol,
            timeframe,
            timestamp: candleTimestamp,
            open: trade.price,
            high: trade.price,
            low: trade.price,
            close: trade.price,
            volume: trade.quantity
        };
        currentCandles.set(key, newCandle);
        return newCandle;
    }

    existingCandle.high = Math.max(existingCandle.high, trade.price);
    existingCandle.low = Math.min(existingCandle.low, trade.price);
    existingCandle.close = trade.price;
    existingCandle.volume += trade.quantity;
    
    return existingCandle;
};

const startWsServer = (port: number): void => {
    const wss = new WebSocket.Server({ port });
    console.log(`WSS running on port ${port}`);
    
    //@ts-ignore
    const sub = new Redis({
        host: 'localhost',
        port: 6379
    });

    sub.on("connect", (): void => console.log("Connected to Redis (subscriber)"));
    sub.on("error", (err: Error): void => console.error("Redis Error:", err));

    sub.subscribe("trades", (err: Error | null, count: number): void => {
        if (err) {
            console.error("Failed to subscribe:", err);
        } else {
            console.log(`Subscribe to ${count} channel.`);
        }
    });

    sub.on("message", (channel: string, message: string): void => {
        try {
            const tradeData: TradeData = JSON.parse(message);
            console.log("Received from redis:", tradeData);

            // Send bid/ask updates to all clients
            const bidAskUpdate: BidAskData = {
                symbol: tradeData.symbol,
                bid: tradeData.bid,
                ask: tradeData.ask,
                timestamp: new Date().getTime()
            };

            wss.clients.forEach((client: WebSocket): void => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'bidask',
                        data: bidAskUpdate
                    }));
                }
            });

            const timeframes = ['30s', '1m', '5m', '10m', '30m'];
            
            timeframes.forEach(timeframe => {
                const updatedCandle = updateCandle(tradeData, timeframe);
                if (updatedCandle) {
                    wss.clients.forEach((client: WebSocket): void => {
                        const extendedClient = client as ExtendedWebSocket;
                        if (client.readyState === WebSocket.OPEN && 
                            extendedClient.subscription &&
                            extendedClient.subscription.symbol === tradeData.symbol &&
                            extendedClient.subscription.timeframe === timeframe) {
                            
                            client.send(JSON.stringify({
                                type: 'candle',
                                data: updatedCandle
                            }));
                        }
                    });
                }
            });

        } catch (error) {
            console.error("Error parsing message:", error);
        }
    });

    wss.on("connection", (ws: ExtendedWebSocket): void => {
        ws.clientId = Math.random().toString(36).substring(7);
        console.log(`Frontend connected to WS: ${ws.clientId}`);
        
        ws.send(JSON.stringify({
            type: "welcome",
            msg: "connected"
        }));

        ws.on("message", (data: string): void => {
            try {
                const message = JSON.parse(data);
                
                if (message.type === 'subscribe') {
                    ws.subscription = {
                        symbol: message.symbol,
                        timeframe: message.timeframe
                    };
                    console.log(`Client ${ws.clientId} subscribed to ${message.symbol} ${message.timeframe}`);
                    
                    ws.send(JSON.stringify({
                        type: 'subscribed',
                        symbol: message.symbol,
                        timeframe: message.timeframe
                    }));
                }
                
            } catch (error) {
                console.error("Error parsing client message:", error);
            }
        });

        ws.on("close", (): void => {
            console.log(`Client ${ws.clientId} disconnected`);
        });
    });
};

startWsServer(port);