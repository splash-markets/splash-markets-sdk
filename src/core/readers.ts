import { Rpc, SolanaRpcApi } from "@solana/kit";
import { getCoreConfigAccountDecoder, getProductListAccountDecoder } from "../codex"
import { CoreConfigAccount, ProductListAccount } from "../types";
import { CORE_CONFIG_ADDR } from "../constants";
import { base64ToUint8Array } from "../utils";
import { getProductListPDA } from "../solana_utils";
import { AccountNotFoundError, DecodingError } from "../errors";


const coreConfigAccountDecoder = getCoreConfigAccountDecoder();
const productListAccountDecoder = getProductListAccountDecoder();


/**
 * Get the core config account data
 * @param rpc - The RPC client to use
 * @returns The core config account
 */
export async function getCoreConfig(
   rpc: Rpc<SolanaRpcApi>
): Promise<CoreConfigAccount> {
   const coreConfigAccount = await rpc.getAccountInfo(CORE_CONFIG_ADDR, { encoding: 'base64' }).send();
   if (coreConfigAccount.value === null) {
      throw new AccountNotFoundError("Core config account not found", CORE_CONFIG_ADDR);
   }
   try {
      return coreConfigAccountDecoder.decode(base64ToUint8Array(coreConfigAccount.value.data[0]));
   } catch (decodeError) {
      const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
      throw new DecodingError(`Failed to decode core config account data`, CORE_CONFIG_ADDR, cause);
   }
}

/**
 * Get the product list account data
 * @param rpc - The RPC client to use
 * @returns The product list account
 */
export async function getProductList(
   rpc: Rpc<SolanaRpcApi>
): Promise<ProductListAccount> {
   const [productListAccountAddr] = await getProductListPDA()
   const productListAccount = await rpc.getAccountInfo(productListAccountAddr, { encoding: 'base64' }).send();
   if (productListAccount.value === null) {
      throw new AccountNotFoundError("Product list account not found", productListAccountAddr);
   }
   try {
      return productListAccountDecoder.decode(base64ToUint8Array(productListAccount.value.data[0]));
   } catch (decodeError) {
      const cause = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
      throw new DecodingError(`Failed to decode product list account data`, productListAccountAddr, cause);
   }
}