import React from 'react';
import { X } from 'lucide-react';
import { Store } from '../../../types';
import { StoreFleetQrDisplayView } from './pairing/StoreFleetQrDisplayView';
import { DriverFleetPairFormView } from './pairing/DriverFleetPairFormView';

interface DriverQrPairingModalProps {
  currentStore: Store;
  onClose: () => void;
  isDriverClient?: boolean;
  onPairSuccess?: (info: { storeId: string; storeName: string; driverName: string }) => void;
}

export const DriverQrPairingModal: React.FC<DriverQrPairingModalProps> = ({
  currentStore,
  onClose,
  isDriverClient = false,
  onPairSuccess,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden p-6 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-950/60 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!isDriverClient ? (
          <StoreFleetQrDisplayView currentStore={currentStore} />
        ) : (
          <DriverFleetPairFormView
            currentStore={currentStore}
            onClose={onClose}
            onPairSuccess={onPairSuccess}
          />
        )}
      </div>
    </div>
  );
};
