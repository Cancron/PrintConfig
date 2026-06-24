import type { EditorRules, Product } from '../types';

const STORAGE_KEY = 'print-config-products';

export const defaultEditorRules: EditorRules = {
  allowImageUpload: true,
  allowAddText: true,
  allowClipart: false,
  allowBackgroundColor: true,
  allowBackgroundImage: false,
  allowCrop: true,
  allowRotate: true,
  allowDeleteObjects: true,
  allowLayersPanel: true,
  maxImageCount: 10,
  maxTextCount: 20,
  minimumDpiWarning: 150,
  minimumDpiBlock: 72,
  requirePlaceholdersFilled: true,
};

export function createDefaultEditorRules(): EditorRules {
  return { ...defaultEditorRules };
}

export function normalizeProduct(product: Product): Product {
  return {
    ...product,
    editorRules: {
      ...defaultEditorRules,
      ...(product.editorRules ?? {}),
    },
  };
}

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const products = JSON.parse(raw) as Product[];
      return products.map(normalizeProduct);
    }
  } catch {
    // ignore
  }
  return seedProducts();
}

export function saveProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products.map(normalizeProduct)));
}

function seedProducts(): Product[] {
  const now = new Date().toISOString();

  const products: Product[] = [
    {
      id: 'p1',
      merchantId: 'm1',
      name: 'Canvas Print',
      slug: 'canvas-print',
      description: 'Premium gallery-wrapped canvas prints with vibrant colors and archival-quality inks.',
      productType: 'Canvas Print',
      status: 'Active',
      basePrice: 49.99,
      thumbnailUrl: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=400',
      editorRules: createDefaultEditorRules(),
      createdAt: now,
      updatedAt: now,
      variants: [
        {
          id: 'v1',
          productId: 'p1',
          name: 'Small Portrait',
          sku: 'CP-S-P',
          price: 49.99,
          status: 'Active',
          options: { size: '8x10', orientation: 'portrait', material: 'cotton canvas' },
          surfaces: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'v2',
          productId: 'p1',
          name: 'Medium Landscape',
          sku: 'CP-M-L',
          price: 79.99,
          status: 'Active',
          options: { size: '16x20', orientation: 'landscape', material: 'poly-cotton blend' },
          surfaces: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'v3',
          productId: 'p1',
          name: 'Large Square',
          sku: 'CP-L-SQ',
          price: 129.99,
          status: 'Draft',
          options: { size: '24x24', orientation: 'square', material: 'cotton canvas' },
          surfaces: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    {
      id: 'p2',
      merchantId: 'm1',
      name: 'Poster Print',
      slug: 'poster-print',
      description: 'High-quality poster prints on premium photo paper with a satin finish.',
      productType: 'Poster Print',
      status: 'Active',
      basePrice: 19.99,
      thumbnailUrl: 'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=400',
      editorRules: createDefaultEditorRules(),
      createdAt: now,
      updatedAt: now,
      variants: [
        {
          id: 'v4',
          productId: 'p2',
          name: 'Standard',
          sku: 'PP-STD',
          price: 19.99,
          status: 'Active',
          options: { size: '18x24', paper: 'matte' },
          surfaces: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'v5',
          productId: 'p2',
          name: 'Large Glossy',
          sku: 'PP-LG-GL',
          price: 34.99,
          status: 'Active',
          options: { size: '24x36', paper: 'glossy' },
          surfaces: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    {
      id: 'p3',
      merchantId: 'm1',
      name: 'T-Shirt',
      slug: 't-shirt',
      description: 'Soft, durable cotton t-shirts perfect for custom designs and prints.',
      productType: 'T-Shirt',
      status: 'Draft',
      basePrice: 24.99,
      thumbnailUrl: 'https://images.pexels.com/photos/991509/pexels-photo-991509.jpeg?auto=compress&cs=tinysrgb&w=400',
      editorRules: createDefaultEditorRules(),
      createdAt: now,
      updatedAt: now,
      variants: [
        {
          id: 'v6',
          productId: 'p3',
          name: 'Small Black',
          sku: 'TS-S-BLK',
          price: 24.99,
          status: 'Draft',
          options: { size: 'S', color: 'black', material: '100% cotton' },
          surfaces: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'v7',
          productId: 'p3',
          name: 'Medium White',
          sku: 'TS-M-WHT',
          price: 24.99,
          status: 'Draft',
          options: { size: 'M', color: 'white', material: '100% cotton' },
          surfaces: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'v8',
          productId: 'p3',
          name: 'Large Heather',
          sku: 'TS-L-HTH',
          price: 26.99,
          status: 'Draft',
          options: { size: 'L', color: 'heather grey', material: 'cotton/poly blend' },
          surfaces: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  ];

  saveProducts(products);
  return products;
}
