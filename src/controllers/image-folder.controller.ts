import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/image-folder.service.js';

export async function list(req: Request, res: Response, next: NextFunction) { try { res.json(await service.listFolders(req.query as Record<string, string | undefined>)); } catch (error) { next(error); } }
export async function listAll(req: Request, res: Response, next: NextFunction) { try { res.json(await service.listAllFolders(req.query as Record<string, string | undefined>)); } catch (error) { next(error); } }
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getFolder(String(req.params.id))); } catch (error) { next(error); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.createFolder(req.body)); } catch (error) { next(error); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json(await service.updateFolder(String(req.params.id), req.body)); } catch (error) { next(error); } }
export async function remove(req: Request, res: Response, next: NextFunction) { try { res.json(await service.deleteFolder(String(req.params.id))); } catch (error) { next(error); } }