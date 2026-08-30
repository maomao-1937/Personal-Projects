import axios from 'axios';

export const UNAUTHORIZED_EVENT = 'api:unauthorized';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Dispatch custom event so AuthProvider can sync state and redirect
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(error);
  }
);

// ==================== 订单相关 API ====================

export interface Package {
  id: string;
  name: string;
  credits: number;
  price: number; // 单位：分
  original_price: number;
  discount_text: string | null;
  recommended: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  amount: number; // 单位：分
  credits: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: string | null;
  transaction_id: string | null;
  created_at: string;
  paid_at: string | null;
}

/** 获取充值套餐列表 */
export function getPackages(): Promise<Package[]> {
  return api.get('/orders/packages').then((res) => res.data);
}

/** 创建订单 */
export function createOrder(packageId: string): Promise<Order> {
  return api.post('/orders', { package_id: packageId }).then((res) => res.data);
}

/** 确认支付（模拟） */
export function confirmPayment(orderId: string, paymentMethod = 'simulated'): Promise<Order> {
  return api
    .post(`/orders/${orderId}/pay`, { payment_method: paymentMethod })
    .then((res) => res.data);
}

/** 获取当前用户订单列表 */
export function getOrders(): Promise<Order[]> {
  return api.get('/orders').then((res) => res.data);
}

export default api;
