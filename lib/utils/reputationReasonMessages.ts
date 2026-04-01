import { LocalizedReason, ReputationReasonCode } from '../types/risk';

const REPUTATION_REASON_MESSAGES: Record<ReputationReasonCode, Omit<LocalizedReason, 'code'>> = {
    GOOD_VOLUME: {
        en: 'Strong monthly sales volume supports operating confidence.',
        es: 'El volumen mensual sólido de ventas respalda la confianza operativa.',
    },
    MODEST_VOLUME: {
        en: 'Moderate monthly sales volume supports a workable operating base.',
        es: 'El volumen mensual moderado de ventas sostiene una base operativa viable.',
    },
    LOW_VOLUME: {
        en: 'Low sales volume limits commercial confidence and operating depth.',
        es: 'El volumen bajo de ventas limita la confianza comercial y la profundidad operativa.',
    },
    LOW_VOLATILITY: {
        en: 'Sales behavior is stable with low volatility.',
        es: 'El comportamiento de ventas es estable y con baja volatilidad.',
    },
    MEDIUM_VOLATILITY: {
        en: 'Sales behavior shows moderate volatility but remains manageable.',
        es: 'El comportamiento de ventas muestra volatilidad media pero sigue siendo manejable.',
    },
    HIGH_VOLATILITY: {
        en: 'Sales behavior is volatile and weakens predictability.',
        es: 'El comportamiento de ventas es volátil y debilita la previsibilidad.',
    },
    LONG_TRACK_RECORD: {
        en: 'The merchant has a long operating record on the platform.',
        es: 'El comercio tiene un historial largo de operación en la plataforma.',
    },
    MID_TRACK_RECORD: {
        en: 'The merchant has a mid-length operating record on the platform.',
        es: 'El comercio tiene un historial medio de operación en la plataforma.',
    },
    SHORT_TRACK_RECORD: {
        en: 'The merchant has a short operating record on the platform.',
        es: 'El comercio tiene un historial corto de operación en la plataforma.',
    },
    CONSISTENT_RECENT_ACTIVITY: {
        en: 'Recent platform activity has been consistent.',
        es: 'La actividad reciente en la plataforma ha sido consistente.',
    },
    PARTIAL_RECENT_ACTIVITY: {
        en: 'Recent platform activity is partial but still visible.',
        es: 'La actividad reciente en la plataforma es parcial pero todavía visible.',
    },
    WEAK_RECENT_ACTIVITY: {
        en: 'Recent platform activity is weak.',
        es: 'La actividad reciente en la plataforma es débil.',
    },
    NO_FAILED_SPLITS: {
        en: 'No failed split events were observed.',
        es: 'No se observaron eventos fallidos de split.',
    },
    MINOR_FAILED_SPLITS: {
        en: 'Only minor split frictions were observed.',
        es: 'Solo se observaron fricciones menores de split.',
    },
    REPEATED_FAILED_SPLITS: {
        en: 'Repeated split failures weaken operating discipline.',
        es: 'Los fallos repetidos de split debilitan la disciplina operativa.',
    },
    RECENT_DROP_PENALTY: {
        en: 'A recent drop in activity penalizes reputation quality.',
        es: 'Una caída reciente de actividad penaliza la calidad reputacional.',
    },
};

export function getLocalizedReputationReason(code: ReputationReasonCode): LocalizedReason {
    return {
        code,
        ...REPUTATION_REASON_MESSAGES[code],
    };
}

export function getLocalizedReputationReasons(codes: ReputationReasonCode[]): LocalizedReason[] {
    return codes.map(getLocalizedReputationReason);
}
