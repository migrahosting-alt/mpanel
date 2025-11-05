import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Invoices from './pages/Invoices';
import Subscriptions from './pages/Subscriptions';
import Servers from './pages/Servers';
import Websites from './pages/Websites';
import DNS from './pages/DNS';
import Email from './pages/Email';
import Databases from './pages/Databases';
import Layout from './components/Layout';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/websites" element={<Websites />} />
        <Route path="/dns" element={<DNS />} />
        <Route path="/email" element={<Email />} />
        <Route path="/databases" element={<Databases />} />
        <Route path="/products" element={<Products />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
      </Routes>
    </Layout>
  );
}

export default App;
