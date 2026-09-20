import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados de Usabilidade & Segurança (Toro Negro)...\n');

  let passed = 0;
  let failed = 0;

  function record(title: string, ok: boolean, detail: string = '') {
    if (ok) {
      console.log(`✅ [PASS] ${title} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Teste de Cabeçalhos de Segurança HTTP
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const nosniff = res.headers.get('x-content-type-options');
    const frameOptions = res.headers.get('x-frame-options');
    const xss = res.headers.get('x-xss-protection');
    const referrer = res.headers.get('referrer-policy');
    const poweredBy = res.headers.get('x-powered-by');

    record('Cabeçalho X-Content-Type-Options: nosniff', nosniff === 'nosniff');
    record('Cabeçalho X-Frame-Options: SAMEORIGIN', frameOptions === 'SAMEORIGIN');
    record('Cabeçalho X-XSS-Protection', xss === '1; mode=block');
    record('Cabeçalho Referrer-Policy', referrer === 'strict-origin-when-cross-origin');
    record('Ocultação de X-Powered-By', poweredBy === null, 'Tecnologia do servidor oculta');
  } catch (err: any) {
    record('Verificação de Cabeçalhos de Segurança', false, err.message);
  }

  // 2. Teste de Autenticação Corporativa (Credenciais Válidas e Inválidas)
  let authToken = '';
  try {
    // 2.1 Inválido
    const failRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'compras@restaurantesantafe.com.br', senha: 'SENHA_ERRADA' })
    });
    record('Rejeição de Credencial Incorreta (401)', failRes.status === 401);

    // 2.2 Válido
    const successRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'compras@restaurantesantafe.com.br', senha: '123456' })
    });
    const successData = await successRes.json();
    authToken = successData.token;
    record('Login Corporativo com Sucesso (200 + JWT)', successRes.status === 200 && !!authToken, `Empresa: ${successData.company?.nome_fantasia}`);
  } catch (err: any) {
    record('Fluxo de Autenticação Corporativa', false, err.message);
  }

  // 3. Teste de Consulta de CNPJ
  try {
    const cnpjRes = await fetch(`${BASE_URL}/api/cnpj/12345678000190`);
    const cnpjData = await cnpjRes.json();
    record('Consulta de CNPJ da Empresa Demo (200)', cnpjRes.status === 200 && cnpjData.success, cnpjData.razao_social || cnpjData.company?.razao_social);
  } catch (err: any) {
    record('Consulta de CNPJ', false, err.message);
  }

  // 4. Teste de Segurança no Pedido: Rejeição de Caixas Negativas e Integridade de Preço
  try {
    // 4.1 Envio com caixas negativas ou zero
    const fakeOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: { cnpj: '12.345.678/0001-90', razaoSocial: 'Restaurante Teste' },
        items: [{ productId: 'tn-carmenere-reservado', boxes: -5, unitPrice: 0.01 }]
      })
    });
    record('Bloqueio de Pedido com Caixas Negativas (400)', fakeOrderRes.status === 400);

    // 4.2 Envio com preço manipulado pelo cliente (deve forçar preço oficial do banco de dados)
    const tamperedRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: { cnpj: '12.345.678/0001-90', razaoSocial: 'Restaurante Teste' },
        items: [{ productId: 'tn-carmenere-reservado', boxes: 2, unitPrice: 0.05 }], // tentou R$ 0,05
        paymentMethod: 'BOLETO_07_14_21'
      })
    });
    const tamperedData = await tamperedRes.json();
    // 2 caixas * 6 garrafas = 12 garrafas * R$ 38.90 = R$ 466.80 (e não 12 * 0.05 = 0.60!)
    const isPriceSecured = tamperedData.valorTotal > 400;
    record('Integridade de Preço Server-Side (Rejeição de Preço Manipulado)', isPriceSecured, `Total recalculado pelo servidor: R$ ${tamperedData.valorTotal?.toFixed(2)}`);
    record('Retorno de OrderNumber e Objeto Order Compatível', !!tamperedData.orderNumber && !!tamperedData.order?.order_number, `Pedido: ${tamperedData.orderNumber}`);
    const encodedOrderNum = encodeURIComponent(tamperedData.orderNumber);
    const hasOrderNumInWa = tamperedData.whatsappUrl?.includes(encodedOrderNum) || tamperedData.whatsappUrl?.includes(tamperedData.orderNumber);
    record('Geração de Link Seguro do WhatsApp Comercial', Boolean(tamperedData.whatsappUrl?.includes('5541998632724') && hasOrderNumInWa), `URL contém ${tamperedData.orderNumber}`);
  } catch (err: any) {
    record('Integridade de Pedidos', false, err.message);
  }

  // 5. Teste de Sanitização Anti-XSS nos Arquivos Frontend
  try {
    const loginHtml = fs.readFileSync(path.resolve('./login-b2b.html'), 'utf-8');
    const portalHtml = fs.readFileSync(path.resolve('./portal-b2b.html'), 'utf-8');
    const indexHtml = fs.readFileSync(path.resolve('./index.html'), 'utf-8');

    const loginHasEscape = loginHtml.includes('function escapeHtml(str)');
    const portalHasEscape = portalHtml.includes('function escapeHtml(str)');
    const portalFixedDataMsg = !portalHtml.includes('${data.message ||');

    record('Função escapeHtml presente em login-b2b.html', loginHasEscape);
    record('Função escapeHtml presente em portal-b2b.html', portalHasEscape);
    record('Correção de ReferenceError data.message em portal-b2b.html', portalFixedDataMsg);

    // 6. Teste de Usabilidade: Mobile Drawer em index.html e Rodapés SEO²
    const indexHasMobileDrawer = indexHtml.includes('id="mobile-nav-menu"') && indexHtml.includes('toggleMobileMenu');
    const indexHasSeo2 = indexHtml.includes('Agência SEO²');
    const loginHasSeo2 = loginHtml.includes('Agência SEO²');
    const portalHasSeo2 = portalHtml.includes('Agência SEO²');
    const loginHasInputMode = loginHtml.includes('inputmode="numeric"');
    const loginHasPassToggle = loginHtml.includes('togglePasswordVisibility');

    record('Menu Hambúrguer Responsivo Mobile presente em index.html', indexHasMobileDrawer);
    record('inputmode="numeric" no campo de CNPJ em login-b2b.html', loginHasInputMode);
    record('Toggle de visibilidade de senha presente em login-b2b.html', loginHasPassToggle);
    record('Rodapé com "Desenvolvido por Agência SEO²" em index.html', indexHasSeo2);
    record('Rodapé com "Desenvolvido por Agência SEO²" em login-b2b.html', loginHasSeo2);
    record('Rodapé com "Desenvolvido por Agência SEO²" em portal-b2b.html', portalHasSeo2);
  } catch (err: any) {
    record('Verificação de Código Frontend', false, err.message);
  }

  console.log(`\n🏁 Resultado Final dos Testes: ${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
