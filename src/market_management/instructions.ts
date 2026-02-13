import { Address, Instruction, AccountMeta, AccountRole } from "@solana/kit";
import { PROGRAM_ADDR, TOKEN_PROGRAM_ADDR, ASSOCIATED_TOKEN_PROGRAM_ADDR, CORE_CONFIG_ADDR, SYSTEM_PROGRAM_ADDR, DEFAULT_ADDRESS } from "../constants";
import { getProductConfigPDA, getProductPoolPDA, getMarketPDA, getATA, getBetPDA, getMarketLiveRollbackPDA, getOraclePDA, getProductFeesPDA } from "../solana_utils";
import { CreateMarketInstruction, MarketStatus, ResolveMarketInstruction } from "../types";
import { getActionsEncoder } from "../codex";
import { validateUint8, validateUint16, validateUint32, validateUint64, validateInt64, validateUint8Array } from "../validation";

const actionsEncoder = getActionsEncoder();

// Type guards for instruction data validation
function isValidMarketStatus(data: unknown): data is MarketStatus {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return d.__kind === 'Prematch' || d.__kind === 'Live' || d.__kind === 'Paused' || 
          d.__kind === 'PendingResolution' || d.__kind === 'PendingFullfillment';
}

function isValidResolveMarketInstruction(data: unknown): data is ResolveMarketInstruction {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return (
      typeof d.rollback_timestamp === 'number' &&
      (d.outcome_index === null || typeof d.outcome_index === 'number') &&
      (d.payout_adjustment === null || typeof d.payout_adjustment === 'bigint')
   );
}

function validateMarketStatus(data: MarketStatus): void {
   if (!isValidMarketStatus(data)) {
      throw new Error('Invalid MarketStatus: missing or incorrect __kind field');
   }
}

function validateResolveMarketInstruction(data: ResolveMarketInstruction): void {
   if (!isValidResolveMarketInstruction(data)) {
      throw new Error('Invalid ResolveMarketInstruction: missing or incorrect type for required fields');
   }
   validateUint32(data.rollback_timestamp);
   if (data.outcome_index !== null) {
      validateUint8(data.outcome_index);
   }
   if (data.payout_adjustment !== null) {
      validateInt64(data.payout_adjustment);
   }
}

/**
 * Build AddFundsToMarketAta instruction - for adding additional funds to a market ATA if needed due to miscalculation during settlement
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id (u16)
 * @param amount - The amount to add (u64) in scaled units (e.g. 100_000_000 for 100 USDC)
 * @param marketId - The market id (u64)
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildAddFundsToMarketAtaInstruction(
   productAdmin: Address,
   productId: number,
   amount: bigint,
   marketId: bigint,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(amount);
   validateUint64(marketId);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productPoolAccount] = await getProductPoolPDA(productId);
   const [marketPda] = await getMarketPDA(productId, marketId);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.READONLY },
         { address: productPoolAccount, role: AccountRole.WRITABLE },
         { address: marketPda, role: AccountRole.READONLY },
         { address: marketAta, role: AccountRole.WRITABLE },
         { address: tokenMint, role: AccountRole.READONLY },
         { address: tokenProgram, role: AccountRole.READONLY },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'AddFundsToMarketAta',
         value: {
            product_id: productId,
            amount,
         },
      })),
   };
}

/**
 * Build CreateMarket instruction - for creating a new market
 * @param productAdmin - The product admin key (signer)
 * @param marketData - The market data instruction
 * @param productId - The product id (u16)
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param oracleUpdater - The oracle updater address (required if creating an oracle account)
 * @param createOracle - Whether to create an oracle account (defaults to false)
 * @returns The instruction
 */
export async function buildCreateMarketInstruction(
   productAdmin: Address,
   marketData: CreateMarketInstruction,
   productId: number,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   oracleUpdater?: Address,
   createOracle: boolean = false,
): Promise<Instruction> {
   const [productConfigPda] = await getProductConfigPDA(productId);
   const marketId = marketData.value.base.market_identifier.market_id;
   const [marketPda] = await getMarketPDA(productId, marketId);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   const isControlled = marketData.__kind === 'DirectControlled' || marketData.__kind === 'AdvControlled';
   const hasGoLiveTime = 
      (marketData.__kind === 'DirectControlled' && marketData.value.go_live_time > 0) ||
      (marketData.__kind === 'AdvControlled' && marketData.value.go_live_time > 0);
   
   if (hasGoLiveTime) {
      const [marketLiveRollbackPda] = await getMarketLiveRollbackPDA(productId, marketId);
      accounts.push({ address: marketLiveRollbackPda, role: AccountRole.WRITABLE });
   }
   if (createOracle || isControlled) {
      const [oraclePda] = await getOraclePDA(productId, marketId);
      if (!oracleUpdater) {
         throw new Error('Oracle updater is required when creating an oracle account');
      }
      // Set resolution_authority to Oracle with oracle PDA
      marketData.value.base.resolution_authority = { method: { __kind: 'Oracle' }, account: oraclePda };
      accounts.push(
         { address: oraclePda, role: AccountRole.WRITABLE },
         { address: oracleUpdater, role: AccountRole.READONLY },
      );
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'CreateMarket',
         value: marketData,
      })),
   };
}

/**
 * Build UpdateMarketStatus instruction - for updating the status of a market
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id (u16)
 * @param marketId - The market id (u64)
 * @param status - The new market status
 * @returns The instruction
 */
export async function buildUpdateMarketStatusInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   status: MarketStatus,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(marketId);
   validateMarketStatus(status);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [marketPda] = await getMarketPDA(productId, marketId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.READONLY },
         { address: marketPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'UpdateMarketStatus',
         value: status,
      })),
   };
}

/**
 * Build ResolveMarket instruction - for resolving a market with the winning outcome
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id (u16)
 * @param marketId - The market id (u64)
 * @param tokenMint - The product token mint address
 * @param resolveData - The resolution data (Manual: outcome_index required; Oracle: outcome_index null, winning_outcome read from oracle)
 * @param oraclePda - The oracle PDA (required when resolution_authority.method === Oracle; omit for Manual)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildResolveMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   tokenMint: Address,
   resolveData: ResolveMarketInstruction,
   oraclePda?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(marketId);
   validateResolveMarketInstruction(resolveData);
   const [marketPda] = await getMarketPDA(productId, marketId);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productPoolPda] = await getProductPoolPDA(productId);
   const [productFeesPda] = await getProductFeesPDA(productId);
   const accounts: AccountMeta[] = [
      { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: productPoolPda, role: AccountRole.WRITABLE },
      { address: productFeesPda, role: AccountRole.WRITABLE },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (oraclePda) {
      accounts.push({ address: oraclePda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'ResolveMarket',
         value: resolveData,
      })),
   };
}

/**
 * Build CloseMarket instruction - for closing a market
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id (u16)
 * @param marketId - The market id (u64)
 * @param tokenMint - The product token mint address
 * @param hasOracleAccount - When true (resolution_authority.method === Oracle), pass oracle PDA to close; when false (Manual), oracle slot uses default pubkey
 * @returns The instruction
 */
export async function buildCloseMarketInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   hasOracleAccount: boolean,
   hasRollbackAccount: boolean,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productPoolPda] = await getProductPoolPDA(productId);
   const [marketPda] = await getMarketPDA(productId, marketId);
   const [marketAta] = await getATA(marketPda, tokenMint, tokenProgram);
   const [oraclePda] = hasOracleAccount ? await getOraclePDA(productId, marketId) : [DEFAULT_ADDRESS];

   const accounts: AccountMeta[] = [
      { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: productPoolPda, role: AccountRole.WRITABLE },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: oraclePda, role: AccountRole.WRITABLE }
   ];
   if(hasRollbackAccount){
      const [rollbackPda] = await getMarketLiveRollbackPDA(productId, marketId);
      accounts.push({ address: rollbackPda, role: AccountRole.READONLY });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'CloseMarket',
      })),
   };
}

/**
 * Build EditMarketGoLiveTime instruction - for updating the go live time of a market
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id (u16)
 * @param marketId - The market id (u64)
 * @param newGoLiveTime - The new go live time (u32)
 * @returns The instruction
 */
export async function buildEditMarketGoLiveTimeInstruction(
   productAdmin: Address,
   productId: number,
   marketId: bigint,
   newGoLiveTime: number,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(marketId);
   validateUint32(newGoLiveTime);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [marketPda] = await getMarketPDA(productId, marketId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.READONLY },
         { address: marketPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'EditGoLiveTime',
         value: {
            product_id: productId,
            new_go_live_time: newGoLiveTime,
         },
      })),
   };
}

/**
 * Build UpdateOracle instruction
 * @param oracleUpdater - The oracle updater address (signer)
 * @param productId - The product id (u16)
 * @param oracleSeed - The oracle seed (u64 - use marketId)
 * @param sequence - The sequence number (u32 - use time in seconds)
 * @param oracleData - The oracle data
 * @returns The instruction
 */
export async function buildUpdateOracleInstruction(
   oracleUpdater: Address,
   productId: number,
   oracleSeed: bigint,
   sequence: number,
   oracleData: Uint8Array,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(oracleSeed);
   validateUint32(sequence);
   validateUint8Array(oracleData);
   const [oraclePda] = await getOraclePDA(productId, oracleSeed);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: oracleUpdater, role: AccountRole.READONLY_SIGNER },
         { address: oraclePda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'UpdateOracle',
         value: {
            sequence,
            oracle_data: oracleData,
         },
      })),
   };
}

/**
 * Build SetWinningOutcome instruction - for setting the winning outcome on an oracle account
 * @param oracleUpdater - The oracle updater key (signer)
 * @param productId - The product id (u16)
 * @param oracleSeed - The oracle seed (u64)
 * @param winningOutcome - The winning outcome index (u8)
 * @returns The instruction
 */
export async function buildSetWinningOutcomeInstruction(
   oracleUpdater: Address,
   productId: number,
   oracleSeed: bigint,
   winningOutcome: number,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(oracleSeed);
   validateUint8(winningOutcome);
   if (winningOutcome < 1) {
      throw new Error('Winning outcome must be >= 1 (outcomes are 1-indexed)');
   }
   const [oraclePda] = await getOraclePDA(productId, oracleSeed);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: oracleUpdater, role: AccountRole.WRITABLE_SIGNER },
         { address: oraclePda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SetWinningOutcome',
         value: winningOutcome,
      })),
   };
}

/**
 * Build UpdateLiveRollbackAccount instruction - for updating the live rollback account with new time periods
 * @param admin - The admin key (signer)
 * @param productId - The product id (u16)
 * @param marketId - The market id (u64)
 * @param periodStart - The start time of the rollback period (u32)
 * @param periodEnd - The end time of the rollback period (u32)
 * @param marketPda - The market PDA address
 * @param oraclePda - The oracle PDA address
 * @returns The instruction
 */
export async function buildUpdateLiveRollbackAccountInstruction(
   admin: Address,
   productId: number,
   marketId: bigint,
   periodStart: number,
   periodEnd: number,
   marketPda: Address,
   oraclePda: Address,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(marketId);
   validateUint32(periodStart);
   validateUint32(periodEnd);
   if (periodEnd <= periodStart) {
      throw new Error('Period end must be greater than period start');
   }
   const [rollbackPda] = await getMarketLiveRollbackPDA(productId, marketId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: admin, role: AccountRole.WRITABLE_SIGNER },
         { address: marketPda, role: AccountRole.READONLY },
         { address: oraclePda, role: AccountRole.READONLY },
         { address: rollbackPda, role: AccountRole.WRITABLE },
         { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'UpdateLiveRollbackAccount',
         value: {
            period_start: periodStart,
            period_end: periodEnd,
         },
      })),
   };
}

/**
 * Build RollbackLiveBuy instruction - for rolling back a live buy bet
 * @param oracleAdmin - The oracle admin key (signer)
 * @param marketId - The market id (u64)
 * @param betId - The bet id (u64)
 * @param userKey - The user key who owns the bet
 * @param productId - The product id (u16)
 * @param tokenMint - The product token mint address
 * @param oracleSeed - The oracle seed (u64)
 * @param isSolFree - Whether this is a SOL-free bet (optional)
 * @returns The instruction
 */
export async function buildRollbackLiveBuyInstruction(
   oracleAdmin: Address,
   marketId: bigint,
   betId: bigint,
   userKey: Address,
   productId: number,
   tokenMint: Address,
   oracleSeed: bigint,
   isSolFree?: boolean,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint64(oracleSeed);
   const [marketPda] = await getMarketPDA(productId, marketId);
   const [marketAta] = await getATA(marketPda, tokenMint);
   const [oraclePda] = await getOraclePDA(productId, oracleSeed);
   const [rollbackPda] = await getMarketLiveRollbackPDA(productId, marketId);
   const [betPda] = await getBetPDA(productId, marketId, betId);
   const [userAta] = await getATA(userKey, tokenMint);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productFeesPda] = await getProductFeesPDA(productId);
   const [productFeesAta] = await getATA(productFeesPda, tokenMint);
   const [coreFeesAta] = await getATA(CORE_CONFIG_ADDR, tokenMint);
   const accounts: Array<{ address: Address; role: AccountRole }> = [
      { address: oracleAdmin, role: AccountRole.WRITABLE_SIGNER },
      { address: marketPda, role: AccountRole.WRITABLE },
      { address: marketAta, role: AccountRole.WRITABLE },
      { address: oraclePda, role: AccountRole.READONLY },
      { address: rollbackPda, role: AccountRole.READONLY },
      { address: betPda, role: AccountRole.WRITABLE },
      { address: userKey, role: AccountRole.READONLY },
      { address: userAta, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: productFeesAta, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: coreFeesAta, role: AccountRole.WRITABLE },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'RollbackLiveBuy',
      })),
   };
}

// RollbackLiveSell was removed from program Actions
