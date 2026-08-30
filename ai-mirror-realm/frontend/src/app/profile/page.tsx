'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/stores/auth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Coins, Clock, Loader2, Trash2, Plus, CreditCard, CheckCircle } from 'lucide-react';
import api, { getOrders, type Order } from '@/lib/api';

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 1);
}

function ProfilePageContent() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [portraits, setPortraits] = useState<any[]>([]);
  const [loadingPortraits, setLoadingPortraits] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (user) {
      api.get('/portraits').then((res) => {
        setPortraits(res.data);
      }).finally(() => setLoadingPortraits(false));

      getOrders().then((data) => {
        setOrders(data);
      }).catch(() => {}).finally(() => setLoadingOrders(false));
    }
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这张写真吗？')) return;
    try {
      await api.delete(`/portraits/${id}`);
      setPortraits(portraits.filter((p) => p.id !== id));
    } catch {
      alert('删除失败');
    }
  };

  const statusText: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    failed: '支付失败',
    refunded: '已退款',
  };

  const statusColor: Record<string, string> = {
    pending: 'text-amber-400',
    paid: 'text-green-400',
    failed: 'text-red-400',
    refunded: 'text-text-dim',
  };

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-8 mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {user?.nickname?.charAt(0) ?? ''}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold">{user?.nickname}</h1>
                <p className="text-sm text-text-dim">{user?.email || user?.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-glow border border-accent/30">
                <Coins size={18} className="text-gold" />
                <div>
                  <div className="text-lg font-bold text-gold">{user?.credits ?? 0}</div>
                  <div className="text-xs text-text-dim">剩余积分</div>
                </div>
              </div>
              <button
                onClick={() => router.push('/recharge')}
                className="px-4 py-2 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                充值
              </button>
              <button
                onClick={() => router.push('/upload')}
                className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Plus size={16} />
                创建写真
              </button>
            </div>
          </div>
        </motion.div>

        {/* Portrait History */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold">我的写真</h2>
          <span className="text-sm text-text-dim">{portraits.length} 张</span>
        </div>

        {loadingPortraits ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl shimmer-bg" />
            ))}
          </div>
        ) : portraits.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 mb-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-bg-secondary flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={28} className="text-text-dim" />
            </div>
            <p className="text-text-dim mb-4">还没有写真作品</p>
            <button
              onClick={() => router.push('/upload')}
              className="text-accent-light hover:text-accent transition-colors text-sm"
            >
              创建第一张 →
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {portraits.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden glass"
              >
                {p.status === 'completed' && p.result_url ? (
                  <Image
                    src={p.result_url}
                    alt={`写真 ${p.id}`}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 256px"
                    quality={80}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    {p.status === 'processing' || p.status === 'pending' ? (
                      <>
                        <Loader2 size={20} className="animate-spin text-accent" />
                        <span className="text-xs text-text-dim">生成中…</span>
                      </>
                    ) : (
                      <span className="text-xs text-red-400">生成失败</span>
                    )}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-white/80">
                      <Clock size={12} />
                      {new Date(p.created_at).toLocaleDateString('zh-CN')}
                    </div>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg bg-black/50 hover:bg-red-500/50 transition-colors"
                    >
                      <Trash2 size={12} className="text-white" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Order History */}
        <div className="mb-6 flex items-center justify-between mt-8">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard size={18} className="text-accent-light" />
            充值记录
          </h2>
          <button
            onClick={() => router.push('/recharge')}
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            去充值 →
          </button>
        </div>

        {loadingOrders ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl shimmer-bg" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 glass rounded-2xl"
          >
            <div className="w-12 h-12 rounded-xl bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
              <CreditCard size={22} className="text-text-dim" />
            </div>
            <p className="text-text-dim text-sm mb-3">暂无充值记录</p>
            <button
              onClick={() => router.push('/recharge')}
              className="text-accent-light hover:text-accent transition-colors text-sm"
            >
              首次充值享优惠 →
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    order.status === 'paid' ? 'bg-green-500/20' : 'bg-bg-tertiary'
                  }`}>
                    {order.status === 'paid' ? (
                      <CheckCircle size={18} className="text-green-400" />
                    ) : (
                      <CreditCard size={18} className="text-text-dim" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {order.credits} 积分
                    </div>
                    <div className="text-xs text-text-dim">
                      {new Date(order.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    ¥{formatPrice(order.amount)}
                  </div>
                  <div className={`text-xs ${statusColor[order.status] || 'text-text-dim'}`}>
                    {statusText[order.status] || order.status}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}
