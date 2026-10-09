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
    // Basic way to handle print state via CSS classes:
    // We can add a class to body or wrapper, but native window.print() just prints what is visible.
    // We already have `.print:hidden` for UI controls, and `.print:block` for the labels.
    window.print();
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
              <div className="bg-white p-2 rounded-lg mb-3 print:mb-1 print:p-0">
                <QRCodeSVG value={item.id} size={100} level="M" />
              </div>
              <p className="text-xs font-bold truncate w-full px-2 text-foreground print:text-[10px]">{product?.nameAr}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 print:hidden">{product?.sku}</p>
              <p className="text-[11px] font-mono font-bold mt-2 tracking-wider bg-background px-2 py-1 rounded border border-border print:border-none print:bg-transparent print:mt-0">{item.id}</p>
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
