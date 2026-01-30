import React, { useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Command, ChevronDown, ChevronUp } from 'lucide-react';
import { AuthProvider } from '../types';

const Login = () => {
  const { login, loginWithProvider } = useStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
        const result = login(username, password);
        if (result.success) {
            navigate('/');
        } else {
            setError(result.message || '登录失败');
            setIsLoading(false);
        }
    }, 600);
  };

  const handleOAuthLogin = (provider: AuthProvider) => {
      setIsLoading(true);
      // Simulate OAuth redirect flow
      setTimeout(() => {
          let mockEmail = '';
          switch(provider) {
              case 'google': mockEmail = 'user@gmail.com'; break;
              case 'microsoft': mockEmail = 'user@outlook.com'; break;
              case 'github': mockEmail = 'dev@github.com'; break;
          }
          
          if (loginWithProvider(provider, mockEmail)) {
              navigate('/');
          } else {
              setError('OAuth 授权失败');
              setIsLoading(false);
          }
      }, 1000);
  };

  const demoUsers = [
      { id: 1, label: '管理员', color: 'bg-slate-800', pass: 'admin' },
      { id: 3, label: '设计师', color: 'bg-violet-600', pass: '123' },
      { id: 2, label: '销售人员', color: 'bg-blue-600', pass: '123' },
  ];

  const fillDemo = (u: number, p: string) => {
      if (u === 1) setUsername('admin');
      else if (u === 2) setUsername('sales'); // Assuming mock sales user exists or created via api
      else if (u === 3) setUsername('design');
      
      setPassword(p);
      setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
             <Command className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">CloudCPQ</h1>
        <p className="text-slate-500 mt-2">企业级智能配置报价系统</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 relative overflow-hidden">
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-500 font-medium">正在验证身份...</p>
                </div>
            </div>
        )}

        <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">账号登录</h2>
            <p className="text-sm text-slate-400">使用您的企业账号或 SSO 单点登录</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
            <button 
                onClick={() => handleOAuthLogin('google')}
                className="flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all group"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800">Google</span>
            </button>
             <button 
                onClick={() => handleOAuthLogin('microsoft')}
                className="flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all group"
            >
                <svg className="w-5 h-5" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800">Microsoft</span>
            </button>
        </div>

        <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-400">或使用账号密码</span>
            </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名 / 邮箱 / 工号</label>
            <div className="relative">
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="EMP1001"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
              />
              <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">密码</label>
                <a href="#" className="text-xs text-blue-600 hover:text-blue-700">忘记密码?</a>
            </div>
            <div className="relative">
              <input
                type="password"
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
              />
              <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
               <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] mt-2"
          >
            登录
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4">
            <button 
                onClick={() => setShowDemo(!showDemo)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-600 py-2"
            >
                <span>开发测试通道 (Quick Fill)</span>
                {showDemo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {showDemo && (
                <div className="grid grid-cols-3 gap-3 mt-2 animate-in fade-in slide-in-from-top-2">
                    {demoUsers.map(u => (
                        <button 
                            key={u.id}
                            onClick={() => fillDemo(u.id, u.pass)}
                            className={`py-2 px-1 rounded-lg text-white text-xs font-medium transition-transform hover:-translate-y-0.5 shadow-md ${u.color}`}
                        >
                            {u.label}
                            <div className="text-[10px] opacity-70 font-mono mt-0.5">{u.id}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>
      
      <p className="text-xs text-slate-400 mt-8">© 2024 CloudCPQ Inc. Security protected by MockAuth.</p>
    </div>
  );
};

export default Login;