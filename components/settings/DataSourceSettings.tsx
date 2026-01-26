import React, { useState, useRef, useEffect } from 'react';
import { Database, Server, CheckCircle, Play, HardDrive, Trash2, Download, Upload, Save, Globe, Lock, Key } from 'lucide-react';
import { useStore } from '../../store';
import { initializeDB, exportDB, clearIndexedDB } from '../../services/db';

type DataSourceType = 'api' | 'sqlite' | 'mysql';

const DataSourceSettings = () => {
    const { importData, loadFromDB } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSaved, setIsSaved] = useState(false);

    // Local state for this component
    const [dataSource, setDataSource] = useState<DataSourceType>(() => {
        const saved = localStorage.getItem('cpq_datasource');
        if (saved === 'mock') return 'sqlite'; // Migrate old default
        return (saved as DataSourceType) || 'sqlite';
    });
    
    // DB Config (MySQL)
    const [dbConfig, setDbConfig] = useState(() => {
        const saved = localStorage.getItem('cpq_db_config');
        return saved ? JSON.parse(saved) : {
            host: 'localhost',
            port: '3306',
            user: 'root',
            password: '',
            database: 'cpq_db'
        };
    });

    // API Config (New)
    const [apiConfig, setApiConfig] = useState(() => {
        const saved = localStorage.getItem('cpq_api_config');
        return saved ? JSON.parse(saved) : {
            baseUrl: 'https://api.your-domain.com/v1',
            apiKey: '',
            timeout: 5000
        };
    });

    const [dbStatus, setDbStatus] = useState<'idle' | 'initializing' | 'ready'>('idle');
    const [dbMessage, setDbMessage] = useState('');

    useEffect(() => {
        if (dataSource === 'sqlite' && dbStatus === 'idle') {
            handleInitSQLite(true);
        }
    }, []);

    const handleSaveSettings = () => {
        localStorage.setItem('cpq_datasource', dataSource);
        localStorage.setItem('cpq_db_config', JSON.stringify(dbConfig));
        if (dataSource === 'api') {
            localStorage.setItem('cpq_api_config', JSON.stringify(apiConfig));
        }
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
        alert("系统配置已保存。");
    };

    const handleInitSQLite = async (silent = false) => {
        setDbStatus('initializing');
        if (!silent) setDbMessage('正在加载数据库...');
        try {
            await initializeDB();
            loadFromDB(); 
            setDbStatus('ready');
            setDbMessage('IndexedDB 存储已就绪');
            if (!silent) setDbMessage('数据库加载成功 (Persistent Storage)');
        } catch (e) {
            console.error(e);
            setDbStatus('idle');
            if (!silent) alert("初始化失败: " + e);
        }
    };

    const handleResetDB = async () => {
        if (confirm("确定要重置本地数据库吗？\n所有数据将被清空并恢复为初始演示数据。\n此操作不可恢复！")) {
            try {
                await clearIndexedDB();
                alert("数据库已清空，请刷新页面重新加载。");
                window.location.reload();
            } catch (e) {
                console.error(e);
                alert("重置失败");
            }
        }
    };

    const handleDownloadSQLite = () => {
        if (dbStatus !== 'ready') {
            alert("请先初始化数据库。");
            return;
        }
        const binaryArray = exportDB();
        if (binaryArray) {
            const blob = new Blob([binaryArray], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CPQ_Backup_${new Date().toISOString().slice(0,10)}.sqlite`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            try {
                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(content);
                    if (confirm(`准备导入:\n${data.products?.length || 0} 个产品\n${data.boms?.length || 0} 个BOM\n这将覆盖当前数据。确定吗？`)) {
                        importData(data);
                        alert('数据导入成功！');
                    }
                }
            } catch (err) {
                console.error(err);
                alert('文件解析失败，请检查格式。');
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Database className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">后端数据库 / 数据源配置</h3>
                        <p className="text-sm text-slate-500">选择系统运行所需的数据存储方式。</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <button 
                        onClick={() => { setDataSource('sqlite'); handleInitSQLite(); }}
                        className={`p-4 rounded-lg border text-left transition-all ${dataSource === 'sqlite' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-800">浏览器存储 (IndexedDB)</span>
                            {dataSource === 'sqlite' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-xs text-slate-500">
                            {dbStatus === 'ready' ? '运行中 (已持久化)' : '使用 SQLite WASM 并在本地持久化存储。'}
                        </p>
                    </button>

                    <button 
                        onClick={() => setDataSource('api')}
                        className={`p-4 rounded-lg border text-left transition-all ${dataSource === 'api' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-800">REST API 接口</span>
                            {dataSource === 'api' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-xs text-slate-500">通过 HTTP 接口连接外部业务系统或 ERP。</p>
                    </button>

                    <button 
                        onClick={() => setDataSource('mysql')}
                        className={`p-4 rounded-lg border text-left transition-all ${dataSource === 'mysql' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-800">MySQL / MariaDB</span>
                            {dataSource === 'mysql' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-xs text-slate-500">连接远程企业级数据库。支持高并发。</p>
                    </button>
                </div>

                {/* API Settings Section */}
                {dataSource === 'api' && (
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-medium">
                            <Globe className="w-4 h-4" /> 远程接口配置
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">API Base URL</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-sm" 
                                    placeholder="https://api.example.com/v1"
                                    value={apiConfig.baseUrl} 
                                    onChange={e => setApiConfig({...apiConfig, baseUrl: e.target.value})} 
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">API Key / Bearer Token</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        className="w-full p-2 pl-8 border border-slate-300 rounded-lg font-mono text-sm" 
                                        placeholder="sk-..."
                                        value={apiConfig.apiKey} 
                                        onChange={e => setApiConfig({...apiConfig, apiKey: e.target.value})} 
                                    />
                                    <Key className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">超时时间 (ms)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 border border-slate-300 rounded-lg" 
                                    value={apiConfig.timeout} 
                                    onChange={e => setApiConfig({...apiConfig, timeout: Number(e.target.value)})} 
                                />
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                            <p className="font-bold mb-1">接口规范说明:</p>
                            系统将通过 GET/POST 请求同步 Products, BOMs, Quotes 等资源。请确保接口符合 OpenAPIv3 标准并已配置 CORS。
                        </div>
                    </div>
                )}

                {/* MySQL Settings Section */}
                {dataSource === 'mysql' && (
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-medium">
                            <Server className="w-4 h-4" /> 远程数据库连接信息
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">主机地址 (Host)</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded-lg" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">端口 (Port)</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded-lg" value={dbConfig.port} onChange={e => setDbConfig({...dbConfig, port: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">用户名 (User)</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded-lg" value={dbConfig.user} onChange={e => setDbConfig({...dbConfig, user: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">密码 (Password)</label>
                                <input type="password" className="w-full p-2 border border-slate-300 rounded-lg" value={dbConfig.password} onChange={e => setDbConfig({...dbConfig, password: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">数据库名 (Database)</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded-lg" value={dbConfig.database} onChange={e => setDbConfig({...dbConfig, database: e.target.value})} />
                            </div>
                        </div>
                    </div>
                )}

                {/* SQLite (Browser) Section */}
                {dataSource === 'sqlite' && (
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4">
                        <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                {dbStatus === 'ready' ? <HardDrive className="w-8 h-8 text-emerald-500" /> : <Play className="w-8 h-8 text-blue-500" />}
                                <div>
                                    <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        {dbStatus === 'ready' ? `本地数据库运行中` : '等待初始化'}
                                        {dbStatus === 'ready' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">IndexedDB On</span>}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {dbStatus === 'ready' ? dbMessage : '数据将存储在您的浏览器中，刷新页面不会丢失。'}
                                    </p>
                                </div>
                            </div>
                            {dbStatus === 'ready' && (
                                <div className="flex gap-2">
                                    <button onClick={handleResetDB} className="bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors">
                                        <Trash2 className="w-4 h-4" /> 重置/清空
                                    </button>
                                </div>
                            )}
                            {dbStatus !== 'ready' && (
                                <button onClick={() => handleInitSQLite()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm">
                                    <Play className="w-4 h-4" /> 初始化数据库
                                </button>
                            )}
                        </div>
                        {dbStatus === 'ready' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <button onClick={handleDownloadSQLite} className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm">
                                    <Download className="w-4 h-4" /> <span>备份下载 (.sqlite)</span>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-purple-400 hover:text-purple-600 transition-colors shadow-sm">
                                    <Upload className="w-4 h-4" /> <span>导入数据 (JSON)</span>
                                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <button 
                    onClick={handleSaveSettings}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                    {isSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {isSaved ? '设置已保存' : '保存系统设置'}
                </button>
            </div>
        </div>
    );
};

export default DataSourceSettings;