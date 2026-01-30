
import React, { useState } from 'react';
import { Product, BOMItem } from '../types';
import { useStore } from '../store';
import { Plus, Search, Edit2, Trash2, Cpu, ChevronRight, ChevronDown, CornerDownRight, Blocks, Layers, Package, LayoutGrid, List as ListIcon, Eye, Image as ImageIcon, AlertTriangle } from 'lucide-react';

import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal';
import FilterHeader from '../components/products/FilterHeader';
import ProductEditModal from '../components/products/ProductEditModal';
import ProductShowcaseModal from '../components/products/ProductShowcaseModal';

const ProductManager = () => {
  const { products, types, productBoms, quotes, addProduct, updateProduct, deleteProduct, updateProductBOM, hasPermission } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShowcaseOpen, setIsShowcaseOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
      isOpen: boolean;
      product: Product | null;
      usageWarning: string | null;
  }>({
      isOpen: false,
      product: null,
      usageWarning: null
  });

  const canViewCost = hasPermission('products', 'view_cost');
  const canCreate = hasPermission('products', 'create');
  const canEdit = hasPermission('products', 'edit');
  const canDelete = hasPermission('products', 'delete');

  const handleOpenEditModal = (product?: Product) => {
    setSelectedProduct(product || null);
    setIsModalOpen(true);
  };

  const handleOpenShowcase = (product: Product) => {
      setSelectedProduct(product);
      setIsShowcaseOpen(true);
  };

  const toggleRowExpansion = (productId: number) => {
      const newExpanded = new Set(expandedRows);
      if (newExpanded.has(productId)) newExpanded.delete(productId);
      else newExpanded.add(productId);
      setExpandedRows(newExpanded);
  };

  const handleSaveProduct = (formData: Partial<Product>, bomItems: BOMItem[]) => {
    let savedProductId = selectedProduct?.id;

    if (selectedProduct) {
      updateProduct({ ...selectedProduct, ...formData } as Product);
    } else {
      savedProductId = Date.now(); // Generate numeric ID
      const newProduct: Product = {
        ...formData,
        id: savedProductId,
      } as Product;
      addProduct(newProduct);
    }

    // Save Product BOM
    if (savedProductId) {
        if (bomItems.length > 0) {
            updateProductBOM(savedProductId, bomItems);
        } else {
            // Optional: If you want to clear BOM when empty, you can send empty array
            updateProductBOM(savedProductId, []);
        }
    }
    setIsModalOpen(false);
  };

  const handleRemoveDeadBOMItem = (parentProductId: number, bomItemId: number) => {
      if(!window.confirm("确认移除此无效组件记录吗？")) return;
      const bom = productBoms.find(b => b.productId === parentProductId);
      if(bom) {
          const removeItemRec = (list: BOMItem[]): BOMItem[] => {
              return list.filter(i => i.id !== bomItemId).map(i => ({
                  ...i,
                  children: i.children ? removeItemRec(i.children) : undefined
              }));
          };
          const newItems = removeItemRec(bom.items);
          updateProductBOM(parentProductId, newItems);
      }
  };

  const checkProductUsage = (productId: number) => {
      const inBomItems = productBoms.some(b => b.items.some(item => item.productId === productId));
      const inQuotes = quotes.some(q => q.items.some(i => i.productId === productId));
      
      const usages = [];
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

  const resolveImageUrl = (src?: string) => {
      if (!src) return '';
      if (src.startsWith('/storage')) {
           const config = localStorage.getItem('cpq_api_config');
           const baseUrl = config ? JSON.parse(config).baseUrl : 'http://localhost:3002';
           const rootUrl = baseUrl.replace(/\/api\/?$/, '');
           return `${rootUrl}${src}`;
      }
      return src;
  };

  const getTypeName = (typeId: number) => {
      return types.find(t => t.id === typeId)?.name || `ID:${typeId}`;
  };

  const filteredProducts = products.filter(p => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(lowerSearch) || 
        p.materialCode.toLowerCase().includes(lowerSearch);
    const matchesType = !selectedTypeFilter || String(p.type) === selectedTypeFilter;
    const matchesColumns = Object.entries(columnFilters).every(([key, value]) => {
        if (!value) return true;
        const filterVal = value.toLowerCase();
        if (key === 'name') return p.name.toLowerCase().includes(filterVal);
        if (key === 'type') return getTypeName(p.type).toLowerCase().includes(filterVal);
        const itemVal = String((p as any)[key] || '').toLowerCase();
        return itemVal.includes(filterVal);
    });
    return matchesSearch && matchesType && matchesColumns;
  });

  // Calculate dynamic style for badge based on color string
  const getTypeStyle = (typeId: number) => {
      const def = types.find(t => t.id === typeId);
      if (!def) return { className: 'bg-slate-100 text-slate-700', style: {} };
      
      const color = def.color;
      // If color is a hex code
      if (color.startsWith('#')) {
          return {
              className: '',
              style: {
                  backgroundColor: color + '20', // ~12% opacity hex
                  color: color,
                  border: `1px solid ${color}40`
              }
          };
      }
      // Fallback for legacy tailwind color names (e.g. 'blue')
      return {
          className: `bg-${color}-100 text-${color}-700`,
          style: {}
      };
  };

  const calculateBOMTotal = (items: BOMItem[], field: 'cost') => {
      return items.reduce((sum, item) => {
          const p = products.find(prod => prod.id === item.productId);
          return sum + ((p?.[field] || 0) * item.quantity);
      }, 0);
  };

  const tableColSpan = 8 + (canViewCost ? 1 : 0) + ((canEdit || canDelete) ? 1 : 0);

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">产品库管理</h2>
          <p className="text-slate-500">管理产品、组件及零件信息，维护物料主数据。</p>
        </div>
        <div className="flex items-center gap-3">
             <div className="bg-white border border-slate-200 rounded-lg p-1 flex">
                 <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    title="列表视图"
                 >
                     <ListIcon className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    title="展示视图"
                 >
                     <LayoutGrid className="w-4 h-4" />
                 </button>
             </div>
             {canCreate && (
              <button 
                onClick={() => handleOpenEditModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                新增项目
              </button>
            )}
        </div>
      </div>

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
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {viewMode === 'list' ? (
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
                        <FilterHeader label="分类" fieldKey="category" columnFilters={columnFilters} setColumnFilters={setColumnFilters} activeFilterCol={activeFilterCol} setActiveFilterCol={setActiveFilterCol} />
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
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                      <tr>
                          <td colSpan={tableColSpan} className="px-6 py-12 text-center text-slate-400">没有找到匹配的产品。</td>
                      </tr>
                  ) : filteredProducts.map((product) => {
                    const typeName = getTypeName(product.type);
                    const typeStyle = getTypeStyle(product.type);
                    const isExpanded = expandedRows.has(product.id);
                    const relatedBOM = productBoms.find(b => b.productId === product.id);
                    const bomItemCount = relatedBOM ? relatedBOM.items.length : 0;
                    
                    const mainImage = product.baseImage || (product.galleryImages && product.galleryImages.length > 0 ? product.galleryImages[0].url : null);

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
                        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => handleOpenShowcase(product)}>
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200 shrink-0">
                            {mainImage ? <img src={resolveImageUrl(mainImage)} alt="" className="w-full h-full object-cover"/> : <Cpu className="w-6 h-6" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">{product.name}</p>
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
                        <span 
                            className={`px-2 py-1 rounded text-xs font-medium ${typeStyle.className}`}
                            style={typeStyle.style}
                        >
                          {typeName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                          {product.category || '-'}
                      </td>
                      {canViewCost && (
                        <td className="px-6 py-4 text-sm text-slate-600 font-mono">¥{product.cost.toLocaleString()}</td>
                      )}
                      <td className="px-6 py-4 text-sm font-medium text-slate-800 font-mono">¥{(product.basePrice || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${product.inventory > 10 ? 'bg-emerald-500' : product.inventory > 0 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                            <span className="text-sm text-slate-600">{product.inventory}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => handleOpenShowcase(product)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="查看详情">
                                <Eye className="w-4 h-4" />
                            </button>
                            {canEdit && (
                                <button onClick={() => handleOpenEditModal(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑">
                                <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                            {canDelete && (
                                <button 
                                    onClick={() => requestDelete(product)} 
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="删除"
                                >
                                <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                      </td>
                    </tr>
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
                                                    onClick={() => handleOpenEditModal(product)}
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
                                                        {canEdit && <th className="px-4 py-2 text-right w-16">操作</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {relatedBOM.items.map(item => {
                                                        const subP = products.find(p => p.id === item.productId);
                                                        return (
                                                            <tr key={item.id} className={`hover:bg-slate-50/50 ${!subP ? 'bg-red-50/30' : ''}`}>
                                                                <td className="px-4 py-2 flex items-center gap-2">
                                                                    <CornerDownRight className="w-3 h-3 text-slate-300" />
                                                                    {subP ? (
                                                                        <span className="text-slate-700">{subP.name}</span>
                                                                    ) : (
                                                                        <span className="text-red-500 text-xs flex items-center gap-1 font-medium" title={`原产品ID: ${item.productId}`}>
                                                                            <AlertTriangle className="w-3 h-3" />
                                                                            组件已删除 / 请核对
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{subP?.materialCode || '-'}</td>
                                                                <td className="px-4 py-2 text-center text-slate-600 font-medium">{item.quantity}</td>
                                                                {canViewCost && (
                                                                    <td className="px-4 py-2 text-right text-slate-500">
                                                                        {subP ? `¥${((subP.cost || 0) * item.quantity).toLocaleString()}` : '-'}
                                                                    </td>
                                                                )}
                                                                {canEdit && (
                                                                    <td className="px-4 py-2 text-right">
                                                                        {!subP && (
                                                                            <button 
                                                                                onClick={() => handleRemoveDeadBOMItem(product.id, item.id)}
                                                                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-100 rounded transition-colors text-xs flex items-center justify-end gap-1 ml-auto"
                                                                                title="移除此无效记录"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                                移除
                                                                            </button>
                                                                        )}
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
                                                            {canEdit && <td></td>}
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
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredProducts.map(product => {
                  const typeName = getTypeName(product.type);
                  const typeStyle = getTypeStyle(product.type);
                  
                  // Priority: Main Image (baseImage) -> First Gallery Image -> null
                  const mainImage = product.baseImage || (product.galleryImages && product.galleryImages.length > 0 ? product.galleryImages[0].url : null);
                  return (
                  <div 
                    key={product.id} 
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-[320px]"
                    onClick={() => handleOpenShowcase(product)}
                  >
                      <div className="h-40 bg-slate-50 relative overflow-hidden flex items-center justify-center">
                          {mainImage ? (
                              <img src={resolveImageUrl(mainImage)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                              <Cpu className="w-12 h-12 text-slate-300" />
                          )}
                          <div className="absolute top-2 right-2 flex gap-1">
                               <span 
                                    className={`text-[10px] font-bold px-2 py-1 rounded shadow-sm backdrop-blur-sm ${typeStyle.className}`}
                                    style={{...typeStyle.style, opacity: 0.95}}
                               >
                                   {typeName}
                               </span>
                          </div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                          <div className="text-xs text-slate-400 mb-1">{product.materialCode}</div>
                          <h3 className="font-bold text-slate-800 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                          <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1">{product.specifications || product.description || '暂无描述'}</p>
                          <div className="flex justify-between items-end">
                              <span className="text-lg font-bold text-blue-600">¥{(product.basePrice || 0).toLocaleString()}</span>
                              <div className="text-xs text-slate-400 flex items-center gap-1">
                                  库存: {product.inventory}
                              </div>
                          </div>
                      </div>
                  </div>
              )})}
              {filteredProducts.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400">
                      没有找到匹配的产品。
                  </div>
              )}
          </div>
      )}

      <ProductEditModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        productToEdit={selectedProduct} 
        onSave={handleSaveProduct} 
      />

      <ProductShowcaseModal
        isOpen={isShowcaseOpen}
        onClose={() => setIsShowcaseOpen(false)}
        product={selectedProduct}
        onEdit={() => { setIsShowcaseOpen(false); handleOpenEditModal(selectedProduct || undefined); }}
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
