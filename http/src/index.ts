import express from "express";
import { Pool } from "pg";
import Redis from "ioredis";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = 3000;
const saltRounds = 10;
const JWT_SECRET = "blah_blah_blah";

app.use(express.json());
app.use(cors());

const pool = new Pool({
  user: "gokul",
  host: "localhost",
  database: "tradingDB",
  password: "gokupass",
  port: 5432,
});

//@ts-ignore
const redis = new Redis({
  host: "localhost",
  port: 6379,
});

interface User {
  id: string;
  email: string;
  password: string;
  balance: bigint;
}

interface Trade {
  orderId: string;
  userId: string;
  asset: string;
  type: "buy" | "sell";
  margin: bigint;
  leverage: number;
  openPrice: bigint;
  closePrice?: bigint;
  pnl?: bigint;
  status: "open" | "closed" | "liquidated";
  createdAt: Date;
  closedAt?: Date;
}

interface AssetPrice {
  symbol: string;
  buyPrice: bigint;
  sellPrice: bigint;
  decimals: number;
}

const USD_DECIMAL = 2;
const INITIAL_BALANCE = BigInt(500000);
const ALLOWED_LEVERAGE = [1, 5, 10, 20, 100];

const ASSET_CONFIG = {
  BTC: {
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 4,
    binanceSymbol: "BTCUSDT",
  },
  ETH: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 4,
    binanceSymbol: "ETHUSDT",
  },
  SOL: {
    name: "Solana",
    symbol: "SOL",
    decimals: 4,
    binanceSymbol: "SOLUSDT",
  },
  BNB: {
    name: "BNB",
    symbol: "BNB",
    decimals: 4,
    binanceSymbol: "BNBUSDT",
  },
};

const users: User[] = [];
const trades: Trade[] = [];
const assetPrices = new Map<string, AssetPrice>();

const findUserById = (id: string): User | undefined => {
  return users.find((user) => user.id === id);
};

const findUserByEmail = (email: string): User | undefined => {
  return users.find((user) => user.email === email);
};

const getUserIdFromToken = (token: string): string | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch (error) {
    return null;
  }
};

const calculatePnL = (trade: Trade, currentPrice: bigint): bigint => {
  const exposure = trade.margin * BigInt(trade.leverage);
  const priceDiff = currentPrice - trade.openPrice;

  if (trade.type === "buy") {
    return (priceDiff * exposure) / trade.openPrice;
  } else {
    return (-priceDiff * exposure) / trade.openPrice;
  }
};

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const userId = getUserIdFromToken(token);
  if (!userId) {
    return res.status(404).json({ error: "Invalid token" });
  }

  req.userId = userId;
  next();
};

redis.subscribe("trades", (err: Error, count: any) => {
  if (err) {
    console.error("Failed to subscribe to Redis : ", err);
  } else {
    console.log(`Subscribe to ${count} channel(s)`);
  }
});

redis.on("message", (channel: string, message: any) => {
  if (channel === "trades") {
    try {
      const data = JSON.parse(message, (key, value) => {
        if (key === "price" || key === "bid" || key === "ask") {
          return BigInt(value);
        }
        return value;
      });

      let assetSymbol = "";
      for (const [symbol, config] of Object.entries(ASSET_CONFIG)) {
        if (config.binanceSymbol === data.symbol) {
          assetSymbol = symbol;
          break;
        }
      }

      if (assetSymbol) {
        const assetConfig =
          ASSET_CONFIG[assetSymbol as keyof typeof ASSET_CONFIG];
        assetPrices.set(assetSymbol, {
          symbol: assetSymbol,
          buyPrice: data.ask,
          sellPrice: data.bid,
          decimals: assetConfig.decimals,
        });
      }
    } catch (error) {
      console.error("Error parsing Redis message : ", error);
    }
  }
});

app.post("/api/v1/user/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password is required" });
    }

    const user = findUserByEmail(email);
    if (user) {
      return res
        .status(401)
        .json({ error: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const id = uuidv4();

    users.push({
      id: id,
      email: email,
      password: hashedPassword,
      balance: INITIAL_BALANCE,
    });

    res.status(200).json({ userId: id });
  } catch (error) {
    return res.status(500).json({ message: "Error while signing up" });
  }
});

app.post("/api/v1/user/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password is required" });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect password" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.status(200).json({ token: token });
  } catch (error) {
    return res.status(500).json({ message: "Error while signing in" });
  }
});

app.post("/api/v1/trade", authenticateToken, (req: any, res) => {
  try {
    const { asset, type, margin, leverage } = req.body;
    const userId = req.userId;

    if (!asset || !type || !margin || !leverage) {
      return res.status(400).json({ message: "fields cannot be empty" });
    }

    if (type !== "buy" && type !== "sell") {
      return res.status(401).json({ message: "Incorrect type input" });
    }

    if (!ALLOWED_LEVERAGE.includes(leverage)) {
      return res.status(401).json({ message: "Incorrect leverage input" });
    }

    if (!ASSET_CONFIG[asset as keyof typeof ASSET_CONFIG]) {
      return res.status(401).json({ message: "Incorrect inputs" });
    }

    const user = findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const marginBigInt = BigInt(margin);
    if (marginBigInt <= 0 || user.balance < marginBigInt) {
      return res
        .status(411)
        .json({ message: "margin <= 0 or margin > user's balance " });
    }

    const assetPrice = assetPrices.get(asset);
    if (!assetPrice) {
      return res.status(400).json({ error: "Asset price not available" });
    }

    const openPrice =
      type === "buy" ? assetPrice.buyPrice : assetPrice.sellPrice;
    user.balance -= marginBigInt;

    const orderId = uuidv4();
    const newTrade: Trade = {
      orderId,
      userId,
      asset,
      type,
      margin: marginBigInt,
      leverage,
      openPrice,
      status: "open",
      createdAt: new Date(),
    };

    trades.push(newTrade);
    res.status(200).json({ orderId: orderId });
  } catch (err) {
    console.error("Create order error : ", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/v1/trades/open", authenticateToken, (req: any, res) => {
  try {
    const userId = req.userId;
    const userOpenTrades = trades.filter(
      (t) => t.userId === userId && t.status === "open"
    );

    const formattedTrades = userOpenTrades.map((trade) => ({
      orderId: trade.orderId,
      type: trade.type,
      margin: Number(trade.margin),
      leverage: trade.leverage,
      openPrice: Number(trade.openPrice),
    }));
    res.status(200).json({ trades: formattedTrades });
  } catch (err) {
    console.error("Get open orders error :", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/v1/trades", authenticateToken, (req: any, res) => {
  try {
    const userId = req.userId;
    const userClosedTrades = trades.filter(
      (t) =>
        (t.userId === userId && t.status === "closed") ||
        status === "liquidated"
    );

    const formattedTrades = userClosedTrades.map((trade) => ({
      orderId: trade.orderId,
      type: trade.type,
      margin: Number(trade.margin),
      leverage: trade.leverage,
      openPrice: Number(trade.openPrice),
      closePrice: trade.closePrice ? Number(trade.closePrice) : null,
      pnl: trade.pnl ? Number(trade.pnl) : null,
    }));

    res.status(200).json({ trades: formattedTrades });
  } catch (err) {
    console.error("Get closed orders error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/v1/user/balance", authenticateToken, (req: any, res) => {
  try {
    const userId = req.userId;
    const user = findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ usd_balance: Number(user.balance)});
  } catch (err) {
    console.error("Get balance error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/v1/assets", (req, res) => {
  try {
    const assets = Object.entries(ASSET_CONFIG).map(([symbol, config]) => {
      const price = assetPrices.get(symbol);
      return {
        name: config.name,
        symbol: config.symbol,
        buyPrice: price ? Number(price.buyPrice) : 0,
        sellPrice: price ? Number(price.sellPrice) : 0,
        decimals: config.decimals
      };
    });

    res.json({ assets });
  } catch (err) {
    console.error("Get assets error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

redis.on("connect", () => console.log("Connected to Redis"));
redis.on("error", (err : Error) => console.error("Redis error:", err));

app.listen(PORT)
