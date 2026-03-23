// Solana Kit codec definitions for Splash Markets Program
import {
   Encoder,
   Decoder,
   getStructEncoder,
   getStructDecoder,
   getTupleEncoder,
   getTupleDecoder,
   getDiscriminatedUnionEncoder,
   getDiscriminatedUnionDecoder,
   getBooleanEncoder,
   getBooleanDecoder,
   getU8Encoder,
   getU8Decoder,
   getU16Encoder,
   getU16Decoder,
   getU32Encoder,
   getU32Decoder,
   getU64Encoder,
   getU64Decoder,
   getI64Encoder,
   getI64Decoder,
   getBytesEncoder,
   getBytesDecoder,
   addEncoderSizePrefix,
   addDecoderSizePrefix,
   transformEncoder,
   transformDecoder,
   getArrayEncoder,
   getArrayDecoder,
   ReadonlyUint8Array,
} from '@solana/codecs';
import { getAddressEncoder, getAddressDecoder, Address } from '@solana/kit';
import * as types from './types';
import {
   CORE_CONFIG_ACCOUNT_TYPE,
   PRODUCT_LIST_ACCOUNT_TYPE,
   PRODUCT_CONFIG_ACCOUNT_TYPE,
   MARKET_ACCOUNT_TYPE,
   LIVE_ROLLBACK_ACCOUNT_TYPE,
   ORACLE_ACCOUNT_TYPE,
   BET_ACCOUNT_TYPE,
   SELL_REQUEST_ACCOUNT_TYPE,
   PARLAY_BET_ACCOUNT_TYPE,
   PARLAY_SELL_REQUEST_ACCOUNT_TYPE,
   DEPOSIT_RECORD_ACCOUNT_TYPE,
   WITHDRAW_RECORD_ACCOUNT_TYPE,
   LP_RECEIPT_ACCOUNT_TYPE,
   FREEBET_ACCOUNT_TYPE,
} from './constants';


// Helper for string encoding/decoding
const stringEncoder = transformEncoder(
   addEncoderSizePrefix(getBytesEncoder(), getU32Encoder()),
   (s: string) => new TextEncoder().encode(s)
);
const stringDecoder = transformDecoder(
   addDecoderSizePrefix(getBytesDecoder(), getU32Decoder()),
   (v) => new TextDecoder().decode(new Uint8Array(v))
);

// u64 and i64 use bigint; u32 uses number
const getU64BigintEncoder = getU64Encoder;
const getU64BigintDecoder = getU64Decoder;

const getI64BigintEncoder = getI64Encoder;
const getI64BigintDecoder = getI64Decoder;

// --- Enum Codecs ---

const getMarketStatusEncoder = (): Encoder<types.MarketStatus> =>
   transformEncoder(
      getU8Encoder(),
      (status: types.MarketStatus) => {
         switch (status.__kind) {
            case 'Prematch': return 0;
            case 'Live': return 1;
            case 'Paused': return 2;
            case 'PendingResolution': return 3;
            case 'PendingFullfillment': return 4;
            default: return 0;
         }
      }
   );
const getMarketStatusDecoder = (): Decoder<types.MarketStatus> =>
   transformDecoder(
      getU8Decoder(),
      (value: number): types.MarketStatus => {
         switch (value) {
            case 0: return { __kind: 'Prematch' };
            case 1: return { __kind: 'Live' };
            case 2: return { __kind: 'Paused' };
            case 3: return { __kind: 'PendingResolution' };
            case 4: return { __kind: 'PendingFullfillment' };
            default: return { __kind: 'Prematch' };
         }
      }
   );

const getMarketTypeEncoder = (): Encoder<types.MarketType> =>
   transformEncoder(
      getU8Encoder(),
      (type: types.MarketType) => {
         switch (type.__kind) {
            case 'Uncontrolled': return 0;
            case 'DirectControlled': return 1;
            case 'IntControlled': return 2;
            case 'AdvControlled': return 3;
            case 'OneVOne': return 4;
            case 'OneVMany': return 5;
            case 'DutchAuction': return 6;
            case 'AdvDutchAuction': return 7;
            default: return 0;
         }
      }
   );
const getMarketTypeDecoder = (): Decoder<types.MarketType> =>
   transformDecoder(
      getU8Decoder(),
      (value: number): types.MarketType => {
         switch (value) {
            case 0: return { __kind: 'Uncontrolled' };
            case 1: return { __kind: 'DirectControlled' };
            case 2: return { __kind: 'IntControlled' };
            case 3: return { __kind: 'AdvControlled' };
            case 4: return { __kind: 'OneVOne' };
            case 5: return { __kind: 'OneVMany' };
            case 6: return { __kind: 'DutchAuction' };
            case 7: return { __kind: 'AdvDutchAuction' };
            default: return { __kind: 'Uncontrolled' };
         }
      }
   );

const getCoreStatusEncoder = (): Encoder<types.CoreStatus> =>
   transformEncoder(
      getU8Encoder(),
      (status: types.CoreStatus) => status.__kind === 'PAUSED' ? 0 : 1
   );
const getCoreStatusDecoder = (): Decoder<types.CoreStatus> =>
   transformDecoder(
      getU8Decoder(),
      (value: number): types.CoreStatus => value === 0 ? { __kind: 'PAUSED' } : { __kind: 'ACTIVE' }
   );

const getProductStatusEncoder = (): Encoder<types.ProductStatus> =>
   transformEncoder(
      getU8Encoder(),
      (status: types.ProductStatus) => {
         switch (status.__kind) {
            case 'PAUSED': return 0;
            case 'ACTIVE': return 1;
            case 'SUSPENDED': return 2;
            default: return 0;
         }
      }
   );
const getProductStatusDecoder = (): Decoder<types.ProductStatus> =>
   transformDecoder(
      getU8Decoder(),
      (value: number): types.ProductStatus => {
         switch (value) {
            case 0: return { __kind: 'PAUSED' };
            case 1: return { __kind: 'ACTIVE' };
            case 2: return { __kind: 'SUSPENDED' };
            default: return { __kind: 'PAUSED' };
         }
      }
   );

const getBetTypeDecoder = (): Decoder<types.BetType> =>
   transformDecoder(
      getU8Decoder(),
      (value: number): types.BetType => value === 0 ? { __kind: 'For' } : { __kind: 'Against' }
   );

export const getOracleDataVariantEncoder = (): Encoder<types.OracleDataVariant> =>
   transformEncoder(
      getDiscriminatedUnionEncoder([
         ['ControlledLiquidity', getStructEncoder([
            ['probabilities', getArrayEncoder(getU16Encoder())],
            ['liquidity', getU64BigintEncoder()],
         ])],
         ['FactoredLiquidity', getStructEncoder([
            ['probabilities', getArrayEncoder(getU16Encoder())],
            ['liquidity_factor', getU16Encoder()],
         ])],
         ['Resolution', getStructEncoder([])],
      ], { size: getU8Encoder() }),
      (variant: types.OracleDataVariant) => {
         if (variant.__kind === 'ControlledLiquidity') {
            return { __kind: 'ControlledLiquidity' as const, probabilities: variant.probabilities, liquidity: variant.liquidity };
         } else if (variant.__kind === 'FactoredLiquidity') {
            return { __kind: 'FactoredLiquidity' as const, probabilities: variant.probabilities, liquidity_factor: variant.liquidity_factor };
         } else {
            return { __kind: 'Resolution' as const };
         }
      }
   );
const getOracleDataVariantDecoder = (): Decoder<types.OracleDataVariant> =>
   transformDecoder(
      getDiscriminatedUnionDecoder([
         ['ControlledLiquidity', getStructDecoder([
            ['probabilities', getArrayDecoder(getU16Decoder())],
            ['liquidity', getU64BigintDecoder()],
         ])],
         ['FactoredLiquidity', getStructDecoder([
            ['probabilities', getArrayDecoder(getU16Decoder())],
            ['liquidity_factor', getU16Decoder()],
         ])],
         ['Resolution', getStructDecoder([])],
      ], { size: getU8Decoder() }),
      (value: { __kind: string; probabilities?: number[]; liquidity?: bigint; liquidity_factor?: number }): types.OracleDataVariant => {
         if (value.__kind === 'ControlledLiquidity') {
            return { __kind: 'ControlledLiquidity' as const, probabilities: value.probabilities!, liquidity: value.liquidity! };
         } else if (value.__kind === 'FactoredLiquidity') {
            return { __kind: 'FactoredLiquidity' as const, probabilities: value.probabilities!, liquidity_factor: value.liquidity_factor! };
         } else {
            return { __kind: 'Resolution' as const };
         }
      }
   );

// --- Core Codecs ---

export const getCoreMultisigSetupDecoder = (): Decoder<types.CoreMultisigSetup> =>
   getStructDecoder([
      ['required_signatures', getU8Decoder()],
      ['signers', getArrayDecoder(getAddressDecoder())],
   ]);

export const getCoreConfigAccountDecoder = (): Decoder<types.CoreConfigAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['admin_key', getAddressDecoder()],
      ['core_flat_fee', getU64BigintDecoder()],
      ['core_pc_fee', getU16Decoder()],
      ['core_win_fee', getU16Decoder()],
      ['core_status', getCoreStatusDecoder()],
      ['core_multisig_setup', getCoreMultisigSetupDecoder()],
   ]);

const getProductInfoDecoder = (): Decoder<types.ProductInfo> =>
   getStructDecoder([
      ['product_id', getU16Decoder()],
      ['product_name', stringDecoder],
   ]);

export const getProductListAccountDecoder = (): Decoder<types.ProductListAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['products', getArrayDecoder(getProductInfoDecoder())],
   ]);

const getCreateProductInstructionEncoder = (): Encoder<types.CreateProductInstruction> =>
   getStructEncoder([
      ['product_id', getU16Encoder()],
      ['product_name', stringEncoder],
      ['admin_key', getAddressEncoder()],
      ['liquid_token', getBooleanEncoder()],
      ['cosigner_key', transformEncoder(
         getDiscriminatedUnionEncoder([
            ['None', getStructEncoder([])],
            ['Some', getStructEncoder([['value', getAddressEncoder()]])],
         ], { size: getU8Encoder() }),
         (value: Address | null) => value === null ? { __kind: 'None' as const } : { __kind: 'Some' as const, value }
      )],
      ['core_performance_fee', getU16Encoder()],
      ['core_fee_on_product', getU16Encoder()],
   ]);

// --- Product Codecs ---


const getLpConfigDecoder = (): Decoder<types.LpConfig> =>
   getStructDecoder([
      ['liquid_token', getBooleanDecoder()],
      ['deposit_delay', getU32Decoder()],
      ['withdraw_delay', getU32Decoder()],
      ['cosigner_key', getAddressDecoder()],
      ['virtual_balance', getU64BigintDecoder()],
      ['max_deposits', getU64BigintDecoder()],
   ]);

export const getProductConfigAccountDecoder = (): Decoder<types.ProductConfigAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['product_id', getU16Decoder()],
      ['admin_key', getAddressDecoder()],
      ['withdraw_authority', getAddressDecoder()],
      ['token_mint', getAddressDecoder()],
      ['product_flat_fee', getU64BigintDecoder()],
      ['product_pc_fee', getU16Decoder()],
      ['product_win_fee', getU16Decoder()],
      ['product_performance_fee', getU16Decoder()],
      ['product_status', getProductStatusDecoder()],
      ['core_performance_fee', getU16Decoder()],
      ['core_fee_on_product', getU16Decoder()],
      ['lp_config', getLpConfigDecoder()],
   ]);

// --- Liquidity Codecs ---

export const getDepositRecordDecoder = (): Decoder<types.DepositRecord> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['owner_key', getAddressDecoder()],
      ['fee_payer', getAddressDecoder()],
      ['product_id', getU16Decoder()],
      ['deposit_id', getU64BigintDecoder()],
      ['amount', getU64BigintDecoder()],
      ['min_amount_lp_received', getU64BigintDecoder()],
      ['created_at', getU32Decoder()],
   ]);

export const getWithdrawRecordDecoder = (): Decoder<types.WithdrawRecord> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['owner_key', getAddressDecoder()],
      ['fee_payer', getAddressDecoder()],
      ['product_id', getU16Decoder()],
      ['withdrawal_id', getU64BigintDecoder()],
      ['amount', getU64BigintDecoder()],
      ['min_amount_token_received', getU64BigintDecoder()],
      ['created_at', getU32Decoder()],
   ]);

export const getLpReceiptDecoder = (): Decoder<types.LpReceipt> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['owner_key', getAddressDecoder()],
      ['fee_payer', getAddressDecoder()],
      ['product_id', getU16Decoder()],
      ['lp_id', getU64BigintDecoder()],
      ['amount', getU64BigintDecoder()],
      ['created_at', getU32Decoder()],
   ]);

const getInitDepositLiquidityInstructionEncoder = (): Encoder<types.InitDepositLiquidityInstruction> =>
   getStructEncoder([
      ['amount', getU64BigintEncoder()],
      ['min_amount_lp_received', getU64BigintEncoder()],
      ['product_id', getU16Encoder()],
      ['deposit_id', getU64BigintEncoder()],
   ]);

const getInitWithdrawLiquidityInstructionEncoder = (): Encoder<types.InitWithdrawLiquidityInstruction> =>
   getStructEncoder([
      ['amount', getU64BigintEncoder()],
      ['min_amount_token_received', getU64BigintEncoder()],
      ['product_id', getU16Encoder()],
      ['withdraw_id', getU64BigintEncoder()],
   ]);

// --- Market Codecs ---

const getMarketIdentifierEncoder = (): Encoder<types.MarketIdentifier> =>
   getStructEncoder([
      ['product_id', getU16Encoder()],
      ['market_id', getU64BigintEncoder()],
      ['category', getU8Encoder()],
      ['sub_category', getU16Encoder()],
      ['event', getU32Encoder()],
      ['other_id_bytes', transformEncoder(
         getArrayEncoder(getU8Encoder(), { size: 7 }),
         (v: Uint8Array) => Array.from(v)
      )],
      ['event_start', getU32Encoder()],
      ['market_string', stringEncoder],
      ['rules_url', stringEncoder],
   ]);
const getMarketIdentifierDecoder = (): Decoder<types.MarketIdentifier> =>
   getStructDecoder([
      ['product_id', getU16Decoder()],
      ['market_id', getU64BigintDecoder()],
      ['category', getU8Decoder()],
      ['sub_category', getU16Decoder()],
      ['event', getU32Decoder()],
      ['other_id_bytes', transformDecoder(
         getArrayDecoder(getU8Decoder(), { size: 7 }),
         (v: number[]) => new Uint8Array(v)
      )],
      ['event_start', getU32Decoder()],
      ['market_string', stringDecoder],
      ['rules_url', stringDecoder],
   ]);

const getOutcomeIdentifierEncoder = (): Encoder<types.OutcomeIdentifier> =>
   getStructEncoder([
      ['outcome_name', stringEncoder],
   ]);
const getOutcomeIdentifierDecoder = (): Decoder<types.OutcomeIdentifier> =>
   getStructDecoder([
      ['outcome_name', stringDecoder],
   ]);

export const getResolutionMethodEncoder = (): Encoder<types.ResolutionMethod> =>
   transformEncoder(
      getU8Encoder(),
      (method: types.ResolutionMethod) => (method.__kind === 'Oracle' ? 0 : 1)
   );
export const getResolutionMethodDecoder = (): Decoder<types.ResolutionMethod> =>
   transformDecoder(
      getU8Decoder(),
      (value: number): types.ResolutionMethod =>
         value === 0 ? { __kind: 'Oracle' } : { __kind: 'Manual' }
   );

export const getResolutionAuthorityEncoder = (): Encoder<types.ResolutionAuthority> =>
   getStructEncoder([
      ['method', getResolutionMethodEncoder()],
      ['account', getAddressEncoder()],
   ]);
export const getResolutionAuthorityDecoder = (): Decoder<types.ResolutionAuthority> =>
   getStructDecoder([
      ['method', getResolutionMethodDecoder()],
      ['account', getAddressDecoder()],
   ]);

const getMarketConfigDecoder = (): Decoder<types.MarketConfig> =>
   getStructDecoder([
      ['product_flat_fee', getU64BigintDecoder()],
      ['product_pc_fee', getU16Decoder()],
      ['product_win_fee', getU16Decoder()],
      ['product_performance_fee', getU16Decoder()],
      ['core_flat_fee', getU64BigintDecoder()],
      ['core_pc_fee', getU16Decoder()],
      ['core_win_fee', getU16Decoder()],
      ['core_fee_on_product', getU16Decoder()],
      ['status', getMarketStatusDecoder()],
      ['lock_time', getU32Decoder()],
      ['trim', getU16Decoder()],
      ['resolution_authority', getResolutionAuthorityDecoder()],
   ]);

const getBaseMarketOutcomeEncoder = (): Encoder<types.BaseMarketOutcome> =>
   getStructEncoder([
      ['outcome_identifier', getOutcomeIdentifierEncoder()],
      ['outcome_balance', getU64BigintEncoder()],
      ['outcome_payout', getU64BigintEncoder()],
   ]);
const getBaseMarketOutcomeDecoder = (): Decoder<types.BaseMarketOutcome> =>
   getStructDecoder([
      ['outcome_identifier', getOutcomeIdentifierDecoder()],
      ['outcome_balance', getU64BigintDecoder()],
      ['outcome_payout', getU64BigintDecoder()],
   ]);

const getParlaySettingsEncoder = (): Encoder<types.ParlaySettings> =>
   getStructEncoder([
      ['parlay_enabled', getBooleanEncoder()],
      ['parlay_odds_factor', getU16Encoder()],
      ['parlay_liquidity_factor', getU64BigintEncoder()],
      ['exclude_markets', getArrayEncoder(getU64BigintEncoder())],
   ]);
const getParlaySettingsDecoder = (): Decoder<types.ParlaySettings> =>
   getStructDecoder([
      ['parlay_enabled', getBooleanDecoder()],
      ['parlay_odds_factor', getU16Decoder()],
      ['parlay_liquidity_factor', getU64BigintDecoder()],
      ['exclude_markets', getArrayDecoder(getU64BigintDecoder())],
   ]);

const getControlledMarketOutcomeEncoder = (): Encoder<types.ControlledMarketOutcome> =>
   getStructEncoder([
      ['outcome_identifier', getOutcomeIdentifierEncoder()],
      ['outcome_risk', getI64BigintEncoder()],
      ['outcome_payout', getU64BigintEncoder()],
   ]);
const getControlledMarketOutcomeDecoder = (): Decoder<types.ControlledMarketOutcome> =>
   getStructDecoder([
      ['outcome_identifier', getOutcomeIdentifierDecoder()],
      ['outcome_risk', getI64BigintDecoder()],
      ['outcome_payout', getU64BigintDecoder()],
   ]);

const getResolutionDecoder = (): Decoder<types.Resolution> =>
   getStructDecoder([
      ['winning_outcome', getU8Decoder()],
      ['rollback_timestamp', getU32Decoder()],
      ['payout_adjustment', getI64BigintDecoder()],
   ]);

const getRollbackPeriodDecoder = (): Decoder<types.RollbackPeriod> =>
   getStructDecoder([
      ['period_start', getU32Decoder()],
      ['period_end', getU32Decoder()],
   ]);

export const getLiveRollbackAccountDecoder = (): Decoder<types.LiveRollbackAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['periods', getArrayDecoder(getRollbackPeriodDecoder())],
   ]);

const getBaseMarketDecoder = (): Decoder<types.BaseMarket> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['market_type', getMarketTypeDecoder()],
      ['market_identifier', getMarketIdentifierDecoder()],
      ['market_config', getMarketConfigDecoder()],
      ['resolution', getResolutionDecoder()],
      ['active_bet_account', getU64BigintDecoder()],
   ]);

const getUncontrolledMarketDecoder = (): Decoder<types.UncontrolledMarket> =>
   getStructDecoder([
      ['base', getBaseMarketDecoder()],
      ['outcomes', getArrayDecoder(getBaseMarketOutcomeDecoder())],
   ]);

const getDirectControlledMarketDecoder = (): Decoder<types.DirectControlledMarket> =>
   getStructDecoder([
      ['base', getBaseMarketDecoder()],
      ['go_live_time', getU32Decoder()],
      ['rollback_account_key', getAddressDecoder()],
      ['outcomes', getArrayDecoder(getControlledMarketOutcomeDecoder())],
      ['parlay_settings', getParlaySettingsDecoder()],
   ]);

const getAdvControlledMarketDecoder = (): Decoder<types.AdvControlledMarket> =>
   getStructDecoder([
      ['base', getBaseMarketDecoder()],
      ['go_live_time', getU32Decoder()],
      ['rollback_account_key', getAddressDecoder()],
      ['max_risk', getU64BigintDecoder()],
      ['bonus_cap', getU16Decoder()],
      ['over_risk_penalty', getU16Decoder()],
      ['liquidity', getU64BigintDecoder()],
      ['outcomes', getArrayDecoder(getControlledMarketOutcomeDecoder())],
      ['parlay_settings', getParlaySettingsDecoder()],
   ]);

const getIntControlledMarketDecoder = (): Decoder<types.IntControlledMarket> =>
   getStructDecoder([
      ['base', getBaseMarketDecoder()],
      ['go_live_time', getU32Decoder()],
      ['rollback_account_key', getAddressDecoder()],
      ['max_risk', getU64BigintDecoder()],
      ['outcomes', getArrayDecoder(getControlledMarketOutcomeDecoder())],
      ['parlay_settings', getParlaySettingsDecoder()],
   ]);

const getOneVOneMarketDecoder = (): Decoder<types.OneVOneMarket> =>
   transformDecoder(
      getStructDecoder([
         ['base', getBaseMarketDecoder()],
         ['challengers', getTupleDecoder([getAddressDecoder(), getAddressDecoder()])],
         ['challenger_balances', getTupleDecoder([getU64BigintDecoder(), getU64BigintDecoder()])],
         ['outcomes', getArrayDecoder(getBaseMarketOutcomeDecoder())],
      ]),
      (value: { challengers: readonly [Address, Address]; challenger_balances: readonly [bigint, bigint]; base: types.BaseMarket; outcomes: types.BaseMarketOutcome[] }): types.OneVOneMarket => ({
         ...value,
         challengers: [value.challengers[0], value.challengers[1]] as [Address, Address],
         challenger_balances: [value.challenger_balances[0], value.challenger_balances[1]] as [bigint, bigint],
      })
   );

const getOneVManyMarketDecoder = (): Decoder<types.OneVManyMarket> =>
   getStructDecoder([
      ['base', getBaseMarketDecoder()],
      ['challenger', getAddressDecoder()],
      ['challenger_amount', getU64BigintDecoder()],
      ['challenger_outcome_index', getU8Decoder()],
      ['opposition_amount', getU64BigintDecoder()],
      ['outcomes', getArrayDecoder(getBaseMarketOutcomeDecoder())],
   ]);

const getDutchAuctionMarketConfigDecoder = (): Decoder<types.DutchAuctionMarketConfig> =>
   getStructDecoder([
      ['trigger_price', getU16Decoder()],
      ['is_decay_active', getBooleanDecoder()],
      ['decay_start_price', getU16Decoder()],
      ['decay_factor_precalc', getU64BigintDecoder()],
   ]);

const getDutchAuctionMarketDecoder = (): Decoder<types.DutchAuctionMarket> =>
   getStructDecoder([
      ['base', getBaseMarketDecoder()],
      ['config', getDutchAuctionMarketConfigDecoder()],
      ['outcomes', getArrayDecoder(getBaseMarketOutcomeDecoder())],
   ]);

const getAdvDutchAuctionMarketDecoder = (): Decoder<types.AdvDutchAuctionMarket> =>
   getStructDecoder([
      ['base', getBaseMarketDecoder()],
      ['config', getDutchAuctionMarketConfigDecoder()],
      ['max_risk', getU64BigintDecoder()],
      ['outcomes', getArrayDecoder(getBaseMarketOutcomeDecoder())],
   ]);

// Custom Market encoder/decoder that matches Rust format:
// Account stores struct directly (no Market enum wrapper)
// Layout: [account_type_discriminator, market_type, ...rest of struct]
export const getMarketDecoder = (): Decoder<types.Market> => {
   const decodeMarket = (bytes: any, offset?: number): types.Market => {
      const startOffset = offset ?? 0;
      // Peek at market_type byte (offset 1, after account_type_discriminator)
      if (bytes.length < startOffset + 2) {
         throw new Error('Market account data too short');
      }
      const marketTypeValue = bytes[startOffset + 1];
      const bytesArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      
      // Decode the full struct based on market_type
      switch (marketTypeValue) {
         case 0: { // Uncontrolled
            const uncontrolled = getUncontrolledMarketDecoder().decode(bytesArray, offset);
            return { __kind: 'Uncontrolled', ...uncontrolled };
         }
         case 1: { // DirectControlled
            const directControlled = getDirectControlledMarketDecoder().decode(bytesArray, offset);
            return { __kind: 'DirectControlled', ...directControlled };
         }
         case 2: { // IntControlled
            const intControlled = getIntControlledMarketDecoder().decode(bytesArray, offset);
            return { __kind: 'IntControlled', ...intControlled };
         }
         case 3: { // AdvControlled
            const advControlled = getAdvControlledMarketDecoder().decode(bytesArray, offset);
            return { __kind: 'AdvControlled', ...advControlled };
         }
         case 4: { // OneVOne
            const oneVOne = getOneVOneMarketDecoder().decode(bytesArray, offset);
            return { __kind: 'OneVOne', ...oneVOne };
         }
         case 5: { // OneVMany
            const oneVMany = getOneVManyMarketDecoder().decode(bytesArray, offset);
            return { __kind: 'OneVMany', ...oneVMany };
         }
         case 6: { // DutchAuction
            const dutchAuction = getDutchAuctionMarketDecoder().decode(bytesArray, offset);
            return { __kind: 'DutchAuction', ...dutchAuction };
         }
         case 7: { // AdvDutchAuction
            const advDutchAuction = getAdvDutchAuctionMarketDecoder().decode(bytesArray, offset);
            return { __kind: 'AdvDutchAuction', ...advDutchAuction };
         }
         default:
            throw new Error(`Unknown market type: ${marketTypeValue}`);
      }
   };
   
   return {
      decode: decodeMarket,
      read: (bytes: any, offset: number) => {
         const value = decodeMarket(bytes, offset);
         // Since Market is variable size, we can't easily determine the exact size
         // Return the full remaining bytes as the size (this is a limitation but works for account reading)
         return [value, bytes.length];
      },
      fixedSize: undefined,
      maxSize: undefined,
   };
};

const getBaseCreateMarketInstructionEncoder = (): Encoder<types.BaseCreateMarketInstruction> =>
   getStructEncoder([
      ['market_identifier', getMarketIdentifierEncoder()],
      ['lock_time', getU32Encoder()],
      ['trim', getU16Encoder()],
      ['resolution_authority', getResolutionAuthorityEncoder()],
      ['fee_override', getBooleanEncoder()],
      ['flat_fee', getU64BigintEncoder()],
      ['pc_fee', getU16Encoder()],
      ['win_fee', getU16Encoder()],
      ['performance_fee', getU16Encoder()],
   ]);

const getCreateUncontrolledMarketInstructionEncoder = (): Encoder<types.CreateUncontrolledMarketInstruction> =>
   getStructEncoder([
      ['base', getBaseCreateMarketInstructionEncoder()],
      ['outcomes', getArrayEncoder(getBaseMarketOutcomeEncoder())],
   ]);

const getCreateDirectControlledMarketInstructionEncoder = (): Encoder<types.CreateDirectControlledMarketInstruction> =>
   getStructEncoder([
      ['base', getBaseCreateMarketInstructionEncoder()],
      ['outcomes', getArrayEncoder(getControlledMarketOutcomeEncoder())],
      ['go_live_time', getU32Encoder()],
      ['parlay_settings', getParlaySettingsEncoder()],
   ]);

const getCreateAdvControlledMarketInstructionEncoder = (): Encoder<types.CreateAdvControlledMarketInstruction> =>
   getStructEncoder([
      ['base', getBaseCreateMarketInstructionEncoder()],
      ['outcomes', getArrayEncoder(getControlledMarketOutcomeEncoder())],
      ['go_live_time', getU32Encoder()],
      ['max_risk', getU64BigintEncoder()],
      ['bonus_cap', getU16Encoder()],
      ['over_risk_penalty', getU16Encoder()],
      ['liquidity', getU64BigintEncoder()],
      ['parlay_settings', getParlaySettingsEncoder()],
   ]);

const getCreateIntControlledMarketInstructionEncoder = (): Encoder<types.CreateIntControlledMarketInstruction> =>
   getStructEncoder([
      ['base', getBaseCreateMarketInstructionEncoder()],
      ['outcomes', getArrayEncoder(getControlledMarketOutcomeEncoder())],
      ['go_live_time', getU32Encoder()],
      ['max_risk', getU64BigintEncoder()],
      ['parlay_settings', getParlaySettingsEncoder()],
   ]);

const getCreateOneVOneMarketInstructionEncoder = (): Encoder<types.CreateOneVOneMarketInstruction> =>
   transformEncoder(
      getStructEncoder([
         ['base', getBaseCreateMarketInstructionEncoder()],
         ['outcomes', getArrayEncoder(getBaseMarketOutcomeEncoder())],
         ['challengers', getTupleEncoder([getAddressEncoder(), getAddressEncoder()])],
      ]),
      (value: types.CreateOneVOneMarketInstruction) => ({
         ...value,
         challengers: value.challengers as [Address, Address],
      })
   );

const getCreateOneVManyMarketInstructionEncoder = (): Encoder<types.CreateOneVManyMarketInstruction> =>
   getStructEncoder([
      ['base', getBaseCreateMarketInstructionEncoder()],
      ['outcomes', getArrayEncoder(getBaseMarketOutcomeEncoder())],
      ['challenger', getAddressEncoder()],
      ['challenger_outcome_index', getU8Encoder()],
   ]);

const getCreateDutchAuctionMarketInstructionEncoder = (): Encoder<types.CreateDutchAuctionMarketInstruction> =>
   getStructEncoder([
      ['base', getBaseCreateMarketInstructionEncoder()],
      ['outcomes', getArrayEncoder(getBaseMarketOutcomeEncoder())],
      ['trigger_price', getU16Encoder()],
   ]);

const getCreateAdvDutchAuctionMarketInstructionEncoder = (): Encoder<types.CreateAdvDutchAuctionMarketInstruction> =>
   getStructEncoder([
      ['base', getBaseCreateMarketInstructionEncoder()],
      ['outcomes', getArrayEncoder(getBaseMarketOutcomeEncoder())],
      ['trigger_price', getU16Encoder()],
      ['max_risk', getU64BigintEncoder()],
   ]);

const getCreateMarketInstructionEncoder = (): Encoder<types.CreateMarketInstruction> =>
   getDiscriminatedUnionEncoder([
      ['Uncontrolled', getStructEncoder([['value', getCreateUncontrolledMarketInstructionEncoder()]])],
      ['DirectControlled', getStructEncoder([['value', getCreateDirectControlledMarketInstructionEncoder()]])],
      ['AdvControlled', getStructEncoder([['value', getCreateAdvControlledMarketInstructionEncoder()]])],
      ['IntControlled', getStructEncoder([['value', getCreateIntControlledMarketInstructionEncoder()]])],
      ['OneVOne', getStructEncoder([['value', getCreateOneVOneMarketInstructionEncoder()]])],
      ['OneVMany', getStructEncoder([['value', getCreateOneVManyMarketInstructionEncoder()]])],
      ['DutchAuction', getStructEncoder([['value', getCreateDutchAuctionMarketInstructionEncoder()]])],
      ['AdvDutchAuction', getStructEncoder([['value', getCreateAdvDutchAuctionMarketInstructionEncoder()]])],
   ], { size: getU8Encoder() });

const getResolveMarketInstructionEncoder = (): Encoder<types.ResolveMarketInstruction> =>
   getStructEncoder([
      ['outcome_index', transformEncoder(
         getDiscriminatedUnionEncoder([
            ['None', getStructEncoder([])],
            ['Some', getStructEncoder([['value', getU8Encoder()]])],
         ], { size: getU8Encoder() }),
         (value: number | null) => value === null ? { __kind: 'None' as const } : { __kind: 'Some' as const, value }
      )],
      ['rollback_timestamp', getU32Encoder()],
      ['payout_adjustment', transformEncoder(
         getDiscriminatedUnionEncoder([
            ['None', getStructEncoder([])],
            ['Some', getStructEncoder([['value', getI64BigintEncoder()]])],
         ], { size: getU8Encoder() }),
         (value: bigint | null) => value === null ? { __kind: 'None' as const } : { __kind: 'Some' as const, value }
      )],
   ]);

const getUpdateMarketCoreFeesInstructionEncoder = (): Encoder<types.UpdateMarketCoreFeesInstruction> =>
   getStructEncoder([
      ['core_flat_fee', transformEncoder(
         getDiscriminatedUnionEncoder([
            ['None', getStructEncoder([])],
            ['Some', getStructEncoder([['value', getU64BigintEncoder()]])],
         ], { size: getU8Encoder() }),
         (value: bigint | null) => value === null ? { __kind: 'None' as const } : { __kind: 'Some' as const, value }
      )],
      ['core_pc_fee', transformEncoder(
         getDiscriminatedUnionEncoder([
            ['None', getStructEncoder([])],
            ['Some', getStructEncoder([['value', getU16Encoder()]])],
         ], { size: getU8Encoder() }),
         (value: number | null) => value === null ? { __kind: 'None' as const } : { __kind: 'Some' as const, value }
      )],
      ['core_win_fee', transformEncoder(
         getDiscriminatedUnionEncoder([
            ['None', getStructEncoder([])],
            ['Some', getStructEncoder([['value', getU16Encoder()]])],
         ], { size: getU8Encoder() }),
         (value: number | null) => value === null ? { __kind: 'None' as const } : { __kind: 'Some' as const, value }
      )],
      ['core_fee_on_product', transformEncoder(
         getDiscriminatedUnionEncoder([
            ['None', getStructEncoder([])],
            ['Some', getStructEncoder([['value', getU16Encoder()]])],
         ], { size: getU8Encoder() }),
         (value: number | null) => value === null ? { __kind: 'None' as const } : { __kind: 'Some' as const, value }
      )],
   ]);

// --- Betting Codecs ---

export const getBetAccountDecoder = (): Decoder<types.BetAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['bet_type', getBetTypeDecoder()],
      ['bet_id', getU64BigintDecoder()],
      ['product_id', getU16Decoder()],
      ['market_id', getU64BigintDecoder()],
      ['owner_key', getAddressDecoder()],
      ['fee_payer', getAddressDecoder()],
      ['frontend_bytes', transformDecoder(
         getArrayDecoder(getU8Decoder(), { size: 8 }),
         (v: number[]) => new Uint8Array(v)
      )],
      ['outcome_index', getU8Decoder()],
      ['amount', getU64BigintDecoder()],
      ['potential_return', getU64BigintDecoder()],
      ['placed_at', getU32Decoder()],
      ['freebet_id', getU32Decoder()],
      ['is_live', getBooleanDecoder()],
   ]);

export const getSellRequestAccountDecoder = (): Decoder<types.SellRequestAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['_padding', getU8Decoder()],
      ['bet_id', getU64BigintDecoder()],
      ['product_id', getU16Decoder()],
      ['market_id', getU64BigintDecoder()],
      ['owner_key', getAddressDecoder()],
      ['fee_payer', getAddressDecoder()],
      ['outcome_index', getU8Decoder()],
      ['amount', getU64BigintDecoder()],
      ['potential_return', getU64BigintDecoder()],
      ['created_at', getU32Decoder()],
      ['balance_deltas', getArrayDecoder(getI64BigintDecoder())],
   ]);

const getBuyInstructionEncoder = (): Encoder<types.BuyInstruction> =>
   getStructEncoder([
      ['amount', getU64BigintEncoder()],
      ['min_return', getU64BigintEncoder()],
      ['product_id', getU16Encoder()],
      ['market_id', getU64BigintEncoder()],
      ['bet_id', getU64BigintEncoder()],
      ['outcome_index', getU8Encoder()],
      ['frontend_bytes', transformEncoder(
         getArrayEncoder(getU8Encoder(), { size: 8 }),
         (v: Uint8Array) => Array.from(v)
      )],
   ]);

const getSellInstructionEncoder = (): Encoder<types.SellInstruction> =>
   getStructEncoder([
      ['amount', getU64BigintEncoder()],
      ['min_return', getU64BigintEncoder()],
      ['product_id', getU16Encoder()],
      ['market_id', getU64BigintEncoder()],
      ['bet_id', getU64BigintEncoder()],
      ['outcome_index', getU8Encoder()],
   ]);

const getBuyWithFreebetInstructionEncoder = (): Encoder<types.BuyWithFreebetInstruction> =>
   getStructEncoder([
      ['amount', getU64BigintEncoder()],
      ['min_return', getU64BigintEncoder()],
      ['product_id', getU16Encoder()],
      ['market_id', getU64BigintEncoder()],
      ['bet_id', getU64BigintEncoder()],
      ['outcome_index', getU8Encoder()],
      ['freebet_id', getU32Encoder()],
      ['frontend_bytes', transformEncoder(
         getArrayEncoder(getU8Encoder(), { size: 8 }),
         (v: Uint8Array) => Array.from(v)
      )],
   ]);

const getSellWithFreebetInstructionEncoder = (): Encoder<types.SellWithFreebetInstruction> =>
   getStructEncoder([
      ['amount', getU64BigintEncoder()],
      ['min_return', getU64BigintEncoder()],
      ['product_id', getU16Encoder()],
      ['market_id', getU64BigintEncoder()],
      ['bet_id', getU64BigintEncoder()],
      ['outcome_index', getU8Encoder()],
      ['freebet_id', getU32Encoder()],
   ]);

export const getParlayBetAccountDecoder = (): Decoder<types.ParlayBetAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['_padding', getU8Decoder()],
      ['bet_id', getU64BigintDecoder()],
      ['product_id', getU16Decoder()],
      ['amount', getU64BigintDecoder()],
      ['owner_key', getAddressDecoder()],
      ['fee_payer', getAddressDecoder()],
      ['frontend_bytes', transformDecoder(
         getArrayDecoder(getU8Decoder(), { size: 8 }),
         (v: number[]) => new Uint8Array(v)
      )],
      ['potential_return', getU64BigintDecoder()],
      ['placed_at', getU32Decoder()],
      ['freebet_id', getU32Decoder()],
      ['is_live', getBooleanDecoder()],
      ['selections', transformDecoder(
         getArrayDecoder(getTupleDecoder([
            getU64BigintDecoder(),
            getU8Decoder(),
            getU32Decoder(),
         ])),
         (value: readonly (readonly [bigint, number, number])[]): [bigint, number, number][] =>
            value.map(v => [v[0], v[1], v[2]] as [bigint, number, number])
      )],
   ]);

export const getParlaySellRequestAccountDecoder = (): Decoder<types.ParlaySellRequestAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['_padding', getU8Decoder()],
      ['bet_id', getU64BigintDecoder()],
      ['product_id', getU16Decoder()],
      ['amount', getU64BigintDecoder()],
      ['owner_key', getAddressDecoder()],
      ['fee_payer', getAddressDecoder()],
      ['potential_return', getU64BigintDecoder()],
      ['created_at', getU32Decoder()],
      ['selections', transformDecoder(
         getArrayDecoder(getTupleDecoder([
            getU64BigintDecoder(),
            getU8Decoder(),
            getU32Decoder(),
         ])),
         (value: readonly (readonly [bigint, number, number])[]): [bigint, number, number][] =>
            value.map(v => [v[0], v[1], v[2]] as [bigint, number, number])
      )],
   ]);

const getParlayBetInstructionEncoder = (): Encoder<types.ParlayBetInstruction> =>
   getStructEncoder([
      ['amount', getU64BigintEncoder()],
      ['min_return', getU64BigintEncoder()],
      ['product_id', getU16Encoder()],
      ['bet_id', getU64BigintEncoder()],
      ['freebet_id', getU32Encoder()],
      ['selections', getArrayEncoder(getTupleEncoder([
         getU64BigintEncoder(),
         getU8Encoder(),
      ]))],
      ['frontend_bytes', transformEncoder(
         getArrayEncoder(getU8Encoder(), { size: 8 }),
         (v: Uint8Array) => Array.from(v)
      )],
   ]);

const getSellParlayInstructionEncoder = (): Encoder<types.SellParlayInstruction> =>
   getStructEncoder([
      ['amount', getU64BigintEncoder()],
      ['min_return', getU64BigintEncoder()],
      ['product_id', getU16Encoder()],
      ['bet_id', getU64BigintEncoder()],
   ]);

// --- Freebet Codecs ---

export const getFreebetAccountDecoder = (): Decoder<types.FreebetAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['freebet_id', getU32Decoder()],
      ['owner_key', getAddressDecoder()],
      ['product_id', getU16Decoder()],
      ['amount', getU64BigintDecoder()],
      ['expires_at', getU32Decoder()],
      ['is_used', getBooleanDecoder()],
      ['max_return', getU64BigintDecoder()],
      ['min_return', getU64BigintDecoder()],
   ]);

const getGiveFreebetInstructionEncoder = (): Encoder<types.GiveFreebetInstruction> =>
   getStructEncoder([
      ['freebet_id', getU32Encoder()],
      ['amount', getU64BigintEncoder()],
      ['expires_at', getU32Encoder()],
      ['max_return', getU64BigintEncoder()],
      ['min_return', getU64BigintEncoder()],
   ]);

// --- Oracle Codecs ---

export const getOracleAccountDecoder = (): Decoder<types.OracleAccount> =>
   getStructDecoder([
      ['account_type_discriminator', getU8Decoder()],
      ['oracle_updater', getAddressDecoder()],
      ['sequence', getU32Decoder()],
      ['data', getOracleDataVariantDecoder()],
      ['winning_outcome', getU8Decoder()],
   ]);

const getInitOracleInstructionEncoder = (): Encoder<types.InitOracleInstruction> =>
   getStructEncoder([
      ['product_id', getU16Encoder()],
      ['market_id', getU64BigintEncoder()],
      ['variant_type', getU8Encoder()],
      ['num_outcomes', getU8Encoder()],
   ]);

const getUpdateOracleInstructionEncoder = (): Encoder<types.UpdateOracleInstruction> =>
   getStructEncoder([
      ['sequence', getU32Encoder()],
      ['oracle_data', getBytesEncoder()], // No Vec length prefix - oracle_data is written directly
   ]);

const getUpdateLiveRollbackAccountInstructionEncoder = (): Encoder<types.UpdateLiveRollbackAccountInstruction> =>
   getStructEncoder([
      ['period_start', getU32Encoder()],
      ['period_end', getU32Encoder()],
   ]);

// --- Actions Codec ---

export const getActionsEncoder = (): Encoder<types.Actions> =>
   getDiscriminatedUnionEncoder([
      // Oracle instructions
      ['UpdateOracle', getStructEncoder([['value', getUpdateOracleInstructionEncoder()]])],
      ['InitOracle', getStructEncoder([['value', getInitOracleInstructionEncoder()]])],
      ['DeleteOracle', getStructEncoder([])],
      ['SetWinningOutcome', getStructEncoder([['value', getU8Encoder()]])],
      ['UpdateLiveRollbackAccount', getStructEncoder([['value', getUpdateLiveRollbackAccountInstructionEncoder()]])],
      ['RollbackLiveBuy', getStructEncoder([])],
      // Splash admin instructions
      ['InitProgramConfigAccount', getStructEncoder([])],
      ['SetAdminKey', getStructEncoder([])],
      ['SetCoreFlatFee', getStructEncoder([['value', getU64Encoder()]])],
      ['SetCorePcFee', getStructEncoder([['value', getU16Encoder()]])],
      ['SetCoreWinFee', getStructEncoder([['value', getU16Encoder()]])],
      ['SetFeeOnProduct', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['fee_on_product', getU16Encoder()],
         ])],
      ])],
      ['SetCoreStatus', getStructEncoder([['value', getCoreStatusEncoder()]])],
      ['CreateProduct', getStructEncoder([['value', getCreateProductInstructionEncoder()]])],
      ['RemoveProduct', getStructEncoder([['value', getU16Encoder()]])],
      ['WithdrawCoreFees', getStructEncoder([['value', getU64Encoder()]])],
      ['AddMultisigSigner', getStructEncoder([
         ['value', getStructEncoder([
            ['signer', getAddressEncoder()],
            ['required_signatures', getU8Encoder()],
         ])],
      ])],
      ['RemoveMultisigSigner', getStructEncoder([
         ['value', getStructEncoder([
            ['signer', getAddressEncoder()],
            ['required_signatures', getU8Encoder()],
         ])],
      ])],
      // Product admin instructions
      ['SetProductAdminKey', getStructEncoder([['value', getU16Encoder()]])],
      ['SetProductWithdrawAuthority', getStructEncoder([['value', getU16Encoder()]])],
      ['SetProductFlatFee', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['flat_fee', getU64Encoder()],
         ])],
      ])],
      ['SetProductPcFee', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['pc_fee', getU16Encoder()],
         ])],
      ])],
      ['SetProductWinFee', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['win_fee', getU16Encoder()],
         ])],
      ])],
      ['SetProductStatus', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['product_status', getProductStatusEncoder()],
         ])],
      ])],
      ['WithdrawProductFees', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['amount', getU64BigintEncoder()],
         ])],
      ])],
      ['AddFundsToMarketAta', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['amount', getU64BigintEncoder()],
         ])],
      ])],
      ['SetLpMaxDeposits', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['max_deposits', getU64BigintEncoder()],
         ])],
      ])],
      ['ChangeLpCosigner', getStructEncoder([['value', getU16Encoder()]])],
      // Liquidity instructions
      ['InitDepositLiquidity', getStructEncoder([['value', getInitDepositLiquidityInstructionEncoder()]])],
      ['DepositLiquidity', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['deposit_id', getU64BigintEncoder()],
         ])],
      ])],
      ['CancelDepositLiquidity', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['deposit_id', getU64BigintEncoder()],
         ])],
      ])],
      ['InitWithdrawLiquidity', getStructEncoder([['value', getInitWithdrawLiquidityInstructionEncoder()]])],
      ['WithdrawLiquidity', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['withdraw_id', getU64BigintEncoder()],
         ])],
      ])],
      ['CancelWithdrawLiquidity', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['withdraw_id', getU64BigintEncoder()],
         ])],
      ])],
      // Market instructions
      ['CreateMarket', getStructEncoder([['value', getCreateMarketInstructionEncoder()]])],
      ['UpdateMarketStatus', getStructEncoder([['value', getMarketStatusEncoder()]])],
      ['EditGoLiveTime', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['new_go_live_time', getU32Encoder()],
         ])],
      ])],
      ['ResolveMarket', getStructEncoder([['value', getResolveMarketInstructionEncoder()]])],
      ['CloseMarket', getStructEncoder([])],
      ['UpdateMarketCoreFees', getStructEncoder([['value', getUpdateMarketCoreFeesInstructionEncoder()]])],
      // Freebets instructions
      ['GiveFreebet', getStructEncoder([['value', getGiveFreebetInstructionEncoder()]])],
      ['RemoveFreebet', getStructEncoder([])],
      // Betting instructions
      ['BuyFor', getStructEncoder([['value', getBuyInstructionEncoder()]])],
      ['BuyAgainst', getStructEncoder([['value', getBuyInstructionEncoder()]])],
      ['SellFor', getStructEncoder([['value', getSellInstructionEncoder()]])],
      ['SellAgainst', getStructEncoder([['value', getSellInstructionEncoder()]])],
      ['HandleSellRequest', getStructEncoder([])],
      ['ClaimPosition', getStructEncoder([])],
      ['BuyForWithFreebet', getStructEncoder([['value', getBuyWithFreebetInstructionEncoder()]])],
      ['BuyAgainstWithFreebet', getStructEncoder([['value', getBuyWithFreebetInstructionEncoder()]])],
      ['SellForWithFreebet', getStructEncoder([['value', getSellWithFreebetInstructionEncoder()]])],
      ['SellAgainstWithFreebet', getStructEncoder([['value', getSellWithFreebetInstructionEncoder()]])],
      ['ClaimPositionWithFreebet', getStructEncoder([])],
      ['BuyParlay', getStructEncoder([['value', getParlayBetInstructionEncoder()]])],
      ['SellParlay', getStructEncoder([['value', getSellParlayInstructionEncoder()]])],
      ['ClaimParlayPosition', getStructEncoder([])],
      ['HandleSellParlayRequest', getStructEncoder([])],
      // Super admin instructions
      ['ForceChangeProductAdminAndWithdraw', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['needs_new_admin_key', getBooleanEncoder()],
            ['needs_new_withdraw_authority', getBooleanEncoder()],
         ])],
      ])],
      ['UnFreezeProductLpToken', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['unfreeze', getBooleanEncoder()],
         ])],
      ])],
      ['DrainProductFees', getStructEncoder([['value', getU16Encoder()]])],
      ['DrainProductPool', getStructEncoder([['value', getU16Encoder()]])],
      ['UnSuspendProduct', getStructEncoder([
         ['value', getStructEncoder([
            ['product_id', getU16Encoder()],
            ['unsuspend', getBooleanEncoder()],
         ])],
      ])],
      ['PauseAllMarketsOfProduct', getStructEncoder([['value', getU16Encoder()]])],
      // DEVNET_ONLY
      ['DevnetForceMoveTokens', getStructEncoder([
         ['value', getStructEncoder([
            ['amount', getU64BigintEncoder()],
            ['auth_seeds', addEncoderSizePrefix(getBytesEncoder(), getU32Encoder())],
            ['auth_bump', getU8Encoder()],
         ])],
      ])],
      ['DevnetCloseAccount', getStructEncoder([])],
   ], { size: getU8Encoder() });

export const getAccountDecoder = (): Decoder<types.Account> => {
   const decodeAccount = (bytes: Uint8Array | ReadonlyUint8Array, offset = 0): types.Account => {
      // Peek at the first byte to determine account type
      if (bytes.length < offset + 1) {
         throw new Error('Account data too short to read discriminator');
      }
      const discriminator = bytes[offset];
      
      // Route to the appropriate decoder based on discriminator
      switch (discriminator) {
         case CORE_CONFIG_ACCOUNT_TYPE: {
            const value = getCoreConfigAccountDecoder().decode(bytes, offset);
            return { __kind: 'CoreConfigAccount', value };
         }
         case PRODUCT_LIST_ACCOUNT_TYPE: {
            const value = getProductListAccountDecoder().decode(bytes, offset);
            return { __kind: 'ProductListAccount', value };
         }
         case PRODUCT_CONFIG_ACCOUNT_TYPE: {
            const value = getProductConfigAccountDecoder().decode(bytes, offset);
            return { __kind: 'ProductConfigAccount', value };
         }
         case MARKET_ACCOUNT_TYPE: {
            const value = getMarketDecoder().decode(bytes, offset);
            return { __kind: 'Market', value };
         }
         case LIVE_ROLLBACK_ACCOUNT_TYPE: {
            const value = getLiveRollbackAccountDecoder().decode(bytes, offset);
            return { __kind: 'LiveRollbackAccount', value };
         }
         case ORACLE_ACCOUNT_TYPE: {
            const value = getOracleAccountDecoder().decode(bytes, offset);
            return { __kind: 'OracleAccount', value };
         }
         case BET_ACCOUNT_TYPE: {
            const value = getBetAccountDecoder().decode(bytes, offset);
            return { __kind: 'BetAccount', value };
         }
         case SELL_REQUEST_ACCOUNT_TYPE: {
            const value = getSellRequestAccountDecoder().decode(bytes, offset);
            return { __kind: 'SellRequestAccount', value };
         }
         case PARLAY_BET_ACCOUNT_TYPE: {
            const value = getParlayBetAccountDecoder().decode(bytes, offset);
            return { __kind: 'ParlayBetAccount', value };
         }
         case PARLAY_SELL_REQUEST_ACCOUNT_TYPE: {
            const value = getParlaySellRequestAccountDecoder().decode(bytes, offset);
            return { __kind: 'ParlaySellRequestAccount', value };
         }
         case DEPOSIT_RECORD_ACCOUNT_TYPE: {
            const value = getDepositRecordDecoder().decode(bytes, offset);
            return { __kind: 'DepositRecord', value };
         }
         case WITHDRAW_RECORD_ACCOUNT_TYPE: {
            const value = getWithdrawRecordDecoder().decode(bytes, offset);
            return { __kind: 'WithdrawRecord', value };
         }
         case LP_RECEIPT_ACCOUNT_TYPE: {
            const value = getLpReceiptDecoder().decode(bytes, offset);
            return { __kind: 'LpReceipt', value };
         }
         case FREEBET_ACCOUNT_TYPE: {
            const value = getFreebetAccountDecoder().decode(bytes, offset);
            return { __kind: 'FreebetAccount', value };
         }
         default:
            throw new Error(`Unknown account type discriminator: ${discriminator}`);
      }
   };
   
   const readAccount = (bytes: Uint8Array | ReadonlyUint8Array, offset: number): [types.Account, number] => {
      const value = decodeAccount(bytes, offset);
      return [value, bytes.length];
   };
   
   return {
      decode: decodeAccount,
      read: readAccount,
      fixedSize: undefined,
      maxSize: undefined,
   };
};
