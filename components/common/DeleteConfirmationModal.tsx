import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: React.ReactNode;
  usageWarning?: string | null; // If provided, shows warning style
  confirmText?: string;
  isWarning?: boolean; // Forces warning style even without usage string
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  usageWarning,
  confirmText = "确认删除",
  isWarning = false
}) => {
  if (!isOpen) return null;

  const showWarning = !!usageWarning || isWarning;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-100">
        <div className="p-6 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${showWarning ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
            {showWarning ? <AlertTriangle className="w-7 h-7" /> : <Trash2 className="w-7 h-7" />}
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {title}
          </h3>
          <div className="text-slate-500 text-sm mb-6 leading-relaxed px-2 text-left">
             {/* If usage warning is provided, show specific layout */}
             {usageWarning ? (
                 <>
                    <div className="mb-2 text-center text-slate-600">{message}</div>
                    <div className="text-amber-700 bg-amber-50 px-3 py-2 rounded text-xs border border-amber-100 mb-2">
                       <strong>关联引用:</strong><br/>
                       {usageWarning}
                    </div>
                    <div className="text-center text-xs text-slate-400">强制删除可能导致数据不一致。</div>
                 </>
             ) : (
                 <div className="text-center">{message}</div>
             )}
          </div>
          <div className="flex gap-3 justify-center w-full">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-medium"
            >
              取消
            </button>
            <button 
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 rounded-lg text-white shadow-md transition-colors font-medium flex items-center justify-center gap-2 ${
                showWarning 
                ? 'bg-amber-600 hover:bg-amber-700' 
                : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;