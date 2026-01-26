import React, { useState, useRef, useEffect } from 'react';
import { Product, BOMItem, ProductDocument } from '../../types';
import { useStore } from '../../store';
import { generateProductDescription } from '../../services/geminiService';
import { X, Package, Layers, Image as ImageIcon, Edit2, DollarSign, Calculator, Loader2, Sparkles, Info, Plus, Trash2, Images, FileText, UploadCloud, Eye, File, FileCode, ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';

interface ProductEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    productToEdit: Product | null;
    onSave: (productData: Partial<Product>, bomItems: BOMItem[]) => void;
}

const ProductEditModal: React.FC<ProductEditModalProps> = ({ isOpen, onClose, productToEdit, onSave }) => {
    const { products, types, boms, currentUser } = useStore();
    const [activeTab, setActiveTab] = useState<'basic' | 'bom' | 'gallery' | 'docs'>('basic');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Lightbox State
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // Permission check
    const canViewCost = currentUser?.role !== 'sales';

    // Form State
    const [formData, setFormData] = useState<Partial<Product>>({});
    
    // Additional Data State
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [documents, setDocuments] = useState<ProductDocument[]>([]);

    // BOM Editor State
    const [bomItems, setBomItems] = useState<BOMItem[]>([]);
    const [isAutoPrice, setIsAutoPrice] = useState(false);
    const [newBomItemId, setNewBomItemId] = useState('');
    const [newBomItemQty, setNewBomItemQty] = useState(1);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab('basic');
            setNewBomItemId('');
            setNewBomItemQty(1);
            resetPreview();

            if (productToEdit) {
                setFormData(productToEdit);
                setGalleryImages(productToEdit.galleryImages || []);
                setDocuments(productToEdit.documents || []);
                
                // Load existing BOM if available
                const existingBOM = boms.find(b => b.rootProductId === productToEdit.id);
                if (existingBOM) {
                    setBomItems(existingBOM.items);
                    const calculatedCost = existingBOM.items.reduce((sum, item) => {
                        const p = products.find(prod => prod.id === item.productId);
                        return sum + ((p?.cost || 0) * item.quantity);
                    }, 0);
                    const calculatedPrice = Math.round(calculatedCost * 1.13);
                    const isPriceAligned = Math.abs(productToEdit.basePrice - calculatedPrice) < 2;
                    setIsAutoPrice(isPriceAligned && existingBOM.items.length > 0);
                } else {
                    setBomItems([]);
                    setIsAutoPrice(false);
                }
            } else {
                // New Product Defaults
                setFormData({
                    type: types[0]?.name || '',
                    category: '',
                    materialCode: '',
                    unit: '个',
                    name: '',
                    basePrice: 0,
                    cost: 0,
                    inventory: 0,
                    description: '',
                    specifications: '',
                    imageUrl: ''
                });
                setGalleryImages([]);
                setDocuments([]);
                setBomItems([]);
                setIsAutoPrice(false);
            }
        }
    }, [isOpen, productToEdit, boms, products, types]);

    // Reset Zoom/Pan when image changes or closes
    const resetPreview = () => {
        setPreviewImage(null);
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const openPreview = (src: string) => {
        setPreviewImage(src);
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    // Calculation Helpers
    const calculateBOMTotal = (items: BOMItem[], field: 'cost' | 'basePrice') => {
        return items.reduce((sum, item) => {
            const p = products.find(prod => prod.id === item.productId);
            return sum + ((p?.[field] || 0) * item.quantity);
        }, 0);
    };

    // Auto-update price effect
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
             setFormData(prev => ({ ...prev, cost: totalBOMCost }));
        }
    }, [bomItems, isAutoPrice, products, isOpen]);

    // --- Handlers ---

    // Main Image
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    // Gallery Upload (Bulk)
    const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setGalleryImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeGalleryImage = (index: number) => {
        setGalleryImages(prev => prev.filter((_, i) => i !== index));
    };

    // Document Upload (Bulk)
    const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const newDoc: ProductDocument = {
                        id: `doc-${Date.now()}-${Math.random()}`,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        uploadDate: new Date().toISOString(),
                        url: reader.result as string
                    };
                    setDocuments(prev => [...prev, newDoc]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeDocument = (id: string) => {
        setDocuments(prev => prev.filter(d => d.id !== id));
    };

    const previewDocument = (doc: ProductDocument) => {
        // Open Base64 data in new tab
        const win = window.open();
        if(win) {
            win.document.write(`<iframe src="${doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        }
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
            id: `bi-${Date.now()}`,
            productId: newBomItemId,
            quantity: newBomItemQty,
            children: []
        };
        setBomItems([...bomItems, newItem]);
        setNewBomItemId('');
        setNewBomItemQty(1);
    };

    const handleUpdateBomItemQty = (id: string, newQty: number) => {
        setBomItems(prevItems => prevItems.map(item => 
            item.id === id ? { ...item, quantity: Math.max(1, newQty) } : item
        ));
    };

    const handleRemoveBomItem = (id: string) => {
        setBomItems(bomItems.filter(item => item.id !== id));
    };

    const handleSubmit = () => {
        const finalData = {
            ...formData,
            galleryImages,
            documents
        };
        onSave(finalData, bomItems);
    };

    // Helper for file size
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // --- Image Preview Logic (Zoom/Pan) ---
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
                {/* Modal Header */}
                <div className="p-0 rounded-t-xl bg-slate-50 border-b border-slate-200">
                    <div className="p-6 flex justify-between items-center pb-4">
                        <h3 className="text-xl font-bold text-slate-800">{productToEdit ? '编辑项目' : '新建项目'}</h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Tabs */}
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

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                {activeTab === 'basic' && (
                    <div className="space-y-4">
                    {/* Image Upload */}
                    <div className="flex gap-6 items-start">
                        <div 
                        className="w-32 h-32 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 relative group overflow-hidden"
                        onClick={() => !formData.imageUrl && fileInputRef.current?.click()}
                        style={{ cursor: formData.imageUrl ? 'default' : 'pointer' }}
                        >
                        {formData.imageUrl ? (
                            <>
                            <img 
                                src={formData.imageUrl} 
                                alt="Preview" 
                                className="w-full h-full object-cover cursor-zoom-in" 
                                onClick={() => openPreview(formData.imageUrl!)}
                            />
                            {/* Overlay Edit Button */}
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
                        {formData.imageUrl && (
                        <button onClick={() => setFormData({...formData, imageUrl: ''})} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 mt-2">
                            <X className="w-3 h-3" /> 移除图片
                        </button>
                        )}
                        <div className="flex-1">
                        <p className="text-sm text-slate-500 mb-2">支持 JPG, PNG 格式。建议尺寸 200x200 像素。</p>
                        <p className="text-xs text-slate-400">如有主图，点击图片可放大查看，悬停点击图标可更换。</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">物料编码</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            placeholder="例如: MAT-001"
                            value={formData.materialCode || ''}
                            onChange={e => setFormData({...formData, materialCode: e.target.value})}
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">单位 (SKU)</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            placeholder="个, 箱, 套..."
                            value={formData.unit || ''}
                            onChange={e => setFormData({...formData, unit: e.target.value})}
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
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">产品类型</label>
                        <select 
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            value={formData.type || ''}
                            onChange={e => setFormData({...formData, type: e.target.value})}
                        >
                            {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">产品分类 (子类)</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            value={formData.category || ''}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                        />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">库存数量</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            value={formData.inventory || 0}
                            onChange={e => setFormData({...formData, inventory: Number(e.target.value)})}
                        />
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-emerald-600"/> 定价策略
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
                                    value={formData.cost || 0}
                                    readOnly={isAutoPrice || bomItems.length > 0} 
                                    onChange={e => setFormData({...formData, cost: Number(e.target.value)})}
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
                                    value={formData.basePrice || 0}
                                    readOnly={isAutoPrice}
                                    onChange={e => setFormData({...formData, basePrice: Number(e.target.value)})}
                                />
                                {isAutoPrice && <Calculator className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />}
                            </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">规格参数</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            value={formData.specifications || ''}
                            onChange={e => setFormData({...formData, specifications: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                        详细描述
                        <button 
                            onClick={handleAIGenerate}
                            disabled={isGenerating}
                            className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full hover:bg-violet-200 inline-flex items-center gap-1"
                        >
                            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                            AI 智能生成
                        </button>
                        </label>
                        <textarea 
                        className="w-full p-2 border border-slate-300 rounded-lg h-24"
                        value={formData.description || ''}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        ></textarea>
                    </div>
                    </div>
                )}

                {/* TAB: Gallery */}
                {activeTab === 'gallery' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-slate-500">上传多张产品图片（如细节图、应用场景等），支持批量上传。点击图片可预览放大。</p>
                            <button 
                                onClick={() => galleryInputRef.current?.click()}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700"
                            >
                                <UploadCloud className="w-4 h-4" /> 批量上传
                            </button>
                            <input 
                                type="file" 
                                ref={galleryInputRef} 
                                className="hidden" 
                                multiple 
                                accept="image/*" 
                                onChange={handleGalleryUpload} 
                            />
                        </div>
                        
                        {galleryImages.length === 0 ? (
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                                <Images className="w-12 h-12 mb-2 opacity-50" />
                                <p className="text-sm">暂无图片，点击上方按钮上传</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-4">
                                {galleryImages.map((src, index) => (
                                    <div 
                                      key={index} 
                                      className="relative group aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in"
                                      onClick={() => openPreview(src)}
                                    >
                                        <img src={src} alt={`Gallery ${index}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                            <div className="bg-black/50 text-white p-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                                                <ZoomIn className="w-4 h-4" />
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removeGalleryImage(index); }}
                                                className="p-1.5 bg-white rounded-full text-red-600 hover:text-red-700 shadow-lg transform hover:scale-110 transition-transform pointer-events-auto"
                                                title="删除图片"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {/* Quick add tile */}
                                <div 
                                    onClick={() => galleryInputRef.current?.click()}
                                    className="aspect-square bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors"
                                >
                                    <Plus className="w-8 h-8" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Documents */}
                {activeTab === 'docs' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-slate-500">上传产品手册、规格说明书、质检报告等。</p>
                            <button 
                                onClick={() => docInputRef.current?.click()}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700"
                            >
                                <UploadCloud className="w-4 h-4" /> 上传文档
                            </button>
                            <input 
                                type="file" 
                                ref={docInputRef} 
                                className="hidden" 
                                multiple 
                                accept=".pdf,.doc,.docx,.xls,.xlsx" 
                                onChange={handleDocUpload} 
                            />
                        </div>

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
                                            <td className="px-4 py-3 flex items-center gap-2">
                                                <File className="w-4 h-4 text-blue-500" />
                                                <span className="truncate max-w-[200px]" title={doc.name}>{doc.name}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{formatBytes(doc.size)}</td>
                                            <td className="px-4 py-3 text-slate-500">{new Date(doc.uploadDate).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => previewDocument(doc)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                        title="在线预览"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => removeDocument(doc.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        title="删除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {documents.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                                <FileCode className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                暂无相关文档
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: BOM Editor */}
                {activeTab === 'bom' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                            <p className="text-sm text-blue-800 flex gap-2">
                                <Info className="w-5 h-5 shrink-0" />
                                在此定义该产品的组成结构。{canViewCost && '如果启用了“自动计算价格”，此处子项的总成本将决定基础价格(113%)。'}
                            </p>
                        </div>

                        {/* Add Item Row */}
                        <div className="flex items-end gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">选择组件</label>
                                <select 
                                    className="w-full p-2 border border-slate-300 rounded text-sm"
                                    value={newBomItemId}
                                    onChange={e => setNewBomItemId(e.target.value)}
                                >
                                    <option value="">-- 添加子项 --</option>
                                    {products
                                        .filter(p => p.id !== productToEdit?.id)
                                        .map(p => (
                                        <option key={p.id} value={p.id}>
                                                {p.name} {canViewCost ? `(成本: ¥${p.cost})` : ''}
                                            </option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">数量</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    className="w-full p-2 border border-slate-300 rounded text-sm"
                                    value={newBomItemQty}
                                    onChange={e => setNewBomItemQty(Number(e.target.value))}
                                />
                            </div>
                            <button 
                                onClick={handleAddBomItem}
                                disabled={!newBomItemId}
                                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Items List */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-2 text-slate-500 font-medium">组件名称</th>
                                        <th className="px-4 py-2 text-slate-500 font-medium text-center">数量</th>
                                        {canViewCost && (
                                            <>
                                            <th className="px-4 py-2 text-slate-500 font-medium">成本</th>
                                            <th className="px-4 py-2 text-slate-500 font-medium text-right">小计</th>
                                            </>
                                        )}
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {bomItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={canViewCost ? 5 : 3} className="px-4 py-8 text-center text-slate-400">暂无 BOM 子项</td>
                                        </tr>
                                    ) : (
                                        bomItems.map(item => {
                                            const product = products.find(p => p.id === item.productId);
                                            if (!product) return null;
                                            const subtotal = product.cost * item.quantity;
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-slate-700">{product.name}</div>
                                                        <div className="text-xs text-slate-400">{product.materialCode}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input 
                                                            type="number" 
                                                            min="1"
                                                            className="w-20 p-1 border border-slate-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateBomItemQty(item.id, Number(e.target.value))}
                                                        />
                                                    </td>
                                                    {canViewCost && (
                                                        <>
                                                        <td className="px-4 py-3 text-slate-500">¥{product.cost}</td>
                                                        <td className="px-4 py-3 text-slate-800 font-medium text-right">¥{subtotal}</td>
                                                        </>
                                                    )}
                                                    <td className="px-4 py-3 text-right">
                                                        <button onClick={() => handleRemoveBomItem(item.id)} className="text-slate-400 hover:text-red-500">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {bomItems.length > 0 && canViewCost && (
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-600">总成本:</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600">
                                                ¥{calculateBOMTotal(bomItems, 'cost')}
                                            </td>
                                            <td></td>
                                        </tr>
                                        <tr className="bg-slate-50 text-xs">
                                            <td colSpan={3} className="px-4 py-2 text-right text-slate-500">建议售价 (113%):</td>
                                            <td className="px-4 py-2 text-right font-medium text-blue-600">
                                                ¥{Math.round(calculateBOMTotal(bomItems, 'cost') * 1.13)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-white rounded-b-xl">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20">保存更改</button>
                </div>
            </div>
            </div>

            {/* Lightbox Preview Layer (Zoom/Pan) */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-0 overflow-hidden"
                    onClick={resetPreview}
                    onWheel={handleWheel}
                >
                    {/* Toolbar */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 z-[80]" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="text-white hover:text-blue-400 p-2 rounded-full hover:bg-white/10"><ZoomOut className="w-5 h-5"/></button>
                        <span className="text-white text-xs font-mono min-w-[3ch] text-center">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(4, s + 0.25))} className="text-white hover:text-blue-400 p-2 rounded-full hover:bg-white/10"><ZoomIn className="w-5 h-5"/></button>
                        <div className="w-px h-4 bg-white/20 mx-2"></div>
                        <button onClick={() => { setScale(1); setPosition({x:0, y:0}); }} className="text-white hover:text-blue-400 p-2 rounded-full hover:bg-white/10" title="重置"><RotateCcw className="w-5 h-5"/></button>
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