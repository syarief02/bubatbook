import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ fullScreen = false, size = 'md' }) {
  const sizeMap = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={`${sizeMap[size]} text-violet-500 animate-spin`} />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className={`${sizeMap[size]} text-violet-500 animate-spin`} />
    </div>
  );
}
