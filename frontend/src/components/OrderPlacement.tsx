import React, { useState } from 'react';
import { useWebSocket } from '../context/WebScoketContext';

const OrderPlacement: React.FC = () => {
  const { priceData, currentSymbol } = useWebSocket();
  const [orderType, setOrderType] = useState<'market' | 'pending'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [volume, setVolume] = useState(0.01);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const currentPrice = priceData[currentSymbol];
  const buyPrice = currentPrice ? currentPrice.buyPrice / Math.pow(10, currentPrice.decimals) : 0;
  const sellPrice = currentPrice ? currentPrice.sellPrice / Math.pow(10, currentPrice.decimals) : 0;

  const handlePlaceOrder = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login first');
        return;
      }

      const orderData = {
        asset: currentSymbol.replace('USDT', ''),
        type: side,
        margin: volume * buyPrice * 100, // Convert to USD with 2 decimals
        leverage: 1,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        slippageBps: 5
      };

      const response = await fetch('http://localhost:3000/api/v1/trade/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Order placed successfully! Order ID: ${result.orderId}`);
        // Reset form
        setVolume(0.01);
        setStopLoss('');
        setTakeProfit('');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || error.error}`);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order');
    }
  };

  return (
    <div className="bg-gray-900 text-white rounded-lg p-4 w-80">
      <h3 className="text-lg font-semibold mb-4">{currentSymbol}</h3>
      
      {/* Order Type */}
      <div className="mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setOrderType('market')}
            className={`px-3 py-1 rounded text-sm ${
              orderType === 'market' ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType('pending')}
            className={`px-3 py-1 rounded text-sm ${
              orderType === 'pending' ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            Pending
          </button>
        </div>
      </div>

      {/* Buy/Sell Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setSide('sell')}
          className={`py-3 px-4 rounded font-semibold ${
            side === 'sell' ? 'bg-red-600' : 'bg-red-700 hover:bg-red-600'
          }`}
        >
          Sell {sellPrice.toFixed(2)}
        </button>
        <button
          onClick={() => setSide('buy')}
          className={`py-3 px-4 rounded font-semibold ${
            side === 'buy' ? 'bg-green-600' : 'bg-green-700 hover:bg-green-600'
          }`}
        >
          Buy {buyPrice.toFixed(2)}
        </button>
      </div>

      {/* Price Difference */}
      <div className="text-center text-sm text-gray-400 mb-4">
        Spread: {(buyPrice - sellPrice).toFixed(2)} USD
      </div>

      {/* Volume */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Volume (Lots)</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVolume(Math.max(0.01, volume - 0.01))}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            -
          </button>
          <input
            type="number"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value) || 0.01)}
            step="0.01"
            min="0.01"
            className="flex-1 px-3 py-2 bg-gray-800 rounded text-white"
          />
          <button
            onClick={() => setVolume(volume + 0.01)}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            +
          </button>
        </div>
      </div>

      {/* Stop Loss */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Stop Loss</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="Not set"
            className="flex-1 px-3 py-2 bg-gray-800 rounded text-white"
          />
          <button
            onClick={() => setStopLoss('')}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Take Profit */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Take Profit</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            placeholder="Not set"
            className="flex-1 px-3 py-2 bg-gray-800 rounded text-white"
          />
          <button
            onClick={() => setTakeProfit('')}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="mb-4 text-sm text-gray-400">
        <div>Volume: {volume} lots</div>
        <div>Volume in USD: ${(volume * buyPrice * 100).toFixed(2)}</div>
        <div>Leverage: 1:1</div>
      </div>

      {/* Place Order Button */}
      <button
        onClick={handlePlaceOrder}
        className={`w-full py-3 px-4 rounded font-semibold ${
          side === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        Confirm {side === 'buy' ? 'Buy' : 'Sell'} {volume} lots
      </button>
    </div>
  );
};

export default OrderPlacement;
