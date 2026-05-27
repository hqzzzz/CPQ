
import React, { useState, useRef, useEffect } from 'react';
import { Product, BOMItem, ProductDocument } from '../../types';
import { useStore } from '../../store';
import { generateProductDescription } from '../../services/geminiService';
import { apiService } from '../../services/api';
import { X, Package, Layers, Image as ImageIcon, Edit2, DollarSign, Calculator, Loader2, Sparkles, Info, Plus, Trash2, Images, FileText, UploadCloud, Eye, File, FileCode, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ProductEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit: Product | null;
  onSave: (productData: Partial<Product>, bomItems: BOMItem[]) => void;
}

const ProductEditModal: React.FC<ProductEditModalProps> = ({ isOpen, onClose, productToEdit, onSave }) => {
  const { products, types, categories, productBoms, currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<'basic' | 'bom' | 'gallery' | 'docs'>('basic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const canViewCost = currentUser?.role !== 2; // Sales role ID

  const [formData, setFormData] = useState<Partial<Product>>({});

  const [galleryImages, setGalleryImages] = useState<ProductDocument[]>([]);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);

  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [isAutoPrice, setIsAutoPrice] = useState(false);
  const [newBomItemId, setNewBomItemId] = useState<number | ''>('');
  const [newBomItemQty, setNewBomItemQty] = useState(1);
  const [materialCodeError, setMaterialCodeError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setNewBomItemId('');
      setNewBomItemQty(1);
      resetPreview();
      setMaterialCodeError('');

      if (productToEdit) {
        setFormData(productToEdit);
        setGalleryImages(productToEdit.galleryImages || []);
        setDocuments(productToEdit.documents || []);

        // Fetch BOM from productBoms store
        const existingBOM = productBoms.find(b => b.productId === productToEdit.id);
        if (existingBOM) {
          setBomItems(existingBOM.items);
          const calculatedCost = existingBOM.items.reduce((sum, item) => {
            const p = products.find(prod => prod.id === item.productId);
            return sum + ((p?.cost || 0) * item.quantity);
          }, 0);
          const calculatedPrice = Math.round(calculatedCost * 1.13);
          const currentPrice = productToEdit.basePrice || 0;
          const isPriceAligned = Math.abs(currentPrice - calculatedPrice) < 2;
          setIsAutoPrice(isPriceAligned && existingBOM.items.length > 0);
        } else {
          setBomItems([]);
          setIsAutoPrice(false);
        }
      } else {
        setFormData({
          type: types[0]?.id || 1,
          category: '',
          materialCode: '',
          unit: '个',
          name: '',
          basePrice: 0,
          cost: 0,
          inventory: 0,
          description: '',
          specifications: '',
          baseImage: '' // Initialize with empty string for image
        });
        setGalleryImages([]);
        setDocuments([]);
        setBomItems([]);
        setIsAutoPrice(false);
      }
    }
  }, [isOpen, productToEdit, productBoms, products, types]);

  const resetPreview = () => {
    setPreviewImage(null);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Helper to resolve URL (handle relative /storage URLs vs absolute http)
  const resolveUrl = (src: string) => {
    if (!src) return '';
    if (src.startsWith('/storage')) {
      const config = localStorage.getItem('cpq_api_config');
      const baseUrl = config ? JSON.parse(config).baseUrl : 'http://localhost:3002';
      // Remove trailing /api if present to get root
      const rootUrl = baseUrl.replace(/\/api\/?$/, '');
      return `${rootUrl}${src}`;
    }
    return src;
  };

  const openPreview = (src: string) => {
    setPreviewImage(resolveUrl(src));
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const calculateBOMTotal = (items: BOMItem[], field: 'cost' | 'basePrice') => {
    return items.reduce((sum, item) => {
      const p = products.find(prod => prod.id === item.productId);
      return sum + ((p?.[field] || 0) * item.quantity);
    }, 0);
  };

  useEffect(() => {
    if (!isOpen) return;
    const totalBOMCost = calculateBOMTotal(bomItems, 'cost');

    if (isAutoPrice) {
      const newPrice = Math.round(totalBOMCost * 1.13);
      setFormData(prev => ({
        ...prev,
        cost: totalBOMCost,
        basePrice: newPrice
      }));
    } else if (bomItems.length > 0) {
      setFormData(prev => {
        const updates: any = { cost: totalBOMCost };
        // Automatically adjust Base Price if it's lower than Cost
        if ((prev.basePrice || 0) < totalBOMCost) {
          updates.basePrice = totalBOMCost;
        }
        return { ...prev, ...updates };
      });
    }
  }, [bomItems, isAutoPrice, products, isOpen]);

  // --- Handlers ---

  // Validate material code uniqueness
  const validateMaterialCode = (materialCode: string): boolean => {
    if (!materialCode || materialCode.trim() === '') {
      setMaterialCodeError('物料编码不能为空');
      return false;
    }

    const trimmedCode = materialCode.trim();

    // Check if material code already exists for other products
    const duplicateProduct = products.find(p =>
      p.materialCode &&
      p.materialCode.trim() === trimmedCode &&
      (!productToEdit || p.id !== productToEdit.id)
    );

    if (duplicateProduct) {
      setMaterialCodeError(`物料编码 "${trimmedCode}" 已存在（产品：${duplicateProduct.name}）`);
      return false;
    }

    setMaterialCodeError('');
    return true;
  };

  // 1. Main Image: Uses Base64 (FileReader), stored in baseImage
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, baseImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // 2. Gallery Images: Uses Server-Side File Upload
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        const tempId = productToEdit?.id || Date.now();
        const uploads = Array.from(files).map(file => apiService.uploadFile(file, tempId));
        const results = await Promise.all(uploads);
        // results are ProductDocument objects
        setGalleryImages(prev => [...prev, ...results]);
      } catch (error) {
        console.error("Gallery upload failed", error);
        alert("图片上传失败，请检查服务器连接。");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  // 3. Documents: Uses Server-Side File Upload
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        const tempId = productToEdit?.id || Date.now();
        const uploads = Array.from(files).map(file => apiService.uploadFile(file, tempId));
        const results = await Promise.all(uploads);
        setDocuments(prev => [...prev, ...results]);
      } catch (error) {
        console.error("Document upload failed", error);
        alert("文档上传失败，请检查服务器连接。");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeDocument = (id: string | number) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const previewDocument = (doc: ProductDocument) => {
    window.open(resolveUrl(doc.url), '_blank');
  };

  const handleAIGenerate = async () => {
    if (!formData.name) {
      alert("请先输入产品名称。");
      return;
    }
    setIsGenerating(true);
    const desc = await generateProductDescription(
      formData.name || '',
      formData.category || '通用',
      `规格: ${formData.specifications || '标准'}`
    );
    setFormData(prev => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const handleAddBomItem = () => {
    if (!newBomItemId) return;
    if (productToEdit && newBomItemId === productToEdit.id) {
      alert("不能将产品自身添加为子项");
      return;
    }
    const newItem: BOMItem = {
      id: Date.now(), // Numeric ID
      productId: newBomItemId,
      quantity: newBomItemQty,
      children: []
    };
    setBomItems([...bomItems, newItem]);
    setNewBomItemId('');
    setNewBomItemQty(1);
  };

  const handleUpdateBomItemQty = (id: number, newQty: number) => {
    setBomItems(prevItems => prevItems.map(item =>
      item.id === id ? { ...item, quantity: Math.max(1, newQty) } : item
    ));
  };

  const handleRemoveBomItem = (id: number) => {
    setBomItems(bomItems.filter(item => item.id !== id));
  };

  const handleSubmit = () => {
    // Validate material code uniqueness
    if (!validateMaterialCode(formData.materialCode || '')) {
      return;
    }

    const finalData = {
      ...formData,
      galleryImages,
      documents
    };
    onSave(finalData, bomItems);
  };

  // Format bytes, handlers...
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleAdjustment = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.5, scale + scaleAdjustment), 4);
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
          <div className="p-0 rounded-t-xl bg-slate-50 border-b border-slate-200">
            <div className="p-6 flex justify-between items-center pb-4">
              <h3 className="text-xl font-bold text-slate-800">{productToEdit ? '编辑项目' : '新建项目'}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex px-6 gap-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab('basic')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'basic' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Package className="w-4 h-4" /> 基础信息
              </button>
              <button
                onClick={() => setActiveTab('bom')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'bom' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Layers className="w-4 h-4" /> BOM 结构
                {bomItems.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{bomItems.length}</span>}
              </button>
              <button
                onClick={() => setActiveTab('gallery')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'gallery' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Images className="w-4 h-4" /> 产品相册
                {galleryImages.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{galleryImages.length}</span>}
              </button>
              <button
                onClick={() => setActiveTab('docs')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'docs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <FileText className="w-4 h-4" /> 产品文档
                {documents.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{documents.length}</span>}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-white relative">
            {isUploading && (
              <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-2" />
                <span className="text-sm font-medium text-slate-600">正在上传文件到服务器...</span>
              </div>
            )}

            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="flex gap-6 items-start">
                  <div
                    className="w-32 h-32 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 relative group overflow-hidden"
                    onClick={() => !formData.baseImage && fileInputRef.current?.click()}
                    style={{ cursor: formData.baseImage ? 'default' : 'pointer' }}
                  >
                    {formData.baseImage ? (
                      <>
                        <img
                          src={resolveUrl(formData.baseImage)}
                          alt="Preview"
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => openPreview(formData.baseImage!)}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                          <button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="bg-white/90 text-slate-700 p-2 rounded-full hover:bg-white hover:text-blue-600 shadow-sm pointer-events-auto"
                            title="更换图片"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center hover:bg-blue-50 transition-colors w-full h-full">
                        <ImageIcon className="w-8 h-8 mb-2" />
                        <span className="text-xs">主图上传</span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>
                  {formData.baseImage && (
                    <button onClick={() => setFormData({ ...formData, baseImage: '' })} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 mt-2">
                      <X className="w-3 h-3" /> 移除图片
                    </button>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 mb-2">支持 JPG, PNG 格式。建议尺寸 200x200 像素。</p>
                    <p className="text-xs text-slate-400">如有主图，点击图片可放大查看，悬停点击图标可更换。(主图使用 Base64 存储)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">物料编码</label>
                    <input
                      type="text"
                      className={`w-full p-2 border rounded-lg ${
                        materialCodeError 
                          ? 'border-red-500 bg-red-50 focus:ring-2 focus:ring-red-200' 
                          : 'border-slate-300 focus:ring-2 focus:ring-blue-200'
                      }`}
                      placeholder="例如: MAT-001"
                      value={formData.materialCode || ''}
                      onChange={e => {
                        setFormData({ ...formData, materialCode: e.target.value });
                        if (materialCodeError) setMaterialCodeError('');
                      }}
                      onBlur={() => validateMaterialCode(formData.materialCode || '')}
                      disabled={!!productToEdit} 
                    />
                    {materialCodeError && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <span>⚠</span> {materialCodeError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">单位 (SKU)</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      placeholder="个, 箱, 套..."
                      value={formData.unit || ''}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">产品名称</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">产品类型</label>
                    <select
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={formData.type || 1}
                      onChange={e => setFormData({ ...formData, type: Number(e.target.value) })}
                    >
                      {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>


                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">规格参数</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    value={formData.specifications || ''}
                    onChange={e => setFormData({ ...formData, specifications: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">产品分类 (业务分组)</label>
                    <select
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      value={formData.category || ''}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="">-- 请选择 --</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      {/* Fallback for legacy data that might not match current categories */}
                      {formData.category && !categories.some(c => c.name === formData.category) && (
                        <option value={formData.category}>{formData.category} (Legacy)</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">库存数量</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={formData.inventory ?? 0}
                      onFocus={(e) => e.target.select()}
                      onChange={e => setFormData({ ...formData, inventory: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" /> 定价策略
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={isAutoPrice}
                        onChange={(e) => setIsAutoPrice(e.target.checked)}
                        disabled={!canViewCost}
                        className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-slate-600">从 BOM 自动计算价格</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {canViewCost && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">成本 (¥)</label>
                        <div className="relative">
                          <input
                            type="number"
                            className={`w-full p-2 border border-slate-300 rounded-lg ${isAutoPrice || bomItems.length > 0 ? 'bg-slate-100 text-slate-500' : ''}`}
                            value={formData.cost ?? 0}
                            onFocus={(e) => e.target.select()}
                            readOnly={isAutoPrice || bomItems.length > 0}
                            onChange={e => {
                              const newCost = Number(e.target.value);
                              setFormData(prev => {
                                const updates: any = { cost: newCost };
                                // Automatically raise Base Price if Cost exceeds it
                                if (!isAutoPrice && (prev.basePrice || 0) < newCost) {
                                  updates.basePrice = newCost;
                                }
                                return { ...prev, ...updates };
                              });
                            }}
                          />
                          {(isAutoPrice || bomItems.length > 0) && <Calculator className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                    )}
                    <div className={!canViewCost ? "col-span-2" : ""}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">基准价 (¥)</label>
                      <div className="relative">
                        <input
                          type="number"
                          className={`w-full p-2 border border-slate-300 rounded-lg ${isAutoPrice ? 'bg-slate-100 text-slate-500 font-bold' : ''}`}
                          value={formData.basePrice ?? 0}
                          onFocus={(e) => e.target.select()}
                          readOnly={isAutoPrice}
                          onChange={e => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                          onBlur={() => {
                            // On blur, ensure Base Price is not lower than Cost
                            if (!isAutoPrice && (formData.basePrice || 0) < (formData.cost || 0)) {
                              setFormData(prev => ({ ...prev, basePrice: prev.cost }));
                            }
                          }}
                        />
                        {isAutoPrice && <Calculator className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                  </div>
                </div>



                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    详细描述
                    <button
                      onClick={handleAIGenerate}
                      disabled={isGenerating}
                      className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full hover:bg-violet-200 inline-flex items-center gap-1"
                    >
                      {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI 智能生成
                    </button>
                  </label>
                  <textarea
                    className="w-full p-2 border border-slate-300 rounded-lg h-24"
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  ></textarea>
                </div>
              </div>
            )}

            {/* Rest of the tabs (gallery, docs, bom) logic remains same, just ensuring context is used correctly */}
            {/* ... (Existing JSX for Gallery, Docs, BOM tabs) ... */}
            {activeTab === 'gallery' && (
              <div className="space-y-4">
                {/* ... */}
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-slate-500">上传多张产品图片（如细节图、应用场景等）。</p>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700"
                  >
                    <UploadCloud className="w-4 h-4" /> 批量上传
                  </button>
                  <input type="file" ref={galleryInputRef} className="hidden" multiple accept="image/*" onChange={handleGalleryUpload} />
                </div>
                {/* ... (Existing Image Grid) ... */}
                {galleryImages.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                    <Images className="w-12 h-12 mb-2 opacity-50" />
                    <p className="text-sm">暂无图片，点击上方按钮上传</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {galleryImages.map((doc, index) => (
                      <div key={doc.id} className="relative group aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in" onClick={() => openPreview(doc.url)}>
                        <img src={resolveUrl(doc.url)} alt={doc.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <button onClick={(e) => { e.stopPropagation(); removeGalleryImage(index); }} className="p-1.5 bg-white rounded-full text-red-600 hover:text-red-700 shadow-lg pointer-events-auto"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'docs' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <button onClick={() => docInputRef.current?.click()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700">
                    <UploadCloud className="w-4 h-4" /> 上传文档
                  </button>
                  <input type="file" ref={docInputRef} className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleDocUpload} />
                </div>
                {/* ... (Existing Docs Table) ... */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-medium text-slate-600">文件名</th>
                        <th className="px-4 py-3 font-medium text-slate-600">大小</th>
                        <th className="px-4 py-3 font-medium text-slate-600">上传日期</th>
                        <th className="px-4 py-3 font-medium text-slate-600 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 flex items-center gap-2"><File className="w-4 h-4 text-blue-500" /><span className="truncate max-w-[200px]">{doc.name}</span></td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{formatBytes(doc.size)}</td>
                          <td className="px-4 py-3 text-slate-500">{new Date(doc.uploadDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => removeDocument(doc.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                      {documents.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">暂无文档</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'bom' && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                  <p className="text-sm text-blue-800 flex gap-2">
                    <Info className="w-5 h-5 shrink-0" />
                    在此定义该产品的组成结构 (Product BOM)。{canViewCost && '如果启用了“自动计算价格”，此处子项的总成本将决定基础价格(113%)。'}
                  </p>
                </div>
                {/* ... (Existing BOM Editor) ... */}
                <div className="flex items-end gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">选择组件</label>
                    <select className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={newBomItemId} onChange={e => setNewBomItemId(Number(e.target.value))}>
                      <option value="">-- 添加子项 --</option>
                      {products.filter(p => p.id !== productToEdit?.id).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">数量</label>
                    <input type="number" min="1" className="w-full p-2 border border-slate-300 rounded text-sm" value={newBomItemQty} onChange={e => setNewBomItemQty(Number(e.target.value))} />
                  </div>
                  <button onClick={handleAddBomItem} disabled={!newBomItemId} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-slate-500 font-medium">组件名称</th>
                          <th className="px-4 py-2 text-slate-500 font-medium text-center">数量</th>
                          {canViewCost && <th className="px-4 py-2 text-slate-500 font-medium text-right">小计</th>}
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bomItems.map(item => {
                          const product = products.find(p => p.id === item.productId);
                          if (!product) return null;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">{product.name}</td>
                              <td className="px-4 py-3 text-center">
                                <input type="number" min="1" className="w-20 p-1 border border-slate-300 rounded text-center text-sm" value={item.quantity} onChange={(e) => handleUpdateBomItemQty(item.id, Number(e.target.value))} />
                              </td>
                              {canViewCost && <td className="px-4 py-3 text-right">¥{product.cost * item.quantity}</td>}
                              <td className="px-4 py-3 text-right">
                                <button onClick={() => handleRemoveBomItem(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          );
                        })}
                        {bomItems.length === 0 && <tr><td colSpan={canViewCost ? 4 : 3} className="px-4 py-8 text-center text-slate-400">暂无子项</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-white rounded-b-xl">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
            <button 
              onClick={handleSubmit} 
              disabled={!!materialCodeError}
              className={`px-4 py-2 rounded-lg shadow-lg shadow-blue-500/20 ${
                materialCodeError 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              保存更改
            </button>
          </div>
        </div>
      </div>
      {/* Preview Modal... */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-0 overflow-hidden"
          onClick={resetPreview}
          onWheel={handleWheel}
        >
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 z-[80]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="text-white hover:text-blue-400 p-2 rounded-full hover:bg-white/10"><ZoomOut className="w-5 h-5" /></button>
            <span className="text-white text-xs font-mono min-w-[3ch] text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(4, s + 0.25))} className="text-white hover:text-blue-400 p-2 rounded-full hover:bg-white/10"><ZoomIn className="w-5 h-5" /></button>
            <div className="w-px h-4 bg-white/20 mx-2"></div>
            <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} className="text-white hover:text-blue-400 p-2 rounded-full hover:bg-white/10" title="重置"><RotateCcw className="w-5 h-5" /></button>
          </div>

          <button
            onClick={resetPreview}
            className="absolute top-4 right-4 text-white/50 hover:text-white p-2 transition-colors z-[80]"
            title="关闭预览"
          >
            <X className="w-10 h-10" />
          </button>

          <div
            className="w-full h-full flex items-center justify-center overflow-hidden cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-none transition-transform duration-75 ease-out select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                maxHeight: '90vh',
                maxWidth: '90vw'
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ProductEditModal;
