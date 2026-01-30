
import React, { useState } from 'react';
import { Product, BOMItem } from '../../types';
import { useStore } from '../../store';
import { X, Edit2, Layers, FileText, Package, Image as ImageIcon, Download, Eye } from 'lucide-react';

interface ProductShowcaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onEdit: () => void;
}

const ProductShowcaseModal: React.FC<ProductShowcaseModalProps> = ({ isOpen, onClose, product, onEdit }) => {
    const { productBoms, hasPermission, types } = useStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'docs'>('overview');

    if (!isOpen || !product) return null;

    const relatedBOM = productBoms.find(b => b.productId === product.id);
    const canEdit = hasPermission('products', 'edit');
    const typeName = types.find(t => t.id === product.type)?.name || `ID:${product.type}`;

    // Helper to resolve URL
    const resolveUrl = (src?: string) => {
        if (!src) return '';
        if (src.startsWith('/storage')) {
             const config = localStorage.getItem('cpq_api_config');
             const baseUrl = config ? JSON.parse(config).baseUrl : 'http://localhost:3002';
             const rootUrl = baseUrl.replace(/\/api\/?$/, '');
             return `${rootUrl}${src}`;
        }
        return src;
    };

    const mainImage = product.baseImage || (product.galleryImages && product.galleryImages.length > 0 ? product.galleryImages[0].url : null);

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header with Image Background if available, or simple header */}
                <div className="relative bg-slate-100 min-h-[160px] flex flex-col justify-end">
                     {mainImage ? (
                         <>
                            <div className="absolute inset-0">
                                <img src={resolveUrl(mainImage)} className="w-full h-full object-cover opacity-90" alt={product.name} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                            </div>
                         </>
                     ) : (
                         <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                             <ImageIcon className="w-24 h-24 opacity-20" />
                         </div>
                     )}
                     
                     <div className="relative p-6 z-10 flex justify-between items-end">
                         <div>
                             <div className="flex gap-2 mb-2">
                                 <span className="px-2 py-0.5 rounded bg-blue-600/90 text-white text-xs font-bold shadow-sm backdrop-blur-sm">
                                     {typeName}
                                 </span>
                                 {product.category && (
                                     <span className="px-2 py-0.5 rounded bg-white/20 text-white border border-white/30 text-xs backdrop-blur-sm">
                                         {product.category}
                                     </span>
                                 )}
                             </div>
                             <h2 className="text-3xl font-bold text-white drop-shadow-md">{product.name}</h2>
                             <p className="text-white/80 font-mono text-sm mt-1">{product.materialCode}</p>
                         </div>
                         <button 
                            onClick={onClose}
                            className="text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition-all backdrop-blur-sm"
                         >
                             <X className="w-6 h-6" />
                         </button>
                     </div>
                </div>

                {/* Content Tabs */}
                <div className="flex border-b border-slate-200 px-6 bg-white">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Package className="w-4 h-4" /> 产品概览
                    </button>
                    <button 
                        onClick={() => setActiveTab('specs')}
                        className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'specs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <FileText className="w-4 h-4" /> 规格参数
                    </button>
                    {(product.documents && product.documents.length > 0) && (
                        <button 
                            onClick={() => setActiveTab('docs')}
                            className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'docs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <Download className="w-4 h-4" /> 相关文档
                        </button>
                    )}
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                 <div className="md:col-span-2 space-y-6">
                                     <div>
                                         <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">产品描述</h3>
                                         <p className="text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                             {product.description || '暂无详细描述'}
                                         </p>
                                     </div>

                                     {relatedBOM && (
                                         <div>
                                             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                 <Layers className="w-4 h-4" /> 包含组件 ({relatedBOM.items.length})
                                             </h3>
                                             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                 {relatedBOM.items.slice(0, 5).map((item, idx) => {
                                                     return <BOMItemRow key={item.id} item={item} isLast={idx === relatedBOM.items.length - 1} />;
                                                 })}
                                                 {relatedBOM.items.length > 5 && (
                                                     <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
                                                         还有 {relatedBOM.items.length - 5} 个组件...
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     )}
                                     
                                     {product.galleryImages && product.galleryImages.length > 0 && (
                                         <div>
                                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">产品图库</h3>
                                            <div className="grid grid-cols-4 gap-2">
                                                {product.galleryImages.map(img => (
                                                    <div key={img.id} className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white">
                                                        <img 
                                                            src={resolveUrl(img.url)} 
                                                            alt={img.name} 
                                                            className="w-full h-full object-cover hover:scale-110 transition-transform duration-500 cursor-zoom-in" 
                                                            onClick={() => window.open(resolveUrl(img.url), '_blank')}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                         </div>
                                     )}
                                 </div>

                                 <div className="space-y-6">
                                     <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                         <div className="text-sm text-slate-500 mb-1">基准价格</div>
                                         <div className="text-3xl font-bold text-slate-800">¥{(product.basePrice || 0).toLocaleString()}</div>
                                         <div className="text-xs text-slate-400 mt-2">单位: {product.unit}</div>
                                     </div>

                                     <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                         <div className="text-sm text-slate-500 mb-2">库存状态</div>
                                         <div className="flex items-center gap-2">
                                             <div className={`w-3 h-3 rounded-full ${product.inventory > 10 ? 'bg-emerald-500' : product.inventory > 0 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                                             <span className={`font-bold ${product.inventory > 0 ? 'text-slate-700' : 'text-red-600'}`}>
                                                 {product.inventory > 0 ? `${product.inventory} ${product.unit}` : '缺货'}
                                             </span>
                                         </div>
                                     </div>

                                     {canEdit && (
                                         <button 
                                            onClick={onEdit}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 font-medium flex items-center justify-center gap-2 transition-transform active:scale-95"
                                         >
                                             <Edit2 className="w-4 h-4" /> 编辑产品信息
                                         </button>
                                     )}
                                 </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'specs' && (
                         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                             <table className="w-full text-left">
                                 <tbody className="divide-y divide-slate-100">
                                     <tr className="hover:bg-slate-50">
                                         <td className="p-4 w-1/3 text-slate-500 font-medium">物料编码</td>
                                         <td className="p-4 text-slate-800 font-mono">{product.materialCode}</td>
                                     </tr>
                                     <tr className="hover:bg-slate-50">
                                         <td className="p-4 w-1/3 text-slate-500 font-medium">规格型号</td>
                                         <td className="p-4 text-slate-800">{product.specifications || '-'}</td>
                                     </tr>
                                     <tr className="hover:bg-slate-50">
                                         <td className="p-4 w-1/3 text-slate-500 font-medium">产品分类</td>
                                         <td className="p-4 text-slate-800">{product.category || '-'}</td>
                                     </tr>
                                     <tr className="hover:bg-slate-50">
                                         <td className="p-4 w-1/3 text-slate-500 font-medium">计量单位</td>
                                         <td className="p-4 text-slate-800">{product.unit}</td>
                                     </tr>
                                 </tbody>
                             </table>
                         </div>
                    )}

                    {activeTab === 'docs' && (
                        <div className="grid grid-cols-1 gap-3">
                            {product.documents?.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-800">{doc.name}</div>
                                            <div className="text-xs text-slate-500 flex gap-2">
                                                <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span>{(doc.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => window.open(resolveUrl(doc.url), '_blank')}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                                        title="在线预览 / 下载"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper component for BOM items row in the overview
const BOMItemRow = ({ item, isLast }: { item: BOMItem, isLast: boolean }) => {
    const { products } = useStore();
    const product = products.find(p => p.id === item.productId);
    
    if (!product) return null;

    return (
        <div className={`flex items-center justify-between p-3 ${!isLast ? 'border-b border-slate-100' : ''} hover:bg-slate-50`}>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                    <Package className="w-4 h-4" />
                </div>
                <div>
                    <div className="text-sm font-medium text-slate-700">{product.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{product.materialCode}</div>
                </div>
            </div>
            <div className="text-sm font-bold text-slate-600">x{item.quantity}</div>
        </div>
    );
};

export default ProductShowcaseModal;
