import { ValidationRangeError, ValidationTypeError, OperationError } from "./errors";

/**
 * Convert a number to a Uint8Array (1 byte, little-endian)
 */
export function u8ToBuffer(value: number): Uint8Array {
   const buf = new Uint8Array(1);
   buf[0] = value;
   return buf;
}

/**
 * Convert a number to a Uint8Array (2 bytes, little-endian)
 */
export function u16ToBuffer(value: number): Uint8Array {
   const buf = new Uint8Array(2);
   const view = new DataView(buf.buffer);
   view.setUint16(0, value, true); // true = little-endian
   return buf;
}

/**
 * Convert a number (u32) to a Uint8Array (4 bytes, little-endian)
 */
export function u32ToBuffer(value: number): Uint8Array {
   const buf = new Uint8Array(4);
   const view = new DataView(buf.buffer);
   view.setUint32(0, value, true); // true = little-endian
   return buf;
}

/**
 * Convert a bigint to a Uint8Array (8 bytes, little-endian)
 */
export function u64ToBuffer(value: bigint): Uint8Array {
   const buf = new Uint8Array(8);
   const view = new DataView(buf.buffer);
   // DataView doesn't support BigInt directly, so we need to split into two 32-bit values
   const low = Number(value & 0xFFFFFFFFn);
   const high = Number(value >> 32n);
   view.setUint32(0, low, true);
   view.setUint32(4, high, true);
   return buf;
}

/**
 * Convert a base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
   const binaryString = atob(base64);
   const bytes = new Uint8Array(binaryString.length);
   for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
   }
   return bytes;
}

/**
 * Convert a string to Uint8Array (UTF-8 encoding)
 */
export function stringToUint8Array(str: string): Uint8Array {
   return new TextEncoder().encode(str);
}

/**
 * Concatenate multiple Uint8Arrays into one
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
   const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
   const result = new Uint8Array(totalLength);
   let offset = 0;
   for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
   }
   return result;
}

/**
 * Read a uint8 value from a Uint8Array at the given offset
 */
export function readUint8(bytes: Uint8Array, offset: number): number {
   const value = bytes[offset];
   if (value === undefined) {
      throw new ValidationRangeError(
         `Offset is out of bounds`,
         'offset',
         offset,
         0,
         bytes.length - 1
      );
   }
   return value;
}

/**
 * Read a biguint64 value from a Uint8Array at the given offset (little-endian)
 */
export function readBigUInt64LE(bytes: Uint8Array, offset: number): bigint {
   const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
   const low = BigInt(view.getUint32(0, true));
   const high = BigInt(view.getUint32(4, true));
   return low | (high << 32n);
}


/**
 * Round a number to a specified number of decimal places
 * @param n - The number to round
 * @param dp - The number of decimal places
 * @param dir - Optional rounding direction ("up" for ceil, "down" for floor, undefined for standard round)
 * @returns The rounded number
 */
export function round(n: number, dp: number, dir?: "up"|"down"|undefined): number{
   let fn = Math.round
   switch (dir){
      case "up":
         fn = Math.ceil
         break;
      case "down":
         fn = Math.floor
         break;
      default:
         break
   }
   const ten_dp = 10**dp
   return fn(n*ten_dp)/ten_dp
}

/**
 * Safely convert a number or string to a bigint, handling decimal numbers by truncating to integer part
 * @param number - The number or string to convert
 * @returns The bigint value (truncated if decimal)
 * @throws Error if conversion fails
 */
export function safeBigInt(number: number | string): bigint {
   try{
      if(typeof number === "bigint"){
         return number;
      }
      if(typeof number === "string"){
         return BigInt(number.split(".")[0]!)
      }
      else if(typeof number === "number"){
         return BigInt(round(number, 0))
      }
      else{
         throw new ValidationTypeError(
            `Invalid safeBigInt input`,
            'number',
            number,
            'number | string'
         );
      }
   }catch(error){
      if (error instanceof ValidationTypeError) {
         throw error;
      }
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new OperationError(
         `Error converting to bigint`,
         'safeBigInt',
         cause
      );
   }
}

/**
 * Safely multiply a number by a bigint scale without overflow
 * Handles decimal numbers by preserving precision during multiplication
 * @param value - The number to multiply (can be decimal, e.g., 1.9)
 * @param scale - The bigint scale factor (e.g., ODDS_SCALE = 1_000_000n)
 * @returns The result as a bigint
 */
export function safeMultiplyByScale(value: number | string, scale: bigint): bigint {
   try {
      // Convert to string to preserve decimal precision
      const valueStr = typeof value === 'string' ? value : value.toString();
      
      // Check if it's a decimal number
      if (valueStr.includes('.')) {
         const parts = valueStr.split('.');
         const integerPart = parts[0] || '0';
         const decimalPart = parts[1] || '';
         const decimalPlaces = decimalPart.length;
         
         // Remove decimal point: "1.9" -> "19" (with 1 decimal place)
         const integerValue = integerPart + decimalPart;
         
         // Multiply integer value by scale: 19 * 1_000_000 = 19_000_000
         const scaled = BigInt(integerValue) * scale;
         
         // Divide by 10^decimalPlaces to account for the decimal: 19_000_000 / 10 = 1_900_000
         const divisor = BigInt(10 ** decimalPlaces);
         return scaled / divisor;
      } else {
         // No decimal part, just multiply directly
         return BigInt(valueStr) * scale;
      }
   } catch (_) {
      return BigInt(0);
   }
}

/**
 * Convert a UI amount to scaled bigint (e.g., 10.5 USDC with 6 decimals -> 10_500_000n)
 * Handles decimal amounts with proper precision
 * @param amount_ui - The amount in UI units (e.g., 10.5 for 10.5 USDC)
 * @param decimals - The number of decimals (e.g., 6 for USDC)
 * @returns The scaled amount as a bigint
 * @throws Error if decimals is invalid
 */
export function uiToScaled(amount_ui: number | string, decimals: number): bigint {
   if (decimals <= 0 || decimals > 18) {
      throw new ValidationRangeError(
         `Decimals must be between 1 and 18`,
         'decimals',
         decimals,
         1,
         18
      );
   }
   const scale = safeBigInt(10 ** decimals);
   return safeMultiplyByScale(amount_ui, scale);
}

/**
 * Convert a scaled bigint to UI amount (e.g., 10_500_000n with 6 decimals -> 10.5)
 * @param scaled - The scaled amount as a bigint (e.g., 10_500_000n)
 * @param decimals - The number of decimals (e.g., 6 for USDC)
 * @returns The amount in UI units as a number
 * @throws Error if decimals is invalid
 */
export function scaledToUi(scaled: bigint, decimals: number): number {
   if (decimals <= 0 || decimals > 18) {
      throw new ValidationRangeError(
         `Decimals must be between 1 and 18`,
         'decimals',
         decimals,
         1,
         18
      );
   }
   const divisor = BigInt(10 ** decimals);
   const quotient = scaled / divisor;
   const remainder = scaled % divisor;
   return Number(quotient) + Number(remainder) / Number(divisor);
}

export function convertOdds(
   inputType: "dec" | "prob" | "american",
   inputOdds: number,
   outputType: "dec" | "prob" | "american",
): number {
   const oddsTypes = ["dec", "prob", "american"];
   if(!oddsTypes.includes(inputType)){
      throw new Error("Invalid input odds type");
   }
   if(!oddsTypes.includes(outputType)){
      throw new Error("Invalid output odds type");
   }
   if(inputType === outputType){
      return inputOdds;
   }

   if(inputType === "dec"){
      if(inputOdds <= 1){
         throw new Error("Decimal odds must be greater than 1");
      }
      if(outputType === "prob"){
         return 1 / inputOdds;
      } else if(outputType === "american"){
         if(inputOdds > 2){
            return ((inputOdds - 1) * 100);
         } else {
            return -100 / (inputOdds - 1);
         }
      }
   } else if(inputType === "prob"){
      if(inputOdds <= 0 || inputOdds > 1){
         throw new Error("Probability must be between 0 and 1");
      }
      if(outputType === "dec"){
         return 1 / inputOdds;
      } else if(outputType === "american"){
         if(inputOdds > 0.5){
            return ((1 / inputOdds - 1) * 100);
         } else {
            return -100 * inputOdds / (1 - inputOdds);
         }
      }
   } else if(inputType === "american"){
      if(inputOdds < 0 && inputOdds > -100 || inputOdds > 0 && inputOdds < 100){
         throw new Error("American odds must not be between -100 and 100 (negative for underdog, positive for favorite)");
      }
      if(inputOdds < 0){
         const outDecimal = (inputOdds + 100) / 100;
         if(outputType === "dec"){
            return outDecimal;
         } else if(outputType === "prob"){
            return 1 / outDecimal;
         }
      } else {
         const outDecimal = (inputOdds + 100) / 100;
         if(outputType === "dec"){
            return outDecimal;
         } else if(outputType === "prob"){
            return 1 / outDecimal;
         }
      }
   }
   throw new Error(`Unsupported conversion from ${inputType} to ${outputType}`);
}