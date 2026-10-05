import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/auth/Login';
import { Dashboard } from './pages/dashboard/Dashboard';
import { POS } from './pages/pos/POS';
import { Products } from './pages/products/Products';
import { Inventory } from './pages/inventory/Inventory';
import { QRCodes } from './pages/qrcodes/QRCodes';
import { Invoices } from './pages/invoices/Invoices';
import { Settings } from './pages/settings/Settings';
import { Branches } from './pages/dashboard/Branches';
import { MasterDashboard } from './pages/dashboard/MasterDashboard';
import { Employees } from './pages/dashboard/Employees';
import { Reports } from './pages/dashboard/Reports';
import { Customers } from './pages/customers/Customers';

import { ProductCompositions } from './pages/products/ProductCompositions';

import { SplashScreen } from './components/SplashScreen';

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        
        {/* Protected Routes */}
        <Route path="/" element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="master-dashboard" element={<MasterDashboard />} />
          <Route path="branches" element={<Branches />} />
          <Route path="employees" element={<Employees />} />
          <Route path="reports" element={<Reports />} />
          <Route path="customers" element={<Customers />} />
          <Route path="pos" element={<POS />} />
          <Route path="products" element={<Products />} />
          <Route path="product-compositions" element={<ProductCompositions />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="qr-codes" element={<QRCodes />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
