import { Pool } from "pg";
import Redis from "ioredis";

export const initializeDatabase = (): Pool => {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
  });
  
  return pool;
};

//@ts-ignore
export const initializeRedis = (): Redis => {
    //@ts-ignore
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
  });

  redis.on("connect", () => console.log("Connected to Redis"));
  redis.on("error", (err: Error) => console.error("Redis error:", err));
  
  return redis;
};