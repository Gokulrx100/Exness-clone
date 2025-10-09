import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';

interface PriceData {
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  decimals: number;
}

interface CandleData {
  timestamp: number;
  open: number;
  close: number;
  high: number;
  low: number;
  decimals: number;
}

interface WebSocketContextType {
  priceData: Record<string, PriceData>;
  candleData: CandleData[];
  isConnected: boolean;
  subscribeToSymbol: (symbol: string, timeframe: string) => void;
  currentSymbol: string;
  currentTimeframe: string;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [priceData, setPriceData] = useState<Record<string, PriceData>>({});
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState('BTCUSDT');
  const [currentTimeframe, setCurrentTimeframe] = useState('1m');
  const wsRef = useRef<WebSocket | null>(null);

  const subscribeToSymbol = (symbol: string, timeframe: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setCurrentSymbol(symbol);
      setCurrentTimeframe(timeframe);
      setCandleData([]); // Clear previous data
      
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        symbol: symbol,
        timeframe: timeframe
      }));
    }
  };

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to default symbol and timeframe
      subscribeToSymbol('BTCUSDT', '1m');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'price_update') {
        setPriceData(prev => ({
          ...prev,
          [message.data.symbol]: message.data
        }));
      } else if (message.type === 'candles') {
        setCandleData(prev => {
          const newCandles = message.data.candles;
          // Merge with existing data, avoiding duplicates
          const existingTimestamps = new Set(prev.map(c => c.timestamp));
          const uniqueNewCandles = newCandles.filter((c: CandleData) => !existingTimestamps.has(c.timestamp));
          return [...prev, ...uniqueNewCandles].sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => ws.close();
  }, []);

  return (
    <WebSocketContext.Provider value={{ 
      priceData, 
      candleData, 
      isConnected, 
      subscribeToSymbol,
      currentSymbol,
      currentTimeframe
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
