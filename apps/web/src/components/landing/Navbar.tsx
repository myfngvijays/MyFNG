import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm shadow-sm z-50">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="MyFNG Logo" className="h-10 w-auto" />
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="/services" className="text-text-body hover:text-brand-primary transition font-medium">Services</Link>
            <Link href="/roadside-assistance" className="text-text-body hover:text-brand-primary transition font-medium">Roadside Assistance</Link>
            <Link href="/ai-experience" className="text-text-body hover:text-brand-primary transition font-medium">AI Experience</Link>
            <Link href="/contact" className="text-text-body hover:text-brand-primary transition font-medium">Contact</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden md:inline-flex items-center text-brand-primary font-semibold hover:text-brand-secondary transition">
              Partner Login
            </Link>
            <Link href="/customer/login" className="btn btn-primary">
              Customer Login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}

