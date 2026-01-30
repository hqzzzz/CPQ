
import React, { useState } from 'react';
import { Product, BOMItem } from '../../types';
import { useStore } from '../../store';
import { X, Edit2, Layers, FileText, Package, Image as ImageIcon, Download, Eye, Tag, Box, Info, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';

interface ProductShowcaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onEdit: () => void;
}

const ProductShowcaseModal: React.FC<ProductShowcaseModalProps> = ({ isOpen, onClose, product, onEdit }) => {
    const { productBoms, hasPermission, types } = useStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'docs'>('overview');
    const [isCopied, setIsCopied] = useState(false);

    if (!isOpen || !product) return null;

    const relatedBOM = productBoms.find(b => b.productId === product.id);
    const canEdit = hasPermission('products', 'edit');
    const typeDef = types.find(t => t.id === product.type);
    const typeName = typeDef?.name || `ID:${product.type}`;
    const typeColor = typeDef?.color || '#3b82f6';

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

    const handleCopyCode = async () => {
        if (!product.materialCode) return;
        const text = product.materialCode;

        // Try modern Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
                return;
            } catch (err) {
                console.warn('Clipboard API failed, trying fallback...', err);
            }
        }

        // Fallback: textArea hack
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            
            // Ensure it's not visible but part of DOM
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } else {
                console.error('Fallback copy failed.');
                alert('复制失败，请手动复制: ' + text);
            }
        } catch (err) {
            console.error('Fallback copy error', err);
            alert('复制失败，请手动复制: ' + text);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 z-[60] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative">
                
                {/* Floating Close / Actions */}
                <div className="absolute top-4 right-4 z-30 flex gap-2">
                    <button 
                        onClick={handleCopyCode}
                        className={`p-2.5 rounded-full backdrop-blur-md transition-all border border-white/10 flex items-center justify-center ${
                            isCopied ? 'bg-emerald-600 text-white' : 'bg-black/20 hover:bg-black/40 text-white'
                        }`} 
                        title={`复制物料编码: ${product.materialCode}`}
                    >
                        {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2.5 bg-black/20 hover:bg-red-500/80 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Hero Section */}
                <div className="relative h-64 shrink-0 bg-slate-800 overflow-hidden group">
                     {mainImage ? (
                         <>
                            <img 
                                src={resolveUrl(mainImage)} 
                                className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105" 
                                alt={product.name} 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                         </>
                     ) : (
                         <div className="absolute inset-0 flex items-center justify-center text-slate-600 bg-slate-100">
                             <div className="text-center opacity-30">
                                 <ImageIcon className="w-20 h-20 mx-auto mb-2" />
                                 <span className="text-lg font-bold">暂无图片</span>
                             </div>
                         </div>
                     )}
                     
                     <div className="absolute bottom-0 left-0 w-full p-8 z-20">
                         <div className="flex items-end justify-between">
                             <div className="max-w-2xl">
                                 <div className="flex gap-2 mb-3">
                                     <span 
                                        className="px-2.5 py-1 rounded text-xs font-bold shadow-sm backdrop-blur-md uppercase tracking-wider flex items-center gap-1"
                                        style={{ backgroundColor: typeColor, color: '#fff' }}
                                     >
                                         <Tag className="w-3 h-3" /> {typeName}
                                     </span>
                                     {product.category && (
                                         <span className="px-2.5 py-1 rounded bg-white/20 text-white border border-white/30 text-xs font-medium backdrop-blur-md">
                                             {product.category}
                                         </span>
                                     )}
                                 </div>
                                 <h2 className="text-4xl font-bold text-white mb-2 leading-tight shadow-sm">{product.name}</h2>
                                 <div className="flex items-center gap-3 text-slate-300 font-mono text-sm">
                                     <span className="bg-white/10 px-2 py-0.5 rounded border border-white/10">{product.materialCode}</span>
                                     <span>|</span>
                                     <span>单位: {product.unit}</span>
                                 </div>
                             </div>
                         </div>
                     </div>
                </div>

                {/* Main Content Area */}
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* Left: Content Scrollable */}
                    <div className="flex-1 overflow-y-auto bg-white relative scroll-smooth">
                        {/* Tabs Navigation */}
                        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-slate-100 px-8 flex gap-8">
                            {[
                                { id: 'overview', label: '产品概览', icon: Package },
                                { id: 'specs', label: '规格参数', icon: FileText },
                                { id: 'docs', label: '相关文档', icon: Download },
                            ].map(tab => (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`py-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                                        activeTab === tab.id 
                                        ? 'border-blue-600 text-blue-600' 
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <tab.icon className="w-4 h-4" /> {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-8 pb-20">
                            {activeTab === 'overview' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                     {/* Description */}
                                     <section>
                                         <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                             <Info className="w-4 h-4" /> 产品描述
                                         </h3>
                                         <p className="text-slate-700 leading-8 text-base text-justify">
                                             {product.description || '暂无详细描述。请联系管理员完善产品信息。'}
                                         </p>
                                     </section>

                                     {/* Gallery */}
                                     {product.galleryImages && product.galleryImages.length > 0 && (
                                         <section>
                                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <ImageIcon className="w-4 h-4" /> 产品图库
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {product.galleryImages.map(img => (
                                                    <div key={img.id} className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shadow-sm cursor-zoom-in" onClick={() => window.open(resolveUrl(img.url), '_blank')}>
                                                        <img 
                                                            src={resolveUrl(img.url)} 
                                                            alt={img.name} 
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                                    </div>
                                                ))}
                                            </div>
                                         </section>
                                     )}

                                     {/* BOM Section */}
                                     {relatedBOM && (
                                         <section>
                                             <div className="flex items-center justify-between mb-4">
                                                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                     <Layers className="w-4 h-4" /> BOM 结构组成 ({relatedBOM.items.length})
                                                 </h3>
                                                 {canEdit && (
                                                     <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">管理结构</button>
                                                 )}
                                             </div>
                                             <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
                                                 {relatedBOM.items.slice(0, 8).map((item) => (
                                                     <BOMItemRow key={item.id} item={item} />
                                                 ))}
                                                 {relatedBOM.items.length > 8 && (
                                                     <div className="p-3 text-center text-xs text-slate-500 bg-slate-100">
                                                         ... 还有 {relatedBOM.items.length - 8} 个组件
                                                     </div>
                                                 )}
                                             </div>
                                         </section>
                                     )}
                                </div>
                            )}

                            {activeTab === 'specs' && (
                                 <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">详细规格参数</h3>
                                     <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                         <table className="w-full text-left text-sm">
                                             <tbody className="divide-y divide-slate-100">
                                                 <SpecRow label="物料编码" value={product.materialCode} />
                                                 <SpecRow label="产品名称" value={product.name} />
                                                 <SpecRow label="规格型号" value={product.specifications || '-'} />
                                                 <SpecRow label="业务分类" value={product.category || '-'} />
                                                 <SpecRow label="计量单位" value={product.unit} />
                                                 <SpecRow label="基础类型" value={typeName} />
                                                 <SpecRow label="库存状态" value={`${product.inventory} ${product.unit}`} highlight={product.inventory > 0} />
                                             </tbody>
                                         </table>
                                     </div>
                                 </div>
                            )}

                            {activeTab === 'docs' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 grid grid-cols-1 gap-4">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">下载中心</h3>
                                    {product.documents && product.documents.length > 0 ? (
                                        product.documents.map(doc => (
                                            <div key={doc.id} className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <FileText className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-base">{doc.name}</div>
                                                        <div className="text-xs text-slate-500 flex gap-3 mt-1">
                                                            <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                                            <span className="w-px h-3 bg-slate-300"></span>
                                                            <span className="font-mono">{(doc.size / 1024).toFixed(1)} KB</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => window.open(resolveUrl(doc.url), '_blank')}
                                                    className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
                                                >
                                                    <Eye className="w-4 h-4" /> 预览
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                                            <p className="text-slate-400">暂无相关文档资料</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Sidebar Info */}
                    <div className="w-80 bg-slate-50 border-l border-slate-200 p-6 flex flex-col gap-6 shrink-0 h-full overflow-y-auto">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-sm text-slate-500 font-medium mb-1">销售指导价</div>
                            <div className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
                                <span className="text-lg font-normal text-slate-500">¥</span>
                                {(product.basePrice || 0).toLocaleString()}
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${product.inventory > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                                <span className={`text-sm font-medium ${product.inventory > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {product.inventory > 0 ? '库存充足' : '暂时缺货'}
                                </span>
                                <span className="text-xs text-slate-400 ml-auto">
                                    库存: {product.inventory}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">关键属性</h4>
                            <div className="space-y-3">
                                <AttributeItem label="物料编码" value={product.materialCode} icon={Box} />
                                <AttributeItem label="所属类型" value={typeName} icon={Layers} />
                                <AttributeItem label="计量单位" value={product.unit} icon={Tag} />
                            </div>
                        </div>

                        <div className="mt-auto pt-6">
                            {canEdit && (
                                <button 
                                onClick={onEdit}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                                >
                                    <Edit2 className="w-4 h-4" /> 编辑产品信息
                                </button>
                            )}
                            <p className="text-center text-xs text-slate-400 mt-4">
                                最后更新: {new Date().toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-components for cleaner code
const SpecRow = ({ label, value, highlight = false }: { label: string, value: string | number, highlight?: boolean }) => (
    <tr className="hover:bg-slate-50 transition-colors">
        <td className="p-4 w-1/3 text-slate-500 font-medium">{label}</td>
        <td className={`p-4 font-medium ${highlight ? 'text-emerald-600' : 'text-slate-800'}`}>{value}</td>
    </tr>
);

const AttributeItem = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-400">
            <Icon className="w-4 h-4" />
        </div>
        <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">{label}</div>
            <div className="text-sm font-medium text-slate-700 truncate max-w-[140px]" title={value}>{value}</div>
        </div>
    </div>
);

const BOMItemRow = ({ item }: { item: BOMItem }) => {
    const { products } = useStore();
    const product = products.find(p => p.id === item.productId);
    
    if (!product) return (
        <div className="flex items-center justify-between p-4 bg-red-50 text-red-500 text-sm">
            <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4"/> 未知组件 (ID: {item.productId})</div>
        </div>
    );

    return (
        <div className="flex items-center justify-between p-4 hover:bg-white transition-colors group">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                    <Package className="w-5 h-5" />
                </div>
                <div>
                    <div className="text-sm font-bold text-slate-700">{product.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{product.materialCode}</div>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">数量</div>
                    <div className="text-sm font-mono font-medium text-slate-800">x{item.quantity}</div>
                </div>
                {item.quantity > 0 && <CheckCircle2 className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
        </div>
    );
};

export default ProductShowcaseModal;
