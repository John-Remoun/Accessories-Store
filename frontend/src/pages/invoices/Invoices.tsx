import { useState, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../../services/store';
import { Invoice } from '../../types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { 
  Printer, Eye, 
  ChevronLeft, ChevronRight, Search, RotateCcw, 
  Send, Trash2, Building2, Sparkles, X, AlertTriangle,
  Star, BookOpen, CreditCard, Phone, CheckCircle2, Clock, FileText,
  User, DollarSign, ArrowLeftRight, MessageSquareText
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import lightLogo from '../../assets/light-logo.png';

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const WEEKDAY_NAMES_AR = [
  'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
];

const getIsoDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const Invoices = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-rose-500 font-bold bg-card border border-border rounded-2xl m-6" dir="rtl">
        غير مصرح لك بالوصول لصفحة الفواتير والمبيعات (متاح للسوبر أدمن فقط).
      </div>
    );
  }

  const allInvoices = store.getInvoices();

  // Active Branch Identification
  const activeBranchId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('id') || localStorage.getItem('last_active_branch') || user?.branchId || 'b1';
  }, [location.search, user?.branchId]);

  const activeBranch = store.getBranch(activeBranchId);
  const activeBranchName = activeBranch?.nameAr || 'فرع أحمد عرابي';

  // Branch Invoices
  const branchInvoices = useMemo(() => {
    return allInvoices.filter(inv => inv.branchId === activeBranchId);
  }, [allInvoices, activeBranchId]);

  // State Management
  const [activeTab, setActiveTab] = useState<'all' | 'unpaid' | 'paid' | 'favorites'>('all');
  const [search, setSearch] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Calendar State
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDeleteMonthModalOpen, setIsDeleteMonthModalOpen] = useState(false);
  const [isDeleteDayModalOpen, setIsDeleteDayModalOpen] = useState(false);
  const calendarStripeRef = useRef<HTMLDivElement>(null);

  // Selected Modals State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statementCustomerPhone, setStatementCustomerPhone] = useState<string | null>(null);
  const [statementCustomerName, setStatementCustomerName] = useState<string>('');
  const [statementModalTab, setStatementModalTab] = useState<'unpaid' | 'paid'>('unpaid');

  // Payment Settlement Modal State
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentModalCustomerPhone, setPaymentModalCustomerPhone] = useState<string | null>(null);
  const [paymentModalCustomerName, setPaymentModalCustomerName] = useState<string>('');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');

  // Single / Batch Delete Modals State
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  // Calendar Math & Helpers
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const monthInvoicesMap = useMemo(() => {
    const map = new Map<number, number>();
    branchInvoices.forEach(inv => {
      const d = new Date(inv.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const dayNum = d.getDate();
        map.set(dayNum, (map.get(dayNum) || 0) + 1);
      }
    });
    return map;
  }, [branchInvoices, currentYear, currentMonth, refreshKey]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
    setSelectedDate(null);
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    const isoToday = getIsoDate(today.toISOString());
    setSelectedDate(isoToday);
  };

  const handleResetFilter = () => {
    setSelectedDate(null);
  };

  const handleConfirmDeleteMonth = () => {
    const monthInvoices = branchInvoices.filter(inv => {
      const d = new Date(inv.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
    const ids = monthInvoices.map(i => i.id);
    if (ids.length > 0) {
      store.deleteInvoicesByIds(ids);
      setRefreshKey(prev => prev + 1);
    }
    setIsDeleteMonthModalOpen(false);
  };

  const handleConfirmDeleteDay = () => {
    if (!selectedDate) return;
    const dayInvoices = branchInvoices.filter(inv => getIsoDate(inv.date) === selectedDate);
    const ids = dayInvoices.map(i => i.id);
    if (ids.length > 0) {
      store.deleteInvoicesByIds(ids);
      setRefreshKey(prev => prev + 1);
    }
    setIsDeleteDayModalOpen(false);
  };

  // Helper getters
  const getInvoiceRemaining = (inv: Invoice) => {
    if (inv.remainingAmount !== undefined) return inv.remainingAmount;
    if (inv.paymentStatus === 'paid') return 0;
    return Math.max(0, inv.total - (inv.paidAmount || 0));
  };

  const getInvoicePaid = (inv: Invoice) => {
    if (inv.paidAmount !== undefined) return inv.paidAmount;
    if (inv.paymentStatus === 'paid') return inv.total;
    return 0;
  };

  const isInvoiceUnpaid = (inv: Invoice) => {
    return inv.paymentStatus === 'deferred' || inv.paymentStatus === 'partial' || getInvoiceRemaining(inv) > 0;
  };

  // Filtered Lists
  const filteredInvoices = useMemo(() => {
    let list = branchInvoices;

    // Calendar day filter or month filter
    if (selectedDate) {
      list = list.filter(inv => getIsoDate(inv.date) === selectedDate);
    } else {
      list = list.filter(inv => {
        const d = new Date(inv.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    }

    // Filter by tab
    if (activeTab === 'unpaid') {
      list = list.filter(inv => isInvoiceUnpaid(inv));
    } else if (activeTab === 'paid') {
      list = list.filter(inv => !isInvoiceUnpaid(inv));
    } else if (activeTab === 'favorites') {
      list = list.filter(inv => inv.isFavorite);
    }

    // Filter by search term
    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(term) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(term)) ||
        (inv.customerPhone && inv.customerPhone.includes(term))
      );
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [branchInvoices, selectedDate, currentYear, currentMonth, activeTab, search, refreshKey]);

  // Dual Column Categorized Lists for Main View
  const unpaidInvoicesList = useMemo(() => {
    return filteredInvoices.filter(inv => isInvoiceUnpaid(inv));
  }, [filteredInvoices]);

  const paidInvoicesList = useMemo(() => {
    return filteredInvoices.filter(inv => !isInvoiceUnpaid(inv));
  }, [filteredInvoices]);

  const totalUnpaidAmount = useMemo(() => {
    return unpaidInvoicesList.reduce((acc, inv) => acc + getInvoiceRemaining(inv), 0);
  }, [unpaidInvoicesList]);

  const totalPaidAmount = useMemo(() => {
    return paidInvoicesList.reduce((acc, inv) => acc + (inv.total || 0), 0);
  }, [paidInvoicesList]);

  const favoritesCount = useMemo(() => {
    return branchInvoices.filter(inv => inv.isFavorite).length;
  }, [branchInvoices, refreshKey]);

  // Handlers
  const handleToggleFavorite = (invId: string) => {
    store.toggleFavoriteInvoice(invId);
    setRefreshKey(prev => prev + 1);
  };

  const handleConfirmDeleteSingle = () => {
    if (singleDeleteId) {
      store.deleteInvoicesByIds([singleDeleteId]);
      setRefreshKey(prev => prev + 1);
      setSingleDeleteId(null);
    }
  };

  // Open Statement Modal ("كشف الحساب")
  const handleOpenCustomerStatement = (customerName?: string, customerPhone?: string) => {
    if (!customerPhone && !customerName) {
      alert('لا يتوفر رقم هاتف أو اسم لهذا العميل لعرض كشف الحساب.');
      return;
    }
    setStatementCustomerPhone(customerPhone || null);
    setStatementCustomerName(customerName || customerPhone || 'عميل الفرع');
    setStatementModalTab('unpaid');
  };

  // Open Single Invoice Payment Dialog
  const handleOpenSinglePayModal = (inv: Invoice) => {
    const rem = getInvoiceRemaining(inv);
    setPaymentModalInvoice(inv);
    setPaymentModalCustomerPhone(null);
    setPaymentModalCustomerName(inv.customerName || 'العميل');
    setPaymentAmountInput(rem.toString());
  };

  // Open Customer Debt Payment Dialog
  const handleOpenCustomerDebtPayModal = (customerName: string, customerPhone: string, totalDebt: number) => {
    setPaymentModalInvoice(null);
    setPaymentModalCustomerPhone(customerPhone);
    setPaymentModalCustomerName(customerName);
    setPaymentAmountInput(totalDebt.toString());
  };

  // Submit Payment Settlement
  const handleConfirmSubmitPayment = () => {
    const amt = parseFloat(paymentAmountInput);
    if (isNaN(amt) || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    if (paymentModalInvoice) {
      store.payInvoice(paymentModalInvoice.id, amt);
      setPaymentModalInvoice(null);
    } else if (paymentModalCustomerPhone) {
      store.payCustomerDebt(paymentModalCustomerPhone, amt);
      setPaymentModalCustomerPhone(null);
    }

    setRefreshKey(prev => prev + 1);
  };

  // WhatsApp Sender Helpers
  const handleSendWhatsAppInvoice = (inv: Invoice) => {
    const branchObj = store.getBranch(inv.branchId);
    const branchName = branchObj ? branchObj.nameAr : activeBranchName;
    const sellerObj = store.getUsers().find(u => u.id === inv.employeeId);
    const sellerName = sellerObj ? sellerObj.name : 'الكاشير';
    const customerInfo = inv.customerName ? `${inv.customerName} (${inv.customerPhone || ''})` : 'عميل الفرع';

    const itemNames = inv.items.map(i => {
      const p = store.getProduct(i.productId);
      return p?.nameAr || p?.nameEn || 'منتج إكسسوارات';
    }).join(', ');

    const rem = getInvoiceRemaining(inv);

    const msg = `*فاتورة مبيعات - Salla Bola & Mina*
------------------------------
• رقم الفاتورة: #${inv.invoiceNumber}
• الفرع: ${branchName}
• التاريخ: ${new Date(inv.date).toLocaleDateString('ar-EG')} - ${new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
• الكاشير: ${sellerName}
• العميل: ${customerInfo}

الأصناف: ${itemNames}

------------------------------
• إجمالي الفاتورة: ${inv.total.toFixed(2)} ج.م
• المدفوع: ${getInvoicePaid(inv).toFixed(2)} ج.م
• المتبقي المستحق: ${rem.toFixed(2)} ج.م
------------------------------
هدفنا إرضاء العميل وليس الربح`;

    const phoneNum = inv.customerPhone ? inv.customerPhone.replace(/[^0-9]/g, '') : '';
    const targetPhone = phoneNum.startsWith('01') ? `2${phoneNum}` : phoneNum;
    const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // WhatsApp Statement Reminder
  const handleSendWhatsAppStatementReminder = (customerName: string, customerPhone: string, invoices: Invoice[], totalDebt: number) => {
    const msg = `*تذكير بكشف الحساب والديون المستحقة - Salla Bola & Mina*
------------------------------
العميل المحترم: ${customerName} (${customerPhone})
عدد الفواتير غير المدفوعة: ${invoices.length} فاتورة
إجمالي الديون المستحقة عليك: ${totalDebt.toFixed(2)} ج.م

نرجو التكرم بسداد المبلغ المستحق في أقرب وقت.
شكراً لتعاملكم معنا.
------------------------------
Salla Bola & Mina`;

    const phoneNum = customerPhone.replace(/[^0-9]/g, '');
    const targetPhone = phoneNum.startsWith('01') ? `2${phoneNum}` : phoneNum;
    const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Customer Statement Calculation (Image 4 Data)
  const statementInvoices = useMemo(() => {
    if (!statementCustomerPhone && !statementCustomerName) return [];
    const term = statementCustomerPhone ? statementCustomerPhone.trim() : statementCustomerName.trim();
    return branchInvoices.filter(i => 
      (i.customerPhone && i.customerPhone.trim() === term) ||
      (i.customerName && i.customerName.trim() === term)
    );
  }, [branchInvoices, statementCustomerPhone, statementCustomerName, refreshKey]);

  const statementUnpaidInvoices = useMemo(() => {
    return statementInvoices.filter(inv => isInvoiceUnpaid(inv));
  }, [statementInvoices]);

  const statementPaidInvoices = useMemo(() => {
    return statementInvoices.filter(inv => !isInvoiceUnpaid(inv));
  }, [statementInvoices]);

  const statementTotalPurchases = useMemo(() => {
    return statementInvoices.reduce((acc, i) => acc + i.total, 0);
  }, [statementInvoices]);

  const statementTotalDebt = useMemo(() => {
    return statementInvoices.reduce((acc, i) => acc + getInvoiceRemaining(i), 0);
  }, [statementInvoices]);

  return (
    <div className="space-y-6 pb-20 md:pb-6 animate-in fade-in" dir="rtl">
      
      {/* PAGE HEADER (Image 2 Top Title) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border/80 p-4 sm:p-5 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">سجل الفواتير والمبيعات</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">تتبع الفواتير المدفوعة والأجلة وتاريخ السداد — {activeBranchName}</p>
          </div>
        </div>
      </div>

      {/* CALENDAR STRIPE CARD */}
      <div className="bg-card border border-border/80 p-4 sm:p-5 rounded-3xl shadow-lg space-y-4">
        
        {/* Calendar Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-3">
          
          {/* Right: Month Title & Nav + Today Button (Single line on Mobile) */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/60"
                title="الشهر السابق"
              >
                <ChevronRight size={18} />
              </button>

              <h2 className="text-base sm:text-lg font-bold text-foreground min-w-[120px] text-center font-mono">
                {MONTH_NAMES_AR[currentMonth]} {currentYear}
              </h2>

              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/60"
                title="الشهر التالي"
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            <button
              onClick={handleTodayClick}
              className="px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>اليوم</span>
              <Clock size={14} />
            </button>
          </div>

          {/* Left: Active Filter Status & Reset / Admin Delete Action */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            
            {selectedDate ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetFilter}
                  className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-all flex items-center gap-1 border border-border"
                >
                  <RotateCcw size={13} />
                  <span>عرض جميع أيام الشهر</span>
                </button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground font-semibold">
                عرض كافة فواتير شهر {MONTH_NAMES_AR[currentMonth]}
              </span>
            )}

            {/* Admin Bulk Delete Month / Day options */}
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                {selectedDate && (
                  <button
                    onClick={() => setIsDeleteDayModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center gap-1"
                    title="حذف جميع فواتير اليوم المحدد"
                  >
                    <Trash2 size={13} />
                    <span>مسح اليوم</span>
                  </button>
                )}
                <button
                  onClick={() => setIsDeleteMonthModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-400 hover:bg-rose-900/40 text-xs font-bold transition-all flex items-center gap-1"
                  title="حذف جميع فواتير هذا الشهر"
                >
                  <Trash2 size={13} />
                  <span>مسح الشهر</span>
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Calendar Days Horizontal Scroll Stripe */}
        <div 
          ref={calendarStripeRef} 
          className="flex items-center gap-2.5 overflow-x-auto pb-2 custom-scrollbar scroll-smooth"
        >
          {Array.from({ length: daysInMonth }, (_, index) => {
            const dayNum = index + 1;
            const dateObj = new Date(currentYear, currentMonth, dayNum);
            const dayOfWeekIndex = dateObj.getDay();
            const weekdayName = WEEKDAY_NAMES_AR[dayOfWeekIndex];
            
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const count = monthInvoicesMap.get(dayNum) || 0;
            
            const today = new Date();
            const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === dayNum;
            const isSelected = selectedDate === dateStr;

            return (
              <button
                key={dayNum}
                onClick={() => {
                  if (isSelected) {
                    setSelectedDate(null);
                  } else {
                    setSelectedDate(dateStr);
                  }
                }}
                className={`flex-shrink-0 w-24 sm:w-28 p-3 rounded-2xl border transition-all text-center flex flex-col items-center justify-between gap-1.5 relative group ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/40'
                    : isToday
                    ? 'bg-card border-amber-500 text-amber-400 shadow-sm shadow-amber-500/10'
                    : count > 0
                    ? 'bg-card border-border/80 text-foreground hover:border-amber-500/40 hover:bg-muted/40'
                    : 'bg-card/50 border-border/40 text-muted-foreground hover:bg-muted/30 opacity-75'
                }`}
              >
                {/* Day Name & Today Badge */}
                <div className="flex items-center justify-center gap-1 w-full">
                  <span className="text-[11px] font-bold opacity-90">
                    {weekdayName}
                  </span>
                  {isToday && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-black text-[9px] font-black leading-none shrink-0 shadow-2xs">
                      اليوم
                    </span>
                  )}
                </div>

                {/* Day Number */}
                <span className="text-xl font-black font-mono tracking-tight">
                  {dayNum}
                </span>

                {/* Invoices Count Badge */}
                {count > 0 ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono ${
                    isSelected 
                      ? 'bg-amber-500 text-black' 
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {count} فاتورة
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60 font-medium">
                    لا يوجد
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* FILTER TABS & SEARCH BAR (Image 2 Header Controls) */}
      <div className="space-y-4">
        
        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/80 p-2 sm:p-2.5 rounded-2xl shadow-xs">
          
          {/* Search Input (On Right side in RTL) */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
            <Input 
              placeholder="ابحث برقم الفاتورة، رقم التليفون، أو اسم العميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-10 text-xs rounded-xl bg-background border-border/80 shadow-2xs w-full"
            />
          </div>

          {/* Navigation Tabs (Single horizontal line on Mobile under Search) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 flex-nowrap w-full sm:w-auto custom-scrollbar scrollbar-none">
            
            {/* Tab: الكل */}
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span>الكل</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
              }`}>
                {filteredInvoices.length}
              </span>
            </button>

            {/* Tab: غير مدفوعة / آجلة */}
            <button
              onClick={() => setActiveTab('unpaid')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-muted/50 text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              <span>غير مدفوعة / آجلة</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {unpaidInvoicesList.length}
              </span>
            </button>

            {/* Tab: مدفوعة بالكامل */}
            <button
              onClick={() => setActiveTab('paid')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'paid'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-muted/50 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <span>مدفوعة بالكامل</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {paidInvoicesList.length}
              </span>
            </button>

            {/* Tab: المفضلة */}
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'favorites'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-muted/50 text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span>المفضلة</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {favoritesCount}
              </span>
            </button>

          </div>

        </div>

      </div>

      {/* DUAL COLUMNS CARDS LAYOUT (Auto full width when single tab is selected) */}
      <div className={`grid gap-6 ${
        activeTab === 'paid' || activeTab === 'unpaid' 
          ? 'grid-cols-1' 
          : 'grid-cols-1 lg:grid-cols-2'
      }`}>

        {/* ========================================================= */}
        {/* COLUMN 1: FULLY PAID INVOICES SECTION (Now First / Right Side) */}
        {/* ========================================================= */}
        {(activeTab === 'all' || activeTab === 'paid' || activeTab === 'favorites') && (
          <div className="space-y-4">
            
            {/* Dark Green Column Banner Header */}
            <div className="bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border border-emerald-800/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2 text-emerald-200">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <h2 className="text-base font-bold">الفواتير المدفوعة بالكامل ({paidInvoicesList.length})</h2>
              </div>
              <div className="text-xs font-bold text-emerald-300 font-mono bg-emerald-900/40 border border-emerald-700/40 px-3 py-1 rounded-xl">
                إجمالي المحصل: {totalPaidAmount.toFixed(2)} ج.م
              </div>
            </div>

            {/* Paid Cards List */}
            {paidInvoicesList.length === 0 ? (
              <div className="bg-card border border-border/60 rounded-2xl p-8 text-center text-muted-foreground text-xs font-bold">
                لا توجد فواتير مدفوعة بالكامل حالياً.
              </div>
            ) : (
              <div className="space-y-3.5">
                {paidInvoicesList.map((inv) => {
                  const cashier = store.getUsers().find(u => u.id === inv.employeeId)?.name || 'الكاشير';

                  return (
                    <div 
                      key={inv.id}
                      className="bg-card/95 border border-emerald-900/40 rounded-2xl p-4 space-y-3 shadow-md hover:border-emerald-600/50 transition-all relative overflow-hidden group"
                    >
                      {/* Card Top Row */}
                      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                        
                        {/* Right: Date Badge & Green Status Pill */}
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            <span>مدفوع</span>
                          </span>

                          <span className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-2.5 py-1 rounded-lg border border-border/50">
                            {new Date(inv.date).toLocaleDateString('ar-EG')} - {new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Left: Invoice # + Delete + Favorite Star */}
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold font-mono text-amber-500 tracking-tight">
                            #{inv.invoiceNumber}
                          </span>

                          {/* Star Favorite Icon */}
                          <button
                            onClick={() => handleToggleFavorite(inv.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              inv.isFavorite 
                                ? 'text-amber-400 hover:bg-amber-500/10' 
                                : 'text-muted-foreground hover:text-amber-400 hover:bg-muted'
                            }`}
                            title="إضافة للمفضلة"
                          >
                            <Star size={16} className={inv.isFavorite ? 'fill-amber-400' : ''} />
                          </button>

                          {/* Trash Delete Icon */}
                          {isAdmin && (
                            <button
                              onClick={() => setSingleDeleteId(inv.id)}
                              className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="حذف الفاتورة"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                      </div>

                      {/* Card Body: Customer Info & Cashier */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        
                        {/* Customer Name & Phone */}
                        <div>
                          <div className="text-base font-bold text-foreground flex items-center gap-2">
                            <span>{inv.customerName || 'عميل فرع'}</span>
                            {inv.customerPhone && (
                              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                <Phone size={12} className="text-emerald-500" />
                                {inv.customerPhone}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <span>الكاشير: </span>
                            <span className="text-emerald-400 font-semibold">{cashier}</span>
                          </div>
                        </div>

                        {/* Amount Highlight */}
                        <div className="text-left sm:text-right font-mono">
                          <div className="text-[11px] text-muted-foreground">إجمالي المحصل</div>
                          <div className="text-lg font-extrabold text-foreground tracking-tight">
                            {inv.total.toFixed(2)} ج.م
                          </div>
                        </div>

                      </div>

                      {/* Card Action Buttons Row */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                        
                        {/* Button 1: واتساب */}
                        <button
                          onClick={() => handleSendWhatsAppInvoice(inv)}
                          className="h-8 px-3 rounded-xl bg-emerald-950/40 border border-emerald-700/50 hover:bg-emerald-900/50 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all"
                        >
                          <Send size={14} />
                          <span>واتساب</span>
                        </button>

                        {/* Button 2: معاينة/طباعة الفاتورة */}
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="h-8 px-3 rounded-xl bg-muted/60 border border-border hover:bg-muted text-foreground font-bold text-xs flex items-center gap-1.5 transition-all"
                        >
                          <Eye size={14} />
                          <span>معاينة وتفاصيل</span>
                        </button>

                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* COLUMN 2: UNPAID / DEFERRED INVOICES SECTION (Now Second / Left Side) */}
        {/* ========================================================= */}
        {(activeTab === 'all' || activeTab === 'unpaid' || activeTab === 'favorites') && (
          <div className="space-y-4">
            
            {/* Dark Red Column Banner Header */}
            <div className="bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-rose-950/80 border border-rose-800/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertTriangle size={18} className="text-rose-400" />
                <h2 className="text-base font-bold">الفواتير غير المدفوعة والأجلة ({unpaidInvoicesList.length})</h2>
              </div>
              <div className="text-xs font-bold text-rose-300 font-mono bg-rose-900/40 border border-rose-700/40 px-3 py-1 rounded-xl">
                إجمالي المستحقات: {totalUnpaidAmount.toFixed(2)} ج.م
              </div>
            </div>

            {/* Unpaid Cards List */}
            {unpaidInvoicesList.length === 0 ? (
              <div className="bg-card border border-border/60 rounded-2xl p-8 text-center text-muted-foreground text-xs font-bold">
                لا توجد فواتير غير مدفوعة أو آجلة حالياً.
              </div>
            ) : (
              <div className="space-y-3.5">
                {unpaidInvoicesList.map((inv) => {
                  const remaining = getInvoiceRemaining(inv);
                  const paid = getInvoicePaid(inv);
                  const cashier = store.getUsers().find(u => u.id === inv.employeeId)?.name || 'الكاشير';

                  return (
                    <div 
                      key={inv.id}
                      className="bg-card/95 border border-rose-900/40 rounded-2xl p-4 space-y-3 shadow-md hover:border-rose-600/50 transition-all relative overflow-hidden group"
                    >
                      {/* Card Top Row: Invoice Number, Date/Time, Badge, Actions */}
                      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                        
                        {/* Right: Date Badge & Red Status Pill */}
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-800/50 text-[11px] font-bold flex items-center gap-1">
                            <Clock size={12} />
                            <span>آجل / غير مدفوع</span>
                          </span>

                          <span className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-2.5 py-1 rounded-lg border border-border/50">
                            {new Date(inv.date).toLocaleDateString('ar-EG')} - {new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Left: Invoice # + Delete + Favorite Star */}
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold font-mono text-amber-500 tracking-tight">
                            #{inv.invoiceNumber}
                          </span>

                          {/* Star Favorite Icon */}
                          <button
                            onClick={() => handleToggleFavorite(inv.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              inv.isFavorite 
                                ? 'text-amber-400 hover:bg-amber-500/10' 
                                : 'text-muted-foreground hover:text-amber-400 hover:bg-muted'
                            }`}
                            title="إضافة للمفضلة"
                          >
                            <Star size={16} className={inv.isFavorite ? 'fill-amber-400' : ''} />
                          </button>

                          {/* Trash Delete Icon */}
                          {isAdmin && (
                            <button
                              onClick={() => setSingleDeleteId(inv.id)}
                              className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="حذف الفاتورة"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                      </div>

                      {/* Card Body: Customer Info & Cashier */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        
                        {/* Customer Name & Phone */}
                        <div>
                          <div className="text-base font-bold text-foreground flex items-center gap-2">
                            <span>{inv.customerName || 'عميل فرع'}</span>
                            {inv.customerPhone && (
                              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                <Phone size={12} className="text-emerald-500" />
                                {inv.customerPhone}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <span>الكاشير: </span>
                            <span className="text-emerald-400 font-semibold">{cashier}</span>
                          </div>
                        </div>

                        {/* Amount Highlights */}
                        <div className="text-left sm:text-right font-mono">
                          <div className="text-lg font-extrabold text-rose-500 tracking-tight">
                            المتبقي: {remaining.toFixed(2)} ج.م
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            مدفوع: {paid.toFixed(2)} من {inv.total.toFixed(2)} ج.م
                          </div>
                        </div>

                      </div>

                      {/* Card Action Buttons Row (Exact Design matching Image 3) */}
                      <div className="pt-2 border-t border-border/40 grid grid-cols-3 gap-2">
                        
                        {/* Button 1: تسديد المتبقي (Solid Emerald Button) */}
                        <button
                          onClick={() => handleOpenSinglePayModal(inv)}
                          className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/20 transition-all"
                        >
                          <DollarSign size={15} />
                          <span>تسديد المتبقي</span>
                        </button>

                        {/* Button 2: كشف الحساب (Gold/Yellow Outlined Button) */}
                        <button
                          onClick={() => handleOpenCustomerStatement(inv.customerName, inv.customerPhone)}
                          className="h-9 px-3 rounded-xl bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <BookOpen size={15} />
                          <span>كشف الحساب</span>
                        </button>

                        {/* Button 3: واتساب (Green Outlined Button) */}
                        <button
                          onClick={() => handleSendWhatsAppInvoice(inv)}
                          className="h-9 px-3 rounded-xl bg-emerald-950/40 border border-emerald-700/50 hover:bg-emerald-900/50 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Send size={15} />
                          <span>واتساب</span>
                        </button>

                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CUSTOMER STATEMENT MODAL ("كشف الحساب") (Exact Design matching Image 4) */}
      {/* ========================================================= */}
      <Dialog open={!!statementCustomerName} onOpenChange={(open) => !open && setStatementCustomerName('')}>
        <DialogContent className="max-w-3xl bg-card border-border/80 p-0 rounded-3xl overflow-hidden shadow-2xl" dir="rtl" showCloseButton={false}>
          
          {/* Modal Header Bar */}
          <div className="bg-card border-b border-border/80 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">كشف حساب: {statementCustomerName}</h2>
                  {statementCustomerPhone && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-xs font-mono font-bold">
                      {statementCustomerPhone}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">جميع الفواتير والمدفوعات المرتبطة برقم التليفون</p>
              </div>
            </div>

            <button 
              onClick={() => setStatementCustomerName('')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            
            {/* Top 3 Summary Metrics Cards (Image 4 Header) */}
            <div className="grid grid-cols-3 gap-3">
              
              {/* Card 1: الفواتير */}
              <div className="bg-muted/40 border border-border/60 p-3.5 rounded-2xl text-center space-y-1">
                <div className="text-xs font-bold text-muted-foreground">الفواتير</div>
                <div className="text-2xl font-extrabold text-foreground font-mono">{statementInvoices.length}</div>
              </div>

              {/* Card 2: إجمالي المشتروات */}
              <div className="bg-emerald-950/20 border border-emerald-800/30 p-3.5 rounded-2xl text-center space-y-1">
                <div className="text-xs font-bold text-emerald-400">إجمالي المشتروات</div>
                <div className="text-xl font-extrabold text-emerald-400 font-mono">{statementTotalPurchases.toFixed(2)} ج.م</div>
              </div>

              {/* Card 3: إجمالي الديون */}
              <div className="bg-rose-950/30 border border-rose-800/40 p-3.5 rounded-2xl text-center space-y-1">
                <div className="text-xs font-bold text-rose-400">إجمالي الديون</div>
                <div className="text-xl font-extrabold text-rose-500 font-mono">{statementTotalDebt.toFixed(2)} ج.م</div>
              </div>

            </div>

            {/* Top Action Buttons inside Modal */}
            <div className="space-y-2.5">
              
              {/* WhatsApp Reminder Button */}
              {statementCustomerPhone && statementTotalDebt > 0 && (
                <button
                  onClick={() => handleSendWhatsAppStatementReminder(statementCustomerName, statementCustomerPhone, statementUnpaidInvoices, statementTotalDebt)}
                  className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
                >
                  <Send size={16} />
                  <span>إرسال إشعار تذكير بكشف الحساب والديون عبر الواتساب</span>
                </button>
              )}

              {/* Pay Debt Button */}
              {statementTotalDebt > 0 && (
                <button
                  onClick={() => handleOpenCustomerDebtPayModal(statementCustomerName, statementCustomerPhone || '', statementTotalDebt)}
                  className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/40 transition-all"
                >
                  <CreditCard size={16} />
                  <span>تسديد مبلغ من ديون العميل</span>
                </button>
              )}

            </div>

            {/* Inner Modal Tabs: غير مدفوعة / آجلة vs مدفوعة بالكامل */}
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <button
                onClick={() => setStatementModalTab('unpaid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  statementModalTab === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>غير مدفوعة / آجلة</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300">
                  {statementUnpaidInvoices.length}
                </span>
              </button>

              <button
                onClick={() => setStatementModalTab('paid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  statementModalTab === 'paid'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>مدفوعة بالكامل</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                  {statementPaidInvoices.length}
                </span>
              </button>
            </div>

            {/* Invoices List inside Modal */}
            <div className="space-y-3">
              {((statementModalTab === 'unpaid' ? statementUnpaidInvoices : statementPaidInvoices)).length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-bold bg-muted/20 rounded-2xl border border-border/40">
                  لا توجد فواتير في هذا القسم لهذا العميل.
                </div>
              ) : (
                (statementModalTab === 'unpaid' ? statementUnpaidInvoices : statementPaidInvoices).map((inv) => {
                  const rem = getInvoiceRemaining(inv);
                  const itemsSummary = inv.items.map(i => {
                    const p = store.getProduct(i.productId);
                    return p?.nameAr || p?.nameEn || 'منتج';
                  }).join(', ');

                  return (
                    <div 
                      key={inv.id}
                      className="bg-card border border-border/80 rounded-2xl p-4 space-y-3 shadow-sm hover:border-border transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                            rem > 0 ? 'bg-rose-950/80 text-rose-400 border border-rose-800/40' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                          }`}>
                            {rem > 0 ? 'آجل / غير مدفوع' : 'مدفوع'}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {new Date(inv.date).toLocaleDateString('ar-EG')} - {new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <span className="text-base font-extrabold font-mono text-amber-500">
                          #{inv.invoiceNumber}
                        </span>
                      </div>

                      {/* Items Summary Text */}
                      <div className="text-xs text-foreground font-medium line-clamp-2 leading-relaxed">
                        {itemsSummary}
                      </div>

                      {/* Total & Remaining info */}
                      <div className="flex items-center justify-between pt-1 font-mono text-xs">
                        <div className="text-muted-foreground">
                          إجمالي: <span className="font-bold text-foreground">{inv.total.toFixed(2)} ج.م</span>
                        </div>
                        {rem > 0 && (
                          <div className="text-rose-500 font-extrabold text-sm">
                            المتبقي: {rem.toFixed(2)} ج.م
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons inside Statement Modal */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                        {rem > 0 && (
                          <button
                            onClick={() => handleOpenSinglePayModal(inv)}
                            className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                          >
                            <DollarSign size={14} />
                            <span>تسديد المتبقي</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="h-8 px-3 rounded-xl bg-muted/60 border border-border hover:bg-muted text-foreground font-bold text-xs flex items-center gap-1.5 transition-all"
                        >
                          <Eye size={14} />
                          <span>معاينة</span>
                        </button>
                        <button
                          onClick={() => handleSendWhatsAppInvoice(inv)}
                          className="h-8 px-3 rounded-xl bg-emerald-950/40 border border-emerald-700/50 hover:bg-emerald-900/50 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all"
                        >
                          <Send size={14} />
                          <span>واتساب</span>
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>

          <div className="bg-card border-t border-border/80 p-4 text-left">
            <Button
              onClick={() => setStatementCustomerName('')}
              variant="outline"
              className="rounded-2xl font-bold text-xs px-6 h-10 bg-muted/40 hover:bg-muted"
            >
              إغلاق كشف الحساب
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 2: DEBT / SINGLE INVOICE PAYMENT MODAL (Exact Design matching Image 5) */}
      {/* ========================================================= */}
      <Dialog open={!!paymentModalInvoice || !!paymentModalCustomerPhone} onOpenChange={(open) => {
        if (!open) {
          setPaymentModalInvoice(null);
          setPaymentModalCustomerPhone(null);
        }
      }}>
        <DialogContent className="max-w-md bg-card border-border/80 p-6 rounded-3xl shadow-2xl space-y-5" dir="rtl" showCloseButton={false}>
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <CreditCard size={18} />
              </div>
              <DialogTitle className="text-base font-bold text-foreground">
                تسديد مبلغ من ديون العميل — {paymentModalCustomerName}
              </DialogTitle>
            </div>

            <button 
              onClick={() => {
                setPaymentModalInvoice(null);
                setPaymentModalCustomerPhone(null);
              }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60"
            >
              <X size={16} />
            </button>
          </div>

          {/* Info Box (Red Accent Card matching Image 5) */}
          <div className="bg-gradient-to-r from-rose-950/80 via-rose-900/40 to-rose-950/80 border border-rose-800/40 p-4 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-rose-200">
              العميل: <span className="text-white font-extrabold">{paymentModalCustomerName}</span>
            </div>
            
            <div className="text-sm font-extrabold text-rose-500 font-mono flex items-center justify-between">
              <span>إجمالي الديون المستحقة:</span>
              <span className="text-lg">{paymentModalInvoice ? getInvoiceRemaining(paymentModalInvoice).toFixed(2) : statementTotalDebt.toFixed(2)} ج.م</span>
            </div>

            <div className="text-[11px] text-rose-300/90 leading-relaxed border-t border-rose-800/30 pt-2 flex items-start gap-1">
              <span>💡</span>
              <span>سيتم خصم وتغطية الديون تلقائياً من الفواتير القديمة أولاً ثم الأحدث بالترتيب.</span>
            </div>
          </div>

          {/* Input Field */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground block">
              المبلغ المراد تسديده (ج.م)
            </label>
            <Input 
              type="number"
              step="any"
              value={paymentAmountInput}
              onChange={(e) => setPaymentAmountInput(e.target.value)}
              placeholder={`أدخل مبلغ أقصاه ${paymentModalInvoice ? getInvoiceRemaining(paymentModalInvoice).toFixed(2) : statementTotalDebt.toFixed(2)} ج.م`}
              className="h-12 text-sm font-mono font-bold rounded-2xl bg-background border-blue-500/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 text-foreground"
            />
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleConfirmSubmitPayment}
              className="flex-1 h-11 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition-all"
            >
              <span>تأكيد تسديد المبلغ</span>
            </button>
            <button
              onClick={() => {
                setPaymentModalInvoice(null);
                setPaymentModalCustomerPhone(null);
              }}
              className="h-11 px-5 rounded-2xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted font-bold text-xs transition-all"
            >
              إلغاء
            </button>
          </div>

        </DialogContent>
      </Dialog>

      {/* REAL PHYSICAL PAPER RECEIPT MODAL (Matching Receipt Modal) */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-md bg-card border-border overflow-hidden p-0 rounded-3xl" dir="rtl" showCloseButton={false}>
          
          <div className="bg-card border-b border-border/80 p-4 flex items-center justify-between print:hidden" dir="rtl">
            <button 
              onClick={() => setSelectedInvoice(null)} 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60 shrink-0"
            >
              <X size={18} />
            </button>

            <DialogTitle className="font-serif text-base font-bold text-foreground text-center flex-1 mx-2">
              تفاصيل فاتورة المبيعات
            </DialogTitle>

            <div className="flex items-center gap-2 shrink-0">
              <Button 
                onClick={() => selectedInvoice && handleSendWhatsAppInvoice(selectedInvoice)} 
                className="rounded-xl font-bold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Send size={15} />
                <span>إرسال عبر الواتساب</span>
              </Button>
            </div>
          </div>
          
          {selectedInvoice && (
            <div className="p-6 bg-white text-black w-full text-right font-sans text-xs" dir="rtl">
              <div className="text-center pb-3 border-b border-gray-300">
                <img src={lightLogo} alt="Salla Bola & Mina" className="h-16 mx-auto object-contain mb-1" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] py-3 border-b border-gray-200">
                <div className="text-right space-y-1">
                  <p><span className="text-gray-500">التاريخ : </span><span className="font-mono font-bold text-gray-900">{new Date(selectedInvoice.date).toLocaleDateString('ar-EG')}</span></p>
                  <p><span className="text-gray-500">الوقت : </span><span className="font-mono font-bold text-gray-900">{new Date(selectedInvoice.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></p>
                  <p><span className="text-gray-500">اسم العميل : </span><span className="font-bold text-gray-900">{selectedInvoice.customerName || 'عام'}</span></p>
                </div>
                <div className="text-right space-y-1">
                  <p><span className="text-gray-500">المسلسل : </span><span className="font-mono font-bold text-gray-900">#{selectedInvoice.invoiceNumber}</span></p>
                  <p><span className="text-gray-500">الكاشير : </span><span className="font-bold text-gray-900">{store.getUsers().find(u => u.id === selectedInvoice.employeeId)?.name || 'كاشير'}</span></p>
                  <p><span className="text-gray-500">رقم الهاتف : </span><span className="font-mono font-bold text-gray-900">{selectedInvoice.customerPhone || '-'}</span></p>
                </div>
              </div>

              <div className="my-3 overflow-x-auto">
                <table className="w-full text-xs text-right border border-gray-300 border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-gray-800 font-bold">
                      <th className="py-1.5 px-2 border-l border-gray-300 text-right">الصنف</th>
                      <th className="py-1.5 px-1 border-l border-gray-300 text-center w-12">الكمية</th>
                      <th className="py-1.5 px-1 border-l border-gray-300 text-center w-14">السعر</th>
                      <th className="py-1.5 px-1 text-left w-16">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const itemMap = new Map<string, { name: string; count: number; unitPrice: number; totalPrice: number }>();
                      selectedInvoice.items.forEach(item => {
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

                          <tr className="font-bold text-gray-900 bg-gray-50 border-t-2 border-gray-400">
                            <td className="py-2 px-2 border-l border-gray-300 text-right text-sm">الإجمالي</td>
                            <td className="py-2 px-1 border-l border-gray-300 text-center font-mono text-sm">{totalQty}</td>
                            <td className="py-2 px-1 border-l border-gray-300 text-center"></td>
                            <td className="py-2 px-1 text-left font-mono text-sm">{selectedInvoice.total.toFixed(2)}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              <div className="text-center text-[11px] text-gray-600 pt-3 space-y-1 border-t border-dashed border-gray-300">
                <p className="font-mono font-semibold text-gray-800 dir-ltr">Tel : 01271994777 - 01210866936</p>
                <p className="text-gray-900 font-bold">{activeBranchName}</p>
                <p className="font-bold text-gray-900 text-xs pt-1">هدفنا ارضاء العميل وليس الربح</p>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Single Invoice Confirmation Modal */}
      <Dialog open={!!singleDeleteId} onOpenChange={(open) => !open && setSingleDeleteId(null)}>
        <DialogContent className="max-w-md border-border/80 bg-card p-6 shadow-2xl rounded-3xl" dir="rtl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">تأكيد حذف الفاتورة</DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من حذف الفاتورة رقم{' '}
              <strong className="text-foreground font-mono">
                #{singleDeleteId ? store.getInvoices().find(i => i.id === singleDeleteId)?.invoiceNumber : ''}
              </strong>؟
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSingleDeleteId(null)}
              className="rounded-xl border-border"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteSingle}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl gap-2 font-bold"
            >
              <Trash2 size={16} />
              <span>حذف الفاتورة</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Month Confirmation Modal */}
      <Dialog open={isDeleteMonthModalOpen} onOpenChange={setIsDeleteMonthModalOpen}>
        <DialogContent className="max-w-md border-border/80 bg-card p-6 shadow-2xl rounded-3xl" dir="rtl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">حذف فواتير الشهر بالكامل</DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من حذف جميع فواتير شهر{' '}
              <strong className="text-foreground font-bold">{MONTH_NAMES_AR[currentMonth]} {currentYear}</strong> لفرع{' '}
              <strong className="text-foreground font-bold">{activeBranchName}</strong>؟
              <br />
              <span className="text-rose-400 text-xs mt-1 block">تحذير: هذا الإجراء سيمسح جميع الفواتير المسجلة في هذا الشهر ولا يمكن التراجع عنه.</span>
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDeleteMonthModalOpen(false)}
              className="rounded-xl border-border"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteMonth}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl gap-2 font-bold"
            >
              <Trash2 size={16} />
              <span>تأكيد حذف شهر بالكامل</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Day Confirmation Modal */}
      <Dialog open={isDeleteDayModalOpen} onOpenChange={setIsDeleteDayModalOpen}>
        <DialogContent className="max-w-md border-border/80 bg-card p-6 shadow-2xl rounded-3xl" dir="rtl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">حذف فواتير اليوم المحدد</DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من حذف جميع فواتير يوم{' '}
              <strong className="text-foreground font-mono">{selectedDate}</strong>؟
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDayModalOpen(false)}
              className="rounded-xl border-border"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteDay}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl gap-2 font-bold"
            >
              <Trash2 size={16} />
              <span>تأكيد حذف فواتير اليوم</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
