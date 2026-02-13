import {Address, getProgramDerivedAddress, ProgramDerivedAddressBump, getAddressEncoder, SolanaRpcApi, Rpc, Base64EncodedBytes, GetProgramAccountsMemcmpFilter, Instruction, TransactionSigner, createKeyPairSignerFromBytes} from '@solana/kit'
import { getTransferInstruction } from '@solana-program/token';
import { ASSOCIATED_TOKEN_PROGRAM_ADDR, DEPOSIT_RECORD_SEED, MARKET_LIVE_ROLLBACK_SEED, BET_SEED, MARKET_SEED, PRODUCT_CONFIG_SEED, PROGRAM_ADDR, TOKEN_PROGRAM_ADDR, SELL_REQUEST_SEED, PARLAY_BET_SEED, FREEBET_SEED, ORACLE_ACCOUNT_SEED, CORE_CONFIG_SEED, PRODUCT_POOL_SEED, LP_TOKEN_MINT_SEED, PRODUCT_FEES_SEED, PRODUCT_FB_SEED, PRODUCT_LIST_SEED, LP_RECEIPT_SEED, WITHDRAW_RECORD_SEED } from './constants';
import { u16ToBuffer, u32ToBuffer, u64ToBuffer, base64ToUint8Array, stringToUint8Array, concatUint8Arrays, readBigUInt64LE } from './utils';
import { AccountNotFoundError, RpcError, ValidationTypeError } from './errors';
import { join } from 'path';
import { readFileSync } from 'fs';

const addressEncoder = getAddressEncoder();

/**
 * Generic function to get a Program Derived Address (PDA)
 * @param programAddress - The program address to derive from
 * @param seeds - Array of seed Uint8Arrays
 * @returns Tuple of [PDA address, bump]
 */
async function getPDA(
   programAddress: Address,
   seeds: Uint8Array[]
): Promise<[Address, ProgramDerivedAddressBump]> {
   const [pda, bump] = await getProgramDerivedAddress({
      programAddress,
      seeds,
   });
   return [pda, bump];
}

export async function getOraclePDA(productId: number, marketId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [ORACLE_ACCOUNT_SEED, u16ToBuffer(productId), u64ToBuffer(marketId)]);
}

// Market PDA: [market, product_id, market_id]
export async function getMarketPDA(productId: number, marketId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [MARKET_SEED, u16ToBuffer(productId), u64ToBuffer(marketId)]);
}

// Bet PDA: [bet, product_id, market_id, bet_id]
export async function getBetPDA(productId: number, marketId: bigint, betId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [BET_SEED, u16ToBuffer(productId), u64ToBuffer(marketId), u64ToBuffer(betId)]);
}

// Market Live Rollback PDA: [market_live_rollback, product_id, market_id]
export async function getMarketLiveRollbackPDA(productId: number, marketId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [MARKET_LIVE_ROLLBACK_SEED, u16ToBuffer(productId), u64ToBuffer(marketId)]);
}

// Sell Request PDA (single bet): [sell_request, product_id, market_id, bet_id]
export async function getSellRequestPDA(productId: number, marketId: bigint, betId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [SELL_REQUEST_SEED, u16ToBuffer(productId), u64ToBuffer(marketId), u64ToBuffer(betId)]);
}

// Parlay Sell Request PDA: [sell_request, product_id, bet_id]
export async function getParlaySellRequestPDA(productId: number, betId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [SELL_REQUEST_SEED, u16ToBuffer(productId), u64ToBuffer(betId)]);
}

// Parlay Bet PDA: [parlay_bet, product_id, bet_id]
export async function getParlayBetPDA(productId: number, betId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [PARLAY_BET_SEED, u16ToBuffer(productId), u64ToBuffer(betId)]);
}

// Freebet PDA: [freebet, product_id, freebet_id]
export async function getFreebetPDA(productId: number, freebetId: number): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [FREEBET_SEED, u16ToBuffer(productId), u32ToBuffer(freebetId)]);
}

// Core Config PDA: [program_config]
export async function getCoreConfigPDA(): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [CORE_CONFIG_SEED]);
}

// Product Config PDA: [product_config, product_id]
export async function getProductConfigPDA(productId: number): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [PRODUCT_CONFIG_SEED, u16ToBuffer(productId)]);
}

// Product Pool PDA: [product_pool, product_id]
export async function getProductPoolPDA(productId: number): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [PRODUCT_POOL_SEED, u16ToBuffer(productId)]);
}

// Product Fees PDA: [product_fees, product_id]
export async function getProductFeesPDA(productId: number): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [PRODUCT_FEES_SEED, u16ToBuffer(productId)]);
}

// Product Freebet PDA: [product_fb, product_id]
export async function getProductFreebetPDA(productId: number): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [PRODUCT_FB_SEED, u16ToBuffer(productId)]);
}

// Product List PDA: [product_list]
export async function getProductListPDA(): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [PRODUCT_LIST_SEED]);
}

// LP Token Mint PDA: [lp_token_mint, product_id]
export async function getLpTokenMintPDA(productId: number): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [LP_TOKEN_MINT_SEED, u16ToBuffer(productId)]);
}

// LP Receipt PDA: [lp_receipt, product_id, user_key]
export async function getLpReceiptPDA(productId: number, userKey: Address): Promise<[Address, ProgramDerivedAddressBump]> {
   const userKeyBytes = new Uint8Array(addressEncoder.encode(userKey));
   return await getPDA(PROGRAM_ADDR, [LP_RECEIPT_SEED, u16ToBuffer(productId), userKeyBytes]);
}

// Deposit Record PDA: [deposit_record, product_id, deposit_id]
export async function getDepositRecordPDA(productId: number, depositId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [DEPOSIT_RECORD_SEED, u16ToBuffer(productId), u64ToBuffer(depositId)]);
}

// Withdraw Record PDA: [withdraw_record, product_id, withdraw_id]
export async function getWithdrawRecordPDA(productId: number, withdrawId: bigint): Promise<[Address, ProgramDerivedAddressBump]> {
   return await getPDA(PROGRAM_ADDR, [WITHDRAW_RECORD_SEED, u16ToBuffer(productId), u64ToBuffer(withdrawId)]);
}

/**
 * Get a keypair from a file
 * @param file_name_or_path - the file name or path of the keypair
 * @returns the keypair
 */
export async function getKeypairFromJsonFile(file_name_or_path: string): Promise<TransactionSigner> {
   let keypairPath: string;
   if (file_name_or_path.includes('/')) {
      keypairPath = file_name_or_path;
   } else {
      keypairPath = join(process.cwd(), file_name_or_path);
   }
   const keypairBytes = new Uint8Array(JSON.parse(readFileSync(keypairPath, 'utf-8')));
   return await createKeyPairSignerFromBytes(keypairBytes);
}

/**
 * Get Associated Token Account (ATA) address for a given owner and token mint
 * @param owner - The owner of the ATA
 * @param tokenMint - The mint of the token
 * @param tokenProgram - The program address of the token program (defaults to TOKEN_PROGRAM_ADDR)
 * @param assocTokenProgram - The program address of the associated token program (defaults to ASSOCIATED_TOKEN_PROGRAM_ADDR)
 * @returns Tuple of [ATA address, bump]
 */
export async function getATA(
   owner: Address,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   assocTokenProgram: Address = ASSOCIATED_TOKEN_PROGRAM_ADDR
): Promise<readonly [Address, ProgramDerivedAddressBump]> {
   const ataAddrAndBump = await getProgramDerivedAddress({
      programAddress: assocTokenProgram,
      seeds: [
         addressEncoder.encode(owner),
         addressEncoder.encode(tokenProgram),
         addressEncoder.encode(tokenMint),
      ],
   });
   return ataAddrAndBump;
}

/**
 * Get the balance of an ATA
 * @param rpc - an Rpc instance
 * @param ata - the ATA address
 * @returns the balance of the ATA
 */
export async function getAtaBalance(
   rpc: Rpc<SolanaRpcApi>,
   ata: Address,
): Promise<bigint> {
   try {
      const accountResp = await rpc.getAccountInfo(ata, { encoding: 'base64' }).send();
      if (accountResp.value === null){
         throw new AccountNotFoundError(
            `Associated token account not found`,
            ata
         );
      };
      const data = base64ToUint8Array(accountResp.value.data[0]);
      // Token account layout: mint (32) + owner (32) + amount (8 bytes u64 little-endian at offset 64)
      const balance = readBigUInt64LE(data, 64);
      return balance;
   } catch (e) {
      // If it's already an AccountNotFoundError, re-throw it
      if (e instanceof AccountNotFoundError) {
         throw e;
      }
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new RpcError(
         `Failed to fetch ATA balance`,
         'getAtaBalance',
         cause
      );
   }
}


export async function buildSendTokenToNonAtaInstruction(
   authority: Address,
   source: Address,
   destination: Address,
   amount: bigint,
): Promise<Instruction> {
   return getTransferInstruction({
      source,
      destination,
      amount,
      authority,
   });
}


/**
 * Convert a value to a Base64EncodedBytes branded string
 * @param value - the value to convert (Uint8Array, ReadonlyUint8Array, string, or array)
 * @returns the Base64EncodedBytes branded string
 */
export function toBase64EncodedBytes(value: Uint8Array | { readonly [n: number]: number; readonly length: number } | string | number[]): Base64EncodedBytes {
   let bytes: Uint8Array;
   if (value instanceof Uint8Array) {
      bytes = value;
   } else if (value && typeof value === 'object' && 'length' in value && (typeof (value as any)[0] === 'number' || Array.isArray(value))) {
      // Handle ReadonlyUint8Array or similar array-like objects
      bytes = new Uint8Array(value as ArrayLike<number>);
   } else if (typeof value === 'string') {
      bytes = stringToUint8Array(value);
   } else if (Array.isArray(value)) {
      bytes = new Uint8Array(value);
   } else {
      throw new ValidationTypeError(
         'Invalid value type for toBase64EncodedBytes',
         'value',
         value,
         'Uint8Array | ReadonlyUint8Array | string | number[]'
      );
   }
   // Convert Uint8Array to base64
   const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
   return btoa(binaryString) as Base64EncodedBytes;
}

/**
 * Represents a filter field with its offset, size, and buffer data
 */
export interface FilterField {
   offset: number;
   size: number;
   buffer: Uint8Array;
}

/**
 * Builds optimized getProgramAccounts filters by combining consecutive fields into single filters.
 * This reduces the number of filters used (max 4 allowed) and improves query efficiency.
 * 
 * @param fields - Array of filter fields with offset, size, and buffer data
 * @returns Array of optimized GetProgramAccountsMemcmpFilter filters
 * 
 * @example
 * ```typescript
 * const fields: FilterField[] = [
 *    { offset: 0, size: 1, buffer: u8ToBuffer(3) },      // account_type
 *    { offset: 1, size: 1, buffer: u8ToBuffer(1) },      // market_type
 *    { offset: 2, size: 2, buffer: u16ToBuffer(5) },     // product_id
 *    { offset: 12, size: 1, buffer: u8ToBuffer(2) },     // sport
 * ];
 * const filters = buildOptimizedFilters(fields);
 * // Returns 2 filters: one at offset 0 (4 bytes) and one at offset 12 (1 byte)
 * ```
 */
export function buildOptimizedFilters(fields: FilterField[]): GetProgramAccountsMemcmpFilter[] {
   if (fields.length === 0) {
      return [];
   }
   
   // Sort fields by offset to identify consecutive ones
   const sortedFields = [...fields].sort((a, b) => a.offset - b.offset);
   
   // Combine consecutive fields
   const filters: GetProgramAccountsMemcmpFilter[] = [];
   let currentGroup: FilterField[] = [];
   let currentOffset = -1;
   
   for (const field of sortedFields) {
      if (currentGroup.length === 0) {
         // Start a new group
         currentGroup = [field];
         currentOffset = field.offset;
      } else {
         const expectedOffset = currentOffset + currentGroup[currentGroup.length - 1]!.size;
         if (field.offset === expectedOffset) {
            // Consecutive field - add to current group
            currentGroup.push(field);
         } else {
            // Non-consecutive - finalize current group and start new one
            const combinedBuffer = concatUint8Arrays(currentGroup.map(f => f.buffer));
            filters.push({
               memcmp: {
                  offset: BigInt(currentOffset),
                  bytes: toBase64EncodedBytes(combinedBuffer),
                  encoding: 'base64',
               },
            });
            currentGroup = [field];
            currentOffset = field.offset;
         }
      }
   }
   
   // Finalize the last group
   if (currentGroup.length > 0) {
      const combinedBuffer = concatUint8Arrays(currentGroup.map(f => f.buffer));
      filters.push({
         memcmp: {
            offset: BigInt(currentOffset),
            bytes: toBase64EncodedBytes(combinedBuffer),
            encoding: 'base64',
         },
      });
   }
   
   return filters;
}