import { createBrowserRouter, isRouteErrorResponse, useRouteError } from 'react-router';
import { DashboardLayout, RootLayout } from '../components/layout/Layouts.jsx';
import { GuestOnly, ProtectedRoute } from '../components/layout/ProtectedRoute.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import AboutPage from '../pages/public/AboutPage.jsx';
import { LoginPage, RegisterPage } from '../pages/public/AuthPages.jsx';
import CampaignDetailPage from '../pages/public/CampaignDetailPage.jsx';
import CampaignsPage from '../pages/public/CampaignsPage.jsx';
import CreatorDetailPage from '../pages/public/CreatorDetailPage.jsx';
import CreatorsPage from '../pages/public/CreatorsPage.jsx';
import HomePage from '../pages/public/HomePage.jsx';
import NotFoundPage from '../pages/public/NotFoundPage.jsx';

/** Dashboard pages are code-split so public pages load less JavaScript. */
const page = (load, props) => async () => {
  const { default: Page } = await load();
  return { Component: props ? () => <Page {...props} /> : Page };
};

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div className="container-page py-24">
      <h1 className="text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted">An unexpected error stopped this page from loading. Reloading usually fixes it.</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-forest px-4 py-2 text-sm text-ivory">
          Reload
        </button>
        <ButtonLink to="/" variant="ghost">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'creators', element: <CreatorsPage /> },
      { path: 'creators/:id', element: <CreatorDetailPage /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      { path: 'campaigns/:id', element: <CampaignDetailPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'login', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: 'register', element: <GuestOnly><RegisterPage /></GuestOnly> },
      {
        element: <ProtectedRoute />,
        children: [{ path: 'projects/:id', lazy: page(() => import('../pages/shared/ProjectDetail.jsx')) }],
      },
      {
        path: 'creator',
        element: <ProtectedRoute role="creator" />,
        children: [
          {
            element: <DashboardLayout role="creator" />,
            children: [
              { path: 'dashboard', lazy: page(() => import('../pages/creator/CreatorDashboard.jsx')) },
              { path: 'profile/edit', lazy: page(() => import('../pages/creator/CreatorProfileEdit.jsx')) },
              { path: 'portfolio', lazy: page(() => import('../pages/creator/CreatorPortfolio.jsx')) },
              { path: 'applications', lazy: page(() => import('../pages/creator/CreatorApplications.jsx')) },
              { path: 'invitations', lazy: page(() => import('../pages/creator/CreatorInvitations.jsx')) },
              { path: 'projects', lazy: page(() => import('../pages/shared/ProjectsList.jsx'), { role: 'creator' }) },
            ],
          },
        ],
      },
      {
        path: 'brand',
        element: <ProtectedRoute role="brand" />,
        children: [
          {
            element: <DashboardLayout role="brand" />,
            children: [
              { path: 'dashboard', lazy: page(() => import('../pages/brand/BrandDashboard.jsx')) },
              { path: 'campaigns', lazy: page(() => import('../pages/brand/BrandCampaigns.jsx')) },
              { path: 'campaigns/new', lazy: page(() => import('../pages/brand/CampaignFormPage.jsx')) },
              { path: 'campaigns/:id/edit', lazy: page(() => import('../pages/brand/CampaignFormPage.jsx')) },
              { path: 'campaigns/:id/applicants', lazy: page(() => import('../pages/brand/CampaignApplicants.jsx')) },
              { path: 'applications', lazy: page(() => import('../pages/brand/BrandApplications.jsx')) },
              { path: 'invitations', lazy: page(() => import('../pages/brand/BrandInvitations.jsx')) },
              { path: 'projects', lazy: page(() => import('../pages/shared/ProjectsList.jsx'), { role: 'brand' }) },
              { path: 'profile', lazy: page(() => import('../pages/brand/BrandProfile.jsx')) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
