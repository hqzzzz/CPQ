
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { ProductCategory } from '../types';
import { Plus, Trash2, Tag, AlertTriangle, Search, GripVertical } from 'lucide-react';
import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal';

const CategoryManager = () => {
  const { categories, products, boms, addCategory, deleteCategory, reorderCategories } = useStore();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
      isOpen: boolean;
      category: ProductCategory | null;
      usageCount: number;
  }>({
      isOpen: false,
      category: null,
      usageCount: 0
  });

  // Local state for DnD to update UI instantly
  const [localCategories, setLocalCategories] = useState<ProductCategory[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
      setLocalCategories(categories);
  }, [categories]);

  const handleAdd = () => {
      if (!newCategoryName.trim()) return;
      
      const exists = categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase());
      if (exists) {
          alert('分类名称已存在');
          return;
      }

      // Append at the end (max sort order + 1)
      const maxSort = categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder || 0)) : 0;

      addCategory({
          id: Date.now(),
          name: newCategoryName.trim(),
          sortOrder: maxSort + 1
      });
      setNewCategoryName('');
  };

  const requestDelete = (category: ProductCategory) => {
    const prodUsage = products.filter(p => p.category === category.name).length;
    const bomUsage = boms.filter(b => b.category === category.name).length;
    const usageCount = prodUsage + bomUsage;

    setDeleteConfirmation({
        isOpen: true,
        category,
        usageCount
    });
  };

  const executeDelete = () => {
      if (deleteConfirmation.category) {
          deleteCategory(deleteConfirmation.category.id);
          setDeleteConfirmation({ isOpen: false, category: null, usageCount: 0 });
      }
  };

  // DnD Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
      dragItem.current = position;
      e.dataTransfer.effectAllowed = "move";
      // Optional: set ghost image
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
      dragOverItem.current = position;
      e.preventDefault();
  };

  const handleDragEnd = () => {
      const draggedIdx = dragItem.current;
      const overIdx = dragOverItem.current;

      if (draggedIdx !== null && overIdx !== null && draggedIdx !== overIdx) {
          const newList = [...localCategories];
          const draggedItemContent = newList[draggedIdx];
          
          newList.splice(draggedIdx, 1);
          newList.splice(overIdx, 0, draggedItemContent);
          
          // Re-assign sortOrder
          const reorderedList = newList.map((item, index) => ({
              ...item,
              sortOrder: index
          }));

          setLocalCategories(reorderedList);
          reorderCategories(reorderedList); // Sync to store/backend
      }

      dragItem.current = null;
      dragOverItem.current = null;
  };

  const filteredCategories = localCategories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col relative animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">业务分类管理</h2>
          <p className="text-slate-500">定义产品和BOM的业务属性分类（如：电气、供水、软件等），便于报表统计与筛选。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* List Section */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                  <div className="font-semibold text-slate-700 flex items-center gap-2 shrink-0">
                      <Tag className="w-4 h-4 text-blue-600" />
                      分类列表 ({categories.length})
                  </div>
                  <div className="relative flex-1 max-w-xs">
                      <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                      <input 
                          type="text" 
                          placeholder="搜索分类..." 
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                  {filteredCategories.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                          <Tag className="w-12 h-12 mb-3 opacity-20" />
                          <p>暂无分类数据</p>
                      </div>
                  ) : (
                      <div className="space-y-2">
                          {filteredCategories.map((cat, index) => {
                              const prodUsage = products.filter(p => p.category === cat.name).length;
                              const bomUsage = boms.filter(b => b.category === cat.name).length;
                              const usage = prodUsage + bomUsage;

                              return (
                                  <div 
                                    key={cat.id} 
                                    draggable={!searchTerm} // Only allow drag when not searching
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnter={(e) => handleDragEnter(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                    className={`flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-100 transition-all group ${!searchTerm ? 'cursor-move' : ''}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          <div className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1">
                                              <GripVertical className="w-4 h-4" />
                                          </div>
                                          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold shadow-sm select-none">
                                              {cat.name.charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                              <div className="font-medium text-slate-800 text-base">{cat.name}</div>
                                              <div className="text-xs text-slate-400 flex items-center gap-2">
                                                  ID: {cat.id}
                                                  {usage > 0 && (
                                                      <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px]">
                                                          {usage} 个关联项
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => requestDelete(cat)}
                                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                          title="删除分类"
                                      >
                                          <Trash2 className="w-5 h-5" />
                                      </button>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
              {!searchTerm && (
                  <div className="p-2 bg-slate-50 text-center text-xs text-slate-400 border-t border-slate-200">
                      拖动列表项可调整排序，该顺序将应用于报价单分组。
                  </div>
              )}
          </div>

          {/* Add Section */}
          <div className="h-fit space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-blue-600" />
                      添加新分类
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">分类名称</label>
                          <input 
                              type="text" 
                              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                              placeholder="例如: 电气设备, 基础建材..."
                              value={newCategoryName}
                              onChange={e => setNewCategoryName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAdd()}
                          />
                      </div>
                      <button 
                          onClick={handleAdd}
                          disabled={!newCategoryName.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 font-medium"
                      >
                          <Plus className="w-4 h-4" /> 确认添加
                      </button>
                  </div>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-800 flex gap-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                  <div>
                      <p className="font-bold mb-1">操作提示：</p>
                      <p className="opacity-90 leading-relaxed">
                          删除分类不会物理删除关联的产品数据。
                          <br/>
                          这些产品的“分类”字段将保留原有文本，但如果不重新创建该分类，它们将无法在筛选器中正确分组。
                      </p>
                  </div>
              </div>
          </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}
        onConfirm={executeDelete}
        title={deleteConfirmation.usageCount > 0 ? '⚠️ 分类正在使用中' : '确认删除分类?'}
        usageWarning={deleteConfirmation.usageCount > 0 ? `检测到 ${deleteConfirmation.usageCount} 个产品或BOM正在使用分类 "${deleteConfirmation.category?.name}"。` : null}
        message={
            deleteConfirmation.usageCount > 0 
            ? null 
            : <p>确定要永久删除 <span className="font-bold text-slate-800">{deleteConfirmation.category?.name}</span> 吗？</p>
        }
        confirmText={deleteConfirmation.usageCount > 0 ? '仍要删除' : '确认删除'}
        isWarning={deleteConfirmation.usageCount > 0}
      />
    </div>
  );
};

export default CategoryManager;
