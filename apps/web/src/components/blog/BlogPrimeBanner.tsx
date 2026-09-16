const PRIME_BENEFITS = [
  '10% off periodic',
  '5% wallet cashback',
  '2x free inspection',
  '2x car scan',
  'Insurance claim help',
  'Priority slots',
  '6-month warranty',
];

export default function BlogPrimeBanner({ href }: { href: string }) {
  return (
    <a href={href} className="blog-prime-banner">
      <div className="blog-prime-banner-row">
        <div>
          <div className="blog-prime-banner-kicker">
            <i className="fa-solid fa-crown" />
            MYFNG PRIME
          </div>
          <p className="blog-prime-banner-tag">Your Car. Our Responsibility. Valid 12 months.</p>
        </div>
        <div className="blog-prime-banner-price">
          <strong>₹699</strong>
          <span>/ year</span>
          <em>Benefits worth ₹6,650</em>
        </div>
      </div>
      <div className="blog-prime-banner-chips">
        {PRIME_BENEFITS.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </a>
  );
}
