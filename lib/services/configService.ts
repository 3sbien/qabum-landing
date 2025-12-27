import { StoreConfig } from '../types/qabum';

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
