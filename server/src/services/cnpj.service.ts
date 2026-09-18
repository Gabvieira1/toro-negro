import { query } from '../db/database.js';

export interface CNPJLookupResult {
  success: boolean;
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnae_principal?: string;
  cnae_descricao?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  situacao_cadastral?: string;
  ativa?: boolean;
  message?: string;
}

export async function lookupCNPJ(rawCnpj: string): Promise<CNPJLookupResult> {
  const cleanCnpj = rawCnpj.replace(/\D/g, '');

  if (cleanCnpj.length !== 14) {
    return {
      success: false,
      cnpj: rawCnpj,
      message: 'CNPJ deve conter 14 dígitos numéricos.'
    };
  }

  // 1. Consulta primeiro no banco de dados local da Toro Negro (Instantâneo e Offline-First)
  try {
    const localComp: any = query.get('SELECT * FROM companies WHERE cnpj = ?', cleanCnpj);
    if (localComp) {
      return {
        success: true,
        cnpj: localComp.cnpj,
        razao_social: localComp.razao_social,
        nome_fantasia: localComp.nome_fantasia,
        cidade: localComp.cidade,
        municipio: localComp.cidade,
        uf: localComp.uf,
        logradouro: localComp.logradouro,
        numero: localComp.numero,
        bairro: localComp.bairro,
        cep: localComp.cep,
        situacao_cadastral: 'ATIVA',
        ativa: true
      };
    }
  } catch (err) {
    // continua para busca externa
  }

  // Fallback / Demo para CNPJ de teste
  if (cleanCnpj === '12345678000190') {
    return {
      success: true,
      cnpj: '12.345.678/0001-90',
      razao_social: 'Restaurante e Adega Santa Fé Ltda',
      nome_fantasia: 'Restaurante Santa Fé',
      cnae_principal: '56.11-2-01',
      cnae_descricao: 'Restaurantes e similares',
      logradouro: 'Rua das Araucárias',
      numero: '450',
      bairro: 'Batel',
      cidade: 'Curitiba',
      uf: 'PR',
      cep: '80420-000',
      situacao_cadastral: 'ATIVA',
      ativa: true
    };
  }

  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  // 2. Consulta via BrasilAPI
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': userAgent
      }
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data: any = await response.json();
      const isAtiva = data.descricao_situacao_cadastral === 'ATIVA' || data.situacao_cadastral === 2;

      const result: CNPJLookupResult = {
        success: true,
        cnpj: data.cnpj || cleanCnpj,
        razao_social: data.razao_social || data.nome_empresarial || '',
        nome_fantasia: data.nome_fantasia || data.razao_social || '',
        cnae_principal: data.cnae_fiscal ? String(data.cnae_fiscal) : '',
        cnae_descricao: data.cnae_fiscal_descricao || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.municipio || data.cidade || '',
        municipio: data.municipio || data.cidade || '',
        uf: data.uf || '',
        cep: data.cep || '',
        situacao_cadastral: data.descricao_situacao_cadastral || 'ATIVA',
        ativa: isAtiva
      };

      // Salvar em cache no banco local
      try {
        query.run(`
          INSERT OR IGNORE INTO companies (
            id, cnpj, razao_social, nome_fantasia, segmento,
            cnae_principal, logradouro, numero, bairro, cidade, uf, cep, limite_credito
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          'comp-' + cleanCnpj,
          cleanCnpj,
          result.razao_social,
          result.nome_fantasia,
          'Restaurante / Empresa',
          result.cnae_principal,
          result.logradouro,
          result.numero,
          result.bairro,
          result.cidade,
          result.uf,
          result.cep,
          10000.00
        );
      } catch (dbErr) {}

      return result;
    }
  } catch (err) {
    // Se falhar BrasilAPI, tenta o fallback abaixo
  }

  // 3. Fallback: MinhaReceita API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const fbRes = await fetch(`https://minhareceita.org/${cleanCnpj}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': userAgent
      }
    });

    clearTimeout(timeout);

    if (fbRes.ok) {
      const data: any = await fbRes.json();
      const isAtiva = data.descricao_situacao_cadastral === 'ATIVA' || data.situacao_cadastral === 2;

      const result: CNPJLookupResult = {
        success: true,
        cnpj: data.cnpj || cleanCnpj,
        razao_social: data.razao_social || data.nome_empresarial || '',
        nome_fantasia: data.nome_fantasia || data.razao_social || '',
        cnae_principal: data.cnae_fiscal ? String(data.cnae_fiscal) : '',
        cnae_descricao: data.cnae_fiscal_descricao || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.municipio || data.cidade || '',
        municipio: data.municipio || data.cidade || '',
        uf: data.uf || '',
        cep: data.cep || '',
        situacao_cadastral: data.descricao_situacao_cadastral || 'ATIVA',
        ativa: isAtiva
      };

      try {
        query.run(`
          INSERT OR IGNORE INTO companies (
            id, cnpj, razao_social, nome_fantasia, segmento,
            cnae_principal, logradouro, numero, bairro, cidade, uf, cep, limite_credito
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          'comp-' + cleanCnpj,
          cleanCnpj,
          result.razao_social,
          result.nome_fantasia,
          'Restaurante / Empresa',
          result.cnae_principal,
          result.logradouro,
          result.numero,
          result.bairro,
          result.cidade,
          result.uf,
          result.cep,
          10000.00
        );
      } catch (dbErr) {}

      return result;
    }
  } catch (err2) {}

  return {
    success: false,
    cnpj: rawCnpj,
    message: 'CNPJ não localizado na Receita Federal. Você pode preencher os dados manualmente.'
  };
}
