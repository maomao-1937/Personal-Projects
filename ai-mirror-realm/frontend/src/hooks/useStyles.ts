'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage, getStyles, type StyleRecord } from '@/lib/api';

export interface MergedStyle {
  id: string;
  name: string;
  category: string;
  previewImage: string;
  description: string;
  sortOrder: number;
  isServerBacked: boolean;
  serverData?: StyleRecord;
}

export interface UseStylesReturn {
  styles: MergedStyle[];
  categories: string[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  getStyleById: (id: string) => MergedStyle | undefined;
  getStylesByCategory: (category: string) => MergedStyle[];
}

export function useStyles(): UseStylesReturn {
  const [serverStyles, setServerStyles] = useState<StyleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getStyles()
      .then((data) => {
        if (active) setServerStyles([...data].sort((a, b) => a.sort_order - b.sort_order));
      })
      .catch((reason) => {
        if (active) setError(getErrorMessage(reason, '模板暂时无法加载'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestKey]);

  const styles = useMemo<MergedStyle[]>(() =>
    serverStyles.map((style) => ({
      id: style.id,
      name: style.name,
      category: style.category,
      description: style.description || '写真模板',
      previewImage: style.preview_url || '',
      sortOrder: style.sort_order,
      isServerBacked: true,
      serverData: style,
    })), [serverStyles]);

  const categories = useMemo(
    () => Array.from(new Set(styles.map((style) => style.category))),
    [styles]
  );

  const retry = useCallback(() => setRequestKey((key) => key + 1), []);
  const getStyleById = useCallback((id: string) => styles.find((style) => style.id === id), [styles]);
  const getStylesByCategory = useCallback(
    (category: string) => styles.filter((style) => style.category === category),
    [styles]
  );

  return { styles, categories, loading, error, retry, getStyleById, getStylesByCategory };
}

export default useStyles;
