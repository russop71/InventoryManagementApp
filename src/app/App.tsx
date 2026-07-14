import { RouterProvider } from 'react-router';
import { router } from './routes';
import { InventoryProvider } from './contexts/InventoryContext';
import { ToastProvider } from './contexts/ToastContext';
import { Toaster } from './components/ui/sonner';
import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';

function App() {
  useEffect(() => {
    document.title = "86'D - Restaurant Inventory Management";
  }, []);

  return (
    <ToastProvider>
      <InventoryProvider>
        <RouterProvider router={router} />
        <Toaster />
        <Analytics />
      </InventoryProvider>
    </ToastProvider>
  );
}

export default App;