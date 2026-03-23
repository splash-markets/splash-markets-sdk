// TypeScript type definitions for Splash Markets Program
// All Rust number types except u8 are represented as bigint

import { Address, Instruction, Rpc, RpcSubscriptions, Signature, SolanaRpcApi, SolanaRpcSubscriptionsApi } from '@solana/kit';

/** Token information (mint address and decimals) used in action inputs */
export type TokenInfo = { mint: Address; decimals: number };

// --- Enums ---

export type MarketStatus =
   | { __kind: 'Prematch' }
   | { __kind: 'Live' }
   | { __kind: 'Paused' }
   | { __kind: 'PendingResolution' }
   | { __kind: 'PendingFullfillment' };

export type MarketType =
   | { __kind: 'Uncontrolled' }
   | { __kind: 'DirectControlled' }
   | { __kind: 'IntControlled' }
   | { __kind: 'AdvControlled' }
   | { __kind: 'OneVOne' }
   | { __kind: 'OneVMany' }
   | { __kind: 'DutchAuction' }
   | { __kind: 'AdvDutchAuction' };

export type CoreStatus =
   | { __kind: 'PAUSED' }
   | { __kind: 'ACTIVE' };

export type ProductStatus =
   | { __kind: 'PAUSED' }
   | { __kind: 'ACTIVE' }
   | { __kind: 'SUSPENDED' };

export type BetType =
   | { __kind: 'For' }
   | { __kind: 'Against' };

export type OracleDataVariant =
   | { __kind: 'ControlledLiquidity'; probabilities: number[]; liquidity: bigint }
   | { __kind: 'FactoredLiquidity'; probabilities: number[]; liquidity_factor: number }
   | { __kind: 'Resolution' };

export type OracleVariantType =
   | { __kind: 'ControlledLiquidity' }
   | { __kind: 'FactoredLiquidity' }
   | { __kind: 'Resolution' };

/** Resolution method: Oracle (winning outcome from oracle account) or Manual (signer sets outcome). */
export type ResolutionMethod =
   | { __kind: 'Oracle' }
   | { __kind: 'Manual' };

export type ResolutionAuthority = {
   method: ResolutionMethod;
   account: Address;
};

// --- Core Types ---

export type CoreMultisigSetup = {
   required_signatures: number; // u8
   signers: Address[];
};

export type CoreConfigAccount = {
   account_type_discriminator: number; // u8
   admin_key: Address;
   core_flat_fee: bigint; // u64
   core_pc_fee: number; // u16
   core_win_fee: number; // u16
   core_status: CoreStatus;
   core_multisig_setup: CoreMultisigSetup;
};

export type ProductInfo = {
   product_id: number; // u16
   product_name: string;
};

export type ProductListAccount = {
   account_type_discriminator: number; // u8
   products: ProductInfo[];
};

export type CreateProductInstruction = {
   product_id: number; // u16
   product_name: string;
   admin_key: Address;
   liquid_token: boolean;
   cosigner_key: Address | null;
   core_performance_fee: number; // u16
   core_fee_on_product: number; // u16
};

// --- Product Types ---

export type LpConfig = {
   liquid_token: boolean;
   deposit_delay: number; // u32
   withdraw_delay: number; // u32
   cosigner_key: Address;
   virtual_balance: bigint; // u64
   max_deposits: bigint; // u64
};

export type ProductConfigAccount = {
   account_type_discriminator: number; // u8
   product_id: number; // u16
   admin_key: Address;
   withdraw_authority: Address;
   token_mint: Address;
   product_flat_fee: bigint; // u64
   product_pc_fee: number; // u16
   product_win_fee: number; // u16
   product_performance_fee: number; // u16
   product_status: ProductStatus;
   core_performance_fee: number; // u16
   core_fee_on_product: number; // u16
   lp_config: LpConfig;
};

// --- Liquidity Types ---

export type DepositRecord = {
   account_type_discriminator: number; // u8
   owner_key: Address;
   fee_payer: Address;
   product_id: number; // u16
   deposit_id: bigint; // u64
   amount: bigint; // u64
   min_amount_lp_received: bigint; // u64
   created_at: number; // u32
};

export type WithdrawRecord = {
   account_type_discriminator: number; // u8
   owner_key: Address;
   fee_payer: Address;
   product_id: number; // u16
   withdrawal_id: bigint; // u64
   amount: bigint; // u64
   min_amount_token_received: bigint; // u64
   created_at: number; // u32
};

export type LpReceipt = {
   account_type_discriminator: number; // u8
   owner_key: Address;
   fee_payer: Address;
   product_id: number; // u16
   lp_id: bigint; // u64
   amount: bigint; // u64
   created_at: number; // u32
};

export type InitDepositLiquidityInstruction = {
   amount: bigint; // u64
   min_amount_lp_received: bigint; // u64
   product_id: number; // u16
   deposit_id: bigint; // u64
};

export type InitWithdrawLiquidityInstruction = {
   amount: bigint; // u64
   min_amount_token_received: bigint; // u64
   product_id: number; // u16
   withdraw_id: bigint; // u64
};

// --- Market Types ---

export type MarketIdentifier = {
   product_id: number; // u16
   market_id: bigint; // u64
   category: number; // u8
   sub_category: number; // u16
   event: number; // u32
   other_id_bytes: Uint8Array; // [u8; 7]
   event_start: number; // u32
   market_string: string;
   rules_url: string;
};

export type OutcomeIdentifier = {
   outcome_name: string,
};

export type MarketConfig = {
   product_flat_fee: bigint; // u64
   product_pc_fee: number; // u16
   product_win_fee: number; // u16
   product_performance_fee: number; // u16
   core_flat_fee: bigint; // u64
   core_pc_fee: number; // u16
   core_win_fee: number; // u16
   core_fee_on_product: number; // u16
   status: MarketStatus;
   lock_time: number; // u32
   trim: number; // u16
   resolution_authority: ResolutionAuthority;
};

export type BaseMarketOutcome = {
   outcome_identifier: OutcomeIdentifier;
   outcome_balance: bigint; // u64
   outcome_payout: bigint; // u64
};

/** Controlled market outcome (DirectControlled, AdvControlled, IntControlled). No outcome_balance; balances from oracle. */
export type ControlledMarketOutcome = {
   outcome_identifier: OutcomeIdentifier;
   outcome_risk: bigint; // i64
   outcome_payout: bigint; // u64
};

export type ParlaySettings = {
   parlay_enabled: boolean;
   parlay_odds_factor: number; // u16
   parlay_liquidity_factor: bigint; // u64
   exclude_markets: bigint[]; // Vec<u64>
};

export type Resolution = {
   winning_outcome: number; // u8
   rollback_timestamp: number; // u32
   payout_adjustment: bigint; // i64
};

export type RollbackPeriod = {
   period_start: number; // u32
   period_end: number; // u32
};

export type LiveRollbackAccount = {
   account_type_discriminator: number; // u8
   periods: RollbackPeriod[];
};

export type BaseMarket = {
   account_type_discriminator: number; // u8
   market_type: MarketType;
   market_identifier: MarketIdentifier;
   market_config: MarketConfig;
   resolution: Resolution;
   active_bet_account: bigint; // u64
};

export type UncontrolledMarket = {
   base: BaseMarket;
   outcomes: BaseMarketOutcome[];
};

export type DirectControlledMarket = {
   base: BaseMarket;
   go_live_time: number; // u32
   rollback_account_key: Address;
   outcomes: ControlledMarketOutcome[];
   parlay_settings: ParlaySettings;
};

export type AdvControlledMarket = {
   base: BaseMarket;
   go_live_time: number; // u32
   rollback_account_key: Address;
   max_risk: bigint; // u64
   bonus_cap: number; // u16
   over_risk_penalty: number; // u16
   /** On-chain counter (buy/sell); for pricing, effective liquidity is oracle `ControlledLiquidity.liquidity` when set, else `liquidity * oracle.liquidity_factor / PC_SCALE`. */
   liquidity: bigint; // u64
   outcomes: ControlledMarketOutcome[];
   parlay_settings: ParlaySettings;
};

export type IntControlledMarket = {
   base: BaseMarket;
   go_live_time: number; // u32
   rollback_account_key: Address;
   max_risk: bigint; // u64
   outcomes: ControlledMarketOutcome[];
   parlay_settings: ParlaySettings;
};

export type OneVOneMarket = {
   base: BaseMarket;
   challengers: [Address, Address];
   challenger_balances: [bigint, bigint]; // [u64, u64]
   outcomes: BaseMarketOutcome[];
};

export type OneVManyMarket = {
   base: BaseMarket;
   challenger: Address;
   challenger_amount: bigint; // u64
   challenger_outcome_index: number; // u8
   opposition_amount: bigint; // u64
   outcomes: BaseMarketOutcome[];
};

export type DutchAuctionMarketConfig = {
   trigger_price: number; // u16
   is_decay_active: boolean;
   decay_start_price: number; // u16
   decay_factor_precalc: bigint; // u64
};

export type DutchAuctionMarket = {
   base: BaseMarket;
   config: DutchAuctionMarketConfig;
   outcomes: BaseMarketOutcome[];
};

export type AdvDutchAuctionMarket = {
   base: BaseMarket;
   config: DutchAuctionMarketConfig;
   max_risk: bigint; // u64
   outcomes: BaseMarketOutcome[];
};

// On-chain Market account is a Borsh enum without an inner "value" wrapper.
// Each variant stores the serialized market struct directly after the enum discriminant.
export type Market =
   | ({ __kind: 'Uncontrolled' } & UncontrolledMarket)
   | ({ __kind: 'DirectControlled' } & DirectControlledMarket)
   | ({ __kind: 'AdvControlled' } & AdvControlledMarket)
   | ({ __kind: 'IntControlled' } & IntControlledMarket)
   | ({ __kind: 'OneVOne' } & OneVOneMarket)
   | ({ __kind: 'OneVMany' } & OneVManyMarket)
   | ({ __kind: 'DutchAuction' } & DutchAuctionMarket)
   | ({ __kind: 'AdvDutchAuction' } & AdvDutchAuctionMarket);

export type BaseCreateMarketInstruction = {
   market_identifier: MarketIdentifier;
   lock_time: number; // u32
   trim: number; // u16
   resolution_authority: ResolutionAuthority;
   fee_override: boolean;
   flat_fee: bigint; // u64
   pc_fee: number; // u16
   win_fee: number; // u16
   performance_fee: number; // u16
};

export type CreateUncontrolledMarketInstruction = {
   base: BaseCreateMarketInstruction;
   outcomes: BaseMarketOutcome[];
};

export type CreateDirectControlledMarketInstruction = {
   base: BaseCreateMarketInstruction;
   outcomes: ControlledMarketOutcome[];
   go_live_time: number; // u32
   parlay_settings: ParlaySettings;
};

export type CreateAdvControlledMarketInstruction = {
   base: BaseCreateMarketInstruction;
   outcomes: ControlledMarketOutcome[];
   go_live_time: number; // u32
   max_risk: bigint; // u64
   bonus_cap: number; // u16
   over_risk_penalty: number; // u16
   liquidity: bigint; // u64: initial counter; with FactoredLiquidity oracle, effective L = this * factor / PC_SCALE
   parlay_settings: ParlaySettings;
};

export type CreateIntControlledMarketInstruction = {
   base: BaseCreateMarketInstruction;
   outcomes: ControlledMarketOutcome[];
   go_live_time: number; // u32
   max_risk: bigint; // u64
   parlay_settings: ParlaySettings;
};

export type CreateOneVOneMarketInstruction = {
   base: BaseCreateMarketInstruction;
   outcomes: BaseMarketOutcome[];
   challengers: [Address, Address];
};

export type CreateOneVManyMarketInstruction = {
   base: BaseCreateMarketInstruction;
   outcomes: BaseMarketOutcome[];
   challenger: Address;
   challenger_outcome_index: number; // u8
};

export type CreateDutchAuctionMarketInstruction = {
   base: BaseCreateMarketInstruction;
   outcomes: BaseMarketOutcome[];
   trigger_price: number; // u16
};

export type CreateAdvDutchAuctionMarketInstruction = {
   base: BaseCreateMarketInstruction;
   outcomes: BaseMarketOutcome[];
   trigger_price: number; // u16
   max_risk: bigint; // u64
};

export type CreateMarketInstruction =
   | { __kind: 'Uncontrolled'; value: CreateUncontrolledMarketInstruction }
   | { __kind: 'DirectControlled'; value: CreateDirectControlledMarketInstruction }
   | { __kind: 'AdvControlled'; value: CreateAdvControlledMarketInstruction }
   | { __kind: 'IntControlled'; value: CreateIntControlledMarketInstruction }
   | { __kind: 'OneVOne'; value: CreateOneVOneMarketInstruction }
   | { __kind: 'OneVMany'; value: CreateOneVManyMarketInstruction }
   | { __kind: 'DutchAuction'; value: CreateDutchAuctionMarketInstruction }
   | { __kind: 'AdvDutchAuction'; value: CreateAdvDutchAuctionMarketInstruction };

export type ResolveMarketFromOracleInstruction = {
   outcome_index: null; // Option<u8>
   rollback_timestamp: number; // u32
   payout_adjustment: bigint | null; // Option<i64>
};

export type ResolveMarketFromAdminInstruction = {
   outcome_index: number; // Option<u8>
   rollback_timestamp: number; // u32
   payout_adjustment: bigint | null; // Option<i64>
};

export type ResolveMarketInstruction = ResolveMarketFromOracleInstruction | ResolveMarketFromAdminInstruction;

export type UpdateMarketCoreFeesInstruction = {
   core_flat_fee: bigint | null; // Option<u64>
   core_pc_fee: number | null; // Option<u16>
   core_win_fee: number | null; // Option<u16>
   core_fee_on_product: number | null; // Option<u16>
};

// --- Betting Types ---

export type BetAccount = {
   account_type_discriminator: number; // u8
   bet_type: BetType;
   bet_id: bigint; // u64
   product_id: number; // u16
   market_id: bigint; // u64
   owner_key: Address;
   fee_payer: Address;
   frontend_bytes: Uint8Array; // [u8; 8]
   outcome_index: number; // u8
   amount: bigint; // u64
   potential_return: bigint; // u64
   placed_at: number; // u32
   freebet_id: number; // u32
   is_live: boolean;
};

export type SellRequestAccount = {
   account_type_discriminator: number; // u8
   _padding: number; // u8
   bet_id: bigint; // u64
   product_id: number; // u16
   market_id: bigint; // u64
   owner_key: Address;
   fee_payer: Address;
   outcome_index: number; // u8
   amount: bigint; // u64
   potential_return: bigint; // u64
   created_at: number; // u32
   balance_deltas: bigint[]; // Vec<i64>
};

export type BuyInstruction = {
   amount: bigint; // u64
   min_return: bigint; // u64
   product_id: number; // u16
   market_id: bigint; // u64
   bet_id: bigint; // u64
   outcome_index: number; // u8
   frontend_bytes: Uint8Array; // [u8; 8]
};

export type SellInstruction = {
   amount: bigint; // u64
   min_return: bigint; // u64
   product_id: number; // u16
   market_id: bigint; // u64
   bet_id: bigint; // u64
   outcome_index: number; // u8
};

export type BuyWithFreebetInstruction = {
   amount: bigint; // u64
   min_return: bigint; // u64
   product_id: number; // u16
   market_id: bigint; // u64
   bet_id: bigint; // u64
   outcome_index: number; // u8
   freebet_id: number; // u32
   frontend_bytes: Uint8Array; // [u8; 8]
};

export type SellWithFreebetInstruction = {
   amount: bigint; // u64
   min_return: bigint; // u64
   product_id: number; // u16
   market_id: bigint; // u64
   bet_id: bigint; // u64
   outcome_index: number; // u8
   freebet_id: number; // u32
};

export type ParlayBetAccount = {
   account_type_discriminator: number; // u8
   _padding: number; // u8
   bet_id: bigint; // u64
   product_id: number; // u16
   amount: bigint; // u64
   owner_key: Address;
   fee_payer: Address;
   frontend_bytes: Uint8Array; // [u8; 8]
   potential_return: bigint; // u64
   placed_at: number; // u32
   freebet_id: number; // u32
   is_live: boolean;
   selections: [bigint, number, number][]; // Vec<(u64, u8, u32)>
};

export type ParlaySellRequestAccount = {
   account_type_discriminator: number; // u8
   _padding: number; // u8
   bet_id: bigint; // u64
   product_id: number; // u16
   amount: bigint; // u64
   owner_key: Address;
   fee_payer: Address;
   potential_return: bigint; // u64
   created_at: number; // u32
   selections: [bigint, number, number][]; // Vec<(u64, u8, u32)>
};

export type ParlayBetInstruction = {
   amount: bigint; // u64
   min_return: bigint; // u64
   product_id: number; // u16
   bet_id: bigint; // u64
   freebet_id: number; // u32
   selections: [bigint, number][]; // Vec<(u64, u8)>
   frontend_bytes: Uint8Array; // [u8; 8]
};

export type SellParlayInstruction = {
   amount: bigint; // u64
   min_return: bigint; // u64
   product_id: number; // u16
   bet_id: bigint; // u64
};

// --- Freebet Types ---

export type FreebetAccount = {
   account_type_discriminator: number; // u8
   freebet_id: number; // u32
   owner_key: Address;
   product_id: number; // u16
   amount: bigint; // u64
   expires_at: number; // u32
   is_used: boolean;
   max_return: bigint; // u64
   min_return: bigint; // u64
};

export type GiveFreebetInstruction = {
   freebet_id: number; // u32
   amount: bigint; // u64
   expires_at: number; // u32
   max_return: bigint; // u64
   min_return: bigint; // u64
};

// --- Oracle Types ---

export type OracleAccount = {
   account_type_discriminator: number; // u8
   oracle_updater: Address;
   sequence: number; // u32
   data: OracleDataVariant;
   winning_outcome: number; // u8
};

export type InitOracleInstruction = {
   product_id: number; // u16
   market_id: bigint; // u64
   variant_type: number; // u8
   num_outcomes: number; // u8
};

export type UpdateOracleInstruction = {
   sequence: number; // u32
   oracle_data: Uint8Array;
};

export type UpdateLiveRollbackAccountInstruction = {
   period_start: number; // u32
   period_end: number; // u32
};

// --- Actions Enum (All Instructions) ---

export type Actions =
   // Oracle instructions
   | { __kind: 'UpdateOracle'; value: UpdateOracleInstruction }
   | { __kind: 'InitOracle'; value: InitOracleInstruction }
   | { __kind: 'DeleteOracle' }
   | { __kind: 'SetWinningOutcome'; value: number }
   | { __kind: 'UpdateLiveRollbackAccount'; value: UpdateLiveRollbackAccountInstruction }
   | { __kind: 'RollbackLiveBuy' }
   // Splash admin instructions
   | { __kind: 'InitProgramConfigAccount' }
   | { __kind: 'SetAdminKey' }
   | { __kind: 'SetCoreFlatFee'; value: bigint }
   | { __kind: 'SetCorePcFee'; value: number }
   | { __kind: 'SetCoreWinFee'; value: number }
   | { __kind: 'SetFeeOnProduct'; value: { product_id: number; fee_on_product: number } }
   | { __kind: 'SetCoreStatus'; value: CoreStatus }
   | { __kind: 'CreateProduct'; value: CreateProductInstruction }
   | { __kind: 'RemoveProduct'; value: number }
   | { __kind: 'WithdrawCoreFees'; value: bigint }
   | { __kind: 'AddMultisigSigner'; value: { signer: Address; required_signatures: number } }
   | { __kind: 'RemoveMultisigSigner'; value: { signer: Address; required_signatures: number } }
   // Product admin instructions
   | { __kind: 'SetProductAdminKey'; value: number }
   | { __kind: 'SetProductWithdrawAuthority'; value: number }
   | { __kind: 'SetProductFlatFee'; value: { product_id: number; flat_fee: bigint } }
   | { __kind: 'SetProductPcFee'; value: { product_id: number; pc_fee: number } }
   | { __kind: 'SetProductWinFee'; value: { product_id: number; win_fee: number } }
   | { __kind: 'SetProductStatus'; value: { product_id: number; product_status: ProductStatus } }
   | { __kind: 'WithdrawProductFees'; value: { product_id: number; amount: bigint } }
   | { __kind: 'AddFundsToMarketAta'; value: { product_id: number; amount: bigint } }
   | { __kind: 'SetLpMaxDeposits'; value: { product_id: number; max_deposits: bigint } }
   | { __kind: 'ChangeLpCosigner'; value: number }
   // Liquidity instructions
   | { __kind: 'InitDepositLiquidity'; value: InitDepositLiquidityInstruction }
   | { __kind: 'DepositLiquidity'; value: { product_id: number; deposit_id: bigint } }
   | { __kind: 'CancelDepositLiquidity'; value: { product_id: number; deposit_id: bigint } }
   | { __kind: 'InitWithdrawLiquidity'; value: InitWithdrawLiquidityInstruction }
   | { __kind: 'WithdrawLiquidity'; value: { product_id: number; withdraw_id: bigint } }
   | { __kind: 'CancelWithdrawLiquidity'; value: { product_id: number; withdraw_id: bigint } }
   // Market instructions
   | { __kind: 'CreateMarket'; value: CreateMarketInstruction }
   | { __kind: 'UpdateMarketStatus'; value: MarketStatus }
   | { __kind: 'EditGoLiveTime'; value: { product_id: number; new_go_live_time: number } }
   | { __kind: 'ResolveMarket'; value: ResolveMarketInstruction }
   | { __kind: 'CloseMarket' }
   | { __kind: 'UpdateMarketCoreFees'; value: UpdateMarketCoreFeesInstruction }
   // Freebets instructions
   | { __kind: 'GiveFreebet'; value: GiveFreebetInstruction }
   | { __kind: 'RemoveFreebet' }
   // Betting instructions
   | { __kind: 'BuyFor'; value: BuyInstruction }
   | { __kind: 'BuyAgainst'; value: BuyInstruction }
   | { __kind: 'SellFor'; value: SellInstruction }
   | { __kind: 'SellAgainst'; value: SellInstruction }
   | { __kind: 'HandleSellRequest' }
   | { __kind: 'ClaimPosition' }
   | { __kind: 'BuyForWithFreebet'; value: BuyWithFreebetInstruction }
   | { __kind: 'BuyAgainstWithFreebet'; value: BuyWithFreebetInstruction }
   | { __kind: 'SellForWithFreebet'; value: SellWithFreebetInstruction }
   | { __kind: 'SellAgainstWithFreebet'; value: SellWithFreebetInstruction }
   | { __kind: 'ClaimPositionWithFreebet' }
   | { __kind: 'BuyParlay'; value: ParlayBetInstruction }
   | { __kind: 'SellParlay'; value: SellParlayInstruction }
   | { __kind: 'ClaimParlayPosition' }
   | { __kind: 'HandleSellParlayRequest' }
   // Super admin instructions
   | { __kind: 'ForceChangeProductAdminAndWithdraw'; value: { product_id: number; needs_new_admin_key: boolean; needs_new_withdraw_authority: boolean } }
   | { __kind: 'UnFreezeProductLpToken'; value: { product_id: number; unfreeze: boolean } }
   | { __kind: 'DrainProductFees'; value: number }
   | { __kind: 'DrainProductPool'; value: number }
   | { __kind: 'UnSuspendProduct'; value: { product_id: number; unsuspend: boolean } }
   | { __kind: 'PauseAllMarketsOfProduct'; value: number }
   // DEVNET_ONLY
   | { __kind: 'DevnetForceMoveTokens'; value: { amount: bigint; auth_seeds: Uint8Array; auth_bump: number } }
   | { __kind: 'DevnetCloseAccount' };


export type Rpcs = {
   rpc: Rpc<SolanaRpcApi>;
   rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
}

export type InstructionWithId = {
   id: string;
   instruction: Instruction;
}

export type InstructionGroup = {
   id: string;
   instructions: InstructionWithId[];
}

export type InstructionStatus = 'successful' | 'failed' | 'cancelled';

export type InstructionResult = {
   instructionId: string;
   groupId: string;
   status: InstructionStatus;
   signature?: Signature;
   error?: Error;
}

export type TransactionExecutionResult = {
   allSucceeded: boolean;
   successfulGroups: string[];
   failedGroups: string[];
   cancelledGroups: string[];
   partiallySuccessfulGroups: string[];
   signatures: Signature[];
   signaturesByGroup: Map<string, Signature[]>;
   instructionResults: InstructionResult[];
   errors: Map<string, Error>;
}

export type Account =
   | { __kind: 'CoreConfigAccount'; value: CoreConfigAccount }
   | { __kind: 'ProductListAccount'; value: ProductListAccount }
   | { __kind: 'ProductConfigAccount'; value: ProductConfigAccount }
   | { __kind: 'Market'; value: Market }
   | { __kind: 'LiveRollbackAccount'; value: LiveRollbackAccount }
   | { __kind: 'OracleAccount'; value: OracleAccount }
   | { __kind: 'BetAccount'; value: BetAccount }
   | { __kind: 'SellRequestAccount'; value: SellRequestAccount }
   | { __kind: 'ParlayBetAccount'; value: ParlayBetAccount }
   | { __kind: 'ParlaySellRequestAccount'; value: ParlaySellRequestAccount }
   | { __kind: 'DepositRecord'; value: DepositRecord }
   | { __kind: 'WithdrawRecord'; value: WithdrawRecord }
   | { __kind: 'LpReceipt'; value: LpReceipt }
   | { __kind: 'FreebetAccount'; value: FreebetAccount };