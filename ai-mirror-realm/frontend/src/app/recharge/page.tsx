'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Coins,
  Sparkles,
  Check,
  CreditCard,
  ArrowRight,
  Crown,
} from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useToast } from '@/contexts/ToastContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getPackages, createOrder, confirmPayment, type Package, type Order } from '@/lib/api';

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 1);
}

function RechargePageContent() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    getPackages()
      .then((data) => setPackages(data))
      .catch(() => showToast('error', '加载套餐失败，请稍后重试'))
      .finally(() => setLoadingPackages(false));
  }, [showToast]);

  const handleSelectPackage = (pkg: Package) => {
    setSelectedPackage(pkg);
    setConfirmModalOpen(true);
    setCurrentOrder(null);
    setPaymentSuccess(false);
  };

  const handleConfirmOrder = async () => {
    if (!selectedPackage) return;
    setCreatingOrder(true);
    try {
      const order = await createOrder(selectedPackage.id);
      setCurrentOrder(order);
    } catch (err: any) {
      const msg = err.response?.data?.detail || '创建订单失败';
      showToast('error', msg);
    } finally {
      setCreatingOrder(false);
    }
  };

  const handlePay = async () => {
    if (!currentOrder) return;
    setPaying(true);
    try {
      const order = await confirmPayment(currentOrder.id);
      setCurrentOrder(order);
      setPaymentSuccess(true);
      showToast('success', `支付成功！已到账 ${order.credits} 积分`);
      await refreshUser();
    } catch (err: any) {
      const msg = err.response?.data?.detail || '支付失败，请稍后重试';
      showToast('error', msg);
    } finally {
      setPaying(false);
    }
  };

  const handleCloseModal = () => {
    setConfirmModalOpen(false);
    setCurrentOrder(null);
    setPaymentSuccess(false);
  };

  const handleGoToStyles = () => {
    handleCloseModal();
    router.push('/styles');
  };

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl font-bold mb-3 gradient-text">积分充值</h1>
          <p className="text-text-dim">选择合适的套餐，开启你的 AI 写真之旅</p>
        </motion.div>

        {/* 当前积分余额 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-3xl p-6 mb-10"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center">
                <Coins size={26} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-text-dim mb-1">当前积分余额</p>
                <p className="text-3xl font-bold text-gold">{user?.credits ?? 0}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-dim mb-1">积分有效期</p>
              <p className="text-sm text-text-primary">永久有效</p>
            </div>
          </div>
        </motion.div>

        {/* 套餐列表 */}
        {loadingPackages ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.1 }}
              >
                <Card
                  className={`relative cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-glow-lg ${
                    pkg.recommended
                      ? 'border-accent ring-2 ring-accent/30 shadow-glow'
                      : 'hover:border-accent/50'
                  }`}
                  onClick={() => handleSelectPackage(pkg)}
                >
                  {/* 推荐标签 */}
                  {pkg.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-accent to-accent-dark text-white text-xs font-medium flex items-center gap-1 shadow-lg">
                      <Crown size={12} />
                      推荐
                    </div>
                  )}

                  <div className="p-6 text-center pt-8">
                    {/* 套餐名称 */}
                    <h3 className="text-lg font-semibold mb-4">{pkg.name}</h3>

                    {/* 积分数 */}
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-gold">{pkg.credits}</span>
                      <span className="text-text-dim ml-1">积分</span>
                    </div>

                    {/* 价格 */}
                    <div className="mb-6">
                      <span className="text-3xl font-bold text-text-primary">
                        ¥{formatPrice(pkg.price)}
                      </span>
                      {pkg.discount_text && (
                        <>
                          <span className="text-sm text-text-muted line-through ml-2">
                            ¥{formatPrice(pkg.original_price)}
                          </span>
                          <div className="mt-1">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-gold/20 text-gold text-xs font-medium">
                              {pkg.discount_text}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 选择按钮 */}
                    <Button
                      variant={pkg.recommended ? 'primary' : 'outline'}
                      fullWidth
                      leftIcon={<Sparkles size={16} />}
                    >
                      立即充值
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* 说明 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center text-xs text-text-muted"
        >
          <p>积分可用于生成 AI 写真，每次生成消耗 1 积分</p>
          <p className="mt-1">如有疑问请联系客服</p>
        </motion.div>
      </div>

      {/* 确认订单 Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={handleCloseModal}
        title={paymentSuccess ? '支付成功' : '确认订单'}
        size="sm"
        closeOnOverlayClick={!paying && !creatingOrder}
        closeOnEsc={!paying && !creatingOrder}
        footer={
          !paymentSuccess &&
          !currentOrder && (
            <>
              <Button
                variant="ghost"
                onClick={handleCloseModal}
                disabled={creatingOrder}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmOrder}
                loading={creatingOrder}
                leftIcon={<CreditCard size={16} />}
              >
                确认下单
              </Button>
            </>
          )
        }
      >
        {paymentSuccess ? (
          <div className="text-center py-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-5"
            >
              <Check size={40} className="text-green-400" />
            </motion.div>
            <h3 className="text-xl font-bold mb-2">支付成功</h3>
            <p className="text-text-dim mb-6">
              <span className="text-gold font-semibold">{selectedPackage?.credits}</span>{' '}
              积分已到账
            </p>
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={handleCloseModal}>
                继续充值
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleGoToStyles}
                rightIcon={<ArrowRight size={16} />}
              >
                去使用
              </Button>
            </div>
          </div>
        ) : currentOrder ? (
          <div className="py-2">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">套餐</span>
                <span className="font-medium">{selectedPackage?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">积分</span>
                <span className="font-medium text-gold">
                  {selectedPackage?.credits} 积分
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">订单号</span>
                <span className="font-mono text-xs text-text-dim">
                  {currentOrder.id.slice(0, 8)}...
                </span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-text-dim">应付金额</span>
                <span className="text-xl font-bold text-accent-light">
                  ¥{selectedPackage ? formatPrice(selectedPackage.price) : '0'}
                </span>
              </div>
            </div>

            <div className="glass rounded-xl p-4 mb-6">
              <p className="text-xs text-text-dim mb-2 text-center">模拟支付演示</p>
              <p className="text-xs text-text-muted text-center">
                当前为演示模式，点击下方按钮模拟支付成功
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={paying}
              onClick={handlePay}
              leftIcon={<CreditCard size={18} />}
            >
              模拟支付
            </Button>
          </div>
        ) : (
          <div className="py-2">
            {selectedPackage && (
              <>
                <p className="text-text-dim mb-4">确认购买以下套餐？</p>
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedPackage.name}</p>
                      <p className="text-sm text-gold">
                        {selectedPackage.credits} 积分
                      </p>
                    </div>
                    <p className="text-xl font-bold text-accent-light">
                      ¥{formatPrice(selectedPackage.price)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function RechargePage() {
  return (
    <ProtectedRoute>
      <RechargePageContent />
    </ProtectedRoute>
  );
}
