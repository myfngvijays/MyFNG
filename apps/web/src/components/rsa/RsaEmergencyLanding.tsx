import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, emergencyServiceSchema, faqPageSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { RSA_EMERGENCY_PAGES, RSA_PHONE, RSA_SERVICE_AREAS, RSA_WHATSAPP, type RsaEmergencyPage } from '@/lib/rsa/emergencyPages';
import RsaServiceRequestForm from '@/components/rsa/RsaServiceRequestForm';

export default function RsaEmergencyLanding({ page }: { page: RsaEmergencyPage }) {
  const path = `/car-roadside-assistance/${page.slug}`;
  const pageUrl = `${SITE_URL}${path}`;

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#142033]">
      <JsonLd
        data={[
          emergencyServiceSchema({
            name: `MYFNG ${page.title}`,
            description: page.metaDescription,
            url: pageUrl,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Roadside Assistance', url: `${SITE_URL}/car-roadside-assistance` },
            { name: page.title, url: pageUrl },
          ]),
          faqPageSchema(page.faqs),
        ]}
      />
      <Navbar />

      <section className="bg-gradient-to-br from-[#023D95] via-[#0357b8] to-[#0088E8] pb-14 pt-40 text-white sm:pt-44">
        <div className="mx-auto max-w-6xl px-4">
          <Link href="/car-roadside-assistance" className="block w-fit text-sm font-semibold text-white/80 hover:text-white">
            ← All roadside services
          </Link>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#e11d48] to-[#dc2626] px-3 py-1.5 text-xs font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-white" />
            {page.badge} · ETA {page.eta}
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold text-white sm:text-5xl">{page.title}</h1>
          <p className="mt-4 max-w-2xl text-base text-white/90 sm:text-lg">{page.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`tel:${RSA_PHONE}`}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#e11d48] to-[#dc2626] px-5 py-3 text-sm font-bold text-white"
            >
              CALL NOW
            </a>
            <a
              href={`https://wa.me/${RSA_WHATSAPP}?text=${encodeURIComponent(`Hello MYFNG Team, I need ${page.title}. Please dispatch help.`)}`}
              className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <div className="rounded-2xl border border-[#d7e4f5] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#0088E8]">Quick answer</p>
            <p className="mt-2 text-base leading-7 text-[#142033]">{page.metaDescription}</p>
          </div>

          {page.sections.map((section) => (
            <section key={section.heading} className="mt-8">
              <h2 className="text-2xl font-bold text-[#023D95]">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-[#3d4a5c]">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <h2 className="mt-10 text-2xl font-bold text-[#023D95]">What you get</h2>
          <ul className="mt-4 grid gap-3">
            {page.included.map((item) => (
              <li key={item} className="rounded-2xl border border-[#f3b4b4] bg-white px-4 py-3 text-sm text-[#142033] shadow-[0_0_0_3px_rgba(239,68,68,.06)]">
                {item}
              </li>
            ))}
          </ul>

          <h2 className="mt-10 text-2xl font-bold text-[#023D95]">Pricing</h2>
          <p className="mt-2 text-sm text-[#5c6778]">Exact cost depends on location, vehicle type and distance.</p>
          <div className="mt-4 rounded-2xl border border-[#f3b4b4] bg-white p-5 shadow-[0_0_0_3px_rgba(239,68,68,.06)]">
            <p className="text-sm font-semibold text-[#0088E8]">{page.price.label}</p>
            <p className="mt-1 text-3xl font-bold text-[#023D95]">
              {page.price.amount}
              {page.price.suffix ? <span className="ml-2 text-base font-semibold text-[#5c6778]">{page.price.suffix}</span> : null}
            </p>
            <p className="mt-2 text-sm text-[#5c6778]">{page.price.note}</p>
          </div>

          <h2 className="mt-10 text-2xl font-bold text-[#023D95]">How it works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {page.steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[#d7e4f5] bg-white p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8f3ff] text-sm font-black text-[#023D95]">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-base font-bold text-[#023D95]">{step.title}</h3>
                <p className="mt-1 text-sm text-[#5c6778]">{step.text}</p>
              </li>
            ))}
          </ol>

          {page.extra ? (
            <div id={page.extra.id} className="mt-10 scroll-mt-28 rounded-2xl border border-[#f3b4b4] bg-white p-5 shadow-[0_0_0_3px_rgba(239,68,68,.06)]">
              <h2 className="text-2xl font-bold text-[#023D95]">{page.extra.title}</h2>
              <p className="mt-2 text-sm text-[#5c6778]">{page.extra.text}</p>
              <ul className="mt-4 grid gap-2">
                {page.extra.points.map((point) => (
                  <li key={point} className="text-sm text-[#142033]">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {page.note ? (
            <p className="mt-6 text-sm text-[#5c6778]">
              {page.note.text}{' '}
              <Link href={page.note.href} className="font-semibold text-[#0088E8]">
                {page.note.label}
              </Link>
            </p>
          ) : null}

          <h2 className="mt-10 text-2xl font-bold text-[#023D95]">Where this service is available</h2>
          <p className="mt-3 text-sm leading-7 text-[#3d4a5c]">
            MYFNG sends {page.title.toLowerCase()} help 24×7 across these cities. Share a landmark or live location when you request help.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {RSA_SERVICE_AREAS.map((city) => (
              <li key={city} className="rounded-full border border-[#d7e4f5] bg-white px-3 py-1.5 text-sm font-semibold text-[#023D95]">
                {city}
              </li>
            ))}
          </ul>
        </div>

        <aside className="h-fit rounded-[20px] border border-[#f3b4b4] bg-white p-4 shadow-[0_0_0_4px_rgba(239,68,68,.08),0_18px_50px_rgba(2,61,149,.10)] lg:sticky lg:top-28">
          <h2 className="text-2xl font-bold text-[#023D95]">Request {page.title}</h2>
          <div className="mt-4">
            <RsaServiceRequestForm
              serviceLabel={page.title}
              whatsappService={page.whatsappService}
              campaign={page.slug}
              showDropLink={page.showDropLink}
            />
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <h2 className="text-2xl font-bold text-[#023D95]">Questions about {page.title}</h2>
        <div className="mt-4 grid gap-3">
          {page.faqs.map((faq) => (
            <div key={faq.question} className="rounded-2xl border border-[#d7e4f5] bg-white p-4">
              <h3 className="text-base font-bold text-[#023D95]">{faq.question}</h3>
              <p className="mt-1 text-sm text-[#5c6778]">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-[#023D95]">Other help</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RSA_EMERGENCY_PAGES.filter((item) => item.slug !== page.slug).map((item) => (
              <Link
                key={item.slug}
                href={`/car-roadside-assistance/${item.slug}`}
                className="rounded-2xl border border-[#f3b4b4] bg-[#F5F7FA] p-4"
              >
                <div className="font-bold text-[#023D95]">{item.title}</div>
                <div className="mt-1 text-sm text-[#5c6778]">ETA {item.eta}</div>
              </Link>
            ))}
            <Link href="/car-services/periodic-car-service" className="rounded-2xl border border-[#d7e4f5] bg-[#F5F7FA] p-4">
              <div className="font-bold text-[#023D95]">Periodic Car Service</div>
              <div className="mt-1 text-sm text-[#5c6778]">Workshop booking, already live</div>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
