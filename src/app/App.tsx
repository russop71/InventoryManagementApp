import { RouterProvider } from 'react-router';
import { router } from './routes';
import { InventoryProvider } from './contexts/InventoryContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { LaborProvider } from './contexts/LaborContext';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <LaborProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <Toaster />
          </ToastProvider>
        </LaborProvider>
      </InventoryProvider>
    </AuthProvider>
  );
}

export default App;
