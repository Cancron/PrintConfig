import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/product.controller.js';
import { ApiError } from '../middleware/errorHandler.js';

export const productRoutes = Router();
const designUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, fieldSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new ApiError(400, 'Only JPG, PNG, and WebP images are allowed.'));
  },
});

productRoutes.get('/', controller.list);
productRoutes.post('/public/:productId/design-upload', designUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'pagePreviews', maxCount: 100 },
]), controller.publicDesignUpload);
productRoutes.get('/public/:productId/design', controller.publicDesign);
productRoutes.get('/public/:id/config', controller.publicConfig);
productRoutes.post('/cart-items/:cartItemId/process', controller.processCartItem);
productRoutes.get('/editor', controller.editorList);
productRoutes.get('/editor/:id/config', controller.editorConfig);
productRoutes.get('/:id', controller.get);
productRoutes.post('/', controller.create);
productRoutes.put('/:id', controller.update);
productRoutes.delete('/:id', controller.remove);
productRoutes.post('/:id/duplicate', controller.duplicate);
productRoutes.get('/:id/export', controller.exportConfig);
productRoutes.post('/import', controller.importConfig);
productRoutes.post('/:id/calculate-price', controller.calculatePrice);
