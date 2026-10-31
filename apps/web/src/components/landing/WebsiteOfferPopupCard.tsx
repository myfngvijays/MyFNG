import { Clock } from 'lucide-react';
import { DEFAULT_WEBSITE_POPUP_COLORS, type WebsiteOfferPopupConfig } from '@/lib/website-offer-popup';

type CardPopup = WebsiteOfferPopupConfig & { href?: string };

export default function WebsiteOfferPopupCard({
  popup,
  preview = false,
}: {
  popup: CardPopup;
  preview?: boolean;
}) {
  const colors = { ...DEFAULT_WEBSITE_POPUP_COLORS, ...popup.colors };
  const buttonStyle = { backgroundColor: colors.button_bg, color: colors.button_text };

  return (
    <div
      className="overflow-hidden rounded-[28px] shadow-2xl"
      style={{ backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.ring}` }}
    >
      {popup.image_url ? (
        <img src={popup.image_url} alt="" className="aspect-[2/1] w-full object-cover" />
      ) : null}
      <div className="px-5 py-5 text-center sm:px-8 sm:py-6">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: colors.headline }}>
          {popup.headline}
        </h2>
        {popup.subtitle ? (
          <p className="mt-2 text-sm font-semibold sm:text-base" style={{ color: colors.subtitle }}>
            {popup.subtitle}
          </p>
        ) : null}

        {popup.coupon_code ? (
          <div className="mx-auto mt-4 flex max-w-[320px] overflow-hidden rounded-2xl shadow-md">
            <div
              className="flex flex-1 items-center justify-center px-3 py-4 text-xl font-extrabold tracking-[0.12em] sm:text-2xl"
              style={{ backgroundColor: colors.code_bg, color: colors.code_text }}
            >
              {popup.coupon_code}
            </div>
            {popup.offer_label ? (
              <div
                className="flex w-[42%] items-center justify-center px-3 py-4 text-center text-xl font-extrabold leading-tight sm:text-2xl"
                style={{ backgroundColor: colors.offer_bg, color: colors.offer_text }}
              >
                {popup.offer_label}
              </div>
            ) : null}
          </div>
        ) : null}

        {popup.badge_text ? (
          <div
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide"
            style={{ backgroundColor: colors.badge_bg, color: colors.badge_text }}
          >
            <Clock className="h-3.5 w-3.5" />
            {popup.badge_text}
          </div>
        ) : null}

        {preview ? (
          <div className="mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-extrabold shadow-lg" style={buttonStyle}>
            {popup.button_text}
          </div>
        ) : (
          <a
            href={popup.href || popup.button_href}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-extrabold shadow-lg transition-opacity hover:opacity-90"
            style={buttonStyle}
          >
            {popup.button_text}
          </a>
        )}
      </div>
    </div>
  );
}
