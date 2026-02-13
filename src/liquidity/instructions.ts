import { Address, AccountRole, Instruction, AccountMeta } from "@solana/kit";
import { getATA, getDepositRecordPDA, getProductConfigPDA, getProductPoolPDA, getWithdrawRecordPDA } from "../solana_utils";
import { ASSOCIATED_TOKEN_PROGRAM_ADDR, CORE_CONFIG_ADDR, PROGRAM_ADDR, SYSTEM_PROGRAM_ADDR, TOKEN_PROGRAM_ADDR } from "../constants";
import { getActionsEncoder } from "../codex";
import { validateUint16, validateUint64 } from "../validation";

const actionsEncoder = getActionsEncoder();


/**
 * Build InitDepositLiquidity instruction
 * @param feePayer - the fee payer address (tx signer; pays for account creation)
 * @param owner - the owner address (depositor; signer; tokens debited from owner ATA)
 * @param accountFeePayer - receives rent when deposit record/ATA are closed (must match value stored in record)
 * @param productId - the product id (u16)
 * @param depositId - the deposit id (u64)
 * @param amount - the amount of depositing token to deposit (u64)
 * @param minAmountLpReceived - the minimum amount of lp tokens to receive (u64)
 * @param depositingTokenMint - the mint address of the depositing token
 * @param depositingTokenProgram - the program address of the depositing token (default is TOKEN_PROGRAM_ADDR)
 * @param liquidTokenParams - lpTokenMint and userLpAta (only needed if the product is a liquid token product), or null
 * @param nonLiquidTokenParams - lpReceiptPda (only needed if the product is not a liquid token product), or null
 * @param cosigner - the cosigner address (optional - only needed if the product requires a liquidity cosigner)
 * @returns the init deposit liquidity instruction
 */
export async function buildInitDepositLiquidityInstruction(
   feePayer: Address, owner: Address, accountFeePayer: Address, productId: number, depositId: bigint, amount: bigint, minAmountLpReceived: bigint,
   depositingTokenMint: Address, depositingTokenProgram: Address,
   liquidTokenParams: null,
   nonLiquidTokenParams: { lpReceiptPda: Address },
   cosigner?: Address
): Promise<Instruction>
export async function buildInitDepositLiquidityInstruction(
   feePayer: Address, owner: Address, accountFeePayer: Address, productId: number, depositId: bigint, amount: bigint, minAmountLpReceived: bigint,
   depositingTokenMint: Address, depositingTokenProgram: Address,
   liquidTokenParams: { lpTokenMint: Address, userLpAta: Address },
   nonLiquidTokenParams: null,
   cosigner?: Address
): Promise<Instruction>
export async function buildInitDepositLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   depositId: bigint,
   amount: bigint,
   minAmountLpReceived: bigint,
   depositingTokenMint: Address,
   depositingTokenProgram: Address = TOKEN_PROGRAM_ADDR,
   liquidTokenParams: null | { lpTokenMint: Address, userLpAta: Address },
   nonLiquidTokenParams: null | { lpReceiptPda: Address },
   cosigner?: Address, // Required if cosigner_key is set
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(depositId);
   validateUint64(amount);
   validateUint64(minAmountLpReceived);
   const [ownerAta] = await getATA(owner, depositingTokenMint, depositingTokenProgram);
   const [depositRecordPda] = await getDepositRecordPDA(productId, depositId);
   const [tokenHoldingAta] = await getATA(depositRecordPda, depositingTokenMint, depositingTokenProgram); // ATA of deposit record PDA
   const [productConfigPda] = await getProductConfigPDA(productId);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: ownerAta, role: AccountRole.WRITABLE },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: depositRecordPda, role: AccountRole.WRITABLE },
      { address: tokenHoldingAta, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: depositingTokenProgram, role: AccountRole.READONLY },
      { address: depositingTokenMint, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
   ];
   if (cosigner) {
      accounts.push({ address: cosigner, role: AccountRole.WRITABLE_SIGNER });
   }
   if (liquidTokenParams && liquidTokenParams.lpTokenMint && liquidTokenParams.userLpAta) {
      accounts.push(
         { address: liquidTokenParams.lpTokenMint, role: AccountRole.READONLY },
         { address: liquidTokenParams.userLpAta, role: AccountRole.WRITABLE },
      );
   } else if (nonLiquidTokenParams && nonLiquidTokenParams.lpReceiptPda) {
      accounts.push({ address: nonLiquidTokenParams.lpReceiptPda, role: AccountRole.WRITABLE });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'InitDepositLiquidity',
         value: {
            amount,
            min_amount_lp_received: minAmountLpReceived,
            product_id: productId,
            deposit_id: depositId,
         },
      })),
   };
}

/**
 * Build the DepositLiquidity instruction - to finalise the deposit once the delay has passed
 * @param feePayer - the fee payer address (tx signer)
 * @param owner - the owner address (depositor; must match deposit record)
 * @param accountFeePayer - receives rent when deposit record/ATA close (must match deposit record)
 * @param productId - the product id (u16)
 * @param depositId - the deposit id (u64)
 * @param tokenMint - the mint address of the depositing token
 * @param liquidTokenParams - lpTokenMint and userLpAta (only if liquid token product), or null
 * @param nonLiquidTokenParams - lpReceiptPda (only if non-liquid token product), or null
 * @param tokenProgram - the program address of the depositing token (default is TOKEN_PROGRAM_ADDR)
 * @returns the deposit liquidity instruction
 */
export async function buildDepositLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   depositId: bigint,
   tokenMint: Address,
   liquidTokenParams: null,
   nonLiquidTokenParams: { lpReceiptPda: Address },
   tokenProgram: Address,
): Promise<Instruction>
export async function buildDepositLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   depositId: bigint,
   tokenMint: Address,
   liquidTokenParams: { lpTokenMint: Address, userLpAta: Address },
   nonLiquidTokenParams: null,
   tokenProgram: Address,
): Promise<Instruction>
export async function buildDepositLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   depositId: bigint,
   tokenMint: Address,
   liquidTokenParams: null | { lpTokenMint: Address, userLpAta: Address },
   nonLiquidTokenParams: null | { lpReceiptPda: Address },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(depositId);
   const [depositRecordPda] = await getDepositRecordPDA(productId, depositId);
   const [tokenHoldingAta] = await getATA(depositRecordPda, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productPoolPda] = await getProductPoolPDA(productId);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.READONLY },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: depositRecordPda, role: AccountRole.WRITABLE },
      { address: tokenHoldingAta, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.WRITABLE },
      { address: productPoolPda, role: AccountRole.WRITABLE },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (liquidTokenParams && liquidTokenParams.lpTokenMint && liquidTokenParams.userLpAta) {
      accounts.push(
         { address: liquidTokenParams.lpTokenMint, role: AccountRole.WRITABLE },
         { address: liquidTokenParams.userLpAta, role: AccountRole.WRITABLE },
      );
   } else if (nonLiquidTokenParams && nonLiquidTokenParams.lpReceiptPda) {
      accounts.push({ address: nonLiquidTokenParams.lpReceiptPda, role: AccountRole.WRITABLE });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'DepositLiquidity',
         value: {
            product_id: productId,
            deposit_id: depositId,
         },
      })),
   };
}

/**
 * Build CancelDepositLiquidity instruction
 * @param feePayer - the fee payer address (tx signer)
 * @param owner - the owner address (depositor; signer)
 * @param accountFeePayer - receives rent when deposit record/ATA close (must match deposit record)
 * @param productId - the product id (u16)
 * @param depositId - the deposit id (u64)
 * @param tokenMint - the mint address of the depositing token
 * @param lpReceiptPda - the pda address of the lp receipt (optional - only needed if the product is a non-liquid token product)
 * @param tokenProgram - the program address of the depositing token (default is TOKEN_PROGRAM_ADDR)
 * @returns the cancel deposit liquidity instruction
 */
export async function buildCancelDepositLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   depositId: bigint,
   tokenMint: Address,
   lpReceiptPda?: Address | null, // Required if liquid_token is false
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(depositId);
   const [ownerAta] = await getATA(owner, tokenMint, tokenProgram);
   const [depositRecordPda] = await getDepositRecordPDA(productId, depositId);
   const [tokenHoldingAta] = await getATA(depositRecordPda, tokenMint, tokenProgram);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: ownerAta, role: AccountRole.WRITABLE },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: depositRecordPda, role: AccountRole.WRITABLE },
      { address: tokenHoldingAta, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
   ];
   if (lpReceiptPda) {
      accounts.push({ address: lpReceiptPda, role: AccountRole.WRITABLE });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'CancelDepositLiquidity',
         value: {
            product_id: productId,
            deposit_id: depositId,
         },
      })),
   };
}

/**
 * Build InitWithdrawLiquidity instruction
 * @param feePayer - the fee payer address (tx signer; must be owner or product admin)
 * @param owner - the owner address (LP position owner)
 * @param accountFeePayer - receives rent when withdraw record is closed (must match value stored in record)
 * @param productId - the product id (u16)
 * @param withdrawId - the withdraw id (u64)
 * @param amount - the amount of lp tokens to withdraw (u64)
 * @param minAmountTokenReceived - the minimum amount of tokens to receive (u64)
 * @returns the init withdraw liquidity instruction
 */
export async function buildInitWithdrawLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   withdrawId: bigint,
   amount: bigint,
   minAmountTokenReceived: bigint,
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(withdrawId);
   validateUint64(amount);
   validateUint64(minAmountTokenReceived);
   const [withdrawRecordPda] = await getWithdrawRecordPDA(productId, withdrawId);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: withdrawRecordPda, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: CORE_CONFIG_ADDR, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];

   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'InitWithdrawLiquidity',
         value: {
            amount,
            min_amount_token_received: minAmountTokenReceived,
            product_id: productId,
            withdraw_id: withdrawId,
         },
      })),
   };
}

/**
 * Build the WithdrawLiquidity instruction - to finalise the withdraw once the delay has passed
 * @param feePayer - the fee payer address (tx signer)
 * @param owner - the owner address (LP position owner; signer)
 * @param accountFeePayer - receives rent when withdraw record is closed (must match withdraw record)
 * @param productId - the product id (u16)
 * @param withdrawId - the withdraw id (u64)
 * @param tokenMint - the mint address of the token to receive
 * @param tokenProgram - the program address of the token (default is TOKEN_PROGRAM_ADDR)
 * @param liquidTokenParams - lpTokenMint and userLpAta (only if liquid token product), or null
 * @param nonLiquidTokenParams - lpReceiptPda (only if non-liquid token product), or null
 * @returns the withdraw liquidity instruction
 */
export async function buildWithdrawLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   withdrawId: bigint,
   tokenMint: Address,
   tokenProgram: Address,
   liquidTokenParams: null,
   nonLiquidTokenParams: { lpReceiptPda: Address },
): Promise<Instruction>
export async function buildWithdrawLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   withdrawId: bigint,
   tokenMint: Address,
   tokenProgram: Address,
   liquidTokenParams: { lpTokenMint: Address, userLpAta: Address },
   nonLiquidTokenParams: null,
): Promise<Instruction>
export async function buildWithdrawLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   withdrawId: bigint,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   liquidTokenParams: null | { lpTokenMint: Address, userLpAta: Address },
   nonLiquidTokenParams: null | { lpReceiptPda: Address },
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(withdrawId);
   const [withdrawRecordPda] = await getWithdrawRecordPDA(productId, withdrawId);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const [productPoolPda] = await getProductPoolPDA(productId);
   const [ownerAta] = await getATA(owner, tokenMint, tokenProgram);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: ownerAta, role: AccountRole.WRITABLE },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: withdrawRecordPda, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.WRITABLE },
      { address: productPoolPda, role: AccountRole.WRITABLE },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDR, role: AccountRole.READONLY },
   ];
   if (liquidTokenParams && liquidTokenParams.lpTokenMint && liquidTokenParams.userLpAta) {
      accounts.push(
         { address: liquidTokenParams.lpTokenMint, role: AccountRole.READONLY },
         { address: liquidTokenParams.userLpAta, role: AccountRole.WRITABLE },
      );
   } else if (nonLiquidTokenParams && nonLiquidTokenParams.lpReceiptPda) {
      accounts.push({ address: nonLiquidTokenParams.lpReceiptPda, role: AccountRole.WRITABLE });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'WithdrawLiquidity',
         value: {
            product_id: productId,
            withdraw_id: withdrawId,
         },
      })),
   };
}

/**
 * Build CancelWithdrawLiquidity instruction
 * @param feePayer - the fee payer address (tx signer)
 * @param owner - the owner address (LP position owner; signer)
 * @param accountFeePayer - receives rent when withdraw record is closed (must match withdraw record)
 * @param productId - the product id (u16)
 * @param withdrawId - the withdraw id (u64)
 * @param tokenMint - the mint address of the token
 * @param tokenProgram - the program address of the token (default is TOKEN_PROGRAM_ADDR)
 * @param lpReceiptPda - the pda address of the lp receipt (optional - only needed if the product is a non-liquid token product)
 * @returns the cancel withdraw liquidity instruction
 */
export async function buildCancelWithdrawLiquidityInstruction(
   feePayer: Address,
   owner: Address,
   accountFeePayer: Address,
   productId: number,
   withdrawId: bigint,
   tokenMint: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   lpReceiptPda?: Address | null, // Required if liquid_token is false
): Promise<Instruction> {
   validateUint16(productId);
   validateUint64(withdrawId);
   const [ownerAta] = await getATA(owner, tokenMint, tokenProgram);
   const [withdrawRecordPda] = await getWithdrawRecordPDA(productId, withdrawId);
   const [productConfigPda] = await getProductConfigPDA(productId);
   const accounts: AccountMeta[] = [
      { address: feePayer, role: AccountRole.WRITABLE_SIGNER },
      { address: owner, role: AccountRole.WRITABLE_SIGNER },
      { address: ownerAta, role: AccountRole.WRITABLE },
      { address: accountFeePayer, role: AccountRole.WRITABLE },
      { address: withdrawRecordPda, role: AccountRole.WRITABLE },
      { address: productConfigPda, role: AccountRole.READONLY },
      { address: tokenMint, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
   ];
   if (lpReceiptPda) {
      accounts.push({ address: lpReceiptPda, role: AccountRole.WRITABLE });
   }
   return {
      programAddress: PROGRAM_ADDR,
      accounts,
      data: new Uint8Array(actionsEncoder.encode({
         __kind: 'CancelWithdrawLiquidity',
         value: {
            product_id: productId,
            withdraw_id: withdrawId,
         },
      })),
   };
}