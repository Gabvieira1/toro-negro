import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipStore = new Map<string, RateLimitRecord>();

// Limpa registros antigos periodicamente a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipStore.entries()) {
    if (now > record.resetTime) {
      ipStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function createRateLimiter(options: { windowMs: number; max: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Obter IP do cliente
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    const record = ipStore.get(key);

    if (!record || now > record.resetTime) {
      ipStore.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      });
      return next();
    }

    record.count++;

    if (record.count > options.max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: options.message,
        retryAfterSeconds
      });
    }

    next();
  };
}

// Limiter para login: máximo 15 tentativas a cada 1 minuto por IP
export const authLoginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Muitas tentativas de login corporativo. Por motivos de segurança, aguarde 1 minuto para tentar novamente.'
});

// Limiter para consulta de CNPJ: máximo 40 consultas por minuto por IP
export const cnpjLookupLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Limite de consultas de CNPJ atingido. Aguarde alguns instantes.'
});
