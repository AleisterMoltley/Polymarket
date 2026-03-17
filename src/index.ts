import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";

import { loadStore, saveStore, getItem, setItem } from "./utils/jsonStore";
import { setLogBroadcastCallback, setTradeBroadcastCallback, type LogType, type TradeLogData } from "./utils/logger";
import adminRouter from "./admin/tabs";
import { runTradingLoop, stopTradingLoop } from "./bot/trading";
import { getStats, flushStats } from "./admin/stats";
import { 
  initTradingMode, 
  getTradingMode, 
  getTradingModeState, 
  setTradingMode, 
  toggleTradingMode,
  type TradingMode
} from "./admin/tradingMode";
import { 
  startSpeedTrading, 
  stopSpeedTrading, 
  isSpeedTradingRunning, 
  getSpeedTradeState,
  getSpeedTradeHistory
} from "./bot/speedTrade";

// ── Bootstrap ──────────────────────────────────────────────────────────────

loadStore();
initTradingMode();

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const STATS_BROADCAST_INTERVAL = parseInt(process.env.STATS_BROADCAST_INTERVAL_MS ?? "10000", 10);
const SHUTDOWN_TIMEOUT_MS = 10000; // Force shutdown after 10 seconds

// ── Trading Settings Defaults ──────────────────────────────────────────────
const DEFAULT_TRADE_PERCENT = 10;
const DEFAULT_MAX_POSITION_SIZE = parseFloat(process.env.MAX_POSITION_SIZE_USDC ?? "100");
const DEFAULT_MIN_TRADE_SIZE = 1;
const DEFAULT_DAILY_LOSS_LIMIT = 0;
const DEFAULT_PAPER_BALANCE = parseFloat(process.env.PAPER_TRADING_BALANCE ?? "1000");

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[http] ${req.method} ${req.path}`);
  next();
});

// Static assets (admin SPA / public pages)
app.use(express.static(path.join(__dirname, "..", "public")));

// Admin API tabs
app.use("/admin", adminRouter);

// Simple liveness probe
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness probe (check if trading loop is running)
app.get("/ready", (_req, res) => {
  res.json({ 
    status: "ready", 
    timestamp: new Date().toISOString(),
    stats: getStats(),
    speedTrading: isSpeedTradingRunning()
  });
});

// Speed trading API endpoints
app.get("/api/speed-trade/status", (_req, res) => {
  res.json({
    running: isSpeedTradingRunning(),
    state: getSpeedTradeState(),
    history: getSpeedTradeHistory().slice(-50) // Last 50 trades
  });
});

app.post("/api/speed-trade/start", async (_req, res) => {
  try {
    await startSpeedTrading();
    res.json({ success: true, message: "Speed trading started" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

app.post("/api/speed-trade/stop", (_req, res) => {
  stopSpeedTrading();
  res.json({ success: true, message: "Speed trading stopped" });
});

// ── Trading Mode API endpoints ─────────────────────────────────────────────

// Get current trading mode
app.get("/api/trading-mode", (_req, res) => {
  res.json(getTradingModeState());
});

// Set trading mode
app.post("/api/trading-mode", (req, res) => {
  try {
    const { mode } = req.body as { mode?: string };
    
    if (!mode || (mode !== "paper" && mode !== "live")) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid mode. Must be "paper" or "live".' 
      });
      return;
    }
    
    const newState = setTradingMode(mode as TradingMode, "dashboard");
    
    // Broadcast mode change to all connected clients
    broadcast("tradingMode", newState);
    
    res.json({ 
      success: true, 
      message: `Trading mode changed to ${mode}`,
      state: newState 
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// Toggle trading mode
app.post("/api/trading-mode/toggle", (_req, res) => {
  try {
    const newState = toggleTradingMode("dashboard");
    
    // Broadcast mode change to all connected clients
    broadcast("tradingMode", newState);
    
    res.json({ 
      success: true, 
      message: `Trading mode toggled to ${newState.mode}`,
      state: newState 
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// ── Trade Percent API endpoint ─────────────────────────────────────────────

// Get current trade percent setting
app.get("/api/trade-percent", (_req, res) => {
  const percent = getItem<number>("tradePercent") ?? 10;
  res.json({ percent });
});

// Set trade percent (1-100%)
app.post("/api/trade-percent", (req, res) => {
  try {
    const { percent } = req.body as { percent?: number };
    
    if (percent === undefined || percent < 1 || percent > 100) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid percent. Must be between 1 and 100.' 
      });
      return;
    }
    
    setItem("tradePercent", percent, true);
    
    res.json({ 
      success: true, 
      message: `Trade percent set to ${percent}%`,
      percent 
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// ── Trading Settings API endpoints ─────────────────────────────────────────

interface TradingSettings {
  tradePercent: number;
  maxPositionSize: number;
  minTradeSize: number;
  dailyLossLimit: number;
  currentBalance: number;
}

// Get all trading settings
app.get("/api/trading-settings", (_req, res) => {
  const tradePercent = getItem<number>("tradePercent") ?? DEFAULT_TRADE_PERCENT;
  const maxPositionSize = getItem<number>("maxPositionSize") ?? DEFAULT_MAX_POSITION_SIZE;
  const minTradeSize = getItem<number>("minTradeSize") ?? DEFAULT_MIN_TRADE_SIZE;
  const dailyLossLimit = getItem<number>("dailyLossLimit") ?? DEFAULT_DAILY_LOSS_LIMIT;
  
  res.json({
    tradePercent,
    maxPositionSize,
    minTradeSize,
    dailyLossLimit,
    currentBalance: DEFAULT_PAPER_BALANCE // For paper mode; live mode would get actual balance
  });
});

// Update trading settings (partial update)
app.post("/api/trading-settings", (req, res) => {
  try {
    const { maxPositionSize, minTradeSize, dailyLossLimit, tradePercent } = req.body as Partial<TradingSettings>;
    
    const updates: string[] = [];
    
    // Update max position size
    if (maxPositionSize !== undefined) {
      if (maxPositionSize < 1 || maxPositionSize > 100000) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid maxPositionSize. Must be between 1 and 100,000 USDC.' 
        });
        return;
      }
      setItem("maxPositionSize", maxPositionSize, true);
      updates.push(`maxPositionSize=${maxPositionSize}`);
    }
    
    // Update min trade size
    if (minTradeSize !== undefined) {
      if (minTradeSize < 0.1 || minTradeSize > 1000) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid minTradeSize. Must be between 0.1 and 1,000 USDC.' 
        });
        return;
      }
      setItem("minTradeSize", minTradeSize, true);
      updates.push(`minTradeSize=${minTradeSize}`);
    }
    
    // Update daily loss limit
    if (dailyLossLimit !== undefined) {
      if (dailyLossLimit < 0 || dailyLossLimit > 100000) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid dailyLossLimit. Must be between 0 and 100,000 USDC.' 
        });
        return;
      }
      setItem("dailyLossLimit", dailyLossLimit, true);
      updates.push(`dailyLossLimit=${dailyLossLimit}`);
    }
    
    // Update trade percent
    if (tradePercent !== undefined) {
      if (tradePercent < 1 || tradePercent > 100) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid tradePercent. Must be between 1 and 100.' 
        });
        return;
      }
      setItem("tradePercent", tradePercent, true);
      updates.push(`tradePercent=${tradePercent}%`);
    }
    
    if (updates.length === 0) {
      res.status(400).json({ 
        success: false, 
        error: 'No valid settings provided.' 
      });
      return;
    }
    
    console.log(`[settings] Trading settings updated: ${updates.join(', ')}`);
    
    res.json({ 
      success: true, 
      message: `Settings updated: ${updates.join(', ')}`,
      settings: {
        tradePercent: getItem<number>("tradePercent") ?? DEFAULT_TRADE_PERCENT,
        maxPositionSize: getItem<number>("maxPositionSize") ?? DEFAULT_MAX_POSITION_SIZE,
        minTradeSize: getItem<number>("minTradeSize") ?? DEFAULT_MIN_TRADE_SIZE,
        dailyLossLimit: getItem<number>("dailyLossLimit") ?? DEFAULT_DAILY_LOSS_LIMIT
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// ── HTTP + WebSocket server ────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Set up logger callbacks for WebSocket broadcasting
setLogBroadcastCallback((type: LogType, message: string) => {
  broadcast("log", { type, message, timestamp: Date.now() });
});

setTradeBroadcastCallback((trade: TradeLogData) => {
  broadcast("trade", trade);
});

wss.on("connection", (ws: WebSocket) => {
  console.log("[ws] Client connected");

  // Send current stats and trading mode immediately on connection
  ws.send(JSON.stringify({ event: "stats", data: getStats() }));
  ws.send(JSON.stringify({ event: "tradingMode", data: getTradingModeState() }));

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { command?: string };
      if (msg.command === "stats") {
        ws.send(JSON.stringify({ event: "stats", data: getStats() }));
      }
      if (msg.command === "tradingMode") {
        ws.send(JSON.stringify({ event: "tradingMode", data: getTradingModeState() }));
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => console.log("[ws] Client disconnected"));
});

/** Broadcast a payload to all connected WebSocket clients. */
export function broadcast(event: string, data: unknown): void {
  const payload = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Auto-broadcast stats to all connected clients
let statsBroadcastTimer: NodeJS.Timeout | null = null;

function startStatsBroadcast(): void {
  statsBroadcastTimer = setInterval(() => {
    broadcast("stats", getStats());
  }, STATS_BROADCAST_INTERVAL);
  console.log(`[ws] Stats broadcast started (interval=${STATS_BROADCAST_INTERVAL}ms)`);
}

function stopStatsBroadcast(): void {
  if (statsBroadcastTimer) {
    clearInterval(statsBroadcastTimer);
    statsBroadcastTimer = null;
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────────────

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[server] Received ${signal}, starting graceful shutdown...`);

  // Stop the trading loop
  console.log("[server] Stopping trading loop...");
  stopTradingLoop();

  // Stop speed trading
  console.log("[server] Stopping speed trading...");
  stopSpeedTrading();

  // Stop stats broadcast
  stopStatsBroadcast();

  // Flush stats to disk
  console.log("[server] Flushing stats to disk...");
  flushStats();
  saveStore();

  // Close WebSocket connections
  console.log("[server] Closing WebSocket connections...");
  wss.clients.forEach((client) => {
    client.close(1000, "Server shutting down");
  });

  // Close HTTP server
  console.log("[server] Closing HTTP server...");
  server.close((err) => {
    if (err) {
      console.error("[server] Error during shutdown:", err);
      process.exit(1);
    }
    console.log("[server] Shutdown complete");
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
}

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[server] Unhandled rejection at:", promise, "reason:", reason);
});

// ── Start ──────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Admin UI  →  http://localhost:${PORT}/admin`);
  console.log(`[server] Health    →  http://localhost:${PORT}/health`);
  console.log(`[server] Speed Trade API  →  http://localhost:${PORT}/api/speed-trade/status`);
});

// Start auto-broadcast of stats
startStatsBroadcast();

// Start the trading loop (non-blocking)
runTradingLoop().catch((err) => {
  console.error("[bot] Trading loop crashed:", err);
  gracefulShutdown("tradingLoopCrash");
});

// Start speed trading if enabled via environment variable
const ENABLE_SPEED_TRADING = process.env.ENABLE_SPEED_TRADING === "true";
if (ENABLE_SPEED_TRADING) {
  startSpeedTrading().catch((err) => {
    console.error("[bot] Speed trading startup failed:", err);
    // Don't crash the whole server, just log the error
  });
}
