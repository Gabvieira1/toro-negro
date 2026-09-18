import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query } from '../db/database.js';
import { JWT_SECRET, requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { lookupCNPJ } from '../services/cnpj.service.js';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      cnpj,
      ie,
      razaoSocial,
      nomeFantasia,
      segmento,
      nome,
      email,
      whatsapp,
      senha,
      cidade,
      uf,
      logradouro,
      numero,
      bairro,
      cep
    } = req.body;

    if (!cnpj || !razaoSocial || !email || !senha || !whatsapp) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes (CNPJ, Razão Social, E-mail, Senha e WhatsApp).' });
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verificar se usuário já existe
    const existingUser = query.get('SELECT id FROM users WHERE email = ?', cleanEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Já existe uma conta corporativa registrada com este e-mail.' });
    }

    // 2. Verificar ou criar Empresa
    let company = query.get('SELECT * FROM companies WHERE cnpj = ?', cleanCnpj);

    if (!company) {
      const companyId = 'comp-' + crypto.randomUUID().slice(0, 8);
      query.run(`
        INSERT INTO companies (
          id, cnpj, razao_social, nome_fantasia, inscricao_estadual,
          segmento, logradouro, numero, bairro, cidade, uf, cep,
          limite_credito, status_aprovacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        companyId,
        cleanCnpj,
        razaoSocial.trim(),
        (nomeFantasia || razaoSocial).trim(),
        ie || 'ISENTO',
        segmento || 'Restaurante / Adega',
        logradouro || '',
        numero || '',
        bairro || '',
        cidade || 'São Paulo',
        uf || 'SP',
        cep || '',
        10000.00, // Limite padrão inicial
        'APROVADO'
      );
      company = query.get('SELECT * FROM companies WHERE id = ?', companyId);
    }

    // 3. Criar Usuário Comprador
    const userId = 'user-' + crypto.randomUUID().slice(0, 8);
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    query.run(`
      INSERT INTO users (
        id, company_id, nome, email, telefone_whatsapp, senha_hash, cargo, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      userId,
      company.id,
      nome || (nomeFantasia || 'Responsável Compras'),
      cleanEmail,
      whatsapp.trim(),
      senhaHash,
      'Comprador Autorizado',
      'BUYER'
    );

    const user = query.get('SELECT id, company_id, nome, email, telefone_whatsapp, cargo, role FROM users WHERE id = ?', userId);

    // 4. Gerar Token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        companyId: company.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Cadastro corporativo aprovado com sucesso!',
      token,
      user,
      company
    });

  } catch (err: any) {
    console.error('Erro no registro:', err);
    return res.status(500).json({ error: 'Erro interno ao processar cadastro corporativo.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, senha } = req.body;

    if (!login || !senha) {
      return res.status(400).json({ error: 'Informe o CNPJ/E-mail e a senha.' });
    }

    const cleanInput = login.trim();
    let user: any = null;

    if (cleanInput.includes('@')) {
      // Login por E-mail
      user = query.get('SELECT * FROM users WHERE email = ?', cleanInput.toLowerCase());
    } else {
      // Login por CNPJ
      const cleanCnpj = cleanInput.replace(/\D/g, '');
      const company = query.get('SELECT id FROM companies WHERE cnpj = ?', cleanCnpj);
      if (company) {
        user = query.get('SELECT * FROM users WHERE company_id = ? LIMIT 1', company.id);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciais corporativas inválidas.' });
    }

    const isMatch = await bcrypt.compare(senha, user.senha_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const company = query.get('SELECT * FROM companies WHERE id = ?', user.company_id);

    const token = jwt.sign(
      {
        userId: user.id,
        companyId: user.company_id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      id: user.id,
      company_id: user.company_id,
      nome: user.nome,
      email: user.email,
      telefone_whatsapp: user.telefone_whatsapp,
      cargo: user.cargo,
      role: user.role
    };

    return res.json({
      message: 'Autenticado com sucesso!',
      token,
      user: safeUser,
      company
    });

  } catch (err: any) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login corporativo.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = query.get('SELECT id, company_id, nome, email, telefone_whatsapp, cargo, role FROM users WHERE id = ?', userId);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const company = query.get('SELECT * FROM companies WHERE id = ?', user.company_id);
  const ordersCount = query.get('SELECT COUNT(*) as total FROM orders WHERE company_id = ?', user.company_id)?.total || 0;

  return res.json({
    user,
    company,
    ordersCount
  });
});
