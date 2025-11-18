import Link from 'next/link';
import { 
  Wrench, 
  Clock, 
  Shield, 
  Users, 
  MapPin, 
  CheckCircle, 
  Star,
  Phone,
  Mail,
  ArrowRight
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navbar */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm shadow-sm z-50">
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-8 h-8 text-brand-fng" />
              <span className="text-2xl font-bold">
                <span className="text-brand-my">My</span>
                <span className="text-brand-fng">FNG</span>
              </span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-text-body hover:text-brand-primary transition">Features</a>
              <a href="#about" className="text-text-body hover:text-brand-primary transition">About</a>
              <a href="#contact" className="text-text-body hover:text-brand-primary transition">Contact</a>
            </div>

            <Link href="/login" className="btn btn-primary">
              Login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-brand-my/5 via-white to-brand-fng/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Complete Workshop
              <br />
              <span className="text-brand-fng">Management Solution</span>
            </h1>
            <p className="text-xl text-text-body mb-8 max-w-2xl mx-auto">
              Professional service management platform for workshops, mechanics, 
              and customers. Streamline your operations with MyFNG.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login" className="btn btn-primary text-lg">
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#features" className="btn btn-outline text-lg">
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-background-grey">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-text-body">Everything you need to manage your workshop efficiently</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Clock className="w-10 h-10 text-brand-primary" />}
              title="Real-Time Tracking"
              description="Track service progress, pickups, and deliveries in real-time with live updates."
            />
            <FeatureCard
              icon={<Users className="w-10 h-10 text-brand-primary" />}
              title="Multi-Role Support"
              description="17+ user roles including admins, managers, mechanics, and customers."
            />
            <FeatureCard
              icon={<MapPin className="w-10 h-10 text-brand-primary" />}
              title="Location Services"
              description="GPS tracking for RSA and home service operations."
            />
            <FeatureCard
              icon={<Shield className="w-10 h-10 text-brand-primary" />}
              title="Secure & Compliant"
              description="GDPR compliant with enterprise-grade security and data protection."
            />
            <FeatureCard
              icon={<CheckCircle className="w-10 h-10 text-brand-primary" />}
              title="Lead Management"
              description="Accept/reject leads, assign tasks, and manage complete workflow."
            />
            <FeatureCard
              icon={<Star className="w-10 h-10 text-brand-primary" />}
              title="Workshop Audits"
              description="Complete audit system with scoring for quality assurance."
            />
          </div>
        </div>
      </section>

      {/* Service Types */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Our Services</h2>
            <p className="text-xl text-text-body">Comprehensive solutions for all your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <ServiceCard
              title="Normal Service"
              description="Regular maintenance and repairs at partner workshops"
              features={['Workshop Network', 'Quality Assured', 'Transparent Pricing']}
            />
            <ServiceCard
              title="Roadside Assistance"
              description="24/7 emergency support with rapid response teams"
              features={['24/7 Support', 'Quick Response', 'GPS Tracking']}
            />
            <ServiceCard
              title="Service at Home"
              description="Convenient service at your doorstep with mobile units"
              features={['Doorstep Service', 'Trained Technicians', 'Flexible Timing']}
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-background-grey">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">About MyFNG</h2>
            <p className="text-lg text-text-body mb-6">
              MyFNG is a comprehensive workshop management platform designed to streamline 
              operations for service providers and customers. Our platform connects workshops, 
              mechanics, managers, and customers in a seamless ecosystem.
            </p>
            <p className="text-lg text-text-body">
              With advanced features like role-based access, real-time tracking, photo documentation, 
              and GDPR compliance, MyFNG is the complete solution for modern workshop management.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Get In Touch</h2>
            <p className="text-lg text-text-body mb-12">
              Have questions? We're here to help!
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              <div className="card text-center hover:shadow-xl transition">
                <Phone className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Phone</h3>
                <p className="text-text-body">+91 XXXXX XXXXX</p>
              </div>
              
              <div className="card text-center hover:shadow-xl transition">
                <Mail className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Email</h3>
                <p className="text-text-body">support@myfng.com</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-my text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-6 md:mb-0">
              <Wrench className="w-8 h-8" />
              <span className="text-2xl font-bold">MyFNG</span>
            </div>
            
            <div className="text-center md:text-right">
              <p className="text-white/80">© 2024 MyFNG. All rights reserved.</p>
              <p className="text-white/60 text-sm mt-2">GDPR Compliant | Secure Platform</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card hover:shadow-xl transition group">
      <div className="mb-4 group-hover:scale-110 transition">{icon}</div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-text-body">{description}</p>
    </div>
  );
}

function ServiceCard({ title, description, features }: { title: string; description: string; features: string[] }) {
  return (
    <div className="card hover:shadow-xl transition border-t-4 border-brand-primary">
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <p className="text-text-body mb-6">{description}</p>
      <ul className="space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="text-text-body">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
