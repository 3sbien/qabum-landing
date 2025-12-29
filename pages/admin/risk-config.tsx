
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { RiskConfig, GlobalRiskConfig, SectorCapConfig } from '../../lib/types/riskConfig';
import { MerchantSector } from '../../lib/types/risk';

const KNOWN_SECTORS: MerchantSector[] = ['HIGH_SENSITIVITY', 'STANDARD_PYME', 'HIGH_MARGIN_SERVICE'];

export default function AdminRiskConfigPage() {
    const [token, setToken] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [config, setConfig] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [statusData, setStatusData] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

    useEffect(() => {
        const stored = sessionStorage.getItem('qabum_admin_token');
        if (stored) {
            setToken(stored);
        }
    }, []);

    const handleAuth = () => {
        if (!token.trim()) return;
        sessionStorage.setItem('qabum_admin_token', token);
        setIsAuthenticated(true);
        loadConfig();
    };

    const loadConfig = async () => {
        setLoading(true);
        setStatusData(null);
        try {
            const res = await fetch('/api/risk-config', {
                headers: { 'x-qabum-admin-token': token }
            });
            if (res.status === 401) {
                setStatusData({ type: 'error', msg: 'Invalid Token / Token Inválido' });
                setIsAuthenticated(false);
                return;
            }
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            setConfig(data);
        } catch (e) {
            setStatusData({ type: 'error', msg: 'Connection Error / Error de Conexión' });
        } finally {
            setLoading(false);
        }
    };

    const normalizeDecimalClient = (v: any): number => {
        if (typeof v === 'number') return v;
        if (!v) return NaN;
        const s = String(v).replace(',', '.').trim();
        if (s === '') return NaN;
        return parseFloat(s);
    };

    const handleSave = async () => {
        if (!config) return;
        setLoading(true);
        setStatusData(null);

        // Normalize payload and check for NaNs
        const payload = JSON.parse(JSON.stringify(config));
        const errors: string[] = [];

        // Global
        Object.keys(payload.global).forEach(k => {
            const val = normalizeDecimalClient(payload.global[k]);
            if (Number.isNaN(val)) {
                errors.push(`Global field '${k}' is invalid (NaN).`);
            } else {
                payload.global[k] = val;
            }
        });

        // Sectors
        KNOWN_SECTORS.forEach(idxSector => { // Note: KNOWN_SECTORS is string[]
            const sector = idxSector as any;
            if (payload.sectorCaps[sector]) {
                const cap = normalizeDecimalClient(payload.sectorCaps[sector].ethicalCap);
                if (Number.isNaN(cap)) {
                    errors.push(`Sector '${sector}' ethicalCap is invalid.`);
                } else {
                    payload.sectorCaps[sector].ethicalCap = cap;
                }

                // maxAdvanceMultipleOfAvgMonthlySales if present
                if (payload.sectorCaps[sector].maxAdvanceMultipleOfAvgMonthlySales !== undefined) {
                    const m = normalizeDecimalClient(payload.sectorCaps[sector].maxAdvanceMultipleOfAvgMonthlySales);
                    if (Number.isNaN(m) && payload.sectorCaps[sector].maxAdvanceMultipleOfAvgMonthlySales !== "") {
                        // allow empty string if optional? But backend coerces empty to null? 
                        // RiskConfigValidation coerceDecimal returns null on empty.
                        // So here we should maybe set to null/undefined if NaN?? 
                        // Let's be strict: if user typed garbage, error. If empty, maybe OK?
                        // If string is empty, normalizeDecimalClient returns NaN above? No, checked '' -> NaN.
                        // Let's strictly require valid number if provided.
                        errors.push(`Sector '${sector}' maxAdvanceMultiple is invalid.`);
                    } else if (!Number.isNaN(m)) {
                        payload.sectorCaps[sector].maxAdvanceMultipleOfAvgMonthlySales = m;
                    }
                }
            }
        });

        if (errors.length > 0) {
            setStatusData({ type: 'error', msg: `Validation Error: ${errors[0]}` });
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/risk-config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-qabum-admin-token': token
                },
                body: JSON.stringify(payload)
            });
            const resData = await res.json();
            if (!res.ok) {
                setStatusData({
                    type: 'error',
                    msg: `Error: ${resData.message} ${resData.errors ? JSON.stringify(resData.errors) : ''}`
                });
            } else {
                setConfig(resData); // update with server response (updatedAt, version)
                setStatusData({ type: 'success', msg: 'Configuration Saved / Configuración Guardada' });
            }
        } catch (e) {
            setStatusData({ type: 'error', msg: 'Save Failed / Error al Guardar' });
        } finally {
            setLoading(false);
        }
    };

    const updateGlobal = (field: keyof GlobalRiskConfig, value: any) => {
        if (!config) return;
        setConfig({
            ...config,
            global: { ...config.global, [field]: value }
        });
    };

    const updateSector = (sector: MerchantSector, field: keyof SectorCapConfig, value: any) => {
        if (!config) return;
        setConfig({
            ...config,
            sectorCaps: {
                ...config.sectorCaps,
                [sector]: {
                    ...config.sectorCaps[sector],
                    [field]: value
                }
            }
        });
    };

    // --- UI HELPERS ---
    const InputNumber = ({ label, value, onChange, step = 0.01, min = 0, max }: { label: string, value: any, onChange: (n: any) => void, step?: number, min?: number, max?: number }) => (
        <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>{label}</label>
            <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #ccc',
                    fontFamily: 'inherit'
                }}
            />
        </div>
    );

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#FFFFFF', minHeight: '100vh', padding: '40px' }}>
            <Head>
                <title>Qabum™ Admin Risk Configuration</title>
            </Head>
            <div style={{ maxWidth: '900px', margin: '0 auto', background: '#FFFFFF' }}>

                {/* BRAND HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #00247D', paddingBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Fallback to text if image fails loading, but assuming it exists based on other pages */}
                        <img src="/logo-azul.png" alt="Qabum™" style={{ height: '28px', display: 'block' }} />
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#00247D' }}>Qabum™</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Internal Use Only / Solo para uso interno
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#00247D', margin: 0 }}>
                        Supra-Administrator: Risk Parameters<br />
                        <span style={{ fontSize: '16px', fontWeight: 'normal', color: '#666' }}>Supra-Administrador: Parámetros de Riesgo</span>
                    </h1>
                    {config && (
                        <div style={{ textAlign: 'right', fontSize: '12px', color: '#888' }}>
                            v{config.version}<br />
                            {new Date(config.updatedAt).toLocaleString()}
                        </div>
                    )}
                </div>

                {!isAuthenticated || !config ? (
                    <div style={{ maxWidth: '400px', margin: '60px auto', textAlign: 'center' }}>
                        <div style={{ marginBottom: '24px', color: '#00247D' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <p style={{ marginBottom: '20px', color: '#444' }}>
                            Enter Supra-Admin Token to access sensitive config.<br />
                            <span style={{ fontSize: '13px', color: '#666' }}>Ingrese Token de Supra-Administrador.</span>
                        </p>
                        <input
                            type="password"
                            placeholder="Enter token / Ingrese token"
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            style={{
                                padding: '12px', width: '100%', marginBottom: '20px',
                                border: '1px solid #ccc', borderRadius: '6px', fontSize: '16px'
                            }}
                        />
                        <button
                            onClick={handleAuth}
                            disabled={loading || !token}
                            style={{
                                background: '#00247D', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer',
                                fontWeight: 'bold', width: '100%', fontSize: '14px', transition: 'background 0.2s'
                            }}
                        >
                            {loading ? 'Verifying...' : 'Access Admin Panel'}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* GLOBAL CONFIG */}
                        <section style={{ marginBottom: '40px' }}>
                            <h2 style={{ fontSize: '18px', color: '#333', borderLeft: '4px solid #00247D', paddingLeft: '12px', marginBottom: '20px' }}>
                                Global Risk Parameters / Parámetros Globales
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <InputNumber
                                    label="Default Bank MDR (Decimal, e.g. 0.03)"
                                    value={config.global.defaultMdr}
                                    onChange={(v) => updateGlobal('defaultMdr', v)}
                                    max={1}
                                />
                                <InputNumber
                                    label="Default Qabum Margin Cap (Decimal)"
                                    value={config.global.defaultQabumMarginCap}
                                    onChange={(v) => updateGlobal('defaultQabumMarginCap', v)}
                                    max={1}
                                />
                                <InputNumber
                                    label="Default Repayment Rate (Decimal)"
                                    value={config.global.defaultRepaymentRate}
                                    onChange={(v) => updateGlobal('defaultRepaymentRate', v)}
                                    max={1}
                                />
                                <InputNumber
                                    label="Max Advance Multiple (of Avg Monthly Sales)"
                                    value={config.global.maxAdvanceMultipleOfAvgMonthlySales}
                                    onChange={(v) => updateGlobal('maxAdvanceMultipleOfAvgMonthlySales', v)}
                                    max={10}
                                />
                                <InputNumber
                                    label="Min Payback Months"
                                    value={config.global.minPaybackMonths}
                                    onChange={(v) => updateGlobal('minPaybackMonths', v)}
                                    step={1} min={1} max={60}
                                />
                                <InputNumber
                                    label="Max Payback Months"
                                    value={config.global.maxPaybackMonths}
                                    onChange={(v) => updateGlobal('maxPaybackMonths', v)}
                                    step={1} min={1} max={60}
                                />
                                <InputNumber
                                    label="Min Platform Age (Months)"
                                    value={config.global.minPlatformAgeMonths}
                                    onChange={(v) => updateGlobal('minPlatformAgeMonths', v)}
                                    step={1} min={0}
                                />
                                <InputNumber
                                    label="Min Active Months (Last N)"
                                    value={config.global.minActiveMonthsLastN}
                                    onChange={(v) => updateGlobal('minActiveMonthsLastN', v)}
                                    step={1} min={0}
                                />
                            </div>
                        </section>

                        {/* SECTOR CAPS */}
                        <section style={{ marginBottom: '40px' }}>
                            <h2 style={{ fontSize: '18px', color: '#333', borderLeft: '4px solid #00247D', paddingLeft: '12px', marginBottom: '20px' }}>
                                Sector Ethical Caps / Topes Éticos por Sector
                            </h2>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                        <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Sector</th>
                                        <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Ethical Cap (Decimal)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {KNOWN_SECTORS.map(sector => (
                                        <tr key={sector} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '12px', fontWeight: '500' }}>{sector}</td>
                                            <td style={{ padding: '12px' }}>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={config.sectorCaps[sector]?.ethicalCap ?? 0}
                                                    onChange={(e) => updateSector(sector, 'ethicalCap', e.target.value)}
                                                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '120px' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>

                        {/* ACTIONS */}
                        <div style={{ display: 'flex', gap: '15px', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                style={{
                                    background: '#00247D', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: '14px', flex: 1
                                }}
                            >
                                {loading ? 'Saving...' : 'Save Changes / Guardar Cambios'}
                            </button>
                            <button
                                onClick={loadConfig}
                                disabled={loading}
                                style={{
                                    background: 'transparent', color: '#666', border: '1px solid #ccc', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: '14px'
                                }}
                            >
                                Discard / Reload
                            </button>
                        </div>
                    </>
                )}

                {statusData && (
                    <div style={{
                        marginTop: '20px',
                        padding: '15px',
                        borderRadius: '6px',
                        backgroundColor: statusData.type === 'error' ? '#ffeeee' : '#eeffee',
                        color: statusData.type === 'error' ? '#cc0000' : '#006600',
                        border: `1px solid ${statusData.type === 'error' ? '#cc0000' : '#006600'}`
                    }}>
                        {statusData.msg}
                    </div>
                )}

                {/* FOOTER */}
                <div style={{ textAlign: 'center', marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #f9f9f9' }}>
                    <a href="https://qabum.com" target="_blank" rel="noreferrer" style={{ color: '#00247D', fontWeight: 'bold', textDecoration: 'none', fontSize: '12px' }}>
                        Powered by Qabum™
                    </a>
                </div>

                <style>{`
                    @media print {
                        body { background-color: white !important; }
                        div[style*="max-width: 900px"] {
                            max-width: 100% !important;
                            box-shadow: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}
