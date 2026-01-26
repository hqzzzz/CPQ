import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { QuoteItem, Product, Quote, BOMItem } from '../types';
import { Plus, Trash2, Printer, Sparkles, FileSpreadsheet, Save, CheckCircle, FileText, History, X, ChevronRight, ChevronDown, Search, Users, CornerDownRight, RefreshCcw, Loader2 } from 'lucide-react';
import { analyzeQuote } from '../services/geminiService';
import { useLocation } from 'react-router-dom';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const QuoteGenerator = () => {
  const { products, addQuote, boms, quotes, currentUser, templateSettings } = useStore();
  const location = useLocation();

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '示例企业有限公司', email: 'contact@example.com' });
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Approved'>('Draft');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  
  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');

  // Expansion State for BOM Items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Ref for PDF generation
  const printRef = useRef<HTMLDivElement>(null);

  // Permission check for cost visibility (affects if they can see sub-item costs)
  const canViewCost = currentUser?.role !== 'sales'; 

  // Check for incoming quote data from Dashboard
  useEffect(() => {
    if (location.state?.quoteData) {
        const incomeQuote = location.state.quoteData as Quote;
        loadQuoteIntoEditor(incomeQuote);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const loadQuoteIntoEditor = (quote: Quote) => {
      // Deep copy items and assign new IDs to treat as a fresh template
      const newItems = quote.items.map(item => ({
          ...item,
          id: `qi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          // Ensure fields exist for older data
          margin: item.margin || 0,
          bomConfig: item.bomConfig ? JSON.parse(JSON.stringify(item.bomConfig)) : undefined
      }));
      setItems(newItems);
      setCustomerInfo({
          name: quote.customerName,
          email: '' 
      });
      // When loading a template, usually reset to Draft, but user can change it manually.
      setStatus('Draft');
      setAiAnalysis(null);
  };

  // Helper to calculate BOM cost recursively
  const calculateBOMCost = (bomItems: BOMItem[]): number => {
    let total = 0;
    bomItems.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        total += p.cost * item.quantity;
        if (item.children) {
          total += calculateBOMCost(item.children);
        }
      }
    });
    return total;
  };

  // Recursively update a sub-item quantity inside the BOM structure
  const updateBOMItemQuantity = (items: BOMItem[], subItemId: string, newQty: number): BOMItem[] => {
      return items.map(item => {
          if (item.id === subItemId) {
              return { ...item, quantity: newQty };
          }
          if (item.children) {
              return { ...item, children: updateBOMItemQuantity(item.children, subItemId, newQty) };
          }
          return item;
      });
  };

  const handleAddItem = () => {
    if (!selectedItem) return;
    
    const product = products.find(p => p.id === selectedItem);
    const bom = boms.find(b => b.id === selectedItem);

    if (product) {
      const newItem: QuoteItem = {
        id: `qi-${Date.now()}`,
        productId: product.id,
        quantity: 1,
        unitPrice: product.basePrice,
        margin: 0,
        total: product.basePrice
      };
      setItems([...items, newItem]);
    } else if (bom) {
      // Snapshot the BOM items so we can modify them individually for this quote
      const bomSnapshot = JSON.parse(JSON.stringify(bom.items));
      const cost = calculateBOMCost(bomSnapshot);
      const price = Math.round(cost * 1.13); // Default margin 13% for BOM base calculation
      
      const newItem: QuoteItem = {
        id: `qi-${Date.now()}`,
        productId: bom.id,
        quantity: 1,
        unitPrice: price,
        margin: 0,
        total: price,
        bomConfig: bomSnapshot
      };
      
      setItems([...items, newItem]);
      // Auto expand the new BOM item
      setExpandedItems(prev => new Set(prev).add(newItem.id));
    }

    setSelectedItem('');
    setAiAnalysis(null);
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // Calculation Logic:
        // 1. Apply Margin Uplift to Base Unit Price
        // 2. Multiply by Quantity (Discount Removed)
        
        const priceWithMargin = updated.unitPrice * (1 + updated.margin / 100);
        
        updated.total = priceWithMargin * updated.quantity;
        return updated;
      }
      return item;
    }));
  };

  // Handle changes to inner BOM components
  const handleBomSubChange = (quoteItemId: string, subItemId: string, newQty: number) => {
      if (newQty < 1) return;

      setItems(prevItems => prevItems.map(item => {
          if (item.id !== quoteItemId || !item.bomConfig) return item;

          // 1. Update the quantity in the config snapshot
          const newBomConfig = updateBOMItemQuantity(item.bomConfig, subItemId, newQty);

          // 2. Recalculate Unit Price based on new configuration cost
          // Maintain the logic: Unit Price = Total Cost * 1.13 (approx 13% margin)
          const newCost = calculateBOMCost(newBomConfig);
          const newUnitPrice = Math.round(newCost * 1.13);

          // 3. Recalculate Line Total with Item Margin
          const priceWithMargin = newUnitPrice * (1 + item.margin / 100);
          const newTotal = priceWithMargin * item.quantity;

          return {
              ...item,
              bomConfig: newBomConfig,
              unitPrice: newUnitPrice,
              total: newTotal
          };
      }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    if (expandedItems.has(id)) {
        const newSet = new Set(expandedItems);
        newSet.delete(id);
        setExpandedItems(newSet);
    }
  };

  const toggleExpand = (id: string) => {
      const newSet = new Set(expandedItems);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedItems(newSet);
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  // Tax rate updated to 9%
  const tax = subtotal * 0.09; 
  const total = subtotal + tax;

  const handleRunAIAnalysis = async () => {
    if (items.length === 0) return;
    setAiAnalysis("正在分析报价结构...");
    const productsInQuote = items.map(i => products.find(p => p.id === i.productId)).filter(Boolean) as Product[];
    const result = await analyzeQuote(productsInQuote);
    setAiAnalysis(result);
  };

  const handleSaveQuote = () => {
    if (items.length === 0) {
      alert("请先添加产品再保存。");
      return;
    }
    
    const newQuote: Quote = {
      id: `Q-${Date.now().toString().slice(-6)}`,
      customerName: customerInfo.name,
      date: new Date().toISOString(),
      status: status,
      items: [...items],
      subtotal: subtotal,
      tax: tax,
      grandTotal: total
    };

    addQuote(newQuote);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  // Helper to fetch images for ExcelJS
  const fetchImageAsBuffer = async (url: string): Promise<{ base64: string, extension: 'png' | 'jpeg' | 'gif' } | null> => {
    try {
        if (url.startsWith('data:image/')) {
            const matches = url.match(/^data:image\/([a-zA-Z]*);base64,([^\"]*)$/);
            if (matches) {
                return {
                    extension: matches[1] === 'jpeg' ? 'jpeg' : 'png', // Simplify
                    base64: matches[2]
                };
            }
        }
        // It's a URL - Needs to be CORS accessible
        const response = await fetch(url);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        let ext = 'png';
        if (blob.type === 'image/jpeg') ext = 'jpeg';
        return { base64, extension: ext as any };
    } catch (e) {
        console.warn("Failed to fetch image for excel", e);
        return null;
    }
  };

  // --- Grouped Data Preparation (Memoized for use in Excel and PDF) ---
  const groupedData = useMemo(() => {
    const groupedItems: Record<string, { items: any[], total: number }> = {};
    const categoryOrder: string[] = [];

    items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const bom = boms.find(b => b.id === item.productId);
        
        // Default category logic
        const category = product?.category || (bom ? '系统集成/BOM' : '其他');
        
        if (!groupedItems[category]) {
            groupedItems[category] = { items: [], total: 0 };
            categoryOrder.push(category);
        }
        
        groupedItems[category].items.push({
            ...item,
            name: product?.name || bom?.name,
            spec: product?.specifications || product?.description || '定制配置',
            unit: product?.unit || '套',
            code: product?.materialCode || '-',
            imageUrl: product?.imageUrl
        });
        groupedItems[category].total += item.total;
    });

    return { groupedItems, categoryOrder };
  }, [items, products, boms]);

  const chineseNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  // --- EXCEL EXPORT ---
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
        const { quote: tpl } = templateSettings;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Quote');
        
        // Define Columns
        sheet.columns = [
            { header: '序号', key: 'idx', width: 8 },
            { header: '图片', key: 'image', width: 15 }, 
            { header: '产品名称', key: 'name', width: 30 },
            { header: '规格/型号', key: 'spec', width: 25 },
            { header: '单位', key: 'unit', width: 8 },
            { header: '数量', key: 'qty', width: 10 },
            { header: '单价', key: 'price', width: 15 },
            { header: '金额', key: 'total', width: 15 },
            { header: '备注', key: 'remark', width: 20 },
        ];

        // Header Info
        sheet.mergeCells('A1:I1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = tpl.title;
        titleCell.font = { size: 20, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        sheet.addRow([]);
        sheet.addRow(['客户名称:', customerInfo.name, '', '', '报价日期:', new Date().toLocaleDateString()]);
        sheet.addRow(['联系人:', customerInfo.email, '', '', '单号:', `Q-${Date.now().toString().slice(-6)}`]);
        sheet.addRow(['卖方公司:', tpl.companyName]);
        sheet.addRow([]);

        // Table Header
        const headerRow = sheet.addRow(['序号', '图片', '产品名称', '规格/型号', '单位', '数量', '单价 (¥)', '金额 (¥)', '备注']);
        
        // Style specific cells to avoid infinite blue row
        for (let i = 1; i <= 9; i++) {
            const cell = headerRow.getCell(i);
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Blue header
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        }
        headerRow.height = 25;

        // Group Data
        const { groupedItems, categoryOrder } = groupedData;
        let globalIndex = 1;

        for (let i = 0; i < categoryOrder.length; i++) {
            const cat = categoryOrder[i];
            const group = groupedItems[cat];
            const sectionTitle = `（${chineseNumerals[i] || (i + 1)}） ${cat}`;

            // Section Header Row
            const sectionRow = sheet.addRow([sectionTitle]);
            sheet.mergeCells(`A${sectionRow.number}:I${sectionRow.number}`);
            const secCell = sectionRow.getCell(1);
            secCell.font = { bold: true, size: 12 };
            secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Light gray
            secCell.alignment = { horizontal: 'left', vertical: 'middle' };
            sectionRow.height = 25;
            
            // Items
            for (const item of group.items) {
                const row = sheet.addRow([
                    globalIndex++,
                    '', // Image placeholder
                    item.name,
                    item.spec,
                    item.unit,
                    item.quantity,
                    item.unitPrice,
                    item.total,
                    '' // Remark
                ]);
                
                row.height = 60; 
                row.alignment = { vertical: 'middle', wrapText: true };
                row.getCell(7).numFmt = '#,##0.00'; 
                row.getCell(8).numFmt = '#,##0.00'; 

                // Image Insertion
                if (item.imageUrl) {
                    const imgData = await fetchImageAsBuffer(item.imageUrl);
                    if (imgData) {
                        const imageId = workbook.addImage({
                            base64: imgData.base64,
                            extension: imgData.extension,
                        });
                        sheet.addImage(imageId, {
                            tl: { col: 1.1, row: row.number - 1 + 0.1 }, 
                            ext: { width: 50, height: 50 },
                            editAs: 'oneCell'
                        });
                    }
                }
                
                // BOM config formatting
                if (item.bomConfig && item.bomConfig.length > 0) {
                     const subItemsStr = item.bomConfig.map((sub:any) => {
                         const p = products.find((p:any) => p.id === sub.productId);
                         return `${p?.name} x${sub.quantity}`;
                     }).join(', ');
                     
                     row.getCell(4).value = item.spec + '\n' + `[含: ${subItemsStr}]`;
                }
            }

            // Category Subtotal Row
            const subtotalRow = sheet.addRow(['', '', '', '', '', '', '本项小计:', group.total, '']);
            subtotalRow.font = { bold: true, italic: true };
            subtotalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
            subtotalRow.getCell(8).numFmt = '#,##0.00';
            subtotalRow.getCell(8).font = { bold: true, color: { argb: 'FF059669' } }; 
            subtotalRow.height = 25;
            sheet.mergeCells(`A${subtotalRow.number}:F${subtotalRow.number}`);
        }

        // Totals Section
        sheet.addRow([]);
        
        const subRow = sheet.addRow(['', '', '', '', '', '', '合计 (Subtotal):', subtotal, '']);
        subRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        subRow.getCell(8).numFmt = '¥#,##0.00';
        subRow.font = { bold: true };

        const taxRow = sheet.addRow(['', '', '', '', '', '', `税费 (Tax ${(tax/subtotal*100).toFixed(0)}%):`, tax, '']);
        taxRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        taxRow.getCell(8).numFmt = '¥#,##0.00';
        taxRow.font = { color: { argb: 'FF64748B' } }; // Slate 500

        const totalRow = sheet.addRow(['', '', '', '', '', '', '总计 (Grand Total):', total, '']);
        totalRow.height = 30;
        totalRow.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
        totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        totalRow.getCell(8).alignment = { vertical: 'middle' };
        totalRow.getCell(8).numFmt = '¥#,##0.00';
        
        // Summary Table
        sheet.addRow([]);
        sheet.addRow(['报价汇总表']).font = { bold: true, size: 12 };
        const summaryHeader = sheet.addRow(['分类名称', '分类金额 (CNY)']);
        summaryHeader.font = { bold: true };
        summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        summaryHeader.getCell(1).border = { bottom: {style:'thin'} };
        summaryHeader.getCell(2).border = { bottom: {style:'thin'} };

        categoryOrder.forEach((cat, i) => {
             const sumRow = sheet.addRow([`（${chineseNumerals[i]||(i+1)}） ${cat}`, groupedItems[cat].total]);
             sumRow.getCell(2).numFmt = '#,##0.00';
        });
        const finalSumRow = sheet.addRow(['项目总价', subtotal]);
        finalSumRow.font = { bold: true };
        finalSumRow.getCell(2).numFmt = '¥#,##0.00';

        // Footer Terms
        sheet.addRow([]);
        sheet.addRow(['条款:', tpl.terms || '']);

        // Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `报价单_${customerInfo.name}_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Export Failed", error);
        alert("导出失败，请检查数据。");
    } finally {
        setIsExporting(false);
    }
  };

  // --- PDF EXPORT ---
  const handleExportPDF = async () => {
      if (!printRef.current) return;
      setIsPdfExporting(true);

      try {
          // Use html2canvas to capture the hidden printable div
          const canvas = await html2canvas(printRef.current, {
              scale: 2, // Higher scale for better quality
              useCORS: true, // For images
              logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF({
              orientation: 'p',
              unit: 'mm',
              format: 'a4'
          });

          const imgWidth = 210; // A4 width in mm
          const pageHeight = 297; // A4 height in mm
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          let heightLeft = imgHeight;
          let position = 0;

          // Add first page
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

          // Add subsequent pages if content overflows
          while (heightLeft > 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
          }

          pdf.save(`报价单_${customerInfo.name}_${new Date().toISOString().slice(0,10)}.pdf`);
      } catch (error) {
          console.error("PDF Export failed", error);
          alert("PDF 导出失败，请重试");
      } finally {
          setIsPdfExporting(false);
      }
  };

  const filteredQuotes = quotes.filter(q => {
      const matchId = q.id.toLowerCase().includes(searchId.toLowerCase());
      const matchCustomer = q.customerName.toLowerCase().includes(searchCustomer.toLowerCase());
      return matchId && matchCustomer;
  });

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      {/* Hidden Print Container for PDF Generation */}
      <div className="absolute top-0 left-[-9999px] overflow-hidden">
          <div ref={printRef} className="w-[794px] min-h-[1123px] bg-white p-12 text-slate-800 font-sans relative">
              {/* PDF Header */}
              <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                  <h1 className="text-3xl font-bold tracking-widest text-slate-900 mb-2">{templateSettings.quote.title}</h1>
                  <p className="text-sm text-slate-500">{templateSettings.quote.companyName}</p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                  <div>
                      <p className="mb-1"><span className="font-bold">客户名称：</span> {customerInfo.name}</p>
                      <p className="mb-1"><span className="font-bold">联系邮箱：</span> {customerInfo.email}</p>
                      <p className="mb-1"><span className="font-bold">联系地址：</span> -</p>
                  </div>
                  <div className="text-right">
                      <p className="mb-1"><span className="font-bold">报价日期：</span> {new Date().toLocaleDateString()}</p>
                      <p className="mb-1"><span className="font-bold">报价单号：</span> {`Q-${Date.now().toString().slice(-6)}`}</p>
                      <p className="mb-1"><span className="font-bold">有效期至：</span> {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</p>
                  </div>
              </div>

              {/* Grouped Table */}
              <div className="mb-8">
                  <table className="w-full text-left text-xs border-collapse">
                      <thead>
                          <tr className="bg-blue-600 text-white">
                              <th className="p-3 border border-blue-700 w-12 text-center">序号</th>
                              <th className="p-3 border border-blue-700 w-20 text-center">图片</th>
                              <th className="p-3 border border-blue-700">产品名称</th>
                              <th className="p-3 border border-blue-700 w-24">规格/型号</th>
                              <th className="p-3 border border-blue-700 w-12 text-center">单位</th>
                              <th className="p-3 border border-blue-700 w-12 text-center">数量</th>
                              <th className="p-3 border border-blue-700 w-20 text-right">单价</th>
                              <th className="p-3 border border-blue-700 w-20 text-right">金额</th>
                          </tr>
                      </thead>
                      <tbody>
                          {groupedData.categoryOrder.map((cat, i) => {
                              const group = groupedData.groupedItems[cat];
                              return (
                                  <React.Fragment key={cat}>
                                      {/* Category Header */}
                                      <tr className="bg-slate-100">
                                          <td colSpan={8} className="p-2 border border-slate-300 font-bold text-slate-700">
                                              {`（${chineseNumerals[i]||(i+1)}） ${cat}`}
                                          </td>
                                      </tr>
                                      {/* Items */}
                                      {group.items.map((item, idx) => (
                                          <tr key={idx}>
                                              <td className="p-2 border border-slate-200 text-center">{idx + 1}</td>
                                              <td className="p-2 border border-slate-200 text-center">
                                                  {item.imageUrl ? (
                                                      <img src={item.imageUrl} className="w-10 h-10 object-contain mx-auto" alt="" />
                                                  ) : '-'}
                                              </td>
                                              <td className="p-2 border border-slate-200">
                                                  <div className="font-medium">{item.name}</div>
                                                  {item.bomConfig && item.bomConfig.length > 0 && (
                                                      <div className="text-[10px] text-slate-500 mt-1">
                                                          含: {item.bomConfig.length} 个组件
                                                      </div>
                                                  )}
                                              </td>
                                              <td className="p-2 border border-slate-200">{item.spec}</td>
                                              <td className="p-2 border border-slate-200 text-center">{item.unit}</td>
                                              <td className="p-2 border border-slate-200 text-center">{item.quantity}</td>
                                              <td className="p-2 border border-slate-200 text-right">¥{item.unitPrice.toLocaleString()}</td>
                                              <td className="p-2 border border-slate-200 text-right">¥{item.total.toLocaleString()}</td>
                                          </tr>
                                      ))}
                                      {/* Category Subtotal */}
                                      <tr className="bg-white">
                                          <td colSpan={6} className="p-2 border border-slate-200 border-t-0"></td>
                                          <td className="p-2 border border-slate-200 font-bold text-right text-slate-600 bg-slate-50">本项小计:</td>
                                          <td className="p-2 border border-slate-200 font-bold text-right bg-slate-50">¥{group.total.toLocaleString()}</td>
                                      </tr>
                                  </React.Fragment>
                              )
                          })}
                      </tbody>
                  </table>
              </div>

              {/* Totals & Summary */}
              <div className="flex gap-8 items-start mb-8 break-inside-avoid">
                  {/* Summary Table */}
                  <div className="flex-1">
                      <h4 className="font-bold text-sm mb-2 border-l-4 border-blue-600 pl-2">报价汇总表</h4>
                      <table className="w-full text-xs border border-slate-300">
                          <thead className="bg-slate-100">
                              <tr>
                                  <th className="p-2 border-b border-slate-300 text-left">分类名称</th>
                                  <th className="p-2 border-b border-slate-300 text-right">分类金额</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                              {groupedData.categoryOrder.map((cat, i) => (
                                  <tr key={cat}>
                                      <td className="p-2">{`（${chineseNumerals[i]||(i+1)}） ${cat}`}</td>
                                      <td className="p-2 text-right">¥{groupedData.groupedItems[cat].total.toLocaleString()}</td>
                                  </tr>
                              ))}
                              <tr className="bg-slate-50 font-bold">
                                  <td className="p-2">项目总价</td>
                                  <td className="p-2 text-right">¥{subtotal.toLocaleString()}</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>

                  {/* Grand Totals */}
                  <div className="w-64">
                      <div className="flex justify-between py-2 border-b border-slate-200 text-sm">
                          <span>合计金额:</span>
                          <span className="font-medium">¥{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-200 text-sm text-slate-500">
                          <span>税费 (9%):</span>
                          <span>¥{tax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-4 text-xl font-bold text-slate-900">
                          <span>总计:</span>
                          <span>¥{total.toLocaleString()}</span>
                      </div>
                  </div>
              </div>

              {/* Footer */}
              <div className="mt-auto border-t border-slate-200 pt-6 text-xs text-slate-500">
                  <p className="font-bold mb-1">条款与备注：</p>
                  <p className="whitespace-pre-wrap">{templateSettings.quote.terms}</p>
              </div>
          </div>
      </div>

      {/* Left: Quote Builder */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="flex justify-between items-center">
           <div>
               <h2 className="text-2xl font-bold text-slate-800">智能报价引擎</h2>
               <p className="text-slate-500">快速为客户生成精准的商业报价单。</p>
           </div>
           <button 
               onClick={() => setShowHistoryModal(true)}
               className="bg-white border border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-colors"
           >
               <History className="w-4 h-4" />
               导入历史报价
           </button>
        </div>

        {/* Customer Info Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">客户信息</h3>
          <div className="grid grid-cols-2 gap-4">
             <input 
               type="text" 
               className="w-full p-2 border border-slate-300 rounded-lg"
               placeholder="客户名称"
               value={customerInfo.name}
               onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})}
             />
             <input 
               type="email" 
               className="w-full p-2 border border-slate-300 rounded-lg"
               placeholder="电子邮箱"
               value={customerInfo.email}
               onChange={e => setCustomerInfo({...customerInfo, email: e.target.value})}
             />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
           {/* Add Item Bar */}
           <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-3">
             <select 
               className="flex-1 p-2 border border-slate-300 rounded-lg"
               value={selectedItem}
               onChange={e => setSelectedItem(e.target.value)}
             >
               <option value="">选择要添加的项目...</option>
               <optgroup label="辅助 BOM (Auxiliary BOMs)">
                    {boms.filter(b => !b.rootProductId).map(b => (
                        <option key={b.id} value={b.id}>📑 {b.name} (BOM)</option>
                    ))}
               </optgroup>
               <optgroup label="标准产品">
                 {products.map(p => (
                    <option key={p.id} value={p.id}>{p.type === '成品' ? '📦' : '🔩'} {p.name} - ¥{p.basePrice}</option>
                 ))}
               </optgroup>
             </select>
             <button 
               onClick={handleAddItem}
               className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
             >
               <Plus className="w-4 h-4" /> 添加行
             </button>
           </div>

           {/* Items Table */}
           <div className="flex-1 p-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <p>报价单暂无项目。</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    const bom = boms.find(b => b.id === item.productId);
                    const isBOM = !!bom;
                    const isExpanded = expandedItems.has(item.id);

                    return (
                      <div key={item.id} className={`border rounded-lg transition-colors overflow-hidden ${isBOM ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100 hover:bg-slate-50'}`}>
                          {/* Main Row */}
                          <div className={`flex items-center gap-4 p-3 ${isBOM && isExpanded ? 'bg-indigo-50/50 border-b border-indigo-100' : ''}`}>
                            {isBOM && (
                                <button onClick={() => toggleExpand(item.id)} className="text-slate-400 hover:text-indigo-600 p-1">
                                    {isExpanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                </button>
                            )}
                            {!isBOM && <div className="w-6"></div>}

                            <div className="flex-1 min-w-[150px]">
                            <p className="font-medium text-slate-800 flex items-center gap-2">
                                {product ? product.name : bom?.name}
                                {isBOM && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">BOM配置</span>}
                            </p>
                            <p className="text-xs text-slate-500">
                                {product ? `${product.materialCode} (${product.unit})` : '自定义配置清单'}
                            </p>
                            </div>
                            
                            <div className="w-20">
                                <label className="text-[10px] uppercase text-slate-400 font-bold">数量</label>
                                <input 
                                    type="number" 
                                    className="w-full p-1 border border-slate-300 rounded text-sm text-center"
                                    value={item.quantity}
                                    onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                />
                            </div>

                            <div className="w-20">
                                <label className="text-[10px] uppercase text-slate-400 font-bold text-blue-600">利润 %</label>
                                <input 
                                    type="number" 
                                    className="w-full p-1 border border-blue-200 bg-blue-50/50 rounded text-sm text-center text-blue-700 font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={item.margin}
                                    onChange={e => updateItem(item.id, 'margin', Number(e.target.value))}
                                    placeholder="0"
                                />
                            </div>
                            
                            <div className="w-28 text-right">
                                <label className="text-[10px] uppercase text-slate-400 font-bold">小计 (CNY)</label>
                                <p className="font-semibold text-slate-800 py-1">¥{item.total.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                            </div>
                            
                            <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500 mt-4 ml-2">
                            <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* BOM Sub-items Table */}
                          {isBOM && isExpanded && item.bomConfig && (
                              <div className="p-3 pl-12 bg-slate-50/50">
                                  <div className="flex items-center gap-2 mb-2 text-xs text-indigo-600 font-medium">
                                      <CornerDownRight className="w-3 h-3" />
                                      <span>配置详情 (修改数量将自动更新单价)</span>
                                  </div>
                                  <div className="border border-slate-200 rounded-lg bg-white overflow-hidden text-sm">
                                      <table className="w-full text-left">
                                          <thead className="bg-slate-50 text-slate-500 text-xs">
                                              <tr>
                                                  <th className="px-3 py-2">组件</th>
                                                  <th className="px-3 py-2 text-center w-24">配置数量</th>
                                                  {canViewCost && <th className="px-3 py-2 text-right">成本估算</th>}
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              {item.bomConfig.map(sub => {
                                                  const subProduct = products.find(p => p.id === sub.productId);
                                                  return (
                                                      <tr key={sub.id} className="hover:bg-slate-50">
                                                          <td className="px-3 py-2">
                                                              <div className="text-slate-700">{subProduct?.name}</div>
                                                              <div className="text-[10px] text-slate-400">{subProduct?.materialCode}</div>
                                                          </td>
                                                          <td className="px-3 py-2 text-center">
                                                              <input 
                                                                  type="number"
                                                                  min="1"
                                                                  className="w-16 p-1 border border-slate-200 rounded text-center text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                  value={sub.quantity}
                                                                  onChange={(e) => handleBomSubChange(item.id, sub.id, Number(e.target.value))}
                                                              />
                                                          </td>
                                                          {canViewCost && (
                                                              <td className="px-3 py-2 text-right text-slate-500 text-xs">
                                                                  ¥{(subProduct?.cost || 0) * sub.quantity}
                                                              </td>
                                                          )}
                                                      </tr>
                                                  )
                                              })}
                                          </tbody>
                                      </table>
                                      <div className="bg-indigo-50 px-3 py-2 text-xs flex justify-between items-center text-indigo-700 border-t border-indigo-100">
                                          <span>
                                              当前配置基准单价 = <span className="font-mono font-bold">¥{item.unitPrice}</span>
                                          </span>
                                          <span className="opacity-70 text-[10px]">自动计算逻辑: 总成本 x 1.13</span>
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Right: Summary & AI */}
      <div className="flex flex-col gap-6">
        
        {/* Quote Summary */}
        <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
          {showSaveSuccess && (
              <div className="absolute inset-0 bg-emerald-600 flex items-center justify-center z-10 animate-in fade-in zoom-in duration-300">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="w-10 h-10 text-white" />
                    <span className="font-bold text-lg">保存成功!</span>
                  </div>
              </div>
          )}
          <h3 className="font-semibold text-lg mb-6">报价汇总</h3>
          <div className="space-y-4">
            <div className="flex justify-between text-slate-400">
              <span>小计 (Subtotal)</span>
              <span>¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>税费 (Tax 9%)</span>
              <span>¥{tax.toLocaleString()}</span>
            </div>
            <div className="h-px bg-slate-700 my-4"></div>
            <div className="flex justify-between text-xl font-bold text-white">
              <span>总计 (Total)</span>
              <span>¥{total.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Status Selection */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <label className="block text-xs font-medium text-slate-400 mb-2">设置报价单状态</label>
            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={() => setStatus('Draft')}
                    className={`text-xs py-2 px-1 rounded border transition-colors ${status === 'Draft' ? 'bg-slate-200 text-slate-900 border-slate-200 font-bold' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}
                >
                    草稿
                </button>
                <button
                    onClick={() => setStatus('Sent')}
                    className={`text-xs py-2 px-1 rounded border transition-colors ${status === 'Sent' ? 'bg-blue-500 text-white border-blue-500 font-bold' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}
                >
                    已发送
                </button>
                <button
                    onClick={() => setStatus('Approved')}
                    className={`text-xs py-2 px-1 rounded border transition-colors ${status === 'Approved' ? 'bg-emerald-500 text-white border-emerald-500 font-bold' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}
                >
                    已批准/成单
                </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button 
                onClick={handleSaveQuote}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> 保存报价单
            </button>
            <button 
              onClick={handleExportExcel}
              disabled={isExporting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
            >
              <FileSpreadsheet className="w-4 h-4" /> {isExporting ? '生成中...' : '导出 Excel'}
            </button>
            <button 
                onClick={handleExportPDF}
                disabled={isPdfExporting}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isPdfExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4" />} 
              {isPdfExporting ? '处理中...' : '导出 PDF'}
            </button>
          </div>
        </div>

        {/* AI Assistant */}
        <div className="bg-gradient-to-br from-violet-50 to-white p-6 rounded-xl border border-violet-100 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
             <Sparkles className="w-5 h-5 text-violet-600" />
             <h3 className="font-bold text-slate-800">智能分析</h3>
           </div>
           
           {!aiAnalysis ? (
             <div className="text-center py-6">
                <p className="text-slate-500 text-sm mb-4">获取关于追加销售和配置优化的建议。</p>
                <button 
                  onClick={handleRunAIAnalysis}
                  disabled={items.length === 0}
                  className="text-sm bg-white border border-violet-200 text-violet-700 px-4 py-2 rounded-lg hover:bg-violet-50 disabled:opacity-50 shadow-sm"
                >
                  分析报价
                </button>
             </div>
           ) : (
             <div className="animate-in fade-in zoom-in duration-300">
                <p className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-violet-100">
                  {aiAnalysis}
                </p>
                <button 
                  onClick={() => setAiAnalysis(null)}
                  className="mt-3 text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  清除分析
                </button>
             </div>
           )}
        </div>
      </div>

      {/* History Import Modal */}
      {showHistoryModal && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                  {/* Modal Header */}
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <History className="w-5 h-5 text-blue-600" />
                          导入历史报价
                      </h3>
                      <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  {/* Search Bar - Adjusted Grid */}
                  <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative">
                          <input 
                              type="text" 
                              placeholder="搜索单号..." 
                              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                              value={searchId}
                              onChange={e => setSearchId(e.target.value)}
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      </div>
                      <div className="relative">
                          <input 
                              type="text" 
                              placeholder="搜索客户..." 
                              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                              value={searchCustomer}
                              onChange={e => setSearchCustomer(e.target.value)}
                          />
                          <Users className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      </div>
                  </div>

                  {/* Table Content */}
                  <div className="flex-1 overflow-y-auto p-0">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-500 text-xs font-semibold sticky top-0 border-b border-slate-200">
                              <tr>
                                  <th className="px-6 py-3 whitespace-nowrap">单号</th>
                                  <th className="px-6 py-3 whitespace-nowrap">客户</th>
                                  <th className="px-6 py-3 whitespace-nowrap">日期</th>
                                  <th className="px-6 py-3 text-right whitespace-nowrap">总额</th>
                                  <th className="px-6 py-3 text-right whitespace-nowrap">操作</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {filteredQuotes.map(q => (
                                  <tr key={q.id} className="hover:bg-slate-50 group">
                                      <td className="px-6 py-4 font-medium text-slate-700 text-sm">{q.id}</td>
                                      <td className="px-6 py-4 text-slate-600 text-sm">{q.customerName}</td>
                                      <td className="px-6 py-4 text-slate-500 text-sm">{new Date(q.date).toLocaleDateString()}</td>
                                      <td className="px-6 py-4 text-slate-800 font-medium text-right text-sm">¥{q.grandTotal.toLocaleString()}</td>
                                      <td className="px-6 py-4 text-right">
                                          <button 
                                              onClick={() => { loadQuoteIntoEditor(q); setShowHistoryModal(false); }}
                                              className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 hover:border-blue-300 transition-colors"
                                          >
                                              选择导入
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                              {filteredQuotes.length === 0 && (
                                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">没有找到匹配的历史报价</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
                  
                  {/* Footer */}
                  <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 rounded-b-xl flex justify-between items-center">
                      <span>提示：导入历史报价将覆盖当前编辑器的所有内容，并作为新草稿开始。</span>
                      <span className="font-medium">共找到 {filteredQuotes.length} 条记录</span>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default QuoteGenerator;