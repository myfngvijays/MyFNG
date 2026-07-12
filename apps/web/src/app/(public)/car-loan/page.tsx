'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

/* ─── validation helpers (same regex as original) ─── */
const VALID_STATES = [
  'AP','AR','AS','BR','CG','GA','GJ','HR','HP','JH','KA','KL','MP','MH',
  'MN','ML','MZ','NL','OD','PB','RJ','SK','TN','TS','TR','UP','UK','WB',
  'AN','CH','DN','DD','DL','JK','LA','LD','PY','BH',
];
function validatePAN(v: string)    { return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v); }
function validateMobile(v: string) { return /^[6-9][0-9]{9}$/.test(v); }
function validateVehicle(v: string){
  if (!VALID_STATES.includes(v.substring(0,2))) return false;
  // DL01AB1234 | DL9CAY5552 (3-letter series) | BH01AB1234 (BH series)
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(v) && v.length >= 9 && v.length <= 11;
}
function validateIncome(v: string)     { return Number(v) > 0; }
function validateOccupation(v: string) { return v !== ''; }

interface F { pan:string; mobile:string; vehicle:string; income:string; occupation:string; }
interface E { pan?:string; mobile?:string; vehicle?:string; income?:string; occupation?:string; }

export default function CarLoanPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}>
      <CarLoanPageInner />
    </Suspense>
  );
}

function CarLoanPageInner() {
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';
  const [form, setForm]           = useState<F>({ pan:'', mobile:'', vehicle:'', income:'', occupation:'' });
  const [utm, setUtm] = useState({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: ''
  });
  const [errors, setErrors]       = useState<E>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setUtm({
      utm_source: params.get('utm_source') || (isEmbed ? 'mobile_app' : ''),
      utm_medium: params.get('utm_medium') || (isEmbed ? 'in_app_webview' : ''),
      utm_campaign: params.get('utm_campaign') || (isEmbed ? 'car_loan_form' : ''),
      utm_term: params.get('utm_term') || '',
      utm_content: params.get('utm_content') || '',
    });
  }, [isEmbed]);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
    const { name, value } = e.target;
    let v = value;
    if (name === 'pan' || name === 'vehicle') v = value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if (name === 'mobile') v = value.replace(/[^0-9]/g,'');
    setForm(p => ({ ...p, [name]: v }));
    setErrors(p => ({ ...p, [name]: undefined }));
  }, []);

  const [apiError, setApiError] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    const ne: E = {};
    if (!validatePAN(form.pan))            ne.pan        = 'Invalid PAN format (Example: ABCDE1234F)';
    if (!validateMobile(form.mobile))      ne.mobile     = 'Enter valid 10 digit mobile number';
    if (!validateVehicle(form.vehicle))    ne.vehicle    = 'Invalid vehicle number (Example: MH03BJ7842)';
    if (!validateIncome(form.income))      ne.income     = 'This field is required';
    if (!validateOccupation(form.occupation)) ne.occupation = 'This field is required';
    if (Object.keys(ne).length) { setErrors(ne); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/car-loan/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pan: form.pan,
          mobile: form.mobile,
          vehicle: form.vehicle,
          income: Number(form.income),
          occupation: form.occupation,
          ...utm
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSubmitted(true);
        setForm({ pan:'', mobile:'', vehicle:'', income:'', occupation:'' });
      } else {
        setApiError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setApiError('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [form, utm]);

  const eligibilityForm = (
    <>
      <h3>Check Eligibility</h3>

      {submitted ? (
        <div style={{ textAlign:'center', padding:'30px 20px' }}>
          <div style={{ fontSize:56, marginBottom:12 }}>🎉</div>
          <h3 style={{ color:'#16a34a', fontSize:22, fontWeight:700, marginBottom:10 }}>
            Thank You!
          </h3>
          <p style={{ color:'#374151', fontSize:15, lineHeight:1.7, marginBottom:18 }}>
            Your eligibility has been checked successfully.<br />
            Our executive will contact you shortly with the best loan offers for your car.
          </p>
          <div style={{ background:'#f0fdf4', borderRadius:12, padding:'14px 18px', marginBottom:18 }}>
            <p style={{ color:'#15803d', fontSize:14, fontWeight:600 }}>
              ✅ Application Received &bull; ⏱ Response within 24-48 hrs
            </p>
          </div>
          <button
            type="button"
            className="cl-btn"
            onClick={() => setSubmitted(false)}
            style={{ maxWidth:220, margin:'0 auto' }}
          >
            Submit Another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <input type="hidden" name="utm_source" value={utm.utm_source} />
          <input type="hidden" name="utm_medium" value={utm.utm_medium} />
          <input type="hidden" name="utm_campaign" value={utm.utm_campaign} />
          <input type="hidden" name="utm_term" value={utm.utm_term} />
          <input type="hidden" name="utm_content" value={utm.utm_content} />
          <div className={`cl-field${errors.pan ? ' invalid' : ''}`}>
            <input type="text" name="pan" id="pan" value={form.pan} onChange={handleChange}
              maxLength={10} placeholder=" " autoComplete="off" />
            <label htmlFor="pan">Enter PAN No. of loan applicant</label>
            {errors.pan && <small className="cl-error">{errors.pan}</small>}
          </div>

          <div className={`cl-field${errors.mobile ? ' invalid' : ''}`}>
            <input type="tel" name="mobile" id="mobile" value={form.mobile} onChange={handleChange}
              maxLength={10} placeholder=" " autoComplete="off" />
            <label htmlFor="mobile">Enter mobile linked with applicant&apos;s PAN</label>
            {errors.mobile && <small className="cl-error">{errors.mobile}</small>}
          </div>

          <div className={`cl-field${errors.vehicle ? ' invalid' : ''}`}>
            <input type="text" name="vehicle" id="vehicle" value={form.vehicle} onChange={handleChange}
              placeholder=" " autoComplete="off" />
            <label htmlFor="vehicle">Enter vehicle registration number</label>
            {errors.vehicle && <small className="cl-error">{errors.vehicle}</small>}
          </div>

          <div className={`cl-field${errors.income ? ' invalid' : ''}`}>
            <input type="number" name="income" id="income" value={form.income} onChange={handleChange}
              min={1} placeholder=" " autoComplete="off" />
            <label htmlFor="income">Enter monthly income</label>
            {errors.income && <small className="cl-error">{errors.income}</small>}
          </div>

          <div className={`cl-field${errors.occupation ? ' invalid' : ''}`}>
            <select name="occupation" id="occupation" value={form.occupation} onChange={handleChange} required>
              <option value="" disabled />
              <option>Salaried</option>
              <option>Self Employed</option>
              <option>Business Owner</option>
            </select>
            <label htmlFor="occupation">Enter occupation</label>
            {errors.occupation && <small className="cl-error">{errors.occupation}</small>}
          </div>

          <p className="cl-rating">⭐ 4.9 in Google Rating | 70,000 Happy customers</p>
          <p className="cl-consent">
            By submitting this form, you agree to the Privacy Policy &amp; Terms of Use
          </p>

          {apiError && (
            <p style={{ color:'#e53935', fontSize:13, textAlign:'center', marginBottom:10, fontWeight:500 }}>
              {apiError}
            </p>
          )}

          <button type="submit" className="cl-btn" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Check Eligibility'}
          </button>
        </form>
      )}
    </>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        *{ margin:0; padding:0; box-sizing:border-box; font-family:'Poppins',sans-serif; }

        body{ background:#f5f7fb; color:#1b1b1b; }

        /* Offset for fixed Navbar */
        .cl-page{ padding-top:5.5rem; }
        @media (min-width:640px){ .cl-page{ padding-top:6rem; } }

        /* HERO */
        .cl-hero{
          padding:30px 8%;
          display:flex;
          gap:50px;
          align-items:center;
          flex-wrap:wrap;
          background:linear-gradient(135deg,#0f172a,#1f3a8a);
          color:#fff;
        }
        .cl-hero-left{ flex:1; min-width:280px; }
        .cl-hero-left h1{ font-size:40px; font-weight:700; line-height:1.3; margin-bottom:15px; color:#fff; }
        .cl-hero-left p{ font-size:16px; opacity:.9; margin-bottom:25px; }
        .cl-badges{ display:flex; gap:20px; flex-wrap:wrap; }
        .cl-badge{ background:rgba(255,255,255,.1); padding:10px 15px; border-radius:10px; font-size:14px; }

        /* FORM BOX */
        .cl-form-box{
          flex:1; min-width:320px;
          background:#fff; color:#000;
          padding:30px 26px; border-radius:16px;
          box-shadow:0 20px 45px rgba(0,0,0,.18);
        }
        .cl-form-box h3{ margin-bottom:18px; font-size:22px; font-weight:600; }

        /* FIELD */
        .cl-field{ position:relative; margin:22px 0; }
        .cl-field input,
        .cl-field select{
          width:100%; border:none;
          border-bottom:2px solid #ccc;
          padding:12px 0 8px;
          font-size:15px; outline:none;
          background:transparent;
        }
        .cl-field label{
          position:absolute; left:0; top:12px;
          color:#888; font-size:14px;
          pointer-events:none; transition:.25s ease;
        }
        .cl-field label::after{ content:" *"; color:#e53935; font-weight:600; }
        .cl-field input:focus ~ label,
        .cl-field input:not(:placeholder-shown) ~ label,
        .cl-field select:focus ~ label,
        .cl-field select:valid ~ label{
          top:-8px; font-size:12px; color:#ff7a00;
        }
        .cl-field input:focus,
        .cl-field select:focus{ border-bottom:2px solid #ff7a00; }
        .cl-field.invalid input,
        .cl-field.invalid select{ border-bottom:2px solid #e53935 !important; }
        .cl-error{ display:block; color:#e53935; font-size:12px; margin-top:4px; }

        .cl-rating{ text-align:center; font-size:14px; margin-top:10px; color:#444; }
        .cl-consent{ text-align:center; font-size:12px; color:#666; margin:12px 0 18px; }

        /* BUTTON */
        .cl-btn{
          background:#ff7a00; color:#fff; border:none;
          padding:15px; width:100%; border-radius:12px;
          font-size:16px; font-weight:600; cursor:pointer; transition:.2s;
        }
        .cl-btn:hover{ background:#e76800; }

        .cl-success-msg{
          text-align:center; padding:18px;
          background:#dcfce7; border-radius:12px;
          color:#16a34a; font-weight:600; font-size:15px;
        }

        /* SECTION */
        .cl-section{ padding:30px 8%; text-align:center; }
        .cl-section h2{ font-size:32px; margin-bottom:45px; color:#0f172a; }

        /* GLOBAL SECTION SYSTEM */
        .cl-section-title{
          font-size:36px; font-weight:700;
          color:#0f172a; margin-bottom:14px; line-height:1.3;
        }
        .cl-section-subtitle{
          max-width:760px; margin:0 auto 45px;
          font-size:17px; color:#5b6475; line-height:1.7;
        }

        /* FEATURES GRID */
        .cl-features{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
          gap:25px;
        }

        /* CARD */
        .cl-card{ background:#fff; padding:28px; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,.08); transition:.3s; }
        .cl-card:hover{ transform:translateY(-6px); }
        .cl-card h4{ margin:15px 0 10px; }

        /* INTEREST RATES TABLE */
        .cl-table-wrapper{ overflow-x:auto; }
        .cl-loan-table{
          width:100%; border-collapse:collapse;
          background:#fff; border-radius:14px;
          overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,.08);
        }
        .cl-loan-table th{
          background:#1f3a8a; color:#fff; padding:16px;
          text-align:left; font-weight:600; font-size:15px;
        }
        .cl-loan-table td{ padding:16px; border-bottom:1px solid #eee; font-size:14px; }
        .cl-loan-table tr:nth-child(even){ background:#f8fafc; }
        .cl-loan-table tr:hover{ background:#eef2ff; }

        /* ELIGIBILITY */
        .cl-elig-grid{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
          gap:30px; margin-top:30px;
        }
        .cl-elig-card{
          background:#fff; padding:30px; border-radius:16px;
          text-align:left; box-shadow:0 10px 30px rgba(0,0,0,.08); transition:.3s;
        }
        .cl-elig-card:hover{ transform:translateY(-6px); }
        .cl-elig-icon{ font-size:42px; margin-bottom:10px; }
        .cl-elig-card h3{ font-size:22px; color:#1f3a8a; margin-bottom:18px; }
        .cl-elig-card ul{ padding-left:18px; margin-bottom:15px; }
        .cl-elig-card li{ margin-bottom:12px; line-height:1.6; color:#374151; }
        .cl-elig-card hr{ border:none; border-top:1px solid #e5e7eb; margin:18px 0; }
        .cl-elig-note{ font-weight:500; color:#0f172a; }

        /* DOCUMENTS */
        .cl-docs-container{
          display:grid; grid-template-columns:1fr 1.2fr;
          gap:50px; align-items:start;
        }
        .cl-docs-left{ text-align:left; }
        .cl-docs-note{ font-size:14px; color:#374151; margin-bottom:18px; font-weight:500; }
        .cl-docs-small{ font-size:13px; color:#6b7280; line-height:1.7; }
        .cl-docs-table{
          width:100%; border-collapse:collapse;
          background:#fff; border-radius:14px;
          overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,.08);
        }
        .cl-docs-table th{ background:#1f3a8a; color:#fff; padding:16px; font-size:14px; text-align:left; }
        .cl-docs-table td{ padding:14px 16px; border-bottom:1px solid #eee; font-size:14px; }
        .cl-docs-table tr:nth-child(even){ background:#f8fafc; }
        .cl-docs-table .yes{ color:#16a34a; font-weight:700; text-align:center; font-size:18px; }
        .cl-docs-table .no { color:#ef4444; font-weight:700; text-align:center; font-size:18px; }

        /* ── RESPONSIVE ── */
        @media (max-width:1024px){
          .cl-hero-left h1{ font-size:32px; font-weight:700; }
          .cl-section-title{ font-size:28px; }
          .cl-section-subtitle{ font-size:15px; }
          .cl-section{ padding:60px 5%; }
        }

        @media (max-width:820px){
          .cl-hero{ flex-direction:column; padding:40px 5%; gap:35px; text-align:center; }
          .cl-hero-left{ order:1; }
          .cl-form-box{ order:2; width:100%; max-width:520px; margin:auto; }
          .cl-hero-left h1{ font-size:28px; font-weight:700; }
          .cl-badges{ justify-content:center; }
          .cl-docs-container{ grid-template-columns:1fr; gap:30px; }
        }

        @media (max-width:600px){
          body{ font-size:14px; }
          .cl-header{ padding:12px 4%; }
          .cl-logo{ font-size:20px; }
          .cl-hero{ padding:35px 4%; }
          .cl-hero-left h1{ font-size:24px; font-weight:700; line-height:1.4; }
          .cl-hero-left p{ font-size:14px; }
          .cl-badge{ font-size:12px; padding:8px 12px; }
          .cl-form-box{ padding:22px 18px; min-width:unset; }
          .cl-form-box h3{ font-size:20px; }
          .cl-btn{ padding:14px; font-size:15px; }
          .cl-section{ padding:50px 4%; }
          .cl-section-title{ font-size:24px; }
          .cl-section-subtitle{ font-size:14px; }
          .cl-card{ padding:20px; }
          .cl-loan-table th, .cl-loan-table td,
          .cl-docs-table th, .cl-docs-table td{ padding:12px 10px; font-size:13px; }
          .cl-table-wrapper{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
          .cl-docs-table-wrapper{ overflow-x:auto; }
          .cl-field input, .cl-field select{ font-size:14px; }
        }

        @media (max-width:480px){
          .cl-hero-left h1{ font-size:22px; font-weight:700; }
          .cl-badge{ width:100%; text-align:center; }
          .cl-elig-icon{ text-align:center; }
          .cl-elig-card h3{ text-align:center; }
          .cl-section-title{ font-size:28px; text-align:center; }
          .cl-section-subtitle{
            max-width:760px; margin:0 auto 45px;
            color:#5b6475; line-height:1.7;
            text-align:center; margin-top:-25px;
          }
          .cl-docs-small{ font-size:13px; color:#6b7280; line-height:1.7; text-align:center; }
          .cl-loan-table th, .cl-loan-table td,
          .cl-docs-table th, .cl-docs-table td{
            padding:12px 10px; font-size:12px; text-align:center;
          }
        }
        .cl-embed-page{
          min-height:100vh;
          background:#f5f7fb;
          padding:16px;
          display:flex;
          justify-content:center;
          align-items:flex-start;
        }
        .cl-embed-page .cl-form-box{
          width:100%;
          max-width:520px;
          margin:0;
          box-shadow:0 8px 24px rgba(0,0,0,.08);
        }
      ` }} />

      {isEmbed ? (
        <div className="cl-embed-page">
          <div className="cl-form-box">{eligibilityForm}</div>
        </div>
      ) : (
        <>
      <Navbar />

      <div className="cl-page">

      {/* ── HERO ── */}
      <section className="cl-hero">
        <div className="cl-hero-left">
          <h1>Get Instant Funds<br />Against Your Car</h1>
          <p>
            Need urgent money but don&apos;t want to sell your vehicle? MyFNG helps car owners
            unlock the value of their car with fast approval &amp; quick disbursal.
          </p>
          <div className="cl-badges">
            <div className="cl-badge">🚀 Approval in 24–48 hrs</div>
            <div className="cl-badge">💰 Up to 200% Car Value</div>
            <div className="cl-badge">📍 Doorstep Verification</div>
            <div className="cl-badge">🤝 Partner NBFCs &amp; Banks</div>
          </div>
        </div>

        <div className="cl-form-box">
          {eligibilityForm}
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="cl-section">
        <h2>Why Car Owners Choose MyFNG</h2>
        <div className="cl-features">
          <div className="cl-card"><h4>No Need to Sell Car</h4><p>Continue using your vehicle while getting funds.</p></div>
          <div className="cl-card"><h4>Fast Processing</h4><p>Quick approvals and minimal paperwork.</p></div>
          <div className="cl-card"><h4>Lowest Interest Options</h4><p>We compare multiple lenders for best rates.</p></div>
          <div className="cl-card"><h4>Doorstep Support</h4><p>MyFNG team assists you at your location.</p></div>
        </div>
      </section>

      {/* ── INTEREST RATES ── */}
      <section className="cl-section" style={{ background:'#ffffff' }}>
        <h2>Interest Rates &amp; Loan Offers</h2>
        <p style={{ maxWidth:720, margin:'0 auto 40px', color:'#555' }}>
          MyFNG partners with leading banks &amp; NBFCs to help you get the best loan offer based on
          your car value, profile, and city. Compare lenders and choose what suits you best.
        </p>

        <div className="cl-table-wrapper">
          <table className="cl-loan-table">
            <thead>
              <tr><th>Lender</th><th>Interest Rates</th><th>Loan Offer</th></tr>
            </thead>
            <tbody>
              {([
                ['Poonawala Finance','11% – 16%','Up to 200% of the car value'],
                ['HDFC Bank','12.75% – 14%','Up to 200% of the car value'],
                ['Axis Bank','14% – 16%','Up to 150% of the car value'],
                ['ICICI Bank','14% – 15.5%','Up to 160% of the car value'],
                ['Tata Capital','14.5% – 16%','Up to 200% of the car value'],
                ['Bajaj Finance','14.5% – 15.75%','Up to 200% of the car value'],
                ['Hero Fincorp','16% – 18%','Up to 200% of the car value'],
              ] as [string,string,string][]).map(([lender,rate,offer]) => (
                <tr key={lender}><td>{lender}</td><td>{rate}</td><td>{offer}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize:13, color:'#666', marginTop:18 }}>
          *Interest rates may vary based on profile, city, credit score, and vehicle condition.
        </p>
      </section>

      {/* ── LOAN ELIGIBILITY ── */}
      <section className="cl-section" style={{ background:'#eef2ff' }}>
        <h2 className="cl-section-title">Loan Eligibility</h2>
        <p className="cl-section-subtitle">
          Understand the requirements and maximise your chances of getting approved for a loan
          against your car.
        </p>

        <div className="cl-elig-grid">
          <div className="cl-elig-card">
            <div className="cl-elig-icon">💼</div>
            <h3>Salaried Individuals</h3>
            <ul>
              <li><strong>Age limit –</strong> Minimum 21 years and not above 65 years at loan maturity.</li>
              <li><strong>Job criteria –</strong> Working for at least 2 years (including 1 year with current employer).</li>
              <li><strong>Minimum annual income –</strong> ₹2,50,000 (spouse income may be considered).</li>
            </ul>
            <hr />
            <p className="cl-elig-note">
              Eligible even if you already have a car loan. You must have paid at least 9 EMIs.
            </p>
          </div>

          <div className="cl-elig-card">
            <div className="cl-elig-icon">🧑‍💻</div>
            <h3>Self-Employed Individuals</h3>
            <ul>
              <li><strong>Age limit –</strong> Minimum 21 years and not above 65 years at loan maturity.</li>
              <li><strong>Business criteria –</strong> Business operational for at least 2 years.</li>
              <li><strong>Minimum annual income –</strong> ₹2,50,000.</li>
            </ul>
            <hr />
            <p className="cl-elig-note">
              Top-up loan possible if your existing car loan has completed at least 9 EMIs.
            </p>
          </div>
        </div>
      </section>

      {/* ── DOCUMENTS REQUIRED ── */}
      <section className="cl-section" style={{ background:'#f8fafc' }}>
        <div className="cl-docs-container">
          <div className="cl-docs-left">
            <h2 className="cl-section-title">Documents Required</h2>
            <p className="cl-section-subtitle" style={{ marginBottom:25 }}>
              These are the basic documents required to get you started.
            </p>
            <p className="cl-docs-note">
              * The final list of documents may vary depending on the lender and your personal profile.
            </p>
            <p className="cl-docs-small">
              Example: Loan against car ₹10,00,000 at ~12.75% for 5 years → EMI approx ₹22,625/month.{' '}
              Processing fees, stamp duty and bank charges will be disclosed by the lender before disbursal.{' '}
              Loan tenure generally ranges between 3 to 5 years based on profile and vehicle age.{' '}
              Interest rate and approval may vary based on credit assessment.
            </p>
          </div>

          <div className="cl-docs-table-wrapper">
            <table className="cl-docs-table">
              <thead>
                <tr>
                  <th>Documents Required</th>
                  <th>Salaried Individuals</th>
                  <th>Self-Employed Individuals</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['Aadhar Card',                          true,  true ],
                  ['PAN Card',                             true,  true ],
                  ['Car Registration Certificate (RC)',    true,  true ],
                  ['GST Certificate / Udyam / Shop Act',   false, true ],
                  ['Bank Account Statement (Last 6 Months)',true, true ],
                  ['Latest Electricity Bill',              true,  true ],
                  ['Passport Size Photograph',             true,  true ],
                  ['Last 2 Years ITR',                     false, true ],
                  ['Salary Slips (Last 3 Months)',         true,  false],
                  ['Form 16 (Last 2 Years)',               true,  false],
                ] as [string,boolean,boolean][]).map(([doc,sal,se]) => (
                  <tr key={doc}>
                    <td>{doc}</td>
                    <td className={sal ? 'yes' : 'no'}>{sal ? '✔' : '✖'}</td>
                    <td className={se  ? 'yes' : 'no'}>{se  ? '✔' : '✖'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="cl-section" style={{ background:'#eef2ff' }}>
        <h2>How It Works</h2>
        <div className="cl-features">
          <div className="cl-card"><h3>1. Submit Details</h3><p>Fill the short eligibility form with your car &amp; contact details.</p></div>
          <div className="cl-card"><h3>2. Car Evaluation</h3><p>Our team checks your vehicle value through smart AI valuation &amp; verification.</p></div>
          <div className="cl-card"><h3>3. Loan Approval</h3><p>We connect you with our partnered banks/NBFCs for best loan options.</p></div>
          <div className="cl-card"><h3>4. Instant Disbursal</h3><p>Money is transferred directly to your bank account after approval.</p></div>
        </div>
      </section>

      </div>{/* end .cl-page */}

      <Footer />
        </>
      )}
    </>
  );
}
