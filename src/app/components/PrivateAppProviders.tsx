import { Outlet } from 'react-router';
import { InventoryProvider } from '../contexts/InventoryContext';
import { LaborProvider } from '../contexts/LaborContext';
import { ToastProvider } from '../contexts/ToastContext';
import { WasteProvider } from '../contexts/WasteContext';

export function PrivateAppProviders() {
  return (
    <InventoryProvider>
      <WasteProvider>
        <LaborProvider>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </LaborProvider>
      </WasteProvider>
    </InventoryProvider>
  );
}
