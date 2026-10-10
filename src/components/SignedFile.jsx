import { useQuery } from '@tanstack/react-query';
import { getSignedDocumentUrl } from '../lib/storage';

// Signed URLs are valid for an hour; refetch well before they expire.
function useSignedDocumentUrl(path) {
  const { data } = useQuery({
    queryKey: ['signed-document-url', path],
    queryFn: () => getSignedDocumentUrl(path),
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    gcTime: 50 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  return data || undefined;
}

/** Link to a private customer document; opens in a new tab once the URL is signed. */
export function SignedLink({ path, children, ...props }) {
  const url = useSignedDocumentUrl(path);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-busy={!url} {...props}>
      {children}
    </a>
  );
}

/** Image of a private customer document; renders once the URL is signed. */
export function SignedImage({ path, alt, ...props }) {
  const url = useSignedDocumentUrl(path);
  if (!url) return null;
  return <img src={url} alt={alt} {...props} />;
}
