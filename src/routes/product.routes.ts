import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/product.controller.js';
import { ApiError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';

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

// Public endpoints (no auth)
productRoutes.get('/', controller.list);
productRoutes.post('/public/:productId/design-upload', designUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'pagePreviews', maxCount: 100 },
]), controller.publicDesignUpload);
productRoutes.get('/public/:productId/design', controller.publicDesign);
productRoutes.post('/public/:productId/final-print', controller.publicFinalPrint);
productRoutes.get('/public/:id/config', controller.publicConfig);
productRoutes.get('/cart-items', controller.listCartItems);
productRoutes.get('/cart-items/:cartItemId', requireAuth, controller.getCartItem);
productRoutes.post('/cart-items/:cartItemId/process', controller.processCartItem);
productRoutes.post('/cart-items/:cartItemId/process-admin', requireAuth, controller.processCartItemAdmin);
productRoutes.post('/cart-items/:cartItemId/mark-ordered', requireAuth, controller.markCartItemOrderedAdmin);
productRoutes.post('/cart-items/:cartItemId/final-prints-download-token', requireAuth, controller.createFinalPrintsDownloadToken);
productRoutes.get('/cart-items/:cartItemId/final-prints.zip', controller.downloadFinalPrintsZip);
productRoutes.get('/editor', controller.editorList);
productRoutes.get('/editor/:id/config', controller.editorConfig);

// Admin endpoints (JWT protected)
productRoutes.get('/', requireAuth, controller.list);
productRoutes.get('/:id', requireAuth, controller.get);
productRoutes.post('/', requireAuth, controller.create);
productRoutes.put('/:id', requireAuth, controller.update);
productRoutes.delete('/:id', requireAuth, controller.remove);
productRoutes.post('/:id/duplicate', requireAuth, controller.duplicate);
productRoutes.get('/:id/export', requireAuth, controller.exportConfig);
productRoutes.post('/import', requireAuth, controller.importConfig);
productRoutes.post('/:id/calculate-price', requireAuth, controller.calculatePrice);
