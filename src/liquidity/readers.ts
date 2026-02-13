import { Address, getAddressEncoder, GetProgramAccountsMemcmpFilter, Rpc, SolanaRpcApi } from "@solana/kit";
import { DepositRecord, WithdrawRecord, LpReceipt } from "../types";
import { getDepositRecordDecoder, getWithdrawRecordDecoder, getLpReceiptDecoder } from "../codex";
import { base64ToUint8Array, u16ToBuffer, u8ToBuffer } from "../utils";
import { getDepositRecordPDA, getWithdrawRecordPDA, getLpReceiptPDA, toBase64EncodedBytes } from "../solana_utils";
import { DEPOSIT_RECORD_ACCOUNT_TYPE, WITHDRAW_RECORD_ACCOUNT_TYPE, LP_RECEIPT_ACCOUNT_TYPE, PROGRAM_ADDR } from "../constants";
import { AccountNotFoundError, RpcError, DecodingError } from "../errors";
const depositRecordDecoder = getDepositRecordDecoder();
const withdrawRecordDecoder = getWithdrawRecordDecoder();
const lpReceiptDecoder = getLpReceiptDecoder();
const addressEncoder = getAddressEncoder();

/**
 * Get the deposit record from the deposit record account
 * @param rpc - the rpc client
 * @param depositRecordPda - the deposit record pda
 * @returns the deposit record
 */
export async function getDepositRecordFromAccount(
   rpc: Rpc<SolanaRpcApi>,
   depositRecordPda: Address,
): Promise<DepositRecord> {
   try {
      const accountResp = await rpc.getAccountInfo(depositRecordPda, { encoding: 'base64' }).send();
      if (accountResp.value === null) {
         throw new AccountNotFoundError('Deposit record account not found', depositRecordPda);
      }
      try {
         const decoded = depositRecordDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
         return decoded;
      } catch (decodeError) {
         const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
         throw new DecodingError(`Failed to decode deposit record account data`, depositRecordPda, cause);
      }
   } catch (e) {
      if (e instanceof AccountNotFoundError || e instanceof DecodingError) {
         throw e;
      }
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new RpcError('RPC call failed while fetching deposit record', 'getDepositRecordFromAccount', cause);
   }
}

/**
 * Get the deposit record from the deposit id
 * @param rpc - the rpc client
 * @param productId - the product id
 * @param depositId - the deposit id
 * @returns the deposit record
 */
export async function getDepositRecordFromDepositId(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   depositId: bigint,
): Promise<DepositRecord> {
   const [depositRecordPda] = await getDepositRecordPDA(productId, depositId);
   return await getDepositRecordFromAccount(rpc, depositRecordPda);
}

export async function getDepositRecordsForProduct(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
): Promise<DepositRecord[]> {
   const filters: GetProgramAccountsMemcmpFilter[] = [
      {
         memcmp: {
            offset: 0n,
            bytes: toBase64EncodedBytes(u8ToBuffer(DEPOSIT_RECORD_ACCOUNT_TYPE)),
            encoding: 'base64',
         },
      },
      {
         memcmp: {
            offset: 33n,
            bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
            encoding: 'base64',
         },
      },
   ];
   
   const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

   return accounts.map(acc => {
      const decoded = depositRecordDecoder.decode(base64ToUint8Array(acc.account.data[0]));
      return decoded;
   });
}

/**
 * Get the deposit records for a user, optionally filtered by product id
 * @param rpc - the rpc client
 * @param user - the user address
 * @param productId - the product id
 * @returns the deposit records
 */
export async function getDepositRecordsForUser(
   rpc: Rpc<SolanaRpcApi>,
   user: Address,
   productId?: number,
): Promise<DepositRecord[]> {
   const filters: GetProgramAccountsMemcmpFilter[] = [
      {
         memcmp: {
            offset: 0n,
            bytes: toBase64EncodedBytes(u8ToBuffer(DEPOSIT_RECORD_ACCOUNT_TYPE)),
            encoding: 'base64',
         },
      },
      {
         memcmp: {
            offset: 1n,
            bytes: toBase64EncodedBytes(addressEncoder.encode(user)),
            encoding: 'base64',
         },
      },
   ];
   if (productId) {
      filters.push({
         memcmp: {
            offset: 33n,
            bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
            encoding: 'base64',
         },
      });
   }
   
   const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

   return accounts.map(acc =>
      depositRecordDecoder.decode(base64ToUint8Array(acc.account.data[0]))
   );
}

/**
 * Get the withdraw record from the withdraw record account
 * @param rpc - the rpc client
 * @param withdrawRecordPda - the withdraw record pda
 * @returns the withdraw record
 */
export async function getWithdrawRecordFromAccount(
   rpc: Rpc<SolanaRpcApi>,
   withdrawRecordPda: Address,
): Promise<WithdrawRecord> {
   try {
      const accountResp = await rpc.getAccountInfo(withdrawRecordPda, { encoding: 'base64' }).send();
      if (accountResp.value === null) {
         throw new AccountNotFoundError('Withdraw record account not found', withdrawRecordPda);
      }
      try {
         const decoded = withdrawRecordDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
         return decoded;
      } catch (decodeError) {
         const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
         throw new DecodingError(`Failed to decode withdraw record account data`, withdrawRecordPda, cause);
      }
   } catch (e) {
      if (e instanceof AccountNotFoundError || e instanceof DecodingError) {
         throw e;
      }
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new RpcError('RPC call failed while fetching withdraw record', 'getWithdrawRecordFromAccount', cause);
   }
}

/**
 * Get the withdraw record from the withdraw id
 * @param rpc - the rpc client
 * @param productId - the product id
 * @param withdrawId - the withdraw id
 * @returns the withdraw record
 */
export async function getWithdrawRecordFromWithdrawId(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   withdrawId: bigint,
): Promise<WithdrawRecord> {
   const [withdrawRecordPda] = await getWithdrawRecordPDA(productId, withdrawId);
   return await getWithdrawRecordFromAccount(rpc, withdrawRecordPda);
}

/**
 * Get the withdraw records for a product
 * @param rpc - the rpc client
 * @param productId - the product id
 * @returns the withdraw records
 */
export async function getWithdrawRecordsForProduct(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
): Promise<WithdrawRecord[]> {
   const filters: GetProgramAccountsMemcmpFilter[] = [
      {
         memcmp: {
            offset: 0n,
            bytes: toBase64EncodedBytes(u8ToBuffer(WITHDRAW_RECORD_ACCOUNT_TYPE)),
            encoding: 'base64',
         },
      },
      {
         memcmp: {
            offset: 33n,
            bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
            encoding: 'base64',
         },
      },
   ];
   
   const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

   return accounts.map(acc => {
      const decoded = withdrawRecordDecoder.decode(base64ToUint8Array(acc.account.data[0]));
      return decoded;
   });
}

/**
 * Get the withdraw records for a user, optionally filtered by product id
 * @param rpc - the rpc client
 * @param user - the user address
 * @param productId - the product id
 * @returns the withdraw records
 */
export async function getWithdrawRecordsForUser(
   rpc: Rpc<SolanaRpcApi>,
   user: Address,
   productId?: number,
): Promise<WithdrawRecord[]> {
   const filters: GetProgramAccountsMemcmpFilter[] = [
      {
         memcmp: {
            offset: 0n,
            bytes: toBase64EncodedBytes(u8ToBuffer(WITHDRAW_RECORD_ACCOUNT_TYPE)),
            encoding: 'base64',
         },
      },
      {
         memcmp: {
            offset: 1n,
            bytes: toBase64EncodedBytes(addressEncoder.encode(user)),
            encoding: 'base64',
         },
      },
   ];
   if (productId) {
      filters.push({
         memcmp: {
            offset: 33n,
            bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
            encoding: 'base64',
         },
      });
   }
   
   const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

   return accounts.map(acc =>
      withdrawRecordDecoder.decode(base64ToUint8Array(acc.account.data[0]))
   );
}

/**
 * Get the LP receipt from the LP receipt account
 * @param rpc - the rpc client
 * @param lpReceiptPda - the LP receipt pda
 * @returns the LP receipt
 */
export async function getLpReceiptFromAccount(
   rpc: Rpc<SolanaRpcApi>,
   lpReceiptPda: Address,
): Promise<LpReceipt> {
   try {
      const accountResp = await rpc.getAccountInfo(lpReceiptPda, { encoding: 'base64' }).send();
      if (accountResp.value === null) {
         throw new AccountNotFoundError('LP receipt account not found', lpReceiptPda);
      }
      try {
         const decoded = lpReceiptDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
         return decoded;
      } catch (decodeError) {
         const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
         throw new DecodingError(`Failed to decode LP receipt account data`, lpReceiptPda, cause);
      }
   } catch (e) {
      if (e instanceof AccountNotFoundError || e instanceof DecodingError) {
         throw e;
      }
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new RpcError('RPC call failed while fetching LP receipt', 'getLpReceiptFromAccount', cause);
   }
}

/**
 * Get the LP receipt from the product id and user
 * @param rpc - the rpc client
 * @param productId - the product id
 * @param user - the user address
 * @returns the LP receipt
 */
export async function getLpReceiptFromUser(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   user: Address,
): Promise<LpReceipt> {
   const [lpReceiptPda] = await getLpReceiptPDA(productId, user);
   return await getLpReceiptFromAccount(rpc, lpReceiptPda);
}

/**
 * Get the LP receipts for a product
 * @param rpc - the rpc client
 * @param productId - the product id
 * @returns the LP receipts
 */
export async function getLpReceiptsForProduct(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
): Promise<LpReceipt[]> {
   const filters: GetProgramAccountsMemcmpFilter[] = [
      {
         memcmp: {
            offset: 0n,
            bytes: toBase64EncodedBytes(u8ToBuffer(LP_RECEIPT_ACCOUNT_TYPE)),
            encoding: 'base64',
         },
      },
      {
         memcmp: {
            offset: 33n,
            bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
            encoding: 'base64',
         },
      },
   ];
   
   const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

   return accounts.map(acc => {
      const decoded = lpReceiptDecoder.decode(base64ToUint8Array(acc.account.data[0]));
      return decoded;
   });
}

/**
 * Get the LP receipts for a user, optionally filtered by product id
 * @param rpc - the rpc client
 * @param user - the user address
 * @param productId - the product id
 * @returns the LP receipts
 */
export async function getLpReceiptsForUser(
   rpc: Rpc<SolanaRpcApi>,
   user: Address,
   productId?: number,
): Promise<LpReceipt[]> {
   const filters: GetProgramAccountsMemcmpFilter[] = [
      {
         memcmp: {
            offset: 0n,
            bytes: toBase64EncodedBytes(u8ToBuffer(LP_RECEIPT_ACCOUNT_TYPE)),
            encoding: 'base64',
         },
      },
      {
         memcmp: {
            offset: 1n,
            bytes: toBase64EncodedBytes(addressEncoder.encode(user)),
            encoding: 'base64',
         },
      },
   ];
   if (productId) {
      filters.push({
         memcmp: {
            offset: 33n,
            bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
            encoding: 'base64',
         },
      });
   }
   
   const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

   return accounts.map(acc =>
      lpReceiptDecoder.decode(base64ToUint8Array(acc.account.data[0]))
   );
}
