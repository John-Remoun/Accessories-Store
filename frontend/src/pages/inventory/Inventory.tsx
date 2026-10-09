import { store } from '../../services/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreSync } from '../../hooks/useStoreSync';
import { Card } from '../../components/ui/card';
import { Sparkles, Package, AlertTriangle } from 'lucide-react';

export const Inventory = () => {
  useStoreSync();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const products = store.getProducts();
  const allPhysicalItems = store.getPhysicalItems();
  const branches = store.getBranches();
  
  // Group by product
  const inventorySummary = products.map(product => {
    const items = allPhysicalItems.filter(i => i.productId === product.id);
    
    // If employee, only count their branch
    const branchItems = isAdmin ? items : items.filter(i => i.branchId === user?.branchId);
    
    const available = branchItems.filter(i => i.status === 'available').length;
    const sold = branchItems.filter(i => i.status === 'sold').length;

    // Check low stock
    let isLow = false;
    let isOut = available === 0;

    if (isAdmin) {
      branches.forEach(b => {
        const bd = store.getProductBranchData(product.id, b.id);
        const ba = items.filter(i => i.branchId === b.id && i.status === 'available').length;
        if (bd && ba > 0 && ba <= bd.minStock) isLow = true;
      });
    } else {
      const bd = store.getProductBranchData(product.id, user?.branchId || '');
      if (bd && available > 0 && available <= bd.minStock) isLow = true;
    }

    return {
      product,
      total: branchItems.length,
      available,
      sold,
      isLow,
      isOut
    };
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-in fade-in" dir="rtl">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif font-bold mb-1 text-foreground">إدارة وتتبع المخزون الكلي</h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? 'متابعة حركة المخزون والقطع الجاهزة بالمعارض في كل الفروع.' : 'متابعة المخزون والقطع الخاصة بفرعك.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Card 1: Available Pieces (Amber Theme) */}
        <Card className="bg-card shadow-xs border-border/80 rounded-2xl p-5 flex flex-col items-center justify-between text-center space-y-3">
          <span className="text-xs sm:text-sm font-bold text-muted-foreground">القطع المتاحة بالمعارض</span>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-500 font-mono">
              {inventorySummary.reduce((acc, curr) => acc + curr.available, 0)}
            </span>
            <span className="text-xs font-bold text-amber-500/90">قطعة</span>
          </div>
          <div className="w-11 h-11 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shadow-xs">
            <Sparkles size={20} className="text-amber-500" />
          </div>
        </Card>

        {/* Card 2: Total Pieces (Emerald/Green Theme) */}
        <Card className="bg-card shadow-xs border-border/80 rounded-2xl p-5 flex flex-col items-center justify-between text-center space-y-3">
          <span className="text-xs sm:text-sm font-bold text-muted-foreground">إجمالي كافة القطع المخزنة</span>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-500 font-mono">
              {inventorySummary.reduce((acc, curr) => acc + curr.total, 0)}
            </span>
            <span className="text-xs font-bold text-emerald-500/90">قطعة</span>
          </div>
          <div className="w-11 h-11 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-xs">
            <Package size={20} className="text-emerald-500" />
          </div>
        </Card>

        {/* Card 3: Low Stock Alerts (Rose/Red Theme) */}
        <Card className="bg-card shadow-xs border-border/80 rounded-2xl p-5 flex flex-col items-center justify-between text-center space-y-3">
          <span className="text-xs sm:text-sm font-bold text-muted-foreground">تنبيهات نواقص المخزون</span>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-500 font-mono">
              {inventorySummary.filter(i => i.isLow || i.isOut).length}
            </span>
            <span className="text-xs font-bold text-rose-500/90">تنبيه</span>
          </div>
          <div className="w-11 h-11 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shadow-xs">
            <AlertTriangle size={20} className="text-rose-500" />
          </div>
        </Card>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-right">المنتج والبيان</TableHead>
              <TableHead className="text-right">القسم / الفئة</TableHead>
              <TableHead className="text-center">المتاح بالمعرض</TableHead>
              <TableHead className="text-center">إجمالي المباع</TableHead>
              <TableHead className="text-center">حالة المخزون</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventorySummary.map((summary) => (
              <TableRow key={summary.product.id} className="hover:bg-muted/30">
                <TableCell className="font-medium py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0">
                      {summary.product.imageUrl && <img src={summary.product.imageUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-foreground">{summary.product.nameAr}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{summary.product.sku}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-bold text-foreground">
                  {store.getCategories().find(c => c.id === summary.product.categoryId)?.nameAr}
                </TableCell>
                <TableCell className="text-center font-bold text-base font-mono text-primary">{summary.available}</TableCell>
                <TableCell className="text-center text-muted-foreground font-mono text-xs">{summary.sold}</TableCell>
                <TableCell className="text-center">
                  {summary.isOut ? (
                    <span className="px-3 py-1 bg-destructive/15 text-destructive text-[11px] rounded-full font-bold border border-destructive/20">منتهي من المخزون</span>
                  ) : summary.isLow ? (
                    <span className="px-3 py-1 bg-amber-500/15 text-amber-600 text-[11px] rounded-full font-bold border border-amber-500/20">مخزون منخفض جداً</span>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-500/15 text-emerald-600 text-[11px] rounded-full font-bold border border-emerald-500/20">متوفر بالمعرض</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
