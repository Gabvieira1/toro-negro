import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, query } from './db/database.js';
import { runSeed } from './db/seed.js';
import { cnpjRouter } from './routes/cnpj.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { productsRouter } from './routes/products.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { adminRouter } from './routes/admin.routes.js';

import { authLoginLimiter, cnpjLookupLimiter } from './middlewares/rateLimit.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Segurança: Ocultar tecnologia do servidor
app.disable('x-powered-by');

// Segurança: Cabeçalhos defensivos HTTP
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middlewares padrão
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Auto-seed se o banco estiver vazio ou sem usuário admin
try {
  const count = query.get<{ total: number }>('SELECT COUNT(*) as total FROM products')?.total || 0;
  const hasAdmin = query.get("SELECT id FROM users WHERE role = 'ADMIN'");
  if (count === 0 || !hasAdmin) {
    console.log('📦 Inicializando seed de produtos e administrador Toro Negro...');
    await runSeed();
  }
} catch (e) {
  console.warn('Aviso na inicialização do seed:', e);
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Toro Negro B2B Wines API',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/cnpj', cnpjLookupLimiter, cnpjRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);

// Rotas diretas e amigáveis para páginas HTML
const staticRoot = path.resolve(__dirname, '../../');

app.get(['/admin', '/admins', '/admins.html'], (req, res) => {
  res.sendFile(path.join(staticRoot, 'admin.html'));
});

app.get(['/portal-b2b', '/b2b', '/loja', '/comprar'], (req, res) => {
  res.sendFile(path.join(staticRoot, 'portal-b2b.html'));
});

app.get(['/login', '/login-b2b'], (req, res) => {
  res.sendFile(path.join(staticRoot, 'login-b2b.html'));
});

// Servir os arquivos estáticos do frontend com resolução automática de extensão .html
app.use(express.static(staticRoot, { extensions: ['html'] }));

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`🍇 Servidor Toro Negro API rodando com sucesso em http://localhost:${PORT}`);
  console.log(`🍷 E-Commerce B2B: http://localhost:${PORT}/portal-b2b.html`);
  console.log(`🏛️ Home Institucional: http://localhost:${PORT}/index.html`);
});
