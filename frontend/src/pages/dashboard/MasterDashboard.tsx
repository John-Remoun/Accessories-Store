import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { store } from '../../services/store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { useNavigate } from 'react-router-dom';
import { Invoice, User } from '../../types';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import { 
  ArrowRight, MapPin, DollarSign, TrendingUp, TrendingDown, Package, 
  FileText, Printer, Diamond, Store, ShieldCheck, Box, Layers, Eye, X,
  Trophy, Users, UserPlus, CheckCircle2, AlertCircle, Send, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, Clock, Coins, Receipt
} from 'lucide-react';
import lightLogo from '../../assets/light-logo.png';
import vodafoneLogo from '../../assets/vodafone-logo.png';
import instapayLogo from '../../assets/instapay-logo.png';

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const WEEKDAY_NAMES_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const FULL_WEEKDAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const MasterDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

  // Add Employee Modal State
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empUsername, setEmpUsername] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empConfirmPassword, setEmpConfirmPassword] = useState('');
  const [empBranchId, setEmpBranchId] = useState('b1');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const branches = store.getBranches();
  const allInvoices = store.getInvoices();
  const allPhysicalItems = store.getPhysicalItems();
  const allProducts = store.getProducts();
  const allUsers = store.getUsers();
  const allFixedExpenses = useMemo(() => store.getAllFixedExpenses(), []);

  // Aggregated Calendar & Performance State for All Branches Combined
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

  const getDayMetrics = (dayNum: number) => {
    const dayInvoices = allInvoices.filter(inv => {
      const d = new Date(inv.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === dayNum;
    });

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

    const dayExpenses = allFixedExpenses.filter(exp => {
      const d = new Date(exp.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === dayNum;
    });

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

  const monthMetrics = useMemo(() => {
    const monthInvoices = allInvoices.filter(inv => {
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

    const monthExpenses = allFixedExpenses.filter(exp => {
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
  }, [allInvoices, allFixedExpenses, currentYear, currentMonth]);

  const yearMetrics = useMemo(() => {
    const yearInvoices = allInvoices.filter(inv => {
      const d = new Date(inv.date);
      return d.getFullYear() === currentYear;
    });
    const totalRevenue = yearInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const totalCost = yearInvoices.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);

    const yearExpenses = allFixedExpenses.filter(exp => {
      const d = new Date(exp.date);
      return d.getFullYear() === currentYear;
    });
    const totalFixedExp = yearExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalFixedExp;

    const monthlyBreakdown = MONTH_NAMES_AR.map((mName, mIdx) => {
      const mInvs = yearInvoices.filter(inv => new Date(inv.date).getMonth() === mIdx);
      const rev = mInvs.reduce((acc, inv) => acc + (inv.total || 0), 0);
      const cst = mInvs.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);
      const mExps = yearExpenses.filter(exp => new Date(exp.date).getMonth() === mIdx);
      const fExp = mExps.reduce((acc, exp) => acc + (exp.amount || 0), 0);

      return {
        monthIndex: mIdx,
        monthName: mName,
        revenue: rev,
        cost: cst,
        fixedExp: fExp,
        netProfit: (rev - cst) - fExp,
        invoicesCount: mInvs.length,
      };
    });

    return {
      totalRevenue,
      totalCost,
      totalFixedExp,
      grossProfit,
      netProfit,
      monthlyBreakdown,
    };
  }, [allInvoices, allFixedExpenses, currentYear]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayWeekdayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Global Financial Calculations for Super Admin
  const globalMetrics = useMemo(() => {
    const totalRevenue = allInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const totalCost = allInvoices.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);
    const totalNetProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? ((totalNetProfit / totalRevenue) * 100).toFixed(1) : '0';

    const availableItemsCount = allPhysicalItems.filter(i => i.status === 'available').length;
    const soldItemsCount = allPhysicalItems.filter(i => i.status === 'sold').length;
    const totalItemsCount = allPhysicalItems.length;

    return {
      totalRevenue,
      totalCost,
      totalNetProfit,
      profitMargin,
      availableItemsCount,
      soldItemsCount,
      totalItemsCount,
      totalInvoicesCount: allInvoices.length,
    };
  }, [allInvoices, allPhysicalItems]);

  // Low Stock Items Summary per branch
  const lowStockSummary = useMemo(() => {
    const summary = branches.map((b) => {
      const branchProducts = allProducts.filter(p => {
        const bd = store.getProductBranchData(p.id, b.id);
        const phys = store.getPhysicalItemsByProduct(p.id).filter(i => i.branchId === b.id);
        return bd || phys.length > 0;
      });

      let count = 0;
      branchProducts.forEach(p => {
        const bd = store.getProductBranchData(p.id, b.id);
        const minStock = bd?.minStock ?? 10;
        const availableCount = store.getPhysicalItemsByProduct(p.id).filter(i => i.branchId === b.id && i.status === 'available').length;
        if (availableCount <= minStock) {
          count++;
        }
      });

      return {
        id: b.id,
        nameAr: b.nameAr,
        nameEn: b.nameEn,
        location: b.location,
        lowStockCount: count,
      };
    });

    const totalLowStock = summary.reduce((acc, item) => acc + item.lowStockCount, 0);

    return {
      totalLowStock,
      branches: summary,
    };
  }, [branches, allProducts, allPhysicalItems]);

  // Per-Branch Financial & Inventory Breakdown
  const branchPerformanceData = useMemo(() => {
    return branches.map((b, idx) => {
      const bInvs = store.getInvoicesByBranch(b.id);
      const bRevenue = bInvs.reduce((acc, inv) => acc + (inv.total || 0), 0);
      const bCost = bInvs.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);
      const bNetProfit = bRevenue - bCost;
      const bProfitMargin = bRevenue > 0 ? ((bNetProfit / bRevenue) * 100).toFixed(1) : '0';
      
      const bAvailableItems = store.getPhysicalItemsByBranch(b.id).filter(i => i.status === 'available');
      const bSoldItems = store.getPhysicalItemsByBranch(b.id).filter(i => i.status === 'sold');
      const bStaff = allUsers.filter(u => u.branchId === b.id);

      return {
        id: b.id,
        number: idx + 1,
        nameAr: b.nameAr,
        nameEn: b.nameEn,
        location: b.location,
        revenue: bRevenue,
        cost: bCost,
        netProfit: bNetProfit,
        profitMargin: bProfitMargin,
        availableStock: bAvailableItems.length,
        soldCount: bSoldItems.length,
        invoicesCount: bInvs.length,
        staffCount: bStaff.length,
      };
    });
  }, [branches, allInvoices, allPhysicalItems, allUsers]);

  // Employee Performance & Ranking (Sorted descending by total sales amount)
  const employeeRankings = useMemo(() => {
    const staff = allUsers.filter(u => u.role !== 'admin');
    
    const ranked = staff.map(emp => {
      const empInvoices = allInvoices.filter(inv => inv.employeeId === emp.id);
      const totalSalesAmount = empInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
      const totalInvoicesCount = empInvoices.length;
      const empBranch = branches.find(b => b.id === emp.branchId);

      return {
        ...emp,
        totalSalesAmount,
        totalInvoicesCount,
        branchName: empBranch ? empBranch.nameAr : 'غير محدد',
      };
    });

    return ranked.sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);
  }, [allUsers, allInvoices, branches]);

  // Chart Data
  const chartData = useMemo(() => {
    return branchPerformanceData.map(b => ({
      name: b.nameAr,
      'المبيعات (الإيرادات)': b.revenue,
      'صافي الأرباح': b.netProfit,
    }));
  }, [branchPerformanceData]);

  const CHART_COLORS = ['#E3A419', '#10B981', '#3B82F6', '#8B5CF6'];

  const handleAddEmployeeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!empName.trim() || !empUsername.trim() || !empPassword.trim()) {
      setFormError('يرجى كتابة كافة حقول البيانات (الاسم، اسم المستخدم، وكلمة المرور).');
      return;
    }
    if (store.getUserByUsername(empUsername.trim())) {
      setFormError('اسم المستخدم هذا موجود ومسجل بالسيستم بالفعل! يرجى اختيار اسم آخر.');
      return;
    }

    const newEmp: User = {
      id: `u_${Date.now()}`,
      name: empName.trim(),
      username: empUsername.trim(),
      password: empPassword.trim(),
      role: 'employee',
      branchId: empBranchId,
      joinDate: new Date().toISOString().split('T')[0],
      salesCount: 0,
    };

    store.addUser(newEmp);

    const branchObj = store.getBranch(empBranchId);
    setFormSuccess(`تم إضافة الموظف "${empName.trim()}" بنجاح وربطه بفرع ${branchObj ? branchObj.nameAr : ''}!`);

    setTimeout(() => {
      setIsAddEmployeeOpen(false);
      setEmpName('');
      setEmpUsername('');
      setEmpPassword('');
      setFormSuccess('');
    }, 1200);
  };

  const handleSendWhatsAppToOwner = (inv: Invoice) => {
    const branchObj = store.getBranch(inv.branchId);
    const branchName = branchObj ? branchObj.nameAr : 'الفرع الرئيسي';
    const sellerObj = store.getUsers().find(u => u.id === inv.employeeId);
    const sellerName = sellerObj ? sellerObj.name : 'الكاشير';
    const customerInfo = inv.customerName ? `${inv.customerName} (${inv.customerPhone || ''})` : 'عميل فرع';

    const itemsList = inv.items.map((item, idx) => {
      const p = store.getProduct(item.productId);
      return `${idx + 1}. ${p?.nameAr || p?.nameEn || 'منتج'}: ${item.unitPrice.toFixed(2)} ج.م`;
    }).join('\n');

    const msg = `🧾 *فاتورة مبيعات جديدة - ${branchName}*
------------------------------
• *رقم الفاتورة:* ${inv.invoiceNumber}
• *التاريخ والوقت:* ${new Date(inv.date).toLocaleDateString('ar-EG')} - ${new Date(inv.date).toLocaleTimeString('ar-EG')}
• *البائع:* ${sellerName}
• *العميل:* ${customerInfo}

📦 *البيانات والمنتجات:*
${itemsList}

------------------------------
💰 *المجموع الفرعي:* ${inv.subtotal.toFixed(2)} ج.م
${inv.discount > 0 ? `🏷️ *الخصم:* -${inv.discount.toFixed(2)} ج.م\n` : ''}💵 *المجموع الإجمالي:* ${inv.total.toFixed(2)} ج.م
💳 *طريقة الدفع:* ${inv.paymentMethod === 'cash' ? 'نقداً (في اليد)' : 'تحويل'}
------------------------------
متجر الإكسسوارات الفاخرة LUMINA`;

    const ownerPhone = '20100000000';
    const url = `https://api.whatsapp.com/send?phone=${ownerPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center font-bold text-destructive">
        عفواً، هذه الصفحة مخصصة فقط للسوبر أدمن.
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-16" dir="rtl">
      
      {/* Super Admin Top Bar with Back Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border/80 p-4 sm:p-6 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          {/* Back Button */}
          <Button 
            onClick={() => navigate('/dashboard')} 
            variant="outline"
            className="rounded-2xl h-11 px-4 border-border/80 hover:bg-primary/10 hover:text-primary transition-all font-bold gap-2 text-xs shadow-xs shrink-0"
            title="الرجوع للشاشة الرئيسية"
          >
            <ArrowRight size={18} />
            <span>رجوع</span>
          </Button>

          <div className="space-y-0.5">
            <h1 className="text-2xl font-serif font-bold text-foreground">لوحة التحكم الرئيسية</h1>
            <p className="text-xs text-muted-foreground">
              لوحة المتابعة الإجمالية: أرباح ومبيعات ومخزون الفروع
            </p>
          </div>
        </div>

        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 4 Primary KPI Cards (2x2 Grid on Mobile, Compact & Scaled) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
        
        {/* Total Revenue */}
        <Card className="bg-card shadow-sm border-border border-l-4 border-l-primary hover:border-primary/40 transition-all rounded-2xl overflow-hidden">
          <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold leading-tight">
              إجمالي مبيعات الفروع
            </CardTitle>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0">
            <p className="text-lg sm:text-3xl font-bold text-primary font-mono tracking-tight">
              {globalMetrics.totalRevenue.toLocaleString()} <span className="text-xs sm:text-sm font-sans font-normal">EGP</span>
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
              الفواتير: <span className="font-bold text-foreground">{globalMetrics.totalInvoicesCount}</span> فاتورة
            </p>
          </CardContent>
        </Card>

        {/* Total Net Profit */}
        <Card className="bg-card shadow-sm border-border border-l-4 border-l-emerald-500 hover:border-emerald-500/40 transition-all rounded-2xl overflow-hidden">
          <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold leading-tight">
              إجمالي الأرباح (المكسب)
            </CardTitle>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <p className="text-lg sm:text-3xl font-bold text-emerald-600 font-mono tracking-tight">
                +{globalMetrics.totalNetProfit.toLocaleString()} <span className="text-xs sm:text-sm font-sans font-normal">EGP</span>
              </p>
              <span className="self-start sm:self-auto text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 font-mono">
                %{globalMetrics.profitMargin} ربح
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
              التكلفة: <span className="font-bold text-foreground">{globalMetrics.totalCost.toLocaleString()} EGP</span>
            </p>
          </CardContent>
        </Card>

        {/* Total Available Inventory Goods */}
        <Card 
          onClick={() => setIsInventoryModalOpen(true)}
          className="bg-card shadow-sm border-border border-l-4 border-l-blue-500 hover:border-blue-500/60 transition-all rounded-2xl overflow-hidden cursor-pointer hover:shadow-md group"
        >
          <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold leading-tight">
              البضاعة المتوفرة بالمعارض
            </CardTitle>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0">
            <p className="text-lg sm:text-3xl font-bold text-foreground font-mono tracking-tight">
              {globalMetrics.availableItemsCount} <span className="text-xs sm:text-sm font-sans font-normal text-muted-foreground">قطعة</span>
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2 flex items-center justify-between">
              <span>المباع: <span className="font-bold text-primary">{globalMetrics.soldItemsCount}</span> قطعة</span>
              <span className="text-blue-500 font-bold underline decoration-blue-500/40">عرض الفروع</span>
            </p>
          </CardContent>
        </Card>

        {/* Low Stock Alerts Card (Replaces Stores Count) */}
        <Card 
          onClick={() => setIsLowStockModalOpen(true)}
          className="bg-card shadow-sm border-border border-l-4 border-l-amber-500 hover:border-amber-500/60 transition-all rounded-2xl overflow-hidden cursor-pointer hover:shadow-md group"
        >
          <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold leading-tight flex items-center gap-1.5">
              تنبيهات نواقص المخزون
            </CardTitle>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0">
            <p className="text-lg sm:text-3xl font-bold text-amber-500 font-mono tracking-tight">
              {lowStockSummary.totalLowStock} <span className="text-xs sm:text-sm font-sans font-normal text-muted-foreground">منتج ناقص</span>
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2 flex items-center justify-between">
              <span>انقر لمعرفة النواقص بالفروع</span>
              <span className="text-amber-500 font-bold underline decoration-amber-500/40">عرض الفروع</span>
            </p>
          </CardContent>
        </Card>

      </div>

      {/* SECTION: Global Branch Performance Summary Table (Read Only Master Overview) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border/60 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-serif font-bold text-foreground flex items-center gap-2">
              <Layers className="text-primary w-5 h-5 sm:w-6 sm:h-6" />
              تقرير الأرباح الإجمالية لكل فرع
            </h2>
          </div>
        </div>

        <div className="bg-card rounded-2xl sm:rounded-3xl shadow-sm border border-border overflow-x-auto custom-scrollbar-x">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-right py-3 px-3 sm:px-4 font-bold text-xs">الفرع</TableHead>
                <TableHead className="text-center py-3 px-3 sm:px-4 font-bold text-xs">إجمالي المبيعات</TableHead>
                <TableHead className="text-center py-3 px-3 sm:px-4 font-bold text-xs">التكلفة</TableHead>
                <TableHead className="text-center py-3 px-3 sm:px-4 font-bold text-xs">صافي المكسب</TableHead>
                <TableHead className="text-center py-3 px-3 sm:px-4 font-bold text-xs">هامش الربح %</TableHead>
                <TableHead className="text-center py-3 px-3 sm:px-4 font-bold text-xs">قطع المخزون</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchPerformanceData.map((b) => {
                const isProfitable = b.netProfit >= 0;
                return (
                  <TableRow key={b.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-right py-3 sm:py-4 px-3 sm:px-4">
                      <div className="font-bold text-xs sm:text-sm text-foreground">{b.nameAr}</div>
                      <div className="text-[10px] sm:text-[11px] text-muted-foreground font-mono">{b.nameEn}</div>
                    </TableCell>

                    <TableCell className="text-center font-bold text-foreground font-mono text-xs sm:text-sm py-3 sm:py-4 px-3 sm:px-4">
                      {b.revenue.toLocaleString()} EGP
                    </TableCell>

                    <TableCell className="text-center font-mono text-[11px] sm:text-xs text-muted-foreground py-3 sm:py-4 px-3 sm:px-4">
                      {b.cost.toLocaleString()} EGP
                    </TableCell>

                    <TableCell className="text-center font-bold font-mono text-xs sm:text-sm py-3 sm:py-4 px-3 sm:px-4">
                      <span className={`inline-flex items-center gap-1 ${isProfitable ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isProfitable ? '+' : ''}{b.netProfit.toLocaleString()} EGP
                        {isProfitable ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      </span>
                    </TableCell>

                    <TableCell className="text-center py-3 sm:py-4 px-3 sm:px-4">
                      <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-primary/15 text-primary border border-primary/25 font-mono">
                        %{b.profitMargin}
                      </span>
                    </TableCell>

                    <TableCell className="text-center font-bold text-foreground font-mono text-[11px] sm:text-xs py-3 sm:py-4 px-3 sm:px-4">
                      {b.availableStock} قطعة
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* SECTION: Visual Analytics (Clean Spaced Bar Chart for High Revenues) */}
      <div className="w-full">
        
        <Card className="w-full bg-card shadow-sm border-border rounded-2xl sm:rounded-3xl p-3 sm:p-6">
          <CardHeader className="p-0 mb-3 sm:mb-6">
            <CardTitle className="text-sm sm:text-lg font-serif font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
              مقارنة المبيعات والأرباح بين المحلات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-64 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                barCategoryGap="20%"
                barGap={4}
              >
                <XAxis 
                  dataKey="name" 
                  stroke="#888888" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={4}
                  interval={0}
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  width={50}
                  domain={[0, (dataMax: number) => Math.max(100000, Math.ceil(dataMax * 1.15))]}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return `${val}`;
                  }} 
                />
                <Tooltip 
                  cursor={false}
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card/95 backdrop-blur-md border border-border p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shadow-xl space-y-1.5 sm:space-y-2 text-right text-xs" dir="rtl">
                          <p className="font-bold text-foreground text-xs sm:text-sm border-b border-border/60 pb-1 flex items-center gap-1.5">
                            <Store size={14} className="text-primary" />
                            <span>{label}</span>
                          </p>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex justify-between items-center gap-3 text-[11px] sm:text-xs font-bold">
                              <span className="flex items-center gap-1" style={{ color: entry.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}:
                              </span>
                              <span className="font-mono text-foreground">{Number(entry.value).toLocaleString()} EGP</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={32} 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontWeight: 'bold' }} 
                />
                <Bar dataKey="المبيعات (الإيرادات)" fill="#E3A419" radius={[4, 4, 0, 0]} />
                <Bar dataKey="صافي الأرباح" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* 4. CALENDAR & PERFORMANCE TRACKING SECTION (AGGREGATED ALL BRANCHES) */}
      <div className="bg-card border border-border/80 p-4 sm:p-5 rounded-3xl shadow-sm space-y-4 my-8">
        
        {/* Calendar Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-3.5">
          
          {/* Header Top Row on mobile: Title + Icon (Right) and Month Nav Pill (Left) */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center gap-2.5">
              <Calendar size={20} className="text-emerald-500 shrink-0" />
              <div>
                <h3 className="text-sm sm:text-base font-serif font-bold text-foreground">
                  التقويم ومتابعة الأداء الإجمالي (جميع الفروع)
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
                title="عرض تفاصيل أداء اليوم لجميع الفروع"
              >
                <Clock size={13} />
                <span>تفاصيل اليوم</span>
              </button>

              {/* Access Month Details */}
              <button
                type="button"
                onClick={() => setIsMonthModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                title="عرض تقرير أداء هذا الشهر بالكامل لجميع الفروع"
              >
                <FileText size={13} />
                <span>تفاصيل الشهر</span>
              </button>

              {/* Access Year Details */}
              <button
                type="button"
                onClick={() => setIsYearModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                title="عرض تقرير أداء هذه السنة بالكامل لجميع الفروع"
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

      {/* DAY PERFORMANCE DETAILS MODAL */}
      <Dialog open={selectedDayModalData !== null} onOpenChange={(open) => !open && setSelectedDayModalData(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border rounded-3xl p-4 sm:p-6 space-y-3.5 sm:space-y-4 shadow-2xl" dir="rtl">
          {selectedDayModalData && (
            <>
              <DialogHeader className="border-b border-border/60 pb-2.5">
                <DialogTitle className="font-serif text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
                  <Calendar size={18} className="text-emerald-500 shrink-0" />
                  <span>تقرير الأداء اليومي — (جميع الفروع)</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-bold font-mono mt-0.5">
                  {selectedDayModalData.weekdayName} {selectedDayModalData.dayNum} {MONTH_NAMES_AR[currentMonth]} {currentYear}
                </p>
              </DialogHeader>

              <div className="space-y-3 sm:space-y-3.5">
                
                {/* 1. Net Profit Card */}
                <div className="bg-card shadow-xs border border-border/80 border-l-4 border-l-teal-500 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-teal-950/80 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 shadow-xs">
                      <Coins size={18} className="sm:w-[22px] sm:h-[22px]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-xs font-bold text-muted-foreground">صافي الربح الإجمالي</span>
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

                {/* 2. Total Sales Revenue Card */}
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

                  {/* Compact Payment Breakdown inside Card */}
                  <div className="space-y-1.5 sm:space-y-2 pt-2 border-t border-border/60">
                    
                    {/* Cash */}
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

                {/* 3. Fixed Expenses Daily Card */}
                <div className="bg-card shadow-xs border border-border/80 border-l-4 border-l-rose-500 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-xs">
                      <Receipt size={18} className="sm:w-[22px] sm:h-[22px]" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-muted-foreground block">إجمالي المصاريف اليومية</span>
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
              <span>تقرير أداء شهر {MONTH_NAMES_AR[currentMonth]} {currentYear} — (جميع الفروع)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-3.5">
            
            {/* 1. Monthly Net Profit Card */}
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

            {/* 2. Monthly Total Sales Revenue Card */}
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

            {/* 4. Net Cash in Drawer Box */}
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
              <span>تقرير أداء سنة {currentYear} بالكامل — (جميع الفروع)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 sm:space-y-3">
            
            {/* 3 Top Annual KPI Cards */}
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

      {/* SECTION: Employee Ranking & Leaderboard (عرض كافّة الموظفين بالكامل) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-3">
          <div>
            <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
              <Trophy className="text-amber-500" size={22} />
              ترتيب كفاءة كافة الموظفين {employeeRankings.length}
            </h2>
            <p className="text-xs text-muted-foreground">
              قائمة كاملة تشمل جميع طاقم العمل بجميع الفروع مرتبين تنازلياً حسب إجمالي المبيعات
            </p>
          </div>
          {/* Add Employee Button opens Modal right in front without navigating */}
          <Button 
            onClick={() => {
              setIsAddEmployeeOpen(true);
              setFormError('');
              setFormSuccess('');
            }} 
            className="rounded-xl text-xs font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all px-4 h-11"
          >
            <UserPlus size={16} /> 
            <span>إدارة وإضافة موظف جديد</span>
          </Button>
        </div>

        <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-center w-16">الترتيب</TableHead>
                <TableHead className="text-right">اسم الموظف</TableHead>
                <TableHead className="text-right">الفرع</TableHead>
                <TableHead className="text-center">عدد الفواتير</TableHead>
                <TableHead className="text-right">إجمالي مبلغ المبيعات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeRankings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    لا يوجد موظفين مسجلين حالياً. يمكنك إضافة موظفين جدد من زر "إدارة وإضافة موظف جديد".
                  </TableCell>
                </TableRow>
              ) : (
                employeeRankings.map((emp, index) => {
                  const rank = index + 1;

                  return (
                    <TableRow 
                      key={emp.id} 
                      className={`hover:bg-muted/30 transition-colors ${rank === 1 ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''}`}
                    >
                      {/* Number Rank Circle */}
                      <TableCell className="text-center py-4 w-16">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs font-mono shadow-xs ${
                          rank === 1 ? 'bg-amber-500/20 text-amber-600 border border-amber-500/40' :
                          rank === 2 ? 'bg-slate-300/30 text-slate-700 dark:text-slate-300 border border-slate-400/40' :
                          rank === 3 ? 'bg-amber-700/20 text-amber-700 dark:text-amber-500 border border-amber-700/40' :
                          'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {rank}
                        </span>
                      </TableCell>

                      {/* Employee Name */}
                      <TableCell className="text-right font-bold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                            {emp.name.charAt(0)}
                          </span>
                          <div>
                            <span className="block">{emp.name}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">@{emp.username}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Branch */}
                      <TableCell className="text-right text-xs font-bold text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} className="text-primary shrink-0" />
                          {emp.branchName}
                        </span>
                      </TableCell>

                      {/* Total Invoices */}
                      <TableCell className="text-center font-mono font-bold text-foreground">
                        {emp.totalInvoicesCount} فاتورة
                      </TableCell>

                      {/* Total Sales Amount */}
                      <TableCell className="text-right font-bold text-base font-mono">
                        {emp.totalSalesAmount > 0 ? (
                          <span className="text-primary">{emp.totalSalesAmount.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">EGP</span></span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-sans font-normal">0 EGP (لا مبيعات)</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }))
              }
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MODAL: ADD NEW EMPLOYEE */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg text-foreground">
              إضافة موظف جديد بالنظام
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddEmployeeSubmit} className="space-y-4 py-3">
            {formError && (
              <div className="bg-destructive/15 border border-destructive/30 text-destructive text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold">الاسم الكامل للموظف</Label>
              <Input 
                value={empName} 
                onChange={e => setEmpName(e.target.value)} 
                placeholder="مثال: كريم محمود" 
                className="h-11 rounded-xl text-xs"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold">اسم المستخدم (للتسجيل والدخول)</Label>
              <Input 
                value={empUsername} 
                onChange={e => setEmpUsername(e.target.value)} 
                placeholder="مثال: kareem_cairo" 
                className="h-11 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">كلمة المرور / الباسورد للموظف</Label>
              <Input 
                type="password"
                value={empPassword} 
                onChange={e => setEmpPassword(e.target.value)} 
                placeholder="••••••••" 
                className="h-11 rounded-xl text-xs font-mono"
              />
            </div>



            {/* SELECTABLE BRANCH DROPDOWN (ADMIN CHOOSES THE BRANCH) */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">الفرع المخصص للموظف</Label>
              <CustomSelect
                value={empBranchId}
                onChange={(val) => setEmpBranchId(val)}
                options={branches.map(b => ({
                  value: b.id,
                  label: b.nameAr
                }))}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                اختر الفرع الذي سيعمل به الموظف وتظهر فواتيره ومبيعاته فيه.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border/80">
              <Button type="button" variant="outline" onClick={() => setIsAddEmployeeOpen(false)} className="rounded-xl text-xs font-bold">
                إلغاء
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold">
                إضافة الموظف الآن
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* REAL PHYSICAL PAPER RECEIPT MODAL (Matching media_1791084693796.png) */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-md bg-card border-border overflow-hidden p-0 rounded-3xl" dir="rtl" showCloseButton={false}>
          
          {/* Header Bar: X on Far Right, Title in Center, Send via WhatsApp ONLY on Far Left */}
          <div className="bg-card border-b border-border/80 p-4 flex items-center justify-between print:hidden" dir="rtl">
            {/* Far Right: X Close Button */}
            <button 
              onClick={() => setSelectedInvoice(null)} 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60 shrink-0"
              title="إغلاق"
            >
              <X size={18} />
            </button>

            {/* Center: Title */}
            <DialogTitle className="font-serif text-base font-bold text-foreground text-center flex-1 mx-2">
              تفاصيل فاتورة المبيعات
            </DialogTitle>

            {/* Far Left: WhatsApp Button ONLY (No Print Button!) */}
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                onClick={() => selectedInvoice && handleSendWhatsAppToOwner(selectedInvoice)} 
                className="rounded-xl font-bold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Send size={15} />
                <span>إرسال عبر الواتساب</span>
              </Button>
            </div>
          </div>
          
          {selectedInvoice && (
            <div className="p-6 bg-white text-black w-full text-right font-sans text-xs" dir="rtl">
              
              {/* Logo Header matching image media_1791084693796.png */}
              <div className="text-center pb-3 border-b border-gray-300">
                <img src={lightLogo} alt="Salla Bola & Mina" className="h-16 mx-auto object-contain mb-1" />
              </div>

              {/* Date/Time, Serial, Cashier, Customer Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] py-3 border-b border-gray-200">
                <div className="text-right space-y-1">
                  <p><span className="text-gray-500">التاريخ : </span><span className="font-mono font-bold text-gray-900">{new Date(selectedInvoice.date).toLocaleDateString('ar-EG')}</span></p>
                  <p><span className="text-gray-500">الوقت : </span><span className="font-mono font-bold text-gray-900">{new Date(selectedInvoice.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></p>
                  <p><span className="text-gray-500">اسم العميل : </span><span className="font-bold text-gray-900">{selectedInvoice.customerName || 'عام'}</span></p>
                </div>
                <div className="text-right space-y-1">
                  <p><span className="text-gray-500">المسلسل : </span><span className="font-mono font-bold text-gray-900">{selectedInvoice.invoiceNumber}</span></p>
                  <p><span className="text-gray-500">الكاشير : </span><span className="font-bold text-gray-900">{store.getUsers().find(u => u.id === selectedInvoice.employeeId)?.name || 'كاشير'}</span></p>
                  <p><span className="text-gray-500">رقم الهاتف : </span><span className="font-mono font-bold text-gray-900">{selectedInvoice.customerPhone || '-'}</span></p>
                </div>
              </div>

              {/* Items Table matching photo: الصنف | الكمية | السعر | الإجمالي */}
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

                          {/* Totals Summary Row matching image */}
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

              {/* Footer Section matching image media_1791084693796.png */}
              <div className="text-center text-[11px] text-gray-600 pt-3 space-y-1 border-t border-dashed border-gray-300">
                <p className="font-mono font-semibold text-gray-800 dir-ltr">Tel : 01271994777 - 01210866936</p>
                <p className="text-gray-900 font-bold">
                  {(() => {
                    const br = store.getBranches().find(b => b.id === selectedInvoice.branchId);
                    return br?.nameAr || br?.nameEn || 'فرع القاهرة';
                  })()}
                </p>
                <p className="font-bold text-gray-900 text-xs pt-1">هدفنا ارضاء العميل وليس الربح</p>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Low Stock Branch Details Dialog */}
      <Dialog open={isLowStockModalOpen} onOpenChange={setIsLowStockModalOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border-border rounded-2xl p-5 sm:p-6 dir-rtl">
          <DialogHeader className="text-right pb-3 border-b border-border">
            <DialogTitle className="text-base sm:text-lg font-serif font-bold flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              تنبيهات نواقص المخزون بالفروع
            </DialogTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              اضغط على أي فرع للانتقال المباشر لصفحة المنتجات وتصفية النواقص
            </CardDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-4">
            {lowStockSummary.branches.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setIsLowStockModalOpen(false);
                  navigate(`/products?id=${b.id}&lowStock=true`);
                }}
                className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-xl border border-border bg-muted/40 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all text-right group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-foreground group-hover:text-amber-500 transition-colors">
                      {b.nameAr}
                    </h4>
                    <p className="text-[9px] sm:text-[11px] text-muted-foreground whitespace-nowrap truncate">
                      {b.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                    b.lowStockCount > 0 
                      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' 
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {b.lowStockCount} ناقص
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground rotate-180 group-hover:translate-x-[-2px] transition-transform group-hover:text-amber-500" />
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <Button variant="outline" onClick={() => setIsLowStockModalOpen(false)} className="rounded-xl text-xs">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Available Stock Branch Details Dialog */}
      <Dialog open={isInventoryModalOpen} onOpenChange={setIsInventoryModalOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border-border rounded-2xl p-5 sm:p-6 dir-rtl">
          <DialogHeader className="text-right pb-3 border-b border-border">
            <DialogTitle className="text-base sm:text-lg font-serif font-bold flex items-center gap-2 text-blue-500">
              <Package className="w-5 h-5 text-blue-500" />
              توزيع البضاعة المتوفرة بالمعارض
            </DialogTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              إجمالي القطع المتوفرة: <span className="font-bold text-foreground font-mono">{globalMetrics.availableItemsCount}</span> قطعة — اضغط على أي فرع للانتقال للمنتجات
            </CardDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-4">
            {branchPerformanceData.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setIsInventoryModalOpen(false);
                  navigate(`/products?id=${b.id}`);
                }}
                className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-xl border border-border bg-muted/40 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all text-right group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-foreground group-hover:text-blue-500 transition-colors">
                      {b.nameAr}
                    </h4>
                    <p className="text-[9px] sm:text-[11px] text-muted-foreground whitespace-nowrap truncate">
                      {b.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-left">
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30 inline-block">
                      {b.availableStock} قطعة
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      مباع: {b.soldCount}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground rotate-180 group-hover:translate-x-[-2px] transition-transform group-hover:text-blue-500" />
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <Button variant="outline" onClick={() => setIsInventoryModalOpen(false)} className="rounded-xl text-xs">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
