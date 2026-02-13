import { buildBuyForInstruction, buildBuyAgainstInstruction, buildSellForInstruction, buildSellAgainstInstruction, buildHandleSellRequestInstruction, buildClaimPositionInstruction, buildBuyForWithFreebetInstruction, buildBuyAgainstWithFreebetInstruction, buildSellForWithFreebetInstruction, buildSellAgainstWithFreebetInstruction, buildClaimPositionWithFreebetInstruction, buildBuyParlayInstruction, buildSellParlayInstruction, buildClaimParlayPositionInstruction, buildHandleSellParlayRequestInstruction } from "./instructions";
import { uiToScaled } from "../utils";
import { validateTokenInfo, validateUint8, validateUint32, validateUint64, validateBool } from "../validation";
import { Address, Instruction, assertIsAddress } from "@solana/kit";
import { ValidationRangeError } from "../errors";
import { BuyInstruction, SellInstruction, BuyWithFreebetInstruction, SellWithFreebetInstruction, ParlayBetInstruction, SellParlayInstruction } from "../types";
import { TOKEN_PROGRAM_ADDR } from "../constants";


/**
 * Get the BuyFor instruction - for betting for an outcome.
 * @param owner - The owner of the bet (signer, must be a valid Solana address)
 * @param productId - The product id (must be 0-255)
 * @param marketId - The market id (must be a valid uint64)
 * @param betId - The bet id (must be a valid uint64)
 * @param outcomeIndex - The outcome index to bet on (1-indexed, must be >= 1 and <= 255)
 * @param amount_ui - The bet amount in UI units (e.g. 10.0 for 10 USDC, must be > 0)
 * @param minReturn_ui - The minimum return in UI units (e.g. 15.0 for 15 USDC, must be >= 0)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param needsOracle - Whether an oracle account is needed (must be a boolean)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getBuyForInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   outcomeIndex: number,
   amount_ui: number,
   minReturn_ui: number,
   tokenInfo: { mint: Address; decimals: number },
   needsOracle: boolean,
   feePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId, 'productId');
   validateUint64(marketId, 'marketId');
   validateUint64(betId, 'betId');
   validateUint8(outcomeIndex, 'outcomeIndex');
   if(outcomeIndex < 1){
      throw new ValidationRangeError("Outcome index must be >= 1 (outcomes are 1-indexed)", 'outcomeIndex', outcomeIndex, 1);
   }
   if(amount_ui <= 0){
      throw new ValidationRangeError("Amount must be > 0", 'amount_ui', amount_ui, 0);
   }
   if(minReturn_ui < 0){
      throw new ValidationRangeError("Min return must be >= 0", 'minReturn_ui', minReturn_ui, 0);
   }
   validateTokenInfo(tokenInfo);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const buyData: BuyInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      market_id: marketId,
      bet_id: betId,
      outcome_index: outcomeIndex,
      frontend_bytes: new Uint8Array(8),
   };
   return await buildBuyForInstruction(feePayer ?? owner, owner, buyData, tokenInfo.mint, needsOracle, tokenProgram);
}

/**
 * Get the BuyAgainst instruction - for betting against an outcome.
 * @param owner - The owner of the bet (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param outcomeIndex - The outcome index to bet against (1-indexed)
 * @param amount_ui - The bet amount in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 15.0 for 15 USDC)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getBuyAgainstInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   outcomeIndex: number,
   amount_ui: number,
   minReturn_ui: number,
   tokenInfo: { mint: Address; decimals: number },
   feePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint8(outcomeIndex);
   if(outcomeIndex < 1){
      throw new Error("Outcome index must be >= 1 (outcomes are 1-indexed)");
   }
   if(amount_ui <= 0){
      throw new Error("Amount must be > 0");
   }
   if(minReturn_ui < 0){
      throw new Error("Min return must be >= 0");
   }
   validateTokenInfo(tokenInfo);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const buyData: BuyInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      market_id: marketId,
      bet_id: betId,
      outcome_index: outcomeIndex,
      frontend_bytes: new Uint8Array(8),
   };
   return await buildBuyAgainstInstruction(feePayer ?? owner, owner, buyData, tokenInfo.mint, tokenProgram);
}

/**
 * Get the SellFor instruction - for selling a bet for an outcome.
 * @param owner - The owner of the bet (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param outcomeIndex - The outcome index of the bet (1-indexed)
 * @param amount_ui - The amount to sell in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 8.0 for 8 USDC)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param needsOracle - Whether an oracle account is needed
 * @param isLive - Whether this is a live market sell
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to fee_payer)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getSellForInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   outcomeIndex: number,
   amount_ui: number,
   minReturn_ui: number,
   tokenInfo: { mint: Address; decimals: number },
   needsOracle: boolean,
   isLive: boolean,
   feePayer?: Address,
   accountFeePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint8(outcomeIndex);
   if(outcomeIndex < 1){
      throw new Error("Outcome index must be >= 1 (outcomes are 1-indexed)");
   }
   if(amount_ui <= 0){
      throw new Error("Amount must be > 0");
   }
   if(minReturn_ui < 0){
      throw new Error("Min return must be >= 0");
   }
   validateTokenInfo(tokenInfo);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const sellData: SellInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      market_id: marketId,
      bet_id: betId,
      outcome_index: outcomeIndex,
   };
   return await buildSellForInstruction(feePayer ?? owner, accountFeePayer ?? feePayer ?? owner, owner, sellData, tokenInfo.mint, needsOracle, isLive, tokenProgram);
}

/**
 * Get the SellAgainst instruction - for selling a bet against an outcome.
 * @param owner - The owner of the bet (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param outcomeIndex - The outcome index of the bet (1-indexed)
 * @param amount_ui - The amount to sell in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 8.0 for 8 USDC)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param needsOracle - Whether an oracle account is needed
 * @param isLive - Whether this is a live market sell
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to fee_payer)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getSellAgainstInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   outcomeIndex: number,
   amount_ui: number,
   minReturn_ui: number,
   tokenInfo: { mint: Address; decimals: number },
   needsOracle: boolean,
   isLive: boolean,
   feePayer?: Address,
   accountFeePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint8(outcomeIndex);
   if(outcomeIndex < 1){
      throw new Error("Outcome index must be >= 1 (outcomes are 1-indexed)");
   }
   if(amount_ui <= 0){
      throw new Error("Amount must be > 0");
   }
   if(minReturn_ui < 0){
      throw new Error("Min return must be >= 0");
   }
   validateTokenInfo(tokenInfo);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const sellData: SellInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      market_id: marketId,
      bet_id: betId,
      outcome_index: outcomeIndex,
   };
   return await buildSellAgainstInstruction(feePayer ?? owner, accountFeePayer ?? feePayer ?? owner, owner, sellData, tokenInfo.mint, needsOracle, isLive, tokenProgram);
}

/**
 * Get the HandleSellRequest instruction - for handling a sell request (typically called by oracle or authorized signer)
 * @param signer - The signer key (signer)
 * @param owner - The owner of the bet
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param needsRollbackAccount - Whether a rollback account is needed
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to fee_payer)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getHandleSellRequestInstruction(
   signer: Address,
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   tokenInfo: { mint: Address; decimals: number },
   needsRollbackAccount: boolean,
   feePayer?: Address,
   accountFeePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(signer);
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateTokenInfo(tokenInfo);
   validateBool(needsRollbackAccount);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   assertIsAddress(tokenProgram);
   return await buildHandleSellRequestInstruction(
      feePayer ?? owner,
      accountFeePayer ?? feePayer ?? owner,
      signer,
      owner,
      betId,
      marketId,
      productId,
      tokenInfo.mint,
      needsRollbackAccount,
      tokenProgram,
   );
}

/**
 * Get the ClaimPosition instruction - for claiming a winning bet position.
 * @param owner - The owner of the bet
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param needsRollbackAccount - Whether a rollback account is needed (defaults to false)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to fee_payer)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getClaimPositionInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   tokenInfo: { mint: Address; decimals: number },
   needsRollbackAccount: boolean = false,
   feePayer?: Address,
   accountFeePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateTokenInfo(tokenInfo);
   validateBool(needsRollbackAccount);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   assertIsAddress(tokenProgram);
   return await buildClaimPositionInstruction(
      feePayer ?? owner,
      accountFeePayer ?? feePayer ?? owner,
      owner,
      betId,
      marketId,
      productId,
      tokenInfo.mint,
      needsRollbackAccount,
      tokenProgram,
   );
}

// --- Freebet Betting Functions ---

/**
 * Get the BuyForWithFreebet instruction - for betting for an outcome using a freebet.
 * @param owner - The owner key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param outcomeIndex - The outcome index to bet on (1-indexed)
 * @param amount_ui - The bet amount in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 15.0 for 15 USDC)
 * @param freebetId - The freebet id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getBuyForWithFreebetInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   outcomeIndex: number,
   amount_ui: number,
   minReturn_ui: number,
   freebetId: number,
   tokenInfo: { mint: Address; decimals: number },
   feePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint8(outcomeIndex);
   if(outcomeIndex < 1){
      throw new Error("Outcome index must be >= 1 (outcomes are 1-indexed)");
   }
   if(amount_ui <= 0){
      throw new Error("Amount must be > 0");
   }
   if(minReturn_ui < 0){
      throw new Error("Min return must be >= 0");
   }
   validateUint32(freebetId);
   validateTokenInfo(tokenInfo);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const buyData: BuyWithFreebetInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      market_id: marketId,
      bet_id: betId,
      outcome_index: outcomeIndex,
      freebet_id: freebetId,
      frontend_bytes: new Uint8Array(8),
   };
   return await buildBuyForWithFreebetInstruction(feePayer ?? owner, owner, buyData, tokenInfo.mint, tokenProgram);
}

/**
 * Get the BuyAgainstWithFreebet instruction - for betting against an outcome using a freebet
 * @param owner - The owner key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param outcomeIndex - The outcome index to bet against (1-indexed)
 * @param amount_ui - The bet amount in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 15.0 for 15 USDC)
 * @param freebetId - The freebet id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getBuyAgainstWithFreebetInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   outcomeIndex: number,
   amount_ui: number,
   minReturn_ui: number,
   freebetId: number,
   tokenInfo: { mint: Address; decimals: number },
   feePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint8(outcomeIndex);
   if(outcomeIndex < 1){
      throw new Error("Outcome index must be >= 1 (outcomes are 1-indexed)");
   }
   if(amount_ui <= 0){
      throw new Error("Amount must be > 0");
   }
   if(minReturn_ui < 0){
      throw new Error("Min return must be >= 0");
   }
   validateUint32(freebetId);
   validateTokenInfo(tokenInfo);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const buyData: BuyWithFreebetInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      market_id: marketId,
      bet_id: betId,
      outcome_index: outcomeIndex,
      freebet_id: freebetId,
      frontend_bytes: new Uint8Array(8),
   };
   return await buildBuyAgainstWithFreebetInstruction(feePayer ?? owner, owner, buyData, tokenInfo.mint, tokenProgram);
}

/**
 * Get the SellForWithFreebet instruction - for selling a bet for an outcome that was placed with a freebet.
 * @param owner - The owner key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param outcomeIndex - The outcome index of the bet (1-indexed)
 * @param amount_ui - The amount to sell in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 8.0 for 8 USDC)
 * @param freebetId - The freebet id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param needsOracle - Whether an oracle account is needed
 * @param isLive - Whether this is a live market sell
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to fee_payer)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getSellForWithFreebetInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   outcomeIndex: number,
   amount_ui: number,
   minReturn_ui: number,
   freebetId: number,
   tokenInfo: { mint: Address; decimals: number },
   needsOracle: boolean,
   isLive: boolean,
   feePayer?: Address,
   accountFeePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint8(outcomeIndex);
   if(outcomeIndex < 1){
      throw new Error("Outcome index must be >= 1 (outcomes are 1-indexed)");
   }
   if(amount_ui <= 0){
      throw new Error("Amount must be > 0");
   }
   if(minReturn_ui < 0){
      throw new Error("Min return must be >= 0");
   }
   validateUint32(freebetId);
   validateTokenInfo(tokenInfo);
   validateBool(needsOracle);
   validateBool(isLive);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const sellData: SellWithFreebetInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      market_id: marketId,
      bet_id: betId,
      outcome_index: outcomeIndex,
      freebet_id: freebetId,
   };
   return await buildSellForWithFreebetInstruction(feePayer ?? owner, accountFeePayer ?? feePayer ?? owner, owner, sellData, tokenInfo.mint, needsOracle, isLive, tokenProgram);
}

/**
 * Get the SellAgainstWithFreebet instruction - for selling a bet against an outcome that was placed with a freebet.
 * @param owner - The owner key (signer)
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param outcomeIndex - The outcome index of the bet (1-indexed)
 * @param amount_ui - The amount to sell in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 8.0 for 8 USDC)
 * @param freebetId - The freebet id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param needsOracle - Whether an oracle account is needed
 * @param isLive - Whether this is a live market sell
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to fee_payer)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getSellAgainstWithFreebetInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   outcomeIndex: number,
   amount_ui: number,
   minReturn_ui: number,
   freebetId: number,
   tokenInfo: { mint: Address; decimals: number },
   needsOracle: boolean,
   isLive: boolean,
   feePayer?: Address,
   accountFeePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint8(outcomeIndex);
   if(outcomeIndex < 1){
      throw new Error("Outcome index must be >= 1 (outcomes are 1-indexed)");
   }
   if(amount_ui <= 0){
      throw new Error("Amount must be > 0");
   }
   if(minReturn_ui < 0){
      throw new Error("Min return must be >= 0");
   }
   validateUint32(freebetId);
   validateTokenInfo(tokenInfo);
   validateBool(needsOracle);
   validateBool(isLive);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const sellData: SellWithFreebetInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      market_id: marketId,
      bet_id: betId,
      outcome_index: outcomeIndex,
      freebet_id: freebetId,
   };
   return await buildSellAgainstWithFreebetInstruction(feePayer ?? owner, accountFeePayer ?? feePayer ?? owner, owner, sellData, tokenInfo.mint, needsOracle, isLive, tokenProgram);
}

/**
 * Get the ClaimPositionWithFreebet instruction - for claiming a winning bet position that was placed with a freebet.
 * @param owner - The owner of the bet
 * @param productId - The product id
 * @param marketId - The market id
 * @param betId - The bet id
 * @param freebetId - The freebet id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param productAdmin - The product admin key
 * @param needsRollbackAccount - Whether a rollback account is needed (defaults to false)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to fee_payer)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getClaimPositionWithFreebetInstruction(
   owner: Address,
   productId: number,
   marketId: bigint,
   betId: bigint,
   freebetId: number,
   tokenInfo: { mint: Address; decimals: number },
   productAdmin: Address,
   needsRollbackAccount: boolean = false,
   feePayer?: Address,
   accountFeePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(marketId);
   validateUint64(betId);
   validateUint32(freebetId);
   validateTokenInfo(tokenInfo);
   assertIsAddress(productAdmin);
   validateBool(needsRollbackAccount);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   assertIsAddress(tokenProgram);
   return await buildClaimPositionWithFreebetInstruction(
      feePayer ?? owner,
      accountFeePayer ?? feePayer ?? owner,
      owner,
      betId,
      freebetId,
      marketId,
      productId,
      tokenInfo.mint,
      productAdmin,
      needsRollbackAccount,
      tokenProgram,
   );
}

// --- Parlay Betting Functions ---

/**
 * Get the BuyParlay instruction - for placing a parlay bet across multiple markets
 * @param owner - The owner key (signer)
 * @param productId - The product id
 * @param betId - The bet id
 * @param amount_ui - The bet amount in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 50.0 for 50 USDC)
 * @param selections - Array of [marketId, outcomeIndex] tuples (1-indexed outcomes)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param freebetId - The freebet id (defaults to 0, meaning no freebet)
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @returns The instruction
 */
export async function getBuyParlayInstruction(
   owner: Address,
   productId: number,
   betId: bigint,
   amount_ui: number,
   minReturn_ui: number,
   selections: [bigint, number][],
   tokenInfo: { mint: Address; decimals: number },
   freebetId: number = 0,
   feePayer?: Address,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(betId);
   if (amount_ui <= 0) {
      throw new Error("Amount must be > 0");
   }
   if (minReturn_ui < 0) {
      throw new Error("Min return must be >= 0");
   }
   if (selections.length < 2) {
      throw new Error("Parlay must have at least 2 selections");
   }
   for (const [marketId, outcomeIndex] of selections) {
      validateUint64(marketId);
      validateUint8(outcomeIndex);
      if (outcomeIndex <= 0) {
         throw new Error("Outcome index must be > 0 (outcomes are 1-indexed)");
      }
   }
   validateTokenInfo(tokenInfo);
   validateUint32(freebetId);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   assertIsAddress(tokenProgram);
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const parlayData: ParlayBetInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      bet_id: betId,
      freebet_id: freebetId,
      selections,
      frontend_bytes: new Uint8Array(8),
   };
   return await buildBuyParlayInstruction(feePayer ?? owner, owner, parlayData, tokenInfo.mint, tokenProgram);
}

/**
 * Get the SellParlay instruction - for selling a parlay bet.
 * @param owner - The owner key (signer)
 * @param productId - The product id
 * @param betId - The bet id
 * @param amount_ui - The amount to sell in UI units (e.g. 10.0 for 10 USDC)
 * @param minReturn_ui - The minimum return in UI units (e.g. 8.0 for 8 USDC)
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param isLive - Whether this is a live market sell
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param marketIds - The market ids for the parlay
 * @param feePayer - Optional fee payer (defaults to owner)
 * @param accountFeePayer - Optional recipient of closed account rent (defaults to fee_payer)
 * @returns The instruction
 */
export async function getSellParlayInstruction(
   owner: Address,
   productId: number,
   betId: bigint,
   amount_ui: number,
   minReturn_ui: number,
   tokenInfo: { mint: Address; decimals: number },
   isLive: boolean,
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   marketIds: bigint[],
   feePayer?: Address,
   accountFeePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(owner);
   validateUint8(productId);
   validateUint64(betId);
   if (amount_ui <= 0) {
      throw new Error("Amount must be > 0");
   }
   if (minReturn_ui < 0) {
      throw new Error("Min return must be >= 0");
   }
   validateTokenInfo(tokenInfo);
   validateBool(isLive);
   if (feePayer !== undefined) assertIsAddress(feePayer);
   if (accountFeePayer !== undefined) assertIsAddress(accountFeePayer);
   assertIsAddress(tokenProgram);
   marketIds.forEach(marketId => validateUint64(marketId));
   if (marketIds.length < 2) {
      throw new Error("Parlay must have at least 2 markets");
   }
   const scaledAmount = uiToScaled(amount_ui, tokenInfo.decimals);
   const scaledMinReturn = uiToScaled(minReturn_ui, tokenInfo.decimals);
   validateUint64(scaledAmount);
   validateUint64(scaledMinReturn);
   const sellData: SellParlayInstruction = {
      amount: scaledAmount,
      min_return: scaledMinReturn,
      product_id: productId,
      bet_id: betId,
   };
   return await buildSellParlayInstruction(feePayer ?? owner, accountFeePayer ?? feePayer ?? owner, owner, sellData, tokenInfo.mint, isLive, tokenProgram, marketIds);
}

/**
 * Get the ClaimParlayPosition instruction - for claiming a winning parlay bet position.
 * @param signer - The signer key (signer)
 * @param owner - The owner of the bet
 * @param betId - The bet id
 * @param productId - The product id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param marketsIdsAndNeedsRollbackAccount - Array of [market_id, needs_rollback_account] tuples (defaults to all false)
 * @param feePayer - Optional fee payer (defaults to signer)
 * @returns The instruction
 */
export async function getClaimParlayPositionInstruction(
   signer: Address,
   owner: Address,
   betId: bigint,
   productId: number,
   tokenInfo: { mint: Address; decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   marketsIdsAndNeedsRollbackAccount: [bigint, boolean][],
   feePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(signer);
   assertIsAddress(owner);
   validateUint64(betId);
   validateUint8(productId);
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);
   for (const [marketId, needsRollbackAccount] of marketsIdsAndNeedsRollbackAccount) {
      validateUint64(marketId);
      validateBool(needsRollbackAccount);
   }
   if (feePayer !== undefined) assertIsAddress(feePayer);
   return await buildClaimParlayPositionInstruction(feePayer ?? signer, owner, betId, productId, tokenInfo.mint, tokenProgram, marketsIdsAndNeedsRollbackAccount);
}

/**
 * Get the HandleSellParlayRequest instruction - for handling a parlay sell request (typically called by oracle or authorized signer).
 * @param signer - The signer key (signer)
 * @param owner - The owner of the bet
 * @param betId - The bet id
 * @param productId - The product id
 * @param tokenInfo - Token information (mint address and decimals, e.g. 6 for USDC)
 * @param tokenProgram - The token program address (defaults to TOKEN_PROGRAM_ADDR)
 * @param marketsIdsAndNeedsRollbackAccount - Array of [market_id, needs_rollback_account] tuples
 * @param feePayer - Optional fee payer (defaults to signer)
 * @returns The instruction
 */
export async function getHandleSellParlayRequestInstruction(
   signer: Address,
   owner: Address,
   betId: bigint,
   productId: number,
   tokenInfo: { mint: Address; decimals: number },
   tokenProgram: Address = TOKEN_PROGRAM_ADDR,
   marketsIdsAndNeedsRollbackAccount: [bigint, boolean][],
   feePayer?: Address,
): Promise<Instruction> {
   assertIsAddress(signer);
   assertIsAddress(owner);
   validateUint64(betId);
   validateUint8(productId);
   validateTokenInfo(tokenInfo);
   assertIsAddress(tokenProgram);
   for (const [marketId, needsRollbackAccount] of marketsIdsAndNeedsRollbackAccount) {
      validateUint64(marketId);
      validateBool(needsRollbackAccount);
   }
   if (feePayer !== undefined) assertIsAddress(feePayer);
   return await buildHandleSellParlayRequestInstruction(feePayer ?? signer, owner, betId, productId, tokenInfo.mint, tokenProgram, marketsIdsAndNeedsRollbackAccount);
}

//get market odds
//get slippage
//get market chart