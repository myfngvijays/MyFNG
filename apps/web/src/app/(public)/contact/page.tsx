'use client';

import React from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Phone, Mail, MapPin, Clock, Send, Truck } from 'lucide-react';

const MAP_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!1m16!1m12!1m3!1d120646.4!2d73.0679487!3d19.1220139!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1sMY%20FNG!5e0!3m2!1sen!2sin';
const MAP_OPEN_URL =
  'https://maps.app.goo.gl/WjBHrvYCDjvhEe7X9';

export default function ContactPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .contact-page * { box-sizing: border-box; }
        .contact-page { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; color: #334155; line-height: 1.6; padding-top: 5.5rem; }
        @media (min-width: 640px) { .contact-page { padding-top: 6rem; } }
        .contact-page .contact-container { max-width: 1100px; margin: 0 auto; padding: 20px; }
        .contact-page .contact-header { text-align: center; margin-bottom: 40px; padding: 0 10px; }
        .contact-page .contact-header h1 { color: #00338d; font-size: clamp(1.8rem, 5vw, 2.5rem); margin-bottom: 10px; }
        .contact-page .contact-header p { margin: 0; color: #334155; }
        .contact-page .contact-wrapper { display: grid; grid-template-columns: 1fr 2fr; gap: 30px; margin-bottom: 30px; align-items: stretch; }
        @media (max-width: 992px) { .contact-page .contact-wrapper { grid-template-columns: 1fr; } }
        .contact-page .info-sidebar { background: #00338d; color: white; padding: 10px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); height: 100%; }
        .contact-page .info-card { margin-bottom: 25px; display: flex; align-items: flex-start; }
        .contact-page .info-card .info-icon { font-size: 1.2rem; margin-right: 15px; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .contact-page .info-card h3 { margin: 0 0 5px 0; font-size: 1.1rem; color: #fff; }
        .contact-page .info-card p { margin: 0; font-size: 0.95rem; opacity: 0.9; word-break: break-word; color: rgba(255,255,255,0.9); }
        .contact-page .info-card a { color: rgba(255,255,255,0.95); text-decoration: none; }
        .contact-page .info-card a:hover { text-decoration: underline; }
        .contact-page .emergency-box { background: #dc2626; padding: 20px; border-radius: 8px; margin-top: auto; border-right: 2px solid #fff; border-bottom: 2px solid #fff; }
        .contact-page .emergency-box h3 { color: #fff; margin: 0 0 8px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; }
        .contact-page .emergency-box p { margin: 0; color: rgba(255,255,255,0.95); font-size: 0.95rem; }
        .contact-page .emergency-box a { color: #fff; text-decoration: none; }
        .contact-page .emergency-box a:hover { text-decoration: underline; }
        .contact-page .rsa-banner a { color: #d90429; text-decoration: none; font-weight: 800; }
        .contact-page .rsa-banner a:hover { text-decoration: underline; }
        .contact-page .service-box { background: rgba(2,61,149,0.59); padding: 20px; border-radius: 8px; margin-top: 0; height: 100%; display: flex; flex-direction: column; gap: 0; }
        .contact-page .form-container { background: white; padding: clamp(20px, 5vw, 40px); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .contact-page .form-container h3 { margin-top: 0; margin-bottom: 25px; color: #00338d; font-size: 1.25rem; }
        .contact-page .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 600px) { .contact-page .form-row { grid-template-columns: 1fr; } }
        .contact-page .form-group { margin-bottom: 20px; }
        .contact-page .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #334155; }
        .contact-page .form-container input, .contact-page .form-container select, .contact-page .form-container textarea { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; font-size: 1rem; color: #334155; }
        .contact-page .btn-submit { background: #0091ff; color: white; padding: 15px; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; transition: background 0.3s; }
        .contact-page .btn-submit:hover { background: #0076d1; }
        .contact-page .rsa-banner { border: 2px solid #d90429; border-radius: 10px; padding: 15px; margin-bottom: 30px; text-align: center; background-color: #fff; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; color: #d90429; font-size: clamp(1rem, 4vw, 1.5rem); font-weight: 800; }
        .contact-page .map-container { border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin-bottom: 20px; }
        .contact-page .map-container iframe { display: block; width: 100%; height: 400px; border: 0; }
        .contact-page .map-link { display: block; text-align: center; margin-top: 10px; color: #0091ff; font-weight: 600; text-decoration: none; }
        .contact-page .map-link:hover { text-decoration: underline; }
      ` }} />
      <div className="min-h-screen bg-[#f8fafc]">
        <Navbar />
        <div className="contact-page">
          <div className="contact-container">
            <header className="contact-header">
              <h1>Your Car Needs Help? We&apos;re On It</h1>
              <p>We&apos;re here to help with car service queries, feedback, or partnership discussions. Reach out to our team and get clear, timely assistance.</p>
            </header>

            <div className="contact-wrapper">
              <aside className="info-sidebar">
                <div className="service-box">
                  <div className="info-card">
                    <div className="info-icon"><Phone className="w-5 h-5" /></div>
                    <div>
                      <h3>Customer Support</h3>
                      <p><a href="tel:+919772215095">+91-9772215095</a></p>
                      <p><a href="mailto:support@myfng.in">support@myfng.in</a></p>
                    </div>
                  </div>

                  <div className="info-card">
                    <div className="info-icon"><Mail className="w-5 h-5" /></div>
                    <div>
                      <h3>Support / Inquiry</h3>
                      <p>Service - <a href="tel:+919772215095">+91-9772215095</a></p>
                      <p>RSA - <a href="tel:+919610448949">+91-9610448949</a></p>
                      <p><a href="mailto:info@myfng.in">info@myfng.in</a></p>
                    </div>
                  </div>

                  <div className="info-card">
                    <div className="info-icon"><MapPin className="w-5 h-5" /></div>
                    <div>
                      <h3>Head Office</h3>
                      <p>
                        <a href={MAP_OPEN_URL} target="_blank" rel="noopener noreferrer">
                          A/309, Centrum Business Square, Road No 16, Wagle Industrial Estate, Thane (W), Thane-400604
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="info-card">
                    <div className="info-icon"><MapPin className="w-5 h-5" /></div>
                    <div>
                      <h3>Delhi Office</h3>
                      <p>
                        <a href={https://maps.app.goo.gl/LiPd8jTzg25D6Rpc7} target="_blank" rel="noopener noreferrer">
                          2151/9B, 3rd Floor, Patel Nagar, Shadipur, Near GD Goenka Healthcare Academy, New Delhi, Delhi-110008, India
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="info-card">
                    <div className="info-icon"><Clock className="w-5 h-5" /></div>
                    <div>
                      <h3>Office Hours</h3>
                      <p>Mon - Sat: 09:30 AM - 06:30 PM</p>
                      <p>Sun: Closed</p>
                    </div>
                  </div>

                  <div className="emergency-box">
                    <h3><Truck className="w-5 h-5 inline" /> 24/7 Roadside</h3>
                    <p>Stranded? Call our emergency dispatch: <strong><br /><a href="tel:+919610448949">+91-9610448949</a></strong></p>
                  </div>
                </div>
              </aside>

              <main className="form-container">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    // Optional: wire to API later
                  }}
                >
                  <h3>Send us a Message</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name</label>
                      <input type="text" placeholder="My FNG" required />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input type="text" placeholder="Autocare" required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" placeholder="info@myfng.in" required />
                  </div>

                  <div className="form-group">
                    <label>Mobile Number <span style={{ color: 'red' }}>*</span></label>
                    <input type="tel" placeholder="9152307030" required />
                  </div>

                  <div className="form-group">
                    <label>Subject</label>
                    <select>
                      <option>General Inquiry</option>
                      <option>Service Support</option>
                      <option>Partner With Us</option>
                      <option>Feedback</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Message</label>
                    <textarea rows={4} placeholder="How can we help you?" />
                  </div>

                  <button type="submit" className="btn-submit">
                    Send Message <Send className="w-5 h-5" />
                  </button>
                </form>
              </main>
            </div>

            <div className="rsa-banner">
              <Truck className="w-6 h-6 flex-shrink-0" />
              RSA Helpline: <a href="tel:+919610448949">+91-9610448949</a>
            </div>

            <div className="map-container">
              <iframe
                src={MAP_EMBED_URL}
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="MY FNG on Google Maps"
              />
              <a href={MAP_OPEN_URL} target="_blank" rel="noopener noreferrer" className="map-link">
                Open MY FNG on Google Maps
              </a>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
