import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Car, Menu, X, User, LogOut, Shield, CalendarDays } from 'lucide-react';

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const profileRef = useRef(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  // Close menus on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/');
    setProfileOpen(false);
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center transition-transform group-hover:scale-110">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">Rent2Go</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
              Browse Cars
            </Link>
            {user && (
              <Link to="/my-bookings" className="text-slate-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                My Bookings
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="text-violet-400 hover:text-violet-300 transition-colors text-sm font-medium flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-slate-300">{user.email?.split('@')[0]}</span>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 glass-card rounded-xl py-2 animate-fade-in">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-secondary text-sm !px-4 !py-2">
                  Sign In
                </Link>
                <Link to="/signup" className="btn-primary text-sm !px-4 !py-2">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden py-4 border-t border-white/5 animate-fade-in">
            <div className="flex flex-col gap-2">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                Browse Cars
              </Link>
              {user && (
                <Link
                  to="/my-bookings"
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  My Bookings
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-2 text-violet-400 hover:text-violet-300 hover:bg-white/5 rounded-xl transition-colors"
                >
                  Admin Dashboard
                </Link>
              )}
              <div className="border-t border-white/5 mt-2 pt-2">
                {user ? (
                  <button
                    onClick={() => { handleSignOut(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Sign Out
                  </button>
                ) : (
                  <div className="flex gap-2 px-4">
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm flex-1 text-center !py-2">
                      Sign In
                    </Link>
                    <Link to="/signup" onClick={() => setMenuOpen(false)} className="btn-primary text-sm flex-1 text-center !py-2">
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
