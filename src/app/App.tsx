import { RouterProvider } from 'react-router';
import { router } from './routes';
import { InventoryProvider } from './contexts/InventoryContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { LaborProvider } from './contexts/LaborContext';
import { WasteProvider } from './contexts/WasteContext';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <WasteProvider>
          <LaborProvider>
            <ToastProvider>
              <RouterProvider router={router} />
              <Toaster />
            </ToastProvider>
          </LaborProvider>
        </WasteProvider>
      </InventoryProvider>
    </AuthProvider>
  );
}

export default App;
