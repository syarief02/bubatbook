import { Car, Shield, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-dark-950/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Car className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold gradient-text">BubatRent</span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed">
              Premium car rental in Malaysia. Browse our fleet, pick your dates, and book instantly with secure deposit payment.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">Browse Cars</Link>
              </li>
              <li>
                <Link to="/my-bookings" className="text-sm text-slate-400 hover:text-white transition-colors">My Bookings</Link>
              </li>
              <li>
                <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Sign In</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-slate-400">
                <Phone className="w-4 h-4 text-violet-400" />
                <span>+60 12-345 6789</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-400">
                <Mail className="w-4 h-4 text-violet-400" />
                <span>hello@bubatrent.my</span>
              </li>
            </ul>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
              <Shield className="w-3.5 h-3.5" />
              <span>Secure booking · Verified fleet</span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 mt-8 pt-8 text-center">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} BubatRent. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
