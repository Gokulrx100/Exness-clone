import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { initializeDatabase, initializeRedis } from "./config/database.js";
import { initializeEmailQueue, startEmailProcessors } from "./services/emailServices.js";
import { startPriceMonitoring } from "./services/priceMonitering.js";
import { authRoutes } from "./routes/authRoutes.js";
import { tradeRoutes } from "./routes/tradeRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";
import { marketRoutes } from "./routes/marketRoutes.js";

dotenv.config();

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(cors());

const pool = initializeDatabase();
const redis = initializeRedis();
const emailQueue = initializeEmailQueue();

startEmailProcessors(emailQueue);
startPriceMonitoring(redis, emailQueue);

app.use("/api/v1/user", authRoutes);
app.use("/api/v1", tradeRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1", marketRoutes);

app.listen(PORT, () => {
  console.log(`Trading server running on port ${PORT}`);
});

export default app;