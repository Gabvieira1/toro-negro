import { Router, Request, Response } from 'express';
import { query } from '../db/database.js';

export const productsRouter = Router();

// GET /api/products
productsRouter.get('/', (req: Request, res: Response) => {
  const { tipo, pais, uva, search } = req.query;

  let sql = 'SELECT * FROM products WHERE ativo = 1';
  const params: any[] = [];

  if (tipo) {
    sql += ' AND LOWER(tipo) = LOWER(?)';
    params.push(tipo);
  }

  if (pais) {
    sql += ' AND LOWER(pais) = LOWER(?)';
    params.push(pais);
  }

  if (uva) {
    sql += ' AND LOWER(uva) LIKE LOWER(?)';
    params.push(`%${uva}%`);
  }

  if (search) {
    sql += ' AND (LOWER(nome) LIKE LOWER(?) OR LOWER(uva) LIKE LOWER(?) OR LOWER(regiao) LIKE LOWER(?))';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY destaque DESC, preco_unitario ASC';

  const products = query.all(sql, ...params);
  return res.json({
    total: products.length,
    products
  });
});

// GET /api/products/:id
productsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const product = query.get('SELECT * FROM products WHERE id = ?', id);

  if (!product) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }

  return res.json(product);
});
