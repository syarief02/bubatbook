import { useParams, Link } from 'react-router-dom';
import DocumentUpload from '../components/DocumentUpload';
import { ArrowLeft, Shield, FileCheck } from 'lucide-react';

export default function DocumentUploadPage() {
  const { id } = useParams();

  return (
    <div className="page-container max-w-xl mx-auto">
      <Link to={`/booking/${id}/confirmation`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to booking
      </Link>

      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
          <FileCheck className="w-7 h-7 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Upload Documents</h1>
        <p className="text-sm text-slate-400">Submit your driving licence for rental verification</p>
      </div>

      {/* Security notice */}
      <div className="glass-card !p-4 flex items-start gap-3 mb-6">
        <Shield className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          <p className="text-green-300 font-medium mb-1">Your documents are secure</p>
          <p>Files are stored in private encrypted storage, accessible only by our admin team. Sensitive data is masked and all access is logged. Documents are deleted after the rental period ends per our data retention policy.</p>
        </div>
      </div>

      <div className="glass-card">
        <DocumentUpload bookingId={id} />
      </div>
    </div>
  );
}
