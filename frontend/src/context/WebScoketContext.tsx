import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface PriceData {
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  decimals: number;
}

interface WebSocketContextType {
  priceData: Record<string, PriceData>;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [priceData, setPriceData] = useState<Record<string, PriceData>>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'price_update') {
        setPriceData(prev => ({
          ...prev,
          [message.data.symbol]: message.data
        }));
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => ws.close();
  }, []);

  return (
    <WebSocketContext.Provider value={{ priceData, isConnected }}>
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
