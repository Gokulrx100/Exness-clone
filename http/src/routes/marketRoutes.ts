import { Router } from "express";
import { Pool } from "pg";
import { assetPrices } from "../services/dataStore.js"
import { 
  ASSET_CONFIG, 
  ALLOWED_LEVERAGE, 
  ALLOWED_SLIPPAGE_BPS, 
  DEFAULT_SLIPPAGE_BPS, 
  LIQUIDATION_THRESHOLD_PERCENT,
  USD_DECIMAL 
} from "../config/constants.js";

export const marketRoutes = Router();

const pool = new Pool({
  user: "gokul",
  host: "localhost",
  database: "tradingDB",
  password: "gokupass",
  port: 5432,
});

marketRoutes.get("/assets", (req, res) => {
  try {
    const assets = Object.entries(ASSET_CONFIG).map(([symbol, config]) => {
      const price = assetPrices.get(symbol);
      return {
        name: config.name,
        symbol: config.symbol,
        buyPriceValue: price ? price.buyPrice.toString() : "0",
        buyPriceDecimals: config.decimals,
        sellPriceValue: price ? price.sellPrice.toString() : "0",
        sellPriceDecimals: config.decimals,
        spreadValue: price ? (price.buyPrice - price.sellPrice).toString() : "0",
        spreadDecimals: config.decimals,
        decimals: config.decimals
      };
    });

    res.json({ assets });
  } catch (err) {
    console.error("Get assets error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

marketRoutes.get("/config", (req, res) => {
  res.json({
    allowedLeverage: ALLOWED_LEVERAGE,
    allowedSlippageBps: ALLOWED_SLIPPAGE_BPS,
    defaultSlippageBps: Number(DEFAULT_SLIPPAGE_BPS),
    liquidationThresholdPercent: Number(LIQUIDATION_THRESHOLD_PERCENT),
    usdDecimals: USD_DECIMAL
  });
});

marketRoutes.get("/candles/:symbol/:timeframe", async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const { limit = 100, from, to } = req.query;
    
    const assetConfig = ASSET_CONFIG[symbol as keyof typeof ASSET_CONFIG];
    if (!assetConfig) {
      return res.status(400).json({ error: "Invalid symbol" });
    }
    
    const validTimeframes = ['30s', '1m', '5m', '10m', '30m'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({ error: "Invalid timeframe. Must be one of: 30s, 1m, 5m, 10m, 30m" });
    }
    
    const tableName = `trades_${timeframe}`;
    const binanceSymbol = assetConfig.binanceSymbol;
    
    let query = `
      SELECT 
        bucket,
        open_value,
        high_value,
        low_value,
        close_value,
        volume_value,
        price_decimals
      FROM ${tableName} 
      WHERE symbol = $1
    `;
    
    const queryParams: any[] = [binanceSymbol];
    let paramIndex = 2;
    
    if (from) {
      query += ` AND bucket >= ${paramIndex}`;
      queryParams.push(new Date(from as string));
      paramIndex++;
    }
    
    if (to) {
      query += ` AND bucket <= ${paramIndex}`;
      queryParams.push(new Date(to as string));
      paramIndex++;
    }
    
    query += ` ORDER BY bucket DESC LIMIT ${paramIndex}`;
    queryParams.push(parseInt(limit as string) || 100);
    
    const result = await pool.query(query, queryParams);
    
    const candles = result.rows.map(row => ({
      timestamp: new Date(row.bucket).getTime(),
      openValue: row.open_value,
      highValue: row.high_value,
      lowValue: row.low_value,
      closeValue: row.close_value,
      volumeValue: row.volume_value,
      decimals: row.price_decimals
    }));
    
    res.json({ 
      symbol,
      timeframe,
      candles: candles.reverse() 
    });
    
  } catch (err) {
    console.error("Get candles error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});