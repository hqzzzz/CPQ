
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { QuoteItem, Product, Quote, BOMItem, QuoteStatusLog } from '../types';
import { Plus, Trash2, Printer, Sparkles, FileSpreadsheet, Save, CheckCircle, FileText, History, X, ChevronRight, ChevronDown, Search, Users, CornerDownRight, RefreshCcw, Loader2, AlertTriangle, RotateCcw, Clock, User as UserIcon } from 'lucide-react';
import { analyzeQuote } from '../services/geminiService';
import { useLocation } from 'react-router-dom';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const QuoteGenerator = () => {
  const { products, addQuote, updateQuote, boms, productBoms, quotes, currentUser, templateSettings, types } = useStore();
  const location = useLocation();

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '示例企业有限公司', email: 'contact@example.com' });
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Approved'>('Draft');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');

  // Editing State
  const [originalQuote, setOriginalQuote] = useState<Quote | null>(null);

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const printRef = useRef<HTMLDivElement>(null);

  // Check role using integer ID
  const canViewCost = currentUser?.role !== 2; 

  useEffect(() => {
    if (location.state?.quoteData) {
        const incomeQuote = location.state.quoteData as Quote;
        loadQuoteIntoEditor(incomeQuote);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const loadQuoteIntoEditor = (quote: Quote) => {
      setOriginalQuote(quote); // Track the original quote for updates
      
      const newItems = quote.items.map(item => ({
          ...item,
          id: Date.now() + Math.random(), // Ensure unique numeric ID for editor
          margin: Number(item.margin || 0),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          total: Number(item.total),
          bomConfig: item.bomConfig ? JSON.parse(JSON.stringify(item.bomConfig)) : undefined
      }));
      setItems(newItems);
      setCustomerInfo({
          name: quote.customerName,
          email: '' 
      });
      setStatus(quote.status); // Set initial status to match loaded quote
      setAiAnalysis(null);
  };

  const handleReset = () => {
      if (items.length > 0 && !window.confirm("确定要重置当前编辑器吗？未保存的内容将丢失。")) return;
      setOriginalQuote(null);
      setItems([]);
      setCustomerInfo({ name: '', email: '' });
      setStatus('Draft');
      setSelectedItem('');
      setAiAnalysis(null);
  };

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

  const updateBOMItemQuantity = (items: BOMItem[], subItemId: number, newQty: number): BOMItem[] => {
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
    
    // selectedItem is string from select, convert to number
    const selId = Number(selectedItem);
    const product = products.find(p => p.id === selId);
    const auxBom = boms.find(b => b.id === selId);

    if (auxBom) {
      const bomSnapshot = JSON.parse(JSON.stringify(auxBom.items));
      const cost = calculateBOMCost(bomSnapshot);
      const price = Math.round(cost * 1.13); 
      
      const newItem: QuoteItem = {
        id: Date.now(),
        productId: auxBom.id,
        quantity: 1,
        unitPrice: price,
        margin: 0,
        total: price,
        bomConfig: bomSnapshot
      };
      
      setItems([...items, newItem]);
      setExpandedItems(prev => new Set(prev).add(newItem.id));

    } else if (product) {
      const price = Number(product.basePrice);
      const prodBom = productBoms.find(pb => pb.productId === product.id);
      
      const newItem: QuoteItem = {
        id: Date.now(),
        productId: product.id,
        quantity: 1,
        unitPrice: price, 
        margin: 0,
        total: price,
        bomConfig: prodBom ? JSON.parse(JSON.stringify(prodBom.items)) : undefined
      };
      setItems([...items, newItem]);
      
      if(prodBom) {
          setExpandedItems(prev => new Set(prev).add(newItem.id));
      }
    }

    setSelectedItem('');
    setAiAnalysis(null);
  };

  const updateItem = (id: number, field: keyof QuoteItem, value: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: Number(value) };
        const priceWithMargin = updated.unitPrice * (1 + updated.margin / 100);
        updated.total = priceWithMargin * updated.quantity;
        return updated;
      }
      return item;
    }));
  };

  const handleBomSubChange = (quoteItemId: number, subItemId: number, newQty: number) => {
      if (newQty < 1) return;

      setItems(prevItems => prevItems.map(item => {
          if (item.id !== quoteItemId || !item.bomConfig) return item;

          const newBomConfig = updateBOMItemQuantity(item.bomConfig, subItemId, newQty);
          const newCost = calculateBOMCost(newBomConfig);
          const newUnitPrice = Math.round(newCost);
          
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

  const handleRemoveBomSubItem = (quoteItemId: number, subItemId: number) => {
      setItems(prevItems => prevItems.map(item => {
          if (item.id !== quoteItemId || !item.bomConfig) return item;
          
          const removeRecursive = (list: BOMItem[]): BOMItem[] => {
              return list.filter(i => i.id !== subItemId).map(i => ({
                  ...i,
                  children: i.children ? removeRecursive(i.children) : undefined
              }));
          };

          const newBomConfig = removeRecursive(item.bomConfig);
          const newCost = calculateBOMCost(newBomConfig);
          const newUnitPrice = Math.round(newCost * 1.13); 
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

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
    if (expandedItems.has(id)) {
        const newSet = new Set(expandedItems);
        newSet.delete(id);
        setExpandedItems(newSet);
    }
  };

  const toggleExpand = (id: number) => {
      const newSet = new Set(expandedItems);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedItems(newSet);
  };

  const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const tax = subtotal * 0.09; 
  const total = subtotal + tax;

  const handleRunAIAnalysis = async () => {
    if (items.length === 0) return;
    setAiAnalysis("正在分析报价结构...");
    const productsInQuote = items.map(i => products.find(p => p.id === i.productId)).filter(Boolean) as Product[];
    const result = await analyzeQuote(productsInQuote);
    setAiAnalysis(result);
  };

  // Status Change Handler: Updates existing quote if in Edit Mode
  const handleStatusChange = async (newStatus: 'Draft' | 'Sent' | 'Approved') => {
      if (originalQuote) {
          // Edit Mode: Update the EXISTING quote record only with new status log
          // We keep the original items, date, ID. Only status and statusLog change.
          
          const newLogEntry: QuoteStatusLog = {
              status: newStatus,
              timestamp: new Date().toISOString(),
              operator: currentUser?.name || 'Unknown User'
          };

          const currentLogs = originalQuote.statusLog || [];
          
          // Slice to ensure only the last 20 logs are kept (Backend Requirement)
          const updatedLogs = [newLogEntry, ...currentLogs].slice(0, 20);

          const updatedQuote: Quote = {
              ...originalQuote,
              status: newStatus,
              statusLog: updatedLogs
          };
          
          updateQuote(updatedQuote);
          setOriginalQuote(updatedQuote); // Update local reference
          setStatus(newStatus); // Update UI
          
          setShowSaveSuccess(true);
          setTimeout(() => setShowSaveSuccess(false), 2000);
      } else {
          // Create Mode: Just update local state for eventual save
          setStatus(newStatus);
      }
  };

  // Save Quote Handler: ALWAYS creates a NEW quote (Versioning)
  const handleSaveQuote = () => {
    if (items.length === 0) {
      alert("请先添加产品再保存。");
      return;
    }
    
    // "Clicking save should start a new order number"
    const newQuote: Quote = {
      id: Date.now(),
      customerName: customerInfo.name,
      date: new Date().toISOString(), // New Date
      status: status,
      items: [...items],
      subtotal: subtotal,
      tax: tax,
      grandTotal: total,
      statusLog: [{
          status: status,
          timestamp: new Date().toISOString(),
          operator: currentUser?.name || 'System'
      }]
    };

    addQuote(newQuote);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  // ... (Export Logic remains unchanged) ...
  const chineseNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  const fetchImageAsBuffer = async (url: string): Promise<{ base64: string, extension: 'png' | 'jpeg' | 'gif' } | null> => {
    try {
        if (url.startsWith('data:image/')) {
            const matches = url.match(/^data:image\/([a-zA-Z]*);base64,([^\"]*)$/);
            if (matches) {
                return {
                    extension: matches[1] === 'jpeg' ? 'jpeg' : 'png', 
                    base64: matches[2]
                };
            }
        }
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

  const groupedData = useMemo(() => {
    const groupedItems: Record<string, { items: any[], total: number }> = {};
    const categoryOrder: string[] = [];

    items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const auxBom = boms.find(b => b.id === item.productId);
        
        // Priority: Product Category -> BOM Category -> Default
        const category = product?.category || auxBom?.category || (auxBom ? '系统集成/BOM' : '其他');
        
        if (!groupedItems[category]) {
            groupedItems[category] = { items: [], total: 0 };
            categoryOrder.push(category);
        }
        
        const imageUrl = product?.baseImage;
        const itemTotal = Number(item.total);

        const spec = product?.specifications || auxBom?.specifications || product?.description || '定制配置';
        const description = product?.description || auxBom?.description || '';

        groupedItems[category].items.push({
            ...item,
            name: product?.name || auxBom?.name,
            spec: spec,
            description: description,
            unit: product?.unit || '套',
            code: product?.materialCode || '-',
            imageUrl: imageUrl,
            total: itemTotal 
        });
        groupedItems[category].total += itemTotal;
    });

    return { groupedItems, categoryOrder };
  }, [items, products, boms]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
        const { quote: tpl } = templateSettings;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Quote');
        
        // ... (Columns setup same as before) ...
        sheet.columns = [
            { header: '序号', key: 'idx', width: 8 },
            { header: '图片', key: 'image', width: 15 }, 
            { header: '产品名称', key: 'name', width: 30 },
            { header: '规格/型号', key: 'spec', width: 25 },
            { header: '单位', key: 'unit', width: 8 },
            { header: '数量', key: 'qty', width: 10 },
            { header: '单价', key: 'price', width: 15 },
            { header: '金额', key: 'total', width: 15 },
            { header: '备注', key: 'remark', width: 25 },
        ];

        sheet.mergeCells('A1:I1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = tpl.title;
        titleCell.font = { size: 20, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        sheet.addRow([]);
        sheet.addRow(['客户名称:', customerInfo.name, '', '', '报价日期:', new Date().toLocaleDateString()]);
        sheet.addRow(['联系人:', customerInfo.email, '', '', '单号:', originalQuote ? `Q-${originalQuote.id} (REV)` : `Q-${Date.now().toString().slice(-6)}`]);
        sheet.addRow(['卖方公司:', tpl.companyName]);
        sheet.addRow([]);

        // ... (Rest of Excel generation same as before) ...
        const headerRow = sheet.addRow(['序号', '图片', '产品名称', '规格/型号', '单位', '数量', '单价 (¥)', '金额 (¥)', '备注']);
        
        for (let i = 1; i <= 9; i++) {
            const cell = headerRow.getCell(i);
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; 
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        }
        headerRow.height = 25;

        const { groupedItems, categoryOrder } = groupedData;
        let globalIndex = 1;

        for (let i = 0; i < categoryOrder.length; i++) {
            const cat = categoryOrder[i];
            const group = groupedItems[cat];
            const sectionTitle = `（${chineseNumerals[i] || (i + 1)}） ${cat}`;

            const sectionRow = sheet.addRow([sectionTitle]);
            sheet.mergeCells(`A${sectionRow.number}:I${sectionRow.number}`);
            const secCell = sectionRow.getCell(1);
            secCell.font = { bold: true, size: 12 };
            secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; 
            secCell.alignment = { horizontal: 'left', vertical: 'middle' };
            sectionRow.height = 25;
            
            for (const item of group.items) {
                const row = sheet.addRow([
                    globalIndex++,
                    '', 
                    item.name,
                    item.spec,
                    item.unit,
                    item.quantity,
                    item.unitPrice,
                    item.total,
                    item.description || '' 
                ]);
                
                row.height = 60; 
                row.alignment = { vertical: 'middle', wrapText: true };
                row.getCell(7).numFmt = '#,##0.00'; 
                row.getCell(8).numFmt = '#,##0.00'; 

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
                
                if (item.bomConfig && item.bomConfig.length > 0) {
                     const subItemsStr = item.bomConfig.map((sub:any) => {
                         const p = products.find((p:any) => p.id === sub.productId);
                         return `${p?.name} x${sub.quantity}`;
                     }).join(', ');
                     
                     row.getCell(4).value = item.spec + '\n' + `[含: ${subItemsStr}]`;
                }
            }

            const subtotalRow = sheet.addRow(['', '', '', '', '', '', '本项小计:', group.total, '']);
            subtotalRow.font = { bold: true, italic: true };
            subtotalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
            subtotalRow.getCell(8).numFmt = '#,##0.00';
            subtotalRow.getCell(8).font = { bold: true, color: { argb: 'FF059669' } }; 
            subtotalRow.height = 25;
            sheet.mergeCells(`A${subtotalRow.number}:F${subtotalRow.number}`);
        }

        sheet.addRow([]);
        
        const subRow = sheet.addRow(['', '', '', '', '', '', '合计 (Subtotal):', subtotal, '']);
        subRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        subRow.getCell(8).numFmt = '¥#,##0.00';
        subRow.font = { bold: true };

        const taxRow = sheet.addRow(['', '', '', '', '', '', `税费 (Tax ${(tax/subtotal*100).toFixed(0)}%):`, tax, '']);
        taxRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        taxRow.getCell(8).numFmt = '¥#,##0.00';
        taxRow.font = { color: { argb: 'FF64748B' } }; 

        const totalRow = sheet.addRow(['', '', '', '', '', '', '总计 (Grand Total):', total, '']);
        totalRow.height = 30;
        totalRow.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
        totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        totalRow.getCell(8).alignment = { vertical: 'middle' };
        totalRow.getCell(8).numFmt = '¥#,##0.00';
        
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

        sheet.addRow([]);
        sheet.addRow(['条款:', tpl.terms || '']);

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

  const handleExportPDF = async () => {
      // ... (PDF Export same as before) ...
      if (!printRef.current) return;
      setIsPdfExporting(true);

      try {
          const canvas = await html2canvas(printRef.current, {
              scale: 2,
              useCORS: true,
              logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF({
              orientation: 'p',
              unit: 'mm',
              format: 'a4'
          });

          const imgWidth = 210; 
          const pageHeight = 297; 
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          let heightLeft = imgHeight;
          let position = 0;

          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

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
      const matchId = String(q.id).includes(searchId);
      const matchCustomer = q.customerName.toLowerCase().includes(searchCustomer.toLowerCase());
      return matchId && matchCustomer;
  });

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      <div className="absolute top-0 left-[-9999px] overflow-hidden">
          <div ref={printRef} className="w-[794px] min-h-[1123px] bg-white p-12 text-slate-800 font-sans relative">
              <div className="flex items-center justify-between mb-8 border-b-2 border-slate-800 pb-4">
                  <div className="flex items-center gap-6">
                      {templateSettings.quote.companyLogo && (
                          <img src={templateSettings.quote.companyLogo} alt="Logo" className="h-20 max-w-[200px] object-contain" />
                      )}
                      <div className={`${!templateSettings.quote.companyLogo ? 'w-full text-center' : ''}`}>
                           <h1 className="text-3xl font-bold tracking-widest text-slate-900 leading-none mb-1">{templateSettings.quote.title}</h1>
                           <p className="text-sm text-slate-500 font-medium">{templateSettings.quote.companyName}</p>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                  <div>
                      <p className="mb-1"><span className="font-bold">客户名称：</span> {customerInfo.name}</p>
                      <p className="mb-1"><span className="font-bold">联系邮箱：</span> {customerInfo.email}</p>
                      <p className="mb-1"><span className="font-bold">联系地址：</span> -</p>
                  </div>
                  <div className="text-right">
                      <p className="mb-1"><span className="font-bold">报价日期：</span> {originalQuote ? new Date(originalQuote.date).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                      <p className="mb-1"><span className="font-bold">报价单号：</span> {originalQuote ? `Q-${originalQuote.id}` : `Q-${Date.now().toString().slice(-6)}`}</p>
                      <p className="mb-1"><span className="font-bold">有效期至：</span> {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</p>
                  </div>
              </div>
              
              {/* ... (Rest of PDF Template code is same as print logic above) ... */}
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
                              <th className="p-3 border border-blue-700 w-24">备注</th>
                          </tr>
                      </thead>
                      <tbody>
                          {groupedData.categoryOrder.map((cat, i) => {
                              const group = groupedData.groupedItems[cat];
                              return (
                                  <React.Fragment key={cat}>
                                      <tr className="bg-slate-100">
                                          <td colSpan={9} className="p-2 border border-slate-300 font-bold text-slate-700">
                                              {`（${chineseNumerals[i]||(i+1)}） ${cat}`}
                                          </td>
                                      </tr>
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
                                              <td className="p-2 border border-slate-200 text-slate-500">{item.description}</td>
                                          </tr>
                                      ))}
                                      <tr className="bg-white">
                                          <td colSpan={6} className="p-2 border border-slate-200 border-t-0"></td>
                                          <td className="p-2 border border-slate-200 font-bold text-right text-slate-600 bg-slate-50">本项小计:</td>
                                          <td colSpan={2} className="p-2 border border-slate-200 font-bold text-left bg-slate-50">¥{group.total.toLocaleString()}</td>
                                      </tr>
                                  </React.Fragment>
                              )
                          })}
                      </tbody>
                  </table>
              </div>

              <div className="flex gap-8 items-start mb-8 break-inside-avoid">
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

              <div className="mt-auto border-t border-slate-200 pt-6 text-xs text-slate-500">
                  <p className="font-bold mb-1">条款与备注：</p>
                  <p className="whitespace-pre-wrap">{templateSettings.quote.terms}</p>
              </div>
          </div>
      </div>

      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="flex justify-between items-center">
           <div>
               <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                   {originalQuote ? `编辑报价单 (Q-${originalQuote.id})` : '智能报价引擎'}
                   {originalQuote && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full border border-blue-200">Edit Mode</span>}
               </h2>
               <p className="text-slate-500">快速为客户生成精准的商业报价单。</p>
           </div>
           <div className="flex gap-2">
                {originalQuote && (
                    <button 
                        onClick={handleReset}
                        className="bg-white border border-slate-300 text-slate-600 hover:text-red-600 hover:border-red-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        重置 / 新建
                    </button>
                )}
                <button 
                    onClick={() => setShowHistoryModal(true)}
                    className="bg-white border border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-colors"
                >
                    <History className="w-4 h-4" />
                    导入历史报价
                </button>
           </div>
        </div>

        {/* ... (Rest of Form UI same as before) ... */}
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
           {/* ... (Item Editor UI same as before) ... */}
           <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-3">
             <select 
               className="flex-1 p-2 border border-slate-300 rounded-lg"
               value={selectedItem}
               onChange={e => setSelectedItem(e.target.value)}
             >
               <option value="">选择要添加的项目...</option>
               <optgroup label="辅助 BOM (Auxiliary BOMs)">
                    {boms.map(b => (
                        <option key={b.id} value={b.id}>📑 {b.name} (BOM)</option>
                    ))}
               </optgroup>
               <optgroup label="标准产品">
                 {products.map(p => (
                    <option key={p.id} value={p.id}>{p.type === 2 ? '📦' : '🔩'} {p.name} - ¥{p.basePrice}</option>
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

           <div className="flex-1 p-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <p>报价单暂无项目。</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    const auxBom = boms.find(b => b.id === item.productId);
                    const isBOM = !!item.bomConfig; 
                    const isExpanded = expandedItems.has(item.id);
                    const isMissing = !product && !auxBom;

                    return (
                      <div key={item.id} className={`border rounded-lg transition-colors overflow-hidden ${isBOM ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100 hover:bg-slate-50'} ${isMissing ? 'bg-red-50 border-red-200' : ''}`}>
                          <div className={`flex items-center gap-4 p-3 ${isBOM && isExpanded ? 'bg-indigo-50/50 border-b border-indigo-100' : ''}`}>
                            {isBOM && (
                                <button onClick={() => toggleExpand(item.id)} className="text-slate-400 hover:text-indigo-600 p-1">
                                    {isExpanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                </button>
                            )}
                            {!isBOM && <div className="w-6"></div>}

                            <div className="flex-1 min-w-[150px]">
                            <p className="font-medium text-slate-800 flex items-center gap-2">
                                {isMissing ? (
                                     <span className="text-red-500 flex items-center gap-1">
                                        <AlertTriangle className="w-4 h-4" />
                                        产品已删除 (ID: {item.productId})
                                     </span>
                                ) : (
                                     product ? product.name : auxBom?.name
                                )}
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
                                    onFocus={(e) => e.target.select()}
                                    onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                />
                            </div>

                            <div className="w-20">
                                <label className="text-[10px] uppercase text-slate-400 font-bold text-blue-600">利润 %</label>
                                <input 
                                    type="number" 
                                    className="w-full p-1 border border-blue-200 bg-blue-50/50 rounded text-sm text-center text-blue-700 font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={item.margin}
                                    onFocus={(e) => e.target.select()}
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
                                                  <th className="px-3 py-2 w-10"></th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              {item.bomConfig.map(sub => {
                                                  const subProduct = products.find(p => p.id === sub.productId);
                                                  return (
                                                      <tr key={sub.id} className={`hover:bg-slate-50 ${!subProduct ? 'bg-red-50/30' : ''}`}>
                                                          <td className="px-3 py-2">
                                                              {subProduct ? (
                                                                  <>
                                                                    <div className="text-slate-700">{subProduct.name}</div>
                                                                    <div className="text-[10px] text-slate-400">{subProduct.materialCode}</div>
                                                                  </>
                                                              ) : (
                                                                  <div className="text-red-500 text-xs flex items-center gap-1 font-medium">
                                                                      <AlertTriangle className="w-3 h-3" />
                                                                      组件已删除 / 请核对
                                                                  </div>
                                                              )}
                                                          </td>
                                                          <td className="px-3 py-2 text-center">
                                                              <input 
                                                                  type="number"
                                                                  min="1"
                                                                  className="w-16 p-1 border border-slate-200 rounded text-center text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                  value={sub.quantity}
                                                                  onFocus={(e) => e.target.select()}
                                                                  onChange={(e) => handleBomSubChange(item.id, sub.id, Number(e.target.value))}
                                                              />
                                                          </td>
                                                          {canViewCost && (
                                                              <td className="px-3 py-2 text-right text-slate-500 text-xs">
                                                                  {subProduct ? `¥${(subProduct.cost || 0) * sub.quantity}` : '-'}
                                                              </td>
                                                          )}
                                                          <td className="px-3 py-2 text-right">
                                                              <button 
                                                                  onClick={() => handleRemoveBomSubItem(item.id, sub.id)}
                                                                  className="text-slate-400 hover:text-red-500 p-1"
                                                                  title="移除此组件"
                                                              >
                                                                  <X className="w-3 h-3" />
                                                              </button>
                                                          </td>
                                                      </tr>
                                                  )
                                              })}
                                          </tbody>
                                      </table>
                                      <div className="bg-indigo-50 px-3 py-2 text-xs flex justify-between items-center text-indigo-700 border-t border-indigo-100">
                                          <span>
                                              当前配置基准单价 = <span className="font-mono font-bold">¥{item.unitPrice}</span>
                                          </span>
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

      {/* Summary and Modals */}
      <div className="flex flex-col gap-6">
          {/* Summary Card */}
          <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl">
              <h3 className="text-lg font-bold mb-6">报价汇总</h3>
              
              <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-slate-400 text-sm">
                      <span>小计 (Subtotal)</span>
                      <span>¥{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-sm">
                      <span>税费 (Tax 9%)</span>
                      <span>¥{tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="h-px bg-slate-700 my-2"></div>
                  <div className="flex justify-between items-end">
                      <span className="text-lg font-bold">总计 (Total)</span>
                      <span className="text-3xl font-bold">¥{total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
              </div>

              {/* Status Selector with Log Display */}
              <div className="mb-6">
                  <label className="text-xs text-slate-500 mb-2 block uppercase font-semibold">
                      {originalQuote ? "更新状态 (原单据)" : "设置报价状态"}
                  </label>
                  <div className="flex bg-slate-800 p-1 rounded-lg">
                      {(['Draft', 'Sent', 'Approved'] as const).map(s => (
                          <button
                              key={s}
                              onClick={() => handleStatusChange(s)}
                              className={`flex-1 py-1.5 text-xs rounded-md transition-all font-medium ${
                                  status === s 
                                  ? 'bg-slate-600 text-white shadow-sm' 
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                          >
                              {s === 'Draft' ? '草稿' : s === 'Sent' ? '已发送' : '已批准/成单'}
                          </button>
                      ))}
                  </div>
                  
                  {/* Status Log Snippet - Showing top 3 */}
                  {originalQuote?.statusLog && originalQuote.statusLog.length > 0 && (
                      <div className="mt-3 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                  <History className="w-3 h-3" /> 变更记录
                              </span>
                              <span className="text-[10px] text-slate-500">最近 3 条</span>
                          </div>
                          <div className="p-2 space-y-2">
                              {originalQuote.statusLog.slice(0, 3).map((log, i) => (
                                  <div key={i} className="relative pl-3 border-l border-slate-700">
                                      <div className={`absolute -left-[3.5px] top-1.5 w-1.5 h-1.5 rounded-full ${
                                          log.status === 'Approved' ? 'bg-emerald-500' : 
                                          log.status === 'Sent' ? 'bg-blue-500' : 'bg-slate-500'
                                      }`}></div>
                                      <div className="flex justify-between items-start text-xs">
                                          <span className="text-slate-300 font-medium">
                                              {log.status === 'Draft' ? '草稿' : log.status === 'Sent' ? '已发送' : '已批准'}
                                          </span>
                                          <span className="text-slate-500 font-mono scale-90 origin-right">
                                              {new Date(log.timestamp).toLocaleDateString()}
                                          </span>
                                      </div>
                                      <div className="flex justify-between items-center mt-0.5">
                                          <span className="text-slate-500 text-[10px] flex items-center gap-1">
                                              <UserIcon className="w-2.5 h-2.5" /> {log.operator}
                                          </span>
                                          <span className="text-slate-600 text-[10px] font-mono">
                                              {new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                          </span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                  <button 
                      onClick={handleSaveQuote}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/30"
                  >
                      {showSaveSuccess ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                      {showSaveSuccess ? '已保存' : '另存为新报价单'}
                  </button>
                  
                  <button 
                      onClick={handleExportExcel}
                      disabled={isExporting}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                  >
                      {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                      导出 Excel
                  </button>

                  <button 
                      onClick={handleExportPDF}
                      disabled={isPdfExporting}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isPdfExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                      导出 PDF
                  </button>
              </div>
          </div>

          {/* AI Analysis Card */}
          <div className="bg-violet-50 rounded-xl p-6 border border-violet-100">
              <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                  <h3 className="font-bold text-slate-800">智能分析</h3>
              </div>
              <div className="text-sm text-slate-600 mb-4 min-h-[40px] leading-relaxed">
                  {aiAnalysis ? (
                      <div className="prose prose-sm prose-violet">{aiAnalysis}</div>
                  ) : (
                      "获取关于追加销售和配置优化的建议。"
                  )}
              </div>
              <button 
                  onClick={handleRunAIAnalysis}
                  disabled={items.length === 0}
                  className="w-full py-2 bg-white border border-violet-200 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-100 transition-colors shadow-sm disabled:opacity-50"
              >
                  {aiAnalysis ? '重新分析' : '分析报价'}
              </button>
          </div>
      </div>

      {showHistoryModal && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
              {/* ... (History Modal Logic Same as Before) ... */}
              <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <History className="w-5 h-5 text-blue-600" />
                          导入历史报价
                      </h3>
                      <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
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
