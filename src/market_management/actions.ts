import { Address, Instruction, assertIsAddress } from "@solana/kit";
import { RATIO_SCALE, PC_SCALE, TOKEN_PROGRAM_ADDR } from "../constants";
import { round, safeBigInt, safeMultiplyByScale, uiToScaled } from "../utils";
import { validateTimes, validateTokenInfo, validateParlaySettings, validateBool, validateInt64, validatePc, validateUint16, validateUint32, validateUint64, validateUint8, validateUint8Array } from "../validation";
import { ValidationRangeError } from "../errors";
import { buildAddFundsToMarketAtaInstruction, buildCreateMarketInstruction, buildUpdateMarketStatusInstruction, buildResolveMarketInstruction, buildCloseMarketInstruction, buildEditMarketGoLiveTimeInstruction, buildUpdateOracleInstruction } from "./instructions";
import { CreateMarketInstruction, MarketStatus, ResolveMarketInstruction, ResolveMarketFromOracleInstruction, ResolveMarketFromAdminInstruction, OracleDataVariant, CreateUncontrolledMarketInstruction, CreateDirectControlledMarketInstruction, CreateAdvControlledMarketInstruction, CreateOneVOneMarketInstruction, CreateOneVManyMarketInstruction, ControlledMarketOutcome } from "../types";
import { getOracleDataVariantEncoder } from "../codex";
import { getOraclePDA } from "../solana_utils";
const oracleDataVariantEncoder = getOracleDataVariantEncoder();
/**
 * Get the AddFundsToMarketAta instruction - for adding additional funds to a market ATA if needed due to miscalculation during settlement
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id (must be 0-255)
 * @param amount_ui - The amount to add in UI units (e.g. 0.1 for 0.10 USDC, must be >= 0)
 * @param marketId - The market id (must be a valid uint64)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 * @throws ValidationRangeError if productId, amount_ui, marketId, or tokenInfo.decimals are out of valid range
 * @throws Error if tokenInfo.mint or tokenProgram are invalid addresses
 */
export async function getAddFundsToMarketAtaInstruction(
   productAdmin: Address,
   productId: number,
   amount_ui: number,
   marketId: bigint,
   tokenInfo: { mint: Address; decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint8(productId, 'productId');
   validateUint64(marketId, 'marketId');
   if(amount_ui < 0){
      throw new ValidationRangeError("Amount must be >= 0", 'amount_ui', amount_ui, 0);
   }
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   return await buildAddFundsToMarketAtaInstruction(
      productAdmin,
      productId,
      scaledAmount,
      marketId,
      tokenInfo.mint,
      tokenProgram
   );
}


/**
 * Get the CreateUncontrolledMarket instruction - for creating an uncontrolled market
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param category - The market category
 * @param subCategory - The market subcategory
 * @param event - The event id
 * @param otherIdBytes - Additional identifier bytes
 * @param times - Market timing information (eventStart, marketLockTime)
 * @param marketString - The market description string
 * @param rulesUrl - The rules URL for the market
 * @param feeOverride - Optional fee override configuration, or false to use product defaults. _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
 * @param trim_pc - The trim percentage in decimal format (0-1, e.g. 0.05 for 5%)
 * @param resolutionMethod - The resolution method (oracle updater if oracle or market admin)
 * @param outcomes - Array of outcomes with names and decimal odds (e.g. 2.5 for 2.5 odds). The program requires de-vigged odds. The SDK will automatically de-vig by multiplying each odd by the overround (sum of 1/odd for all outcomes). If you want to use a different de-vigging method, provide already de-vigged odds.
 * @param liquidity_ui - The initial liquidity in UI units (e.g. 1000.0 for 1000 USDC)
 * @param tokenInfo - Token information (mint address and decimals)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param oracleUpdater - Optional oracle updater address (required if resolutionMethod is "oracle" and you want to create an oracle account, e.g. for Resolution oracle)
 * @returns The instruction
 */
export async function getUncontrolledCreateMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   category: number,
   subCategory: number,
   event: number,
   otherIdBytes: Uint8Array,
   times: { eventStart: number, marketLockTime: number },
   marketString: string,
   rulesUrl: string,
   feeOverride: false | {productFlatFee_ui: number, productPcFee_pc: number, productWinFee_pc: number, productPerformanceFee_pc: number },
   trim_pc: number,
   resolutionMethod: {oracleUpdater: Address} | {marketAdmin: Address},
   outcomes: {name: string, odds_dec: number}[],
   liquidity_ui: number,
   tokenInfo: { mint: Address, decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint8(productId);
   validateUint64(marketId);
   validateUint8(category);
   validateUint16(subCategory);
   validateUint32(event);
   validateUint8Array(otherIdBytes);
   validateTimes(times);
   if(feeOverride){
      validateUint64(uiToScaled(feeOverride.productFlatFee_ui, tokenInfo.decimals));
      validatePc(feeOverride.productPcFee_pc);
      validatePc(feeOverride.productWinFee_pc);
      validatePc(feeOverride.productPerformanceFee_pc);
   }
   validatePc(trim_pc);

   let resolutionType: "oracle" | "marketAdmin" | undefined = undefined;
   let marketAdmin: Address | undefined = undefined;
   let oracleUpdater: Address | undefined = undefined;
   if("oracleUpdater" in resolutionMethod){
      oracleUpdater = resolutionMethod.oracleUpdater;
      resolutionType = "oracle";
      assertIsAddress(oracleUpdater);
   }else if ("marketAdmin" in resolutionMethod){
      marketAdmin = resolutionMethod.marketAdmin;
      resolutionType = "marketAdmin";
      assertIsAddress(marketAdmin);
   } else {
      throw new Error("Invalid resolution method");
   }
   
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);

   // Remove vig: calculate overround as sum of 1/odd for all outcomes
   const overround = outcomes.reduce((sum, outcome) => sum + (1 / outcome.odds_dec), 0);

   // multiply by liquidity_ui safely without overflow
   const scaledOutcomes = outcomes.map(outcome => {
      const outcomeBalance = uiToScaled(liquidity_ui / (outcome.odds_dec * overround), tokenInfo.decimals);
      validateUint64(outcomeBalance);
      return {
         outcome_identifier: {
            outcome_name: outcome.name,
         },
         outcome_balance: outcomeBalance,
         outcome_payout: safeBigInt(0),
      }
   });

   const marketData: CreateUncontrolledMarketInstruction = {
      base: {
         market_identifier: {
            product_id: productId,
            market_id: marketId,
            category: category,
            sub_category: subCategory,
            event: event,
            other_id_bytes: otherIdBytes,
            event_start: times.eventStart,
            market_string: marketString,
            rules_url: rulesUrl,
         },
         lock_time: times.marketLockTime,
         trim: trim_pc * PC_SCALE,
         resolution_authority: resolutionType === 'oracle'
            ? { method: { __kind: 'Oracle' }, account: (await getOraclePDA(productId, marketId))[0] }
            : { method: { __kind: 'Manual' }, account: marketAdmin! },
         fee_override: feeOverride !== false,
         flat_fee: feeOverride ? uiToScaled(feeOverride.productFlatFee_ui, tokenInfo.decimals) : safeBigInt(0),
         pc_fee: feeOverride ? feeOverride.productPcFee_pc * PC_SCALE : 0,
         win_fee: feeOverride ? feeOverride.productWinFee_pc * PC_SCALE : 0,
         performance_fee: feeOverride ? feeOverride.productPerformanceFee_pc * PC_SCALE : 0,
      },
      outcomes: scaledOutcomes,
   };
   return await buildCreateMarketInstruction(
      productAdmin,
      { __kind: 'Uncontrolled', value: marketData },
      productId,
      tokenInfo.mint,
      tokenProgram,
      resolutionType === 'oracle' ? oracleUpdater : marketAdmin!,
      resolutionType === 'oracle', // Only create oracle if oracleUpdater is provided
   );
}

/**
 * Get the CreateDirectControlledMarket instruction - for creating a direct controlled market
 * @param productAdmin - The product admin key (signer)
 * @param marketType - Must be "DirectControlled"
 * @param productId - The product id
 * @param marketId - The market id
 * @param category - The market category
 * @param subCategory - The market subcategory
 * @param event - The event id
 * @param otherIdBytes - Additional identifier bytes
 * @param times - Market timing information (eventStart, marketLockTime, optional goLiveTime)
 * @param marketString - The market description string
 * @param rulesUrl - The rules URL for the market
 * @param feeOverride - Optional fee override configuration, or false to use product defaults. _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
 * @param trim_pc - The trim percentage in decimal format (0-1, e.g. 0.05 for 5%)
 * @param oracleAuthority - The oracle authority address
 * @param outcomes - Array of outcomes with names and decimal odds (e.g. 2.5 for 2.5 odds). The program requires de-vigged odds. The SDK will automatically de-vig by multiplying each odd by the overround (sum of 1/odd for all outcomes). If you want to use a different de-vigging method, provide already de-vigged odds.
 * @param liquidity_ui - The initial liquidity in UI units (e.g. 1000.0 for 1000 USDC)
 * @param parlaySettings - Parlay configuration (enabled, optional oddsFactor, optional liquidityFactor_ui in UI units, optional excludeMarkets)
 * @param riskControl - Must be null for DirectControlled markets
 * @param tokenInfo - Token information (mint address and decimals)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getControlledCreateMarketInstruction(
   productAdmin: Address,
   marketType: "DirectControlled",
   productId: number,
   marketId: bigint,
   category: number,
   subCategory: number,
   event: number,
   otherIdBytes: Uint8Array,
   times: { eventStart: number, marketLockTime: number, goLiveTime?: number },
   marketString: string,
   rulesUrl: string,
   feeOverride: false | {productFlatFee_ui: number, productPcFee_pc: number, productWinFee_pc: number, productPerformanceFee_pc: number }, // _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
   trim_pc: number,
   oracleAuthority: Address,
   outcomes: {name: string, odds_dec: number}[],
   liquidity_ui: number,
   parlaySettings: { parlayEnabled: boolean, parlayOddsFactor?: number, parlayLiquidityFactor_ui?: number, excludeMarkets?: bigint[] },
   riskControl: null,
   tokenInfo: { mint: Address, decimals: number },
   tokenProgram?: Address,
): Promise<Instruction>
/**
 * Get the CreateAdvControlledMarket instruction - for creating an advanced controlled market
 * @param productAdmin - The product admin key (signer)
 * @param marketType - Must be "AdvControlled"
 * @param productId - The product id
 * @param marketId - The market id
 * @param category - The market category
 * @param subCategory - The market subcategory
 * @param event - The event id
 * @param otherIdBytes - Additional identifier bytes
 * @param times - Market timing information (eventStart, marketLockTime, optional goLiveTime)
 * @param marketString - The market description string
 * @param rulesUrl - The rules URL for the market
 * @param feeOverride - Optional fee override configuration, or false to use product defaults. _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
 * @param trim_pc - The trim percentage in decimal format (0-1, e.g. 0.05 for 5%)
 * @param oracleAuthority - The oracle authority address
 * @param outcomes - Array of outcomes with names and decimal odds (e.g. 2.5 for 2.5 odds). The program requires de-vigged odds. The SDK will automatically de-vig by multiplying each odd by the overround (sum of 1/odd for all outcomes). If you want to use a different de-vigging method, provide already de-vigged odds.
 * @param liquidity_ui - The initial liquidity in UI units (e.g. 1000.0 for 1000 USDC)
 * @param parlaySettings - Parlay configuration (enabled, optional oddsFactor, optional liquidityFactor_ui in UI units, optional excludeMarkets)
 * @param riskControl - Risk control (maxRisk, bonusCap, overRiskPenalty) — required for AdvControlled
 * @param tokenInfo - Token information (mint address and decimals)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getControlledCreateMarketInstruction(
   productAdmin: Address,
   marketType: "AdvControlled",
   productId: number,
   marketId: bigint,
   category: number,
   subCategory: number,
   event: number,
   otherIdBytes: Uint8Array,
   times: { eventStart: number, marketLockTime: number, goLiveTime?: number },
   marketString: string,
   rulesUrl: string,
   feeOverride: false | {productFlatFee_ui: number, productPcFee_pc: number, productWinFee_pc: number, productPerformanceFee_pc: number }, // _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
   trim_pc: number,
   oracleAuthority: Address,
   outcomes: {name: string, odds_dec: number}[],
   liquidity_ui: number,
   parlaySettings: { parlayEnabled: boolean, parlayOddsFactor?: number, parlayLiquidityFactor_ui?: number, excludeMarkets?: bigint[] },
   riskControl: { maxRisk: bigint, bonusCap: number, overRiskPenalty: number },
   tokenInfo: { mint: Address, decimals: number },
   tokenProgram?: Address,
): Promise<Instruction>
export async function getControlledCreateMarketInstruction(
   productAdmin: Address,
   marketType: "DirectControlled" | "AdvControlled",
   productId: number,
   marketId: bigint,
   category: number,
   subCategory: number,
   event: number,
   otherIdBytes: Uint8Array,
   times: { eventStart: number, marketLockTime: number, goLiveTime?: number },
   marketString: string,
   rulesUrl: string,
   feeOverride: false | {productFlatFee_ui: number, productPcFee_pc: number, productWinFee_pc: number, productPerformanceFee_pc: number }, // _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
   trim_pc: number,
   oracleAuthority: Address,
   outcomes: {name: string, odds_dec: number}[],
   liquidity_ui: number,
   parlaySettings: { parlayEnabled: boolean, parlayOddsFactor?: number, parlayLiquidityFactor_ui?: number, excludeMarkets?: bigint[] },
   riskControl: null | { maxRisk: bigint, bonusCap: number, overRiskPenalty: number },
   tokenInfo: { mint: Address, decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   if(marketType === "AdvControlled"){
      if(riskControl === null){
         throw new Error("Risk control is required for AdvControlled markets");
      }
   }
   validateUint8(productId);
   validateUint64(marketId);
   validateUint8(category);
   validateUint16(subCategory);
   validateUint32(event);
   validateUint8Array(otherIdBytes);
   validateTimes(times);
   if(feeOverride){
      validateUint64(uiToScaled(feeOverride.productFlatFee_ui, tokenInfo.decimals));
      validatePc(feeOverride.productPcFee_pc);
      validatePc(feeOverride.productWinFee_pc);
      validatePc(feeOverride.productPerformanceFee_pc);
   }
   validatePc(trim_pc);
   assertIsAddress(oracleAuthority);
   validateTokenInfo(tokenInfo);
   validateParlaySettings(marketId, parlaySettings, tokenInfo.decimals);
   if(marketType === "AdvControlled" && riskControl !== null){
      validateUint64(riskControl.maxRisk);
      validateUint16(riskControl.bonusCap);
      validateUint16(riskControl.overRiskPenalty);
      if(riskControl.maxRisk <= 0){
         throw new Error("Max risk must be > 0");
      }
   }
   assertIsAddress(tokenProgram);


   // multiply by liquidity_ui safely without overflow
   const scaledOutcomes: ControlledMarketOutcome[] = outcomes.map(outcome => {
      return {
         outcome_identifier: {
            outcome_name: outcome.name,
         },
         outcome_risk: safeBigInt(0),
         outcome_payout: safeBigInt(0),
      };
   });
   const baseMarketInstruction = {
      base: {
         market_identifier: {
            product_id: productId,
            market_id: marketId,
            category: category,
            sub_category: subCategory,
            event: event,
            other_id_bytes: otherIdBytes,
            event_start: times.eventStart,
            market_string: marketString,
            rules_url: rulesUrl,
         },
         lock_time: times.marketLockTime,
         trim: trim_pc * PC_SCALE,
         resolution_authority: { method: { __kind: 'Oracle' as const }, account: (await getOraclePDA(productId, marketId))[0] },
         fee_override: feeOverride !== false,
         flat_fee: feeOverride ? uiToScaled(feeOverride.productFlatFee_ui, tokenInfo.decimals) : safeBigInt(0),
         pc_fee: feeOverride ? feeOverride.productPcFee_pc * PC_SCALE : 0,
         win_fee: feeOverride ? feeOverride.productWinFee_pc * PC_SCALE : 0,
         performance_fee: feeOverride ? feeOverride.productPerformanceFee_pc * PC_SCALE : 0,
      },
      go_live_time: times.goLiveTime ?? 0,
      parlay_settings: {
         parlay_enabled: parlaySettings.parlayEnabled,
         parlay_odds_factor: (parlaySettings.parlayOddsFactor ?? 0) * PC_SCALE,
         parlay_liquidity_factor: parlaySettings.parlayLiquidityFactor_ui !== undefined 
            ? uiToScaled(parlaySettings.parlayLiquidityFactor_ui, tokenInfo.decimals)
            : safeBigInt(0),
         exclude_markets: parlaySettings.excludeMarkets ?? [],
      },
   };

   const marketData: CreateDirectControlledMarketInstruction | CreateAdvControlledMarketInstruction = 
      marketType === "AdvControlled" && riskControl !== null
         ? {
            ...baseMarketInstruction,
            max_risk: riskControl.maxRisk,
            bonus_cap: riskControl.bonusCap,
            over_risk_penalty: riskControl.overRiskPenalty,
            liquidity: uiToScaled(liquidity_ui, tokenInfo.decimals),
            outcomes: scaledOutcomes.map((outcome) => ({
               ...outcome,
               outcome_risk: safeBigInt(0),
            })),
         }
         : {
            ...baseMarketInstruction,
            outcomes: scaledOutcomes,
         };

   const createMarketInstruction: CreateMarketInstruction = 
      marketType === "AdvControlled"
         ? { __kind: "AdvControlled", value: marketData as CreateAdvControlledMarketInstruction }
         : { __kind: "DirectControlled", value: marketData as CreateDirectControlledMarketInstruction };

   return await buildCreateMarketInstruction(
      productAdmin,
      createMarketInstruction,
      productId,
      tokenInfo.mint,
      tokenProgram,
      oracleAuthority,
      true,
   );
}

/**
 * Get the CreateOneVOneMarket instruction - for creating a one-vs-one market where two challengers each stake for their respective outcomes
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param category - The market category
 * @param subCategory - The market subcategory
 * @param event - The event id
 * @param otherIdBytes - Additional identifier bytes
 * @param times - Market timing information (eventStart, marketLockTime)
 * @param marketString - The market description string
 * @param rulesUrl - The rules URL for the market
 * @param feeOverride - Optional fee override configuration, or false to use product defaults. _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
 * @param trim_pc - The trim percentage in decimal format (0-1, e.g. 0.05 for 5%)
 * @param resolutionMethod - The resolution method ("oracle" or resolver address)
 * @param outcomeNames - Array of exactly 2 outcome names
 * @param challengerStakes_ui - Array of exactly 2 stakes in UI units (e.g. [100.0, 100.0] for 100 USDC each)
 * @param challengers - Tuple of exactly 2 challenger addresses
 * @param tokenInfo - Token information (mint address and decimals)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getOneVOneCreateMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   category: number,
   subCategory: number,
   event: number,
   otherIdBytes: Uint8Array,
   times: { eventStart: number, marketLockTime: number },
   marketString: string,
   rulesUrl: string,
   feeOverride: false | {productFlatFee_ui: number, productPcFee_pc: number, productWinFee_pc: number, productPerformanceFee_pc: number }, // _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
   trim_pc: number,
   resolutionMethod: {oracleUpdater: Address} | {marketAdmin: Address},
   outcomeNames: string[],
   challengerStakes_ui: number[],
   challengers: [Address, Address],
   tokenInfo: { mint: Address, decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint8(productId);
   validateUint64(marketId);
   validateUint8(category);
   validateUint16(subCategory);
   validateUint32(event);
   validateUint8Array(otherIdBytes);
   validateTimes(times);
   if(feeOverride){
      validateUint64(uiToScaled(feeOverride.productFlatFee_ui, tokenInfo.decimals));
      validatePc(feeOverride.productPcFee_pc);
      validatePc(feeOverride.productWinFee_pc);
      validatePc(feeOverride.productPerformanceFee_pc);
   }
   validatePc(trim_pc);

   let resolutionType: "oracle" | "marketAdmin" | undefined = undefined;
   let marketAdmin: Address | undefined = undefined;
   let oracleUpdater: Address | undefined = undefined;
   if("oracleUpdater" in resolutionMethod){
      oracleUpdater = resolutionMethod.oracleUpdater;
      resolutionType = "oracle";
      assertIsAddress(oracleUpdater);
   }else if ("marketAdmin" in resolutionMethod){
      marketAdmin = resolutionMethod.marketAdmin;
      resolutionType = "marketAdmin";
      assertIsAddress(marketAdmin);
   } else {
      throw new Error("Invalid resolution method");
   }

   if(outcomeNames.length != 2){
      throw new Error("There must be two outcomes");
   }
   if(challengerStakes_ui.length != 2){
      throw new Error("There must be two challenger stakes");
   }
   challengerStakes_ui.forEach((stake, index) => {
      if(stake <= 0){
         throw new Error(`Challenger stake ${index} must be > 0`);
      }
   });
   if(challengers.length != 2){
      throw new Error("There must be two challengers");
   }
   if(challengers[0] == challengers[1]){
      throw new Error("Challengers must be different");
   }
   assertIsAddress(challengers[0]);
   assertIsAddress(challengers[1]);
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);


   // multiply by liquidity_ui safely without overflow
   const scaledOutcomes = outcomeNames.map((name, index) => {
      const outcomeBalance = uiToScaled(challengerStakes_ui[index]!, tokenInfo.decimals);
      validateUint64(outcomeBalance);
      return {
         outcome_identifier: {
            outcome_name: name,
         },
         outcome_balance: outcomeBalance,
         outcome_payout: safeBigInt(0),
      };
   });

   const marketData: CreateOneVOneMarketInstruction = {
      base: {
         market_identifier: {
            product_id: productId,
            market_id: marketId,
            category: category,
            sub_category: subCategory,
            event: event,
            other_id_bytes: otherIdBytes,
            event_start: times.eventStart,
            market_string: marketString,
            rules_url: rulesUrl,
         },
         lock_time: times.marketLockTime,
         trim: trim_pc * PC_SCALE,
         resolution_authority: resolutionType === 'oracle'
            ? { method: { __kind: 'Oracle' }, account: (await getOraclePDA(productId, marketId))[0] }
            : { method: { __kind: 'Manual' }, account: marketAdmin! },
         fee_override: feeOverride !== false,
         flat_fee: feeOverride ? uiToScaled(feeOverride.productFlatFee_ui, tokenInfo.decimals) : safeBigInt(0),
         pc_fee: feeOverride ? feeOverride.productPcFee_pc * PC_SCALE : 0,
         win_fee: feeOverride ? feeOverride.productWinFee_pc * PC_SCALE : 0,
         performance_fee: feeOverride ? feeOverride.productPerformanceFee_pc * PC_SCALE : 0,
      },
      outcomes: scaledOutcomes,
      challengers: challengers,
   };
   return await buildCreateMarketInstruction(
      productAdmin,
      { __kind: 'OneVOne', value: marketData },
      productId,
      tokenInfo.mint,
      tokenProgram,
      resolutionType === 'oracle' ? oracleUpdater : marketAdmin!,
      resolutionType === 'oracle',
   );
}

/**
 * Get the CreateOneVManyMarket instruction - for creating a one-vs-many market where one challenger stakes for one outcome, and the pool provides liquidity for other outcomes
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param category - The market category
 * @param subCategory - The market subcategory
 * @param event - The event id
 * @param otherIdBytes - Additional identifier bytes
 * @param times - Market timing information (eventStart, marketLockTime)
 * @param marketString - The market description string
 * @param rulesUrl - The rules URL for the market
 * @param feeOverride - Optional fee override configuration, or false to use product defaults. _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
 * @param trim_pc - The trim percentage in decimal format (0-1, e.g. 0.05 for 5%)
 * @param resolutionMethod - The resolution method ("oracle" or resolver address)
 * @param outcomeNames - Array of exactly 2 outcome names
 * @param outcomeOdds_dec - Array of exactly 2 decimal odds (e.g. [2.5, 1.8] for 2.5 and 1.8 odds). The program requires de-vigged odds. The SDK will automatically de-vig by multiplying each odd by the overround (sum of 1/odd for all outcomes). If you want to use a different de-vigging method, provide already de-vigged odds.
 * @param challenger - The challenger address
 * @param challengerStake_ui - The challenger's stake in UI units (e.g. 100.0 for 100 USDC)
 * @param challengerOutcomeIndex - The challenger's outcome index (1-indexed, must be between 1 and number of outcomes)
 * @param tokenInfo - Token information (mint address and decimals)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getOneVManyCreateMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   category: number,
   subCategory: number,
   event: number,
   otherIdBytes: Uint8Array,
   times: { eventStart: number, marketLockTime: number },
   marketString: string,
   rulesUrl: string,
   feeOverride: false | {productFlatFee_ui: number, productPcFee_pc: number, productWinFee_pc: number, productPerformanceFee_pc: number }, // _pc values are in decimal format (0-1, e.g. 0.05 for 5%)
   trim_pc: number,
   resolutionMethod: {oracleUpdater: Address} | {marketAdmin: Address},
   outcomeNames: string[],
   outcomeOdds_dec: number[],
   challenger: Address,
   challengerStake_ui: number,
   challengerOutcomeIndex: number,
   tokenInfo: { mint: Address, decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint8(productId);
   validateUint64(marketId);
   validateUint8(category);
   validateUint16(subCategory);
   validateUint32(event);
   validateUint8Array(otherIdBytes);
   validateTimes(times);
   if(feeOverride){
      validateUint64(uiToScaled(feeOverride.productFlatFee_ui, tokenInfo.decimals));
      validatePc(feeOverride.productPcFee_pc);
      validatePc(feeOverride.productWinFee_pc);
      validatePc(feeOverride.productPerformanceFee_pc);
   }
   validatePc(trim_pc);

   let resolutionType: "oracle" | "marketAdmin" | undefined = undefined;
   let marketAdmin: Address | undefined = undefined;
   let oracleUpdater: Address | undefined = undefined;
   if("oracleUpdater" in resolutionMethod){
      oracleUpdater = resolutionMethod.oracleUpdater;
      resolutionType = "oracle";
      assertIsAddress(oracleUpdater);
   }else if ("marketAdmin" in resolutionMethod){
      marketAdmin = resolutionMethod.marketAdmin;
      resolutionType = "marketAdmin";
      assertIsAddress(marketAdmin);
   } else {
      throw new Error("Invalid resolution method");
   }

   if(outcomeNames.length != 2){
      throw new Error("There must be two outcomes");
   }
   if(outcomeOdds_dec.length != 2){
      throw new Error("There must be two outcome odds");
   }
   if(challengerStake_ui <= 0){
      throw new Error("Challenger stake must be > 0");
   }
   assertIsAddress(challenger);
   validateUint8(challengerOutcomeIndex);
   if(challengerOutcomeIndex < 1 || challengerOutcomeIndex > outcomeNames.length){
      throw new Error("Challenger outcome index must be between 1 and the number of outcomes (1-indexed)");
   }
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);

   // Remove vig: calculate overround as sum of 1/odd for all outcomes
   const overround = outcomeOdds_dec.reduce((sum, odd) => sum + (1 / odd), 0);
   const deviggedOdds = outcomeOdds_dec.map(odd => odd * overround);
   // multiply by liquidity_ui safely without overflow
   const scaledOutcomes = outcomeNames.map((name, index) => {
      const outcomeBalance = 
         index === (challengerOutcomeIndex - 1) //is challenger outcome (1-indexed)
         ? uiToScaled(challengerStake_ui, tokenInfo.decimals)
         : uiToScaled(challengerStake_ui / (deviggedOdds[index]! - 1), tokenInfo.decimals);
      validateUint64(outcomeBalance);
      return {
         outcome_identifier: {
            outcome_name: name,
         },
         outcome_balance: outcomeBalance,
         outcome_payout: safeBigInt(0),
      };
   });

   const marketData: CreateOneVManyMarketInstruction = {
      base: {
         market_identifier: {
            product_id: productId,
            market_id: marketId,
            category: category,
            sub_category: subCategory,
            event: event,
            other_id_bytes: otherIdBytes,
            event_start: times.eventStart,
            market_string: marketString,
            rules_url: rulesUrl,
         },
         lock_time: times.marketLockTime,
         trim: trim_pc * PC_SCALE,
         resolution_authority: resolutionType === 'oracle'
            ? { method: { __kind: 'Oracle' }, account: (await getOraclePDA(productId, marketId))[0] }
            : { method: { __kind: 'Manual' }, account: marketAdmin! },
         fee_override: feeOverride !== false,
         flat_fee: feeOverride ? uiToScaled(feeOverride.productFlatFee_ui, tokenInfo.decimals) : safeBigInt(0),
         pc_fee: feeOverride ? feeOverride.productPcFee_pc * PC_SCALE : 0,
         win_fee: feeOverride ? feeOverride.productWinFee_pc * PC_SCALE : 0,
         performance_fee: feeOverride ? feeOverride.productPerformanceFee_pc * PC_SCALE : 0,
      },
      outcomes: scaledOutcomes,
      challenger: challenger,
      challenger_outcome_index: challengerOutcomeIndex,
   };
   return await buildCreateMarketInstruction(
      productAdmin,
      { __kind: 'OneVMany', value: marketData },
      productId,
      tokenInfo.mint,
      tokenProgram,
      resolutionType === 'oracle' ? oracleUpdater : marketAdmin!,
      resolutionType === 'oracle',
   );
}

/**
 * Get the UpdateMarketStatus instruction - for updating the status of a market
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param status - The new market status ('Prematch' | 'Live' | 'Paused')
 * @returns The instruction
 */
export async function getUpdateMarketStatusInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   status: MarketStatus['__kind'],
): Promise<Instruction> {
   validateUint8(productId);
   validateUint64(marketId);
   if(status !== 'Prematch' && status !== 'Live' && status !== 'Paused'){
      throw new Error("Invalid market status");
   }
   return await buildUpdateMarketStatusInstruction(productAdmin, productId, marketId, { __kind: status });
}

/**
 * Get the EditGoLiveTime instruction - for editing the go live time of a market
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param newGoLiveTime - The new go live time
 * @returns The instruction
 */
export async function getEditGoLiveTimeInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   newGoLiveTime: number,
): Promise<Instruction> {
   validateUint8(productId);
   validateUint64(marketId);
   validateUint32(newGoLiveTime);
   if(newGoLiveTime <= Date.now()/1000){
      throw new Error("Go live time must be >= current time");
   }
   return await buildEditMarketGoLiveTimeInstruction(productAdmin, productId, marketId, newGoLiveTime);
}

/**
 * Get the ResolveMarket instruction - for resolving a market with the winning outcome.
 * Manual resolution: signer must be resolution_authority.account (e.g. product admin), provide outcome_index.
 * Oracle resolution: pass oracle PDA; winning_outcome is read from oracle account at resolution_authority.account.
 * @param productAdmin - Resolution authority signer (product admin for Manual; same for Oracle, oracle account passed separately)
 * @param productId - The product id
 * @param marketId - The market id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param resolveData - Manual: outcome_index = 1-indexed winning outcome; Oracle: outcome_index null
 * @param oraclePda - Required when resolution_authority.method === Oracle; omit for Manual
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
/** Oracle resolution: pass oraclePda; resolveData.outcome_index must be null. */
export async function getResolveMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   tokenInfo: { mint: Address; decimals: number },
   resolveData: ResolveMarketFromOracleInstruction,
   oraclePda: Address,
   tokenProgram?: Address,
): Promise<Instruction>
/** Admin resolution: omit oraclePda; resolveData.outcome_index must be the winning outcome (1-indexed). */
export async function getResolveMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   tokenInfo: { mint: Address; decimals: number },
   resolveData: ResolveMarketFromAdminInstruction,
   oraclePda?: never,
   tokenProgram?: Address,
): Promise<Instruction>
export async function getResolveMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   tokenInfo: { mint: Address; decimals: number },
   resolveData: ResolveMarketInstruction,
   oraclePda?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint8(productId);
   validateUint64(marketId);
   validateTokenInfo(tokenInfo);
   validateUint32(resolveData.rollback_timestamp);
   if(resolveData.payout_adjustment !== null){
      validateInt64(resolveData.payout_adjustment);
   }
   if(resolveData.outcome_index === null && oraclePda === undefined){
      throw new Error("Oracle PDA is required when resolution_authority.method === Oracle. For Manual resolution, omit oraclePda and set resolveData.outcome_index to the winning outcome (1-indexed).");
   }
   if(resolveData.outcome_index !== null){
      validateUint8(resolveData.outcome_index);
      if(resolveData.outcome_index <= 0){
         throw new Error("Outcome index must be > 0 (outcomes are 1-indexed)");
      }
   }
   if(oraclePda !== undefined){
      assertIsAddress(oraclePda);
   }
   assertIsAddress(tokenProgram);

   return await buildResolveMarketInstruction(
      productAdmin,
      productId,
      marketId,
      tokenInfo.mint,
      resolveData,
      oraclePda,
      tokenProgram,
   );
}


/**
 * Get the CloseMarket instruction - for closing a market (this does not perform any validation on market state - market should have 0 open bets)
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param hasOracleAccount - When true (resolution_authority.method === Oracle), oracle account is closed; when false (Manual), pass default pubkey
 * @returns The instruction
 */
export async function getCloseMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   hasOracleAccount: boolean,
   hasRollbackAccount: boolean,
   tokenInfo: { mint: Address; decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint8(productId);
   validateUint64(marketId);
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);
   return await buildCloseMarketInstruction(
      productAdmin,
      productId,
      marketId,
      hasOracleAccount,
      hasRollbackAccount,
      tokenInfo.mint,
      tokenProgram,
   );
}

/**
 * Get the UpdateOracle instruction - for updating the oracle odds
 * @param oracleUpdater - The oracle updater key (signer)
 * @param productId - The product id
 * @param odds - The decimal odds for each outcome. The program requires de-vigged odds. The SDK will automatically de-vig by multiplying each odd by the overround (sum of 1/odd for all outcomes). If you want to use a different de-vigging method, provide already de-vigged odds.
 * @param sequence - The sequence number
 * @param oracleType - The oracle type ('Standard' | 'Live' | 'Resolution')
 * @param liquidityFactor - The liquidity scaling factor (0-1) - only used for Live oracle type
 * @returns The instruction
 */
export async function getUpdateOracleInstruction(
   oracleUpdater: Address,
   productId: number,
   oracleSeed: bigint,
   odds: number[],
   sequence: number = Math.floor(Date.now() / 1000),
   oracleType: OracleDataVariant['__kind'],
   liquidityFactor: number = 1,
): Promise<Instruction> {
   validateUint8(productId);
   validateUint64(oracleSeed);
   validateUint32(sequence);
   if(sequence <= 0){
      throw new Error("Sequence must be > 0");
   }
   // Validate odds
   if (odds.length === 0) {
      throw new Error("Odds array cannot be empty");
   }
   if (!odds.every(odd => odd == 0) && odds.some(odd => odd <= 1)) {
      throw new Error("All odds must be > 1 or all odds must be 0");
   }
   if(odds.length > 254){
      throw new Error("Odds array length must be <= 254");
   }
   if(oracleType !== 'ControlledLiquidity' && oracleType !== 'FactoredLiquidity' && oracleType !== 'Resolution'){
      throw new Error("Invalid oracle type");
   }
   if(oracleType === 'Resolution'){
      throw new Error("This instruction is not supported for Resolution oracle type. Use getSetWinningOutcomeInstruction instead");
   }
   if(oracleType === 'FactoredLiquidity'){
      if(liquidityFactor < 0){
         throw new Error("Liquidity factor must be >= 0");
      }
      if(liquidityFactor > PC_SCALE){
         throw new Error("Liquidity factor must be <= " + PC_SCALE);
      }
   }

   let scaledOdds: bigint[];
   if(odds.every(odd => odd == 0)){
      scaledOdds = odds.map(odd => safeBigInt(0));
   } else {
      // Remove vig: calculate overround as sum of 1/odd for all outcomes
      const overround = odds.reduce((sum, odd) => sum + (1 / odd), 0);
      // Scale odds: multiply by RATIO_SCALE (10^6) safely without overflow
      scaledOdds = odds.map(odd => safeMultiplyByScale(odd * overround, RATIO_SCALE));
   }
  
   scaledOdds.forEach(odd => validateUint64(odd));

   // Encode oracle data variant (probabilities from odds: prob_i ∝ 1/odd_i, scaled to 0..PC_SCALE)
   const overroundForProbs = odds.every(odd => odd === 0) ? 1 : odds.reduce((sum, odd) => sum + (odd > 0 ? 1 / odd : 0), 0);
   const probabilities: number[] = odds.map(odd => odd === 0 ? 0 : round((1 / odd) / overroundForProbs * PC_SCALE, 0));

   let oracleData: OracleDataVariant;
   if(oracleType === 'ControlledLiquidity'){
      oracleData = {
         __kind: 'ControlledLiquidity',
         probabilities,
         liquidity: safeBigInt(0),
      };
   } else if(oracleType === 'FactoredLiquidity'){
      oracleData = {
         __kind: 'FactoredLiquidity',
         liquidity_factor: round(liquidityFactor * PC_SCALE, 0),
         probabilities,
      };
   } else {
      throw new Error("Invalid oracle type");
   }
   const encodedOracleData = new Uint8Array(oracleDataVariantEncoder.encode(oracleData));

   return await buildUpdateOracleInstruction(oracleUpdater, productId, oracleSeed, sequence, encodedOracleData);
}