// BTC race bot: slow EMA trend rider with take-profit / stop-loss exits.
// Strategy: long only, one position at a time.
//   - Enter 100% of cash when EMA(90) crosses above EMA(150) on 1-minute closes.
//   - Exit the whole position when price reaches +1.5% (take profit) or -1.2%
//     (stop loss) vs the fill price, or when EMA(90) crosses back below EMA(150).
//   - No trades before bar 150 (the slow EMA needs to warm up).
//   - Orders are decided on the bar that just closed and fill at the next bar's
//     open; max_slippage_bps 200 caps the move from the latest close.
// Deterministic: no randomness, no wall clock, no environment reads. All state
// comes from the harness messages (hello / batch / done) on stdin.

const BPS = 10000;
const FAST_N = 90;
const SLOW_N = 150;
const TP_BPS = 150; // +1.5%
const SL_BPS = 120; // -1.2%
const MAX_SLIPPAGE_BPS = 200;

let symbol = "CBBTC";
let warmupBars = 0;
let seq = -1;
const closes: number[] = [];
let emaFast = 0;
let emaSlow = 0;
let prevFast = 0;
let prevSlow = 0;
let barsSeen = 0;

// Position tracking, from the harness account + our own fills.
let positionQty = 0n;
let cash = 0n;
let entryPrice = 0; // fill price of the open position (price_scale units), 0 = flat
let orderCount = 0;

const kFast = 2 / (FAST_N + 1);
const kSlow = 2 / (SLOW_N + 1);

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let idx = buffer.indexOf("\n");
  while (idx >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line.length > 0) handleLine(line);
    idx = buffer.indexOf("\n");
  }
});

function handleLine(line: string): void {
  const msg = JSON.parse(line);
  if (msg.type === "hello") {
    symbol = (msg.symbols && msg.symbols[0] && msg.symbols[0].symbol) || "CBBTC";
    warmupBars = msg.warmup_bars ?? 0;
    cash = BigInt(msg.capital.quote_units);
    return;
  }
  if (msg.type === "batch") {
    seq = msg.seq;
    const account = msg.account;
    cash = BigInt(account.cash_quote_units);
    positionQty = 0n;
    for (const p of account.positions ?? []) {
      if (p.symbol === symbol) positionQty = BigInt(p.qty);
    }
    // Record fills: a filled buy sets our entry price.
    for (const f of msg.fills ?? []) {
      if (f.symbol === symbol && f.status === "filled") {
        if (f.side === "buy") entryPrice = Number(f.price);
        if (f.side === "sell") entryPrice = 0;
      }
    }
    // The batch carries one bar for our symbol.
    const bar = (msg.bars ?? []).find((b: any) => b.symbol === symbol);
    if (!bar) {
      sendReply([]);
      return;
    }
    const close = Number(bar.c);
    if (barsSeen === 0) {
      emaFast = close;
      emaSlow = close;
    } else {
      prevFast = emaFast;
      prevSlow = emaSlow;
      emaFast = emaFast + kFast * (close - emaFast);
      emaSlow = emaSlow + kSlow * (close - emaSlow);
    }
    closes.push(close);
    barsSeen += 1;

    const orders: any[] = [];
    const warmingUp = warmupBars > 0 && seq < warmupBars;
    if (!warmingUp && barsSeen > SLOW_N) {
      if (positionQty === 0n) {
        // Cross up: fast EMA moves above slow EMA.
        if (emaFast > emaSlow && prevFast <= prevSlow) {
          if (cash >= 1000000n) {
            orderCount += 1;
            orders.push({
              side: "buy",
              client_id: "trend-" + orderCount,
              symbol: symbol,
              notional_quote_units: cash.toString(),
              max_slippage_bps: MAX_SLIPPAGE_BPS,
            });
          }
        }
      } else if (entryPrice > 0) {
        const chgBps = ((close - entryPrice) * BPS) / entryPrice;
        const crossBack = emaFast < emaSlow;
        if (chgBps >= TP_BPS || chgBps <= -SL_BPS || crossBack) {
          orderCount += 1;
          orders.push({
            side: "sell",
            client_id: "exit-" + orderCount,
            symbol: symbol,
            qty: positionQty.toString(),
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          });
        }
      }
    }
    sendReply(orders);
    return;
  }
  if (msg.type === "done") {
    process.exit(0);
  }
}

function sendReply(orders: any[]): void {
  const out = JSON.stringify({ type: "reply", seq: seq, orders: orders });
  process.stdout.write(out + "\n");
}
