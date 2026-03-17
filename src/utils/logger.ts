/**
 * logger.ts — Centralized logging with WebSocket broadcast support
 *
 * This module provides a unified logging interface that:
 * - Logs to console
 * - Broadcasts log messages to connected WebSocket clients
 * - Supports different log levels (info, warn, error, trade, win, loss)
 */

// Callback type for log broadcasting
type LogBroadcastCallback = (type: LogType, message: string) => void;
type TradeBroadcastCallback = (trade: TradeLogData) => void;

export type LogType = "info" | "warn" | "error" | "trade" | "win" | "loss";

export interface TradeLogData {
  id: string;
  side: string;
  outcome: string;
  price: number;
  size: number;
  paper: boolean;
  pnl?: number;
  timestamp: number;
}

// Callbacks - set by index.ts after server is initialized
let logBroadcast: LogBroadcastCallback | null = null;
let tradeBroadcast: TradeBroadcastCallback | null = null;

/**
 * Set the log broadcast callback. Called by index.ts after WebSocket server is ready.
 */
export function setLogBroadcastCallback(callback: LogBroadcastCallback): void {
  logBroadcast = callback;
}

/**
 * Set the trade broadcast callback. Called by index.ts after WebSocket server is ready.
 */
export function setTradeBroadcastCallback(callback: TradeBroadcastCallback): void {
  tradeBroadcast = callback;
}

/**
 * Log a message with the specified type.
 */
export function log(type: LogType, message: string, prefix = "[bot]"): void {
  const timestamp = new Date().toISOString();
  const fullMessage = `${prefix} ${message}`;
  
  // Console output
  switch (type) {
    case "error":
      console.error(`[${timestamp}] ${fullMessage}`);
      break;
    case "warn":
      console.warn(`[${timestamp}] ${fullMessage}`);
      break;
    default:
      console.log(`[${timestamp}] ${fullMessage}`);
  }
  
  // Broadcast to WebSocket clients if callback is set
  if (logBroadcast) {
    logBroadcast(type, fullMessage);
  }
}

/**
 * Log and broadcast a trade event.
 */
export function logTrade(trade: TradeLogData): void {
  const pnlStr = trade.pnl !== undefined ? ` (PnL: ${trade.pnl.toFixed(2)} USDC)` : "";
  const modeStr = trade.paper ? "📝 PAPER" : "🔴 LIVE";
  const type: LogType = trade.pnl !== undefined ? (trade.pnl >= 0 ? "win" : "loss") : "trade";
  
  log(type, `${modeStr} ${trade.side} ${trade.size.toFixed(2)} ${trade.outcome} @ ${trade.price.toFixed(4)}${pnlStr}`, "[trade]");
  
  // Broadcast trade event
  if (tradeBroadcast) {
    tradeBroadcast(trade);
  }
}

// Convenience functions
export const logInfo = (message: string, prefix?: string) => log("info", message, prefix);
export const logWarn = (message: string, prefix?: string) => log("warn", message, prefix);
export const logError = (message: string, prefix?: string) => log("error", message, prefix);
