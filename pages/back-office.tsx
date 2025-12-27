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
                fontFamily: 'Arial, sans-serif',
                backgroundColor: '#f0f2f5',
                minHeight: '100vh',
                padding: '20px',
            }}
        >
            <Head>
                <title>Qabum™ Working Capital Advance Eligibility</title>
                <link rel="shortcut icon" href="/logo-azul.png" />
            </Head>

            {/* HEADER (no se imprime) */}
            <div
                className="no-print"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    padding: '10px 20px',
                    borderBottom: `2px solid ${PRIMARY_BLUE}`,
                    backgroundColor: 'white',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                        src="/logo-azul.png"
                        alt="Qabum™"
                        style={{ height: '40px' }}
                    />
                    <div>
                        <h2 style={{ color: PRIMARY_BLUE, margin: 0 }}>
                            Qabum™ Working Capital Advance Eligibility
                        </h2>
                        <p
                            style={{
                                margin: 0,
                                fontSize: '12px',
                                color: '#555',
                            }}
                        >
                            Internal backoffice module for eligibility & decisioning /
                            Backoffice interno para elegibilidad y decisiones de adelantos.
                        </p>
                    </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#666' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                        Internal Use Only / Solo para uso interno
                    </div>
                    <div>
                        <button
                            onClick={() => setActiveTab('input')}
                            style={{
                                marginRight: '8px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                fontWeight: activeTab === 'input' ? 'bold' : 'normal',
                            }}
                        >
                            Data Entry / Ingreso de Datos
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            disabled={!fullRiskResult}
                            style={{
                                marginRight: '8px',
                                padding: '6px 10px',
                                cursor: !fullRiskResult ? 'not-allowed' : 'pointer',
                                fontWeight: activeTab === 'report' ? 'bold' : 'normal',
                                opacity: !fullRiskResult ? 0.5 : 1,
                            }}
                        >
                            Decision Report / Reporte de Decisión
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={!fullRiskResult || activeTab !== 'report'}
                            style={{
                                padding: '6px 10px',
                                cursor:
                                    !fullRiskResult || activeTab !== 'report'
                                        ? 'not-allowed'
                                        : 'pointer',
                                fontWeight: 'bold',
                                backgroundColor:
                                    activeTab === 'report' ? PRIMARY_BLUE : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                            }}
                        >
                            Print / PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* INPUT TAB */}
            {activeTab === 'input' && (
                <div
                    style={{
                        display: 'flex',
                        gap: '20px',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                    }}
                >
                    {/* Panel Riesgo */}
                    <div
                        style={{
                            backgroundColor: 'white',
                            padding: '20px',
                            borderRadius: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            width: 440,
                        }}
                    >
                        <h3 style={{ color: PRIMARY_BLUE, marginBottom: 8 }}>
                            ⚖️ Working Capital Advance Assessment /
                            Evaluación de Adelanto de Capital
                        </h3>
                        <p
                            style={{
                                fontSize: 12,
                                color: '#666',
                                marginBottom: 8,
                            }}
                        >
                            Evaluate eligibility for a working capital advance on future
                            digital sales. / Evaluar elegibilidad para un adelanto de capital de trabajo sobre futuras ventas digitales.
                        </p>
                        <p
                            style={{
                                fontSize: 11,
                                color: '#777',
                                marginBottom: 12,
                            }}
                        >
                            1) Select merchant. 2) Set requested amount. 3) Generate report
                            for human review. / 1) Selecciona el comercio. 2) Define el monto
                            solicitado. 3) Genera el reporte para revisión humana.
                        </p>

                        <form
                            onSubmit={handleRiskSubmit}
                            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                        >
                            <label
                                style={{
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                }}
                            >
                                Merchant ID / ID de Comercio
                            </label>
                            <input
                                type="text"
                                name="merchantId"
                                value={riskInput.merchantId}
                                onChange={handleRiskChange}
                                style={{
                                    padding: 8,
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                }}
                            />

                            <label
                                style={{
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                }}
                            >
                                Requested Advance Amount (USD) /
                                Monto de Adelanto Solicitado (USD)
                            </label>
                            <input
                                type="number"
                                name="requestedAmount"
                                value={riskInput.requestedAmount}
                                onChange={handleRiskChange}
                                style={{
                                    padding: 8,
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                }}
                            />

                            <button
                                type="submit"
                                disabled={riskLoading}
                                style={{
                                    marginTop: 10,
                                    padding: 10,
                                    backgroundColor: '#ffc107',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                }}
                            >
                                {riskLoading
                                    ? 'Analizando... / Processing...'
                                    : 'Generar Reporte de Elegibilidad / Generate Eligibility Report'}
                            </button>
                        </form>

                        {riskError && (
                            <div
                                style={{
                                    color: 'red',
                                    marginTop: 10,
                                    fontSize: 13,
                                }}
                            >
                                {riskError}
                            </div>
                        )}

                        {/* Merchant Context Block */}
                        {fullRiskResult && (
                            <div
                                style={{
                                    marginTop: 16,
                                    paddingTop: 10,
                                    borderTop: '1px solid #eee',
                                    fontSize: 12,
                                    color: '#444',
                                }}
                            >
                                <h4
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 'bold',
                                        marginBottom: 6,
                                    }}
                                >
                                    Merchant Summary / Resumen del Comercio
                                </h4>
                                <p>
                                    <strong>Commercial Name / Nombre comercial:</strong>{' '}
                                    {merchantSnapshot.merchantName || 'N/A'}
                                </p>
                                <p>
                                    <strong>Joined Qabum™ / Fecha de ingreso:</strong>{' '}
                                    {merchantSnapshot.onboardDate || 'N/A'}
                                </p>
                                <p>
                                    <strong>
                                        Average Monthly Volume / Volumen promedio mensual:
                                    </strong>{' '}
                                    {merchantSnapshot.averageMonthlyVolume
                                        ? merchantSnapshot.averageMonthlyVolume.toLocaleString(
                                            'en-US',
                                            {
                                                style: 'currency',
                                                currency: 'USD',
                                            },
                                        )
                                        : 'N/A'}
                                </p>
                                <p>
                                    <strong>Months Active / Meses activo:</strong>{' '}
                                    {merchantSnapshot.monthsActive ?? 'N/A'}
                                </p>
                                <p style={{ fontSize: '12px', color: '#777', marginTop: '8px' }}>
                                    Data based on the most recent Qabum™ merchant sales snapshot. / Datos basados en el snapshot más reciente de ventas del comercio en Qabum™.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Panel Split */}
                    <div
                        style={{
                            backgroundColor: 'white',
                            padding: '20px',
                            borderRadius: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            width: 380,
                        }}
                    >
                        <h3 style={{ color: '#444', marginBottom: 8 }}>
                            ⚙️ Transaction Core (Split & Ethical Cap) /
                            Núcleo de Transacción (Split y Tope Ético)
                        </h3>
                        <p
                            style={{
                                fontSize: 12,
                                color: '#666',
                                marginBottom: 10,
                            }}
                        >
                            Internal technical check of the split engine and ethical cap per transaction. / Prueba técnica interna del motor de Split y el tope ético por transacción.
                        </p>

                        <form
                            onSubmit={handleSplitSubmit}
                            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                        >
                            <label
                                style={{
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                }}
                            >
                                Merchant ID / ID de Comercio
                            </label>
                            <input
                                type="text"
                                name="merchantId"
                                value={splitInput.merchantId}
                                onChange={handleSplitChange}
                                style={{
                                    padding: 6,
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                }}
                            />

                            <label
                                style={{
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                }}
                            >
                                Transaction Amount (USD) /
                                Monto de la Transacción (USD)
                            </label>
                            <input
                                type="number"
                                name="transactionAmount"
                                value={splitInput.transactionAmount}
                                onChange={handleSplitChange}
                                style={{
                                    padding: 6,
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                }}
                            />

                            <button
                                type="submit"
                                disabled={splitLoading}
                                style={{
                                    padding: 8,
                                    backgroundColor: PRIMARY_BLUE,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                }}
                            >
                                {splitLoading
                                    ? 'Testing Split... / Probando Split...'
                                    : 'Test Split / Probar Split'}
                            </button>
                        </form>

                        {splitResult && (
                            <div
                                style={{
                                    marginTop: 10,
                                    fontSize: 12,
                                    color: 'green',
                                }}
                            >
                                Last Split: Success. Ethical cap respected. /
                                Último Split: correcto, tope ético respetado.
                            </div>
                        )}
                        {splitError && (
                            <div
                                style={{
                                    marginTop: 10,
                                    fontSize: 12,
                                    color: 'red',
                                }}
                            >
                                {splitError}
                            </div>
                        )}
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
                                minHeight: A4_MIN_HEIGHT,
                                backgroundColor: 'white',
                                padding: '40px',
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
                                    marginBottom: 30,
                                }}
                            >
                                <img
                                    src="/logo-azul.png"
                                    alt="Qabum™"
                                    style={{ height: '50px' }}
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
                            <div style={{ marginBottom: '25px' }}>
                                <h3
                                    style={{
                                        fontSize: '14px',
                                        textTransform: 'uppercase',
                                        borderBottom: '1px solid #eee',
                                        paddingBottom: '5px',
                                    }}
                                >
                                    1. Merchant Working Capital Profile /
                                    Perfil de capital de trabajo del comercio
                                </h3>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '15px',
                                        fontSize: '14px',
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
                                        <strong>Joined Qabum™ / Fecha de ingreso:</strong>{' '}
                                        {merchantSnapshot.onboardDate || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* 2. Historical Performance */}
                            <div style={{ marginBottom: '25px' }}>
                                <h3
                                    style={{
                                        fontSize: '14px',
                                        textTransform: 'uppercase',
                                        borderBottom: '1px solid #eee',
                                        paddingBottom: '5px',
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
                                                    padding: '8px',
                                                    borderBottom: '1px solid #eee',
                                                }}
                                            >
                                                Average Monthly Volume (last 12 months) /
                                                Volumen promedio mensual (últimos 12 meses)
                                            </td>
                                            <td
                                                style={{
                                                    padding: '8px',
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
                                                    padding: '8px',
                                                    borderBottom: '1px solid #eee',
                                                }}
                                            >
                                                Months Active on Platform /
                                                Meses activo en la plataforma
                                            </td>
                                            <td
                                                style={{
                                                    padding: '8px',
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
                            <div style={{ marginBottom: '25px' }}>
                                <h3
                                    style={{
                                        fontSize: '14px',
                                        borderBottom: '1px solid #eee',
                                        paddingBottom: '5px',
                                    }}
                                >
                                    3. Qabum™ Core Analysis (Split & Risk Recommendation)
                                </h3>
                                <div
                                    style={{
                                        backgroundColor: '#f9f9f9',
                                        padding: '15px',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                    }}
                                >
                                    <p>
                                        <strong>System Decision / Decisión del sistema:</strong>{' '}
                                        {fullRiskResult.isEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'} /
                                        {fullRiskResult.isEligible ? ' ELEGIBLE' : ' NO ELEGIBLE'}
                                    </p>
                                    <p>
                                        <strong>Reason / Razón:</strong>{' '}
                                        {fullRiskResult.decisionReason}
                                    </p>

                                    <table
                                        style={{
                                            width: '100%',
                                            marginTop: 12,
                                            borderCollapse: 'collapse',
                                        }}
                                    >
                                        <tbody>
                                            <tr>
                                                <td
                                                    style={{
                                                        padding: 6,
                                                        borderBottom: '1px solid #eee',
                                                    }}
                                                >
                                                    Suggested Max Advance Limit /
                                                    Límite máximo sugerido
                                                </td>
                                                <td
                                                    style={{
                                                        padding: 6,
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
                                                        padding: 6,
                                                        borderBottom: '1px solid #eee',
                                                    }}
                                                >
                                                    Recommended Repayment Share of Sales /
                                                    Porcentaje recomendado de repago
                                                </td>
                                                <td
                                                    style={{
                                                        padding: 6,
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
                                                        padding: 6,
                                                        borderBottom: '1px solid #eee',
                                                    }}
                                                >
                                                    Internal Loss Provision Rate /
                                                    Tasa interna de provisión de pérdida
                                                </td>
                                                <td
                                                    style={{
                                                        padding: 6,
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
                                                <td style={{ padding: 6 }}>
                                                    Effective Take Rate (Store cap) /
                                                    Take rate efectivo (tope del comercio)
                                                </td>
                                                <td style={{ padding: 6, textAlign: 'right' }}>
                                                    {(TAKE_RATE_CAP_STORE * 100).toFixed(2)}%
                                                </td>
                                            </tr>
                                            <tr>
                                                <td
                                                    style={{
                                                        padding: 6,
                                                        borderBottom: '1px solid #eee',
                                                    }}
                                                >
                                                    Estimated Payback Period (months) /
                                                    Periodo estimado de repago (meses)
                                                </td>
                                                <td
                                                    style={{
                                                        padding: 6,
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
                                    marginBottom: '25px',
                                    border: '2px solid #333',
                                    borderRadius: 4,
                                    padding: 16,
                                }}
                            >
                                <h3
                                    style={{
                                        fontSize: '14px',
                                        textTransform: 'uppercase',
                                        marginBottom: 10,
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
                                            ✅ AUTHORIZED / AUTORIZADO
                                        </span>
                                    )}
                                </h3>

                                <div className="no-print" style={{ marginBottom: 10 }}>
                                    <p style={{ fontSize: 12, color: '#666' }}>
                                        Review the limit suggested by the system. Human decision
                                        cannot exceed it. / Revisar el límite sugerido por el
                                        sistema. La decisión humana no puede superarlo.
                                    </p>
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 10,
                                            alignItems: 'flex-end',
                                        }}
                                    >
                                        <div>
                                            <label
                                                style={{
                                                    display: 'block',
                                                    fontSize: 12,
                                                    fontWeight: 'bold',
                                                    marginBottom: 4,
                                                }}
                                            >
                                                Authorized Capital Amount (USD) /
                                                Monto de capital autorizado (USD)
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
                                                    padding: 8,
                                                    width: 150,
                                                    border: approvalError
                                                        ? '1px solid red'
                                                        : '1px solid #ccc',
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={handleAuthorize}
                                            disabled={!fullRiskResult.isEligible}
                                            style={{
                                                padding: '9px 18px',
                                                backgroundColor: PRIMARY_BLUE,
                                                color: 'white',
                                                border: 'none',
                                                cursor: fullRiskResult.isEligible
                                                    ? 'pointer'
                                                    : 'not-allowed',
                                                opacity: fullRiskResult.isEligible ? 1 : 0.5,
                                            }}
                                        >
                                            AUTORIZAR Y FIRMAR / AUTHORIZE & SIGN
                                        </button>
                                    </div>
                                    {approvalError && (
                                        <p
                                            style={{
                                                color: 'red',
                                                fontSize: 12,
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
                                        gap: 16,
                                        marginTop: 8,
                                    }}
                                >
                                    <div
                                        style={{
                                            borderTop: '1px solid #ccc',
                                            paddingTop: 4,
                                        }}
                                    >
                                        <p
                                            style={{
                                                fontSize: 12,
                                                margin: '0 0 4px 0',
                                            }}
                                        >
                                            Final Authorized Amount /
                                            Monto final autorizado:
                                        </p>
                                        <p
                                            style={{
                                                fontSize: 22,
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
                                            paddingTop: 4,
                                        }}
                                    >
                                        <p
                                            style={{
                                                fontSize: 12,
                                                margin: '0 0 4px 0',
                                            }}
                                        >
                                            Authorization Date /
                                            Fecha de autorización:
                                        </p>
                                        <p style={{ fontSize: 16, margin: 0 }}>
                                            {isApproved ? approvalDate : '---'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer legal */}
                            <div
                                style={{
                                    fontSize: 10,
                                    color: '#999',
                                    textAlign: 'center',
                                    borderTop: '1px solid #eee',
                                    paddingTop: 8,
                                    marginTop: 10,
                                }}
                            >
                                <p style={{ marginBottom: 6 }}>
                                    <strong>English:</strong> This is an internal analysis of
                                    Working Capital Advance in a closed digital ecosystem based on
                                    future sales. It is not a consumer loan and does not use
                                    interest or fees. The final legal classification depends on
                                    local regulation and must be defined in specific contracts by
                                    jurisdiction. Qabum™ is a technology and service layer, not a
                                    financial institution. All activity occurs under private
                                    agreements within its closed platform.
                                </p>
                                <p>
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
                  body { background-color: white !important; }
                  body * { visibility: hidden; }
                  .a4-page, .a4-page * { visibility: visible; }
                  .a4-page {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    box-shadow: none;
                    margin: 0;
                    padding: 20px;
                  }
                  .no-print { display: none !important; }
                  @page { margin: 0; }
                }
              `}</style>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default BackOfficePage;
