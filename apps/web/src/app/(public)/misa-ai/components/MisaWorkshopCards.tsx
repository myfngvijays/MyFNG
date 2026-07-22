'use client';

import { MapPin, Navigation, Phone, Wrench } from 'lucide-react';
import { DEFAULT_WORKSHOP_PHONE, type WorkshopCardItem } from '@/lib/chatbot_v2/workshopUi';

type Props = {
  items: WorkshopCardItem[];
  title?: string;
  onBook: (workshop: WorkshopCardItem) => void;
};

function workshopTel(phone?: string) {
  const digits = String(phone || DEFAULT_WORKSHOP_PHONE).replace(/\D/g, '').slice(-10);
  return `tel:+91${digits}`;
}

const actionBtnBase =
  'inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-bold transition';

export function MisaWorkshopCards({ items, title, onBook }: Props) {
  if (!items.length) return null;

  return (
    <div className="mt-3 w-full min-w-0 max-w-full">
      <div className="rounded-2xl border border-brand-primary/12 bg-gradient-to-b from-slate-50/90 to-white p-3 sm:p-3.5">
        {title ? (
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-primary/80">{title}</p>
        ) : null}

        <div className="grid w-full grid-cols-2 gap-2.5 sm:gap-3">
          {items.map((workshop) => (
            <article
              key={workshop.id}
              className="misa-workshop-card flex min-w-0 flex-col rounded-xl border border-brand-primary/10 bg-white p-3 shadow-sm"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-sm">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-bold leading-snug text-gray-900">{workshop.name}</h3>
                  {workshop.city ? (
                    <p className="mt-0.5 text-[10px] font-semibold text-brand-primary/70">{workshop.city}</p>
                  ) : null}
                </div>
              </div>

              {workshop.address ? (
                <p className="mt-2.5 flex min-w-0 items-start gap-1.5 text-[11px] leading-relaxed text-gray-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
                  <span className="line-clamp-3 break-words">{workshop.address}</span>
                </p>
              ) : null}

              {workshop.workingTime ? (
                <p className="mt-1.5 text-[10px] font-medium text-gray-500">{workshop.workingTime}</p>
              ) : null}

              <div className="mt-3 flex flex-col gap-1.5">
                {workshop.mapLink ? (
                  <a
                    href={workshop.mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className={`${actionBtnBase} border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100`}
                  >
                    <Navigation className="h-3.5 w-3.5 shrink-0" />
                    Directions
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className={`${actionBtnBase} border border-gray-200 bg-gray-50 text-gray-400`}
                  >
                    <Navigation className="h-3.5 w-3.5 shrink-0" />
                    Directions
                  </button>
                )}

                <a
                  href={workshopTel(workshop.phone)}
                  className={`${actionBtnBase} border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  Call Now
                </a>

                <button
                  type="button"
                  onClick={() => onBook(workshop)}
                  className={`${actionBtnBase} border border-brand-primary/20 bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-sm hover:opacity-95`}
                >
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  Book Now
                </button>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-3 text-center text-[11px] font-medium text-gray-500">
          ✨ All workshops offer free pickup & drop
        </p>
      </div>
    </div>
  );
}
