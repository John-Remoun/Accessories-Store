import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../../services/store';
import { useStoreSync } from '../../hooks/useStoreSync';
import { Product, ProductBranchData, Category } from '../../types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Plus, QrCode, Search, Tag, Package, DollarSign, RefreshCw, Sparkles, Printer, AlertTriangle, AlertCircle, Settings, Download, CheckCircle2, Trash2, Droplet, Warehouse, Pencil, MoreVertical, PackagePlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { ScrollArea } from '../../components/ui/scroll-area';
import { QRCodeSVG } from 'qrcode.react';
import { 
  getPrinterConfig, 
  checkPrinterServiceStatus, 
  sendPrintJobToLocalService, 
  downloadTSPLFile,
  PrinterServiceConfig, 
  PrinterStatus 
} from '../../services/printerService';

export const Products = () => {
  useStoreSync();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();

  // Dynamic active branch state with URL parameter & localStorage sync
  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    if (user && user.role !== 'admin' && user.branchId) {
      return user.branchId;
    }
    return localStorage.getItem('last_active_branch') || user?.branchId || 'b4';
  });

  useEffect(() => {
    if (user && user.role !== 'admin' && user.branchId) {
      setActiveBranchId(user.branchId);
      return;
    }
    const params = new URLSearchParams(location.search);
    const bId = params.get('id') || localStorage.getItem('last_active_branch') || user?.branchId || 'b4';
    setActiveBranchId(bId);

    if (params.get('lowStock') === 'true') {
      setLowStockOnlyFilter(true);
    }
  }, [location.search, user]);

  const [products, setProducts] = useState<Product[]>(() => store.getProducts());
  const [categories, setCategories] = useState<Category[]>(() => store.getCategories());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [lowStockOnlyFilter, setLowStockOnlyFilter] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    setProducts([...store.getProducts()]);
    setCategories([...store.getCategories()]);

    const timer = setTimeout(() => {
      setProducts([...store.getProducts()]);
      setCategories([...store.getCategories()]);
    }, 600);

    return () => clearTimeout(timer);
  }, [activeBranchId]);

  const currentBranchObj = store.getBranch(activeBranchId);
  const currentBranchName = currentBranchObj?.nameAr || 'الفرع الحالي';

  // Product Options & Restock Modal States
  const [optionsProduct, setOptionsProduct] = useState<Product | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState<number | ''>('');
  const [restockError, setRestockError] = useState<string>('');

  const handleSaveRestock = () => {
    if (!restockProduct) return;
    const addedCount = Number(restockAmount);
    if (!addedCount || addedCount <= 0) {
      setRestockError('يرجى كتابة كمية الشحنة الجديدة (أكبر من 0)');
      return;
    }

    const bd = store.getProductBranchData(restockProduct.id, activeBranchId);
    const currentQty = Number(bd?.quantity || 0);
    const newTotalQty = currentQty + addedCount;

    const cleanPrefix = restockProduct.sku.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITM';
    store.adjustProductBranchQuantity(restockProduct.id, activeBranchId, newTotalQty, cleanPrefix);

    setProducts([...store.getProducts()]);
    setRestockProduct(null);
    setRestockAmount('');
    setRestockError('');
  };

  // Edit Product Modal State & Form Fields
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [epNameAr, setEpNameAr] = useState('');
  const [epNameEn, setEpNameEn] = useState('');
  const [epSku, setEpSku] = useState('');
  const [epCategory, setEpCategory] = useState('');
  const [epCost, setEpCost] = useState<number>(0);
  const [epPrice1, setEpPrice1] = useState<number>(0);
  const [epPrice2, setEpPrice2] = useState<number>(0);
  const [epPrice3, setEpPrice3] = useState<number>(0);
  const [epPrice4, setEpPrice4] = useState<number>(0);
  const [epQuantity, setEpQuantity] = useState<number>(0);
  const [epMinStock, setEpMinStock] = useState<number>(10);
  const [editFormError, setEditFormError] = useState<string>('');

  const openEditModal = (product: Product) => {
    const bd = store.getProductBranchData(product.id, activeBranchId);

    setEditingProduct(product);
    setEpNameAr(product.nameAr);
    setEpNameEn(product.nameEn || '');
    setEpSku(product.sku);
    setEpCategory(product.categoryId);
    setEpCost(Number(bd?.cost) || 0);
    setEpPrice1(Number(bd?.price1) || 0);
    setEpPrice2(Number(bd?.price2) || 0);
    setEpPrice3(Number(bd?.price3) || 0);
    setEpPrice4(Number(bd?.price4) || Number(bd?.price1) || 0);
    setEpQuantity(Number(bd?.quantity) || 0);
    setEpMinStock(Number(bd?.minStock) ?? 10);
    setEditFormError('');
    setIsEditModalOpen(true);
  };

  const handleSaveProductEdit = () => {
    if (!editingProduct) return;
    if (!epNameAr.trim()) {
      setEditFormError('اسم المنتج بالعربية إجباري!');
      return;
    }
    setEditFormError('');

    const cleanSku = epSku.trim() ? epSku.trim().toUpperCase() : editingProduct.sku;

    // 1. Update basic product info
    store.updateProduct(editingProduct.id, {
      nameAr: epNameAr.trim(),
      nameEn: epNameEn.trim() || epNameAr.trim(),
      categoryId: epCategory,
      sku: cleanSku,
      productCode: cleanSku,
    });

    // 2. Update branch pricing & min stock & quantity
    const existingBranchData = store.getProductBranchData(editingProduct.id, activeBranchId);
    const targetQty = Math.max(0, Number(epQuantity) || 0);
    store.updateProductBranchData({
      productId: editingProduct.id,
      branchId: activeBranchId,
      cost: Number(epCost) || 0,
      price1: Number(epPrice1) || 0,
      price1Label: existingBranchData?.price1Label || 'سعر 1',
      price2: Number(epPrice2) || Number(epPrice1) || 0,
      price2Label: existingBranchData?.price2Label || 'سعر 2',
      price3: Number(epPrice3) || Number(epPrice1) || 0,
      price3Label: existingBranchData?.price3Label || 'سعر 3',
      price4: Number(epPrice4) || Number(epPrice1) || 0,
      price4Label: existingBranchData?.price4Label || 'سعر 4',
      minStock: Number(epMinStock) || 10,
      quantity: targetQty,
    });

    // 3. Adjust quantity of physical items in this branch
    const cleanPrefix = cleanSku.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITM';
    store.adjustProductBranchQuantity(editingProduct.id, activeBranchId, targetQty, cleanPrefix);

    // 4. Refresh state & close modal
    setProducts([...store.getProducts()]);
    setIsEditModalOpen(false);
  };

  // Delete Product Confirmation State
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);

  const confirmDeleteProductAction = () => {
    if (!deleteConfirmProduct) return;
    store.deleteProduct(deleteConfirmProduct.id);
    setProducts([...store.getProducts()]);
    setDeleteConfirmProduct(null);
    setIsEditModalOpen(false);
  };

  // Category Management Popup Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [modalCategoryName, setModalCategoryName] = useState<string>('');
  const [modalCatError, setModalCatError] = useState<string>('');

  const handleAddCategoryFromModal = () => {
    if (!modalCategoryName.trim()) {
      setModalCatError('يرجى كتابة اسم الفئة أولاً!');
      return;
    }
    setModalCatError('');
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      nameAr: modalCategoryName.trim(),
      nameEn: modalCategoryName.trim()
    };
    store.addCategory(newCat);
    setCategories([...store.getCategories()]);
    setModalCategoryName('');
  };

  // Delete Category Confirmation State
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<{ id: string; nameAr: string } | null>(null);

  const confirmDeleteCategoryAction = () => {
    if (!deleteConfirmCategory) return;
    store.deleteCategory(deleteConfirmCategory.id);
    setCategories([...store.getCategories()]);
    setDeleteConfirmCategory(null);
  };

  const handleDeleteCategoryFromModal = (id: string, nameAr: string) => {
    setDeleteConfirmCategory({ id, nameAr });
  };

  // Dynamic Per-Branch Inventory Stats
  const branchStats = useMemo(() => {
    const branchProductsList = products.filter(p => {
      const bd = store.getProductBranchData(p.id, activeBranchId);
      const phys = store.getPhysicalItemsByProduct(p.id).filter(i => i.branchId === activeBranchId);
      return Boolean(bd || phys.length > 0);
    });

    let totalPieces = 0;
    let totalInventoryValue = 0;
    let lowStockCount = 0;

    branchProductsList.forEach(p => {
      const bd = store.getProductBranchData(p.id, activeBranchId);
      const qty = Number(bd?.quantity || 0);
      const cost = Number(bd?.cost || 0);
      const minStock = Number(bd?.minStock ?? 10);

      totalPieces += qty;
      totalInventoryValue += (cost * qty);

      if (qty <= minStock) {
        lowStockCount++;
      }
    });

    return {
      totalPieces,
      availablePieces: totalPieces,
      lowStockCount,
      totalInventoryValue
    };
  }, [products, activeBranchId]);

  // Print Label Modal State & Thermal Printer Service Config
  const [printModalProduct, setPrintModalProduct] = useState<Product | null>(null);
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<'40x25' | '38x25' | '50x25'>('40x25');
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [printerConfig, setPrinterConfig] = useState<PrinterServiceConfig>(getPrinterConfig());
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const [isSendingJob, setIsSendingJob] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showConfigSettings, setShowConfigSettings] = useState<boolean>(false);

  // Check Local Printer Agent status when modal opens
  useEffect(() => {
    if (printModalProduct) {
      checkPrinterServiceStatus().then(setPrinterStatus);
    }
  }, [printModalProduct]);

  // Isolated Thermal Label Printing (Exact 40x25mm single-ticket architecture)
  const handleExecutePrintLabels = () => {
    if (!printModalProduct) return;
    const copies = Math.max(1, Number(printCopies) || 1);

    const widthMm = labelSize === '50x25' ? 50 : labelSize === '38x25' ? 38 : 40;
    const heightMm = 25;
    const safeWidthMm = labelSize === '50x25' ? 44 : labelSize === '38x25' ? 33.5 : 35;
    const safeHeightMm = 20.5;
    const qrWidthMm = labelSize === '50x25' ? 17.5 : labelSize === '38x25' ? 14 : 15;
    const infoWidthMm = labelSize === '50x25' ? 25 : labelSize === '38x25' ? 18 : 19;

    // Retrieve Price 4 for this product in active branch
    const bd = store.getProductBranchData(printModalProduct.id, activeBranchId);
    const rawPrice4 = bd?.price4 !== undefined && bd?.price4 !== null && bd?.price4 !== 0 
      ? bd.price4 
      : (bd?.price1 || '');
    const price4Display = rawPrice4 !== '' ? String(rawPrice4) : '';

    // Grab the rendered QR SVG from preview
    const svgEl = document.querySelector('#label-qr-preview-container svg');
    const qrSvgString = svgEl ? svgEl.outerHTML : '';

    const labelPagesHtml = Array.from({ length: copies })
      .map(
        (_, i) => `
        <div class="ticket-page" key="${i}">
          <div class="ticket-content">
            <!-- 1. الـ QR Code على اليسار -->
            <div class="qr-section">
              ${qrSvgString}
            </div>

            <!-- 2. التفاصيل على اليمين -->
            <div class="info-section">
              <div class="serial-no">${printModalProduct.sku}</div>
              <div class="item-title">${printModalProduct.nameAr}</div>
              <div class="price-tag">${price4Display || '—'} <span class="currency">ج.م</span></div>
            </div>
          </div>
        </div>
      `
      )
      .join('\n');

    const printDocumentHtml = `
      <!DOCTYPE html>
      <html lang="ar">
      <head>
        <meta charset="utf-8" />
        <title></title>
        <style>
          /* 1. ضبط مقاس الصفحة وتصفير الهوامش وإجبار الوضع الأفقي لمنع الشقلبة */
          @page {
            size: ${widthMm}mm ${heightMm}mm ${printOrientation};
            margin: 0 !important;
            @top-left { content: none !important; }
            @top-center { content: none !important; }
            @top-right { content: none !important; }
            @bottom-left { content: none !important; }
            @bottom-center { content: none !important; }
            @bottom-right { content: none !important; }
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

          /* 2. صفحة التيكت بالحجم الفعلي للورقة */
          .ticket-page {
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            max-width: ${widthMm}mm !important;
            max-height: ${heightMm}mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            background-color: #ffffff !important;
          }

          .ticket-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* 3. الحاوية الآمنة للمحتوى (بها هوامش أمان من جميع الأطراف حتى لا يتآكل أي جزء) */
          .ticket-content {
            width: ${safeWidthMm}mm !important;
            height: ${safeHeightMm}mm !important;
            display: flex !important;
            flex-direction: row !important; /* الكيو آر يسار والنصوص يمين */
            align-items: center !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            padding: 0 !important;
          }

          /* 4. الكيو آر كود */
          .qr-section {
            width: ${qrWidthMm}mm !important;
            height: ${qrWidthMm}mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
          }

          .qr-section img, .qr-section svg {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            image-rendering: pixelated !important;
            display: block !important;
          }

          /* 5. التفاصيل على اليمين */
          .info-section {
            width: ${infoWidthMm}mm !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            direction: rtl !important;
            text-align: right !important;
            overflow: hidden !important;
            padding-right: 0.8mm !important;
          }

          .serial-no {
            font-size: 7pt !important;
            font-weight: 700 !important;
            color: #000 !important;
            direction: ltr !important;
            text-align: right !important;
            font-family: monospace !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            margin-bottom: 0.5mm !important;
            line-height: 1.1 !important;
          }

          .item-title {
            font-size: 6.5pt !important;
            font-weight: 600 !important;
            color: #000 !important;
            line-height: 1.15 !important;
            margin-bottom: 0.7mm !important;
            max-height: 6.5mm !important;
            overflow: hidden !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            word-break: break-word !important;
          }

          .price-tag {
            font-size: 9pt !important;
            font-weight: 900 !important;
            color: #000 !important;
            line-height: 1 !important;
            white-space: nowrap !important;
          }

          .price-tag .currency {
            font-size: 5.5pt !important;
            font-weight: normal !important;
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
          // Clear titles so Chrome doesn't print parent page title in header
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

  // New Product Form State
  const [npNameAr, setNpNameAr] = useState('');
  const [npNameEn, setNpNameEn] = useState('');
  const [npSku, setNpSku] = useState('');
  const [npCategory, setNpCategory] = useState('');
  const [npCost, setNpCost] = useState<number>(0);
  const [npPrice1, setNpPrice1] = useState<number>(0);
  const [npPrice2, setNpPrice2] = useState<number>(0);
  const [npPrice3, setNpPrice3] = useState<number>(0);
  const [npPrice4, setNpPrice4] = useState<number>(0);
  const [npQuantity, setNpQuantity] = useState<number>(1);
  const [npMinStock, setNpMinStock] = useState<number>(10);
  const [formError, setFormError] = useState<string>('');

  // Auto Generate SKU Code (UPPERCASE ENGLISH LETTERS AND NUMBERS ONLY)
  const generateAutoSku = () => {
    const categoriesList = store.getCategories();
    const selectedCatObj = categoriesList.find(c => c.id === npCategory);
    let catName = selectedCatObj ? selectedCatObj.nameEn || selectedCatObj.nameAr : 'ACC';
    let englishPrefix = catName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (!englishPrefix || englishPrefix.length < 2) {
      englishPrefix = 'ACC';
    }
    const prefix = englishPrefix.slice(0, 3);
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${randomNum}`;
  };

  // Open Add Modal & set initial defaults
  const openAddModal = () => {
    const cats = store.getCategories();
    const defaultCat = cats.length > 0 ? cats[0].id : '';
    setNpCategory(defaultCat);
    setNpNameAr('');
    setNpNameEn('');
    setNpCost(0);
    setNpPrice1(0);
    setNpPrice2(0);
    setNpPrice3(0);
    setNpPrice4(0);
    setNpQuantity(1);
    setNpMinStock(10);
    
    // Set generated SKU in UPPERCASE ENGLISH LETTERS AND NUMBERS ONLY
    const prefix = cats.length > 0 ? cats[0].nameAr.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'ACC' : 'ACC';
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    setNpSku(`${prefix}-${randomNum}`);
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = () => {
    if (!npNameAr.trim()) {
      setFormError('اسم المنتج بالعربية إجباري!');
      return;
    }
    setFormError('');

    const autoGeneratedSku = npSku.trim() ? npSku.trim().toUpperCase() : generateAutoSku();

    const newProduct: Product = {
      id: `p_${Date.now()}`,
      nameEn: npNameAr.trim(),
      nameAr: npNameAr.trim(),
      descriptionEn: '',
      descriptionAr: '',
      categoryId: npCategory || (categories[0]?.id || 'c1'),
      sku: autoGeneratedSku,
      productCode: autoGeneratedSku,
      material: '', color: '', size: '', isActive: true
    };

    const initialQty = Number(npQuantity) || 0;
    const costVal = Number(npCost) || 0;
    const p1Val = Number(npPrice1) || (costVal > 0 ? costVal * 1.2 : 0);
    const p2Val = Number(npPrice2) || p1Val;
    const p3Val = Number(npPrice3) || p1Val;
    const p4Val = Number(npPrice4) || p1Val;

    const branchDataList: ProductBranchData[] = [{
      productId: newProduct.id,
      branchId: activeBranchId,
      cost: costVal,
      price1: p1Val,
      price1Label: 'سعر 1',
      price2: p2Val,
      price2Label: 'سعر 2',
      price3: p3Val,
      price3Label: 'سعر 3',
      price4: p4Val,
      price4Label: 'سعر 4',
      minStock: Number(npMinStock) || 10,
      quantity: initialQty
    }];

    store.addProduct(newProduct, branchDataList);

    // Ensure single barcode QR code item exists for scanning
    const cleanPrefix = autoGeneratedSku.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITM';
    store.generatePhysicalItems(newProduct.id, activeBranchId, initialQty, cleanPrefix);

    setProducts([...store.getProducts()]);
    setIsAddModalOpen(false);
  };

  // Filter products by Active Branch, Category Pills, Search term, and Low Stock Filter Toggle
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // STRICT BRANCH ISOLATION
      const bd = store.getProductBranchData(p.id, activeBranchId);
      const phys = store.getPhysicalItemsByProduct(p.id).filter(i => i.branchId === activeBranchId);
      if (!bd && phys.length === 0) return false;

      const availableCount = Number(bd?.quantity || 0);
      const minStock = Number(bd?.minStock ?? 10);

      // Low Stock Interactive Click Filter
      if (lowStockOnlyFilter && availableCount > minStock) {
        return false;
      }

      // Category filter pill
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) {
        return false;
      }
      
      // Search term filter (Name in Ar/En, SKU, or Product Code)
      if (search.trim()) {
        const term = search.toLowerCase().trim();
        const matchNameAr = p.nameAr.toLowerCase().includes(term);
        const matchNameEn = p.nameEn ? p.nameEn.toLowerCase().includes(term) : false;
        const matchSku = p.sku.toLowerCase().includes(term);
        const matchCode = p.productCode ? p.productCode.toLowerCase().includes(term) : false;

        if (!matchNameAr && !matchNameEn && !matchSku && !matchCode) {
          return false;
        }
      }

      return true;
    });
  }, [products, search, activeBranchId, categoryFilter, lowStockOnlyFilter]);

  return (
    <div className="space-y-6 pb-20 md:pb-6 animate-in fade-in" dir="rtl">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border/80 p-6 rounded-3xl shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <Package size={28} className="text-amber-500 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">المنتجات</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              استعراض وإضافة المنتجات، التنبيه بنقصان المخزون، وتوليد وطباعة أكواد الـ QR بالفرع.
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-end">
            <Button 
              onClick={() => setIsCategoryModalOpen(true)}
              variant="outline"
              className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-bold text-xs px-5 h-11 rounded-2xl gap-2 w-full sm:w-auto shadow-xs"
            >
              <Tag size={18} />
              <span>إدارة الفئات</span>
            </Button>

            <Button 
              onClick={openAddModal} 
              className="shadow-md bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-6 h-11 rounded-2xl gap-2 w-full sm:w-auto"
            >
              <Plus size={18} />
              <span>إضافة منتج جديد</span>
            </Button>
          </div>
        )}
      </div>

      {/* DYNAMIC PER-BRANCH INVENTORY STATS CARDS */}
      <div className="space-y-3 print:hidden">
        <div className="flex justify-between items-center border-b border-border/60 pb-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Package size={18} className="text-amber-500" />
              <span>إدارة وتتبع المخزون بـ ({currentBranchName})</span>
            </h2>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-5`}>
          
          {/* Card 1: Available Physical Items (Cyan Theme - NON-CLICKABLE STATIC DISPLAY) */}
          <Card className="bg-card shadow-xs border border-border/80 border-l-4 border-l-cyan-500 rounded-2xl p-5 min-h-[100px]">
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flex flex-col items-start justify-center gap-1">
                <span className="text-xs font-bold text-muted-foreground">القطع المتاحة بالمعرض</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">
                    {branchStats.availablePieces}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">قطعة</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <Droplet size={22} />
              </div>
            </div>
          </Card>

          {/* Card 2: Total Inventory Financial Value (Indigo Theme - Super Admin Only) */}
          {isAdmin && (
            <Card className="bg-card shadow-xs border border-border/80 border-l-4 border-l-indigo-500 rounded-2xl p-5 min-h-[100px]">
              <div className="flex flex-row items-center justify-between w-full">
                <div className="flex flex-col items-start justify-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-muted-foreground">إجمالي قيمة البضاعة بالمخزن</span>
                    <span className="text-[10px] text-indigo-400 font-bold">(تفاصيل)</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1" dir="ltr">
                    <span className="text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">
                      {branchStats.totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground font-mono">ج.م</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-xs">
                  <Warehouse size={22} />
                </div>
              </div>
            </Card>
          )}

          {/* Card 3: Low Stock Alerts (Amber Theme - CLICKABLE FILTER TOGGLE) */}
          <Card 
            onClick={() => setLowStockOnlyFilter(prev => !prev)}
            className={`bg-card shadow-xs border border-border/80 border-l-4 border-l-amber-500 rounded-2xl p-5 min-h-[100px] cursor-pointer transition-all select-none hover:bg-amber-500/10 hover:border-amber-500/50 ${
              lowStockOnlyFilter 
                ? 'ring-2 ring-amber-500 bg-amber-500/10 shadow-md' 
                : 'ring-1 ring-amber-500/20'
            }`}
          >
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flex flex-col items-start justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">تنبيهات نواقص المخزون</span>
                  {lowStockOnlyFilter && (
                    <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-md animate-pulse">نشط</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                    {branchStats.lowStockCount}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">تنبيه</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all shadow-xs ${
                lowStockOnlyFilter 
                  ? 'bg-amber-500 text-white shadow-md' 
                  : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
              }`}>
                <AlertTriangle size={22} />
              </div>
            </div>
          </Card>

        </div>
      </div>

      {/* SEARCH AND DYNAMIC CATEGORY PILLS BAR */}
      <div className="space-y-4 print:hidden">
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="ابحث باسم المنتج أو بكود الـ SKU..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pr-10 h-12 text-xs rounded-2xl bg-card border-border/80 shadow-2xs w-full" 
          />
        </div>

        {/* Dynamic Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 ${
              categoryFilter === 'all'
                ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/60'
            }`}
          >
            <Tag size={13} />
            <span>الكل</span>
          </button>

          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 ${
                categoryFilter === c.id
                  ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted/60'
              }`}
            >
              <span>{c.nameAr}</span>
            </button>
          ))}
        </div>

      </div>

      {/* PRODUCTS GRID (Clean cards with low stock alerts & out of stock dark state) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 print:hidden">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full bg-card border border-border rounded-3xl p-12 text-center text-muted-foreground space-y-3">
            <Package size={42} className="mx-auto text-muted-foreground/30" />
            <p className="text-sm font-bold">لا توجد منتجات مسجلة بهذه الفئة في {currentBranchName}.</p>
            <p className="text-xs italic">اضغط على زر "إضافة منتج جديد" لإضافة منتجات وتوليد أكواد QR لها بالفرع.</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const branchData = store.getProductBranchData(product.id, activeBranchId);
            const minStock = Number(branchData?.minStock ?? 10);
            const availableCount = Number(branchData?.quantity || 0);
            const categoryObj = store.getCategories().find(c => c.id === product.categoryId);

            const isOutOfStock = availableCount === 0;
            const isLowStock = availableCount > 0 && availableCount <= minStock;

            return (
              <Card 
                key={product.id} 
                className={`transition-all rounded-3xl p-4 flex flex-col justify-between space-y-2.5 group relative ${
                  printModalProduct?.id === product.id ? 'ring-2 ring-amber-500' : ''
                } ${
                  isOutOfStock 
                    ? 'bg-muted/40 border-rose-500/40 opacity-75 shadow-xs' 
                    : isLowStock 
                    ? 'border-amber-500/80 ring-2 ring-amber-500/50 bg-amber-500/5 shadow-md' 
                    : 'bg-card border-border/80 hover:border-amber-500/50 shadow-sm'
                }`}
              >
                {/* Header Badge */}
                <div className="flex justify-between items-start border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs border ${
                      isOutOfStock ? 'bg-rose-500/15 text-rose-600 border-rose-500/30' : isLowStock ? 'bg-amber-500/20 text-amber-500 border-amber-500/40' : 'bg-amber-500/15 text-amber-500 border-amber-500/20'
                    }`}>
                      <Tag size={14} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        {categoryObj?.nameAr || 'عام'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-muted text-foreground font-extrabold border border-border">
                      {product.sku}
                    </span>

                    {/* Stock Alert Badge Header */}
                    {isOutOfStock ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono shadow-xs">
                        نفذت الكمية ⚠️
                      </span>
                    ) : isLowStock ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-black font-mono shadow-xs flex items-center gap-1">
                        <AlertTriangle size={10} /> مخزون منخفض
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Product Name */}
                <div>
                  <h3 className={`text-sm font-bold leading-snug ${isOutOfStock ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {product.nameAr}
                  </h3>
                </div>

                {/* Pricing & Stock Meta Info */}
                <div className="bg-muted/30 p-2.5 rounded-2xl border border-border/50 space-y-1.5 text-xs">
                  {branchData ? (
                    <>
                      {isAdmin && (
                        <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                          <span>سعر التكلفة:</span>
                          <span className="font-mono font-bold text-rose-500">{Number(branchData.cost || 0).toFixed(2)} ج.م</span>
                        </div>
                      )}
                      
                      {/* 4 Selling Prices Grid */}
                      <div className="grid grid-cols-4 gap-1 pt-1 border-t border-border/40 text-[10px] text-center">
                        <div className="bg-amber-500/10 p-1 rounded-xl border border-amber-500/20" title={`سعر 1: ${Number(branchData.price1 || 0).toFixed(2)} ج.م`}>
                          <span className="block text-[9px] text-muted-foreground font-bold">سعر 1</span>
                          <span className="font-mono font-extrabold text-amber-500 whitespace-nowrap">
                            {Number.isInteger(Number(branchData.price1 || 0)) ? Number(branchData.price1 || 0) : Number(branchData.price1 || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-muted/40 p-1 rounded-xl border border-border/60" title={`سعر 2: ${Number(branchData.price2 || branchData.price1 || 0).toFixed(2)} ج.م`}>
                          <span className="block text-[9px] text-muted-foreground font-bold">سعر 2</span>
                          <span className="font-mono font-extrabold text-foreground whitespace-nowrap">
                            {Number.isInteger(Number(branchData.price2 || branchData.price1 || 0)) ? Number(branchData.price2 || branchData.price1 || 0) : Number(branchData.price2 || branchData.price1 || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-muted/40 p-1 rounded-xl border border-border/60" title={`سعر 3: ${Number(branchData.price3 || branchData.price1 || 0).toFixed(2)} ج.م`}>
                          <span className="block text-[9px] text-muted-foreground font-bold">سعر 3</span>
                          <span className="font-mono font-extrabold text-foreground whitespace-nowrap">
                            {Number.isInteger(Number(branchData.price3 || branchData.price1 || 0)) ? Number(branchData.price3 || branchData.price1 || 0) : Number(branchData.price3 || branchData.price1 || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-muted/40 p-1 rounded-xl border border-border/60" title={`سعر 4: ${Number(branchData.price4 || branchData.price1 || 0).toFixed(2)} ج.م`}>
                          <span className="block text-[9px] text-muted-foreground font-bold">سعر 4</span>
                          <span className="font-mono font-extrabold text-foreground whitespace-nowrap">
                            {Number.isInteger(Number(branchData.price4 || branchData.price1 || 0)) ? Number(branchData.price4 || branchData.price1 || 0) : Number(branchData.price4 || branchData.price1 || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">لا يوجد تسعير مسجل.</div>
                  )}

                  <div className={`flex justify-between items-center pt-1 border-t border-border/40 font-bold ${
                    isOutOfStock ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-amber-500'
                  }`}>
                    <span className="flex items-center gap-1 text-[11px]">
                      <Package size={13} /> القطع المتاحة بالفرع:
                    </span>
                    <span className={`font-mono text-xs px-2 py-0.5 rounded-lg border font-bold ${
                      isOutOfStock ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : isLowStock ? 'bg-amber-500/15 border-amber-500/30 text-amber-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                    }`}>
                      {availableCount} قطعة
                    </span>
                  </div>
                </div>

                {/* Out of stock banner only */}
                {isOutOfStock && (
                  <div className="bg-rose-500/15 p-2 rounded-xl text-rose-600 font-bold text-center text-[11px] border border-rose-500/30 flex items-center justify-center gap-1">
                    <AlertCircle size={14} />
                    <span>نفذت الكمية بالكامل من الفرع!</span>
                  </div>
                )}

                {/* Actions: Thermal QR Label Print & 3 Vertical Dots Options Menu */}
                <div className="pt-0.5 flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    disabled={isOutOfStock}
                    className="flex-1 h-10 text-xs font-bold rounded-2xl gap-1.5 transition-all shadow-xs bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500 hover:text-black"
                    onClick={() => {
                      setPrintModalProduct(product);
                      setPrintCopies(1);
                      setPrintFeedback(null);
                      setShowConfigSettings(false);
                    }}
                  >
                    <Printer size={15} />
                    <span>طباعة ملصق الـ QR</span>
                  </Button>

                  {isAdmin && (
                    <Button 
                      variant="outline" 
                      className="h-10 w-10 p-0 flex items-center justify-center text-xs font-bold rounded-2xl transition-all bg-muted/60 text-foreground border-border hover:bg-accent shrink-0 shadow-xs"
                      onClick={() => setOptionsProduct(product)}
                      title="خيارات المنتج (ريستوك، تعديل، حذف)"
                    >
                      <MoreVertical size={18} />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* ADD NEW PRODUCT MODAL DIALOG */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-xl bg-card border-border rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]" dir="rtl">
          
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0">
            <DialogTitle className="font-serif text-lg font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-amber-500" />
              <span>إضافة منتج جديد لـ {currentBranchName}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs scrollbar-none">
            
            {/* Form Error Banner */}
            {formError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-600 font-bold rounded-xl">
                {formError}
              </div>
            )}

            {/* Product Name Arabic & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  اسم المنتج بالعربية <span className="text-rose-500">*</span>
                </Label>
                <Input 
                  placeholder="مثال: سلسلة فضة عيار 925..." 
                  value={npNameAr} 
                  onChange={e => {
                    setNpNameAr(e.target.value);
                    if (e.target.value.trim()) setFormError('');
                  }} 
                  className="rounded-xl h-11 text-xs" 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  الفئة (خاتم، سلسلة...) <span className="text-rose-500">*</span>
                </Label>
                <CustomSelect
                  value={npCategory}
                  onChange={(val) => {
                    setNpCategory(val);
                    const cats = store.getCategories();
                    const selCat = cats.find(c => c.id === val);
                    const prefix = selCat ? selCat.nameAr.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'ACC' : 'ACC';
                    const randomNum = Math.floor(10000 + Math.random() * 90000);
                    setNpSku(`${prefix}-${randomNum}`);
                  }}
                  placeholder="اختر الفئة..."
                  options={categories.map(c => ({
                    value: c.id,
                    label: c.nameAr
                  }))}
                />
              </div>
            </div>

            {/* Pricing & Cost Inputs */}
            <div className="bg-muted/20 p-4 rounded-2xl border border-border/60 space-y-4">
              <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <DollarSign size={16} className="text-amber-500" />
                <span>تحديد التكلفة وأسعار البيع بالفرع (ج.م)</span>
              </h4>

              {/* Cost Price - Full Row */}
              <div className="space-y-1.5 bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/20">
                <Label className="text-rose-600 font-bold text-xs">سعر التكلفة (واقف عليا بكام)</Label>
                <Input 
                  type="number" 
                  min={0}
                  value={npCost || ''} 
                  onChange={e => setNpCost(Number(e.target.value))} 
                  className="rounded-xl h-11 font-mono font-bold text-sm bg-background" 
                />
              </div>

              {/* Price 1, Price 2, Price 3, Price 4 - 4 Columns Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1.5 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  <Label className="text-amber-500 font-bold text-xs">سعر 1</Label>
                  <Input 
                    type="number" 
                    min={0}
                    value={npPrice1 || ''} 
                    onChange={e => setNpPrice1(Number(e.target.value))} 
                    className="rounded-xl h-10 font-mono font-bold text-xs bg-background" 
                  />
                </div>

                <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border/60">
                  <Label className="text-foreground font-bold text-xs">سعر 2</Label>
                  <Input 
                    type="number" 
                    min={0}
                    value={npPrice2 || ''} 
                    onChange={e => setNpPrice2(Number(e.target.value))} 
                    className="rounded-xl h-10 font-mono font-bold text-xs bg-background" 
                  />
                </div>

                <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border/60">
                  <Label className="text-foreground font-bold text-xs">سعر 3</Label>
                  <Input 
                    type="number" 
                    min={0}
                    value={npPrice3 || ''} 
                    onChange={e => setNpPrice3(Number(e.target.value))} 
                    className="rounded-xl h-10 font-mono font-bold text-xs bg-background" 
                  />
                </div>

                <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border/60">
                  <Label className="text-foreground font-bold text-xs">سعر 4</Label>
                  <Input 
                    type="number" 
                    min={0}
                    value={npPrice4 || ''} 
                    onChange={e => setNpPrice4(Number(e.target.value))} 
                    className="rounded-xl h-10 font-mono font-bold text-xs bg-background" 
                  />
                </div>
              </div>
            </div>

            {/* Initial Quantity & Low Stock Threshold Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-amber-500">كمية القطع للمخزون بـ ({currentBranchName})</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={npQuantity} 
                  onChange={e => setNpQuantity(Math.max(1, Number(e.target.value)))} 
                  className="rounded-xl h-11 text-xs font-mono font-bold text-center bg-background border-amber-500/40" 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-amber-600">الحد الأدنى للمخزون (تنبيه بالنقصان)</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={npMinStock} 
                  onChange={e => setNpMinStock(Math.max(1, Number(e.target.value)))} 
                  className="rounded-xl h-11 text-xs font-mono font-bold text-center bg-background border-amber-500/40" 
                />
              </div>
            </div>

          </div>

          <div className="p-4 border-t border-border flex justify-end gap-3 bg-card shrink-0 z-10">
            <Button 
              variant="outline" 
              onClick={() => setIsAddModalOpen(false)} 
              className="rounded-xl text-xs font-bold border-border"
            >
              إلغاء
            </Button>

            <Button 
              onClick={handleSaveProduct} 
              className="rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black gap-2 px-5 shadow-sm"
            >
              <Plus size={16} />
              <span>حفظ المنتج وتوليد أكواد الـ QR</span>
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      {/* EDIT PRODUCT MODAL DIALOG */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl bg-card border-border rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]" dir="rtl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/30 shrink-0">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Pencil className="text-amber-500" size={20} />
              <span>تعديل بيانات المنتج والمخزون</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-none">
            
            {editFormError && (
              <div className="bg-destructive/15 border border-destructive/30 text-destructive text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{editFormError}</span>
              </div>
            )}

            {/* Product Name (Arabic) & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">اسم المنتج بالعربية <span className="text-rose-500">*</span></Label>
                <Input 
                  value={epNameAr} 
                  onChange={e => setEpNameAr(e.target.value)} 
                  placeholder="مثال: خاتم أسد فاخر" 
                  className="rounded-xl h-11 text-xs font-bold" 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الفئة / التصنيف</Label>
                <CustomSelect
                  value={epCategory}
                  onChange={(val) => setEpCategory(val)}
                  options={categories.map(c => ({
                    value: c.id,
                    label: c.nameAr
                  }))}
                />
              </div>
            </div>

            {/* Pricing Breakdown (Cost & 3 Selling Prices) */}
            <div className="bg-muted/30 p-4 rounded-2xl border border-border/60 space-y-3">
              <Label className="text-xs font-bold text-foreground block">تعديل أسعار المنتج (ج.م)</Label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                  <Label className="text-xs font-bold text-rose-500">سعر التكلفة</Label>
                  <Input 
                    type="number" 
                    step="0.5" 
                    min={0} 
                    value={epCost || ''} 
                    onChange={e => setEpCost(Number(e.target.value))} 
                    className="rounded-xl h-10 text-xs font-mono font-bold text-center bg-background border-rose-500/30" 
                  />
                </div>

                <div className="space-y-1.5 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  <Label className="text-xs font-bold text-amber-500">سعر 1</Label>
                  <Input 
                    type="number" 
                    step="0.5" 
                    min={0} 
                    value={epPrice1 || ''} 
                    onChange={e => setEpPrice1(Number(e.target.value))} 
                    className="rounded-xl h-10 text-xs font-mono font-bold text-center bg-background border-amber-500/40" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 bg-muted/40 p-3 rounded-xl border border-border/60">
                  <Label className="text-xs font-bold text-foreground">سعر 2</Label>
                  <Input 
                    type="number" 
                    step="0.5" 
                    min={0} 
                    value={epPrice2 || ''} 
                    onChange={e => setEpPrice2(Number(e.target.value))} 
                    className="rounded-xl h-10 text-xs font-mono font-bold text-center bg-background" 
                  />
                </div>

                <div className="space-y-1.5 bg-muted/40 p-3 rounded-xl border border-border/60">
                  <Label className="text-xs font-bold text-foreground">سعر 3</Label>
                  <Input 
                    type="number" 
                    step="0.5" 
                    min={0} 
                    value={epPrice3 || ''} 
                    onChange={e => setEpPrice3(Number(e.target.value))} 
                    className="rounded-xl h-10 text-xs font-mono font-bold text-center bg-background" 
                  />
                </div>

                <div className="space-y-1.5 bg-muted/40 p-3 rounded-xl border border-border/60">
                  <Label className="text-xs font-bold text-foreground">سعر 4</Label>
                  <Input 
                    type="number" 
                    step="0.5" 
                    min={0} 
                    value={epPrice4 || ''} 
                    onChange={e => setEpPrice4(Number(e.target.value))} 
                    className="rounded-xl h-10 text-xs font-mono font-bold text-center bg-background" 
                  />
                </div>
              </div>
            </div>

            {/* Quantity in Active Branch & Minimum Stock Alert Threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-amber-600">القطع المتاحة بالفرع ({currentBranchName})</Label>
                <Input 
                  type="number" 
                  min={0} 
                  value={epQuantity} 
                  onChange={e => setEpQuantity(Math.max(0, Number(e.target.value)))} 
                  className="rounded-xl h-11 text-xs font-mono font-bold text-center bg-background border-amber-500/40" 
                />
                <p className="text-[10px] text-muted-foreground">تعديل وتصحيح عدد القطع المتاحة بالمعرض حالياً.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-cyan-600">الحد الأدنى لتنبيه نقصان المخزون</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={epMinStock} 
                  onChange={e => setEpMinStock(Math.max(1, Number(e.target.value)))} 
                  className="rounded-xl h-11 text-xs font-mono font-bold text-center bg-background border-cyan-500/40" 
                />
                <p className="text-[10px] text-muted-foreground">تنبيه عند انخفاض المتاح بالفرع عن هذا الحد.</p>
              </div>
            </div>

          </div>

          <div className="p-4 border-t border-border flex items-center justify-end gap-2.5 bg-card shrink-0 z-10">
            <Button 
              variant="outline" 
              onClick={() => setIsEditModalOpen(false)} 
              className="rounded-xl text-xs font-bold border-border h-11 px-4"
            >
              إلغاء
            </Button>

            <Button 
              onClick={handleSaveProductEdit} 
              className="rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black gap-2 h-11 px-5 shadow-sm"
            >
              <CheckCircle2 size={16} />
              <span>حفظ التعديلات</span>
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------------- */}
      {/* ULTRA-CLEAN PRINT PRODUCT LABEL MODAL DIALOG */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={!!printModalProduct} onOpenChange={(open) => !open && setPrintModalProduct(null)}>
        <DialogContent className="max-w-md w-[92vw] max-h-[90vh] flex flex-col bg-card border-border rounded-3xl p-5 shadow-2xl overflow-hidden" dir="rtl">
          
          {/* Header (Pinned) */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Printer size={18} className="text-amber-500" />
              <span>طباعة الملصق (بالعرض)</span>
            </h3>
          </div>

          {printModalProduct && (
            <div className="space-y-4 overflow-y-auto flex-1 pr-1 pl-1">
              
              {(() => {
                const bd = store.getProductBranchData(printModalProduct.id, activeBranchId);
                const rawPrice4 = bd?.price4 !== undefined && bd?.price4 !== null && bd?.price4 !== 0 
                  ? bd.price4 
                  : (bd?.price1 || '');
                const price4Display = rawPrice4 !== '' ? String(rawPrice4) : '';

                return (
                  <>
                    {/* Realistic Thermal Label Sticker Preview (Exact 40x25mm: QR Left, Info Right) */}
                    <div 
                      className="bg-white text-black p-2 rounded-2xl border border-border/80 shadow-md flex flex-row items-center justify-between mx-auto overflow-hidden select-none transition-all w-[260px] h-[140px]"
                      dir="ltr"
                    >
                      {/* Element 1: QR Code on the Left */}
                      <div id="label-qr-preview-container" className="p-0.5 bg-white shrink-0 flex items-center justify-center w-[115px] h-[115px]">
                        <QRCodeSVG value={printModalProduct.sku} size={110} level="M" />
                      </div>

                      {/* Element 2: Details on the Right */}
                      <div className="flex-1 h-[115px] flex flex-col justify-center text-right px-2" dir="rtl">
                        {/* Serial Number */}
                        <p className="font-mono font-bold text-[11px] text-gray-800 tracking-wider truncate mb-1" dir="ltr" style={{ textAlign: 'right' }}>
                          {printModalProduct.sku}
                        </p>

                        {/* Item Title */}
                        <p className="font-normal text-xs text-gray-900 leading-tight truncate mb-2">
                          {printModalProduct.nameAr}
                        </p>

                        {/* Price Tag */}
                        <p className="font-black text-sm text-black">
                          {price4Display || '—'} <span className="text-[10px] font-normal">ج.م</span>
                        </p>
                      </div>
                    </div>

                    {/* Product Meta Info */}
                    <div className="space-y-2 text-xs bg-muted/30 p-3.5 rounded-2xl border border-border/50" dir="rtl">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-bold">المنتج:</span>
                        <span className="font-bold text-foreground line-clamp-1 max-w-[180px]">{printModalProduct.nameAr}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-border/40 pt-1.5">
                        <span className="text-muted-foreground font-bold">السيريال:</span>
                        <span className="font-mono font-black text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                          {printModalProduct.sku}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-border/40 pt-1.5">
                        <span className="text-muted-foreground font-bold">سعر 4 المطبوع:</span>
                        <span className="font-mono font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          {price4Display ? `${price4Display} ج.م` : 'غير محدد'}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Label Roll Size Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" dir="rtl">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground block text-right">
                    مقاس التيكت:
                  </Label>
                  <CustomSelect
                    size="sm"
                    value={labelSize}
                    onChange={(val: any) => setLabelSize(val as any)}
                    options={[
                      { value: '40x25', label: '40 × 25 مم (الافتراضي)', sublabel: 'المقاس الفعلي للتيكت' },
                      { value: '38x25', label: '38 × 25 مم', sublabel: '3.8 × 2.5 سم' },
                      { value: '50x25', label: '50 × 25 مم', sublabel: 'عرضي كبير' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground block text-right">
                    اتجاه الطباعة:
                  </Label>
                  <CustomSelect
                    size="sm"
                    value={printOrientation}
                    onChange={(val: any) => setPrintOrientation(val as any)}
                    options={[
                      { value: 'landscape', label: 'بالعرض (Landscape)', sublabel: 'معدول على تيكت واحد (موصى به)' },
                      { value: 'portrait', label: 'بالطول (Portrait)', sublabel: 'إذا كانت طابعتك مضبوطة بالطول' },
                    ]}
                  />
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="space-y-2" dir="rtl">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-foreground">
                    عدد الملصقات (الكمية):
                  </Label>
                  <span className="text-xs font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    سيتم طباعة: {printCopies} ملصق
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPrintCopies(c => Math.max(1, c - 1))}
                    className="h-11 w-11 rounded-xl text-lg font-bold shrink-0 border-border"
                  >
                    −
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={printCopies}
                    onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value)))}
                    className="h-11 text-base font-mono font-bold text-center rounded-xl bg-card border-border shadow-2xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPrintCopies(c => c + 1)}
                    className="h-11 w-11 rounded-xl text-lg font-bold shrink-0 border-border"
                  >
                    +
                  </Button>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setPrintCopies(1)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      printCopies === 1
                        ? 'bg-amber-500 text-black border-amber-500'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/60'
                    }`}
                  >
                    1 ملصق فقط
                  </button>
                  {(() => {
                    const bd = store.getProductBranchData(printModalProduct.id, activeBranchId);
                    const stock = Number(bd?.quantity || 0);
                    if (stock > 1) {
                      return (
                        <button
                          type="button"
                          onClick={() => setPrintCopies(stock)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                            printCopies === stock
                              ? 'bg-amber-500 text-black border-amber-500'
                              : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/60'
                          }`}
                        >
                          كل المتاح في الفرع ({stock})
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Important Thermal Print Calibration Warning */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 space-y-1.5" dir="rtl">
                <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <Printer size={15} className="shrink-0" />
                  <span>تعليمات الطباعة لمنع الشقلبة وضمان خروج تيكت واحد مضبوط:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed opacity-95 pr-1">
                  <li>في نافذة طباعة كروم: تأكد أن <strong>الاتجاه (Layout)</strong> مضبوط على <strong>بالعرض (Landscape)</strong> لمنع خروج التيكت بالمشقلب.</li>
                  <li>اضبط <strong>الهوامش (Margins)</strong> على <strong>بلا (None)</strong>.</li>
                  <li>ألغِ تحديد خيار <strong>الرؤوس والتذييلات (Headers and footers)</strong>.</li>
                  <li>ستلاحظ في معاينة كروم أن المستند صفحة واحدة فقط (1 من 1) وبداخله الكيو آر والبيانات معدولين تماماً.</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2" dir="rtl">
                <Button
                  type="button"
                  onClick={handleExecutePrintLabels}
                  className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-sm rounded-xl shadow-md gap-2 flex items-center justify-center transition-all active:scale-[0.98]"
                >
                  <Printer size={18} />
                  <span>
                    {printCopies === 1 ? 'طباعة الملصق' : `طباعة (${printCopies}) ملصق`}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPrintModalProduct(null)}
                  className="w-full h-9 text-xs text-muted-foreground hover:text-foreground font-bold rounded-xl"
                >
                  إلغاء
                </Button>
              </div>

            </div>
          )}

        </DialogContent>
      </Dialog>

      {/* CATEGORY MANAGEMENT POPUP MODAL */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border p-4 sm:p-6 rounded-3xl space-y-4 shadow-2xl" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Tag size={20} className="text-amber-500" />
              <span>إدارة الفئات</span>
            </DialogTitle>
          </DialogHeader>

          {/* Add New Category Form */}
          <div className="space-y-2 bg-muted/20 p-3.5 sm:p-4 rounded-2xl border border-border/60">
            <Label className="text-xs font-bold text-foreground block">إضافة فئة (Category) جديدة</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="أدخل اسم الفئة (مثال: سلسلة فضة، خاتم...)"
                value={modalCategoryName}
                onChange={(e) => {
                  setModalCategoryName(e.target.value);
                  if (e.target.value.trim()) setModalCatError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCategoryFromModal();
                }}
                className="h-10 text-xs rounded-xl bg-background flex-1"
              />
              <Button
                onClick={handleAddCategoryFromModal}
                className="h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl gap-1 shrink-0 justify-center"
              >
                <Plus size={16} />
                <span>إضافة</span>
              </Button>
            </div>
            {modalCatError && (
              <p className="text-xs text-rose-500 font-bold mt-1">{modalCatError}</p>
            )}
          </div>

          {/* Existing Categories List with Delete */}
          <div className="space-y-2.5 pt-1">
            <h4 className="text-xs font-bold text-muted-foreground flex justify-between items-center">
              <span>الفئات الحالية المعتمدة ({categories.length}):</span>
              <span className="text-[10px] text-muted-foreground">اضغط سلة المهملات للحذف</span>
            </h4>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-none">
              {categories.map((cat) => {
                const productCount = products.filter(p => {
                  if (p.categoryId !== cat.id) return false;
                  const bd = store.getProductBranchData(p.id, activeBranchId);
                  const phys = store.getPhysicalItemsByProduct(p.id).filter(i => i.branchId === activeBranchId);
                  return Boolean(bd || phys.length > 0);
                }).length;
                return (
                  <div 
                    key={cat.id} 
                    className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/20 border border-border/70 rounded-2xl hover:border-amber-500/40 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-xs">
                        <Tag size={15} />
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-foreground">{cat.nameAr}</h5>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {productCount} منتج مرتبط
                        </span>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => handleDeleteCategoryFromModal(cat.id, cat.nameAr)}
                      className="text-muted-foreground hover:text-rose-500 p-1.5 rounded-lg transition-colors"
                      title="حذف الفئة"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------------- */}
      {/* PRODUCT OPTIONS POPUP (3 DOTS MENU) */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={!!optionsProduct} onOpenChange={(open) => !open && setOptionsProduct(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xs sm:max-w-sm bg-card border-border rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4" dir="rtl">
          <DialogHeader className="pb-2.5 border-b border-border/60">
            <DialogTitle className="text-base font-bold text-foreground line-clamp-1 pr-6 text-right">
              {optionsProduct?.nameAr}
            </DialogTitle>
          </DialogHeader>

          {optionsProduct && (
            <div className="space-y-2.5 pt-1">
              
              {/* Option 1: Restock */}
              <Button
                type="button"
                onClick={() => {
                  const target = optionsProduct;
                  setOptionsProduct(null);
                  setRestockProduct(target);
                  setRestockAmount('');
                  setRestockError('');
                }}
                className="w-full h-14 justify-start bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 rounded-2xl font-bold text-xs gap-3 p-3.5 transition-all shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <PackagePlus size={18} />
                </div>
                <div className="flex flex-col items-start text-right">
                  <span className="text-xs font-bold text-emerald-600">ريستوك (تزويد بضاعة جديدة)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">إدخال الكمية الجديدة فور وصول شحنة</span>
                </div>
              </Button>

              {/* Option 2: Edit */}
              <Button
                type="button"
                onClick={() => {
                  const target = optionsProduct;
                  setOptionsProduct(null);
                  openEditModal(target);
                }}
                className="w-full h-14 justify-start bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-2xl font-bold text-xs gap-3 p-3.5 transition-all shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-black flex items-center justify-center shrink-0">
                  <Pencil size={18} />
                </div>
                <div className="flex flex-col items-start text-right">
                  <span className="text-xs font-bold text-amber-500">تعديل (الأسعار والمخزون)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">تعديل الاسم والأسعار ومستوى المخزون</span>
                </div>
              </Button>

              {/* Option 3: Delete */}
              <Button
                type="button"
                onClick={() => {
                  const target = optionsProduct;
                  setOptionsProduct(null);
                  if (target) setDeleteConfirmProduct(target);
                }}
                className="w-full h-14 justify-start bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-2xl font-bold text-xs gap-3 p-3.5 transition-all shadow-2xs"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <Trash2 size={18} />
                </div>
                <div className="flex flex-col items-start text-right">
                  <span className="text-xs font-bold text-rose-500">حذف المنتج</span>
                  <span className="text-[10px] text-muted-foreground font-normal">حذف المنتج نهائياً من السيستم</span>
                </div>
              </Button>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------------- */}
      {/* RESTOCK MODAL DIALOG */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={!!restockProduct} onOpenChange={(open) => !open && setRestockProduct(null)}>
        <DialogContent className="max-w-xs sm:max-w-md w-[95vw] bg-card border-border rounded-3xl p-6 shadow-2xl space-y-5" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <PackagePlus size={20} className="text-emerald-500" />
              <span>ريستوك (إضافة شحنة جديدة)</span>
            </DialogTitle>
          </DialogHeader>

          {restockProduct && (
            <div className="space-y-4">
              
              {/* Product Summary Banner */}
              <div className="bg-muted/30 p-3.5 rounded-2xl border border-border/60 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-foreground">{restockProduct.nameAr}</h4>
                  <span className="text-[10px] text-muted-foreground font-mono">{restockProduct.sku}</span>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-muted-foreground block font-bold">المخزون الحالي بالفرع:</span>
                  <span className="font-mono font-bold text-emerald-500 text-sm">
                    {Number(store.getProductBranchData(restockProduct.id, activeBranchId)?.quantity || 0)} قطعة
                  </span>
                </div>
              </div>

              {/* Error alert if any */}
              {restockError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-600 text-xs font-bold rounded-xl">
                  {restockError}
                </div>
              )}

              {/* Single Input Field: Quantity of incoming stock */}
              <div className="space-y-2 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                <Label className="text-xs font-bold text-emerald-600 block">
                  الكمية الجديدة المصلة (عدد القطع المضافة): <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={restockAmount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setRestockAmount(val);
                    if (val && val > 0) setRestockError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRestock();
                  }}
                  className="h-12 text-base font-mono font-extrabold text-center rounded-xl bg-background border-emerald-500/40 text-emerald-600 shadow-2xs"
                  autoFocus
                />
              </div>

              {/* Total projection display */}
              {typeof restockAmount === 'number' && restockAmount > 0 && (
                <div className="bg-card p-3 rounded-xl border border-emerald-500/30 text-center font-bold text-xs text-foreground flex items-center justify-center gap-2">
                  <span>الإجمالي الجديد بعد الإضافة:</span>
                  <span className="font-mono text-emerald-500 font-extrabold text-sm">
                    {Number(store.getProductBranchData(restockProduct.id, activeBranchId)?.quantity || 0) + restockAmount} قطعة
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRestockProduct(null)}
                  className="flex-1 h-11 text-xs font-bold rounded-xl border-border"
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveRestock}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md gap-1.5"
                >
                  <PackagePlus size={16} />
                  <span>تأكيد الإضافة (ريستوك)</span>
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------------- */}
      {/* DELETE PRODUCT CUSTOM CONFIRMATION POPUP MODAL */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={!!deleteConfirmProduct} onOpenChange={(open) => !open && setDeleteConfirmProduct(null)}>
        <DialogContent className="max-w-xs sm:max-w-md w-[92vw] bg-card border-border rounded-3xl p-6 shadow-2xl space-y-4" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-base font-bold text-rose-500 flex items-center gap-2">
              <AlertTriangle size={20} className="text-rose-500" />
              <span>تأكيد حذف المنتج</span>
            </DialogTitle>
          </DialogHeader>

          {deleteConfirmProduct && (
            <div className="space-y-4">
              <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 text-xs space-y-2">
                <p className="font-bold text-foreground leading-relaxed text-sm">
                  هل أنت تأكد من حذف المنتج <span className="text-rose-500 font-extrabold">({deleteConfirmProduct.nameAr})</span> بالكامل من النظام؟
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ⚠️ سيؤدي هذا الإجراء إلى مسح المنتج وأكواده وجميع بيانات تسعيره نهائياً من السيستم.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteConfirmProduct(null)}
                  className="flex-1 h-11 text-xs font-bold rounded-xl border-border"
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  onClick={confirmDeleteProductAction}
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

      {/* ------------------------------------------------------------------------- */}
      {/* DELETE CATEGORY CUSTOM CONFIRMATION POPUP MODAL */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={!!deleteConfirmCategory} onOpenChange={(open) => !open && setDeleteConfirmCategory(null)}>
        <DialogContent className="max-w-xs sm:max-w-md w-[92vw] bg-card border-border rounded-3xl p-6 shadow-2xl space-y-4 z-50" dir="rtl">
          {deleteConfirmCategory && (() => {
            const linkedProductsCount = products.filter(p => p.categoryId === deleteConfirmCategory.id).length;
            const isBlocked = linkedProductsCount > 0;

            return (
              <>
                <DialogHeader className="pb-3 border-b border-border/60">
                  <DialogTitle className={`text-base font-bold flex items-center gap-2 ${isBlocked ? 'text-amber-500' : 'text-rose-500'}`}>
                    <AlertTriangle size={20} className={isBlocked ? 'text-amber-500' : 'text-rose-500'} />
                    <span>{isBlocked ? 'ممنوع حذف الفئة' : 'تأكيد حذف الفئة'}</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {isBlocked ? (
                    <div className="bg-rose-500/15 p-4 rounded-2xl border border-rose-500/30 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-rose-500 font-extrabold text-sm">
                        <AlertCircle size={18} />
                        <span>عفواً، لا يمكن حذف الفئة ({deleteConfirmCategory.nameAr})</span>
                      </div>
                      <p className="font-bold text-foreground leading-relaxed text-sm">
                        تحتوي هذه الفئة حالياً على <span className="text-rose-500 font-extrabold font-mono text-base">({linkedProductsCount})</span> منتج مرتبط بها.
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        ⚠️ لحماية البيانات والمخزون، يرجى إعادة تخصيص المنتجات لفئة أخرى أو حذفها أولاً قبل إمكانية حذف هذه الفئة.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 text-xs space-y-2">
                      <p className="font-bold text-foreground leading-relaxed text-sm">
                        هل أنت تأكد من حذف فئة <span className="text-rose-500 font-extrabold">"{deleteConfirmCategory.nameAr}"</span>؟
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        ⚠️ لا تحتوي هذه الفئة على أي منتجات مسجلة. سيتم حذفها نهائياً من النظام وقاعدة البيانات.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-3">
                    {isBlocked ? (
                      <Button
                        type="button"
                        onClick={() => setDeleteConfirmCategory(null)}
                        className="w-full h-11 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-black shadow-md"
                      >
                        حسناً، فهمت ذلك
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDeleteConfirmCategory(null)}
                          className="flex-1 h-11 text-xs font-bold rounded-xl border-border"
                        >
                          إلغاء
                        </Button>
                        <Button
                          type="button"
                          onClick={confirmDeleteCategoryAction}
                          className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md gap-1.5"
                        >
                          <Trash2 size={16} />
                          <span>نعم، تأكيد الحذف</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
};
