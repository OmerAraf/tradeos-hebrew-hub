# TradeOS Insights

Build a complete trading journal web app called "TRADE·OS 2050". Build the FULL app in this single generation — all pages, all features, no placeholders.

LANGUAGE & DIRECTION: Entire UI in Hebrew, full RTL layout (dir="rtl"). Numbers and tickers stay LTR inline. IMPORTANT: wrap all chart containers in dir="ltr" to avoid recharts RTL rendering bugs — only chart labels/titles in Hebrew.

DESIGN: Futuristic dark theme with glassmorphism — deep navy/black background, frosted-glass cards (backdrop-blur, subtle borders), neon cyan/purple accents, green for profit, red for loss. Hebrew-friendly font (Heebo from Google Fonts). Fully responsive, mobile-first.

DATA: No backend, no Supabase, no auth. Persist everything in localStorage under key "tradeos_v1".

Trade fields: id, symbol, direction ("long"|"short"), entryDate, exitDate, entryPrice, exitPrice, quantity, fees, stopPrice (optional), strategy ("swing"|"long-term"), notes.
P&L calculation — be exact:
- long: (exitPrice - entryPrice) * quantity - fees
- short: (entryPrice - exitPrice) * quantity - fees
R-multiple (only if stopPrice exists): P&L / (|entryPrice - stopPrice| * quantity).

PAGES (top navbar, RTL):

1. דשבורד (Dashboard):
- KPI cards: total P&L, win rate %, profit factor, avg win, avg loss, avg R-multiple, total trades, best/worst trade
- Equity curve (cumulative P&L line chart, recharts)
- Monthly P&L bar chart (green/red bars)
- Breakdown table: P&L and win rate per symbol

2. יומן עסקאות (Trades):
- Sortable, filterable table (by symbol, direction, strategy, date range)
- Add/edit via modal form with validation, delete with confirm
- Row colors: green profit, red loss

3. ייבוא/גיבוי (Import & Backup):
- CSV upload + paste-text area. Generic parser: read the header row, auto-map columns by common names (symbol/ticker, qty/quantity/shares, price, date, side/type/buy/sell). If auto-mapping fails, show a manual column-mapping UI (dropdown per required field).
- Date parsing must handle common formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, with and without time.
- Match buy and sell transactions per symbol (FIFO) into round-trip trades. Support partial fills: if a position is closed in multiple sells (or opened in multiple buys), split into multiple round-trip trades with proportional quantities.
- Preview parsed trades in a table before confirming. Skip duplicates by (symbol, entryDate, entryPrice, quantity).
- Backup: "Export JSON" button downloads all data; "Import JSON" restores it.

4. תובנות (Insights):
- Auto-computed warning cards: strategy with win rate below 40%; symbols with 3+ losing trades; simultaneous conflicting long+short exposure on overlapping dates; avg loss larger than avg win; trades with stopPrice where R-multiple ≤ -1.5 flagged as "stop too tight or not honored".

Include 8 realistic sample trades as seed data (only when localStorage is empty), some with stopPrice.

All labels, buttons, warnings and empty states in Hebrew. Handle edge cases: empty data, invalid CSV, division by zero in stats.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/289af24c-ca8d-4d68-a128-1962073a327a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
