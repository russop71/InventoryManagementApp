import { Suspense } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#FBFAF6] font-bold text-[#303A43]">Loading ZestIQ…</div>}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
