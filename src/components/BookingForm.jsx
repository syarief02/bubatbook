import { useState } from 'react';
import { User, Mail, Phone, FileText } from 'lucide-react';

export default function BookingForm({ onSubmit, loading = false, initialData = {} }) {
  const [name, setName] = useState(initialData.name || '');
  const [email, setEmail] = useState(initialData.email || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [notes, setNotes] = useState(initialData.notes || '');
  const [errors, setErrors] = useState({});

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email address';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    else if (phone.replace(/\D/g, '').length < 9) errs.phone = 'Invalid phone number';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), notes: notes.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="input-label flex items-center gap-1.5">
          <User className="w-4 h-4 text-violet-400" />
          Full Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field"
          placeholder="Ahmad bin Abdullah"
          disabled={loading}
        />
        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="input-label flex items-center gap-1.5">
          <Mail className="w-4 h-4 text-violet-400" />
          Email Address *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder="ahmad@email.com"
          disabled={loading}
        />
        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="input-label flex items-center gap-1.5">
          <Phone className="w-4 h-4 text-violet-400" />
          Phone Number *
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input-field"
          placeholder="+60 12-345 6789"
          disabled={loading}
        />
        {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label className="input-label flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-violet-400" />
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input-field resize-none"
          rows={3}
          placeholder="Any special requests or pick-up instructions..."
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading ? 'Saving...' : 'Continue to Payment'}
      </button>
    </form>
  );
}
