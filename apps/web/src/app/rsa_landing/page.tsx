'use client';

import React from 'react';

const RSA_WHATSAPP = '919610448949';

function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const form = e.currentTarget;
  const data = new FormData(form);
  const name = data.get('name') as string;
  const phone = data.get('phone') as string;
  const city = data.get('city') as string;
  const service = data.get('service') as string;
  const location = data.get('location') as string;
  const msg = `Hello MYFNG Team,%0A%0AI need Roadside Assistance (RSA).%0A%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0ACity: ${encodeURIComponent(city)}%0AService: ${encodeURIComponent(service)}%0ALocation: ${encodeURIComponent(location)}%0A%0APlease dispatch help ASAP.`;
  window.open(`https://wa.me/${RSA_WHATSAPP}?text=${msg}`, '_blank');
  form.reset();
}

export default function RsaLandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
    :root{--bg:#0b1220;--text:#ffffff;--muted:rgba(255,255,255,.72);--brand:#ff4d2e;--brand2:#ff8a00;--card: rgba(255,255,255,.06);--border: rgba(255,255,255,.12);--shadow: 0 18px 60px rgba(0,0,0,.35);--radius: 18px;}
    .rsa-landing *{box-sizing:border-box}
    .rsa-landing{scroll-behavior:smooth;margin:0;font-family:"Poppins",system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#ffffff;background:#070b14;min-height:100vh}
    .rsa-landing a{color:inherit;text-decoration:none}
    .rsa-landing h1,.rsa-landing h2,.rsa-landing h3,.rsa-landing h4,.rsa-landing h5,.rsa-landing h6{color:#ffffff}
    .rsa-landing summary{color:#ffffff}
    .rsa-landing .price{color:#ffffff}
    .rsa-landing select.input{color:#ffffff}
    .rsa-landing select.input option{color:#1a1a1a;background:#fff}
    .rsa-landing .container{max-width:1180px;margin:auto;padding:0 18px}
    .rsa-landing header{position:sticky;top:0;z-index:50;background: rgba(15, 7, 7, .55);backdrop-filter: blur(14px);border-bottom:1px solid var(--border)}
    .rsa-landing .nav{display:flex;align-items:center;justify-content:space-between;padding:14px 0;gap:14px}
    .rsa-landing .brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.3px}
    .rsa-landing .logo{width:40px;height:40px;border-radius:14px;background: linear-gradient(135deg, var(--brand2), var(--brand));display:grid;place-items:center;box-shadow: 0 10px 30px rgba(255,77,46,.25);font-weight:900;color:#2a0a07}
    .rsa-landing .nav-links{display:flex;gap:18px;align-items:center;font-size:14px;color:rgba(255,255,255,.75)}
    .rsa-landing .nav-links a:hover{color:#fff}
    .rsa-landing .nav-cta{display:flex;gap:10px;align-items:center}
    .rsa-landing .btn{border:1px solid var(--border);background: rgba(255,255,255,.06);color:#fff;padding:10px 14px;border-radius:14px;font-weight:700;font-size:14px;cursor:pointer;transition:.2s ease;display:inline-flex;gap:8px;align-items:center;justify-content:center;white-space:nowrap}
    .rsa-landing .btn:hover{transform: translateY(-1px); background: rgba(255,255,255,.10)}
    .rsa-landing .btn.primary{background: linear-gradient(135deg, var(--brand2), var(--brand));border: none;box-shadow: 0 16px 40px rgba(255,77,46,.22);color:#2a0a07}
    .rsa-landing .btn.primary:hover{filter:brightness(1.05)}
    .rsa-landing .btn.small{padding:9px 12px;border-radius:12px}
    .rsa-landing .hero{position:relative;overflow:hidden;padding: 60px 0 30px;background:radial-gradient(1200px 700px at 15% 20%, rgba(255, 92, 0, 0.18), transparent 60%),radial-gradient(900px 600px at 70% 30%, rgba(255, 0, 92, 0.12), transparent 55%),radial-gradient(900px 700px at 85% 85%, rgba(255, 90, 0, 0.10), transparent 60%),linear-gradient(135deg, #4c0e0b 0%, #3f0d0a 35%, #5a1510 70%, #7b1d1c 100%)}
    .rsa-landing .hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 30%, rgba(0,0,0,.18), transparent 60%),radial-gradient(circle at 80% 70%, rgba(0,0,0,.22), transparent 55%);pointer-events:none}
    .rsa-landing .hero-grid{position:relative;z-index:2;display:grid;grid-template-columns: 1.1fr .9fr;gap:22px;align-items:stretch}
    .rsa-landing .badge{display:inline-flex;gap:10px;align-items:center;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background: rgba(255,255,255,.06);color:rgba(255,255,255,.82);font-size:13px;width:fit-content}
    .rsa-landing .dot{width:10px;height:10px;border-radius:50%;background:#ff3b30;box-shadow:0 0 0 6px rgba(255,59,48,.15)}
    .rsa-landing h1{margin:14px 0 12px;font-size:46px;line-height:1.1;letter-spacing:-.7px}
    .rsa-landing .gradient-text{background: linear-gradient(135deg, #ff8a00, #ff4d2e, #ff8a00);-webkit-background-clip:text;background-clip:text;color:transparent}
    .rsa-landing .lead{color:rgba(255,255,255,.75);font-size:16px;line-height:1.75;margin:0 0 18px}
    .rsa-landing .chips{display:flex;gap:10px;flex-wrap:wrap;margin: 12px 0 18px}
    .rsa-landing .chip{display:inline-flex;gap:8px;align-items:center;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background: rgba(0,0,0,.12);font-size:13px;color:rgba(255,255,255,.85)}
    .rsa-landing .hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin: 12px 0 16px}
    .rsa-landing .stats{display:grid;grid-template-columns: repeat(2, 1fr);gap:12px;margin-top:18px}
    .rsa-landing .stat{border:1px solid rgba(255,255,255,.16);background: rgba(255,255,255,.06);border-radius: var(--radius);padding:14px}
    .rsa-landing .stat strong{display:block;font-size:20px;color:#ffffff}
    .rsa-landing .stat span{color:rgba(255,255,255,.72);font-size:13px}
    .rsa-landing .card{border:1px solid rgba(255,255,255,.16);background: rgba(0,0,0,.22);border-radius: 22px;box-shadow: var(--shadow);padding:18px}
    .rsa-landing .card h3{margin:4px 0 8px;font-size:18px;color:#ffffff}
    .rsa-landing .card p{margin:0 0 14px;color:rgba(255,255,255,.72);font-size:13px}
    .rsa-landing .form{display:grid;gap:10px;margin-top:10px}
    .rsa-landing .input{width:100%;padding:12px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background: rgba(0,0,0,.20);color:#ffffff;outline:none;font-size:14px}
    .rsa-landing .input::placeholder{color:rgba(255,255,255,.5)}
    .rsa-landing .input:focus{border-color: rgba(255,138,0,.75)}
    .rsa-landing .form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rsa-landing .note{margin-top:10px;font-size:12px;color:rgba(255,255,255,.70)}
    .rsa-landing section{padding: 46px 0;background:#070b14}
    .rsa-landing .section-title{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px}
    .rsa-landing .section-title h2{margin:0;font-size:28px;letter-spacing:-.3px;color:#ffffff}
    .rsa-landing .section-title p{margin:0;color:rgba(255,255,255,.68);max-width:620px}
    .rsa-landing .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .rsa-landing .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .rsa-landing .feature{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:16px}
    .rsa-landing .feature .icon{width:42px;height:42px;border-radius:14px;background: rgba(255,138,0,.16);border:1px solid rgba(255,138,0,.25);display:grid;place-items:center;margin-bottom:10px;font-weight:900;color:#ffb86b}
    .rsa-landing .feature h4{margin:0 0 6px;font-size:16px;color:#ffffff}
    .rsa-landing .feature p{margin:0;color:rgba(255,255,255,.68);font-size:13px;line-height:1.6}
    .rsa-landing .pricing{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .rsa-landing .price-card{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: 22px;padding:18px}
    .rsa-landing .price-card h3{margin:0 0 8px;color:#ffffff}
    .rsa-landing .price{font-size:34px;font-weight:900;letter-spacing:-.5px;margin:10px 0;color:#ffffff}
    .rsa-landing .price small{font-size:14px;color:rgba(255,255,255,.70);font-weight:700}
    .rsa-landing .list{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:8px}
    .rsa-landing .list li{display:flex;gap:10px;align-items:flex-start;color:rgba(255,255,255,.70);font-size:14px}
    .rsa-landing .tick{width:18px;height:18px;border-radius:50%;background: rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.35);display:grid;place-items:center;color:#22c55e;flex:0 0 auto;margin-top:2px;font-size:12px;font-weight:900}
    .rsa-landing .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .rsa-landing .step{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:16px}
    .rsa-landing .step b{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:12px;background: rgba(255,77,46,.16);border:1px solid rgba(255,77,46,.30);margin-bottom:10px;color:#ffb3a6;font-weight:900}
    .rsa-landing .step h4{margin:0 0 6px;color:#ffffff}
    .rsa-landing .step p{margin:0;color:rgba(255,255,255,.68);font-size:13px;line-height:1.6}
    .rsa-landing .testimonials{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .rsa-landing .review{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:16px;min-width:300px}
    .rsa-landing .stars{color:#ffcc66;letter-spacing:1px;font-size:14px}
    .rsa-landing .review p{color:rgba(255,255,255,.70);font-size:13px;line-height:1.7;margin:10px 0 12px}
    .rsa-landing .review strong{display:block;color:#ffffff}
    .rsa-landing .review span{color:rgba(255,255,255,.65);font-size:12px}
    .rsa-landing details{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:14px 16px}
    .rsa-landing details + details{margin-top:10px}
    .rsa-landing summary{cursor:pointer;font-weight:700;list-style:none}
    .rsa-landing summary::-webkit-details-marker{display:none}
    .rsa-landing details p{color:rgba(255,255,255,.70);font-size:13px;line-height:1.7;margin:10px 0 0}
    .rsa-landing footer{padding: 26px 0;border-top:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.65);font-size:13px;background:#070b14}
    .rsa-landing .marquee{overflow:hidden;position:relative}
    .rsa-landing .marquee-track{display:flex;gap:18px;width:max-content;animation:rsa-scroll 70s linear infinite}
    @keyframes rsa-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    @media (max-width: 980px){.rsa-landing .hero-grid{grid-template-columns:1fr;gap:14px}.rsa-landing h1{font-size:36px}.rsa-landing .grid-4{grid-template-columns:repeat(2,1fr)}.rsa-landing .grid-3{grid-template-columns:repeat(2,1fr)}.rsa-landing .steps{grid-template-columns:repeat(2,1fr)}.rsa-landing .pricing{grid-template-columns:1fr}.rsa-landing .testimonials{grid-template-columns:repeat(2,1fr)}.rsa-landing .nav-links{display:none}}
    @media (max-width: 560px){.rsa-landing h1{font-size:30px}.rsa-landing .form-row{grid-template-columns:1fr}.rsa-landing .grid-3,.rsa-landing .grid-4{grid-template-columns:1fr}.rsa-landing .steps{grid-template-columns:1fr}.rsa-landing .testimonials{grid-template-columns:1fr}.rsa-landing .stats{grid-template-columns:1fr}}
  `}} />
      <div className="rsa-landing">
        <header>
          <div className="container">
            <div className="nav">
              <div className="brand">
                <div className="logo">MF</div>
                <div>
                  <div style={{ fontSize: '14px', lineHeight: 1.1 }}>MYFNG</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.70)', fontWeight: 600 }}>Roadside Assistance</div>
                </div>
              </div>
              <nav className="nav-links">
                <a href="#services">Services</a>
                <a href="#pricing">Pricing</a>
                <a href="#process">Process</a>
                <a href="#reviews">Reviews</a>
                <a href="#faq">FAQ</a>
                <a href="#contact">Contact</a>
              </nav>
              <div className="nav-cta">
                <a className="btn small" href={`tel:+${RSA_WHATSAPP}`}>📞 Call</a>
                <a className="btn small primary" href={`https://wa.me/${RSA_WHATSAPP}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
              </div>
            </div>
          </div>
        </header>

        <main className="hero">
          <div className="container">
            <div className="hero-grid">
              <div>
                <div className="badge"><span className="dot" />24×7 Emergency Support • AI-Powered Emergency Dispatch</div>
                <h1>Stuck on the Road?<br /><span className="gradient-text">We&apos;re Just a Tap Away!</span></h1>
                <p className="lead">Car breakdown? Flat tyre? Battery dead? MYFNG&apos;s roadside assistance helps you quickly with <b>AI-powered emergency dispatch</b> and verified technicians — reaching you in <b>under 30 minutes</b> (subject to location).</p>
                <div className="chips">
                  <div className="chip">⏱ Under 30 Min</div>
                  <div className="chip">🛡 Trusted Help</div>
                  <div className="chip">📍 Live Tracking</div>
                </div>
                <div className="hero-actions">
                  <a className="btn primary" href="#contact">🚨 Request Emergency Help</a>
                  <a className="btn" href={`https://wa.me/${RSA_WHATSAPP}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp Now</a>
                  <a className="btn" href="#services">Explore Services →</a>
                </div>
                <div style={{ marginTop: 8, color: 'rgba(255,255,255,.65)', fontSize: 13 }}>Available in 50+ cities across India • 24×7 Support</div>
                <div className="stats">
                  <div className="stat"><strong>24×7</strong><span>Emergency assistance</span></div>
                  <div className="stat"><strong>30 Min</strong><span>Average dispatch time</span></div>
                  <div className="stat"><strong>Live GPS</strong><span>Track technician</span></div>
                  <div className="stat"><strong>30000+</strong><span>Rescues Done</span></div>
                </div>
              </div>
              <aside className="card" id="contact">
                <h3>Quick RSA Request</h3>
                <p>Share your details. We will connect instantly and dispatch help.</p>
                <form className="form" onSubmit={handleSubmit}>
                  <input className="input" type="text" name="name" placeholder="Your Name" required />
                  <div className="form-row">
                    <input className="input" type="tel" name="phone" placeholder="Mobile Number" required />
                    <input className="input" type="text" name="city" placeholder="City" required />
                  </div>
                  <select className="input" name="service" required>
                    <option value="">Select Service</option>
                    <option>Jump Start</option>
                    <option>Towing Service</option>
                    <option>Flat Tyre Fix</option>
                    <option>Fuel Delivery</option>
                    <option>Minor Repair</option>
                    <option>Accident Support</option>
                  </select>
                  <input className="input" type="text" name="location" placeholder="Current Location / Landmark" required />
                  <button className="btn primary" type="submit">Submit & WhatsApp</button>
                  <div className="note">By submitting, you agree to be contacted by MYFNG for RSA support.</div>
                </form>
              </aside>
            </div>
          </div>
        </main>

        <section id="services">
          <div className="container">
            <div className="section-title"><div><h2>Roadside Assistance Services</h2><p>Quick on‑road solutions for every car emergency.</p></div></div>
            <div className="grid-4">
              <div className="feature"><div className="icon">⚡</div><h4>Battery Jumpstart</h4><p>Instant battery start at your location.</p></div>
              <div className="feature"><div className="icon">🚗</div><h4>Car Towing Services</h4><p>Safe towing to nearest workshop.</p></div>
              <div className="feature"><div className="icon">⛽</div><h4>Fuel Delivery</h4><p>Emergency petrol/diesel delivery.</p></div>
              <div className="feature"><div className="icon">🧯</div><h4>Accidental Car Towing</h4><p>Accident vehicle recovery & transport.</p></div>
              <div className="feature"><div className="icon">🛠</div><h4>Roadside Assistance</h4><p>Minor on‑road repairs support.</p></div>
              <div className="feature"><div className="icon">📍</div><h4>Car Tracking Services</h4><p>Live location and tracking support.</p></div>
              <div className="feature"><div className="icon">🧰</div><h4>Periodic Car Service</h4><p>Doorstep periodic maintenance booking.</p></div>
              <div className="feature"><div className="icon">🛞</div><h4>Flat Tyre Assistance</h4><p>Tyre change or puncture fix instantly.</p></div>
            </div>
          </div>
        </section>

        <section id="pricing">
          <div className="container">
            <div className="section-title"><div><h2>Pricing</h2><p>Clear and affordable pricing. Exact cost depends on location, vehicle type and distance.</p></div></div>
            <div className="pricing">
              <div className="price-card">
                <h3>Towing</h3>
                <div className="price">₹25/km <small>onwards</small></div>
                <ul className="list">
                  <li><span className="tick">✓</span> Safe towing with proper equipment</li>
                  <li><span className="tick">✓</span> Pickup from breakdown spot</li>
                  <li><span className="tick">✓</span> Drop to nearest service location</li>
                </ul>
                <div style={{ marginTop: 14 }}><a className="btn primary" href="#contact">Request Towing</a></div>
              </div>
              <div className="price-card">
                <h3>RSA Support</h3>
                <div className="price">On Demand <small>as per service</small></div>
                <ul className="list">
                  <li><span className="tick">✓</span> Jumpstart, puncture, fuel & minor fixes</li>
                  <li><span className="tick">✓</span> AI-powered emergency dispatch</li>
                  <li><span className="tick">✓</span> 24×7 customer support</li>
                </ul>
                <div style={{ marginTop: 14 }}><a className="btn primary" href={`https://wa.me/${RSA_WHATSAPP}`} target="_blank" rel="noopener noreferrer">WhatsApp for Quote</a></div>
              </div>
            </div>
          </div>
        </section>

        <section id="process">
          <div className="container">
            <div className="section-title"><div><h2>How It Works</h2><p>Get emergency support in 4 simple steps.</p></div></div>
            <div className="steps">
              <div className="step"><b>1</b><h4>Raise Request</h4><p>Call/WhatsApp and share your issue & location.</p></div>
              <div className="step"><b>2</b><h4>AI Dispatch</h4><p>We assign nearest available technician instantly.</p></div>
              <div className="step"><b>3</b><h4>Get Help</h4><p>Repair on-site or tow your vehicle safely if needed.</p></div>
              <div className="step"><b>4</b><h4>Done</h4><p>Service completed and confirmation shared with you.</p></div>
            </div>
          </div>
        </section>

        <section id="reviews">
          <div className="container">
            <div className="section-title"><div><h2>Reviews</h2><p>Trusted by customers for quick response and professional roadside support.</p></div></div>
            <div className="marquee">
              <div className="marquee-track">
                <div className="review"><div className="stars">★★★★★</div><p>Jumpstart done quickly for my Swift in Pune. Reached in 20 minutes.</p><strong>Rahul • Pune • Maruti Swift</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Towing arranged for my i20 in Mumbai highway. Very professional.</p><strong>Amit • Mumbai • Hyundai i20</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Flat tyre help at night in Delhi. Technician polite.</p><strong>Sachin • Delhi • Honda City</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Fuel delivered in Bangalore Outer Ring Road. Lifesaver.</p><strong>Karthik • Bangalore • Kia Seltos</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Accident towing handled carefully in Hyderabad.</p><strong>Praveen • Hyderabad • Creta</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Battery jumpstart in Ahmedabad parking basement.</p><strong>Mehul • Ahmedabad • Baleno</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Fast service for my WagonR in Jaipur.</p><strong>Rohit • Jaipur • WagonR</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Car stopped in rain, got help in Chennai quickly.</p><strong>Arun • Chennai • Polo</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Tracking feature was accurate in Gurgaon.</p><strong>Neeraj • Gurgaon • Verna</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Very smooth towing for my Fortuner in Noida.</p><strong>Deepak • Noida • Fortuner</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Night support in Indore saved my trip.</p><strong>Ankit • Indore • Amaze</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Good behavior and fair price in Nagpur.</p><strong>Vivek • Nagpur • Tiago</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Tyre replaced in 15 mins in Surat.</p><strong>Jay • Surat • Nexon</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Jumpstart early morning in Kolkata.</p><strong>Sourav • Kolkata • Alto</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Excellent coordination in Lucknow.</p><strong>Harsh • Lucknow • Brezza</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Technician arrived quickly in Bhopal.</p><strong>Rakesh • Bhopal • XUV300</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Highway towing handled perfectly in Chandigarh.</p><strong>Gagan • Chandigarh • Scorpio</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Fuel delivery within 25 minutes in Kochi.</p><strong>Nithin • Kochi • Jazz</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Jumpstart done quickly for my Swift in Pune. Reached in 20 minutes.</p><strong>Rahul • Pune • Maruti Swift</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Towing arranged for my i20 in Mumbai highway. Very professional.</p><strong>Amit • Mumbai • Hyundai i20</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="container">
            <div className="section-title"><div><h2>FAQ</h2><p>Frequently asked questions about MYFNG Roadside Assistance.</p></div></div>
            <details open>
              <summary>Is MYFNG RSA available 24×7?</summary>
              <p>Yes. MYFNG roadside assistance is available 24×7 for emergency support.</p>
            </details>
            <details>
              <summary>Do you provide towing and on-road repairs?</summary>
              <p>Yes. We provide towing and minor roadside repairs depending on the issue.</p>
            </details>
            <details>
              <summary>How can I book RSA quickly?</summary>
              <p>You can submit the request form or WhatsApp us to get help immediately.</p>
            </details>
            <details>
              <summary>Do you offer live tracking?</summary>
              <p>Yes. Live GPS tracking is available to track technician in real-time.</p>
            </details>
          </div>
        </section>

        <footer>
          <div className="container">© MYFNG Roadside Assistance. All rights reserved.</div>
        </footer>
      </div>
    </>
  );
}
