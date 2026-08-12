'use client';

import {
  BookOpen,
  Link2,
  QrCode,
  Shield,
  Smartphone,
  Split,
  Upload,
  Share2,
  Webhook,
  MousePointerClick,
  LayoutDashboard,
} from 'lucide-react';

const SECTIONS = [
  {
    id: 'overview',
    icon: LayoutDashboard,
    title: 'Overview — kya hai?',
    body: [
      'Yeh pehla tab hai — yahan numbers aur quick lists milte hain.',
      'Upar date filter se last 7 / 30 days ya custom range chuno — clicks / QR us period ke hisaab se dikhenge.',
      'Cards: total links, period clicks, QR scans, all-time clicks / QR / unique.',
      'Links with UTM tags: Overview pe latest 10. Poori list + filters ke liye “View more” → UTM Links tab.',
      'Recent opens: Overview pe latest 20. Poori history + filters ke liye “View more” → Recent Opens tab.',
    ],
  },
  {
    id: 'create',
    icon: Link2,
    title: 'Create Link — naya short link / QR',
    body: [
      'Jab naya short link ya QR banana ho, yeh tab use karo.',
      'Output type: sirf Short link, sirf QR, ya dono (Link + QR) — jo chaho select karo.',
      'Basics me Destination URL zaroori hai (jaahan user finally jayega). Title, custom slug (/s/saket-wp), tags, folder, notes optional.',
      'UTM (source, medium, campaign…) marketing track karne ke liye — destination URL pe chipak jate hain.',
      'Expiry: kab tak link chale (never / 7 / 30 / 90 / 365 days).',
      'Right side pe live preview rehta hai — URL / QR pehle se dikhega. Neeche Create button se save hota hai.',
    ],
  },
  {
    id: 'advanced',
    icon: Smartphone,
    title: 'Advanced options — extra settings',
    body: [
      'Create Link ke neeche violet “Advanced options” box — har tab alag kaam.',
      'Device & App: iPhone / Android / Desktop pe alag destination URL. App deep link (jaise myfng://…) bhi yahan. Landing page on/off.',
      'Security: password, max clicks, fallback URL (neeche alag section me detail).',
      'WhatsApp / OG: jab link WhatsApp ya social pe share ho, title / description / image dikhe.',
      'A/B & Geo: do URLs pe traffic baanto, ya country ke hisaab se alag URL.',
      'Pixels & Hook: Meta / Google pixel ID + webhook (link open hone pe notify).',
      'Bulk: ek saath kai links — number series (1 se 24) ya URL list paste.',
    ],
  },
  {
    id: 'series',
    icon: Upload,
    title: 'Bulk number series — jaise Saket 1 se 24',
    body: [
      'Kab use: ek hi destination, lekin 24 alag short links chahiye (parking / standee / flat number).',
      'Create → Advanced → Bulk → “Number series (1→24)” select karo.',
      'From = 1, To = 24. Title: Saket Complex {n} → Saket Complex 1, 2, 3…',
      'Slug: saket-{n} → myfng.in/s/saket-1 … saket-24. {n} ki jagah number aata hai.',
      'Destination URL Basics me ya Bulk me daalo — blank ho to Basics wala use hoga.',
      'Zero pad 2 rakho to saket-01, saket-02… Max 100 links ek baar. “Paste URL list” alag destinations ke liye hai.',
    ],
  },
  {
    id: 'recent-opens',
    icon: MousePointerClick,
    title: 'Recent Opens tab — full click log',
    body: [
      'Overview pe sirf latest 20 dikhte hain. Poora log is tab me hai.',
      'Filters: date range, event type (click / QR), platform, UTM source/medium/campaign, search title/code.',
      'Pagination 10 / 25 / 50 per page.',
    ],
  },
  {
    id: 'utm-links-tab',
    icon: Share2,
    title: 'UTM Links tab — saari UTM tagged links',
    body: [
      'Overview pe sirf latest 10 UTM links. Poori list is tab me.',
      'Search title/code + filter UTM source / medium / campaign.',
      'Clicks aur QR counts bhi table me dikhte hain.',
    ],
  },
  {
    id: 'links',
    icon: MousePointerClick,
    title: 'My Links — manage / edit',
    body: [
      'Saare bane hue links yahan list me dikhte hain. Search se title, code ya URL dhoondo.',
      '10 / 20 / 50 per page; neeche Prev / Next / page numbers.',
      'Koi row select karo → right side preview: QR, clicks, title / destination / UTM edit, QR download.',
      'Copy, open, pause (band), activate, delete — row actions se.',
      'Purane links tootenge nahi — naye advanced fields optional hain.',
    ],
  },
  {
    id: 'urls',
    icon: QrCode,
    title: 'Short URL vs QR vs Landing — farq',
    body: [
      '/s/code — normal short link. Share karo WhatsApp pe; simple link seedha destination pe le jata hai.',
      'QR ke andar alag track URL hoti hai — scan count alag se Overview me “QR scans” me aata hai.',
      '/l/code — branded landing page. Password, OG preview, deep link, ya landing on hone pe use hoti hai.',
      'Link click ≠ QR scan — dono alag count. Campaign me dono dekhna ho to Overview dekho.',
    ],
  },
  {
    id: 'security',
    icon: Shield,
    title: 'Security — password, max clicks, fallback',
    body: [
      'Password: link open karne se pehle user se password maanga jayega (landing pe). Blank = koi lock nahi. Eye icon se password dikhao/chhupao.',
      'Max clicks: jaise 500 — itne opens ke baad link band. Blank = unlimited.',
      'Fallback URL: expiry ya max clicks ke baad user is URL pe redirect (jaise homepage).',
      'Basics me Expiry date bhi isi fallback ke saath kaam karti hai.',
    ],
  },
  {
    id: 'utm',
    icon: Share2,
    title: 'UTM & tracking — campaign measure',
    body: [
      'UTM = marketing labels. Example: source=whatsapp, medium=society, campaign=saket_launch.',
      'Create pe bharo — final destination URL me ye query params chipak jate hain, Google Analytics / ads me track hota hai.',
      'Overview me top UTM sources / mediums / campaigns + Recent opens table dikhti hai.',
      'Pixels: Meta / Google ID landing pe fire. Webhook: har open pe tumhare server pe POST.',
    ],
  },
  {
    id: 'abgeo',
    icon: Split,
    title: 'A/B & Geo — split / country redirect',
    body: [
      'A/B: do alag URLs + weight (jaise 50 / 50). Har visitor randomly weight ke hisaab se A ya B pe jata hai — test ke liye.',
      'Geo: countries IN, AE… + URL. Us country se aaye visitor us URL pe redirect.',
      'Device URLs (iOS / Android / Desktop) set hon to pehle device rule apply ho sakta hai.',
    ],
  },
  {
    id: 'api',
    icon: Webhook,
    title: 'Tips / setup — yaad rakhna',
    body: [
      'Advanced fields DB me chahiye: Supabase pe 312_managed_short_links_advanced.sql run karo.',
      'System Monitor me Link Manager health check dikhta hai (tables / API key).',
      'Same custom slug dobara nahi banega — series me unique template rakho (saket-{n}).',
      'Kuch samajh na aaye to pehle Overview numbers dekho, phir Create se ek test link banao.',
    ],
  },
];

export default function ReadmeSection() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-600 p-2.5 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Link Manager — README</h2>
            <p className="mt-1 text-sm text-gray-600">
              Short guide: har cheez kya hai aur kab use karni hai. Sirf pehla section (Overview) default open
              rehta hai — baaki pe Show dabao.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const defaultOpen = section.id === 'overview';
          return (
            <details
              key={section.id}
              open={defaultOpen}
              className="group rounded-2xl border border-gray-200 bg-white shadow-sm open:border-blue-200"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5">
                <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-bold text-gray-900">{section.title}</span>
                <span className="text-xs font-semibold text-gray-400 group-open:hidden">Show</span>
                <span className="hidden text-xs font-semibold text-blue-600 group-open:inline">Hide</span>
              </summary>
              <ul className="space-y-2.5 border-t border-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-700">
                {section.body.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
