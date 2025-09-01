import { getUserIdFromToken } from "../services/dataStore.js";

export const authenticateToken = (req: any, res: any, next: any) => {
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