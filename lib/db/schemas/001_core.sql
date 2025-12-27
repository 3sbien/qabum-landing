-- 001_core.sql
-- Base Schema for Qabum Module 1 (Financial Split Engine)

-- 1. STORES: Configuration for each physical or logical store
CREATE TABLE stores (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    country_code TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    take_rate_cap NUMERIC(10, 4) NOT NULL, -- e.g. 0.0300
    default_mdr NUMERIC(10, 4) NOT NULL, -- e.g. 0.0220
    default_qabum_margin_cap NUMERIC(10, 4) NOT NULL, -- e.g. 0.0150
    default_repayment_rate NUMERIC(10, 4) NOT NULL, -- e.g. 0.0080
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MERCHANTS: Business owners
CREATE TABLE merchants (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ADVANCES: Financial advances given to merchants
CREATE TABLE advances (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    amount NUMERIC(15, 2) NOT NULL,
    outstanding_balance NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAID', 'DEFAULTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TRANSACTIONS: Financial transactions and their split results
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    store_id TEXT NOT NULL REFERENCES stores(id),
    
    -- Raw Transaction Data
    amount NUMERIC(15, 2) NOT NULL,
    
    -- Computed Split Data (Audit Trail)
    mdr_amount NUMERIC(15, 2) NOT NULL,
    qabum_margin_amount NUMERIC(15, 2) NOT NULL,
    repayment_amount NUMERIC(15, 2) NOT NULL,
    merchant_net_amount NUMERIC(15, 2) NOT NULL,
    
    -- Metrics
    effective_take_rate NUMERIC(10, 6) NOT NULL,
    cap_exceeded BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
