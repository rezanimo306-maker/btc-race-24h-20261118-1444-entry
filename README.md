# BTC Race 24h — EMA Trend Rider

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![make.fun · btc-race-24h-20261118-1444 rank](https://make.fun/badge/btc-race-24h-20261118-1444/rezanimo306-maker/btc-race-24h-20261118-1444-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![make.fun · btc-race-24h-20261118-1444 reward](https://make.fun/badge/btc-race-24h-20261118-1444/rezanimo306-maker/btc-race-24h-20261118-1444-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A BTC trading bot racing live for 24 hours, built for the [make.fun bounty "Race a BTC trading bot live for 24 hours"](https://make.fun/bounty/btc-race-24h-20261118-1444) ($250, top 10).

## What it does

A slow EMA trend rider. The bot goes long when the fast EMA(90) crosses above the slow EMA(150), committing 100% of cash, and rides the trend until it ends. It is long-only: it never shorts. Every position carries a take-profit at +1.5% and a stop-loss at −1.2%, and it exits early if the fast EMA crosses back below the slow EMA. The design is deliberately simple — one trend signal, one entry size, fixed exits — so it behaves the same on unseen bars as it did on the dev window.

## Dev result

On the frozen 1,440-bar dev window (24 hours of 1-minute cbBTC bars):

- **Net PnL: +$8.82** (starts from $1,000)
- **Trades: 4**
- **Max drawdown: 0.77%**

The dev grade is positive, so the bot qualifies to race. Dev numbers are provisional — the live 24-hour race is judged on unseen bars, and a trend rider can give back gains if the market turns choppy.

## Design notes

- **Why EMA 90/150:** the wide gap between the two averages filters out short-lived noise; a cross only fires when a genuine trend is forming, which keeps the trade count low (4 trades on the dev window) and the fee drag small.
- **Why 100% in, fixed exits:** one position at a time with a hard stop keeps the worst case bounded (max drawdown 0.77% on dev) and the behaviour easy to verify — there is no position sizing to misfire mid-race.
- **What can go wrong live:** in a sideways market the EMAs can cross back and forth and the stop-loss can be hit repeatedly; the take-profit and cross-back exit are the mitigations, but they do not guarantee a profit.

## How to run the local grade

From the kit directory:

```bash
node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

The bot reads one JSON line per minute and replies with its orders; fills happen at the next minute's open, with the harness fee, slippage, and impact model applied.

## Files

- `main.ts` — the bot
- `README.md` — this file
- `LICENSE` — MIT
