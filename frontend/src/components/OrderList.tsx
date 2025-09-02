import React, { useState, useEffect } from 'react';
import { useWebSocket } from "../context/WebScoketContext"

interface SymbolData {
  symbol: string;
  ask: number;
  bid: number;
  priceDirection: 'up' | 'down';
  askState: 'up' | 'down' | 'neutral';
  bidState: 'up' | 'down' | 'neutral';
}

const SymbolList: React.FC = () => {
  const { priceData } = useWebSocket();
  const [symbols, setSymbols] = useState<Record<string, SymbolData>>({});

  useEffect(() => {
    Object.entries(priceData).forEach(([symbol, data]) => {
      const ask = data.buyPrice / Math.pow(10, data.decimals);
      const bid = data.sellPrice / Math.pow(10, data.decimals);
      const currentPrice = ask * 0.995;

      setSymbols(prev => {
        const prevAsk = prev[symbol]?.ask ?? ask;
        const prevBid = prev[symbol]?.bid ?? bid;

        const priceDirection = currentPrice >=  (prev[symbol]?.ask !== undefined ? prev[symbol].ask * 0.995 : currentPrice) ? 'up' : 'down';

        const askState =
          ask > prevAsk ? 'up' :
          ask < prevAsk ? 'down' : 'neutral';

        const bidState =
          bid > prevBid ? 'up' :
          bid < prevBid ? 'down' : 'neutral';

        return {
          ...prev,
          [symbol]: {
            symbol,
            ask,
            bid,
            priceDirection,
            askState,
            bidState
          }
        };
      });
    });
  }, [priceData]);

  const formatPrice = (price: number, _symbol: string): string => {
    return price.toFixed(4);
  };

  const getSymbolDisplay = (symbol: string): string => {
    return symbol.replace('USDT', '');
  };

  const SignalIcon = ({ direction }: { direction: 'up' | 'down' }) => {
    if (direction === 'up') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16">
          <polygon points="8,4 12,10 4,10" fill="#22c55e" />
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <polygon points="4,6 12,6 8,12" fill="#ef4444" />
      </svg>
    );
  };

  return (
    <div className="bg-gray-900 text-white rounded-lg overflow-hidden max-w-1/3 m-4">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-300">
          <div>Symbol</div>
          <div className="text-center">Signal</div>
          <div className="text-right">Bid</div>
          <div className="text-right">Ask</div>
        </div>
      </div>

      {/* Symbol List */}
      <div className="divide-y divide-gray-700">
        {Object.values(symbols).map((data) => (
          <div 
            key={data.symbol} 
            className="px-4 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="grid grid-cols-4 gap-4 items-center">
              {/* Symbol */}
              <div className="flex items-center space-x-2">
                <span className="font-medium">{getSymbolDisplay(data.symbol)}</span>
              </div>

              {/* Signal */}
              <div className="flex justify-center">
                <div className={`p-1 rounded ${
                  data.priceDirection === 'up' ? 'bg-green-900/50' : 'bg-red-900/50'
                }`}>
                  <SignalIcon direction={data.priceDirection} />
                </div>
              </div>

              {/* Bid */}
              <div className="text-right">
                <div className={`font-mono text-sm transition-colors ${
                  data.bidState === 'up' ? 'text-green-400'
                  : data.bidState === 'down' ? 'text-red-400'
                  : 'text-gray-300'
                }`}>
                  {formatPrice(data.bid, data.symbol)}
                </div>
              </div>

              {/* Ask */}
              <div className="text-right">
                <div className={`font-mono text-sm transition-colors ${
                  data.askState === 'up' ? 'text-green-400'
                  : data.askState === 'down' ? 'text-red-400'
                  : 'text-gray-300'
                }`}>
                  {formatPrice(data.ask, data.symbol)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SymbolList;