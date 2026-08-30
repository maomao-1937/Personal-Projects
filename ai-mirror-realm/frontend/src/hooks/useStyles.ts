'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import {
  styleConfigs,
  styleByCategory,
  styleById,
  styleCategories,
  styleColors,
  type StyleConfig,
} from '@/config/styles';

/**
 * 服务端返回的风格数据结构
 */
export interface ServerStyle {
  id: string;
  name: string;
  category: string;
  description?: string;
  prompt_template?: string;
  [key: string]: any;
}

/**
 * 合并了本地配置和服务端数据的风格对象
 */
export interface MergedStyle extends StyleConfig {
  /** 服务端的原始数据 */
  serverData?: ServerStyle;
}

export interface UseStylesOptions {
  /** 是否从服务端获取风格列表 */
  fetchFromServer?: boolean;
}

export interface UseStylesReturn {
  /** 风格列表（合并了本地配置和服务端数据） */
  styles: MergedStyle[];
  /** 分类列表 */
  categories: string[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 根据 ID 获取风格 */
  getStyleById: (id: string) => MergedStyle | undefined;
  /** 根据分类获取风格 */
  getStylesByCategory: (category: string) => MergedStyle[];
  /** 获取风格的渐变类名 */
  getGradient: (category: string) => string;
  /** 本地风格配置（静态数据） */
  localConfigs: StyleConfig[];
}

/**
 * useStyles - 风格数据获取 Hook
 *
 * 封装了风格数据的获取和合并逻辑：
 * - 本地静态配置作为兜底（颜色、渐变等）
 * - 可从服务端获取动态风格列表
 * - 自动合并本地配置与服务端数据
 *
 * @param options - 配置选项
 * @returns 风格数据和操作方法
 */
export function useStyles(options: UseStylesOptions = {}): UseStylesReturn {
  const { fetchFromServer = true } = options;

  const [serverStyles, setServerStyles] = useState<ServerStyle[]>([]);
  const [loading, setLoading] = useState(fetchFromServer);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fetchFromServer) return;

    let cancelled = false;

    const fetchStyles = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/styles');
        if (!cancelled) {
          setServerStyles(res.data || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.detail || '获取风格列表失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStyles();

    return () => {
      cancelled = true;
    };
  }, [fetchFromServer]);

  // 合并本地配置和服务端数据
  const styles = useMemo<MergedStyle[]>(() => {
    if (serverStyles.length === 0) {
      // 没有服务端数据时，返回本地配置
      return styleConfigs as MergedStyle[];
    }

    // 以服务端数据为主，合并本地颜色配置
    return serverStyles.map((serverStyle) => {
      const localConfig = styleByCategory[serverStyle.category] || styleById[serverStyle.id];

      return {
        id: serverStyle.id,
        name: serverStyle.name,
        category: serverStyle.category,
        primaryColor: localConfig?.primaryColor || '#6366f1',
        secondaryColor: localConfig?.secondaryColor || '#4f46e5',
        bgColor: localConfig?.bgColor || '#1a1a26',
        textColor: localConfig?.textColor || '#e8e8f0',
        gradient: localConfig?.gradient || 'from-accent/20 to-bg-tertiary',
        previewImage: localConfig?.previewImage || serverStyle.preview_image || '',
        description: serverStyle.description || localConfig?.description,
        prompt_template: serverStyle.prompt_template || localConfig?.prompt_template,
        serverData: serverStyle,
      };
    });
  }, [serverStyles]);

  // 分类列表
  const categories = useMemo(() => {
    if (serverStyles.length > 0) {
      return Array.from(new Set(serverStyles.map((s) => s.category)));
    }
    return styleCategories;
  }, [serverStyles]);

  // 根据 ID 获取风格
  const getStyleById = (id: string): MergedStyle | undefined => {
    return styles.find((s) => s.id === id);
  };

  // 根据分类获取风格
  const getStylesByCategory = (category: string): MergedStyle[] => {
    return styles.filter((s) => s.category === category);
  };

  // 获取风格的渐变类名
  const getGradient = (category: string): string => {
    return styleColors[category] || 'from-accent/20 to-bg-tertiary';
  };

  return {
    styles,
    categories,
    loading,
    error,
    getStyleById,
    getStylesByCategory,
    getGradient,
    localConfigs: styleConfigs,
  };
}

export default useStyles;
