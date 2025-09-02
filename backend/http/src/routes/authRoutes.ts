import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { users, findUserByEmail } from "../services/dataStore.js"
import { JWT_SECRET, saltRounds, INITIAL_BALANCE } from "../config/constants.js";

export const authRoutes = Router();

authRoutes.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password is required" });
    }

    const user = findUserByEmail(email);
    if (user) {
      return res.status(401).json({ error: "User with this email already exists" });
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

authRoutes.post("/signin", async (req, res) => {
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