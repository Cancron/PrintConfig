import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/layout.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listLayoutTemplates({ accountId: String(req.query.accountId), merchantId: String(req.query.merchantId ?? ''), categoryId: String(req.query.categoryId ?? ''), scope: String(req.query.scope ?? ''), status: String(req.query.status ?? ''), templateType: String(req.query.templateType ?? ''), orientation: String(req.query.orientation ?? ''), search: String(req.query.search ?? '') })); } catch (error) { next(error); }
}
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getLayoutTemplate(String(req.params.id))); } catch (error) { next(error); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.createLayoutTemplate(req.body)); } catch (error) { next(error); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json(await service.updateLayoutTemplate(String(req.params.id), req.body)); } catch (error) { next(error); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { res.json(await service.deleteLayoutTemplate(String(req.params.id))); } catch (error) { next(error); } }
export async function duplicate(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.duplicateLayoutTemplate(String(req.params.id))); } catch (error) { next(error); } }
export async function exportConfig(req: Request, res: Response, next: NextFunction) { try { res.json(await service.exportLayoutTemplate(String(req.params.id))); } catch (error) { next(error); } }
export async function importConfig(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.importLayoutTemplate(req.body)); } catch (error) { next(error); } }