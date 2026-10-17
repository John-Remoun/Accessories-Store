import { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { store } from '../../services/store';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Printer, Filter } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreSync } from '../../hooks/useStoreSync';
import { CustomSelect } from '../../components/ui/CustomSelect';

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

  const products = store.getProducts();
  const branches = store.getBranches();
  const allPhysicalItems = store.getPhysicalItems();

  const filteredItems = useMemo(() => {
    return allPhysicalItems.filter(item => {
      if (item.status !== 'available') return false;
      if (selectedProduct !== 'all' && item.productId !== selectedProduct) return false;
      if (selectedBranch !== 'all' && item.branchId !== selectedBranch) return false;
      return true;
    });
  }, [allPhysicalItems, selectedProduct, selectedBranch]);

  const printSelected = () => {
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
        <div class="thermal-label-page">
          <div class="qr-box">
            ${qrSvgString}
          </div>
          <div class="prod-name">${product?.nameAr || 'منتج'}</div>
          <div class="prod-sku">${item.id}</div>
          ${price4Val ? `<div class="prod-price">${price4Val}</div>` : ''}
        </div>
      `;
    }).join('\n');

    const printDocumentHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title> </title>
        <style>
          @page {
            size: 25mm 50mm;
            margin: 0mm !important;
            @top-left { content: none !important; }
            @top-center { content: none !important; }
            @top-right { content: none !important; }
            @bottom-left { content: none !important; }
            @bottom-center { content: none !important; }
            @bottom-right { content: none !important; }
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: 25mm !important;
            height: 50mm !important;
            max-height: 50mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Tahoma", sans-serif !important;
            direction: rtl !important;
            overflow: hidden !important;
          }
          .thermal-label-page {
            width: 25mm !important;
            height: 50mm !important;
            max-height: 50mm !important;
            padding: 2.5mm 1.5mm !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-evenly !important;
            text-align: center !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .thermal-label-page:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
          }
          .thermal-label-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .qr-box {
            width: 15mm !important;
            height: 15mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 auto !important;
            flex-shrink: 0 !important;
          }
          .qr-box svg {
            width: 100% !important;
            height: 100% !important;
            display: block !important;
          }
          .prod-name {
            font-size: 8.5px !important;
            font-weight: 800 !important;
            line-height: 1.2 !important;
            color: #000000 !important;
            max-width: 23mm !important;
            white-space: normal !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            text-align: center !important;
            direction: rtl !important;
            margin: 0.3mm 0 !important;
          }
          .prod-sku {
            font-family: monospace, "Courier New", Courier !important;
            font-size: 8px !important;
            font-weight: 700 !important;
            color: #000000 !important;
            letter-spacing: 0.3px !important;
            line-height: 1 !important;
            text-align: center !important;
            margin: 0.2mm 0 !important;
          }
          .prod-price {
            font-family: monospace, -apple-system, BlinkMacSystemFont, sans-serif !important;
            font-size: 11px !important;
            font-weight: 900 !important;
            color: #000000 !important;
            line-height: 1 !important;
            text-align: center !important;
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
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(printDocumentHtml);
      doc.close();

      const originalParentTitle = document.title;
      setTimeout(() => {
        try {
          document.title = "";
          if (iframe.contentDocument) {
            iframe.contentDocument.title = "";
          }
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Print iframe error", e);
        } finally {
          setTimeout(() => {
            document.title = originalParentTitle;
          }, 1500);
        }
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
    <div className="space-y-8 pb-20 md:pb-0" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 print:hidden bg-card p-6 rounded-xl shadow-sm border border-border">
        <div>
          <h1 className="text-3xl font-bold mb-2">إدارة أكواد الـ QR Barcode</h1>
          <p className="text-muted-foreground">إدارة وطباعة ملصقات الباركود والـ QR للقطع والمجوهرات.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button onClick={toggleSelectAll} variant="outline">
            {selectedQRs.size === filteredItems.length && filteredItems.length > 0 ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
          </Button>
          <Button onClick={printSelected} size="lg" className="shadow-md gap-2" disabled={selectedQRs.size === 0}>
            <Printer className="h-5 w-5" />
            طباعة {selectedQRs.size} ملصق
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 print:hidden">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">تصفية حسب المنتج</label>
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
            <label className="text-sm font-medium">تصفية حسب الفرع</label>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {filteredItems.map(item => {
          const product = store.getProduct(item.productId);
          const isSelected = selectedQRs.has(item.id);
          // In print mode, only show selected QRs
          const printClass = isSelected ? 'print:flex' : 'print:hidden';

          return (
            <Card 
              key={item.id} 
              className={`flex flex-col items-center justify-center p-4 text-center border-border shadow-sm cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'} ${printClass} print:shadow-none print:border-black print:rounded-none print:p-2`}
              onClick={() => toggleSelect(item.id)}
            >
              <div id={`qr-box-${item.id}`} className="bg-white p-2 rounded-lg mb-3 print:mb-1 print:p-0">
                <QRCodeSVG value={item.id} size={100} level="M" />
              </div>
              <p className="text-xs font-bold truncate w-full px-2 text-foreground print:text-[10px]">{product?.nameAr}</p>
              <p className="text-[11px] font-mono font-bold mt-2 tracking-wider bg-background px-2 py-1 rounded border border-border print:border-none print:bg-transparent print:mt-0">{item.id}</p>
              {(() => {
                const bd = store.getProductBranchData(item.productId, item.branchId || 'b1');
                const rawPrice4 = bd?.price4 !== undefined && bd?.price4 !== null && bd?.price4 !== 0 
                  ? bd.price4 
                  : (bd?.price1 || '');
                return rawPrice4 ? (
                  <p className="font-mono font-black text-xs text-foreground mt-1.5">{rawPrice4}</p>
                ) : null;
              })()}
            </Card>
          );
        })}
      </div>
      
      {filteredItems.length === 0 && (
        <div className="text-center py-20 text-muted-foreground print:hidden">
          لا توجد قطع متاحة تطابق الفلاتر المحددة.
        </div>
      )}
    </div>
  );
};
