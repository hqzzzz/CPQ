import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { Quote, BOMItem, Product } from '../types';
import { FileSpreadsheet, Box, Factory, AlertTriangle, ArrowRight, CheckCircle2, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ProductionMaterial {
    productId: string;
    materialCode: string;
    name: string;
    unit: string;
    requiredQty: number;
    currentInventory: number;
    category: string;
    level: number;
}

const ProductionOrder = () => {
    const { quotes, products, boms, templateSettings } = useStore();
    const [selectedQuoteId, setSelectedQuoteId] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    const selectedQuote = quotes.find(q => q.id === selectedQuoteId);

    // Reset category filter when quote changes
    useEffect(() => {
        setSelectedCategory('ALL');
    }, [selectedQuoteId]);

    // Recursively flatten BOM structure to get leaf nodes (materials)
    const flattenBOM = (
        productId: string, 
        qtyMultiplier: number, 
        accumulator: Map<string, number>,
        customBOM?: BOMItem[] // If quote item has custom BOM config
    ) => {
        // 1. Determine the structure to traverse
        // If customBOM is provided (from Quote Item modification), use that.
        // Otherwise, look for a BOM definition in the store.
        let itemsToTraverse: BOMItem[] | undefined = customBOM;

        if (!itemsToTraverse) {
            const definedBOM = boms.find(b => b.rootProductId === productId);
            if (definedBOM) {
                itemsToTraverse = definedBOM.items;
            }
        }

        // 2. Traversal Logic
        if (itemsToTraverse && itemsToTraverse.length > 0) {
            // It has children, so it's an assembly. Traverse deeper.
            itemsToTraverse.forEach(child => {
                flattenBOM(child.productId, child.quantity * qtyMultiplier, accumulator, child.children);
            });
        } else {
            // It has no children (Leaf Node), so it's a raw material/part needed for production.
            // OR it's a standalone product with no BOM.
            // Add to accumulator.
            const currentQty = accumulator.get(productId) || 0;
            accumulator.set(productId, currentQty + qtyMultiplier);
        }
    };

    const productionMaterials = useMemo(() => {
        if (!selectedQuote) return [];

        const accumulator = new Map<string, number>();

        selectedQuote.items.forEach(quoteItem => {
            // Check if this quote item is a standalone BOM (Auxiliary) or a Product
            const isAuxBOM = boms.find(b => b.id === quoteItem.productId);
            
            if (isAuxBOM) {
                // If the quote item ID matches a BOM ID, it means it's a standalone BOM added to quote
                // We must use the quoteItem.bomConfig if available (customized), else the original BOM items
                const itemsToUse = quoteItem.bomConfig || isAuxBOM.items;
                itemsToUse.forEach(child => {
                    flattenBOM(child.productId, child.quantity * quoteItem.quantity, accumulator, child.children);
                });
            } else {
                // It's a standard Product ID
                flattenBOM(quoteItem.productId, quoteItem.quantity, accumulator, quoteItem.bomConfig);
            }
        });

        // Convert Map to Array and enrich with Product Info
        const result: ProductionMaterial[] = [];
        accumulator.forEach((qty, pid) => {
            const product = products.find(p => p.id === pid);
            if (product) {
                // Find type definition to get level
                // We assume store.types is available, but for now we map via product properties
                result.push({
                    productId: pid,
                    materialCode: product.materialCode,
                    name: product.name,
                    unit: product.unit,
                    requiredQty: qty,
                    currentInventory: product.inventory,
                    category: product.category || '其他',
                    level: 0 // Placeholder, purely flattened list implies lowest level needed
                });
            }
        });

        return result.sort((a, b) => a.category.localeCompare(b.category) || a.materialCode.localeCompare(b.materialCode));
    }, [selectedQuote, products, boms]);

    const availableCategories = useMemo(() => {
        const cats = new Set(productionMaterials.map(m => m.category));
        return Array.from(cats).sort();
    }, [productionMaterials]);

    const filteredMaterials = useMemo(() => {
        if (selectedCategory === 'ALL') return productionMaterials;
        return productionMaterials.filter(m => m.category === selectedCategory);
    }, [productionMaterials, selectedCategory]);

    const handleExport = () => {
        if (!selectedQuote || filteredMaterials.length === 0) return;

        const { production: tpl } = templateSettings;

        // Standard replacements for custom templates
        const replacements: Record<string, string> = {
            '{{QuoteID}}': selectedQuote.id,
            '{{CustomerName}}': selectedQuote.customerName,
            '{{Date}}': new Date().toLocaleDateString()
        };

        let wb: XLSX.WorkBook;
        let ws: XLSX.WorkSheet;

        // Case 1: Custom Template
        if (tpl.templateFileBase64) {
            try {
                wb = XLSX.read(tpl.templateFileBase64, { type: 'base64' });
                ws = wb.Sheets[wb.SheetNames[0]];
                
                // --- Simple Replacement & Fill (Existing Logic for Custom Template) ---
                const range = XLSX.utils.decode_range(ws['!ref'] || "A1:H100");
                let tableStartRow = -1;
                let tableStartCol = 0;

                for (let R = range.s.r; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cellRef = XLSX.utils.encode_cell({r: R, c: C});
                        const cell = ws[cellRef];
                        if (cell && typeof cell.v === 'string') {
                            Object.keys(replacements).forEach(key => {
                                if (cell.v.includes(key)) {
                                    cell.v = cell.v.replace(key, replacements[key]);
                                }
                            });
                            if (cell.v.includes('{{TableStart}}')) {
                                tableStartRow = R;
                                tableStartCol = C;
                                cell.v = cell.v.replace('{{TableStart}}', '');
                                if(cell.v === '') cell.v = "序号";
                            }
                        }
                    }
                }

                if (tableStartRow === -1) tableStartRow = range.e.r + 2;
                else tableStartRow++;

                // Flattened List for Custom Template
                const tableData: any[][] = [];
                let idx = 1;
                filteredMaterials.forEach(m => {
                    const shortage = Math.max(0, m.requiredQty - m.currentInventory);
                    tableData.push([
                        idx++, m.materialCode, m.name, m.category, m.unit, m.requiredQty, m.currentInventory, shortage > 0 ? `缺 ${shortage}` : '充足'
                    ]);
                });
                XLSX.utils.sheet_add_aoa(ws, tableData, { origin: { r: tableStartRow, c: tableStartCol } });

            } catch (e) {
                console.error("Template load error", e);
                alert("加载自定义模板失败，使用默认格式。");
                wb = XLSX.utils.book_new();
                ws = XLSX.utils.aoa_to_sheet([["Production Order - Error"]]);
            }
        } 
        // Case 2: Default Template with Grouping Logic (Matching Quote Style)
        else {
            wb = XLSX.utils.book_new();
            
            // Build Array of Arrays
            const wsData: any[][] = [];
            
            // Header
            wsData.push([tpl.title]);
            wsData.push([]);
            wsData.push(["关联报价单:", selectedQuote.id, "", "日期:", new Date().toLocaleDateString()]);
            wsData.push(["客户:", selectedQuote.customerName, "", "范围:", selectedCategory === 'ALL' ? '全部分类' : selectedCategory]);
            wsData.push([]);

            // Group materials by category
            const groupedMaterials: Record<string, ProductionMaterial[]> = {};
            filteredMaterials.forEach(m => {
                if (!groupedMaterials[m.category]) groupedMaterials[m.category] = [];
                groupedMaterials[m.category].push(m);
            });

            // Table Header Row
            wsData.push(["序号", "物料编码", "物料名称", "分类", "单位", "需求数量", "当前库存", "缺口状态"]);
            
            let globalIndex = 1;
            
            // Loop groups
            Object.keys(groupedMaterials).sort().forEach(category => {
                // Section Header (Only show if ALL is selected, or just to keep format consistent)
                wsData.push([`-- ${category} --`, "", "", "", "", "", "", ""]);
                
                // Items
                groupedMaterials[category].forEach(m => {
                    const shortage = Math.max(0, m.requiredQty - m.currentInventory);
                    wsData.push([
                        globalIndex++,
                        m.materialCode,
                        m.name,
                        m.category,
                        m.unit,
                        m.requiredQty,
                        m.currentInventory,
                        shortage > 0 ? `缺 ${shortage}` : '充足'
                    ]);
                });
            });

            ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // Basic merged cells for title
            ws['!merges'] = [
                { s: {r:0, c:0}, e: {r:0, c:7} }, // Title
            ];
            
            // Set widths
            ws['!cols'] = [
                { wch: 8 },  // Idx
                { wch: 20 }, // Code
                { wch: 30 }, // Name
                { wch: 15 }, // Category
                { wch: 8 },  // Unit
                { wch: 10 }, // Req
                { wch: 10 }, // Inv
                { wch: 12 }, // Status
            ];
        }

        const fileNameSuffix = selectedCategory === 'ALL' ? '总表' : selectedCategory;
        XLSX.utils.book_append_sheet(wb, ws || XLSX.utils.aoa_to_sheet([]), "备料清单");
        XLSX.writeFile(wb, `生产单_${selectedQuote.id}_${fileNameSuffix}.xlsx`);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">生产单管理</h2>
                    <p className="text-slate-500">基于销售报价单生成生产所需的底层物料清单 (BOM 展开)。</p>
                </div>
            </div>

            {/* Selection Area */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <label className="block text-sm font-medium text-slate-700 mb-2">选择报价单</label>
                        <select 
                            className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50"
                            value={selectedQuoteId}
                            onChange={e => setSelectedQuoteId(e.target.value)}
                        >
                            <option value="">-- 请选择已批准的报价单 --</option>
                            {quotes
                                .filter(q => q.status === 'Sent' || q.status === 'Approved')
                                .map(q => (
                                    <option key={q.id} value={q.id}>
                                        [{q.status === 'Approved' ? '已批准' : '已发送'}] {q.id} - {q.customerName} (¥{q.grandTotal.toLocaleString()})
                                    </option>
                            ))}
                        </select>
                    </div>
                    {selectedQuote && (
                        <div className="flex-1 flex gap-4 px-6 py-2 bg-blue-50/50 rounded-lg border border-blue-100 items-center justify-between">
                            <div className="flex gap-6">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase">客户名称</div>
                                    <div className="font-semibold text-slate-700">{selectedQuote.customerName}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400 uppercase">报价日期</div>
                                    <div className="font-semibold text-slate-700">{new Date(selectedQuote.date).toLocaleDateString()}</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 justify-end flex-1">
                                <div className="flex flex-col items-end w-full max-w-xs">
                                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1">
                                        <Filter className="w-3 h-3"/> 导出范围 / 筛选
                                    </label>
                                    <select 
                                        className="text-sm border border-slate-300 rounded-md p-1.5 bg-white focus:ring-1 focus:ring-blue-500 outline-none w-full shadow-sm"
                                        value={selectedCategory}
                                        onChange={e => setSelectedCategory(e.target.value)}
                                    >
                                        <option value="ALL">全部 (总表)</option>
                                        {availableCategories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="h-8 w-px bg-slate-200 mx-2"></div>
                                <button 
                                    onClick={handleExport}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-emerald-700 shadow-sm shrink-0"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> 导出
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Material List Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                {selectedQuoteId ? (
                    <>
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Factory className="w-4 h-4 text-blue-600" /> 
                                物料需求总表 (BOM 自动展开至最低层)
                            </h3>
                            <div className="flex gap-2">
                                {selectedCategory !== 'ALL' && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full border border-blue-200">
                                        当前筛选: {selectedCategory}
                                    </span>
                                )}
                                <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-full text-slate-500">
                                    共 {filteredMaterials.length} 种物料
                                </span>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold text-slate-600">物料编码</th>
                                        <th className="px-6 py-3 font-semibold text-slate-600">物料名称 / 描述</th>
                                        <th className="px-6 py-3 font-semibold text-slate-600">分类</th>
                                        <th className="px-6 py-3 font-semibold text-slate-600 text-center">需求数量</th>
                                        <th className="px-6 py-3 font-semibold text-slate-600 text-center">当前库存</th>
                                        <th className="px-6 py-3 font-semibold text-slate-600 text-center">缺口分析</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredMaterials.map(item => {
                                        const shortage = Math.max(0, item.requiredQty - item.currentInventory);
                                        return (
                                            <tr key={item.productId} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-slate-500">{item.materialCode}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-800">{item.name}</div>
                                                    <div className="text-xs text-slate-400">Unit: {item.unit}</div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-blue-700 bg-blue-50/30">
                                                    {item.requiredQty}
                                                </td>
                                                <td className="px-6 py-4 text-center text-slate-600">
                                                    {item.currentInventory}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {shortage > 0 ? (
                                                        <div className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            <span className="font-bold">缺 {shortage}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 opacity-70">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            <span>充足</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredMaterials.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-400">
                                                当前分类下无物料数据
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Box className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">请先在上方选择一个报价单</p>
                        <p className="text-sm">系统将自动计算所需的所有零部件及原材料。</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductionOrder;