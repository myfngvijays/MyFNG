import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white font-poppins">
      <Navbar />
      
      <main className="pt-16 sm:pt-20 md:pt-24 pb-12 sm:pb-16 md:pb-20">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          {/* Header */}
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-brand-secondary">Get In Touch</h1>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-4">
              We're here to help. Whether it's a question about your car, feedback, or partnership inquiry.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-12 max-w-6xl mx-auto">
            {/* Contact Info */}
            <div>
              <div className="bg-brand-secondary text-white p-6 sm:p-8 md:p-10 rounded-xl sm:rounded-2xl shadow-xl h-full">
                <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-7 md:mb-8">Contact Information</h2>
                
                <div className="space-y-6 sm:space-y-7 md:space-y-8">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="bg-white/10 p-2 sm:p-2.5 md:p-3 rounded-lg flex-shrink-0">
                      <Phone className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">Phone</h3>
                      <p className="text-blue-100 mb-0.5 sm:mb-1 text-sm sm:text-base">+91 12345 67890</p>
                      <p className="text-xs sm:text-sm text-blue-200">Mon-Sun: 9am - 7pm</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="bg-white/10 p-2 sm:p-2.5 md:p-3 rounded-lg flex-shrink-0">
                      <Mail className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">Email</h3>
                      <p className="text-blue-100 text-sm sm:text-base break-all">support@myfng.com</p>
                      <p className="text-blue-100 text-sm sm:text-base break-all">partners@myfng.com</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="bg-white/10 p-2 sm:p-2.5 md:p-3 rounded-lg flex-shrink-0">
                      <MapPin className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">Head Office</h3>
                      <p className="text-blue-100 text-sm sm:text-base">123 Workshop Street, Auto City, India</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="bg-white/10 p-2 sm:p-2.5 md:p-3 rounded-lg flex-shrink-0">
                      <Clock className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">Working Hours</h3>
                      <p className="text-blue-100 text-sm sm:text-base">Workshop: 9:00 AM - 7:00 PM</p>
                      <p className="text-blue-100 text-sm sm:text-base">RSA Support: 24/7 Open</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-5 md:mb-6 text-brand-secondary">Send us a Message</h2>
              <form className="space-y-4 sm:space-y-5 md:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">First Name</label>
                    <input type="text" className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" placeholder="John" />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Last Name</label>
                    <input type="text" className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" placeholder="Doe" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Email Address</label>
                  <input type="email" className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none" placeholder="john@example.com" />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Subject</label>
                  <select className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none bg-white">
                    <option>General Inquiry</option>
                    <option>Service Support</option>
                    <option>Partner Program</option>
                    <option>Feedback</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Message</label>
                  <textarea rows={4} className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none resize-none" placeholder="How can we help you?"></textarea>
                </div>

                <button type="submit" className="w-full btn btn-primary py-2.5 sm:py-3 md:py-4 flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                  Send Message
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

