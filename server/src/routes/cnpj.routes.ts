import { Router, Request, Response } from 'express';
import { lookupCNPJ } from '../services/cnpj.service.js';

export const cnpjRouter = Router();

cnpjRouter.get('/:cnpj', async (req: Request, res: Response) => {
  const { cnpj } = req.params;

  if (!cnpj) {
    return res.status(400).json({ error: 'CNPJ é obrigatório.' });
  }

  const result = await lookupCNPJ(cnpj);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json({
    ...result,
    company: result
  });
});
