import { Rpc, SolanaRpcApi, Address } from "@solana/kit";
import { getMarketDecoder, getOracleAccountDecoder, getLiveRollbackAccountDecoder } from "../codex";
import { LiveRollbackAccount, Market, OracleAccount, BaseMarketOutcome, ControlledMarketOutcome } from "../types";
import { getMarketPDA, buildOptimizedFilters, FilterField, getOraclePDA, getMarketLiveRollbackPDA } from "../solana_utils";
import { u16ToBuffer, u8ToBuffer, u32ToBuffer, base64ToUint8Array, safeBigInt, uiToScaled, scaledToUi } from "../utils";
import { MARKET_ACCOUNT_TYPE, RATIO_SCALE, PC_SCALE, PROGRAM_ADDR } from "../constants";
import { AccountNotFoundError, RpcError, ValidationRequiredError, ValidationTypeError, OperationError, DecodingError, UnknownError } from "../errors";
import { computeAdvControlledPayout } from "./adv_controlled_math";

export { computeAdvControlledPayout } from "./adv_controlled_math";
export type { AdvOddsOperation } from "./adv_controlled_math";

const marketDecoder = getMarketDecoder();
const oracleAccountDecoder = getOracleAccountDecoder();
const liveRollbackAccountDecoder = getLiveRollbackAccountDecoder();

/**
 * Get a market from its address
 * @param rpc - the RPC client
 * @param address - the address of the market
 * @returns the market
 * @returns 
 */
export async function getMarketFromAddress(
   rpc: Rpc<SolanaRpcApi>,
   address: Address,
): Promise<Market> {
   let accountResp;
   try {
      accountResp = await rpc.getAccountInfo(address, { encoding: 'base64' }).send();
   } catch (e) {
      // RPC call failed (network, timeout, etc.)
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new RpcError(`RPC call failed while fetching market account`, 'getMarketFromAddress', cause);
   }

   if (accountResp.value === null){
      throw new AccountNotFoundError(`Market account not found`, address);
   }

   try {
      const decoded = marketDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
      return decoded;
   } catch (decodeError) {
      // Decoding failed (wrong format, corrupted data, wrong account type)
      const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
      throw new DecodingError(`Failed to decode market account data`, address, cause);
   }
}


/**
 * Get a market from its product id and market id
 * @param rpc - the RPC client
 * @param productId - the product id
 * @param marketId - the market id
 * @returns the market
 */
export async function getMarketFromId(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   marketId: bigint,
): Promise<Market> {
   try {
      const [marketPda] = await getMarketPDA(productId, marketId);
      return await getMarketFromAddress(rpc, marketPda);
   } catch (e) {
      // Re-throw all known error types
      if (e instanceof AccountNotFoundError || e instanceof DecodingError || e instanceof RpcError || e instanceof UnknownError) {
         throw e;
      }
      // Anything else is an unknown error
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new UnknownError(`Unexpected error while fetching market`, 'getMarketFromId', cause);
   }
}


/**
 * Get all markets from a product
 * @param rpc - the RPC client
 * @param productId - the product id
 * @param additionalFilters - optional filters for market_type, sport, league, event, period
 * @returns the markets
 */
export async function getAllMarketsFromProduct(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   additionalFilters?: {market_type?: Market['__kind'], sport?: number, league?: number, event?: number, period?: number},
): Promise<Market[]> {
   try {
      const filters = buildOptimizedFilters(buildMarketFilterFields(productId, additionalFilters));
      const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();
      return accounts.map(acc => {
         const decoded = marketDecoder.decode(base64ToUint8Array(acc.account.data[0]));
         return decoded;
      });
   } catch (e) {
      // Re-throw all known error types
      if (e instanceof AccountNotFoundError || e instanceof DecodingError || e instanceof RpcError || e instanceof UnknownError) {
         throw e;
      }
      // Anything else is an unknown error
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new UnknownError(`Unexpected error while fetching markets`, 'getMarketsForProduct', cause);
   }
}

/**
 * Market struct field offsets (in bytes):
 * offset 0: account_type_discriminator (u8 = 1 byte)
 * offset 1: market_type (u8 = 1 byte)
 * offset 2-3: product_id (u16 = 2 bytes)
 * offset 4-11: market_id (u64 = 8 bytes)
 * offset 12: sport (u8 = 1 byte)
 * offset 13-14: league (u16 = 2 bytes)
 * offset 15-18: event (u32 = 4 bytes)
 * offset 19: period (u8 = 1 byte)
 */

/**
 * Builds filter fields for market account queries based on productId and optional filters
 * @param productId - The product id (always included)
 * @param additionalFilters - Optional filters for market_type, sport, league, event, period
 * @returns Array of FilterField objects ready for buildOptimizedFilters
 */
function buildMarketFilterFields(
   productId: number,
   additionalFilters?: {market_type?: Market['__kind'], sport?: number, league?: number, event?: number, period?: number}
): FilterField[] {
   const fields: FilterField[] = [];
   
   // Always include account_type_discriminator
   fields.push({
      offset: 0,
      size: 1,
      buffer: u8ToBuffer(MARKET_ACCOUNT_TYPE),
   });
   
   // Add market_type if provided
   if (additionalFilters?.market_type !== undefined) {
      const marketTypeValue = (() => {
         switch (additionalFilters.market_type) {
            case 'Uncontrolled': return 0;
            case 'DirectControlled': return 1;
            case 'IntControlled': return 2;
            case 'AdvControlled': return 3;
            case 'OneVOne': return 4;
            case 'OneVMany': return 5;
            case 'DutchAuction': return 6;
            case 'AdvDutchAuction': return 7;
            default: throw new ValidationTypeError(
               `Invalid market type`,
               'market_type',
               additionalFilters.market_type,
               'Uncontrolled | DirectControlled | IntControlled | AdvControlled | OneVOne | OneVMany | DutchAuction | AdvDutchAuction'
            );
         }
      })();
      fields.push({
         offset: 1,
         size: 1,
         buffer: u8ToBuffer(marketTypeValue),
      });
   }
   
   // Always include product_id
   fields.push({
      offset: 2,
      size: 2,
      buffer: u16ToBuffer(productId),
   });
   
   // Add sport if provided
   if (additionalFilters?.sport !== undefined) {
      fields.push({
         offset: 12,
         size: 1,
         buffer: u8ToBuffer(additionalFilters.sport),
      });
   }
   
   // Add league if provided
   if (additionalFilters?.league !== undefined) {
      fields.push({
         offset: 13,
         size: 2,
         buffer: u16ToBuffer(additionalFilters.league),
      });
   }
   
   // Add event if provided
   if (additionalFilters?.event !== undefined) {
      fields.push({
         offset: 15,
         size: 4,
         buffer: u32ToBuffer(additionalFilters.event),
      });
   }
   
   // Add period if provided
   if (additionalFilters?.period !== undefined) {
      fields.push({
         offset: 19,
         size: 1,
         buffer: u8ToBuffer(additionalFilters.period),
      });
   }
   
   return fields;
}

/**
 * Read Oracle Account
 * @param rpc - the RPC client
 * @param oracleAccount - the address of the oracle account
 * @returns the oracle account
 */
export async function getOracleFromAccount(
   rpc: Rpc<SolanaRpcApi>, 
   oracleAccount: Address
): Promise<OracleAccount> {
   let accountResp;
   try {
      accountResp = await rpc.getAccountInfo(oracleAccount, { encoding: 'base64' }).send();
   } catch (e) {
      // RPC call failed
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new RpcError(`RPC call failed while fetching oracle account`, 'getOracleFromAccount', cause);
   }

   if (accountResp.value === null) {
      throw new AccountNotFoundError(`Oracle account not found`, oracleAccount);
   }

   try {
      const decoded = oracleAccountDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
      return decoded;
   } catch (decodeError) {
      // Decoding failed
      const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
      throw new DecodingError(`Failed to decode oracle account data`, oracleAccount, cause);
   }
}


/**
 * Get an oracle from its product id and market id
 * @param rpc - the RPC client
 * @param productId - the product id
 * @param marketId - the market id
 * @returns the oracle account
 */
export async function getOracleFromId(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   marketId: bigint,
): Promise<OracleAccount> {
   try {
      const [oraclePda] = await getOraclePDA(productId, marketId);
      return await getOracleFromAccount(rpc, oraclePda);
   } catch (e) {
      // Re-throw all known error types
      if (e instanceof AccountNotFoundError || e instanceof DecodingError || e instanceof RpcError || e instanceof UnknownError) {
         throw e;
      }
      // Anything else is an unknown error
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new UnknownError(`Unexpected error while fetching oracle`, 'getOracleFromId', cause);
   }
}


/**
 * Read Live Rollback Account
 * @param rpc - the RPC client
 * @param productId - the product id
 * @param marketId - the market id
 * @returns the live rollback account
 */
export async function getLiveRollbackAccount(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   marketId: bigint,
): Promise<LiveRollbackAccount> {
   try {
      const [rollbackPda] = await getMarketLiveRollbackPDA(productId, marketId);
      let accountResp;
      try {
         accountResp = await rpc.getAccountInfo(rollbackPda, { encoding: 'base64' }).send();
      } catch (e) {
         // RPC call failed
         const cause = e instanceof Error ? e : new Error(String(e));
         throw new RpcError(`RPC call failed while fetching live rollback account`, 'getLiveRollbackAccountFromId', cause);
      }

      if (accountResp.value === null) {
         throw new AccountNotFoundError(`Live rollback account not found`, rollbackPda);
      }

      try {
         const decoded = liveRollbackAccountDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
         return decoded;
      } catch (decodeError) {
         // Decoding failed
         const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
         throw new DecodingError(`Failed to decode live rollback account data`, rollbackPda, cause);
      }
   } catch (e) {
      // Re-throw known error types
      if (e instanceof AccountNotFoundError || e instanceof DecodingError || e instanceof RpcError) {
         throw e;
      }
      // Anything else is an unknown error
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new UnknownError(`Unexpected error while fetching live rollback account`, 'getLiveRollbackAccountFromId', cause);
   }
}

/** Display ratio `num/den`; mirrors on-chain checked_div (denominator must be non-zero). */
function ratioBigInt(num: bigint, den: bigint, detail: string): number {
   if (den === 0n) {
      throw new OperationError(`Division by zero: ${detail}`, "calculateOddsFromMarketData");
   }
   return Number(num) / Number(den);
}

/**
 * Client-side odds preview aligned with `calculate_bet_impact` / pool maths in `splash-markets-program-v2` (`utils.rs`, `adv_controlled_bet.rs`).
 *
 * - **Buys:** `scaledAmount` is stake (lamports scaled), same as the program `amount` on buy instructions.
 * - **Sells:** `scaledAmount` is shares sold. The program also derives **effective stake** from the bet account; this preview passes the same value for stake and shares in `computeAdvControlledPayout`, so it matches when stake-per-share is 1:1 with your input (e.g. full exit).
 * - **`outcomeIndex`:** Omit for every outcome in one array. With `scaledAmount > 0`, each row’s `amountOdds_*` assumes a trade on that row’s outcome (uncontrolled / adv-controlled). With a single `outcomeIndex`, amount-impact odds match a trade on that outcome only (unchanged).
 */
export function calculateOddsFromMarketData(
   marketData: Market,
   oracleData: OracleAccount | null,
   scaledAmount: bigint = 0n,
   operation: "BuyFor" | "BuyAgainst" | "SellFor" | "SellAgainst" = "BuyFor",
   outcomeIndex?: number,
): {
   outcomeIndex: number;
   outcomeName: string;
   screenOdds_dec: number;
   screenOdds_prob: number;
   amountOdds_dec: number;
   amountOdds_prob: number;
}[] {
   if (marketData.__kind === "IntControlled") {
      throw new ValidationTypeError(
         "IntControlled market type is not yet supported",
         'marketData.__kind',
         'IntControlled',
         'Uncontrolled | AdvControlled | DirectControlled | OneVOne | OneVMany'
      );
   }

   if (marketData.__kind === "OneVOne") {
      if (marketData.base.market_config.status.__kind === "PendingFullfillment") {
         if (operation !== "BuyFor") {
            throw new OperationError("Only BuyFor operations allowed during fixed odds phase", 'calculateOddsFromMarketData');
         }
         const sumBal = marketData.outcomes.reduce((acc: bigint, o: BaseMarketOutcome) => acc + o.outcome_balance, 0n);
         return marketData.outcomes.map((outcome: BaseMarketOutcome, i: number) => {
            const bal = outcome.outcome_balance;
            const decOdds = ratioBigInt(sumBal, bal, "fixed odds: outcome balance is zero");
            const pcOdds = ratioBigInt(bal, sumBal, "fixed odds: pool sum is zero");
            return {
               outcomeIndex: i + 1,
               outcomeName: outcome.outcome_identifier.outcome_name,
               screenOdds_dec: decOdds,
               screenOdds_prob: pcOdds,
               amountOdds_dec: decOdds,
               amountOdds_prob: pcOdds,
            };
         });
      }
      return calcUncontrolledOdds(
         marketData.outcomes,
         scaledAmount,
         operation,
         marketData.base.market_config.trim,
         outcomeIndex,
      );
   }

   if (marketData.__kind === "OneVMany") {
      if (marketData.base.market_config.status.__kind === "PendingFullfillment") {
         if (operation !== "BuyFor") {
            throw new OperationError("Only BuyFor operations allowed during fixed odds phase", 'calculateOddsFromMarketData');
         }
         const sumBal = marketData.challenger_amount + marketData.opposition_amount;
         return marketData.outcomes.map((outcome: BaseMarketOutcome, i: number) => {
            const bal = outcome.outcome_balance;
            const decOdds = ratioBigInt(sumBal, bal, "OneVMany fixed odds: outcome balance is zero");
            const pcOdds = ratioBigInt(bal, sumBal, "OneVMany fixed odds: pool sum is zero");
            return {
               outcomeIndex: i + 1,
               outcomeName: outcome.outcome_identifier.outcome_name,
               screenOdds_dec: decOdds,
               screenOdds_prob: pcOdds,
               amountOdds_dec: decOdds,
               amountOdds_prob: pcOdds,
            };
         });
      }
      return calcUncontrolledOdds(
         marketData.outcomes,
         scaledAmount,
         operation,
         marketData.base.market_config.trim,
         outcomeIndex,
      );
   }

   if (marketData.__kind === "Uncontrolled") {
      return calcUncontrolledOdds(
         marketData.outcomes,
         scaledAmount,
         operation,
         marketData.base.market_config.trim,
         outcomeIndex,
      );
   }

   if (marketData.__kind === "DirectControlled") {
      if (!oracleData) {
         throw new ValidationRequiredError("Oracle account data is required for controlled markets", 'oracleData');
      }
      return calcDirectControlledOdds(marketData, oracleData, scaledAmount, operation);
   }

   if (marketData.__kind === "AdvControlled") {
      if (!oracleData) {
         throw new ValidationRequiredError("Oracle account data is required for AdvControlled markets", 'oracleData');
      }
      return calcAdvControlledOdds(marketData, oracleData, scaledAmount, operation, outcomeIndex);
   }

   throw new ValidationTypeError(
      "Invalid market type for odds calculation",
      'marketData.__kind',
      marketData.__kind,
      'Uncontrolled | AdvControlled | DirectControlled | OneVOne | OneVMany'
   );
}

/** Post-trade balances: same structure as `calculate_simple_market_bet` in program `utils.rs`. */
export function calculateSimpleMarketNewBalances(
   currentBalances: readonly bigint[],
   operation: "BuyFor" | "BuyAgainst" | "SellFor" | "SellAgainst",
   amount: bigint,
   outcomeIndex: number,
   trim: number,
): { newBalances: bigint[]; poolSum: bigint } {
   const PC = BigInt(PC_SCALE);
   const oneMinusTrim = PC - BigInt(trim);
   const idx = outcomeIndex - 1;
   if (outcomeIndex < 1 || outcomeIndex > currentBalances.length) {
      throw new OperationError("Invalid outcome index (1-based)", "calculateOddsFromMarketData");
   }

   const sum = currentBalances.reduce((a, b) => a + b, 0n);

   if (operation === "BuyFor") {
      const trimmed = (amount * oneMinusTrim) / PC;
      const newBalances = [...currentBalances];
      newBalances[idx] = newBalances[idx]! + trimmed;
      return { newBalances, poolSum: newBalances.reduce((a, b) => a + b, 0n) };
   }

   if (operation === "BuyAgainst") {
      const outcomeBal = currentBalances[idx]!;
      const otherSumBefore = sum - outcomeBal;
      if (otherSumBefore === 0n) {
         throw new OperationError("BuyAgainst: other outcome balances sum is zero", "calculateOddsFromMarketData");
      }
      const newBalances = [...currentBalances];
      for (let i = 0; i < newBalances.length; i++) {
         if (i !== idx) {
            const additional =
               (((newBalances[i]! * amount) / otherSumBefore) * oneMinusTrim) / PC;
            newBalances[i] = newBalances[i]! + additional;
         }
      }
      return { newBalances, poolSum: newBalances.reduce((a, b) => a + b, 0n) };
   }

   if (operation === "SellFor") {
      const trimmed = (amount * oneMinusTrim) / PC;
      const newOutcome = currentBalances[idx]! - trimmed;
      if (newOutcome < 0n) {
         throw new OperationError("SellFor: insufficient outcome balance", "calculateOddsFromMarketData");
      }
      const newBalances = [...currentBalances];
      newBalances[idx] = newOutcome;
      return { newBalances, poolSum: newBalances.reduce((a, b) => a + b, 0n) };
   }

   const trimmedAmount = (amount * oneMinusTrim) / PC;
   const outcomeBal = currentBalances[idx]!;
   const otherSumBefore = sum - outcomeBal;
   if (otherSumBefore === 0n) {
      throw new OperationError("SellAgainst: other outcome balances sum is zero", "calculateOddsFromMarketData");
   }
   const newBalances = [...currentBalances];
   for (let i = 0; i < newBalances.length; i++) {
      if (i !== idx) {
         const reduction =
            (((newBalances[i]! * trimmedAmount) / otherSumBefore) * oneMinusTrim) / PC;
         const next = newBalances[i]! - reduction;
         if (next < 0n) {
            throw new OperationError("SellAgainst: insufficient outcome balance", "calculateOddsFromMarketData");
         }
         newBalances[i] = next;
      }
   }
   return { newBalances, poolSum: newBalances.reduce((a, b) => a + b, 0n) };
}

function uncontrolledScreenOddsPair(
   operation: "BuyFor" | "BuyAgainst" | "SellFor" | "SellAgainst",
   bal: bigint,
   sumBal: bigint,
): { pcOdds: number; decOdds: number } {
   if (sumBal === 0n) {
      throw new OperationError("Uncontrolled: pool sum is zero", "calculateOddsFromMarketData");
   }
   if (operation === "BuyFor" || operation === "SellFor") {
      return {
         pcOdds: ratioBigInt(bal, sumBal, "outcome probability: pool sum is zero"),
         decOdds: ratioBigInt(sumBal, bal, "decimal odds: outcome balance is zero"),
      };
   }
   const otherBal = sumBal - bal;
   return {
      pcOdds: ratioBigInt(otherBal, sumBal, "against probability: other side sum is zero"),
      decOdds: ratioBigInt(sumBal, otherBal, "decimal odds (against): other side sum is zero"),
   };
}

function calcUncontrolledOdds(
   outcomes: BaseMarketOutcome[],
   amount: bigint,
   operation: "BuyFor" | "BuyAgainst" | "SellFor" | "SellAgainst",
   trim: number,
   outcomeIndex?: number,
): {
   outcomeIndex: number;
   outcomeName: string;
   screenOdds_dec: number;
   screenOdds_prob: number;
   amountOdds_dec: number;
   amountOdds_prob: number;
}[] {
   const sumBal = outcomes.reduce((acc: bigint, o: BaseMarketOutcome) => acc + o.outcome_balance, 0n);
   const balances = outcomes.map((o) => o.outcome_balance);

   type Sim = { newBalances: bigint[]; poolSum: bigint };
   let singleSim: Sim | null = null;
   let perOutcomeSim: Sim[] | null = null;
   if (amount > 0n) {
      if (outcomeIndex !== undefined) {
         if (outcomeIndex < 1 || outcomeIndex > outcomes.length) {
            throw new OperationError(
               "outcomeIndex must be between 1 and number of outcomes when amount is non-zero",
               "calculateOddsFromMarketData",
            );
         }
         singleSim = calculateSimpleMarketNewBalances(balances, operation, amount, outcomeIndex, trim);
      } else {
         perOutcomeSim = outcomes.map((_, j) =>
            calculateSimpleMarketNewBalances(balances, operation, amount, j + 1, trim),
         );
      }
   }

   return outcomes.map((outcome: BaseMarketOutcome, i: number) => {
      const bal = outcome.outcome_balance;
      const { pcOdds, decOdds } = uncontrolledScreenOddsPair(operation, bal, sumBal);

      let pcOddsAmount = pcOdds;
      let decOddsAmount = decOdds;
      if (singleSim !== null) {
         const poolSumAfter = singleSim.poolSum;
         if (poolSumAfter === 0n) {
            throw new OperationError("Post-trade pool sum is zero", "calculateOddsFromMarketData");
         }
         const nb = singleSim.newBalances[i]!;
         pcOddsAmount = ratioBigInt(nb, poolSumAfter, "post-trade outcome probability");
         decOddsAmount = ratioBigInt(poolSumAfter, nb, "post-trade decimal odds: outcome balance is zero");
      } else if (perOutcomeSim !== null) {
         const sim = perOutcomeSim[i]!;
         const poolSumAfter = sim.poolSum;
         if (poolSumAfter === 0n) {
            throw new OperationError("Post-trade pool sum is zero", "calculateOddsFromMarketData");
         }
         const nb = sim.newBalances[i]!;
         pcOddsAmount = ratioBigInt(nb, poolSumAfter, "post-trade outcome probability");
         decOddsAmount = ratioBigInt(poolSumAfter, nb, "post-trade decimal odds: outcome balance is zero");
      }

      return {
         outcomeIndex: i + 1,
         outcomeName: outcome.outcome_identifier.outcome_name,
         screenOdds_dec: decOdds,
         screenOdds_prob: pcOdds,
         amountOdds_dec: decOddsAmount,
         amountOdds_prob: pcOddsAmount,
      };
   });
}

function calcDirectControlledOdds(
   marketData: { outcomes: ControlledMarketOutcome[] },
   oracleData: OracleAccount,
   amount: bigint,
   operation: 'BuyFor' | 'BuyAgainst' | 'SellFor' | 'SellAgainst',
): { outcomeIndex: number; outcomeName: string; screenOdds_dec: number; screenOdds_prob: number; amountOdds_dec: number; amountOdds_prob: number }[] {
   const outcomes = marketData.outcomes;
   const scale = BigInt(PC_SCALE);

   const oracleProbs = oracleData.data.__kind === "ControlledLiquidity" || oracleData.data.__kind === "FactoredLiquidity"
      ? oracleData.data.probabilities.map(p => BigInt(p))
      : null;

   if (!oracleProbs || oracleProbs.length !== outcomes.length) {
      throw new OperationError("Oracle probabilities not available or length mismatch", 'calculateOddsFromMarketData');
   }

   let newBalanceSum: bigint;
   if (oracleData.data.__kind === "ControlledLiquidity") {
      newBalanceSum = oracleData.data.liquidity;
   } else {
      throw new OperationError("DirectControlled requires ControlledLiquidity oracle", 'calculateOddsFromMarketData');
   }

   const adjustedBalances = oracleProbs.map((prob) => {
      if (prob === 0n) throw new OperationError("Betting is closed", "calculateOddsFromMarketData");
      return (newBalanceSum * prob) / scale;
   });
   const adjustedSum = adjustedBalances.reduce((acc, bal) => acc + bal, 0n);
   if (adjustedSum === 0n) {
      throw new OperationError("DirectControlled: oracle-implied pool sum is zero", "calculateOddsFromMarketData");
   }

   return outcomes.map((outcome, i) => {
      const adjustedBalance = adjustedBalances[i];
      if (adjustedBalance === undefined) throw new OperationError("Adjusted balance not found", "calculateOddsFromMarketData");

      let pcOdds: number;
      let decOdds: number;
      let pcOddsStake: number;
      let decOddsStake: number;

      if (operation === "BuyFor") {
         pcOdds = ratioBigInt(adjustedBalance, adjustedSum, "DirectControlled BuyFor screen prob");
         decOdds = ratioBigInt(adjustedSum, adjustedBalance, "DirectControlled BuyFor screen dec");
         pcOddsStake = ratioBigInt(adjustedBalance + amount, adjustedSum + amount, "DirectControlled BuyFor post prob");
         decOddsStake = ratioBigInt(adjustedSum + amount, adjustedBalance + amount, "DirectControlled BuyFor post dec");
      } else if (operation === "BuyAgainst") {
         const otherBal = adjustedSum - adjustedBalance;
         pcOdds = ratioBigInt(otherBal, adjustedSum, "DirectControlled BuyAgainst screen prob");
         decOdds = ratioBigInt(adjustedSum, otherBal, "DirectControlled BuyAgainst screen dec");
         pcOddsStake = ratioBigInt(otherBal + amount, adjustedSum + amount, "DirectControlled BuyAgainst post prob");
         decOddsStake = ratioBigInt(adjustedSum + amount, otherBal + amount, "DirectControlled BuyAgainst post dec");
      } else if (operation === "SellFor") {
         pcOdds = ratioBigInt(adjustedBalance, adjustedSum, "DirectControlled SellFor screen prob");
         decOdds = ratioBigInt(adjustedSum, adjustedBalance, "DirectControlled SellFor screen dec");
         if (amount > adjustedBalance) {
            throw new OperationError(
               "DirectControlled SellFor: amount exceeds oracle-implied outcome balance",
               "calculateOddsFromMarketData",
            );
         }
         const newOutcomeBal = adjustedBalance - amount;
         const newSumBal = adjustedSum - amount;
         pcOddsStake = ratioBigInt(newOutcomeBal, newSumBal, "DirectControlled SellFor post prob");
         decOddsStake = ratioBigInt(newSumBal, newOutcomeBal, "DirectControlled SellFor post dec");
      } else {
         const otherBal = adjustedSum - adjustedBalance;
         pcOdds = ratioBigInt(otherBal, adjustedSum, "DirectControlled SellAgainst screen prob");
         decOdds = ratioBigInt(adjustedSum, otherBal, "DirectControlled SellAgainst screen dec");
         if (amount > otherBal) {
            throw new OperationError(
               "DirectControlled SellAgainst: amount exceeds oracle-implied other-side balance",
               "calculateOddsFromMarketData",
            );
         }
         const newOtherBal = otherBal - amount;
         const newSumBal = adjustedSum - amount;
         pcOddsStake = ratioBigInt(newOtherBal, newSumBal, "DirectControlled SellAgainst post prob");
         decOddsStake = ratioBigInt(newSumBal, newOtherBal, "DirectControlled SellAgainst post dec");
      }

      return {
         outcomeIndex: i + 1,
         outcomeName: outcome.outcome_identifier.outcome_name,
         screenOdds_dec: decOdds,
         screenOdds_prob: pcOdds,
         amountOdds_dec: decOddsStake,
         amountOdds_prob: pcOddsStake,
      };
   });
}

function calcAdvControlledOdds(
   marketData: {
      liquidity: bigint;
      max_risk: bigint;
      bonus_cap: number;
      over_risk_penalty: number;
      outcomes: ControlledMarketOutcome[];
   },
   oracleData: OracleAccount,
   scaledAmount: bigint,
   operation: "BuyFor" | "BuyAgainst" | "SellFor" | "SellAgainst",
   outcomeIndex?: number,
): {
   outcomeIndex: number;
   outcomeName: string;
   screenOdds_dec: number;
   screenOdds_prob: number;
   amountOdds_dec: number;
   amountOdds_prob: number;
}[] {
   const outcomes = marketData.outcomes;
   const scale = BigInt(PC_SCALE);

   const oracleProbs =
      oracleData.data.__kind === "ControlledLiquidity" || oracleData.data.__kind === "FactoredLiquidity"
         ? oracleData.data.probabilities.map((p) => BigInt(p))
         : null;

   if (!oracleProbs || oracleProbs.length !== outcomes.length) {
      throw new OperationError("Oracle probabilities not available or length mismatch", "calculateOddsFromMarketData");
   }

   if (oracleData.data.__kind !== "ControlledLiquidity" && oracleData.data.__kind !== "FactoredLiquidity") {
      throw new OperationError(
         "AdvControlled requires ControlledLiquidity or FactoredLiquidity oracle",
         "calculateOddsFromMarketData",
      );
   }

   const maxRisk = marketData.max_risk;
   const bonusCap = BigInt(marketData.bonus_cap);
   const overRiskPenalty = BigInt(marketData.over_risk_penalty);
   // Matches on-chain `adv_controlled_bet.rs`: ControlledLiquidity uses oracle liquidity only; FactoredLiquidity uses market.liquidity * factor / PC_SCALE.
   const effectiveLiquidity =
      oracleData.data.__kind === "ControlledLiquidity"
         ? oracleData.data.liquidity
         : (marketData.liquidity * BigInt(oracleData.data.liquidity_factor)) / scale;

   const sellShares = operation === "SellFor" || operation === "SellAgainst" ? scaledAmount : undefined;

   let netForTradeSingle: bigint | undefined;
   if (scaledAmount > 0n && outcomeIndex !== undefined) {
      if (outcomeIndex < 1 || outcomeIndex > outcomes.length) {
         throw new OperationError("Invalid outcome index (1-based)", "calculateOddsFromMarketData");
      }
      const outcomeIdx0 = outcomeIndex - 1;
      const targetedProb = oracleProbs[outcomeIdx0];
      if (targetedProb === undefined || targetedProb === 0n) {
         throw new OperationError("Betting is closed for this outcome", "calculateOddsFromMarketData");
      }
      netForTradeSingle = computeAdvControlledPayout(
         operation,
         outcomes,
         outcomeIdx0,
         scaledAmount,
         effectiveLiquidity,
         targetedProb,
         maxRisk,
         bonusCap,
         overRiskPenalty,
         sellShares,
      );
   }

   return outcomes.map((outcome, i) => {
      const prob = oracleProbs[i] ?? 0n;
      if (prob === 0n) {
         throw new OperationError("Betting is closed", "calculateOddsFromMarketData");
      }

      const screenProb = ratioBigInt(prob, scale, "AdvControlled screen probability");
      const screenDec = ratioBigInt(scale, prob, "AdvControlled screen decimal odds");

      let amountOddsProb = screenProb;
      let amountOddsDec = screenDec;
      if (scaledAmount > 0n) {
         if (outcomeIndex !== undefined) {
            if (i + 1 === outcomeIndex) {
               amountOddsDec = ratioBigInt(netForTradeSingle!, scaledAmount, "AdvControlled trade decimal odds");
               amountOddsProb = ratioBigInt(scaledAmount, netForTradeSingle!, "AdvControlled trade implied prob");
            }
         } else {
            const netForTrade = computeAdvControlledPayout(
               operation,
               outcomes,
               i,
               scaledAmount,
               effectiveLiquidity,
               prob,
               maxRisk,
               bonusCap,
               overRiskPenalty,
               sellShares,
            );
            amountOddsDec = ratioBigInt(netForTrade, scaledAmount, "AdvControlled trade decimal odds");
            amountOddsProb = ratioBigInt(scaledAmount, netForTrade, "AdvControlled trade implied prob");
         }
      }

      return {
         outcomeIndex: i + 1,
         outcomeName: outcome.outcome_identifier.outcome_name,
         screenOdds_dec: screenDec,
         screenOdds_prob: screenProb,
         amountOdds_dec: amountOddsDec,
         amountOdds_prob: amountOddsProb,
      };
   });
}

/**
 * Get the odds for all outcomes in a market
 * @param rpc - the RPC client
 * @param productId - the product id
 * @param marketId - the market id
 * @param needsOracle - whether the market needs an oracle to calculate the odds
 * @param outcomeIndex - 1-based outcome for the simulated trade
 * @param scaledAmount - scaled input amount (stake for buys, shares for sells); default 0 (no size on the trade)
 * @param operation - defaults to `BuyFor`
 * @returns an array of { outcomeIndex: number, outcomeName: string, screenOdds_dec: number, screenOdds_prob: number, amountOdds_dec: number, amountOdds_prob: number } for each outcome
 */
export async function getMarketOdds(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   marketId: bigint,
   needsOracle: boolean,
   outcomeIndex: number,
   scaledAmount: bigint = 0n,
   operation: "BuyFor" | "BuyAgainst" | "SellFor" | "SellAgainst" = "BuyFor",
): Promise<{ 
   outcomeIndex: number, outcomeName: string, 
   screenOdds_dec: number, screenOdds_prob: number, 
   amountOdds_dec: number, amountOdds_prob: number 
}[]> {
   try {
      const marketDataP = getMarketFromId(rpc, productId, marketId);
      const oracleDataP = needsOracle ? getOracleFromId(rpc, productId, marketId) : Promise.resolve(null);
      return calculateOddsFromMarketData(
         await marketDataP,
         await oracleDataP,
         scaledAmount,
         operation,
         outcomeIndex,
      );
   } catch (e) {
      // Re-throw all known error types
      if (e instanceof AccountNotFoundError || e instanceof DecodingError || e instanceof RpcError || 
          e instanceof ValidationRequiredError || e instanceof OperationError || e instanceof ValidationTypeError ||
          e instanceof UnknownError) {
         throw e;
      }
      // Anything else is an unknown error
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new UnknownError(`Unexpected error while fetching market odds`, 'getMarketOddsFromId', cause);
   }
}

/**
 * Get the odds for a parlay
 * @param rpc - the RPC client
 * @param productId - the product id
 * @param stake - the stake in the parlay
 * @param decimals - the decimals of the betting token
 * @param marketIdAndOutcome - an array of [marketId, outcomeIndex] pairs
 * @returns {odds_dec: number, odds_prob: number, payout: number}
 */
export async function getParlayReturn(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   stake: number,
   decimals: number,
   marketIdAndOutcome: [bigint, number][],
): Promise<{odds_dec: number, odds_prob: number, payout: number}> {
   const SCALER = 1n << 100n;
   // Calculate total odds (as decimal) and find minimum liquidity factor
   let normalOdds_dec = 1;
   let sumReciprocalLiquidityFactors = 0n;
   for (const [marketId, outcomeIndex] of marketIdAndOutcome) {
      const marketDataP = getMarketFromId(rpc, productId, marketId);
      const oracleDataP = getOracleFromId(rpc, productId, marketId)
      const {odds, liquidityFactor} = calculateParlayOddsFromMarketData(await marketDataP, await oracleDataP, outcomeIndex);
      normalOdds_dec *= odds;
      sumReciprocalLiquidityFactors += (SCALER / liquidityFactor);
   }
   
   // Convert stake to scaled token units (matching Rust: data.amount)
   const scaledStake = uiToScaled(stake, decimals);
      
   // Calculate normal_return = amount * total_odds (all in scaled units)
   const normalReturnScaled = (scaledStake * uiToScaled(normalOdds_dec, 6)) / uiToScaled(1, 6);
   
   const totalLiquidityFactor = SCALER * safeBigInt(marketIdAndOutcome.length) / sumReciprocalLiquidityFactors;
   // Check if normal_return > min_parlay_liquidity_factor (Rust validation)
   if (normalReturnScaled > totalLiquidityFactor) {
      throw new OperationError(
         `Normal return ${normalReturnScaled} is greater than minimum parlay liquidity factor ${totalLiquidityFactor}`,
         'getParlayReturn'
      );
   }
   
   // Calculate slippage = (normal_return * normal_return) / min_parlay_liquidity_factor
   const slippage = (normalReturnScaled * normalReturnScaled) / totalLiquidityFactor;
   
   // Calculate potential_return = normal_return - slippage
   const potentialReturnScaled = normalReturnScaled - slippage;
   
   // Convert back to UI units
   const payout = scaledToUi(potentialReturnScaled, decimals);
   if (stake === 0) {
      throw new OperationError("Parlay stake must be non-zero", "getParlayReturn");
   }
   const slippedOdds_dec = payout / stake;
   if (slippedOdds_dec === 0) {
      throw new OperationError("Parlay slipped decimal odds computed as zero", "getParlayReturn");
   }
   const slippedOdds_prob = 1 / slippedOdds_dec;
   
   return {
      odds_dec: slippedOdds_dec,
      odds_prob: slippedOdds_prob,
      payout: payout,
   }
}

/**
 * Get the odds contribution for a single outcome in a parlay
 * @param rpc - the RPC client
 * @param productId - the product id
 * @param marketId - the market id
 * @param outcomeIndex - the outcome index
 * @returns the odds contribution for the outcome
 */
export async function getParlayOddsContributionForOutcome(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   marketId: bigint,
   outcomeIndex: number,
): Promise<{odds: number, liquidityFactor: bigint}> {
   const marketDataP = getMarketFromId(rpc, productId, marketId);
   const oracleDataP = getOracleFromId(rpc, productId, marketId);
   return calculateParlayOddsFromMarketData(await marketDataP, await oracleDataP, outcomeIndex);
}


function calculateParlayOddsFromMarketData(
   marketData: Market,
   oracleData: OracleAccount,
   outcomeIndex: number,
): {odds: number, liquidityFactor: bigint} {
   if(oracleData.data.__kind !== "ControlledLiquidity" && oracleData.data.__kind !== "FactoredLiquidity") {
      throw new OperationError(`Oracle data is not ControlledLiquidity or FactoredLiquidity`, 'calculateParlayOddsFromMarketData');
   }
   const prob = oracleData.data.probabilities[outcomeIndex - 1];
   if (prob === undefined) {
      throw new OperationError(`Oracle probability not found for outcome ${outcomeIndex}`, "calculateParlayOddsFromMarketData");
   }
   if (prob === 0) {
      throw new OperationError(`Oracle probability is zero for outcome ${outcomeIndex}`, "calculateParlayOddsFromMarketData");
   }
   if(marketData.__kind !== "AdvControlled" && marketData.__kind !== "DirectControlled" && marketData.__kind !== "IntControlled") {
      throw new OperationError(`Market data is not controlled`, 'calculateParlayOddsFromMarketData');
   }
   const marketParlayOddsFactor = marketData.parlay_settings.parlay_odds_factor;
   const parlayOddsFactorDecimal = Number(marketParlayOddsFactor) / PC_SCALE;
   const oracleOddsDecimal = 1 / Number(prob / PC_SCALE);

   const oracleLiquidityFactor = oracleData.data.__kind === "FactoredLiquidity" ? oracleData.data.liquidity_factor : PC_SCALE;
   return {
      odds: (oracleOddsDecimal - 1) * parlayOddsFactorDecimal + 1,
      liquidityFactor: safeBigInt(oracleLiquidityFactor) * marketData.parlay_settings.parlay_liquidity_factor / BigInt(PC_SCALE),
   };
}