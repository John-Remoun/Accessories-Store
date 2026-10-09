import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../../services/store';
import { PhysicalItem, Product, ProductBranchData, Customer, Invoice, InternalComponent, ExternalComponent, ProductComposition } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/card';
import { 
  ScanLine, Search, X, CheckCircle2, ShoppingCart, User, Phone, 
  Clock, DollarSign, Printer, MessageCircle, QrCode, Plus, Minus, Trash2, 
  Sparkles, CreditCard, Send, Check, AlertCircle, Package, ChevronDown, Star,
  Filter, Layers
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { CustomSelect } from '../../components/ui/CustomSelect';
import vodafoneLogo from '../../assets/vodafone-logo.png';
import instapayLogo from '../../assets/instapay-logo.png';
import lightLogo from '../../assets/light-logo.png';

interface CartLineItem {
  physicalItemId: string;
  product: Product;
  branchData: ProductBranchData;
  priceTier: 'price1' | 'price2' | 'price3' | 'price4';
  selectedPrice: number;
  quantity: number;
}

// Custom Searchable Product Combobox for POS Composition Modal
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
    <div className="relative flex-1 min-w-[180px]">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 px-3.5 border border-border/80 rounded-xl bg-background text-foreground text-xs font-bold flex items-center justify-between shadow-2xs hover:border-amber-500/50 transition-all text-right"
      >
        <span className="truncate">
          {selectedProduct ? (
            <span className="font-bold text-foreground">{selectedProduct.nameAr}</span>
          ) : (
            <span className="text-muted-foreground font-normal">اختار او ابحث</span>
          )}
        </span>
        <ChevronDown size={16} className="text-muted-foreground shrink-0 ml-1" />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-1.5 right-0 left-0 bg-card border border-border/90 rounded-2xl shadow-2xl p-2 space-y-2 animate-in fade-in zoom-in-95 min-w-[280px]">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="اختار او ابحث..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full h-9 pr-9 pl-3 text-xs bg-muted/40 border border-border/60 rounded-xl text-foreground font-bold outline-none focus:ring-1 focus:ring-amber-500"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-none pr-1">
            {filteredProducts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-3">لا توجد منتجات مطابقة للبحث.</p>
            ) : (
              filteredProducts.map(p => {
                const stockCount = store.getPhysicalItemsByBranch(activeBranchId).filter(i => i.productId === p.id && i.status === 'available').length;
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
                      isSel ? 'bg-amber-500/15 text-amber-500 font-bold border border-amber-500/30' : 'hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <span className="font-bold">{p.nameAr}</span>
                    <span className="text-[11px] font-extrabold font-mono text-amber-500 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
                      {stockCount}
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

export const POS = () => {
  const { user } = useAuth();
  const location = useLocation();

  const currentBranchId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('id') || localStorage.getItem('last_active_branch') || user?.branchId || 'b1';
  }, [location.search, user?.branchId]);

  // Master State
  const [cart, setCart] = useState<CartLineItem[]>([]);
  
  // Product & Category Selection Form State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedPriceTier, setSelectedPriceTier] = useState<'price1' | 'price2' | 'price3' | 'price4'>('price1');
  const [inputQuantity, setInputQuantity] = useState<number>(1);
  const [qrScanInput, setQrScanInput] = useState<string>('');

  // Customer & Payment Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerError, setCustomerError] = useState<string>('');
  const [isCustomerFavorite, setIsCustomerFavorite] = useState<boolean>(false);
  const [customersList, setCustomersList] = useState<Customer[]>(() => store.getCustomers());

  const handleSelectCustomer = (custId: string) => {
    setSelectedCustomerId(custId);
    if (!custId) {
      setCustomerName('');
      setCustomerPhone('');
      setIsCustomerFavorite(false);
      return;
    }
    const cust = customersList.find(c => c.id === custId);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone);
      setIsCustomerFavorite(true);
      setCustomerError('');
    }
  };

  const handleToggleStarCustomer = () => {
    const cName = customerName.trim();
    const cPhone = customerPhone.trim();

    if (!cName && !cPhone) {
      setCustomerError('اكتب اسم العميل ورقم التليفون أولاً لإضافته للمفضلة!');
      return;
    }
    setCustomerError('');

    if (isCustomerFavorite) {
      // Un-star: remove from favorite store list
      if (cPhone) {
        store.removeCustomer(cPhone);
      } else if (selectedCustomerId) {
        store.removeCustomer(selectedCustomerId);
      }
      setIsCustomerFavorite(false);
      setSelectedCustomerId('');
      setCustomersList([...store.getCustomers()]);
    } else {
      // Star: add to favorite store list
      const existing = customersList.find(c => (cPhone && c.phone.trim() === cPhone) || (cName && c.name.trim() === cName));
      const targetId = existing?.id || selectedCustomerId || `cust_${Date.now()}`;
      const newCust: Customer = {
        id: targetId,
        name: cName || 'عميل مفضل',
        phone: cPhone || ''
      };
      store.addCustomer(newCust);
      setSelectedCustomerId(targetId);
      setIsCustomerFavorite(true);
      setCustomersList([...store.getCustomers()]);
    }
  };
  
  // Payment Status: 'paid' | 'partial' | 'deferred'
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'deferred'>('paid');
  // Payment Sub Method: 'cash' | 'vodafone_cash' | 'instapay'
  const [paymentSubMethod, setPaymentSubMethod] = useState<'cash' | 'vodafone_cash' | 'instapay'>('cash');
  
  const [paidAmountInput, setPaidAmountInput] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);

  // Scanner Dialog State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string>('');
  const [lastPrintedInvoice, setLastPrintedInvoice] = useState<Invoice | null>(null);

  // Add Composition Dialog State
  const [isCompositionModalOpen, setIsCompositionModalOpen] = useState<boolean>(false);
  const [compName, setCompName] = useState<string>('');
  const [customSellingPrice, setCustomSellingPrice] = useState<number>(0);
  const [internalItems, setInternalItems] = useState<InternalComponent[]>([
    { productId: '', quantity: 1, selectedPriceTier: 'price1' }
  ]);
  const [externalItems, setExternalItems] = useState<ExternalComponent[]>([]);
  const [compFormError, setCompFormError] = useState<string>('');

  const calculatedTotalComponentCost = useMemo(() => {
    let internalSum = 0;
    internalItems.forEach(item => {
      if (item.productId) {
        const bData = store.getProductBranchData(item.productId, currentBranchId);
        if (bData) {
          const tierKey = item.selectedPriceTier || 'price1';
          const compPrice = bData[tierKey] ?? bData.price1 ?? bData.cost ?? 0;
          internalSum += compPrice;
        }
      }
    });

    let externalSum = 0;
    externalItems.forEach(ext => {
      externalSum += (ext.cost || 0) * (ext.quantity || 1);
    });

    return internalSum + externalSum;
  }, [internalItems, externalItems, currentBranchId]);

  const minSellingPrice = calculatedTotalComponentCost + 5;

  useEffect(() => {
    if (customSellingPrice < minSellingPrice) {
      setCustomSellingPrice(minSellingPrice);
    }
  }, [minSellingPrice]);

  const handleAddInternalRow = () => {
    setInternalItems(prev => [...prev, { productId: '', quantity: 1, selectedPriceTier: 'price1' }]);
  };

  const handleRemoveInternalRow = (index: number) => {
    setInternalItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateInternalRow = (index: number, key: keyof InternalComponent, val: any) => {
    setInternalItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  };

  const handleAddExternalRow = () => {
    setExternalItems(prev => [
      ...prev,
      { id: `ext_${Date.now()}_${Math.random()}`, name: '', cost: 0, quantity: 1 }
    ]);
  };

  const handleRemoveExternalRow = (index: number) => {
    setExternalItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateExternalRow = (index: number, key: keyof ExternalComponent, val: any) => {
    setExternalItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  };

  const handleSaveCompositionFromPOS = () => {
    if (!compName.trim()) {
      setCompFormError('اسم التركيبة إجباري!');
      return;
    }

    if (customSellingPrice < minSellingPrice) {
      setCompFormError(`سعر التركيبة يجب أن يكون أزيد من مجموع المكونات بـ 5 ج.م على الأقل! (الحد الأدنى: ${minSellingPrice} ج.م)`);
      return;
    }

    setCompFormError('');

    const qtyToCreate = 1;
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

    const finalPrice = customSellingPrice || minSellingPrice;

    const branchDataList = store.getBranches().map(b => ({
      productId: newAssembledProduct.id,
      branchId: b.id,
      cost: calculatedTotalComponentCost,
      price1: finalPrice,
      price1Label: 'سعر 1',
      price2: finalPrice,
      price2Label: 'سعر 2',
      price3: finalPrice,
      price3Label: 'سعر 3',
      price4: finalPrice,
      price4Label: 'سعر 4',
      minStock: 5
    }));

    store.addProduct(newAssembledProduct, branchDataList);
    store.generatePhysicalItems(newAssembledProduct.id, currentBranchId, qtyToCreate, cleanPrefix);

    const newComp: ProductComposition = {
      id: `comp_${Date.now()}`,
      branchId: currentBranchId,
      name: compName.trim(),
      quantity: qtyToCreate,
      price1: finalPrice,
      price2: finalPrice,
      price3: finalPrice,
      totalCost: calculatedTotalComponentCost,
      internalComponents: internalItems.filter(i => i.productId),
      externalComponents: externalItems.filter(e => e.name.trim()),
      createdProductId: newAssembledProduct.id,
      createdAt: new Date().toISOString()
    };

    store.addComposition(newComp);

    // Auto-add to POS cart immediately as a single product line item
    const targetBranchData = store.getProductBranchData(newAssembledProduct.id, currentBranchId);
    if (targetBranchData) {
      const availItems = store.getPhysicalItemsByBranch(currentBranchId).filter(i => i.productId === newAssembledProduct.id && i.status === 'available');
      const physId = availItems[0]?.id || `ITEM-${Date.now()}`;

      setCart(prev => [
        ...prev,
        {
          physicalItemId: physId,
          product: newAssembledProduct,
          branchData: targetBranchData,
          priceTier: 'price1',
          selectedPrice: finalPrice,
          quantity: 1
        }
      ]);
    }

    setIsCompositionModalOpen(false);
    setCompName('');
    setCustomSellingPrice(0);
    setInternalItems([{ productId: '', quantity: 1 }]);
    setExternalItems([]);
  };

  // Store data getters
  const rawProducts = store.getProducts();
  const allProducts = useMemo(() => {
    return rawProducts.filter(p => {
      const bd = store.getProductBranchData(p.id, currentBranchId);
      const phys = store.getPhysicalItemsByProduct(p.id).filter(i => i.branchId === currentBranchId);
      return Boolean(bd || phys.length > 0);
    });
  }, [rawProducts, currentBranchId]);
  const categoriesList = useMemo(() => store.getCategories(), []);
  const customers = store.getCustomers();
  const availablePhysicalItems = store.getPhysicalItemsByBranch(currentBranchId).filter(i => i.status === 'available');

  // Filtered Products for Search Bar & Category Filter
  const filteredProducts = useMemo(() => {
    let prods = allProducts;
    if (selectedCategoryId) {
      prods = prods.filter(p => p.categoryId === selectedCategoryId);
    }
    if (!productSearchTerm.trim()) return prods;
    const term = productSearchTerm.toLowerCase().trim();
    return prods.filter(p => 
      p.nameAr.toLowerCase().includes(term) || 
      p.nameEn.toLowerCase().includes(term) || 
      p.sku.toLowerCase().includes(term)
    );
  }, [allProducts, selectedCategoryId, productSearchTerm]);

  // Selected product details for adding
  const currentSelectedProduct = useMemo(() => {
    return allProducts.find(p => p.id === selectedProductId);
  }, [allProducts, selectedProductId]);

  const currentProductBranchData = useMemo(() => {
    if (!selectedProductId) return null;
    return store.getProductBranchData(selectedProductId, currentBranchId);
  }, [selectedProductId, currentBranchId]);

  const availableStockForSelected = useMemo(() => {
    if (!selectedProductId) return 0;
    return availablePhysicalItems.filter(i => i.productId === selectedProductId).length;
  }, [selectedProductId, availablePhysicalItems]);

  const currentInCartForSelected = useMemo(() => {
    if (!selectedProductId) return 0;
    return cart.filter(c => c.product.id === selectedProductId).reduce((sum, item) => sum + item.quantity, 0);
  }, [selectedProductId, cart]);

  const maxAllowedForInput = useMemo(() => {
    if (!selectedProductId) return 999;
    return Math.max(0, availableStockForSelected - currentInCartForSelected);
  }, [selectedProductId, availableStockForSelected, currentInCartForSelected]);

  // Handle Camera initialization for laptop/device camera
  useEffect(() => {
    if (!isScanning) return;
    let stream: MediaStream | null = null;
    let animationId: number;

    async function startCamera() {
      try {
        setCameraError('');
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('الكاميرا غير مدعومة أو غير متاحة في هذا المتصفح');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }

        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a']
          });
          const scanFrame = async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0) {
                  handleQrScanAdd(codes[0].rawValue);
                  setIsScanning(false);
                  return;
                }
              } catch (err) {
                console.error(err);
              }
            }
            animationId = requestAnimationFrame(scanFrame);
          };
          scanFrame();
        }
      } catch (err) {
        console.error("Camera access failed:", err);
        setCameraError('لم نتمكن من تشغيل الكاميرا. يرجى التأكد من سماح المتصفح بالكاميرا.');
      }
    }

    startCamera();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isScanning]);

  // Add Product manually via form
  const handleAddProductToCart = () => {
    if (!selectedProductId || !currentSelectedProduct || !currentProductBranchData) return;
    
    // Check available physical items count for this product in current branch
    const availableItems = availablePhysicalItems.filter(i => i.productId === selectedProductId);
    const availableStockCount = availableItems.length;

    // Calculate total quantity of this product already in cart
    const currentInCartQty = cart
      .filter(c => c.product.id === selectedProductId)
      .reduce((acc, c) => acc + c.quantity, 0);

    const maxCanAdd = Math.max(0, availableStockCount - currentInCartQty);
    if (maxCanAdd <= 0) return;

    const qtyToAdd = Math.min(inputQuantity, maxCanAdd);
    if (qtyToAdd <= 0) return;

    const price = currentProductBranchData[selectedPriceTier] || currentProductBranchData.price1;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === selectedProductId && item.priceTier === selectedPriceTier);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + qtyToAdd
        };
        return updated;
      } else {
        const availItem = availableItems.find(i => !prev.some(c => c.physicalItemId === i.id));
        return [...prev, {
          physicalItemId: availItem?.id || `ITEM-${Date.now()}`,
          product: currentSelectedProduct,
          branchData: currentProductBranchData,
          priceTier: selectedPriceTier,
          selectedPrice: price,
          quantity: qtyToAdd
        }];
      }
    });

    // Reset selection inputs
    setSelectedProductId('');
    setInputQuantity(1);
  };

  // Quick Add via QR Code / Serial scan directly to cart
  const handleQrScanAdd = (scannedCode: string) => {
    if (!scannedCode || !scannedCode.trim()) return;
    const targetCode = scannedCode.trim().toLowerCase();

    // Check matching physical item or product SKU / product Code
    const matchedPhysical = availablePhysicalItems.find(i => 
      i.id.toLowerCase() === targetCode || i.serialNumber.toLowerCase() === targetCode
    );

    let targetProduct: Product | undefined;
    if (matchedPhysical) {
      targetProduct = allProducts.find(p => p.id === matchedPhysical.productId);
    } else {
      targetProduct = allProducts.find(p => 
        p.sku.toLowerCase() === targetCode || 
        p.productCode.toLowerCase() === targetCode ||
        p.nameAr.toLowerCase().includes(targetCode)
      );
    }

    if (targetProduct) {
      const branchData = store.getProductBranchData(targetProduct.id, currentBranchId);
      if (branchData) {
        const price = branchData.price1;
        setCart(prev => {
          const existingIdx = prev.findIndex(item => item.product.id === targetProduct!.id && item.priceTier === 'price1');
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx].quantity += 1;
            return updated;
          } else {
            return [...prev, {
              physicalItemId: matchedPhysical?.id || `ITEM-${Date.now()}`,
              product: targetProduct!,
              branchData,
              priceTier: 'price1',
              selectedPrice: price,
              quantity: 1
            }];
          }
        });
      }
      setIsScanning(false);
    } else {
      alert('لم يتم العثور على منتج يطابق كود QR أو السيريال المدخل.');
    }
    setQrScanInput('');
  };

  // Cart Quantities & Items manipulation
  const updateCartQuantity = (idx: number, delta: number) => {
    setCart(prev => {
      const item = prev[idx];
      if (!item) return prev;

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }

      if (delta > 0) {
        // Check stock limit for physical items in branch
        const availableItems = store.getPhysicalItemsByBranch(currentBranchId).filter(
          i => i.productId === item.product.id && i.status === 'available'
        );
        const availCount = availableItems.length;

        // Total quantity of this product across ALL cart lines
        const totalProductQtyInCart = prev
          .filter(line => line.product.id === item.product.id)
          .reduce((sum, line) => sum + line.quantity, 0);

        if (availCount > 0 && totalProductQtyInCart + delta > availCount) {
          return prev; // Silently do nothing, stops at max stock!
        }
      }

      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: newQty };
      return updated;
    });
  };

  const removeCartItem = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculate Totals
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.selectedPrice * item.quantity), 0);
  }, [cart]);

  const totalCost = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.branchData.cost * item.quantity), 0);
  }, [cart]);

  const finalTotal = Math.max(0, subtotal - discount);

  // Effective Paid & Deferred Amount calculation
  const effectivePaidAmount = useMemo(() => {
    if (paymentStatus === 'paid') return finalTotal;
    if (paymentStatus === 'deferred') return 0;
    return Math.min(paidAmountInput, finalTotal);
  }, [paymentStatus, finalTotal, paidAmountInput]);

  const remainingDeferredAmount = Math.max(0, finalTotal - effectivePaidAmount);

  // Helper to send structured WhatsApp text message receipt
  const sendWhatsAppTextInvoice = (inv: Invoice, custName: string, custPhone: string, cashierName: string) => {
    if (!custPhone.trim()) return;
    const cleanPhone = custPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('2') ? cleanPhone : `20${cleanPhone.replace(/^0/, '')}`;
    
    // Group invoice items by product
    const itemMap = new Map<string, { name: string; count: number; unitPrice: number; totalPrice: number }>();
    inv.items.forEach(item => {
      const prod = store.getProduct(item.productId);
      const name = prod?.nameAr || prod?.nameEn || 'منتج إكسسوارات';
      const existing = itemMap.get(item.productId);
      if (existing) {
        existing.count += 1;
        existing.totalPrice += item.unitPrice;
      } else {
        itemMap.set(item.productId, { name, count: 1, unitPrice: item.unitPrice, totalPrice: item.unitPrice });
      }
    });

    let msg = `*Salla Bola & Mina*\n`;
    msg += `فاتورة مبيعات مسلسل: #${inv.invoiceNumber}\n`;
    msg += `التاريخ والوقت: ${new Date(inv.date).toLocaleDateString('ar-EG')} - ${new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}\n`;
    msg += `اسم العميل: ${custName}\n`;
    msg += `رقم التليفون: ${custPhone}\n`;
    msg += `الموظف البائع: ${cashierName}\n`;
    msg += `-----------------------------------\n`;
    msg += `تفاصيل المنتجات والمشتريات:\n`;
    itemMap.forEach(item => {
      msg += `- ${item.name} (عدد ${item.count}) : ${item.totalPrice.toFixed(2)} ج.م\n`;
    });
    msg += `-----------------------------------\n`;
    msg += `المجموع الإجمالي: ${inv.total.toFixed(2)} ج.م\n`;
    if (inv.paidAmount !== undefined) {
      msg += `المدفوع الآن: ${inv.paidAmount.toFixed(2)} ج.م\n`;
    }
    if (inv.remainingAmount !== undefined && inv.remainingAmount > 0) {
      msg += `المتبقي (آجل): ${inv.remainingAmount.toFixed(2)} ج.م\n`;
    }
    msg += `-----------------------------------\n`;
    msg += `\nهدفنا ارضاء العميل وليس الربح\n`;
    msg += `متجر Salla Bola & Mina للإكسسوارات`;

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Complete Invoice Sale
  const handleCompleteSale = () => {
    if (cart.length === 0) return;

    // MANDATORY CUSTOMER CHECK
    if (!customerName.trim() || !customerPhone.trim()) {
      setCustomerError('اسم العميل ورقم التليفون إجباري لإتمام الفاتورة!');
      return;
    }
    setCustomerError('');

    const generateUniqueInvoiceNumber = (): string => {
      const existingInvoices = store.getInvoices();
      const existingSet = new Set(existingInvoices.map(i => i.invoiceNumber));
      
      for (let i = 0; i < 1000; i++) {
        const num = Math.floor(10000000 + Math.random() * 90000000).toString();
        if (!existingSet.has(num)) return num;
      }

      return `${Date.now()}`.slice(-9);
    };

    const invoiceNum = generateUniqueInvoiceNumber();

    // Build invoice items
    const invoiceItems = cart.flatMap(item => 
      Array.from({ length: item.quantity }).map((_, qIdx) => ({
        physicalItemId: `${item.physicalItemId}${qIdx > 0 ? `-${qIdx}` : ''}`,
        productId: item.product.id,
        unitPrice: item.selectedPrice
      }))
    );

    const cName = customerName.trim();
    const cPhone = customerPhone.trim();
    const cashierName = user?.name || 'الكاشير';

    const newInvoice: Invoice = {
      id: `inv_${Date.now()}`,
      invoiceNumber: invoiceNum,
      branchId: currentBranchId,
      employeeId: user?.id || 'u3',
      customerId: selectedCustomerId || undefined,
      customerName: cName,
      customerPhone: cPhone,
      date: new Date().toISOString(),
      items: invoiceItems,
      subtotal,
      discount,
      total: finalTotal,
      totalCost,
      paymentMethod: paymentSubMethod === 'vodafone_cash' ? 'vodafone_cash' : paymentSubMethod === 'instapay' ? 'instapay' : 'cash',
      paymentStatus,
      paymentSubMethod,
      paidAmount: effectivePaidAmount,
      remainingAmount: remainingDeferredAmount
    };

    // 1. Save invoice to system
    store.addInvoice(newInvoice);

    // 2. Deduct sold quantities from branch stock
    cart.forEach(item => {
      const bd = store.getProductBranchData(item.product.id, currentBranchId);
      const currentQty = Number(bd?.quantity || 0);
      const newQty = Math.max(0, currentQty - item.quantity);
      const cleanPrefix = item.product.sku.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITM';
      store.adjustProductBranchQuantity(item.product.id, currentBranchId, newQty, cleanPrefix);
    });

    // Save customer to store if starred
    if (isCustomerFavorite) {
      const existing = store.getCustomers().find(c => (cPhone && c.phone.trim() === cPhone) || (cName && c.name.trim() === cName));
      const targetId = existing?.id || selectedCustomerId || `cust_${Date.now()}`;
      store.addCustomer({
        id: targetId,
        name: cName,
        phone: cPhone
      });
      setCustomersList([...store.getCustomers()]);
    }

    setLastPrintedInvoice(newInvoice);

    // 3. Immediately open WhatsApp Web with text receipt
    sendWhatsAppTextInvoice(newInvoice, cName, cPhone, cashierName);

    // 4. Reset cart and customer form fields immediately
    setCart([]);
    setDiscount(0);
    setPaidAmountInput(0);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId('');
    setIsCustomerFavorite(false);
  };

  return (
    <>
      <div className="space-y-6 pb-20 md:pb-6 animate-in fade-in print:hidden" dir="rtl">
      
      {/* ------------------------------------------------------------------------- */}
      {/* TOP POS HEADER BAR */}
      {/* ------------------------------------------------------------------------- */}
      <div className="flex flex-row justify-between items-center gap-3 bg-card border border-border/80 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0" />
          <h1 className="text-sm sm:text-xl font-bold text-foreground truncate">المبيعات (كاشير)</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-muted/60 border border-border/80 text-[11px] sm:text-xs flex items-center gap-1.5 sm:gap-2 font-medium">
            <User size={14} className="text-amber-500 shrink-0" />
            <span className="truncate">الكاشير: <strong className="text-foreground">{user?.name}</strong></span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* MAIN POS 2-COLUMN GRID (Right: New Sale / Cart, Left: Invoice & Checkout) */}
      {/* ------------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ======================================================================= */}
        {/* RIGHT COLUMN: New Sale Form & Active Cart Items (Col Span 7) */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-card border-border shadow-md rounded-3xl p-4 sm:p-6 relative overflow-hidden">
            
            {/* Header Badge */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-amber-500" size={20} />
                <h2 className="text-lg font-bold text-foreground">عملية بيع جديدة</h2>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border font-medium">
                الكاشير: {user?.name || 'test'}
              </span>
            </div>

            {/* QR Scanner & Serial Quick Input Bar */}
            <div className="bg-muted/30 p-3.5 rounded-2xl border border-border/60 mb-3">
              <div className="flex flex-row items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500" size={18} />
                  <Input 
                    placeholder="امسح كود QR أو أدخل الباركود..."
                    value={qrScanInput}
                    onChange={(e) => setQrScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleQrScanAdd(qrScanInput);
                      }
                    }}
                    className="pr-9 h-11 text-xs rounded-xl bg-background border-border/80 truncate"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {qrScanInput.trim().length > 0 ? (
                    <Button 
                      type="button"
                      onClick={() => handleQrScanAdd(qrScanInput)} 
                      className="h-11 px-3.5 sm:px-6 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl gap-1.5 shrink-0 shadow-sm transition-all whitespace-nowrap"
                      title="إضافة المنتج للسلة"
                    >
                      <Plus size={16} />
                      <span>إضافة</span>
                    </Button>
                  ) : (
                    <Button 
                      type="button"
                      onClick={() => setIsScanning(true)} 
                      className="h-11 px-3.5 sm:px-5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl gap-1.5 shrink-0 shadow-sm transition-all whitespace-nowrap"
                      title="فتح الكاميرا لمسح كود QR"
                    >
                      <ScanLine size={16} />
                      <span>مسح كود QR</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Standalone Button for Adding Composition */}
            <Button 
              type="button" 
              onClick={() => setIsCompositionModalOpen(true)}
              className="w-full h-11 bg-amber-500/15 text-amber-500 hover:bg-amber-500 hover:text-black font-bold text-xs sm:text-sm rounded-2xl shadow-xs flex items-center justify-center gap-2 transition-all border border-amber-500/30 mb-6"
            >
              <Layers size={18} />
              <span>إضافة تركيبة</span>
            </Button>

            {/* CATEGORY FILTER BAR BETWEEN QR SCANNER AND PRODUCT SELECTION */}
            <div className="bg-card border border-border/80 p-4 rounded-2xl shadow-xs mb-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Filter className="text-amber-500" size={16} />
                  <span>تصفية حسب الفئة:</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/20 font-bold">
                    {selectedCategoryId 
                      ? (categoriesList.find(c => c.id === selectedCategoryId)?.nameAr || 'فئة محددة') 
                      : 'جميع الفئات'}
                  </span>
                </div>

                {/* Fast Select Dropdown */}
                <div className="w-full sm:w-64">
                  <CustomSelect
                    size="sm"
                    value={selectedCategoryId}
                    onChange={(catId) => {
                      setSelectedCategoryId(catId);
                      if (selectedProductId) {
                        const p = allProducts.find(item => item.id === selectedProductId);
                        if (p && catId && p.categoryId !== catId) {
                          setSelectedProductId('');
                          setProductSearchTerm('');
                        }
                      }
                    }}
                    options={[
                      { value: '', label: `جميع الفئات (${allProducts.length} منتج)` },
                      ...categoriesList.map(cat => ({
                        value: cat.id,
                        label: cat.nameAr,
                        sublabel: `${allProducts.filter(p => p.categoryId === cat.id).length} منتج`
                      }))
                    ]}
                  />
                </div>
              </div>

              {/* Clickable Quick Category Badges */}
              {categoriesList.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {categoriesList.map(cat => {
                    const isSelected = selectedCategoryId === cat.id;
                    const count = allProducts.filter(p => p.categoryId === cat.id).length;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const newCatId = isSelected ? '' : cat.id;
                          setSelectedCategoryId(newCatId);
                          if (selectedProductId) {
                            const p = allProducts.find(item => item.id === selectedProductId);
                            if (p && p.categoryId !== newCatId) {
                              setSelectedProductId('');
                              setProductSearchTerm('');
                            }
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                          isSelected 
                            ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-xs' 
                            : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/60'
                        }`}
                      >
                        {cat.nameAr} <span className="text-[10px] opacity-80 font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SINGLE-ROW PRODUCT SELECTION MATCHING SCREENSHOT */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-muted/20 p-4 rounded-2xl border border-border/50 mb-6" dir="rtl">
              
              {/* 1. SELECT PRODUCT SEARCHABLE COMBOBOX (Span 5) */}
              <div className="md:col-span-5 space-y-1 relative">
                <Label className="text-xs font-bold text-muted-foreground block">اختر المنتج</Label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none">
                    <Package size={18} />
                  </div>
                  <Input
                    placeholder="اختر أو ابحث عن المنتج..."
                    value={isDropdownOpen ? productSearchTerm : (currentSelectedProduct ? currentSelectedProduct.nameAr : productSearchTerm)}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    className="pr-10 pl-14 h-11 text-xs font-bold rounded-xl bg-background border-border"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {selectedProductId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedProductId('');
                          setProductSearchTerm('');
                        }}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="إلغاء التحديد"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  {/* Floating Dropdown List */}
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground text-center">لا يوجد منتج يطابق البحث</div>
                      ) : (
                        filteredProducts.map(p => {
                          const stockCount = availablePhysicalItems.filter(i => i.productId === p.id).length;
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedProductId(p.id);
                                setProductSearchTerm('');
                                setIsDropdownOpen(false);
                              }}
                              className={`p-2.5 text-xs font-bold hover:bg-amber-500/10 hover:text-amber-500 cursor-pointer flex justify-between items-center ${p.id === selectedProductId ? 'bg-amber-500/15 text-amber-500' : ''}`}
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <Package size={14} className="text-amber-500 shrink-0" />
                                <span className="truncate">{p.nameAr}</span>
                                {categoriesList.find(c => c.id === p.categoryId) && (
                                  <span className="text-[9px] font-normal px-1.5 py-0.5 bg-muted text-muted-foreground rounded-md shrink-0">
                                    {categoriesList.find(c => c.id === p.categoryId)?.nameAr}
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] font-extrabold font-mono text-amber-500 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
                                {stockCount}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. SELECT PRICE TIER (Span 3) */}
              <div className="md:col-span-3 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground block">السعر</Label>
                <CustomSelect
                  disabled={!selectedProductId}
                  value={selectedPriceTier}
                  onChange={(val: any) => setSelectedPriceTier(val)}
                  placeholder={selectedProductId ? 'اختر السعر' : 'اختر المنتج أولاً'}
                  options={
                    currentProductBranchData
                      ? [
                          { value: 'price1', label: `${currentProductBranchData.price1Label || 'سعر 1'}: ${currentProductBranchData.price1.toFixed(2)} ج.م` },
                          { value: 'price2', label: `${currentProductBranchData.price2Label || 'سعر 2'}: ${currentProductBranchData.price2.toFixed(2)} ج.م` },
                          { value: 'price3', label: `${currentProductBranchData.price3Label || 'سعر 3'}: ${currentProductBranchData.price3.toFixed(2)} ج.م` },
                          { value: 'price4', label: `${currentProductBranchData.price4Label || 'سعر 4'}: ${(currentProductBranchData.price4 || currentProductBranchData.price1).toFixed(2)} ج.م` },
                        ]
                      : []
                  }
                />
              </div>

              {/* 3. QUANTITY (Span 2) */}
              <div className="md:col-span-2 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground block text-center">الكمية (قطعة)</Label>
                <Input
                  type="number"
                  min={1}
                  max={selectedProductId ? maxAllowedForInput : 999}
                  value={inputQuantity}
                  onChange={(e) => {
                    const rawVal = parseInt(e.target.value, 10);
                    if (isNaN(rawVal) || rawVal < 1) {
                      setInputQuantity(1);
                      return;
                    }
                    if (selectedProductId) {
                      setInputQuantity(Math.min(maxAllowedForInput, rawVal));
                    } else {
                      setInputQuantity(rawVal);
                    }
                  }}
                  className="h-11 text-center font-mono font-bold text-xs rounded-xl bg-background"
                />
              </div>

              {/* 4. ADD BUTTON (Span 2) */}
              <div className="md:col-span-2">
                <Button
                  type="button"
                  onClick={handleAddProductToCart}
                  disabled={!selectedProductId}
                  className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-sm rounded-full shadow-sm"
                >
                  إضافة
                </Button>
              </div>

            </div>

            {/* Current Cart Items Header */}
            <div className="border-t border-border/60 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-foreground">عناصر السلة الفعالة</h3>
                <span className="text-xs text-muted-foreground font-mono">
                  إجمالي القطع: <strong className="text-amber-500 font-bold">{cart.reduce((a, b) => a + b.quantity, 0)}</strong> قطعة
                </span>
              </div>

              {/* Cart Items Table */}
              <div className="bg-background rounded-2xl border border-border/80 overflow-hidden min-h-[200px] flex flex-col justify-between">
                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                    <ShoppingCart size={36} className="text-muted-foreground/30" />
                    <p className="text-xs italic">السلة فارغة. اختر منتجاً من الأعلى أو قم بمسح كود QR لإضافته للفاتورة.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-right">المنتج</TableHead>
                        <TableHead className="text-xs font-bold text-center">السعر المختار</TableHead>
                        <TableHead className="text-xs font-bold text-center">الكمية</TableHead>
                        <TableHead className="text-xs font-bold text-left">الإجمالي</TableHead>
                        <TableHead className="text-xs font-bold text-center w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/20">
                          <TableCell className="py-3">
                            <p className="font-bold text-xs text-foreground">{item.product.nameAr}</p>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              كود: {item.physicalItemId}
                            </span>
                          </TableCell>

                          <TableCell className="text-center py-3 font-mono font-bold text-xs text-foreground">
                            {item.selectedPrice.toFixed(2)} ج.م
                          </TableCell>

                          <TableCell className="text-center py-3">
                            <div className="inline-flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/60">
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCartQuantity(idx, -1);
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="font-mono font-bold text-xs w-6 text-center">{item.quantity}</span>
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCartQuantity(idx, 1);
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </TableCell>

                          <TableCell className="text-left py-3 font-mono font-bold text-xs text-amber-500">
                            {(item.selectedPrice * item.quantity).toFixed(2)} ج.م
                          </TableCell>

                          <TableCell className="text-center py-3">
                            <button 
                              type="button" 
                              onClick={() => removeCartItem(idx)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

          </Card>
        </div>

        {/* ======================================================================= */}
        {/* LEFT COLUMN: Invoice Summary & Payment Completion (Col Span 5) */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-card border-border shadow-md rounded-3xl p-4 sm:p-6 space-y-5 sm:space-y-6 relative overflow-hidden">
            
            {/* Header Title */}
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <CreditCard className="text-amber-500" size={20} />
              <h2 className="text-lg font-bold text-foreground">بيانات العميل وإتمام الدفع</h2>
            </div>

            {/* Preferred Customers Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-amber-500 flex items-center gap-1">
                ⭐ العملاء المفضليين
              </Label>
              <CustomSelect
                value={selectedCustomerId}
                onChange={(val) => handleSelectCustomer(val)}
                placeholder="-- اختر من القائمة المفضلة لتعبئة البيانات تلقائياً --"
                options={[
                  { value: '', label: '-- اختر من القائمة المفضلة لتعبئة البيانات تلقائياً --' },
                  ...customersList.map(c => ({
                    value: c.id,
                    label: `⭐ ${c.name}`,
                    sublabel: c.phone
                  }))
                ]}
              />
            </div>

            {/* Customer Validation Alert Error Banner */}
            {customerError && (
              <div className="bg-rose-500/15 border border-rose-500/40 text-rose-600 text-xs font-bold p-3 rounded-2xl flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={18} className="shrink-0 text-rose-500" />
                <span>{customerError}</span>
              </div>
            )}

            {/* Mandatory Customer Name & Phone Fields + Favorite Star Button */}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                  اسم العميل <span className="text-rose-500 font-bold">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    placeholder="اكتب اسم العميل..."
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (e.target.value.trim()) setCustomerError('');
                    }}
                    className={`pr-8 h-10 text-xs rounded-xl bg-muted/20 ${!customerName.trim() && customerError ? 'border-rose-500 ring-1 ring-rose-500' : ''}`}
                  />
                </div>
              </div>

              <div className="flex-1 space-y-1">
                <Label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                  رقم التليفون <span className="text-rose-500 font-bold">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    placeholder="رقم التليفون..."
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      if (e.target.value.trim()) setCustomerError('');
                    }}
                    className={`pr-8 h-10 text-xs rounded-xl bg-muted/20 font-mono ${!customerPhone.trim() && customerError ? 'border-rose-500 ring-1 ring-rose-500' : ''}`}
                  />
                </div>
              </div>

              {/* Star Toggle Button */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground block opacity-0 select-none">
                  مفضلة
                </Label>
                <button
                  type="button"
                  onClick={handleToggleStarCustomer}
                  title={isCustomerFavorite ? 'مسجل بالعملاء المفضلين (إزالة)' : 'إضافة إلى العملاء المفضلين'}
                  className={`h-10 px-3 rounded-xl border flex items-center justify-center transition-all select-none ${
                    isCustomerFavorite 
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-500 shadow-xs ring-1 ring-amber-500/30' 
                      : 'bg-muted/30 border-border/80 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/30'
                  }`}
                >
                  <Star size={18} className={isCustomerFavorite ? 'fill-amber-400 text-amber-400' : ''} />
                </button>
              </div>
            </div>

            {/* PAYMENT STATUS / INVOICE TYPE TOGGLE (مدفوع بالكامل / دفع جزئي / آجل) */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground block">
                حالة الدفع / نوع الفاتورة
              </Label>
              
              <div className="grid grid-cols-3 gap-2">
                {/* Fully Paid */}
                <button
                  type="button"
                  onClick={() => setPaymentStatus('paid')}
                  className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    paymentStatus === 'paid'
                      ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-sm'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <Check size={16} />
                  <span>مدفوع بالكامل</span>
                </button>

                {/* Partial Payment */}
                <button
                  type="button"
                  onClick={() => setPaymentStatus('partial')}
                  className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    paymentStatus === 'partial'
                      ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-sm'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <Clock size={16} />
                  <span>دفع جزئي</span>
                </button>

                {/* Deferred / Unpaid */}
                <button
                  type="button"
                  onClick={() => setPaymentStatus('deferred')}
                  className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                    paymentStatus === 'deferred'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <Clock size={16} />
                  <span>آجل / لم يدفع</span>
                </button>
              </div>
            </div>

            {/* CASH PAYMENT SUB METHOD (نقداً / فودافون كاش / إنستاباي) */}
            {paymentStatus !== 'deferred' && (
              <div className="space-y-1.5 bg-muted/20 p-3 rounded-2xl border border-border/50">
                <Label className="text-xs font-bold text-muted-foreground block">
                  وسيلة الدفع النقدي
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  
                  {/* Cash in Hand */}
                  <button
                    type="button"
                    onClick={() => setPaymentSubMethod('cash')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                      paymentSubMethod === 'cash'
                        ? 'bg-amber-500/20 text-amber-500 border-amber-500 shadow-xs'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                    }`}
                  >
                    <svg className="w-4 h-4 fill-none stroke-current shrink-0" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="M6 12h.01M18 12h.01" />
                    </svg>
                    <span>نقداً (في اليد)</span>
                  </button>

                  {/* Vodafone Cash */}
                  <button
                    type="button"
                    onClick={() => setPaymentSubMethod('vodafone_cash')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                      paymentSubMethod === 'vodafone_cash'
                        ? 'bg-red-500/20 text-red-500 border-red-500 shadow-xs'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                    }`}
                  >
                    <img src={vodafoneLogo} alt="فودافون كاش" className="w-5 h-5 object-contain shrink-0 rounded-full" />
                    <span>فودافون كاش</span>
                  </button>

                  {/* InstaPay */}
                  <button
                    type="button"
                    onClick={() => setPaymentSubMethod('instapay')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                      paymentSubMethod === 'instapay'
                        ? 'bg-purple-500/20 text-purple-500 border-purple-500 shadow-xs'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                    }`}
                  >
                    <img src={instapayLogo} alt="إنستاباي" className="w-5 h-5 object-contain shrink-0 rounded-md" />
                    <span>إنستاباي</span>
                  </button>

                </div>
              </div>
            )}

            {/* PARTIAL PAYMENT AMOUNT INPUT (If Partial Selected) */}
            {paymentStatus === 'partial' && (
              <div className="space-y-1.5 bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/30">
                <Label className="text-xs font-bold text-amber-500">المبلغ المدفوع الآن (ج.م)</Label>
                <Input 
                  type="number"
                  min={0}
                  max={finalTotal}
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(Number(e.target.value))}
                  className="h-11 font-mono font-bold text-sm text-center rounded-xl bg-background border-amber-500/40"
                />
              </div>
            )}

            {/* Discount Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">قيمة الخصم (ج.م)</Label>
              <Input 
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="h-11 font-mono text-center text-xs rounded-xl bg-muted/20"
              />
            </div>

            {/* Totals Summary Box */}
            <div className="bg-muted/40 p-4 rounded-2xl space-y-2.5 text-xs border border-border/60">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold text-foreground">{subtotal.toFixed(2)} ج.م</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between items-center text-rose-500">
                  <span>الخصم:</span>
                  <span className="font-mono font-bold">-{discount.toFixed(2)} ج.م</span>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-border/60 pt-2 text-sm font-bold">
                <span className="text-foreground">المجموع الإجمالي:</span>
                <span className="font-mono text-base text-foreground">{finalTotal.toFixed(2)} ج.م</span>
              </div>

              <div className="flex justify-between items-center pt-1 text-amber-500 font-bold">
                <span>المدفوع الآن:</span>
                <span className="font-mono">{effectivePaidAmount.toFixed(2)} ج.م</span>
              </div>

              {remainingDeferredAmount > 0 && (
                <div className="flex justify-between items-center pt-1 text-rose-500 font-bold border-t border-border/40">
                  <span>المتبقي (الآجل):</span>
                  <span className="font-mono">{remainingDeferredAmount.toFixed(2)} ج.م</span>
                </div>
              )}
            </div>

            {/* ACTIONS: COMPLETE SALE & WHATSAPP */}
            <div className="space-y-3 pt-2">
              <Button 
                type="button"
                onClick={handleCompleteSale}
                disabled={cart.length === 0}
                className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-base rounded-2xl shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={22} />
                <span>إتمام البيع واصدار الفاتورة ({finalTotal.toFixed(2)} ج.م)</span>
              </Button>
            </div>

          </Card>
        </div>

      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* REAL CAMERA QR SCANNER DIALOG (Square Mobile Frame) */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={isScanning} onOpenChange={setIsScanning}>
        <DialogContent className="sm:max-w-md bg-card border-border" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center">مسح كود QR والباركود</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {/* Square camera container */}
            <div className="w-64 h-64 max-w-full aspect-square border-2 border-amber-500 rounded-3xl relative overflow-hidden bg-black flex items-center justify-center shadow-lg">
              <video 
                ref={videoRef} 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              {/* Square scanner viewfinder reticle */}
              <div className="absolute w-44 h-44 border-2 border-amber-400 border-dashed rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                <div className="w-full h-0.5 bg-amber-400/80 shadow-[0_0_8px_#f59e0b]" />
              </div>
              <div className="absolute top-2 right-2 bg-amber-600/90 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" /> الكاميرا نشطة 📷
              </div>
            </div>

            {cameraError && (
              <p className="mt-2 text-xs text-rose-500 font-bold text-center">{cameraError}</p>
            )}

            <p className="mt-3 text-center text-muted-foreground text-xs">
              وجه الكاميرا نحو كود الـ QR الخاص بالمنتج لمسحه تلقائياً.
            </p>

            {/* Manual Code Input fallback inside camera popup */}
            <div className="w-full mt-4 flex gap-2">
              <Input 
                placeholder="أو أدخل الكود يدوياً هنا..."
                value={qrScanInput}
                onChange={(e) => setQrScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleQrScanAdd(qrScanInput);
                  }
                }}
                className="h-10 text-xs rounded-xl"
              />
              <Button 
                type="button" 
                onClick={() => handleQrScanAdd(qrScanInput)} 
                className="h-10 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs shrink-0"
              >
                اختيار
              </Button>
            </div>

            {/* Quick test item selection button */}
            <Button 
              type="button"
              variant="outline"
              onClick={() => {
                if (availablePhysicalItems.length > 0) {
                  const randomItem = availablePhysicalItems[Math.floor(Math.random() * availablePhysicalItems.length)];
                  handleQrScanAdd(randomItem.id);
                }
              }} 
              className="mt-3 w-full border-amber-500/40 text-amber-500 hover:bg-amber-500/10 text-xs font-bold rounded-xl"
            >
              (اختيار عينة QR تجريبية للمنتج)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      </div>

      {/* PRINTABLE RECEIPT CONTAINER (Hidden on screen, Visible only during print/PDF generation) */}
      {lastPrintedInvoice && (
        <div id="printable-pos-receipt" className="hidden print:block print:fixed print:inset-0 print:bg-white print:text-black print:p-6 print:z-[99999] font-sans text-xs" dir="rtl">
          <div className="max-w-xs mx-auto space-y-3 text-right">
            
            {/* Logo Header matching brand image */}
            <div className="text-center pb-2 border-b border-gray-300">
              <img src={lightLogo} alt="Salla Bola & Mina" className="h-16 mx-auto object-contain" />
            </div>

            {/* Date/Time, Serial, Cashier, Customer Name and Customer Phone Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pb-2 border-b border-gray-200">
              <div className="text-right space-y-1">
                <p><span className="text-gray-500">التاريخ : </span><span className="font-mono font-bold text-gray-900">{new Date(lastPrintedInvoice.date).toLocaleDateString('ar-EG')}</span></p>
                <p><span className="text-gray-500">الوقت : </span><span className="font-mono font-bold text-gray-900">{new Date(lastPrintedInvoice.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></p>
                <p><span className="text-gray-500">اسم العميل : </span><span className="font-bold text-gray-900">{lastPrintedInvoice.customerName || 'عام'}</span></p>
              </div>
              <div className="text-right space-y-1">
                <p><span className="text-gray-500">المسلسل : </span><span className="font-mono font-bold text-gray-900">{lastPrintedInvoice.invoiceNumber}</span></p>
                <p><span className="text-gray-500">الكاشير : </span><span className="font-bold text-gray-900">{store.getUsers().find(u => u.id === lastPrintedInvoice.employeeId)?.name || user?.name || 'كاشير'}</span></p>
                <p><span className="text-gray-500">رقم الهاتف : </span><span className="font-mono font-bold text-gray-900">{lastPrintedInvoice.customerPhone || '-'}</span></p>
              </div>
            </div>

            {/* Items Table matching photo: الصنف | الكمية | السعر | الإجمالي */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border border-gray-300 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 text-gray-800 font-bold">
                    <th className="py-1 px-2 border-l border-gray-300 text-right">الصنف</th>
                    <th className="py-1 px-1 border-l border-gray-300 text-center w-12">الكمية</th>
                    <th className="py-1 px-1 border-l border-gray-300 text-center w-14">السعر</th>
                    <th className="py-1 px-1 text-left w-16">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const itemMap = new Map<string, { name: string; count: number; unitPrice: number; totalPrice: number }>();
                    lastPrintedInvoice.items.forEach(item => {
                      const prod = store.getProduct(item.productId);
                      const name = prod?.nameAr || prod?.nameEn || 'منتج إكسسوارات';
                      const existing = itemMap.get(item.productId);
                      if (existing) {
                        existing.count += 1;
                        existing.totalPrice += item.unitPrice;
                      } else {
                        itemMap.set(item.productId, { name, count: 1, unitPrice: item.unitPrice, totalPrice: item.unitPrice });
                      }
                    });
                    const rows = Array.from(itemMap.values());
                    const totalQty = rows.reduce((acc, r) => acc + r.count, 0);

                    return (
                      <>
                        {rows.map((itm, i) => (
                          <tr key={i} className="border-b border-gray-200 text-gray-900">
                            <td className="py-1.5 px-2 border-l border-gray-200 font-bold text-[11px]">{itm.name}</td>
                            <td className="py-1.5 px-1 border-l border-gray-200 text-center font-mono">{itm.count}</td>
                            <td className="py-1.5 px-1 border-l border-gray-200 text-center font-mono">{itm.unitPrice.toFixed(2)}</td>
                            <td className="py-1.5 px-1 text-left font-mono font-bold">{itm.totalPrice.toFixed(2)}</td>
                          </tr>
                        ))}

                        {/* Totals Summary Row matching image */}
                        <tr className="font-bold text-gray-900 bg-gray-50 border-t-2 border-gray-400">
                          <td className="py-2 px-2 border-l border-gray-300 text-right text-sm">الإجمالي</td>
                          <td className="py-2 px-1 border-l border-gray-300 text-center font-mono text-sm">{totalQty}</td>
                          <td className="py-2 px-1 border-l border-gray-300 text-center"></td>
                          <td className="py-2 px-1 text-left font-mono text-sm">{lastPrintedInvoice.total.toFixed(2)}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Footer Section matching image */}
            <div className="text-center text-[11px] text-gray-600 pt-3 space-y-1 border-t border-dashed border-gray-300">
              <p className="font-mono font-semibold text-gray-800 dir-ltr">Tel : 01271994777 - 01210866936</p>
              <p className="text-gray-700 font-medium">ش / احمد عرابي_امام مول النصر</p>
              <p className="font-bold text-gray-900 text-xs pt-1">هدفنا ارضاء العميل وليس الربح</p>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* ADD COMPOSITION POPUP MODAL (Matching Landscape & User Instructions) */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={isCompositionModalOpen} onOpenChange={setIsCompositionModalOpen}>
        <DialogContent className="max-w-5xl w-[95vw] bg-card border-border shadow-2xl rounded-3xl p-6 sm:p-8 overflow-y-auto max-h-[92vh]" dir="rtl">
          <DialogHeader className="mb-4 text-right border-b border-border/60 pb-3">
            <DialogTitle className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <Layers size={22} className="text-amber-500" />
              <span>إضافة تركيبة</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* 1. Comp Name */}
            <div className="space-y-2">
              <Label className="text-xs font-extrabold text-foreground">
                اسم التركيبة
              </Label>
              <Input 
                placeholder="مثال: سلسلة"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="h-11 bg-muted/30 border-border/80 rounded-xl text-sm font-bold"
              />
            </div>

            {/* 2. Internal Components Section: المكونات */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-extrabold text-foreground">
                  المكونات
                </Label>
                <button
                  type="button"
                  onClick={handleAddInternalRow}
                  className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20"
                >
                  <Plus size={14} />
                  <span>+ إضافة مكون جديد</span>
                </button>
              </div>

              <div className="space-y-3">
                {internalItems.map((item, idx) => {
                  const selectedProductBranch = item.productId ? store.getProductBranchData(item.productId, currentBranchId) : null;
                  const currentTier = item.selectedPriceTier || 'price1';

                  return (
                    <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-muted/20 p-3.5 rounded-2xl border border-border/60">
                      {/* Product Combobox */}
                      <div className="flex-1 min-w-[220px]">
                        <ProductSearchCombobox 
                          products={allProducts}
                          selectedProductId={item.productId}
                          onSelect={(prodId) => handleUpdateInternalRow(idx, 'productId', prodId)}
                          activeBranchId={currentBranchId}
                        />
                      </div>

                      {/* Price Tier Selection List Dropdown */}
                      {selectedProductBranch ? (
                        <div className="w-full sm:w-64 shrink-0">
                          <CustomSelect
                            value={currentTier}
                            onChange={(val) => handleUpdateInternalRow(idx, 'selectedPriceTier', val as any)}
                            options={[
                              { value: 'price1', label: `${selectedProductBranch.price1Label || 'قطاعي'}: ${selectedProductBranch.price1.toFixed(2)} ج.م` },
                              { value: 'price2', label: `${selectedProductBranch.price2Label || 'جملة'}: ${selectedProductBranch.price2.toFixed(2)} ج.م` },
                              { value: 'price3', label: `${selectedProductBranch.price3Label || 'سعر خاص VIP'}: ${selectedProductBranch.price3.toFixed(2)} ج.م` },
                              { value: 'price4', label: `${selectedProductBranch.price4Label || 'سعر 4'}: ${(selectedProductBranch.price4 || selectedProductBranch.price1).toFixed(2)} ج.م` },
                            ]}
                          />
                        </div>
                      ) : (
                        <div className="w-full sm:w-64 h-11 bg-muted/30 border border-border/40 rounded-xl px-3 flex items-center justify-center text-xs font-bold text-muted-foreground/60 shrink-0">
                          اختر المنتج لعرض الأسعار
                        </div>
                      )}

                      {/* Remove Component Row */}
                      {internalItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInternalRow(idx)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0 self-center"
                          title="حذف المكون"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. External Components Section: إضافة مكون مشتري من الخارج */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-extrabold text-foreground">
                  مكونات مشترى من الخارج
                </Label>
                <button
                  type="button"
                  onClick={handleAddExternalRow}
                  className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20"
                >
                  <Plus size={14} />
                  <span>+ إضافة مكون مشتري من الخارج</span>
                </button>
              </div>

              <div className="space-y-2">
                {externalItems.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-3 rounded-2xl border border-dashed border-border/60 text-center">
                    اضغط "+ إضافة مكون مشتري من الخارج" لإضافة أي قطعة أو مادة خارجية مع تكلفتها.
                  </p>
                ) : (
                  externalItems.map((ext, idx) => (
                    <div key={ext.id} className="flex items-center gap-2 bg-muted/20 p-2.5 rounded-2xl border border-border/60">
                      <Input 
                        placeholder="اسم المكون الخارجي..."
                        value={ext.name}
                        onChange={(e) => handleUpdateExternalRow(idx, 'name', e.target.value)}
                        className="flex-1 h-11 bg-background border-border/80 rounded-xl text-xs font-bold"
                      />
                      <Input 
                        type="number"
                        min="0"
                        placeholder="التكلفة (ج.م)"
                        value={ext.cost || ''}
                        onChange={(e) => handleUpdateExternalRow(idx, 'cost', parseFloat(e.target.value) || 0)}
                        className="w-28 h-11 bg-background border-border/80 rounded-xl text-center font-bold font-mono text-xs"
                      />
                      <Input 
                        type="number"
                        min="1"
                        value={ext.quantity}
                        onChange={(e) => handleUpdateExternalRow(idx, 'quantity', Math.max(1, parseFloat(e.target.value) || 1))}
                        placeholder="الكمية"
                        className="w-20 h-11 bg-background border-border/80 rounded-xl text-center font-bold font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExternalRow(idx)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. Selling Price Calculation & Enforcement */}
            <div className="bg-muted/30 p-4 rounded-2xl border border-border/70 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <Label className="text-xs font-extrabold text-foreground block">
                    سعر التركيبة (سعر البيع)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    مجموع تكلفة المكونات: <strong className="text-foreground font-mono">{calculatedTotalComponentCost} ج.م</strong> | 
                    الحد الأدنى لسعر التركيبة (+5 ج.م): <strong className="text-amber-500 font-mono">{minSellingPrice} ج.م</strong>
                  </p>
                </div>
                <div className="w-full sm:w-48">
                  <Input 
                    type="number"
                    min={minSellingPrice}
                    value={customSellingPrice || ''}
                    onChange={(e) => setCustomSellingPrice(parseFloat(e.target.value) || 0)}
                    placeholder={`${minSellingPrice}`}
                    className="h-11 bg-background border-amber-500/50 focus:ring-amber-500 text-center font-extrabold text-base font-mono text-amber-500 rounded-xl shadow-xs"
                  />
                </div>
              </div>
              {customSellingPrice < minSellingPrice && (
                <p className="text-[11px] font-bold text-destructive text-right pt-1">
                  ⚠️ سعر التركيبة يجب أن يكون أزيد من مجموع المكونات المضافة بـ 5 جنيه على الأقل (الحد الأدنى: {minSellingPrice} ج.م).
                </p>
              )}
            </div>

            {/* Error display if any */}
            {compFormError && (
              <p className="text-xs font-bold text-destructive bg-destructive/10 p-3 rounded-xl text-center">
                {compFormError}
              </p>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setIsCompositionModalOpen(false)}
                className="h-11 px-6 rounded-xl text-xs font-bold border-border hover:bg-muted"
              >
                إلغاء
              </Button>
              <Button 
                type="button"
                onClick={handleSaveCompositionFromPOS}
                disabled={customSellingPrice < minSellingPrice}
                className="h-11 px-8 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-black shadow-md transition-all"
              >
                إضافة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
