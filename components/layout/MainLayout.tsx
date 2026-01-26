import React from 'react';
import Sidebar from '../Sidebar';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => (
    <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 overflow-y-auto max-h-screen">
            {children}
        </main>
    </div>
);

export default MainLayout;