type BlogPostCtaProps = {
  appHref: string;
  bookHref: string;
};

export default function BlogPostCta({ appHref, bookHref }: BlogPostCtaProps) {
  return (
    <div className="blog-post-cta" data-myfng-cta="1">
      <h3>Need trusted car service in your city?</h3>
      <p>
        Download the MyFNG app to book workshop service with pickup &amp; drop — we collect your car, service it at the workshop, and return it.
      </p>
      <div className="blog-post-cta-actions">
        <a href={appHref} className="app-btn" target="_blank" rel="noopener noreferrer">
          <span className="cta-full">Download MyFNG App</span>
          <span className="cta-short">Download App</span>
        </a>
        <a href={bookHref} className="book-btn" target="_blank" rel="noopener noreferrer">
          <span className="cta-full">Book Service Now</span>
          <span className="cta-short">Book Now</span>
        </a>
        <a href="tel:+919152307030" className="blog-post-cta-phone">
          <span className="cta-full">Call +91-9152307030</span>
          <span className="cta-short">Call</span>
        </a>
      </div>
    </div>
  );
}
