import {Address, Instruction, AccountRole, AccountMeta} from '@solana/kit'
import { getActionsEncoder } from '../codex'
import { PROGRAM_ADDR, TOKEN_PROGRAM_ADDR, ASSOCIATED_TOKEN_PROGRAM_ADDR, SYSTEM_PROGRAM_ADDR, CORE_CONFIG_ADDR, DEFAULT_ADDRESS } from '../constants';
import { getATA, getProductFeesPDA, getMarketPDA, getFreebetPDA, getBetPDA, getOraclePDA, getSellRequestPDA, getProductFreebetPDA, getProductConfigPDA, getParlayBetPDA, getParlaySellRequestPDA, getProductPoolPDA, getMarketLiveRollbackPDA } from '../solana_utils';
import { BuyInstruction, SellInstruction, BuyWithFreebetInstruction, SellWithFreebetInstruction, ParlayBetInstruction, SellParlayInstruction } from '../types';
import { validateUint8, validateUint16, validateUint32, validateUint64 } from '../validation';

const actionsEncoder = getActionsEncoder();

// Type guards for instruction data validation
function isValidBuyInstruction(data: unknown): data is BuyInstruction {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return (
      typeof d.product_id === 'number' &&
      typeof d.market_id === 'bigint' &&
      typeof d.bet_id === 'bigint' &&
      typeof d.outcome_index === 'number' &&
      typeof d.amount === 'bigint' &&
      typeof d.min_return === 'bigint' &&
      d.frontend_bytes instanceof Uint8Array
   );
}

function isValidSellInstruction(data: unknown): data is SellInstruction {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return (
      typeof d.product_id === 'number' &&
      typeof d.market_id === 'bigint' &&
      typeof d.bet_id === 'bigint' &&
      typeof d.outcome_index === 'number' &&
      typeof d.amount === 'bigint' &&
      typeof d.min_return === 'bigint'
   );
}

function isValidBuyWithFreebetInstruction(data: unknown): data is BuyWithFreebetInstruction {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return (
      typeof d.product_id === 'number' &&
      typeof d.market_id === 'bigint' &&
      typeof d.bet_id === 'bigint' &&
      typeof d.outcome_index === 'number' &&
      typeof d.amount === 'bigint' &&
      typeof d.min_return === 'bigint' &&
      typeof d.freebet_id === 'number' &&
      d.frontend_bytes instanceof Uint8Array
   );
}

function isValidSellWithFreebetInstruction(data: unknown): data is SellWithFreebetInstruction {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return (
      typeof d.product_id === 'number' &&
      typeof d.market_id === 'bigint' &&
      typeof d.bet_id === 'bigint' &&
      typeof d.outcome_index === 'number' &&
      typeof d.amount === 'bigint' &&
      typeof d.min_return === 'bigint' &&
      typeof d.freebet_id === 'number'
   );
}

function isValidParlayBetInstruction(data: unknown): data is ParlayBetInstruction {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return (
      typeof d.product_id === 'number' &&
      typeof d.bet_id === 'bigint' &&
      typeof d.amount === 'bigint' &&
      typeof d.min_return === 'bigint' &&
      typeof d.freebet_id === 'number' &&
      d.frontend_bytes instanceof Uint8Array &&
      Array.isArray(d.selections) &&
      d.selections.every((s: unknown) => 
         Array.isArray(s) && s.length === 2 && 
         typeof s[0] === 'bigint' && typeof s[1] === 'number'
      )
   );
}

function isValidSellParlayInstruction(data: unknown): data is SellParlayInstruction {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return (
      typeof d.product_id === 'number' &&
      typeof d.bet_id === 'bigint' &&
      typeof d.amount === 'bigint' &&
      typeof d.min_return === 'bigint'
   );
}

function validateBuyInstruction(data: BuyInstruction): void {
   if (!isValidBuyInstruction(data)) {
      throw new Error('Invalid BuyInstruction: missing or incorrect type for required fields');
   }
   validateUint16(data.product_id);
   validateUint64(data.market_id);
   validateUint64(data.bet_id);
   validateUint8(data.outcome_index);
   if (data.outcome_index < 1) {
      throw new Error('Outcome index must be >= 1 (outcomes are 1-indexed)');
   }
   validateUint64(data.amount);
   validateUint64(data.min_return);
}

function validateSellInstruction(data: SellInstruction): void {
   if (!isValidSellInstruction(data)) {
      throw new Error('Invalid SellInstruction: missing or incorrect type for required fields');
   }
   validateUint16(data.product_id);
   validateUint64(data.market_id);
   validateUint64(data.bet_id);
   validateUint8(data.outcome_index);
   if (data.outcome_index < 1) {
      throw new Error('Outcome index must be >= 1 (outcomes are 1-indexed)');
   }
   validateUint64(data.amount);
   validateUint64(data.min_return);
}

function validateBuyWithFreebetInstruction(data: BuyWithFreebetInstruction): void {
   if (!isValidBuyWithFreebetInstruction(data)) {
      throw new Error('Invalid BuyWithFreebetInstruction: missing or incorrect type for required fields');
   }
   validateUint16(data.product_id);
   validateUint64(data.market_id);
   validateUint64(data.bet_id);
   validateUint8(data.outcome_index);
   if (data.outcome_index < 1) {
      throw new Error('Outcome index must be >= 1 (outcomes are 1-indexed)');
   }
   validateUint64(data.amount);
   validateUint64(data.min_return);
   validateUint32(data.freebet_id);
}

function validateSellWithFreebetInstruction(data: SellWithFreebetInstruction): void {
   if (!isValidSellWithFreebetInstruction(data)) {
      throw new Error('Invalid SellWithFreebetInstruction: missing or incorrect type for required fields');
   }
   validateUint16(data.product_id);
   validateUint64(data.market_id);
   validateUint64(data.bet_id);
   validateUint8(data.outcome_index);
   if (data.outcome_index < 1) {
      throw new Error('Outcome index must be >= 1 (outcomes are 1-indexed)');
   }
   validateUint64(data.amount);
   validateUint64(data.min_return);
   validateUint32(data.freebet_id);
}

function validateParlayBetInstruction(data: ParlayBetInstruction): void {
   if (!isValidParlayBetInstruction(data)) {
      throw new Error('Invalid ParlayBetInstruction: missing or incorrect type for required fields');
   }
   validateUint16(data.product_id);
   validateUint64(data.bet_id);
   validateUint64(data.amount);
   validateUint64(data.min_return);
   validateUint32(data.freebet_id);
   data.selections.forEach((sel, i) => {
      validateUint64(sel[0]);
      validateUint8(sel[1]);
      if (sel[1] < 1) {
         throw new Error(`Selection ${i}: outcome index must be >= 1 (outcomes are 1-indexed)`);
      }
   });
}

function validateSellParlayInstruction(data: SellParlayInstruction): void {
   if (!isValidSellParlayInstruction(data)) {
      throw new Error('Invalid SellParlayInstruction: missing or incorrect type for required fields');
   }
   validateUint16(data.product_id);
   validateUint64(data.bet_id);
   validateUint64(data.amount);
   validateUint64(data.min_return);
}

/**
 * Build BuyFor instruction. Account order: fee_payer (tx signer), owner, then rest.
 * @param feePayer - The fee payer (tx signer)
 * @param owner - The owner of the bet (signer)
 * @param buyData - The buy instruction data
 * @param tokenMint - The product token mint address
 * @param needsOracle - Whether an oracle account is needed
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildBuyForInstruction(
   feePayer: Address,
   owner: Address,
   buyData: BuyInstruction,
   tokenMint: Address,
   needsOracle: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateBuyInstruction(buyData);
   const [marketPda] = await getMarketPDA(buyData.product_id, buyData.market_id);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(buyData.product_id, buyData.market_id, buyData.bet_id);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(buyData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (needsOracle) {
      const [oraclePda] = await getOraclePDA(buyData.product_id, buyData.market_id);
      accounts.push({ address: oraclePda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'BuyFor',
         value: buyData,
      })),
   };
}

/**
 * Build BuyAgainst instruction. Account order: fee_payer (tx signer), owner, then rest.
 * @param feePayer - The fee payer (tx signer)
 * @param owner - The owner of the bet (signer)
 * @param buyData - The buy instruction data
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildBuyAgainstInstruction(
   feePayer: Address,
   owner: Address,
   buyData: BuyInstruction,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateBuyInstruction(buyData);
   const [marketPda] = await getMarketPDA(buyData.product_id, buyData.market_id);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(buyData.product_id, buyData.market_id, buyData.bet_id);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(buyData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'BuyAgainst',
         value: buyData,
      })),
   };
}

/**
 * Build SellFor instruction. Account order: fee_payer (tx signer), account_fee_payer (recipient on close), owner, then rest.
 * @param feePayer - The fee payer (tx signer)
 * @param accountFeePayer - Recipient of closed account rent (required for close)
 * @param owner - The owner of the bet (signer)
 * @param sellData - The sell instruction data
 * @param tokenMint - The product token mint address
 * @param needsOracle - Whether an oracle account is needed
 * @param isLive - Whether this is a live market sell
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildSellForInstruction(
   feePayer: Address,
   accountFeePayer: Address,
   owner: Address,
   sellData: SellInstruction,
   tokenMint: Address,
   needsOracle: boolean,
   isLive: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateSellInstruction(sellData);
   const [marketPda] = await getMarketPDA(sellData.product_id, sellData.market_id);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(sellData.product_id, sellData.market_id, sellData.bet_id);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(sellData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: accountFeePayer, role: AccountRole.READONLY },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (isLive) {
      const [sellRequestPda] = await getSellRequestPDA(sellData.product_id, sellData.market_id, sellData.bet_id);
      accounts.push({ address: sellRequestPda, role: AccountRole.WRITABLE });
   }
   if (needsOracle) {
      const [oraclePda] = await getOraclePDA(sellData.product_id, sellData.market_id);
      accounts.push({ address: oraclePda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SellFor',
         value: sellData,
      })),
   };
}

/**
 * Build SellAgainst instruction. Account order: fee_payer (tx signer), account_fee_payer (recipient on close), owner, then rest.
 * @param feePayer - The fee payer (tx signer)
 * @param accountFeePayer - Recipient of closed account rent (required for close)
 * @param owner - The owner of the bet (signer)
 * @param sellData - The sell instruction data
 * @param tokenMint - The product token mint address
 * @param needsOracle - Whether an oracle account is needed
 * @param isLive - Whether this is a live market sell
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildSellAgainstInstruction(
   feePayer: Address,
   accountFeePayer: Address,
   owner: Address,
   sellData: SellInstruction,
   tokenMint: Address,
   needsOracle: boolean,
   isLive: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateSellInstruction(sellData);
   const [marketPda] = await getMarketPDA(sellData.product_id, sellData.market_id);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(sellData.product_id, sellData.market_id, sellData.bet_id);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(sellData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: accountFeePayer, role: AccountRole.READONLY },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (isLive) {
      const [sellRequestPda] = await getSellRequestPDA(sellData.product_id, sellData.market_id, sellData.bet_id);
      accounts.push({ address: sellRequestPda, role: AccountRole.WRITABLE });
   }
   if (needsOracle) {
      const [oraclePda] = await getOraclePDA(sellData.product_id, sellData.market_id);
      accounts.push({ address: oraclePda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SellAgainst',
         value: sellData,
      })),
   };
}

/**
 * Build HandleSellRequest instruction. Account order: fee_payer (tx signer), account_fee_payer (recipient on close), signer, owner, then rest.
 * @param feePayer - The fee payer (tx signer)
 * @param accountFeePayer - Recipient of closed account rent
 * @param signer - The signer key (signer)
 * @param owner - The owner of the bet
 * @param betId - The bet id (u64)
 * @param marketId - The market id (u64)
 * @param productId - The product id (u16)
 * @param tokenMint - The product token mint address
 * @param needsRollbackAccount - Whether a rollback account is needed
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildHandleSellRequestInstruction(
   feePayer: Address,
   accountFeePayer: Address,
   signer: Address,
   owner: Address,
   betId: bigint,
   marketId: bigint,
   productId: number,
   tokenMint: Address,
   needsRollbackAccount: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   const [marketPda] = await getMarketPDA(productId, marketId);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(productId, marketId, betId);
   const [sellRequestPda] = await getSellRequestPDA(productId, marketId, betId);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productFeesPda] = await getProductFeesPDA(productId);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const rollbackPda = needsRollbackAccount 
      ? (await getMarketLiveRollbackPDA(productId, marketId))[0]
      : DEFAULT_ADDRESS;
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: accountFeePayer, role: AccountRole.READONLY },
      { address: signer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.READONLY },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: sellRequestPda, role: AccountRole.WRITABLE },
      { address: rollbackPda, role: AccountRole.READONLY },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
   ];
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'HandleSellRequest',
      })),
   };
}

/**
 * Build ClaimPosition instruction. Account order: fee_payer (tx signer), account_fee_payer (recipient on close), owner, then rest.
 * @param feePayer - Fee payer (tx signer)
 * @param accountFeePayer - Recipient of closed account rent
 * @param owner - The owner of the bet
 * @param betId - The bet id (u64)
 * @param marketId - The market id (u64)
 * @param productId - The product id (u16)
 * @param tokenMint - The product token mint address
 * @param needsRollbackAccount - Whether a rollback account is needed (defaults to false)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildClaimPositionInstruction(
   feePayer: Address,
   accountFeePayer: Address,
   owner: Address,
   betId: bigint,
   marketId: bigint,
   productId: number,
   tokenMint: Address,
   needsRollbackAccount: boolean = false,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   const [marketPda] = await getMarketPDA(productId, marketId);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(productId, marketId, betId);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productFeesPda] = await getProductFeesPDA(productId);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const rollbackPda = needsRollbackAccount 
      ? (await getMarketLiveRollbackPDA(productId, marketId))[0]
      : DEFAULT_ADDRESS;
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: rollbackPda, role: AccountRole.READONLY },
   ];
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'ClaimPosition',
      })),
   };
}

/**
 * Build BuyForWithFreebet instruction - for betting for an outcome using a freebet.
 * @param feePayer - Fee payer (tx signer)
 * @param owner - The owner key (signer)
 * @param buyData - The buy instruction data with freebet info
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildBuyForWithFreebetInstruction(
   feePayer: Address,
   owner: Address,
   buyData: BuyWithFreebetInstruction,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   const [marketPda] = await getMarketPDA(buyData.product_id, buyData.market_id);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(buyData.product_id, buyData.market_id, buyData.bet_id);
   const [freebetPda] = await getFreebetPDA(buyData.product_id, buyData.freebet_id);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(buyData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: freebetPda, role: AccountRole.WRITABLE },
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'BuyForWithFreebet',
         value: buyData,
      })),
   };
}

/**
 * Build BuyAgainstWithFreebet instruction - for betting against an outcome using a freebet.
 * @param feePayer - Fee payer (tx signer)
 * @param owner - The owner key (signer)
 * @param buyData - The buy instruction data with freebet info
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildBuyAgainstWithFreebetInstruction(
   feePayer: Address,
   owner: Address,
   buyData: BuyWithFreebetInstruction,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateBuyWithFreebetInstruction(buyData);
   const [marketPda] = await getMarketPDA(buyData.product_id, buyData.market_id);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(buyData.product_id, buyData.market_id, buyData.bet_id);
   const [freebetPda] = await getFreebetPDA(buyData.product_id, buyData.freebet_id);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(buyData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: freebetPda, role: AccountRole.WRITABLE },
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'BuyAgainstWithFreebet',
         value: buyData,
      })),
   };
}

/**
 * Build SellForWithFreebet instruction - for selling a bet for an outcome that was placed with a freebet.
 * @param feePayer - Fee payer (tx signer)
 * @param accountFeePayer - Recipient of closed account rent
 * @param owner - The owner key (signer)
 * @param sellData - The sell instruction data with freebet info
 * @param tokenMint - The product token mint address
 * @param needsOracle - Whether an oracle account is needed
 * @param isLive - Whether this is a live market sell
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildSellForWithFreebetInstruction(
   feePayer: Address,
   accountFeePayer: Address,
   owner: Address,
   sellData: SellWithFreebetInstruction,
   tokenMint: Address,
   needsOracle: boolean,
   isLive: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateSellWithFreebetInstruction(sellData);
   const [marketPda] = await getMarketPDA(sellData.product_id, sellData.market_id);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(sellData.product_id, sellData.market_id, sellData.bet_id);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(sellData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (isLive) {
      const [sellRequestPda] = await getSellRequestPDA(sellData.product_id, sellData.market_id, sellData.bet_id);
      accounts.push({ address: sellRequestPda, role: AccountRole.WRITABLE });
   }
   if (needsOracle) {
      const [oraclePda] = await getOraclePDA(sellData.product_id, sellData.market_id);
      accounts.push({ address: oraclePda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SellForWithFreebet',
         value: sellData,
      })),
   };
}

/**
 * Build SellAgainstWithFreebet instruction - for selling a bet against an outcome that was placed with a freebet.
 * @param feePayer - Fee payer (tx signer)
 * @param accountFeePayer - Recipient of closed account rent
 * @param owner - The owner key (signer)
 * @param sellData - The sell instruction data with freebet info
 * @param tokenMint - The product token mint address
 * @param needsOracle - Whether an oracle account is needed
 * @param isLive - Whether this is a live market sell
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildSellAgainstWithFreebetInstruction(
   feePayer: Address,
   accountFeePayer: Address,
   owner: Address,
   sellData: SellWithFreebetInstruction,
   tokenMint: Address,
   needsOracle: boolean,
   isLive: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateSellWithFreebetInstruction(sellData);
   const [marketPda] = await getMarketPDA(sellData.product_id, sellData.market_id);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(sellData.product_id, sellData.market_id, sellData.bet_id);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(sellData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (isLive) {
      const [sellRequestPda] = await getSellRequestPDA(sellData.product_id, sellData.market_id, sellData.bet_id);
      accounts.push({ address: sellRequestPda, role: AccountRole.WRITABLE });
   }
   if (needsOracle) {
      const [oraclePda] = await getOraclePDA(sellData.product_id, sellData.market_id);
      accounts.push({ address: oraclePda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SellAgainstWithFreebet',
         value: sellData,
      })),
   };
}

/**
 * Build ClaimPositionWithFreebet instruction - for claiming a winning bet position that was placed with a freebet.
 * @param feePayer - Fee payer (tx signer)
 * @param accountFeePayer - Recipient of closed account rent
 * @param owner - The owner of the bet
 * @param betId - The bet id (u64)
 * @param freebetId - The freebet id (u32)
 * @param marketId - The market id (u64)
 * @param productId - The product id (u16)
 * @param tokenMint - The product token mint address
 * @param productAdmin - The product admin key
 * @param needsRollbackAccount - Whether a rollback account is needed (defaults to false)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildClaimPositionWithFreebetInstruction(
   feePayer: Address,
   accountFeePayer: Address,
   owner: Address,
   betId: bigint,
   freebetId: number,
   marketId: bigint,
   productId: number,
   tokenMint: Address,
   productAdmin: Address,
   needsRollbackAccount: boolean = false,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   const [freebetPda] = await getFreebetPDA(productId, freebetId);
   const [marketPda] = await getMarketPDA(productId, marketId);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [betPda] = await getBetPDA(productId, marketId, betId);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productFreebetPda] = await getProductFreebetPDA(productId);
   const [productFreebetAta] = await getATA(productFreebetPda, tokenMint, tokenProgram);
   const rollbackPda = needsRollbackAccount 
      ? (await getMarketLiveRollbackPDA(productId, marketId))[0]
      : DEFAULT_ADDRESS;
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: freebetPda, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: productFreebetAta, role: AccountRole.WRITABLE },
      { address: rollbackPda, role: AccountRole.READONLY },
      { address: productAdmin, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
   ];
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'ClaimPositionWithFreebet',
      })),
   };
}

/**
 * Build BuyParlay instruction - for placing a parlay bet across multiple markets.
 * @param feePayer - Fee payer (tx signer)
 * @param owner - The owner key (signer)
 * @param parlayData - The parlay bet instruction data
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildBuyParlayInstruction(
   feePayer: Address,
   owner: Address,
   parlayData: ParlayBetInstruction,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateParlayBetInstruction(parlayData);
   const [parlayBetPda] = await getParlayBetPDA(parlayData.product_id, parlayData.bet_id);
   const [parlayAta] = await getATA(parlayBetPda, tokenMint, tokenProgram);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productFeesPda] = await getProductFeesPDA(parlayData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: parlayBetPda, role: AccountRole.WRITABLE },
      { address: parlayAta, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (parlayData.freebet_id !== 0) {
      const [freebetPda] = await getFreebetPDA(parlayData.product_id, parlayData.freebet_id);
      accounts.push({ address: freebetPda, role: AccountRole.WRITABLE });
   }
   for (const [marketId, _outcomeIndex] of parlayData.selections) {
      const [marketPda] = await getMarketPDA(parlayData.product_id, marketId);
      const [oraclePda] = await getOraclePDA(parlayData.product_id, marketId);
      accounts.push({ address: marketPda, role: AccountRole.WRITABLE });
      accounts.push({ address: oraclePda, role: AccountRole.READONLY });
   }
   console.log(accounts.map(a => a.address));
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'BuyParlay',
         value: parlayData,
      })),
   };
}

/**
 * Build SellParlay instruction - for selling a parlay bet.
 * @param feePayer - Fee payer (tx signer)
 * @param accountFeePayer - Recipient of closed account rent
 * @param owner - The owner key (signer)
 * @param sellData - The sell parlay instruction data
 * @param tokenMint - The product token mint address
 * @param isLive - Whether this is a live market sell
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param marketIds - The market ids for the parlay
 * @returns The instruction
 */
export async function buildSellParlayInstruction(
   feePayer: Address,
   accountFeePayer: Address,
   owner: Address,
   sellData: SellParlayInstruction,
   tokenMint: Address,
   isLive: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   marketIds: bigint[],
): Promise<Instruction> {
   validateSellParlayInstruction(sellData);
   const [parlayBetPda] = await getParlayBetPDA(sellData.product_id, sellData.bet_id);
   const [parlayAta] = await getATA(parlayBetPda, tokenMint, tokenProgram);
   const [userAta] = await getATA(owner, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(sellData.product_id);
   const [productFeesPda] = await getProductFeesPDA(sellData.product_id);
   const [productPoolPda] = await getProductPoolPDA(sellData.product_id);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: parlayBetPda, role: AccountRole.WRITABLE },
      { address: parlayAta, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: productPoolPda, role: AccountRole.WRITABLE },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (isLive) {
      const [parlaySellRequestPda] = await getParlaySellRequestPDA(sellData.product_id, sellData.bet_id);
      accounts.push({ address: parlaySellRequestPda, role: AccountRole.WRITABLE });
   }
   for (const marketId of marketIds) {
      const [marketPda] = await getMarketPDA(sellData.product_id, marketId);
      const [oraclePda] = await getOraclePDA(sellData.product_id, marketId);
      accounts.push({ address: marketPda, role: AccountRole.WRITABLE });
      accounts.push({ address: oraclePda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SellParlay',
         value: sellData,
      })),
   };
}

/**
 * Build ClaimParlayPosition instruction - for claiming a winning parlay bet position
 * @param signer - The signer key (signer)
 * @param user - The user key (owner of bet)
 * @param betId - The bet id (u64)
 * @param productId - The product id (u16)
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param marketsIdsAndNeedsRollbackAccount - Array of [market_id (u64), needs_rollback_account] tuples
 * @returns The instruction
 */
export async function buildClaimParlayPositionInstruction(
   signer: Address,
   user: Address,
   betId: bigint,
   productId: number,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   marketsIdsAndNeedsRollbackAccount: [bigint, boolean][],
): Promise<Instruction> {
   const [parlayBetPda] = await getParlayBetPDA(productId, betId);
   const [parlayAta] = await getATA(parlayBetPda, tokenMint, tokenProgram);
   const [userAta] = await getATA(user, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productFeesPda] = await getProductFeesPDA(productId);
   const [productPoolPda] = await getProductPoolPDA(productId);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: signer, role: AccountRole.WRITABLE_SIGNER },
      { address: user, role: AccountRole.WRITABLE },
      { address: parlayBetPda, role: AccountRole.WRITABLE },
      { address: parlayAta, role: AccountRole.WRITABLE },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: productPoolPda, role: AccountRole.WRITABLE },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
   ];
   for (const [marketId, needsRollback] of marketsIdsAndNeedsRollbackAccount) {
      const [marketPda] = await getMarketPDA(productId, marketId);
      const rollbackPda = needsRollback 
         ? (await getMarketLiveRollbackPDA(productId, marketId))[0]
         : DEFAULT_ADDRESS;
      accounts.push({ address: marketPda, role: AccountRole.WRITABLE });
      accounts.push({ address: rollbackPda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'ClaimParlayPosition',
      })),
   };
}

/**
 * Build HandleSellParlayRequest instruction - for handling a parlay sell request (typically called by oracle or authorized signer)
 * @param signer - The signer key (signer)
 * @param user - The user key who owns the bet
 * @param betId - The bet id (u64)
 * @param productId - The product id (u16)
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param marketsIdsAndNeedsRollbackAccount - Array of [market_id (u64), needs_rollback_account] tuples
 * @returns The instruction
 */
export async function buildHandleSellParlayRequestInstruction(
   signer: Address,
   user: Address,
   betId: bigint,
   productId: number,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   marketsIdsAndNeedsRollbackAccount: [bigint, boolean][],
): Promise<Instruction> {
   const [parlayBetPda] = await getParlayBetPDA(productId, betId);
   const [parlayAta] = await getATA(parlayBetPda, tokenMint, tokenProgram);
   const [parlaySellRequestPda] = await getParlaySellRequestPDA(productId, betId);
   const [userAta] = await getATA(user, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productFeesPda] = await getProductFeesPDA(productId);
   const [productPoolPda] = await getProductPoolPDA(productId);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: signer, role: AccountRole.WRITABLE_SIGNER },
      { address: user, role: AccountRole.READONLY },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: parlayBetPda, role: AccountRole.WRITABLE },
      { address: parlayAta, role: AccountRole.WRITABLE },
      { address: parlaySellRequestPda, role: AccountRole.WRITABLE },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: productPoolPda, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
   ];
   for (const [marketId, needsRollback] of marketsIdsAndNeedsRollbackAccount) {
      const [marketPda] = await getMarketPDA(productId, marketId);
      const rollbackPda = needsRollback 
         ? (await getMarketLiveRollbackPDA(productId, marketId))[0]
         : DEFAULT_ADDRESS;
      accounts.push({ address: marketPda, role: AccountRole.WRITABLE });
      accounts.push({ address: rollbackPda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'HandleSellParlayRequest',
      })),
   };
}

