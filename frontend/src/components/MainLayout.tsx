import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../context/WebScoketContext';
import SymbolList from './OrderList';
import TradingChart from './Chart';
import OrderPlacement from './OrderPlacement';
import TradesSection from './TradesSection';

const MainLayout: React.FC = () => {
  const { priceData, currentSymbol, subscribeToSymbol } = useWebSocket();
  const [balance, setBalance] = useState({ balance: 0, unrealizedPnL: 0, totalEquity: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3000/api/v1/user/balance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBalance({
          balance: parseFloat(data.balanceValue) / Math.pow(10, data.balanceDecimals),
          unrealizedPnL: parseFloat(data.unrealizedPnLValue) / Math.pow(10, data.unrealizedPnLDecimals),
          totalEquity: parseFloat(data.totalEquityValue) / Math.pow(10, data.totalEquityDecimals)
        });
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSymbolClick = (symbol: string) => {
    subscribeToSymbol(symbol, '1m');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Navigation */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">Exness Clone</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => handleSymbolClick('BTCUSDT')}
                className={`px-3 py-1 rounded text-sm ${
                  currentSymbol === 'BTCUSDT' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                BTC
              </button>
              <button
                onClick={() => handleSymbolClick('ETHUSDT')}
                className={`px-3 py-1 rounded text-sm ${
                  currentSymbol === 'ETHUSDT' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                ETH
              </button>
              <button
                onClick={() => handleSymbolClick('SOLUSDT')}
                className={`px-3 py-1 rounded text-sm ${
                  currentSymbol === 'SOLUSDT' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                SOL
              </button>
              <button
                onClick={() => handleSymbolClick('BNBUSDT')}
                className={`px-3 py-1 rounded text-sm ${
                  currentSymbol === 'BNBUSDT' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                BNB
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <div>Balance: ${balance.balance.toFixed(2)}</div>
              <div className="text-gray-400">
                Equity: ${balance.totalEquity.toFixed(2)}
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-screen">
        {/* Left Sidebar - Symbol List */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <SymbolList />
        </div>

        {/* Center - Chart */}
        <div className="flex-1 p-4 overflow-y-auto">
          <TradingChart />
        </div>

        {/* Right Sidebar - Order Placement */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
          <OrderPlacement />
        </div>
      </div>

      {/* Bottom - Trades Section */}
      <div className="h-64 border-t border-gray-700">
        <TradesSection />
      </div>
    </div>
  );
};

export default MainLayout;
