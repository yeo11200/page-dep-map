import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { PageListPage } from './pages/PageListPage';
import { PageDetailPage } from './pages/PageDetailPage';
import { ApiListPage } from './pages/ApiListPage';
import { ApiDetailPage } from './pages/ApiDetailPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'pages', element: <PageListPage /> },
      { path: 'pages/:slug', element: <PageDetailPage /> },
      { path: 'apis', element: <ApiListPage /> },
      { path: 'apis/:id', element: <ApiDetailPage /> },
    ],
  },
]);
