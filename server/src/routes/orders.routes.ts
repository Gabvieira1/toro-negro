import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db/database.js';
import { optionalAuth, requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export const ordersRouter = Router();

// POST /api/orders
ordersRouter.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      company,
      items,
      paymentMethod = 'BOLETO_07_14_21',
      deliveryAddress,
      observations
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'O carrinho está vazio. Adicione ao menos 1 caixa de vinho.' });
    }

    let companyId = req.user?.companyId;
    let userId = req.user?.userId;

    // Se o pedido vier sem login ativo, verificar ou criar a empresa pelo CNPJ informado
    if (!companyId) {
      const razaoSocial = company?.razaoSocial || company?.razao_social;
      if (!company || !company.cnpj || !razaoSocial) {
        return res.status(400).json({ error: 'Identificação corporativa necessária (CNPJ e Razão Social).' });
      }

      const cleanCnpj = company.cnpj.replace(/\D/g, '');
      let existingCompany = query.get('SELECT id FROM companies WHERE cnpj = ? OR cnpj = ?', cleanCnpj, company.cnpj);

      if (!existingCompany) {
        companyId = 'comp-' + crypto.randomUUID().slice(0, 8);
        query.run(`
          INSERT INTO companies (
            id, cnpj, razao_social, nome_fantasia, inscricao_estadual,
            segmento, logradouro, numero, bairro, cidade, uf, cep, limite_credito
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          companyId,
          cleanCnpj,
          razaoSocial,
          company.nomeFantasia || company.nome_fantasia || razaoSocial,
          company.ie || 'ISENTO',
          company.segmento || 'Restaurante / Adega',
          deliveryAddress?.logradouro || '',
          deliveryAddress?.numero || '',
          deliveryAddress?.bairro || '',
          deliveryAddress?.cidade || company.cidade || 'Curitiba',
          deliveryAddress?.uf || company.uf || 'PR',
          deliveryAddress?.cep || '',
          10000.00
        );
      } else {
        companyId = existingCompany.id;
      }

      // Usuário temporário/anônimo para o pedido se não houver
      let existingUser = query.get('SELECT id FROM users WHERE company_id = ? LIMIT 1', companyId);
      if (!existingUser) {
        userId = 'user-' + crypto.randomUUID().slice(0, 8);
        query.run(`
          INSERT INTO users (id, company_id, nome, email, telefone_whatsapp, senha_hash)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          userId,
          companyId,
          company.responsavel || company.nomeFantasia || 'Comprador',
          company.email || `compras@${cleanCnpj}.com.br`,
          company.whatsapp || '(11) 99876-5432',
          'NO_PASSWORD_GUEST'
        );
      } else {
        userId = existingUser.id;
      }
    }

    // 2. Calcular totais e validar itens
    let totalCaixas = 0;
    let totalGarrafas = 0;
    let valorProdutos = 0;

    const validatedItems: any[] = [];

    for (const item of items) {
      const boxes = Number(item.boxes || item.quantidade_caixas || 1);
      if (boxes <= 0) continue;

      let product: any = null;
      if (item.productId || item.id) {
        product = query.get('SELECT * FROM products WHERE id = ?', item.productId || item.id);
      } else if (item.wineName) {
        product = query.get('SELECT * FROM products WHERE LOWER(nome) = LOWER(?)', item.wineName);
      }

      const unitPrice = product ? Number(product.preco_unitario) : Number(item.unitPrice || 38.90);
      const bottlesCount = boxes * 6;
      const subtotal = boxes * 6 * unitPrice;

      totalCaixas += boxes;
      totalGarrafas += bottlesCount;
      valorProdutos += subtotal;

      validatedItems.push({
        productId: product?.id || 'tn-carmenere-reservado',
        wineName: product?.nome || item.wineName || 'Vinho Toro Negro',
        boxes,
        bottlesCount,
        unitPrice,
        subtotal
      });
    }

    if (totalCaixas === 0) {
      return res.status(400).json({ error: 'Nenhuma caixa válida no pedido.' });
    }

    // 3. Regra de Desconto (3% OFF no Pix à vista)
    let valorDesconto = 0;
    if (paymentMethod === 'PIX_A_VISTA') {
      valorDesconto = valorProdutos * 0.03;
    }

    const valorTotal = valorProdutos - valorDesconto;

    // 4. Gerar Código do Pedido #TN-XXXXX
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `#TN-${randomSuffix}`;
    const orderId = 'ord-' + crypto.randomUUID().slice(0, 10);

    // 5. Inserir Pedido no Banco
    query.run(`
      INSERT INTO orders (
        id, order_number, company_id, user_id, total_caixas, total_garrafas,
        valor_produtos, valor_frete, valor_desconto, valor_total,
        forma_pagamento, status, endereco_entrega, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      orderId,
      orderNumber,
      companyId,
      userId,
      totalCaixas,
      totalGarrafas,
      valorProdutos,
      0.00, // Frete cortesia para pedidos B2B
      valorDesconto,
      valorTotal,
      paymentMethod,
      'CONFIRMADO',
      JSON.stringify(deliveryAddress || { cidade: 'A combinar', uf: 'BR' }),
      observations || ''
    );

    // 6. Inserir Itens do Pedido & Abater Estoque
    for (const it of validatedItems) {
      const itemId = 'item-' + crypto.randomUUID().slice(0, 10);
      query.run(`
        INSERT INTO order_items (
          id, order_id, product_id, quantidade_caixas, quantidade_garrafas,
          preco_unitario_cobrado, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        itemId,
        orderId,
        it.productId,
        it.boxes,
        it.bottlesCount,
        it.unitPrice,
        it.subtotal
      );

      // Abater estoque de caixas
      query.run(`
        UPDATE products SET estoque_caixas = MAX(0, estoque_caixas - ?) WHERE id = ?
      `, it.boxes, it.productId);
    }

    // 7. Montar Mensagem Oficial de Confirmação para WhatsApp
    const compData = query.get('SELECT * FROM companies WHERE id = ?', companyId);
    let wsMsg = `*PEDIDO CORPORATIVO B2B - TORO NEGRO WINES*\n`;
    wsMsg += `----------------------------------------\n`;
    wsMsg += `*Número do Pedido:* ${orderNumber}\n`;
    wsMsg += `*Empresa:* ${compData?.nome_fantasia || compData?.razao_social || 'Cliente PJ'}\n`;
    wsMsg += `*CNPJ:* ${compData?.cnpj || 'Informado na plataforma'}\n`;
    wsMsg += `*Condição de Pagamento:* ${paymentMethod === 'BOLETO_07_14_21' || paymentMethod === 'BOLETO_28D' ? 'Boleto Faturado (07/14/21 Dias)' : paymentMethod === 'PIX_A_VISTA' ? 'Pix à Vista (3% OFF aplicado)' : 'Cartão Corporativo'}\n`;
    wsMsg += `*Logística & Entrega:* Frota Própria MUFS (Direta e Climatizada)\n`;
    wsMsg += `----------------------------------------\n`;
    wsMsg += `*ITENS DO PEDIDO (CAIXAS COM 6 GARRAFAS):*\n`;

    for (const it of validatedItems) {
      wsMsg += `• ${it.boxes}x cx (${it.bottlesCount} un) - ${it.wineName}: R$ ${it.subtotal.toFixed(2).replace('.', ',')}\n`;
    }

    wsMsg += `----------------------------------------\n`;
    wsMsg += `*Total de Caixas:* ${totalCaixas} caixas (${totalGarrafas} garrafas)\n`;
    if (valorDesconto > 0) {
      wsMsg += `*Desconto Pix (3%):* - R$ ${valorDesconto.toFixed(2).replace('.', ',')}\n`;
    }
    wsMsg += `*Valor Total:* R$ ${valorTotal.toFixed(2).replace('.', ',')}\n\n`;
    wsMsg += `Pedido registrado no sistema da Vinícola! Olá, gostaria de confirmar o faturamento e o envio da NFe/Boleto.`;

    const encodedWsMsg = encodeURIComponent(wsMsg);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=5541998632724&text=${encodedWsMsg}`;

    return res.status(201).json({
      success: true,
      orderId,
      orderNumber,
      totalCaixas,
      totalGarrafas,
      valorTotal,
      formaPagamento: paymentMethod,
      whatsappUrl,
      message: `Pedido ${orderNumber} criado com sucesso e registrado na base de dados.`
    });

  } catch (err: any) {
    console.error('Erro ao criar pedido:', err);
    return res.status(500).json({ error: 'Erro interno ao processar pedido corporativo.' });
  }
});

// GET /api/orders
ordersRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user!.companyId;
  const orders = query.all(`
    SELECT o.*, COUNT(oi.id) as total_itens
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.company_id = ?
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `, companyId);

  return res.json({ orders });
});

// GET /api/orders/:orderNumber
ordersRouter.get('/:orderNumber', (req: Request, res: Response) => {
  const { orderNumber } = req.params;
  const order = query.get('SELECT * FROM orders WHERE order_number = ?', orderNumber);

  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }

  const items = query.all(`
    SELECT oi.*, p.nome, p.imagem_url, p.uva, p.pais
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `, order.id);

  return res.json({ order, items });
});
