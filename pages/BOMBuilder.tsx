
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Product, BOMStructure, BOMItem } from '../types';
import { Layout, Search, Plus, Trash2, ChevronRight, ChevronDown, Layers, Save, FileText, CornerDownRight, X, AlertCircle, Box, DollarSign, CheckCircle, Filter, Image as ImageIcon } from 'lucide-react';
import { CreateBOMModal } from '../components/bom/BOMModals';

const BOMBuilder = () => {
  const { products, boms, categories, updateBOM, addBOM, deleteBOM, currentUser } = useStore();
  const [selectedBOMId, setSelectedBOMId] = useState<number | ''>(''); 
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Add Item State
  const [targetParentId, setTargetParentId] = useState<number | null>(null);
  const [newProductId, setNewProductId] = useState<number | ''>('');
  const [newQuantity, setNewQuantity] = useState(1);

  // Local state for metadata form including baseImage
  const [metaForm, setMetaForm] = useState({ specifications: '', category: '', description: '', baseImage: '' });
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canViewCost = currentUser?.role !== 2; // Sales role ID is 2

  // Filter Auxiliary BOMs
  const filteredBoms = boms.filter(b => {
      const matchesSearch = !searchTerm || b.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !filterCategory || b.category === filterCategory;
      return matchesSearch && matchesCategory;
  });

  // Get current BOM object and its items
  const activeBOM = boms.find(b => b.id === selectedBOMId);
  const currentItems = activeBOM ? activeBOM.items : [];

  // Sync local form when active BOM switches
  useEffect(() => {
      if (activeBOM) {
          setMetaForm({
              specifications: activeBOM.specifications || '',
              category: activeBOM.category || '',
              description: activeBOM.description || '',
              baseImage: activeBOM.baseImage || ''
          });
      }
  }, [activeBOM?.id]);

  const getProduct = (id: number) => products.find(p => p.id === id);

  // --- Helpers ---

  const findItemRecursive = (items: BOMItem[], id: number): BOMItem | null => {
      for (const item of items) {
          if (item.id === id) return item;
          if (item.children) {
              const found = findItemRecursive(item.children, id);
              if (found) return found;
          }
      }
      return null;
  };

  const targetParentItem = targetParentId ? findItemRecursive(currentItems, targetParentId) : null;
  // Handle deleted product lookup safely
  const targetParentProduct = targetParentItem ? getProduct(targetParentItem.productId) : null;
  const targetParentName = targetParentItem 
      ? (targetParentProduct ? targetParentProduct.name : `已删组件 (ID:${targetParentItem.productId})`) 
      : '根节点 (Top Level)';

  const calculateRollup = (items: BOMItem[], field: 'cost' | 'basePrice'): number => {
    let total = 0;
    items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        total += (p[field] || 0) * item.quantity;
      }
      if (item.children) {
          total += calculateRollup(item.children, field);
      }
    });
    return total;
  };

  const totalBOMCost = calculateRollup(currentItems, 'cost');
  const totalBOMBasePrice = calculateRollup(currentItems, 'basePrice');

  // --- Tree Manipulation Logic ---

  const addItemToTree = (items: BOMItem[], parentId: number | null, newItem: BOMItem): BOMItem[] => {
      if (parentId === null) {
          return [...items, newItem];
      }
      return items.map(item => {
          if (item.id === parentId) {
              return { ...item, children: [...(item.children || []), newItem] };
          }
          if (item.children) {
              return { ...item, children: addItemToTree(item.children, parentId, newItem) };
          }
          return item;
      });
  };

  const updateItemInTree = (items: BOMItem[], itemId: number, updates: Partial<BOMItem>): BOMItem[] => {
      return items.map(item => {
          if (item.id === itemId) return { ...item, ...updates };
          if (item.children) return { ...item, children: updateItemInTree(item.children, itemId, updates) };
          return item;
      });
  };

  const deleteItemFromTree = (items: BOMItem[], itemId: number): BOMItem[] => {
      return items
        .filter(item => item.id !== itemId)
        .map(item => ({
            ...item,
            children: item.children ? deleteItemFromTree(item.children, itemId) : undefined
        }));
  };

  // Unified Save Function: Saves items (if provided) AND current metadata form
  const saveBOM = (newItems?: BOMItem[]) => {
      if (!activeBOM) return;
      updateBOM({ 
          ...activeBOM, 
          items: newItems || activeBOM.items,
          specifications: metaForm.specifications,
          category: metaForm.category,
          description: metaForm.description,
          baseImage: metaForm.baseImage
      });
  };

  // --- Handlers ---

  const handleManualSave = () => {
      saveBOM();
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              setMetaForm(prev => ({ ...prev, baseImage: base64 }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleAddItem = () => {
      if (!activeBOM || !newProductId) return;
      
      const newItem: BOMItem = {
          id: Date.now(),
          productId: Number(newProductId),
          quantity: Number(newQuantity),
          children: []
      };

      const updatedItems = addItemToTree(currentItems, targetParentId, newItem);
      saveBOM(updatedItems);
      
      setNewProductId('');
      setNewQuantity(1);
  };

  const handleDeleteItem = (itemId: number) => {
      if (!activeBOM) return;
      if (!window.confirm("确定移除此组件吗？")) return;
      const updatedItems = deleteItemFromTree(currentItems, itemId);
      saveBOM(updatedItems);
      // If we deleted the current target parent, reset to root
      if (targetParentId === itemId) setTargetParentId(null);
  };

  const handleUpdateQuantity = (itemId: number, qty: number) => {
      if (!activeBOM) return;
      const updatedItems = updateItemInTree(currentItems, itemId, { quantity: Math.max(1, qty) });
      saveBOM(updatedItems);
  };

  const handleCreateAuxBOM = (name: string) => {
      const newBOM: BOMStructure = {
          id: Date.now(),
          name: name,
          items: []
      };
      addBOM(newBOM);
      setSelectedBOMId(newBOM.id);
  };

  const handleDeleteAuxBOM = (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      if(window.confirm('确定要删除整个辅助配置吗？此操作无法撤销。')) {
          deleteBOM(id);
          if (selectedBOMId === id) setSelectedBOMId('');
      }
  };

  // Flatten the tree for table rendering with indentation
  const flattenItems = (items: BOMItem[], level = 0): { item: BOMItem, level: number }[] => {
      return items.reduce((acc, item) => {
          acc.push({ item, level });
          if (item.children && item.children.length > 0) {
              acc.push(...flattenItems(item.children, level + 1));
          }
          return acc;
      }, [] as { item: BOMItem, level: number }[]);
  };

  const flatList = activeBOM ? flattenItems(currentItems) : [];

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">辅助配置 (BOM 模板)</h2>
          <p className="text-slate-500">
              管理可独立引用的辅助 BOM 模板，用于快速报价组合。
          </p>
        </div>
        {selectedBOMId && (
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-6">
            {canViewCost && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 uppercase font-bold">成本合计:</span>
                    <span className="text-lg font-bold text-slate-600 flex items-center">
                        <DollarSign className="w-4 h-4" />
                        {totalBOMCost.toLocaleString()}
                    </span>
                </div>
            )}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 uppercase font-bold">基准价合计:</span>
                <span className="text-xl font-bold text-blue-600 flex items-center">
                    <DollarSign className="w-5 h-5" />
                    {totalBOMBasePrice.toLocaleString()}
                </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
        {/* Sidebar List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-fit flex flex-col min-h-[500px]">
          <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold px-1">
              <Layout className="w-5 h-5 text-blue-600" />
              配置列表
          </div>

          <div className="space-y-3 mb-3">
              <div className="relative">
                  <input 
                      type="text" 
                      placeholder="搜索模板..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
              <div className="relative">
                  <select
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-600 appearance-none"
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                  >
                      <option value="">所有分类</option>
                      {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      {/* Handle distinct categories already in BOMs that might not be in the master list if deleted */}
                      {[...new Set(boms.map(b => b.category).filter(c => c && !categories.some(cat => cat.name === c)))].map(c => (
                           <option key={c as string} value={c as string}>{c as string} (Legacy)</option>
                      ))}
                  </select>
                  <Filter className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-0 max-h-[600px]">
                {filteredBoms.map(bom => (
                    <div
                        key={bom.id}
                        onClick={() => { setSelectedBOMId(bom.id); setTargetParentId(null); }}
                        className={`w-full text-left px-3 py-3 rounded-lg border transition-all cursor-pointer group flex justify-between items-start ${
                        selectedBOMId === bom.id 
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                            : 'border-transparent hover:bg-slate-50 text-slate-600 border-slate-100'
                        }`}
                    >
                        <div className="truncate flex-1 pr-2">
                            <div className="font-medium truncate text-sm">{bom.name}</div>
                            <div className="text-[10px] opacity-50 font-mono mt-1">ID: {bom.id}</div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Layers className="w-3 h-3" /> {bom.items.length} 项
                                </div>
                                {bom.category && <span className="text-[10px] bg-slate-200 px-1.5 rounded text-slate-600">{bom.category}</span>}
                            </div>
                        </div>
                        <button 
                            onClick={(e) => handleDeleteAuxBOM(e, bom.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded transition-all shrink-0"
                            title="删除 BOM"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            
            {filteredBoms.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center">
                    <Layers className="w-8 h-8 mb-2 opacity-20" />
                    {boms.length === 0 ? '暂无辅助 BOM 配置' : '未找到匹配的模板'}
                </div>
            )}
          </div>
          
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" /> 新建配置
          </button>
        </div>

        {/* Main Editor Area */}
        <div className="lg:col-span-3 flex flex-col gap-4">
           {activeBOM ? (
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[500px]">
                   {/* Header */}
                   <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                       <div className="flex justify-between items-center mb-4">
                           <div className="flex items-center gap-4">
                               {/* Image Uploader */}
                               <div 
                                   className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden group relative"
                                   onClick={() => fileInputRef.current?.click()}
                               >
                                   {metaForm.baseImage ? (
                                       <img src={metaForm.baseImage} className="w-full h-full object-cover" alt="BOM" />
                                   ) : (
                                       <ImageIcon className="w-8 h-8 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                   )}
                                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-white font-medium bg-black/50 px-1 rounded">更换</span>
                                   </div>
                               </div>
                               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                               <div>
                                   <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                       {activeBOM.name}
                                       <span className="text-[10px] px-2 py-0.5 rounded border bg-blue-100 text-blue-700 border-blue-200">BOM配单</span>
                                   </div>
                                   <div className="text-xs text-slate-500 font-mono mt-1">TEMPLATE-ID-{activeBOM.id}</div>
                               </div>
                           </div>
                           
                           {/* SAVE BUTTON */}
                           <button 
                                onClick={handleManualSave}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 shadow-sm transition-all active:scale-95"
                           >
                               {showSaveSuccess ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                               {showSaveSuccess ? '已保存' : '保存配置'}
                           </button>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-4">
                          <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">规格型号</label>
                              <input 
                                  type="text" 
                                  className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                                  placeholder="例如: 2024款-高配版"
                                  value={metaForm.specifications}
                                  onChange={(e) => setMetaForm(prev => ({...prev, specifications: e.target.value}))}
                              />
                          </div>
                          <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">业务分类</label>
                              <select 
                                  className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                                  value={metaForm.category}
                                  onChange={(e) => setMetaForm(prev => ({...prev, category: e.target.value}))}
                              >
                                  <option value="">-- 请选择 --</option>
                                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                  {metaForm.category && !categories.some(c => c.name === metaForm.category) && (
                                      <option value={metaForm.category}>{metaForm.category} (Legacy)</option>
                                  )}
                              </select>
                          </div>
                          <div>
                               <label className="text-xs font-semibold text-slate-500 mb-1 block">详细描述</label>
                               <input 
                                  type="text"
                                  className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                                  placeholder="配置详细说明..."
                                  value={metaForm.description}
                                  onChange={(e) => setMetaForm(prev => ({...prev, description: e.target.value}))}
                               />
                          </div>
                       </div>
                   </div>

                   {/* Inline Add Bar */}
                   <div className="p-4 bg-white border-b border-slate-200">
                       {targetParentId && (
                           <div className="flex items-center gap-2 text-xs text-blue-600 mb-2 bg-blue-50 p-2 rounded border border-blue-100 w-fit">
                               <CornerDownRight className="w-3 h-3" />
                               正在向 <strong>{targetParentName}</strong> 添加子组件
                               <button onClick={() => setTargetParentId(null)} className="ml-2 hover:text-red-500"><X className="w-3 h-3"/></button>
                           </div>
                       )}
                       <div className="flex items-end gap-2">
                           <div className="flex-1">
                               <label className="text-xs font-semibold text-slate-500 mb-1 block">选择组件</label>
                               <select 
                                   className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                   value={newProductId}
                                   onChange={e => setNewProductId(Number(e.target.value))}
                               >
                                   <option value="">-- 选择要添加的产品 --</option>
                                   {products.map(p => (
                                       <option key={p.id} value={p.id}>{p.name} - {p.materialCode}</option>
                                   ))}
                                </select>
                           </div>
                           <div className="w-24">
                               <label className="text-xs font-semibold text-slate-500 mb-1 block">数量</label>
                               <input 
                                   type="number" 
                                   min="1" 
                                   className="w-full p-2 border border-slate-300 rounded-lg text-sm text-center"
                                   value={newQuantity}
                                   onChange={e => setNewQuantity(Number(e.target.value))}
                               />
                           </div>
                           <button 
                               onClick={handleAddItem}
                               disabled={!newProductId}
                               className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                               title="添加"
                           >
                               <Plus className="w-5 h-5" />
                           </button>
                       </div>
                   </div>

                   {/* Table View */}
                   <div className="flex-1 overflow-auto">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                               <tr>
                                   <th className="px-4 py-3 font-medium text-slate-600 w-1/3">组件名称</th>
                                   <th className="px-4 py-3 font-medium text-slate-600">编码</th>
                                   <th className="px-4 py-3 font-medium text-slate-600 text-center">数量</th>
                                   {canViewCost && <th className="px-4 py-3 font-medium text-slate-600 text-right">单价(成本)</th>}
                                   <th className="px-4 py-3 font-medium text-slate-600 text-right">单价(基准)</th>
                                   {canViewCost && <th className="px-4 py-3 font-medium text-slate-600 text-right">小计(成本)</th>}
                                   <th className="px-4 py-3 font-medium text-slate-600 text-right">小计(基准)</th>
                                   <th className="px-4 py-3 font-medium text-slate-600 text-right">操作</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {flatList.length === 0 ? (
                                   <tr>
                                       <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                                           <div className="flex flex-col items-center">
                                               <Layers className="w-8 h-8 mb-2 opacity-20" />
                                               暂无组件，请在上方添加。
                                           </div>
                                       </td>
                                   </tr>
                               ) : (
                                   flatList.map(({ item, level }) => {
                                       const product = getProduct(item.productId);
                                       const subtotalCost = product ? product.cost * item.quantity : 0;
                                       const subtotalBase = product ? (product.basePrice || 0) * item.quantity : 0;
                                       const isTarget = targetParentId === item.id;

                                       return (
                                           <tr key={item.id} className={`hover:bg-slate-50 group ${isTarget ? 'bg-blue-50/60' : ''} ${!product ? 'bg-red-50/20' : ''}`}>
                                               <td className="px-4 py-3">
                                                   <div style={{ paddingLeft: `${level * 24}px` }} className="flex items-center gap-2">
                                                       {level > 0 && <CornerDownRight className="w-3 h-3 text-slate-300" />}
                                                       
                                                       {product ? (
                                                           <>
                                                               <Box className="w-4 h-4 text-slate-400 shrink-0" />
                                                               <span className={`truncate ${level === 0 ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                                                                   {product.name}
                                                               </span>
                                                           </>
                                                       ) : (
                                                            <span className="text-red-500 text-xs flex items-center gap-1 font-medium" title={`原产品ID: ${item.productId}`}>
                                                                <AlertCircle className="w-3 h-3" />
                                                                组件已删除 / 请核对
                                                            </span>
                                                       )}

                                                       {isTarget && <span className="text-[10px] text-blue-600 font-bold ml-2 animate-pulse">● 目标父级</span>}
                                                   </div>
                                               </td>
                                               <td className="px-4 py-3 text-slate-500 font-mono text-xs">{product?.materialCode || '-'}</td>
                                               <td className="px-4 py-3 text-center">
                                                   <input 
                                                       type="number" 
                                                       min="1" 
                                                       className="w-16 p-1 border border-slate-200 rounded text-center text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-transparent hover:bg-white transition-colors"
                                                       value={item.quantity}
                                                       onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                                   />
                                               </td>
                                               {canViewCost && (
                                                   <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">
                                                       {product ? `¥${product.cost.toLocaleString()}` : '-'}
                                                   </td>
                                               )}
                                               <td className="px-4 py-3 text-right text-blue-600 font-mono text-xs font-medium">
                                                   {product ? `¥${(product.basePrice || 0).toLocaleString()}` : '-'}
                                               </td>
                                               {canViewCost && (
                                                   <td className="px-4 py-3 text-right font-medium text-slate-600">
                                                       {product ? `¥${subtotalCost.toLocaleString()}` : '-'}
                                                   </td>
                                               )}
                                               <td className="px-4 py-3 text-right font-bold text-blue-700">
                                                   {product ? `¥${subtotalBase.toLocaleString()}` : '-'}
                                               </td>
                                               <td className="px-4 py-3 text-right">
                                                   <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                       {product && (
                                                           <button 
                                                               onClick={() => setTargetParentId(targetParentId === item.id ? null : item.id)}
                                                               className={`p-1.5 rounded transition-colors ${targetParentId === item.id ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100'}`}
                                                               title="添加子组件到此项"
                                                           >
                                                               <Plus className="w-3.5 h-3.5" />
                                                           </button>
                                                       )}
                                                       <button 
                                                           onClick={() => handleDeleteItem(item.id)}
                                                           className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors"
                                                           title="删除"
                                                       >
                                                           <Trash2 className="w-3.5 h-3.5" />
                                                       </button>
                                                   </div>
                                               </td>
                                           </tr>
                                       );
                                   })
                               )}
                           </tbody>
                       </table>
                   </div>
               </div>
           ) : (
               <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
                   <FileText className="w-16 h-16 mb-4 opacity-20" />
                   <p className="text-lg font-medium">请选择一个配置模板</p>
                   <p className="text-sm mt-2">
                       从左侧列表选择，或点击“新建配置”创建。
                   </p>
               </div>
           )}
        </div>
      </div>

      <CreateBOMModal 
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateAuxBOM}
      />
    </div>
  );
};

export default BOMBuilder;
