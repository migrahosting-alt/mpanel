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

// Premium Features
import SSLCertificatesPage from './pages/SSLCertificatesPage';
import AppInstallerPage from './pages/AppInstallerPage';
import APIKeysPage from './pages/APIKeysPage';
import BackupsPage from './pages/BackupsPage';
import AIFeatures from './pages/AIFeatures';
import WebSocketPage from './pages/WebSocketPage';
import GraphQLPage from './pages/GraphQLPage';
import Analytics from './pages/Analytics';
import Kubernetes from './pages/Kubernetes';
import CDNManagement from './pages/CDNManagement';
import MonitoringPage from './pages/MonitoringPage';
import APIMarketplace from './pages/APIMarketplace';
import WhiteLabel from './pages/WhiteLabel';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import { CustomersPage } from './pages/CustomersPage';
import UsersPage from './pages/UsersPage';
import { DnsPage } from './pages/DnsPage';
import GuardianManagement from './pages/GuardianManagement';

// Client portal
import ClientLayout from './components/ClientLayout';
import ClientDashboard from './pages/client/ClientDashboard';
import ClientServices from './pages/client/ClientServices';
import ClientInvoices from './pages/client/ClientInvoices';
import ClientDomains from './pages/client/ClientDomains';
import ClientBilling from './pages/client/ClientBilling';
import ClientSupport from './pages/client/ClientSupport';

// Service Management Pages (Client Portal)
import SSLManagement from './pages/services/SSLManagement';
import BackupManagement from './pages/services/BackupManagement';
import EmailManagement from './pages/services/EmailManagement';
import Migration from './pages/services/Migration';

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
          <Route path="/admin/guardian" element={<ProtectedRoute><GuardianManagement /></ProtectedRoute>} />
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
      
      {/* Premium Features Routes */}
      <Route path="/ssl-certificates" element={<ProtectedRoute><SSLCertificatesPage /></ProtectedRoute>} />
      <Route path="/app-installer" element={<ProtectedRoute><AppInstallerPage /></ProtectedRoute>} />
      <Route path="/api-keys" element={<ProtectedRoute><APIKeysPage /></ProtectedRoute>} />
      <Route path="/backups" element={<ProtectedRoute><BackupsPage /></ProtectedRoute>} />
      <Route path="/ai" element={<ProtectedRoute><AIFeatures /></ProtectedRoute>} />
      <Route path="/websocket" element={<ProtectedRoute><WebSocketPage /></ProtectedRoute>} />
      <Route path="/graphql" element={<ProtectedRoute><GraphQLPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/kubernetes" element={<ProtectedRoute><Kubernetes /></ProtectedRoute>} />
      <Route path="/cdn" element={<ProtectedRoute><CDNManagement /></ProtectedRoute>} />
      <Route path="/monitoring" element={<ProtectedRoute><MonitoringPage /></ProtectedRoute>} />
      <Route path="/marketplace" element={<ProtectedRoute><APIMarketplace /></ProtectedRoute>} />
      <Route path="/api-marketplace" element={<ProtectedRoute><APIMarketplace /></ProtectedRoute>} />
      <Route path="/white-label" element={<ProtectedRoute><WhiteLabel /></ProtectedRoute>} />
      
      {/* Client Portal Routes */}
      <Route path="/client" element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
        <Route index element={<ClientDashboard />} />
        <Route path="services" element={<ClientServices />} />
        <Route path="domains" element={<ClientDomains />} />
        <Route path="invoices" element={<ClientInvoices />} />
        <Route path="billing" element={<ClientBilling />} />
        <Route path="support" element={<ClientSupport />} />
        
        {/* Basic Service Management (All Customers) */}
        <Route path="ssl" element={<SSLManagement />} />
        <Route path="email-management" element={<EmailManagement />} />
        
        {/* Premium Service Management (Add-on Features) */}
        <Route path="backups" element={<BackupManagement />} />
        <Route path="migration" element={<Migration />} />
      </Route>
      
      {/* Standalone Premium Service Routes (can also be accessed directly) */}
      <Route path="/manage/ssl" element={<ProtectedRoute><SSLManagement /></ProtectedRoute>} />
      <Route path="/manage/backups" element={<ProtectedRoute><BackupManagement /></ProtectedRoute>} />
      <Route path="/manage/email" element={<ProtectedRoute><EmailManagement /></ProtectedRoute>} />
      <Route path="/migrate" element={<ProtectedRoute><Migration /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
