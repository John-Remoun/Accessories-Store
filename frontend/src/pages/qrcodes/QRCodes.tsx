import { useState, useMemo, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { store } from '../../services/store';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Printer, RefreshCw, CheckCircle2, AlertCircle, Laptop, ExternalLink } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreSync } from '../../hooks/useStoreSync';
import { CustomSelect } from '../../components/ui/CustomSelect';
import {
  checkPrinterServiceStatus,
  printBatchLabelsViaAgent,
  openPrintJobInDesktopAgent,
  wakeDesktopAgent,
  BatchLabelItem
} from '../../services/printerService';

export const QRCodes = () => {
  useStoreSync();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialProductId = queryParams.get('product') || 'all';

  const [selectedProduct, setSelectedProduct] = useState<string>(initialProductId);
  const [selectedBranch, setSelectedBranch] = useState<string>(isAdmin ? 'all' : user?.branchId || 'b1');
  const [selectedQRs, setSelectedQRs] = useState<Set<string>>(new Set());

  // Desktop Print Agent Status & Feedback
  const [agentStatus, setAgentStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<{ type: 'success' | 'error'; message: string; showWakePrompt?: boolean } | null>(null);

  const products = store.getProducts();
  const branches = store.getBranches();
  const allPhysicalItems = store.getPhysicalItems();

  // Check agent status on mount and periodically
  const refreshAgentStatus = async () => {
    setAgentStatus('checking');
    const status = await checkPrinterServiceStatus();
    setAgentStatus(status.connected ? 'connected' : 'disconnected');
  };

  useEffect(() => {
    refreshAgentStatus();
    const interval = setInterval(refreshAgentStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = useMemo(() => {
    return allPhysicalItems.filter(item => {
      if (item.status !== 'available') return false;
      if (selectedProduct !== 'all' && item.productId !== selectedProduct) return false;
      if (selectedBranch !== 'all' && item.branchId !== selectedBranch) return false;
      return true;
    });
  }, [allPhysicalItems, selectedProduct, selectedBranch]);

  // Execute silent printing through Desktop Agent Bridge
  const printSelected = async () => {
    const selectedItems = filteredItems.filter(i => selectedQRs.has(i.id));
    if (selectedItems.length === 0) return;

    const batchItems: BatchLabelItem[] = selectedItems.map(item => {
      const product = store.getProduct(item.productId);
      const bd = store.getProductBranchData(item.productId, item.branchId || 'b1');
      const rawPrice4 = bd?.price4 !== undefined && bd?.price4 !== null && bd?.price4 !== 0 
        ? bd.price4 
        : (bd?.price1 || '');
      return {
        id: item.id,
        serial: item.id,
        name: product?.nameAr || 'منتج',
        price: rawPrice4 ? String(rawPrice4) : '',
        storeName: 'Salla',
        copies: 1
      };
    });

    setIsPrinting(true);
    setPrintFeedback(null);

    // If single item selected, open directly in desktop application overlay
    if (batchItems.length === 1) {
      await openPrintJobInDesktopAgent({ product: batchItems[0] });
      setAgentStatus('connected');
      setPrintFeedback({
        type: 'success',
        message: 'تم فتح أمر الطباعة في تطبيق الديسكتوب المكتبي 🖨️'
      });
      setTimeout(() => setPrintFeedback(null), 4000);
      setIsPrinting(false);
      return;
    }

    try {
      const result = await printBatchLabelsViaAgent(batchItems, {
        widthMm: 50,
        heightMm: 25,
        storeName: 'Salla',
        autoWake: true
      });

      if (result.success) {
        setAgentStatus('connected');
        setPrintFeedback({
          type: 'success',
          message: `تم إرسال ${batchItems.length} ملصق فوراً وبصمت إلى طابعة الاستيكرات (${result.printer || 'Xprinter XP-246B'})!`
        });
        setTimeout(() => setPrintFeedback(null), 5000);
      } else {
        setAgentStatus('disconnected');
        setPrintFeedback({
          type: 'error',
          message: result.message,
          showWakePrompt: true
        });
      }
    } catch (err: any) {
      setAgentStatus('disconnected');
      setPrintFeedback({
        type: 'error',
        message: err.message || 'حدث خطأ غير متوقع أثناء إرسال أمر الطباعة',
        showWakePrompt: true
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // Browser Print Fallback (if agent is not installed on cashier machine)
  const handleBrowserFallbackPrint = () => {
    const selectedItems = filteredItems.filter(i => selectedQRs.has(i.id));
    if (selectedItems.length === 0) return;

    const labelPagesHtml = selectedItems.map(item => {
      const product = store.getProduct(item.productId);
      const bd = store.getProductBranchData(item.productId, item.branchId || 'b1');
      const rawPrice4 = bd?.price4 !== undefined && bd?.price4 !== null && bd?.price4 !== 0 
        ? bd.price4 
        : (bd?.price1 || '');
      const price4Val = rawPrice4 !== '' ? String(rawPrice4) : '';
      
      const svgEl = document.querySelector(`#qr-box-${item.id} svg`);
      const qrSvgString = svgEl ? svgEl.outerHTML : '';

      return `
        <div class="ticket-page">
          <div class="ticket-content">
            <div class="qr-section">
              ${qrSvgString}
            </div>
            <div class="info-section">
              <div class="serial-no">${item.id}</div>
              <div class="item-title">${product?.nameAr || 'منتج'}</div>
              <div class="price-tag">${price4Val || '—'} <span class="currency">ج.م</span></div>
            </div>
          </div>
        </div>
      `;
    }).join('\n');

    const printDocumentHtml = `
      <!DOCTYPE html>
      <html lang="ar">
      <head>
        <meta charset="utf-8" />
        <title> </title>
        <style>
          @page {
            size: 50mm 25mm;
            margin: 0 !important;
          }
          * {
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #ffffff !important;
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif !important;
          }
          .ticket-page {
            width: 50mm !important;
            height: 25mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            background-color: #ffffff !important;
          }
          .ticket-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .ticket-content {
            width: 46mm !important;
            height: 22mm !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            overflow: hidden !important;
          }
          .qr-section {
            width: 17mm !important;
            height: 17mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
          }
          .qr-section svg {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
          }
          .info-section {
            width: 27mm !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            direction: rtl !important;
            text-align: right !important;
            overflow: hidden !important;
          }
          .serial-no {
            font-size: 7.5pt !important;
            font-weight: 700 !important;
            direction: ltr !important;
            text-align: right !important;
            font-family: monospace !important;
          }
          .item-title {
            font-size: 7pt !important;
            font-weight: 700 !important;
            line-height: 1.15 !important;
            max-height: 7.5mm !important;
            overflow: hidden !important;
          }
          .price-tag {
            font-size: 9.5pt !important;
            font-weight: 900 !important;
          }
        </style>
      </head>
      <body>
        ${labelPagesHtml}
      </body>
      </html>
    `;

    let iframe = document.getElementById('thermal-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'thermal-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '300px';
      iframe.style.height = '300px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(printDocumentHtml);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 350);
    }
  };

  const toggleSelectAll = () => {
    if (selectedQRs.size === filteredItems.length) {
      setSelectedQRs(new Set());
    } else {
      setSelectedQRs(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedQRs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedQRs(next);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0" dir="rtl">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 print:hidden bg-card p-6 rounded-2xl shadow-sm border border-border">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">إدارة وطباعة استيكرات الـ QR Barcode</h1>
            {/* Agent Status Pill */}
            <div 
              onClick={refreshAgentStatus}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold cursor-pointer border transition-all ${
                agentStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  : agentStatus === 'checking'
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20'
              }`}
              title="حالة اتصال وسيط الطباعة المكتبي على جهاز الكاشير (اضغط للتحديث)"
            >
              <Laptop size={14} />
              <span>
                {agentStatus === 'connected' && 'وسيط الطباعة: متصل 🟢'}
                {agentStatus === 'checking' && 'جاري الفحص...'}
                {agentStatus === 'disconnected' && 'وسيط الطباعة: غير متصل 🔴'}
              </span>
              <RefreshCw size={12} className={agentStatus === 'checking' ? 'animate-spin' : ''} />
            </div>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            طباعة حرارية صامتة وفورية لمقاس (50×25 مم) مباشرة لطابعة Xprinter XP-246B دون نوافذ المتصفح.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={toggleSelectAll} variant="outline" className="rounded-xl text-xs font-bold">
            {selectedQRs.size === filteredItems.length && filteredItems.length > 0 ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
          </Button>

          <Button 
            onClick={printSelected} 
            size="lg" 
            disabled={selectedQRs.size === 0 || isPrinting}
            className="rounded-xl shadow-md gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold"
          >
            <Printer className="h-5 w-5" />
            <span>
              {isPrinting ? 'جاري الإرسال للطابعة...' : `طباعة (${selectedQRs.size}) استيكر`}
            </span>
          </Button>
        </div>
      </div>

      {/* Feedback Banner (Success / Error / Wake Prompt) */}
      {printFeedback && (
        <div 
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm font-semibold transition-all shadow-sm ${
            printFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {printFeedback.type === 'success' ? (
              <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-rose-600" />
            )}
            <span>{printFeedback.message}</span>
          </div>

          {printFeedback.showWakePrompt && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  wakeDesktopAgent();
                  setTimeout(refreshAgentStatus, 1500);
                }}
                className="bg-primary text-primary-foreground rounded-lg text-xs font-bold gap-1 shadow-sm"
              >
                <ExternalLink size={14} />
                <span>فتح وسيط الطباعة المكتبي</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBrowserFallbackPrint}
                className="rounded-lg text-xs font-bold border-rose-300 dark:border-rose-800"
              >
                طباعة عبر المتصفح كبديل
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-col md:flex-row gap-4 print:hidden">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold text-muted-foreground">تصفية حسب المنتج</label>
          <CustomSelect
            value={selectedProduct}
            onChange={(val) => setSelectedProduct(val)}
            options={[
              { value: 'all', label: 'جميع المنتجات' },
              ...products.map(p => ({ value: p.id, label: p.nameAr }))
            ]}
          />
        </div>
        {isAdmin && (
          <div className="w-64 space-y-2">
            <label className="text-xs font-bold text-muted-foreground">تصفية حسب الفرع</label>
            <CustomSelect
              value={selectedBranch}
              onChange={(val) => setSelectedBranch(val)}
              options={[
                { value: 'all', label: 'جميع الفروع' },
                ...branches.map(b => ({ value: b.id, label: b.nameAr }))
              ]}
            />
          </div>
        )}
      </div>

      {/* Grid of QR Items */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredItems.map(item => {
          const product = store.getProduct(item.productId);
          const isSelected = selectedQRs.has(item.id);

          return (
            <Card 
              key={item.id} 
              className={`flex flex-col items-center justify-center p-3 text-center border rounded-2xl cursor-pointer transition-all ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5 border-primary shadow-sm' 
                  : 'hover:border-primary/50 bg-card'
              }`}
              onClick={() => toggleSelect(item.id)}
            >
              <div id={`qr-box-${item.id}`} className="bg-white p-2 rounded-xl mb-2.5 shadow-xs">
                <QRCodeSVG value={item.id} size={92} level="M" />
              </div>
              <p className="text-xs font-bold truncate w-full px-1 text-foreground" title={product?.nameAr}>
                {product?.nameAr || 'منتج'}
              </p>
              <p className="text-[11px] font-mono font-bold mt-1.5 tracking-wider bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
                {item.id}
              </p>
              {(() => {
                const bd = store.getProductBranchData(item.productId, item.branchId || 'b1');
                const rawPrice4 = bd?.price4 !== undefined && bd?.price4 !== null && bd?.price4 !== 0 
                  ? bd.price4 
                  : (bd?.price1 || '');
                return rawPrice4 ? (
                  <p className="font-mono font-black text-xs text-primary mt-1.5">
                    {rawPrice4} <span className="text-[10px] font-normal text-muted-foreground">ج.م</span>
                  </p>
                ) : null;
              })()}
            </Card>
          );
        })}
      </div>
      
      {filteredItems.length === 0 && (
        <div className="text-center py-20 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
          لا توجد قطع متاحة تطابق الفلاتر المحددة.
        </div>
      )}
    </div>
  );
};
