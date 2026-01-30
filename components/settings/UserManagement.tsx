
import React, { useState } from 'react';
import { Users, Plus, Lock, Edit2, Trash2, User as UserIcon, X, Briefcase, Mail, Key } from 'lucide-react';
import { useStore } from '../../store';
import { User } from '../../types';
import md5 from 'md5';

const UserManagement = () => {
    const { currentUser, users, roles, addUser, updateUser, deleteUser } = useStore();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    const handleAddUser = () => {
        setEditingUser({
            id: Date.now(), // Numeric ID
            employeeId: '',
            username: '',
            name: '',
            email: '',
            role: 2, // Default to Sales (ID 2)
            title: '',
            department: '',
            authProvider: 'local',
            avatar: ''
        });
        setIsUserModalOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser({...user}); 
        setIsUserModalOpen(true);
    };

    const handleDeleteUser = (id: number) => {
        if (id === currentUser?.id) {
            alert("无法删除当前登录用户。");
            return;
        }
        if (confirm("确定要删除此用户吗？此操作无法撤销。")) {
            deleteUser(id);
        }
    };

    const handleSaveUser = () => {
        if (!editingUser || !editingUser.username || !editingUser.name) {
            alert("用户名和姓名不能为空");
            return;
        }
        const existing = users.find(u => (u.username === editingUser.username || (editingUser.email && u.email === editingUser.email)) && u.id !== editingUser.id);
        if (existing) {
            alert("用户名或邮箱已存在，请更换。");
            return;
        }
        const isUpdate = users.some(u => u.id === editingUser.id);
        if (isUpdate) {
            updateUser(editingUser);
        } else {
            if (editingUser.authProvider === 'local' && !editingUser.password) {
                // Default hash for '123456'
                editingUser.password = md5('123456'); 
            } else if (editingUser.authProvider === 'local' && editingUser.password) {
                // Hash provided password
                editingUser.password = md5(editingUser.password);
            }
            addUser(editingUser);
        }
        setIsUserModalOpen(false);
        setEditingUser(null);
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
             <div className="flex justify-between items-start mb-6">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">用户列表</h3>
                        <p className="text-sm text-slate-500">分配用户到指定的角色组。</p>
                    </div>
                 </div>
                 {currentUser?.role === 1 && ( // Admin is 1
                     <button 
                        onClick={handleAddUser}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700"
                     >
                         <Plus className="w-4 h-4" /> 添加用户
                     </button>
                 )}
             </div>

             {currentUser?.role !== 1 ? (
                 <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center gap-3 text-red-700">
                     <Lock className="w-5 h-5" />
                     <span>您没有权限管理用户。请联系管理员。</span>
                 </div>
             ) : (
                 <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                         <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                             <tr>
                                 <th className="p-4 rounded-tl-lg">员工信息</th>
                                 <th className="p-4">所属角色</th>
                                 <th className="p-4">工号/邮箱</th>
                                 <th className="p-4 text-right rounded-tr-lg">操作</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {users.map(user => {
                                 const roleDef = roles.find(r => r.id === user.role);
                                 return (
                                 <tr key={user.id} className="hover:bg-slate-50">
                                     <td className="p-4">
                                         <div className="flex items-center gap-3">
                                             {user.avatar ? (
                                                <img src={user.avatar} className="w-8 h-8 rounded-full border border-slate-200 object-cover" alt="" />
                                             ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                             )}
                                             <div>
                                                 <div className="font-medium text-slate-800 flex items-center gap-2">
                                                     {user.name}
                                                     {user.authProvider !== 'local' && (
                                                         <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 px-1 rounded uppercase">{user.authProvider}</span>
                                                     )}
                                                 </div>
                                                 <div className="text-xs text-slate-500">@{user.username}</div>
                                             </div>
                                         </div>
                                     </td>
                                     <td className="p-4">
                                         <span className={`px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200`}>
                                             {roleDef ? roleDef.name : user.role}
                                         </span>
                                     </td>
                                     <td className="p-4">
                                         <div className="text-sm text-slate-700 font-mono">{user.employeeId || '-'}</div>
                                         <div className="text-xs text-slate-400">{user.email || '-'}</div>
                                     </td>
                                     <td className="p-4 text-right">
                                         <div className="flex justify-end gap-2">
                                             <button 
                                                onClick={() => handleEditUser(user)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                             >
                                                 <Edit2 className="w-4 h-4" />
                                             </button>
                                             {user.id !== currentUser?.id && (
                                                <button 
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                             )}
                                         </div>
                                     </td>
                                 </tr>
                             )})}
                         </tbody>
                     </table>
                 </div>
             )}

            {isUserModalOpen && editingUser && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <UserIcon className="w-5 h-5" />
                                {users.some(u => u.id === editingUser.id) ? '编辑用户' : '新建用户'}
                            </h3>
                            <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-slate-700 mb-1">工号 (Employee ID)</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                className="w-full p-2 pl-7 border border-slate-300 rounded-lg text-sm"
                                                value={editingUser.employeeId || ''}
                                                onChange={e => setEditingUser({...editingUser, employeeId: e.target.value})}
                                                placeholder="EMP001"
                                            />
                                            <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                        </div>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-slate-700 mb-1">姓名</label>
                                        <input 
                                            type="text" 
                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                            value={editingUser.name}
                                            onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">电子邮箱</label>
                                    <div className="relative">
                                        <input 
                                            type="email" 
                                            className="w-full p-2 pl-7 border border-slate-300 rounded-lg text-sm"
                                            value={editingUser.email || ''}
                                            onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                                            placeholder="user@company.com"
                                        />
                                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">登录用户名</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            className="w-full p-2 pl-7 border border-slate-300 rounded-lg text-sm"
                                            value={editingUser.username}
                                            onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                                        />
                                        <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">系统角色 (Role)</label>
                                    <select 
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-blue-50/50"
                                        value={editingUser.role}
                                        onChange={e => setEditingUser({...editingUser, role: Number(e.target.value)})}
                                    >
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">
                                        当前选择角色的权限: {roles.find(r => r.id === editingUser.role)?.description}
                                    </p>
                                </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
                            <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
                            <button 
                                onClick={handleSaveUser}
                                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20"
                            >
                                保存用户
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
