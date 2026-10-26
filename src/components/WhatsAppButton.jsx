import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useCar, useCarContact } from '../hooks/useCars';

const DEFAULT_PHONE = '60194961568'; // Default fallback
const DEFAULT_MSG = 'Hi, I want to inquire about car rental at Rent2Go!';

export default function WhatsAppButton() {
  const location = useLocation();
  // On /cars/:id or /checkout/:id, chat with whoever looks after that car
  // (the car page's address is the plate, e.g. /cars/vjc5290, or an older id link)
  const carId = location.pathname.match(/\/(?:cars|checkout)\/([a-zA-Z0-9-]+)/)?.[1];
  const { car } = useCar(carId);
  const contact = useCarContact(car?.id);

  const phoneNumber = (carId && contact?.whatsapp) || DEFAULT_PHONE;
  const message =
    carId && contact?.whatsapp && car
      ? `Hi ${contact.name || 'Admin'}, I want to inquire about the ${car.brand} ${car.model} on Rent2Go!`
      : DEFAULT_MSG;

  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="print:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 group"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="w-7 h-7 text-white" />
      <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-dark-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Chat with us
      </span>
    </a>
  );
}
