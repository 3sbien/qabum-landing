import fs from 'fs/promises';
import path from 'path';
import { StoreConfig } from '../types/qabum';
import { RiskConfig } from '../types/riskConfig';

/**
 * SERVER-ONLY SERVICE
 * This file uses 'fs' and should NOT be imported into client-side bundles.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'riskConfig.json');
const AUDIT_FILE = path.join(DATA_DIR, 'riskConfig.audit.jsonl');

// Conservative defaults as per requirement
const DEFAULT_CONFIG: RiskConfig = {
    version: 1,
    updatedAt: new Date().toISOString(),
    global: {
        defaultMdr: 0.03,
        defaultQabumMarginCap: 0.05,
        defaultRepaymentRate: 0.10, // 10%
        maxAdvanceMultipleOfAvgMonthlySales: 1.0,
        minPaybackMonths: 1,
        maxPaybackMonths: 12,
        minPlatformAgeMonths: 3,
        minActiveMonthsLastN: 3,
    },
    sectorCaps: {
        HIGH_SENSITIVITY: { ethicalCap: 0.022 },
        STANDARD_PYME: { ethicalCap: 0.027 },
        HIGH_MARGIN_SERVICE: { ethicalCap: 0.030 },
    }
};

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

/**
 * Reads the current risk configuration from disk (server-side only).
 * Initializes with defaults if file is missing.
 */
export async function getRiskConfig(): Promise<RiskConfig> {
    await ensureDataDir();
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        return JSON.parse(data) as RiskConfig;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // File missing, write defaults and return them
            await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
            return DEFAULT_CONFIG;
        }
        throw error;
    }
}

/**
 * Updates the risk configuration safely.
 * - Reads previous
 * - Writes next (atomic-ish)
 * - Appends audit log
 */
export async function updateRiskConfig(next: RiskConfig, meta?: { reason?: string; actor?: string; userAgent?: string; ip?: string }): Promise<void> {
    await ensureDataDir();

    // Read previous for audit
    let previous: RiskConfig | null = null;
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        previous = JSON.parse(data);
    } catch (e) {
        // ignore if previous doesn't exist
    }

    // Set updated meta
    next.updatedAt = new Date().toISOString();
    // Increment version if previous exists
    if (previous) {
        next.version = previous.version + 1;
    }

    // Write Config: Write to temp file then rename for atomicity
    const tempFile = `${CONFIG_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(next, null, 2), 'utf-8');
    await fs.rename(tempFile, CONFIG_FILE);

    // Audit Log
    const auditEntry = {
        ts: new Date().toISOString(),
        actor: meta?.actor || 'unknown',
        reason: meta?.reason || '',
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        previous,
        next
    };

    try {
        await fs.appendFile(AUDIT_FILE, JSON.stringify(auditEntry) + '\n', 'utf-8');
    } catch (e) {
        console.error("Failed to append audit log", e);
    }
}

// SIMULACIÓN: Mapa en memoria de las configuraciones de las tiendas.
// Nota: En producción, esto se reemplazaría por una conexión a la tabla 'stores'.
const STORE_CONFIG_MOCK: Record<string, StoreConfig> = {
    'ec-qabum-001': {
        id: 'ec-qabum-001',
        code: 'QABUM_EC',
        countryCode: 'EC',
        currencyCode: 'USD',
        takeRateCap: 0.0300, // 3.00%
        defaultMdr: 0.0220, // MDR Banco Típico: 2.20%
        defaultQabumMarginCap: 0.0150, // Margen Qabum máximo: 1.50%
        defaultRepaymentRate: 0.0080, // Tasa que se intenta aplicar al repago: 0.80%
    },
    'uk-qabum-001': {
        id: 'uk-qabum-001',
        code: 'QABUM_UK',
        countryCode: 'GB',
        currencyCode: 'GBP',
        takeRateCap: 0.0250, // 2.50%
        defaultMdr: 0.0150, // 1.50%
        defaultQabumMarginCap: 0.0100, // 1.00%
        defaultRepaymentRate: 0.0050, // 0.50%
    },
};

/**
 * Simula la obtención de la configuración global y ética de la tienda por su ID.
 * Lanza un error si la configuración no existe, garantizando que el motor de split no corra con datos nulos.
 */
export function getStoreConfig(storeId: string): StoreConfig {
    const config = STORE_CONFIG_MOCK[storeId];
    if (!config) {
        throw new Error(`Configuración de tienda no encontrada para ID: ${storeId}`);
    }
    return config;
}
