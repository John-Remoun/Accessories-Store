import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { store } from '../../services/store';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, Package, QrCode, ShoppingCart, 
  MapPin, TrendingUp, Box, Layers, AlertTriangle, Tag, Sparkles, DollarSign,
  Droplet, Warehouse, Coins, ShoppingBag, Receipt, Plus, Trash2, Calendar,
  ChevronLeft, ChevronRight, Clock, FileText
} from 'lucide-react';
import vodafoneLogo from '../../assets/vodafone-logo.png';
import instapayLogo from '../../assets/instapay-logo.png';

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const WEEKDAY_NAMES_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const FULL_WEEKDAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const getIsoDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const Branches = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const branchId = queryParams.get('id');

  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType] = useState<'daily' | 'monthly'>('daily');
  const [expensesVersion, setExpensesVersion] = useState(0);

  if (!isAdmin) {
    return (
      <div className="p-8 font-bold text-destructive text-center">
        غير مصرح لك بدخول هذه الصفحة. فقط السوبر أدمن يمكنه الوصول للوحة الفروع.
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
        <h2 className="text-2xl font-serif mb-2 font-bold">لم يتم تحديد فرع</h2>
        <Button onClick={() => navigate('/dashboard')} className="font-bold rounded-xl">
          العودة للشاشة الرئيسية بالفروع الأربعة
        </Button>
      </div>
    );
  }

  const branch = store.getBranch(branchId);
  if (!branch) return <div className="p-8 text-center font-bold">الفرع غير موجود.</div>;

  // Fixed Expenses for this branch
  const fixedExpensesList = useMemo(() => store.getFixedExpensesByBranch(branch.id), [branch.id, expensesVersion]);
  const totalFixedExpenses = useMemo(() => fixedExpensesList.reduce((acc, item) => acc + (item.amount || 0), 0), [fixedExpensesList]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount || parseFloat(expenseAmount) <= 0) return;

    store.addFixedExpense({
      id: `exp-${Date.now()}`,
      branchId: branch.id,
      title: expenseTitle.trim(),
      amount: parseFloat(expenseAmount),
      type: 'daily',
      date: new Date().toISOString(),
    });

    setExpenseTitle('');
    setExpenseAmount('');
    setExpensesVersion(v => v + 1);
  };

  const handleRemoveExpense = (id: string) => {
    store.removeFixedExpense(id);
    setExpensesVersion(v => v + 1);
  };

  // Branch Specific Financial Stats
  const bInvs = store.getInvoicesByBranch(branch.id);
  const rawRev = bInvs.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const cost = bInvs.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);

  // Deduct fixed expenses directly from Total Sales Revenue and Net Profit
  const netRevenue = Math.max(0, rawRev - totalFixedExpenses);
  const grossProfit = rawRev - cost;
  const netProfit = grossProfit - totalFixedExpenses;
  const isProfitable = netProfit >= 0;

  // Revenue Payment Method Breakdown (Cash in drawer, InstaPay, Vodafone Cash)
  const paymentBreakdown = useMemo(() => {
    let cashTotal = 0;
    let instapayTotal = 0;
    let vodafoneTotal = 0;

    bInvs.forEach(inv => {
      const method = inv.paymentSubMethod || inv.paymentMethod;
      const amt = inv.paidAmount || inv.total || 0;
      if (method === 'instapay') {
        instapayTotal += amt;
      } else if (method === 'vodafone_cash') {
        vodafoneTotal += amt;
      } else {
        cashTotal += amt;
      }
    });

    // Deduct expenses from Cash in Drawer first
    const netCashTotal = Math.max(0, cashTotal - totalFixedExpenses);

    return { cashTotal: netCashTotal, instapayTotal, vodafoneTotal };
  }, [bInvs, totalFixedExpenses]);

  const physicalItems = store.getPhysicalItemsByBranch(branch.id);
  const availableItems = physicalItems.filter(i => i.status === 'available');
  const allProducts = store.getProducts();

  // Total Financial Cost Value of Inventory in Active Branch
  const totalInventoryValue = useMemo(() => {
    let sum = 0;
    availableItems.forEach(item => {
      const bd = store.getProductBranchData(item.productId, branch.id);
      sum += (Number(bd?.cost) || 0);
    });
    return sum;
  }, [availableItems, branch.id]);

  const lowStockList = useMemo(() => {
    const branchProducts = allProducts.filter(p => {
      const bd = store.getProductBranchData(p.id, branch.id);
      const phys = store.getPhysicalItemsByProduct(p.id).filter(i => i.branchId === branch.id);
      return Boolean(bd || phys.length > 0);
    });

    return branchProducts.filter(p => {
      const bd = store.getProductBranchData(p.id, branch.id);
      const minStock = Number(bd?.minStock ?? 10);
      const phys = store.getPhysicalItemsByProduct(p.id).filter(i => i.branchId === branch.id);
      const availableCount = phys.filter(i => i.status === 'available').length;
      return availableCount <= minStock;
    });
  }, [allProducts, branch.id]);

  // Calendar State for Branch Dashboard
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);

  const [selectedDayModalData, setSelectedDayModalData] = useState<{
    dateStr: string;
    dayNum: number;
    weekdayName: string;
    metrics: {
      invoicesCount: number;
      totalRevenue: number;
      totalCost: number;
      totalFixedExp: number;
      grossProfit: number;
      netProfit: number;
      dayCash: number;
      dayInstapay: number;
      dayVodafone: number;
      netCashInDrawer: number;
    };
  } | null>(null);

  // Month Metrics for Active Branch
  const monthMetrics = useMemo(() => {
    const monthInvoices = bInvs.filter(inv => {
      const d = new Date(inv.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
    const totalRevenue = monthInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const totalCost = monthInvoices.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);

    let monthCash = 0;
    let monthInstapay = 0;
    let monthVodafone = 0;

    monthInvoices.forEach(inv => {
      const method = inv.paymentSubMethod || inv.paymentMethod;
      const amt = inv.paidAmount || inv.total || 0;
      if (method === 'instapay') {
        monthInstapay += amt;
      } else if (method === 'vodafone_cash') {
        monthVodafone += amt;
      } else {
        monthCash += amt;
      }
    });

    const monthExpenses = fixedExpensesList.filter(exp => {
      const d = new Date(exp.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
    const totalFixedExp = monthExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalFixedExp;
    const netCashInDrawer = monthCash - totalFixedExp;

    return {
      invoicesCount: monthInvoices.length,
      totalRevenue,
      totalCost,
      totalFixedExp,
      grossProfit,
      netProfit,
      monthCash,
      monthInstapay,
      monthVodafone,
      netCashInDrawer,
    };
  }, [bInvs, fixedExpensesList, currentYear, currentMonth]);

  // Year Metrics for Active Branch
  const yearMetrics = useMemo(() => {
    const yearInvoices = bInvs.filter(inv => {
      const d = new Date(inv.date);
      return d.getFullYear() === currentYear;
    });
    const totalRevenue = yearInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const totalCost = yearInvoices.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);

    const yearExpenses = fixedExpensesList.filter(exp => {
      const d = new Date(exp.date);
      return d.getFullYear() === currentYear;
    });
    const totalFixedExp = yearExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalFixedExp;

    const monthlyBreakdown = MONTH_NAMES_AR.map((mName, mIdx) => {
      const mInvs = yearInvoices.filter(inv => new Date(inv.date).getMonth() === mIdx);
      const mRev = mInvs.reduce((acc, inv) => acc + (inv.total || 0), 0);
      const mCost = mInvs.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);
      const mExp = yearExpenses.filter(exp => new Date(exp.date).getMonth() === mIdx)
                               .reduce((acc, exp) => acc + (exp.amount || 0), 0);
      const mNet = mRev - mCost - mExp;
      return {
        monthName: mName,
        monthIndex: mIdx,
        revenue: mRev,
        netProfit: mNet,
        invoicesCount: mInvs.length,
      };
    });

    return {
      invoicesCount: yearInvoices.length,
      totalRevenue,
      totalCost,
      totalFixedExp,
      grossProfit,
      netProfit,
      monthlyBreakdown,
    };
  }, [bInvs, fixedExpensesList, currentYear]);

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayWeekdayIndex = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const getDayMetrics = (dayNum: number) => {
    const datePrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    
    // Filter branch invoices for this date
    const dayInvoices = bInvs.filter(inv => getIsoDate(inv.date) === datePrefix);
    const totalRevenue = dayInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const totalCost = dayInvoices.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);

    let dayCash = 0;
    let dayInstapay = 0;
    let dayVodafone = 0;

    dayInvoices.forEach(inv => {
      const method = inv.paymentSubMethod || inv.paymentMethod;
      const amt = inv.paidAmount || inv.total || 0;
      if (method === 'instapay') {
        dayInstapay += amt;
      } else if (method === 'vodafone_cash') {
        dayVodafone += amt;
      } else {
        dayCash += amt;
      }
    });

    // Filter fixed expenses for this date
    const dayExpenses = fixedExpensesList.filter(exp => getIsoDate(exp.date) === datePrefix);
    const totalFixedExp = dayExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalFixedExp;
    const netCashInDrawer = dayCash - totalFixedExp;

    return {
      invoicesCount: dayInvoices.length,
      totalRevenue,
      totalCost,
      totalFixedExp,
      grossProfit,
      netProfit,
      dayCash,
      dayInstapay,
      dayVodafone,
      netCashInDrawer,
    };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20 md:pb-0" dir="rtl">
      
      {/* 1. Centered Branch Header Bar */}
      <div className="bg-card border border-border/80 p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
          {branch.nameAr}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
          <MapPin size={14} className="text-primary shrink-0" />
          <span>لوحة التحكم والأرباح والمخزن بالفرع</span>
        </p>
      </div>

      {/* 2. DASHBOARD SECTION FOR THIS BRANCH */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-border/60 pb-2">
          <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
            <Layers className="text-primary" size={20} />
            <span>لوحة التحكم</span>
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">لوحة تحكم الفرع</span>
        </div>

        {/* TOP ROW: 3 Inventory KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1: Total Inventory Value */}
          <Card className="bg-card shadow-xs border border-border/80 border-l-4 border-l-indigo-500 rounded-2xl p-5 min-h-[100px]">
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flex flex-col items-start justify-center gap-1">
                <span className="text-xs font-bold text-muted-foreground">القيمة الإجمالية للمخزون</span>
                <div className="flex items-baseline gap-1.5 mt-1" dir="ltr">
                  <span className="text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">
                    {totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground font-mono">ج.م</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <Warehouse size={22} />
              </div>
            </div>
          </Card>

          {/* Card 2: Available Items */}
          <Card 
            onClick={() => navigate(`/products?id=${branch.id}`)}
            className="bg-card shadow-xs border border-border/80 border-l-4 border-l-cyan-500 rounded-2xl p-5 min-h-[100px] cursor-pointer transition-all select-none hover:bg-cyan-500/10 hover:border-cyan-500/50 group"
          >
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flex flex-col items-start justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">القطع المتاحة بالمعرض</span>
                  <span className="text-[10px] bg-cyan-600 text-white font-bold px-1.5 py-0.5 rounded-md group-hover:scale-105 transition-transform">اضغط للتفاصيل 🔍</span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">
                    {availableItems.length}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">قطعة</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                <Droplet size={22} />
              </div>
            </div>
          </Card>

          {/* Card 3: Low Stock Items */}
          <Card 
            onClick={() => navigate(`/products?id=${branch.id}&lowStock=true`)}
            className="bg-card shadow-xs border border-border/80 border-l-4 border-l-amber-500 ring-2 ring-amber-500/30 rounded-2xl p-5 min-h-[100px] cursor-pointer transition-all select-none hover:bg-amber-500/10 hover:border-amber-500/50 group"
          >
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flex flex-col items-start justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">عناصر منخفضة المخزون</span>
                  <span className="text-[10px] bg-amber-600 text-white font-bold px-1.5 py-0.5 rounded-md group-hover:scale-105 transition-transform">اضغط للتفاصيل 🔍</span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                    {lowStockList.length}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">تنبيه</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-950/80 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                <AlertTriangle size={22} />
              </div>
            </div>
          </Card>

        </div>

        {/* BOTTOM ROW: 2 Financial KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          
          {/* Card 4: Net Total Sales Revenue (Deducted by Expenses) */}
          <Card 
            onClick={() => setIsRevenueModalOpen(true)}
            className="bg-card shadow-xs border border-border/80 border-l-4 border-l-emerald-500 hover:bg-emerald-500/10 transition-all rounded-2xl p-5 min-h-[100px] cursor-pointer group select-none"
          >
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flex flex-col items-start justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">إجمالي إيرادات المبيعات</span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-md group-hover:scale-105 transition-transform">اضغط للتفاصيل 🔍</span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">{netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span className="text-xs font-bold text-emerald-400">ج.م</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                <TrendingUp size={22} />
              </div>
            </div>
          </Card>

          {/* Card 5: Net Profit (Deducted by Expenses) */}
          <Card className="bg-card shadow-xs border border-border/80 border-l-4 border-l-teal-500 rounded-2xl p-5 min-h-[100px]">
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flex flex-col items-start justify-center gap-1">
                <span className="text-xs font-bold text-muted-foreground">صافي الربح</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className={`text-2xl sm:text-3xl font-extrabold font-mono ${isProfitable ? 'text-teal-400' : 'text-rose-500'}`}>
                    {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold text-teal-400">ج.م</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-teal-950/80 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <Coins size={22} />
              </div>
            </div>
          </Card>

        </div>

        {/* 3. FIXED EXPENSES SECTION FOR THIS BRANCH */}
        <div className="space-y-4 pt-4 mt-10">
          
          {/* Section Header Line Matching 'لوحة التحكم' Header */}
          <div className="flex justify-between items-center border-b border-border/60 pb-2">
            <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
              <Receipt className="text-rose-500" size={20} />
              <span>المصاريف الثابتة</span>
            </h2>
            <div className="px-3.5 py-1.5 rounded-full bg-rose-950/70 text-rose-400 border border-rose-800/40 text-xs font-bold font-mono shadow-2xs">
              إجمالي مصاريف اليومي: {totalFixedExpenses.toLocaleString('en-US', { minimumFractionDigits: 0 })} ج.م
            </div>
          </div>

          <div className="bg-card shadow-md border border-border/80 rounded-3xl p-6 space-y-5">

          {/* Input Form Row with Labels */}
          <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            
            {/* Field 1: Reason */}
            <div className="sm:col-span-7 space-y-1">
              <label className="text-xs font-bold text-muted-foreground block">سبب المصروف</label>
              <Input 
                type="text"
                placeholder="سبب المصروف (مثال: إيجار، كهرباء، صيانة...)"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                className="h-11 text-xs rounded-xl bg-background border-border/80 focus:border-rose-500 px-4 font-bold"
              />
            </div>

            {/* Field 2: Amount */}
            <div className="sm:col-span-3 space-y-1">
              <label className="text-xs font-bold text-muted-foreground block">المبلغ</label>
              <Input 
                type="number"
                min="0"
                step="any"
                placeholder="المبلغ (ج.م)"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="h-11 text-xs rounded-xl bg-background border-border/80 focus:border-rose-500 px-4 font-mono font-bold"
              />
            </div>

            {/* Submit Button */}
            <div className="sm:col-span-2">
              <Button 
                type="submit"
                className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-md transition-all flex items-center justify-center"
              >
                <Plus size={16} />
                <span>إضافة</span>
              </Button>
            </div>

          </form>

          {/* List of Added Fixed Expenses Table */}
          {fixedExpensesList.length > 0 && (
            <div className="pt-2 overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-bold">
                    <th className="py-2.5 px-3 text-right">سبب المصروف</th>
                    <th className="py-2.5 px-3 text-center">التاريخ</th>
                    <th className="py-2.5 px-3 text-center">المبلغ</th>
                    <th className="py-2.5 px-3 text-center w-16">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {fixedExpensesList.map((exp) => (
                    <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-foreground">{exp.title}</td>
                      <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                        {new Date(exp.date).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-rose-400">
                        {exp.amount.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveExpense(exp.id)}
                          className="text-muted-foreground hover:text-rose-500 transition-colors p-2 rounded-xl hover:bg-rose-500/10 active:scale-95"
                          title="حذف المصروف وإعادة المبلغ للدرج"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
        </div>

        {/* 4. CALENDAR & PERFORMANCE TRACKING SECTION */}
        <div className="bg-card border border-border/80 p-4 sm:p-5 rounded-3xl shadow-sm space-y-4 mt-8">
          
          {/* Calendar Header Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-3.5">
            
            {/* Header Top Row on mobile: Title + Icon (Right) and Month Nav Pill (Left) */}
            <div className="flex items-center justify-between w-full sm:w-auto gap-3">
              <div className="flex items-center gap-2.5">
                <Calendar size={20} className="text-emerald-500 shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-serif font-bold text-foreground">
                    التقويم ومتابعة الأداء
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-semibold font-mono mt-0.5">
                    {MONTH_NAMES_AR[currentMonth]} {currentYear}
                  </p>
                </div>
              </div>

              {/* Month Nav Pill (visible on mobile in same row as Title) */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60 sm:hidden">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="الشهر السابق"
                >
                  <ChevronRight size={15} />
                </button>

                <button
                  type="button"
                  onClick={handleTodayClick}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[11px] font-bold transition-all"
                  title="الانتقال للشهر الحالي"
                >
                  اليوم
                </button>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="الشهر التالي"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>
            </div>

            {/* Action Buttons Row + Month Nav Pill (on desktop) */}
            <div className="flex flex-wrap items-center justify-between w-full sm:w-auto gap-1.5 sm:gap-2">
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Access Day Details */}
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const isCurrentMonthActive = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
                    const targetDay = isCurrentMonthActive ? today.getDate() : 1;
                    const dateObj = new Date(currentYear, currentMonth, targetDay);
                    const weekdayName = FULL_WEEKDAY_NAMES_AR[dateObj.getDay()];
                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
                    setSelectedDayModalData({
                      dateStr,
                      dayNum: targetDay,
                      weekdayName,
                      metrics: getDayMetrics(targetDay),
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 hover:bg-amber-500/25 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                  title="عرض تفاصيل أداء اليوم"
                >
                  <Clock size={13} />
                  <span>تفاصيل اليوم</span>
                </button>

                {/* Access Month Details */}
                <button
                  type="button"
                  onClick={() => setIsMonthModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                  title="عرض تقرير أداء هذا الشهر بالكامل"
                >
                  <FileText size={13} />
                  <span>تفاصيل الشهر</span>
                </button>

                {/* Access Year Details */}
                <button
                  type="button"
                  onClick={() => setIsYearModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                  title="عرض تقرير أداء هذه السنة بالكامل"
                >
                  <Layers size={13} />
                  <span>تفاصيل السنة</span>
                </button>
              </div>

              {/* Month Nav Controls (Desktop only) */}
              <div className="hidden sm:flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="الشهر السابق"
                >
                  <ChevronRight size={15} />
                </button>

                <button
                  type="button"
                  onClick={handleTodayClick}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[11px] font-bold transition-all"
                  title="الانتقال للشهر الحالي"
                >
                  اليوم
                </button>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="الشهر التالي"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>

            </div>

          </div>

          {/* Weekday Headers (7 Columns) */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_NAMES_AR.map((dayName) => (
              <div key={dayName} className="py-0.5 text-[10px] sm:text-xs font-bold text-muted-foreground">
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar 7-Column Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {/* Empty Padding Cells for Offset */}
            {Array.from({ length: firstDayWeekdayIndex }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[42px] sm:min-h-[54px] rounded-xl bg-muted/5 border border-transparent" />
            ))}

            {/* Day Cells */}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const dayNum = index + 1;
              const dateObj = new Date(currentYear, currentMonth, dayNum);
              const dayOfWeekIndex = dateObj.getDay();
              const weekdayName = FULL_WEEKDAY_NAMES_AR[dayOfWeekIndex];
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              
              const today = new Date();
              const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === dayNum;
              const metrics = getDayMetrics(dayNum);

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDayModalData({
                    dateStr,
                    dayNum,
                    weekdayName,
                    metrics,
                  })}
                  className={`min-h-[44px] sm:min-h-[54px] p-1 sm:p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between items-center text-center group select-none relative overflow-hidden ${
                    isToday
                      ? 'border-2 border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-xs'
                      : 'bg-card/90 hover:bg-muted/60 border-border/70 hover:border-amber-500/60'
                  }`}
                >
                  {/* Top Header inside cell: Weekday Name + Today Badge */}
                  <div className="flex items-center justify-between w-full gap-0.5 px-0.5">
                    <span className={`text-[8px] sm:text-[10px] font-bold truncate ${isToday ? 'text-amber-500 font-black' : 'text-muted-foreground'}`}>
                      {weekdayName}
                    </span>
                    {isToday && (
                      <span className="px-1 py-0 rounded-full bg-amber-500 text-black font-black text-[7px] sm:text-[8px] leading-tight shrink-0">
                        اليوم
                      </span>
                    )}
                  </div>

                  {/* Center: Compact Day Number */}
                  <div className="my-auto py-0">
                    <span className={`text-xs sm:text-base font-extrabold font-mono ${isToday ? 'text-amber-500' : 'text-foreground'}`}>
                      {dayNum}
                    </span>
                  </div>

                  {/* Bottom: Revenue or Clean Blank */}
                  <div className="w-full text-center min-h-[12px] flex items-center justify-center">
                    {metrics.totalRevenue > 0 && (
                      <span className="text-[8px] sm:text-[9px] font-bold text-amber-500 font-mono truncate block leading-none">
                        +{metrics.totalRevenue.toLocaleString()} ج.م
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* REVENUE BREAKDOWN POPUP MODAL (Kash, InstaPay, Vodafone Cash) */}
      <Dialog open={isRevenueModalOpen} onOpenChange={setIsRevenueModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border rounded-3xl p-4 sm:p-6 space-y-3.5 sm:space-y-5 shadow-2xl" dir="rtl">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="font-serif text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
              <TrendingUp size={20} className="text-emerald-500" />
              <span>تفاصيل إيرادات المبيعات والدرج — ({branch.nameAr})</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            
            {/* Cash in Drawer */}
            <div className="bg-emerald-500/10 p-3 sm:p-4 rounded-2xl border border-emerald-500/30 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold text-base sm:text-lg border border-emerald-500/30 shrink-0">
                  💵
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-foreground">نقداً (كاش)</h4>
                </div>
              </div>
              <div className="text-left font-mono font-extrabold text-sm sm:text-base text-emerald-600">
                {paymentBreakdown.cashTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-sans font-bold">ج.م</span>
              </div>
            </div>

            {/* InstaPay */}
            <div className="bg-purple-500/10 p-3 sm:p-4 rounded-2xl border border-purple-500/30 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/90 p-1.5 flex items-center justify-center border border-purple-500/30 shrink-0 shadow-xs">
                  <img src={instapayLogo} alt="InstaPay" className="w-full h-full object-contain rounded-md" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-foreground">إنستاباي (InstaPay)</h4>
                </div>
              </div>
              <div className="text-left font-mono font-extrabold text-sm sm:text-base text-purple-600">
                {paymentBreakdown.instapayTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-sans font-bold">ج.م</span>
              </div>
            </div>

            {/* Vodafone Cash */}
            <div className="bg-rose-500/10 p-3 sm:p-4 rounded-2xl border border-rose-500/30 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/90 p-1.5 flex items-center justify-center border border-rose-500/30 shrink-0 shadow-xs">
                  <img src={vodafoneLogo} alt="Vodafone Cash" className="w-full h-full object-contain rounded-md" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-foreground">فودافون كاش (Vodafone Cash)</h4>
                </div>
              </div>
              <div className="text-left font-mono font-extrabold text-sm sm:text-base text-rose-600">
                {paymentBreakdown.vodafoneTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-sans font-bold">ج.م</span>
              </div>
            </div>

            {/* Total Sum Footer */}
            <div className="bg-muted/40 p-3.5 sm:p-4 rounded-2xl border border-border/80 flex items-center justify-between pt-3 font-bold mt-2">
              <span className="text-xs text-foreground">إجمالي المبيعات المحصلة بالفرع:</span>
              <span className="text-base sm:text-lg text-emerald-600 font-mono font-extrabold">
                {netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </span>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* DAY PERFORMANCE DETAILS MODAL */}
      <Dialog open={selectedDayModalData !== null} onOpenChange={(open) => !open && setSelectedDayModalData(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border rounded-3xl p-4 sm:p-6 space-y-3.5 sm:space-y-4 shadow-2xl" dir="rtl">
          {selectedDayModalData && (
            <>
              <DialogHeader className="border-b border-border/60 pb-2.5">
                <DialogTitle className="font-serif text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
                  <Calendar size={18} className="text-emerald-500 shrink-0" />
                  <span>تقرير الأداء اليومي — ({branch.nameAr})</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-bold font-mono mt-0.5">
                  {selectedDayModalData.weekdayName} {selectedDayModalData.dayNum} {MONTH_NAMES_AR[currentMonth]} {currentYear}
                </p>
              </DialogHeader>

              <div className="space-y-3 sm:space-y-3.5">
                
                {/* 1. Net Profit Card (FIRST - Image 2 Style) */}
                <div className="bg-card shadow-xs border border-border/80 border-l-4 border-l-teal-500 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-teal-950/80 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 shadow-xs">
                      <Coins size={18} className="sm:w-[22px] sm:h-[22px]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-xs font-bold text-muted-foreground">صافي الربح</span>
                        <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md ${
                          selectedDayModalData.metrics.netProfit >= 0 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {selectedDayModalData.metrics.netProfit >= 0 ? 'مكسب صافي' : 'خسارة'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <span className={`text-lg sm:text-2xl font-extrabold ${selectedDayModalData.metrics.netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                      {selectedDayModalData.metrics.netProfit >= 0 ? '+' : ''}
                      {selectedDayModalData.metrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground mr-1">ج.م</span>
                  </div>
                </div>

                {/* 2. Total Sales Revenue Card (SECOND - Image 2 & 3 Style) */}
                <div className="bg-card shadow-xs border border-border/80 border-l-4 border-l-emerald-500 rounded-2xl p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
                  
                  {/* Top Row: Icon + Title + Total Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
                        <TrendingUp size={18} className="sm:w-[22px] sm:h-[22px]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-xs font-bold text-muted-foreground">إجمالي إيرادات المبيعات</span>
                          <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 sm:px-2 py-0.5 rounded-md border border-emerald-500/30">
                            {selectedDayModalData.metrics.invoicesCount} فاتورة
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-lg sm:text-2xl font-extrabold text-emerald-400">
                        {selectedDayModalData.metrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold text-muted-foreground mr-1">ج.م</span>
                    </div>
                  </div>

                  {/* Compact Payment Breakdown inside Card (Image 3 Style) */}
                  <div className="space-y-1.5 sm:space-y-2 pt-2 border-t border-border/60">
                    
                    {/* Cash in Drawer */}
                    <div className="bg-emerald-500/10 p-2 sm:p-2.5 rounded-xl border border-emerald-500/25 flex items-center justify-between text-xs shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm">💵</span>
                        <span className="font-bold text-foreground text-[11px] sm:text-xs">نقداً (كاش)</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-[11px] sm:text-xs">
                        {selectedDayModalData.metrics.dayCash.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                      </span>
                    </div>

                    {/* InstaPay */}
                    <div className="bg-purple-500/10 p-2 sm:p-2.5 rounded-xl border border-purple-500/25 flex items-center justify-between text-xs shadow-2xs">
                      <div className="flex items-center gap-2">
                        <img src={instapayLogo} alt="InstaPay" className="w-4 h-4 sm:w-5 sm:h-5 object-contain rounded-md shrink-0 bg-white/90 p-0.5 border border-purple-500/30" />
                        <span className="font-bold text-foreground text-[11px] sm:text-xs">إنستاباي (InstaPay)</span>
                      </div>
                      <span className="font-mono font-bold text-purple-400 text-[11px] sm:text-xs">
                        {selectedDayModalData.metrics.dayInstapay.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                      </span>
                    </div>

                    {/* Vodafone Cash */}
                    <div className="bg-rose-500/10 p-2 sm:p-2.5 rounded-xl border border-rose-500/25 flex items-center justify-between text-xs shadow-2xs">
                      <div className="flex items-center gap-2">
                        <img src={vodafoneLogo} alt="Vodafone Cash" className="w-4 h-4 sm:w-5 sm:h-5 object-contain rounded-md shrink-0 bg-white/90 p-0.5 border border-rose-500/30" />
                        <span className="font-bold text-foreground text-[11px] sm:text-xs">فودافون كاش (Vodafone Cash)</span>
                      </div>
                      <span className="font-mono font-bold text-rose-400 text-[11px] sm:text-xs">
                        {selectedDayModalData.metrics.dayVodafone.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                      </span>
                    </div>

                  </div>

                </div>

                {/* 3. Fixed Expenses Daily Card (Red Style) */}
                <div className="bg-card shadow-xs border border-border/80 border-l-4 border-l-rose-500 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-xs">
                      <Receipt size={18} className="sm:w-[22px] sm:h-[22px]" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-muted-foreground block">المصاريف الثابتة اليومية</span>
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-lg sm:text-2xl font-extrabold text-rose-400">
                      -{selectedDayModalData.metrics.totalFixedExp.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground mr-1">ج.م</span>
                  </div>
                </div>

                {/* 4. Net Cash in Drawer Box */}
                <div className="bg-muted/30 p-3 sm:p-4 rounded-2xl border border-border/60 flex justify-between items-center font-bold text-xs sm:text-sm shadow-2xs">
                  <span className="text-foreground flex items-center gap-1">
                    <span>الإجمالي (الدرج):</span>
                    <span className="text-[9px] sm:text-[10px] font-normal text-muted-foreground">(الكاش - المصاريف اليومية)</span>
                  </span>
                  <span className={`font-mono font-extrabold text-xs sm:text-base ${
                    selectedDayModalData.metrics.netCashInDrawer >= 0 ? 'text-emerald-400' : 'text-rose-500'
                  }`}>
                    {selectedDayModalData.metrics.netCashInDrawer.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </span>
                </div>

              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MONTH PERFORMANCE DETAILS MODAL */}
      <Dialog open={isMonthModalOpen} onOpenChange={setIsMonthModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border rounded-3xl p-4 sm:p-6 space-y-3.5 sm:space-y-4 shadow-2xl" dir="rtl">
          <DialogHeader className="border-b border-border/60 pb-2.5">
            <DialogTitle className="font-serif text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
              <Calendar size={18} className="text-cyan-500 shrink-0" />
              <span>تقرير أداء شهر {MONTH_NAMES_AR[currentMonth]} {currentYear} — ({branch.nameAr})</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-3.5">
            
            {/* 1. Monthly Net Profit Card (FIRST) */}
            <div className="bg-card shadow-xs border border-border/80 border-l-4 border-l-teal-500 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-teal-950/80 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 shadow-xs">
                  <Coins size={18} className="sm:w-[22px] sm:h-[22px]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs font-bold text-muted-foreground">صافي الربح الشهري</span>
                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md ${
                      monthMetrics.netProfit >= 0 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {monthMetrics.netProfit >= 0 ? 'مكسب صافي' : 'خسارة'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-left font-mono">
                <span className={`text-lg sm:text-2xl font-extrabold ${monthMetrics.netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                  {monthMetrics.netProfit >= 0 ? '+' : ''}
                  {monthMetrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground mr-1">ج.م</span>
              </div>
            </div>

            {/* 2. Monthly Total Sales Revenue Card (SECOND) */}
            <div className="bg-card shadow-xs border border-border/80 border-l-4 border-l-emerald-500 rounded-2xl p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
              
              {/* Top Row: Icon + Title + Total Amount */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
                    <TrendingUp size={18} className="sm:w-[22px] sm:h-[22px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-xs font-bold text-muted-foreground">إجمالي إيرادات المبيعات الشهرية</span>
                      <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 sm:px-2 py-0.5 rounded-md border border-emerald-500/30">
                        {monthMetrics.invoicesCount} فاتورة
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left font-mono">
                  <span className="text-lg sm:text-2xl font-extrabold text-emerald-400">
                    {monthMetrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-muted-foreground mr-1">ج.م</span>
                </div>
              </div>

              {/* Compact Monthly Payment Breakdown inside Card */}
              <div className="space-y-1.5 sm:space-y-2 pt-2 border-t border-border/60">
                
                {/* Cash */}
                <div className="bg-emerald-500/10 p-2 sm:p-2.5 rounded-xl border border-emerald-500/25 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm">💵</span>
                    <span className="font-bold text-foreground text-[11px] sm:text-xs">نقداً (كاش)</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-[11px] sm:text-xs">
                    {monthMetrics.monthCash.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </span>
                </div>

                {/* InstaPay */}
                <div className="bg-purple-500/10 p-2 sm:p-2.5 rounded-xl border border-purple-500/25 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <img src={instapayLogo} alt="InstaPay" className="w-4 h-4 sm:w-5 sm:h-5 object-contain rounded-md shrink-0 bg-white/90 p-0.5 border border-purple-500/30" />
                    <span className="font-bold text-foreground text-[11px] sm:text-xs">إنستاباي (InstaPay)</span>
                  </div>
                  <span className="font-mono font-bold text-purple-400 text-[11px] sm:text-xs">
                    {monthMetrics.monthInstapay.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </span>
                </div>

                {/* Vodafone Cash */}
                <div className="bg-rose-500/10 p-2 sm:p-2.5 rounded-xl border border-rose-500/25 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <img src={vodafoneLogo} alt="Vodafone Cash" className="w-4 h-4 sm:w-5 sm:h-5 object-contain rounded-md shrink-0 bg-white/90 p-0.5 border border-rose-500/30" />
                    <span className="font-bold text-foreground text-[11px] sm:text-xs">فودافون كاش (Vodafone Cash)</span>
                  </div>
                  <span className="font-mono font-bold text-rose-400 text-[11px] sm:text-xs">
                    {monthMetrics.monthVodafone.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </span>
                </div>

              </div>

            </div>

            {/* 3. Monthly Fixed Expenses Card */}
            <div className="bg-card shadow-xs border border-border/80 border-l-4 border-l-rose-500 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-xs">
                  <Receipt size={18} className="sm:w-[22px] sm:h-[22px]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-muted-foreground block">المصاريف الثابتة الشهرية</span>
                </div>
              </div>
              <div className="text-left font-mono">
                <span className="text-lg sm:text-2xl font-extrabold text-rose-400">
                  -{monthMetrics.totalFixedExp.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground mr-1">ج.م</span>
              </div>
            </div>

            {/* 4. Net Cash in Drawer Box (Monthly) */}
            <div className="bg-muted/30 p-3 sm:p-4 rounded-2xl border border-border/60 flex justify-between items-center font-bold text-xs sm:text-sm shadow-2xs">
              <span className="text-foreground flex items-center gap-1">
                <span>الإجمالي (الدرج الشهري):</span>
                <span className="text-[9px] sm:text-[10px] font-normal text-muted-foreground">(الكاش - المصاريف الشهرية)</span>
              </span>
              <span className={`font-mono font-extrabold text-xs sm:text-base ${
                monthMetrics.netCashInDrawer >= 0 ? 'text-emerald-400' : 'text-rose-500'
              }`}>
                {monthMetrics.netCashInDrawer.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
              </span>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* YEAR PERFORMANCE DETAILS MODAL */}
      <Dialog open={isYearModalOpen} onOpenChange={setIsYearModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-3xl bg-card border-border rounded-3xl p-3 sm:p-5 space-y-2 sm:space-y-3.5 shadow-2xl overflow-hidden" dir="rtl">
          <DialogHeader className="border-b border-border/60 pb-2">
            <DialogTitle className="font-serif text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
              <Layers size={18} className="text-purple-500 shrink-0" />
              <span>تقرير أداء سنة {currentYear} بالكامل — ({branch.nameAr})</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 sm:space-y-3">
            
            {/* 3 Top Annual KPI Cards (3 columns on all screen sizes including mobile) */}
            <div className="grid grid-cols-3 gap-1 sm:gap-2.5">
              
              {/* 1. Annual Net Profit Card */}
              <div className="bg-card shadow-xs border border-border/80 border-l-2 sm:border-l-4 border-l-teal-500 rounded-xl sm:rounded-2xl p-1.5 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-0.5 sm:gap-1">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-full bg-teal-950/80 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 shadow-xs">
                    <Coins size={12} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[11px] font-bold text-muted-foreground block truncate">صافي الربح</span>
                  </div>
                </div>
                <div className="text-right sm:text-left font-mono w-full sm:w-auto">
                  <span className={`text-[11px] sm:text-base font-extrabold block truncate ${yearMetrics.netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                    {yearMetrics.netProfit >= 0 ? '+' : ''}
                    {yearMetrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* 2. Annual Revenue Card */}
              <div className="bg-card shadow-xs border border-border/80 border-l-2 sm:border-l-4 border-l-emerald-500 rounded-xl sm:rounded-2xl p-1.5 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-0.5 sm:gap-1">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
                    <TrendingUp size={12} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[11px] font-bold text-muted-foreground block truncate">الإيرادات</span>
                  </div>
                </div>
                <div className="text-right sm:text-left font-mono w-full sm:w-auto">
                  <span className="text-[11px] sm:text-base font-extrabold text-emerald-400 block truncate">
                    {yearMetrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* 3. Annual Fixed Expenses Card */}
              <div className="bg-card shadow-xs border border-border/80 border-l-2 sm:border-l-4 border-l-rose-500 rounded-xl sm:rounded-2xl p-1.5 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-0.5 sm:gap-1">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-xs">
                    <Receipt size={12} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[11px] font-bold text-muted-foreground block truncate">المصاريف</span>
                  </div>
                </div>
                <div className="text-right sm:text-left font-mono w-full sm:w-auto">
                  <span className="text-[11px] sm:text-base font-extrabold text-rose-400 block truncate">
                    -{yearMetrics.totalFixedExp.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

            </div>

            {/* Monthly Table Breakdown for the Year */}
            <div className="space-y-1">
              <h4 className="text-[10px] sm:text-[11px] font-bold text-muted-foreground">التفاصيل الشهرية لسنة {currentYear}:</h4>
              <div className="border border-border/80 rounded-2xl overflow-hidden bg-card">
                <table className="w-full text-[10px] sm:text-xs text-right border-collapse">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border/60 text-muted-foreground font-bold">
                      <th className="py-1 px-2 text-right">الشهر</th>
                      <th className="py-1 px-2 text-center">المبيعات</th>
                      <th className="py-1 px-2 text-center">صافي الربح</th>
                      <th className="py-1 px-2 text-center">الفواتير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {yearMetrics.monthlyBreakdown.map((m) => (
                      <tr key={m.monthIndex} className="hover:bg-muted/30 transition-colors">
                        <td className="py-0.5 sm:py-1 px-2 font-bold text-foreground">{m.monthName}</td>
                        <td className="py-0.5 sm:py-1 px-2 text-center font-mono font-bold text-emerald-500">
                          {m.revenue.toLocaleString()} ج.م
                        </td>
                        <td className="py-0.5 sm:py-1 px-2 text-center font-mono font-bold">
                          <span className={m.netProfit >= 0 ? 'text-amber-500' : 'text-rose-500'}>
                            {m.netProfit >= 0 ? '+' : ''}{m.netProfit.toLocaleString()} ج.م
                          </span>
                        </td>
                        <td className="py-0.5 sm:py-1 px-2 text-center font-mono text-muted-foreground">
                          {m.invoicesCount} فاتورة
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
