
import { Product, ProductTypeDefinition, BOMStructure, ProductBOM, Quote, User, RoleDefinition, TemplateSettings, ProductDocument, BOMItem, QuoteStatusLog, ProductCategory, AuthProvider } from '../types';

// Helper to get config
const getConfig = () => {
    const saved = localStorage.getItem('cpq_api_config');
    const config = saved ? JSON.parse(saved) : {};
    // 默认连接本地后端，防止首次启动报错
    return { 
        baseUrl: config.baseUrl || 'http://localhost:3002/api', 
        apiKey: config.apiKey || '', 
        timeout: config.timeout || 10000 
    };
};

class ApiService {
    private getHeaders() {
        const { apiKey } = getConfig();
        return {
            'Content-Type': 'application/json',
            'Authorization': apiKey ? `Bearer ${apiKey}` : '',
            'X-Client-Version': '2.1.0'
        };
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const { baseUrl, timeout } = getConfig();
        
        if (!baseUrl) {
            throw new Error("API_NOT_CONFIGURED");
        }

        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout || 10000);

        try {
            // Clean URL construction
            const cleanBase = baseUrl.replace(/\/$/, '');
            const cleanEndpoint = endpoint.replace(/^\//, '');
            const url = `${cleanBase}/${cleanEndpoint}`;
            
            // Handle FormData specially: do not set Content-Type header manually
            const headers: Record<string, string> = { ...this.getHeaders(), ...options.headers as any };
            if (options.body instanceof FormData) {
                // @ts-ignore
                delete headers['Content-Type'];
            }

            const response = await fetch(url, {
                ...options,
                headers: headers,
                signal: controller.signal
            });

            clearTimeout(id);

            if (!response.ok) {
                const errorText = await response.text();
                // Parse JSON error if possible
                let errMsg = errorText;
                try {
                    const jsonErr = JSON.parse(errorText);
                    if (jsonErr.message) errMsg = jsonErr.message;
                } catch(e) {}
                throw new Error(`API Request Failed (${response.status}): ${errMsg || response.statusText}`);
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return {} as T;
            }

            return await response.json();
        } catch (error: any) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error(`请求超时 (${timeout}ms)。请检查网络或后端状态。`);
            } else if (error.message === 'API_NOT_CONFIGURED') {
                throw error;
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error(`无法连接到服务器 (${baseUrl})。请检查 API 地址配置或跨域设置。`);
            }
            throw error;
        }
    }

    // --- Authentication ---
    async getOAuthUrl(provider: AuthProvider) {
        return (await this.request<{success: boolean, url: string}>(`/auth/${provider}/url`));
    }

    async loginWithOAuth(provider: AuthProvider, code: string) {
        return (await this.request<{success: boolean, data: User}>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ provider, code })
        })).data;
    }

    async register(user: Partial<User>) {
        return await this.request<{success: boolean, message: string}>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(user)
        });
    }

    // --- Files ---
    async uploadFile(file: File, id?: number): Promise<ProductDocument> {
        const formData = new FormData();
        if (id) {
            formData.append('id', String(id));
        }
        formData.append('file', file);
        
        const res = await this.request<{ success: boolean, data: ProductDocument }>('/upload', {
            method: 'POST',
            body: formData
        });
        return res.data;
    }

    // --- Products ---
    async getProducts() { return (await this.request<{success:boolean, data: Product[]}>('/products')).data; }
    async createProduct(p: Product) { return (await this.request<{success:boolean, data: Product}>('/products', { method: 'POST', body: JSON.stringify(p) })).data; }
    async updateProduct(p: Product) { return (await this.request<{success:boolean, data: Product}>(`/products/${p.id}`, { method: 'PUT', body: JSON.stringify(p) })).data; }
    async deleteProduct(id: string) { return this.request<void>(`/products/${id}`, { method: 'DELETE' }); }

    // --- Types ---
    async getTypes() { return (await this.request<{success:boolean, data: ProductTypeDefinition[]}>('/types')).data; }
    async createType(t: ProductTypeDefinition) { return (await this.request<{success:boolean, data: ProductTypeDefinition}>('/types', { method: 'POST', body: JSON.stringify(t) })).data; }
    async updateType(t: ProductTypeDefinition) { return (await this.request<{success:boolean, data: ProductTypeDefinition}>(`/types/${t.id}`, { method: 'PUT', body: JSON.stringify(t) })).data; }
    async deleteType(id: string) { return this.request<void>(`/types/${id}`, { method: 'DELETE' }); }

    // --- Categories ---
    async getCategories() { return (await this.request<{success:boolean, data: ProductCategory[]}>('/categories')).data; }
    async createCategory(c: ProductCategory) { return (await this.request<{success:boolean, data: ProductCategory}>('/categories', { method: 'POST', body: JSON.stringify(c) })).data; }
    async deleteCategory(id: string) { return this.request<void>(`/categories/${id}`, { method: 'DELETE' }); }
    async reorderCategories(categories: ProductCategory[]) { return this.request<void>('/categories/reorder', { method: 'PUT', body: JSON.stringify(categories) }); }

    // --- Auxiliary BOMs (Standalone) ---
    async getBOMs() { return (await this.request<{success:boolean, data: BOMStructure[]}>('/boms')).data; }
    async createBOM(b: BOMStructure) { return (await this.request<{success:boolean, data: BOMStructure}>('/boms', { method: 'POST', body: JSON.stringify(b) })).data; }
    async updateBOM(b: BOMStructure) { return (await this.request<{success:boolean, data: BOMStructure}>(`/boms/${b.id}`, { method: 'PUT', body: JSON.stringify(b) })).data; }
    async deleteBOM(id: string) { return this.request<void>(`/boms/${id}`, { method: 'DELETE' }); }

    // --- Product BOMs (Linked) ---
    async getProductBOMs() { return (await this.request<{success:boolean, data: ProductBOM[]}>('/product-boms')).data; }
    async updateProductBOM(productId: number, items: BOMItem[]) { return (await this.request<{success:boolean, data: ProductBOM}>(`/product-boms/${productId}`, { method: 'PUT', body: JSON.stringify({ items }) })).data; }

    // --- Quotes ---
    async getQuotes() { return (await this.request<{success:boolean, data: Quote[]}>('/quotes')).data; }
    async createQuote(q: Quote) { return (await this.request<{success:boolean, data: Quote}>('/quotes', { method: 'POST', body: JSON.stringify(q) })).data; }
    async updateQuote(q: Quote) { return (await this.request<{success:boolean, data: Quote}>(`/quotes/${q.id}`, { method: 'PUT', body: JSON.stringify(q) })).data; }
    async deleteQuote(id: string) { return this.request<void>(`/quotes/${id}`, { method: 'DELETE' }); }

    // --- Users & Roles ---
    async getUsers() { return (await this.request<{success:boolean, data: User[]}>('/users')).data; }
    async createUser(u: Partial<User>) { return (await this.request<{success:boolean, data: User}>('/users', { method: 'POST', body: JSON.stringify(u) })).data; }
    async updateUser(u: User) { return (await this.request<{success:boolean, data: User}>(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify(u) })).data; }
    async deleteUser(id: string) { return this.request<void>(`/users/${id}`, { method: 'DELETE' }); }

    async getRoles() { return (await this.request<{success:boolean, data: RoleDefinition[]}>('/roles')).data; }
    async createRole(r: RoleDefinition) { return (await this.request<{success:boolean, data: RoleDefinition}>('/roles', { method: 'POST', body: JSON.stringify(r) })).data; }
    async updateRole(r: RoleDefinition) { return (await this.request<{success:boolean, data: RoleDefinition}>(`/roles/${r.id}`, { method: 'PUT', body: JSON.stringify(r) })).data; }
    async deleteRole(id: string) { return this.request<void>(`/roles/${id}`, { method: 'DELETE' }); }

    // --- Settings ---
    async getTemplateSettings() { return (await this.request<{success:boolean, data: TemplateSettings}>('/settings/templates')).data; }
    async updateTemplateSettings(s: TemplateSettings) { return (await this.request<{success:boolean, data: TemplateSettings}>('/settings/templates', { method: 'PUT', body: JSON.stringify(s) })).data; }

    async testConnection() {
        try {
            await this.request('/test-connection');
            return { success: true, message: '连接成功 (REST API)' };
        } catch (e: any) {
            return { success: false, message: e.message || '连接失败' };
        }
    }
}

export const apiService = new ApiService();
