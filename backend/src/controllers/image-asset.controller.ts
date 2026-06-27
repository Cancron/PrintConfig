import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/image-asset.service.js';

export async function list(req: Request, res: Response, next: NextFunction) { try { res.json(await service.listAssets(req.query as Record<string, string | undefined>)); } catch (error) { next(error); } }
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getAsset(String(req.params.id))); } catch (error) { next(error); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.createAsset(req.body)); } catch (error) { next(error); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json(await service.updateAsset(String(req.params.id), req.body)); } catch (error) { next(error); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { res.json(await service.deleteAsset(String(req.params.id))); } catch (error) { next(error); } }
export async function move(req: Request, res: Response, next: NextFunction) { try { res.json(await service.moveAsset(String(req.params.id), req.body?.folderId)); } catch (error) { next(error); } }