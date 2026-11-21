import { MessageCircle } from 'lucide-react';
import { whatsAppLink } from '../utils/phoneUtils';

/**
 * A customer's phone number that opens a WhatsApp chat with them (new tab, or the
 * WhatsApp app on a phone). Falls back to plain text when the number isn't usable.
 * Clicks don't reach the parent, so it can sit in a row that expands on click.
 */
export default function WhatsAppPhone({ phone, className = '', iconClassName = 'w-3.5 h-3.5' }) {
  if (!phone) return null;
  const href = whatsAppLink(phone);
  if (!href) return <span className={className}>{phone}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Chat on WhatsApp"
      className={`inline-flex items-center gap-1 text-green-400 hover:text-green-300 hover:underline ${className}`}
    >
      {phone}
      <MessageCircle className={`${iconClassName} shrink-0`} aria-hidden="true" />
      <span className="sr-only">(WhatsApp)</span>
    </a>
  );
}
