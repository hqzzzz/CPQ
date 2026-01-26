import React, { useRef, useEffect } from 'react';
import { Filter } from 'lucide-react';

interface FilterHeaderProps {
    label: string;
    fieldKey: string;
    columnFilters: Record<string, string>;
    setColumnFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    activeFilterCol: string | null;
    setActiveFilterCol: React.Dispatch<React.SetStateAction<string | null>>;
}

const FilterHeader: React.FC<FilterHeaderProps> = ({ 
    label, 
    fieldKey, 
    columnFilters, 
    setColumnFilters, 
    activeFilterCol, 
    setActiveFilterCol 
}) => {
    const isActive = !!columnFilters[fieldKey];
    const isOpen = activeFilterCol === fieldKey;
    const filterMenuRef = useRef<HTMLDivElement>(null);

    // Handle outside click to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                if (isOpen) setActiveFilterCol(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, setActiveFilterCol]);

    return (
        <div className="flex items-center gap-1.5 relative">
            <span>{label}</span>
            <button 
                onClick={(e) => { e.stopPropagation(); setActiveFilterCol(isOpen ? null : fieldKey); }}
                className={`p-1 rounded transition-colors ${isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                title="筛选"
            >
                <Filter className="w-3.5 h-3.5" strokeWidth={isActive ? 2.5 : 2} />
            </button>
            {isOpen && (
                <div 
                    ref={filterMenuRef}
                    className="absolute top-8 left-0 z-50 w-56 bg-white rounded-lg shadow-xl border border-slate-200 p-3"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="mb-2 text-xs font-semibold text-slate-500">筛选: {label}</div>
                    <input 
                        type="text" 
                        autoFocus
                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none mb-3 text-slate-800"
                        placeholder="输入关键词..."
                        value={columnFilters[fieldKey] || ''}
                        onChange={e => setColumnFilters(prev => ({...prev, [fieldKey]: e.target.value}))}
                        onKeyDown={e => {
                            if (e.key === 'Enter') setActiveFilterCol(null);
                        }}
                    />
                    <div className="flex justify-between items-center">
                         <button 
                            onClick={() => {
                                const newFilters = {...columnFilters};
                                delete newFilters[fieldKey];
                                setColumnFilters(newFilters);
                                setActiveFilterCol(null);
                            }}
                            className="text-xs px-2 py-1 text-slate-500 hover:bg-slate-100 rounded"
                        >
                            重置
                        </button>
                        <button 
                            onClick={() => setActiveFilterCol(null)}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                        >
                            完成
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterHeader;