import { useAuth } from '../../contexts/AuthContext';
import { store } from '../../services/store';
import { Button } from '../../components/ui/button';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  ArrowRight, MapPin, Package, ShoppingCart, QrCode, 
  ShieldCheck, LayoutDashboard, BarChart3, TrendingUp, Store
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const branches = store.getBranches();

  // Employee View -> Redirect immediately to POS page
  if (!isAdmin) {
    return <Navigate to="/pos" replace />;
  }

  // --- SUPER ADMIN LANDING PAGE (Dynamic Branch Cards + Centered Master Dashboard Card) ---
  const branchList = branches.map((b, idx) => ({ number: idx + 1, ...b }));

  return (
    <div className="min-h-full flex flex-col justify-center items-center space-y-4 sm:space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-4 sm:pb-12 pt-1 sm:pt-4" dir="rtl">
      
      {/* 1. Header Banner */}
      <div className="text-center space-y-1 sm:space-y-2 max-w-2xl px-2">
        <h1 className="text-xl sm:text-4xl font-serif font-bold text-foreground">
          المعارض والفروع الرئيسية
        </h1>
        <p className="text-[11px] sm:text-sm text-muted-foreground">
          اختر الفرع للوصول لوحته الخاصة، أو ادخل على لوحة التحكم الكلية للسوبر أدمن بالأسفل
        </p>
      </div>

      {/* 2. Main Branch Cards */}
      <div className="w-full max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 px-1 sm:px-2">
        {branchList.map((branch) => {
          return (
            <div
              key={branch.id}
              onClick={() => navigate(`/branches?id=${branch.id}`)}
              className="group relative cursor-pointer bg-card/90 backdrop-blur-lg border border-border/80 hover:border-primary rounded-2xl sm:rounded-[2rem] p-3 sm:p-7 transition-all duration-300 shadow-xs hover:shadow-xl hover:-translate-y-1 flex flex-col justify-center items-center text-center overflow-hidden min-h-[110px] sm:min-h-[170px] active:scale-[0.98] select-none"
            >
              {/* Decorative Glow */}
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors pointer-events-none" />

              {/* Branch Icon */}
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1.5 sm:mb-3 group-hover:scale-110 transition-transform shadow-xs shrink-0">
                <Store className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>

              {/* Branch Name */}
              <h3 className="text-sm sm:text-2xl font-bold font-serif text-foreground mb-0.5 sm:mb-1 group-hover:text-primary transition-colors leading-tight">
                {branch.nameAr}
              </h3>
              
              {/* Branch Location Subtitle */}
              <p className="text-[9px] sm:text-[11px] text-muted-foreground flex items-center justify-center gap-1 font-medium mt-0.5 whitespace-nowrap truncate max-w-full px-1">
                <MapPin size={11} className="text-primary shrink-0 sm:w-3.5 sm:h-3.5" />
                <span className="truncate">{branch.location}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* 3. CENTERED COMPACT ROW CARD for Super Admin Master Dashboard */}
      <div className="w-full max-w-6xl px-1 sm:px-2 pt-1 sm:pt-2">
        <div 
          onClick={() => navigate('/master-dashboard')}
          className="group relative cursor-pointer bg-card/90 backdrop-blur-xl border border-primary/40 hover:border-primary rounded-xl sm:rounded-2xl p-3 sm:p-5 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 overflow-hidden flex flex-row items-center justify-between active:scale-[0.99] select-none"
        >
          {/* Background Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all pointer-events-none" />

          <div className="relative z-10 flex flex-row items-center gap-2.5 sm:gap-4 text-right w-full">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
              <LayoutDashboard className="w-4 h-4 sm:w-6 sm:h-6" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-right overflow-hidden">
              <h2 className="text-xs sm:text-xl font-serif font-bold text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                لوحة التحكم الرئيسية
              </h2>
              <span className="hidden sm:inline text-muted-foreground/40 font-bold">•</span>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                لوحة التحكم الشاملة لجميع الفروع والموظفين والنظام
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
