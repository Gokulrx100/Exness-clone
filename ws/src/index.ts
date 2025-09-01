import WebSocket = require('ws');
import Redis from 'ioredis';
import type { 
    TradeData, 
    ClientSubscription, 
    ExtendedWebSocket, 
    CandleData, 
    FrontendCandle,
    FrontendPriceUpdate
} from './types.js';

const port: number = 8080;

// stores candle data like a dict with key "tradesymbol-timeframe" 
const currentCandles = new Map<string, CandleData>();

// timeframe in milliseconds
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

    // Convert bigint values for comparison
    const tradePrice = trade.price;
    const tradeQuantity = trade.quantity;

    if (!existingCandle || existingCandle.timestamp !== candleTimestamp) {
        // New candle
        const newCandle: CandleData = {
            symbol: trade.symbol,
            timeframe,
            timestamp: candleTimestamp,
            open: tradePrice,
            high: tradePrice,
            low: tradePrice,
            close: tradePrice,
            volume: tradeQuantity,
            decimals: trade.priceDecimals
        };
        currentCandles.set(key, newCandle);
        return newCandle;
    }

    // Update existing candle
    existingCandle.high = tradePrice > existingCandle.high ? tradePrice : existingCandle.high;
    existingCandle.low = tradePrice < existingCandle.low ? tradePrice : existingCandle.low;
    existingCandle.close = tradePrice;
    existingCandle.volume += tradeQuantity;
    
    return existingCandle;
};

const formatCandleForFrontend = (candle: CandleData): FrontendCandle => {
    return {
        timestamp: candle.timestamp,
        open: Number(candle.open),
        close: Number(candle.close),
        high: Number(candle.high),
        low: Number(candle.low),
        decimals: candle.decimals
    };
};

const formatBidAskForFrontend = (tradeData: TradeData): FrontendPriceUpdate => {
    return {
        symbol: tradeData.symbol,
        buyPrice: Number(tradeData.ask), // Ask -> price to buy
        sellPrice: Number(tradeData.bid), // Bid -> price to sell
        decimals: tradeData.bidDecimals
    };
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
            console.log(`Subscribed to ${count} channel(s).`);
        }
    });

    sub.on("message", (channel: string, message: string): void => {
        try {
            const tradeData: TradeData = JSON.parse(message, (key, value) => {
                // Convert string representations of bigint back to bigint
                if (key === 'price' || key === 'quantity' || key === 'bid' || key === 'ask') {
                    return BigInt(value);
                }
                if (key === 'tradeTime') {
                    return new Date(value);
                }
                return value;
            });

            console.log("Received from redis:", {
                symbol: tradeData.symbol,
                price: tradeData.price.toString(),
                decimals: tradeData.priceDecimals
            });

            const priceUpdate = formatBidAskForFrontend(tradeData);
            wss.clients.forEach((client: WebSocket): void => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'price_update',
                        data: priceUpdate
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
                                type: 'candles',
                                data: {
                                    candles: [formatCandleForFrontend(updatedCandle)]
                                }
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
            message: "Connected to trading WebSocket"
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
                    
                    const candleKey = `${message.symbol}-${message.timeframe}`;
                    const currentCandle = currentCandles.get(candleKey);
                    
                    if (currentCandle) {
                        ws.send(JSON.stringify({
                            type: 'candles',
                            data: {
                                candles: [formatCandleForFrontend(currentCandle)]
                            }
                        }));
                    }
                    
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

        ws.on("error", (error: Error): void => {
            console.error(`Client ${ws.clientId} error:`, error);
        });
    });
};

startWsServer(port);