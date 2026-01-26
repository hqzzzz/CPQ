import { Product, ProductTypeDefinition, BOMStructure, Quote, User, RoleDefinition, AuthProvider, ResourceKey, ActionKey, TemplateSettings } from './types';
import { INITIAL_TYPES, INITIAL_PRODUCTS, INITIAL_BOMS, INITIAL_QUOTES, DEFAULT_ROLES } from './constants';
import * as dbService from './services/db';

// Initial Mock Users
const INITIAL_USERS: User[] = [
    { 
        id: 'u1', 
        employeeId: 'EMP001',
        username: 'admin', 
        email: 'admin@cloudcpq.com',
        password: 'admin', 
        name: '系统管理员', 
        role: 'admin', 
        title: 'IT 总监', 
        department: '信息技术部',
        authProvider: 'local',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin' 
    },
    { 
        id: 'u2', 
        employeeId: 'EMP007',
        username: 'design', 
        email: 'lee@cloudcpq.com',
        password: '123',
        name: '李工', 
        role: 'designer', 
        title: '高级工程师', 
        department: '研发设计部',
        authProvider: 'local',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=design' 
    },
    { 
        id: 'u3', 
        employeeId: 'EMP102',
        username: 'sales', 
        email: 'wang@cloudcpq.com',
        password: '123',
        name: '王经理', 
        role: 'sales', 
        title: '销售总监', 
        department: '市场销售部',
        authProvider: 'local',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sales' 
    },
];

const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
    quote: {
        title: "报价单 (QUOTATION)",
        companyName: "",
        companyAddress: "",
        companyContact: "",
        terms: "1. 本报价单有效期为 30 天，逾期需重新询价。\n2. 价格已包含标准包装及国内运费。\n3. 签字盖章后生效。",
    },
    production: {
        title: "生产备料单 (Production Material Request)",
    }
};

class Store {
  types = INITIAL_TYPES;
  products = INITIAL_PRODUCTS;
  boms = INITIAL_BOMS;
  quotes = INITIAL_QUOTES;
  
  // Auth State
  users: User[] = INITIAL_USERS;
  currentUser: User | null = null;
  
  // RBAC State
  roles: RoleDefinition[] = DEFAULT_ROLES;

  // Template Settings
  templateSettings: TemplateSettings = DEFAULT_TEMPLATE_SETTINGS;

  listeners: Set<() => void> = new Set();

  constructor() {
      // Restore User Session & Settings
      const savedUser = localStorage.getItem('cpq_user');
      const savedUsersList = localStorage.getItem('cpq_users_list');
      const savedRoles = localStorage.getItem('cpq_roles');
      const savedTemplates = localStorage.getItem('cpq_templates');

      if (savedUsersList) {
          try { this.users = JSON.parse(savedUsersList); } catch(e) {}
      }
      
      if (savedRoles) {
          try { this.roles = JSON.parse(savedRoles); } catch(e) {}
      }

      if (savedTemplates) {
          try { this.templateSettings = JSON.parse(savedTemplates); } catch(e) {}
      } else {
          // If no saved settings, ensure defaults have new fields
          this.templateSettings = DEFAULT_TEMPLATE_SETTINGS;
      }

      if (savedUser) {
          try { 
              const parsedUser = JSON.parse(savedUser);
              const validUser = this.users.find(u => u.id === parsedUser.id);
              this.currentUser = validUser || null;
          } catch(e) {}
      }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  // --- Auth Actions ---

  login(username: string, password?: string): { success: boolean, message?: string } {
      const user = this.users.find(u => u.username === username || u.email === username);
      
      if (!user) {
          return { success: false, message: '用户不存在' };
      }
      
      if (password && user.password && user.password !== password) {
           return { success: false, message: '密码错误' };
      }

      this.setCurrentUser(user);
      return { success: true };
  }

  loginWithProvider(provider: AuthProvider, email: string): boolean {
      let user = this.users.find(u => u.email === email);

      if (!user) {
          user = {
              id: `u-${Date.now()}`,
              username: email.split('@')[0],
              name: email.split('@')[0],
              email: email,
              role: 'guest',
              authProvider: provider,
              avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${email}`,
              employeeId: `EXT-${Math.floor(Math.random() * 1000)}`
          };
          this.addUser(user);
      }

      this.setCurrentUser(user);
      return true;
  }

  private setCurrentUser(user: User) {
      const updatedUser = { ...user, lastLogin: new Date().toISOString() };
      this.currentUser = updatedUser;
      this.updateUser(updatedUser); 
      localStorage.setItem('cpq_user', JSON.stringify(updatedUser));
      this.notify();
  }

  logout() {
      this.currentUser = null;
      localStorage.removeItem('cpq_user');
      this.notify();
  }

  changePassword(userId: string, oldPass: string, newPass: string): { success: boolean, message?: string } {
      const userIndex = this.users.findIndex(u => u.id === userId);
      if (userIndex === -1) return { success: false, message: '用户未找到' };
      
      const user = this.users[userIndex];
      
      if (user.authProvider !== 'local') {
          return { success: false, message: 'OAuth 用户无法在本地修改密码' };
      }
      
      if (user.password && user.password !== oldPass) {
          return { success: false, message: '旧密码不正确' };
      }

      const updatedUser = { ...user, password: newPass };
      this.users[userIndex] = updatedUser;
      
      if (this.currentUser?.id === userId) {
          this.currentUser = updatedUser;
          localStorage.setItem('cpq_user', JSON.stringify(updatedUser));
      }
      
      this.saveUsers();
      this.notify();
      return { success: true };
  }

  // --- Helper: Permission Checking ---
  hasPermission(resource: ResourceKey, action: ActionKey): boolean {
      if (!this.currentUser) return false;
      
      const roleDef = this.roles.find(r => r.id === this.currentUser?.role);
      if (!roleDef) return false;

      // Admin super user check (optional, but good for safety)
      if (roleDef.id === 'admin') return true;

      const resourcePerms = roleDef.permissions[resource];
      return resourcePerms ? resourcePerms.includes(action) : false;
  }

  // --- Template Settings Actions ---
  updateTemplateSettings(settings: TemplateSettings) {
      this.templateSettings = settings;
      localStorage.setItem('cpq_templates', JSON.stringify(settings));
      this.notify();
  }

  // --- Role Actions ---
  addRole(role: RoleDefinition) {
      if(dbService.getDB()) dbService.dbAddRole(role);
      this.roles = [...this.roles, role];
      this.saveRoles();
      this.notify();
  }
  
  updateRole(role: RoleDefinition) {
      if(dbService.getDB()) dbService.dbUpdateRole(role);
      this.roles = this.roles.map(r => r.id === role.id ? role : r);
      this.saveRoles();
      this.notify();
  }

  deleteRole(id: string) {
      if(dbService.getDB()) dbService.dbDeleteRole(id);
      this.roles = this.roles.filter(r => r.id !== id);
      this.saveRoles();
      this.notify();
  }

  private saveRoles() {
      localStorage.setItem('cpq_roles', JSON.stringify(this.roles));
  }

  // --- User Management Actions ---
  addUser(user: User) {
      this.users = [...this.users, user];
      this.saveUsers();
      this.notify();
  }

  updateUser(user: User) {
      this.users = this.users.map(u => u.id === user.id ? user : u);
      if (this.currentUser?.id === user.id) {
          this.currentUser = user;
          localStorage.setItem('cpq_user', JSON.stringify(user));
      }
      this.saveUsers();
      this.notify();
  }

  deleteUser(userId: string) {
      this.users = this.users.filter(u => u.id !== userId);
      this.saveUsers();
      this.notify();
  }

  private saveUsers() {
      localStorage.setItem('cpq_users_list', JSON.stringify(this.users));
  }

  // --- Database Sync ---
  
  loadFromDB() {
      if (!dbService.getDB()) {
          console.warn("Cannot load from DB: No database connected.");
          return;
      }
      try {
          this.types = dbService.dbGetTypes();
          this.products = dbService.dbGetProducts();
          this.boms = dbService.dbGetBOMs();
          this.quotes = dbService.dbGetQuotes();
          
          const loadedRoles = dbService.dbGetRoles();
          if (loadedRoles.length > 0) this.roles = loadedRoles;

          this.notify();
          console.log("Store hydrated from SQLite database.");
      } catch (e) {
          console.error("Error loading from DB:", e);
      }
  }

  // --- Type Actions ---
  addType(type: ProductTypeDefinition) {
    if (dbService.getDB()) dbService.dbAddType(type);
    this.types = [...this.types, type];
    this.notify();
  }
  updateType(type: ProductTypeDefinition) {
    if (dbService.getDB()) dbService.dbUpdateType(type);
    this.types = this.types.map(t => t.id === type.id ? type : t);
    this.notify();
  }
  deleteType(id: string) {
    if (dbService.getDB()) dbService.dbDeleteType(id);
    this.types = this.types.filter(t => t.id !== id);
    this.notify();
  }

  // --- Product Actions ---
  addProduct(product: Product) {
    if (dbService.getDB()) dbService.dbAddProduct(product);
    this.products = [...this.products, product];
    this.notify();
  }
  updateProduct(product: Product) {
    if (dbService.getDB()) dbService.dbUpdateProduct(product);
    this.products = this.products.map(p => p.id === product.id ? product : p);
    this.notify();
  }
  deleteProduct(id: string) {
    if (dbService.getDB()) dbService.dbDeleteProduct(id);
    this.products = this.products.filter(p => p.id !== id);
    this.notify();
  }

  // --- BOM Actions ---
  addBOM(bom: BOMStructure) {
    if (dbService.getDB()) dbService.dbAddBOM(bom);
    this.boms = [...this.boms, bom];
    this.notify();
  }
  updateBOM(bom: BOMStructure) {
    if (dbService.getDB()) dbService.dbUpdateBOM(bom);
    this.boms = this.boms.map(b => b.id === bom.id ? bom : b);
    this.notify();
  }
  updateBOMs(boms: BOMStructure[]) { 
    if (dbService.getDB()) {
        boms.forEach(b => dbService.dbUpdateBOM(b));
    }
    this.boms = boms;
    this.notify();
  }
  deleteBOM(id: string) {
    if (dbService.getDB()) dbService.dbDeleteBOM(id);
    this.boms = this.boms.filter(b => b.id !== id);
    this.notify();
  }

  // --- Quote Actions ---
  addQuote(quote: Quote) {
    if (dbService.getDB()) dbService.dbAddQuote(quote);
    this.quotes = [quote, ...this.quotes]; 
    this.notify();
  }
  deleteQuote(id: string) {
    if (dbService.getDB()) dbService.dbDeleteQuote(id);
    this.quotes = this.quotes.filter(q => q.id !== id);
    this.notify();
  }

  // --- Bulk Import ---
  importData(data: { products?: Product[], types?: ProductTypeDefinition[], boms?: BOMStructure[], quotes?: Quote[] }) {
    const isDB = !!dbService.getDB();
    if (data.types) {
        if(isDB) data.types.forEach(t => dbService.dbAddType(t));
        this.types = data.types;
    }
    if (data.products) {
        if(isDB) data.products.forEach(p => dbService.dbAddProduct(p));
        this.products = data.products;
    }
    if (data.boms) {
        if(isDB) data.boms.forEach(b => dbService.dbAddBOM(b));
        this.boms = data.boms;
    }
    if (data.quotes) {
        if(isDB) data.quotes.forEach(q => dbService.dbAddQuote(q));
        this.quotes = data.quotes;
    }
    this.notify();
  }
}

export const store = new Store();

// React Hook for store
import { useState, useEffect } from 'react';
export const useStore = () => {
  const [state, setState] = useState({
    types: store.types,
    products: store.products,
    boms: store.boms,
    quotes: store.quotes,
    users: store.users,
    roles: store.roles, // Exposed roles
    templateSettings: store.templateSettings,
    currentUser: store.currentUser,
  });

  useEffect(() => {
    return store.subscribe(() => {
      setState({
        types: store.types,
        products: store.products,
        boms: store.boms,
        quotes: store.quotes,
        users: store.users,
        roles: store.roles,
        templateSettings: store.templateSettings,
        currentUser: store.currentUser,
      });
    });
  }, []);

  return {
    ...state,
    login: store.login.bind(store),
    loginWithProvider: store.loginWithProvider.bind(store),
    changePassword: store.changePassword.bind(store),
    logout: store.logout.bind(store),
    hasPermission: store.hasPermission.bind(store), // New Helper
    addRole: store.addRole.bind(store),
    updateRole: store.updateRole.bind(store),
    deleteRole: store.deleteRole.bind(store),
    addUser: store.addUser.bind(store),
    updateUser: store.updateUser.bind(store),
    deleteUser: store.deleteUser.bind(store),
    loadFromDB: store.loadFromDB.bind(store), 
    addType: store.addType.bind(store),
    updateType: store.updateType.bind(store),
    deleteType: store.deleteType.bind(store),
    addProduct: store.addProduct.bind(store),
    updateProduct: store.updateProduct.bind(store),
    deleteProduct: store.deleteProduct.bind(store),
    addBOM: store.addBOM.bind(store),
    updateBOM: store.updateBOM.bind(store),
    updateBOMs: store.updateBOMs.bind(store),
    deleteBOM: store.deleteBOM.bind(store),
    addQuote: store.addQuote.bind(store),
    deleteQuote: store.deleteQuote.bind(store),
    importData: store.importData.bind(store),
    updateTemplateSettings: store.updateTemplateSettings.bind(store)
  };
};