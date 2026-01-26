import React, { useState } from 'react';
import { useStore } from '../store';
import { ProductTypeDefinition } from '../types';
import { Plus, Trash2, Edit2, Info } from 'lucide-react';
import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal';
import TypeEditModal from '../components/types/TypeEditModal';

const TypeManager = () => {
  const { types, products, addType, updateType, deleteType } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ProductTypeDefinition | null>(null);
  
  // State for Custom Delete Confirmation Modal
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
      isOpen: boolean;
      type: ProductTypeDefinition | null;
      usageCount: number;
  }>({
      isOpen: false,
      type: null,
      usageCount: 0
  });

  // Sort types by level (1 -> 4)
  const sortedTypes = [...types].sort((a, b) => a.level - b.level);

  const handleOpenModal = (type?: ProductTypeDefinition) => {
    setEditingType(type || null);
    setIsModalOpen(true);
  };

  const handleSave = (formData: Partial<ProductTypeDefinition>) => {
    if (editingType) {
      updateType({ ...editingType, ...formData } as ProductTypeDefinition);
    } else {
      addType({
        id: `t-${Date.now()}`,
        name: formData.name!,
        level: formData.level || 3,
        color: formData.color || 'blue'
      });
    }
    setIsModalOpen(false);
  };

  // Step 1: Request Delete - Opens the custom modal
  const requestDelete = (type: ProductTypeDefinition) => {
    const usageCount = products.filter(p => p.type === type.name).length;
    setDeleteConfirmation({
        isOpen: true,
        type,
        usageCount
    });
  };

  // Step 2: Confirm Delete - Executes the action
  const executeDelete = () => {
      if (deleteConfirmation.type) {
          deleteType(deleteConfirmation.type.id);
          setDeleteConfirmation({ isOpen: false, type: null, usageCount: 0 });
      }
  };

  const getLevelBadge = (level: number) => {
      if (level === 1) return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">Level 1 (销售层)</span>;
      if (level === 2) return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Level 2 (成品层)</span>;
      if (level === 3) return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">Level 3 (中间层)</span>;
      if (level === 4) return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold">Level 4 (基础层)</span>;
      return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Level {level}</span>;
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">产品类型与层级</h2>
          <p className="text-slate-500">定义产品的分类及BOM构建时的层级逻辑。</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          新增类型
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">层级逻辑说明 (Level Logic):</p>
              <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Level 1 (销售层别):</strong> 面向客户的销售套餐或解决方案，BOM 的根节点。</li>
                  <li><strong>Level 2 (成品层):</strong> 生产完成的最终产品。</li>
                  <li><strong>Level 3 (中间层):</strong> 组件或半成品。</li>
                  <li><strong>Level 4 (基础层):</strong> 基础零件或原材料，不可再分。</li>
                  <li className="mt-2 text-blue-900 font-medium">BOM 规则: 父级只能包含比自己层级数字更大 (Level 更低) 的子项。</li>
              </ul>
          </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">类型名称</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">层级逻辑</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">颜色标记</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTypes.map((type) => {
               const usageCount = products.filter(p => p.type === type.name).length;
               
               return (
                <tr key={type.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{type.name}</td>
                    <td className="px-6 py-4">{getLevelBadge(type.level)}</td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full bg-${type.color}-500`}></div>
                            <span className="text-sm text-slate-600 capitalize">{type.color}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => handleOpenModal(type)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => requestDelete(type)} 
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={usageCount > 0 ? `该类型正在被 ${usageCount} 个产品使用` : "删除类型"}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    </td>
                </tr>
            )})}
          </tbody>
        </table>
      </div>

      <TypeEditModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        typeToEdit={editingType} 
        onSave={handleSave} 
      />

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}
        onConfirm={executeDelete}
        title={deleteConfirmation.usageCount > 0 ? '⚠️ 强制删除类型?' : '确认删除此类型?'}
        usageWarning={deleteConfirmation.usageCount > 0 ? `检测到 ${deleteConfirmation.usageCount} 个产品正在使用 "${deleteConfirmation.type?.name}"。` : null}
        message={deleteConfirmation.usageCount > 0 ? null : <><span className="font-semibold text-slate-700">"{deleteConfirmation.type?.name}"</span> 将被永久删除。</>}
        confirmText={deleteConfirmation.usageCount > 0 ? '强制删除' : '确认删除'}
        isWarning={deleteConfirmation.usageCount > 0}
      />
    </div>
  );
};

export default TypeManager;