import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../../services/store';
import { Product, ProductComposition, InternalComponent, ExternalComponent } from '../../types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Plus, Search, Layers, Trash2, Package, Sparkles, CheckCircle2, AlertCircle, AlertTriangle, ChevronDown, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Custom Searchable Product Combobox with Keyboard Search & Realtime Filtering
const ProductSearchCombobox = ({
  products,
  selectedProductId,
  onSelect,
  activeBranchId
}: {
  products: Product[];
  selectedProductId: string;
  onSelect: (productId: string) => void;
  activeBranchId: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase().trim();
    return products.filter(p => 
      p.nameAr.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

  return (
    <div className="relative flex-1">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 px-3.5 border border-border/80 rounded-xl bg-background text-foreground text-xs font-bold flex items-center justify-between shadow-2xs hover:border-emerald-500/50 transition-all text-right"
      >
        <span className="truncate">
          {selectedProduct ? (
            <>
              <span className="font-bold">{selectedProduct.nameAr}</span>
              <span className="text-[10px] text-muted-foreground font-mono mr-2">
                (تكلفة: {store.getProductBranchData(selectedProduct.id, activeBranchId)?.cost || 0} ج.م)
              </span>
            </>
          ) : (
            <span className="text-muted-foreground font-normal">ابحث بالكيبورد عن المنتج...</span>
          )}
        </span>
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-1.5 right-0 left-0 bg-card border border-border/90 rounded-2xl shadow-2xl p-2 space-y-2 animate-in fade-in zoom-in-95">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="اكتب هنا للبحث باسم المنتج أو كود الـ SKU..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full h-9 pr-9 pl-3 text-xs bg-muted/40 border border-border/60 rounded-xl text-foreground font-bold outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-none pr-1">
            {filteredProducts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-3">لا توجد منتجات مطابقة للبحث.</p>
            ) : (
              filteredProducts.map(p => {
                const bd = store.getProductBranchData(p.id, activeBranchId);
                const isSel = p.id === selectedProductId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p.id);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-right p-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      isSel ? 'bg-emerald-500/15 text-emerald-500 font-bold border border-emerald-500/30' : 'hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">{p.nameAr}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{p.sku}</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                      تكلفة: {bd?.cost || 0} ج.م
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ProductCompositions = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [activeBranchId] = useState<string>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('id') || localStorage.getItem('last_active_branch') || user?.branchId || 'b1';
  });

  const currentBranchObj = store.getBranch(activeBranchId);
  const currentBranchName = currentBranchObj?.nameAr || 'الفرع الحالي';

  const [compositions, setCompositions] = useState<ProductComposition[]>(() => 
    store.getCompositionsByBranch(activeBranchId)
  );
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [compName, setCompName] = useState('');
  const [compQuantity, setCompQuantity] = useState<number>(0);
  const [price1, setPrice1] = useState<number>(20);
  const [price2, setPrice2] = useState<number>(25);
  const [price3, setPrice3] = useState<number>(30);
  const [formError, setFormError] = useState<string>('');

  // Internal Components Selected from Available Store Products
  const [internalItems, setInternalItems] = useState<InternalComponent[]>([]);
  // External Components Brought From Outside
  const [externalItems, setExternalItems] = useState<ExternalComponent[]>([]);

  const availableProducts = useMemo(() => store.getProducts(), []);

  // Calculate live total cost per unit
  const calculatedUnitCost = useMemo(() => {
    let total = 0;
    // Internal items cost
    internalItems.forEach(item => {
      if (item.productId) {
        const bd = store.getProductBranchData(item.productId, activeBranchId);
        const unitCost = bd?.cost || 0;
        total += unitCost * (item.quantity || 1);
      }
    });
    // External items cost
    externalItems.forEach(item => {
      total += (item.cost || 0) * (item.quantity || 1);
    });
    return total;
  }, [internalItems, externalItems, activeBranchId]);

  // Open Add Modal & Reset Fields
  const openAddModal = () => {
    setCompName('');
    setCompQuantity(0);
    setPrice1(20);
    setPrice2(25);
    setPrice3(30);
    setInternalItems([
      { productId: availableProducts[0]?.id || '', quantity: 1 }
    ]);
    setExternalItems([]);
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Add Internal Product Component Row
  const handleAddInternalRow = () => {
    if (availableProducts.length === 0) return;
    setInternalItems(prev => [...prev, { productId: availableProducts[0].id, quantity: 1 }]);
  };

  // Remove Internal Product Component Row
  const handleRemoveInternalRow = (index: number) => {
    setInternalItems(prev => prev.filter((_, i) => i !== index));
  };

  // Update Internal Product Component Row
  const handleUpdateInternalRow = (index: number, key: keyof InternalComponent, val: any) => {
    setInternalItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  };

  // Add External Component Row
  const handleAddExternalRow = () => {
    setExternalItems(prev => [
      ...prev, 
      { id: `ext_${Date.now()}_${Math.random()}`, name: '', cost: 0, quantity: 1 }
    ]);
  };

  // Remove External Component Row
  const handleRemoveExternalRow = (index: number) => {
    setExternalItems(prev => prev.filter((_, i) => i !== index));
  };

  // Update External Component Row
  const handleUpdateExternalRow = (index: number, key: keyof ExternalComponent, val: any) => {
    setExternalItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  };

  // Save Composition & Register Assembled Product
  const handleSaveComposition = () => {
    if (!compName.trim()) {
      setFormError('اسم التركيبة / المنتج النهائي إجباري!');
      return;
    }

    setFormError('');

    // 1. Create a new final Product in the store so it can be sold in POS immediately!
    const cleanPrefix = 'COMP';
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const skuCode = `${cleanPrefix}-${randomNum}`;
    const categories = store.getCategories();
    const defaultCatId = categories.length > 0 ? categories[0].id : 'c1';

    const newAssembledProduct: Product = {
      id: `comp_p_${Date.now()}`,
      nameAr: compName.trim(),
      nameEn: compName.trim(),
      descriptionAr: 'منتج مُجمع / تركيبة خاصة',
      descriptionEn: 'Assembled Product / Custom Composition',
      categoryId: defaultCatId,
      sku: skuCode,
      productCode: skuCode,
      material: '', color: '', size: '', isActive: true
    };

    const branchDataList = store.getBranches().map(b => ({
      productId: newAssembledProduct.id,
      branchId: b.id,
      cost: calculatedUnitCost,
      price1: price1 || calculatedUnitCost * 1.2,
      price1Label: 'سعر 1',
      price2: price2 || price1 || calculatedUnitCost * 1.15,
      price2Label: 'سعر 2',
      price3: price3 || price1 || calculatedUnitCost * 1.1,
      price3Label: 'سعر 3',
      price4: price1 || calculatedUnitCost * 1.05,
      price4Label: 'سعر 4',
      minStock: 5
    }));

    store.addProduct(newAssembledProduct, branchDataList);

    // Generate physical items for the created assembled product in active branch
    if (compQuantity > 0) {
      store.generatePhysicalItems(newAssembledProduct.id, activeBranchId, compQuantity, cleanPrefix);
    }

    // 2. Create composition record
    const newComp: ProductComposition = {
      id: `comp_${Date.now()}`,
      branchId: activeBranchId,
      name: compName.trim(),
      quantity: compQuantity,
      price1,
      price2,
      price3,
      totalCost: calculatedUnitCost,
      internalComponents: internalItems.filter(i => i.productId),
      externalComponents: externalItems.filter(e => e.name.trim()),
      createdProductId: newAssembledProduct.id,
      createdAt: new Date().toISOString()
    };

    store.addComposition(newComp);
    setCompositions(store.getCompositionsByBranch(activeBranchId));
    setIsAddModalOpen(false);
  };

  // Delete Composition Confirmation State
  const [deleteConfirmComp, setDeleteConfirmComp] = useState<ProductComposition | null>(null);

  const confirmDeleteCompAction = () => {
    if (!deleteConfirmComp) return;
    store.deleteComposition(deleteConfirmComp.id);
    if (deleteConfirmComp.createdProductId) {
      store.deleteProduct(deleteConfirmComp.createdProductId);
    }
    setCompositions(store.getCompositionsByBranch(activeBranchId));
    setDeleteConfirmComp(null);
  };

  const filteredCompositions = useMemo(() => {
    return compositions.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [compositions, search]);

  return (
    <div className="space-y-6 pb-20 md:pb-6 animate-in fade-in" dir="rtl">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border/80 p-6 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/20 shrink-0">
            <Layers size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <span>تركيب المنتجات</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
                {currentBranchName}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              تجميع وتركيب المنتجات والسلاسل والأطقم من المواد المتاحة بالنظام والقطع الخارجية.
            </p>
          </div>
        </div>

        <Button 
          onClick={openAddModal}
          className="shadow-md bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-6 h-12 rounded-2xl gap-2 w-full md:w-auto"
        >
          <Plus size={20} />
          <span>إضافة تركيبة جديدة</span>
        </Button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input 
          placeholder="ابحث باسم التركيبة أو المنتج المجمع..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pr-10 h-12 text-xs rounded-2xl bg-card border-border/80 shadow-2xs w-full" 
        />
      </div>

      {/* COMPOSITIONS LIST GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCompositions.length === 0 ? (
          <div className="col-span-full bg-card border border-border rounded-3xl p-12 text-center text-muted-foreground space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/40">
              <Layers size={36} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">لا توجد تركيبات مسجلة في {currentBranchName}</h3>
              <p className="text-xs text-muted-foreground">اضغط على زر "إضافة تركيبة جديدة" للبدء في تجميع المنتجات والأطقم.</p>
            </div>
            <Button 
              onClick={openAddModal}
              variant="outline"
              className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-bold text-xs rounded-2xl h-11 gap-2 px-5"
            >
              <Plus size={18} />
              <span>إضافة أول تركيبة الآن</span>
            </Button>
          </div>
        ) : (
          filteredCompositions.map(comp => (
            <Card key={comp.id} className="bg-card border border-border/80 rounded-3xl p-5 space-y-4 shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between">
              
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-border/60 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-foreground leading-tight">{comp.name}</h3>
                    <span className="text-[10px] text-amber-500 font-bold font-mono bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 mt-1 inline-block">
                      مُصنع ومُدرج بنقطة البيع
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setDeleteConfirmComp(comp)}
                    className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl h-8 w-8 shrink-0"
                    title="حذف التركيبة"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                {/* Costs & Stock */}
                <div className="bg-muted/30 p-3.5 rounded-2xl border border-border/50 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>تكلفة التصنيع (القطعة):</span>
                    <span className="font-mono font-bold text-rose-500">{comp.totalCost.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-amber-500 border-t border-border/40 pt-1.5">
                    <span>الكمية المتاحة بالمخزن:</span>
                    <span className="font-mono bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/20">{comp.quantity} قطعة</span>
                  </div>
                </div>

                {/* Selling Prices 3 Columns */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    <span className="block text-[10px] text-muted-foreground font-bold">سعر 1</span>
                    <span className="font-mono font-extrabold text-amber-500">{comp.price1} ج.م</span>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-xl border border-border/60">
                    <span className="block text-[10px] text-muted-foreground font-bold">سعر 2</span>
                    <span className="font-mono font-extrabold text-foreground">{comp.price2} ج.م</span>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-xl border border-border/60">
                    <span className="block text-[10px] text-muted-foreground font-bold">سعر 3</span>
                    <span className="font-mono font-extrabold text-foreground">{comp.price3} ج.م</span>
                  </div>
                </div>

                {/* Ingredients / Components Preview */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-muted-foreground block">مكونات التركيبة:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {comp.internalComponents.map((ic, idx) => {
                      const prod = store.getProduct(ic.productId);
                      return (
                        <span key={idx} className="text-[10px] bg-background border border-border px-2 py-1 rounded-lg text-foreground font-bold">
                          {prod ? prod.nameAr : 'منتج'} ({ic.quantity}x)
                        </span>
                      );
                    })}
                    {comp.externalComponents.map((ec, idx) => (
                      <span key={idx} className="text-[10px] bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg text-amber-600 font-bold">
                        {ec.name} ({ec.cost} ج.م)
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </Card>
          ))
        )}
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* ADD NEW COMPOSITION MODAL DIALOG (MATCHING IMAGE 1 LAYOUT EXACTLY) */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] bg-[#121614] border border-border/80 rounded-3xl p-6 shadow-2xl space-y-5" dir="rtl">
          
          {/* Header */}
          <DialogHeader className="pb-2 border-b border-border/40">
            <DialogTitle className="text-xl font-bold text-foreground text-center sm:text-right">
              إضافة تركيبة جديدة
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[75vh] pr-1">
            <div className="space-y-5 text-xs">

              {/* Form Error Banner */}
              {formError && (
                <div className="bg-destructive/15 border border-destructive/30 text-destructive text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Composition / Final Product Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground block text-right">
                  اسم التركيبة / المنتج النهائي
                </Label>
                <Input 
                  placeholder="مثال: خلطة العفريت / تركيب سلسلة الفراشة" 
                  value={compName} 
                  onChange={e => setCompName(e.target.value)} 
                  className="rounded-xl h-11 text-xs font-bold bg-[#181d1a] border-border/80" 
                />
              </div>

              {/* 2. Initial Stock Quantity */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground block text-right">
                  الكمية المخزنة من قبل
                </Label>
                <Input 
                  type="number" 
                  min={0}
                  value={compQuantity} 
                  onChange={e => setCompQuantity(Math.max(0, Number(e.target.value)))} 
                  className="rounded-xl h-11 text-xs font-mono font-bold text-right bg-[#181d1a] border-border/80" 
                />
              </div>

              {/* 3. Internal Product Components Section (Material / Ingredients) */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    المواد الخام والمكونات (للمنتج الواحد)
                  </Label>
                  <button 
                    type="button" 
                    onClick={handleAddInternalRow}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                  >
                    + إضافة مادة خام
                  </button>
                </div>

                {internalItems.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-1">اضغط "+ إضافة مادة خام" لربط منتجات من المحل.</p>
                ) : (
                  <div className="space-y-2.5">
                    {internalItems.map((item, idx) => {
                      const selectedProd = availableProducts.find(p => p.id === item.productId);
                      const bd = selectedProd ? store.getProductBranchData(selectedProd.id, activeBranchId) : null;
                      const unitCost = bd?.cost || 0;
                      const itemTotalCost = unitCost * (item.quantity || 1);

                      return (
                        <div key={idx} className="flex items-center gap-2.5 bg-[#181d1a] p-3 rounded-2xl border border-border/60">
                          {/* Keyboard Searchable Product Combobox */}
                          <ProductSearchCombobox 
                            products={availableProducts}
                            selectedProductId={item.productId}
                            onSelect={(pId) => handleUpdateInternalRow(idx, 'productId', pId)}
                            activeBranchId={activeBranchId}
                          />

                          {/* Quantity Input */}
                          <div className="w-24 shrink-0">
                            <Input 
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => handleUpdateInternalRow(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                              className="h-11 text-xs font-mono font-bold text-center rounded-xl bg-background border-border/80"
                            />
                          </div>

                          {/* Live Cost Display */}
                          <div className="w-20 text-center font-mono font-bold text-rose-500 text-[11px] shrink-0">
                            {itemTotalCost.toFixed(1)} ج.م
                          </div>

                          {/* Trash Delete Row Button */}
                          <Button 
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveInternalRow(idx)}
                            className="text-muted-foreground hover:text-rose-500 rounded-xl h-9 w-9 shrink-0"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. External Items Section (Material from Outside / Packaging) */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    مواد التعبئة والتغليف والقطع الخارجية (للمنتج الواحد)
                  </Label>
                  <button 
                    type="button" 
                    onClick={handleAddExternalRow}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                  >
                    + إضافة عبوة/تعبئة
                  </button>
                </div>

                {externalItems.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-1">اضغط "+ إضافة عبوة/تعبئة" لإضافة قطع خارجية أو علب.</p>
                ) : (
                  <div className="space-y-2.5">
                    {externalItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 bg-[#181d1a] p-3 rounded-2xl border border-border/60">
                        {/* Name Input */}
                        <Input 
                          placeholder="اسم المكون الخارجي (مثال: شكل فراشة)"
                          value={item.name}
                          onChange={e => handleUpdateExternalRow(idx, 'name', e.target.value)}
                          className="flex-1 h-11 text-xs rounded-xl bg-background border-border/80"
                        />

                        {/* Cost Input */}
                        <div className="w-24 shrink-0">
                          <Input 
                            type="number"
                            min={0}
                            placeholder="سعر التكلفة"
                            value={item.cost || ''}
                            onChange={e => handleUpdateExternalRow(idx, 'cost', Number(e.target.value))}
                            className="h-11 text-xs font-mono font-bold text-center rounded-xl bg-background border-rose-500/40 text-rose-500"
                          />
                        </div>

                        {/* Quantity Input */}
                        <div className="w-20 shrink-0">
                          <Input 
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => handleUpdateExternalRow(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                            className="h-11 text-xs font-mono font-bold text-center rounded-xl bg-background border-border/80"
                          />
                        </div>

                        {/* Trash Delete Row Button */}
                        <Button 
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveExternalRow(idx)}
                          className="text-muted-foreground hover:text-rose-500 rounded-xl h-9 w-9 shrink-0"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Live Total Cost Box Summary */}
              <div className="bg-[#181d1a] p-3.5 rounded-2xl border border-border/60 flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground">إجمالي تكلفة وقوف القطعة الواحدة عليك:</span>
                <span className="font-mono text-base font-extrabold text-rose-500 bg-rose-500/10 px-3 py-1 rounded-xl border border-rose-500/20">
                  {calculatedUnitCost.toFixed(2)} ج.م
                </span>
              </div>

              {/* 6. Selling Prices for Composition (AT THE VERY BOTTOM BEFORE BUTTONS) */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <Label className="text-xs font-bold text-foreground block text-right">
                  أسعار البيع للتركيبة
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 text-center">
                    <Label className="text-[10px] font-bold text-muted-foreground">سعر 1 (ج.م)</Label>
                    <Input 
                      type="number" 
                      min={0}
                      value={price1} 
                      onChange={e => setPrice1(Number(e.target.value))} 
                      className="rounded-xl h-11 text-xs font-mono font-extrabold text-center bg-[#181d1a] border-border/80" 
                    />
                  </div>

                  <div className="space-y-1 text-center">
                    <Label className="text-[10px] font-bold text-muted-foreground">سعر 2 (ج.م)</Label>
                    <Input 
                      type="number" 
                      min={0}
                      value={price2} 
                      onChange={e => setPrice2(Number(e.target.value))} 
                      className="rounded-xl h-11 text-xs font-mono font-extrabold text-center bg-[#181d1a] border-border/80" 
                    />
                  </div>

                  <div className="space-y-1 text-center">
                    <Label className="text-[10px] font-bold text-muted-foreground">سعر 3 (ج.م)</Label>
                    <Input 
                      type="number" 
                      min={0}
                      value={price3} 
                      onChange={e => setPrice3(Number(e.target.value))} 
                      className="rounded-xl h-11 text-xs font-mono font-extrabold text-center bg-[#181d1a] border-border/80" 
                    />
                  </div>
                </div>
              </div>

            </div>
          </ScrollArea>

          {/* Footer Actions (Matching Image 1: Side by Side on Left) */}
          <div className="pt-3 border-t border-border/40 flex items-center justify-start gap-3">
            <Button 
              onClick={handleSaveComposition}
              className="rounded-2xl text-xs font-bold bg-[#2d4838] hover:bg-[#385946] text-emerald-400 border border-emerald-500/30 h-11 px-8 shadow-sm"
            >
              حفظ
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-2xl text-xs font-bold border-border/80 text-foreground bg-[#181d1a] h-11 px-6"
            >
              إلغاء
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------------- */}
      {/* DELETE COMPOSITION CUSTOM CONFIRMATION POPUP MODAL */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={!!deleteConfirmComp} onOpenChange={(open) => !open && setDeleteConfirmComp(null)}>
        <DialogContent className="max-w-xs sm:max-w-md w-[92vw] bg-card border-border rounded-3xl p-6 shadow-2xl space-y-4" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-base font-bold text-rose-500 flex items-center gap-2">
              <AlertTriangle size={20} className="text-rose-500" />
              <span>تأكيد حذف التركيبة</span>
            </DialogTitle>
          </DialogHeader>

          {deleteConfirmComp && (
            <div className="space-y-4">
              <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 text-xs space-y-2">
                <p className="font-bold text-foreground leading-relaxed text-sm">
                  هل أنت تأكد من حذف تركيبة <span className="text-rose-500 font-extrabold">({deleteConfirmComp.name})</span> بالكامل من النظام؟
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ⚠️ سيتم حذف التركيبة والمنتج المرتبط بها من القوائم.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteConfirmComp(null)}
                  className="flex-1 h-11 text-xs font-bold rounded-xl border-border"
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  onClick={confirmDeleteCompAction}
                  className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md gap-1.5"
                >
                  <Trash2 size={16} />
                  <span>نعم، تأكيد الحذف</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};
