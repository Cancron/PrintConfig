import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/category.service.js';

export async function list(req: Request, res: Response, next: NextFunction) { try { res.json(await service.listCategories({ accountId: String(req.query.accountId), merchantId: String(req.query.merchantId ?? '') })); } catch (e) { next(e); } }
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getCategory(String(req.params.id))); } catch (e) { next(e); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.createCategory(req.body)); } catch (e) { next(e); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json(await service.updateCategory(String(req.params.id), req.body)); } catch (e) { next(e); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { res.json(await service.deleteCategory(String(req.params.id))); } catch (e) { next(e); } }
export async function duplicate(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.duplicateCategory(String(req.params.id), req.body?.includeProducts === true)); } catch (e) { next(e); } }
