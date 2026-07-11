import React from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import AppLayout from '../components/Layout';
import Login from '../pages/Login/index';
import Dashboard from '../pages/Dashboard';
import PositionsList from '../pages/Positions/List';
import PositionForm from '../pages/Positions/Form';
import ResumesList from '../pages/Resumes/List';
import ResumeUpload from '../pages/Resumes/Upload';
import ResumeDetail from '../pages/Resumes/Detail';
import InterviewsList from '../pages/Interviews/List';
import InterviewScore from '../pages/Interviews/Score';
import InterviewResultPage from '../pages/Interviews/Result';
import PublicJobDetail from '../pages/Public/JobDetail';
import PublicReview from '../pages/Public/Review';
import UsersList from '../pages/Settings/Users';
import ProfileSettings from '../pages/Settings/Profile';
import SystemSettingsPage from '../pages/Settings/System';
import WorkflowsList from '../pages/Workflows/List';
import RequisitionsList from '../pages/Requisitions/List';
import TalentPoolList from '../pages/TalentPool/List';
import InterviewerMappingList from '../pages/InterviewerMapping/List';
import BackgroundChecksList from '../pages/BackgroundChecks/List';
import OnboardingList from '../pages/Onboarding/List';
import ProbationList from '../pages/Probation/List';
import ResumeScreeningList from '../pages/ResumeScreening/List';
import DailyReportsList from '../pages/DailyReports/List';
import PositionMappings from '../pages/Settings/PositionMappings';
import CapabilityDimensions from '../pages/Settings/CapabilityDimensions';
import WorkflowEditor from '../pages/Workflows/Editor';
import { useAuth } from '../contexts/AuthContext';
import { Spin } from 'antd';

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

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/public/jobs/:id',
    element: <PublicJobDetail />,
  },
  {
    path: '/public/review/:resumeId/:reviewerId',
    element: <PublicReview />,
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
        element: <PositionsList />,
      },
      {
        path: 'positions/new',
        element: <PositionForm />,
      },
      {
        path: 'positions/:id',
        element: <PositionForm />,
      },
      {
        path: 'resumes',
        element: <ResumesList />,
      },
      {
        path: 'resumes/upload',
        element: <ResumeUpload />,
      },
      {
        path: 'resumes/:id',
        element: <ResumeDetail />,
      },
      {
        path: 'interviewer-mapping',
        element: <InterviewerMappingList />,
      },
      {
        path: 'interviews',
        element: <InterviewsList />,
      },
      {
        path: 'interviews/:id/score',
        element: <InterviewScore />,
      },
      {
        path: 'interviews/:id/result',
        element: <InterviewResultPage />,
      },
      {
        path: 'settings/users',
        element: <UsersList />,
      },
      {
        path: 'settings/profile',
        element: <ProfileSettings />,
      },
      {
        path: 'settings/system',
        element: <SystemSettingsPage />,
      },
      {
        path: 'workflows',
        element: <WorkflowsList />,
      },
      {
        path: 'workflows/:id',
        element: <WorkflowEditor />,
      },
      {
        path: 'requisitions',
        element: <RequisitionsList />,
      },
      {
        path: 'talent-pool',
        element: <TalentPoolList />,
      },
      {
        path: 'background-checks',
        element: <BackgroundChecksList />,
      },
      {
        path: 'onboarding',
        element: <OnboardingList />,
      },
      {
        path: 'probation',
        element: <ProbationList />,
      },
      {
        path: 'resume-screening',
        element: <ResumeScreeningList />,
      },
      {
        path: 'daily-reports',
        element: <DailyReportsList />,
      },
      {
        path: 'settings/position-mappings',
        element: <PositionMappings />,
      },
      {
        path: 'settings/capability-dimensions',
        element: <CapabilityDimensions />,
      },
    ],
  },
]);

export default router;
