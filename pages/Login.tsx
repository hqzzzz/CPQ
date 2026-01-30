
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, User, AlertCircle, Command, Loader2, Settings, X, Server, Key, ArrowRight } from 'lucide-react';
import { AuthProvider } from '../types';
import { apiService } from '../services/api';
import md5 from 'md5';

const Login = () => {
  const { login, initiateOAuthLogin, completeOAuthLogin } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [apiConfig, setApiConfig] = useState({ 
      baseUrl: 'http://localhost:3002/api', 
      apiKey: '' 
  });

  // Load Settings
  useEffect(() => {
      const saved = localStorage.getItem('cpq_api_config');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              setApiConfig(prev => ({ ...prev, ...parsed }));
          } catch(e) {}
      }
  }, []);

  const handleSaveSettings = () => {
      localStorage.setItem('cpq_api_config', JSON.stringify(apiConfig));
      setShowSettings(false);
      window.location.reload(); // Refresh to apply new connection settings
  };

  // Handle OAuth Callback
  useEffect(() => {
      const handleCallback = async () => {
          const params = new URLSearchParams(location.search);
          const code = params.get('code');
          const state = params.get('state'); // 'google', 'microsoft', 'wechat'

          if (code && state) {
              setIsLoading(true);
              setStatusMsg('正在验证 OAuth 授权...');
              
              const success = await completeOAuthLogin(state as AuthProvider, code);
              if (success) {
                  navigate('/dashboard');
              } else {
                  setError('OAuth 登录失败，请重试。');
                  setIsLoading(false);
                  setStatusMsg('');
              }
          }
      };
      
      handleCallback();
  }, [location, completeOAuthLogin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg('正在验证身份...');
    setError('');
    
    // Hash password with MD5 before sending
    const hashedPassword = md5(password);

    // 1. Try local login (cache check via store)
    // Note: This relies on Store having fetched users. 
    // If backend is down, Store.users might be empty, causing login failure.
    const result = login(username, hashedPassword);
    
    if (result.success) {
        navigate('/dashboard');
        return;
    } 

    // 2. If login failed, diagnose: Is it Auth Error or Network Error?
    // We attempt a lightweight ping to the server.
    setStatusMsg('登录失败，正在检测服务器连接...');
    
    try {
        const connection = await apiService.testConnection();
        if (connection.success) {
            // Backend is reachable, so it must be invalid credentials
            setError('账号或密码错误，请重试。');
        } else {
            // Backend reached but returned failure (unlikely for testConnection)
            setError('服务器连接异常: ' + (connection.message || '未知错误'));
        }
    } catch (err: any) {
        // Network request failed completely
        setError('无法连接到服务器。请检查 API 地址配置或网络状态。');
    }

    setIsLoading(false);
    setStatusMsg('');
  };

  const handleOAuthClick = async (provider: AuthProvider) => {
      setIsLoading(true);
      setStatusMsg(`正在连接 ${provider} ...`);
      setError('');
      
      const success = await initiateOAuthLogin(provider);
      if (!success) {
          setError(`无法连接到 ${provider} 授权服务。请检查网络或后端配置。`);
          setIsLoading(false);
          setStatusMsg('');
      }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 bg-[#0f172a] overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-[#0f172a] to-[#0f172a] z-0"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px] animate-pulse z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] z-0"></div>

      {/* Buttons Top Right */}
      <div className="absolute top-6 right-6 flex gap-2 z-20">
        <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            title="服务器配置"
        >
            <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md">
          {/* Main Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                        <p className="text-sm text-slate-300 font-medium">{statusMsg || '请稍候...'}</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 mb-4 shadow-lg shadow-blue-500/40 ring-1 ring-white/20">
                    <Command className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">CloudCPQ</h1>
                <p className="text-slate-400 mt-2 text-sm">企业级智能配置报价系统</p>
            </div>

            {/* OAuth */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                    onClick={() => handleOAuthClick('google')}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition-all group disabled:opacity-50"
                >
                    <svg className="w-5 h-5 opacity-90 group-hover:opacity-100" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white">Google</span>
                </button>
                <button 
                    onClick={() => handleOAuthClick('microsoft')}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition-all group disabled:opacity-50"
                >
                    <svg className="w-5 h-5 opacity-90 group-hover:opacity-100" viewBox="0 0 23 23">
                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                    </svg>
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white">Microsoft</span>
                </button>
            </div>

            <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                    <span className="px-2 bg-[#161e31] text-slate-500 rounded">第三方登录 / 或使用账号</span>
                </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">账号</label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder:text-slate-600"
                    placeholder="工号 / 用户名 / 邮箱"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(''); }}
                    disabled={isLoading}
                  />
                  <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1 ml-1">
                    <label className="block text-xs font-medium text-slate-400">密码</label>
                    <a href="#" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">忘记密码?</a>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder:text-slate-600"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                   <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/50 transition-all active:scale-[0.98] mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                登录
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-xs text-slate-400">
                    还没有账号? {' '}
                    <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        立即注册
                    </Link>
                </p>
            </div>
          </div>
          
          <p className="text-xs text-slate-500 mt-8 text-center">
              © 2024 CloudCPQ Inc. 已建立安全连接
          </p>
      </div>

      {/* Settings Modal */}
      {showSettings && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-blue-600" />
                          连接配置
                      </h3>
                      <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-6 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">后端 API 地址</label>
                          <div className="relative">
                              <input 
                                  type="text" 
                                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                  placeholder="http://localhost:3002/api"
                                  value={apiConfig.baseUrl}
                                  onChange={e => setApiConfig({...apiConfig, baseUrl: e.target.value})}
                              />
                              <Server className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">API 密钥 (可选)</label>
                          <div className="relative">
                              <input 
                                  type="password" 
                                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                  placeholder="sk-..."
                                  value={apiConfig.apiKey}
                                  onChange={e => setApiConfig({...apiConfig, apiKey: e.target.value})}
                              />
                              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          </div>
                      </div>
                      <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-100 leading-relaxed">
                          配置将保存在本地。点击“保存并重连”将刷新页面以应用新设置。
                      </div>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                      <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">取消</button>
                      <button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium shadow-sm transition-colors">保存并重连</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Login;
