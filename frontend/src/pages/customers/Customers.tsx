import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../../services/store';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreSync } from '../../hooks/useStoreSync';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Users, Search, Download, Star, MessageCircle, Send, Megaphone, Check, Copy, Sparkles, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  invoiceCount: number;
  totalSpent: number;
  lastVisit: string;
  isFavorite: boolean;
}

export const Customers = () => {
  useStoreSync();
  const { user } = useAuth();
  const location = useLocation();

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-rose-500 font-bold bg-card border border-border rounded-2xl m-6" dir="rtl">
        غير مصرح لك بالوصول لصفحة سجل العملاء (متاح للسوبر أدمن فقط).
      </div>
    );
  }

  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    return localStorage.getItem('last_active_branch') || user?.branchId || 'b1';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const bId = params.get('id') || localStorage.getItem('last_active_branch') || user?.branchId || 'b1';
    setActiveBranchId(bId);
  }, [location.search, user?.branchId]);

  const currentBranch = store.getBranch(activeBranchId);
  const currentBranchName = currentBranch?.nameAr || 'الفرع الحالي';

  const [search, setSearch] = useState<string>('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [storeVersion, setStoreVersion] = useState<number>(0);
  const [deletedKeys, setDeletedKeys] = useState<Record<string, boolean>>({});
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<CustomerRecord | null>(null);

  const handleToggleFavorite = (customer: CustomerRecord) => {
    if (customer.isFavorite) {
      store.removeCustomer(customer.id);
      if (customer.phone) store.removeCustomer(customer.phone);
    } else {
      store.addCustomer({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        branchId: activeBranchId
      });
    }
    setStoreVersion(prev => prev + 1);
  };

  const confirmDeleteCustomerAction = () => {
    if (!deleteConfirmCustomer) return;
    store.removeCustomer(deleteConfirmCustomer.id);
    if (deleteConfirmCustomer.phone) {
      store.removeCustomer(deleteConfirmCustomer.phone);
    }
    const key = deleteConfirmCustomer.phone.trim() || deleteConfirmCustomer.name.trim();
    setDeletedKeys(prev => ({ ...prev, [key]: true }));
    setDeleteConfirmCustomer(null);
    setStoreVersion(prev => prev + 1);
  };

  // Aggregate Customer Records for Active Branch
  const customerRecords = useMemo(() => {
    const branchInvoices = store.getInvoicesByBranch(activeBranchId);
    const favoriteCustomers = store.getCustomers().filter(fc => !fc.branchId || fc.branchId === activeBranchId);
    const customerMap = new Map<string, CustomerRecord>();

    const isFavCustomer = (rawPhone: string, rawName: string, customerId?: string) => {
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const cleanName = rawName.trim().toLowerCase();
      return favoriteCustomers.some(fc => {
        const fcPhone = (fc.phone || '').replace(/\D/g, '');
        const fcName = (fc.name || '').trim().toLowerCase();
        return (
          (customerId && fc.id === customerId) ||
          (cleanPhone && fcPhone && (cleanPhone === fcPhone || cleanPhone.endsWith(fcPhone) || fcPhone.endsWith(cleanPhone))) ||
          (cleanName && fcName && cleanName === fcName)
        );
      });
    };

    // 1. Process Branch Invoices
    branchInvoices.forEach(inv => {
      const rawPhone = (inv.customerPhone || '').trim();
      const rawName = (inv.customerName || 'عميل فرع').trim();
      if (!rawPhone && !rawName) return;

      const key = rawPhone || rawName;
      if (deletedKeys[key]) return; // Skip deleted customers

      const isFav = isFavCustomer(rawPhone, rawName, inv.customerId);

      const existing = customerMap.get(key);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalSpent += (inv.total || 0);
        if (new Date(inv.date) > new Date(existing.lastVisit)) {
          existing.lastVisit = inv.date;
        }
        if (isFav) existing.isFavorite = true;
      } else {
        customerMap.set(key, {
          id: inv.customerId || `c_${Date.now()}_${Math.random()}`,
          name: rawName,
          phone: rawPhone,
          invoiceCount: 1,
          totalSpent: inv.total || 0,
          lastVisit: inv.date,
          isFavorite: isFav
        });
      }
    });

    // 2. Add Favorite Customers who belong to this branch and might not have invoices in this branch yet
    favoriteCustomers.forEach(fc => {
      const key = (fc.phone || '').trim() || (fc.name || '').trim();
      if (key && !deletedKeys[key]) {
        const existing = Array.from(customerMap.values()).find(
          c => (fc.phone && c.phone.replace(/\D/g, '') === fc.phone.replace(/\D/g, '')) ||
               (fc.name && c.name.trim().toLowerCase() === fc.name.trim().toLowerCase())
        );
        if (existing) {
          existing.isFavorite = true;
        } else {
          customerMap.set(key, {
            id: fc.id,
            name: fc.name,
            phone: fc.phone,
            invoiceCount: 0,
            totalSpent: 0,
            lastVisit: new Date().toISOString(),
            isFavorite: true
          });
        }
      }
    });

    return Array.from(customerMap.values()).sort(
      (a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
    );
  }, [activeBranchId, storeVersion, deletedKeys]);

  // Filtered customers by search term & favorites filter (Sorted by Last Visit Date)
  const filteredCustomers = useMemo(() => {
    let list = customerRecords;
    if (showFavoritesOnly) {
      list = list.filter(c => c.isFavorite);
    }
    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.phone.toLowerCase().includes(term)
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
    );
  }, [customerRecords, search, showFavoritesOnly]);

  // Summary stats
  const totalCustomersCount = customerRecords.length;
  const favoriteCount = customerRecords.filter(c => c.isFavorite).length;

  // Offers Modal State & Handlers
  const [isOffersModalOpen, setIsOffersModalOpen] = useState<boolean>(false);
  const [offerMessage, setOfferMessage] = useState<string>('مرحباً بك في متجر صفية وبولا ومينا للإكسسوارات! 🎁 يسعدنا إعلامك بوجود عرض خاص وتخفيضات مميزة على التشكيلة الجديدة الآن في المحل. شرفنا بالزيارة للاستفادة بالعرض!');
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [sentCustomerIds, setSentCustomerIds] = useState<Record<string, boolean>>({});

  // Reachable customers with valid phone numbers
  const reachableCustomers = useMemo(() => {
    return customerRecords.filter(c => (c.phone || '').trim().length > 0);
  }, [customerRecords]);

  // Helper to format phone number for Egyptian WhatsApp (e.g. 010xxx -> 2010xxx)
  const formatPhoneForWhatsApp = (phone: string) => {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!cleanPhone) return '';
    return cleanPhone.startsWith('2') ? cleanPhone : `20${cleanPhone.replace(/^0/, '')}`;
  };

  // Send to individual customer via WhatsApp
  const handleSendSingleCustomer = (customer: CustomerRecord) => {
    const formattedPhone = formatPhoneForWhatsApp(customer.phone);
    if (!formattedPhone) return;
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(offerMessage)}`;
    window.open(url, '_blank');
    setSentCustomerIds(prev => ({ ...prev, [customer.id]: true }));
  };

  // Send broadcast / open WhatsApp links for reachable customers
  const handleSendAllWhatsApp = () => {
    if (reachableCustomers.length === 0) {
      alert('لا يوجد عملاء لديهم أرقام هواتف مسجلة بالفرع!');
      return;
    }
    if (!offerMessage.trim()) {
      alert('يرجى كتابة نص رسالة العرض أولاً!');
      return;
    }

    const updatedSentState: Record<string, boolean> = {};

    // Open first customer's WhatsApp link directly
    const firstCustomer = reachableCustomers[0];
    const formattedPhone = formatPhoneForWhatsApp(firstCustomer.phone);
    if (formattedPhone) {
      const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(offerMessage)}`;
      window.open(url, '_blank');
      updatedSentState[firstCustomer.id] = true;
    }

    // Sequentially open up to 5 tabs directly to bypass browser pop-up restrictions, and mark all as sent
    reachableCustomers.forEach((c, idx) => {
      updatedSentState[c.id] = true;
      if (idx > 0 && idx < 5) {
        const p = formatPhoneForWhatsApp(c.phone);
        if (p) {
          setTimeout(() => {
            window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(offerMessage)}`, '_blank');
          }, idx * 400);
        }
      }
    });

    setSentCustomerIds(prev => ({ ...prev, ...updatedSentState }));
  };

  // Copy message text to clipboard
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(offerMessage);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  // Download PDF / Print Report Handler
  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لتحميل التقرير كـ PDF!');
      return;
    }

    const reportDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const rowsHtml = filteredCustomers.map((c, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; text-align: right; font-weight: bold;">${c.name} ${c.isFavorite ? '⭐' : ''}</td>
        <td style="padding: 10px; text-align: center; font-family: monospace; font-weight: bold; font-size: 13px;">${c.phone || 'غير محدد'}</td>
        <td style="padding: 10px; text-align: center;">${c.isFavorite ? 'عميل مفضل' : 'عادي'}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold;">${c.invoiceCount}</td>
        <td style="padding: 10px; text-align: left; font-family: monospace; font-weight: bold; color: #059669;">${c.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</td>
        <td style="padding: 10px; text-align: center; font-size: 11px; color: #64748b;">${new Date(c.lastVisit).toLocaleDateString('ar-EG')}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>سجل أرقام والعملاء - ${currentBranchName}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; background: #ffffff; }
          .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: bold; color: #059669; margin: 5px 0; }
          .subtitle { font-size: 14px; color: #64748b; margin: 2px 0; }
          .stats-grid { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f8fafc; padding: 12px 20px; border-radius: 10px; border: 1px solid #e2e8f0; }
          .stat-item { text-align: center; }
          .stat-label { font-size: 11px; color: #64748b; font-weight: bold; }
          .stat-val { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #f1f5f9; color: #334155; padding: 10px; text-align: center; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 12px; font-weight: bold; color: #64748b;">متجر إكسسوارات Salla Bola & Mina</div>
          <div class="title">سجل العملاء وأرقام الاتصال (${currentBranchName})</div>
          <div class="subtitle">تاريخ التقرير: ${reportDate}</div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">إجمالي العملاء بالفرع</div>
            <div class="stat-val">${totalCustomersCount} عميل</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">العملاء المفضلون</div>
            <div class="stat-val">${favoriteCount} عميل</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th style="text-align: right;">اسم العميل</th>
              <th>رقم التليفون</th>
              <th>النوع</th>
              <th>عدد الفواتير</th>
              <th style="text-align: left;">إجمالي التعاملات</th>
              <th>آخر معاملة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colSpan="7" style="text-align:center; padding: 20px;">لا يوجد عملاء مسجلين</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          تقرير رسمي صادر من نظام إكسسوارات Salla Bola & Mina — حفظ كملف PDF
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6 animate-in fade-in" dir="rtl">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border/80 p-6 rounded-3xl shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <Users size={28} className="text-amber-500 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">سجل أرقام العملاء</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              دليل بيانات وأرقام تليفونات العملاء المسجلين والزبائن الذين تم التعامل معهم بالفرع.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button 
            onClick={handleDownloadPDF}
            className="shadow-md bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-5 h-11 rounded-2xl gap-2 w-full sm:w-auto"
          >
            <Download size={18} />
            <span>تحميل PDF / تصدير السجل</span>
          </Button>
        </div>
      </div>

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        {/* Total Customers Card (Cyan Theme - NON-CLICKABLE STATIC DISPLAY) */}
        <Card className="bg-card border border-border/80 border-l-4 border-l-cyan-500 rounded-2xl p-5 min-h-[100px]">
          <div className="flex flex-row items-center justify-between w-full">
            <div className="flex flex-col items-start justify-center gap-1">
              <span className="text-xs font-bold text-muted-foreground">إجمالي عملاء الفرع</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                  {totalCustomersCount}
                </span>
                <span className="text-xs font-bold text-muted-foreground">عميل</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-xs">
              <Users size={22} />
            </div>
          </div>
        </Card>

        {/* Favorite Customers Card (Amber Theme - CLICKABLE FILTER TOGGLE) */}
        <Card 
          onClick={() => setShowFavoritesOnly(prev => !prev)}
          className={`bg-card border border-l-4 border-l-amber-500 rounded-2xl p-5 min-h-[100px] cursor-pointer transition-all hover:bg-amber-500/10 hover:border-amber-500/50 select-none ${
            showFavoritesOnly ? 'ring-2 ring-amber-500/60 border-amber-500 bg-amber-500/10' : 'border-border/80'
          }`}
        >
          <div className="flex flex-row items-center justify-between w-full">
            <div className="flex flex-col items-start justify-center gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">العملاء المفضلون ⭐</span>
                {showFavoritesOnly && (
                  <span className="text-[10px] bg-amber-500 text-black font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                    مفعل
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                  {favoriteCount}
                </span>
                <span className="text-xs font-bold text-amber-400/90">عميل مفضل</span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-full border flex items-center justify-center shrink-0 shadow-xs transition-colors ${
              showFavoritesOnly 
                ? 'bg-amber-500 text-black border-amber-400' 
                : 'bg-amber-950/80 border-amber-500/30 text-amber-400'
            }`}>
              <Star size={22} className={showFavoritesOnly ? 'fill-black text-black' : 'fill-amber-400 text-amber-400'} />
            </div>
          </div>
        </Card>

        {/* Offers Message Card (Emerald/WhatsApp Theme - CLICKABLE MODAL TRIGGER ON THE LEFT SIDE) */}
        <Card 
          onClick={() => setIsOffersModalOpen(true)}
          className="bg-card border border-l-4 border-l-emerald-500 rounded-2xl p-5 min-h-[100px] cursor-pointer transition-all hover:bg-emerald-500/10 hover:border-emerald-500/50 select-none group shadow-xs"
        >
          <div className="flex flex-row items-center justify-between w-full">
            <div className="flex flex-col items-start justify-center gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                  <Megaphone size={14} className="animate-bounce" />
                  رسالة عروض 📢
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl sm:text-2xl font-extrabold text-foreground">
                  إرسال عروض
                </span>
                <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {reachableCustomers.length} عميل
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-all flex items-center justify-center shrink-0 shadow-xs">
              <MessageCircle size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* SEARCH AND CUSTOMERS TABLE */}
      <div className="space-y-4 print:hidden">
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="ابحث باسم العميل أو برقم التليفون..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 h-12 text-xs rounded-2xl bg-card border-border/80 shadow-2xs w-full"
          />
        </div>

        <div className="bg-card rounded-2xl border border-border/80 overflow-hidden shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold text-right">اسم العميل</TableHead>
                <TableHead className="text-xs font-bold text-center">رقم التليفون</TableHead>
                <TableHead className="text-xs font-bold text-center">الحالة</TableHead>
                <TableHead className="text-xs font-bold text-center">عدد الفواتير</TableHead>
                <TableHead className="text-xs font-bold text-left">إجمالي المشتريات</TableHead>
                <TableHead className="text-xs font-bold text-center">تاريخ آخر معاملة</TableHead>
                <TableHead className="text-xs font-bold text-center">تواصل</TableHead>
                <TableHead className="text-xs font-bold text-center">حذف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                    لا يوجد عملاء مطبقين لنتائج البحث في {currentBranchName}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((c) => {
                  const cleanPhone = (c.phone || '').replace(/\D/g, '');
                  const formattedPhone = cleanPhone.startsWith('2') ? cleanPhone : `20${cleanPhone.replace(/^0/, '')}`;

                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      {/* 1. Customer Name */}
                      <TableCell className="py-3 font-bold text-xs text-foreground">
                        <span>{c.name}</span>
                      </TableCell>

                      {/* 2. Phone */}
                      <TableCell className="text-center py-3 font-mono font-bold text-xs text-muted-foreground" dir="ltr">
                        {c.phone || 'غير مسجل'}
                      </TableCell>

                      {/* 3. Status Badge (Click to toggle) */}
                      <TableCell className="text-center py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(c)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all inline-flex items-center justify-center gap-1 cursor-pointer border ${
                            c.isFavorite 
                              ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25 shadow-xs' 
                              : 'bg-muted/60 text-muted-foreground border-border hover:bg-amber-500/10 hover:text-amber-500'
                          }`}
                          title="اضغط للتبديل بين عميل مفضل وعادي"
                        >
                          <span>{c.isFavorite ? 'مفضل ⭐' : 'عادي'}</span>
                        </button>
                      </TableCell>

                      {/* 4. Invoice Count */}
                      <TableCell className="text-center py-3 font-mono font-bold text-xs">
                        {c.invoiceCount}
                      </TableCell>

                      {/* 5. Total Spent */}
                      <TableCell className="text-left py-3 font-mono font-bold text-xs text-amber-500" dir="ltr">
                        {c.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </TableCell>

                      {/* 6. Last Visit Date */}
                      <TableCell className="text-center py-3 text-xs text-muted-foreground font-mono">
                        <div className="font-bold text-foreground">{new Date(c.lastVisit).toLocaleDateString('ar-EG')}</div>
                        <div className="text-[10px] text-muted-foreground/80">
                          {new Date(c.lastVisit).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </TableCell>

                      {/* 7. Contact (WhatsApp - Emerald Theme) */}
                      <TableCell className="text-center py-3">
                        {c.phone ? (
                          <a
                            href={`https://wa.me/${formattedPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-xl transition-colors"
                          >
                            <MessageCircle size={14} />
                            <span>واتساب</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* 8. Delete Button (Far Left Column) */}
                      <TableCell className="text-center py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmCustomer(c)}
                          className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl shrink-0"
                          title="حذف العميل"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* OFFERS BROADCAST POPUP MODAL (Emerald/WhatsApp Theme) */}
      <Dialog open={isOffersModalOpen} onOpenChange={setIsOffersModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-card border-border/80 p-6 space-y-4 shadow-2xl">
          <DialogHeader className="text-right space-y-2">
            <div className="flex items-center gap-3 text-emerald-500">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Megaphone size={20} />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  إرسال رسالة عروض للعملاء عبر الواتساب 📢
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  أرسل خصومات وتنبيهات فورية لجميع زبائن وعملاء {currentBranchName} عبر واتساب بيزنس.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Target Customers Counter Info Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-500">
                <Sparkles size={16} />
                <span>إجمالي العملاء المستهدفين بالفرع:</span>
              </div>
              <span className="font-mono font-extrabold text-sm px-3 py-1 rounded-xl bg-emerald-500 text-black shadow-xs">
                {reachableCustomers.length} عميل
              </span>
            </div>

            {/* Message Textarea */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-foreground">
                  نص رسالة العرض أو التخفيض:
                </label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleCopyMessage}
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2 rounded-lg"
                >
                  {copiedSuccess ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedSuccess ? 'تم النسخ' : 'نسخ النص'}</span>
                </Button>
              </div>
              <textarea
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                placeholder="اكتب تفاصيل العرض والتخفيض هنا... مثال: بمناسبة التخفيضات عملنا خصم 20% على كل الإكسسوارات عندنا في المحل!"
                className="w-full h-32 p-3 text-xs rounded-2xl bg-background border border-border/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none text-foreground leading-relaxed shadow-2xs"
              />
            </div>

            {/* Reachable Customer List with direct send buttons */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-muted-foreground">قائمة أرقام العملاء بالفرع:</span>
                <span className="text-[10px] text-muted-foreground">يمكنك الإرسال للجميع دفعة واحدة أو لعميل عميل</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border border-border/60 rounded-2xl p-2 bg-muted/20">
                {reachableCustomers.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">لا يوجد أرقام تليفونات مسجلة للعملاء في هذا الفرع.</p>
                ) : (
                  reachableCustomers.map((c) => {
                    const isSent = sentCustomerIds[c.id];
                    return (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{c.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">{c.phone}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSendSingleCustomer(c)}
                          className={`h-7 px-2.5 rounded-lg text-[11px] font-bold gap-1 ${
                            isSent ? 'bg-emerald-500/15 text-emerald-500' : 'bg-emerald-500 text-black hover:bg-emerald-600'
                          }`}
                        >
                          <MessageCircle size={13} />
                          <span>{isSent ? 'تم الفتح ✓' : 'إرسال'}</span>
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              onClick={handleSendAllWhatsApp}
              disabled={reachableCustomers.length === 0 || !offerMessage.trim()}
              className="w-full sm:w-auto flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-2xl gap-2 shadow-md"
            >
              <Send size={16} />
              <span>إرسال العرض عبر واتساب بيزنس ({reachableCustomers.length} عميل)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOffersModalOpen(false)}
              className="w-full sm:w-auto h-11 rounded-2xl text-xs font-bold"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------------- */}
      {/* DELETE CUSTOMER CONFIRMATION POPUP MODAL */}
      {/* ------------------------------------------------------------------------- */}
      <Dialog open={!!deleteConfirmCustomer} onOpenChange={(open) => !open && setDeleteConfirmCustomer(null)}>
        <DialogContent className="max-w-xs sm:max-w-md w-[92vw] bg-card border-border rounded-3xl p-6 shadow-2xl space-y-4" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-base font-bold text-rose-500 flex items-center gap-2">
              <AlertTriangle size={20} className="text-rose-500" />
              <span>تأكيد حذف العميل</span>
            </DialogTitle>
          </DialogHeader>

          {deleteConfirmCustomer && (
            <div className="space-y-4">
              <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 text-xs space-y-2">
                <p className="font-bold text-foreground leading-relaxed text-sm">
                  هل أنت تأكد من حذف العميل <span className="text-rose-500 font-extrabold">({deleteConfirmCustomer.name})</span> من السجل؟
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ⚠️ سيتم إزالة هذا العميل وأرقامه من القوائم بالكامل.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteConfirmCustomer(null)}
                  className="flex-1 h-11 text-xs font-bold rounded-xl border-border"
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  onClick={confirmDeleteCustomerAction}
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
