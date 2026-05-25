import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Filter, Check, Search } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface MultiSelectFilterProps {
    label: string;
    fieldKey: string;
    options: Option[];
    columnFilters: Record<string, string>;
    setColumnFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    activeFilterCol: string | null;
    setActiveFilterCol: React.Dispatch<React.SetStateAction<string | null>>;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
    label,
    fieldKey,
    options,
    columnFilters,
    setColumnFilters,
    activeFilterCol,
    setActiveFilterCol
}) => {
    const rawValue = columnFilters[fieldKey] || '';
    const selectedValues = useMemo(() => rawValue ? rawValue.split(',') : [], [rawValue]);
    const isActive = selectedValues.length > 0;
    const isOpen = activeFilterCol === fieldKey;
    const filterMenuRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');

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

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lower = searchTerm.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(lower));
    }, [options, searchTerm]);

    const toggleOption = (value: string) => {
        const current = new Set(selectedValues);
        if (current.has(value)) {
            current.delete(value);
        } else {
            current.add(value);
        }
        const newVal = Array.from(current).join(',');
        setColumnFilters(prev => {
            if (newVal === '') {
                const next = { ...prev };
                delete next[fieldKey];
                return next;
            }
            return { ...prev, [fieldKey]: newVal };
        });
    };

    const selectAll = () => {
        const allValues = options.map(o => o.value).join(',');
        setColumnFilters(prev => ({ ...prev, [fieldKey]: allValues }));
    };

    const clearAll = () => {
        const next = { ...columnFilters };
        delete next[fieldKey];
        setColumnFilters(next);
        setActiveFilterCol(null);
    };

    return (
        <div className="flex items-center gap-1.5 relative">
            <span>{label}</span>
            <button
                onClick={(e) => { e.stopPropagation(); setActiveFilterCol(isOpen ? null : fieldKey); }}
                className={`p-1 rounded transition-colors ${isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                title="多选筛选"
            >
                <Filter className="w-3.5 h-3.5" strokeWidth={isActive ? 2.5 : 2} />
            </button>
            {isOpen && (
                <div
                    ref={filterMenuRef}
                    className="absolute top-8 left-0 z-50 w-64 bg-white rounded-lg shadow-xl border border-slate-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-slate-100">
                        <div className="text-xs font-semibold text-slate-500 mb-2">筛选: {label}</div>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                            <input
                                type="text"
                                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700"
                                placeholder="搜索..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-slate-400 text-center">无匹配选项</div>
                        ) : filteredOptions.map(opt => {
                            const checked = selectedValues.includes(opt.value);
                            return (
                                <label
                                    key={opt.value}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                        checked
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-slate-300 hover:border-blue-400'
                                    }`}>
                                        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                    </div>
                                    <span className="text-sm text-slate-700 truncate">{opt.label}</span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Footer actions */}
                    <div className="px-3 py-2 border-t border-slate-100 flex justify-between items-center">
                        <div className="flex gap-2">
                            <button
                                onClick={selectAll}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                                全选
                            </button>
                            <button
                                onClick={clearAll}
                                className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
                            >
                                清除
                            </button>
                        </div>
                        <button
                            onClick={() => setActiveFilterCol(null)}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                        >
                            确定
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelectFilter;