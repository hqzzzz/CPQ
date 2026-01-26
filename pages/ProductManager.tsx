import React, { useState } from 'react';
import { Product, BOMItem } from '../types';
import { useStore } from '../store';
import { Plus, Search, Edit2, Trash2, Cpu, ChevronRight, ChevronDown, CornerDownRight, Blocks, Layers, Package, Lock } from 'lucide-react';

import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal';
import FilterHeader from '../components/products/FilterHeader';
import ProductEditModal from '../components/products/ProductEditModal';

const ProductManager = () => {
  const { products, types, boms, quotes, addProduct, updateProduct, deleteProduct, addBOM, updateBOM, hasPermission } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Table State
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
      isOpen: boolean;
      product: Product | null;
      usageWarning: string | null;
  }>({
      isOpen: false,
      product: null,
      usageWarning: null
  });

  // Permission Check
  const canViewCost = hasPermission('products', 'view_cost');
  const canCreate = hasPermission('products', 'create');
  const canEdit = hasPermission('products', 'edit');
  const canDelete = hasPermission('products', 'delete');

  // Handlers
  const handleOpenModal = (product?: Product) => {
    setEditingProduct(product || null);
    setIsModalOpen(true);
  };

  const toggleRowExpansion = (productId: string) => {
      const newExpanded = new Set(expandedRows);
      if (newExpanded.has(productId)) newExpanded.delete(productId);
      else newExpanded.add(productId);
      setExpandedRows(newExpanded);
  };

  // Main Save Logic
  const handleSaveProduct = (formData: Partial<Product>, bomItems: BOMItem[]) => {
    let savedProductId = editingProduct?.id;

    // 1. Save Product
    if (editingProduct) {
      updateProduct({ ...editingProduct, ...formData } as Product);
    } else {
      savedProductId = `p${Date.now()}`;
      const newProduct: Product = {
        ...formData,
        id: savedProductId,
      } as Product;
      addProduct(newProduct);
    }

    // 2. Save BOM (Link to Product ID)
    if (savedProductId) {
        const existingBOM = boms.find(b => b.rootProductId === savedProductId);
        if (bomItems.length > 0) {
            if (existingBOM) {
                updateBOM({ ...existingBOM, items: bomItems });
            } else {
                addBOM({
                    id: `bom-${Date.now()}`,
                    rootProductId: savedProductId,
                    name: `${formData.name} BOM`,
                    items: bomItems
                });
            }
        } else if (existingBOM && bomItems.length === 0) {
            updateBOM({ ...existingBOM, items: [] });
        }
    }
    setIsModalOpen(false);
  };

  // Delete Logic
  const checkProductUsage = (productId: string) => {
      const inBomRoot = boms.some(b => b.rootProductId === productId);
      const checkInItems = (items: any[]): boolean => {
          return items.some(item => item.productId === productId || (item.children && checkInItems(item.children)));
      };
      const inBomItems = boms.some(b => checkInItems(b.items));
      const inQuotes = quotes.some(q => q.items.some(i => i.productId === productId));
      
      const usages = [];
      if (inBomRoot) usages.push("BOM 根产品");
      if (inBomItems) usages.push("BOM 组件");
      if (inQuotes) usages.push("历史报价单");
      return usages;
  };

  const requestDelete = (product: Product) => {
      const usages = checkProductUsage(product.id);
      setDeleteConfirmation({
          isOpen: true,
          product,
          usageWarning: usages.length > 0 ? usages.join(', ') : null
      });
  };

  const executeDelete = () => {
      if (deleteConfirmation.product) {
          deleteProduct(deleteConfirmation.product.id);
          setDeleteConfirmation({ isOpen: false, product: null, usageWarning: null });
      }
  };

  // Filtering
  const filteredProducts = products.filter(p => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(lowerSearch) || 
        p.materialCode.toLowerCase().includes(lowerSearch);
    const matchesType = !selectedTypeFilter || p.type === selectedTypeFilter;
    const matchesColumns = Object.entries(columnFilters).every(([key, value]) => {
        if (!value) return true;
        const filterVal = value.toLowerCase();
        if (key === 'name') return p.name.toLowerCase().includes(filterVal);
        const itemVal = String((p as any)[key] || '').toLowerCase();
        return itemVal.includes(filterVal);
    });
    return matchesSearch && matchesType && matchesColumns;
  });

  const getTypeColor = (typeName: string) => {
      const def = types.find(t => t.name === typeName);
      return def ? def.color : 'slate';
  };

  // Helper for BOM display cost
  const calculateBOMTotal = (items: BOMItem[], field: 'cost') => {
      return items.reduce((sum, item) => {
          const p = products.find(prod => prod.id === item.productId);
          return sum + ((p?.[field] || 0) * item.quantity);
      }, 0);
  };

  // Calculate dynamic colspan based on permissions
  // Fixed columns: Arrow(1) + Name(1) + Code(1) + Unit(1) + Type(1) + Category(1) + Price(1) + Inventory(1) = 8
  const tableColSpan = 8 + (canViewCost ? 1 : 0) + ((canEdit || canDelete) ? 1 : 0);

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">产品库管理</h2>
          <p className="text-slate-500">管理产品、组件及零件信息，维护物料主数据。</p>
        </div>
        {canCreate && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            新增项目
          </button>
        )}
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="全局搜索: 物料编码 或 产品名称..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
            className="px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
        >
          <option value="">所有类型</option>
          {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-visible"> 
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-80">
                    <FilterHeader label="产品信息" fieldKey="name" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="物料编码" fieldKey="materialCode" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="单位" fieldKey="unit" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="类型" fieldKey="type" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="子类" fieldKey="category" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
                </th>
                {canViewCost && (
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <FilterHeader label="成本" fieldKey="cost" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
                  </th>
                )}
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="基准价" fieldKey="basePrice" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="库存" fieldKey="inventory" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
                </th>
                {(canEdit || canDelete) && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                  <tr>
                      <td colSpan={tableColSpan} className="px-6 py-12 text-center text-slate-400">没有找到匹配的产品。</td>
                  </tr>
              ) : filteredProducts.map((product) => {
                const color = getTypeColor(product.type);
                const isExpanded = expandedRows.has(product.id);
                const relatedBOM = boms.find(b => b.rootProductId === product.id);
                const bomItemCount = relatedBOM ? relatedBOM.items.length : 0;

                return (
                <React.Fragment key={product.id}>
                <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-4 py-4 text-center">
                      <button 
                        onClick={() => toggleRowExpansion(product.id)}
                        className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-blue-200 text-blue-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                      >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200 shrink-0">
                        {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover"/> : <Cpu className="w-6 h-6" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{product.name}</p>
                        <p className="text-xs text-slate-500 truncate w-40">{product.specifications || product.description}</p>
                        {bomItemCount > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-600 mt-0.5">
                                <Layers className="w-3 h-3" />
                                包含 {bomItemCount} 个组件
                            </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{product.materialCode}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{product.unit}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium bg-${color}-100 text-${color}-700`}>
                      {product.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                      {product.category || '-'}
                  </td>
                  {canViewCost && (
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">¥{product.cost.toLocaleString()}</td>
                  )}
                  <td className="px-6 py-4 text-sm font-medium text-slate-800 font-mono">¥{product.basePrice.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${product.inventory > 10 ? 'bg-emerald-500' : product.inventory > 0 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-slate-600">{product.inventory}</span>
                    </div>
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                            <button onClick={() => handleOpenModal(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                        {canDelete && (
                            <button 
                                onClick={() => requestDelete(product)} 
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                            <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {/* Expanded BOM Details */}
                {isExpanded && (
                    <tr>
                        <td colSpan={tableColSpan} className="bg-slate-50/30 p-0 border-b border-slate-100 shadow-inner">
                            <div className="p-4 pl-16">
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-w-4xl shadow-sm">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                            <Blocks className="w-3.5 h-3.5 text-blue-500" />
                                            BOM 结构详情
                                        </h4>
                                        {canEdit && (
                                            <button 
                                                onClick={() => handleOpenModal(product)}
                                                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                                编辑 BOM
                                            </button>
                                        )}
                                    </div>
                                    {relatedBOM && relatedBOM.items.length > 0 ? (
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-slate-500 text-xs">
                                                <tr>
                                                    <th className="px-4 py-2 text-left">组件名称</th>
                                                    <th className="px-4 py-2 text-left">编码</th>
                                                    <th className="px-4 py-2 text-center">数量</th>
                                                    {canViewCost && <th className="px-4 py-2 text-right">成本小计</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {relatedBOM.items.map(item => {
                                                    const subP = products.find(p => p.id === item.productId);
                                                    return (
                                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-2 flex items-center gap-2">
                                                                <CornerDownRight className="w-3 h-3 text-slate-300" />
                                                                <span className="text-slate-700">{subP?.name || 'Unknown'}</span>
                                                            </td>
                                                            <td className="px-4 py-2 text-slate-500 font-mono text-xs">{subP?.materialCode}</td>
                                                            <td className="px-4 py-2 text-center text-slate-600 font-medium">{item.quantity}</td>
                                                            {canViewCost && (
                                                                <td className="px-4 py-2 text-right text-slate-500">
                                                                    ¥{((subP?.cost || 0) * item.quantity).toLocaleString()}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            {canViewCost && (
                                                <tfoot className="bg-slate-50 border-t border-slate-100">
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-2 text-right text-xs font-bold text-slate-600">总成本:</td>
                                                        <td className="px-4 py-2 text-right text-xs font-bold text-emerald-600">
                                                            ¥{calculateBOMTotal(relatedBOM.items, 'cost').toLocaleString()}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    ) : (
                                        <div className="p-6 text-center text-slate-400 text-sm flex flex-col items-center">
                                            <Package className="w-8 h-8 mb-2 opacity-20" />
                                            此产品暂无 BOM 结构数据。
                                        </div>
                                    )}
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {/* Modals */}
      <ProductEditModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        productToEdit={editingProduct} 
        onSave={handleSaveProduct} 
      />

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}
        onConfirm={executeDelete}
        title={deleteConfirmation.usageWarning ? '⚠️ 强制删除产品?' : '确认删除此产品?'}
        usageWarning={deleteConfirmation.usageWarning ? `检测到以下关联数据，强制删除可能会影响系统稳定性：${deleteConfirmation.usageWarning}` : null}
        message={<><span className="font-bold text-slate-700">{deleteConfirmation.product?.name}</span> 将被永久删除。</>}
        confirmText={deleteConfirmation.usageWarning ? '我已知晓后果，强制删除' : '确认删除'}
        isWarning={!!deleteConfirmation.usageWarning}
      />
    </div>
  );
};

export default ProductManager;