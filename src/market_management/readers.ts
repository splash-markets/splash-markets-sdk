import { Rpc, SolanaRpcApi, Address } from "@solana/kit";
import { getMarketDecoder, getOracleAccountDecoder, getLiveRollbackAccountDecoder } from "../codex";
import { LiveRollbackAccount, Market, OracleAccount } from "../types";
import { getMarketPDA, buildOptimizedFilters, FilterField, getOraclePDA, getMarketLiveRollbackPDA } from "../solana_utils";
import { u16ToBuffer, u8ToBuffer, u32ToBuffer, base64ToUint8Array, safeBigInt, uiToScaled, scaledToUi } from "../utils";
import { MARKET_ACCOUNT_TYPE, RATIO_SCALE, PC_SCALE, PROGRAM_ADDR } from "../constants";
import { AccountNotFoundError, RpcError, ValidationRequiredError, ValidationTypeError, OperationError, DecodingError, UnknownError } from "../errors";

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
            case 'AdvControlled': return 2;
            case 'OneVOne': return 3;
            case 'OneVMany': return 4;
            case 'DutchAuction': return 5;
            case 'AdvDutchAuction': return 6;
            default: throw new ValidationTypeError(
               `Invalid market type`,
               'market_type',
               additionalFilters.market_type,
               'Uncontrolled | DirectControlled | AdvControlled | OneVOne | OneVMany | DutchAuction | AdvDutchAuction'
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


/**
 * Calculate the odds for all outcomes in a market based on the market data and oracle data and a stake
 * @param marketData - the market data
 * @param oracleData - the oracle data (if null, the market is uncontrolled)
 * @param scaledStake - the stake in scaled amount (e.g. 10_000_000 for 10 USDC)
 * @returns an array of { outcomeIndex: number, outcomeName: string, screenOdds_dec: number, screenOdds_prob: number, stakeOdds_dec: number, stakeOdds_prob: number } for each outcome
 */
export function calculateOddsFromMarketData(
   marketData: Market,
   oracleData: OracleAccount | null,
   scaledStake: bigint = 0n,
): { 
   outcomeIndex: number, outcomeName: string, 
   screenOdds_dec: number, screenOdds_prob: number, 
   stakeOdds_dec: number, stakeOdds_prob: number 
}[] {

   if (marketData.__kind === "AdvControlled" || marketData.__kind === "DirectControlled" || marketData.__kind === "IntControlled") {
      if (!oracleData) {
         throw new ValidationRequiredError(
            "Oracle account data is required for direct controlled markets",
            'oracleData'
         );
      }

     throw new Error("Controlled market maths pending")

   } else if (marketData.__kind === "Uncontrolled") {
      const sumBal = marketData.outcomes.reduce((acc, outcome) => acc + outcome.outcome_balance, 0n);
      return marketData.outcomes.map((outcome, i) => ({
         outcomeIndex: i + 1, // 1-indexed (outcomes are 1-indexed in the program)
         outcomeName: outcome.outcome_identifier.outcome_name,
         screenOdds_dec: Number(sumBal) / Number(outcome.outcome_balance),
         screenOdds_prob: Number(outcome.outcome_balance) / Number(sumBal),
         stakeOdds_dec: Number(sumBal + scaledStake) / Number(outcome.outcome_balance + scaledStake),
         stakeOdds_prob: Number(outcome.outcome_balance + scaledStake) / Number(sumBal + scaledStake),
      }));
   } else {
      throw new ValidationTypeError(
         "Invalid market type for odds calculation",
         'marketData.__kind',
         marketData.__kind,
         'Uncontrolled | AdvControlled | DirectControlled'
      );
   }
}

/**
 * Get the odds for all outcomes in a market
 * @param rpc - the RPC client
 * @param productId - the product id
 * @param marketId - the market id
 * @param needsOracle - whether the market needs an oracle to calculate the odds
 * @param scaledStake - the stake in scaled amount (e.g. 10_000_000 for 10 USDC)
 * @returns an array of { outcomeIndex: number, outcomeName: string, screenOdds_dec: number, screenOdds_prob: number, stakeOdds_dec: number, stakeOdds_prob: number } for each outcome
 */
export async function getMarketOdds(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   marketId: bigint,
   needsOracle: boolean,
   scaledStake: bigint = 0n,
): Promise<{ 
   outcomeIndex: number, outcomeName: string, 
   screenOdds_dec: number, screenOdds_prob: number, 
   stakeOdds_dec: number, stakeOdds_prob: number 
}[]> {
   try {
      const marketDataP = getMarketFromId(rpc, productId, marketId);
      const oracleDataP = needsOracle ? getOracleFromId(rpc, productId, marketId) : Promise.resolve(null);
      return calculateOddsFromMarketData(await marketDataP, await oracleDataP, scaledStake);
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
   const slippedOdds_dec = payout / stake;
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
   if(prob === undefined) {
      throw new OperationError(`Oracle probability not found for outcome ${outcomeIndex}`, 'calculateParlayOddsFromMarketData');
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