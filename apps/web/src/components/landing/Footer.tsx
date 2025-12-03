import { Phone, Mail, MapPin, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-brand-secondary text-white pt-16 pb-8" id="contact">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          {/* Services Column */}
          <div>
            <h3 className="text-lg font-bold mb-6 border-b-2 border-brand-primary inline-block pb-2 text-white">Services</h3>
            <ul className="space-y-3 text-blue-100">
              <li><Link href="/services" className="hover:text-white transition">Periodic Service</Link></li>
              <li><Link href="/services" className="hover:text-white transition">Engine Service</Link></li>
              <li><Link href="/services" className="hover:text-white transition">Brake Service</Link></li>
              <li><Link href="/services" className="hover:text-white transition">AC Service</Link></li>
              <li><Link href="/services" className="hover:text-white transition">Battery Service</Link></li>
              <li><Link href="/services" className="hover:text-white transition">Clutch Service</Link></li>
              <li><Link href="/services" className="hover:text-white transition">Tyre & Wheel Care</Link></li>
              <li><Link href="/services" className="hover:text-white transition">Detailing Service</Link></li>
              <li><Link href="/services" className="hover:text-white transition">Denting & Painting</Link></li>
            </ul>
          </div>
          
          {/* Popular Areas Column */}
          <div>
            <h3 className="text-lg font-bold mb-6 border-b-2 border-brand-primary inline-block pb-2 text-white">Popular Area</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-blue-100 text-sm">
              <Link href="#" className="hover:text-white transition">Ambernath</Link>
              <Link href="#" className="hover:text-white transition">Bhiwandi</Link>
              <Link href="#" className="hover:text-white transition">Kalyan West</Link>
              <Link href="#" className="hover:text-white transition">Kopar Khairane</Link>
              <Link href="#" className="hover:text-white transition">Vartak Nagar, Thane</Link>
              <Link href="#" className="hover:text-white transition">Kalyan East</Link>
              <Link href="#" className="hover:text-white transition">Manpada, Thane</Link>
              <Link href="#" className="hover:text-white transition">Virar West</Link>
              <Link href="#" className="hover:text-white transition">Vashi West</Link>
              <Link href="#" className="hover:text-white transition">Vashi East</Link>
              <Link href="#" className="hover:text-white transition">Nerul</Link>
              <Link href="#" className="hover:text-white transition">Khopoli</Link>
              <Link href="#" className="hover:text-white transition">Dombivli</Link>
              <Link href="#" className="hover:text-white transition">Boisar</Link>
              <Link href="#" className="hover:text-white transition">Mira Road East</Link>
              <Link href="#" className="hover:text-white transition">Sector 15, Panvel</Link>
              <Link href="#" className="hover:text-white transition">Plot no 71, Panvel</Link>
              <Link href="#" className="hover:text-white transition">Ghotai Phata, Titwala</Link>
              <Link href="#" className="hover:text-white transition">Ghodbunder Road, Thane</Link>
              <Link href="#" className="hover:text-white transition">Marol, Andheri East</Link>
              <Link href="#" className="hover:text-white transition">Badlapur</Link>
              <Link href="#" className="hover:text-white transition">Pune</Link>
            </div>
          </div>
          
          {/* About Us Column */}
          <div>
            <h3 className="text-lg font-bold mb-6 border-b-2 border-brand-primary inline-block pb-2 text-white">About Us</h3>
            <ul className="space-y-3 text-blue-100">
              <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
              <li><Link href="/partner" className="hover:text-white transition">My FNG Partner</Link></li>
              <li><Link href="/work" className="hover:text-white transition">Our Work</Link></li>
              <li><Link href="/faq" className="hover:text-white transition">FAQ</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms and Condition</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
            </ul>
          </div>
          
          {/* Book Service Column */}
          <div>
            <h3 className="text-lg font-bold mb-6 border-b-2 border-brand-primary inline-block pb-2 text-white">Book Service</h3>
            <form className="space-y-4">
              <div>
                <label htmlFor="mobile" className="block text-sm font-semibold mb-2 text-white">Mobile</label>
                <input 
                  type="tel" 
                  id="mobile"
                  placeholder="Enter your mobile number"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/50"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3 px-6 rounded-lg transition transform hover:scale-105"
              >
                Submit
              </button>
            </form>
            
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-blue-100">
                <Phone className="w-5 h-5 text-brand-primary flex-shrink-0" />
                <a href="tel:+919167779696" className="hover:text-white transition">+91 9167779696</a>
              </div>
              <div className="flex items-center gap-3 text-blue-100">
                <Mail className="w-5 h-5 text-brand-primary flex-shrink-0" />
                <a href="mailto:support@myfng.in" className="hover:text-white transition">support@myfng.in</a>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="MY FNG Logo" className="h-8 w-auto brightness-0 invert" />
              <div>
                <span className="text-xl font-bold">MY FNG</span>
                <p className="text-xs text-blue-200">Your Friendly Neighbourhood Garage</p>
              </div>
            </div>
            <p className="text-blue-200 text-sm text-center md:text-right">
              © {new Date().getFullYear()} MY FNG. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

