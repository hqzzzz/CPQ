// Dynamic Type Definition
export interface ProductTypeDefinition {
  id: string;
  name: string;
  level: number; // 1: Top (Product), 2: Middle (Component), 3: Bottom (Part)
  color: string; // For UI badges
}

export interface ProductDocument {
  id: string;
  name: string;
  url: string; // Base64 or URL
  type: string; // MIME type
  size: number; // Bytes
  uploadDate: string;
}

export interface Product {
  id: string;
  materialCode: string; // Renamed from SKU
  unit: string;         // New field (User referred to this as SKU/Unit)
  name: string;
  description: string;
  specifications?: string;
  type: string;         // Now a string referencing ProductTypeDefinition.name
  cost: number;
  basePrice: number;
  inventory: number;
  category: string;
  imageUrl?: string;    // Main thumbnail
  
  // New Fields
  galleryImages?: string[]; // Array of image URLs/Base64
  documents?: ProductDocument[]; // Array of attached documents
}

export interface BOMItem {
  id: string;
  productId: string;
  quantity: number;
  children?: BOMItem[];
}

export interface BOMStructure {
  id: string;
  rootProductId?: string; // Made optional for standalone auxiliary BOMs
  name: string;
  items: BOMItem[];
}

export interface QuoteItem {
  id: string;
  productId: string; // Can be Product ID or BOM ID
  quantity: number;
  unitPrice: number;
  margin: number; // Percentage (Profit margin added to base price)
  total: number;
  
  // New: Store a customized snapshot of the BOM for this specific quote item
  // This allows changing component quantities in a quote without affecting the master BOM
  bomConfig?: BOMItem[]; 
}

export interface Quote {
  id: string;
  customerName: string;
  date: string;
  status: 'Draft' | 'Sent' | 'Approved';
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  grandTotal: number;
}

// --- Excel Template Settings ---
export interface TemplateSettings {
    quote: {
        // Legacy fields kept for text replacement mapping
        title: string;
        companyName: string;
        companyAddress: string;
        companyContact: string;
        terms: string; 
        
        // New: Custom Excel Template (Base64)
        templateFileBase64?: string;
        templateFileName?: string;
    };
    production: {
        title: string;
        templateFileBase64?: string;
        templateFileName?: string;
    };
}

// --- Auth & Permission Types ---

export type ResourceKey = 'dashboard' | 'products' | 'types' | 'bom' | 'quotes' | 'production' | 'templates' | 'users' | 'settings';
export type ActionKey = 'view' | 'create' | 'edit' | 'delete' | 'view_cost' | 'export';

export interface Permission {
    resource: ResourceKey;
    actions: ActionKey[];
}

export interface RoleDefinition {
    id: string;
    name: string;
    description: string;
    isSystem: boolean; // Cannot be deleted if true
    permissions: Partial<Record<ResourceKey, ActionKey[]>>;
}

// Deprecated simple Role string, kept for migration logic, but UI should use RoleDefinition.id
export type Role = string; 
export type AuthProvider = 'local' | 'google' | 'microsoft' | 'github';

export interface User {
    id: string;
    employeeId?: string; 
    username: string;
    email?: string;      
    name: string;
    password?: string;   
    role: string; // Stores the RoleDefinition ID (e.g., 'admin', 'role-123')
    avatar?: string;
    title?: string;
    department?: string; 
    authProvider: AuthProvider; 
    lastLogin?: string;  
    
    // Legacy support field, can be removed in future if fully migrated to role-based system
    customPermissions?: string[]; 
}

// Deprecated: RolePermission (We now use RoleDefinition)
export interface RolePermission {
    role: string;
    allowedPaths: string[]; 
}