import React, { useState } from 'react';
import Head from 'next/head';
import { TransactionSplitResult } from '../lib/types/qabum';
import { AdvanceEligibilityResult, MerchantSalesSnapshot } from '../lib/types/risk';

// --- Interfaces ---
interface TransactionInput {
    storeId: string;
    merchantId: string;
    transactionAmount: number | string;
}

interface RiskRequestInput {
    storeId: string;
    merchantId: string;
    requestedAmount: number | string;
}

// Resultado completo para el estado
interface FullRiskResult extends AdvanceEligibilityResult {
    snapshot: MerchantSalesSnapshot;
}

// Constantes de estilo
const PRIMARY_BLUE = '#00247D';
const A4_WIDTH = '210mm';
const A4_MIN_HEIGHT = '297mm';
const TAKE_RATE_CAP_STORE = 0.03; // 3 %

const BackOfficePage: React.FC = () => {
    // Estado fijo de UI
    const [generatedAt] = useState(() => new Date());
    const [refId] = useState(() =>
        Math.random().toString(36).substr(2, 9).toUpperCase(),
    );

    // Estados core financiero
    const [splitInput, setSplitInput] = useState<TransactionInput>({
        storeId: 'ec-qabum-001',
        merchantId: 'merch-001',
        transactionAmount: 100,
    });
    const [splitResult, setSplitResult] = useState<TransactionSplitResult | null>(
        null,
    );
    const [splitLoading, setSplitLoading] = useState(false);
    const [splitError, setSplitError] = useState<string | null>(null);

    const [riskInput, setRiskInput] = useState<RiskRequestInput>({
        storeId: 'ec-qabum-001',
        merchantId: 'merch-001',
        requestedAmount: 1000,
    });
    const [fullRiskResult, setFullRiskResult] = useState<FullRiskResult | null>(
        null,
    );
    const [riskLoading, setRiskLoading] = useState(false);
    const [riskError, setRiskError] = useState<string | null>(null);

    // Aprobación humana
    const [humanAuthorizedAmount, setHumanAuthorizedAmount] =
        useState<string>('');
    const [approvalError, setApprovalError] = useState<string | null>(null);
    const [isApproved, setIsApproved] = useState(false);
    const [approvalDate, setApprovalDate] = useState<string | null>(null);

    // Pestañas
    const [activeTab, setActiveTab] = useState<'input' | 'report'>('input');

    // Handlers
    const handleSplitChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setSplitInput({ ...splitInput, [e.target.name]: e.target.value });

    const handleRiskChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setRiskInput({ ...riskInput, [e.target.name]: e.target.value });

    const handlePrint = () => {
        window.print();
    };

    const handleSplitSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSplitLoading(true);
        setSplitError(null);
        setSplitResult(null);

        try {
            const response = await fetch('/api/processTransaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...splitInput,
                    transactionAmount: Number(splitInput.transactionAmount),
                }),
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || 'Error processing transaction');
            setSplitResult(data.data);
        } catch (err: any) {
            setSplitError(err.message);
        } finally {
            setSplitLoading(false);
        }
    };

    const handleRiskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setRiskLoading(true);
        setRiskError(null);
        setFullRiskResult(null);
        setIsApproved(false);
        setHumanAuthorizedAmount('');
        setApprovalDate(null);

        try {
            // 1. Elegibilidad
            const eligibilityResponse = await fetch('/api/requestAdvanceEligibility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...riskInput,
                    requestedAmount: Number(riskInput.requestedAmount),
                }),
            });
            const eligibilityData: AdvanceEligibilityResult =
                await eligibilityResponse.json();
            if (!eligibilityResponse.ok)
                throw new Error(
                    eligibilityData.decisionReason || 'Error fetching eligibility',
                );

            // 2. Snapshot
            const snapshotResponse = await fetch('/api/getMerchantSnapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchantId: riskInput.merchantId,
                    storeId: riskInput.storeId,
                }),
            });
            const snapshot: MerchantSalesSnapshot = await snapshotResponse.json();
            if (!snapshotResponse.ok)
                throw new Error('Could not retrieve snapshot data');

            // 3. Combinar resultados
            setFullRiskResult({
                ...eligibilityData,
                snapshot,
            });

            if (eligibilityData.isEligible) {
                setHumanAuthorizedAmount(eligibilityData.approvedAmount.toString());
            }
            setActiveTab('report');
        } catch (err: any) {
            setRiskError(err.message);
        } finally {
            setRiskLoading(false);
        }
    };

    const handleAuthorize = () => {
        if (!fullRiskResult) return;

        const humanAmount = Number(humanAuthorizedAmount);

        const systemCap = Math.min(
            fullRiskResult.approvedAmount,
            fullRiskResult.riskProfile.maxAdvanceLimit,
        );

        if (isNaN(humanAmount) || humanAmount <= 0) {
            setApprovalError('Monto inválido / Invalid amount');
            return;
        }

        if (humanAmount > systemCap) {
            setApprovalError(
                `ERROR: No se puede autorizar más del monto recomendado por el sistema (USD ${systemCap.toLocaleString(
                    'en-US',
                    { minimumFractionDigits: 2 },
                )}).`,
            );
            setIsApproved(false);
            setApprovalDate(null);
            return;
        }

        setApprovalError(null);
        setIsApproved(true);
        setApprovalDate(
            new Date().toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }),
        );

        console.log('Advance Authorized:', {
            merchantId: fullRiskResult.merchantId,
            authorizedAmount: humanAmount,
            repaymentRate: fullRiskResult.riskProfile.recommendedRepaymentRate,
            authorizationDate: new Date().toISOString(),
        });
    };

    // Para leer campos opcionales del snapshot sin pelear con tipos
    const merchantSnapshot: any = fullRiskResult?.snapshot || {};

    return (
        <div
            style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                backgroundColor: '#ffffff',
                minHeight: '100vh',
                color: '#333',
                paddingBottom: '40px',
            }}
        >
            <Head>
                <title>Qabum™ Working Capital Advance Eligibility</title>
                <link rel="shortcut icon" href="/logo-azul.png" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            {/* HEADER (no se imprime) - Clean Layout */}
            <div
                className="no-print"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: '1px solid #e0e0e0',
                    backgroundColor: 'white',
                    marginBottom: '24px',
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img
                            src="/logo-azul.png"
                            alt="Qabum™"
                            style={{ height: '40px', display: 'block' }}
                        />
                        <h2
                            style={{
                                color: PRIMARY_BLUE,
                                margin: 0,
                                fontSize: '20px',
                                fontWeight: 600,
                            }}
                        >
                            Qabum™ Working Capital Advance Eligibility
                        </h2>
                    </div>
                    {/* Subtitle restored below title */}
                    <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666', lineHeight: 1.4 }}>
                        <strong>EN:</strong> Internal backoffice module for eligibility & decisioning<br />
                        <strong>ES:</strong> Backoffice interno para elegibilidad y decisiones de adelantos.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <button
                        onClick={() => setActiveTab('input')}
                        style={{
                            padding: '8px 16px',
                            cursor: 'pointer',
                            fontWeight: activeTab === 'input' ? 'bold' : 'normal',
                            backgroundColor: activeTab === 'input' ? '#f0f4ff' : 'transparent',
                            border: 'none',
                            color: activeTab === 'input' ? PRIMARY_BLUE : '#666',
                            borderRadius: '6px',
                            transition: 'all 0.2s',
                            fontSize: '14px',
                        }}
                    >
                        Data Entry
                    </button>
                    <button
                        onClick={() => setActiveTab('report')}
                        disabled={!fullRiskResult}
                        style={{
                            padding: '8px 16px',
                            cursor: !fullRiskResult ? 'not-allowed' : 'pointer',
                            fontWeight: activeTab === 'report' ? 'bold' : 'normal',
                            backgroundColor: activeTab === 'report' ? '#f0f4ff' : 'transparent',
                            border: 'none',
                            color: activeTab === 'report' ? PRIMARY_BLUE : !fullRiskResult ? '#ccc' : '#666',
                            borderRadius: '6px',
                            transition: 'all 0.2s',
                            fontSize: '14px',
                        }}
                    >
                        Decision Report
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={!fullRiskResult || activeTab !== 'report'}
                        style={{
                            padding: '8px 16px',
                            cursor: !fullRiskResult || activeTab !== 'report' ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            backgroundColor: activeTab === 'report' ? PRIMARY_BLUE : '#e0e0e0',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                        }}
                    >
                        Print / PDF
                    </button>
                </div>
            </div>

            {/* MAIN CONTAINER */}
            <div
                className="main-container"
                style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    padding: '0 16px',
                }}
            >
                {/* INPUT TAB */}
                {activeTab === 'input' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                        {/* Cards Section */}
                        <div className="cards-container">
                            <style jsx>{`
                                .cards-container {
                                    display: flex;
                                    gap: 24px;
                                }
                                @media (max-width: 768px) {
                                    .cards-container {
                                        flex-direction: column;
                                    }
                                }
                                .card {
                                    flex: 1;
                                    background-color: white;
                                    padding: 24px;
                                    border-radius: 10px;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                                    border: 1px solid #f0f0f0;
                                    display: flex;
                                    flex-direction: column;
                                }
                                .card-title {
                                    color: ${PRIMARY_BLUE};
                                    margin-bottom: 16px;
                                    font-size: 18px;
                                    font-weight: 700;
                                    padding-bottom: 12px;
                                    border-bottom: 1px solid #f5f5f5;
                                }
                                .card-desc {
                                    font-size: 13px;
                                    color: #555;
                                    margin-bottom: 24px;
                                    line-height: 1.5;
                                }
                                label {
                                    display: block;
                                    margin-bottom: 8px;
                                    font-size: 13px;
                                    font-weight: 700;
                                    color: #333;
                                }
                                input {
                                    width: 100%;
                                    padding: 10px 12px;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 6px;
                                    font-size: 14px;
                                    margin-bottom: 20px;
                                    transition: all 0.2s;
                                    background-color: #FAFAFA;
                                }
                                input:focus {
                                    border-color: ${PRIMARY_BLUE};
                                    background-color: white;
                                    outline: none;
                                    box-shadow: 0 0 0 2px rgba(0, 36, 125, 0.1);
                                }
                                button.action-btn {
                                    width: 100%;
                                    padding: 12px;
                                    background-color: ${PRIMARY_BLUE};
                                    color: white;
                                    border: none;
                                    border-radius: 6px;
                                    font-size: 14px;
                                    font-weight: bold;
                                    cursor: pointer;
                                    transition: background-color 0.2s;
                                }
                                button.action-btn:hover {
                                    background-color: #001a5c;
                                }
                                button.action-btn:disabled {
                                    background-color: #ccc;
                                    cursor: not-allowed;
                                }
                            `}</style>

                            {/* ASSESSMENT CARD */}
                            <div className="card">
                                <h3 className="card-title">
                                    Working Capital Advance Assessment / Evaluación de Adelanto de Capital
                                </h3>
                                <div className="card-desc">
                                    <strong>EN:</strong> This panel performs an internal eligibility assessment for a working-capital flow, using only digital sales processed within the closed Qabum™ ecosystem.<br />
                                    <strong>ES:</strong> Este panel realiza una evaluación interna de elegibilidad para un flujo de capital de trabajo, utilizando únicamente las ventas digitales procesadas dentro del ecosistema cerrado de Qabum™.
                                </div>

                                <form onSubmit={handleRiskSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <div>
                                        <label>Merchant ID / ID de Comercio</label>
                                        <input
                                            type="text"
                                            name="merchantId"
                                            value={riskInput.merchantId}
                                            onChange={handleRiskChange}
                                            placeholder="e.g., merch-001"
                                        />
                                    </div>

                                    <div>
                                        <label>Requested Advance Amount (USD)</label>
                                        <input
                                            type="number"
                                            name="requestedAmount"
                                            value={riskInput.requestedAmount}
                                            onChange={handleRiskChange}
                                            placeholder="e.g., 1000"
                                        />
                                    </div>

                                    <button type="submit" className="action-btn" disabled={riskLoading} style={{ marginTop: 'auto' }}>
                                        {riskLoading ? 'Processing...' : 'Generate Eligibility Report'}
                                    </button>
                                </form>

                                {riskError && (
                                    <div style={{ color: '#d32f2f', marginTop: '16px', fontSize: '13px', padding: '12px', backgroundColor: '#FFF5F5', borderRadius: '6px', border: '1px solid #FFCDD2' }}>
                                        {riskError}
                                    </div>
                                )}

                                {/* Merchant Context Block */}
                                {fullRiskResult && (
                                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                                        <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold', marginBottom: '12px', color: '#888' }}>
                                            Merchant Summary
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '13px', color: '#444' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #eee', paddingBottom: '4px' }}>
                                                <span>Name:</span>
                                                <span style={{ fontWeight: 600 }}>{merchantSnapshot.merchantName || 'N/A'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #eee', paddingBottom: '4px' }}>
                                                <span>Joined:</span>
                                                <span style={{ fontWeight: 600 }}>{merchantSnapshot.onboardDate || 'N/A'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #eee', paddingBottom: '4px' }}>
                                                <span>Avg Monthly Vol:</span>
                                                <span style={{ fontWeight: 600 }}>
                                                    {merchantSnapshot.averageMonthlyVolume
                                                        ? merchantSnapshot.averageMonthlyVolume.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                                                        : 'N/A'}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Months Active:</span>
                                                <span style={{ fontWeight: 600 }}>{merchantSnapshot.monthsActive ?? 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* TRANSACTION CORE CARD */}
                            <div className="card">
                                <h3 className="card-title">
                                    Transaction Core (Split & Ethical Cap) / Núcleo de Transacción (Split y Tope Ético)
                                </h3>
                                <div className="card-desc">
                                    <strong>EN:</strong> This panel simulates the internal transaction core: it applies the MDR of the payment processor, the Qabum™ margin and the ethical take-rate cap defined for the merchant’s sector inside the closed digital ecosystem.<br />
                                    <strong>ES:</strong> Este panel simula el núcleo transaccional interno: aplica el MDR del procesador de pagos, el margen Qabum™ y el tope ético definido para el sector del comercio dentro del ecosistema digital cerrado.
                                </div>

                                <form onSubmit={handleSplitSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <div>
                                        <label>Merchant ID / ID de Comercio</label>
                                        <input
                                            type="text"
                                            name="merchantId"
                                            value={splitInput.merchantId}
                                            onChange={handleSplitChange}
                                        />
                                    </div>

                                    <div>
                                        <label>Transaction Amount (USD)</label>
                                        <input
                                            type="number"
                                            name="transactionAmount"
                                            value={splitInput.transactionAmount}
                                            onChange={handleSplitChange}
                                        />
                                    </div>

                                    <button type="submit" className="action-btn" disabled={splitLoading} style={{ marginTop: 'auto' }}>
                                        {splitLoading ? 'Testing Split...' : 'Test Split Engine'}
                                    </button>
                                </form>

                                {splitResult && (
                                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#F6FFED', color: '#389E0D', borderRadius: '6px', fontSize: '13px', border: '1px solid #B7EB8F' }}>
                                        ✅ <strong>Success:</strong> Ethical cap respected.
                                    </div>
                                )}
                                {splitError && (
                                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#FFF5F5', color: '#CF1322', borderRadius: '6px', fontSize: '13px', border: '1px solid #FFCDD2' }}>
                                        {splitError}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Explanatory Text Section */}
                        <div style={{
                            maxWidth: '960px',
                            margin: '0 auto',
                            backgroundColor: 'white',
                            padding: '24px 32px',
                            borderRadius: '10px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            border: '1px solid #f0f0f0'
                        }}>
                            <p style={{ marginBottom: '12px', fontSize: '14px', lineHeight: '1.6', color: '#555' }}>
                                <strong>EN:</strong> Internal backoffice module to simulate and document ethical working-capital flows inside a closed digital ecosystem. Eligibility, suggested amounts and expected settlement horizon are determined using only the merchant’s historical digital sales and behavioural / reputational signals within Qabum™. The working-capital amount is gradually settled through a small share of future transactions on the platform, under a sector-specific ethical take-rate cap that ensures the total percentage deducted from each sale never exceeds the limit defined for that type of business.
                            </p>
                            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#555' }}>
                                <strong>ES:</strong> Módulo de backoffice interno para simular y documentar flujos éticos de capital de trabajo dentro de un ecosistema digital cerrado. La elegibilidad, los montos sugeridos y el horizonte estimado de cobertura se determinan únicamente usando las ventas digitales históricas del comercio y señales de comportamiento / reputación dentro de Qabum™. El monto de capital de trabajo se va cubriendo de forma gradual con un porcentaje pequeño de las transacciones futuras en la plataforma, bajo un tope ético por sector que garantiza que el porcentaje total descontado en cada venta nunca supere el límite definido para ese tipo de negocio.
                            </p>
                        </div>

                        {/* Footer (Main Page) */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                                Internal Use Only / Solo para uso interno
                            </div>
                            <div style={{ marginBottom: '16px', fontSize: '12px' }}>
                                <a
                                    href="https://qabum.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        color: PRIMARY_BLUE,
                                        fontWeight: 'bold',
                                        textDecoration: 'none',
                                    }}
                                >
                                    Powered by Qabum™
                                </a>
                            </div>
                        </div>
                    </div>
                )}


                {/* REPORT TAB */}
                {activeTab === 'report' &&
                    fullRiskResult &&
                    fullRiskResult.riskProfile &&
                    fullRiskResult.snapshot && (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div
                                className="a4-page"
                                style={{
                                    width: A4_WIDTH,
                                    minHeight: '297mm', // Only for screen, overridden in print
                                    backgroundColor: 'white',
                                    padding: '40px', // Restored professional padding
                                    boxShadow: '0 0 15px rgba(0,0,0,0.1)',
                                    position: 'relative',
                                    color: '#333',
                                }}
                            >
                                {/* Header PDF */}
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        borderBottom: '2px solid #ccc',
                                        paddingBottom: 20,
                                        marginBottom: 25, // Balanced margin
                                    }}
                                >
                                    <img
                                        src="/logo-azul.png"
                                        alt="Qabum™"
                                        style={{ height: '48px' }}
                                    />
                                    <div style={{ textAlign: 'right' }}>
                                        <h1
                                            style={{
                                                margin: 0,
                                                fontSize: '24px',
                                                color: PRIMARY_BLUE,
                                            }}
                                        >
                                            Working Capital Advance Eligibility Report
                                        </h1>
                                        <p
                                            style={{ margin: 0, fontSize: '12px', color: '#666' }}
                                        >
                                            Internal analysis for Qabum™ Working Capital.
                                        </p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                            Generado: {generatedAt.toLocaleString()}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                            Ref: {refId}
                                        </p>
                                    </div>
                                </div>

                                {/* 1. Merchant Profile */}
                                <div style={{ marginBottom: '22px' }}>
                                    <h3
                                        style={{
                                            fontSize: '13px',
                                            textTransform: 'uppercase',
                                            borderBottom: '1px solid #eee',
                                            paddingBottom: '6px',
                                            marginTop: 0,
                                            marginBottom: '10px',
                                        }}
                                    >
                                        1. Merchant Working Capital Profile /
                                        Perfil de capital de trabajo del comercio
                                    </h3>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '12px',
                                            fontSize: '13px',
                                        }}
                                    >
                                        <div>
                                            <strong>Merchant ID:</strong> {fullRiskResult.merchantId}
                                        </div>
                                        <div>
                                            <strong>Store ID:</strong> {fullRiskResult.storeId}
                                        </div>
                                        <div>
                                            <strong>Commercial Name / Nombre comercial:</strong>{' '}
                                            {merchantSnapshot.merchantName || 'N/A'}
                                        </div>
                                        <div>
                                            <strong>Sector / Sector:</strong>{' '}
                                            {fullRiskResult.merchantSectorUsed || merchantSnapshot.sector || 'N/A'}
                                        </div>
                                        <div>
                                            <strong>Joined Qabum™ / Fecha de ingreso:</strong>{' '}
                                            {merchantSnapshot.onboardDate || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Historical Performance */}
                                <div style={{ marginBottom: '22px' }}>
                                    <h3
                                        style={{
                                            fontSize: '13px',
                                            textTransform: 'uppercase',
                                            borderBottom: '1px solid #eee',
                                            paddingBottom: '6px',
                                            marginTop: 0,
                                            marginBottom: '10px',
                                        }}
                                    >
                                        2. Historical Performance & Evidence (Sales Data) /
                                        Desempeño histórico y evidencia (datos de ventas)
                                    </h3>
                                    <table
                                        style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontSize: '13px',
                                        }}
                                    >
                                        <tbody>
                                            <tr>
                                                <td
                                                    style={{
                                                        padding: '6px 8px',
                                                        borderBottom: '1px solid #eee',
                                                    }}
                                                >
                                                    Average Monthly Volume (last 12 months) /
                                                    Volumen promedio mensual (últimos 12 meses)
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '6px 8px',
                                                        borderBottom: '1px solid #eee',
                                                        textAlign: 'right',
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    {merchantSnapshot.averageMonthlyVolume
                                                        ? merchantSnapshot.averageMonthlyVolume.toLocaleString('en-US', {
                                                            style: 'currency',
                                                            currency: 'USD',
                                                        })
                                                        : 'N/A'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td
                                                    style={{
                                                        padding: '6px 8px',
                                                        borderBottom: '1px solid #eee',
                                                    }}
                                                >
                                                    Months Active on Platform /
                                                    Meses activo en la plataforma
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '6px 8px',
                                                        borderBottom: '1px solid #eee',
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {merchantSnapshot.monthsActive ?? 'N/A'}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* 3. Qabum Core Analysis */}
                                <div style={{ marginBottom: '22px' }}>
                                    <h3
                                        style={{
                                            fontSize: '13px',
                                            borderBottom: '1px solid #eee',
                                            paddingBottom: '6px',
                                            marginTop: 0,
                                            marginBottom: '10px',
                                        }}
                                    >
                                        3. Qabum™ Core Analysis (Split & Risk Recommendation)
                                    </h3>
                                    <div
                                        style={{
                                            backgroundColor: '#f9f9f9',
                                            padding: '12px 16px',
                                            borderRadius: '4px',
                                            fontSize: '13px',
                                        }}
                                    >
                                        <p style={{ margin: '0 0 8px 0' }}>
                                            <strong>System Decision / Decisión del sistema:</strong>{' '}
                                            {fullRiskResult.isEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'} /
                                            {fullRiskResult.isEligible ? ' ELEGIBLE' : ' NO ELEGIBLE'}
                                        </p>
                                        <p style={{ margin: 0 }}>
                                            <strong>Reason / Razón:</strong>{' '}
                                            {fullRiskResult.decisionReason}
                                        </p>

                                        <table
                                            style={{
                                                width: '100%',
                                                marginTop: 10,
                                                borderCollapse: 'collapse',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <tbody>
                                                <tr>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                        }}
                                                    >
                                                        Suggested Max Advance Limit /
                                                        Límite máximo sugerido
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                            textAlign: 'right',
                                                            fontWeight: 'bold',
                                                        }}
                                                    >
                                                        USD{' '}
                                                        {fullRiskResult.riskProfile.maxAdvanceLimit.toLocaleString(
                                                            'en-US',
                                                            { minimumFractionDigits: 2 },
                                                        )}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                        }}
                                                    >
                                                        Recommended Repayment Share of Sales /
                                                        Porcentaje recomendado de repago
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        {(
                                                            fullRiskResult.riskProfile.recommendedRepaymentRate *
                                                            100
                                                        ).toFixed(2)}
                                                        %
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                        }}
                                                    >
                                                        Internal Loss Provision Rate /
                                                        Tasa interna de provisión de pérdida
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        {(
                                                            fullRiskResult.riskProfile.lossProvisionRate * 100
                                                        ).toFixed(2)}
                                                        %
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                        }}
                                                    >
                                                        Ethical Cap Used /
                                                        Tope Ético aplicado
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        {fullRiskResult.ethicalCapUsed
                                                            ? (fullRiskResult.ethicalCapUsed * 100).toFixed(3)
                                                            : 'N/A'}%
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: 5 }}>
                                                        Effective Take Rate (Store cap) /
                                                        Take rate efectivo (tope del comercio)
                                                    </td>
                                                    <td style={{ padding: 5, textAlign: 'right' }}>
                                                        {fullRiskResult.ethicalCapUsed
                                                            ? (fullRiskResult.ethicalCapUsed * 100).toFixed(2)
                                                            : (TAKE_RATE_CAP_STORE * 100).toFixed(2)}%
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                        }}
                                                    >
                                                        Estimated Payback Period (months) /
                                                        Periodo estimado de repago (meses)
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: 5,
                                                            borderBottom: '1px solid #eee',
                                                            textAlign: 'right',
                                                            fontWeight: 'bold',
                                                        }}
                                                    >
                                                        {fullRiskResult.estimatedPaybackMonths != null
                                                            ? fullRiskResult.estimatedPaybackMonths.toFixed(1)
                                                            : 'Not available / No disponible'}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Human approval */}
                                <div
                                    style={{
                                        marginBottom: '25px', // More space before footer
                                        border: '2px solid #333',
                                        borderRadius: 4,
                                        padding: 16, // Comfortable padding
                                    }}
                                >
                                    <h3
                                        style={{
                                            fontSize: '13px',
                                            textTransform: 'uppercase',
                                            marginBottom: 10,
                                            marginTop: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}
                                    >
                                        4. Final Human Authorization /
                                        Autorización humana final
                                        {isApproved && (
                                            <span
                                                style={{
                                                    marginLeft: 8,
                                                    fontSize: 12,
                                                    color: 'green',
                                                }}
                                            >
                                                ✅ AUTHORIZED
                                            </span>
                                        )}
                                    </h3>

                                    <div className="no-print" style={{ marginBottom: 12 }}>
                                        <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px 0' }}>
                                            Review the limit suggested by the system. Human decision
                                            cannot exceed it.
                                        </p>
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 12,
                                                alignItems: 'flex-end',
                                            }}
                                        >
                                            <div>
                                                <label
                                                    style={{
                                                        display: 'block',
                                                        fontSize: 11,
                                                        fontWeight: 'bold',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    Authorized Capital Amount (USD)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={humanAuthorizedAmount}
                                                    onChange={(e) => {
                                                        setHumanAuthorizedAmount(e.target.value);
                                                        setIsApproved(false);
                                                        setApprovalError(null);
                                                        setApprovalDate(null);
                                                    }}
                                                    style={{
                                                        padding: 6,
                                                        width: 150,
                                                        border: approvalError
                                                            ? '1px solid red'
                                                            : '1px solid #ccc',
                                                        fontSize: '13px',
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={handleAuthorize}
                                                disabled={!fullRiskResult.isEligible}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: PRIMARY_BLUE,
                                                    color: 'white',
                                                    border: 'none',
                                                    cursor: fullRiskResult.isEligible
                                                        ? 'pointer'
                                                        : 'not-allowed',
                                                    opacity: fullRiskResult.isEligible ? 1 : 0.5,
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                }}
                                            >
                                                AUTHORIZE & SIGN
                                            </button>
                                        </div>
                                        {approvalError && (
                                            <p
                                                style={{
                                                    color: 'red',
                                                    fontSize: 11,
                                                    marginTop: 4,
                                                }}
                                            >
                                                {approvalError}
                                            </p>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 20,
                                            marginTop: 8,
                                        }}
                                    >
                                        <div
                                            style={{
                                                borderTop: '1px solid #ccc',
                                                paddingTop: 6,
                                            }}
                                        >
                                            <p
                                                style={{
                                                    fontSize: 11,
                                                    margin: '0 0 4px 0',
                                                    color: '#555',
                                                }}
                                            >
                                                Final Authorized Amount /
                                                Monto final autorizado:
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: 18,
                                                    fontWeight: 'bold',
                                                    margin: 0,
                                                }}
                                            >
                                                {isApproved
                                                    ? `USD ${Number(
                                                        humanAuthorizedAmount,
                                                    ).toLocaleString('en-US', {
                                                        minimumFractionDigits: 2,
                                                    })}`
                                                    : '---'}
                                            </p>
                                        </div>
                                        <div
                                            style={{
                                                borderTop: '1px solid #ccc',
                                                paddingTop: 6,
                                            }}
                                        >
                                            <p
                                                style={{
                                                    fontSize: 11,
                                                    margin: '0 0 4px 0',
                                                    color: '#555',
                                                }}
                                            >
                                                Authorization Date /
                                                Fecha de autorización:
                                            </p>
                                            <p style={{ fontSize: 14, margin: 0 }}>
                                                {isApproved ? approvalDate : '---'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Powered by Qabum Footer */}
                                <div
                                    style={{
                                        marginTop: '16px',
                                        marginBottom: '6px',
                                        textAlign: 'center',
                                    }}
                                >
                                    <a
                                        href="https://qabum.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: PRIMARY_BLUE,
                                            fontWeight: 'bold',
                                            textDecoration: 'none',
                                            fontSize: '11px',
                                        }}
                                    >
                                        Powered by Qabum™
                                    </a>
                                </div>

                                {/* Footer legal */}
                                <div
                                    style={{
                                        fontSize: 9,
                                        color: '#999',
                                        textAlign: 'center',
                                        borderTop: '1px solid #eee',
                                        paddingTop: 8,
                                        marginTop: 8,
                                    }}
                                >
                                    <p style={{ marginBottom: 4, lineHeight: 1.3 }}>
                                        <strong>English:</strong> This is an internal analysis of
                                        Working Capital Advance in a closed digital ecosystem based on
                                        future sales. It is not a consumer loan and does not use
                                        interest or fees. The final legal classification depends on
                                        local regulation and must be defined in specific contracts by
                                        jurisdiction. Qabum™ is a technology and service layer, not a
                                        financial institution. All activity occurs under private
                                        agreements within its closed platform.
                                    </p>
                                    <p style={{ margin: 0, lineHeight: 1.3 }}>
                                        <strong>Español:</strong> Este es un análisis interno de
                                        Working Capital Advance en un ecosistema digital cerrado basado
                                        en futuras ventas. No es un préstamo de consumo y no utiliza
                                        intereses ni cuotas. La clasificación legal final depende de la
                                        regulación local y debe definirse en contratos específicos por
                                        jurisdicción. Qabum™ es una capa de tecnología y servicio, no
                                        una institución financiera. Toda la actividad ocurre bajo
                                        acuerdos privados dentro de su plataforma cerrada.
                                    </p>
                                </div>

                                <style>{`
                                    @media print {
                                        @page { 
                                            size: A4; 
                                            margin: 0; 
                                        }
                                        
                                        html, body {
                                            /* FORCE the document to be exactly one A4 page tall to cut off ghost content */
                                            height: 297mm !important;
                                            width: 210mm !important;
                                            overflow: hidden !important; /* Clip anything else */
                                            background-color: white !important;
                                            margin: 0 !important;
                                            padding: 0 !important;
                                        }

                                        /* Hide everything by default (paint only) */
                                        body * { 
                                            visibility: hidden; 
                                        }
                                        
                                        /* Show only our report */
                                        .a4-page, .a4-page * { 
                                            visibility: visible !important;
                                            color-adjust: exact;
                                            -webkit-print-color-adjust: exact;
                                        }
                                        
                                        .a4-page {
                                            position: absolute;
                                            left: 0;
                                            top: 0;
                                            width: 210mm !important;
                                            /* Allow height to flow naturally but practically limited by body clipping if it exceeds */
                                            height: auto !important; 
                                            min-height: auto !important;
                                            margin: 0 !important;
                                            padding: 40px !important;
                                            background-color: white !important;
                                            box-shadow: none !important;
                                            z-index: 9999;
                                        }
                                        
                                        .no-print { 
                                            display: none !important; 
                                        }
                                    }
                                `}</style>
                            </div>
                        </div>
                    )}

            </div>
        </div>
    );
};

export default BackOfficePage;
