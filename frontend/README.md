# Exness Clone Frontend

A simple trading platform frontend built with React, TypeScript, and ApexCharts.

## Features

- **Real-time Chart**: ApexCharts candlestick chart with historical data loading
- **Live Price Updates**: WebSocket integration for real-time price feeds
- **Order Placement**: Buy/Sell orders with stop loss and take profit
- **Trades Management**: View open, pending, and closed trades
- **Symbol Selection**: Switch between different trading pairs
- **Timeframe Selection**: 30s, 1m, 5m, 10m, 30m intervals

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Make sure your backend services are running:
   - HTTP Server (port 3000)
   - WebSocket Server (port 8080)
   - Price Poller
   - TimescaleDB
   - Redis

## Usage

1. **Login/Signup**: Create an account or login with existing credentials
2. **Select Symbol**: Click on BTC, ETH, SOL, or BNB in the top navigation
3. **View Chart**: The chart loads historical data and updates with live data
4. **Change Timeframe**: Use the timeframe buttons above the chart
5. **Place Orders**: Use the right sidebar to place buy/sell orders
6. **Monitor Trades**: View your trades in the bottom section

## Components

- `Login.tsx` - Authentication component
- `MainLayout.tsx` - Main application layout
- `Chart.tsx` - ApexCharts candlestick chart
- `OrderPlacement.tsx` - Order placement form
- `TradesSection.tsx` - Trades management
- `OrderList.tsx` - Symbol list with live prices
- `WebScoketContext.tsx` - WebSocket state management

## API Endpoints

- `POST /api/v1/user/signup` - User registration
- `POST /api/v1/user/signin` - User login
- `GET /api/v1/user/balance` - Get user balance
- `POST /api/v1/trade/create` - Create new trade
- `POST /api/v1/trade/:id/close` - Close trade
- `GET /api/v1/trades/open` - Get open trades
- `GET /api/v1/trades` - Get closed trades
- `GET /api/v1/candles/:symbol/:timeframe` - Get historical candles

## WebSocket Events

- `subscribe` - Subscribe to symbol/timeframe
- `price_update` - Real-time price updates
- `candles` - Real-time candle updates
