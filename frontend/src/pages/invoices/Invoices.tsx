import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../../services/store';
import { api } from '../../services/api';
import { useStoreSync } from '../../hooks/useStoreSync';
import { Invoice, VODAFONE_CASH_NUMBERS } from '../../types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { 
  Printer, Eye, 
  ChevronLeft, ChevronRight, Search, RotateCcw, 
  Send, Trash2, Building2, Sparkles, X, AlertTriangle, AlertCircle,
  Star, BookOpen, CreditCard, Phone, CheckCircle2, Clock, FileText,
  User, DollarSign, ArrowLeftRight, MessageSquareText, ShieldCheck,
  Pencil, Plus, Minus, Save, PackageCheck, Receipt, Coins
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { CustomSelect } from '../../components/ui/CustomSelect';
import lightLogo from '../../assets/light-logo.png';
import vodafoneLogo from '../../assets/vodafone-logo.png';
import instapayLogo from '../../assets/instapay-logo.png';

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

interface InvoicePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  accentColor?: 'emerald' | 'rose' | 'amber';
}

const InvoicePagination = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  accentColor = 'emerald'
}: InvoicePaginationProps) => {
  if (totalItems <= itemsPerPage && totalPages <= 1) return null;

  // Generate page numbers to show (e.g., 1, 2, 3 ... totalPages)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  const activeStyles = {
    emerald: 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40 font-black',
    rose: 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/40 font-black',
    amber: 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/40 font-black',
  }[accentColor];

  return (
    <div className="flex items-center justify-center pt-3 pb-1 border-t border-border/50 text-xs">
      {/* Pagination controls */}
      <div className="flex items-center gap-1.5 select-none" dir="rtl">
        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 px-3 rounded-xl border border-border/80 bg-card hover:bg-muted text-foreground font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-xs"
          title="الصفحة السابقة"
        >
          <ChevronRight size={14} className="shrink-0" />
          <span>السابق</span>
        </button>

        {/* Number Buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1.5 text-muted-foreground/60 font-bold font-mono">
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === currentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-xl font-mono text-xs transition-all flex items-center justify-center border ${
                  isActive
                    ? `${activeStyles} scale-105`
                    : 'bg-card border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold'
                } active:scale-95 shadow-xs`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 px-3 rounded-xl border border-border/80 bg-card hover:bg-muted text-foreground font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-xs"
          title="الصفحة التالية"
        >
          <span>التالي</span>
          <ChevronLeft size={14} className="shrink-0" />
        </button>
      </div>
    </div>
  );
};

export const Invoices = () => {
  useStoreSync();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();

  const allInvoices = store.getInvoices();

  // Active Branch Identification
  const [branchFilter, setBranchFilter] = useState<string>(() => {
    if (!isAdmin && user?.branchId) {
      return user.branchId;
    }
    const params = new URLSearchParams(location.search);
    return params.get('id') || localStorage.getItem('last_active_branch') || 'all';
  });

  const activeBranchId = branchFilter === 'all' ? undefined : branchFilter;
  const activeBranch = activeBranchId ? store.getBranch(activeBranchId) : null;
  const activeBranchName = activeBranch?.nameAr || 'كل الفروع';

  // Invoices Filtering: Employees see ONLY their own invoices, Admins see all
  const userInvoices = useMemo(() => {
    if (isAdmin) return allInvoices;
    if (!user) return [];
    return allInvoices.filter(inv => {
      const isMine = inv.employeeId === user.id || 
                     inv.employeeId === user.username ||
                     (user.name && (inv as any).cashierName === user.name) ||
                     (inv.employeeId && store.getUsers().find(u => u.id === inv.employeeId)?.username === user.username);
      return isMine;
    });
  }, [allInvoices, isAdmin, user]);

  // Branch Invoices
  const branchInvoices = useMemo(() => {
    return userInvoices.filter(inv => !activeBranchId || inv.branchId === activeBranchId);
  }, [userInvoices, activeBranchId]);

  // State Management
  const [activeTab, setActiveTab] = useState<'all' | 'unpaid' | 'partial' | 'paid' | 'favorites'>('all');
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

  // On-demand lazy-loading of invoice items: only fetch items when receipt modal is opened
  useEffect(() => {
    if (selectedInvoice && (!selectedInvoice.items || selectedInvoice.items.length === 0)) {
      api.getInvoiceById(selectedInvoice.id)
        .then((fullInv) => {
          if (fullInv && Array.isArray(fullInv.items) && fullInv.items.length > 0) {
            setSelectedInvoice(prev => (prev && prev.id === fullInv.id ? { ...prev, items: fullInv.items } : prev));
          }
        })
        .catch((err) => {
          console.warn('Could not load invoice items on-demand:', err);
        });
    }
  }, [selectedInvoice?.id]);

  const [statementCustomerPhone, setStatementCustomerPhone] = useState<string | null>(null);
  const [statementCustomerName, setStatementCustomerName] = useState<string>('');
  const [statementModalTab, setStatementModalTab] = useState<'unpaid' | 'paid'>('unpaid');
  const [serverStatement, setServerStatement] = useState<any>(null);
  const [isLoadingStatement, setIsLoadingStatement] = useState<boolean>(false);
  const [statementError, setStatementError] = useState<string | null>(null);

  useEffect(() => {
    if (!statementCustomerPhone && !statementCustomerName) {
      setServerStatement(null);
      setStatementError(null);
      return;
    }

    let active = true;
    setIsLoadingStatement(true);
    setStatementError(null);

    const effBranch = (!isAdmin && user?.branchId) ? user.branchId : activeBranchId;
    api.getCustomerStatement({
      phone: statementCustomerPhone || undefined,
      name: statementCustomerName || undefined,
      branchId: effBranch,
    })
      .then(res => {
        if (active && res) {
          setServerStatement(res);
        }
      })
      .catch(err => {
        if (active) {
          console.error('Failed to load customer statement:', err);
          setStatementError('تعذر تحميل كشف الحساب الكامل من السيرفر.');
          toast.error('تعذر تحميل كشف الحساب من السيرفر');
        }
      })
      .finally(() => {
        if (active) setIsLoadingStatement(false);
      });

    return () => { active = false; };
  }, [statementCustomerPhone, statementCustomerName, activeBranchId, user?.branchId, isAdmin, refreshKey]);

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
    const ids = Array.from(new Set(monthInvoices.flatMap(i => [i.id, i.invoiceNumber]).filter(Boolean))) as string[];
    if (ids.length > 0) {
      store.deleteInvoicesByIds(ids);
      setRefreshKey(prev => prev + 1);
    }
    setIsDeleteMonthModalOpen(false);
  };

  const handleConfirmDeleteDay = () => {
    if (!selectedDate) return;
    const dayInvoices = branchInvoices.filter(inv => getIsoDate(inv.date) === selectedDate);
    const ids = Array.from(new Set(dayInvoices.flatMap(i => [i.id, i.invoiceNumber]).filter(Boolean))) as string[];
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

  const isInvoicePartiallyPaid = (inv: Invoice) => {
    const paid = getInvoicePaid(inv);
    const remaining = getInvoiceRemaining(inv);
    return (inv.paymentStatus === 'partial' || (paid > 0 && remaining > 0)) && remaining > 0 && paid > 0;
  };

  const isInvoiceStrictlyUnpaid = (inv: Invoice) => {
    const paid = getInvoicePaid(inv);
    const remaining = getInvoiceRemaining(inv);
    return (inv.paymentStatus === 'deferred' || remaining > 0) && paid === 0;
  };

  const isInvoiceFullyPaid = (inv: Invoice) => {
    return getInvoiceRemaining(inv) === 0 || (inv.paymentStatus === 'paid' && getInvoiceRemaining(inv) === 0);
  };

  const isInvoiceUnpaid = (inv: Invoice) => {
    return inv.paymentStatus === 'deferred' || inv.paymentStatus === 'partial' || getInvoiceRemaining(inv) > 0;
  };

  const favCusts = useMemo(() => store.getCustomers(), [refreshKey]);
  const isFavCustomerInvoice = useCallback((inv: Invoice) => {
    if (inv.isFavorite) return true;
    const cPhone = (inv.customerPhone || '').replace(/\D/g, '');
    const cName = (inv.customerName || '').trim().toLowerCase();
    return favCusts.some(fc => {
      const fcPhone = (fc.phone || '').replace(/\D/g, '');
      const fcName = (fc.name || '').trim().toLowerCase();
      return (
        (fc.id && inv.customerId && fc.id === inv.customerId) ||
        (cPhone && fcPhone && (cPhone === fcPhone || cPhone.endsWith(fcPhone) || fcPhone.endsWith(cPhone))) ||
        (cName && fcName && cName === fcName)
      );
    });
  }, [favCusts]);

  // Invoices filtered by active time period and search query
  const periodInvoices = useMemo(() => {
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
  }, [branchInvoices, selectedDate, currentYear, currentMonth, search, refreshKey]);

  // Tab Badge Counts (computed from current periodInvoices)
  const allCount = periodInvoices.length;
  const unpaidCount = useMemo(() => periodInvoices.filter(isInvoiceStrictlyUnpaid).length, [periodInvoices]);
  const partialCount = useMemo(() => periodInvoices.filter(isInvoicePartiallyPaid).length, [periodInvoices]);
  const paidCount = useMemo(() => periodInvoices.filter(isInvoiceFullyPaid).length, [periodInvoices]);
  const favoritesCount = useMemo(() => periodInvoices.filter(isFavCustomerInvoice).length, [periodInvoices, isFavCustomerInvoice]);

  // Dual Column Categorized Lists for Main View based on activeTab
  const unpaidInvoicesList = useMemo(() => {
    if (activeTab === 'paid') return [];
    if (activeTab === 'unpaid') return periodInvoices.filter(isInvoiceStrictlyUnpaid);
    if (activeTab === 'partial') return periodInvoices.filter(isInvoicePartiallyPaid);
    if (activeTab === 'favorites') return periodInvoices.filter(inv => isFavCustomerInvoice(inv) && (isInvoiceStrictlyUnpaid(inv) || isInvoicePartiallyPaid(inv)));
    // activeTab === 'all'
    return periodInvoices.filter(inv => isInvoiceStrictlyUnpaid(inv) || isInvoicePartiallyPaid(inv));
  }, [periodInvoices, activeTab, isFavCustomerInvoice]);

  const paidInvoicesList = useMemo(() => {
    if (activeTab === 'unpaid' || activeTab === 'partial') return [];
    if (activeTab === 'favorites') return periodInvoices.filter(inv => isFavCustomerInvoice(inv) && isInvoiceFullyPaid(inv));
    // activeTab === 'all' || activeTab === 'paid'
    return periodInvoices.filter(isInvoiceFullyPaid);
  }, [periodInvoices, activeTab, isFavCustomerInvoice]);

  const totalUnpaidAmount = useMemo(() => {
    return unpaidInvoicesList.reduce((acc, inv) => acc + getInvoiceRemaining(inv), 0);
  }, [unpaidInvoicesList]);

  const totalPaidAmount = useMemo(() => {
    return paidInvoicesList.reduce((acc, inv) => acc + (inv.total || 0), 0);
  }, [paidInvoicesList]);

  // Pagination Settings (8 invoices per page)
  const ITEMS_PER_PAGE = 8;
  const [paidPage, setPaidPage] = useState<number>(1);
  const [unpaidPage, setUnpaidPage] = useState<number>(1);

  // Server-side paginated state
  const [serverPaidInvoices, setServerPaidInvoices] = useState<Invoice[]>([]);
  const [serverUnpaidInvoices, setServerUnpaidInvoices] = useState<Invoice[]>([]);
  const [serverPaidTotal, setServerPaidTotal] = useState<number>(0);
  const [serverUnpaidTotal, setServerUnpaidTotal] = useState<number>(0);
  const [isServerPaginationActive, setIsServerPaginationActive] = useState<boolean>(false);
  const [isLoadingServerInvoices, setIsLoadingServerInvoices] = useState<boolean>(false);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setPaidPage(1);
    setUnpaidPage(1);
  }, [search, selectedDate, currentYear, currentMonth, activeTab, activeBranchId]);

  const totalPagesPaid = Math.max(1, Math.ceil(paidInvoicesList.length / ITEMS_PER_PAGE));
  const totalPagesUnpaid = Math.max(1, Math.ceil(unpaidInvoicesList.length / ITEMS_PER_PAGE));

  const safePaidPage = Math.min(paidPage, isServerPaginationActive && serverPaidTotal > 0 ? Math.max(1, Math.ceil(serverPaidTotal / ITEMS_PER_PAGE)) : totalPagesPaid);
  const safeUnpaidPage = Math.min(unpaidPage, isServerPaginationActive && serverUnpaidTotal > 0 ? Math.max(1, Math.ceil(serverUnpaidTotal / ITEMS_PER_PAGE)) : totalPagesUnpaid);

  // Fetch paginated invoices from backend
  useEffect(() => {
    let isCancelled = false;

    const fetchServerPaginated = async () => {
      setIsLoadingServerInvoices(true);
      try {
        let startDate: string | undefined;
        let endDate: string | undefined;

        if (selectedDate) {
          const [sY, sM, sD] = selectedDate.split('-').map(Number);
          startDate = new Date(sY, sM - 1, sD, 0, 0, 0, 0).toISOString();
          endDate = new Date(sY, sM - 1, sD, 23, 59, 59, 999).toISOString();
        } else {
          startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0).toISOString();
          endDate = new Date(currentYear, currentMonth, daysInMonth, 23, 59, 59, 999).toISOString();
        }

        const effectiveBranch = (!isAdmin && user?.branchId) ? user.branchId : activeBranchId;

        // Fetch paid invoices if needed by current tab
        const shouldFetchPaid = activeTab === 'all' || activeTab === 'paid' || activeTab === 'favorites';
        const shouldFetchUnpaid = activeTab === 'all' || activeTab === 'unpaid' || activeTab === 'partial' || activeTab === 'favorites';

        const promises: [Promise<any> | null, Promise<any> | null] = [
          shouldFetchPaid ? api.getPaginatedInvoices({
            page: safePaidPage,
            limit: ITEMS_PER_PAGE,
            search: search.trim() || undefined,
            branchId: effectiveBranch,
            startDate,
            endDate,
            paymentStatus: 'paid',
            isFavorite: activeTab === 'favorites' ? true : undefined,
          }) : null,
          shouldFetchUnpaid ? api.getPaginatedInvoices({
            page: safeUnpaidPage,
            limit: ITEMS_PER_PAGE,
            search: search.trim() || undefined,
            branchId: effectiveBranch,
            startDate,
            endDate,
            paymentStatus: activeTab === 'partial' ? 'partial' : 'unpaid',
            isFavorite: activeTab === 'favorites' ? true : undefined,
          }) : null
        ];

        const [paidRes, unpaidRes] = await Promise.all([
          promises[0] ? promises[0].catch(err => { console.warn('Server paid invoices fetch failed:', err); return null; }) : null,
          promises[1] ? promises[1].catch(err => { console.warn('Server unpaid invoices fetch failed:', err); return null; }) : null,
        ]);

        if (isCancelled) return;

        if (paidRes && Array.isArray(paidRes.data)) {
          setServerPaidInvoices(paidRes.data);
          setServerPaidTotal(paidRes.total || 0);
          setIsServerPaginationActive(true);
        } else if (!shouldFetchPaid) {
          setServerPaidInvoices([]);
          setServerPaidTotal(0);
        }

        if (unpaidRes && Array.isArray(unpaidRes.data)) {
          setServerUnpaidInvoices(unpaidRes.data);
          setServerUnpaidTotal(unpaidRes.total || 0);
          setIsServerPaginationActive(true);
        } else if (!shouldFetchUnpaid) {
          setServerUnpaidInvoices([]);
          setServerUnpaidTotal(0);
        }
      } catch (err) {
        console.warn('Error fetching server paginated invoices, using local fallback:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingServerInvoices(false);
        }
      }
    };

    fetchServerPaginated();

    return () => {
      isCancelled = true;
    };
  }, [
    safePaidPage,
    safeUnpaidPage,
    search,
    selectedDate,
    currentYear,
    currentMonth,
    activeTab,
    activeBranchId,
    refreshKey,
    user?.id,
    isAdmin,
    daysInMonth
  ]);

  const paginatedPaidInvoices = useMemo(() => {
    const start = (safePaidPage - 1) * ITEMS_PER_PAGE;
    return paidInvoicesList.slice(start, start + ITEMS_PER_PAGE);
  }, [paidInvoicesList, safePaidPage]);

  const paginatedUnpaidInvoices = useMemo(() => {
    const start = (safeUnpaidPage - 1) * ITEMS_PER_PAGE;
    return unpaidInvoicesList.slice(start, start + ITEMS_PER_PAGE);
  }, [unpaidInvoicesList, safeUnpaidPage]);

  // Display lists prioritizing server pagination
  const displayPaidInvoices = isServerPaginationActive ? serverPaidInvoices : paginatedPaidInvoices;
  const displayUnpaidInvoices = isServerPaginationActive ? serverUnpaidInvoices : paginatedUnpaidInvoices;

  const displayPaidCount = isServerPaginationActive ? serverPaidTotal : paidInvoicesList.length;
  const displayUnpaidCount = isServerPaginationActive ? serverUnpaidTotal : unpaidInvoicesList.length;

  const displayTotalPagesPaid = isServerPaginationActive
    ? Math.max(1, Math.ceil(serverPaidTotal / ITEMS_PER_PAGE))
    : totalPagesPaid;
  const displayTotalPagesUnpaid = isServerPaginationActive
    ? Math.max(1, Math.ceil(serverUnpaidTotal / ITEMS_PER_PAGE))
    : totalPagesUnpaid;

  const filteredInvoices = periodInvoices;

  // Handlers
  const handleToggleFavorite = (invId: string) => {
    store.toggleFavoriteInvoice(invId);
    setRefreshKey(prev => prev + 1);
  };

  const handleConfirmDeleteSingle = () => {
    if (singleDeleteId) {
      const inv = store.getInvoices().find(i => i.id === singleDeleteId || i.invoiceNumber === singleDeleteId);
      const toDelete = inv
        ? Array.from(new Set([inv.id, inv.invoiceNumber, singleDeleteId])).filter(Boolean) as string[]
        : [singleDeleteId];
      store.deleteInvoicesByIds(toDelete);
      setRefreshKey(prev => prev + 1);
      setSingleDeleteId(null);
    }
  };

  // Open Statement Modal ("كشف الحساب")
  const handleOpenCustomerStatement = (customerName?: string, customerPhone?: string) => {
    if (!customerPhone && !customerName) {
      toast.error('لا يتوفر رقم هاتف أو اسم لهذا العميل لعرض كشف الحساب.');
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
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const handleConfirmSubmitPayment = async () => {
    const amt = parseFloat(paymentAmountInput);
    if (isNaN(amt) || amt <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    const effBranch = (!isAdmin && user?.branchId) ? user.branchId : activeBranchId;
    setIsSubmittingPayment(true);
    try {
      if (paymentModalInvoice) {
        await store.payInvoice(paymentModalInvoice.id, amt);
        setPaymentModalInvoice(null);
        toast.success('تم تسجيل سداد الفاتورة بنجاح');
      } else if (paymentModalCustomerPhone) {
        await store.payCustomerDebt(paymentModalCustomerPhone, amt, effBranch);
        setPaymentModalCustomerPhone(null);
        toast.success('تم تسجيل سداد مديونية العميل بنجاح');
      }
      setRefreshKey(prev => prev + 1);

      // Refresh authoritative statement if statement modal is active
      if (statementCustomerPhone || statementCustomerName) {
        try {
          const res = await api.getCustomerStatement({
            phone: statementCustomerPhone || undefined,
            name: statementCustomerName || undefined,
            branchId: effBranch,
          });
          setServerStatement(res);
        } catch (e) {
          console.warn('Could not refresh statement after payment:', e);
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'فشل تسجيل السداد. يرجى المحاولة مرة أخرى.';
      toast.error(msg);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // WhatsApp Recipient Selection Modal State
  const [whatsAppModalInvoice, setWhatsAppModalInvoice] = useState<Invoice | null>(null);
  const [recipientType, setRecipientType] = useState<'customer' | 'bola' | 'mina'>('customer');
  const [recipientPhoneInput, setRecipientPhoneInput] = useState<string>('');

  const getAdminPhone = (type: 'bola' | 'mina') => {
    const allUsers = store.getUsers();
    if (type === 'bola') {
      const bUser = allUsers.find(u => u && u.username && u.username.trim().toLowerCase() === 'bola');
      return bUser?.phone || localStorage.getItem('super_admin_phone_bola') || '01204292945';
    } else {
      const mUser = allUsers.find(u => u && u.username && u.username.trim().toLowerCase() === 'mina');
      return mUser?.phone || localStorage.getItem('super_admin_phone_mina') || '01094534953';
    }
  };

  const handleOpenWhatsAppModal = (inv: Invoice) => {
    setWhatsAppModalInvoice(inv);
    setRecipientType('customer');
    setRecipientPhoneInput(inv.customerPhone || '');
    if (!inv.items || inv.items.length === 0) {
      api.getInvoiceById(inv.id || inv.invoiceNumber)
        .then(full => {
          if (full && Array.isArray(full.items) && full.items.length > 0) {
            setWhatsAppModalInvoice(prev => (prev && (prev.id === full.id || prev.invoiceNumber === full.invoiceNumber) ? { ...prev, items: full.items } : prev));
          }
        })
        .catch(err => {
          console.warn('Could not load invoice items for WhatsApp message:', err);
        });
    }
  };

  const handleSelectRecipientType = (type: 'customer' | 'bola' | 'mina') => {
    setRecipientType(type);
    if (type === 'customer') {
      setRecipientPhoneInput(whatsAppModalInvoice?.customerPhone || '');
    } else if (type === 'bola') {
      setRecipientPhoneInput(getAdminPhone('bola'));
    } else if (type === 'mina') {
      setRecipientPhoneInput(getAdminPhone('mina'));
    }
  };

  const handleConfirmSendWhatsApp = () => {
    if (!whatsAppModalInvoice) return;
    const cleanPhone = recipientPhoneInput.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      toast.error('يرجى كتابة أو تحديد رقم هاتف صحيح لإرسال الواتساب');
      return;
    }

    // Persist updated super admin phone numbers for future use
    if (recipientType === 'bola') {
      localStorage.setItem('super_admin_phone_bola', recipientPhoneInput.trim());
      const bUser = store.getUsers().find(u => u?.username?.toLowerCase() === 'bola');
      if (bUser) store.updateUser(bUser.id, { phone: recipientPhoneInput.trim() });
    } else if (recipientType === 'mina') {
      localStorage.setItem('super_admin_phone_mina', recipientPhoneInput.trim());
      const mUser = store.getUsers().find(u => u?.username?.toLowerCase() === 'mina');
      if (mUser) store.updateUser(mUser.id, { phone: recipientPhoneInput.trim() });
    }

    const inv = whatsAppModalInvoice;
    const branchObj = store.getBranch(inv.branchId);
    const branchName = branchObj ? branchObj.nameAr : activeBranchName;
    const sellerObj = store.getUsers().find(u => u.id === inv.employeeId);
    const sellerName = sellerObj ? sellerObj.name : (user?.name || 'الكاشير');
    const customerInfo = inv.customerName ? `${inv.customerName} (${inv.customerPhone || ''})` : 'عميل الفرع';
    const rem = getInvoiceRemaining(inv);
    const paid = getInvoicePaid(inv);

    const itemLines = (inv.items || []).map((item) => {
      const p = store.getProduct(item.productId);
      const name = item.productName || p?.nameAr || p?.nameEn || 'منتج إكسسوارات';
      const count = item.quantity || 1;
      const unitPrice = Number(item.unitPrice || 0);
      const total = unitPrice * count;
      return `• ${name} (عدد ${count} × ${unitPrice.toFixed(2)} ج.م) : ${total.toFixed(2)} ج.م`;
    }).join('\n');

    const invDiscount = Number(inv.discount || 0);
    const invSubtotal = inv.total + invDiscount;
    const totalsCustomer = invDiscount > 0
      ? `المجموع قبل الخصم: ${invSubtotal.toFixed(2)} ج.م\nالخصم: -${invDiscount.toFixed(2)} ج.م\nالإجمالي بعد الخصم: ${inv.total.toFixed(2)} ج.م`
      : `المجموع الإجمالي: ${inv.total.toFixed(2)} ج.م`;

    const totalsAdmin = invDiscount > 0
      ? `💰 المجموع قبل الخصم: ${invSubtotal.toFixed(2)} ج.م\n🏷️ الخصم: -${invDiscount.toFixed(2)} ج.م\n💵 الإجمالي بعد الخصم: ${inv.total.toFixed(2)} ج.م`
      : `💰 المجموع الإجمالي: ${inv.total.toFixed(2)} ج.م`;

    let msg = '';
    if (recipientType === 'customer') {
      msg = `*متجر Salla Bola & Mina للإكسسوارات*
فاتورة مبيعات مسلسل: #${inv.invoiceNumber}
التاريخ: ${new Date(inv.date).toLocaleDateString('ar-EG')} - ${new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
اسم العميل: ${inv.customerName || 'عميل محترم'}
الموظف البائع: ${sellerName}
الفرع: ${branchName}
-----------------------------------
تفاصيل المشتريات:
${itemLines}
-----------------------------------
${totalsCustomer}
${paid > 0 ? `المدفوع: ${paid.toFixed(2)} ج.م\n` : ''}${rem > 0 ? `المتبقي (آجل): ${rem.toFixed(2)} ج.م\n` : ''}طريقة السداد: ${inv.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : inv.paymentMethod === 'multi' ? 'دفع مقسم (متعدد)' : 'نقداً'}
-----------------------------------
هدفنا إرضاء العميل وليس الربح ❤️
متجر Salla Bola & Mina للإكسسوارات`;
    } else {
      const adminName = recipientType === 'bola' ? 'بولا (Bola)' : 'مينا (Mina)';
      msg = `🧾 *إشعار فاتورة مبيعات جديدة للسوبر أدمن ${adminName}*
-----------------------------------
• رقم الفاتورة: #${inv.invoiceNumber}
• الفرع: ${branchName}
• التاريخ: ${new Date(inv.date).toLocaleDateString('ar-EG')} - ${new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
• الكاشير البائع: ${sellerName}
• العميل: ${customerInfo}

📦 تفاصيل الأصناف والمشتريات:
${itemLines}

-----------------------------------
${totalsAdmin}
💵 المدفوع: ${paid.toFixed(2)} ج.م
${rem > 0 ? `⚠️ المتبقي (آجل): ${rem.toFixed(2)} ج.م\n` : ''}💳 طريقة السداد: ${inv.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : inv.paymentMethod === 'instapay' ? 'إنستاباي' : inv.paymentMethod === 'multi' ? 'دفع مقسم (متعدد)' : 'نقداً'}
-----------------------------------
متجر Salla Bola & Mina للإكسسوارات`;
    }

    let targetPhone = cleanPhone;
    if (targetPhone.startsWith('0')) {
      targetPhone = '20' + targetPhone.slice(1);
    } else if (!targetPhone.startsWith('20')) {
      targetPhone = '20' + targetPhone;
    }

    const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    toast.success(`تم تجهيز رسالة الواتساب إلى ${recipientType === 'customer' ? 'العميل' : recipientType === 'bola' ? 'بولا' : 'مينا'}`);
    setWhatsAppModalInvoice(null);
  };

  // Alias for backward compatibility with existing button triggers
  const handleSendWhatsAppInvoice = (inv: Invoice) => {
    handleOpenWhatsAppModal(inv);
  };

  // --- SUPER ADMIN: EDIT INVOICE & RETURNS STATE ---
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [openingInvoiceId, setOpeningInvoiceId] = useState<string | null>(null);
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'vodafone_cash' | 'instapay' | 'multi'>('cash');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'partial' | 'deferred'>('paid');
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editSplitCash, setEditSplitCash] = useState<number>(0);
  const [editSplitVodafone, setEditSplitVodafone] = useState<number>(0);
  const [editSplitInstapay, setEditSplitInstapay] = useState<number>(0);
  const [editVodafoneNumber, setEditVodafoneNumber] = useState<string>(VODAFONE_CASH_NUMBERS[0]);
  const [editItems, setEditItems] = useState<Array<{
    physicalItemId?: string;
    productId: string;
    productName?: string;
    unitPrice: number;
    unitCost: number;
    quantity: number;
    originalQuantity: number;
  }>>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  const handleOpenEditModal = async (inv: Invoice) => {
    setOpeningInvoiceId(inv.id);
    let fullInv = inv;
    if (!inv.items || inv.items.length === 0) {
      try {
        const fetched = await api.getInvoiceById(inv.id || inv.invoiceNumber);
        if (fetched && fetched.items && fetched.items.length > 0) {
          fullInv = fetched;
        }
      } catch (err) {
        console.warn('Could not load full invoice items for edit modal:', err);
      }
    }

    setEditingInvoice(fullInv);
    setEditCustomerName(fullInv.customerName || '');
    setEditCustomerPhone(fullInv.customerPhone || '');
    const initialMethod = (fullInv.paymentSubMethod || fullInv.paymentMethod || 'cash') as any;
    setEditPaymentMethod(initialMethod);
    setEditVodafoneNumber(fullInv.vodafoneNumber || VODAFONE_CASH_NUMBERS[0]);

    // 3 distinct payment statuses: paid, partial, deferred
    let initialStatus: 'paid' | 'partial' | 'deferred' = 'paid';
    if (fullInv.paymentStatus === 'deferred' || (!fullInv.paidAmount && fullInv.remainingAmount && fullInv.remainingAmount >= fullInv.total && fullInv.total > 0)) {
      initialStatus = 'deferred';
    } else if (fullInv.paymentStatus === 'partial' || (fullInv.remainingAmount && fullInv.remainingAmount > 0)) {
      initialStatus = 'partial';
    }
    setEditPaymentStatus(initialStatus);

    if (initialStatus === 'paid') {
      setEditPaidAmount(fullInv.total);
    } else if (initialStatus === 'deferred') {
      setEditPaidAmount(0);
    } else {
      setEditPaidAmount(fullInv.paidAmount !== undefined ? fullInv.paidAmount : fullInv.total);
    }

    setEditDiscount(fullInv.discount || 0);

    // Populate split payments
    if (fullInv.splitPayments) {
      setEditSplitCash(Number(fullInv.splitPayments.cash || 0));
      setEditSplitVodafone(Number(fullInv.splitPayments.vodafone_cash || 0));
      setEditSplitInstapay(Number(fullInv.splitPayments.instapay || 0));
    } else {
      const pTotal = initialStatus === 'paid' ? fullInv.total : (fullInv.paidAmount || 0);
      setEditSplitCash(initialMethod === 'cash' ? pTotal : 0);
      setEditSplitVodafone(initialMethod === 'vodafone_cash' ? pTotal : 0);
      setEditSplitInstapay(initialMethod === 'instapay' ? pTotal : 0);
    }

    const cloned = (fullInv.items || []).map(it => {
      const bd = store.getProductBranchData(it.productId, fullInv.branchId);
      const pr = Number(it.unitPrice);
      const q = Number(it.quantity);
      return {
        physicalItemId: it.physicalItemId,
        productId: it.productId,
        productName: it.productName || store.getProduct(it.productId)?.nameAr || 'منتج',
        unitPrice: isNaN(pr) ? 0 : pr,
        unitCost: Number((it as any).unitCost !== undefined ? (it as any).unitCost : (bd?.cost || 0)),
        quantity: isNaN(q) || q <= 0 ? 1 : q,
        originalQuantity: isNaN(q) || q <= 0 ? 1 : q,
      };
    });
    setEditItems(cloned);
    setOpeningInvoiceId(null);
  };

  const handleRemoveEditItem = (idx: number) => {
    setEditItems(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      const newSub = updated.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * (Number(it.quantity) || 1)), 0);
      const newTot = Math.max(0, newSub - (Number(editDiscount) || 0));

      if (editPaymentStatus === 'paid') {
        setEditPaidAmount(newTot);
        if (editPaymentMethod === 'cash') setEditSplitCash(newTot);
        else if (editPaymentMethod === 'vodafone_cash') setEditSplitVodafone(newTot);
        else if (editPaymentMethod === 'instapay') setEditSplitInstapay(newTot);
      } else if (editPaymentStatus === 'deferred') {
        setEditPaidAmount(0);
        setEditSplitCash(0);
        setEditSplitVodafone(0);
        setEditSplitInstapay(0);
      } else {
        setEditPaidAmount(prevPaid => Math.min(prevPaid, newTot));
      }
      return updated;
    });
  };

  const handleUpdateEditItemQuantity = (idx: number, delta: number) => {
    setEditItems(prev => {
      const copy = [...prev];
      const curQty = Number(copy[idx].quantity) || 1;
      const maxAllowed = Number(copy[idx].originalQuantity) || curQty;
      // Cannot increase above original sold quantity!
      const newQty = Math.min(maxAllowed, Math.max(1, curQty + delta));
      if (newQty === curQty) return prev;

      copy[idx] = { ...copy[idx], quantity: newQty };

      const newSub = copy.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * (Number(it.quantity) || 1)), 0);
      const newTot = Math.max(0, newSub - (Number(editDiscount) || 0));

      if (editPaymentStatus === 'paid') {
        setEditPaidAmount(newTot);
        if (editPaymentMethod === 'cash') setEditSplitCash(newTot);
        else if (editPaymentMethod === 'vodafone_cash') setEditSplitVodafone(newTot);
        else if (editPaymentMethod === 'instapay') setEditSplitInstapay(newTot);
      } else if (editPaymentStatus === 'deferred') {
        setEditPaidAmount(0);
        setEditSplitCash(0);
        setEditSplitVodafone(0);
        setEditSplitInstapay(0);
      } else {
        setEditPaidAmount(prevPaid => Math.min(prevPaid, newTot));
      }
      return copy;
    });
  };

  const handleEditDiscountChange = (newDiscount: number) => {
    const safeD = Math.max(0, newDiscount);
    setEditDiscount(safeD);
    const newTot = Math.max(0, editSubtotal - safeD);

    if (editPaymentStatus === 'paid') {
      setEditPaidAmount(newTot);
      if (editPaymentMethod === 'cash') setEditSplitCash(newTot);
      else if (editPaymentMethod === 'vodafone_cash') setEditSplitVodafone(newTot);
      else if (editPaymentMethod === 'instapay') setEditSplitInstapay(newTot);
    } else if (editPaymentStatus === 'deferred') {
      setEditPaidAmount(0);
      setEditSplitCash(0);
      setEditSplitVodafone(0);
      setEditSplitInstapay(0);
    } else {
      setEditPaidAmount(prev => Math.min(prev, newTot));
    }
  };

  const handleUpdateEditItemPrice = (idx: number, newPrice: number) => {
    const safePrice = isNaN(newPrice) ? 0 : Math.max(0, newPrice);
    setEditItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], unitPrice: safePrice };

      const newSub = copy.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * (Number(it.quantity) || 1)), 0);
      const newTot = Math.max(0, newSub - (Number(editDiscount) || 0));

      if (editPaymentStatus === 'paid') {
        setEditPaidAmount(newTot);
        if (editPaymentMethod === 'cash') setEditSplitCash(newTot);
        else if (editPaymentMethod === 'vodafone_cash') setEditSplitVodafone(newTot);
        else if (editPaymentMethod === 'instapay') setEditSplitInstapay(newTot);
      } else {
        setEditPaidAmount(prevPaid => Math.min(prevPaid, newTot));
      }
      return copy;
    });
  };

  // Computations for Edit Modal
  const editSubtotal = useMemo(() => {
    return editItems.reduce((acc, it) => {
      const p = Number(it.unitPrice) || 0;
      const q = Number(it.quantity) || 1;
      return acc + (p * q);
    }, 0);
  }, [editItems]);

  const editTotalCost = useMemo(() => {
    return editItems.reduce((acc, it) => {
      const c = Number(it.unitCost) || 0;
      const q = Number(it.quantity) || 1;
      return acc + (c * q);
    }, 0);
  }, [editItems]);

  const editTotal = useMemo(() => {
    const d = Number(editDiscount) || 0;
    return Math.max(0, editSubtotal - d);
  }, [editSubtotal, editDiscount]);

  const editNetProfit = useMemo(() => {
    return editTotal - editTotalCost;
  }, [editTotal, editTotalCost]);

  // Track returned items and quantities to be restored to inventory
  const returnedItemsSummary = useMemo(() => {
    if (!editingInvoice) return [];
    const origMap = new Map<string, { name: string; qty: number }>();
    (editingInvoice.items || []).forEach(it => {
      const cur = origMap.get(it.productId) || { name: it.productName || 'منتج', qty: 0 };
      cur.qty += (it.quantity || 1);
      origMap.set(it.productId, cur);
    });

    const newMap = new Map<string, number>();
    editItems.forEach(it => {
      newMap.set(it.productId, (newMap.get(it.productId) || 0) + (it.quantity || 1));
    });

    const returnedList: Array<{ productId: string; productName: string; returnCount: number }> = [];
    origMap.forEach((val, pId) => {
      const newQ = newMap.get(pId) || 0;
      if (val.qty > newQ) {
        returnedList.push({
          productId: pId,
          productName: val.name,
          returnCount: val.qty - newQ
        });
      }
    });
    return returnedList;
  }, [editingInvoice, editItems]);

  const originalNetProfit = useMemo(() => {
    if (!editingInvoice) return 0;
    return (editingInvoice.total || 0) - (editingInvoice.totalCost || 0);
  }, [editingInvoice]);

  const profitDeduction = useMemo(() => {
    return Math.max(0, originalNetProfit - editNetProfit);
  }, [originalNetProfit, editNetProfit]);

  const originalPaymentInfo = useMemo(() => {
    if (!editingInvoice) return null;
    const method = editingInvoice.paymentSubMethod || editingInvoice.paymentMethod || 'cash';
    if (editingInvoice.splitPayments && (editingInvoice.paymentSubMethod === 'multi' || editingInvoice.paymentMethod === 'multi')) {
      const parts = [
        editingInvoice.splitPayments.cash ? `كاش: ${editingInvoice.splitPayments.cash} ج.م` : null,
        editingInvoice.splitPayments.vodafone_cash ? `فودافون: ${editingInvoice.splitPayments.vodafone_cash} ج.م` : null,
        editingInvoice.splitPayments.instapay ? `إنستاباي: ${editingInvoice.splitPayments.instapay} ج.م` : null,
      ].filter(Boolean);
      return {
        name: 'دفع مقسّم (متعدد)',
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
        icon: <Coins size={14} className="shrink-0 text-amber-500" />,
        details: parts.length > 0 ? parts.join(' • ') : undefined
      };
    }
    switch (method) {
      case 'vodafone_cash':
        return {
          name: 'فودافون كاش',
          color: 'text-red-500 bg-red-500/10 border-red-500/30',
          icon: <img src={vodafoneLogo} alt="فودافون كاش" className="w-4 h-4 object-contain shrink-0 rounded-full" />,
        };
      case 'instapay':
        return {
          name: 'إنستاباي (InstaPay)',
          color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
          icon: <img src={instapayLogo} alt="إنستاباي" className="w-4 h-4 object-contain shrink-0 rounded-md" />,
        };
      case 'card':
        return {
          name: 'فيزا / بطاقة بنكية',
          color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
          icon: <CreditCard size={14} className="shrink-0 text-blue-500" />,
        };
      case 'transfer':
        return {
          name: 'تحويل بنكي',
          color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
          icon: <Building2 size={14} className="shrink-0 text-emerald-500" />,
        };
      case 'cash':
      default:
        return {
          name: 'نقداً (كاش)',
          color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
          icon: (
            <svg className="w-4 h-4 fill-none stroke-current shrink-0" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="3" />
              <path d="M6 12h.01M18 12h.01" />
            </svg>
          ),
        };
    }
  }, [editingInvoice]);

  const paymentMethodOptions = useMemo(() => [
    {
      value: 'cash',
      label: 'نقداً (كاش)',
      sublabel: 'في اليد',
      icon: (
        <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      ),
    },
    {
      value: 'vodafone_cash',
      label: 'فودافون كاش',
      sublabel: 'محفظة',
      icon: <img src={vodafoneLogo} alt="فودافون" className="w-4 h-4 object-contain rounded-full" />,
    },
    {
      value: 'instapay',
      label: 'إنستاباي (InstaPay)',
      sublabel: 'IPN فوري',
      icon: <img src={instapayLogo} alt="إنستاباي" className="w-4 h-4 object-contain rounded-md" />,
    },
    {
      value: 'multi',
      label: 'دفع متعدد (مقسم)',
      sublabel: 'أكثر من وسيلة',
      icon: <Coins size={15} />,
    },
    {
      value: 'card',
      label: 'فيزا / بطاقة بنكية',
      sublabel: 'POS',
      icon: <CreditCard size={15} />,
    },
    {
      value: 'transfer',
      label: 'تحويل بنكي',
      sublabel: 'حساب بنكي',
      icon: <Building2 size={15} />,
    },
  ], []);

  const paymentStatusOptions = useMemo(() => [
    {
      value: 'paid',
      label: 'مدفوع بالكامل',
      sublabel: 'تم سداد كامل قيمة الفاتورة',
      icon: <CheckCircle2 size={16} className="text-emerald-500" />,
    },
    {
      value: 'partial',
      label: 'دفع جزئي',
      sublabel: 'تم دفع جزء من المبلغ والباقي آجل على العميل',
      icon: <Clock size={16} className="text-amber-500" />,
    },
    {
      value: 'deferred',
      label: 'آجل بالكامل',
      sublabel: 'المبلغ غير مدفوع بالكامل وآجل على العميل',
      icon: <AlertCircle size={16} className="text-rose-500" />,
    },
  ], []);

  const handleSaveInvoiceEdit = async (openWhatsApp = false) => {
    if (!editingInvoice) return;
    if (editItems.length === 0) {
      setIsSubmittingEdit(true);
      try {
        const invId = editingInvoice.id || editingInvoice.invoiceNumber;
        await store.deleteInvoicesByIds([invId, editingInvoice.invoiceNumber].filter(Boolean), [editingInvoice]);
        toast.success('تم حذف الفاتورة بالكامل وإرجاع المنتجات إلى المخزن وتحديث الأرباح بنجاح.');
        setEditingInvoice(null);
        setRefreshKey(prev => prev + 1);
      } catch (err: any) {
        toast.error(err?.message || 'حدث خطأ أثناء حذف الفاتورة وإرجاع المنتجات');
      } finally {
        setIsSubmittingEdit(false);
      }
      return;
    }

    try {
      setIsSubmittingEdit(true);

      const isMulti = editPaymentMethod === 'multi';
      const cleanTotal = Number(editTotal) || 0;
      const cleanSubtotal = Number(editSubtotal) || 0;
      const cleanCost = Number(editTotalCost) || 0;
      const cleanDiscount = Number(editDiscount) || 0;

      const splitCash = Number(editSplitCash) || 0;
      const splitVoda = Number(editSplitVodafone) || 0;
      const splitInsta = Number(editSplitInstapay) || 0;
      const splitSum = splitCash + splitVoda + splitInsta;

      let effectivePaid: number;
      let effectiveRemaining: number;
      let effectiveStatus: 'paid' | 'partial' | 'deferred';

      if (editPaymentStatus === 'paid') {
        effectivePaid = cleanTotal;
        effectiveRemaining = 0;
        effectiveStatus = 'paid';
      } else if (editPaymentStatus === 'deferred') {
        effectivePaid = 0;
        effectiveRemaining = cleanTotal;
        effectiveStatus = 'deferred';
      } else {
        // partial
        if (isMulti) {
          effectivePaid = Math.min(splitSum, cleanTotal);
        } else {
          const pAmt = Number(editPaidAmount);
          effectivePaid = Math.min(isNaN(pAmt) ? cleanTotal : Math.max(0, pAmt), cleanTotal);
        }
        effectiveRemaining = Math.max(0, cleanTotal - effectivePaid);
        effectiveStatus = effectiveRemaining <= 0 ? 'paid' : (effectivePaid <= 0 ? 'deferred' : 'partial');
      }

      const finalSplitPayments = isMulti ? {
        cash: splitCash,
        vodafone_cash: splitVoda,
        instapay: splitInsta,
      } : {
        cash: editPaymentMethod === 'cash' ? effectivePaid : 0,
        vodafone_cash: editPaymentMethod === 'vodafone_cash' ? effectivePaid : 0,
        instapay: editPaymentMethod === 'instapay' ? effectivePaid : 0,
      };

      const updatedInvoicePayload: Invoice = {
        ...editingInvoice,
        customerName: editCustomerName.trim() || 'عميل فرع',
        customerPhone: editCustomerPhone.trim(),
        paymentMethod: editPaymentMethod,
        paymentSubMethod: (isMulti ? 'multi' : editPaymentMethod === 'vodafone_cash' ? 'vodafone_cash' : editPaymentMethod === 'instapay' ? 'instapay' : 'cash') as any,
        splitPayments: finalSplitPayments,
        vodafoneNumber: (editPaymentMethod === 'vodafone_cash' || (isMulti && splitVoda > 0)) ? editVodafoneNumber : undefined,
        paymentStatus: effectiveStatus,
        paidAmount: effectivePaid,
        remainingAmount: effectiveRemaining,
        subtotal: cleanSubtotal,
        discount: cleanDiscount,
        total: cleanTotal,
        totalCost: cleanCost,
        items: editItems.map(it => {
          const pId = it.physicalItemId?.trim();
          const isSynthetic = !pId ||
            pId.startsWith('COMP-ITEM-') ||
            pId.startsWith('COMP-') ||
            pId.startsWith('ITEM-');

          return {
            physicalItemId: isSynthetic ? undefined : pId,
            productId: it.productId,
            productName: it.productName,
            unitPrice: Number(it.unitPrice) || 0,
            unitCost: Number(it.unitCost) || 0,
            quantity: Number(it.quantity) || 1,
          };
        }),
      };

      const returnedStockPayload = returnedItemsSummary.map(r => ({
        productId: r.productId,
        productName: r.productName,
        quantity: r.returnCount
      }));

      const savedInvoice = await store.updateInvoice(updatedInvoicePayload, returnedStockPayload);

      toast.success(
        returnedStockPayload.length > 0
          ? `تم حفظ تعديلات الفاتورة بنجاح، وإرجاع ${returnedStockPayload.reduce((a, b) => a + b.quantity, 0)} قطعة للمخزن وتحديث الأرباح.`
          : 'تم حفظ تعديلات الفاتورة بنجاح وتحديث الأرباح.'
      );

      setEditingInvoice(null);
      setSelectedInvoice(savedInvoice || updatedInvoicePayload);
      setRefreshKey(prev => prev + 1);

      if (openWhatsApp) {
        handleSendWhatsAppInvoice(savedInvoice || updatedInvoicePayload);
      }
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء تعديل الفاتورة');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // WhatsApp Statement Reminder
  const handleSendWhatsAppStatementReminder = (customerName: string, customerPhone: string, invoices: Invoice[], totalDebt: number) => {
    if (isLoadingStatement) {
      toast.error('يرجى الانتظار حتى اكتمال تحميل كشف الحساب.');
      return;
    }
    if (statementError || !serverStatement) {
      toast.error('تعذر إرسال التذكير بسبب فشل تحميل كشف الحساب الدقيق من السيرفر. يرجى إعادة المحاولة.');
      return;
    }

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
  const statementInvoices: Invoice[] = useMemo(() => {
    if (serverStatement && Array.isArray(serverStatement.invoices)) {
      return serverStatement.invoices as Invoice[];
    }
    return [];
  }, [serverStatement]);

  const statementUnpaidInvoices: Invoice[] = useMemo(() => {
    if (serverStatement && Array.isArray(serverStatement.unpaidInvoices)) {
      return serverStatement.unpaidInvoices as Invoice[];
    }
    return [];
  }, [serverStatement]);

  const statementPaidInvoices: Invoice[] = useMemo(() => {
    if (serverStatement && Array.isArray(serverStatement.paidInvoices)) {
      return serverStatement.paidInvoices as Invoice[];
    }
    return [];
  }, [serverStatement]);

  const statementTotalPurchases = useMemo(() => {
    if (serverStatement?.totalPurchases !== undefined) {
      return Number(serverStatement.totalPurchases || 0);
    }
    return 0;
  }, [serverStatement]);

  const statementTotalDebt = useMemo(() => {
    if (serverStatement?.totalDebt !== undefined) {
      return Number(serverStatement.totalDebt || 0);
    }
    return 0;
  }, [serverStatement]);

  return (
    <div className="space-y-6 pb-20 md:pb-6 animate-in fade-in" dir="rtl">
      
      {/* PAGE HEADER (Image 2 Top Title) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border/80 p-4 sm:p-5 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">سجل الفواتير والمبيعات</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">تتبع الفواتير المدفوعة والأجلة وتاريخ السداد — {activeBranchName}</p>
          </div>
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1.5 rounded-2xl border border-border/60">
            <button
              onClick={() => {
                setBranchFilter('all');
                store.quickSyncStockAndInvoices();
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                branchFilter === 'all'
                  ? 'bg-amber-500 text-black shadow-xs font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              كل الفروع
            </button>
            {store.getBranches().map(b => (
              <button
                key={b.id}
                onClick={() => {
                  setBranchFilter(b.id);
                  try {
                    localStorage.setItem('last_active_branch', b.id);
                  } catch {}
                  store.quickSyncStockAndInvoices(b.id);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  branchFilter === b.id
                    ? 'bg-amber-500 text-black shadow-xs font-black'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {b.nameAr}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold shadow-xs">
            <User size={15} />
            <span>فواتيرك المسجلة باسمك فقط ({branchInvoices.length} فاتورة)</span>
          </div>
        )}
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span>الكل</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
              }`}>
                {allCount}
              </span>
            </button>

            {/* Tab: غير مدفوعة / آجلة */}
            <button
              onClick={() => setActiveTab('unpaid')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-muted/50 text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              <span>غير مدفوعة</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {unpaidCount}
              </span>
            </button>

            {/* Tab: دفع جزئي */}
            <button
              onClick={() => setActiveTab('partial')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'partial'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 ring-1 ring-amber-400/50'
                  : 'bg-muted/50 text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <span>دفع جزئي</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {partialCount}
              </span>
            </button>

            {/* Tab: مدفوعة بالكامل */}
            <button
              onClick={() => setActiveTab('paid')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'paid'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-muted/50 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <span>مدفوعة بالكامل</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {paidCount}
              </span>
            </button>

            {/* Tab: المفضلة */}
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
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
        activeTab === 'paid' || activeTab === 'unpaid' || activeTab === 'partial'
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
                <h2 className="text-base font-bold">الفواتير المدفوعة بالكامل ({displayPaidCount})</h2>
                {isLoadingServerInvoices && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" title="جاري التحديث..." />}
              </div>
              <div className="text-xs font-bold text-emerald-300 font-mono bg-emerald-900/40 border border-emerald-700/40 px-3 py-1 rounded-xl">
                إجمالي المحصل: {totalPaidAmount.toFixed(2)} ج.م
              </div>
            </div>

            {/* Paid Cards List */}
            {displayPaidInvoices.length === 0 ? (
              <div className="bg-card border border-border/60 rounded-2xl p-8 text-center text-muted-foreground text-xs font-bold">
                {isLoadingServerInvoices ? 'جاري تحميل الفواتير...' : 'لا توجد فواتير مدفوعة بالكامل حالياً.'}
              </div>
            ) : (
              <div className="space-y-3.5">
                {displayPaidInvoices.map((inv) => {
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
                        
                        {/* Super Admin: تعديل الفاتورة والمرتجعات */}
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEditModal(inv)}
                            disabled={openingInvoiceId === inv.id}
                            className="h-8 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-500 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
                            title="تعديل الفاتورة وإرجاع المنتجات"
                          >
                            {openingInvoiceId === inv.id ? (
                              <>
                                <RotateCcw className="animate-spin" size={13} />
                                <span>جاري الفتح...</span>
                              </>
                            ) : (
                              <>
                                <Pencil size={13} />
                                <span>تعديل</span>
                              </>
                            )}
                          </button>
                        )}

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

                {/* Pagination Controls for Paid Invoices */}
                <InvoicePagination
                  currentPage={safePaidPage}
                  totalPages={displayTotalPagesPaid}
                  totalItems={displayPaidCount}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={(p) => setPaidPage(p)}
                  accentColor="emerald"
                />
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* COLUMN 2: UNPAID / DEFERRED INVOICES SECTION (Now Second / Left Side) */}
        {/* ========================================================= */}
        {(activeTab === 'all' || activeTab === 'unpaid' || activeTab === 'partial' || activeTab === 'favorites') && (
          <div className="space-y-4">
            
            {/* Column Banner Header */}
            <div className={`border p-4 rounded-2xl flex items-center justify-between shadow-lg ${
              activeTab === 'partial'
                ? 'bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-amber-950/80 border-amber-800/40 text-amber-200'
                : 'bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-rose-950/80 border-rose-800/40 text-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className={activeTab === 'partial' ? 'text-amber-400' : 'text-rose-400'} />
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span>
                    {activeTab === 'partial'
                      ? `فواتير الدفع الجزئي (${displayUnpaidCount})`
                      : activeTab === 'unpaid'
                      ? `الفواتير غير المدفوعة (${displayUnpaidCount})`
                      : `الفواتير غير المدفوعة والآجلة والدفع الجزئي (${displayUnpaidCount})`
                    }
                  </span>
                  {isLoadingServerInvoices && <span className="inline-block w-2 h-2 rounded-full bg-rose-400 animate-ping ml-1" title="جاري التحديث..." />}
                </h2>
              </div>
              <div className={`text-xs font-bold font-mono border px-3 py-1 rounded-xl ${
                activeTab === 'partial'
                  ? 'text-amber-300 bg-amber-900/40 border-amber-700/40'
                  : 'text-rose-300 bg-rose-900/40 border-rose-700/40'
              }`}>
                إجمالي المستحقات: {totalUnpaidAmount.toFixed(2)} ج.م
              </div>
            </div>

            {/* Unpaid Cards List */}
            {displayUnpaidInvoices.length === 0 ? (
              <div className="bg-card border border-border/60 rounded-2xl p-8 text-center text-muted-foreground text-xs font-bold">
                {isLoadingServerInvoices ? 'جاري تحميل الفواتير...' : (
                  activeTab === 'partial'
                    ? 'لا توجد فواتير ذات دفع جزئي حالياً.'
                    : 'لا توجد فواتير غير مدفوعة أو آجلة حالياً.'
                )}
              </div>
            ) : (
              <div className="space-y-3.5">
                {displayUnpaidInvoices.map((inv) => {
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
                        
                        {/* Right: Date Badge & Status Pill */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                            paid > 0 && remaining > 0
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                          }`}>
                            <Clock size={12} />
                            <span>{paid > 0 && remaining > 0 ? 'دفع جزئي' : 'آجل / غير مدفوع'}</span>
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
                      <div className={`pt-2 border-t border-border/40 grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                        
                        {/* Button 1: تسديد المتبقي (Solid Emerald Button - Admin Only) */}
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenSinglePayModal(inv)}
                            className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/20 transition-all"
                          >
                            <DollarSign size={15} />
                            <span>تسديد المتبقي</span>
                          </button>
                        )}

                        {/* Super Admin: تعديل الفاتورة والمرتجعات */}
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEditModal(inv)}
                            disabled={openingInvoiceId === inv.id}
                            className="h-9 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-500 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
                            title="تعديل الفاتورة وإرجاع المنتجات"
                          >
                            {openingInvoiceId === inv.id ? (
                              <>
                                <RotateCcw className="animate-spin" size={14} />
                                <span>جاري الفتح...</span>
                              </>
                            ) : (
                              <>
                                <Pencil size={14} />
                                <span>تعديل</span>
                              </>
                            )}
                          </button>
                        )}

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

                {/* Pagination Controls for Unpaid Invoices */}
                <InvoicePagination
                  currentPage={safeUnpaidPage}
                  totalPages={displayTotalPagesUnpaid}
                  totalItems={displayUnpaidCount}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={(p) => setUnpaidPage(p)}
                  accentColor={activeTab === 'partial' ? 'amber' : 'rose'}
                />
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

            {/* Loading / Error States for Authoritative Statement */}
            {isLoadingStatement && (
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-center text-xs font-bold text-muted-foreground animate-pulse">
                جارٍ تحميل كشف الحساب والديون التاريخية من السيرفر...
              </div>
            )}
            {statementError && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-center text-xs font-bold text-rose-400">
                ⚠️ {statementError}
              </div>
            )}

            {/* Top Action Buttons inside Modal */}
            <div className="space-y-2.5">
              
              {/* WhatsApp Reminder Button */}
              {statementCustomerPhone && statementTotalDebt > 0 && (
                <button
                  disabled={isLoadingStatement || !!statementError}
                  onClick={() => handleSendWhatsAppStatementReminder(statementCustomerName, statementCustomerPhone, statementUnpaidInvoices, statementTotalDebt)}
                  className={`w-full h-11 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isLoadingStatement || !!statementError
                      ? 'bg-muted cursor-not-allowed text-muted-foreground opacity-60'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                  }`}
                >
                  <Send size={16} />
                  <span>{isLoadingStatement ? 'جارٍ التحقق من كشف الحساب...' : 'إرسال إشعار تذكير بكشف الحساب والديون عبر الواتساب'}</span>
                </button>
              )}

              {/* Pay Debt Button (Admin Only) */}
              {isAdmin && statementTotalDebt > 0 && (
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
                (statementModalTab === 'unpaid' ? statementUnpaidInvoices : statementPaidInvoices).map((inv: Invoice) => {
                  const rem = getInvoiceRemaining(inv);
                  const itemsSummary = (inv.items || []).map((i: any) => {
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
        <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] flex flex-col bg-card border-border overflow-hidden p-0 rounded-3xl shadow-2xl" dir="rtl" showCloseButton={false}>
          
          <div className="bg-card border-b border-border/80 p-4 flex items-center justify-between shrink-0 select-none print:hidden" dir="rtl">
            <button 
              onClick={() => setSelectedInvoice(null)} 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60 shrink-0"
              title="إغلاق"
            >
              <X size={18} />
            </button>

            <DialogTitle className="font-serif text-base font-bold text-foreground text-center flex-1 mx-2">
              تفاصيل فاتورة المبيعات
            </DialogTitle>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <Button 
                  onClick={() => {
                    if (selectedInvoice) {
                      handleOpenEditModal(selectedInvoice);
                      setSelectedInvoice(null);
                    }
                  }}
                  className="rounded-xl font-bold text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black shadow-xs"
                >
                  <Pencil size={14} />
                  <span>تعديل</span>
                </Button>
              )}
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
            <div className="p-4 sm:p-6 bg-white text-black w-full text-right font-sans text-xs flex-1 overflow-y-auto overscroll-contain" dir="rtl">
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
                      selectedInvoice.items.forEach((item, idx) => {
                        const prod = store.getProduct(item.productId);
                        const name = item.productName || prod?.nameAr || prod?.nameEn || 'منتج إكسسوارات';
                        const key = `${item.productId || 'p'}_${name}_${item.unitPrice}`;
                        const existing = itemMap.get(key);
                        if (existing) {
                          existing.count += item.quantity || 1;
                          existing.totalPrice += item.unitPrice * (item.quantity || 1);
                        } else {
                          itemMap.set(key, { name, count: item.quantity || 1, unitPrice: item.unitPrice, totalPrice: item.unitPrice * (item.quantity || 1) });
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

                          {Number(selectedInvoice.discount || 0) > 0 && (
                            <>
                              <tr className="text-gray-700 bg-gray-50 border-t border-gray-300">
                                <td colSpan={3} className="py-1.5 px-2 text-right font-medium text-[11px]">المجموع قبل الخصم</td>
                                <td className="py-1.5 px-1 text-left font-mono font-bold">{(selectedInvoice.total + Number(selectedInvoice.discount)).toFixed(2)}</td>
                              </tr>
                              <tr className="text-rose-600 bg-rose-50/50">
                                <td colSpan={3} className="py-1.5 px-2 text-right font-medium text-[11px]">الخصم</td>
                                <td className="py-1.5 px-1 text-left font-mono font-bold">-{Number(selectedInvoice.discount).toFixed(2)}</td>
                              </tr>
                            </>
                          )}

                          <tr className="font-bold text-gray-900 bg-gray-100 border-t-2 border-gray-400">
                            <td className="py-2 px-2 border-l border-gray-300 text-right text-sm">
                              {Number(selectedInvoice.discount || 0) > 0 ? 'الإجمالي بعد الخصم' : 'المجموع الإجمالي'}
                            </td>
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

              {/* Payment Method & Split Details */}
              <div className="text-[11px] py-2 border-b border-dashed border-gray-300 text-gray-800 space-y-1">
                {selectedInvoice.paidAmount !== undefined && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>المدفوع:</span>
                    <span className="font-mono">{selectedInvoice.paidAmount.toFixed(2)} ج.م</span>
                  </div>
                )}

                {selectedInvoice.splitPayments && (selectedInvoice.paymentSubMethod === 'multi' || selectedInvoice.paymentMethod === 'multi') ? (
                  <div className="space-y-0.5 pt-1 border-t border-gray-100">
                    <div className="flex justify-between font-bold text-gray-900">
                      <span>طريقة السداد:</span>
                      <span>دفع مقسّم (متعدد)</span>
                    </div>
                    {Number(selectedInvoice.splitPayments.cash || 0) > 0 && (
                      <div className="flex justify-between text-gray-700 pr-2">
                        <span>• نقداً (كاش):</span>
                        <span className="font-mono font-bold">{Number(selectedInvoice.splitPayments.cash).toFixed(2)} ج.م</span>
                      </div>
                    )}
                    {Number(selectedInvoice.splitPayments.vodafone_cash || 0) > 0 && (
                      <div className="flex justify-between text-gray-700 pr-2">
                        <span>• فودافون كاش:</span>
                        <span className="font-mono font-bold">{Number(selectedInvoice.splitPayments.vodafone_cash).toFixed(2)} ج.م</span>
                      </div>
                    )}
                    {Number(selectedInvoice.splitPayments.instapay || 0) > 0 && (
                      <div className="flex justify-between text-gray-700 pr-2">
                        <span>• إنستاباي:</span>
                        <span className="font-mono font-bold">{Number(selectedInvoice.splitPayments.instapay).toFixed(2)} ج.م</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between pt-1 border-t border-gray-100">
                    <span className="text-gray-600">طريقة السداد:</span>
                    <span className="font-bold text-gray-900">
                      {selectedInvoice.paymentStatus === 'deferred' && (selectedInvoice.paidAmount === 0 || !selectedInvoice.paidAmount)
                        ? 'آجل بالكامل (لم يدفع)'
                        : selectedInvoice.paymentSubMethod === 'vodafone_cash' 
                        ? 'فودافون كاش' 
                        : selectedInvoice.paymentSubMethod === 'instapay' 
                        ? 'إنستاباي' 
                        : 'نقداً (في اليد)'}
                    </span>
                  </div>
                )}

                {selectedInvoice.remainingAmount !== undefined && selectedInvoice.remainingAmount > 0 && (
                  <div className="flex justify-between font-bold text-red-600 pt-1 border-t border-gray-200">
                    <span>المتبقي (آجل):</span>
                    <span className="font-mono">{selectedInvoice.remainingAmount.toFixed(2)} ج.م</span>
                  </div>
                )}
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

      {/* ========================================================= */}
      {/* MODAL: WHATSAPP RECIPIENT SELECTION (Customer vs Bola vs Mina) */}
      {/* ========================================================= */}
      <Dialog open={!!whatsAppModalInvoice} onOpenChange={(open) => !open && setWhatsAppModalInvoice(null)}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full bg-card border-border/80 p-0 rounded-3xl overflow-hidden shadow-2xl" dir="rtl" showCloseButton={false}>
          
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border-b border-emerald-800/40 p-4 sm:p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <Send size={20} />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-white">إرسال الفاتورة عبر الواتساب</DialogTitle>
                {whatsAppModalInvoice && (
                  <p className="text-xs text-emerald-300 font-mono mt-0.5">
                    فاتورة #{whatsAppModalInvoice.invoiceNumber} — {whatsAppModalInvoice.total.toFixed(2)} ج.م
                  </p>
                )}
              </div>
            </div>

            <button 
              onClick={() => setWhatsAppModalInvoice(null)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-emerald-200/70 hover:text-white hover:bg-emerald-900/40 transition-colors border border-emerald-700/40 shrink-0"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>

          {whatsAppModalInvoice && (
            <div className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">
                  اختر وجهة الإرسال (المستلم):
                </label>
                <p className="text-[11px] text-muted-foreground">
                  اختر إرسال الفاتورة للعميل صاحب الفاتورة أو إشعار أحد مديري السوبر أدمن (بولا أو مينا).
                </p>
              </div>

              {/* 3 Recipient Selection Cards */}
              <div className="space-y-2.5">
                
                {/* 1. Customer Card */}
                <div 
                  onClick={() => handleSelectRecipientType('customer')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    recipientType === 'customer'
                      ? 'bg-emerald-500/15 border-emerald-500 text-foreground ring-2 ring-emerald-500/30 shadow-xs'
                      : 'bg-card border-border/80 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      recipientType === 'customer' ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      <User size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>العميل صاحب الفاتورة</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                          {whatsAppModalInvoice.customerName || 'عميل الفرع'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                        {whatsAppModalInvoice.customerPhone ? whatsAppModalInvoice.customerPhone : 'لا يوجد رقم مسجل بالفاتورة'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    recipientType === 'customer' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border'
                  }`}>
                    {recipientType === 'customer' && <CheckCircle2 size={14} />}
                  </div>
                </div>

                {/* 2. Bola (Super Admin) Card */}
                <div 
                  onClick={() => handleSelectRecipientType('bola')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    recipientType === 'bola'
                      ? 'bg-amber-500/15 border-amber-500 text-foreground ring-2 ring-amber-500/30 shadow-xs'
                      : 'bg-card border-border/80 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      recipientType === 'bola' ? 'bg-amber-500 text-black' : 'bg-muted text-muted-foreground'
                    }`}>
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>سوبر أدمن: بولا (Bola)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono">
                          إشعار الإدارة
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                        الرقم المعتمد: {getAdminPhone('bola')}
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    recipientType === 'bola' ? 'border-amber-500 bg-amber-500 text-black' : 'border-border'
                  }`}>
                    {recipientType === 'bola' && <CheckCircle2 size={14} />}
                  </div>
                </div>

                {/* 3. Mina (Super Admin) Card */}
                <div 
                  onClick={() => handleSelectRecipientType('mina')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    recipientType === 'mina'
                      ? 'bg-amber-500/15 border-amber-500 text-foreground ring-2 ring-amber-500/30 shadow-xs'
                      : 'bg-card border-border/80 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      recipientType === 'mina' ? 'bg-amber-500 text-black' : 'bg-muted text-muted-foreground'
                    }`}>
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>سوبر أدمن: مينا (Mina)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono">
                          إشعار الإدارة
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                        الرقم المعتمد: {getAdminPhone('mina')}
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    recipientType === 'mina' ? 'border-amber-500 bg-amber-500 text-black' : 'border-border'
                  }`}>
                    {recipientType === 'mina' && <CheckCircle2 size={14} />}
                  </div>
                </div>

              </div>

              {/* Phone Input Field (Auto populated, editable) */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>رقم الهاتف الموجه إليه رسالة الواتساب:</span>
                  <span className="text-[10px] text-muted-foreground font-normal">يمكنك تعديل الرقم قبل الإرسال</span>
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    type="tel"
                    value={recipientPhoneInput}
                    onChange={(e) => setRecipientPhoneInput(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="pr-10 h-11 text-xs font-mono font-bold rounded-xl bg-background border-border"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Send and Cancel Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setWhatsAppModalInvoice(null)}
                  className="rounded-xl text-xs font-bold h-11 px-5"
                >
                  إلغاء
                </Button>
                
                <Button 
                  type="button" 
                  onClick={handleConfirmSendWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs h-11 px-6 rounded-xl gap-2 shadow-lg shadow-emerald-950/40"
                >
                  <Send size={15} />
                  <span>إرسال عبر الواتساب الآن</span>
                </Button>
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

      {/* SUPER ADMIN EDIT INVOICE & RETURNS MODAL */}
      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && !isSubmittingEdit && setEditingInvoice(null)}>
        <DialogContent showCloseButton={false} className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col bg-card border-border overflow-hidden p-0 rounded-3xl shadow-2xl" dir="rtl">
          
          {/* Modal Header */}
          <DialogHeader className="p-5 border-b border-border/80 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Pencil size={20} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>تعديل بيانات الفاتورة وإدارة المرتجعات</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                      سوبر أدمن
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    فاتورة رقم #{editingInvoice?.invoiceNumber} • تاريخ: {editingInvoice ? new Date(editingInvoice.date).toLocaleDateString('ar-EG') : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60"
              >
                <X size={16} />
              </button>
            </div>
          </DialogHeader>

          {/* Modal Scrollable Body */}
          {editingInvoice && (
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">

              {/* 1. Customer & Payment Details */}
              <div className="bg-muted/20 p-4 rounded-2xl border border-border/60 space-y-4">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <User size={16} className="text-amber-500" />
                  <span>بيانات العميل والدفع</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Name */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block">اسم العميل</label>
                    <Input
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      placeholder="اسم العميل"
                      className="h-10 text-xs font-bold rounded-xl bg-background"
                    />
                  </div>

                  {/* Customer Phone */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block">رقم هاتف العميل</label>
                    <Input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="h-10 text-xs font-mono font-bold rounded-xl bg-background"
                      dir="ltr"
                    />
                  </div>

                  {/* Payment Status (3 Options: Paid in full / Partial / Deferred) */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block">حالة السداد</label>
                    <CustomSelect
                      value={editPaymentStatus}
                      onChange={(val) => {
                        const sVal = val as 'paid' | 'partial' | 'deferred';
                        setEditPaymentStatus(sVal);
                        if (sVal === 'paid') {
                          setEditPaidAmount(editTotal);
                          if (editPaymentMethod === 'cash') setEditSplitCash(editTotal);
                          else if (editPaymentMethod === 'vodafone_cash') setEditSplitVodafone(editTotal);
                          else if (editPaymentMethod === 'instapay') setEditSplitInstapay(editTotal);
                        } else if (sVal === 'deferred') {
                          setEditPaidAmount(0);
                          setEditSplitCash(0);
                          setEditSplitVodafone(0);
                          setEditSplitInstapay(0);
                        } else {
                          if (editPaidAmount === editTotal || editPaidAmount === 0) {
                            setEditPaidAmount(Math.round(editTotal / 2));
                          }
                        }
                      }}
                      options={paymentStatusOptions}
                    />
                  </div>

                  {/* Discount */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block">الخصم الممنوح (ج.م)</label>
                    <Input
                      type="number"
                      min={0}
                      value={editDiscount}
                      onChange={(e) => handleEditDiscountChange(parseFloat(e.target.value) || 0)}
                      className="h-10 text-xs font-mono font-bold rounded-xl bg-background"
                    />
                  </div>

                  {/* Status Indicator & Partial Inputs */}
                  <div className="sm:col-span-2">
                    {editPaymentStatus === 'paid' && (
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-between">
                        <span>حالة السداد: مدفوع بالكامل نقداً / إلكترونياً</span>
                        <span className="font-mono text-sm">{editTotal.toFixed(2)} ج.م</span>
                      </div>
                    )}

                    {editPaymentStatus === 'deferred' && (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center justify-between">
                        <span>حالة السداد: آجل بالكامل (المبلغ المدفوع: 0.00 ج.م)</span>
                        <span className="font-mono text-sm">كامل الفاتورة دين آجل على العميل: {editTotal.toFixed(2)} ج.م</span>
                      </div>
                    )}

                    {editPaymentStatus === 'partial' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="font-bold text-foreground block">المبلغ المدفوع حالياً (ج.م)</label>
                          <Input
                            type="number"
                            min={0}
                            max={editTotal}
                            value={editPaidAmount}
                            onChange={(e) => {
                              const pAmt = Math.max(0, parseFloat(e.target.value) || 0);
                              setEditPaidAmount(pAmt);
                              if (editPaymentMethod === 'cash') setEditSplitCash(pAmt);
                              else if (editPaymentMethod === 'vodafone_cash') setEditSplitVodafone(pAmt);
                              else if (editPaymentMethod === 'instapay') setEditSplitInstapay(pAmt);
                            }}
                            className="h-10 text-xs font-mono font-bold rounded-xl bg-background"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-rose-400 block">المبلغ المتبقي (آجل على العميل) (ج.م)</label>
                          <div className="h-10 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono font-bold flex items-center">
                            {Math.max(0, editTotal - editPaidAmount).toFixed(2)} ج.م
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Method Section - Distinctive POS Buttons + Custom Theme Select */}
                  <div className="space-y-3 sm:col-span-2 pt-2 border-t border-border/50">
                    {/* Registered / Original Payment Info */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-2xl bg-background/80 border border-border/80 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-bold">طريقة الدفع المسجلة بالفاتورة:</span>
                        {originalPaymentInfo && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${originalPaymentInfo.color}`}>
                            {originalPaymentInfo.icon}
                            <span>{originalPaymentInfo.name}</span>
                          </span>
                        )}
                      </div>
                      {originalPaymentInfo?.details && (
                        <span className="text-[11px] font-mono font-bold text-foreground bg-muted/60 px-2.5 py-1 rounded-xl border border-border/60">
                          {originalPaymentInfo.details}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-foreground block text-xs">
                          اختر طريقة الدفع المعدلة (نفس تصميم نقطة البيع):
                        </label>
                        <span className="text-[11px] text-amber-500 font-bold">
                          المحدد الآن: {paymentMethodOptions.find(o => o.value === editPaymentMethod)?.label || 'نقداً'}
                        </span>
                      </div>

                      {/* 3 Prominent POS Buttons + Multi */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Cash */}
                        <button
                          type="button"
                          onClick={() => setEditPaymentMethod('cash')}
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                            editPaymentMethod === 'cash'
                              ? 'bg-amber-500/20 text-amber-500 border-amber-500 shadow-xs ring-1 ring-amber-500/40'
                              : 'bg-background text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          <svg className="w-4 h-4 fill-none stroke-current shrink-0" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="6" width="20" height="12" rx="2" />
                            <circle cx="12" cy="12" r="3" />
                            <path d="M6 12h.01M18 12h.01" />
                          </svg>
                          <span>نقداً (كاش)</span>
                        </button>

                        {/* Vodafone Cash */}
                        <button
                          type="button"
                          onClick={() => setEditPaymentMethod('vodafone_cash')}
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                            editPaymentMethod === 'vodafone_cash'
                              ? 'bg-red-500/20 text-red-500 border-red-500 shadow-xs ring-1 ring-red-500/40'
                              : 'bg-background text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          <img src={vodafoneLogo} alt="فودافون كاش" className="w-5 h-5 object-contain shrink-0 rounded-full" />
                          <span>فودافون كاش</span>
                        </button>

                        {/* InstaPay */}
                        <button
                          type="button"
                          onClick={() => setEditPaymentMethod('instapay')}
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                            editPaymentMethod === 'instapay'
                              ? 'bg-purple-500/20 text-purple-500 border-purple-500 shadow-xs ring-1 ring-purple-500/40'
                              : 'bg-background text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          <img src={instapayLogo} alt="إنستاباي" className="w-5 h-5 object-contain shrink-0 rounded-md" />
                          <span>إنستاباي (InstaPay)</span>
                        </button>

                        {/* Split / Multi Payment */}
                        <button
                          type="button"
                          onClick={() => setEditPaymentMethod('multi')}
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                            editPaymentMethod === 'multi'
                              ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-sm ring-1 ring-amber-400'
                              : 'bg-background text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          <Coins size={15} className="shrink-0" />
                          <span>دفع مقسّم (متعدد)</span>
                        </button>
                      </div>

                      {/* Vodafone Cash Wallet Selector for Single Payment */}
                      {editPaymentMethod === 'vodafone_cash' && (
                        <div className="space-y-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 animate-in fade-in-50">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                              <img src={vodafoneLogo} alt="Vodafone" className="w-4 h-4 object-contain rounded-full" />
                              <span>اختر رقم محفظة فودافون كاش المراد التحويل عليها:</span>
                            </label>
                            <span className="text-[10px] text-muted-foreground font-semibold">3 أرقام متاحة</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {VODAFONE_CASH_NUMBERS.map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setEditVodafoneNumber(num)}
                                className={`py-2 px-3 rounded-xl text-xs font-mono font-bold transition-all border flex items-center justify-between ${
                                  editVodafoneNumber === num
                                    ? 'bg-rose-500 text-white border-rose-500 shadow-sm ring-1 ring-rose-400'
                                    : 'bg-background/90 text-foreground border-border/80 hover:bg-muted'
                                }`}
                              >
                                <span dir="ltr">{num}</span>
                                {editVodafoneNumber === num ? (
                                  <span className="w-4 h-4 rounded-full bg-white text-rose-600 flex items-center justify-center text-[10px] font-extrabold">✓</span>
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Split Breakdown when multi */}
                    {editPaymentMethod === 'multi' && (
                      <div className="space-y-3 pt-2.5 border-t border-border/50 animate-in fade-in-50">
                        <div className="text-[11px] text-muted-foreground">
                          أدخل مبالغ التوزيع بين وسائل الدفع:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Cash Split */}
                          <div className="p-2.5 rounded-xl border border-border bg-card space-y-1.5">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1">
                              <Coins size={14} className="text-amber-500" />
                              <span>نقداً (كاش)</span>
                            </span>
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={editSplitCash}
                                onChange={(e) => setEditSplitCash(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="h-8 text-xs font-mono font-bold text-left pl-8 rounded-lg bg-background"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">ج.م</span>
                            </div>
                          </div>

                          {/* Vodafone Cash Split */}
                          <div className="p-2.5 rounded-xl border border-border bg-card space-y-1.5">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1">
                              <img src={vodafoneLogo} alt="فودافون" className="w-3.5 h-3.5 object-contain rounded-full" />
                              <span>فودافون كاش</span>
                            </span>
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={editSplitVodafone}
                                onChange={(e) => setEditSplitVodafone(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="h-8 text-xs font-mono font-bold text-left pl-8 rounded-lg bg-background"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">ج.م</span>
                            </div>
                            {/* Wallet Selection in Split */}
                            <div className="pt-2 border-t border-border/40 space-y-1">
                              <span className="text-[10px] font-bold text-rose-500/90 block">
                                محفظة التحويل:
                              </span>
                              <div className="grid grid-cols-3 gap-1">
                                {VODAFONE_CASH_NUMBERS.map((num) => (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => setEditVodafoneNumber(num)}
                                    className={`py-1 px-1 rounded-lg text-[9px] font-mono font-bold transition-all border text-center truncate ${
                                      editVodafoneNumber === num
                                        ? 'bg-rose-500 text-white border-rose-500 font-extrabold shadow-2xs'
                                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                                    }`}
                                    title={num}
                                  >
                                    {num.slice(-4)}..
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* InstaPay Split */}
                          <div className="p-2.5 rounded-xl border border-border bg-card space-y-1.5">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1">
                              <img src={instapayLogo} alt="إنستاباي" className="w-3.5 h-3.5 object-contain rounded-md" />
                              <span>إنستاباي</span>
                            </span>
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={editSplitInstapay}
                                onChange={(e) => setEditSplitInstapay(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="h-8 text-xs font-mono font-bold text-left pl-8 rounded-lg bg-background"
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">ج.م</span>
                            </div>
                          </div>
                        </div>

                        {/* Split Total Indicator */}
                        <div className="p-2 rounded-xl bg-background/80 border border-border/80 text-xs flex items-center justify-between">
                          <span className="text-muted-foreground">مجموع المبالغ الموزعة:</span>
                          <span className={`font-mono font-bold ${(editSplitCash + editSplitVodafone + editSplitInstapay) === editTotal ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {(editSplitCash + editSplitVodafone + editSplitInstapay).toFixed(2)} ج.م
                            {editTotal > 0 && ` (من أصل ${editTotal.toFixed(2)} ج.م)`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Items List & Returns Management */}
              <div className="bg-muted/20 p-4 rounded-2xl border border-border/60 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                  <div>
                    <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                      <PackageCheck size={16} className="text-amber-500" />
                      <span>منتجات الفاتورة الحالية ({editItems.length} صنف)</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      لحذف منتج قام العميل بإرجاعه، اضغط على زر الحذف، أو استخدم أزرار (+) و (-) لتعديل الكمية.
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-muted/60 text-muted-foreground text-[11px] font-bold border-b border-border/80">
                          <th className="p-2.5">المنتج</th>
                          <th className="p-2.5 text-center">السعر</th>
                          <th className="p-2.5 text-center">الكمية المباعة</th>
                          <th className="p-2.5 text-center">الإجمالي</th>
                          <th className="p-2.5 text-center">إرجاع / حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {editItems.map((item, idx) => {
                          const isReduced = (item.quantity || 1) < item.originalQuantity;
                          const lineTotal = item.unitPrice * (item.quantity || 1);

                          return (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="p-2.5">
                                <div className="font-bold text-foreground">{item.productName}</div>
                                {isReduced && (
                                  <span className="text-[10px] text-amber-500 font-bold block mt-0.5">
                                    ↩️ سيتم إرجاع {item.originalQuantity - item.quantity} قطعة للمخزن
                                  </span>
                                )}
                              </td>

                              <td className="p-2.5 text-center">
                                <span className="inline-block px-3 py-1 rounded-xl bg-muted/60 border border-border/80 text-xs font-mono font-bold text-foreground">
                                  {item.unitPrice.toFixed(2)} ج.م
                                </span>
                              </td>

                              <td className="p-2.5 text-center">
                                <div className="inline-flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border/60">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateEditItemQuantity(idx, -1)}
                                    disabled={item.quantity <= 1}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-card text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                                    title="تقليل الكمية وإرجاع قطعة للمخزن"
                                  >
                                    <Minus size={13} />
                                  </button>
                                  <span className="font-mono font-bold text-xs w-7 text-center text-foreground">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateEditItemQuantity(idx, 1)}
                                    disabled={item.quantity >= item.originalQuantity}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-card text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                                    title={item.quantity >= item.originalQuantity ? "لا يمكن زيادة الكمية عن الكمية الأصلية بالفاتورة" : "زيادة الكمية"}
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              </td>

                              <td className="p-2.5 text-center font-mono font-bold text-amber-500">
                                {lineTotal.toFixed(2)} ج.م
                              </td>

                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditItem(idx)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                                  title="إرجاع المنتج بالكامل للمخزن وحذفه من الفاتورة"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Returned Items Box notification */}
                {returnedItemsSummary.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1 text-[11px] text-amber-300">
                    <div className="font-bold flex items-center gap-1.5 text-amber-400">
                      <RotateCcw size={14} />
                      <span>إشعار المرتجعات التلقائي للمخزون:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pr-2">
                      {returnedItemsSummary.map((r, i) => (
                        <li key={i} className="text-foreground">
                          <strong>{r.productName}</strong>: سيتم إعادة <strong>{r.returnCount} قطعة</strong> تلقائياً إلى مخزن الفرع.
                        </li>
                      ))}
                    </ul>
                    {profitDeduction > 0 && (
                      <div className="pt-1 text-emerald-400 font-bold border-t border-amber-500/20">
                        • تم خصم نسبة ربح المرتجع بقيمة: <strong>-{profitDeduction.toFixed(2)} ج.م</strong> تلقائياً من إجمالي أرباح الفاتورة.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Live Financial Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card p-4 rounded-2xl border border-border/80">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">المجموع الفرعي</span>
                  <div className="text-sm font-mono font-bold text-foreground">{editSubtotal.toFixed(2)} ج.م</div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">الخصم</span>
                  <div className="text-sm font-mono font-bold text-rose-400">-{editDiscount.toFixed(2)} ج.م</div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">إجمالي الفاتورة الجديد</span>
                  <div className="text-base font-mono font-extrabold text-amber-500">{editTotal.toFixed(2)} ج.م</div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">صافي الربح الجديد</span>
                  <div className="text-sm font-mono font-bold text-emerald-400">{editNetProfit.toFixed(2)} ج.م</div>
                </div>
              </div>

            </div>
          )}

          {/* Modal Footer */}
          <DialogFooter className="p-4 border-t border-border/80 bg-muted/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingEdit}
              onClick={() => setEditingInvoice(null)}
              className="rounded-xl text-xs font-bold h-11 px-4"
            >
              إلغاء
            </Button>

            <Button
              type="button"
              disabled={isSubmittingEdit}
              onClick={() => handleSaveInvoiceEdit(false)}
              className="bg-muted hover:bg-muted/80 text-foreground border border-border font-bold text-xs h-11 px-5 rounded-xl gap-2 transition-all shadow-2xs"
            >
              <Save size={16} />
              <span>حفظ التعديل</span>
            </Button>

            <Button
              type="button"
              disabled={isSubmittingEdit}
              onClick={() => handleSaveInvoiceEdit(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-11 px-5 rounded-xl gap-2 shadow-md shadow-emerald-950/20"
            >
              {isSubmittingEdit ? (
                <>
                  <RotateCcw className="animate-spin" size={16} />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>حفظ وإرسال الفاتورة عبر الواتساب</span>
                </>
              )}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  );
};
