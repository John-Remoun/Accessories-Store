import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, ShoppingCart, Package, QrCode, FileText, 
  Settings as SettingsIcon, LogOut, Sun, Moon, Users, UserPlus, Scan, BarChart3,
  Store, ChevronRight, ChevronLeft, Layers, Menu, X
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { store } from '../services/store';
import darkLogo from '../assets/dark-logo.png';
import lightLogo from '../assets/light-logo.png';

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    return localStorage.getItem('last_active_branch') || user?.branchId || 'b4';
  });

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Track branch changes from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const bId = params.get('id');
    if (bId) {
      setActiveBranchId(bId);
      localStorage.setItem('last_active_branch', bId);
    }
  }, [location.search]);

  const [previousPath, setPreviousPath] = useState<string>('/dashboard');

  // Track previous path before entering settings
  useEffect(() => {
    if (location.pathname !== '/settings') {
      setPreviousPath(location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const isLandingPage = isAdmin && (location.pathname === '/dashboard' || location.pathname === '/' || location.pathname === '/master-dashboard');
  const isSettingsPage = location.pathname === '/settings';

  const handleSettingsClick = () => {
    if (isSettingsPage) {
      navigate(previousPath || '/dashboard');
    } else {
      navigate('/settings');
    }
  };

  const currentBranch = store.getBranch(activeBranchId) || store.getBranches()[0];

  // Navigation items with dynamic branch dashboard
  const adminNav = [
    { name: 'الفروع (الشاشة الرئيسية)', path: '/dashboard', icon: Store },
    { name: `لوحة تحكم ${currentBranch ? currentBranch.nameAr : 'فرع القاهرة'}`, path: `/branches?id=${activeBranchId}`, icon: LayoutDashboard },
    { name: 'نقطة البيع', path: '/pos', icon: ShoppingCart },
    { name: 'المنتجات', path: '/products', icon: Package },
    { name: 'سجل الفواتير', path: '/invoices', icon: FileText },
    { name: 'سجل العملاء', path: `/customers?id=${activeBranchId}`, icon: Users },
    { name: 'الموظفين والطاقم', path: '/employees', icon: UserPlus },
  ];

  const employeeNav = [
    { name: 'نقطة البيع', path: '/pos', icon: ShoppingCart },
    { name: 'المنتجات', path: '/products', icon: Package },
  ];

  const navItems = isAdmin ? adminNav : employeeNav;

  return (
    <div className="flex h-screen bg-background transition-colors overflow-hidden" dir="rtl">
      
      {/* Mobile Side Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Side Drawer */}
      <aside 
        className={`fixed top-0 bottom-0 right-0 z-50 w-72 bg-card border-l border-border flex flex-col md:hidden transition-transform duration-300 shadow-2xl ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-20 flex items-center justify-between px-5 border-b border-border">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-extrabold text-amber-500 tracking-wide truncate">
              {currentBranch ? currentBranch.nameAr : 'فرع القاهرة'}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">{user?.name} ({isAdmin ? 'Super Admin' : 'موظف'})</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(false)}
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <X size={22} />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-none">
          {navItems.map((item) => {
            const currentFullUrl = location.pathname + location.search;
            const isActive = item.path.includes('?') 
              ? currentFullUrl === item.path
              : (location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path)));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-xs ${
                  isActive 
                    ? 'bg-amber-500 text-black shadow-md' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border bg-muted/20 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold text-base shrink-0">
              {user?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-foreground truncate">{user?.name}</p>
              <p className="text-[10px] text-amber-500 font-bold">{isAdmin ? 'Super Admin' : 'موظف'}</p>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 border-border text-xs font-bold rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30 h-11" 
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>تسجيل الخروج</span>
          </Button>
        </div>
      </aside>

      {/* Desktop Sidebar (Hidden on Mobile, Landing Page & Settings Page) */}
      {!isLandingPage && !isSettingsPage && (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-card border-l border-border flex flex-col hidden md:flex shrink-0 transition-all duration-300 relative overflow-x-hidden select-none`}>
          
          {/* Top Header of Sidebar with Toggle Arrow on the Far Right Edge */}
          <div className={`h-24 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-start gap-3 px-4'} border-b border-border overflow-hidden`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-xl hover:bg-muted transition-all text-muted-foreground hover:text-foreground shrink-0"
              title={isCollapsed ? "توسيع القائمة" : "طَي القائمة"}
            >
              {isCollapsed ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
            </Button>

            {!isCollapsed && (
              <span className="text-sm sm:text-base font-black text-amber-500 tracking-tight truncate min-w-0">
                {currentBranch ? currentBranch.nameAr : 'فرع القاهرة'}
              </span>
            )}
          </div>
          
          {/* Nav Items (Scrollbar Hidden) */}
          <nav className="flex-1 overflow-y-auto py-6 scrollbar-none">
            <ul className="space-y-1.5 px-3">
              {navItems.map((item) => {
                const currentFullUrl = location.pathname + location.search;
                const isActive = item.path.includes('?') 
                  ? currentFullUrl === item.path
                  : (location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path)));
                const Icon = item.icon;

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      title={isCollapsed ? item.name : undefined}
                      className={`flex items-center gap-3 ${isCollapsed ? 'justify-center px-2 py-3' : 'px-3.5 py-3'} rounded-xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-amber-500 text-black font-extrabold shadow-md' 
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} className="shrink-0" />
                      {!isCollapsed && <span className="tracking-wide text-xs truncate">{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Sidebar Footer User Info */}
          <div className="p-4 border-t border-border bg-muted/20">
            {!isCollapsed ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold text-base shrink-0">
                    {user?.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-foreground truncate">{user?.name}</p>
                    <p className="text-[10px] text-amber-500 capitalize font-bold tracking-wider">{user?.role === 'admin' ? 'Super Admin' : 'موظف'}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 border-border text-xs font-bold rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30" 
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>تسجيل الخروج</span>
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold text-sm" title={user?.name}>
                  {user?.name.charAt(0)}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl" 
                  onClick={handleLogout} 
                  title="تسجيل الخروج"
                >
                  <LogOut size={18} />
                </Button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative w-full">
        {/* Top Navbar with Centered Store Title Logo */}
        <header className="relative h-16 sm:h-20 bg-card/90 backdrop-blur-md border-b border-border flex items-center justify-between px-3 sm:px-8 z-10 shadow-xs shrink-0">
          
          {/* Right Action on Mobile: Hamburger Menu */}
          <div className="flex items-center gap-2 z-10">
            {!isLandingPage && !isSettingsPage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden rounded-xl hover:bg-muted text-foreground"
                title="القائمة الرئيسية"
              >
                <Menu size={22} />
              </Button>
            )}
          </div>

          {/* Centered Store Brand Logo (Absolute Center) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center py-1 pointer-events-auto">
            <img src={darkLogo} alt="Salla Bola & Mina" className="hidden dark:block h-10 sm:h-16 w-auto object-contain transition-all duration-300 drop-shadow-sm max-w-[150px] sm:max-w-none" />
            <img src={lightLogo} alt="Salla Bola & Mina" className="block dark:hidden h-10 sm:h-16 w-auto object-contain transition-all duration-300 drop-shadow-sm max-w-[150px] sm:max-w-none" />
          </div>

          {/* Left Action: Settings, Theme Toggle & Logout */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 z-10">
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSettingsClick} 
                className={`rounded-xl transition-all duration-300 h-9 w-9 sm:h-10 sm:w-10 shrink-0 ${
                  isSettingsPage 
                    ? 'bg-amber-500 text-black shadow-[0_0_18px_rgba(245,158,11,0.6)] border border-amber-400 hover:bg-amber-400' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`} 
                title={isSettingsPage ? "إغلاق الإعدادات والعودة" : "الإعدادات"}
              >
                <SettingsIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${isSettingsPage ? 'text-black' : 'text-muted-foreground hover:text-foreground'}`} />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
              className="rounded-xl hover:bg-muted h-9 w-9 sm:h-10 sm:w-10 shrink-0" 
              title="تغيير المظهر"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />}
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleLogout} 
              className="rounded-xl border-border/80 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30 shadow-xs h-9 w-9 sm:h-10 sm:w-10 shrink-0" 
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            </Button>
          </div>
        </header>

        {/* Page Content View */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 md:p-8 bg-muted/10 scrollbar-none pb-20 md:pb-8">
          <div className="mx-auto max-w-7xl h-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav Bar (Icon-Only with Liquid Glass Circle for POS) */}
      {!isLandingPage && !isSettingsPage && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border/80 flex justify-around items-center h-16 z-40 px-3 shadow-2xl">
          {navItems.slice(0, 4).map(item => {
            const currentFullUrl = location.pathname + location.search;
            const isActive = item.path.includes('?') 
              ? currentFullUrl === item.path
              : (location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path)));
            const Icon = item.icon;
            const isPos = item.path === '/pos';

            if (isPos) {
              return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  title={item.name}
                  className="flex items-center justify-center flex-1 transition-all py-1"
                >
                  <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 relative ${
                      isActive
                        ? 'bg-amber-500 text-black shadow-[0_0_22px_rgba(245,158,11,0.65)] scale-110 border-2 border-amber-300'
                        : 'bg-gradient-to-b from-amber-500/25 via-amber-500/15 to-amber-500/5 text-amber-400 border border-amber-500/40 backdrop-blur-xl shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:border-amber-500/70 hover:scale-105'
                    }`}
                  >
                    <ShoppingCart size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                </Link>
              );
            }

            return (
              <Link 
                key={item.path} 
                to={item.path} 
                title={item.name}
                className="flex items-center justify-center flex-1 transition-all py-1"
              >
                <div 
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                    isActive 
                      ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            title="القائمة الرئيسية"
            className="flex items-center justify-center flex-1 transition-all py-1"
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
              <Menu size={20} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
