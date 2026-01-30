
import React, { useState } from 'react';
import { useStore } from '../../store';
import { Product } from '../../types';

export const AddItemModal = ({ isOpen, onClose, onAdd, parentTypeId }: any) => {
    const { products, types } = useStore();
    const [selectedProduct, setSelectedProduct] = useState("");
    const [quantity, setQuantity] = useState(1);

    if (!isOpen) return null;

    const isRoot = parentTypeId === 0;
    const parentLevel = isRoot ? 0 : (types.find(t => t.id === parentTypeId)?.level || 0);

    const availableProducts = products.filter((p: Product) => {
        const pTypeDef = types.find(t => t.id === p.type);
        return pTypeDef && pTypeDef.level > parentLevel;
    });

    const handleAdd = () => {
        if (selectedProduct) {
            onAdd(selectedProduct, quantity);
            setSelectedProduct("");
            setQuantity(1);
            onClose();
        }
    };

    const parentName = isRoot ? 'BOM 根节点' : (types.find(t => t.id === parentTypeId)?.name || '未知类型');

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">添加子项</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="text-sm text-slate-500 bg-slate-50 p-2 rounded mb-4">
                        父级: <span className="font-medium text-slate-700">{parentName}</span>. 
                        仅显示可用的下级组件。
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">选择内容</label>
                        <select 
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            value={selectedProduct}
                            onChange={e => setSelectedProduct(e.target.value)}
                        >
                            <option value="">-- 请选择 --</option>
                            {availableProducts.map((p: Product) => {
                                const typeName = types.find(t => t.id === p.type)?.name;
                                return (
                                <option key={p.id} value={p.id}>
                                    [{typeName}] {p.name} - ¥{p.cost}
                                </option>
                            )})}
                        </select>
                        {availableProducts.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">没有符合层级规则的下级项目。</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">数量</label>
                        <input 
                            type="number" 
                            min="1"
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            value={quantity}
                            onChange={e => setQuantity(Number(e.target.value))}
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                    <button 
                        onClick={handleAdd} 
                        disabled={!selectedProduct}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
                    >
                        确认添加
                    </button>
                </div>
            </div>
        </div>
    );
};

export const CreateBOMModal = ({ isOpen, onClose, onCreate }: { isOpen: boolean, onClose: () => void, onCreate: (name: string) => void }) => {
    const [name, setName] = useState('');

    if (!isOpen) return null;

    const handleCreate = () => {
        if (name) {
            onCreate(name);
            setName('');
            onClose();
        }
    };

    return (
         <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">新建 BOM 配置</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">配置名称 (BOM Name)</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            placeholder="例如: 2024款高性能服务器配置"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            创建一个独立的辅助 BOM 清单，可直接用于报价。
                        </p>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                    <button 
                        onClick={handleCreate} 
                        disabled={!name}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
                    >
                        立即创建
                    </button>
                </div>
            </div>
         </div>
    );
};
