import { useState, useEffect } from 'react';
import { store } from '../../services/store';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const Reports = () => {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <div className="p-8 text-center text-red-500 font-bold">غير مصرح لك بالوصول لهذه الصفحة</div>;

  const [serverSummary, setServerSummary] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    api.getReportsSummary()
      .then(res => {
        if (active && res) {
          setServerSummary(res);
        }
      })
      .catch(err => {
        if (active) {
          console.warn('Reports summary error:', err);
          setError('تعذر الاتصال بالخادم لجلب الإجماليات الشاملة، يتم عرض البيانات المؤقتة');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const branches = store.getBranches();
  const data = branches.map(b => {
    const sBranch = serverSummary?.branchSummaries?.find((s: any) => s.branchId === b.id);
    if (sBranch) {
      return {
        name: b.nameAr,
        Revenue: Number(sBranch.revenue || 0),
        Cost: Number(sBranch.cost || 0),
        Profit: Number(sBranch.netProfit || 0),
      };
    }
    const invs = store.getInvoicesByBranch(b.id);
    const revenue = invs.reduce((acc, i) => {
      const paid = i.paidAmount !== undefined ? Number(i.paidAmount) : (i.paymentStatus === 'paid' ? Number(i.total || 0) : 0);
      return acc + paid;
    }, 0);
    const cost = invs.reduce((acc, i) => {
      const paid = i.paidAmount !== undefined ? Number(i.paidAmount) : (i.paymentStatus === 'paid' ? Number(i.total || 0) : 0);
      const total = Number(i.total || 0);
      const totalCost = Number(i.totalCost || 0);
      if (paid <= 0 || total <= 0 || totalCost <= 0) return acc;
      if (paid >= total) return acc + totalCost;
      return acc + (totalCost * (paid / total));
    }, 0);
    return {
      name: b.nameAr,
      Revenue: revenue,
      Cost: cost,
      Profit: revenue - cost,
    };
  });

  const totalRev = serverSummary?.overall?.revenue !== undefined
    ? Number(serverSummary.overall.revenue || 0)
    : data.reduce((a, b) => a + b.Revenue, 0);

  const totalProfit = serverSummary?.overall?.netProfit !== undefined
    ? Number(serverSummary.overall.netProfit || 0)
    : data.reduce((a, b) => a + b.Profit, 0);

  return (
    <div className="space-y-8 animate-in fade-in pb-20 md:pb-0" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span>التقارير المالية</span>
            {isLoading && <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground animate-pulse font-normal">جاري التحديث من الخادم...</span>}
          </h1>
          <p className="text-muted-foreground">تفاصيل الإيرادات والتكاليف وصافي الأرباح الشاملة لجميع الفروع.</p>
          {error && <p className="text-xs text-amber-500 font-semibold mt-1">{error}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-card shadow-sm border-border border-r-4 border-r-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">إجمالي مبيعات التجارة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalRev.toLocaleString()} ج.م</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-border border-r-4 border-r-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">إجمالي صافي الأرباح</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-600">{totalProfit.toLocaleString()} ج.م</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border pt-6">
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip cursor={{fill: 'var(--muted)'}} contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                <Bar dataKey="Revenue" name="الإيرادات" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" name="الربح" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.map(d => (
          <Card key={d.name} className="shadow-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg font-bold">{d.name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الإيرادات:</span>
                <span className="font-bold">{d.Revenue.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">التكلفة:</span>
                <span className="font-bold text-destructive">{d.Cost.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between pt-2 mt-2 border-t border-border">
                <span className="text-muted-foreground">صافي الربح:</span>
                <span className="font-bold text-green-600 text-lg">{d.Profit.toLocaleString()} ج.م</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
