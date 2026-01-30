
import React, { useState, useRef } from 'react';
import { useStore } from '../store';
import { TemplateSettings } from '../types';
import { Save, CheckCircle, FileText, Factory, FileSpreadsheet, RotateCcw, Upload, Download, Trash2, HelpCircle, Image as ImageIcon, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const TemplateManager = () => {
    const { templateSettings, updateTemplateSettings, hasPermission } = useStore();
    const [config, setConfig] = useState<TemplateSettings>(templateSettings);
    const [activeTab, setActiveTab] = useState<'quote' | 'production'>('quote');
    const [isSaved, setIsSaved] = useState(false);
    
    const quoteFileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const productionFileInputRef = useRef<HTMLInputElement>(null);

    const canEdit = hasPermission('templates', 'edit');

    const handleSave = () => {
        updateTemplateSettings(config);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'quote' | 'production') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = (event.target?.result as string).split(',')[1];
            if (type === 'quote') {
                setConfig(prev => ({
                    ...prev,
                    quote: { ...prev.quote, templateFileBase64: base64, templateFileName: file.name }
                }));
            } else {
                setConfig(prev => ({
                    ...prev,
                    production: { ...prev.production, templateFileBase64: base64, templateFileName: file.name }
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setConfig(prev => ({
                ...prev,
                quote: { ...prev.quote, companyLogo: base64 }
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleClearTemplate = (type: 'quote' | 'production') => {
        if (!confirm('确定要移除自定义模板并恢复使用默认生成逻辑吗？')) return;
        if (type === 'quote') {
            setConfig(prev => ({
                ...prev,
                quote: { ...prev.quote, templateFileBase64: undefined, templateFileName: undefined }
            }));
        } else {
            setConfig(prev => ({
                ...prev,
                production: { ...prev.production, templateFileBase64: undefined, templateFileName: undefined }
            }));
        }
    };

    // Helper to generate a sample xlsx with placeholders for the user to download
    const downloadReferenceTemplate = (type: 'quote' | 'production') => {
        const wb = XLSX.utils.book_new();
        const wsData: any[][] = [];

        if (type === 'quote') {
            wsData.push(["报价单 / QUOTATION"]);
            wsData.push([]);
            wsData.push(["公司名称:", "{{CompanyName}}", "日期:", "{{Date}}"]);
            wsData.push(["地址:", "{{CompanyAddress}}", "单号:", "{{QuoteID}}"]);
            wsData.push(["客户:", "{{CustomerName}}"]);
            wsData.push([]);
            // Table Header row that will be recognized as start of table
            wsData.push(["{{TableStart}}", "产品图片", "产品名称", "编码", "单位", "数量", "单价", "金额"]);
            // Simulation of what the system outputs
            wsData.push(["（一） 示例分类 A"]); // Category Header
            wsData.push(["1", "(图片)", "示例产品 A", "P-001", "个", 10, 100, 1000]); // Item
            wsData.push(["", "", "", "", "", "", "本项小计:", 1000]); // Subtotal Row
            wsData.push([]);
            wsData.push(["", "", "", "", "", "", "总计:", "{{GrandTotal}}"]);
            wsData.push([]);
            wsData.push(["报价汇总表"]);
            wsData.push(["分类名称", "分类金额"]);
            wsData.push(["（一） 示例分类 A", 1000]);
            wsData.push([]);
            wsData.push(["条款:", "{{Terms}}"]);
        } else {
            wsData.push(["生产备料单"]);
            wsData.push(["单号:", "{{QuoteID}}"]);
            wsData.push(["日期:", "{{Date}}"]);
            wsData.push([]);
            wsData.push(["{{TableStart}}", "物料编码", "名称", "单位", "需求量", "库存", "缺口"]);
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Set some column widths
        ws['!cols'] = [{wch: 15}, {wch: 15}, {wch: 25}, {wch: 15}, {wch: 10}, {wch: 10}, {wch: 15}, {wch: 15}];
        
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `${type === 'quote' ? '报价单' : '生产单'}_模板参考.xlsx`);
    };

    return (
        <div className="max-w-5xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">模板管理</h2>
                    <p className="text-slate-500">上传设计好的 Excel 文件 (.xlsx) 作为导出模板。</p>
                </div>
                <div className="flex gap-3">
                    {canEdit && (
                        <button 
                            onClick={handleSave}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                        >
                            {isSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {isSaved ? '已保存设置' : '保存模板配置'}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex">
                {/* Left Sidebar Tabs */}
                <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 space-y-2">
                    <button 
                        onClick={() => setActiveTab('quote')}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'quote' ? 'bg-white border border-slate-200 shadow-sm text-blue-600 font-medium' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
                    >
                        <FileText className="w-4 h-4" />
                        报价单模板
                    </button>
                    <button 
                        onClick={() => setActiveTab('production')}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'production' ? 'bg-white border border-slate-200 shadow-sm text-blue-600 font-medium' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
                    >
                        <Factory className="w-4 h-4" />
                        生产单模板
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-8">
                    {activeTab === 'quote' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                                <FileSpreadsheet className="w-6 h-6 text-blue-500" />
                                <h3 className="text-lg font-bold text-slate-800">报价单 Excel 模板设置</h3>
                            </div>

                            {/* Template Upload Section */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                            自定义模板文件
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${config.quote.templateFileBase64 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {config.quote.templateFileBase64 ? '已启用自定义' : '使用系统默认'}
                                            </span>
                                        </h4>
                                        <p className="text-sm text-slate-500 mt-1">上传带有特定占位符的 .xlsx 文件，系统将自动填充数据。</p>
                                    </div>
                                    <button 
                                        onClick={() => downloadReferenceTemplate('quote')}
                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Download className="w-4 h-4" /> 下载参考模板
                                    </button>
                                </div>

                                {config.quote.templateFileBase64 ? (
                                    <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                                            <div>
                                                <div className="font-medium text-slate-800">{config.quote.templateFileName || 'Custom_Template.xlsx'}</div>
                                                <div className="text-xs text-emerald-600">模板已加载</div>
                                            </div>
                                        </div>
                                        {canEdit && (
                                            <button 
                                                onClick={() => handleClearTemplate('quote')}
                                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="移除模板"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div 
                                        className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer bg-white"
                                        onClick={() => canEdit && quoteFileInputRef.current?.click()}
                                    >
                                        <Upload className="w-8 h-8 mb-2 text-slate-300" />
                                        <span className="text-sm font-medium">点击上传 .xlsx 文件</span>
                                        <span className="text-xs mt-1">支持 Excel 2007+ 格式</span>
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    ref={quoteFileInputRef} 
                                    accept=".xlsx" 
                                    className="hidden" 
                                    onChange={(e) => handleFileUpload(e, 'quote')}
                                />
                            </div>

                            {/* Placeholders Info */}
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                <h5 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-2">
                                    <HelpCircle className="w-4 h-4" />
                                    支持的占位符 (在 Excel 单元格中使用)
                                </h5>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-blue-700">
                                    <div className="flex justify-between"><span>客户名称:</span> <code className="font-mono bg-white/50 px-1 rounded">{'{{CustomerName}}'}</code></div>
                                    <div className="flex justify-between"><span>报价单号:</span> <code className="font-mono bg-white/50 px-1 rounded">{'{{QuoteID}}'}</code></div>
                                    <div className="flex justify-between"><span>日期:</span> <code className="font-mono bg-white/50 px-1 rounded">{'{{Date}}'}</code></div>
                                    <div className="flex justify-between"><span>总金额:</span> <code className="font-mono bg-white/50 px-1 rounded">{'{{GrandTotal}}'}</code></div>
                                    <div className="flex justify-between"><span>卖方公司:</span> <code className="font-mono bg-white/50 px-1 rounded">{'{{CompanyName}}'}</code></div>
                                    <div className="flex justify-between"><span>卖方地址:</span> <code className="font-mono bg-white/50 px-1 rounded">{'{{CompanyAddress}}'}</code></div>
                                    <div className="flex justify-between"><span>条款文本:</span> <code className="font-mono bg-white/50 px-1 rounded">{'{{Terms}}'}</code></div>
                                    <div className="col-span-2 mt-2 pt-2 border-t border-blue-200">
                                        <div className="flex justify-between font-semibold">
                                            <span>产品列表起始行标记 (必须):</span> 
                                            <code className="font-mono bg-white px-2 rounded border border-blue-200 text-red-600">{'{{TableStart}}'}</code>
                                        </div>
                                        <p className="text-xs mt-1 text-blue-600 opacity-80">
                                            * 系统将在此标记处自动插入：<br/>
                                            1. 分类标题行 (如 "（一）系统设备")<br/>
                                            2. 产品明细行<br/>
                                            3. <strong>本项小计</strong> 行 (自动计算)
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Basic Info Fields (Used to fill placeholders) */}
                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                                <div className="col-span-2">
                                    <h4 className="font-bold text-slate-700 mb-4">基础信息与 PDF 设置</h4>
                                </div>
                                
                                {/* Company Logo Upload */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">公司图标 / Logo</label>
                                    <div 
                                        className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors h-32 relative group"
                                        onClick={() => canEdit && logoInputRef.current?.click()}
                                    >
                                        {config.quote.companyLogo ? (
                                            <>
                                                <img src={config.quote.companyLogo} alt="Logo" className="h-full w-full object-contain" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                                                    <span className="text-white text-xs font-medium">点击更换</span>
                                                </div>
                                                {canEdit && <button 
                                                    onClick={(e) => { e.stopPropagation(); setConfig(prev => ({...prev, quote: {...prev.quote, companyLogo: ''}})) }}
                                                    className="absolute top-1 right-1 p-1 bg-white rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>}
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                                                <span className="text-xs text-slate-500">点击上传 Logo (PNG/JPG)</span>
                                            </>
                                        )}
                                        <input 
                                            type="file" 
                                            ref={logoInputRef} 
                                            accept="image/*"
                                            className="hidden" 
                                            onChange={handleLogoUpload}
                                        />
                                    </div>
                                </div>

                                <div className="col-span-2 md:col-span-1 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">文档标题 (Document Title)</label>
                                        <input 
                                            type="text" 
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={config.quote.title}
                                            placeholder="例如: 报价单, Sales Quote..."
                                            onChange={e => setConfig({...config, quote: {...config.quote, title: e.target.value}})}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">公司名称 (自定义名称)</label>
                                        <input 
                                            type="text" 
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={config.quote.companyName}
                                            onChange={e => setConfig({...config, quote: {...config.quote, companyName: e.target.value}})}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                </div>

                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">联系方式</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={config.quote.companyContact}
                                        onChange={e => setConfig({...config, quote: {...config.quote, companyContact: e.target.value}})}
                                        disabled={!canEdit}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">公司地址</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={config.quote.companyAddress}
                                        onChange={e => setConfig({...config, quote: {...config.quote, companyAddress: e.target.value}})}
                                        disabled={!canEdit}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">条款与条件</label>
                                    <textarea 
                                        className="w-full p-3 border border-slate-300 rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        value={config.quote.terms}
                                        onChange={e => setConfig({...config, quote: {...config.quote, terms: e.target.value}})}
                                        disabled={!canEdit}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'production' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                                <Factory className="w-6 h-6 text-blue-500" />
                                <h3 className="text-lg font-bold text-slate-800">生产单 Excel 模板设置</h3>
                            </div>

                            {/* Template Upload Section */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                            自定义模板文件
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${config.production.templateFileBase64 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {config.production.templateFileBase64 ? '已启用自定义' : '使用系统默认'}
                                            </span>
                                        </h4>
                                    </div>
                                    <button 
                                        onClick={() => downloadReferenceTemplate('production')}
                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Download className="w-4 h-4" /> 下载参考模板
                                    </button>
                                </div>

                                {config.production.templateFileBase64 ? (
                                    <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                                            <div>
                                                <div className="font-medium text-slate-800">{config.production.templateFileName || 'Production_Template.xlsx'}</div>
                                                <div className="text-xs text-emerald-600">模板已加载</div>
                                            </div>
                                        </div>
                                        {canEdit && (
                                            <button 
                                                onClick={() => handleClearTemplate('production')}
                                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="移除模板"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div 
                                        className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer bg-white"
                                        onClick={() => canEdit && productionFileInputRef.current?.click()}
                                    >
                                        <Upload className="w-8 h-8 mb-2 text-slate-300" />
                                        <span className="text-sm font-medium">点击上传 .xlsx 文件</span>
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    ref={productionFileInputRef} 
                                    accept=".xlsx" 
                                    className="hidden" 
                                    onChange={(e) => handleFileUpload(e, 'production')}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemplateManager;
