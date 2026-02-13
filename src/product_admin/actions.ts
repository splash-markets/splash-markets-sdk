import { buildSetProductFlatFeeInstruction, buildSetProductPcFeeInstruction, buildSetProductStatusInstruction, buildSetProductWinFeeInstruction, buildWithdrawProductFeesInstruction, buildSetLpMaxDepositsInstruction, buildGiveFreebetInstruction, buildRemoveFreebetInstruction, buildSetProductWithdrawAuthorityInstruction, buildSetProductAdminKeyInstruction } from "./instructions";
import { safeBigInt, uiToScaled } from "../utils";
import { validateTokenInfo, validateUint8, validateUint16, validateUint32, validateUint64 } from "../validation";
import { Address, Instruction, assertIsAddress } from "@solana/kit";
import { ProductStatus, GiveFreebetInstruction } from "../types";
import { getATA } from "../solana_utils";
import { TOKEN_PROGRAM_ADDR } from "../constants";


/**
 * Get the SetProductAdminKey instruction - for setting a new admin key
 * @param productAdmin - The current product admin key (signer)
 * @param productId - The product id
 * @param newAdminKey - The new admin key
 * @returns The instruction
 */
export async function getSetProductAdminKeyInstruction(
   productAdmin: Address,
   productId: number,
   newAdminKey: Address,
): Promise<Instruction> {
   validateUint16(productId);
   assertIsAddress(productAdmin);
   assertIsAddress(newAdminKey);
   return await buildSetProductAdminKeyInstruction(productAdmin, productId, newAdminKey);
}

/**
 * Get the SetProductWithdrawAuthority instruction - for setting a new fee withdraw authority
 * @param productAdmin - The current product admin key (signer)
 * @param productId - The product id
 * @param productWithdrawAuthority - The current product withdraw authority (signer)
 * @param newWithdrawAuthority - The new withdraw authority (signer)
 * @returns The instruction
 */
export async function getSetProductWithdrawAuthorityInstruction(
   productAdmin: Address,
   productId: number,
   productWithdrawAuthority: Address,
   newWithdrawAuthority: Address,
): Promise<Instruction> {
   validateUint16(productId);
   assertIsAddress(productAdmin);
   assertIsAddress(productWithdrawAuthority);
   assertIsAddress(newWithdrawAuthority);
   return await buildSetProductWithdrawAuthorityInstruction(productAdmin, productId, productWithdrawAuthority, newWithdrawAuthority);
}

/**
 * Get the SetProductFlatFee instruction
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param flatFee_ui - The flat fee in UI units (e.g. 0.1 for 0.10 USDC)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @returns The instruction
 */
export async function getSetProductFlatFeeInstruction(
   productAdmin: Address,
   productId: number,
   flatFee_ui: number,
   tokenInfo: { mint: Address; decimals: number }
): Promise<Instruction> {
   validateUint16(productId);
   if(flatFee_ui < 0){
      throw new Error("Flat fee must be >= 0");
   }
   validateTokenInfo(tokenInfo);
   const scaledFee = uiToScaled(flatFee_ui, tokenInfo.decimals);
   validateUint64(scaledFee);
   assertIsAddress(productAdmin);
   return await buildSetProductFlatFeeInstruction(productAdmin, productId, scaledFee);
}


/**
 * Get the SetProductPcFee instruction
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param pcFee - The percentage fee (e.g. 1.5 for 1.5%)
 * @returns The instruction
 */
export async function setProductPcFee(
   productAdmin: Address,
   productId: number,
   pcFee: number,
): Promise<Instruction> {
   validateUint16(productId);
   if(pcFee < 0){
      throw new Error("Percentage fee must be >= 0");
   }
   if(pcFee > 100){
      throw new Error("Percentage fee must be <= 100");
   }
   const scaledFee = Math.round(pcFee * 10);
   validateUint16(scaledFee);
   assertIsAddress(productAdmin);
   return await buildSetProductPcFeeInstruction(productAdmin, productId, scaledFee);
}

/**
 * Get the SetProductWinFee instruction
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param winFee - The win fee (e.g. 1.5 for 1.5%)
 * @returns The instruction
 */
export async function setProductWinFee(
   productAdmin: Address,
   productId: number,
   winFee: number,
): Promise<Instruction> {
   validateUint16(productId);
   if(winFee < 0){
      throw new Error("Win fee must be >= 0");
   }
   if(winFee > 100){
      throw new Error("Win fee must be <= 100");
   }
   const scaledFee = Math.round(winFee * 10);
   validateUint16(scaledFee);
   return await buildSetProductWinFeeInstruction(productAdmin, productId, scaledFee);
}

/**
 * Get the SetProductStatus instruction
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param status - The product status
 * @returns The instruction
 */
export async function setProductStatus(
   productAdmin: Address,
   productId: number,
   status: ProductStatus['__kind'],
): Promise<Instruction> {
   validateUint16(productId);
   if(status !== 'ACTIVE' && status !== 'PAUSED'){
      throw new Error("Invalid status. Must be 'ACTIVE' | 'PAUSED'");
   }
   assertIsAddress(productAdmin);
   return await buildSetProductStatusInstruction(productAdmin, productId, { __kind: status });
}

/**
 * Withdraw product fees
 * @param productWithdrawAuthority - The product withdraw authority (signer)
 * @param destinationWallet - The destination wallet address
 * @param productId - The product id
 * @param amount_ui - The amount to withdraw in UI units (e.g. 0.1 for 0.10 USDC)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function withdrawProductFees(
   productWithdrawAuthority: Address,
   destinationWallet: Address,
   productId: number,
   amount_ui: number,
   tokenInfo: { mint: Address; decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   validateUint16(productId);
   if(amount_ui < 0){
      throw new Error("Amount must be >= 0");
   }
   validateTokenInfo(tokenInfo);
   assertIsAddress(destinationWallet);
   assertIsAddress(tokenProgram);

   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   const [destinationAta] = await getATA(destinationWallet, tokenInfo.mint, tokenProgram);
   return await buildWithdrawProductFeesInstruction(
      productWithdrawAuthority,
      productId,
      destinationWallet,
      destinationAta,
      scaledAmount,
      tokenInfo.mint,
      tokenProgram,
   );
}


/**
 * Get the SetLpMaxDeposits instruction - for setting the maximum deposits allowed for liquidity providers
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param maxDeposits_ui - The maximum deposits in UI units (e.g. 100.0 for 100 USDC)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @returns The instruction
 */
export async function getSetLpMaxDepositsInstruction(
   productAdmin: Address,
   productId: number,
   maxDeposits_ui: number,
   tokenInfo: { mint: Address; decimals: number },
): Promise<Instruction> {
   validateUint16(productId);
   if(maxDeposits_ui < 0){
      throw new Error("Max deposits must be >= 0");
   }
   validateTokenInfo(tokenInfo);
   const scaledMaxDeposits = uiToScaled(maxDeposits_ui, tokenInfo.decimals);
   validateUint64(scaledMaxDeposits);
   return await buildSetLpMaxDepositsInstruction(
      productAdmin,
      productId,
      scaledMaxDeposits,
   );
}



// --- Freebet Functions ---

/**
 * Get the GiveFreebet instruction - for giving a freebet to a user
 * @param productAdmin - The product admin key (signer)
 * @param productId - The product id
 * @param freebetId - The freebet id
 * @param amount_ui - The freebet amount in UI units (e.g. 10.0 for 10 USDC)
 * @param expiresAt - The expiration timestamp (Unix timestamp)
 * @param maxReturn_ui - The maximum return in UI units (e.g. 100.0 for 100 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 0.0 for 0 USDC)
 * @param userKey - The user key to give the freebet to
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @returns The instruction
 */
export async function getGiveFreebetInstruction(
   productAdmin: Address,
   productId: number,
   freebetId: number,
   amount_ui: number,
   expiresAt: number,
   maxReturn_ui: number,
   minReturn_ui: number,
   userKey: Address,
   tokenInfo: { mint: Address; decimals: number },
): Promise<Instruction> {
   validateUint16(productId);
   validateUint32(freebetId);
   if(amount_ui < 0){
      throw new Error("Amount must be >= 0");
   }
   validateUint32(expiresAt);
   if(maxReturn_ui < 0){
      throw new Error("Max return must be >= 0");
   }
   if(minReturn_ui < 0){
      throw new Error("Min return must be >= 0");
   }
   if(maxReturn_ui < minReturn_ui){
      throw new Error("Max return must be >= min return");
   }
   assertIsAddress(userKey);
   validateTokenInfo(tokenInfo);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMaxReturn = uiToScaled(maxReturn_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMaxReturn);
   validateUint64(scaledMinReturn);
   const freebetData: GiveFreebetInstruction = {
      freebet_id: freebetId,
      amount: scaledAmount,
      expires_at: expiresAt,
      max_return: scaledMaxReturn,
      min_return: scaledMinReturn,
   };
   assertIsAddress(productAdmin);
   return await buildGiveFreebetInstruction(productAdmin, productId, freebetData, userKey);
}

/**
 * Get the RemoveFreebet instruction - for removing a freebet
 * @param productAdmin - The product admin key (signer)
 * @param freebetId - The freebet id
 * @param productId - The product id
 * @returns The instruction
 */
export async function getRemoveFreebetInstruction(
   productAdmin: Address,
   freebetId: number,
   productId: number,
): Promise<Instruction> {
   validateUint32(freebetId);
   validateUint16(productId);
   assertIsAddress(productAdmin);
   return await buildRemoveFreebetInstruction(productAdmin, freebetId, productId);
}
