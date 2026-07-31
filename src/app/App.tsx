import { RouterProvider } from 'react-router';
import { router } from './routes';
import { InventoryProvider } from './contexts/InventoryContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    document.title = 'zestIQ - Restaurant Inventory Management';
  }, []);

  return (
    <AuthProvider>
      <InventoryProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <Toaster />
        </ToastProvider>
      </InventoryProvider>
    </AuthProvider>
  );
}

export default App;