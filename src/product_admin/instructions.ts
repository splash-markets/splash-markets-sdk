import {Address, Instruction, AccountRole} from '@solana/kit'
import { getActionsEncoder } from '../codex'
import { PROGRAM_ADDR, TOKEN_PROGRAM_ADDR, SYSTEM_PROGRAM_ADDR } from '../constants';
import { getProductConfigPDA, getProductFeesPDA, getFreebetPDA } from '../solana_utils';
import { ProductStatus, GiveFreebetInstruction } from '../types';
import { validateUint16, validateUint32, validateUint64 } from '../validation';

const actionsEncoder = getActionsEncoder();

/**
 * Build SetProductAdminKey instruction - for setting a new admin key
 * @param productAdmin - The current product admin key (signer)
 * @param productId - The product id
 * @param newAdminKey - The new admin key
 * @returns The instruction
 */
export async function buildSetProductAdminKeyInstruction(
   productAdmin: Address,
   productId: number,
   newAdminKey: Address,
): Promise<Instruction> {
   const [productConfigPda] = await getProductConfigPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.WRITABLE },
         { address: newAdminKey, role: AccountRole.READONLY },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SetProductAdminKey',
         value: productId,
      })),
   };
}

/**
 * Build SetProductWithdrawAuthority instruction - for setting a new fee withdraw authority
 * @param productAdmin - The current product admin key (signer)
 * @param productId - The product id
 * @param productWithdrawAuthority - The current product withdraw authority (signer)
 * @param newWithdrawAuthority - The new withdraw authority (signer)
 * @returns The instruction
 */
export async function buildSetProductWithdrawAuthorityInstruction(
   productAdmin: Address,
   productId: number,
   productWithdrawAuthority: Address,
   newWithdrawAuthority: Address,
): Promise<Instruction> {
   validateUint16(productId);
   const [productConfigPda] = await getProductConfigPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productWithdrawAuthority, role: AccountRole.READONLY },
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: newWithdrawAuthority, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SetProductWithdrawAuthority',
         value: productId,
      })),
   };
}

/**
 * Build SetProductFlatFee instruction - for updating the product default flat fee (charged on each bet)
 * @param productAdmin - The current product admin key (signer)
 * @param productId - The product id
 * @param flatFee - The new flat fee (in formatted units (e.g. 10000 for 0.10 USDC))
 * @returns The instruction
 */
export async function buildSetProductFlatFeeInstruction(
   productAdmin: Address,
   productId: number,
   flatFee: bigint,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(flatFee);
   const [productConfigPda] = await getProductConfigPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SetProductFlatFee',
         value: {
            product_id: productId,
            flat_fee: flatFee,
         },
      })),
   };
}

/**
 * Build SetProductPcFee instruction - for updating the product default percentage fee (charged on the risk of each bet)
 * @param productAdmin - The current product admin key (signer)
 * @param productId - The product id
 * @param pcFee - The new percentage fee in scaled format (e.g. 15 for 1.5%)
 * @returns The instruction
 */
export async function buildSetProductPcFeeInstruction(
   productAdmin: Address,
   productId: number,
   pcFee: number,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint16(pcFee);
   const [productConfigPda] = await getProductConfigPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SetProductPcFee',
         value: {
            product_id: productId,
            pc_fee: pcFee,
         },
      })),
   };
}

/**
 * Build SetProductWinFee instruction - for updating the product default win fee (charged on the profit of each bet)
 * @param productAdmin - The current product admin key (signer)
 * @param productId - The product id
 * @param winFee - The new win fee percent in scaled format (e.g. 15 for 1.5%)
 * @returns The instruction
 */
export async function buildSetProductWinFeeInstruction(
   productAdmin: Address,
   productId: number,
   winFee: number,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint16(winFee);
   const [productConfigPda] = await getProductConfigPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SetProductWinFee',
         value: {
            product_id: productId,
            win_fee: winFee,
         },
      })),
   };
}

/**
 * Build SetProductStatus instruction
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param status - The product status
 * @returns The instruction
 */
function isValidProductStatus(data: unknown): data is ProductStatus {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return d.__kind === 'PAUSED' || d.__kind === 'ACTIVE' || d.__kind === 'SUSPENDED';
}

function isValidGiveFreebetInstruction(data: unknown): data is GiveFreebetInstruction {
   if (!data || typeof data !== 'object') return false;
   const d = data as Record<string, unknown>;
   return (
      typeof d.freebet_id === 'number' &&
      typeof d.amount === 'bigint' &&
      typeof d.expires_at === 'number' &&
      typeof d.max_return === 'bigint' &&
      typeof d.min_return === 'bigint'
   );
}

function validateProductStatus(data: ProductStatus): void {
   if (!isValidProductStatus(data)) {
      throw new Error('Invalid ProductStatus: missing or incorrect __kind field');
   }
}

function validateGiveFreebetInstruction(data: GiveFreebetInstruction): void {
   if (!isValidGiveFreebetInstruction(data)) {
      throw new Error('Invalid GiveFreebetInstruction: missing or incorrect type for required fields');
   }
   validateUint32(data.freebet_id);
   validateUint64(data.amount);
   validateUint32(data.expires_at);
   validateUint64(data.max_return);
   validateUint64(data.min_return);
}

export async function buildSetProductStatusInstruction(
   productAdmin: Address,
   productId: number,
   status: ProductStatus,
): Promise<Instruction> {
   validateUint16(productId);
   validateProductStatus(status);
   const [productConfigPda] = await getProductConfigPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SetProductStatus',
         value: {
            product_id: productId,
            product_status: status,
         },
      })),
   };
}

/**
 * Build WithdrawProductFees instruction
 * @param withdrawAuthority - The product withdraw authority (signer)
 * @param productId - The product id
 * @param destinationWallet - The destination wallet address
 * @param destinationAta - The destination ATA address
 * @param amount - The amount to withdraw in scaled units (e.g. 100_000_000 for 100 USDC)
 * @param tokenMint - The product token mint address
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function buildWithdrawProductFeesInstruction(
   withdrawAuthority: Address,
   productId: number,
   destinationWallet: Address,
   destinationAta: Address,
   amount: bigint,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(amount);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productFeesAccount] = await getProductFeesPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: withdrawAuthority, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.READONLY },
         { address: productFeesAccount, role: AccountRole.WRITABLE },
         { address: destinationWallet, role: AccountRole.READONLY },
         { address: destinationAta, role: AccountRole.WRITABLE },
         { address: tokenMint, role: AccountRole.READONLY },
         { address: tokenProgram, role: AccountRole.READONLY },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'WithdrawProductFees',
         value: {
            product_id: productId,
            amount,
         },
      })),
   };
}


/**
 * Build SetLpMaxDeposits instruction - for setting the maximum deposits allowed for liquidity providers
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param maxDeposits - The maximum deposits in scaled units (e.g. 100_000_000 for 100 USDC)
 * @returns The instruction
 */
export async function buildSetLpMaxDepositsInstruction(
   productAdmin: Address,
   productId: number,
   maxDeposits: bigint,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(maxDeposits);
   const [productConfigPda] = await getProductConfigPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'SetLpMaxDeposits',
         value: {
            product_id: productId,
            max_deposits: maxDeposits,
         },
      })),
   };
}

/**
 * Build GiveFreebet instruction - for giving a freebet to a user
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param freebetData - The freebet data
 * @param userKey - The user key to give the freebet to
 * @returns The instruction
 */
export async function buildGiveFreebetInstruction(
   productAdmin: Address,
   productId: number,
   freebetData: GiveFreebetInstruction,
   userKey: Address,
): Promise<Instruction> {
   validateUint16(productId);
   validateGiveFreebetInstruction(freebetData);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [freebetPda] = await getFreebetPDA(productId, freebetData.freebet_id);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.READONLY },
         { address: userKey, role: AccountRole.READONLY },
         { address: freebetPda, role: AccountRole.WRITABLE },
         { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'GiveFreebet',
         value: freebetData,
      })),
   };
}

/**
 * Build RemoveFreebet instruction - for removing a freebet
 * @param productAdmin - The product admin key (signer)
 * @param freebetId - The freebet id
 * @param productId - The product id
 * @returns The instruction
 */
export async function buildRemoveFreebetInstruction(
   productAdmin: Address,
   freebetId: number,
   productId: number,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint32(freebetId);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [freebetPda] = await getFreebetPDA(productId, freebetId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.READONLY },
         { address: freebetPda, role: AccountRole.WRITABLE },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'RemoveFreebet',
      })),
   };
}

/**
 * Build ChangeLpCosigner instruction - for changing the liquidity provider cosigner
 * @param productAdmin - The product admin key (signer)
 * @param productId - the product id
 * @param cosigner - the account to become the new cosigner (111... if removing it)
 * @returns The instruction
 */
export async function buildChangeLpCosignerInstruction(
   productAdmin: Address,
   productId: number,
   cosigner: Address,
): Promise<Instruction> {
   validateUint16(productId);
   const [productConfigPda] = await getProductConfigPDA(productId);
   return {
      programAddress: PROGRAM_ADDR,
      accounts: [
         { address: productAdmin, role: AccountRole.WRITABLE_SIGNER },
         { address: productConfigPda, role: AccountRole.WRITABLE },
         { address: cosigner, role: AccountRole.READONLY },
      ],
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'ChangeLpCosigner',
         value: productId,
      })),
   };
}