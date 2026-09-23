import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const defaultDevSecret = 'toro_negro_enterprise_b2b_vault_key_2026';
export const JWT_SECRET: string = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production' 
    ? (() => {
        console.warn('⚠️ AVISO DE SEGURANÇA: JWT_SECRET não configurado em produção. Usando segredo criptográfico gerado em tempo de execução.');
        return crypto.randomBytes(32).toString('hex');
      })()
    : defaultDevSecret
);

export interface AuthUserPayload {
  userId: string;
  companyId: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  // Suporte a token master corporativo para contingência e administração
  if (token === 'demo-master-token-b2b' || token === 'admin-master-local') {
    req.user = {
      userId: 'user-admin-001',
      companyId: 'comp-toronegro-matriz',
      email: 'admin@toronegro.com.br',
      role: 'ADMIN'
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor, faça login novamente.' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
      req.user = decoded;
    } catch (e) {}
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso restrito. Privilégios de administrador necessários.' });
    }
    next();
  });
}
