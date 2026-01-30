
// Dynamic Type Definition (动态类型定义)
export interface ProductTypeDefinition {
  id: number;    // 类型唯一标识符 (Type ID)
  name: string;  // 类型名称 (Type Name, e.g., 成品, 零件)
  level: number; // 层级 (Level: 1=顶层/销售, 2=成品, 3=组件, 4=零件)
  color: string; // UI 显示颜色 (Badge Color)
}

// Product Document (产品文档/附件)
export interface ProductDocument {
  id: string | number; // 文档唯一标识 (ID, support both numeric and UUID)
  name: string;        // 文件名 (File Name)
  url: string;         // 文件地址 (URL path or Base64)
  type: string;        // MIME 类型 (File Type, e.g., application/pdf)
  size: number;        // 文件大小 (Size in Bytes)
  uploadDate: string;  // 上传时间 (ISO Date String)
}

// Product (产品主数据)
export interface Product {
  id: number;           // 产品唯一标识符 (ID)
  materialCode: string; // 物料编码 (Material Code, ERP Code)
  unit: string;         // 计量单位 (Unit, e.g., 个, 套, m)
  name: string;         // 产品名称 (Product Name)
  description: string;  // 产品详细描述 (Description / Marketing Text)
  specifications?: string; // 规格型号 (Technical Specifications)
  type: number;         // 产品类型 ID (Type ID, 关联 ProductTypeDefinition)
  cost: number;         // 成本价 (Cost Price)
  
  basePrice: number;    // 基准销售价 (Base Selling Price)
  inventory: number;    // 库存数量 (Inventory Count)
  category: string;     // 产品子分类 (Sub-category, e.g., 电子, 结构)
  
  baseImage?: string;   // 产品主图 (Main Image, Base64 or URL)
  
  galleryImages?: ProductDocument[]; // 产品相册集 (Additional Images)
  documents?: ProductDocument[];     // 相关文档 (Related Documents: PDFs, Specs)
}

// BOM Item (物料清单子项)
export interface BOMItem {
  id: number;        // 节点唯一标识 (Node ID)
  productId: number; // 关联产品 ID (Product ID)
  quantity: number;  // 用量/数量 (Quantity)
  children?: BOMItem[]; // 子级结构 (Recursion for multi-level BOM)
}

// Auxiliary BOM Structure (独立/辅助 BOM 结构定义) - Table: boms
export interface BOMStructure {
  id: number;             // BOM 结构 ID
  name: string;           // BOM 配置名称 (Configuration Name)
  items: BOMItem[];       // 顶层子项列表 (Top-level Items)
  specifications?: string; // 规格型号 (Technical Specifications)
  description?: string;    // 详细描述 (Detailed Description)
  category?: string;       // 分类 (Subclass / Category)
}

// Product BOM (产品绑定 BOM) - Table: product_boms
export interface ProductBOM {
    productId: number;    // 关联的产品 ID (Foreign Key to Product)
    items: BOMItem[];     // BOM 结构
}

// Quote Item (报价单行项目)
export interface QuoteItem {
  id: number;        // 行项目 ID (Line Item ID)
  productId: number; // 产品 ID 或 BOM ID (Product or BOM ID)
  quantity: number;  // 销售数量 (Quantity)
  unitPrice: number; // 单价 (Unit Price)
  margin: number;    // 利润率百分比 (Margin Percentage)
  total: number;     // 行总价 (Total Price)
  
  bomConfig?: BOMItem[]; // 定制的 BOM 配置快照 (Custom BOM Snapshot)
}

// Status Change Log (状态变更日志)
export interface QuoteStatusLog {
    status: 'Draft' | 'Sent' | 'Approved';
    timestamp: string;
    operator: string;
}

// Quote (报价单)
export interface Quote {
  id: number;            // 报价单号 (Quote ID)
  customerName: string;  // 客户名称 (Customer Name)
  date: string;          // 报价日期 (Date)
  status: 'Draft' | 'Sent' | 'Approved'; // 状态 (Status)
  statusLog?: QuoteStatusLog[]; // 状态变更记录
  items: QuoteItem[];    // 报价项目列表 (Line Items)
  subtotal: number;      // 小计 (Subtotal before tax)
  tax: number;           // 税费 (Tax)
  grandTotal: number;    // 总金额 (Grand Total)
}

// --- Excel Template Settings (Excel 模板配置) ---
export interface TemplateSettings {
    quote: {
        title: string;           // 报价单标题 (Document Title)
        companyName: string;     // 卖方公司名称 (Seller Company)
        companyAddress: string;  // 卖方地址 (Seller Address)
        companyContact: string;  // 卖方联系方式 (Seller Contact)
        terms: string;           // 条款与条件 (Terms & Conditions)
        companyLogo?: string;    // 公司图标 Base64 (Company Logo)
        templateFileBase64?: string; // 自定义模板文件内容 (Custom Template File Base64)
        templateFileName?: string;   // 自定义模板文件名 (Custom Template Filename)
    };
    production: {
        title: string;           // 生产单标题 (Document Title)
        templateFileBase64?: string; // 自定义模板文件内容
        templateFileName?: string;   // 自定义模板文件名
    };
}

// --- Auth & Permission Types (权限与认证类型) ---

export type ResourceKey = 'dashboard' | 'products' | 'types' | 'bom' | 'quotes' | 'production' | 'templates' | 'users' | 'settings';
export type ActionKey = 'view' | 'create' | 'edit' | 'delete' | 'view_cost' | 'export';

export interface Permission {
    resource: ResourceKey; // 资源模块 (Resource)
    actions: ActionKey[];  // 允许的操作 (Allowed Actions)
}

// Role Definition (角色定义)
export interface RoleDefinition {
    id: number;      // 角色 ID
    name: string;    // 角色名称 (Role Name)
    description: string; // 角色描述 (Description)
    isSystem: boolean;   // 是否为系统预置角色 (Is System Default)
    permissions: Partial<Record<ResourceKey, ActionKey[]>>; // 权限表 (Permission Map)
}

export type Role = number; // Role ID alias
export type AuthProvider = 'local' | 'google' | 'microsoft' | 'github';

// User (用户)
export interface User {
    id: number;          // 用户 ID
    employeeId?: string; // 工号 (Employee ID)
    username: string;    // 用户名 (Login Username)
    email?: string;      // 邮箱 (Email Address)
    name: string;        // 真实姓名 (Full Name)
    password?: string;   // 密码哈希 (Password Hash, optional on client)
    role: number;        // 角色 ID (Role ID)
    avatar?: string;     // 头像 URL (Avatar URL)
    title?: string;      // 职位 (Job Title)
    department?: string; // 部门 (Department)
    authProvider: AuthProvider; // 认证提供商 (Auth Provider)
    lastLogin?: string;  // 最后登录时间 (Last Login Date)
    
    customPermissions?: string[]; // 自定义权限 (Extensible)
}

export interface RolePermission {
    role: number;
    allowedPaths: string[]; 
}
