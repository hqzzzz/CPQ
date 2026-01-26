import React, { useState, useRef } from 'react';
import { Camera, Lock, Shield } from 'lucide-react';
import { useStore } from '../../store';

const ProfileSettings = () => {
    const { currentUser, updateUser, roles, changePassword } = useStore();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [pwdForm, setPwdForm] = useState({ old: '', new: '', confirm: '' });
    const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

    if (!currentUser) return null;

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateUser({ ...currentUser, avatar: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (pwdForm.new !== pwdForm.confirm) {
            setPwdMsg({ type: 'error', text: '两次输入的新密码不一致' });
            return;
        }
        if (pwdForm.new.length < 3) {
            setPwdMsg({ type: 'error', text: '密码长度至少为 3 位' });
            return;
        }

        const result = changePassword(currentUser.id, pwdForm.old, pwdForm.new);
        if (result.success) {
            setPwdMsg({ type: 'success', text: '密码修改成功' });
            setPwdForm({ old: '', new: '', confirm: '' });
        } else {
            setPwdMsg({ type: 'error', text: result.message || '修改失败' });
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-4">
            {/* Profile Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1">
                <div className="flex flex-col items-center text-center">
                    <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                        <img 
                          src={currentUser.avatar} 
                          alt="Avatar" 
                          className="w-24 h-24 rounded-full border-4 border-slate-50 object-cover" 
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-8 h-8 text-white" />
                        </div>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-slate-800">{currentUser.name}</h3>
                    <p className="text-slate-500 text-sm">@{currentUser.username}</p>
                    
                    <div className="mt-6 w-full space-y-3">
                        <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                            <span className="text-slate-500">工号 ID</span>
                            <span className="font-mono text-slate-700">{currentUser.employeeId || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                            <span className="text-slate-500">职位</span>
                            <span className="text-slate-700">{currentUser.title || '未设置'}</span>
                        </div>
                        <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                            <span className="text-slate-500">部门</span>
                            <span className="text-slate-700">{currentUser.department || '未设置'}</span>
                        </div>
                        <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                            <span className="text-slate-500">角色</span>
                            <span className="capitalize px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                                {roles.find(r => r.id === currentUser.role)?.name || currentUser.role}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                 <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Lock className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                          <h3 className="text-lg font-semibold text-slate-800">安全设置</h3>
                          <p className="text-sm text-slate-500">管理您的登录密码及账户安全。</p>
                      </div>
                 </div>

                 {currentUser.authProvider !== 'local' ? (
                     <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                         <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                         <div>
                             <p className="text-sm font-medium text-blue-800">账户由 {currentUser.authProvider} 托管</p>
                             <p className="text-xs text-blue-600 mt-1">您使用了第三方 OAuth 登录，请在对应的提供商处修改密码或管理安全设置。</p>
                         </div>
                     </div>
                 ) : (
                     <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                         <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">当前旧密码</label>
                             <input 
                                type="password" 
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={pwdForm.old}
                                onChange={e => setPwdForm({...pwdForm, old: e.target.value})}
                             />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="block text-sm font-medium text-slate-700 mb-1">新密码</label>
                                 <input 
                                    type="password" 
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={pwdForm.new}
                                    onChange={e => setPwdForm({...pwdForm, new: e.target.value})}
                                 />
                             </div>
                             <div>
                                 <label className="block text-sm font-medium text-slate-700 mb-1">确认新密码</label>
                                 <input 
                                    type="password" 
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={pwdForm.confirm}
                                    onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})}
                                 />
                             </div>
                         </div>
                         
                         {pwdMsg.text && (
                             <div className={`text-sm p-2 rounded ${pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                 {pwdMsg.text}
                             </div>
                         )}

                         <div className="pt-2">
                             <button 
                                type="submit"
                                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                             >
                                 更新密码
                             </button>
                         </div>
                     </form>
                 )}
            </div>
        </div>
    );
};

export default ProfileSettings;