-- Schema SQLite Relacional para Toro Negro B2B

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    cnpj TEXT UNIQUE NOT NULL,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    inscricao_estadual TEXT,
    segmento TEXT,
    cnae_principal TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT NOT NULL,
    uf TEXT NOT NULL,
    cep TEXT,
    situacao_cadastral TEXT DEFAULT 'ATIVA',
    limite_credito REAL DEFAULT 5000.00,
    status_aprovacao TEXT DEFAULT 'APROVADO', -- 'APROVADO', 'PENDENTE', 'BLOQUEADO'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone_whatsapp TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    cargo TEXT,
    role TEXT DEFAULT 'BUYER',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    linha TEXT NOT NULL,               -- 'Reservado Chile', 'Mendoza Argentina', 'Especiais'
    tipo TEXT NOT NULL,                -- 'Tinto', 'Branco', 'Rosé', 'Espumante'
    uva TEXT NOT NULL,                 -- 'Carménère', 'Cabernet Sauvignon', 'Merlot', 'Sauvignon Blanc', 'Chardonnay', 'Syrah Rosé', 'Malbec', 'Bonarda', 'Torrontés', 'Pedro Jimenez', 'Blend Nobre Ícone', 'Vitis Vinifera Suave', 'Sweet Tinto', 'Brut Charmat', 'Brut Rosé Charmat'
    pais TEXT NOT NULL,                -- 'Chile', 'Argentina'
    regiao TEXT NOT NULL,              -- 'Valle Central', 'Mendoza'
    safra TEXT DEFAULT '2023',
    teor_alcoolico REAL,
    volume_ml INTEGER DEFAULT 750,
    unidades_por_caixa INTEGER DEFAULT 6,
    preco_varejo_ref REAL NOT NULL,    -- Preço riscado de referência no varejo
    preco_unitario REAL NOT NULL,      -- Preço unitário faturado atacado
    preco_caixa REAL NOT NULL,         -- Preço da caixa (unitario * 6)
    estoque_caixas INTEGER DEFAULT 50, -- Saldo em caixas fechadas
    descricao TEXT,
    harmonizacao TEXT,
    temperatura_servico TEXT,
    imagem_url TEXT NOT NULL,
    destaque INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL, -- Ex: #TN-10024
    company_id TEXT NOT NULL REFERENCES companies(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    total_caixas INTEGER NOT NULL,
    total_garrafas INTEGER NOT NULL,
    valor_produtos REAL NOT NULL,
    valor_frete REAL DEFAULT 0.00,
    valor_desconto REAL DEFAULT 0.00,
    valor_total REAL NOT NULL,
    forma_pagamento TEXT NOT NULL,     -- 'BOLETO_28D', 'PIX_A_VISTA', 'CARTAO_PJ'
    status TEXT DEFAULT 'CONFIRMADO',  -- 'AGUARDANDO_PAGAMENTO', 'CONFIRMADO', 'EM_SEPARACAO', 'EM_TRANSPORTE', 'ENTREGUE'
    endereco_entrega TEXT NOT NULL,    -- JSON stringificado com dados de entrega
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantidade_caixas INTEGER NOT NULL,
    quantidade_garrafas INTEGER NOT NULL,
    preco_unitario_cobrado REAL NOT NULL,
    subtotal REAL NOT NULL
);
