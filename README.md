# Splash Markets SDK

TypeScript SDK for interacting with Splash Markets on Solana. This SDK provides a comprehensive set of tools for reading on-chain data, building transactions, and managing betting markets.

## Installation

```bash
npm install @splash-markets/splash-markets-sdk
```

## Requirements

**Important:** This SDK is designed to work with `@solana/kit`, not `@solana/web3.js`. All RPC operations, address types, and instruction building use `@solana/kit` APIs.

```bash
npm install @solana/kit
```

## SDK Layout

The SDK is organized into modules by functionality, with each module typically containing three types of files:

### Module Structure

Each module (`betting`, `market_management`, `liquidity`, `product_admin`) follows a consistent structure:

- **`readers.ts`** - Functions for fetching and decoding on-chain account data
- **`actions.ts`** - High-level functions that sanitize input data and build instructions (recommended for most use cases)
- **`instructions.ts`** - Low-level functions that build raw instructions directly with minimal validation

### Main Modules

```
src/
├── betting/          # Betting operations (buy, sell, parlay, etc.)
├── market_management/# Market creation and management
├── liquidity/        # Liquidity provider operations
├── product_admin/    # Product configuration and administration
├── core/readers.ts   # Core program readers
├── utils.ts          # Utility functions
├── solana_utils.ts   # Solana-specific utilities (PDAs, ATAs, etc.)
├── constants.ts      # Program constants and addresses
├── types.ts          # TypeScript type definitions
└── validation.ts     # Input validation helpers
```

## Usage Guide

### Readers (`readers.ts`)

Readers fetch and decode on-chain account data. Use these functions when you need to read the current state of accounts.

**Characteristics:**
- Fetch account data from the blockchain
- Decode account data into TypeScript types
- Return structured account objects
- No data sanitization (data comes directly from chain)
- Numeric types follow the program’s Rust types: **u64/i64** → `bigint` (e.g. amounts, market_id, bet_id); **u32/u16/u8** → `number` (e.g. freebet_id, placed_at, event, product_id). Use `scaledToUi()` to convert scaled bigint amounts to display numbers.

### Actions (`actions.ts`)

Actions are high-level functions that accept user-friendly inputs, validate and sanitize the data, then build instructions. **Use these for most use cases.**

**Characteristics:**
- Accept user-friendly inputs (e.g., `amount_ui` for UI amounts, `amount_pc` for percentages (0-1))
- Validate all inputs with helpful error messages
- Automatically convert UI amounts to scaled bigints
- Handle data sanitization (e.g., de-vigging odds, scaling amounts)
- Return complete, ready-to-use `Instruction` objects from `@solana/kit`
- **Recommended for most applications**

### Instructions (`instructions.ts`)

Instructions build raw instruction data with minimal validation. Use these when you need fine-grained control and have already validated/sanitized your inputs.

**Characteristics:**
- Accept already-scaled/properly formatted inputs
- Minimal validation (basic type checking only)
- No data sanitization (you must handle this yourself)
- Return `Instruction` objects from `@solana/kit`
- **Use when you need low-level control or have pre-validated inputs**

## Important Concepts

### Fee Payer, Owner, and Account Fee Payer

User-facing instructions distinguish between who pays transaction fees and who owns the position:

- **`fee_payer`** – The account that signs the transaction and pays network fees. In **actions**, this is optional and defaults to `owner`.
- **`owner`** – The account that owns the position (e.g. the bet, the LP position). This is the “user” in business logic.
- **`account_fee_payer`** – For instructions that **close** an account (e.g. claim position, sell, handle sell request), the account that receives the closed account’s rent. In **actions**, this is optional and defaults to `fee_payer`.

**In `actions.ts`:** You typically pass `owner`; `feePayer` and `accountFeePayer` are optional and default to `owner` and `feePayer` respectively. Example: `getBuyForInstruction(owner, ...)` or `getBuyForInstruction(owner, ..., feePayer)`.

**In `instructions.ts`:** The low-level builders require explicit `feePayer` and `owner` (and `accountFeePayer` where the instruction closes an account). There is no default; you must pass all of them.

### Number types (Rust → TypeScript)

The SDK maps the program’s Rust integer types to TypeScript as follows:

| Rust type | TypeScript type | Examples |
|-----------|-----------------|----------|
| **u64**, **i64** | `bigint` | `market_id`, `bet_id`, amounts, scaled token amounts |
| **u32** | `number` | `event`, `event_start`, `freebet_id`, `placed_at`, `created_at`, `lock_time`, `go_live_time`, `sequence`, timestamps (u32) |
| **u16**, **u8** | `number` | `product_id`, `category`, `sub_category`, `outcome_index` |

Use `bigint` for u64/i64 (e.g. `10_500_000n` for scaled amounts). Use plain `number` for u32/u16/u8 (e.g. `freebetId: 0`, `event: 12345`). Actions and types use these consistently; readers return decoded account data in the same mapping.

### Ids

- **Product ID**: A unique identifier for a product (u16 → `number`). Used to identify the product on the chain.
- **Market ID**: A unique identifier for a market (u64 → `bigint`). Can be a random or deterministic value; used to identify the market and generate the market PDA.
- **Category**: A unique identifier for a category of a market (u8 → `number`). Used for filtering and grouping markets.
- **Sub Category**: A unique identifier for a sub category of a market (u16 → `number`). Used for filtering and grouping markets.
- **Event**: A unique identifier for an event (u32 → `number`). Used for filtering and grouping markets, and preventing parlay bet selections on the same event.
- **Other id bytes**: Extra bytes for forming more detailed market identifiers. Can be used for additional filtering and grouping.
- **Bet ID**: A unique identifier for a bet (u64 → `bigint`). Used to identify the bet and generate the bet PDA.
- **Outcome Index**: The index of the outcome in the market, starting from 1 (u8 → `number`). Used to identify the outcome.
- **Freebet ID**: A unique identifier for a freebet (u32 → `number`). Used to identify the freebet and generate the freebet PDA.
- **Deposit ID**: A unique identifier for a deposit to the LP (u64 → `bigint`). Used to identify the deposit and generate the deposit PDA.


### Odds Format

- **Decimal odds format**: `2.5` means a $1 bet returns $2.50 (profit + stake)
- Odds must be greater than 1.0
- Used in some return values in the SDK (e.g. `getMarketOdds`, `getParlayReturn`)

- **Probability odds format**: `0.4` means a 40% chance of the outcome happening
- Used in the oracle data (e.g. `OracleAccount.data.probabilities`)
- Program expects probabilities to always sum to exactly 1.0 and are then scaled by `PC_SCALE = 10_000` 

- **American odds format**: `-150` means a $100 bet returns $150 (profit + stake)
- Not used in the program but supported for conversion.

To convert between odds formats, use the `convertOdds` utility:
```typescript
import { convertOdds } from 'splash-markets-sdk';

// Convert American odds to decimal
const decimalOdds = convertOdds('american', -150, 'dec'); // 1.67

// Convert decimal odds to probability
const probability = convertOdds('dec', 2.5, 'prob'); // 0.4
```

### Vig (Overround) and De-vigging

**Vig** (also called overround) is the built-in margin in betting odds that ensures the house maintains an edge. The SDK automatically handles de-vigging when creating markets.

**How it works:**
- The on-chain program requires **de-vigged odds** (true probability odds)
- When you provide odds with vig (e.g., `[1.85, 1.9]` for a 2-outcome market), the SDK calculates the overround and automatically de-vigs by multiplying each odd by the overround
- Overround = sum of (1/odd) for all outcomes

**Example:**

- You provide odds: [1.85, 1.9]
- Overround = 1/1.85 + 1/1.9 = 1.078
- SDK automatically de-vigs: [1.85 * 1.078, 1.9 * 1.078] = [1.9753, 2.0462]
- If you want to use your own de-vigging method, provide already de-vigged odds

### Input Suffixes: `_pc` and `_ui`

The SDK uses suffixes to distinguish between different input formats:

- **`tokenInfo`** - **Token information** object `{ mint: Address, decimals: number }` used across all actions that need token mint and decimals. Validated by `validateTokenInfo()` (mint must be a valid address, decimals must be an integer between 1 and 18).

- **`_ui`** - **User Interface** amounts (human-readable decimal values)
  - Example: `amount_ui: 10.5` means 10.5 tokens
  - Automatically converted to scaled bigints using token decimals
  - Used in `actions.ts` functions

- **`_pc`** - **Percentage** values in decimal format (0-1 range)
  - Example: `trim_pc: 0.05` means 5% trim (0.05 in decimal = 5%)
  - Automatically converted to scaled integers (multiplied by `PC_SCALE = 10_000`, so 0.05 = 500)
  - Used in `actions.ts` functions

**Examples:**
```typescript
// In actions.ts - use _ui and _pc suffixes; owner (and optional feePayer)
// tokenInfo: { mint, decimals } is used for token mint address and decimals
await getBuyForInstruction(
   owner,                 // or pass feePayer as second optional for relayers
   productId,
   marketId,
   betId,
   outcomeIndex,
   10.5,                  // amount_ui: 10.5 USDC
   15.0,                  // minReturn_ui: 15.0 USDC
   { mint: usdcMint, decimals: 6 },  // tokenInfo
   needsOracle
   // optional: feePayer if different from owner
);

await getControlledCreateMarketInstruction(
   // ...
   trim_pc: 0.05,        // 5% trim (decimal format: 0.05 = 5%)
   liquidity_ui: 1000.0, // 1000 USDC
   tokenInfo: { mint: usdcMint, decimals: 6 },
   // ...
);

// In instructions.ts - feePayer and owner are required; use scaled values
await buildBuyForInstruction(
   feePayer,
   owner,
   { amount: 10_500_000n, min_return: 15_000_000n, /* ... */ },
   // ...
);
```

### Outcome Indexes: 1-Indexed

**Outcome indexes start at 1, not 0.**

- First outcome: `outcomeIndex = 1`
- Second outcome: `outcomeIndex = 2`
- And so on...

This is consistent across all functions in the SDK. If you provide `outcomeIndex = 0` or a negative number, the SDK will throw a validation error.

**Example:**
```typescript
// For a market with 3 outcomes: ["Team A", "Team B", "Draw"]
const betOnTeamA = await getBuyForInstruction(
   owner,
   productId,
   marketId,
   betId,
   1,   // outcomeIndex: first outcome (Team A)
   // ...
);

const betOnTeamB = await getBuyForInstruction(
   owner,
   productId,
   marketId,
   betId,
   2,   // outcomeIndex: second outcome (Team B)
   // ...
);
```

### Market Types and Oracle Requirements

Splash Markets supports several market types, each with different characteristics and oracle requirements:

**Market Types:**
- **Uncontrolled** - Odds are determined purely by liquidity pool mechanics (CFMM). No oracle needed.
- **DirectControlled** - Market with controlled odds that require an oracle account.
- **IntControlled** - Intermediate controlled market type.
- **AdvControlled** - Advanced controlled market with deviation limits and risk management. Requires an oracle account.
- **OneVOne**, **OneVMany**, **DutchAuction**, **AdvDutchAuction** - Specialized market types. No oracle needed.

**Understanding `needsOracle`:**

When placing bets on markets, you must specify whether the market requires an oracle account:

- **`needsOracle: false`** - For **Uncontrolled markets**. The instruction does not include an oracle account; odds are calculated from the liquidity pool state.
- **`needsOracle: true`** - For **Controlled markets** (`DirectControlled`, `IntControlled`, `AdvControlled`). The instruction includes an oracle PDA. The oracle stores **scaled probabilities** (and optionally liquidity or liquidity factor), not decimal odds; it is updated by authorized updaters.


### Other Important Notes

1. **Number types**: Values from readers and types follow the program’s integer sizes: **u64/i64** → `bigint` (amounts, market_id, bet_id, etc.); **u32/u16/u8** → `number` (freebet_id, event, timestamps stored as u32, product_id, etc.). Use `BigInt()` and bigint arithmetic only for u64/i64 values.

2. **On-Chain Scaling**: Values stored on-chain are scaled using different factors:
   
   - **Token Amounts**: Scaled by token decimals (e.g., USDC = 6 decimals, WSOL = 9 decimals)
     - Example: `10.5 USDC` = `10_500_000n` on-chain (10.5 × 10^6)
     - Example: `1.5 WSOL` = `1_500_000_000n` on-chain (1.5 × 10^9)
   
   - **Percentages / PC-scaled values**: Scaled by `PC_SCALE = 10_000` (number; 1% = 100)
     - Example: `0.05` (5% in decimal) = `500` on-chain (0.05 × 10_000)
     - Used for trim, fees, oracle probabilities, liquidity factor, etc.
   
   - **Ratios**: Scaled by `RATIO_SCALE = 1_000_000n` (bigint, 10^6) where applicable.
   
   - **Oracle data**: Oracles store **scaled probabilities** (and optionally liquidity or liquidity factor), not decimal odds. Variants:
     - **ControlledLiquidity**: `probabilities` (number[]) and `liquidity` (bigint).
     - **FactoredLiquidity**: `probabilities` (number[]) and `liquidity_factor` (number, scaled by `PC_SCALE`).
     - **Resolution**: No live data (market resolved).
   
   The SDK automatically handles conversions in `actions.ts`. When using `instructions.ts`, you must provide already-scaled values.

3. **Market States**: Markets have states (`Prematch`, `Live`, `Paused`, `Resolved`, `Cancelled`, `PendingResolution`, `PendingFullfillment`). Check market status before placing bets using the `base.status` field on market accounts. Transactions on anything except `Prematch` and `Live` will fail.

4. **Live Betting**: 
   - Controlled markets must transition to `Live` state after the `go_live_time` for betting to be allowed
   - There's a 10-second delay (`LIVE_BETTING_DELAY` constant) for live SELLS to prevent front-running
   - Live BUYS can be rolled back (refunded) if they occur within a rollback period (stored onchain in the market live rollback account)
   - Live betting requires the market status to be `Live` and may have different odds calculations

5. **Fee payer vs owner**: Use the optional `feePayer` (and `accountFeePayer` for close instructions) in actions when a relayer pays fees; otherwise omit them and `owner` is used as fee payer.

## Utility Functions

### `utils.ts`

**Amount Conversions:**
```typescript
import { uiToScaled, scaledToUi } from 'splash-markets-sdk';

// Convert UI amount to scaled bigint
const scaled = uiToScaled(10.5, 6); // 10_500_000n (for USDC with 6 decimals)

// Convert scaled bigint to UI amount
const ui = scaledToUi(10_500_000n, 6); // 10.5
```

**Odds Conversion:**
```typescript
import { convertOdds } from 'splash-markets-sdk';

// Convert between decimal, probability, and American odds
convertOdds('dec', 2.5, 'american'); // 150
convertOdds('american', -150, 'dec'); // 1.67
convertOdds('dec', 2.0, 'prob'); // 0.5
```

**Number Utilities:**
```typescript
import { round, safeBigInt, safeMultiplyByScale } from 'splash-markets-sdk';

// Round with direction
round(3.14159, 2); // 3.14
round(3.14159, 2, 'up'); // 3.15
round(3.14159, 2, 'down'); // 3.14

// Safe conversions
safeBigInt('123.45'); // 123n (truncates decimals), handles strings and numbers
safeMultiplyByScale(1.5, 1_000_000n); // 1_500_000n
```

### `solana_utils.ts`

**Program Derived Addresses (PDAs):**
```typescript
import {
   getMarketPDA,
   getBetPDA,
   getProductConfigPDA,
   // ... many more
} from 'splash-markets-sdk';

// Get PDA address and bump
const [marketPda, bump] = await getMarketPDA(productId: 1, marketId: 12345n);
const [betPda, bump] = await getBetPDA(productId: 1, marketId: 12345n, betId: 67890n);
```

**Associated Token Accounts (ATAs):**
```typescript
import { getATA, getAtaBalance } from 'splash-markets-sdk';

// Get ATA address
const [ataAddress, bump] = await getATA(owner, tokenMint);

// Get ATA balance
const balance = await getAtaBalance(rpc, ataAddress);
```

**Filter Building (for getProgramAccounts):**
```typescript
import { buildOptimizedFilters } from 'splash-markets-sdk';

// Build optimized filters for querying accounts
const filters = buildOptimizedFilters([
   { offset: 0, size: 1, buffer: u8ToBuffer(3) }, // account_type
   { offset: 2, size: 2, buffer: u16ToBuffer(5) }, // product_id
]);
```

## Constants

Key constants are exported from the SDK:

```typescript
import {
   PROGRAM_ADDR,
   CORE_CONFIG_ADDR,
   RATIO_SCALE,          // 1_000_000n (10^6) - bigint, for ratio calculations
   PC_SCALE,             // 10_000 (number) - percentages, oracle probabilities (1% = 100)
   LIVE_BETTING_DELAY,   // 10 seconds
   TOKEN_ACCOUNT_SIZE,   // 165 bytes
   ASSOCIATED_TOKEN_PROGRAM_ADDR,
   // ... many more
} from 'splash-markets-sdk';
```

## Error Handling

The SDK uses custom error types for better error handling:

```typescript
import {
   ValidationRangeError,
   ValidationTypeError,
   ValidationRequiredError,
   AccountNotFoundError,
   RpcError,
   OperationError
} from 'splash-markets-sdk';

try {
   await getBuyForInstruction(/* ... */);
} catch (error) {
   if (error instanceof ValidationRangeError) {
      console.error(`Invalid range: ${error.message}`);
   } else if (error instanceof AccountNotFoundError) {
      console.error(`Account not found: ${error.address}`);
   }
   // ... handle other errors
}
```

## Examples

### Fetching and Working with Markets
```typescript
import { getMarketFromId, getMarketOdds, getOracleFromId, uiToScaled } from 'splash-markets-sdk';

// Fetch market account
const market = await getMarketFromId(rpc, productId, marketId);

// Check market type and determine oracle requirement
const needsOracle = market.__kind === 'DirectControlled' || market.__kind === 'AdvControlled';

// In reality, you should have stored the market type in your database and not fetched it from the chain each time

// Check odds received if betting $100.00
const outcomesWithOdds = await getMarketOdds(rpc, productId, marketId, needsOracle, uiToScaled(100, 6));
console.log(`Team A decimal odds if betting $100.00: ${outcomesWithOdds[0].stakeOdds_dec}`);
```

### Placing a Bet
```typescript
import { getBuyForInstruction, getMarketFromId } from 'splash-markets-sdk';

// First, fetch the market to determine if oracle is needed (see "Market Types and Oracle Requirements" section)
const market = await getMarketFromId(rpc, productId, marketId);
const needsOracle = market.__kind === 'DirectControlled' || market.__kind === 'AdvControlled';

// Build the buy instruction (owner = user; feePayer optional, defaults to owner)
const instruction = await getBuyForInstruction(
   ownerAddress,
   1,       // productId
   12345n,  // marketId
   67890n,  // betId
   1,       // outcomeIndex (1-indexed)
   10.0,    // amount_ui (10 USDC)
   15.0,    // minReturn_ui (minimum 15 USDC return)
   { mint: usdcMint, decimals: 6 },  // tokenInfo
   needsOracle
   // optional: feePayer if different from owner
);

// Send transaction with @solana/kit
const signature = await sendTransaction([instruction], [userKeypair]);
await confirmTransaction(signature);
```

### Fetching Bet Account Data
```typescript
import { getAccountDetailsFromId, scaledToUi } from 'splash-markets-sdk';

// Fetch bet account
const betAccount = await getAccountDetailsFromId(
   rpc,
   productId: 1,
   accountType: "Bet",
   id: 67890n,
   marketId: 12345n
);

const bettingTokenDecimals = 6;
console.log(`Bet amount: ${scaledToUi(betAccount.amount, bettingTokenDecimals)} tokens`);
console.log(`Outcome: ${betAccount.outcome_index}`); // 1-indexed
```

### Creating a Controlled Market
```typescript
import { getControlledCreateMarketInstruction, getUpdateOracleInstruction, safeBigInt } from 'splash-markets-sdk';

const marketCreationInstruction = await getControlledCreateMarketInstruction(
   adminAddress,
   'DirectControlled',
   productId,
   marketId,
   // ... category, subCategory, event, otherIdBytes, times, marketString, rulesUrl,
   feeOverride,
   trim_pc,
   oracleAuthority,
   outcomes,      // e.g. [{ name: "Team A", odds_dec: 2.0 }, { name: "Team B", odds_dec: 2.0 }]
   liquidity_ui,
   parlaySettings,
   null,          // riskControl (required for AdvControlled)
   { mint: usdcMint, decimals: 6 },  // tokenInfo
   tokenProgram
);

// Initialize the oracle with scaled probabilities (and liquidity factor for FactoredLiquidity).
// Oracles store probabilities, not decimal odds; the SDK can derive probabilities from odds.
const oracleInitializationInstruction = await getUpdateOracleInstruction(
   oracleUpdater,
   productId,
   oracleSeed,
   odds,              // decimal odds; SDK converts to probabilities
   Math.floor(Date.now() / 1000),  // sequence (u32 → number)
   'FactoredLiquidity',  // or 'ControlledLiquidity'
   liquidityFactor
);

const signature = await sendTransaction([marketCreationInstruction, oracleInitializationInstruction], [adminKeypair]);
await confirmTransaction(signature);
```

## TypeScript Types

All types are exported from the SDK:

```typescript
import type {
   BetAccount,
   MarketAccount,
   CreateMarketInstruction,
   BuyInstruction,
   // ... many more
} from 'splash-markets-sdk';
```

