import express from "express";
import { Pool } from "pg";
import Redis from "ioredis";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {v4 as uuidv4} from "uuid";

const app = express();
const PORT = 3000;
const saltRounds = 10;
const JWT_SECRET = "blah_blah_blah";

app.use(express.json());
app.use(cors());

interface User {
    id : string
  email: string;
  password: string;
}

const users: User[] = [];

app.post("/api/v1/user/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password is required" });
    }

    const user = users.find((u) => {
      u.email === email;
    });
    if (user) {
      return res
        .status(401)
        .json({ error: "user with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const id = uuidv4();
    users.push({ id : id ,email : email, password: hashedPassword });
    res.status(200).json({ message: "signup successful" , userId : id});
  } catch (err) {
    return res.status(403).json({ message: "Error while signing up" });
  }
});

app.post("/api/v1/user/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password is required" });
  }

  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ error: "Incorrect password" });
  }

  const token = jwt.sign({ email: user.email }, JWT_SECRET);
  res.status(200).json({ message: "signin successful", token: token });
});

const pool = new Pool({
  user: "gokul",
  host: "localhost",
  database: "tradingDB",
  password: "gokupass",
  port: 5432,
});

app.listen(PORT);
