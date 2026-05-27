
import { Product, ProductTypeDefinition, BOMStructure, ProductBOM, Quote, User, RoleDefinition, AuthProvider, ResourceKey, ActionKey, TemplateSettings, BOMItem, ProductCategory } from './types';
import { apiService } from './services/api';

// Minimal Default Data for fallback
const DEFAULT_ROLES: RoleDefinition[] = [
    { id: 1, name: '系统管理员', description: 'System Admin', isSystem: true, permissions: { dashboard: ['view'], products: ['view','create','edit','delete','export','view_cost'], settings: ['view','edit'] } }
];
const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
    quote: { title: "报价单", companyName: "", companyAddress: "", companyContact: "", terms: "" },
    production: { title: "生产备料单" }
};

class Store {
  // State
  types: ProductTypeDefinition[] = [];
  categories: ProductCategory[] = [];
  products: Product[] = [];
  boms: BOMStructure[] = []; // Auxiliary BOMs
  productBoms: ProductBOM[] = []; // Product Linked BOMs
  quotes: Quote[] = [];
  users: User[] = [];
  roles: RoleDefinition[] = DEFAULT_ROLES;

  currentUser: User | null = null;
  templateSettings: TemplateSettings = DEFAULT_TEMPLATE_SETTINGS;

  listeners: Set<() => void> = new Set();

  // 用户索引 Map，用于 O(1) 查询而不是 O(n) 遍历
  private userIndex: Map<string, User> = new Map();
  private employeeIdIndex: Map<string, User> = new Map();
  // 登录失败计数，防暴力破解
  private loginAttempts: Map<string, { count: number; lockUntil: number }> = new Map();
  
  constructor() {
      const savedUser = localStorage.getItem('cpq_user');
      if (savedUser) {
          try { 
              this.currentUser = JSON.parse(savedUser);
          } catch(e) { console.error("Session restore failed", e); }
      }
      // Initial fetch
      this.fetchData();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify = () => {
    this.listeners.forEach(l => l());
  }

  // --- Data Synchronization ---
  // Fetch all data (original behavior)
  fetchData = async () => {
      await this.fetchDataByModules(['all']);
  }

  // Fetch data by specific modules
  fetchDataByModules = async (modules: ('products' | 'types' | 'categories' | 'boms' | 'productBoms' | 'quotes' | 'users' | 'roles' | 'templateSettings' | 'all')[]) => {
      const fetchAll = modules.includes('all');

      try {
          if (fetchAll || modules.includes('products')) {
              this.products = await apiService.getProducts();
          }
          if (fetchAll || modules.includes('types')) {
              this.types = await apiService.getTypes();
          }
          if (fetchAll || modules.includes('categories')) {
              this.categories = await apiService.getCategories();
          }
          if (fetchAll || modules.includes('boms')) {
              this.boms = await apiService.getBOMs();
          }
          if (fetchAll || modules.includes('productBoms')) {
              this.productBoms = await apiService.getProductBOMs();
          }
          if (fetchAll || modules.includes('quotes')) {
              this.quotes = await apiService.getQuotes();
          }
          if (fetchAll || modules.includes('users')) {
              this.users = await apiService.getUsers();
              this.buildUserIndexes();
          }
          if (fetchAll || modules.includes('roles')) {
              this.roles = (await apiService.getRoles()).length > 0 ? (await apiService.getRoles()) : DEFAULT_ROLES;
          }
          if (fetchAll || modules.includes('templateSettings')) {
              this.templateSettings = await apiService.getTemplateSettings();
          }
      } catch (e) {
          console.error("Failed to fetch data", e);
      } finally {
          this.notify();
      }
  }

  // 构建用户索引，实现 O(1) 查询
  private buildUserIndexes = () => {
      this.userIndex.clear();
      this.employeeIdIndex.clear();
      this.users.forEach(user => {
          if (user.username) this.userIndex.set(user.username.toLowerCase(), user);
          if (user.employeeId) this.employeeIdIndex.set(user.employeeId.toString(), user);
      });
  }

  // --- Authentication ---

  // 1. 本地登录（推荐使用后端 API，见 completeOAuthLogin 或创建 loginWithPassword API）
  login = (username: string, passHash: string) => {
      const identifier = username.toLowerCase();
      const lockoutInfo = this.loginAttempts.get(identifier);
      const now = Date.now();

      // 检查账户是否被锁定
      if (lockoutInfo && lockoutInfo.lockUntil > now) {
          const minutesLeft = Math.ceil((lockoutInfo.lockUntil - now) / 60000);
          return { success: false, message: `账户已锁定，请在 ${minutesLeft} 分钟后重试` };
      }

      // 使用索引查询，O(1) 性能
      const user = this.userIndex.get(identifier) || this.employeeIdIndex.get(identifier);

      if (user && user.password === passHash) {
          this.currentUser = user;
          localStorage.setItem('cpq_user', JSON.stringify(user));
          // 清除失败计数
          this.loginAttempts.delete(identifier);
          this.notify();
          return { success: true };
      }

      // 记录失败尝试
      const attempts = lockoutInfo?.count || 0;
      if (attempts >= 9) {
          // 第10次失败，锁定15分钟
          this.loginAttempts.set(identifier, {
              count: attempts + 1,
              lockUntil: now + 15 * 60000
          });
          return { success: false, message: '登录失败次数过多，账户已锁定15分钟' };
      }

      this.loginAttempts.set(identifier, {
          count: attempts + 1,
          lockUntil: 0
      });
      return { success: false, message: `用户名或密码错误 (${attempts + 1}/10)` };
  }

  // 2. OAuth Initiation
  initiateOAuthLogin = async (provider: AuthProvider) => {
      try {
          const url = await apiService.getOAuthUrl(provider);
          if (url) {
              window.location.href = url; // Redirect to Google/Microsoft/WeChat
              return true;
          }
      } catch (e) {
          console.error("OAuth Init Failed", e);
      }
      return false;
  }

  // 推荐：使用后端 API 进行密码认证（更安全）
  // 需要在 apiService 中添加此方法
  loginWithPassword = async (username: string, passHash: string) => {
      try {
          const user = await apiService.loginWithPassword(username, passHash);
          if (user) {
              this.currentUser = user;
              localStorage.setItem('cpq_user', JSON.stringify(user));
              await this.fetchData();
              this.notify();
              return { success: true };
          }
          return { success: false, message: '用户名或密码错误' };
      } catch (e: any) {
          return { success: false, message: e.message || '登录失败' };
      }
  }
  completeOAuthLogin = async (provider: AuthProvider, code: string) => {
      try {
          const user = await apiService.loginWithOAuth(provider, code);
          if (user) {
              this.currentUser = user;
              localStorage.setItem('cpq_user', JSON.stringify(user));
              // Refresh data to ensure we have latest permissions/roles
              await this.fetchData(); 
              this.notify();
              return true;
          }
      } catch (e) {
          console.error("OAuth Completion Failed", e);
      }
      return false;
  }

  // 4. Registration
  register = async (user: Partial<User>) => {
      try {
          const result = await apiService.register(user);
          if (result.success) {
              // Optionally fetch users if we want to update the list, but for registration mainly we just want success
              return { success: true, message: '注册成功，请登录。' };
          }
          return { success: false, message: result.message || '注册失败' };
      } catch (e: any) {
          return { success: false, message: e.message || '注册失败' };
      }
  }

  logout = () => {
      this.currentUser = null;
      localStorage.removeItem('cpq_user');
      this.notify();
  }

  // --- Permission Check ---
  hasPermission = (resource: ResourceKey, action: ActionKey): boolean => {
      if (!this.currentUser) return false;
      const roleDef = this.roles.find(r => r.id === this.currentUser!.role);
      if (!roleDef) return false;
      // Admin override (Role 1)
      if (roleDef.id === 1) return true;
      
      const resourcePerms = roleDef.permissions[resource];
      if (!resourcePerms) return false;
      
      return resourcePerms.includes(action);
  }

  // --- Products ---
  addProduct = async (product: Product) => {
      // 立即添加到本地数组，让 UI 立即更新
      this.products = [...this.products, product];
      this.notify();
      // 后台保存到服务器
      await apiService.createProduct(product);
      // 后台刷新数据以同步服务器状态
      await this.fetchDataByModules(['products', 'productBoms']);
  }
  updateProduct = async (product: Product) => {
      // 立即更新本地数组，让 UI 立即更新
      this.products = this.products.map(p => p.id === product.id ? product : p);
      this.notify();
      // 后台保存到服务器
      await apiService.updateProduct(product);
      // 后台刷新数据以同步服务器状态
      await this.fetchDataByModules(['products', 'productBoms']);
  }
  deleteProduct = async (id: number) => {
      // 立即从本地数组中移除，让 UI 立即更新
      this.products = this.products.filter(p => p.id !== id);
      this.notify();
      // 后台刷新数据
      await apiService.deleteProduct(String(id));
      await this.fetchDataByModules(['products', 'productBoms']);
  }

  // --- Types ---
  addType = async (type: ProductTypeDefinition) => {
      await apiService.createType(type);
      this.fetchData();
  }
  updateType = async (type: ProductTypeDefinition) => {
      await apiService.updateType(type);
      this.fetchData();
  }
  deleteType = async (id: number) => {
      await apiService.deleteType(String(id));
      this.fetchData();
  }

  // --- Categories ---
  addCategory = async (category: ProductCategory) => {
      await apiService.createCategory(category);
      this.fetchData();
  }
  deleteCategory = async (id: number) => {
      await apiService.deleteCategory(String(id));
      this.fetchData();
  }
  reorderCategories = async (categories: ProductCategory[]) => {
      await apiService.reorderCategories(categories);
      this.fetchData();
  }

  // --- BOMs (Auxiliary) ---
  addBOM = async (bom: BOMStructure) => {
      await apiService.createBOM(bom);
      this.fetchData();
  }
  updateBOM = async (bom: BOMStructure) => {
      await apiService.updateBOM(bom);
      this.fetchData();
  }
  deleteBOM = async (id: number) => {
      await apiService.deleteBOM(String(id));
      this.fetchData();
  }

  // --- Product BOMs ---
  updateProductBOM = async (productId: number, items: BOMItem[]) => {
      await apiService.updateProductBOM(productId, items);
      this.fetchData();
  }

  // --- Quotes ---
  addQuote = async (quote: Quote) => {
      await apiService.createQuote(quote);
      this.fetchData();
  }
  updateQuote = async (quote: Quote) => {
      await apiService.updateQuote(quote);
      this.fetchData();
  }
  deleteQuote = async (id: number) => {
      await apiService.deleteQuote(String(id));
      this.fetchData();
  }

  // --- Users & Roles ---
  addUser = async (user: User) => {
      await apiService.createUser(user);
      this.fetchData();
  }
  updateUser = async (user: User) => {
      await apiService.updateUser(user);
      this.fetchData();
  }
  deleteUser = async (id: number) => {
      await apiService.deleteUser(String(id));
      this.fetchData();
  }
  changePassword = async (userId: number, oldPassHash: string, newPassHash: string): Promise<{ success: boolean; message?: string }> => {
      // In a real implementation, we would send these hashes to the backend
      // await apiService.changePassword(userId, oldPassHash, newPassHash);
      return { success: true }; 
  }

  addRole = async (role: RoleDefinition) => {
      await apiService.createRole(role);
      this.fetchData();
  }
  updateRole = async (role: RoleDefinition) => {
      await apiService.updateRole(role);
      this.fetchData();
  }
  deleteRole = async (id: number) => {
      await apiService.deleteRole(String(id));
      this.fetchData();
  }

  // --- Settings ---
  updateTemplateSettings = async (settings: TemplateSettings) => {
      await apiService.updateTemplateSettings(settings);
      this.fetchData();
  }
}

// Singleton
export const store = new Store();

// React Hook
import { useSyncExternalStore } from 'react';
export const useStore = () => useSyncExternalStore(store.subscribe.bind(store), () => store);
