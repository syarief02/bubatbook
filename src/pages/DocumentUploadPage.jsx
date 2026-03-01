import { Navigate } from 'react-router-dom';

// Legacy per-booking document upload — now redirects to profile-based verification
export default function DocumentUploadPage() {
  return <Navigate to="/verify" replace />;
}
