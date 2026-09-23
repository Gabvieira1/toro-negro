import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db/database.js';
import { requireAdmin, optionalAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export const productsRouter = Router();

// GET /api/products (com suporte a includeInactive para o painel de admin)
productsRouter.get('/', (req: Request, res: Response) => {
  const { tipo, pais, uva, search, includeInactive } = req.query;

  let sql = (includeInactive === '1' || includeInactive === 'true')
    ? 'SELECT * FROM products WHERE 1=1'
    : 'SELECT * FROM products WHERE ativo = 1';

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

// PUT /api/products/:id (Editar Produto / Valores / Estoque)
productsRouter.put('/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = query.get('SELECT * FROM products WHERE id = ?', id);

    if (!existing) {
      return res.status(404).json({ error: 'Produto não localizado para edição.' });
    }

    const {
      nome,
      linha,
      tipo,
      uva,
      pais,
      regiao,
      safra,
      teor_alcoolico,
      volume_ml,
      unidades_por_caixa,
      preco_varejo_ref,
      preco_unitario,
      estoque_caixas,
      descricao,
      harmonizacao,
      temperatura_servico,
      imagem_url,
      destaque,
      ativo
    } = req.body;

    const finalNome = (nome !== undefined ? String(nome).trim() : existing.nome) || existing.nome;
    const finalLinha = (linha !== undefined ? String(linha).trim() : existing.linha) || existing.linha;
    const finalTipo = (tipo !== undefined ? String(tipo).trim() : existing.tipo) || existing.tipo;
    const finalUva = (uva !== undefined ? String(uva).trim() : existing.uva) || existing.uva;
    const finalPais = (pais !== undefined ? String(pais).trim() : existing.pais) || existing.pais;
    const finalRegiao = (regiao !== undefined ? String(regiao).trim() : existing.regiao) || existing.regiao;
    const finalSafra = (safra !== undefined ? String(safra).trim() : existing.safra) || existing.safra;
    const finalTeor = teor_alcoolico !== undefined ? Number(teor_alcoolico) : existing.teor_alcoolico;
    const finalVolume = volume_ml !== undefined ? Number(volume_ml) : existing.volume_ml;
    const finalUnitsPerBox = unidades_por_caixa !== undefined ? Math.max(1, Number(unidades_por_caixa)) : (existing.unidades_por_caixa || 6);

    // Validações financeiras e estoque
    const finalPrecoUnitario = preco_unitario !== undefined ? Math.max(0.01, Number(preco_unitario)) : existing.preco_unitario;
    const finalPrecoVarejo = preco_varejo_ref !== undefined ? Math.max(finalPrecoUnitario, Number(preco_varejo_ref)) : existing.preco_varejo_ref;
    const finalPrecoCaixa = Number((finalPrecoUnitario * finalUnitsPerBox).toFixed(2));
    const finalEstoque = estoque_caixas !== undefined ? Math.max(0, Math.floor(Number(estoque_caixas))) : existing.estoque_caixas;

    const finalDesc = descricao !== undefined ? String(descricao).trim() : existing.descricao;
    const finalHarmon = harmonizacao !== undefined ? String(harmonizacao).trim() : existing.harmonizacao;
    const finalTemp = temperatura_servico !== undefined ? String(temperatura_servico).trim() : existing.temperatura_servico;
    const finalImg = (imagem_url !== undefined ? String(imagem_url).trim() : existing.imagem_url) || existing.imagem_url;
    const finalDestaque = destaque !== undefined ? (Number(destaque) ? 1 : 0) : existing.destaque;
    const finalAtivo = ativo !== undefined ? (Number(ativo) ? 1 : 0) : existing.ativo;

    query.run(`
      UPDATE products SET
        nome = ?,
        linha = ?,
        tipo = ?,
        uva = ?,
        pais = ?,
        regiao = ?,
        safra = ?,
        teor_alcoolico = ?,
        volume_ml = ?,
        unidades_por_caixa = ?,
        preco_varejo_ref = ?,
        preco_unitario = ?,
        preco_caixa = ?,
        estoque_caixas = ?,
        descricao = ?,
        harmonizacao = ?,
        temperatura_servico = ?,
        imagem_url = ?,
        destaque = ?,
        ativo = ?
      WHERE id = ?
    `,
      finalNome,
      finalLinha,
      finalTipo,
      finalUva,
      finalPais,
      finalRegiao,
      finalSafra,
      finalTeor,
      finalVolume,
      finalUnitsPerBox,
      finalPrecoVarejo,
      finalPrecoUnitario,
      finalPrecoCaixa,
      finalEstoque,
      finalDesc,
      finalHarmon,
      finalTemp,
      finalImg,
      finalDestaque,
      finalAtivo,
      id
    );

    const updated = query.get('SELECT * FROM products WHERE id = ?', id);

    return res.json({
      success: true,
      message: `Rótulo "${finalNome}" atualizado com sucesso!`,
      product: updated
    });

  } catch (err: any) {
    console.error('Erro ao atualizar produto:', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar dados do produto.' });
  }
});

// POST /api/products (Cadastrar Novo Rótulo)
productsRouter.post('/', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      nome,
      linha = 'Reservado Chile',
      tipo = 'Tinto',
      uva = 'Cabernet Sauvignon',
      pais = 'Chile',
      regiao = 'Valle Central',
      safra = '2023',
      teor_alcoolico = 13.0,
      volume_ml = 750,
      unidades_por_caixa = 6,
      preco_varejo_ref = 59.90,
      preco_unitario = 38.90,
      estoque_caixas = 50,
      descricao = '',
      harmonizacao = '',
      temperatura_servico = '16° à 18°C',
      imagem_url = './assets/bottles/web/toro-negro-carmenere.png',
      destaque = 0
    } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome do vinho é obrigatório.' });
    }

    const cleanName = String(nome).trim();
    const idSlug = 'tn-' + cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + crypto.randomUUID().slice(0, 4);

    const unitPrice = Math.max(0.01, Number(preco_unitario));
    const unitsPerBox = Math.max(1, Number(unidades_por_caixa));
    const boxPrice = Number((unitPrice * unitsPerBox).toFixed(2));
    const retailRef = Math.max(unitPrice, Number(preco_varejo_ref));
    const stockBoxes = Math.max(0, Math.floor(Number(estoque_caixas)));

    query.run(`
      INSERT INTO products (
        id, nome, linha, tipo, uva, pais, regiao, safra,
        teor_alcoolico, volume_ml, unidades_por_caixa, preco_varejo_ref,
        preco_unitario, preco_caixa, estoque_caixas, descricao,
        harmonizacao, temperatura_servico, imagem_url, destaque, ativo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      idSlug,
      cleanName,
      linha,
      tipo,
      uva,
      pais,
      regiao,
      safra,
      Number(teor_alcoolico),
      Number(volume_ml),
      unitsPerBox,
      retailRef,
      unitPrice,
      boxPrice,
      stockBoxes,
      descricao,
      harmonizacao,
      temperatura_servico,
      imagem_url,
      destaque ? 1 : 0,
      1
    );

    const created = query.get('SELECT * FROM products WHERE id = ?', idSlug);

    return res.status(201).json({
      success: true,
      message: `Vinho "${cleanName}" cadastrado com sucesso!`,
      product: created
    });

  } catch (err: any) {
    console.error('Erro ao cadastrar novo produto:', err);
    return res.status(500).json({ error: 'Erro interno ao cadastrar produto.' });
  }
});

// DELETE /api/products/:id (Alternar Ativo / Inativo ou Excluir)
productsRouter.delete('/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = query.get('SELECT * FROM products WHERE id = ?', id);

    if (!existing) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    // Toggle status para inativo (soft-delete seguro)
    const newStatus = existing.ativo === 1 ? 0 : 1;
    query.run('UPDATE products SET ativo = ? WHERE id = ?', newStatus, id);

    return res.json({
      success: true,
      message: `Produto ${newStatus === 1 ? 'ativado' : 'desativado'} no catálogo com sucesso!`,
      ativo: newStatus
    });

  } catch (err: any) {
    console.error('Erro ao alterar status do produto:', err);
    return res.status(500).json({ error: 'Erro ao desativar produto.' });
  }
});
