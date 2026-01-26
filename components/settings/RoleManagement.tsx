import React, { useState } from 'react';
import { Shield, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { useStore } from '../../store';
import { RoleDefinition, ResourceKey, ActionKey } from '../../types';

const RESOURCES: { key: ResourceKey, label: string }[] = [
    { key: 'dashboard', label: '仪表盘' },
    { key: 'products', label: '产品库' },
    { key: 'types', label: '产品类型' },
    { key: 'bom', label: 'BOM 构建' },
    { key: 'quotes', label: '智能报价' },
    { key: 'production', label: '生产单' },
    { key: 'templates', label: '模板管理' },
    { key: 'users', label: '用户管理' },
    { key: 'settings', label: '系统设置' },
];

const ACTIONS: { key: ActionKey, label: string }[] = [
    { key: 'view', label: '查看 / 进入' },
    { key: 'create', label: '新增' },
    { key: 'edit', label: '编辑' },
    { key: 'delete', label: '删除' },
    { key: 'view_cost', label: '查看成本价' },
    { key: 'export', label: '导出数据' },
];

const RoleManagement = () => {
    const { currentUser, roles, users, addRole, updateRole, deleteRole } = useStore();
    const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

    const handleAddRole = () => {
        setEditingRole({
            id: `role-${Date.now()}`,
            name: '',
            description: '',
            isSystem: false,
            permissions: {
                dashboard: ['view']
            }
        });
        setIsRoleModalOpen(true);
    };

    const handleEditRole = (role: RoleDefinition) => {
        setEditingRole(JSON.parse(JSON.stringify(role)));
        setIsRoleModalOpen(true);
    };

    const handleDeleteRole = (id: string) => {
        if (roles.find(r => r.id === id)?.isSystem) {
            alert("系统默认角色无法删除。");
            return;
        }
        if (users.some(u => u.role === id)) {
            alert("无法删除：该角色已分配给用户。请先修改用户角色。");
            return;
        }
        if (confirm("确定要删除此角色吗？")) {
            deleteRole(id);
        }
    };

    const toggleRolePermission = (resource: ResourceKey, action: ActionKey) => {
        if (!editingRole) return;
        const currentPerms = editingRole.permissions[resource] || [];
        let newPerms: ActionKey[];
        
        if (currentPerms.includes(action)) {
            newPerms = currentPerms.filter(a => a !== action);
        } else {
            newPerms = [...currentPerms, action];
        }

        setEditingRole({
            ...editingRole,
            permissions: {
                ...editingRole.permissions,
                [resource]: newPerms
            }
        });
    };

    const handleSaveRole = () => {
        if (!editingRole || !editingRole.name) {
            alert("角色名称不能为空");
            return;
        }
        const existing = roles.find(r => r.id === editingRole.id);
        if (existing) {
            updateRole(editingRole);
        } else {
            addRole(editingRole);
        }
        setIsRoleModalOpen(false);
        setEditingRole(null);
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-start mb-6">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Shield className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">角色权限管理</h3>
                        <p className="text-sm text-slate-500">自定义角色分组，并配置细粒度的功能访问与字段可见性。</p>
                    </div>
                 </div>
                 {currentUser?.role === 'admin' && (
                     <button 
                        onClick={handleAddRole}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700"
                     >
                         <Plus className="w-4 h-4" /> 新增角色
                     </button>
                 )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {roles.map(role => (
                     <div key={role.id} className="border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow relative bg-slate-50/50">
                         <div className="flex justify-between items-start mb-2">
                             <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                 {role.name}
                                 {role.isSystem && <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">系统默认</span>}
                             </h4>
                             <div className="flex gap-1">
                                 <button onClick={() => handleEditRole(role)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                                     <Edit2 className="w-4 h-4" />
                                 </button>
                                 {!role.isSystem && (
                                     <button onClick={() => handleDeleteRole(role.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                                         <Trash2 className="w-4 h-4" />
                                     </button>
                                 )}
                             </div>
                         </div>
                         <p className="text-xs text-slate-500 mb-4 h-8 line-clamp-2">{role.description}</p>
                         <div className="text-xs text-slate-400 font-mono mb-2">ID: {role.id}</div>
                         <div className="flex flex-wrap gap-1">
                             {Object.keys(role.permissions).length > 0 ? (
                                 Object.entries(role.permissions).slice(0, 3).map(([key, actions]) => (
                                     <span key={key} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-500">
                                         {RESOURCES.find(r => r.key === key)?.label}: {actions.length}项
                                     </span>
                                 ))
                             ) : <span className="text-xs text-slate-400">无权限</span>}
                             {Object.keys(role.permissions).length > 3 && <span className="text-[10px] text-slate-400 px-1">...</span>}
                         </div>
                     </div>
                 ))}
            </div>

            {/* Role Editor Modal */}
            {isRoleModalOpen && editingRole && (
               <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                   <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                       <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                           <h3 className="font-bold text-slate-800 flex items-center gap-2">
                               <Shield className="w-5 h-5 text-indigo-600" />
                               {roles.some(r => r.id === editingRole.id) ? '编辑角色权限' : '新建角色'}
                           </h3>
                           <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                               <X className="w-5 h-5" />
                           </button>
                       </div>

                       <div className="flex-1 overflow-y-auto p-6">
                           <div className="grid grid-cols-2 gap-4 mb-6">
                               <div>
                                   <label className="block text-sm font-medium text-slate-700 mb-1">角色名称</label>
                                   <input 
                                       type="text" 
                                       className="w-full p-2 border border-slate-300 rounded-lg"
                                       value={editingRole.name}
                                       onChange={e => setEditingRole({...editingRole, name: e.target.value})}
                                   />
                               </div>
                               <div>
                                   <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                                   <input 
                                       type="text" 
                                       className="w-full p-2 border border-slate-300 rounded-lg"
                                       value={editingRole.description}
                                       onChange={e => setEditingRole({...editingRole, description: e.target.value})}
                                   />
                               </div>
                           </div>

                           <div className="border border-slate-200 rounded-lg overflow-hidden">
                               <table className="w-full text-sm text-left">
                                   <thead className="bg-slate-100 text-slate-600 font-medium">
                                       <tr>
                                           <th className="p-3 border-b border-r border-slate-200 w-32">资源模块</th>
                                           {ACTIONS.map(action => (
                                               <th key={action.key} className="p-3 border-b border-slate-200 text-center w-24">
                                                   {action.label}
                                               </th>
                                           ))}
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100">
                                       {RESOURCES.map(res => (
                                           <tr key={res.key} className="hover:bg-slate-50">
                                               <td className="p-3 font-medium text-slate-700 border-r border-slate-200 bg-slate-50">
                                                   {res.label}
                                               </td>
                                               {ACTIONS.map(action => {
                                                   const hasPerm = editingRole.permissions[res.key]?.includes(action.key);
                                                   // Logic for invalid combinations
                                                   const isInvalid = 
                                                       (res.key === 'dashboard' && action.key !== 'view') ||
                                                       (res.key === 'settings' && ['create','delete','export','view_cost'].includes(action.key)) ||
                                                       (res.key === 'users' && action.key === 'view_cost') || 
                                                       (res.key === 'types' && ['view_cost','export'].includes(action.key)) ||
                                                       (res.key === 'templates' && ['create','delete','view_cost'].includes(action.key));

                                                   if (isInvalid) {
                                                       return <td key={action.key} className="bg-slate-50/50"></td>;
                                                   }

                                                   return (
                                                       <td key={action.key} className="p-3 text-center">
                                                           <button 
                                                               onClick={() => toggleRolePermission(res.key, action.key)}
                                                               className={`w-5 h-5 rounded border flex items-center justify-center transition-all mx-auto ${
                                                                   hasPerm 
                                                                     ? 'bg-blue-600 border-blue-600 text-white' 
                                                                     : 'bg-white border-slate-300 text-transparent hover:border-blue-400'
                                                               }`}
                                                           >
                                                               <Check className="w-3.5 h-3.5" />
                                                           </button>
                                                       </td>
                                                   );
                                               })}
                                           </tr>
                                       ))}
                                   </tbody>
                               </table>
                           </div>
                       </div>

                       <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
                           <button onClick={() => setIsRoleModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
                           <button 
                               onClick={handleSaveRole}
                               className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20"
                           >
                               保存角色配置
                           </button>
                       </div>
                   </div>
               </div>
           )}
        </div>
    );
};

export default RoleManagement;