import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/layout.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listLayoutCategories({ accountId: String(req.query.accountId), merchantId: String(req.query.merchantId ?? ''), scope: String(req.query.scope ?? ''), status: String(req.query.status ?? ''), search: String(req.query.search ?? '') })); } catch (error) { next(error); }
}
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getLayoutCategory(String(req.params.id))); } catch (error) { next(error); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.createLayoutCategory(req.body)); } catch (error) { next(error); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json(await service.updateLayoutCategory(String(req.params.id), req.body)); } catch (error) { next(error); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { res.json(await service.deleteLayoutCategory(String(req.params.id))); } catch (error) { next(error); } }
export async function duplicate(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.duplicateLayoutCategory(String(req.params.id), req.body?.includeTemplates === true)); } catch (error) { next(error); } }
export async function exportConfig(req: Request, res: Response, next: NextFunction) { try { res.json(await service.exportLayoutCategory(String(req.params.id), req.query.includeTemplates === 'true')); } catch (error) { next(error); } }
export async function importConfig(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.importLayoutCategory(req.body)); } catch (error) { next(error); } }