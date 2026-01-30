
import { Product, ProductTypeDefinition, BOMStructure, ProductBOM, Quote, User, RoleDefinition, AuthProvider, ResourceKey, ActionKey, TemplateSettings, BOMItem } from './types';
import { apiService } from './services/api';

// Minimal Default Data
const DEFAULT_ROLES: RoleDefinition[] = [
    { id: 1, name: '系统管理员', description: 'System Admin', isSystem: true, permissions: { dashboard: ['view'], products: ['view','create','edit','delete','export','view_cost'], settings: ['view','edit'] } }
];
const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
    quote: { title: "报价单", companyName: "", companyAddress: "", companyContact: "", terms: "" },
    production: { title: "生产备料单" }
};

const ensureArray = <T>(response: any): T[] => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    console.warn("Received non-array data where array was expected:", response);
    return [];
};

class Store {
  // State
  types: ProductTypeDefinition[] = [];
  products: Product[] = [];
  boms: BOMStructure[] = []; // Auxiliary BOMs
  productBoms: ProductBOM[] = []; // Product Linked BOMs
  quotes: Quote[] = [];
  users: User[] = [];
  roles: RoleDefinition[] = DEFAULT_ROLES;
  
  currentUser: User | null = null;
  templateSettings: TemplateSettings = DEFAULT_TEMPLATE_SETTINGS;
  
  listeners: Set<() => void> = new Set();
  
  constructor() {
      const savedUser = localStorage.getItem('cpq_user');
      if (savedUser) {
          try { 
              this.currentUser = JSON.parse(savedUser);
          } catch(e) { console.error("Session restore failed", e); }
      }
      this.fetchData();
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

  // --- Data Synchronization ---
  
  async fetchData() {
      console.log("Fetching data from API...");
      try {
          const [products, types, boms, productBoms, quotes, roles, users, templates] = await Promise.allSettled([
              apiService.getProducts(),
              apiService.getTypes(),
              apiService.getBOMs(),
              apiService.getProductBOMs(),
              apiService.getQuotes(),
              apiService.getRoles(),
              apiService.getUsers(),
              apiService.getTemplateSettings()
          ]);

          if (products.status === 'fulfilled') {
              this.products = ensureArray(products.value).map((p: any) => ({
                  ...p,
                  id: Number(p.id),
                  cost: Number(p.cost || 0),
                  basePrice: Number(p.basePrice || 0),
                  inventory: Number(p.inventory || 0)
              }));
          }
          if (types.status === 'fulfilled') this.types = ensureArray(types.value);
          if (boms.status === 'fulfilled') this.boms = ensureArray(boms.value);
          if (productBoms.status === 'fulfilled') this.productBoms = ensureArray(productBoms.value);
          
          if (quotes.status === 'fulfilled') {
              this.quotes = ensureArray(quotes.value).map((q: any) => ({
                  ...q,
                  id: Number(q.id),
                  subtotal: Number(q.subtotal || 0),
                  tax: Number(q.tax || 0),
                  grandTotal: Number(q.grandTotal || 0),
                  items: (q.items || []).map((i: any) => ({
                      ...i,
                      quantity: Number(i.quantity || 0),
                      unitPrice: Number(i.unitPrice || 0),
                      total: Number(i.total || 0),
                      margin: Number(i.margin || 0)
                  }))
              }));
          }

          if (roles.status === 'fulfilled') this.roles = ensureArray(roles.value);
          if (users.status === 'fulfilled') this.users = ensureArray(users.value);
          
          if (templates.status === 'fulfilled' && templates.value) {
              const t = templates.value;
              this.templateSettings = {
                  quote: { ...DEFAULT_TEMPLATE_SETTINGS.quote, ...(t.quote || {}) },
                  production: { ...DEFAULT_TEMPLATE_SETTINGS.production, ...(t.production || {}) }
              };
          }

          this.notify();
          console.log("Data sync complete.");

      } catch (e) {
          console.error("Critical: Failed to fetch initial data.", e);
      }
  }

  // --- Auth Actions ---

  login(username: string, password?: string): { success: boolean, message?: string } {
      const user = this.users.find(u => u.username === username || u.email === username);
      
      // Fallback for initial admin
      if (!user && username === 'admin' && password === 'admin') {
          const tempAdmin: User = { 
              id: 1, username: 'admin', name: 'Local Admin', role: 1, 
              authProvider: 'local', email: 'admin@local' 
          };
          this.setCurrentUser(tempAdmin);
          return { success: true };
      }
      
      if (!user) return { success: false, message: '用户不存在 (请检查 API 连接或初始化数据)' };
      if (password && user.password && user.password !== password) return { success: false, message: '密码错误' };

      this.setCurrentUser(user);
      return { success: true };
  }

  loginWithProvider(provider: AuthProvider, email: string): boolean {
      let user = this.users.find(u => u.email === email);
      if (!user) {
          user = {
              id: Date.now(), // Generate temp ID
              username: email.split('@')[0], name: email.split('@')[0],
              email: email, role: 4, authProvider: provider, // 4 = Guest
              avatar: ''
          };
          this.addUser(user); 
      }
      this.setCurrentUser(user);
      return true;
  }

  private setCurrentUser(user: User) {
      this.currentUser = { ...user, lastLogin: new Date().toISOString() };
      localStorage.setItem('cpq_user', JSON.stringify(this.currentUser));
      this.notify();
  }

  logout() {
      this.currentUser = null;
      localStorage.removeItem('cpq_user');
      this.notify();
  }

  changePassword(userId: number, oldPass: string, newPass: string): { success: boolean, message?: string } {
      const user = this.users.find(u => u.id === userId);
      if (!user) return { success: false, message: 'User not found' };
      const updatedUser = { ...user, password: newPass };
      this.updateUser(updatedUser);
      return { success: true };
  }

  hasPermission(resource: ResourceKey, action: ActionKey): boolean {
      if (!this.currentUser) return false;
      const roleDef = this.roles.find(r => r.id === this.currentUser?.role);
      if (!roleDef) return false;
      if (roleDef.id === 1) return true; // Admin ID
      return roleDef.permissions[resource]?.includes(action) || false;
  }

  // --- CRUD Actions ---

  private async performAction<T>(
    apiCall: () => Promise<T>,
    optimisticUpdate: () => void,
    rollback: () => void
  ) {
      optimisticUpdate();
      this.notify();
      try {
          await apiCall();
      } catch (e) {
          console.error("Action failed:", e);
          alert("操作失败，请检查网络连接。");
          rollback();
          this.notify();
      }
  }

  // Types
  addType(type: ProductTypeDefinition) {
      this.performAction(
          () => apiService.createType(type),
          () => this.types = [...this.types, type],
          () => this.types = this.types.filter(t => t.id !== type.id)
      );
  }
  updateType(type: ProductTypeDefinition) {
      const original = this.types.find(t => t.id === type.id);
      this.performAction(
          () => apiService.updateType(type),
          () => this.types = this.types.map(t => t.id === type.id ? type : t),
          () => { if(original) this.types = this.types.map(t => t.id === type.id ? original : t); }
      );
  }
  deleteType(id: number) {
      const original = this.types.find(t => t.id === id);
      this.performAction(
          () => apiService.deleteType(String(id)),
          () => this.types = this.types.filter(t => t.id !== id),
          () => { if(original) this.types = [...this.types, original]; }
      );
  }

  // Products
  addProduct(product: Product) {
      const p = {
          ...product,
          cost: Number(product.cost),
          basePrice: Number(product.basePrice),
          inventory: Number(product.inventory)
      };
      this.performAction(
          () => apiService.createProduct(p),
          () => this.products = [...this.products, p],
          () => this.products = this.products.filter(item => item.id !== p.id)
      );
  }
  updateProduct(product: Product) {
      const p = {
          ...product,
          cost: Number(product.cost),
          basePrice: Number(product.basePrice),
          inventory: Number(product.inventory)
      };
      const original = this.products.find(item => item.id === p.id);
      this.performAction(
          () => apiService.updateProduct(p),
          () => this.products = this.products.map(item => item.id === p.id ? p : item),
          () => { if(original) this.products = this.products.map(item => item.id === p.id ? original : item); }
      );
  }
  deleteProduct(id: number) {
      const original = this.products.find(p => p.id === id);
      this.performAction(
          () => apiService.deleteProduct(String(id)),
          () => this.products = this.products.filter(p => p.id !== id),
          () => { if(original) this.products = [...this.products, original]; }
      );
  }

  // Auxiliary BOMs (boms)
  addBOM(bom: BOMStructure) {
      this.performAction(
          () => apiService.createBOM(bom),
          () => this.boms = [...this.boms, bom],
          () => this.boms = this.boms.filter(b => b.id !== bom.id)
      );
  }
  updateBOM(bom: BOMStructure) {
      const original = this.boms.find(b => b.id === bom.id);
      this.performAction(
          () => apiService.updateBOM(bom),
          () => this.boms = this.boms.map(b => b.id === bom.id ? bom : b),
          () => { if(original) this.boms = this.boms.map(b => b.id === bom.id ? original : b); }
      );
  }
  deleteBOM(id: number) {
      const original = this.boms.find(b => b.id === id);
      this.performAction(
          () => apiService.deleteBOM(String(id)),
          () => this.boms = this.boms.filter(b => b.id !== id),
          () => { if(original) this.boms = [...this.boms, original]; }
      );
  }

  // Product BOMs (product_boms)
  updateProductBOM(productId: number, items: BOMItem[]) {
      const original = this.productBoms.find(b => b.productId === productId);
      const newBOM = { productId, items };
      
      this.performAction(
          () => apiService.updateProductBOM(productId, items),
          () => {
              const exists = this.productBoms.some(b => b.productId === productId);
              if (exists) {
                  this.productBoms = this.productBoms.map(b => b.productId === productId ? newBOM : b);
              } else {
                  this.productBoms = [...this.productBoms, newBOM];
              }
          },
          () => { 
              if(original) {
                  this.productBoms = this.productBoms.map(b => b.productId === productId ? original : b); 
              } else {
                  this.productBoms = this.productBoms.filter(b => b.productId !== productId);
              }
          }
      );
  }

  // Quotes
  addQuote(quote: Quote) {
      this.performAction(
          () => apiService.createQuote(quote),
          () => this.quotes = [quote, ...this.quotes],
          () => this.quotes = this.quotes.filter(q => q.id !== quote.id)
      );
  }
  updateQuote(quote: Quote) {
      const original = this.quotes.find(q => q.id === quote.id);
      this.performAction(
          () => apiService.updateQuote(quote),
          () => this.quotes = this.quotes.map(q => q.id === quote.id ? quote : q),
          () => { if(original) this.quotes = this.quotes.map(q => q.id === quote.id ? original : q); }
      );
  }
  deleteQuote(id: number) {
      const original = this.quotes.find(q => q.id === id);
      this.performAction(
          () => apiService.deleteQuote(String(id)),
          () => this.quotes = this.quotes.filter(q => q.id !== id),
          () => { if(original) this.quotes = [...this.quotes, original]; }
      );
  }

  // Users & Roles
  addUser(user: User) {
      this.performAction(
          () => apiService.createUser(user),
          () => this.users = [...this.users, user],
          () => this.users = this.users.filter(u => u.id !== user.id)
      );
  }
  updateUser(user: User) {
      const original = this.users.find(u => u.id === user.id);
      this.performAction(
          () => apiService.updateUser(user),
          () => {
              this.users = this.users.map(u => u.id === user.id ? user : u);
              if (this.currentUser?.id === user.id) this.setCurrentUser(user);
          },
          () => { if(original) this.users = this.users.map(u => u.id === user.id ? original : u); }
      );
  }
  deleteUser(id: number) {
      const original = this.users.find(u => u.id === id);
      this.performAction(
          () => apiService.deleteUser(String(id)),
          () => this.users = this.users.filter(u => u.id !== id),
          () => { if(original) this.users = [...this.users, original]; }
      );
  }
  addRole(role: RoleDefinition) {
      this.performAction(
          () => apiService.createRole(role),
          () => this.roles = [...this.roles, role],
          () => this.roles = this.roles.filter(r => r.id !== role.id)
      );
  }
  updateRole(role: RoleDefinition) {
      const original = this.roles.find(r => r.id === role.id);
      this.performAction(
          () => apiService.updateRole(role),
          () => this.roles = this.roles.map(r => r.id === role.id ? role : r),
          () => { if(original) this.roles = this.roles.map(r => r.id === role.id ? original : r); }
      );
  }
  deleteRole(id: number) {
      const original = this.roles.find(r => r.id === id);
      this.performAction(
          () => apiService.deleteRole(String(id)),
          () => this.roles = this.roles.filter(r => r.id !== id),
          () => { if(original) this.roles = [...this.roles, original]; }
      );
  }

  updateTemplateSettings(settings: TemplateSettings) {
      const original = this.templateSettings;
      this.performAction(
          () => apiService.updateTemplateSettings(settings),
          () => this.templateSettings = settings,
          () => this.templateSettings = original
      );
  }

  importData(data: any) {
      if (data.products) data.products.forEach((p: Product) => this.addProduct(p));
      if (data.boms) data.boms.forEach((b: BOMStructure) => this.addBOM(b));
      if (data.quotes) data.quotes.forEach((q: Quote) => this.addQuote(q));
      if (data.types) data.types.forEach((t: ProductTypeDefinition) => this.addType(t));
      this.fetchData();
  }
}

export const store = new Store();

import { useState, useEffect } from 'react';
export const useStore = () => {
  const [state, setState] = useState({
    types: store.types,
    products: store.products,
    boms: store.boms, // Aux
    productBoms: store.productBoms, // Linked
    quotes: store.quotes,
    users: store.users,
    roles: store.roles,
    templateSettings: store.templateSettings,
    currentUser: store.currentUser,
  });

  useEffect(() => {
    setState({
        types: store.types,
        products: store.products,
        boms: store.boms,
        productBoms: store.productBoms,
        quotes: store.quotes,
        users: store.users,
        roles: store.roles,
        templateSettings: store.templateSettings,
        currentUser: store.currentUser,
    });
    return store.subscribe(() => {
      setState({
        types: store.types,
        products: store.products,
        boms: store.boms,
        productBoms: store.productBoms,
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
    loadFromDB: store.fetchData.bind(store),
    fetchData: store.fetchData.bind(store),
    login: store.login.bind(store),
    loginWithProvider: store.loginWithProvider.bind(store),
    changePassword: store.changePassword.bind(store),
    logout: store.logout.bind(store),
    hasPermission: store.hasPermission.bind(store),
    addRole: store.addRole.bind(store),
    updateRole: store.updateRole.bind(store),
    deleteRole: store.deleteRole.bind(store),
    addUser: store.addUser.bind(store),
    updateUser: store.updateUser.bind(store),
    deleteUser: store.deleteUser.bind(store),
    addType: store.addType.bind(store),
    updateType: store.updateType.bind(store),
    deleteType: store.deleteType.bind(store),
    addProduct: store.addProduct.bind(store),
    updateProduct: store.updateProduct.bind(store),
    deleteProduct: store.deleteProduct.bind(store),
    addBOM: store.addBOM.bind(store),
    updateBOM: store.updateBOM.bind(store),
    updateProductBOM: store.updateProductBOM.bind(store),
    deleteBOM: store.deleteBOM.bind(store),
    addQuote: store.addQuote.bind(store),
    updateQuote: store.updateQuote.bind(store),
    deleteQuote: store.deleteQuote.bind(store),
    importData: store.importData.bind(store),
    updateTemplateSettings: store.updateTemplateSettings.bind(store)
  };
};
