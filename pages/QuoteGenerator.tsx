
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { QuoteItem, Product, Quote, BOMItem, QuoteStatusLog } from '../types';
import { Plus, Trash2, Printer, Sparkles, FileSpreadsheet, Save, CheckCircle, FileText, History, X, ChevronRight, ChevronDown, Search, Users, CornerDownRight, RefreshCcw, Loader2, AlertTriangle, RotateCcw, Clock, User as UserIcon } from 'lucide-react';
import { analyzeQuote } from '../services/geminiService';
import { useLocation } from 'react-router-dom';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// 工具函数：数字转中文大写金额
const digitToChinese = (n: number) => {
    const fraction = ['角', '分'];
    const digit = [
        '零', '壹', '贰', '叁', '肆',
        '伍', '陆', '柒', '捌', '玖'
    ];
    const unit = [
        ['元', '万', '亿'],
        ['', '拾', '佰', '仟']
    ];
    const head = n < 0 ? '欠' : '';
    n = Math.abs(n);
    let s = '';
    for (let i = 0; i < fraction.length; i++) {
        s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
    }
    s = s || '整';
    n = Math.floor(n);
    for (let i = 0; i < unit[0].length && n > 0; i++) {
        let p = '';
        for (let j = 0; j < unit[1].length && n > 0; j++) {
            p = digit[n % 10] + unit[1][j] + p;
            n = Math.floor(n / 10);
        }
        s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
    }
    return head + s.replace(/(零.)*零元/, '元')
        .replace(/(零.)+/g, '零')
        .replace(/^整$/, '零元整');
};

const QuoteGenerator = () => {
  // 从 Store 获取 categories 用于排序逻辑
  const { products, addQuote, updateQuote, boms, productBoms, quotes, currentUser, templateSettings, types, categories } = useStore();
  const location = useLocation();

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '示例企业有限公司', email: 'contact@example.com' });
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Approved'>('Draft');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');

  // 编辑状态管理
  const [originalQuote, setOriginalQuote] = useState<Quote | null>(null);

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const printRef = useRef<HTMLDivElement>(null);

  // 权限检查：非销售角色可见成本
  const canViewCost = currentUser?.role !== 2; 

  useEffect(() => {
    if (location.state?.quoteData) {
        const incomeQuote = location.state.quoteData as Quote;
        loadQuoteIntoEditor(incomeQuote);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  // 加载报价单到编辑器
  const loadQuoteIntoEditor = (quote: Quote) => {
      setOriginalQuote(quote); 
      
      const newItems = quote.items.map(item => ({
          ...item,
          id: Date.now() + Math.random(), // 确保编辑器内 ID 唯一
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
      setStatus(quote.status); 
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

  // 递归计算 BOM 树总价
  const calculateBOMTotal = (bomItems: BOMItem[], field: 'cost' | 'basePrice'): number => {
    let total = 0;
    bomItems.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        total += (p[field] || 0) * item.quantity;
        if (item.children) {
          total += calculateBOMTotal(item.children, field);
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
    
    const selId = Number(selectedItem);
    const product = products.find(p => p.id === selId);
    const auxBom = boms.find(b => b.id === selId);

    const defaultMargin = 10; // 默认利润率

    if (auxBom) {
      const bomSnapshot = JSON.parse(JSON.stringify(auxBom.items));
      // 辅助 BOM：使用基准价总和作为单价
      const price = calculateBOMTotal(bomSnapshot, 'basePrice');
      
      const newItem: QuoteItem = {
        id: Date.now(),
        productId: auxBom.id,
        quantity: 1,
        unitPrice: price,
        margin: defaultMargin,
        total: price * (1 + defaultMargin / 100),
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
        margin: defaultMargin,
        total: price * (1 + defaultMargin / 100),
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
          const newUnitPrice = calculateBOMTotal(newBomConfig, 'basePrice');
          
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
          const newUnitPrice = calculateBOMTotal(newBomConfig, 'basePrice');
          
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

  const handleStatusChange = async (newStatus: 'Draft' | 'Sent' | 'Approved') => {
      if (originalQuote) {
          const newLogEntry: QuoteStatusLog = {
              status: newStatus,
              timestamp: new Date().toISOString(),
              operator: currentUser?.name || 'Unknown User'
          };

          const currentLogs = originalQuote.statusLog || [];
          const updatedLogs = [newLogEntry, ...currentLogs].slice(0, 20);

          const updatedQuote: Quote = {
              ...originalQuote,
              status: newStatus,
              statusLog: updatedLogs
          };
          
          updateQuote(updatedQuote);
          setOriginalQuote(updatedQuote); 
          setStatus(newStatus); 
          
          setShowSaveSuccess(true);
          setTimeout(() => setShowSaveSuccess(false), 2000);
      } else {
          setStatus(newStatus);
      }
  };

  const handleSaveQuote = () => {
    if (items.length === 0) {
      alert("请先添加产品再保存。");
      return;
    }
    
    const newQuote: Quote = {
      id: Date.now(),
      customerName: customerInfo.name,
      date: new Date().toISOString(), 
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

  // --- 核心：分组与排序逻辑 ---
  const groupedData = useMemo(() => {
    const groupedItems: Record<string, { items: any[], total: number }> = {};

    items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const auxBom = boms.find(b => b.id === item.productId);
        
        // 分类优先级: 产品分类 > BOM分类 > 默认
        const category = product?.category || auxBom?.category || (auxBom ? '系统集成/BOM' : '其他');
        
        if (!groupedItems[category]) {
            groupedItems[category] = { items: [], total: 0 };
        }
        
        const imageUrl = product?.baseImage || auxBom?.baseImage;
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

    // --- 排序算法 (Sorting Logic) ---
    // 1. 获取全局定义的分类顺序 (从 CategoryManager 获取)
    const definedOrder = categories.map(c => c.name);
    // 2. 获取当前报价单实际用到的分类
    const usedCategories = Object.keys(groupedItems);
    
    // 3. 排序：如果在全局列表中，按其索引排序；否则按拼音/字符顺序
    const sortedCategories = usedCategories.sort((a, b) => {
        const idxA = definedOrder.indexOf(a);
        const idxB = definedOrder.indexOf(b);
        
        // 都在列表中，比较索引
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        
        // 只有 A 在列表中，A 优先
        if (idxA !== -1) return -1;
        // 只有 B 在列表中，B 优先
        if (idxB !== -1) return 1;
        
        // 都不在列表中，按名称排序 (支持中文拼音)
        return a.localeCompare(b, 'zh-CN');
    });

    return { groupedItems, categoryOrder: sortedCategories };
  }, [items, products, boms, categories]); // 依赖 categories 确保拖动排序后生效

  // --- 导出功能 ---
  
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

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
        const { quote: tpl } = templateSettings;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Quote');
        
        // 设置列宽
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

        const headerRow = sheet.addRow(['序号', '图片', '产品名称', '规格/型号', '单位', '数量', '单价 (¥)', '金额 (¥)', '备注']);
        
        for (let i = 1; i <= 9; i++) {
            const cell = headerRow.getCell(i);
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; 
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        }
        headerRow.height = 25;

        // 使用已排序的 categoryOrder
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
                const sellingUnitPrice = item.unitPrice * (1 + (item.margin || 0) / 100);

                const row = sheet.addRow([
                    globalIndex++,
                    '', 
                    item.name,
                    item.spec,
                    item.unit,
                    item.quantity,
                    sellingUnitPrice, 
                    item.total,
                    item.description || '' 
                ]);
                
                row.height = 60; 
                row.alignment = { vertical: 'middle', wrapText: true };
                row.getCell(7).numFmt = '#,##0.000'; 
                row.getCell(8).numFmt = '#,##0.000'; 

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
            subtotalRow.getCell(8).numFmt = '#,##0.000';
            subtotalRow.getCell(8).font = { bold: true, color: { argb: 'FF059669' } }; 
            subtotalRow.height = 25;
            sheet.mergeCells(`A${subtotalRow.number}:F${subtotalRow.number}`);
        }

        sheet.addRow([]);
        
        const subRow = sheet.addRow(['', '', '', '', '', '', '合计 (Subtotal):', subtotal, '']);
        subRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        subRow.getCell(8).numFmt = '¥#,##0.000';
        subRow.font = { bold: true };

        const taxRow = sheet.addRow(['', '', '', '', '', '', `税费 (Tax ${(tax/subtotal*100).toFixed(4)}%):`, tax, '']);
        taxRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        taxRow.getCell(8).numFmt = '¥#,##0.000';
        taxRow.font = { color: { argb: 'FF64748B' } }; 

        const totalRow = sheet.addRow(['', '', '', '', '', '', '总计 (Grand Total):', total, '']);
        totalRow.height = 30;
        totalRow.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
        totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        totalRow.getCell(8).alignment = { vertical: 'middle' };
        totalRow.getCell(8).numFmt = '¥#,##0.000';
        
        sheet.addRow([]);
        sheet.addRow(['报价汇总表']).font = { bold: true, size: 12 };
        const summaryHeader = sheet.addRow(['分类名称', '分类金额 (CNY)']);
        summaryHeader.font = { bold: true };
        summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        summaryHeader.getCell(1).border = { bottom: {style:'thin'} };
        summaryHeader.getCell(2).border = { bottom: {style:'thin'} };

        // 汇总表也遵循排序
        categoryOrder.forEach((cat, i) => {
             const sumRow = sheet.addRow([`（${chineseNumerals[i]||(i+1)}） ${cat}`, groupedItems[cat].total]);
             sumRow.getCell(2).numFmt = '#,##0.000';
        });
        const finalSumRow = sheet.addRow(['项目总价', subtotal]);
        finalSumRow.font = { bold: true };
        finalSumRow.getCell(2).numFmt = '¥#,##0.000';

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

  const handleExportNativePDF = async () => {
      setIsPdfExporting(true);
      setPdfProgress('加载资源...');
      
      try {
          const doc = new jsPDF();
          let fontName = 'helvetica'; // 默认字体

          // 1. 加载中文字体 (Alibaba PuHuiTi)
          const fontUrls = [
              '/Alibaba-PuHuiTi-Regular.ttf', // 优先本地
              'https://static.heytea.com/font/Alibaba-PuHuiTi-Regular.ttf', // CDN 1
              'https://cdn.jsdelivr.net/gh/staticcdn/font/Alibaba-PuHuiTi-Regular.ttf' // CDN 2
          ];

          let fontBytes: ArrayBuffer | null = null;

          for (const url of fontUrls) {
              try {
                  setPdfProgress(`加载字体 (${url.includes('/') ? (url.startsWith('http') ? 'CDN' : '本地') : '...'})`);
                  const response = await fetch(url);
                  if (response.ok) {
                      fontBytes = await response.arrayBuffer();
                      console.log(`Font loaded successfully from: ${url}`);
                      break; 
                  }
              } catch (e) {
                  console.warn(`Font load failed from ${url}`, e);
              }
          }

          if (fontBytes) {
              const fontBase64 = arrayBufferToBase64(fontBytes);
              // 必须同时注册 normal 和 bold，防止 autotable 计算宽度时报错
              doc.addFileToVFS('Alibaba-PuHuiTi-Regular.ttf', fontBase64);
              doc.addFont('Alibaba-PuHuiTi-Regular.ttf', 'AlibabaPuHuiTi', 'normal');
              doc.addFont('Alibaba-PuHuiTi-Regular.ttf', 'AlibabaPuHuiTi', 'bold'); 
              fontName = 'AlibabaPuHuiTi';
          } else {
              alert("⚠️ 警告：无法加载中文字体文件。\n\n请手动下载 'Alibaba-PuHuiTi-Regular.ttf' 并放入项目的 public 文件夹中以支持中文显示。");
          }
          
          doc.setFont(fontName);

          const getImageData = async (url: string): Promise<{ base64: string, format: string } | null> => {
              const res = await fetchImageAsBuffer(url);
              return res ? { base64: res.base64, format: res.extension.toUpperCase() } : null;
          };

          const tpl = templateSettings.quote;
          const leftMargin = 14;
          const rightMargin = 196; // A4 width 210 - 14
          
          setPdfProgress('生成头部...');

          // 2. 头部内容 (Header)
          if (tpl.companyLogo) {
              const logoData = await fetchImageAsBuffer(tpl.companyLogo);
              if (logoData) {
                  doc.addImage(logoData.base64, logoData.extension.toUpperCase(), leftMargin, 10, 40, 15, undefined, 'FAST');
              }
          }

          doc.setFontSize(22);
          doc.setTextColor(40, 40, 40);
          doc.text(tpl.title, 200, 20, { align: 'right' });

          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(tpl.companyName, 200, 26, { align: 'right' });

          doc.setLineWidth(0.5);
          doc.setDrawColor(200, 200, 200);
          doc.line(leftMargin, 35, 200, 35);

          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          let yPos = 45;
          
          doc.text(`客户名称: ${customerInfo.name}`, leftMargin, yPos);
          doc.text(`联系邮箱: ${customerInfo.email}`, leftMargin, yPos + 6);
          
          const quoteDate = originalQuote ? new Date(originalQuote.date).toLocaleDateString() : new Date().toLocaleDateString();
          const quoteId = originalQuote ? `Q-${originalQuote.id}` : `Q-${Date.now().toString().slice(-6)}`;
          
          doc.text(`报价日期: ${quoteDate}`, 140, yPos);
          doc.text(`报价单号: ${quoteId}`, 140, yPos + 6);
          doc.text(`有效期至: ${new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString()}`, 140, yPos + 12); // 有效期 7 天

          yPos += 20;

          // 3. 表格内容
          setPdfProgress('生成表格...');
          // 使用已排序的 categoryOrder
          const { groupedItems, categoryOrder } = groupedData;
          let globalIndex = 1;

          // 预取图片
          const imageMap: Record<number, {base64: string, format: string} | null> = {};
          for (const item of items) {
              const product = products.find(p => p.id === item.productId);
              const auxBom = boms.find(b => b.id === item.productId);
              const imgUrl = product?.baseImage || auxBom?.baseImage;
              if (imgUrl) {
                  imageMap[item.id] = await getImageData(imgUrl);
              }
          }

          const tableBody: any[] = [];
          
          for (let i = 0; i < categoryOrder.length; i++) {
              const cat = categoryOrder[i];
              const group = groupedItems[cat];
              
              // 分类标题行
              tableBody.push([{
                  content: `（${chineseNumerals[i]||(i+1)}） ${cat}`,
                  colSpan: 9,
                  styles: { 
                      fillColor: [241, 245, 249], 
                      fontStyle: 'bold', 
                      textColor: [30, 41, 59],
                      halign: 'left'
                  }
              }]);

              // 明细行
              for (const item of group.items) {
                  const sellingUnitPrice = item.unitPrice * (1 + (item.margin || 0) / 100);
                  const imgData = imageMap[item.id];
                  
                  tableBody.push([
                      globalIndex++,
                      imgData ? '' : '-', 
                      { content: item.name + (item.bomConfig ? `\n(含${item.bomConfig.length}个组件)` : ''), styles: { minCellHeight: 15 } },
                      item.spec,
                      item.unit,
                      item.quantity,
                      `¥${sellingUnitPrice.toLocaleString()}`,
                      `¥${item.total.toLocaleString()}`,
                      item.description || ''
                  ]);
              }

              // 小计行
              tableBody.push([
                  { 
                      content: '', 
                      colSpan: 6, 
                      styles: { 
                          fillColor: [255, 255, 255], 
                          lineWidth: 0.1,
                          lineColor: [200, 200, 200] 
                      } 
                  },
                  { content: '本项小计:', colSpan: 1, styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250], lineWidth: 0.1, lineColor: [200, 200, 200] } },
                  { content: `¥${group.total.toLocaleString()}`, colSpan: 2, styles: { fontStyle: 'bold', textColor: [5, 150, 105], fillColor: [250, 250, 250], lineWidth: 0.1, lineColor: [200, 200, 200] } }
              ]);
          }

          autoTable(doc, {
              startY: yPos,
              head: [['序号', '图片', '产品名称', '规格/型号', '单位', '数量', '单价', '金额', '备注']],
              body: tableBody,
              theme: 'grid',
              styles: {
                  font: fontName, 
                  fontSize: 8,
                  cellPadding: 2,
                  valign: 'middle',
                  lineWidth: 0.1,
                  lineColor: [200, 200, 200]
              },
              headStyles: {
                  fillColor: [79, 70, 229], // Blue-600
                  textColor: 255,
                  fontStyle: 'bold'
              },
              columns: [
                  { header: '序号', dataKey: 'id' },
                  { header: '图片', dataKey: 'img' },
                  { header: '产品名称', dataKey: 'name' },
                  { header: '规格/型号', dataKey: 'spec' },
                  { header: '单位', dataKey: 'unit' },
                  { header: '数量', dataKey: 'qty' },
                  { header: '单价', dataKey: 'price' },
                  { header: '金额', dataKey: 'total' },
                  { header: '备注', dataKey: 'remark' }
              ],
              columnStyles: {
                  0: { cellWidth: 10, halign: 'center' },
                  1: { cellWidth: 15, minCellHeight: 15 },
                  2: { cellWidth: 'auto', fontStyle: 'bold' }, 
                  3: { cellWidth: 25, fontStyle: 'bold' },
                  4: { cellWidth: 12, halign: 'center' },
                  5: { cellWidth: 12, halign: 'center' },
                  6: { cellWidth: 20, halign: 'right' },
                  7: { cellWidth: 20, halign: 'right' },
                  8: { cellWidth: 25 }
              },
              // 待实现：图片绘制逻辑 (略，防止字体崩溃)
          });

          // 4. 汇总与页脚
          let currentY = (doc as any).lastAutoTable.finalY + 10;
          if (currentY > 250) { doc.addPage(); currentY = 20; }

          doc.setFontSize(10);
          doc.text('报价汇总表', leftMargin, currentY);
          currentY += 5;
          
          const summaryBody = categoryOrder.map((cat, i) => [
              `（${chineseNumerals[i]||(i+1)}） ${cat}`,
              `¥${groupedData.groupedItems[cat].total.toLocaleString(undefined, {minimumFractionDigits: 4})}`
          ]);
          summaryBody.push(['项目总价', `¥${subtotal.toLocaleString(undefined, {minimumFractionDigits: 4})}`]);
          summaryBody.push(['税费 (9%)', `¥${tax.toLocaleString(undefined, {minimumFractionDigits: 4})}`]);
          summaryBody.push(['总计', `¥${total.toLocaleString(undefined, {minimumFractionDigits: 4})}`]);
          summaryBody.push(['大写金额', digitToChinese(total)]);

          autoTable(doc, {
              startY: currentY,
              head: [['分类名称', '分类金额 (CNY)']],
              body: summaryBody,
              theme: 'grid',
              styles: { 
                  font: fontName, 
                  fontSize: 9,
                  lineColor: [200, 200, 200],
                  lineWidth: 0.1,
                  cellPadding: 3
              },
              headStyles: {
                  fillColor: [241, 245, 249], 
                  textColor: [51, 65, 85], 
                  fontStyle: 'bold',
                  lineWidth: 0.1,
                  lineColor: [200, 200, 200]
              },
              columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 100, halign: 'right' } },
              didParseCell: (data) => {
                  // 总计行高亮
                  if (data.section === 'body' && data.row.index === summaryBody.length - 2) {
                      data.cell.styles.fontStyle = 'bold';
                      data.cell.styles.textColor = [220, 38, 38]; // Red
                      data.cell.styles.fontSize = 10;
                  }
                  // 大写金额行
                  if (data.section === 'body' && data.row.index === summaryBody.length - 1) {
                      data.cell.styles.fontStyle = 'bold';
                      if(data.column.index === 1) data.cell.styles.halign = 'left'; 
                  }
              },
              margin: { left: leftMargin }
          });

          currentY = (doc as any).lastAutoTable.finalY + 20;
          if (currentY > 260) { doc.addPage(); currentY = 20; }
          
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.text('条款与备注:', leftMargin, currentY);
          
          const splitTerms = doc.splitTextToSize(templateSettings.quote.terms, 180);
          doc.text(splitTerms, leftMargin, currentY + 5);

          // 保存文件
          doc.save(`报价单_${customerInfo.name}_${new Date().toISOString().slice(0,10)}.pdf`);

      } catch (error) {
          console.error("PDF Generation Error", error);
          alert("PDF 生成失败，请重试。\n错误详情: " + (error instanceof Error ? error.message : String(error)));
      } finally {
          setIsPdfExporting(false);
          setPdfProgress('');
      }
  };

  function arrayBufferToBase64(buffer: ArrayBuffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
  }

  const filteredQuotes = quotes.filter(q => {
      const matchId = String(q.id).includes(searchId);
      const matchCustomer = q.customerName.toLowerCase().includes(searchCustomer.toLowerCase());
      return matchId && matchCustomer;
  });

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      <div className="absolute top-0 left-[-9999px] overflow-hidden">
          <div ref={printRef} className="w-[794px] min-h-[1123px] bg-white p-12 text-slate-800 font-sans relative">
              <div className="flex items-end justify-between mb-8 border-b-2 border-slate-800 pb-4">
                  <div className="flex items-center gap-6">
                      {templateSettings.quote.companyLogo && (
                          <img src={templateSettings.quote.companyLogo} alt="Logo" className="h-16 max-w-[200px] object-contain" />
                      )}
                      <h1 className="text-4xl font-bold tracking-widest text-slate-900 leading-none">{templateSettings.quote.title}</h1>
                  </div>
                  <div className="mb-1 text-right">
                       <p className="text-xl font-bold text-slate-500">{templateSettings.quote.companyName}</p>
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
                      <p className="mb-1"><span className="font-bold">有效期至：</span> {new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString()}</p>
                  </div>
              </div>
              
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
                                      {group.items.map((item, idx) => {
                                          const sellingUnitPrice = item.unitPrice * (1 + (item.margin || 0) / 100);
                                          return (
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
                                              <td className="p-2 border border-slate-200 text-right">¥{sellingUnitPrice.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 4})}</td>
                                              <td className="p-2 border border-slate-200 text-right">¥{item.total.toLocaleString()}</td>
                                              <td className="p-2 border border-slate-200 text-slate-500">{item.description}</td>
                                          </tr>
                                      )})}
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
                              <tr className="bg-slate-5 font-bold">
                                  <td className="p-2">项目总价</td>
                                  <td className="p-2 text-right">¥{subtotal.toLocaleString()}</td>
                              </tr>
                              <tr>
                                  <td className="p-2">税费 (9%)</td>
                                  <td className="p-2 text-right">¥{tax.toLocaleString()}</td>
                              </tr>
                              <tr className="bg-slate-50 font-bold text-red-600">
                                  <td className="p-2">总计</td>
                                  <td className="p-2 text-right">¥{total.toLocaleString()}</td>
                              </tr>
                              <tr>
                                  <td className="p-2 font-bold">大写金额</td>
                                  <td className="p-2 text-right">{digitToChinese(total)}</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>

              <div className="mt-auto border-t border-slate-200 pt-6 text-xs text-slate-500">
                  <p className="font-bold mb-1">条款与备注：</p>
                  <p className="whitespace-pre-wrap">{templateSettings.quote.terms}</p>
              </div>
          </div>
      </div>

      <div className="lg:col-span-2 flex flex-col gap-6">
        {/* ... (Existing UI Code remains unchanged) ... */}
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

        {/* ... (Rest of Form UI) ... */}
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
                                <p className="font-semibold text-slate-800 py-1">¥{item.total.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 4})}</p>
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
                                          <thead className="bg-slate-50 border-b border-slate-200">
                                              <tr>
                                                  <th className="px-4 py-2 font-medium text-slate-500">组件名称</th>
                                                  <th className="px-4 py-2 font-medium text-slate-500 text-center">用量</th>
                                                  <th className="px-4 py-2 font-medium text-slate-500 text-right">单价 (基准)</th>
                                                  <th className="px-4 py-2 font-medium text-slate-500 text-right">操作</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              {item.bomConfig.map(sub => {
                                                  const subProduct = products.find(p => p.id === sub.productId);
                                                  return (
                                                      <tr key={sub.id}>
                                                          <td className="px-4 py-2 text-slate-700">{subProduct?.name || `Unknown (${sub.productId})`}</td>
                                                          <td className="px-4 py-2 text-center">
                                                              <input 
                                                                  type="number" 
                                                                  min="1"
                                                                  className="w-16 p-1 border border-slate-200 rounded text-center text-xs"
                                                                  value={sub.quantity}
                                                                  onChange={(e) => handleBomSubChange(item.id, sub.id, Number(e.target.value))}
                                                              />
                                                          </td>
                                                          <td className="px-4 py-2 text-right text-slate-600">¥{(subProduct?.basePrice || 0).toLocaleString()}</td>
                                                          <td className="px-4 py-2 text-right">
                                                              <button onClick={() => handleRemoveBomSubItem(item.id, sub.id)} className="text-slate-400 hover:text-red-500">
                                                                  <Trash2 className="w-3 h-3" />
                                                              </button>
                                                          </td>
                                                      </tr>
                                                  )
                                              })}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          )}
                      </div>
                    )
                  })}
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Summary Sidebar (Right Column) */}
      <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">报价汇总</h3>
              <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                      <span>项目小计</span>
                      <span>¥{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                      <span>税费 (9%)</span>
                      <span>¥{tax.toLocaleString()}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="font-bold text-slate-800 text-lg">总计</span>
                      <span className="font-bold text-blue-600 text-2xl">¥{total.toLocaleString()}</span>
                  </div>
              </div>

              <div className="mt-6 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleStatusChange('Draft')}
                        className={`py-2 rounded-lg text-sm font-medium border ${status === 'Draft' ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        草稿
                    </button>
                    <button 
                        onClick={() => handleStatusChange('Sent')}
                        className={`py-2 rounded-lg text-sm font-medium border ${status === 'Sent' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        已发送
                    </button>
                    <button 
                        onClick={() => handleStatusChange('Approved')}
                        className={`col-span-2 py-2 rounded-lg text-sm font-medium border ${status === 'Approved' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        已批准 (Approved)
                    </button>
                  </div>

                  <button 
                      onClick={handleSaveQuote}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                      {showSaveSuccess ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                      {showSaveSuccess ? '保存成功' : '保存报价单'}
                  </button>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                          onClick={handleExportExcel}
                          disabled={isExporting}
                          className="flex items-center justify-center gap-2 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-green-600 transition-colors"
                      >
                          {isExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4" />}
                          导出 Excel
                      </button>
                      <button 
                          onClick={handleExportNativePDF}
                          disabled={isPdfExporting}
                          className="flex items-center justify-center gap-2 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors"
                      >
                          {isPdfExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4" />}
                          {isPdfExporting && pdfProgress ? pdfProgress : '原生 PDF'}
                      </button>
                  </div>
              </div>
          </div>

          {/* AI Analysis Card */}
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
              <Sparkles className="w-32 h-32 text-white opacity-10 absolute -right-6 -bottom-6 rotate-12" />
              <div className="relative z-10">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" /> 分析
                  </h3>
                  <p className="text-indigo-100 text-sm mb-4">
                      让 AI 助手分析当前报价结构
                  </p>
                  {aiAnalysis ? (
                      <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 text-sm border border-white/20">
                          {aiAnalysis}
                      </div>
                  ) : (
                      <button 
                          onClick={handleRunAIAnalysis}
                          className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm"
                      >
                          开始分析
                      </button>
                  )}
              </div>
          </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="font-bold text-slate-800">导入历史报价</h3>
                    <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 border-b border-slate-200 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input 
                            type="text" 
                            placeholder="搜索客户名称..." 
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
                            value={searchCustomer}
                            onChange={e => setSearchCustomer(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filteredQuotes.map(q => (
                        <div 
                            key={q.id}
                            onClick={() => {
                                loadQuoteIntoEditor(q);
                                setShowHistoryModal(false);
                            }}
                            className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                            <div>
                                <div className="font-medium text-slate-800">{q.customerName}</div>
                                <div className="text-xs text-slate-500 flex gap-2 mt-1">
                                    <span>{new Date(q.date).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>ID: {q.id}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-slate-700">¥{q.grandTotal.toLocaleString()}</div>
                                <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                                    q.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {q.status}
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredQuotes.length === 0 && (
                        <div className="text-center py-8 text-slate-400">未找到相关报价单</div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default QuoteGenerator;
