import { AccountModel } from '../models/Account.js';
import { MerchantModel } from '../models/Merchant.js';

export const DEMO_ACCOUNT_ID = 'acct-1';
export const DEMO_ACCOUNT_NAME = 'Koda North Demo Account';

export async function ensureDemoAccount() {
  const existing = await AccountModel.findById(DEMO_ACCOUNT_ID);
  if (existing) return existing;
  return AccountModel.create({ _id: DEMO_ACCOUNT_ID, name: DEMO_ACCOUNT_NAME, status: 'active' });
}

export async function seedMerchants(accountId: string) {
  const count = await MerchantModel.countDocuments({ accountId });
  if (count > 0) return;
  await MerchantModel.insertMany([
    { accountId, name: 'Main Canvas Store', slug: 'main-canvas-store', status: 'active', editorPrimaryColor: '#111827', editorSecondaryColor: '#f3f4f6', editorAccentColor: '#2563eb' },
    { accountId, name: 'Gift Shop Site', slug: 'gift-shop-site', status: 'active', editorPrimaryColor: '#14532d', editorSecondaryColor: '#ecfdf5', editorAccentColor: '#f59e0b' },
    { accountId, name: 'Poster Brand Site', slug: 'poster-brand-site', status: 'draft', editorPrimaryColor: '#581c87', editorSecondaryColor: '#faf5ff', editorAccentColor: '#db2777' },
  ]);
}

export async function listMerchants(accountId: string) {
  return MerchantModel.find({ accountId }).sort({ name: 1 });
}

export async function getMerchant(id: string) {
  return MerchantModel.findById(id);
}

export async function createMerchant(data: unknown) {
  return MerchantModel.create(data);
}

export async function updateMerchant(id: string, data: unknown) {
  return MerchantModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

export async function deleteMerchant(id: string) {
  return MerchantModel.findByIdAndDelete(id);
}

