/**
 * Automated Test Suite for Toro Negro Admin & Maintenance Features
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🍷 Inicando Testes Automatizados da Área Administrativa Toro Negro...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Security Check: Unauthenticated request to /api/admin/stats
    console.log('1. Testando Segurança & Controle de Acesso:');
    const unauthRes = await fetch(`${BASE_URL}/api/admin/stats`);
    assert(unauthRes.status === 401, 'Requisição sem token para /api/admin/stats retorna 401 Unauthorized');

    // 2. Admin Login
    console.log('\n2. Testando Autenticação Administrativa (/api/admin/login):');
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@toronegro.com.br',
        password: 'admin123'
      })
    });
    assert(loginRes.status === 200, 'Login do administrador retorna status 200');
    const loginData = await loginRes.json();
    assert(!!loginData.token, 'Token JWT retornado no login');
    assert(loginData.user?.role === 'ADMIN', 'Usuário autenticado possui role ADMIN');
    const adminToken = loginData.token;

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    // 3. Admin Dashboard Stats
    console.log('\n3. Testando Métricas do Dashboard (/api/admin/stats):');
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, { headers: authHeaders });
    assert(statsRes.status === 200, 'GET /api/admin/stats retorna status 200');
    const statsData = await statsRes.json();
    assert(typeof statsData.stats?.activeProducts === 'number', 'Métrica activeProducts presente');
    assert(typeof statsData.stats?.totalBoxesStock === 'number', 'Métrica totalBoxesStock presente');
    assert(typeof statsData.stats?.totalRevenue === 'number', 'Métrica totalRevenue presente');
    assert(typeof statsData.stats?.totalOrders === 'number', 'Métrica totalOrders presente');
    assert(typeof statsData.stats?.totalCompanies === 'number', 'Métrica totalCompanies presente');
    console.log(`     -> Rótulos Ativos: ${statsData.stats.activeProducts}`);
    console.log(`     -> Estoque em Caixas: ${statsData.stats.totalBoxesStock}`);
    console.log(`     -> Total Pedidos: ${statsData.stats.totalOrders}`);
    console.log(`     -> Clientes PJ: ${statsData.stats.totalCompanies}`);

    // 4. Edição de Preços e Produtos (PUT /api/products/:id)
    console.log('\n4. Testando Edição de Produto & Recálculo Automático de Preço por Caixa:');
    const targetId = 'tn-carmenere-reservado';
    
    // Obter dados atuais
    const prodRes1 = await fetch(`${BASE_URL}/api/products`);
    const prodsData1 = await prodRes1.json();
    const originalProd = prodsData1.products.find((p: any) => p.id === targetId);
    assert(!!originalProd, `Produto ${targetId} encontrado no catálogo`);

    const originalUnitPrice = originalProd.preco_unitario;
    const originalStock = originalProd.estoque_caixas;

    // Atualizar preço unitário e estoque
    const newUnitPrice = 42.50;
    const newStock = 135;
    const updateRes = await fetch(`${BASE_URL}/api/products/${targetId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        preco_unitario: newUnitPrice,
        estoque_caixas: newStock
      })
    });
    assert(updateRes.status === 200, 'PUT /api/products/:id retorna status 200');
    const updateData = await updateRes.json();
    assert(updateData.product?.preco_unitario === newUnitPrice, `Preço unitário atualizado para R$ ${newUnitPrice}`);
    // 42.50 * 6 = 255.00
    assert(updateData.product?.preco_caixa === 255, `Preço da caixa recalculado automaticamente para R$ 255,00 (6x R$ 42,50)`);
    assert(updateData.product?.estoque_caixas === newStock, `Estoque atualizado para ${newStock} caixas`);

    // 5. Verificar sincronização no catálogo público do e-commerce
    console.log('\n5. Verificando Sincronização Dinâmica com a Vitrine B2B (/api/products):');
    const prodRes2 = await fetch(`${BASE_URL}/api/products`);
    const prodsData2 = await prodRes2.json();
    const syncedProd = prodsData2.products.find((p: any) => p.id === targetId);
    assert(syncedProd.preco_unitario === newUnitPrice, 'Catálogo público reflete novo preço unitário');
    assert(syncedProd.preco_caixa === 255, 'Catálogo público reflete novo preço por caixa');

    // Restaurar produto para valores originais
    console.log('\n6. Restaurando Valores Originais do Rótulo:');
    const restoreRes = await fetch(`${BASE_URL}/api/products/${targetId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        preco_unitario: originalUnitPrice,
        estoque_caixas: originalStock
      })
    });
    assert(restoreRes.status === 200, 'Rótulo restaurado aos valores originais com sucesso');

    // 7. Listagem de Pedidos Corporativos
    console.log('\n7. Testando Gestão de Pedidos (/api/admin/orders):');
    const ordersRes = await fetch(`${BASE_URL}/api/admin/orders`, { headers: authHeaders });
    assert(ordersRes.status === 200, 'GET /api/admin/orders retorna status 200');
    const ordersData = await ordersRes.json();
    assert(Array.isArray(ordersData.orders), 'Lista de pedidos retornada em array');
    console.log(`     -> Encontrados ${ordersData.orders.length} pedidos no banco`);

    if (ordersData.orders.length > 0) {
      const firstOrder = ordersData.orders[0];
      const newStatus = firstOrder.status === 'CONFIRMADO' ? 'FATURADO' : 'CONFIRMADO';
      const patchRes = await fetch(`${BASE_URL}/api/admin/orders/${firstOrder.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus })
      });
      assert(patchRes.status === 200, `Atualização de status do pedido para ${newStatus} retorna status 200`);
      const patchData = await patchRes.json();
      assert(patchData.order?.status === newStatus, `Status do pedido atualizado com sucesso`);
    }

    // 8. Listagem de Clientes PJ
    console.log('\n8. Testando Gestão de Clientes PJ (/api/admin/companies):');
    const compRes = await fetch(`${BASE_URL}/api/admin/companies`, { headers: authHeaders });
    assert(compRes.status === 200, 'GET /api/admin/companies retorna status 200');
    const compData = await compRes.json();
    assert(Array.isArray(compData.companies), 'Lista de empresas parceiras retornada');
    console.log(`     -> Encontradas ${compData.companies.length} empresas cadastradas`);

  } catch (err) {
    console.error('Erro na execução dos testes:', err);
    failed++;
  }

  console.log('\n=========================================');
  console.log(`📊 RESULTADO DOS TESTES: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('=========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
