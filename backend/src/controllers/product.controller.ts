import type { Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import * as service from "../services/product.service.js";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await service.listProducts(
        req.query as Record<string, string | undefined>,
      ),
    );
  } catch (e) {
    next(e);
  }
}
export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getProduct(String(req.params.id)));
  } catch (e) {
    next(e);
  }
}
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.createProduct(req.body));
  } catch (e) {
    next(e);
  }
}
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.updateProduct(String(req.params.id), req.body));
  } catch (e) {
    next(e);
  }
}
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.deleteProduct(String(req.params.id)));
  } catch (e) {
    next(e);
  }
}
export async function duplicate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res
      .status(201)
      .json(
        await service.duplicateProduct(String(req.params.id), req.body ?? {}),
      );
  } catch (e) {
    next(e);
  }
}
export async function exportConfig(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(await service.exportProduct(String(req.params.id)));
  } catch (e) {
    next(e);
  }
}
export async function importConfig(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.status(201).json(await service.importProduct(req.body));
  } catch (e) {
    next(e);
  }
}
export async function calculatePrice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(
      await service.calculatePrice(
        String(req.params.id),
        req.body.variantId,
        req.body.selectedOptions ?? {},
        req.body.designedPlacementIds ?? req.body.tshirtPlacements ?? [],
      ),
    );
  } catch (e) {
    next(e);
  }
}
export async function listCartItems(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listDesignCartItems(req.query as Record<string, string | undefined>));
  } catch (e) {
    next(e);
  }
}

export async function getCartItem(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    res.json(await service.getDesignCartItem({
      cartItemId: String(req.params.cartItemId),
      accountId: req.user?.accountId,
    }));
  } catch (e) {
    next(e);
  }
}

export async function processCartItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.status(202).json(
      await service.processDesignCartItem({
        cartItemId: String(req.params.cartItemId),
        apiPrivateKey: String(req.header("x-api-key") ?? ""),
        orderId: req.body?.orderId,
        force: req.body?.force,
      }),
    );
  } catch (e) {
    next(e);
  }
}
export async function processCartItemAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    res.status(202).json(
      await service.processDesignCartItemForAdmin({
        cartItemId: String(req.params.cartItemId),
        accountId: req.user?.accountId,
        orderId: req.body?.orderId,
        force: req.body?.force,
      }),
    );
  } catch (e) {
    next(e);
  }
}

export async function markCartItemOrderedAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    res.status(202).json(
      await service.markDesignCartItemOrderedForAdmin({
        cartItemId: String(req.params.cartItemId),
        accountId: req.user?.accountId,
        orderId: req.body?.orderId,
        force: req.body?.force,
      }),
    );
  } catch (e) {
    next(e);
  }
}

export async function createFinalPrintsDownloadToken(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(
      await service.createFinalPrintsDownloadToken({
        cartItemId: String(req.params.cartItemId),
        accountId: req.user?.accountId,
        userId: req.user?._id,
        origin: `${String(req.get("x-forwarded-proto") ?? req.protocol).split(",")[0]}://${req.get("host")}`,
      }),
    );
  } catch (e) {
    next(e);
  }
}

export async function downloadFinalPrintsZip(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await service.streamFinalPrintsZip({
      cartItemId: String(req.params.cartItemId),
      downloadToken: String(req.query.downloadToken ?? ""),
      response: res,
    });
  } catch (e) {
    next(e);
  }
}
export async function publicDesignUpload(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = await service.verifyPublicDesignToken({
      authorization: req.header("authorization"),
      routeProductId: String(req.params.productId),
    });
    res
      .status(201)
      .json(
        await service.savePublicDesignUpload({
          productId: token.productId,
          merchantId: token.merchantId,
          userKey: token.userKey,
          projectId: req.body.projectId,
          productType: req.body.productType,
          designData: req.body.designData ?? req.body.design,
          file: getUploadedFile(req.files, 'image'),
          pagePreviewFiles: getUploadedFiles(req.files, 'pagePreviews'),
          pagePreviewMeta: req.body.pagePreviewMeta,
          addToCart: req.body.addToCart,
          origin: `${req.protocol}://${req.get("host")}`,
        }),
      );
  } catch (e) {
    next(e);
  }
}

function getUploadedFile(files: Request['files'], fieldName: string) {
  return getUploadedFiles(files, fieldName)[0];
}

function getUploadedFiles(files: Request['files'], fieldName: string) {
  if (!files || Array.isArray(files)) return [];
  return files[fieldName] ?? [];
}
export async function publicDesign(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = await service.verifyPublicDesignToken({
      authorization: req.header("authorization"),
      routeProductId: String(req.params.productId),
    });
    res.json(
      await service.getPublicDesignWithProduct({
        productId: token.productId,
        merchantId: token.merchantId,
        userKey: token.userKey,
        projectId: req.query.projectId,
      }),
    );
  } catch (e) {
    next(e);
  }
}

export async function publicFinalPrint(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.status(202).json(
      await service.processPublicDesignFinalPrint({
        productId: String(req.params.productId),
        apiPrivateKey: String(req.header("x-api-key") ?? ""),
        cartItemId: req.body?.cartItemId,
        projectId: req.body?.projectId,
        force: req.body?.force,
      }),
    );
  } catch (e) {
    next(e);
  }
}

export async function publicConfig(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(
      await service.getPublicProductConfig(
        String(req.params.id),
        typeof req.query.merchantId === "string"
          ? req.query.merchantId
          : undefined,
      ),
    );
  } catch (e) {
    next(e);
  }
}
export async function editorConfig(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(
      await service.getEditorProductConfig(
        String(req.params.id),
        String(req.header("x-api-key") ?? ""),
      ),
    );
  } catch (e) {
    next(e);
  }
}
export async function editorList(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(
      await service.listEditorProducts(String(req.header("x-api-key") ?? "")),
    );
  } catch (e) {
    next(e);
  }
}
