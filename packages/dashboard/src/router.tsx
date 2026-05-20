import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { PageListPage } from './pages/PageListPage';
import { PageDetailPage } from './pages/PageDetailPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'pages', element: <PageListPage /> },
      { path: 'pages/:slug', element: <PageDetailPage /> },
    ],
  },
]);
