import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProtectedPatientRoute } from './components/ProtectedPatientRoute';
import { RoleRedirect } from './components/RoleRedirect';

// Cada página vira um pedaço (chunk) separado do JavaScript, baixado só quando
// a rota é visitada — evita mandar o app inteiro (todas as telas do profissional
// e do paciente) no primeiro carregamento.
const LoginPage = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/Register').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPasswordPage })));
const DashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const PatientListPage = lazy(() => import('./pages/patients/PatientList').then((m) => ({ default: m.PatientListPage })));
const PatientFormPage = lazy(() => import('./pages/patients/PatientForm').then((m) => ({ default: m.PatientFormPage })));
const PatientRecordPage = lazy(() => import('./pages/patients/PatientRecord').then((m) => ({ default: m.PatientRecordPage })));
const ConsentPage = lazy(() => import('./pages/patients/ConsentPage').then((m) => ({ default: m.ConsentPage })));
const NewVisitWizard = lazy(() => import('./pages/visits/NewVisitWizard').then((m) => ({ default: m.NewVisitWizard })));
const AvailabilitySettingsPage = lazy(() => import('./pages/professional/AvailabilitySettings').then((m) => ({ default: m.AvailabilitySettingsPage })));
const ProfessionalValidationPage = lazy(() => import('./pages/professional/ProfessionalValidation').then((m) => ({ default: m.ProfessionalValidationPage })));
const PatientRegisterPage = lazy(() => import('./pages/patientApp/PatientRegister').then((m) => ({ default: m.PatientRegisterPage })));
const PatientHomePage = lazy(() => import('./pages/patientApp/PatientHome').then((m) => ({ default: m.PatientHomePage })));
const PatientCarePage = lazy(() => import('./pages/patientApp/PatientCare').then((m) => ({ default: m.PatientCarePage })));
const PatientHistoryPage = lazy(() => import('./pages/patientApp/PatientHistory').then((m) => ({ default: m.PatientHistoryPage })));
const PatientProfilePage = lazy(() => import('./pages/patientApp/PatientProfile').then((m) => ({ default: m.PatientProfilePage })));
const PatientPreAnamnesisPage = lazy(() => import('./pages/patientApp/PatientPreAnamnesis').then((m) => ({ default: m.PatientPreAnamnesisPage })));
const PatientSearchPage = lazy(() => import('./pages/patientApp/PatientSearch').then((m) => ({ default: m.PatientSearchPage })));

function RouteLoading() {
  return <p style={{ padding: 24 }}>Carregando…</p>;
}

function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route path="/patient/login" element={<LoginPage />} />
        <Route path="/patient/register" element={<PatientRegisterPage />} />

        <Route
          path="/app/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/patients"
          element={
            <ProtectedRoute>
              <PatientListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/patients/new"
          element={
            <ProtectedRoute>
              <PatientFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/patients/:id"
          element={
            <ProtectedRoute>
              <PatientRecordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/patients/:id/edit"
          element={
            <ProtectedRoute>
              <PatientFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/patients/:id/consent"
          element={
            <ProtectedRoute>
              <ConsentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/patients/:id/visits/new"
          element={
            <ProtectedRoute>
              <NewVisitWizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/availability"
          element={
            <ProtectedRoute>
              <AvailabilitySettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/professional-info"
          element={
            <ProtectedRoute>
              <ProfessionalValidationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/home"
          element={
            <ProtectedPatientRoute>
              <PatientHomePage />
            </ProtectedPatientRoute>
          }
        />
        <Route
          path="/patient/care"
          element={
            <ProtectedPatientRoute>
              <PatientCarePage />
            </ProtectedPatientRoute>
          }
        />
        <Route
          path="/patient/history"
          element={
            <ProtectedPatientRoute>
              <PatientHistoryPage />
            </ProtectedPatientRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <ProtectedPatientRoute>
              <PatientProfilePage />
            </ProtectedPatientRoute>
          }
        />
        <Route
          path="/patient/pre-anamnesis"
          element={
            <ProtectedPatientRoute>
              <PatientPreAnamnesisPage />
            </ProtectedPatientRoute>
          }
        />
        <Route
          path="/patient/search"
          element={
            <ProtectedPatientRoute>
              <PatientSearchPage />
            </ProtectedPatientRoute>
          }
        />

        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </Suspense>
  );
}

export default App;
