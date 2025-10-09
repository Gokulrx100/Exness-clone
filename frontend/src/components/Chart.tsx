import React, { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { useWebSocket } from '../context/WebScoketContext';

const TradingChart: React.FC = () => {
  const { candleData, currentSymbol, currentTimeframe, subscribeToSymbol } = useWebSocket();
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  // Load historical data when component mounts or symbol/timeframe changes
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/v1/candles/${currentSymbol}/${currentTimeframe}?limit=100`);
        const data = await response.json();
        
        if (data.candles) {
          const formattedData = data.candles.map((candle: any) => ({
            x: new Date(candle.timestamp).getTime(),
            y: [
              candle.openValue / Math.pow(10, candle.decimals),
              candle.highValue / Math.pow(10, candle.decimals),
              candle.lowValue / Math.pow(10, candle.decimals),
              candle.closeValue / Math.pow(10, candle.decimals)
            ]
          }));
          setHistoricalData(formattedData);
        }
      } catch (error) {
        console.error('Failed to load historical data:', error);
      }
    };

    loadHistoricalData();
  }, [currentSymbol, currentTimeframe]);

  // Convert live candle data to ApexCharts format
  const liveData = candleData.map(candle => ({
    x: candle.timestamp,
    y: [
      candle.open,
      candle.high,
      candle.low,
      candle.close
    ]
  }));

  // Combine historical and live data
  const allData = [...historicalData, ...liveData];

  const options: ApexOptions = {
    chart: {
      type: 'candlestick',
      height: 400,
      background: '#1f2937',
      toolbar: {
        show: true,
        tools: {
          download: false,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      }
    },
    title: {
      text: `${currentSymbol} - ${currentTimeframe}`,
      align: 'left',
      style: {
        color: '#ffffff'
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: '#9ca3af'
        }
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#9ca3af'
        }
      }
    },
    grid: {
      borderColor: '#374151'
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#22c55e',
          downward: '#ef4444'
        }
      }
    },
    theme: {
      mode: 'dark'
    }
  };

  const series = [{
    name: 'Price',
    data: allData
  }];

  const timeframes = ['30s', '1m', '5m', '10m', '30m'];

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      {/* Timeframe Selector */}
      <div className="flex gap-2 mb-4">
        {timeframes.map(tf => (
          <button
            key={tf}
            onClick={() => subscribeToSymbol(currentSymbol, tf)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              currentTimeframe === tf
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <Chart
        options={options}
        series={series}
        type="candlestick"
        height={400}
      />
    </div>
  );
};

export default TradingChart;
