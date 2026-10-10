import { RouterProvider } from 'react-router';
import { Providers } from './providers.jsx';
import { router } from './router.jsx';

export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
