import React from 'react';
import { LayoutDashboard, Layers, FileText, Settings, Database, HardDrive, Tags, LogOut, Factory, FileSpreadsheet } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ResourceKey } from '../types';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout, hasPermission } = useStore();

  const allNavItems: { icon: any, label: string, path: string, resource: ResourceKey }[] = [
    { icon: LayoutDashboard, label: '仪表盘', path: '/', resource: 'dashboard' },
    { icon: Tags, label: '产品类型管理', path: '/types', resource: 'types' },
    { icon: Database, label: '产品库管理', path: '/products', resource: 'products' },
    { icon: Layers, label: 'BOM 构建', path: '/bom', resource: 'bom' },
    { icon: FileText, label: '智能报价', path: '/quotes', resource: 'quotes' },
    { icon: Factory, label: '生产单管理', path: '/production', resource: 'production' },
    { icon: FileSpreadsheet, label: '模板管理', path: '/templates', resource: 'templates' },
    { icon: HardDrive, label: '系统设置', path: '/settings', resource: 'settings' },
  ];

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  // Permission Logic using granular checks
  const navItems = allNavItems.filter(item => {
      // Dashboard is typically always visible to logged in users, or explicit permission
      if (item.path === '/') return true; 
      // If resource check fails, hide it
      return hasPermission(item.resource, 'view');
  });

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 border-b border-slate-700 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">CloudCPQ</h1>
          <p className="text-xs text-slate-400">企业版 V2.0</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-xl p-4 mb-2">
            <div className="flex items-center gap-3 mb-3">
                <img src={currentUser?.avatar || "https://picsum.photos/40/40"} alt="User" className="w-10 h-10 rounded-full border-2 border-slate-600" />
                <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{currentUser?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{currentUser?.title}</p>
                </div>
            </div>
            <div className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-700 text-center uppercase">
                {currentUser?.role}
            </div>
        </div>
        <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 py-2 rounded-lg transition-colors"
        >
            <LogOut className="w-4 h-4" /> 退出登录
        </button>
      </div>
    </div>
  );
};

export default Sidebar;