import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useWorkspace } from './useWorkspace';
import type { ImageAsset, ImageFolder } from '../types';

export function useImageLibrary(folderId: string | null, search = '') {
  const { account, selectedMerchantId, selectedMerchant } = useWorkspace();
  const [folders, setFolders] = useState<ImageFolder[]>([]);
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [allFolders, setAllFolders] = useState<ImageFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const filters = { accountId: account.id, merchantId: selectedMerchantId, folderId, search };
      const [nextFolders, nextAssets, everyFolder] = await Promise.all([
        api.listImageFolders(filters), api.listImageAssets(filters), api.listAllImageFolders(account.id, selectedMerchantId),
      ]);
      setFolders(nextFolders); setAssets(nextAssets); setAllFolders(everyFolder); setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the image library.');
    } finally { setLoading(false); }
  }, [account.id, folderId, search, selectedMerchantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { account, selectedMerchantId, selectedMerchant, folders, assets, allFolders, loading, error, refresh };
}