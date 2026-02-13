import { Rpc, SolanaRpcApi, GetProgramAccountsMemcmpFilter, Address, getAddressEncoder } from "@solana/kit";
import { FreebetAccount, ProductConfigAccount } from "../types";
import { getProductConfigAccountDecoder, getFreebetAccountDecoder } from "../codex";
import { getFreebetPDA, getProductConfigPDA, toBase64EncodedBytes } from "../solana_utils";
import { u16ToBuffer, u8ToBuffer, base64ToUint8Array } from "../utils";
import { FREEBET_ACCOUNT_TYPE, PROGRAM_ADDR } from "../constants";
import { AccountNotFoundError, RpcError, DecodingError } from "../errors";

const productConfigAccountDecoder = getProductConfigAccountDecoder();
const freebetAccountDecoder = getFreebetAccountDecoder();
const addressEncoder = getAddressEncoder();
/**
 * Fetch the config of a product
 * @param rpc - an Rpc instance
 * @param productId  
 * @returns the product config account details
 */
export async function getProductConfig(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
): Promise<ProductConfigAccount> {
   try {
      const [productConfigPda] = await getProductConfigPDA(productId);
      const accountResp = await rpc.getAccountInfo(productConfigPda, { encoding: 'base64' }).send();
      if (accountResp.value === null){
         throw new AccountNotFoundError(`Product config account not found`, productConfigPda);
      }
      try {
         const decoded = productConfigAccountDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
         return decoded;
      } catch (decodeError) {
         const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
         throw new DecodingError(`Failed to decode product config account data`, productConfigPda, cause);
      }
   } catch (e) {
      if (e instanceof AccountNotFoundError || e instanceof DecodingError) {
         throw e;
      }
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new RpcError(`RPC call failed while reading product config`, 'getProductConfig', cause);
   }
}

/**
 * Read Freebet Account from freebet id
 * @param rpc - an Rpc instance
 * @param productId - the product id
 * @param freebetId - the freebet id
 * @returns the freebet account details
 */
export async function getFreebetFromId(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   freebetId: number,
): Promise<FreebetAccount> {
   try {
      const [freebetPda] = await getFreebetPDA(productId, freebetId);
      const accountResp = await rpc.getAccountInfo(freebetPda, { encoding: 'base64' }).send();
      if (accountResp.value === null){
         throw new AccountNotFoundError(`Freebet account not found`, freebetPda);
      }
      try {
         const decoded = freebetAccountDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
         return decoded;
      } catch (decodeError) {
         const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
         throw new DecodingError(`Failed to decode freebet account data`, freebetPda, cause);
      }
   } catch (e) {
      if (e instanceof AccountNotFoundError || e instanceof DecodingError) {
         throw e;
      }
      const cause = e instanceof Error ? e : new Error(String(e));
      throw new RpcError(`RPC call failed while reading freebet`, 'getFreebetFromId', cause);
   }
}

export async function getAllFreebetsFromProduct(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
): Promise<FreebetAccount[]> {
   try {
      const filters: GetProgramAccountsMemcmpFilter[] = [
         {
            memcmp: {
               offset: 0n,
               bytes: toBase64EncodedBytes(u8ToBuffer(FREEBET_ACCOUNT_TYPE)),
               encoding: 'base64',
            },
         },
         {
            memcmp: {
               offset: 37n,
               bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
               encoding: 'base64',
            },
         },
      ];
      const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();
      return accounts.map(acc => {
         const decoded = freebetAccountDecoder.decode(base64ToUint8Array(acc.account.data[0]));
         return {
            ...decoded,
            address: acc.pubkey,
         };
      });
   } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error reading freebets: ${message}`);
   }
}

export async function getFreeBetsFromUser(
   rpc: Rpc<SolanaRpcApi>,
   user: Address,
   productId?: number,
): Promise<FreebetAccount[]> {
   try {
      const filters: GetProgramAccountsMemcmpFilter[] = [
         {
            memcmp: {
               offset: 0n,
               bytes: toBase64EncodedBytes(u8ToBuffer(FREEBET_ACCOUNT_TYPE)),
               encoding: 'base64',
            },
         },
         {
            memcmp: {
               offset: 73n,
               bytes: toBase64EncodedBytes(addressEncoder.encode(user)),
               encoding: 'base64',
            },
         },
      ];
      if (productId !== undefined) {
         filters.push({
            memcmp: {
               offset: 37n,
               bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
               encoding: 'base64',
            },
         });
      }
      const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

      return accounts.map(acc => {
         const decoded = freebetAccountDecoder.decode(base64ToUint8Array(acc.account.data[0]));
         return {
            ...decoded,
            address: acc.pubkey,
         };
      });
   } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error reading freebets: ${message}`);
   }
}

