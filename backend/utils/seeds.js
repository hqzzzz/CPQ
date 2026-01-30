
const SEED_TYPES = [
    { id: 1, name: '销售成品', level: 1, color: '#d946ef' },
    { id: 2, name: '成品', level: 2, color: '#22c55e' },
    { id: 3, name: '组件', level: 3, color: '#F59E0B' },
    { id: 4, name: '零件', level: 4, color: '#84cc16' },
    { id: 5, name: '标准件', level: 90, color: '#64748b' }
];

const SEED_CATEGORIES = [
    { id: 1, name: '电气' },
    { id: 2, name: '设备' },
    { id: 3, name: '供水' },
    { id: 4, name: '硬件' },
    { id: 5, name: '软件' }
];

const PLACEHOLDER_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const SEED_PRODUCTS = [
    {
        id: 1, materialCode: 'SRV-ENT-X1', unit: 'EA', name: 'Enterprise Server X1',
        description: 'High-performance rack server for enterprise workloads.', specifications: '2U Rackmount, Dual Socket', 
        type: 1, cost: 1800.00, basePrice: 2500.00, inventory: 45, category: '硬件',
        baseImage: PLACEHOLDER_IMG,
        galleryImages: [{
            id: 'seed-img-1', name: 'server_front.jpg', type: 'image/jpeg', size: 1024, uploadDate: new Date().toISOString(),
            url: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?auto=format&fit=crop&w=400&q=80'
        }], 
        documents: []
    },
    {
        id: 2, materialCode: 'SW-CRM-SUB', unit: 'LIC', name: 'Cloud CRM License',
        description: 'Cloud-based Customer Relationship Management subscription.', specifications: 'SaaS, Annual', 
        type: 1, cost: 10.00, basePrice: 50.00, inventory: 9999, category: '软件',
        baseImage: PLACEHOLDER_IMG,
        galleryImages: [{
            id: 'seed-img-2', name: 'crm_dashboard.jpg', type: 'image/jpeg', size: 2048, uploadDate: new Date().toISOString(),
            url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80'
        }], 
        documents: []
    }
];

const SEED_ROLES = [
    { 
        id: 1, name: '系统管理员', description: '全权限用户', isSystem: true, 
        permissions: { dashboard: ['view'], products: ['view','create','edit','delete','view_cost','export'], settings: ['view','edit'], types: ['view', 'create', 'edit', 'delete'], categories: ['view', 'create', 'edit', 'delete'], bom: ['view', 'create', 'edit', 'delete'] } 
    },
    { 
        id: 2, name: '销售人员', description: 'Create and manage quotes', isSystem: false, 
        permissions: { dashboard: ['view'], products: ['view'], quotes: ['view','create','edit','delete','export'], categories: ['view'] } 
    },
    { 
        id: 3, name: '研发人员', description: 'Create and manage quotes', isSystem: false, 
        permissions: { dashboard: ['view'], products: ['view','create','edit','delete','view_cost','export'], quotes: ['view','create','edit','delete','export'], categories: ['view'] } 
    },
    { 
        id: 3, name: '数据管理人员', description: 'Create and manage quotes', isSystem: false, 
        permissions: { dashboard: ['view'], products: ['view','edit']} 
    },
    { 
        id: 4, name: 'Guest', description: 'Guest', isSystem: false, 
        permissions: { dashboard: ['view']} 
    }
];

const SEED_USERS = [
    {
        id: 1, employeeId: 'EMP001', username: 'admin', name: 'Administrator', role: 1, 
        authProvider: 'local', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', email: 'yang.linhao@hotmail.com'
    }
];

const SEED_SETTINGS = {
    quote: { title: "Sales Quote", companyName: "青岛鑫光正牧业", companyAddress: "123 Tech Blvd", companyContact: "yang.linhao@hotmail.com", terms: "Net 30" },
    production: { title: "Production Work Order" }
};

module.exports = { SEED_TYPES, SEED_CATEGORIES, SEED_PRODUCTS, SEED_ROLES, SEED_USERS, SEED_SETTINGS };
