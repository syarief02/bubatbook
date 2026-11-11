import { useQuery } from '@tanstack/react-query';
import { FileText, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SignedLink } from './SignedFile';
import { DOC_LABELS, daysLeft } from '../utils/carDocuments';
import { formatDate } from '../utils/dates';

/**
 * The road tax, insurance and Puspakom of the car a customer is renting now,
 * with the files to open (e.g. at a roadblock or after an accident). The
 * database gives them only for the customer's own booking and only during
 * the rental; show this for a booking where isCurrentRental() is true.
 */
export default function RentalCarDocuments({ bookingId }) {
  const { data: docs, isLoading } = useQuery({
    queryKey: ['rental-car-documents', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bubatrent_my_rental_car_documents', {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (isLoading || !docs) return null;

  return (
    <div className="mb-3 rounded-xl bg-white/[0.03] p-3 text-xs space-y-2">
      <p className="text-slate-400 font-medium flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5" /> Car documents
      </p>
      {docs.length === 0 ? (
        <p className="text-slate-500">
          None on file yet. Ask us on WhatsApp for the road tax or insurance.
        </p>
      ) : (
        docs.map((d) => {
          const expired = daysLeft(d.valid_until) < 0;
          return (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-slate-200">
                  {DOC_LABELS[d.doc_type]}
                  {d.provider && <span className="text-slate-500"> · {d.provider}</span>}
                </p>
                <p className={expired ? 'text-red-400' : 'text-slate-500'}>
                  {expired ? 'Expired on' : 'Valid until'} {formatDate(d.valid_until)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {d.file_paths.map((path, i) => (
                  <SignedLink
                    key={path}
                    path={path}
                    className="text-cyan-500/70 hover:text-cyan-400 flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    {d.file_paths.length > 1 ? `File ${i + 1}` : 'View'}
                  </SignedLink>
                ))}
              </div>
            </div>
          );
        })
      )}
      {docs.length > 0 && (
        <p className="text-slate-500">
          Show these if the police or JPJ ask. They are here while you have the car.
        </p>
      )}
    </div>
  );
}
