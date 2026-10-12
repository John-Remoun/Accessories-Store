import React, { useState } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { 
  X, Send, CheckCheck, Phone, Video, MoreVertical, 
  Copy, Check, AlertCircle, Loader2, Sparkles, ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';

export interface WhatsAppReceiptData {
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  cashierName?: string;
  date?: string;
  total: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentMethod?: string;
  items: Array<{
    name: string;
    count: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface WhatsAppReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: WhatsAppReceiptData | null;
  onConfirmSend?: (token: string) => Promise<void>;
  isSending?: boolean;
}

export const WhatsAppReceiptModal: React.FC<WhatsAppReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  onConfirmSend,
  isSending = false
}) => {
  const [copied, setCopied] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<'pending' | 'sending' | 'delivered' | 'failed'>('pending');

  if (!receiptData) return null;

  const formattedPhone = receiptData.customerPhone.startsWith('0') 
    ? `+20 ${receiptData.customerPhone.slice(1)}` 
    : receiptData.customerPhone;

  // Build structured message text
  const messageText = `*متجر Salla Bola & Mina للإكسسوارات*
فاتورة مبيعات مسلسل: #${receiptData.invoiceNumber}
التاريخ: ${receiptData.date ? new Date(receiptData.date).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
اسم العميل: ${receiptData.customerName}
رقم الهاتف: ${receiptData.customerPhone}
الموظف البائع: ${receiptData.cashierName || 'الكاشير'}
-----------------------------------
تفاصيل المشتريات:
${receiptData.items.map(it => `- ${it.name} (عدد ${it.count}) : ${it.totalPrice.toFixed(2)} ج.م`).join('\n')}
-----------------------------------
المجموع الإجمالي: ${receiptData.total.toFixed(2)} ج.م
${receiptData.paidAmount !== undefined ? `المدفوع: ${receiptData.paidAmount.toFixed(2)} ج.م\n` : ''}${receiptData.remainingAmount !== undefined && receiptData.remainingAmount > 0 ? `المتبقي (آجل): ${receiptData.remainingAmount.toFixed(2)} ج.م\n` : ''}طريقة السداد: ${receiptData.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : receiptData.paymentMethod === 'instapay' ? 'إنستاباي' : receiptData.paymentMethod === 'multi' ? 'دفع مقسم (متعدد)' : 'نقداً'}
-----------------------------------
هدفنا إرضاء العميل وليس الربح ❤️
متجر Salla Bola & Mina للإكسسوارات`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    toast.success('تم نسخ نص رسالة الفاتورة');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendAction = async () => {
    if (!onConfirmSend) return;
    try {
      setDeliveryStatus('sending');
      const token = `wa_verify_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await onConfirmSend(token);
      setDeliveryStatus('delivered');
      toast.success('تم تسليم إيصال الواتساب بنجاح وتم تسجيل الفاتورة!');
    } catch (err: any) {
      setDeliveryStatus('failed');
      toast.error(err?.message || 'فشل إرسال إيصال الواتساب. تم إلغاء الفاتورة.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-md w-[95vw] sm:w-full p-0 overflow-hidden rounded-3xl border border-emerald-600/30 shadow-2xl bg-[#0b141a] text-slate-100" 
        dir="rtl"
        showCloseButton={false}
      >
        {/* WHATSAPP APP BAR */}
        <div className="bg-[#1f2c34] px-4 py-3 border-b border-[#2a3942] flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="إغلاق والعودة"
            >
              <X size={18} />
            </button>

            {/* Recipient Avatar */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                {receiptData.customerName.charAt(0) || 'ع'}
              </div>
              <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1f2c34] absolute bottom-0 right-0" />
            </div>

            {/* Recipient Name & Phone */}
            <div className="text-right">
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5 leading-tight">
                <span>{receiptData.customerName}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono">عميل</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono" dir="ltr">
                {formattedPhone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <button type="button" onClick={handleCopy} className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="نسخ نص الإيصال">
              {copied ? <Check size={17} className="text-emerald-400" /> : <Copy size={17} />}
            </button>
          </div>
        </div>

        {/* CHAT CANVAS / WALLPAPER */}
        <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto space-y-3 bg-[#0b141a] bg-radial from-[#121b22] to-[#0b141a]">
          
          {/* Security Notice Pill */}
          <div className="flex justify-center">
            <span className="bg-[#182229] border border-[#222d34] text-[#ffd279] text-[10px] px-3 py-1 rounded-lg text-center shadow-xs">
              🔒 الرسائل والإيصالات مشفرة تماماً بين الطرفين
            </span>
          </div>

          {/* INCOMING RECEIPT MESSAGE BUBBLE */}
          <div className="flex justify-start">
            <div className="max-w-[92%] sm:max-w-[85%] bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-xs shadow-md space-y-2 text-xs leading-relaxed border border-emerald-500/20 font-sans">
              
              {/* Receipt Header Badge */}
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-400/20 text-[11px]">
                <span className="font-bold text-emerald-200 flex items-center gap-1">
                  <ShoppingBag size={13} />
                  <span>متجر Salla Bola & Mina</span>
                </span>
                <span className="font-mono text-emerald-300">#{receiptData.invoiceNumber}</span>
              </div>

              {/* Items List */}
              <div className="space-y-1 py-1">
                <span className="text-[11px] text-emerald-200 font-bold block">محتويات الفاتورة:</span>
                {receiptData.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] bg-emerald-900/40 px-2 py-1 rounded">
                    <span>• {it.name} (عدد {it.count})</span>
                    <span className="font-mono font-bold text-emerald-200">{it.totalPrice.toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>

              {/* Financial Totals */}
              <div className="pt-1.5 border-t border-emerald-400/20 space-y-0.5 text-[11px]">
                <div className="flex justify-between font-bold text-white text-xs">
                  <span>المجموع الإجمالي:</span>
                  <span className="font-mono">{receiptData.total.toFixed(2)} ج.م</span>
                </div>
                {receiptData.paidAmount !== undefined && (
                  <div className="flex justify-between text-emerald-200">
                    <span>المدفوع:</span>
                    <span className="font-mono">{receiptData.paidAmount.toFixed(2)} ج.م</span>
                  </div>
                )}
                {receiptData.remainingAmount !== undefined && receiptData.remainingAmount > 0 && (
                  <div className="flex justify-between text-rose-300 font-bold">
                    <span>المتبقي (آجل):</span>
                    <span className="font-mono">{receiptData.remainingAmount.toFixed(2)} ج.م</span>
                  </div>
                )}
              </div>

              {/* Footer text + Timestamp + Double Checkmarks */}
              <div className="pt-2 flex items-center justify-between text-[10px] text-emerald-300 border-t border-emerald-400/20">
                <span>هدفنا إرضاء العميل وليس الربح ❤️</span>
                <span className="flex items-center gap-1 font-mono">
                  <span>{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCheck size={14} className="text-cyan-300" />
                </span>
              </div>

            </div>
          </div>

          {/* Delivery Status Indicator */}
          {deliveryStatus === 'sending' && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-400 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              <Loader2 size={16} className="animate-spin" />
              <span>جارٍ تسليم إيصال الواتساب إلى العميل والتحقق...</span>
            </div>
          )}

          {deliveryStatus === 'delivered' && (
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
              <CheckCheck size={16} className="text-cyan-400" />
              <span className="font-bold">تم تأكيد وتسليم الإيصال بنجاح عبر واتساب!</span>
            </div>
          )}

          {deliveryStatus === 'failed' && (
            <div className="flex items-center justify-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
              <AlertCircle size={16} />
              <span className="font-bold">فشل الإرسال. تم إلغاء الفاتورة لحماية المخزون.</span>
            </div>
          )}

        </div>

        {/* BOTTOM ACTION BAR (IN-PAGE ZERO TAB NAVIGATION) */}
        <div className="bg-[#1f2c34] p-3.5 border-t border-[#2a3942] flex flex-col sm:flex-row items-center gap-2">
          {deliveryStatus !== 'delivered' ? (
            <Button
              type="button"
              onClick={handleSendAction}
              disabled={isSending || deliveryStatus === 'sending'}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-98"
            >
              {deliveryStatus === 'sending' || isSending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>جارٍ الإرسال والتأكيد...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>تأكيد وإرسال الفاتورة عبر واتساب</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onClose}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <CheckCheck size={18} />
              <span>إغلاق والعودة لنقطة البيع</span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full sm:w-auto h-12 text-slate-300 hover:text-white hover:bg-white/10 rounded-2xl px-4 text-xs font-bold shrink-0"
          >
            إلغاء
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
