import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/database.js';
import { JWT_SECRET, requireAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { authLoginLimiter } from '../middlewares/rateLimit.middleware.js';

export const adminRouter = Router();

// POST /api/admin/login
adminRouter.post('/login', authLoginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, login, senha, password } = req.body;
    const loginUser = (email || login || '').trim().toLowerCase();
    const loginPass = (senha || password || '').trim();

    if (!loginUser || !loginPass) {
      return res.status(400).json({ error: 'Informe o e-mail administrativo e a senha.' });
    }

    const user: any = query.get('SELECT * FROM users WHERE email = ?', loginUser);

    if (!user) {
      return res.status(401).json({ error: 'Credenciais administrativas inválidas.' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Esta conta não possui privilégios de administrador.' });
    }

    const isMatch = await bcrypt.compare(loginPass, user.senha_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Senha administrativa incorreta.' });
    }

    const company: any = query.get('SELECT * FROM companies WHERE id = ?', user.company_id);

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
      cargo: user.cargo,
      role: user.role
    };

    return res.json({
      success: true,
      message: `Bem-vindo à gestão Toro Negro, ${user.nome}!`,
      token,
      user: safeUser,
      company: company || { nome_fantasia: 'Toro Negro Matriz' }
    });

  } catch (err: any) {
    console.error('Erro no login admin:', err);
    return res.status(500).json({ error: 'Erro interno ao autenticar administrador.' });
  }
});

// GET /api/admin/stats (Métricas Consolidadas)
adminRouter.get('/stats', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalProducts = query.get<{ count: number }>('SELECT COUNT(*) as count FROM products')?.count || 0;
    const activeProducts = query.get<{ count: number }>('SELECT COUNT(*) as count FROM products WHERE ativo = 1')?.count || 0;
    const totalBoxesStock = query.get<{ total: number }>('SELECT SUM(estoque_caixas) as total FROM products WHERE ativo = 1')?.total || 0;
    const totalOrders = query.get<{ count: number }>('SELECT COUNT(*) as count FROM orders')?.count || 0;
    const totalRevenue = query.get<{ total: number }>("SELECT SUM(valor_total) as total FROM orders WHERE status != 'CANCELADO'")?.total || 0;
    const totalCompanies = query.get<{ count: number }>('SELECT COUNT(*) as count FROM companies')?.count || 0;

    const recentOrders = query.all(`
      SELECT o.id, o.order_number, o.total_caixas, o.valor_total, o.forma_pagamento, o.status, o.created_at,
             c.razao_social, c.nome_fantasia, c.cnpj
      FROM orders o
      JOIN companies c ON c.id = o.company_id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    return res.json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        totalBoxesStock,
        totalOrders,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCompanies
      },
      recentOrders
    });

  } catch (err: any) {
    console.error('Erro ao buscar stats admin:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar métricas.' });
  }
});

// GET /api/admin/orders (Todos os pedidos corporativos)
adminRouter.get('/orders', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = query.all(`
      SELECT o.*, c.razao_social, c.nome_fantasia, c.cnpj, c.cidade, c.uf,
             u.nome as comprador_nome, u.telefone_whatsapp,
             COUNT(oi.id) as itens_count
      FROM orders o
      JOIN companies c ON c.id = o.company_id
      JOIN users u ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);

    return res.json({
      success: true,
      total: orders.length,
      orders
    });

  } catch (err: any) {
    console.error('Erro ao listar pedidos admin:', err);
    return res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
});

// PATCH /api/admin/orders/:id/status (Atualizar Status do Pedido)
adminRouter.patch('/orders/:id/status', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDENTE', 'CONFIRMADO', 'FATURADO', 'EM_SEPARACAO', 'EM_TRANSPORTE', 'ENTREGUE', 'CANCELADO'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status inválido. Escolha entre: ${validStatuses.join(', ')}`
      });
    }

    const order = query.get('SELECT * FROM orders WHERE id = ? OR order_number = ?', id, id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não localizado.' });
    }

    query.run('UPDATE orders SET status = ? WHERE id = ?', status, order.id);

    return res.json({
      success: true,
      message: `Status do pedido ${order.order_number} atualizado para "${status}".`,
      orderId: order.id,
      newStatus: status,
      order: {
        ...order,
        status
      }
    });

  } catch (err: any) {
    console.error('Erro ao atualizar status do pedido:', err);
    return res.status(500).json({ error: 'Erro ao atualizar status do pedido.' });
  }
});

// GET /api/admin/companies (Empresas Clientes PJ)
adminRouter.get('/companies', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const companies = query.all(`
      SELECT c.*, COUNT(o.id) as total_pedidos, COALESCE(SUM(o.valor_total), 0) as total_faturado
      FROM companies c
      LEFT JOIN orders o ON o.company_id = c.id AND o.status != 'CANCELADO'
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    return res.json({
      success: true,
      total: companies.length,
      companies
    });

  } catch (err: any) {
    console.error('Erro ao listar empresas clientes:', err);
    return res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
});
