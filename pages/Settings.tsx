import React, { useState } from 'react';
import ProfileSettings from '../components/settings/ProfileSettings';
import UserManagement from '../components/settings/UserManagement';
import RoleManagement from '../components/settings/RoleManagement';
import DataSourceSettings from '../components/settings/DataSourceSettings';

type TabType = 'profile' | 'users' | 'roles' | 'datasource';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">系统设置</h2>
            <p className="text-slate-500">管理个人资料、系统用户及数据连接。</p>
        </div>
        
        {/* Tab Switcher */}
        <div className="bg-white rounded-lg p-1 border border-slate-200 flex gap-1">
            <button 
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
                个人中心
            </button>
            <button 
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
                人员管理
            </button>
            <button 
                onClick={() => setActiveTab('roles')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'roles' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
                角色权限
            </button>
            <button 
                onClick={() => setActiveTab('datasource')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'datasource' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
                数据源配置
            </button>
        </div>
      </div>

      {activeTab === 'profile' && <ProfileSettings />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'roles' && <RoleManagement />}
      {activeTab === 'datasource' && <DataSourceSettings />}
    </div>
  );
};

export default Settings;