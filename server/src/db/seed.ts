import { db, query } from './database.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export async function runSeed() {
  console.log('🌱 Executando seed do banco de dados...');

  // 1. Criar Empresa de Demonstração
  const demoCompanyId = 'comp-santafe-001';
  const existingCompany = query.get('SELECT id FROM companies WHERE id = ?', demoCompanyId);

  if (!existingCompany) {
    query.run(`
      INSERT INTO companies (
        id, cnpj, razao_social, nome_fantasia, inscricao_estadual,
        segmento, cnae_principal, logradouro, numero, bairro,
        cidade, uf, cep, limite_credito, status_aprovacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      demoCompanyId,
      '12.345.678/0001-90',
      'Restaurante e Adega Santa Fé Ltda',
      'Restaurante Santa Fé',
      'ISENTO',
      'Restaurante / Bistrô',
      '56.11-2-01',
      'Rua das Araucárias',
      '450',
      'Batel',
      'Curitiba',
      'PR',
      '80420-000',
      15000.00,
      'APROVADO'
    );
    console.log('✅ Empresa Demo cadastrada.');
  }

  // 2. Criar Usuário Comprador Demo
  const demoUserId = 'user-carlos-001';
  const existingUser = query.get('SELECT id FROM users WHERE id = ?', demoUserId);

  if (!existingUser) {
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash('123456', salt);

    query.run(`
      INSERT INTO users (
        id, company_id, nome, email, telefone_whatsapp, senha_hash, cargo, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      demoUserId,
      demoCompanyId,
      'Carlos Mendonça',
      'compras@restaurantesantafe.com.br',
      '(41) 99876-5432',
      senhaHash,
      'Sommelier & Comprador',
      'BUYER'
    );
    console.log('✅ Usuário Demo criado (login: compras@restaurantesantafe.com.br / 123456).');
  }

  // 2.1 Criar Empresa e Usuário Administrador Geral
  const adminCompanyId = 'comp-toronegro-matriz';
  const existingAdminComp = query.get('SELECT id FROM companies WHERE id = ?', adminCompanyId);
  if (!existingAdminComp) {
    query.run(`
      INSERT INTO companies (
        id, cnpj, razao_social, nome_fantasia, inscricao_estadual,
        segmento, cnae_principal, logradouro, numero, bairro,
        cidade, uf, cep, limite_credito, status_aprovacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      adminCompanyId,
      '00.000.000/0001-00',
      'Toro Negro Wines Importação e Distribuição Ltda',
      'Toro Negro Matriz & Gestão',
      'ISENTO',
      'Importadora / Vinícola',
      '46.35-4-01',
      'Av. das Vinhas',
      '1000',
      'Centro',
      'Curitiba',
      'PR',
      '80000-000',
      999999.00,
      'APROVADO'
    );
  }

  const adminUserId = 'user-admin-001';
  const existingAdminUser = query.get('SELECT id FROM users WHERE id = ? OR email = ?', adminUserId, 'admin@toronegro.com.br');
  if (!existingAdminUser) {
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash('admin123', salt);

    query.run(`
      INSERT INTO users (
        id, company_id, nome, email, telefone_whatsapp, senha_hash, cargo, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      adminUserId,
      adminCompanyId,
      'Gestão Toro Negro',
      'admin@toronegro.com.br',
      '(41) 99863-2724',
      senhaHash,
      'Administrador Geral',
      'ADMIN'
    );
    console.log('✅ Usuário Administrador criado (login: admin@toronegro.com.br / admin123).');
  }

  // 3. Catálogo Oficial dos 15 Vinhos Toro Negro
  const wines = [
    {
      id: 'tn-carmenere-reservado',
      nome: 'Toro Negro Carménère Reservado',
      linha: 'Reservado Chile',
      tipo: 'Tinto',
      uva: 'Carménère',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2023',
      teor_alcoolico: 13.0,
      volume_ml: 750,
      preco_varejo_ref: 59.90,
      preco_unitario: 38.90,
      preco_caixa: 233.40,
      estoque_caixas: 120,
      descricao: 'Vermelho cereja com notas púrpura. Aromas de frutas e especiarias pretas. Na boca taninos frutados, aveludados e equilibrados.',
      harmonizacao: 'Massas com molho vermelho, queijos e carnes magras.',
      temperatura_servico: '16° à 18°C',
      imagem_url: './assets/bottles/web/toro-negro-carmenere.png',
      destaque: 1
    },
    {
      id: 'tn-cabernet-reservado',
      nome: 'Toro Negro Cabernet Sauvignon Reservado',
      linha: 'Reservado Chile',
      tipo: 'Tinto',
      uva: 'Cabernet Sauvignon',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2023',
      teor_alcoolico: 13.0,
      volume_ml: 750,
      preco_varejo_ref: 59.90,
      preco_unitario: 38.90,
      preco_caixa: 233.40,
      estoque_caixas: 150,
      descricao: 'Vermelho rubi profundo. Notas a cerejas vermelhas e ameixas com toques de chocolate. Taninos redondos, suaves e bem estruturados.',
      harmonizacao: 'Churrascos, massas à bolonhesa e queijos maduros.',
      temperatura_servico: '16° à 18°C',
      imagem_url: './assets/bottles/web/toro-negro-cabernet.png',
      destaque: 1
    },
    {
      id: 'tn-merlot-reservado',
      nome: 'Toro Negro Merlot Reservado',
      linha: 'Reservado Chile',
      tipo: 'Tinto',
      uva: 'Merlot',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2023',
      teor_alcoolico: 13.0,
      volume_ml: 750,
      preco_varejo_ref: 59.90,
      preco_unitario: 38.90,
      preco_caixa: 233.40,
      estoque_caixas: 90,
      descricao: 'Vermelho rubi com reflexos violáceos. Aromas intensos de ameixas pretas, amoras e delicadas notas de especiarias doces. Taninos redondos e final sedoso.',
      harmonizacao: 'Carnes assadas, risotos e massas com molhos ricos.',
      temperatura_servico: '16° à 18°C',
      imagem_url: './assets/bottles/web/toro-negro-merlot.png',
      destaque: 0
    },
    {
      id: 'tn-sauvignon-reservado',
      nome: 'Toro Negro Sauvignon Blanc Reservado',
      linha: 'Reservado Chile',
      tipo: 'Branco',
      uva: 'Sauvignon Blanc',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2024',
      teor_alcoolico: 13.0,
      volume_ml: 750,
      preco_varejo_ref: 56.90,
      preco_unitario: 36.90,
      preco_caixa: 221.40,
      estoque_caixas: 80,
      descricao: 'Amarelo palha com reflexos esverdeados. Aroma de maçã verde, cítricos e toranja. Paladar fresco, vivaz e equilibrado.',
      harmonizacao: 'Ceviches, pratos frios, frutos do mar e salada caesar.',
      temperatura_servico: '10° à 12°C',
      imagem_url: './assets/bottles/web/toro-negro-sauvignon-blanc.png',
      destaque: 0
    },
    {
      id: 'tn-chardonnay-reservado',
      nome: 'Toro Negro Chardonnay Reservado',
      linha: 'Reservado Chile',
      tipo: 'Branco',
      uva: 'Chardonnay',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2024',
      teor_alcoolico: 13.0,
      volume_ml: 750,
      preco_varejo_ref: 56.90,
      preco_unitario: 36.90,
      preco_caixa: 221.40,
      estoque_caixas: 75,
      descricao: 'Amarelo dourado brilhante. Aromas tropicais de abacaxi maduro, pêssego e toques florais delicados. Paladar untuoso com excelente frescor e persistência.',
      harmonizacao: 'Salmão grelhado, aves ao molho branco e queijos cremosos.',
      temperatura_servico: '10° à 12°C',
      imagem_url: './assets/bottles/web/toro-negro-chardonnay.png',
      destaque: 0
    },
    {
      id: 'tn-rose-reservado',
      nome: 'Toro Negro Rosé Reservado',
      linha: 'Reservado Chile',
      tipo: 'Rosé',
      uva: 'Syrah Rosé',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2024',
      teor_alcoolico: 13.0,
      volume_ml: 750,
      preco_varejo_ref: 56.90,
      preco_unitario: 36.90,
      preco_caixa: 221.40,
      estoque_caixas: 60,
      descricao: 'Rosa pálido sofisticado. Aromas florais com notas de framboesa, cereja ácida e groselha. Paladar equilibrado e aveludado no final.',
      harmonizacao: 'Gazpachos, peixe, macarrão com molho branco e saladas.',
      temperatura_servico: '10° à 12°C',
      imagem_url: './assets/bottles/web/toro-negro-rose.png',
      destaque: 0
    },
    {
      id: 'tn-malbec-mendoza',
      nome: 'Toro Negro Malbec Mendoza',
      linha: 'Mendoza Argentina',
      tipo: 'Tinto',
      uva: 'Malbec',
      pais: 'Argentina',
      regiao: 'Mendoza',
      safra: '2023',
      teor_alcoolico: 13.5,
      volume_ml: 750,
      preco_varejo_ref: 64.90,
      preco_unitario: 42.90,
      preco_caixa: 257.40,
      estoque_caixas: 140,
      descricao: 'Vermelho com tons enegrecidos e violeta. Aromas de groselhas negras e amoras. Sabor persistente de frutas vermelhas e taninos amigáveis.',
      harmonizacao: 'Carnes vermelhas assadas em churrasqueira e queijos duros.',
      temperatura_servico: '14° à 16°C',
      imagem_url: './assets/bottles/web/toro-negro-malbec.png',
      destaque: 1
    },
    {
      id: 'tn-bonarda-mendoza',
      nome: 'Toro Negro Bonarda Mendoza',
      linha: 'Mendoza Argentina',
      tipo: 'Tinto',
      uva: 'Bonarda',
      pais: 'Argentina',
      regiao: 'Mendoza',
      safra: '2023',
      teor_alcoolico: 13.0,
      volume_ml: 750,
      preco_varejo_ref: 64.90,
      preco_unitario: 42.90,
      preco_caixa: 257.40,
      estoque_caixas: 85,
      descricao: 'Cor rubi intensa com reflexos granada. Notas exuberantes de figos maduros, amoras e especiarias doces, com paladar aveludado e envolvente.',
      harmonizacao: 'Risotos de funghi, massas recheadas e carnes de caça.',
      temperatura_servico: '15° à 17°C',
      imagem_url: './assets/bottles/web/toro-negro-bonarda.png',
      destaque: 1
    },
    {
      id: 'tn-torrontes-mendoza',
      nome: 'Toro Negro Torrontés',
      linha: 'Mendoza Argentina',
      tipo: 'Branco',
      uva: 'Torrontés',
      pais: 'Argentina',
      regiao: 'Mendoza',
      safra: '2024',
      teor_alcoolico: 13.0,
      volume_ml: 750,
      preco_varejo_ref: 59.90,
      preco_unitario: 39.90,
      preco_caixa: 239.40,
      estoque_caixas: 70,
      descricao: 'Amarelo brilhante com reflexos dourados. Aromas florais inebriantes de jasmim e flor de laranjeira combinados a notas de pêssego branco.',
      harmonizacao: 'Cozinha asiática, frutos do mar picantes e queijo de cabra.',
      temperatura_servico: '8° à 10°C',
      imagem_url: './assets/bottles/web/toro-negro-torrontes.png',
      destaque: 0
    },
    {
      id: 'tn-suave-sweet',
      nome: 'Toro Negro Suave Sweet',
      linha: 'Especiais',
      tipo: 'Tinto',
      uva: 'Vitis Vinifera Suave',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2023',
      teor_alcoolico: 12.5,
      volume_ml: 750,
      preco_varejo_ref: 49.90,
      preco_unitario: 32.90,
      preco_caixa: 197.40,
      estoque_caixas: 110,
      descricao: 'Tinto rubi com notas de frutas vermelhas. No paladar é doce e persistente, sem perder os taninos nobres das uvas vitis vinifera.',
      harmonizacao: 'Sobremesas finas, chocolates amargos e bolos.',
      temperatura_servico: '16° à 18°C',
      imagem_url: './assets/bottles/web/toro-negro-suave.png',
      destaque: 1
    },
    {
      id: 'tn-verano-pedro-jimenez',
      nome: 'Pedro Jimenez Verano',
      linha: 'Especiais',
      tipo: 'Branco',
      uva: 'Pedro Jimenez',
      pais: 'Chile',
      regiao: 'Valle del Limarí',
      safra: '2024',
      teor_alcoolico: 12.0,
      volume_ml: 750,
      preco_varejo_ref: 54.90,
      preco_unitario: 34.90,
      preco_caixa: 209.40,
      estoque_caixas: 95,
      descricao: 'Amarelo-palha com reflexos esverdeados. Delicado, com notas de mel e florais. Paladar suculento com ótima acidez e frescor incrível.',
      harmonizacao: 'Aperitivos, frutos do mar e saladas frescas.',
      temperatura_servico: '12° à 14°C',
      imagem_url: './assets/bottles/web/toro-negro-verano.png',
      destaque: 1
    },
    {
      id: 'tn-el-secreto',
      nome: 'Toro Negro El Secreto Gran Seleção',
      linha: 'Especiais',
      tipo: 'Tinto',
      uva: 'Blend Nobre Ícone',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2022',
      teor_alcoolico: 13.5,
      volume_ml: 750,
      preco_varejo_ref: 89.90,
      preco_unitario: 49.90,
      preco_caixa: 299.40,
      estoque_caixas: 80,
      descricao: 'Edição especial de vinhedos selecionados. Encorpado, nobre, com notas complexas de cassis, cedro e baunilha.',
      harmonizacao: 'Cortes nobres, cordeiro grelhado e queijos curados.',
      temperatura_servico: '16° à 18°C',
      imagem_url: './assets/bottles/web/toro-negro-el-secreto.png',
      destaque: 1
    },
    {
      id: 'tn-brut-sparkling',
      nome: 'Toro Negro Brut Sparkling',
      linha: 'Especiais',
      tipo: 'Espumante',
      uva: 'Brut Charmat',
      pais: 'Argentina',
      regiao: 'Mendoza',
      safra: 'NV',
      teor_alcoolico: 12.0,
      volume_ml: 750,
      preco_varejo_ref: 69.90,
      preco_unitario: 44.90,
      preco_caixa: 269.40,
      estoque_caixas: 80,
      descricao: 'Perlage fino e constante, notas cítricas elegantes e frescor vibrante na taça, expressando o equilíbrio da altitude mendocina.',
      harmonizacao: 'Entradas leves, canapés finos e celebrações.',
      temperatura_servico: '6° à 8°C',
      imagem_url: './assets/bottles/web/toro-negro-brut.png',
      destaque: 1
    },
    {
      id: 'tn-brut-rose-sparkling',
      nome: 'Toro Negro Brut Rosé Sparkling',
      linha: 'Especiais',
      tipo: 'Espumante',
      uva: 'Brut Rosé Charmat',
      pais: 'Argentina',
      regiao: 'Mendoza',
      safra: 'NV',
      teor_alcoolico: 12.0,
      volume_ml: 750,
      preco_varejo_ref: 69.90,
      preco_unitario: 44.90,
      preco_caixa: 269.40,
      estoque_caixas: 70,
      descricao: 'Coloração salmão suave com perlage delicado e persistente. Aromas sedutores de frutas vermelhas frescas e paladar cremoso.',
      harmonizacao: 'Salmão grelhado, carpaccios e sobremesas com frutas.',
      temperatura_servico: '6° à 8°C',
      imagem_url: './assets/bottles/web/toro-negro-brut-rose.png',
      destaque: 1
    },
    {
      id: 'tn-sweet-tinto',
      nome: 'Toro Negro Sweet',
      linha: 'Especiais',
      tipo: 'Tinto',
      uva: 'Sweet Tinto',
      pais: 'Chile',
      regiao: 'Valle Central',
      safra: '2023',
      teor_alcoolico: 12.5,
      volume_ml: 750,
      preco_varejo_ref: 49.90,
      preco_unitario: 32.90,
      preco_caixa: 197.40,
      estoque_caixas: 65,
      descricao: 'Intensidade aromática de geléia de amoras e cerejas com final doce, macio e aveludado, preservando a identidade clássica da casta.',
      harmonizacao: 'Sobremesas à base de frutas vermelhas e queijos azuis.',
      temperatura_servico: '14° à 16°C',
      imagem_url: './assets/bottles/web/toro-negro-sweet.png',
      destaque: 0
    }
  ];

  for (const wine of wines) {
    const existing = query.get('SELECT id FROM products WHERE id = ?', wine.id);
    if (!existing) {
      query.run(`
        INSERT INTO products (
          id, nome, linha, tipo, uva, pais, regiao, safra, teor_alcoolico,
          volume_ml, preco_varejo_ref, preco_unitario, preco_caixa,
          estoque_caixas, descricao, harmonizacao, temperatura_servico,
          imagem_url, destaque, ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        wine.id, wine.nome, wine.linha, wine.tipo, wine.uva, wine.pais,
        wine.regiao, wine.safra, wine.teor_alcoolico, wine.volume_ml,
        wine.preco_varejo_ref, wine.preco_unitario, wine.preco_caixa,
        wine.estoque_caixas, wine.descricao, wine.harmonizacao,
        wine.temperatura_servico, wine.imagem_url, wine.destaque, 1
      );
    }
  }

  console.log(`✅ ${wines.length} vinhos Toro Negro populados no catálogo.`);
}

// Permitir execução direta se chamado como script
if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed().then(() => process.exit(0)).catch(err => {
    console.error('Erro no seed:', err);
    process.exit(1);
  });
}
