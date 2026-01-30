import React, { useState } from 'react';
import { Globe, Save, CheckCircle, RefreshCcw, Wifi, Key, Server, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { apiService } from '../../services/api';

const DataSourceSettings = () => {
    const { fetchData } = useStore();
    const [isSaved, setIsSaved] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{success?: boolean, message?: string} | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // API Config
    const [apiConfig, setApiConfig] = useState(() => {
        const saved = localStorage.getItem('cpq_api_config');
        return saved ? JSON.parse(saved) : {
            baseUrl: 'https://api.your-backend.com/v1',
            apiKey: '',
            timeout: 10000
        };
    });

    const handleSaveSettings = () => {
        localStorage.setItem('cpq_api_config', JSON.stringify(apiConfig));
        // Force DataSource to API implicitly
        localStorage.setItem('cpq_datasource', 'api');
        
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
        
        // Reload data using new settings
        fetchData();
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setConnectionStatus(null);
        // Save temporary config so apiService can read it
        localStorage.setItem('cpq_api_config', JSON.stringify(apiConfig));
        
        const result = await apiService.testConnection();
        setConnectionStatus(result);
        setIsTesting(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Globe className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">REST API 接口配置</h3>
                        <p className="text-sm text-slate-500">配置后端服务器连接信息。系统将通过 API 同步所有业务数据。</p>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-800 font-medium">
                            <Server className="w-4 h-4" /> 
                            服务器连接参数
                        </div>
                        <button 
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 border border-blue-200 bg-white px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
                        >
                            {isTesting ? <RefreshCcw className="w-3 h-3 animate-spin"/> : <Wifi className="w-3 h-3"/>}
                            {isTesting ? '连接中...' : '测试连接'}
                        </button>
                    </div>

                    {connectionStatus && (
                        <div className={`mb-4 p-3 rounded-lg text-sm border flex items-center gap-2 animate-in fade-in slide-in-from-top-1 ${connectionStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {connectionStatus.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            {connectionStatus.message}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                API Base URL (基础地址)
                            </label>
                            <input 
                                type="text" 
                                className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                                placeholder="https://api.example.com/v1"
                                value={apiConfig.baseUrl} 
                                onChange={e => setApiConfig({...apiConfig, baseUrl: e.target.value})} 
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                指向后端服务的根路径，例如: <code>http://localhost:8080/api</code>
                            </p>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">API Key / Token</label>
                            <div className="relative">
                                <input 
                                    type="password" 
                                    className="w-full p-2.5 pl-9 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                                    placeholder="Bearer Token..."
                                    value={apiConfig.apiKey} 
                                    onChange={e => setApiConfig({...apiConfig, apiKey: e.target.value})} 
                                />
                                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            </div>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">请求超时 (ms)</label>
                            <input 
                                type="number" 
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                                value={apiConfig.timeout} 
                                onChange={e => setApiConfig({...apiConfig, timeout: Number(e.target.value)})} 
                            />
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                        <p className="font-bold mb-2 flex items-center gap-1"><Server className="w-3 h-3"/> 接口规范要求:</p>
                        <ul className="list-disc pl-4 space-y-1 opacity-80">
                            <li>必须支持 CORS (跨域资源共享)。</li>
                            <li>遵循 RESTful 风格: <code>GET /products</code>, <code>POST /products</code>, <code>PUT /products/:id</code>。</li>
                            <li>鉴权方式为 Bearer Token (Authorization Header)。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button 
                    onClick={handleSaveSettings}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 font-medium"
                >
                    {isSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {isSaved ? '配置已保存' : '保存系统配置'}
                </button>
            </div>
        </div>
    );
};

export default DataSourceSettings;