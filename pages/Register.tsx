
import React, { useState } from 'react';
import { useStore } from '../store';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, AlertCircle, Command, Mail, ArrowRight, Loader2, CheckCircle2, Briefcase } from 'lucide-react';
import md5 from 'md5';

const Register = () => {
  const { register } = useStore();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
      username: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
        setError('两次输入的密码不一致');
        return;
    }
    if (formData.password.length < 6) {
        setError('密码长度至少为 6 位');
        return;
    }

    setIsLoading(true);
    
    // Simulate slight delay for effect
    await new Promise(r => setTimeout(r, 600));

    // Hash the password using MD5 before sending to backend/store
    const hashedPassword = md5(formData.password);

    const result = await register({
        username: formData.username,
        name: formData.name,
        email: formData.email,
        password: hashedPassword
    });

    setIsLoading(false);

    if (result.success) {
        setSuccess(result.message || '注册成功！正在跳转登录页...');
        setTimeout(() => {
            navigate('/login');
        }, 1500);
    } else {
        setError(result.message || '注册失败，请重试');
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 bg-[#0f172a] overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-[#0f172a] to-[#0f172a] z-0"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px] animate-pulse z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] z-0"></div>

      <div className="relative z-10 w-full max-w-md">
          {/* Main Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 mb-4 shadow-lg shadow-blue-500/40 ring-1 ring-white/20">
                    <Command className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">创建新账号</h1>
                <p className="text-slate-400 mt-2 text-sm">注册 CloudCPQ 企业版</p>
            </div>

            {/* Register Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Employee ID (Username) */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">工号 (作为登录账号)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder:text-slate-600 text-sm"
                    placeholder="请输入工号 (如: EMP001)"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    disabled={isLoading}
                  />
                  <Briefcase className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Full Name - Separate Line */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">真实姓名</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder:text-slate-600 text-sm"
                    placeholder="请输入您的姓名"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    disabled={isLoading}
                  />
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">电子邮箱</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder:text-slate-600 text-sm"
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    disabled={isLoading}
                  />
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                </div>
              </div>
              
              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">设置密码</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder:text-slate-600 text-sm"
                    placeholder="至少 6 位字符"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">确认密码</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder:text-slate-600 text-sm"
                    placeholder="再次输入密码"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                   <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                   <CheckCircle2 className="w-4 h-4" /> {success}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/50 transition-all active:scale-[0.98] mt-4 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                        注册账号
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-xs text-slate-400">
                    已有账号? {' '}
                    <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        直接登录
                    </Link>
                </p>
            </div>
          </div>
          
          <p className="text-xs text-slate-500 mt-8 text-center">
              © 2024 CloudCPQ Inc. 已建立安全连接
          </p>
      </div>
    </div>
  );
};

export default Register;
