

import { Product, ProductTypeDefinition, BOMStructure, Quote, RoleDefinition } from './types';

export const INITIAL_TYPES: ProductTypeDefinition[] = [
  { id: 1, name: '销售套餐', level: 1, color: 'purple' },
  { id: 2, name: '成品', level: 2, color: 'blue' },
  { id: 3, name: '组件', level: 3, color: 'amber' },
  { id: 4, name: '零件', level: 4, color: 'slate' }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 100,
    materialCode: 'SOL-DATACENTER-01',
    unit: '套',
    name: '高性能数据中心解决方案',
    description: '包含服务器与基础软件的销售组合。',
    specifications: '含3台服务器',
    type: 1, // 销售套餐
    cost: 25500,
    basePrice: 50000,
    inventory: 10,
    category: '解决方案'
  },
  {
    id: 101,
    materialCode: 'SRV-ENT-001',
    unit: '台',
    name: '企业级服务器 X1',
    description: '用于数据中心的高性能机架式服务器。',
    specifications: '2U 机架式, 双路电源',
    type: 2, // 成品
    cost: 8500,
    basePrice: 16000,
    inventory: 45,
    category: '服务器整机',
    baseImage: '' // Base64 image placeholder
  },
  {
    id: 102,
    materialCode: 'CPU-INT-I9',
    unit: '颗',
    name: 'Intel Core i9 处理器',
    description: '高性能计算处理器。',
    specifications: 'LGA1700, 16C/24T',
    type: 4, // 零件
    cost: 2500,
    basePrice: 3500,
    inventory: 120,
    category: '计算芯片'
  },
  {
    id: 103,
    materialCode: 'CHA-ATX-02',
    unit: '套',
    name: 'ATX 服务器机箱组件',
    description: '机箱基础组件。',
    specifications: 'SPCC 1.0mm 钢板',
    type: 3, // 组件
    cost: 800,
    basePrice: 1500,
    inventory: 80,
    category: '结构件'
  }
];

export const INITIAL_BOMS: BOMStructure[] = [
  {
    id: 201,
    // rootProductId removed (Standalone BOM)
    name: '定制服务器配置单 (Auxiliary)',
    items: [
      { id: 1, productId: 101, quantity: 1 }, // Base Server
      { id: 2, productId: 102, quantity: 2 }, // Extra CPUs
    ]
  },
  {
    id: 202,
    name: '数据中心促销包',
    items: [
      { id: 3, productId: 101, quantity: 3 } // Contains 3 Finished Goods
    ]
  }
];

export const INITIAL_QUOTES: Quote[] = [
  {
    id: 3001,
    customerName: '未来科技有限公司',
    date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    status: 'Approved',
    items: [
      // 16000 * 5 = 80000. (Removed 5% discount)
      { id: 1, productId: 101, quantity: 5, unitPrice: 16000, margin: 0, total: 80000 }
    ],
    subtotal: 80000,
    tax: 7200, // 9%
    grandTotal: 87200
  },
  {
    id: 3002,
    customerName: '北方云数据中心',
    date: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    status: 'Sent',
    items: [
      { id: 2, productId: 100, quantity: 1, unitPrice: 50000, margin: 0, total: 50000 }
    ],
    subtotal: 50000,
    tax: 4500, // 9%
    grandTotal: 54500
  },
  {
    id: 3003,
    customerName: '创新软件园',
    date: new Date().toISOString(), // Today
    status: 'Draft',
    items: [
      // 16000 * 2 = 32000. (Removed 10% discount)
      { id: 3, productId: 101, quantity: 2, unitPrice: 16000, margin: 0, total: 32000 }
    ],
    subtotal: 32000,
    tax: 2880, // 9%
    grandTotal: 34880
  }
];

export const DEFAULT_ROLES: RoleDefinition[] = [
    {
        id: 1, // Admin
        name: '系统管理员',
        description: '拥有系统所有模块的完全控制权限。',
        isSystem: true,
        permissions: {
            dashboard: ['view'],
            products: ['view', 'create', 'edit', 'delete', 'view_cost', 'export'],
            types: ['view', 'create', 'edit', 'delete'],
            bom: ['view', 'create', 'edit', 'delete', 'view_cost'],
            quotes: ['view', 'create', 'edit', 'delete', 'export'],
            users: ['view', 'create', 'edit', 'delete'],
            settings: ['view', 'edit']
        }
    },
    {
        id: 2, // Sales
        name: '销售人员',
        description: '负责报价单创建与管理，只能查看公开价格，不可见成本。',
        isSystem: true,
        permissions: {
            dashboard: ['view'],
            products: ['view'], // No create/edit/delete/view_cost
            bom: ['view'], // No view_cost
            quotes: ['view', 'create', 'edit', 'delete', 'export'],
            settings: ['view'] // Can view personal profile
        }
    },
    {
        id: 3, // Designer
        name: '研发设计',
        description: '负责产品库与 BOM 结构的维护。',
        isSystem: true,
        permissions: {
            dashboard: ['view'],
            products: ['view', 'create', 'edit', 'view_cost'], // Cannot delete
            types: ['view', 'create', 'edit'],
            bom: ['view', 'create', 'edit', 'view_cost'],
            settings: ['view']
        }
    },
    {
        id: 4, // Guest
        name: '访客',
        description: '仅拥有部分查看权限。',
        isSystem: true,
        permissions: {
            dashboard: ['view']
        }
    }
];