import React from 'react';
import { ArrowUpRight, DollarSign, Package, FileText, ChevronRight, Lock } from 'lucide-react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, change, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-2">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm text-emerald-600">
      <ArrowUpRight className="w-4 h-4 mr-1" />
      <span className="font-medium">{change}</span>
      <span className="text-slate-400 ml-1">较上月</span>
    </div>
  </div>
);

const Dashboard = () => {
  const { products, quotes, currentUser } = useStore();
  const navigate = useNavigate();

  // Handle Guest Role (No Permissions)
  if (currentUser?.role === 'guest') {
      return (
          <div className="flex flex-col items-center justify-center h-[80vh] text-center animate-in fade-in zoom-in duration-300">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Lock className="w-10 h-10 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">账号待授权</h2>
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 max-w-md text-left mt-4">
                  <p className="text-orange-800 text-sm font-medium mb-1">OAuth 登录成功</p>
                  <p className="text-orange-700 text-xs">
                      您的账号已创建，但系统尚未分配任何功能权限。出于安全考虑，新注册的第三方账号默认为“访客”状态。
                  </p>
              </div>
              <p className="text-slate-500 mt-6 text-sm">
                  请联系系统管理员激活您的账号并分配角色 (Admin/Designer/Sales)。
              </p>
              <div className="mt-2 text-xs text-slate-400 font-mono">
                  Current User ID: {currentUser.id}
              </div>
          </div>
      )
  }

  // Calculate Stats
  const totalRevenue = quotes.reduce((sum, q) => sum + q.grandTotal, 0);
  const activeQuotesCount = quotes.length;
  const totalProductsCount = products.length;

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Approved': return 'bg-emerald-100 text-emerald-700';
          case 'Sent': return 'bg-blue-100 text-blue-700';
          default: return 'bg-slate-100 text-slate-600';
      }
  };

  const handleQuoteClick = (quote: any) => {
      navigate('/quotes', { state: { quoteData: quote } });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">系统概览</h2>
          <p className="text-slate-500">欢迎回到您的 CPQ 工作台。</p>
        </div>
        <button 
            onClick={() => navigate('/quotes')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors"
        >
            <FileText className="w-4 h-4" /> 新建报价
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            title="总收入 (Total Revenue)" 
            value={`¥${totalRevenue.toLocaleString()}`} 
            change="+12.5%" 
            icon={DollarSign} 
            color="bg-blue-500" 
        />
        <StatCard 
            title="报价单数量 (Quotes)" 
            value={activeQuotesCount} 
            change="+8.2%" 
            icon={FileText} 
            color="bg-emerald-500" 
        />
        <StatCard 
            title="产品总数 (Products)" 
            value={totalProductsCount.toLocaleString()} 
            change="+2.4%" 
            icon={Package} 
            color="bg-violet-500" 
        />
      </div>

      {/* Recent Quotes List (Full Width) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">最近报价详表</h3>
              <button 
                  onClick={() => navigate('/quotes')}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                  前往智能报价 <ChevronRight className="w-4 h-4" />
              </button>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                      <tr>
                          <th className="px-6 py-4">报价单号</th>
                          <th className="px-6 py-4">客户名称</th>
                          <th className="px-6 py-4">日期</th>
                          <th className="px-6 py-4">金额</th>
                          <th className="px-6 py-4">状态</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {quotes.slice(0, 10).map((quote) => (
                          <tr 
                              key={quote.id} 
                              onClick={() => handleQuoteClick(quote)}
                              className="hover:bg-slate-50 transition-colors cursor-pointer group"
                              title="点击重新配置此报价"
                          >
                              <td className="px-6 py-4 text-sm font-medium text-slate-700 group-hover:text-blue-600">
                                  {quote.id}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                  {quote.customerName}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-500">
                                  {new Date(quote.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                  ¥{quote.grandTotal.toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(quote.status)}`}>
                                      {quote.status}
                                  </span>
                              </td>
                          </tr>
                      ))}
                      {quotes.length === 0 && (
                          <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                  暂无报价数据
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;