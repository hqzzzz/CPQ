import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Product, BOMStructure, BOMItem } from '../types';
import { ChevronRight, ChevronDown, Plus, Trash, Box, DollarSign, Layers, FilePlus, FileText } from 'lucide-react';
import { AddItemModal, CreateBOMModal } from '../components/bom/BOMModals';

interface BOMNodeProps {
  item: BOMItem;
  allProducts: Product[];
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, parentTypeName: string) => void;
  onUpdate: (id: string, updates: Partial<BOMItem>) => void;
  level?: number;
  canViewCost: boolean;
}

// Recursive Component for BOM Tree
const BOMNode: React.FC<BOMNodeProps> = ({ 
  item, 
  allProducts, 
  onDelete, 
  onAddChild,
  onUpdate,
  level = 0,
  canViewCost
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const { types } = useStore();
  const product = allProducts.find(p => p.id === item.productId);

  if (!product) return null;

  const totalCost = product.cost * item.quantity;
  const typeDef = types.find(t => t.name === product.type);
  const currentLevel = typeDef ? typeDef.level : 99;

  // Determine if we can add children (Can add if there are types with higher level number available)
  const canAddChildren = types.some(t => t.level > currentLevel);

  return (
    <div className="select-none">
      <div 
        className={`flex items-center p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors group`}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className={`mr-2 p-1 rounded hover:bg-slate-200 text-slate-500 ${(!item.children || item.children.length === 0) && 'invisible'}`}
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        
        <div className="flex-1 grid grid-cols-12 gap-4 items-center">
          {/* Column 1: Name (Span 5) */}
          <div className="col-span-5 flex items-center gap-3">
            <Box className={`w-4 h-4 text-${typeDef?.color || 'slate'}-500 shrink-0`} />
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-slate-800 font-medium truncate">{product.name}</span>
                    <span className={`text-[10px] px-1.5 rounded border bg-${typeDef?.color || 'slate'}-50 border-${typeDef?.color || 'slate'}-200 text-${typeDef?.color || 'slate'}-700 shrink-0`}>
                        {product.type}
                    </span>
                </div>
                <div className="text-xs text-slate-400 truncate">{product.materialCode}</div>
            </div>
          </div>

          {/* Column 2: Quantity Input (Span 2) */}
          <div className="col-span-2 flex justify-center">
            <input 
                type="number" 
                min="1"
                className="w-20 p-1 border border-slate-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none hover:border-blue-300 transition-colors"
                value={item.quantity}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onUpdate(item.id, { quantity: Math.max(1, Number(e.target.value)) })}
            />
          </div>

          {/* Column 3: Unit (Span 1) */}
          <div className="col-span-1 text-slate-600 text-sm truncate" title={product.unit}>
            {product.unit}
          </div>

          {/* Column 4: Cost (Span 2) */}
          <div className="col-span-2 text-slate-600 text-sm truncate">
            {canViewCost ? `¥${product.cost.toLocaleString()}` : '***'}
          </div>

          {/* Column 5: Total & Actions (Span 2) */}
          <div className="col-span-2 flex justify-between items-center">
             <span className="font-semibold text-slate-800">{canViewCost ? `¥${totalCost.toLocaleString()}` : '***'}</span>
             <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {canAddChildren && (
                    <button 
                        onClick={() => onAddChild(item.id, product.type)} 
                        className="text-blue-500 hover:bg-blue-100 p-1 rounded"
                        title="添加子项"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                )}
                <button onClick={() => onDelete(item.id)} className="text-red-400 hover:bg-red-100 p-1 rounded" title="删除">
                    <Trash className="w-4 h-4" />
                </button>
             </div>
          </div>
        </div>
      </div>
      
      {isOpen && item.children && (
        <div>
          {item.children.map(child => (
            <BOMNode 
              key={child.id} 
              item={child} 
              allProducts={allProducts} 
              onDelete={onDelete}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              level={level + 1} 
              canViewCost={canViewCost}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const BOMBuilder = () => {
  const { products, boms, updateBOM, addBOM, deleteBOM, currentUser } = useStore();
  const [selectedBOMId, setSelectedBOMId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Permission Check
  const canViewCost = currentUser?.role !== 'sales';

  // Select first BOM on load if none selected
  useEffect(() => {
      if (!selectedBOMId && boms.length > 0) {
          setSelectedBOMId(boms[0].id);
      } else if (boms.length === 0) {
          setSelectedBOMId('');
      } else if (selectedBOMId && !boms.find(b => b.id === selectedBOMId)) {
           // If selected BOM was deleted, select another one
           setSelectedBOMId(boms[0].id);
      }
  }, [boms, selectedBOMId]);

  // Modal State for adding children
  const [modalState, setModalState] = useState<{
      isOpen: boolean;
      targetParentId: string | null; // null for root
      parentTypeName: string;
  }>({
      isOpen: false,
      targetParentId: null,
      parentTypeName: ''
  });

  const currentBOM = boms.find(b => b.id === selectedBOMId);

  // Helper to calculate total cost roll-up recursively
  const calculateRollup = (items: BOMItem[]): number => {
    let total = 0;
    items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        total += p.cost * item.quantity;
        if (item.children) {
          total += calculateRollup(item.children);
        }
      }
    });
    return total;
  };

  const totalBOMCost = currentBOM ? calculateRollup(currentBOM.items) : 0;

  // Recursive Add
  const addItemToTree = (items: BOMItem[], targetParentId: string | null, newItem: BOMItem): BOMItem[] => {
      if (targetParentId === null) {
          return [...items, newItem];
      }
      return items.map(item => {
          if (item.id === targetParentId) {
              return { ...item, children: [...(item.children || []), newItem] };
          }
          if (item.children) {
              return { ...item, children: addItemToTree(item.children, targetParentId, newItem) };
          }
          return item;
      });
  };

  // Recursive Update
  const updateItemInTree = (items: BOMItem[], itemId: string, updates: Partial<BOMItem>): BOMItem[] => {
      return items.map(item => {
          if (item.id === itemId) return { ...item, ...updates };
          if (item.children) return { ...item, children: updateItemInTree(item.children, itemId, updates) };
          return item;
      });
  };

  // Recursive Delete
  const deleteItemFromTree = (items: BOMItem[], itemId: string): BOMItem[] => {
      return items
        .filter(item => item.id !== itemId)
        .map(item => ({
            ...item,
            children: item.children ? deleteItemFromTree(item.children, itemId) : undefined
        }));
  };

  const handleOpenAddModal = (parentId: string | null, parentTypeName: string) => {
      setModalState({
          isOpen: true,
          targetParentId: parentId,
          parentTypeName: parentTypeName
      });
  };

  const handleConfirmAdd = (productId: string, quantity: number) => {
      if (!currentBOM) return;
      
      const newItem: BOMItem = {
          id: `bi-${Date.now()}`,
          productId,
          quantity,
          children: []
      };

      const updatedItems = addItemToTree(currentBOM.items, modalState.targetParentId, newItem);
      updateBOM({ ...currentBOM, items: updatedItems });
  };

  const handleUpdateItem = (itemId: string, updates: Partial<BOMItem>) => {
      if (!currentBOM) return;
      const updatedItems = updateItemInTree(currentBOM.items, itemId, updates);
      updateBOM({ ...currentBOM, items: updatedItems });
  };

  const handleDeleteItem = (itemId: string) => {
    if (!currentBOM) return;
    if (!window.confirm("确定要删除此项目及其子项吗?")) return;

    const updatedItems = deleteItemFromTree(currentBOM.items, itemId);
    updateBOM({ ...currentBOM, items: updatedItems });
  };

  const handleCreateBOM = (name: string) => {
      const newBOM: BOMStructure = {
          id: `bom-${Date.now()}`,
          name: name,
          items: []
      };
      addBOM(newBOM);
      setSelectedBOMId(newBOM.id);
  };

  const handleDeleteBOM = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(window.confirm('确定要删除整个 BOM 配置吗？此操作无法撤销。')) {
          deleteBOM(id);
      }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">BOM 构建与配置</h2>
          <p className="text-slate-500">构建多层级辅助 BOM 清单，可直接用于智能报价。</p>
        </div>
        {canViewCost && (
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
            <span className="text-sm text-slate-500">预计 BOM 总成本:</span>
            <span className="text-xl font-bold text-emerald-600 flex items-center">
              <DollarSign className="w-5 h-5" />
              {totalBOMCost.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
        {/* Left: BOM List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-fit">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="font-semibold text-slate-700">活跃 BOM 列表</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{boms.length}</span>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
            {boms.map(bom => (
              <div
                key={bom.id}
                onClick={() => setSelectedBOMId(bom.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all cursor-pointer group flex justify-between items-center ${
                  selectedBOMId === bom.id 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium shadow-sm' 
                    : 'border-transparent hover:bg-slate-50 text-slate-600 border-slate-100'
                }`}
              >
                <div className="truncate flex-1 pr-2">
                    <div className="truncate">{bom.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal truncate">ID: {bom.id}</div>
                </div>
                <button 
                    onClick={(e) => handleDeleteBOM(e, bom.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded transition-all"
                    title="删除 BOM"
                >
                    <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {boms.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                    暂无 BOM 数据
                </div>
            )}
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> 创建新 BOM
          </button>
        </div>

        {/* Right: BOM Structure Editor */}
        <div className="lg:col-span-3 flex flex-col gap-4">
           {/* Tree View */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden min-h-[500px] flex flex-col">
             {currentBOM ? (
                <>
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 grid grid-cols-12 gap-4 text-xs font-semibold text-slate-500 uppercase">
                        <div className="col-span-5">结构层级</div>
                        <div className="col-span-2 text-center">数量</div>
                        <div className="col-span-1">单位</div>
                        <div className="col-span-2">{canViewCost ? '单位成本' : '***'}</div>
                        <div className="col-span-2 text-right">小计 / 操作</div>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-0">
                        {/* Root Header Node - Now standalone, representing the BOM itself */}
                        <div className="flex items-center p-3 bg-blue-50/30 border-b border-blue-100 group">
                            <div className="mr-2 w-6"></div> {/* Spacer for chevron */}
                            <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-5 flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-700" />
                                <div>
                                    <span className="font-bold text-slate-800 text-lg">{currentBOM.name}</span>
                                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                                        辅助 BOM
                                    </span>
                                </div>
                            </div>
                            <div className="col-span-2 text-center text-slate-400 text-sm">-</div>
                            <div className="col-span-1 text-slate-400 text-sm">-</div>
                            <div className="col-span-2 text-slate-400 text-sm">-</div>
                            <div className="col-span-2 flex justify-end items-center">
                                <button 
                                    onClick={() => handleOpenAddModal(null, 'ROOT')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded shadow-sm flex items-center gap-1 text-xs"
                                >
                                    <Plus className="w-3 h-3" /> 添加
                                </button>
                            </div>
                            </div>
                        </div>

                        {/* Children */}
                        {currentBOM.items.map(item => (
                        <BOMNode 
                            key={item.id} 
                            item={item} 
                            allProducts={products} 
                            onDelete={handleDeleteItem}
                            onAddChild={handleOpenAddModal}
                            onUpdate={handleUpdateItem}
                            level={1} 
                            canViewCost={canViewCost}
                        />
                        ))}
                        {currentBOM.items.length === 0 && (
                            <div className="p-8 text-center text-slate-400">
                                <Layers className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>此 BOM 暂无组件，请点击上方“添加”按钮开始构建。</p>
                            </div>
                        )}
                    </div>
                </>
             ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400">
                     <FilePlus className="w-16 h-16 mb-4 opacity-20" />
                     <p className="text-lg font-medium">请选择或创建一个 BOM</p>
                     <p className="text-sm">在左侧列表中选择项目，或点击“创建新 BOM”开始。</p>
                 </div>
             )}
           </div>
        </div>
      </div>

      <AddItemModal 
          isOpen={modalState.isOpen}
          onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
          onAdd={handleConfirmAdd}
          parentTypeName={modalState.parentTypeName}
      />

      <CreateBOMModal 
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateBOM}
      />
    </div>
  );
};

export default BOMBuilder;