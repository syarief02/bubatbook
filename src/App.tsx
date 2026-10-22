import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ViewAsProvider, useViewAs } from './hooks/ViewAsContext.jsx';
import { FleetProvider } from './hooks/useFleet.jsx';
import GroupStatusGuard from './components/GroupStatusGuard';
import ViewAsBanner from './components/ViewAsBanner';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import ScrollToTop from './components/ScrollToTop';
import { ToastProvider } from './components/Toast';

const Home = lazy(() => import('./pages/Home'));
const CarDetail = lazy(() => import('./pages/CarDetail'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
const Checkout = lazy(() => import('./pages/Checkout'));
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'));
const DocumentUploadPage = lazy(() => import('./pages/DocumentUploadPage'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminCars = lazy(() => import('./pages/admin/Cars'));
const AdminCarDocuments = lazy(() => import('./pages/admin/CarDocuments'));
const AdminCarHistory = lazy(() => import('./pages/admin/CarHistory'));
const AdminCustomerHistory = lazy(() => import('./pages/admin/CustomerHistory'));
const AdminCounter = lazy(() => import('./pages/admin/Counter'));
const AdminBookings = lazy(() => import('./pages/admin/Bookings'));
const AdminBookingDetail = lazy(() => import('./pages/admin/BookingDetail'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const VerifyAccount = lazy(() => import('./pages/VerifyAccount'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminSales = lazy(() => import('./pages/admin/Sales'));
const AdminExpenses = lazy(() => import('./pages/admin/Expenses'));
const FleetSettings = lazy(() => import('./pages/admin/FleetSettings'));
const GroupManagement = lazy(() => import('./pages/admin/GroupManagement'));
const ChangeRequests = lazy(() => import('./pages/admin/ChangeRequests'));
const GroupMembers = lazy(() => import('./pages/admin/GroupMembers'));
const CreateCustomer = lazy(() => import('./pages/admin/CreateCustomer'));
const AdminBookForCustomer = lazy(() => import('./pages/admin/AdminBookForCustomer'));
const UserManual = lazy(() => import('./pages/admin/UserManual'));
const UploadLogs = lazy(() => import('./pages/admin/UploadLogs'));
const RentalAgreement = lazy(() => import('./pages/RentalAgreement'));
const Invoice = lazy(() => import('./pages/Invoice'));
const Privacy = lazy(() => import('./pages/Privacy'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children, requireMobile = true }) {
  const { user, loading, needsMobile } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSpinner fullScreen />;
  const returnTo = encodeURIComponent(location.pathname + location.search);
  if (!user) {
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  // Customers add a mobile number (e.g. after Google sign-up) before using account pages
  if (requireMobile && needsMobile) {
    return <Navigate to={`/complete-profile?returnTo=${returnTo}`} replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return (
    <FleetProvider userId={user.id} isSuperAdmin={isSuperAdmin}>
      <GroupStatusGuard>{children}</GroupStatusGuard>
    </FleetProvider>
  );
}

function AppRoutes() {
  const { isViewMode } = useViewAs();

  return (
    <>
      <ViewAsBanner />
      <Navbar />
      <ScrollToTop />
      <main className={`min-h-screen ${isViewMode ? 'pt-[7rem]' : 'pt-16'}`}>
        <Suspense fallback={<LoadingSpinner fullScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cars/:id" element={<CarDetail />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/complete-profile"
              element={
                <ProtectedRoute requireMobile={false}>
                  <CompleteProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout/:carId"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/verify"
              element={
                <ProtectedRoute>
                  <VerifyAccount />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/booking/:id/confirmation"
              element={
                <ProtectedRoute>
                  <BookingConfirmation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/booking/:id/documents"
              element={
                <ProtectedRoute>
                  <DocumentUploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/booking/:id/agreement"
              element={
                <ProtectedRoute>
                  <RentalAgreement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/booking/:id/invoice"
              element={
                <ProtectedRoute>
                  <Invoice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/cars"
              element={
                <AdminRoute>
                  <AdminCars />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/counter"
              element={
                <AdminRoute>
                  <AdminCounter />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/customer-history"
              element={
                <AdminRoute>
                  <AdminCustomerHistory />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/cars/:carId/history"
              element={
                <AdminRoute>
                  <AdminCarHistory />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/car-documents"
              element={
                <AdminRoute>
                  <AdminCarDocuments />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/bookings"
              element={
                <AdminRoute>
                  <AdminBookings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/bookings/:id"
              element={
                <AdminRoute>
                  <AdminBookingDetail />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <AdminRoute>
                  <AdminCustomers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/customers/create"
              element={
                <AdminRoute>
                  <CreateCustomer />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/bookings/create"
              element={
                <AdminRoute>
                  <AdminBookForCustomer />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/sales"
              element={
                <AdminRoute>
                  <AdminSales />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/expenses"
              element={
                <AdminRoute>
                  <AdminExpenses />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/fleet"
              element={
                <AdminRoute>
                  <FleetSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/fleet/members"
              element={
                <AdminRoute>
                  <GroupMembers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/groups"
              element={
                <AdminRoute>
                  <GroupManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/change-requests"
              element={
                <AdminRoute>
                  <ChangeRequests />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/manual"
              element={
                <AdminRoute>
                  <UserManual />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/upload-logs"
              element={
                <AdminRoute>
                  <UploadLogs />
                </AdminRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ViewAsProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ViewAsProvider>
    </ErrorBoundary>
  );
}
