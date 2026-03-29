import fs from 'fs/promises';
import path from 'path';
import { StoreConfig } from '../types/qabum';
import { RiskConfig } from '../types/riskConfig';

type RiskConfigAuditMeta = {
    reason?: string;
    actor?: string;
    userAgent?: string;
    ip?: string;
};

type RiskConfigAuditEvent = {
    ts: string;
    actor: string;
    reason: string;
    userAgent?: string;
    ip?: string;
    version: number;
    updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'riskConfig.json');
const AUDIT_FILE = path.join(DATA_DIR, 'riskConfig.audit.jsonl');

const EDGE_CONFIG_KEY = 'riskConfig';
const EDGE_CONFIG_AUDIT_KEY = 'riskConfigAudit';
const EDGE_CONFIG_AUDIT_LIMIT = 20;

const DEFAULT_CONFIG: RiskConfig = {
    version: 1,
    updatedAt: new Date().toISOString(),
    global: {
        defaultMdr: 0.03,
        defaultQabumMarginCap: 0.05,
        defaultRepaymentRate: 0.10,
        maxAdvanceMultipleOfAvgMonthlySales: 1.0,
        minPaybackMonths: 1,
        maxPaybackMonths: 12,
        minPlatformAgeMonths: 3,
        minActiveMonthsLastN: 3,
    },
    sectorCaps: {
        HIGH_SENSITIVITY: { ethicalCap: 0.022 },
        STANDARD_PYME: { ethicalCap: 0.027 },
        HIGH_MARGIN_SERVICE: { ethicalCap: 0.03 },
    },
};

function isVercelRuntime(): boolean {
    return process.env.VERCEL === '1';
}

function getEdgeConfigId(): string {
    const id = process.env.QABUM_EDGE_CONFIG_ID;
    if (!id) {
        throw new Error('Missing QABUM_EDGE_CONFIG_ID');
    }
    return id;
}

function getVercelApiToken(): string {
    const token = process.env.VERCEL_API_TOKEN;
    if (!token) {
        throw new Error('Missing VERCEL_API_TOKEN');
    }
    return token;
}

function cloneDefaultConfig(): RiskConfig {
    return JSON.parse(JSON.stringify({
        ...DEFAULT_CONFIG,
        updatedAt: new Date().toISOString(),
    })) as RiskConfig;
}

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

async function getEdgeConfigItem<T>(key: string): Promise<T | null> {
    const edgeConfigId = getEdgeConfigId();
    const apiToken = getVercelApiToken();

    const response = await fetch(
        `https://api.vercel.com/v1/edge-config/${edgeConfigId}/item/${encodeURIComponent(key)}`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Edge Config GET failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    return (payload?.value ?? null) as T | null;
}

async function patchEdgeConfigItems(
    items: Array<{
        operation: 'create' | 'update' | 'upsert' | 'delete';
        key: string;
        value?: unknown;
    }>,
): Promise<void> {
    const edgeConfigId = getEdgeConfigId();
    const apiToken = getVercelApiToken();

    const response = await fetch(
        `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items }),
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Edge Config PATCH failed (${response.status}): ${text}`);
    }
}

async function getRiskConfigLocal(): Promise<RiskConfig> {
    await ensureDataDir();

    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        return JSON.parse(data) as RiskConfig;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            const defaults = cloneDefaultConfig();
            await fs.writeFile(CONFIG_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
            return defaults;
        }
        throw error;
    }
}

async function updateRiskConfigLocal(
    next: RiskConfig,
    meta?: RiskConfigAuditMeta,
): Promise<RiskConfig> {
    await ensureDataDir();

    let previous: RiskConfig | null = null;
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        previous = JSON.parse(data) as RiskConfig;
    } catch {
        previous = null;
    }

    const persisted: RiskConfig = {
        ...next,
        updatedAt: new Date().toISOString(),
        version: previous ? previous.version + 1 : 1,
    };

    const tempFile = `${CONFIG_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(persisted, null, 2), 'utf-8');
    await fs.rename(tempFile, CONFIG_FILE);

    const auditEntry = {
        ts: new Date().toISOString(),
        actor: meta?.actor || 'unknown',
        reason: meta?.reason || '',
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        previous,
        next: persisted,
    };

    try {
        await fs.appendFile(AUDIT_FILE, JSON.stringify(auditEntry) + '\n', 'utf-8');
    } catch (error) {
        console.error('Failed to append local audit log', error);
    }

    return persisted;
}

async function getRiskConfigVercel(): Promise<RiskConfig> {
    const existing = await getEdgeConfigItem<RiskConfig>(EDGE_CONFIG_KEY);
    if (existing) {
        return existing;
    }

    return cloneDefaultConfig();
}

async function updateRiskConfigVercel(
    next: RiskConfig,
    meta?: RiskConfigAuditMeta,
): Promise<RiskConfig> {
    const previous = await getEdgeConfigItem<RiskConfig>(EDGE_CONFIG_KEY);

    const persisted: RiskConfig = {
        ...next,
        updatedAt: new Date().toISOString(),
        version: previous ? previous.version + 1 : 1,
    };

    const currentAudit =
        (await getEdgeConfigItem<RiskConfigAuditEvent[]>(EDGE_CONFIG_AUDIT_KEY)) || [];

    const auditEvent: RiskConfigAuditEvent = {
        ts: new Date().toISOString(),
        actor: meta?.actor || 'unknown',
        reason: meta?.reason || '',
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        version: persisted.version,
        updatedAt: persisted.updatedAt,
    };

    const nextAudit = [...currentAudit, auditEvent].slice(-EDGE_CONFIG_AUDIT_LIMIT);

    await patchEdgeConfigItems([
        {
            operation: 'upsert',
            key: EDGE_CONFIG_KEY,
            value: persisted,
        },
        {
            operation: 'upsert',
            key: EDGE_CONFIG_AUDIT_KEY,
            value: nextAudit,
        },
    ]);

    return persisted;
}

export async function getRiskConfig(): Promise<RiskConfig> {
    if (isVercelRuntime()) {
        return getRiskConfigVercel();
    }

    return getRiskConfigLocal();
}

export async function updateRiskConfig(
    next: RiskConfig,
    meta?: RiskConfigAuditMeta,
): Promise<RiskConfig> {
    if (isVercelRuntime()) {
        return updateRiskConfigVercel(next, meta);
    }

    return updateRiskConfigLocal(next, meta);
}

const STORE_CONFIG_MOCK: Record<string, StoreConfig> = {
    'ec-qabum-001': {
        id: 'ec-qabum-001',
        code: 'QABUM_EC',
        countryCode: 'EC',
        currencyCode: 'USD',
        takeRateCap: 0.03,
        defaultMdr: 0.022,
        defaultQabumMarginCap: 0.015,
        defaultRepaymentRate: 0.008,
    },
    'uk-qabum-001': {
        id: 'uk-qabum-001',
        code: 'QABUM_UK',
        countryCode: 'GB',
        currencyCode: 'GBP',
        takeRateCap: 0.025,
        defaultMdr: 0.015,
        defaultQabumMarginCap: 0.01,
        defaultRepaymentRate: 0.005,
    },
};

export function getStoreConfig(storeId: string): StoreConfig {
    const config = STORE_CONFIG_MOCK[storeId];
    if (!config) {
        throw new Error(`Configuración de tienda no encontrada para ID: ${storeId}`);
    }
    return config;
}
