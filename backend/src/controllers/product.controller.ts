import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/product.service.js';

export async function list(req: Request, res: Response, next: NextFunction) { try { res.json(await service.listProducts(req.query as Record<string, string | undefined>)); } catch (e) { next(e); } }
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getProduct(req.params.id)); } catch (e) { next(e); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.createProduct(req.body)); } catch (e) { next(e); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json(await service.updateProduct(req.params.id, req.body)); } catch (e) { next(e); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { res.json(await service.deleteProduct(req.params.id)); } catch (e) { next(e); } }
export async function duplicate(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.duplicateProduct(req.params.id, req.body ?? {})); } catch (e) { next(e); } }
export async function exportConfig(req: Request, res: Response, next: NextFunction) { try { res.json(await service.exportProduct(req.params.id)); } catch (e) { next(e); } }
export async function importConfig(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.importProduct(req.body)); } catch (e) { next(e); } }
export async function calculatePrice(req: Request, res: Response, next: NextFunction) { try { res.json(await service.calculatePrice(req.params.id, req.body.variantId, req.body.selectedOptions ?? {})); } catch (e) { next(e); } }
