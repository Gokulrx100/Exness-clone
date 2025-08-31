import express from "express";
import {Pool} from "pg";
import Redis from "ioredis";
import cors from "cors";

const app =express();
const PORT = 3000;
app.use(express.json());
app.use(cors());

const pool = new Pool({
    user : "gokul",
    host : "localhost",
    database : "tradingDB",
    password : "gokupass",
    port : 5432
});

