import { Address, Instruction, assertIsAddress } from "@solana/kit";
import { getATA, getLpReceiptPDA, getLpTokenMintPDA } from "../solana_utils";
import { TOKEN_PROGRAM_ADDR } from "../constants";
import { buildCancelDepositLiquidityInstruction, buildDepositLiquidityInstruction, buildInitDepositLiquidityInstruction, buildInitWithdrawLiquidityInstruction, buildWithdrawLiquidityInstruction, buildCancelWithdrawLiquidityInstruction } from "./instructions";
import { validateTokenInfo, validateUint16, validateUint64, validateBool } from "../validation";


/**
 * Get the init deposit liquidity instruction - to start the deposit process
 * @param owner - the owner address (depositor; signer)
 * @param amount - the amount of depositing token to deposit
 * @param minReturnAmountLpReceived - the minimum amount of lp tokens to receive
 * @param productId - the product id
 * @param depositId - the deposit id
 * @param isLiquidToken - whether the product is a liquid token product
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param tokenProgram - the token program address (default is TOKEN_PROGRAM_ADDR)
 * @param cosigner - the cosigner address (optional - only needed if the product requires a liquidity cosigner)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to feePayer)
 * @returns the init deposit liquidity instruction
 */
export async function initDeposit(
   owner: Address,
   amount: bigint, // u64
   minReturnAmountLpReceived: bigint, // u64
   productId: number, // u16
   depositId: bigint, // u64
   isLiquidToken: boolean,
   tokenInfo: { mint: Address; decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   cosigner?: Address,
   feePayer?: Address,
   accountFeePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint64(amount);
   validateUint64(minReturnAmountLpReceived);
   validateUint16(productId);
   validateUint64(depositId);
   validateBool(isLiquidToken);
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);
   if (cosigner !== undefined) assertIsAddress(cosigner);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   if (isLiquidToken) {
      const [lpTokenMint] = await getLpTokenMintPDA(productId);
      const [userLpAta] = await getATA(owner, lpTokenMint, tokenProgram);
      return await buildInitDepositLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         depositId,
         amount,
         minReturnAmountLpReceived,
         tokenInfo.mint,
         tokenProgram,
         { lpTokenMint, userLpAta },
         null,
         cosigner,
      );
   } else {
      const [lpReceiptPda] = await getLpReceiptPDA(productId, owner);
      return await buildInitDepositLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         depositId,
         amount,
         minReturnAmountLpReceived,
         tokenInfo.mint,
         tokenProgram,
         null,
         { lpReceiptPda },
         cosigner,
      );
   }
}


/**
 * Finalize the deposit process
 * @param owner - the owner address (depositor; must match deposit record)
 * @param productId - the product id
 * @param depositId - the deposit id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param isLiquidToken - whether the product is a liquid token product
 * @param tokenProgram - the token program address
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to feePayer)
 * @returns the deposit liquidity instruction
 */
export async function deposit(
   owner: Address,
   productId: number, // u16
   depositId: bigint, // u64
   tokenInfo: { mint: Address; decimals: number },
   isLiquidToken: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   feePayer?: Address,
   accountFeePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint16(productId);
   validateUint64(depositId);
   validateTokenInfo(tokenInfo);
   validateBool(isLiquidToken);
   assertIsAddress(tokenProgram);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   if (isLiquidToken) {
      const [lpTokenMint] = await getLpTokenMintPDA(productId);
      const [userLpAta] = await getATA(owner, lpTokenMint, tokenProgram);
      return await buildDepositLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         depositId,
         tokenInfo.mint,
         { lpTokenMint, userLpAta },
         null,
         tokenProgram,
      );
   } else {
      const [lpReceiptPda] = await getLpReceiptPDA(productId, owner);
      return await buildDepositLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         depositId,
         tokenInfo.mint,
         null,
         { lpReceiptPda },
         tokenProgram,
      );
   }
}


/**
 * Cancel the deposit process
 * @param owner - the owner address (depositor; signer)
 * @param productId - the product id
 * @param depositId - the deposit id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param isLiquidToken - whether the product is a liquid token product
 * @param tokenProgram - the token program address (default is TOKEN_PROGRAM_ADDR)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to feePayer)
 * @returns the cancel deposit liquidity instruction
 */
export async function cancelDeposit(
   owner: Address,
   productId: number, // u16
   depositId: bigint, // u64
   tokenInfo: { mint: Address; decimals: number },
   isLiquidToken: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   feePayer?: Address,
   accountFeePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint16(productId);
   validateUint64(depositId);
   validateTokenInfo(tokenInfo);
   validateBool(isLiquidToken);
   assertIsAddress(tokenProgram);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   if (isLiquidToken) {
      return await buildCancelDepositLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         depositId,
         tokenInfo.mint,
         null,
         tokenProgram,
      );
   } else {
      const [lpReceiptPda] = await getLpReceiptPDA(productId, owner);
      return await buildCancelDepositLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         depositId,
         tokenInfo.mint,
         lpReceiptPda,
         tokenProgram,
      );
   }
}


/**
 * Get the init withdraw liquidity instruction - to start the withdraw process
 * @param owner - the owner address (LP position owner)
 * @param amount - the amount of lp tokens to withdraw (u64)
 * @param minAmountTokenReceived - the minimum amount of tokens to receive (u64)
 * @param productId - the product id (u16)
 * @param withdrawId - the withdraw id (u64)
 * @param isLiquidToken - whether the product is a liquid token product
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param tokenProgram - the token program address (default is TOKEN_PROGRAM_ADDR)
 * @param cosigner - the cosigner address (optional - only needed if the product requires a liquidity cosigner)
 * @param feePayer - optional; defaults to owner (must be owner or product admin)
 * @param accountFeePayer - optional; defaults to feePayer ?? owner
 * @returns the init withdraw liquidity instruction
 */
export async function initWithdraw(
   owner: Address,
   amount: bigint, // u64
   minAmountTokenReceived: bigint, // u64
   productId: number, // u16
   withdrawId: bigint, // u64
   isLiquidToken: boolean,
   tokenInfo: { mint: Address; decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   cosigner?: Address,
   feePayer?: Address,
   accountFeePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint64(amount);
   validateUint64(minAmountTokenReceived);
   validateUint16(productId);
   validateUint64(withdrawId);
   validateBool(isLiquidToken);
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);
   if (cosigner !== undefined) assertIsAddress(cosigner);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   return await buildInitWithdrawLiquidityInstruction(
      feePayer ?? owner,
      owner,
      accountFeePayer ?? feePayer ?? owner,
      productId,
      withdrawId,
      amount,
      minAmountTokenReceived,
   );
}


/**
 * Finalize the withdraw process
 * @param owner - the owner address (LP position owner; signer)
 * @param productId - the product id
 * @param withdrawId - the withdraw id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param isLiquidToken - whether the product is a liquid token product
 * @param tokenProgram - the token program address (default is TOKEN_PROGRAM_ADDR)
 * @param feePayer - optional; defaults to owner
 * @param accountFeePayer - optional; defaults to feePayer ?? owner
 * @returns the withdraw liquidity instruction
 */
export async function withdraw(
   owner: Address,
   productId: number, // u16
   withdrawId: bigint, // u64
   tokenInfo: { mint: Address; decimals: number },
   isLiquidToken: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   feePayer?: Address,
   accountFeePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint16(productId);
   validateUint64(withdrawId);
   validateTokenInfo(tokenInfo);
   validateBool(isLiquidToken);
   assertIsAddress(tokenProgram);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   if (isLiquidToken) {
      const [lpTokenMint] = await getLpTokenMintPDA(productId);
      const [userLpAta] = await getATA(owner, lpTokenMint, tokenProgram);
      return await buildWithdrawLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         withdrawId,
         tokenInfo.mint,
         tokenProgram,
         { lpTokenMint, userLpAta },
         null,
      );
   } else {
      const [lpReceiptPda] = await getLpReceiptPDA(productId, owner);
      return await buildWithdrawLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         withdrawId,
         tokenInfo.mint,
         tokenProgram,
         null,
         { lpReceiptPda },
      );
   }
}


/**
 * Cancel the withdraw process
 * @param owner - the owner address (LP position owner; signer)
 * @param productId - the product id
 * @param withdrawId - the withdraw id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param isLiquidToken - whether the product is a liquid token product
 * @param tokenProgram - the token program address (default is TOKEN_PROGRAM_ADDR)
 * @param feePayer - optional; defaults to owner
 * @param accountFeePayer - optional; defaults to feePayer ?? owner
 * @returns the cancel withdraw liquidity instruction
 */
export async function cancelWithdraw(
   owner: Address,
   productId: number, // u16
   withdrawId: bigint, // u64
   tokenInfo: { mint: Address; decimals: number },
   isLiquidToken: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   feePayer?: Address,
   accountFeePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint16(productId);
   validateUint64(withdrawId);
   validateTokenInfo(tokenInfo);
   validateBool(isLiquidToken);
   assertIsAddress(tokenProgram);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   if (isLiquidToken) {
      return await buildCancelWithdrawLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         withdrawId,
         tokenInfo.mint,
         tokenProgram,
         null,
      );
   } else {
      const [lpReceiptPda] = await getLpReceiptPDA(productId, owner);
      return await buildCancelWithdrawLiquidityInstruction(
         feePayer ?? owner,
         owner,
         accountFeePayer ?? feePayer ?? owner,
         productId,
         withdrawId,
         tokenInfo.mint,
         tokenProgram,
         lpReceiptPda,
      );
   }
}