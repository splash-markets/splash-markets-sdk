// Constants for Splash Markets Program
import { Address } from '@solana/kit';
import { stringToUint8Array } from './utils';

// Program Address (to be set when deployed)
export const PROGRAM_ADDR: Address = '5p1AshJzXzerkwr4rVcqTrRfWSsLS1RvDpFeB6BCMq4w' as Address; // TODO: Update with actual program address

// System Program Addresses
export const SYSTEM_PROGRAM_ADDR: Address = '11111111111111111111111111111111' as Address;
export const TOKEN_PROGRAM_ADDR: Address = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
export const TOKEN_2022_PROGRAM_ADDR: Address = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
export const ASSOCIATED_TOKEN_PROGRAM_ADDR: Address = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
export const RENT_SYSVAR_ADDR: Address = 'SysvarRent111111111111111111111111111111111' as Address;

// Account Type Discriminators
export const CORE_CONFIG_ACCOUNT_TYPE = 0;
export const PRODUCT_LIST_ACCOUNT_TYPE = 1;
export const PRODUCT_CONFIG_ACCOUNT_TYPE = 2;
export const MARKET_ACCOUNT_TYPE = 3;
export const LIVE_ROLLBACK_ACCOUNT_TYPE = 4;
export const ORACLE_ACCOUNT_TYPE = 5;
export const BET_ACCOUNT_TYPE = 6;
export const SELL_REQUEST_ACCOUNT_TYPE = 7;
export const PARLAY_BET_ACCOUNT_TYPE = 8;
export const PARLAY_SELL_REQUEST_ACCOUNT_TYPE = 9;
export const DEPOSIT_RECORD_ACCOUNT_TYPE = 10;
export const WITHDRAW_RECORD_ACCOUNT_TYPE = 11;
export const LP_RECEIPT_ACCOUNT_TYPE = 12;
export const FREEBET_ACCOUNT_TYPE = 13;


// Account Seeds (PDA seeds) - matching src/shared/constants.rs
export const ORACLE_ACCOUNT_SEED = stringToUint8Array('oracle');
export const CORE_CONFIG_SEED = stringToUint8Array('program_config');
export const PRODUCT_CONFIG_SEED = stringToUint8Array('product_config');
export const PRODUCT_POOL_SEED = stringToUint8Array('product_pool');
export const PRODUCT_FEES_SEED = stringToUint8Array('product_fees');
export const PRODUCT_FB_SEED = stringToUint8Array('product_fb');
export const PRODUCT_LIST_SEED = stringToUint8Array('product_list');
export const LP_TOKEN_MINT_SEED = stringToUint8Array('lp_token_mint');
export const LP_RECEIPT_SEED = stringToUint8Array('lp_receipt');
export const DEPOSIT_RECORD_SEED = stringToUint8Array('deposit_record');
export const WITHDRAW_RECORD_SEED = stringToUint8Array('withdraw_record');
export const MARKET_SEED = stringToUint8Array('market');
export const MARKET_LIVE_ROLLBACK_SEED = stringToUint8Array('market_live_rollback');
export const BET_SEED = stringToUint8Array('bet');
export const PARLAY_BET_SEED = stringToUint8Array('parlay_bet');
export const SELL_REQUEST_SEED = stringToUint8Array('sell_request');
export const FREEBET_SEED = stringToUint8Array('freebet');

// Number Formatting / Scaling Factors (matching program constants)
export const RATIO_SCALE: bigint = 1_000_000n; // 10^6 - fixed-point scale for lp_ratio and other ratio calculations
export const PC_SCALE: number = 10_000; // 10^4 - percentages, oracle probabilities, liquidity factor (1% = 100)

// Betting Config
export const LIVE_BETTING_DELAY = 10; // 10 seconds

// Token Account Size
export const TOKEN_ACCOUNT_SIZE = 165;

// Fixed Keys (to be set when deployed)
export const CORE_CONFIG_ADDR: Address = 'EQ7Z6MDR9oV4m32Y93i5m9pEHRzGi4MXptUzQMnauVBo' as Address; // derived from PDA with seed CORE_CONFIG_SEED
/** Sentinel address used as default for optional accounts (e.g. rollback PDA when not used). */
export const DEFAULT_ADDRESS: Address = '11111111111111111111111111111111' as Address;

export const ADMIN_ADDRESS: Address = '6wWGxzXXUkH11MLFXmj2ibn6ycHrXyrT6unZF1NG2JXr' as Address;

export const DUMMYUSDC_MINT_ADDRESS: Address = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr' as Address;