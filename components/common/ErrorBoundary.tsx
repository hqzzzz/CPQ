import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Settings } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    // Clear potentially bad data/settings causing the crash
    localStorage.removeItem('cpq_api_config');
    localStorage.removeItem('cpq_datasource');
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-xl border border-slate-200 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">应用遇到错误</h1>
            <p className="text-slate-500 mb-6 text-sm">
              可能是由于 API 配置错误或数据格式不匹配导致的系统崩溃。
            </p>
            
            <div className="bg-slate-100 p-3 rounded-lg text-left mb-6 overflow-auto max-h-32">
                <code className="text-xs text-red-500 font-mono break-all">
                    {this.state.error?.message}
                </code>
            </div>

            <div className="flex flex-col gap-3">
                <button 
                    onClick={this.handleReload}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                >
                    <RefreshCcw className="w-4 h-4" /> 刷新页面重试
                </button>
                <button 
                    onClick={this.handleReset}
                    className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                >
                    <Settings className="w-4 h-4" /> 重置系统设置
                </button>
            </div>
            <p className="mt-4 text-xs text-slate-400">点击“重置系统设置”将清除 API 连接信息并恢复默认状态。</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;