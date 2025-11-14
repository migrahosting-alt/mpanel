import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Invoices from './pages/Invoices';
import Subscriptions from './pages/Subscriptions';
import Servers from './pages/Servers';
import Websites from './pages/Websites';
import DNS from './pages/DNS';
import Email from './pages/Email';
import Databases from './pages/Databases';
import Domains from './pages/Domains';
import FileManager from './pages/FileManager';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import Layout from './components/Layout';
import ServerMetrics from './pages/ServerMetrics';
import Security from './pages/Security';
import PremiumTools from './pages/PremiumTools';
import Provisioning from './pages/Provisioning';
import ServerManagement from './pages/ServerManagement';
import RoleManagement from './pages/RoleManagement';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import { CustomersPage } from './pages/CustomersPage';
import UsersPage from './pages/UsersPage';
import { DnsPage } from './pages/DnsPage';

// Client portal
import ClientLayout from './components/ClientLayout';
import ClientDashboard from './pages/client/ClientDashboard';
import ClientServices from './pages/client/ClientServices';
import ClientInvoices from './pages/client/ClientInvoices';
import ClientDomains from './pages/client/ClientDomains';
import ClientBilling from './pages/client/ClientBilling';
import ClientSupport from './pages/client/ClientSupport';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

function App() {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/welcome" element={<Welcome />} />
      
      {/* Protected routes with layout */}
      <Route path="/" element={
        <ProtectedRoute>
          {isAdmin ? <AdminDashboard /> : <Dashboard />}
        </ProtectedRoute>
      } />
      
      {/* Admin-only routes */}
      {isAdmin && (
        <>
          <Route path="/admin/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/admin/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
        </>
      )}
      
      {/* Shared routes */}
      <Route path="/servers" element={<ProtectedRoute><Servers /></ProtectedRoute>} />
      <Route path="/websites" element={<ProtectedRoute><Websites /></ProtectedRoute>} />
      <Route path="/domains" element={<ProtectedRoute><Domains /></ProtectedRoute>} />
      <Route path="/dns" element={<ProtectedRoute><DnsPage /></ProtectedRoute>} />
      <Route path="/email" element={<ProtectedRoute><Email /></ProtectedRoute>} />
      <Route path="/files" element={<ProtectedRoute><FileManager /></ProtectedRoute>} />
      <Route path="/databases" element={<ProtectedRoute><Databases /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
      <Route path="/metrics" element={<ProtectedRoute><ServerMetrics /></ProtectedRoute>} />
      <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
      <Route path="/premium-tools" element={<ProtectedRoute><PremiumTools /></ProtectedRoute>} />
      <Route path="/provisioning" element={<ProtectedRoute><Provisioning /></ProtectedRoute>} />
      <Route path="/server-management" element={<ProtectedRoute><ServerManagement /></ProtectedRoute>} />
      <Route path="/admin/roles" element={<ProtectedRoute><RoleManagement /></ProtectedRoute>} />
      
      {/* Client Portal Routes */}
      <Route path="/client" element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
        <Route index element={<ClientDashboard />} />
        <Route path="services" element={<ClientServices />} />
        <Route path="domains" element={<ClientDomains />} />
        <Route path="invoices" element={<ClientInvoices />} />
        <Route path="billing" element={<ClientBilling />} />
        <Route path="support" element={<ClientSupport />} />
      </Route>
    </Routes>
  );
}

export default App;
