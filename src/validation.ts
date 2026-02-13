// Validation helpers - all validation functions consolidated here for better organization

import { Address, assertIsAddress } from "@solana/kit";
import type { TokenInfo } from "./types";
import { ValidationRangeError, ValidationRequiredError, ValidationTypeError } from "./errors";
import { MarketIdentifier } from "./types";
import { uiToScaled } from "./utils";

// --- Primitive Type Validators ---

/**
 * Validate that a number is a valid uint8 (0-255)
 * @param value - The value to validate
 * @param parameter - Optional parameter name for better error messages
 * @throws ValidationRangeError if value is not in the valid range
 */
export function validateUint8(value: number, parameter?: string): void {
   if(value < 0 || value > 255){
      throw new ValidationRangeError("Value must be between 0 and 255", parameter || 'value', value, 0, 255);
   }
}

/**
 * Validate that a number is a valid uint16 (0-65535)
 * @param value - The value to validate
 * @param parameter - Optional parameter name for better error messages
 * @throws ValidationRangeError if value is not in the valid range
 */
export function validateUint16(value: number, parameter?: string): void {
   if(value < 0 || value > 65535){
      throw new ValidationRangeError("Value must be between 0 and 65535", parameter || 'value', value, 0, 65535);
   }
}

/**
 * Validate that a number is a valid uint32 (0-4294967295)
 * @param value - The value to validate
 * @param parameter - Optional parameter name for better error messages
 * @throws ValidationRangeError if value is not in the valid range
 */
export function validateUint32(value: number, parameter?: string): void {
   if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 4294967295) {
      throw new ValidationRangeError("Value must be between 0 and 4294967295", parameter || 'value', value, 0, 4294967295);
   }
}

/**
 * Validate that a bigint is a valid uint64 (0-18446744073709551615)
 * @param value - The value to validate
 * @param parameter - Optional parameter name for better error messages
 * @throws ValidationRangeError if value is not in the valid range
 */
export function validateUint64(value: bigint, parameter?: string): void {
   if(value < 0n || value > 18446744073709551615n){
      throw new ValidationRangeError("Value must be between 0 and 18446744073709551615", parameter || 'value', value, 0n, 18446744073709551615n);
   }
}

/**
 * Validate that a bigint is a valid int64 (-9223372036854775808 to 9223372036854775807)
 * @param value - The value to validate
 * @param parameter - Optional parameter name for better error messages
 * @throws ValidationRangeError if value is not in the valid range
 */
export function validateInt64(value: bigint, parameter?: string): void {
   if(value < -9223372036854775808n || value > 9223372036854775807n){
      throw new ValidationRangeError("Value must be between -9223372036854775808 and 9223372036854775807", parameter || 'value', value, -9223372036854775808n, 9223372036854775807n);
   }
}

/**
 * Validate that a value is a boolean
 * @param value - The value to validate
 * @param parameter - Optional parameter name for better error messages
 * @throws ValidationTypeError if value is not a boolean
 */
export function validateBool(value: boolean, parameter?: string): void {
   if(typeof value !== "boolean"){
      throw new ValidationTypeError("Value must be a boolean", parameter || 'value', value, 'boolean');
   }
}

/**
 * Validate that a value is a Uint8Array and optionally check its length
 * @param array - The array to validate
 * @param expLength - Optional expected length
 * @param parameter - Optional parameter name for better error messages
 * @throws ValidationTypeError if array is not a Uint8Array
 * @throws ValidationRangeError if length doesn't match
 */
export function validateUint8Array(array: Uint8Array, expLength?: number, parameter?: string): void {
   if(!(array instanceof Uint8Array)){
      throw new ValidationTypeError("Input must be a Uint8Array", parameter || 'array', array, 'Uint8Array');
   }
   if(expLength !== undefined && array.length !== expLength){
      throw new ValidationRangeError(`Array length must be ${expLength}`, parameter || 'array', array.length, expLength, expLength);
   }
}

/**
 * Validate that a number is a valid percentage in decimal format (0-1, e.g. 0.05 for 5%)
 * @param value - The value to validate (decimal format, e.g. 0.05 for 5%)
 * @param parameter - Optional parameter name for better error messages
 * @throws ValidationRangeError if value is not in the valid range
 */
export function validatePc(value: number, parameter?: string): void {
   if(value < 0 || value > 1){
      throw new ValidationRangeError("Value must be between 0 and 1 (decimal format, e.g. 0.05 for 5%)", parameter || 'value', value, 0, 1);
   }
}

// --- Complex Type Validators ---

/**
 * Validate market timing information
 * @param times - Market timing information (eventStart, marketLockTime, optional goLiveTime)
 * @throws ValidationRangeError if any time is in the past or if lockTime is before eventStart
 */
export function validateTimes(times: { eventStart: number, marketLockTime: number, goLiveTime?: number }): void {
   const now = Math.floor(Date.now() / 1000);
   
   if(times.eventStart <= now){
      throw new ValidationRangeError(
         "Event start time must be in the future",
         'eventStart',
         times.eventStart,
         now + 1
      );
   }
   
   if(times.marketLockTime <= now){
      throw new ValidationRangeError(
         "Market lock time must be in the future",
         'marketLockTime',
         times.marketLockTime,
         now + 1
      );
   }
   
   if(times.marketLockTime < times.eventStart){
      throw new ValidationRangeError(
         "Market lock time must be >= event start time",
         'marketLockTime',
         times.marketLockTime,
         times.eventStart
      );
   }
   
   if(times.goLiveTime !== undefined){
      if(times.goLiveTime <= now){
         throw new ValidationRangeError(
            "Go live time must be in the future",
            'goLiveTime',
            times.goLiveTime,
            now + 1
         );
      }
      if(times.goLiveTime >= times.marketLockTime){
         throw new ValidationRangeError(
            "Go live time must be < market lock time",
            'goLiveTime',
            times.goLiveTime,
            undefined,
            times.marketLockTime - 1
         );
      }
   }
}

/**
 * Validate parlay settings
 * @param thisMarketId - The current market id (used to ensure it's not in excludeMarkets)
 * @param parlaySettings - Parlay configuration (enabled, optional oddsFactor, optional liquidityFactor_ui in UI units, optional excludeMarkets)
 * @param decimals - Token decimals for scaling liquidity factor
 * @throws ValidationRequiredError if parlay is enabled but excludeMarkets is missing
 * @throws ValidationRangeError if this market is in excludeMarkets or if parlayOddsFactor or parlayLiquidityFactor_ui is invalid
 */
export function validateParlaySettings(
   thisMarketId: bigint,
   parlaySettings: { parlayEnabled: boolean, parlayOddsFactor?: number, parlayLiquidityFactor_ui?: number, excludeMarkets?: bigint[] },
   decimals: number
): void {
   if(parlaySettings.parlayEnabled){
      if(parlaySettings.excludeMarkets === undefined){
         throw new ValidationRequiredError(
            "Exclude markets array is required when parlay is enabled",
            'excludeMarkets'
         );
      }
      
      if(parlaySettings.parlayOddsFactor !== undefined){
         validatePc(parlaySettings.parlayOddsFactor, 'parlayOddsFactor');
      }
      
      if(parlaySettings.parlayLiquidityFactor_ui !== undefined){
         if(parlaySettings.parlayLiquidityFactor_ui < 0){
            throw new ValidationRangeError(
               "Parlay liquidity factor must be >= 0",
               'parlayLiquidityFactor_ui',
               parlaySettings.parlayLiquidityFactor_ui,
               0
            );
         }
         // Validate the scaled value
         const scaledValue = uiToScaled(parlaySettings.parlayLiquidityFactor_ui, decimals);
         validateUint64(scaledValue, 'parlayLiquidityFactor_ui (scaled)');
      }
      
      parlaySettings.excludeMarkets.forEach((marketId, index) => {
         validateUint64(marketId, `excludeMarkets[${index}]`);
         if(marketId === thisMarketId){
            throw new ValidationRangeError(
               "This market cannot be in its own excludeMarkets list",
               `excludeMarkets[${index}]`,
               marketId
            );
         }
      });
   }
}

/**
 * Validate a MarketIdentifier structure
 * @param identifier - The market identifier to validate
 * @throws ValidationRangeError if any field is out of range
 * @throws ValidationRequiredError if otherIdBytes length is incorrect
 */
export function validateMarketIdentifier(identifier: MarketIdentifier): void {
   validateUint16(identifier.product_id, 'product_id');
   validateUint64(identifier.market_id, 'market_id');
   validateUint8(identifier.category, 'category');
   validateUint16(identifier.sub_category, 'sub_category');
   validateUint32(identifier.event, 'event');
   validateUint8Array(identifier.other_id_bytes, 7, 'other_id_bytes');
   validateUint32(identifier.event_start, 'event_start');
   
   if(!identifier.market_string || identifier.market_string.length === 0){
      throw new ValidationRequiredError(
         "Market string cannot be empty",
         'market_string'
      );
   }
   
   if(!identifier.rules_url || identifier.rules_url.length === 0){
      throw new ValidationRequiredError(
         "Rules URL cannot be empty",
         'rules_url'
      );
   }
}

/**
 * Validate an outcome structure for market creation
 * @param outcomes - Array of outcomes to validate
 * @param minOutcomes - Minimum number of outcomes required (default: 2)
 * @throws ValidationRequiredError if outcomes array is empty or too short
 * @throws ValidationRangeError if odds are invalid
 */
export function validateOutcomes(
   outcomes: {name: string, odds_dec: number}[],
   minOutcomes: number = 2
): void {
   if(!outcomes || outcomes.length === 0){
      throw new ValidationRequiredError(
         "At least one outcome is required",
         'outcomes'
      );
   }
   
   if(outcomes.length < minOutcomes){
      throw new ValidationRequiredError(
         `At least ${minOutcomes} outcomes are required`,
         'outcomes'
      );
   }
   
   outcomes.forEach((outcome, index) => {
      if(!outcome.name || outcome.name.trim().length === 0){
         throw new ValidationRequiredError(
            `Outcome name at index ${index} cannot be empty`,
            `outcomes[${index}].name`
         );
      }
      
      if(outcome.odds_dec <= 1){
         throw new ValidationRangeError(
            "Decimal odds must be greater than 1",
            `outcomes[${index}].odds_dec`,
            outcome.odds_dec,
            1
         );
      }
   });
   
   // Calculate overround to warn if it's unusual (though not strictly invalid)
   const overround = outcomes.reduce((sum, outcome) => sum + (1 / outcome.odds_dec), 0);
   if(overround < 0.8 || overround > 1.25){
      // This is a warning, not an error - some markets may have unusual overrounds
      // But we can still validate that it's reasonable
   }
}

/**
 * Validate token info (mint address and decimals)
 * @param tokenInfo - Token information with mint address and decimals
 * @param parameter - Optional parameter name for error messages
 * @throws ValidationTypeError if mint is not a valid address
 * @throws ValidationRangeError if decimals is not an integer between 1 and 18
 */
export function validateTokenInfo(tokenInfo: TokenInfo, parameter?: string): void {
   assertIsAddress(tokenInfo.mint);
   if (typeof tokenInfo.decimals !== 'number' || !Number.isInteger(tokenInfo.decimals)) {
      throw new ValidationRangeError(
         "Decimals must be an integer",
         parameter ? `${parameter}.decimals` : 'decimals',
         tokenInfo.decimals,
         1,
         18
      );
   }
   if (tokenInfo.decimals < 1 || tokenInfo.decimals > 18) {
      throw new ValidationRangeError(
         "Decimals must be between 1 and 18",
         parameter ? `${parameter}.decimals` : 'decimals',
         tokenInfo.decimals,
         1,
         18
      );
   }
}

/**
 * Validate address format (wrapper around assertIsAddress with better error)
 * @param address - The address to validate
 * @param parameter - Parameter name for error messages
 * @throws ValidationTypeError if address is invalid
 */
export function validateAddress(address: Address | string, parameter: string): void {
   try {
      assertIsAddress(address);
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ValidationTypeError(
         `Invalid address format: ${message}`,
         parameter,
         address,
         'Address'
      );
   }
}

