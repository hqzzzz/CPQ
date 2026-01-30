
import React, { useState, useEffect } from 'react';
import { ProductTypeDefinition } from '../../types';
import { X, Check } from 'lucide-react';

interface TypeEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    typeToEdit: ProductTypeDefinition | null;
    onSave: (data: Partial<ProductTypeDefinition>) => void;
}

const PRESET_COLORS = [
    '#64748b', '#ef4444', '#f97316', '#f59e0b', '#eab308', 
    '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', 
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', 
    '#d946ef', '#ec4899', '#f43f5e', '#1e293b', '#0f172a',
    '#7f1d1d', '#9a3412', '#92400e', '#854d0e', '#3f6212',
    '#166534', '#065f46', '#115e59', '#155e75', '#075985',
    '#1e40af', '#4c1d95'
];

const TypeEditModal: React.FC<TypeEditModalProps> = ({ isOpen, onClose, typeToEdit, onSave }) => {
    const [formData, setFormData] = useState<Partial<ProductTypeDefinition>>({
        name: '',
        level: 3,
        color: '#3b82f6'
    });

    useEffect(() => {
        if (isOpen) {
            if (typeToEdit) {
                // Ensure legacy colors like 'blue' map to a hex or keep as is if valid CSS
                // But for the color picker input, we prefer Hex. 
                // If it's a name, we default to blue hex for the picker, but keep the value until changed.
                setFormData(typeToEdit);
            } else {
                setFormData({ name: '', level: 3, color: '#3b82f6' });
            }
        }
    }, [isOpen, typeToEdit]);

    const handleSubmit = () => {
        if (!formData.name) return;
        onSave(formData);
    };

    // Helper to ensure color input receives a hex value
    const getColorInputValue = (color?: string) => {
        if (!color) return '#000000';
        if (color.startsWith('#')) return color;
        // Fallback for legacy names to a safe hex default just for the picker visual
        return '#3b82f6';
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
            <div className="p-6 space-y-5">
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">颜色标记</label>
                  <div className="flex items-center gap-3 mb-3">
                      <div className="relative w-10 h-10 overflow-hidden rounded-lg shadow-sm border border-slate-200">
                          <input 
                              type="color" 
                              className="absolute -top-2 -left-2 w-16 h-16 p-0 cursor-pointer border-0"
                              value={getColorInputValue(formData.color)}
                              onChange={e => setFormData({...formData, color: e.target.value})}
                          />
                      </div>
                      <input 
                          type="text" 
                          className="flex-1 p-2 border border-slate-300 rounded-lg font-mono text-sm uppercase text-slate-600"
                          value={formData.color || ''}
                          onChange={e => setFormData({...formData, color: e.target.value})}
                          placeholder="#RRGGBB"
                      />
                  </div>
                  
                  <div className="grid grid-cols-8 gap-2">
                      {PRESET_COLORS.map(c => (
                          <button
                              key={c}
                              type="button"
                              className={`w-full aspect-square rounded-md transition-all flex items-center justify-center ${formData.color === c ? 'ring-2 ring-blue-500 ring-offset-2 scale-110 shadow-md' : 'hover:scale-105 border border-slate-100'}`}
                              style={{ backgroundColor: c }}
                              onClick={() => setFormData({...formData, color: c})}
                              title={c}
                          >
                              {formData.color === c && <Check className="w-3 h-3 text-white drop-shadow-md" />}
                          </button>
                      ))}
                  </div>
                </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm">保存</button>
            </div>
          </div>
        </div>
    );
};

export default TypeEditModal;
