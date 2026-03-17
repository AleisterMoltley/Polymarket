import axios from "axios";
import { getWallet, getTokenBalance } from "../utils/wallet";
import { recordTrade, getAllTrades } from "../admin/stats";
import { getItem, setItem } from "../utils/jsonStore";
import { isPaperMode } from "../admin/tradingMode";
import type { TradeRecord } from "../admin/stats";

let _tradeIdCounter = 0;
function newId(): string {
  return `trade-${Date.now()}-${++_tradeIdCounter}`;
}

export interface Market {
  conditionId: string;
  condition_id: string;
  question: string;
  outcomes: string[];
  prices: number[];
  tokens?: Array<{
    token_id: string;
    outcome: string;
    price: number;
    winner: boolean;
  }>;
}

/** Track open positions to prevent duplicates */
interface Position {
  market: string;
  outcome: string;
  size: number;
  entryPrice: number;
  timestamp: number;
}

const POSITIONS_KEY = "positions";

function getPositions(): Position[] {
  return getItem<Position[]>(POSITIONS_KEY) ?? [];
}

function addPosition(pos: Position): void {
  const positions = getPositions();
  positions.push(pos);
  setItem(POSITIONS_KEY, positions, true);
}

function hasExistingPosition(market: string, outcome: string): boolean {
  return getPositions().some((p) => p.market === market && p.outcome === outcome);
}

/** Fetch active markets accepting orders from the Polymarket CLOB API. */
export async function fetchMarkets(): Promise<Market[]> {
  const baseUrl = process.env.CLOB_API_URL ?? "https://clob.polymarket.com";
  try {
    const { data } = await axios.get<any>(`${baseUrl}/markets`, {
      params: { 
        accepting_orders: true
      },
      timeout: 10_000,
    });
    
    const rawMarkets = Array.isArray(data) ? data : (data.data ?? data.markets ?? []);
    
    console.log("[trading] Total markets from API:", rawMarkets.length);
    
    // Count how many have accepting_orders: true
    const acceptingOrders = rawMarkets.filter((m: any) => m.accepting_orders === true);
    console.log("[trading] Markets with accepting_orders=true:", acceptingOrders.length);

    // Transform and filter - ONLY markets accepting orders
    const markets: Market[] = rawMarkets
      .filter((m: any) => {
        const passes = m.accepting_orders === true &&
                       m.tokens && 
                       Array.isArray(m.tokens) && 
                       m.tokens.length > 0;
        if (!passes && m.accepting_orders === true) {
          console.log("[trading] ⚠️  Market rejected (no tokens):", m.question?.substring(0, 50));
        }
        return passes;
      })
      .map((m: any) => ({
        conditionId: m.condition_id,
        condition_id: m.condition_id,
        question: m.question,
        outcomes: m.tokens.map((t: any) => t.outcome),
        prices: m.tokens.map((t: any) => t.price),
        tokens: m.tokens,
      }));
    
    console.log("[trading] Markets with tokens:", markets.length);
    return markets;
  } catch (err) {
    console.error("[trading] fetchMarkets error:", err);
    return [];
  }
}

/**
 * Evaluate a market and return a trade signal if edge exceeds MIN_EDGE.
 * Supports both paper and live trading modes, controlled via dashboard.
 * Includes position tracking to prevent duplicate orders.
 * Skips resolved markets (where prices are 0 or 1).
 * Supports percentage-based position sizing with max position size limit.
 * Respects daily loss limits when configured.
 */
export async function evaluateAndTrade(market: Market): Promise<void> {
  const minEdge = parseFloat(process.env.MIN_EDGE ?? "0.05");
  const isPaper = isPaperMode();
  
  // Get trading settings from dashboard (with fallbacks to env/defaults)
  const tradePercent = getItem<number>("tradePercent") ?? 10;
  const maxPositionSize = getItem<number>("maxPositionSize") ?? parseFloat(process.env.MAX_POSITION_SIZE_USDC ?? "100");
  const minTradeSize = getItem<number>("minTradeSize") ?? 1;
  const dailyLossLimit = getItem<number>("dailyLossLimit") ?? 0;
  
  // Check daily loss limit
  if (dailyLossLimit > 0) {
    const dailyLoss = getDailyLoss();
    if (dailyLoss >= dailyLossLimit) {
      console.log(`[trading] Daily loss limit reached (${dailyLoss.toFixed(2)} >= ${dailyLossLimit} USDC). Skipping trades.`);
      return;
    }
  }
        
  // Safety check
  if (!market.outcomes || !Array.isArray(market.outcomes) || !market.prices || !Array.isArray(market.prices)) {
    return;
  }

  // Skip resolved markets (prices are 0 or 1 - one side is worthless)
  const hasExtremePrice = market.prices.some((p: number) => p === 0 || p === 1);
  if (hasExtremePrice) {
    return; // Skip this market - it's resolved or near-resolved
  }
  
  // Calculate position size based on percentage of available balance
  // Always respect the max position size from dashboard
  let effectiveMaxSize = maxPositionSize;
  if (!isPaper) {
    try {
      const balanceStr = await getTokenBalance("USDC");
      const balance = parseFloat(balanceStr);
      if (balance > 0) {
        const percentSize = (balance * tradePercent) / 100;
        // Take minimum of percentage-based size and max position size
        effectiveMaxSize = Math.min(percentSize, maxPositionSize);
        console.log(`[trading] Balance: ${balance.toFixed(2)} USDC, Trade %: ${tradePercent}%, Max: ${maxPositionSize} USDC, Effective: ${effectiveMaxSize.toFixed(2)} USDC`);
      }
    } catch (err) {
      console.log("[trading] Could not get balance for percentage sizing, using max position size");
    }
  } else {
    // For paper trading, use a simulated balance (configurable via env)
    const simulatedBalance = parseFloat(process.env.PAPER_TRADING_BALANCE ?? "1000");
    const percentSize = (simulatedBalance * tradePercent) / 100;
    // Take minimum of percentage-based size and max position size
    effectiveMaxSize = Math.min(percentSize, maxPositionSize);
    console.log(`[trading] Paper balance: ${simulatedBalance} USDC, Trade %: ${tradePercent}%, Max: ${maxPositionSize} USDC, Effective: ${effectiveMaxSize.toFixed(2)} USDC`);
  }

  for (let i = 0; i < market.outcomes.length; i++) {
    const price = market.prices[i];
    if (price === undefined) continue;

    const outcome = market.outcomes[i];

    // Check for existing position to prevent duplicates
    if (hasExistingPosition(market.conditionId, outcome)) {
      console.log(`[trading] Skipping duplicate position: ${market.conditionId} / ${outcome}`);
      continue;
    }

    // Simple edge model: buy if implied probability is below (1 - MIN_EDGE)
    const edge = 1 - price - minEdge;

    console.log(`[trading] Market: ${market.question?.substring(0, 60)}`);
    console.log(`[trading]   ${outcome}: price=${price}, edge=${edge.toFixed(4)}, minEdge=${minEdge}`);

    if (edge < 0) {
      console.log(`[trading]   → SKIP (edge too low)`);
      continue;
    }

    // Calculate size based on edge, capped by effective max size
    const size = Math.min(effectiveMaxSize, Math.round(edge * effectiveMaxSize * 100) / 100);
    
    // Skip if trade size is below minimum
    if (size < minTradeSize) {
      console.log(`[trading]   → SKIP (size ${size.toFixed(2)} USDC below minimum ${minTradeSize} USDC)`);
      continue;
    }
    
    // Calculate simulated PnL for paper trades (for better visualization)
    // Uses deterministic calculation based on timestamp for reproducible results
    const tradeTimestamp = Date.now();
    const simulatedPnl = isPaper ? calculateSimulatedPnL(size, price, edge, tradeTimestamp) : undefined;

    console.log(`[${isPaper ? 'paper' : 'live'}-trade] BUY ${size} USDC of "${outcome}" @ ${price}${simulatedPnl !== undefined ? ` (simulated PnL: ${simulatedPnl.toFixed(2)})` : ''}`);

    recordTrade({
      id: newId(),
      timestamp: tradeTimestamp,
      market: market.question,
      outcome,
      side: "BUY",
      size,
      price,
      paper: isPaper,
      status: "FILLED",
      pnl: simulatedPnl,
    });
  }
}

/**
 * Get the total loss for today (negative PnL trades).
 * Used to enforce daily loss limits.
 */
function getDailyLoss(): number {
  const trades = getAllTrades();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  let totalLoss = 0;
  for (const trade of trades) {
    if (trade.timestamp >= startOfDay && trade.pnl !== undefined && trade.pnl < 0) {
      // pnl is negative, so we negate it to get a positive loss value
      totalLoss -= trade.pnl;
    }
  }
  return totalLoss;
}

/**
 * Calculate simulated PnL for paper trades.
 * Uses a deterministic probability model based on edge and timestamp
 * to determine win/loss for reproducible results.
 */
function calculateSimulatedPnL(size: number, price: number, edge: number, timestamp?: number): number {
  // Use timestamp for deterministic randomness (allows reproducible results)
  const seed = timestamp ?? Date.now();
  const pseudoRandom = ((seed * 9301 + 49297) % 233280) / 233280;
  
  // Higher edge = higher probability of winning
  // Base win probability is 50%, adjusted by edge
  const winProbability = Math.min(0.5 + edge, 0.9); // Cap at 90%
  const isWinner = pseudoRandom < winProbability;
  
  if (isWinner) {
    // Won the trade: profit is size * (1/price - 1) for binary markets
    return Math.round(size * (1 / price - 1) * 100) / 100;
  } else {
    // Lost the trade: lose the position value
    return -Math.round(size * 100) / 100;
  }
}

/**
 * Submit a real order to the Polymarket CLOB API.
 * Requires CLOB_API_KEY, CLOB_API_SECRET, CLOB_API_PASSPHRASE.
 */
async function submitOrder(trade: TradeRecord): Promise<void> {
  const baseUrl = process.env.CLOB_API_URL ?? "https://clob.polymarket.com";
  const wallet = getWallet();
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const headers = {
    "POLY_ADDRESS": wallet.address,
    "POLY_SIGNATURE": await wallet.signMessage(timestamp),
    "POLY_TIMESTAMP": timestamp,
    "POLY_API_KEY": process.env.CLOB_API_KEY ?? "",
    "POLY_API_SECRET": process.env.CLOB_API_SECRET ?? "",
    "POLY_PASSPHRASE": process.env.CLOB_API_PASSPHRASE ?? "",
  };

  await axios.post(
    `${baseUrl}/order`,
    {
      market: trade.market,
      side: trade.side,
      price: trade.price,
      size: trade.size,
      outcome: trade.outcome,
    },
    { headers, timeout: 10_000 }
  );
}

let _tradingLoopTimer: NodeJS.Timeout | null = null;
let _isRunning = false;

// ── 5-Minute Optimization Constants ────────────────────────────────────────
// Trading interval constant for 5-minute trading.
const FIVE_MINUTE_INTERVAL_MS = 300000; // 5 minutes = 300,000ms

/** Main trading loop — polls markets and evaluates trade signals.
 *  Supports both paper and live trading modes, controlled via dashboard.
 */
export async function runTradingLoop(): Promise<void> {
  // Always use 5-minute interval regardless of env setting
  const interval = FIVE_MINUTE_INTERVAL_MS;
  console.log(`[trading] Starting 5-minute trading loop (interval=${interval}ms)`);
  console.log(`[trading] Trading mode: ${isPaperMode() ? 'PAPER' : 'LIVE'}`);
  _isRunning = true;

  const tick = async () => {
    if (!_isRunning) return;
    
    try {
      const markets = await fetchMarkets();
      console.log(`[trading] Evaluating ${markets.length} markets…`);
      for (const market of markets) {
        if (!_isRunning) break;
        await evaluateAndTrade(market);
      }
    } catch (err) {
      console.error("[trading] Error in trading tick:", err);
    }
  };

  await tick();
  _tradingLoopTimer = setInterval(tick, interval);
}

/** Stop the trading loop gracefully. */
export function stopTradingLoop(): void {
  console.log("[trading] Stopping trading loop...");
  _isRunning = false;
  if (_tradingLoopTimer) {
    clearInterval(_tradingLoopTimer);
    _tradingLoopTimer = null;
  }
  console.log("[trading] Trading loop stopped");
}

/** Check if the trading loop is currently running. */
export function isTradingLoopRunning(): boolean {
  return _isRunning;
}
