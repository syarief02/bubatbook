import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';

const Home = lazy(() => import('./pages/Home'));
const CarDetail = lazy(() => import('./pages/CarDetail'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Checkout = lazy(() => import('./pages/Checkout'));
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'));
const DocumentUploadPage = lazy(() => import('./pages/DocumentUploadPage'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminCars = lazy(() => import('./pages/admin/Cars'));
const AdminBookings = lazy(() => import('./pages/admin/Bookings'));
const AdminBookingDetail = lazy(() => import('./pages/admin/BookingDetail'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16">
        <Suspense fallback={<LoadingSpinner fullScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cars/:id" element={<CarDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/checkout/:carId" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/booking/:id/confirmation" element={<ProtectedRoute><BookingConfirmation /></ProtectedRoute>} />
            <Route path="/booking/:id/documents" element={<ProtectedRoute><DocumentUploadPage /></ProtectedRoute>} />
            <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/cars" element={<AdminRoute><AdminCars /></AdminRoute>} />
            <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
            <Route path="/admin/bookings/:id" element={<AdminRoute><AdminBookingDetail /></AdminRoute>} />
            <Route path="/admin/customers" element={<AdminRoute><AdminCustomers /></AdminRoute>} />
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
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}
