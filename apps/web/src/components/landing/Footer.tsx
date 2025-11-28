import { Phone, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-secondary text-white pt-20 pb-10" id="contact">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <img src="/logo.png" alt="MyFNG Logo" className="h-8 w-auto brightness-0 invert" />
              <span className="text-2xl font-bold">MyFNG</span>
            </div>
            <p className="text-blue-100 mb-6">
              Simplifying car ownership with AI-driven technology. The smart choice for modern car care.
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-brand-primary transition cursor-pointer">
                <Phone className="w-5 h-5" />
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-brand-primary transition cursor-pointer">
                <Mail className="w-5 h-5" />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-6 border-b-2 border-brand-primary inline-block pb-2">Services</h3>
            <ul className="space-y-3 text-blue-100">
              <li><a href="/services" className="hover:text-white transition">Periodic Service</a></li>
              <li><a href="/services" className="hover:text-white transition">Denting & Painting</a></li>
              <li><a href="/roadside-assistance" className="hover:text-white transition">Roadside Assistance</a></li>
              <li><a href="/services" className="hover:text-white transition">Car Detailing</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-6 border-b-2 border-brand-primary inline-block pb-2">Company</h3>
            <ul className="space-y-3 text-blue-100">
              <li><a href="#" className="hover:text-white transition">About Us</a></li>
              <li><a href="#" className="hover:text-white transition">Careers</a></li>
              <li><a href="#" className="hover:text-white transition">Partner with Us</a></li>
              <li><a href="https://myfng.in" className="hover:text-white transition">Visit MyFNG.in</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-6 border-b-2 border-brand-primary inline-block pb-2">Contact</h3>
            <ul className="space-y-4 text-blue-100">
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-brand-primary" />
                <span>+91 12345 67890</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-brand-primary" />
                <span>support@myfng.com</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-brand-primary flex-shrink-0" />
                <span>123 Workshop Street, Auto City, India</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-blue-200 text-sm">
            © {new Date().getFullYear()} MyFNG. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

