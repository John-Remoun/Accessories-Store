import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { store } from '../../services/store';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreSync } from '../../hooks/useStoreSync';
import { SupplierPurchase, SupplierPaymentRecord } from '../../types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { 
  ArrowRight, Truck, Plus, Search, DollarSign, CheckCircle2, Clock, 
  AlertCircle, Calendar, Edit3, Trash2, History, CreditCard, 
  ArrowDownLeft, Phone, FileText, Check, AlertTriangle, Printer,
  Building2, Layers, Users
} from 'lucide-react';

const getLocalNowIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toLocalDatetimeString = (dateStr?: string) => {
  if (!dateStr) return getLocalNowIso();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return getLocalNowIso();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const Suppliers = () => {
  useStoreSync();
  const { user } = useAuth();

  // Super Admin security check
  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-rose-500 font-bold bg-card border border-border rounded-2xl m-6" dir="rtl">
        غير مصرح لك بالوصول لصفحة الموردين (متاحة للسوبر أدمن فقط).
      </div>
    );
  }

  const location = useLocation();
  const navigate = useNavigate();

  const branches = store.getBranches();

  // Branch parameter from URL query (?id=b4 or ?view=all)
  const queryParams = new URLSearchParams(location.search);
  const branchParam = queryParams.get('id');
  const viewParam = queryParams.get('view');

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (viewParam === 'all') return 'all';
    return branchParam || localStorage.getItem('last_active_branch') || 'all';
  });

  useEffect(() => {
    if (viewParam === 'all') {
      setSelectedBranchId('all');
    } else if (branchParam) {
      setSelectedBranchId(branchParam);
    }
  }, [branchParam, viewParam]);

  const handleSelectBranch = (bId: string) => {
    setSelectedBranchId(bId);
    if (bId === 'all') {
      navigate('/suppliers?view=all');
    } else {
      navigate(`/suppliers?id=${bId}`);
    }
  };

  const activeBranchObj = selectedBranchId !== 'all' ? store.getBranch(selectedBranchId) : null;

  // State
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  
  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<SupplierPurchase | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<SupplierPurchase | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedPurchaseForDetails, setSelectedPurchaseForDetails] = useState<SupplierPurchase | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Supplier Statement / Profile State
  const [statementSupplier, setStatementSupplier] = useState<{ name: string; phone?: string } | null>(null);
  const [isSupplierSelectModalOpen, setIsSupplierSelectModalOpen] = useState(false);
  const [supplierSelectSearch, setSupplierSelectSearch] = useState('');

  // Form State for Add / Edit
  const [formData, setFormData] = useState<{
    supplierName: string;
    supplierPhone: string;
    invoiceNumber: string;
    itemsDescription: string;
    branchId: string;
    totalAmount: string;
    paidAmount: string;
    paymentMode: 'paid' | 'partial' | 'unpaid';
    purchaseDateTime: string;
    notes: string;
  }>({
    supplierName: '',
    supplierPhone: '',
    invoiceNumber: '',
    itemsDescription: '',
    branchId: selectedBranchId !== 'all' ? selectedBranchId : (branches[0]?.id || 'b4'),
    totalAmount: '',
    paidAmount: '',
    paymentMode: 'unpaid',
    purchaseDateTime: getLocalNowIso(),
    notes: '',
  });

  // Payment installment form state
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentDateTime, setPaymentDateTime] = useState<string>(getLocalNowIso());

  // Get raw purchases list
  const purchases = store.getSupplierPurchases();

  // Filtered purchases by Branch, Status, and Search
  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      // Branch filter
      if (selectedBranchId !== 'all') {
        const itemBranch = item.branchId || 'b4';
        if (itemBranch !== selectedBranchId) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && item.paymentStatus !== statusFilter) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const branchObj = store.getBranch(item.branchId || 'b4');
        const matchBranch = (branchObj?.nameAr || '').toLowerCase().includes(query);
        const matchName = (item.supplierName || '').toLowerCase().includes(query);
        const matchPhone = (item.supplierPhone || '').toLowerCase().includes(query);
        const matchInvoice = (item.invoiceNumber || '').toLowerCase().includes(query);
        const matchDesc = (item.itemsDescription || '').toLowerCase().includes(query);
        const matchNotes = (item.notes || '').toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchInvoice && !matchDesc && !matchNotes && !matchBranch) {
          return false;
        }
      }

      return true;
    });
  }, [purchases, selectedBranchId, statusFilter, search]);

  // Statistics calculated dynamically for the active branch (or all branches)
  const stats = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    const uniqueSuppliers = new Set<string>();

    filteredPurchases.forEach((p) => {
      totalPurchases += Number(p.totalAmount || 0);
      totalPaid += Number(p.paidAmount || 0);
      totalRemaining += Number(p.remainingAmount || 0);
      if (p.supplierName) {
        uniqueSuppliers.add(p.supplierName.trim().toLowerCase());
      }
    });

    return {
      totalPurchases: Number(totalPurchases.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      totalRemaining: Number(totalRemaining.toFixed(2)),
      suppliersCount: uniqueSuppliers.size,
      billsCount: filteredPurchases.length,
    };
  }, [filteredPurchases]);

  // Format Date in Arabic with Day Name, Date, and Time
  const formatArabicDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { dayName: '', datePart: dateStr, timePart: '' };

      const dayName = d.toLocaleDateString('ar-EG', { weekday: 'long' });
      const datePart = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
      const timePart = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

      return { dayName, datePart, timePart };
    } catch {
      return { dayName: '', datePart: dateStr, timePart: '' };
    }
  };

  // Existing Unique Suppliers for Auto-fill and Statement Matching
  const existingSuppliers = useMemo(() => {
    const map = new Map<string, { 
      name: string; 
      phone: string; 
      count: number; 
      totalRemaining: number; 
      totalPurchases: number; 
      totalPaid: number;
    }>();
    purchases.forEach((p) => {
      const name = (p.supplierName || '').trim();
      if (!name) return;
      const phone = (p.supplierPhone || '').trim();
      const key = `${name.toLowerCase()}___${phone}`;
      if (!map.has(key)) {
        map.set(key, { 
          name, 
          phone, 
          count: 1, 
          totalRemaining: Number(p.remainingAmount || 0),
          totalPurchases: Number(p.totalAmount || 0),
          totalPaid: Number(p.paidAmount || 0),
        });
      } else {
        const item = map.get(key)!;
        item.count += 1;
        item.totalRemaining += Number(p.remainingAmount || 0);
        item.totalPurchases += Number(p.totalAmount || 0);
        item.totalPaid += Number(p.paidAmount || 0);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [purchases]);

  // Purchases for the selected Statement Supplier
  const statementPurchases = useMemo(() => {
    if (!statementSupplier) return [];
    const targetName = statementSupplier.name.trim().toLowerCase();
    const targetPhone = (statementSupplier.phone || '').trim();
    return purchases.filter((p) => {
      const nameMatch = (p.supplierName || '').trim().toLowerCase() === targetName;
      if (!nameMatch) return false;
      if (targetPhone && p.supplierPhone) {
        return (p.supplierPhone || '').trim() === targetPhone;
      }
      return true;
    });
  }, [purchases, statementSupplier]);

  // Statement Summary Stats
  const statementStats = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    statementPurchases.forEach(p => {
      totalPurchases += Number(p.totalAmount || 0);
      totalPaid += Number(p.paidAmount || 0);
      totalRemaining += Number(p.remainingAmount || 0);
    });
    return {
      totalPurchases: Number(totalPurchases.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      totalRemaining: Number(totalRemaining.toFixed(2)),
      billsCount: statementPurchases.length,
    };
  }, [statementPurchases]);

  const handleOpenSupplierStatement = (name: string, phone?: string) => {
    setStatementSupplier({ name, phone });
  };

  // Print Statement for specific supplier
  const handlePrintSupplierStatement = () => {
    if (!statementSupplier) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportTitle = `كشف حساب المورد: ${statementSupplier.name}`;
    const rowsHtml = statementPurchases.map((p, idx) => {
      const dt = formatArabicDateTime(p.purchaseDate);
      const branchName = store.getBranch(p.branchId || 'b4')?.nameAr || 'فرع المكتب';
      const statusLabel = p.paymentStatus === 'paid' ? 'مدفوع بالكامل' : p.paymentStatus === 'partial' ? 'دفع جزئي' : 'آجل (لم يُدفع)';
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">#${p.invoiceNumber || '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${branchName}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${p.itemsDescription || '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${dt.dayName} ${dt.datePart} (${dt.timePart})</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${p.totalAmount.toLocaleString()} ج.م</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: green;">${p.paidAmount.toLocaleString()} ج.م</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: red; font-weight: bold;">${p.remainingAmount.toLocaleString()} ج.م</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${statusLabel}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${reportTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; direction: rtl; }
            h2, p { text-align: center; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th { background-color: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: center; }
            .kpi-box { display: flex; justify-content: space-around; margin: 15px 0; padding: 12px; border: 1px solid #ccc; border-radius: 8px; background: #fafafa; }
            .kpi { text-align: center; }
            .kpi-title { font-size: 12px; color: #64748b; }
            .kpi-val { font-size: 16px; font-weight: bold; margin-top: 4px; }
          </style>
        </head>
        <body>
          <h2>${reportTitle}</h2>
          ${statementSupplier.phone ? `<p style="font-weight: bold; color: #475569;">رقم الهاتف: ${statementSupplier.phone}</p>` : ''}
          <p style="color: #64748b; font-size: 12px;">تاريخ استخراج الكشف: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
          
          <div class="kpi-box">
            <div class="kpi">
              <div class="kpi-title">إجمالي المشتريات</div>
              <div class="kpi-val">${statementStats.totalPurchases.toLocaleString()} ج.م</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">إجمالي المسدد</div>
              <div class="kpi-val" style="color: green;">${statementStats.totalPaid.toLocaleString()} ج.م</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">صافي الدين المتبقي للمورد</div>
              <div class="kpi-val" style="color: red;">${statementStats.totalRemaining.toLocaleString()} ج.م</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">عدد الفواتير</div>
              <div class="kpi-val">${statementStats.billsCount}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>م</th>
                <th>رقم الفاتورة</th>
                <th>الفرع</th>
                <th>بيان البضاعة</th>
                <th>التاريخ والوقت</th>
                <th>إجمالي الثمن</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>حالة السداد</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingPurchase(null);
    setFormData({
      supplierName: '',
      supplierPhone: '',
      invoiceNumber: '',
      itemsDescription: '',
      branchId: selectedBranchId !== 'all' ? selectedBranchId : (branches[0]?.id || 'b4'),
      totalAmount: '',
      paidAmount: '',
      paymentMode: 'unpaid',
      purchaseDateTime: getLocalNowIso(),
      notes: '',
    });
    setIsAddEditOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: SupplierPurchase) => {
    setEditingPurchase(item);
    let mode: 'paid' | 'partial' | 'unpaid' = item.paymentStatus;
    setFormData({
      supplierName: item.supplierName,
      supplierPhone: item.supplierPhone || '',
      invoiceNumber: item.invoiceNumber || '',
      itemsDescription: item.itemsDescription || '',
      branchId: item.branchId || (selectedBranchId !== 'all' ? selectedBranchId : 'b4'),
      totalAmount: item.totalAmount.toString(),
      paidAmount: item.paidAmount.toString(),
      paymentMode: mode,
      purchaseDateTime: toLocalDatetimeString(item.purchaseDate),
      notes: item.notes || '',
    });
    setIsAddEditOpen(true);
  };

  // Handle total and mode changes in form
  const handleTotalChange = (val: string) => {
    const num = parseFloat(val) || 0;
    let newPaid = formData.paidAmount;
    if (formData.paymentMode === 'paid') {
      newPaid = num > 0 ? num.toString() : '';
    } else if (formData.paymentMode === 'unpaid') {
      newPaid = '0';
    } else if (formData.paymentMode === 'partial') {
      if (parseFloat(newPaid) >= num || parseFloat(newPaid) <= 0) {
        newPaid = num > 0 ? (num / 2).toString() : '0';
      }
    }
    setFormData(prev => ({
      ...prev,
      totalAmount: val,
      paidAmount: newPaid,
    }));
  };

  const handlePaymentModeSelect = (mode: 'paid' | 'partial' | 'unpaid') => {
    const total = parseFloat(formData.totalAmount) || 0;
    let newPaid = formData.paidAmount;
    if (mode === 'paid') {
      newPaid = total > 0 ? total.toString() : '0';
    } else if (mode === 'unpaid') {
      newPaid = '0';
    } else if (mode === 'partial') {
      if (parseFloat(newPaid) >= total || parseFloat(newPaid) <= 0) {
        newPaid = total > 0 ? (total / 2).toString() : '0';
      }
    }
    setFormData(prev => ({
      ...prev,
      paymentMode: mode,
      paidAmount: newPaid,
    }));
  };

  // Save Add/Edit
  const handleSavePurchase = async () => {
    const name = formData.supplierName.trim();
    if (!name) {
      alert('يرجى إدخال اسم المورد');
      return;
    }

    const total = parseFloat(formData.totalAmount);
    if (isNaN(total) || total <= 0) {
      alert('يرجى إدخال إجمالي ثمن البضاعة بشكل صحيح');
      return;
    }

    let paid = parseFloat(formData.paidAmount) || 0;
    if (formData.paymentMode === 'paid') {
      paid = total;
    } else if (formData.paymentMode === 'unpaid') {
      paid = 0;
    }

    if (paid > total) {
      paid = total;
    }
    if (paid < 0) {
      paid = 0;
    }

    const remaining = Number((total - paid).toFixed(2));
    let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (remaining <= 0) {
      status = 'paid';
    } else if (paid > 0) {
      status = 'partial';
    }

    const isoDate = formData.purchaseDateTime ? new Date(formData.purchaseDateTime).toISOString() : new Date().toISOString();
    const resolvedBranchId = formData.branchId || (selectedBranchId !== 'all' ? selectedBranchId : 'b4');

    if (editingPurchase) {
      await store.updateSupplierPurchase(editingPurchase.id, {
        supplierName: name,
        supplierPhone: formData.supplierPhone.trim() || undefined,
        invoiceNumber: formData.invoiceNumber.trim() || undefined,
        itemsDescription: formData.itemsDescription.trim() || undefined,
        branchId: resolvedBranchId,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: remaining,
        paymentStatus: status,
        purchaseDate: isoDate,
        notes: formData.notes.trim() || undefined,
      });
    } else {
      const newPurchase: SupplierPurchase = {
        id: 'supp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        supplierName: name,
        supplierPhone: formData.supplierPhone.trim() || undefined,
        invoiceNumber: formData.invoiceNumber.trim() || undefined,
        itemsDescription: formData.itemsDescription.trim() || undefined,
        branchId: resolvedBranchId,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: remaining,
        paymentStatus: status,
        purchaseDate: isoDate,
        notes: formData.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        paymentHistory: paid > 0 ? [{
          id: 'pay_init_' + Date.now(),
          amount: paid,
          date: isoDate,
          notes: 'دفعة أولى عند استلام البضاعة',
        }] : [],
      };
      await store.addSupplierPurchase(newPurchase);
    }

    setIsAddEditOpen(false);
  };

  // Open Installment Payment Modal
  const handleOpenPayment = (purchase: SupplierPurchase) => {
    setSelectedPurchaseForPayment(purchase);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentDateTime(getLocalNowIso());
    setIsPaymentModalOpen(true);
  };

  // Confirm Installment Payment
  const handleConfirmPayment = async () => {
    if (!selectedPurchaseForPayment) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح للدفعة');
      return;
    }

    if (amount > selectedPurchaseForPayment.remainingAmount) {
      alert(`المبلغ المدخل (${amount} ج.م) أكبر من المبلغ المتبقي (${selectedPurchaseForPayment.remainingAmount} ج.م)`);
      return;
    }

    await store.recordSupplierPayment(
      selectedPurchaseForPayment.id, 
      amount, 
      paymentNotes.trim() || undefined
    );

    setIsPaymentModalOpen(false);
    setSelectedPurchaseForPayment(null);
  };

  // Open Details Modal
  const handleOpenDetails = (purchase: SupplierPurchase) => {
    setSelectedPurchaseForDetails(purchase);
    setIsDetailsModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (deleteConfirmId) {
      await store.deleteSupplierPurchase(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  // Calculated remaining for current form
  const formCalculatedTotal = parseFloat(formData.totalAmount) || 0;
  const formCalculatedPaid = formData.paymentMode === 'paid' 
    ? formCalculatedTotal 
    : formData.paymentMode === 'unpaid' 
      ? 0 
      : (parseFloat(formData.paidAmount) || 0);
  const formCalculatedRemaining = Math.max(0, Number((formCalculatedTotal - formCalculatedPaid).toFixed(2)));

  // Print Summary Report
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportTitle = activeBranchObj ? `سجل فواتير وحسابات الموردين - ${activeBranchObj.nameAr}` : 'سجل فواتير وحسابات الموردين (كافة الفروع)';

    const rowsHtml = filteredPurchases.map((p, idx) => {
      const dt = formatArabicDateTime(p.purchaseDate);
      const branchName = store.getBranch(p.branchId || 'b4')?.nameAr || 'فرع المكتب';
      const statusLabel = p.paymentStatus === 'paid' ? 'مدفوع بالكامل' : p.paymentStatus === 'partial' ? 'دفع جزئي' : 'آجل (لم يُدفع)';
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${p.supplierName}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${branchName}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${p.supplierPhone || '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${p.itemsDescription || '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${dt.dayName} ${dt.datePart}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${p.totalAmount} ج.م</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: green;">${p.paidAmount} ج.م</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: red; font-weight: bold;">${p.remainingAmount} ج.م</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${statusLabel}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${reportTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; direction: rtl; }
            h2, p { text-align: center; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th { background-color: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: center; }
            .kpi-box { display: flex; justify-content: space-around; margin: 20px 0; padding: 10px; border: 1px solid #ccc; border-radius: 8px; }
            .kpi { text-align: center; }
            .kpi-title { font-size: 12px; color: #64748b; }
            .kpi-val { font-size: 16px; font-weight: bold; margin-top: 4px; }
          </style>
        </head>
        <body>
          <h2>${reportTitle}</h2>
          <p style="color: #64748b; font-size: 12px;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          
          <div class="kpi-box">
            <div class="kpi">
              <div class="kpi-title">إجمالي المشتريات</div>
              <div class="kpi-val">${stats.totalPurchases} ج.م</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">إجمالي المسدد</div>
              <div class="kpi-val" style="color: green;">${stats.totalPaid} ج.م</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">إجمالي المتبقي (الديون)</div>
              <div class="kpi-val" style="color: red;">${stats.totalRemaining} ج.م</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">عدد الفواتير</div>
              <div class="kpi-val">${stats.billsCount}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم المورد</th>
                <th>الفرع</th>
                <th>الهاتف</th>
                <th>بيان البضاعة</th>
                <th>تاريخ التوريد</th>
                <th>إجمالي المبلغ</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>حالة السداد</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32 sm:pb-20 max-w-7xl mx-auto px-1 sm:px-4" dir="rtl">
      
      {/* Super Admin Top Bar with Back Button (Same style as Master Dashboard) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border/80 p-4 sm:p-6 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          {/* Back Button */}
          <Button 
            onClick={() => navigate('/dashboard')} 
            variant="outline"
            className="rounded-2xl h-11 px-4 border-border/80 hover:bg-amber-500/10 hover:text-amber-500 transition-all font-bold gap-2 text-xs shadow-xs shrink-0"
            title="الرجوع للشاشة الرئيسية"
          >
            <ArrowRight size={18} />
            <span>رجوع</span>
          </Button>

          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
              {activeBranchObj ? `سجل موردين ${activeBranchObj.nameAr}` : 'سجل وحسابات الموردين (كافة الفروع)'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {activeBranchObj 
                ? `متابعة فواتير شراء البضاعة وحسابات الموردين الخاصة بـ ${activeBranchObj.nameAr}.`
                : 'لوحة المتابعة الشاملة لفواتير شراء البضاعة، المبالغ المسددة، والمتبقي لكل مورد عبر كافة الفروع.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto z-10 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setIsSupplierSelectModalOpen(true)}
            className="flex-1 sm:flex-none gap-2 rounded-2xl text-xs font-bold border-amber-500/40 hover:bg-amber-500/10 text-amber-500 h-11 px-4 shadow-xs"
            title="عرض كشوف حسابات الموردين وفواتير كل مورد"
          >
            <FileText size={16} />
            <span>كشف حساب مورد</span>
          </Button>

          <Button
            variant="outline"
            onClick={handlePrintReport}
            className="flex-1 sm:flex-none gap-2 rounded-2xl text-xs font-bold border-border/80 hover:bg-muted h-11 px-4 shadow-xs"
            title="طباعة كشف الحساب"
          >
            <Printer size={16} />
            <span className="hidden xs:inline">طباعة تقرير</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none gap-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-2xl text-xs h-11 px-5 shadow-md shadow-amber-500/20"
          >
            <Plus size={18} />
            <span>إضافة فاتورة مورد جديدة</span>
          </Button>
        </div>

        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Branch Switcher Tabs (All Branches + Individual Branches) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => handleSelectBranch('all')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            selectedBranchId === 'all'
              ? 'bg-amber-500 text-black shadow-md font-black'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Layers size={14} />
          <span>كافة الفروع (الشامل)</span>
        </button>

        {branches.map(b => (
          <button
            key={b.id}
            type="button"
            onClick={() => handleSelectBranch(b.id)}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedBranchId === b.id
                ? 'bg-amber-500 text-black shadow-md font-black'
                : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Building2 size={14} />
            <span>{b.nameAr}</span>
          </button>
        ))}
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Purchases */}
        <Card className="p-4 sm:p-5 rounded-2xl border-border bg-gradient-to-br from-card to-muted/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-muted-foreground">إجمالي المشتريات</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-2xl font-black text-foreground">
              {stats.totalPurchases.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">ج.م</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
              <span>{stats.billsCount} فاتورة توريد</span>
            </div>
          </div>
        </Card>

        {/* Total Paid */}
        <Card className="p-4 sm:p-5 rounded-2xl border-border bg-gradient-to-br from-card to-muted/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-muted-foreground">إجمالي المدفوع</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-2xl font-black text-emerald-500">
              {stats.totalPaid.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">ج.م</span>
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <span>تم سداده للموردين</span>
            </div>
          </div>
        </Card>

        {/* Total Remaining (Debts) */}
        <Card className="p-4 sm:p-5 rounded-2xl border-border bg-gradient-to-br from-card to-rose-500/5 relative overflow-hidden border-rose-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-rose-500">الديون المتبقية للموردين</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-2xl font-black text-rose-500">
              {stats.totalRemaining.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">ج.م</span>
            </div>
            <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1 flex items-center gap-1 font-bold">
              <span>مستحق السداد</span>
            </div>
          </div>
        </Card>

        {/* Total Suppliers Count */}
        <Card 
          onClick={() => setIsSupplierSelectModalOpen(true)}
          className="p-4 sm:p-5 rounded-2xl border-border bg-gradient-to-br from-card to-muted/30 relative overflow-hidden cursor-pointer hover:border-amber-500/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-muted-foreground group-hover:text-amber-500 transition-colors">عدد الموردين</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Truck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-2xl font-black text-foreground">
              {stats.suppliersCount} <span className="text-xs text-muted-foreground font-normal">مورد</span>
            </div>
            <div className="text-[11px] text-amber-500/90 mt-1 flex items-center gap-1 font-bold">
              <span>عرض كشوف الحساب 📋</span>
            </div>
          </div>
        </Card>

      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 sm:p-4 rounded-2xl border border-border">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المورد، رقم الهاتف، رقم الفاتورة، أو نوع البضاعة..."
            className="pr-10 rounded-xl bg-background/50 border-border text-xs sm:text-sm h-10"
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              مسح
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl text-xs font-bold h-9 px-3 shrink-0 ${
              statusFilter === 'all' ? 'bg-foreground text-background' : 'border-border'
            }`}
          >
            الكل ({purchases.length})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === 'paid' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('paid')}
            className={`rounded-xl text-xs font-bold h-9 px-3 shrink-0 ${
              statusFilter === 'paid' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10'
            }`}
          >
            مدفوع بالكامل ({purchases.filter(p => p.paymentStatus === 'paid').length})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === 'partial' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('partial')}
            className={`rounded-xl text-xs font-bold h-9 px-3 shrink-0 ${
              statusFilter === 'partial' ? 'bg-amber-500 text-black hover:bg-amber-600' : 'text-amber-500 border-amber-500/30 hover:bg-amber-500/10'
            }`}
          >
            دفع جزئي ({purchases.filter(p => p.paymentStatus === 'partial').length})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === 'unpaid' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('unpaid')}
            className={`rounded-xl text-xs font-bold h-9 px-3 shrink-0 ${
              statusFilter === 'unpaid' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'text-rose-500 border-rose-500/30 hover:bg-rose-500/10'
            }`}
          >
            آجل / لم يُدفع ({purchases.filter(p => p.paymentStatus === 'unpaid').length})
          </Button>
        </div>

      </div>

      {/* Purchases List Table */}
      <Card className="rounded-2xl border-border overflow-hidden">
        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
              <Truck size={32} />
            </div>
            <h3 className="text-base font-bold text-foreground">لا توجد فواتير موردين مسجلة</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {search || statusFilter !== 'all' 
                ? 'لم يتم العثور على نتائج تطابق معايير البحث الحالية.' 
                : 'اضغط على زر "إضافة فاتورة مورد جديدة" لتسجيل فواتير البضاعة والموردين ومتابعة سدادها.'}
            </p>
            {(!search && statusFilter === 'all') && (
              <Button
                onClick={handleOpenAdd}
                className="mt-4 gap-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-xs"
              >
                <Plus size={16} />
                <span>إضافة أول فاتورة</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-right text-xs font-bold">المورد</TableHead>
                  <TableHead className="text-right text-xs font-bold">الفرع</TableHead>
                  <TableHead className="text-right text-xs font-bold">بيان البضاعة</TableHead>
                  <TableHead className="text-right text-xs font-bold">اليوم والتاريخ والوقت</TableHead>
                  <TableHead className="text-center text-xs font-bold">إجمالي الثمن</TableHead>
                  <TableHead className="text-center text-xs font-bold">المدفوع</TableHead>
                  <TableHead className="text-center text-xs font-bold">المتبقي</TableHead>
                  <TableHead className="text-center text-xs font-bold">حالة السداد</TableHead>
                  <TableHead className="text-center text-xs font-bold">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((item) => {
                  const dt = formatArabicDateTime(item.purchaseDate);
                  const branchName = store.getBranch(item.branchId || 'b4')?.nameAr || 'فرع المكتب';

                  return (
                    <TableRow key={item.id} className="border-border hover:bg-muted/20 transition-colors">
                      
                      {/* Supplier Info */}
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenSupplierStatement(item.supplierName, item.supplierPhone)}
                              className="font-extrabold text-xs sm:text-sm text-foreground hover:text-amber-500 hover:underline transition-colors text-right"
                              title="عرض كشف حساب هذا المورد"
                            >
                              {item.supplierName}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenSupplierStatement(item.supplierName, item.supplierPhone)}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 font-bold transition-all shrink-0 flex items-center gap-1"
                              title="عرض كشف الحساب وتفاصيل كل الفواتير"
                            >
                              <FileText size={11} />
                              <span>كشف حساب</span>
                            </button>
                            {item.invoiceNumber && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono font-normal">
                                #{item.invoiceNumber}
                              </span>
                            )}
                          </div>
                          {item.supplierPhone ? (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                              <Phone size={11} /> {item.supplierPhone}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60 mt-0.5">بدون هاتف</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Branch Info */}
                      <TableCell className="align-middle whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/25">
                          {branchName}
                        </span>
                      </TableCell>

                      {/* Items Description */}
                      <TableCell className="align-middle max-w-[180px]">
                        <p className="text-xs text-foreground truncate font-medium" title={item.itemsDescription || 'بدون بيان'}>
                          {item.itemsDescription || <span className="text-muted-foreground/60 italic">بدون بيان</span>}
                        </p>
                      </TableCell>

                      {/* Day, Date & Time */}
                      <TableCell className="align-middle whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground">
                            {dt.dayName}
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">
                            {dt.datePart}
                          </span>
                          <span className="text-[10px] text-amber-500/90 font-mono mt-0.5">
                            {dt.timePart}
                          </span>
                        </div>
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell className="align-middle text-center font-extrabold text-xs sm:text-sm text-foreground whitespace-nowrap">
                        {item.totalAmount.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">ج.م</span>
                      </TableCell>

                      {/* Paid Amount */}
                      <TableCell className="align-middle text-center font-bold text-xs sm:text-sm text-emerald-500 whitespace-nowrap">
                        {item.paidAmount.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">ج.م</span>
                      </TableCell>

                      {/* Remaining Amount */}
                      <TableCell className="align-middle text-center whitespace-nowrap">
                        {item.remainingAmount > 0 ? (
                          <span className="font-extrabold text-xs sm:text-sm text-rose-500">
                            {item.remainingAmount.toLocaleString()} <span className="text-[10px] text-rose-400/80 font-normal">ج.م</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">0 ج.م</span>
                        )}
                      </TableCell>

                      {/* Payment Status Badge */}
                      <TableCell className="align-middle text-center whitespace-nowrap">
                        {item.paymentStatus === 'paid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={12} />
                            <span>مدفوع بالكامل</span>
                          </span>
                        )}
                        {item.paymentStatus === 'partial' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock size={12} />
                            <span>دفع جزئي</span>
                          </span>
                        )}
                        {item.paymentStatus === 'unpaid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <AlertCircle size={12} />
                            <span>آجل / لم يُدفع</span>
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="align-middle text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Quick Pay Button */}
                          {item.remainingAmount > 0 ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPayment(item)}
                              className="h-8 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[11px] gap-1 shadow-xs"
                              title="تسديد دفعة جديدة للمورد"
                            >
                              <CreditCard size={13} />
                              <span>تسديد دفعة</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDetails(item)}
                              className="h-8 px-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 text-[11px] font-bold gap-1 bg-emerald-500/5 hover:bg-emerald-500/15"
                            >
                              <Check size={13} />
                              <span>خالص</span>
                            </Button>
                          )}

                          {/* Details & History */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenDetails(item)}
                            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="عرض تفاصيل الفاتورة وسجل الدفعات"
                          >
                            <History size={15} />
                          </Button>

                          {/* Edit */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(item)}
                            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                            title="تعديل الفاتورة"
                          >
                            <Edit3 size={15} />
                          </Button>

                          {/* Delete */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                            title="حذف الفاتورة"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </TableCell>

                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ==================== Add / Edit Modal ==================== */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full max-w-xl max-h-[90dvh] rounded-3xl p-0 overflow-hidden flex flex-col bg-card border-border shadow-2xl" dir="rtl">
          
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <Truck className="text-amber-500" size={20} />
              <span>{editingPurchase ? 'تعديل فاتورة مورد' : 'إضافة فاتورة شراء من مورد'}</span>
            </DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              سجّل بيانات المورد، قيمة البضاعة المشتراة، وتفاصيل السداد بدقة.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
            
            {/* Field: Branch Selection */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                الفرع التابع له الفاتورة <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
                className="w-full rounded-xl text-xs h-10 px-3 bg-background border border-border text-foreground font-bold outline-none focus:ring-1 focus:ring-amber-500"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-suggest dropdown for previously recorded suppliers */}
            {existingSuppliers.length > 0 && !editingPurchase && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-bold text-amber-500">
                  <span className="flex items-center gap-1.5">
                    <Users size={14} />
                    <span>اختيار مورد مسجل سابقاً (تعبئة تلقائية):</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {existingSuppliers.length} مورد مسجل
                  </span>
                </div>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const [suppName, suppPhone] = val.split('___');
                    setFormData(prev => ({
                      ...prev,
                      supplierName: suppName || prev.supplierName,
                      supplierPhone: suppPhone || '',
                    }));
                  }}
                  className="w-full rounded-xl text-xs h-10 px-3 bg-background border border-amber-500/30 text-foreground font-bold outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">-- اضغط لاختيار مورد وتعبئة اسمه ورقم هاتفه تلقائياً --</option>
                  {existingSuppliers.map((s, idx) => (
                    <option key={idx} value={`${s.name}___${s.phone || ''}`}>
                      {s.name} {s.phone ? `(${s.phone})` : ''} — [{s.count} فاتورة] {s.totalRemaining > 0 ? `(متبقي له: ${s.totalRemaining.toLocaleString()} ج.م)` : '(خالص)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Row 1: Supplier Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  اسم المورد <span className="text-rose-500">*</span>
                </label>
                <Input
                  list="suppliers-names-datalist"
                  value={formData.supplierName}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                  placeholder="مثال: مصنع الأندلس / الحاج رجب"
                  className="rounded-xl text-xs h-10"
                />
                <datalist id="suppliers-names-datalist">
                  {existingSuppliers.map((s, idx) => (
                    <option key={idx} value={s.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  رقم الهاتف (اختياري)
                </label>
                <Input
                  list="suppliers-phones-datalist"
                  value={formData.supplierPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplierPhone: e.target.value }))}
                  placeholder="010XXXXXXXX"
                  className="rounded-xl text-xs h-10"
                  dir="ltr"
                />
                <datalist id="suppliers-phones-datalist">
                  {existingSuppliers.filter(s => s.phone).map((s, idx) => (
                    <option key={idx} value={s.phone} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Row 2: Invoice No & Date/Time (Exact Clock & Date) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  رقم الفاتورة / إذن الاستلام (اختياري)
                </label>
                <Input
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  placeholder="مثال: INV-1049"
                  className="rounded-xl text-xs h-10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1 flex items-center justify-between">
                  <span>التاريخ والوقت بالساعة والدقيقة <span className="text-rose-500">*</span></span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, purchaseDateTime: getLocalNowIso() }))}
                    className="text-[10px] text-amber-500 hover:underline font-bold"
                    title="ضبط على اللحظة الحالية الآن"
                  >
                    الآن ⏱️
                  </button>
                </label>
                <Input
                  type="datetime-local"
                  value={formData.purchaseDateTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseDateTime: e.target.value }))}
                  className="rounded-xl text-xs h-10 font-mono"
                />
              </div>
            </div>

            {/* Row 3: Goods Description */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                بيان البضاعة المشتراة
              </label>
              <Input
                value={formData.itemsDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, itemsDescription: e.target.value }))}
                placeholder="مثال: 50 سلسلة ستانلس + 100 خاتم فضي"
                className="rounded-xl text-xs h-10"
              />
            </div>

            {/* Row 3: Total Goods Cost */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                إجمالي ثمن البضاعة (اشترى بضاعة بكام؟) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.totalAmount}
                  onChange={(e) => handleTotalChange(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl text-sm font-extrabold h-11 pl-12"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                  ج.م
                </span>
              </div>
            </div>

            {/* Row 4: Payment Status Options (3 Tabs/Buttons) */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                حالة الدفع للمورد
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handlePaymentModeSelect('paid')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    formData.paymentMode === 'paid'
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-xs'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <CheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span className="text-[11px] sm:text-xs">أخد فلوسه كاملة</span>
                  <span className="text-[9px] sm:text-[10px] opacity-80">(مدفوع بالكامل)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePaymentModeSelect('partial')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    formData.paymentMode === 'partial'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-extrabold shadow-xs'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Clock size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span className="text-[11px] sm:text-xs">دفع جزء وباقي جزء</span>
                  <span className="text-[9px] sm:text-[10px] opacity-80">(دفع جزئي)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePaymentModeSelect('unpaid')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    formData.paymentMode === 'unpaid'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold shadow-xs'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <AlertCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span className="text-[11px] sm:text-xs">لسه ما دفعش خالص</span>
                  <span className="text-[9px] sm:text-[10px] opacity-80">(آجل بالكامل)</span>
                </button>
              </div>
            </div>

            {/* Row 5: Paid and Remaining Live Display */}
            {formData.paymentMode === 'partial' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <label className="text-xs font-bold text-foreground mb-1 block">
                    المبلغ الذي تم دفعه الآن
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max={formData.totalAmount || undefined}
                      step="any"
                      value={formData.paidAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, paidAmount: e.target.value }))}
                      placeholder="0.00"
                      className="rounded-xl text-sm font-extrabold h-10 pl-12 text-emerald-500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                      ج.م
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground mb-1 block">
                    المبلغ المتبقي للمورد
                  </label>
                  <div className="h-10 rounded-xl bg-card border border-rose-500/30 flex items-center justify-between px-3 text-rose-500 font-extrabold text-sm">
                    <span>{formCalculatedRemaining.toLocaleString()}</span>
                    <span className="text-xs font-normal text-muted-foreground">ج.م</span>
                  </div>
                </div>
              </div>
            )}

            {formData.paymentMode === 'unpaid' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  المبلغ المتبقي بالكامل كدين للمورد:
                </span>
                <span className="text-sm font-black">{formCalculatedTotal.toLocaleString()} ج.م</span>
              </div>
            )}

            {formData.paymentMode === 'paid' && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  تم سداد الفاتورة بالكامل، والمتبقي:
                </span>
                <span className="text-sm font-black">0 ج.م</span>
              </div>
            )}



            {/* Row 7: Notes */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                ملاحظات إضافية (اختياري)
              </label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="أي ملاحظات حول البضاعة أو مواعيد السداد..."
                className="rounded-xl text-xs h-10"
              />
            </div>

          </div>

          <DialogFooter className="p-4 border-t border-border bg-card shrink-0 flex flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddEditOpen(false)}
              className="rounded-xl text-xs font-bold border-border"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSavePurchase}
              className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-xs px-5 shadow-sm"
            >
              {editingPurchase ? 'حفظ التعديلات' : 'إضافة الفاتورة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Installment Payment Modal ==================== */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full max-w-md max-h-[90dvh] rounded-3xl p-0 overflow-hidden flex flex-col bg-card border-border shadow-2xl" dir="rtl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <CreditCard className="text-amber-500" size={20} />
              <span>تسديد دفعة للمورد</span>
            </DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              تسجيل دفعة نقدية جديدة وتخفيض رصيد الدين المتبقي للمورد.
            </DialogDescription>
          </DialogHeader>

          {selectedPurchaseForPayment && (
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
              
              {/* Info summary card */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">اسم المورد:</span>
                  <span className="font-extrabold text-foreground">{selectedPurchaseForPayment.supplierName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">الفرع التابع له:</span>
                  <span className="font-bold text-amber-500">{store.getBranch(selectedPurchaseForPayment.branchId || 'b4')?.nameAr || 'فرع المكتب'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">إجمالي الفاتورة:</span>
                  <span className="font-bold text-foreground">{selectedPurchaseForPayment.totalAmount} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">المسدد سابقاً:</span>
                  <span className="font-bold text-emerald-500">{selectedPurchaseForPayment.paidAmount} ج.م</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between items-center text-xs">
                  <span className="font-bold text-rose-500">المبلغ المتبقي حالياً:</span>
                  <span className="font-black text-rose-500 text-sm">{selectedPurchaseForPayment.remainingAmount} ج.م</span>
                </div>
              </div>

              {/* Installment Amount Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-foreground">
                    مبلغ الدفعة الحالية <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedPurchaseForPayment.remainingAmount.toString())}
                    className="text-[11px] text-amber-500 hover:underline font-bold"
                  >
                    سداد المتبقي بالكامل
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    max={selectedPurchaseForPayment.remainingAmount}
                    step="any"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="rounded-xl text-sm font-extrabold h-11 pl-12 text-emerald-500"
                    autoFocus
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                    ج.م
                  </span>
                </div>
              </div>

              {/* Installment Date */}
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  تاريخ وتوقيت السداد
                </label>
                <Input
                  type="datetime-local"
                  value={paymentDateTime}
                  onChange={(e) => setPaymentDateTime(e.target.value)}
                  className="rounded-xl text-xs h-10"
                />
              </div>

              {/* Installment Notes */}
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  طريقة السداد / ملاحظات
                </label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="مثال: نقداً من الخزينة / تحويل فودافون كاش / انستاباي"
                  className="rounded-xl text-xs h-10"
                />
              </div>

            </div>
          )}

          <DialogFooter className="p-4 border-t border-border bg-card shrink-0 flex flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPaymentModalOpen(false)}
              className="rounded-xl text-xs font-bold border-border"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmPayment}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs px-5 shadow-sm"
            >
              تأكيد سداد الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Details & History Modal ==================== */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full max-w-lg max-h-[90dvh] rounded-3xl p-0 overflow-hidden flex flex-col bg-card border-border shadow-2xl" dir="rtl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <History className="text-amber-500" size={20} />
              <span>تفاصيل الفاتورة وسجل الدفعات</span>
            </DialogTitle>
          </DialogHeader>

          {selectedPurchaseForDetails && (
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
              
              {/* Supplier Header Box */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-2.5">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-sm text-foreground">{selectedPurchaseForDetails.supplierName}</h4>
                  {selectedPurchaseForDetails.paymentStatus === 'paid' && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                      مدفوع بالكامل
                    </span>
                  )}
                  {selectedPurchaseForDetails.paymentStatus === 'partial' && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/20">
                      دفع جزئي
                    </span>
                  )}
                  {selectedPurchaseForDetails.paymentStatus === 'unpaid' && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/20">
                      آجل / لم يُدفع
                    </span>
                  )}
                </div>

                {selectedPurchaseForDetails.supplierPhone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5" dir="ltr">
                    <Phone size={13} /> {selectedPurchaseForDetails.supplierPhone}
                  </p>
                )}

                {selectedPurchaseForDetails.itemsDescription && (
                  <p className="text-xs text-foreground bg-muted/40 p-2 rounded-lg">
                    <span className="font-bold text-muted-foreground">بيان البضاعة: </span>
                    {selectedPurchaseForDetails.itemsDescription}
                  </p>
                )}

                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-500" />
                  <span>تاريخ الشراء: </span>
                  <span className="font-bold text-foreground">
                    {formatArabicDateTime(selectedPurchaseForDetails.purchaseDate).dayName} - {formatArabicDateTime(selectedPurchaseForDetails.purchaseDate).datePart} ({formatArabicDateTime(selectedPurchaseForDetails.purchaseDate).timePart})
                  </span>
                </div>
              </div>

              {/* Progress Bar of Payment */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1 font-bold">
                  <span>نسبة السداد</span>
                  <span className="text-amber-500 font-mono">
                    {Math.round((selectedPurchaseForDetails.paidAmount / (selectedPurchaseForDetails.totalAmount || 1)) * 100)}%
                  </span>
                </div>
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((selectedPurchaseForDetails.paidAmount / (selectedPurchaseForDetails.totalAmount || 1)) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] mt-1.5 text-muted-foreground">
                  <span>المدفوع: <b className="text-emerald-500">{selectedPurchaseForDetails.paidAmount} ج.م</b></span>
                  <span>المتبقي: <b className="text-rose-500">{selectedPurchaseForDetails.remainingAmount} ج.م</b></span>
                  <span>الإجمالي: <b className="text-foreground">{selectedPurchaseForDetails.totalAmount} ج.م</b></span>
                </div>
              </div>

              {/* Payment Installments Timeline */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <History size={14} className="text-amber-500" />
                  <span>سجل الدفعات المسددة ({selectedPurchaseForDetails.paymentHistory?.length || 0})</span>
                </h5>

                {!selectedPurchaseForDetails.paymentHistory || selectedPurchaseForDetails.paymentHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded-xl text-center">
                    لم يتم تسجيل أي دفعات نقدية مسددة لهذه الفاتورة بعد.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
                    {selectedPurchaseForDetails.paymentHistory.map((rec, i) => {
                      const dt = formatArabicDateTime(rec.date);
                      return (
                        <div key={rec.id || i} className="p-2.5 rounded-xl bg-muted/30 border border-border flex items-center justify-between text-xs">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-emerald-500">
                              + {rec.amount.toLocaleString()} ج.م
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {rec.notes || 'دفعة نقدية'}
                            </span>
                          </div>
                          <div className="text-left text-[10px] text-muted-foreground">
                            <div>{dt.dayName} {dt.datePart}</div>
                            <div className="font-mono text-amber-500/80">{dt.timePart}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedPurchaseForDetails.notes && (
                <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-border/50">
                  <span className="font-bold text-foreground">ملاحظات: </span>
                  {selectedPurchaseForDetails.notes}
                </div>
              )}

            </div>
          )}

          <DialogFooter className="p-4 border-t border-border bg-card shrink-0 flex flex-row justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDetailsModalOpen(false)}
              className="rounded-xl text-xs font-bold px-6"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Confirmation Dialog ==================== */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-rose-500 flex items-center gap-2">
              <AlertTriangle size={22} />
              <span>تأكيد حذف الفاتورة</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2">
              هل أنت متأكد من رغبتك في حذف فاتورة المورد هذه نهائياً؟ لن يمكن استرجاع بيانات الفاتورة أو سجل دفعاتها بعد الحذف.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="rounded-xl text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs"
            >
              نعم، حذف الفاتورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Supplier Statement / Ledger Modal (كشف حساب المورد) ==================== */}
      <Dialog open={!!statementSupplier} onOpenChange={(open) => !open && setStatementSupplier(null)}>
        <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full max-w-4xl max-h-[92dvh] rounded-3xl p-0 overflow-hidden flex flex-col bg-card border-border shadow-2xl" dir="rtl">
          {statementSupplier && (
            <>
              {/* Header */}
              <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                    <FileText className="text-amber-500 shrink-0" size={22} />
                    <span>كشف حساب المورد: {statementSupplier.name}</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                    {statementSupplier.phone ? (
                      <span className="flex items-center gap-1 font-mono text-foreground font-bold" dir="ltr">
                        <Phone size={12} /> {statementSupplier.phone}
                      </span>
                    ) : (
                      <span>بدون رقم هاتف</span>
                    )}
                    <span>•</span>
                    <span>سجل ومتابعة كافة فواتير البضاعة والمبالغ المتبقية لهذا المورد.</span>
                  </DialogDescription>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={handlePrintSupplierStatement}
                    variant="outline"
                    className="flex-1 sm:flex-none gap-1.5 rounded-xl text-xs font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 h-9 shadow-xs"
                    title="طباعة كشف الحساب"
                  >
                    <Printer size={15} />
                    <span>طباعة كشف الحساب</span>
                  </Button>
                </div>
              </DialogHeader>

              {/* Statement Content */}
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
                
                {/* 4 Summary Cards for this Supplier */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <Card className="p-3 sm:p-4 rounded-2xl border-border bg-card">
                    <span className="text-[11px] sm:text-xs text-muted-foreground font-bold block">إجمالي المشتريات منه</span>
                    <div className="text-base sm:text-xl font-black text-foreground font-mono mt-1">
                      {statementStats.totalPurchases.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">ج.م</span>
                    </div>
                  </Card>

                  <Card className="p-3 sm:p-4 rounded-2xl border-border bg-card">
                    <span className="text-[11px] sm:text-xs text-emerald-500 font-bold block">إجمالي المسدد له</span>
                    <div className="text-base sm:text-xl font-black text-emerald-500 font-mono mt-1">
                      {statementStats.totalPaid.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">ج.م</span>
                    </div>
                  </Card>

                  <Card className="p-3 sm:p-4 rounded-2xl border-rose-500/30 bg-rose-500/5">
                    <span className="text-[11px] sm:text-xs text-rose-500 font-bold block">صافي الدين المتبقي</span>
                    <div className="text-base sm:text-xl font-black text-rose-500 font-mono mt-1">
                      {statementStats.totalRemaining.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">ج.م</span>
                    </div>
                  </Card>

                  <Card className="p-3 sm:p-4 rounded-2xl border-border bg-card">
                    <span className="text-[11px] sm:text-xs text-muted-foreground font-bold block">عدد الفواتير</span>
                    <div className="text-base sm:text-xl font-black text-amber-500 font-mono mt-1">
                      {statementStats.billsCount} <span className="text-[10px] font-normal text-muted-foreground">فاتورة</span>
                    </div>
                  </Card>
                </div>

                {/* Invoices List Table */}
                <div className="rounded-2xl border border-border overflow-hidden bg-card">
                  <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Truck size={15} className="text-amber-500" />
                      <span>تفاصيل فواتير المورد ({statementPurchases.length})</span>
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      موزعة عبر الفروع وتواريخ الشراء
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-right text-[11px] font-bold"># الفاتورة</TableHead>
                          <TableHead className="text-right text-[11px] font-bold">الفرع</TableHead>
                          <TableHead className="text-right text-[11px] font-bold">التاريخ والوقت</TableHead>
                          <TableHead className="text-right text-[11px] font-bold">بيان البضاعة</TableHead>
                          <TableHead className="text-center text-[11px] font-bold">إجمالي الثمن</TableHead>
                          <TableHead className="text-center text-[11px] font-bold">المدفوع</TableHead>
                          <TableHead className="text-center text-[11px] font-bold">المتبقي</TableHead>
                          <TableHead className="text-center text-[11px] font-bold">حالة السداد</TableHead>
                          <TableHead className="text-center text-[11px] font-bold">إجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statementPurchases.map((inv) => {
                          const dt = formatArabicDateTime(inv.purchaseDate);
                          const branchName = store.getBranch(inv.branchId || 'b4')?.nameAr || 'فرع المكتب';
                          return (
                            <TableRow key={inv.id} className="border-border hover:bg-muted/20 text-xs">
                              <TableCell className="font-mono font-bold whitespace-nowrap">
                                #{inv.invoiceNumber || inv.id.slice(-6)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-foreground">
                                  {branchName}
                                </span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <div className="text-[11px]">
                                  <span className="font-bold">{dt.dayName}</span> {dt.datePart}
                                  <div className="text-[10px] text-amber-500 font-mono">{dt.timePart}</div>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate" title={inv.itemsDescription || ''}>
                                {inv.itemsDescription || <span className="text-muted-foreground/60 italic">—</span>}
                              </TableCell>
                              <TableCell className="text-center font-bold font-mono">
                                {inv.totalAmount.toLocaleString()} ج.م
                              </TableCell>
                              <TableCell className="text-center font-bold font-mono text-emerald-500">
                                {inv.paidAmount.toLocaleString()} ج.م
                              </TableCell>
                              <TableCell className="text-center font-bold font-mono text-rose-500">
                                {inv.remainingAmount > 0 ? `${inv.remainingAmount.toLocaleString()} ج.م` : '0 ج.م'}
                              </TableCell>
                              <TableCell className="text-center whitespace-nowrap">
                                {inv.paymentStatus === 'paid' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    مدفوع بالكامل
                                  </span>
                                ) : inv.paymentStatus === 'partial' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    دفع جزئي
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                    آجل / لم يدفع
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  {inv.remainingAmount > 0 ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenPayment(inv)}
                                      className="h-7 px-2 text-[10px] bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-lg"
                                    >
                                      تسديد
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleOpenDetails(inv)}
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                                    title="التفاصيل وسجل الدفعات"
                                  >
                                    <History size={13} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

              </div>

              <DialogFooter className="p-4 border-t border-border bg-card shrink-0 flex flex-row justify-end">
                <Button
                  variant="outline"
                  onClick={() => setStatementSupplier(null)}
                  className="rounded-xl text-xs font-bold px-6"
                >
                  إغلاق
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== Supplier Select / Ledger Directory Modal ==================== */}
      <Dialog open={isSupplierSelectModalOpen} onOpenChange={setIsSupplierSelectModalOpen}>
        <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full max-w-2xl max-h-[90dvh] rounded-3xl p-0 overflow-hidden flex flex-col bg-card border-border shadow-2xl" dir="rtl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <FileText className="text-amber-500" size={20} />
              <span>دليل كشوفات حسابات الموردين</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              اختر أي مورد لعرض كشف حسابه الكامل وجميع الفواتير والديون المستحقة له.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
            {/* Search Box */}
            <div className="relative">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={supplierSelectSearch}
                onChange={(e) => setSupplierSelectSearch(e.target.value)}
                placeholder="ابحث باسم المورد أو رقم الهاتف..."
                className="pr-9 rounded-xl text-xs h-10"
              />
            </div>

            {/* Suppliers List Cards */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin">
              {existingSuppliers
                .filter(s => {
                  if (!supplierSelectSearch.trim()) return true;
                  const q = supplierSelectSearch.trim().toLowerCase();
                  return s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q));
                })
                .map((s, idx) => (
                  <div 
                    key={idx}
                    className="p-3 sm:p-3.5 rounded-2xl border border-border bg-card hover:border-amber-500/40 hover:bg-muted/20 transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 font-black text-sm">
                        <Truck size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-foreground">{s.name}</h4>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          {s.phone ? (
                            <span className="flex items-center gap-1 font-mono" dir="ltr">
                              <Phone size={11} /> {s.phone}
                            </span>
                          ) : (
                            <span>بدون هاتف</span>
                          )}
                          <span>•</span>
                          <span className="font-bold text-amber-500">{s.count} فاتورة</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left font-mono">
                        <span className="text-[10px] text-muted-foreground block">صافي المتبقي له</span>
                        <span className={`text-xs sm:text-sm font-extrabold ${s.totalRemaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {s.totalRemaining > 0 ? `${s.totalRemaining.toLocaleString()} ج.م` : 'خالص'}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setIsSupplierSelectModalOpen(false);
                          setStatementSupplier({ name: s.name, phone: s.phone });
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs h-9 px-3.5 rounded-xl gap-1.5 shadow-xs"
                      >
                        <FileText size={14} />
                        <span>فتح كشف الحساب</span>
                      </Button>
                    </div>
                  </div>
                ))}

              {existingSuppliers.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  لا يوجد موردين مسجلين بعد. عند إضافة أول فاتورة مورد ستظهر هنا تلقائياً.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-card shrink-0 flex flex-row justify-end">
            <Button
              variant="outline"
              onClick={() => setIsSupplierSelectModalOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
export default Suppliers;
