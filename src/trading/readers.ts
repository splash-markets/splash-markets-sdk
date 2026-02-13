import { Address, getAddressEncoder, GetProgramAccountsMemcmpFilter, Rpc, SolanaRpcApi } from "@solana/kit";
import { BetAccount, ParlayBetAccount, ParlaySellRequestAccount, SellRequestAccount } from "../types";
import { getAccountDecoder } from "../codex";
import { getBetPDA, getParlayBetPDA, getParlaySellRequestPDA, getSellRequestPDA, toBase64EncodedBytes } from "../solana_utils";
import { BET_ACCOUNT_TYPE, PARLAY_BET_ACCOUNT_TYPE, PARLAY_SELL_REQUEST_ACCOUNT_TYPE, PROGRAM_ADDR, SELL_REQUEST_ACCOUNT_TYPE } from "../constants";
import { u16ToBuffer, u64ToBuffer, u8ToBuffer, base64ToUint8Array } from "../utils";

const addressEncoder = getAddressEncoder();
const accountDecoder = getAccountDecoder();

/**
* Get the details of a buy/sell request/parlay buy/parlay sell request account
* @param rpc - an Rpc instance
* @param account - the account address
* @param accountType - the type of account ("Bet", "SellRequest", "ParlayBet", "ParlaySellRequest")
* @returns the details of the account
*/
export async function getTradeDetailsFromAccount(rpc: Rpc<SolanaRpcApi>, account: Address, accountType: "Bet"): Promise<BetAccount>
export async function getTradeDetailsFromAccount(rpc: Rpc<SolanaRpcApi>, account: Address, accountType: "SellRequest"): Promise<SellRequestAccount>
export async function getTradeDetailsFromAccount(rpc: Rpc<SolanaRpcApi>, account: Address, accountType: "ParlayBet"): Promise<ParlayBetAccount>
export async function getTradeDetailsFromAccount(rpc: Rpc<SolanaRpcApi>, account: Address, accountType: "ParlaySellRequest"): Promise<ParlaySellRequestAccount>
export async function getTradeDetailsFromAccount(
   rpc: Rpc<SolanaRpcApi>,
   account: Address,
   accountType: "Bet" | "SellRequest" | "ParlayBet" | "ParlaySellRequest"
): Promise<BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount> {
   try {
      const accountResp = await rpc.getAccountInfo(account, { encoding: 'base64' }).send();
      if (accountResp.value === null){
         throw new Error(`Error fetching account ${account}`);
      };
      const decoded = accountDecoder.decode(base64ToUint8Array(accountResp.value.data[0]));
      return decoded.value as BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount;
   } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error fetching account ${account}: ${message}`);
   }
}

/**
* Get the details of a buy/sell request/parlay buy/parlay sell request account from an id
* @param rpc - an Rpc instance
* @param productId - the product id
* @param marketId - the market id - only used for Bet and SellRequest accounts
* @param accountType - the type of account ("Bet", "SellRequest", "ParlayBet", "ParlaySellRequest")
* @param id - the id of the account
* @returns the details of the account
*/
export async function getTradeDetailsFromId(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "Bet", id: bigint, marketId: bigint, ): Promise<BetAccount>
export async function getTradeDetailsFromId(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "SellRequest", id: bigint, marketId: bigint, ): Promise<SellRequestAccount>
export async function getTradeDetailsFromId(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "ParlayBet", id: bigint): Promise<ParlayBetAccount>
export async function getTradeDetailsFromId(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "ParlaySellRequest", id: bigint): Promise<ParlaySellRequestAccount>
export async function getTradeDetailsFromId(
   rpc: Rpc<SolanaRpcApi>,
   productId: number,
   accountType: "Bet" | "SellRequest" | "ParlayBet" | "ParlaySellRequest",
   id: bigint,
   marketId?: bigint,
): Promise<BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount> {
   try {
      switch (accountType) {
         case "Bet": {
            const [accountPda] = await getBetPDA(productId, marketId!, id);
            return await getTradeDetailsFromAccount(rpc, accountPda, accountType);
         }
         case "SellRequest": {
            const [accountPda] = await getSellRequestPDA(productId, marketId!, id);
            return await getTradeDetailsFromAccount(rpc, accountPda, accountType);
         }
         case "ParlayBet": {
            const [accountPda] = await getParlayBetPDA(productId, id);
            return await getTradeDetailsFromAccount(rpc, accountPda, accountType);
         }
         case "ParlaySellRequest": {
            const [accountPda] = await getParlaySellRequestPDA(productId, id);
            return await getTradeDetailsFromAccount(rpc, accountPda, accountType);
         }
         default:
            throw new Error(`Invalid account type ${accountType}`);
      }
   } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error fetching account from id ${id} for product ${productId} and market ${marketId}: ${message}`);
   }
}

/**
* Get all the details of a user's accounts of a given type
* @param rpc - an Rpc instance
* @param user - the user address
* @param accountType - the type of account ("Bet", "SellRequest", "ParlayBet", "ParlaySellRequest", or "All")
* @param productId - the product id (optional)
* @returns the details of the accounts
*/
export async function getAllAccountDetailsFromUser(rpc: Rpc<SolanaRpcApi>, user: Address, accountType: "Bet", productId?: number): Promise<BetAccount[]>
export async function getAllAccountDetailsFromUser(rpc: Rpc<SolanaRpcApi>, user: Address, accountType: "SellRequest", productId?: number): Promise<SellRequestAccount[]>
export async function getAllAccountDetailsFromUser(rpc: Rpc<SolanaRpcApi>, user: Address, accountType: "ParlayBet", productId?: number): Promise<ParlayBetAccount[]>
export async function getAllAccountDetailsFromUser(rpc: Rpc<SolanaRpcApi>, user: Address, accountType: "ParlaySellRequest", productId?: number): Promise<ParlaySellRequestAccount[]>
export async function getAllAccountDetailsFromUser(rpc: Rpc<SolanaRpcApi>, user: Address, accountType: "All", productId?: number): Promise<(BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount)[]>
export async function getAllAccountDetailsFromUser(
   rpc: Rpc<SolanaRpcApi>, 
   user: Address, 
   accountType: "Bet" | "SellRequest" | "ParlayBet" | "ParlaySellRequest" | "All",
   productId?: number,
): Promise<BetAccount[] | SellRequestAccount[] | ParlayBetAccount[] | ParlaySellRequestAccount[] | (BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount)[]> {
   try {
      const filters: GetProgramAccountsMemcmpFilter[] = [
         {
            memcmp: {
               offset: 20n,
               bytes: toBase64EncodedBytes(addressEncoder.encode(user)),
               encoding: 'base64',
            },
         },
      ];

      if(productId !== undefined) {
         filters.push({
            memcmp: {
               offset: 10n,
               bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
               encoding: 'base64',
            },
         });
      }
      
      switch (accountType) {
         case "Bet":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(BET_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "SellRequest":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(SELL_REQUEST_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "ParlayBet":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(PARLAY_BET_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "ParlaySellRequest":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(PARLAY_SELL_REQUEST_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "All":
            break;
         default:
            throw new Error(`Invalid account type ${accountType}`);
      }

      const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

      return accounts.map(acc => {
         const account = accountDecoder.decode(base64ToUint8Array(acc.account.data[0]));
         return {
            ...account.value,
            address: acc.pubkey,
         };
      }) as (BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount)[];
   } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error fetching account from user ${user}: ${message}`);
   }
}

/**
* Get all the details of a market's accounts of a given type
* @param rpc - an Rpc instance
* @param productId - the product id
* @param marketId - the market id
* @param accountType - the type of account ("Bet", "SellRequest" or "All")
* @returns the details of the accounts
*/
export async function getAllAccountDetailsFromMarket(rpc: Rpc<SolanaRpcApi>, productId: number, marketId: bigint, accountType: "Bet"): Promise<BetAccount[]>
export async function getAllAccountDetailsFromMarket(rpc: Rpc<SolanaRpcApi>, productId: number, marketId: bigint, accountType: "SellRequest"): Promise<SellRequestAccount[]>
export async function getAllAccountDetailsFromMarket(rpc: Rpc<SolanaRpcApi>, productId: number, marketId: bigint, accountType: "All"): Promise<(BetAccount | SellRequestAccount)[]>
export async function getAllAccountDetailsFromMarket(
   rpc: Rpc<SolanaRpcApi>,
   productId: number, 
   marketId: bigint, 
   accountType: "Bet" | "SellRequest" | "All"
): Promise<BetAccount[] | SellRequestAccount[] | (BetAccount | SellRequestAccount)[]> {

   try {
      const filters: GetProgramAccountsMemcmpFilter[] = [
         {
            memcmp: {
               offset: 10n,
               bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
               encoding: 'base64',
            },
         },
         {
            memcmp: {
               offset: 12n,
               bytes: toBase64EncodedBytes(u64ToBuffer(marketId)),
               encoding: 'base64',
            },
         },
      ];

      switch (accountType) {
         case "Bet":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(BET_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "SellRequest":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(SELL_REQUEST_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "All":
            break;
         default:
            throw new Error(`Invalid account type ${accountType}`);
      }

      const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

      return accounts.map(acc => {
         const account = accountDecoder.decode(base64ToUint8Array(acc.account.data[0]));
         return {
            ...account.value,
            address: acc.pubkey,
         };
      }).filter(acc => accountType === "All" ? 
         (acc as any).account_type_discriminator === BET_ACCOUNT_TYPE || 
         (acc as any).account_type_discriminator === SELL_REQUEST_ACCOUNT_TYPE : 
         true) as (BetAccount | SellRequestAccount)[];
   } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error fetching account from market ${marketId}: ${message}`);
   }
}

/**
* Get all the details of a product's accounts of a given type
* @param rpc - an Rpc instance
* @param productId - the product id
* @param accountType - the type of account ("Bet", "SellRequest", "ParlayBet", "ParlaySellRequest" or "All")
* @returns the details of the accounts
*/
export async function getAllAccountDetailsFromProduct(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "Bet"): Promise<BetAccount[]>
export async function getAllAccountDetailsFromProduct(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "SellRequest"): Promise<SellRequestAccount[]>
export async function getAllAccountDetailsFromProduct(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "ParlayBet"): Promise<ParlayBetAccount[]>
export async function getAllAccountDetailsFromProduct(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "ParlaySellRequest"): Promise<ParlaySellRequestAccount[]>
export async function getAllAccountDetailsFromProduct(rpc: Rpc<SolanaRpcApi>, productId: number, accountType: "All"): Promise<(BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount)[]>
export async function getAllAccountDetailsFromProduct(
   rpc: Rpc<SolanaRpcApi>, 
   productId: number, 
   accountType: "Bet" | "SellRequest" | "ParlayBet" | "ParlaySellRequest" | "All"
): Promise<BetAccount[] | SellRequestAccount[] | ParlayBetAccount[] | ParlaySellRequestAccount[] | (BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount)[]> {
   try {
      const filters: GetProgramAccountsMemcmpFilter[] = [
         {
            memcmp: {
               offset: 10n,
               bytes: toBase64EncodedBytes(u16ToBuffer(productId)),
               encoding: 'base64',
            },
         },
      ];

      switch (accountType) {
         case "Bet":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(BET_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "SellRequest":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(SELL_REQUEST_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "ParlayBet":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(PARLAY_BET_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "ParlaySellRequest":
            filters.push({
               memcmp: {
                  offset: 0n,
                  bytes: toBase64EncodedBytes(u8ToBuffer(PARLAY_SELL_REQUEST_ACCOUNT_TYPE)),
                  encoding: 'base64',
               },
            });
            break;
         case "All":
            break;
         default:
            throw new Error(`Invalid account type ${accountType}`);
      }

      const accounts = await rpc.getProgramAccounts(PROGRAM_ADDR, { encoding: 'base64', filters}).send();

      return accounts.map(acc => {
         const account = accountDecoder.decode(base64ToUint8Array(acc.account.data[0]));
         return {
            ...account.value,
            address: acc.pubkey,
         };
      }) as (BetAccount | SellRequestAccount | ParlayBetAccount | ParlaySellRequestAccount)[];
   } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error fetching account from product ${productId}: ${message}`);
   }
}