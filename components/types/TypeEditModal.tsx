import React, { useState, useEffect } from 'react';
import { ProductTypeDefinition } from '../../types';
import { X } from 'lucide-react';

interface TypeEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    typeToEdit: ProductTypeDefinition | null;
    onSave: (data: Partial<ProductTypeDefinition>) => void;
}

const TypeEditModal: React.FC<TypeEditModalProps> = ({ isOpen, onClose, typeToEdit, onSave }) => {
    const [formData, setFormData] = useState<Partial<ProductTypeDefinition>>({
        name: '',
        level: 3,
        color: 'blue'
    });

    useEffect(() => {
        if (isOpen) {
            if (typeToEdit) {
                setFormData(typeToEdit);
            } else {
                setFormData({ name: '', level: 3, color: 'blue' });
            }
        }
    }, [isOpen, typeToEdit]);

    const handleSubmit = () => {
        if (!formData.name) return;
        onSave(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{typeToEdit ? '编辑类型' : '新增类型'}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">类型名称</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="例如: 销售套餐, 基础零件..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">层级 (1-99)</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.level || 3}
                    onChange={e => setFormData({...formData, level: Number(e.target.value)})}
                  />
                  <p className="text-xs text-slate-500 mt-1">数值越小层级越高。Level 4 (基础层) 无法添加子项。</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">显示颜色</label>
                  <select 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.color || 'blue'}
                    onChange={e => setFormData({...formData, color: e.target.value})}
                  >
                      <option value="purple">Purple (紫色 - 销售层)</option>
                      <option value="blue">Blue (蓝色 - 成品层)</option>
                      <option value="amber">Amber (琥珀色 - 中间层)</option>
                      <option value="slate">Slate (灰色 - 基础层)</option>
                      <option value="green">Green (绿色 - 其他)</option>
                      <option value="red">Red (红色)</option>
                  </select>
                </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg">保存</button>
            </div>
          </div>
        </div>
    );
};

export default TypeEditModal;