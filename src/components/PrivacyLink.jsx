// "Dasar Privasi" / "Privacy Policy" in the rental terms, as a link to
// /privacy. It opens in a new tab, so a renter in the middle of signing the
// agreement doesn't lose their place. A plain <a>, so it also works where the
// terms render outside the router (a printed agreement).

const PRIVACY_WORDS = /(Dasar Privasi|Privacy Policy)/;

export function PrivacyLink({ children }) {
  return (
    <a
      href="/privacy"
      target="_blank"
      rel="noopener noreferrer"
      className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
    >
      {children}
    </a>
  );
}

/** The text with every "Dasar Privasi" / "Privacy Policy" turned into a link. */
export function WithPrivacyLinks({ text }) {
  return (
    <>
      {text
        .split(PRIVACY_WORDS)
        .map((part, i) => (i % 2 ? <PrivacyLink key={i}>{part}</PrivacyLink> : part))}
    </>
  );
}
