import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import AppLayout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Spin } from 'antd';

// 关键页面（首屏立即加载）
import Login from '../pages/Login/index';
import Dashboard from '../pages/Dashboard';

// 按需加载（lazy load）
const PositionsList = lazy(() => import('../pages/Positions/List'));
const PositionForm = lazy(() => import('../pages/Positions/Form'));
const ResumesList = lazy(() => import('../pages/Resumes/List'));
const ResumeUpload = lazy(() => import('../pages/Resumes/Upload'));
const ResumeDetail = lazy(() => import('../pages/Resumes/Detail'));
const InterviewsList = lazy(() => import('../pages/Interviews/List'));
const InterviewScore = lazy(() => import('../pages/Interviews/Score'));
const InterviewResultPage = lazy(() => import('../pages/Interviews/Result'));
const PublicJobDetail = lazy(() => import('../pages/Public/JobDetail'));
const PublicReview = lazy(() => import('../pages/Public/Review'));
const UsersList = lazy(() => import('../pages/Settings/Users'));
const ProfileSettings = lazy(() => import('../pages/Settings/Profile'));
const SystemSettingsPage = lazy(() => import('../pages/Settings/System'));
const WorkflowsList = lazy(() => import('../pages/Workflows/List'));
const WorkflowEditor = lazy(() => import('../pages/Workflows/Editor'));
const RequisitionsList = lazy(() => import('../pages/Requisitions/List'));
const TalentPoolList = lazy(() => import('../pages/TalentPool/List'));
const InterviewerMappingList = lazy(() => import('../pages/InterviewerMapping/List'));
const BackgroundChecksList = lazy(() => import('../pages/BackgroundChecks/List'));
const OnboardingList = lazy(() => import('../pages/Onboarding/List'));
const ProbationList = lazy(() => import('../pages/Probation/List'));
const ResumeScreeningList = lazy(() => import('../pages/ResumeScreening/List'));
const DailyReportsList = lazy(() => import('../pages/DailyReports/List'));
const PositionMappings = lazy(() => import('../pages/Settings/PositionMappings'));
const CapabilityDimensions = lazy(() => import('../pages/Settings/CapabilityDimensions'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

/** 包裹懒加载组件的 Suspense fallback */
const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spin size="large" tip="加载中..." />
    </div>
  }>
    {children}
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/public/jobs/:id',
    element: <LazyPage><PublicJobDetail /></LazyPage>,
  },
  {
    path: '/public/review/:resumeId/:reviewerId',
    element: <LazyPage><PublicReview /></LazyPage>,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'positions',
        element: <LazyPage><PositionsList /></LazyPage>,
      },
      {
        path: 'positions/new',
        element: <LazyPage><PositionForm /></LazyPage>,
      },
      {
        path: 'positions/:id',
        element: <LazyPage><PositionForm /></LazyPage>,
      },
      {
        path: 'resumes',
        element: <LazyPage><ResumesList /></LazyPage>,
      },
      {
        path: 'resumes/new',
        element: <LazyPage><ResumeUpload /></LazyPage>,
      },
      {
        path: 'resumes/:id',
        element: <LazyPage><ResumeDetail /></LazyPage>,
      },
      {
        path: 'interviews',
        element: <LazyPage><InterviewsList /></LazyPage>,
      },
      {
        path: 'interviews/:id',
        element: <LazyPage><InterviewScore /></LazyPage>,
      },
      {
        path: 'interviews/:id/result',
        element: <LazyPage><InterviewResultPage /></LazyPage>,
      },
      {
        path: 'interviews/:id/score',
        element: <LazyPage><InterviewScore /></LazyPage>,
      },
      {
        path: 'users',
        element: <LazyPage><UsersList /></LazyPage>,
      },
      {
        path: 'users/profile',
        element: <LazyPage><ProfileSettings /></LazyPage>,
      },
      {
        path: 'settings/system',
        element: <LazyPage><SystemSettingsPage /></LazyPage>,
      },
      {
        path: 'settings/position-mappings',
        element: <LazyPage><PositionMappings /></LazyPage>,
      },
      {
        path: 'settings/capability-dimensions',
        element: <LazyPage><CapabilityDimensions /></LazyPage>,
      },
      {
        path: 'workflows',
        element: <LazyPage><WorkflowsList /></LazyPage>,
      },
      {
        path: 'workflows/:id/edit',
        element: <LazyPage><WorkflowEditor /></LazyPage>,
      },
      {
        path: 'requisitions',
        element: <LazyPage><RequisitionsList /></LazyPage>,
      },
      {
        path: 'talent-pool',
        element: <LazyPage><TalentPoolList /></LazyPage>,
      },
      {
        path: 'interviewer-mapping',
        element: <LazyPage><InterviewerMappingList /></LazyPage>,
      },
      {
        path: 'background-checks',
        element: <LazyPage><BackgroundChecksList /></LazyPage>,
      },
      {
        path: 'onboarding',
        element: <LazyPage><OnboardingList /></LazyPage>,
      },
      {
        path: 'probation',
        element: <LazyPage><ProbationList /></LazyPage>,
      },
      {
        path: 'resume-screening',
        element: <LazyPage><ResumeScreeningList /></LazyPage>,
      },
      {
        path: 'daily-reports',
        element: <LazyPage><DailyReportsList /></LazyPage>,
      },
    ],
  },
]);

export default router;
