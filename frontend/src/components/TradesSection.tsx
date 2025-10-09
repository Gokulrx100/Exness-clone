import React, { useState, useEffect } from 'react';

interface Trade {
  orderId: string;
  asset: string;
  type: 'buy' | 'sell';
  marginValue: string;
  marginDecimals: number;
  leverage: number;
  openPriceValue: string;
  openPriceDecimals: number;
  currentPnLValue?: string;
  currentPnLDecimals?: number;
  liquidationPriceValue: string;
  liquidationPriceDecimals: number;
  status: string;
  createdAt: string;
  closedAt?: string;
  closePriceValue?: string;
  closePriceDecimals?: number;
  pnlValue?: string;
  pnlDecimals?: number;
}

const TradesSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'open' | 'pending' | 'closed'>('open');
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTrades = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Load open trades
      const openResponse = await fetch('http://localhost:3000/api/v1/trades/open', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (openResponse.ok) {
        const openData = await openResponse.json();
        setOpenTrades(openData.trades || []);
      }

      // Load closed trades
      const closedResponse = await fetch('http://localhost:3000/api/v1/trades', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (closedResponse.ok) {
        const closedData = await closedResponse.json();
        setClosedTrades(closedData.trades || []);
      }
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, []);

  const formatPrice = (value: string, decimals: number) => {
    return (parseFloat(value) / Math.pow(10, decimals)).toFixed(2);
  };

  const formatPnL = (value: string, decimals: number) => {
    const pnl = parseFloat(value) / Math.pow(10, decimals);
    return pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2);
  };

  const getPnLColor = (value: string, decimals: number) => {
    const pnl = parseFloat(value) / Math.pow(10, decimals);
    return pnl >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const renderOpenTrades = () => {
    if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    if (openTrades.length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">📦</div>
          <div>No open positions</div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Symbol</th>
              <th className="text-left py-2 px-4">Type</th>
              <th className="text-right py-2 px-4">Volume</th>
              <th className="text-right py-2 px-4">Open Price</th>
              <th className="text-right py-2 px-4">Current P&L</th>
              <th className="text-right py-2 px-4">Liquidation</th>
              <th className="text-right py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {openTrades.map((trade) => (
              <tr key={trade.orderId} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="py-2 px-4 font-medium">{trade.asset}</td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    trade.type === 'buy' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                  }`}>
                    {trade.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-4 text-right">
                  {formatPrice(trade.marginValue, trade.marginDecimals)} USD
                </td>
                <td className="py-2 px-4 text-right">
                  {formatPrice(trade.openPriceValue, trade.openPriceDecimals)}
                </td>
                <td className={`py-2 px-4 text-right font-medium ${
                  trade.currentPnLValue ? getPnLColor(trade.currentPnLValue, trade.currentPnLDecimals || 0) : 'text-gray-400'
                }`}>
                  {trade.currentPnLValue ? formatPnL(trade.currentPnLValue, trade.currentPnLDecimals || 0) : 'N/A'}
                </td>
                <td className="py-2 px-4 text-right">
                  {formatPrice(trade.liquidationPriceValue, trade.liquidationPriceDecimals)}
                </td>
                <td className="py-2 px-4 text-right">
                  <button
                    onClick={() => handleCloseTrade(trade.orderId)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                  >
                    Close
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderClosedTrades = () => {
    if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    if (closedTrades.length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">📊</div>
          <div>No closed positions</div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Symbol</th>
              <th className="text-left py-2 px-4">Type</th>
              <th className="text-right py-2 px-4">Volume</th>
              <th className="text-right py-2 px-4">Open Price</th>
              <th className="text-right py-2 px-4">Close Price</th>
              <th className="text-right py-2 px-4">P&L</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-left py-2 px-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {closedTrades.map((trade) => (
              <tr key={trade.orderId} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="py-2 px-4 font-medium">{trade.asset}</td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    trade.type === 'buy' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                  }`}>
                    {trade.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-4 text-right">
                  {formatPrice(trade.marginValue, trade.marginDecimals)} USD
                </td>
                <td className="py-2 px-4 text-right">
                  {formatPrice(trade.openPriceValue, trade.openPriceDecimals)}
                </td>
                <td className="py-2 px-4 text-right">
                  {trade.closePriceValue ? formatPrice(trade.closePriceValue, trade.closePriceDecimals || 0) : 'N/A'}
                </td>
                <td className={`py-2 px-4 text-right font-medium ${
                  trade.pnlValue ? getPnLColor(trade.pnlValue, trade.pnlDecimals || 0) : 'text-gray-400'
                }`}>
                  {trade.pnlValue ? formatPnL(trade.pnlValue, trade.pnlDecimals || 0) : 'N/A'}
                </td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    trade.status === 'closed' ? 'bg-blue-900 text-blue-300' :
                    trade.status === 'liquidated' ? 'bg-red-900 text-red-300' :
                    'bg-yellow-900 text-yellow-300'
                  }`}>
                    {trade.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-4 text-gray-400">
                  {new Date(trade.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleCloseTrade = async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:3000/api/v1/trade/${orderId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Trade closed successfully');
        loadTrades(); // Reload trades
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || error.error}`);
      }
    } catch (error) {
      console.error('Error closing trade:', error);
      alert('Failed to close trade');
    }
  };

  return (
    <div className="bg-gray-900 text-white rounded-lg">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('open')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'open' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'pending' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setActiveTab('closed')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'closed' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Closed
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'open' && renderOpenTrades()}
        {activeTab === 'pending' && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">⏳</div>
            <div>No pending orders</div>
          </div>
        )}
        {activeTab === 'closed' && renderClosedTrades()}
      </div>
    </div>
  );
};

export default TradesSection;
