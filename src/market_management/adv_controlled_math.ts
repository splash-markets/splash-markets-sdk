/**
 * Mirrors `splash-markets-program-v2` `adv_controlled_bet.rs` for client-side
 * potential_return / net_return preview (u128/u64 truncating division like Rust).
 */
import { PC_SCALE } from "../constants";
import type { ControlledMarketOutcome } from "../types";
import { OperationError } from "../errors";

const PC = BigInt(PC_SCALE);
const I64_MIN = -9223372036854775808n;
const I64_MAX = 9223372036854775807n;
const U64_MAX = 18446744073709551615n;

type HelpfulBreakpoint = { v: bigint; w: bigint };

function clampI64(x: bigint): bigint {
   if (x < I64_MIN) return I64_MIN;
   if (x > I64_MAX) return I64_MAX;
   return x;
}

function assertU64(label: string, v: bigint): void {
   if (v < 0n || v > U64_MAX) {
      throw new OperationError(`${label} out of u64 range`, "computeAdvControlledPayout");
   }
}

function maxOutcomeRisk(outcomes: ControlledMarketOutcome[]): bigint {
   if (outcomes.length === 0) {
      return 0n;
   }
   return outcomes.reduce((m, o) => (o.outcome_risk > m ? o.outcome_risk : m), outcomes[0]!.outcome_risk);
}

/** Helpful units: special outcome risk decreases, others increase (SellFor, BuyAgainst). */
function sHelpIdxDec(
   outcomes: ControlledMarketOutcome[],
   outcomeIdx: number,
   numOutcomes: number,
   decSlopeDelta: bigint,
   incSlopeDelta: bigint,
   decBpNum: bigint,
   decBpDen: bigint,
   incBpNum: bigint,
   incBpDen: bigint,
   maxUnits: bigint,
): bigint {
   const riskDecreasing = outcomes[outcomeIdx]!.outcome_risk;
   if (riskDecreasing <= 0n) {
      return 0n;
   }
   const breakpointDecreasing = (riskDecreasing * decBpNum) / decBpDen;

   if (numOutcomes === 2) {
      const riskIncreasing = outcomes[1 - outcomeIdx]!.outcome_risk;
      if (decSlopeDelta > incSlopeDelta) {
         return breakpointDecreasing < maxUnits ? breakpointDecreasing : maxUnits;
      }
      if (riskIncreasing >= 0n) {
         return 0n;
      }
      const breakpointIncreasing = (BigInt(-riskIncreasing) * incBpNum) / incBpDen;
      const a = breakpointDecreasing < breakpointIncreasing ? breakpointDecreasing : breakpointIncreasing;
      return a < maxUnits ? a : maxUnits;
   }

   if (numOutcomes === 3) {
      let negativeCount = 0;
      const negativeRisks: [bigint, bigint] = [0n, 0n];
      let positiveOtherCount = 0;
      for (let j = 0; j < 3; j++) {
         if (j !== outcomeIdx) {
            const r = outcomes[j]!.outcome_risk;
            if (r < 0n) {
               if (negativeCount < 2) {
                  negativeRisks[negativeCount] = r;
               }
               negativeCount++;
            } else {
               positiveOtherCount++;
            }
         }
      }

      const slopeInit = -decSlopeDelta + BigInt(positiveOtherCount) * incSlopeDelta;
      if (slopeInit >= 0n) {
         return 0n;
      }

      if (negativeCount === 0) {
         return breakpointDecreasing < maxUnits ? breakpointDecreasing : maxUnits;
      }

      if (negativeCount === 1) {
         if (decSlopeDelta > incSlopeDelta) {
            return breakpointDecreasing < maxUnits ? breakpointDecreasing : maxUnits;
         }
         const breakpointIncreasing = (BigInt(-negativeRisks[0]!) * incBpNum) / incBpDen;
         const a = breakpointDecreasing < breakpointIncreasing ? breakpointDecreasing : breakpointIncreasing;
         return a < maxUnits ? a : maxUnits;
      }

      const riskAbsLow = (-negativeRisks[0]!) < (-negativeRisks[1]!) ? -negativeRisks[0]! : -negativeRisks[1]!;
      const riskAbsHigh = (-negativeRisks[0]!) > (-negativeRisks[1]!) ? -negativeRisks[0]! : -negativeRisks[1]!;
      const breakpointIncreasingLow = (riskAbsLow * incBpNum) / incBpDen;
      const breakpointIncreasingHigh = (riskAbsHigh * incBpNum) / incBpDen;

      let result: bigint;
      if (decSlopeDelta >= 2n * incSlopeDelta) {
         result = breakpointDecreasing < breakpointIncreasingHigh ? breakpointDecreasing : breakpointIncreasingHigh;
      } else if (decSlopeDelta >= incSlopeDelta) {
         if (breakpointDecreasing <= breakpointIncreasingLow) {
            result = breakpointIncreasingLow;
         } else if (breakpointDecreasing >= breakpointIncreasingHigh) {
            result = breakpointIncreasingHigh;
         } else {
            result = breakpointDecreasing;
         }
      } else {
         result = breakpointIncreasingHigh;
      }
      return result < maxUnits ? result : maxUnits;
   }

   let positiveOtherCount = 0n;
   for (let j = 0; j < numOutcomes; j++) {
      if (j !== outcomeIdx && outcomes[j]!.outcome_risk >= 0n) {
         positiveOtherCount += 1n;
      }
   }

   let slope = -decSlopeDelta + positiveOtherCount * incSlopeDelta;
   if (slope >= 0n) {
      return 0n;
   }

   const breakpoints: HelpfulBreakpoint[] = [{ v: breakpointDecreasing, w: decSlopeDelta }];
   for (let j = 0; j < numOutcomes; j++) {
      if (j !== outcomeIdx && outcomes[j]!.outcome_risk < 0n) {
         const breakpointJ = (BigInt(-outcomes[j]!.outcome_risk) * incBpNum) / incBpDen;
         breakpoints.push({ v: breakpointJ, w: incSlopeDelta });
      }
   }

   const used = new Array<boolean>(breakpoints.length).fill(false);
   for (let _ = 0; _ < breakpoints.length; _++) {
      let minValue = U64_MAX + 1n;
      let minIndex = 0;
      for (let b = 0; b < breakpoints.length; b++) {
         if (!used[b] && breakpoints[b]!.v < minValue) {
            minValue = breakpoints[b]!.v;
            minIndex = b;
         }
      }
      if (minValue > maxUnits) {
         break;
      }
      used[minIndex] = true;
      slope += breakpoints[minIndex]!.w;
      if (slope >= 0n) {
         return minValue;
      }
   }
   return maxUnits;
}

/** Helpful units: special outcome risk increases, others decrease (BuyFor, SellAgainst). */
function sHelpIdxInc(
   outcomes: ControlledMarketOutcome[],
   outcomeIdx: number,
   numOutcomes: number,
   incSlopeDelta: bigint,
   decSlopeDelta: bigint,
   incBpNum: bigint,
   incBpDen: bigint,
   decBpNum: bigint,
   decBpDen: bigint,
   maxUnits: bigint,
): bigint {
   if (numOutcomes === 2) {
      const riskDecreasing = outcomes[1 - outcomeIdx]!.outcome_risk;
      if (riskDecreasing <= 0n) {
         return 0n;
      }
      const breakpointDecreasing = (riskDecreasing * decBpNum) / decBpDen;
      const riskIncreasing = outcomes[outcomeIdx]!.outcome_risk;

      if (incSlopeDelta >= decSlopeDelta) {
         if (riskIncreasing >= 0n) {
            return 0n;
         }
         const breakpointIncreasing = (BigInt(-riskIncreasing) * incBpNum) / incBpDen;
         const a = breakpointIncreasing < breakpointDecreasing ? breakpointIncreasing : breakpointDecreasing;
         return a < maxUnits ? a : maxUnits;
      }
      return breakpointDecreasing < maxUnits ? breakpointDecreasing : maxUnits;
   }

   if (numOutcomes === 3) {
      const decreasingRisks: [bigint, bigint] = [0n, 0n];
      let decreasingCount = 0;
      for (let j = 0; j < 3; j++) {
         if (j !== outcomeIdx && outcomes[j]!.outcome_risk > 0n) {
            if (decreasingCount < 2) {
               decreasingRisks[decreasingCount] = outcomes[j]!.outcome_risk;
            }
            decreasingCount++;
         }
      }

      if (decreasingCount === 0) {
         return 0n;
      }

      const riskIncreasing = outcomes[outcomeIdx]!.outcome_risk;

      if (decreasingCount === 1) {
         const breakpointDecreasing = (decreasingRisks[0]! * decBpNum) / decBpDen;
         if (incSlopeDelta >= decSlopeDelta) {
            if (riskIncreasing >= 0n) {
               return 0n;
            }
            const breakpointIncreasing = (BigInt(-riskIncreasing) * incBpNum) / incBpDen;
            const a = breakpointIncreasing < breakpointDecreasing ? breakpointIncreasing : breakpointDecreasing;
            return a < maxUnits ? a : maxUnits;
         }
         return breakpointDecreasing < maxUnits ? breakpointDecreasing : maxUnits;
      }

      const slopeInit =
         (riskIncreasing > 0n ? incSlopeDelta : 0n) - 2n * decSlopeDelta;
      if (slopeInit >= 0n) {
         return 0n;
      }

      const breakpointDecreasingLow =
         (decreasingRisks[0]! < decreasingRisks[1]! ? decreasingRisks[0]! : decreasingRisks[1]!) * decBpNum / decBpDen;
      const breakpointDecreasingHigh =
         (decreasingRisks[0]! > decreasingRisks[1]! ? decreasingRisks[0]! : decreasingRisks[1]!) * decBpNum / decBpDen;
      let breakpointIncreasing: bigint;
      if (riskIncreasing < 0n) {
         breakpointIncreasing = (BigInt(-riskIncreasing) * incBpNum) / incBpDen;
      } else if (riskIncreasing === 0n) {
         breakpointIncreasing = 0n;
      } else {
         breakpointIncreasing = U64_MAX;
      }

      let result: bigint;
      if (incSlopeDelta >= 2n * decSlopeDelta) {
         result =
            breakpointIncreasing < breakpointDecreasingHigh ? breakpointIncreasing : breakpointDecreasingHigh;
      } else if (incSlopeDelta >= decSlopeDelta) {
         if (breakpointIncreasing <= breakpointDecreasingLow) {
            result = breakpointDecreasingLow;
         } else if (breakpointIncreasing >= breakpointDecreasingHigh) {
            result = breakpointDecreasingHigh;
         } else {
            result = breakpointIncreasing;
         }
      } else {
         result = breakpointDecreasingHigh;
      }
      return result < maxUnits ? result : maxUnits;
   }

   const riskIncreasing = outcomes[outcomeIdx]!.outcome_risk;
   let decreasingPositiveCount = 0n;
   for (let j = 0; j < numOutcomes; j++) {
      if (j !== outcomeIdx && outcomes[j]!.outcome_risk > 0n) {
         decreasingPositiveCount += 1n;
      }
   }

   let slope = (riskIncreasing > 0n ? incSlopeDelta : 0n) - decreasingPositiveCount * decSlopeDelta;
   if (slope >= 0n) {
      return 0n;
   }

   const breakpoints: HelpfulBreakpoint[] = [];
   if (riskIncreasing <= 0n) {
      const breakpointValue =
         riskIncreasing < 0n ? (BigInt(-riskIncreasing) * incBpNum) / incBpDen : 0n;
      breakpoints.push({ v: breakpointValue, w: incSlopeDelta });
   }
   for (let j = 0; j < numOutcomes; j++) {
      if (j !== outcomeIdx && outcomes[j]!.outcome_risk > 0n) {
         const breakpointJ = (BigInt(outcomes[j]!.outcome_risk) * decBpNum) / decBpDen;
         breakpoints.push({ v: breakpointJ, w: decSlopeDelta });
      }
   }

   const used = new Array<boolean>(breakpoints.length).fill(false);
   for (let _ = 0; _ < breakpoints.length; _++) {
      let minValue = U64_MAX + 1n;
      let minIndex = 0;
      for (let b = 0; b < breakpoints.length; b++) {
         if (!used[b] && breakpoints[b]!.v < minValue) {
            minValue = breakpoints[b]!.v;
            minIndex = b;
         }
      }
      if (minValue > maxUnits) {
         break;
      }
      used[minIndex] = true;
      slope += breakpoints[minIndex]!.w;
      if (slope >= 0n) {
         return minValue;
      }
   }
   return maxUnits;
}

function computeAdvBuyFor(
   outcomes: ControlledMarketOutcome[],
   outcomeIdx: number,
   numOutcomes: number,
   amount: bigint,
   effectiveLiquidity: bigint,
   outcomeProb: bigint,
   maxRisk: bigint,
   bonusCap: bigint,
   overRiskPenalty: bigint,
): bigint {
   const outcomeRisk = outcomes[outcomeIdx]!.outcome_risk;
   const maxOutcomeR = maxOutcomeRisk(outcomes);
   const bonus =
      maxOutcomeR > 0n && maxRisk > 0n
         ? (bonusCap * (maxOutcomeR < maxRisk ? maxOutcomeR : maxRisk)) / maxRisk
         : 0n;

   const scaledBonus = (outcomeProb * bonus) / PC;
   const effectiveProb = outcomeProb - scaledBonus;
   if (effectiveProb <= 0n) {
      throw new OperationError("Effective probability is zero after bonus", "computeAdvControlledPayout");
   }
   const complementProb = PC - effectiveProb;
   const liquidityWeightedProb = (effectiveLiquidity * outcomeProb) / PC;

   const helpfulStake = sHelpIdxInc(
      outcomes,
      outcomeIdx,
      numOutcomes,
      complementProb,
      effectiveProb,
      effectiveProb,
      complementProb,
      1n,
      1n,
      amount,
   );

   const riskFromHelp = (helpfulStake * complementProb) / effectiveProb;
   const postHelpRisk = BigInt(outcomeRisk) + riskFromHelp;
   const maxRiskI128 = maxRisk;
   const remaining = amount - helpfulStake;

   let neutralStake = 0n;
   if (postHelpRisk < maxRiskI128 && remaining > 0n) {
      const gap = maxRiskI128 - postHelpRisk;
      const liquidityComplement = (effectiveLiquidity * (PC - outcomeProb)) / PC;
      if (liquidityComplement > gap) {
         const numerator = gap * liquidityWeightedProb;
         const denominator = liquidityComplement - gap;
         const cap = numerator / denominator;
         neutralStake = cap < remaining ? cap : remaining;
      } else {
         neutralStake = remaining;
      }
   }

   const overStake = remaining - neutralStake;

   let payoutHelpful = 0n;
   if (helpfulStake > 0n) {
      payoutHelpful = (helpfulStake * PC) / effectiveProb;
   }

   let payoutNeutral = 0n;
   if (neutralStake > 0n) {
      payoutNeutral =
         (neutralStake * (effectiveLiquidity + neutralStake)) /
         (liquidityWeightedProb + neutralStake);
   }

   let payoutOver = 0n;
   if (overStake > 0n) {
      const initialExcess = postHelpRisk > maxRiskI128 ? postHelpRisk - maxRiskI128 : 0n;
      const excess =
         initialExcess + (overStake * (PC - outcomeProb)) / outcomeProb;
      const penaltyAdjustment = (overRiskPenalty * excess) / PC;
      const numerator = overStake + effectiveLiquidity + penaltyAdjustment;
      const denominator = liquidityWeightedProb + overStake + penaltyAdjustment;
      payoutOver = (overStake * numerator) / denominator;
   }

   return payoutHelpful + payoutNeutral + payoutOver;
}

function computeAdvBuyAgainst(
   outcomes: ControlledMarketOutcome[],
   outcomeIdx: number,
   numOutcomes: number,
   amount: bigint,
   effectiveLiquidity: bigint,
   outcomeProb: bigint,
   maxRisk: bigint,
   bonusCap: bigint,
   overRiskPenalty: bigint,
): bigint {
   const againstProb = PC - outcomeProb;
   if (againstProb === 0n) {
      throw new OperationError("Against probability is zero", "computeAdvControlledPayout");
   }

   const maxOutcomeR = maxOutcomeRisk(outcomes);
   const bonus =
      maxOutcomeR > 0n && maxRisk > 0n
         ? (bonusCap * (maxOutcomeR < maxRisk ? maxOutcomeR : maxRisk)) / maxRisk
         : 0n;

   const scaledBonus = (againstProb * bonus) / PC;
   const effectiveAgainstProb = againstProb - scaledBonus;
   if (effectiveAgainstProb <= 0n) {
      throw new OperationError("Effective against probability is zero after bonus", "computeAdvControlledPayout");
   }
   const complementEffective = PC - effectiveAgainstProb;
   const liquidityAgainst = (effectiveLiquidity * againstProb) / PC;
   const liquidityFor = (effectiveLiquidity * outcomeProb) / PC;

   const helpfulStake = sHelpIdxDec(
      outcomes,
      outcomeIdx,
      numOutcomes,
      effectiveAgainstProb,
      complementEffective,
      1n,
      1n,
      effectiveAgainstProb,
      complementEffective,
      amount,
   );

   const riskIncreasePerOther = (helpfulStake * complementEffective) / effectiveAgainstProb;
   let maxOtherRiskPostHelp: bigint | undefined;
   for (let j = 0; j < numOutcomes; j++) {
      if (j !== outcomeIdx) {
         const post = outcomes[j]!.outcome_risk + riskIncreasePerOther;
         if (maxOtherRiskPostHelp === undefined || post > maxOtherRiskPostHelp) {
            maxOtherRiskPostHelp = post;
         }
      }
   }
   const postHelpRisk = maxOtherRiskPostHelp ?? 0n;
   const maxRiskI128 = maxRisk;
   const remaining = amount - helpfulStake;

   let neutralStake = 0n;
   if (postHelpRisk < maxRiskI128 && remaining > 0n) {
      const gap = maxRiskI128 - postHelpRisk;
      if (liquidityFor > gap) {
         const numerator = gap * liquidityAgainst;
         const denominator = liquidityFor - gap;
         const cap = numerator / denominator;
         neutralStake = cap < remaining ? cap : remaining;
      } else {
         neutralStake = remaining;
      }
   }

   const overStake = remaining - neutralStake;

   let payoutHelpful = 0n;
   if (helpfulStake > 0n) {
      payoutHelpful = (helpfulStake * PC) / effectiveAgainstProb;
   }

   let payoutNeutral = 0n;
   if (neutralStake > 0n) {
      payoutNeutral =
         (neutralStake * (effectiveLiquidity + neutralStake)) / (liquidityAgainst + neutralStake);
   }

   let payoutOver = 0n;
   if (overStake > 0n) {
      const initialExcess = postHelpRisk > maxRiskI128 ? postHelpRisk - maxRiskI128 : 0n;
      const excess = initialExcess + (overStake * outcomeProb) / againstProb;
      const penaltyAdjustment = (overRiskPenalty * excess) / PC;
      const numerator = overStake + effectiveLiquidity + penaltyAdjustment;
      const denominator = liquidityAgainst + overStake + penaltyAdjustment;
      payoutOver = (overStake * numerator) / denominator;
   }

   return payoutHelpful + payoutNeutral + payoutOver;
}

function computeAdvSellFor(
   outcomes: ControlledMarketOutcome[],
   outcomeIdx: number,
   numOutcomes: number,
   amount: bigint,
   sellShares: bigint,
   effectiveLiquidity: bigint,
   outcomeProb: bigint,
   maxRisk: bigint,
   bonusCap: bigint,
   overRiskPenalty: bigint,
): bigint {
   if (sellShares === 0n || amount === 0n) {
      return 0n;
   }

   const returnAtOraclePrice = (sellShares * outcomeProb) / PC;
   const complementProb = PC - outcomeProb;
   const projectedDeltaOutcome = returnAtOraclePrice - sellShares;
   const projectedDeltaOther = returnAtOraclePrice;

   let maxProjectedRisk: bigint | undefined;
   for (let j = 0; j < numOutcomes; j++) {
      const currentRisk = outcomes[j]!.outcome_risk;
      const projected =
         j === outcomeIdx
            ? BigInt(currentRisk) + projectedDeltaOutcome
            : BigInt(currentRisk) + projectedDeltaOther;
      const projectedClamped = clampI64(projected);
      if (maxProjectedRisk === undefined || projectedClamped > maxProjectedRisk) {
         maxProjectedRisk = projectedClamped;
      }
   }

   const bonus =
      (maxProjectedRisk ?? 0n) > 0n && maxRisk > 0n
         ? (bonusCap * ((maxProjectedRisk ?? 0n) < maxRisk ? (maxProjectedRisk ?? 0n) : maxRisk)) / maxRisk
         : 0n;

   const scaledBonus = (outcomeProb * bonus) / PC;
   let effectiveSellProb = outcomeProb - scaledBonus;
   if (effectiveSellProb <= 0n) {
      effectiveSellProb = 1n;
   }

   const helpfulShares = sHelpIdxDec(
      outcomes,
      outcomeIdx,
      numOutcomes,
      complementProb,
      effectiveSellProb,
      PC,
      complementProb,
      PC,
      effectiveSellProb,
      sellShares,
   );

   const riskIncreasePerOther = (helpfulShares * effectiveSellProb) / PC;
   let maxOtherRiskPostHelp: bigint | undefined;
   for (let j = 0; j < numOutcomes; j++) {
      if (j !== outcomeIdx) {
         const post = outcomes[j]!.outcome_risk + riskIncreasePerOther;
         if (maxOtherRiskPostHelp === undefined || post > maxOtherRiskPostHelp) {
            maxOtherRiskPostHelp = post;
         }
      }
   }
   const postHelpRisk = maxOtherRiskPostHelp ?? 0n;
   const maxRiskI128 = maxRisk;
   let remainingShares = sellShares - helpfulShares;
   if (remainingShares < 0n) {
      remainingShares = 0n;
   }

   let neutralShares = 0n;
   if (postHelpRisk < maxRiskI128 && remainingShares > 0n) {
      const gap = maxRiskI128 - postHelpRisk;
      const maxSharesForGap = (gap * PC) / effectiveSellProb;
      neutralShares = maxSharesForGap < remainingShares ? maxSharesForGap : remainingShares;
   }

   let overShares = remainingShares - neutralShares;
   if (overShares < 0n) {
      overShares = 0n;
   }

   let payoutHelpful = 0n;
   if (helpfulShares > 0n) {
      payoutHelpful = (helpfulShares * effectiveSellProb) / PC;
   }

   let payoutNeutral = 0n;
   if (neutralShares > 0n) {
      const extra = (neutralShares * complementProb) / effectiveSellProb;
      const denominator = effectiveLiquidity + extra;
      if (denominator > 0n) {
         payoutNeutral = (neutralShares * effectiveLiquidity * effectiveSellProb) / (PC * denominator);
      }
   }

   let payoutOver = 0n;
   if (overShares > 0n) {
      const initialExcess = postHelpRisk > maxRiskI128 ? postHelpRisk - maxRiskI128 : 0n;
      const excess = initialExcess + (overShares * effectiveSellProb) / PC;
      const penaltyAdjustment = (overRiskPenalty * excess) / PC;
      const extra = (overShares * complementProb) / effectiveSellProb;
      const denominator = effectiveLiquidity + extra + penaltyAdjustment;
      if (denominator > 0n) {
         payoutOver = (overShares * effectiveLiquidity * effectiveSellProb) / (PC * denominator);
      }
   }

   return payoutHelpful + payoutNeutral + payoutOver;
}

function computeAdvSellAgainst(
   outcomes: ControlledMarketOutcome[],
   outcomeIdx: number,
   numOutcomes: number,
   amount: bigint,
   sellShares: bigint,
   effectiveLiquidity: bigint,
   outcomeProb: bigint,
   maxRisk: bigint,
   bonusCap: bigint,
   overRiskPenalty: bigint,
): bigint {
   if (sellShares === 0n || amount === 0n) {
      return 0n;
   }

   const againstProb = PC - outcomeProb;
   if (againstProb === 0n) {
      throw new OperationError("Against probability is zero", "computeAdvControlledPayout");
   }

   const returnAtOraclePrice = (sellShares * againstProb) / PC;
   const projectedDeltaOutcome = returnAtOraclePrice;
   const projectedDeltaOther = returnAtOraclePrice - sellShares;

   let maxProjectedRisk: bigint | undefined;
   for (let j = 0; j < numOutcomes; j++) {
      const currentRisk = outcomes[j]!.outcome_risk;
      const projected =
         j === outcomeIdx
            ? BigInt(currentRisk) + projectedDeltaOutcome
            : BigInt(currentRisk) + projectedDeltaOther;
      const projectedClamped = clampI64(projected);
      if (maxProjectedRisk === undefined || projectedClamped > maxProjectedRisk) {
         maxProjectedRisk = projectedClamped;
      }
   }

   const bonus =
      (maxProjectedRisk ?? 0n) > 0n && maxRisk > 0n
         ? (bonusCap * ((maxProjectedRisk ?? 0n) < maxRisk ? (maxProjectedRisk ?? 0n) : maxRisk)) / maxRisk
         : 0n;

   const scaledBonus = (againstProb * bonus) / PC;
   let effectiveSellAgainstProb = againstProb - scaledBonus;
   if (effectiveSellAgainstProb <= 0n) {
      effectiveSellAgainstProb = 1n;
   }

   const helpfulShares = sHelpIdxInc(
      outcomes,
      outcomeIdx,
      numOutcomes,
      effectiveSellAgainstProb,
      outcomeProb,
      PC,
      effectiveSellAgainstProb,
      PC,
      outcomeProb,
      sellShares,
   );

   const riskIncreaseOutcome = (helpfulShares * effectiveSellAgainstProb) / PC;
   const postHelpRisk = outcomes[outcomeIdx]!.outcome_risk + riskIncreaseOutcome;
   const maxRiskI128 = maxRisk;
   let remainingShares = sellShares - helpfulShares;
   if (remainingShares < 0n) {
      remainingShares = 0n;
   }

   let neutralShares = 0n;
   if (postHelpRisk < maxRiskI128 && remainingShares > 0n) {
      const gap = maxRiskI128 - postHelpRisk;
      const maxSharesForGap = (gap * PC) / effectiveSellAgainstProb;
      neutralShares = maxSharesForGap < remainingShares ? maxSharesForGap : remainingShares;
   }

   let overShares = remainingShares - neutralShares;
   if (overShares < 0n) {
      overShares = 0n;
   }

   let payoutHelpful = 0n;
   if (helpfulShares > 0n) {
      payoutHelpful = (helpfulShares * effectiveSellAgainstProb) / PC;
   }

   let payoutNeutral = 0n;
   if (neutralShares > 0n) {
      const extra = (neutralShares * outcomeProb) / effectiveSellAgainstProb;
      const denominator = effectiveLiquidity + extra;
      if (denominator > 0n) {
         payoutNeutral =
            (neutralShares * effectiveLiquidity * effectiveSellAgainstProb) / (PC * denominator);
      }
   }

   let payoutOver = 0n;
   if (overShares > 0n) {
      const initialExcess = postHelpRisk > maxRiskI128 ? postHelpRisk - maxRiskI128 : 0n;
      const excess = initialExcess + (overShares * effectiveSellAgainstProb) / PC;
      const penaltyAdjustment = (overRiskPenalty * excess) / PC;
      const extra = (overShares * outcomeProb) / effectiveSellAgainstProb;
      const denominator = effectiveLiquidity + extra + penaltyAdjustment;
      if (denominator > 0n) {
         payoutOver =
            (overShares * effectiveLiquidity * effectiveSellAgainstProb) / (PC * denominator);
      }
   }

   return payoutHelpful + payoutNeutral + payoutOver;
}

export type AdvOddsOperation = "BuyFor" | "BuyAgainst" | "SellFor" | "SellAgainst";

/**
 * Returns `potential_return` (buys) or `net_return` (sells) matching on-chain AdvControlled math (`adv_controlled_bet.rs`).
 *
 * - **Buys:** `amount` is instruction stake (same as Rust `amount`).
 * - **Sells:** Rust passes **effective stake** as `amount` and **shares** separately (`sell_shares`). Pass both from your bet account when you need an exact match; the odds helper in `readers.ts` passes the share size for both when you only supply share amount.
 */
export function computeAdvControlledPayout(
   operation: AdvOddsOperation,
   outcomes: ControlledMarketOutcome[],
   outcomeIdx0: number,
   amount: bigint,
   effectiveLiquidity: bigint,
   outcomeProb: bigint,
   maxRisk: bigint,
   bonusCap: bigint,
   overRiskPenalty: bigint,
   sellShares?: bigint,
): bigint {
   const numOutcomes = outcomes.length;
   assertU64("amount", amount);
   assertU64("effectiveLiquidity", effectiveLiquidity);
   assertU64("outcomeProb", outcomeProb);
   assertU64("maxRisk", maxRisk);
   assertU64("bonusCap", bonusCap);
   assertU64("overRiskPenalty", overRiskPenalty);

   if (outcomeIdx0 < 0 || outcomeIdx0 >= numOutcomes) {
      throw new OperationError("Invalid outcome index (0-based)", "computeAdvControlledPayout");
   }

   let net: bigint;
   if (operation === "BuyFor") {
      net = computeAdvBuyFor(
         outcomes,
         outcomeIdx0,
         numOutcomes,
         amount,
         effectiveLiquidity,
         outcomeProb,
         maxRisk,
         bonusCap,
         overRiskPenalty,
      );
   } else if (operation === "BuyAgainst") {
      net = computeAdvBuyAgainst(
         outcomes,
         outcomeIdx0,
         numOutcomes,
         amount,
         effectiveLiquidity,
         outcomeProb,
         maxRisk,
         bonusCap,
         overRiskPenalty,
      );
   } else if (operation === "SellFor") {
      const sh = sellShares ?? amount;
      assertU64("sellShares", sh);
      net = computeAdvSellFor(
         outcomes,
         outcomeIdx0,
         numOutcomes,
         amount,
         sh,
         effectiveLiquidity,
         outcomeProb,
         maxRisk,
         bonusCap,
         overRiskPenalty,
      );
   } else {
      const sh = sellShares ?? amount;
      assertU64("sellShares", sh);
      net = computeAdvSellAgainst(
         outcomes,
         outcomeIdx0,
         numOutcomes,
         amount,
         sh,
         effectiveLiquidity,
         outcomeProb,
         maxRisk,
         bonusCap,
         overRiskPenalty,
      );
   }

   assertU64("netPayout", net);
   return net;
}
