import { getMerchantSalesSnapshot } from './dataService';
import { REPUTATION_TIER_RULES_V1 } from '../config/reputationRules';
import {
    MerchantReputationProfile,
    MerchantSalesSnapshot,
    ReputationReasonCode,
    ReputationScoreBreakdown,
    ReputationTier,
    ReputationTierRule,
} from '../types/risk';

function clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
}

function qualifiesForTier(snapshot: MerchantSalesSnapshot, totalScore: number, rule: ReputationTierRule): boolean {
    if (totalScore < rule.minScore) return false;
    if (snapshot.monthsActive < rule.minMonthsActive) return false;
    if (snapshot.recentActiveMonths < rule.minRecentActiveMonths) return false;
    if (snapshot.failedSplitCount > rule.maxFailedSplits) return false;
    if (rule.requiresNoRecentDrop && snapshot.hasRecentDrop) return false;
    return true;
}

function deriveTier(snapshot: MerchantSalesSnapshot, totalScore: number): ReputationTier {
    const matchedRule = REPUTATION_TIER_RULES_V1.find((rule) => qualifiesForTier(snapshot, totalScore, rule));
    return matchedRule?.tier || 'REP1';
}

export function deriveMerchantReputationProfile(
    snapshot: MerchantSalesSnapshot,
): MerchantReputationProfile {
    const reasonCodes: ReputationReasonCode[] = [];

    let volume = 0;
    if (snapshot.averageMonthlyVolume >= 8000) {
        volume = 20;
        reasonCodes.push('GOOD_VOLUME');
    } else if (snapshot.averageMonthlyVolume >= 3000) {
        volume = 12;
        reasonCodes.push('MODEST_VOLUME');
    } else {
        volume = snapshot.averageMonthlyVolume > 0 ? 6 : 0;
        reasonCodes.push('LOW_VOLUME');
    }

    let stability = 0;
    if (snapshot.monthlyVolatilityIndex <= 0.25) {
        stability = 20;
        reasonCodes.push('LOW_VOLATILITY');
    } else if (snapshot.monthlyVolatilityIndex <= 0.45) {
        stability = 12;
        reasonCodes.push('MEDIUM_VOLATILITY');
    } else {
        stability = snapshot.monthlyVolatilityIndex <= 0.7 ? 6 : 0;
        reasonCodes.push('HIGH_VOLATILITY');
    }

    let tenure = 0;
    if (snapshot.monthsActive >= 12) {
        tenure = 20;
        reasonCodes.push('LONG_TRACK_RECORD');
    } else if (snapshot.monthsActive >= 6) {
        tenure = 12;
        reasonCodes.push('MID_TRACK_RECORD');
    } else {
        tenure = snapshot.monthsActive >= 3 ? 6 : 0;
        reasonCodes.push('SHORT_TRACK_RECORD');
    }

    let activity = 0;
    if (snapshot.recentActiveMonths >= 3) {
        activity = 15;
        reasonCodes.push('CONSISTENT_RECENT_ACTIVITY');
    } else if (snapshot.recentActiveMonths >= 2) {
        activity = 10;
        reasonCodes.push('PARTIAL_RECENT_ACTIVITY');
    } else {
        activity = snapshot.recentActiveMonths >= 1 ? 5 : 0;
        reasonCodes.push('WEAK_RECENT_ACTIVITY');
    }

    let discipline = 0;
    if (snapshot.failedSplitCount === 0) {
        discipline = 15;
        reasonCodes.push('NO_FAILED_SPLITS');
    } else if (snapshot.failedSplitCount <= 1) {
        discipline = 10;
        reasonCodes.push('MINOR_FAILED_SPLITS');
    } else {
        discipline = snapshot.failedSplitCount <= 3 ? 4 : 0;
        reasonCodes.push('REPEATED_FAILED_SPLITS');
    }

    const penalties = snapshot.hasRecentDrop ? 12 : 0;
    if (snapshot.hasRecentDrop) {
        reasonCodes.push('RECENT_DROP_PENALTY');
    }

    const total = clampScore(volume + stability + tenure + activity + discipline - penalties);
    const repTier = deriveTier(snapshot, total);

    const scoreBreakdown: ReputationScoreBreakdown = {
        volume,
        stability,
        tenure,
        activity,
        discipline,
        penalties,
        total,
    };

    return {
        merchantId: snapshot.merchantId,
        storeId: snapshot.storeId,
        repTier,
        repScore: total,
        reasonCodes,
        scoreBreakdown,
    };
}

export async function getMerchantReputationProfile(params: {
    storeId: string;
    merchantId: string;
}): Promise<MerchantReputationProfile> {
    const snapshot = await getMerchantSalesSnapshot(params);
    return deriveMerchantReputationProfile(snapshot);
}
