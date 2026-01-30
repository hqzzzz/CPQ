
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProductManager from './pages/ProductManager';
import TypeManager from './pages/TypeManager';
import CategoryManager from './pages/CategoryManager';
import BOMBuilder from './pages/BOMBuilder';
import QuoteGenerator from './pages/QuoteGenerator';
import ProductionOrder from './pages/ProductionOrder';
import TemplateManager from './pages/TemplateManager';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import PrivateRoute from './components/auth/PrivateRoute';
import MainLayout from './components/layout/MainLayout';

const App = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Redirect root to dashboard (which handles auth check) */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/dashboard" element={<PrivateRoute><MainLayout><Dashboard /></MainLayout></PrivateRoute>} />
        <Route path="/types" element={<PrivateRoute><MainLayout><TypeManager /></MainLayout></PrivateRoute>} />
        <Route path="/categories" element={<PrivateRoute><MainLayout><CategoryManager /></MainLayout></PrivateRoute>} />
        <Route path="/products" element={<PrivateRoute><MainLayout><ProductManager /></MainLayout></PrivateRoute>} />
        <Route path="/bom" element={<PrivateRoute><MainLayout><BOMBuilder /></MainLayout></PrivateRoute>} />
        <Route path="/quotes" element={<PrivateRoute><MainLayout><QuoteGenerator /></MainLayout></PrivateRoute>} />
        <Route path="/production" element={<PrivateRoute><MainLayout><ProductionOrder /></MainLayout></PrivateRoute>} />
        <Route path="/templates" element={<PrivateRoute><MainLayout><TemplateManager /></MainLayout></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><MainLayout><Settings /></MainLayout></PrivateRoute>} />
      </Routes>
    </HashRouter>
  );
};

export default App;
