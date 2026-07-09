import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/layout.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listCollages({ accountId: String(req.query.accountId), merchantId: String(req.query.merchantId ?? ''), categoryId: String(req.query.categoryId ?? ''), scope: String(req.query.scope ?? ''), status: String(req.query.status ?? ''), orientation: String(req.query.orientation ?? ''), search: String(req.query.search ?? ''), page: String(req.query.page ?? ''), pageSize: String(req.query.pageSize ?? '') })); } catch (error) { next(error); }
}
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getCollage(String(req.params.id))); } catch (error) { next(error); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.createCollage(req.body)); } catch (error) { next(error); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json(await service.updateCollage(String(req.params.id), req.body)); } catch (error) { next(error); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { res.json(await service.deleteCollage(String(req.params.id))); } catch (error) { next(error); } }
export async function duplicate(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.duplicateCollage(String(req.params.id))); } catch (error) { next(error); } }
export async function exportConfig(req: Request, res: Response, next: NextFunction) { try { res.json(await service.exportCollage(String(req.params.id))); } catch (error) { next(error); } }
export async function importConfig(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.importCollage(req.body)); } catch (error) { next(error); } }
