'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage, getStyles, type StyleRecord } from '@/lib/api';
import { resolvePreviewUrl, styleConfigs, type StyleConfig } from '@/config/styles';

export interface MergedStyle extends StyleConfig {
  sortOrder: number;
  isServerBacked: boolean;
  serverData?: StyleRecord;
}

export interface UseStylesReturn {
  styles: MergedStyle[];
  categories: string[];
  loading: boolean;
  error: string | null;
  usingFallback: boolean;
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

  const usingFallback = Boolean(error);
  const styles = useMemo<MergedStyle[]>(() => {
    if (usingFallback) {
      return styleConfigs.map((style, index) => ({
        ...style,
        sortOrder: index + 1,
        isServerBacked: false,
      }));
    }
    return serverStyles.map((style) => ({
      id: style.id,
      name: style.name,
      category: style.category,
      description: style.description || '写真模板',
      previewImage: resolvePreviewUrl(style.preview_url, style.category),
      sortOrder: style.sort_order,
      isServerBacked: true,
      serverData: style,
    }));
  }, [serverStyles, usingFallback]);

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

  return { styles, categories, loading, error, usingFallback, retry, getStyleById, getStylesByCategory };
}

export default useStyles;
