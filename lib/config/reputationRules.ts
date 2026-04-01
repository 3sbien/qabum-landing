import { ReputationTierRule } from '../types/risk';

export const REPUTATION_TIER_RULES_V1: ReputationTierRule[] = [
    {
        tier: 'REP3',
        minScore: 80,
        minMonthsActive: 12,
        minRecentActiveMonths: 3,
        maxFailedSplits: 1,
        requiresNoRecentDrop: true,
        summary: 'Strong merchant profile with stable activity and premium operating trust.',
    },
    {
        tier: 'REP2',
        minScore: 55,
        minMonthsActive: 6,
        minRecentActiveMonths: 2,
        maxFailedSplits: 3,
        requiresNoRecentDrop: false,
        summary: 'Operationally acceptable merchant with fair continuity and manageable risk signals.',
    },
    {
        tier: 'REP1',
        minScore: 0,
        minMonthsActive: 0,
        minRecentActiveMonths: 0,
        maxFailedSplits: Number.MAX_SAFE_INTEGER,
        requiresNoRecentDrop: false,
        summary: 'Basic entry-level reputation. Merchant is still early, thin-file, or behaviorally weaker.',
    },
];
