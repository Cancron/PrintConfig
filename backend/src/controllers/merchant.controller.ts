import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/merchant.service.js';

export async function list(req: Request, res: Response, next: NextFunction) { try { res.json(await service.listMerchants(String(req.query.accountId))); } catch (e) { next(e); } }
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getMerchant(String(req.params.id))); } catch (e) { next(e); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.createMerchant(req.body)); } catch (e) { next(e); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json(await service.updateMerchant(String(req.params.id), req.body)); } catch (e) { next(e); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { res.json(await service.deleteMerchant(String(req.params.id))); } catch (e) { next(e); } }
