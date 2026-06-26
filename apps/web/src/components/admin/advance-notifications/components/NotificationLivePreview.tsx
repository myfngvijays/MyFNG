'use client';

import { useState } from 'react';
import { ChevronDown, Eye, Smartphone, Apple } from 'lucide-react';

type Props = {
  title: string;
  message: string;
  notificationType: string;
  priority: 'default' | 'high';
  imageUrl?: string;
  iconUrl?: string;
};

type PreviewDevice = 'ios' | 'android';

const TYPE_LABELS: Record<string, string> = {
  promotional: 'Promotional',
  transactional: 'Transactional',
  reminder: 'Reminder',
  system: 'System',
};

const TYPE_DOT: Record<string, string> = {
  promotional: 'bg-pink-500',
  transactional: 'bg-blue-500',
  reminder: 'bg-amber-500',
  system: 'bg-gray-500',
};

type PreviewContent = {
  displayTitle: string;
  displayMessage: string;
  trimmedImage: string;
  trimmedIcon: string;
  typeLabel: string;
  priorityLabel: string;
};

function buildContent(
  title: string,
  message: string,
  notificationType: string,
  priority: 'default' | 'high',
  imageUrl?: string,
  iconUrl?: string,
): PreviewContent {
  return {
    displayTitle: title.trim() || 'Your notification title',
    displayMessage: message.trim() || 'Your message body will appear here as you type.',
    trimmedImage: imageUrl?.trim() || '',
    trimmedIcon: iconUrl?.trim() || '',
    typeLabel: TYPE_LABELS[notificationType] || notificationType,
    priorityLabel: priority === 'high' ? 'High priority' : 'Normal',
  };
}

function AppIcon({ iconUrl, rounded = 'rounded-[7px]' }: { iconUrl: string; rounded?: string }) {
  if (iconUrl) {
    return (
      <div className={`push-app-icon shrink-0 overflow-hidden p-0 bg-white ${rounded}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            el.parentElement!.classList.add('push-app-icon--fallback');
            el.parentElement!.textContent = 'M';
          }}
        />
      </div>
    );
  }

  return <div className={`push-app-icon shrink-0 ${rounded}`}>M</div>;
}

function AndroidPhone({ content }: { content: PreviewContent }) {
  const { displayTitle, displayMessage, trimmedImage, trimmedIcon, typeLabel, priorityLabel } = content;

  return (
    <div className="push-device-frame push-device-frame--android">
      <span className="push-device-btn push-device-btn--power-android" aria-hidden />
      <span className="push-device-btn push-device-btn--vol-up-android" aria-hidden />
      <span className="push-device-btn push-device-btn--vol-down-android" aria-hidden />

      <div className="push-phone-shell">
        <div className="push-phone-notch-slot">
          <div className="push-phone-camera-hole" />
        </div>
        <div className="push-phone-screen">
          <div className="push-phone-statusbar">
            <span>9:41</span>
            <div className="push-phone-status-icons">
              <span className="push-signal-bar" />
              <span className="push-signal-bar push-signal-bar--tall" />
              <span className="push-battery" />
            </div>
          </div>

          <div className="push-phone-wallpaper push-phone-wallpaper--android">
            <p className="push-shade-label">Notifications</p>

            <div className={`push-notification-preview ${trimmedImage ? 'expanded' : ''}`}>
              <div className="flex items-start gap-2.5">
                <AppIcon iconUrl={trimmedIcon} rounded="rounded-[8px]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">
                      MyFNG <span className="text-gray-400 font-normal">· now</span>
                    </p>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </div>
                  <p className="font-bold text-[13px] text-gray-900 leading-snug mt-0.5 line-clamp-2">
                    {displayTitle}
                  </p>
                  <p className="text-[12px] text-gray-600 mt-1 leading-snug line-clamp-3">
                    {displayMessage}
                  </p>
                </div>
              </div>

              {trimmedImage ? (
                <div className="mt-2.5 ml-[34px] rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={trimmedImage}
                    alt=""
                    className="w-full h-[72px] object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="push-preview-meta">
              <span>{typeLabel}</span>
              <span>·</span>
              <span>{priorityLabel}</span>
            </div>
          </div>

          <div className="push-phone-screen-footer push-phone-screen-footer--android">
            <div className="push-android-nav">
              <span />
              <span className="push-android-nav-home" />
              <span />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IosPhone({ content }: { content: PreviewContent }) {
  const { displayTitle, displayMessage, trimmedImage, trimmedIcon, typeLabel } = content;

  return (
    <div className="push-device-frame push-device-frame--ios">
      <span className="push-device-btn push-device-btn--silent" aria-hidden />
      <span className="push-device-btn push-device-btn--vol-up" aria-hidden />
      <span className="push-device-btn push-device-btn--vol-down" aria-hidden />
      <span className="push-device-btn push-device-btn--power" aria-hidden />

      <div className="push-phone-shell">
        <div className="push-phone-notch-slot">
          <div className="push-phone-dynamic-island" />
        </div>
        <div className="push-phone-screen push-phone-screen--ios">
          <div className="push-phone-wallpaper push-phone-wallpaper--ios">
            <p className="push-ios-time">9:41</p>
            <p className="push-ios-date">Tuesday, June 23</p>

            <div
              className={`push-notification-preview push-notification-preview--ios ${trimmedImage ? 'expanded' : ''}`}
            >
              <div className="flex items-start gap-2">
                <AppIcon iconUrl={trimmedIcon} rounded="rounded-[6px]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">MyFNG</p>
                    <span className="text-[10px] text-gray-400">now</span>
                  </div>
                  <p className="font-semibold text-[12px] text-gray-900 leading-snug mt-0.5 line-clamp-2">
                    {displayTitle}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5 leading-snug line-clamp-2">
                    {displayMessage}
                  </p>
                </div>
              </div>

              {trimmedImage ? (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={trimmedImage}
                    alt=""
                    className="w-full h-[64px] object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="push-preview-meta">
              <span>{typeLabel}</span>
            </div>
          </div>

          <div className="push-phone-screen-footer push-phone-screen-footer--ios">
            <div className="push-home-indicator" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationLivePreview({
  title,
  message,
  notificationType,
  priority,
  imageUrl,
  iconUrl,
}: Props) {
  const [device, setDevice] = useState<PreviewDevice>('ios');
  const content = buildContent(title, message, notificationType, priority, imageUrl, iconUrl);

  return (
    <div className="push-card push-preview-panel">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="push-preview-header-icon shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-gray-900">Live Preview</h3>
            <p className="text-[11px] text-gray-500">
              {device === 'ios' ? 'iPhone lock screen' : 'Android notification shade'}
            </p>
          </div>
        </div>
        <span className="push-badge-pink shrink-0">{content.typeLabel}</span>
      </div>

      <div className="push-device-toggle" role="tablist" aria-label="Preview device">
        <span
          className={`push-device-toggle-pill ${device === 'ios' ? 'to-ios' : 'to-android'}`}
          aria-hidden
        />
        <button
          type="button"
          role="tab"
          aria-selected={device === 'ios'}
          onClick={() => setDevice('ios')}
          className={`push-device-toggle-btn ${device === 'ios' ? 'active' : ''}`}
        >
          <Apple className="w-3.5 h-3.5" />
          iOS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={device === 'android'}
          onClick={() => setDevice('android')}
          className={`push-device-toggle-btn ${device === 'android' ? 'active' : ''}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Android
        </button>
      </div>

      <div className="push-phone-stage">
        <div className={`push-phone-layer ${device === 'ios' ? 'visible' : 'hidden'}`}>
          <IosPhone content={content} />
        </div>
        <div className={`push-phone-layer ${device === 'android' ? 'visible' : 'hidden'}`}>
          <AndroidPhone content={content} />
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center mt-3">Preview updates in real time</p>
    </div>
  );
}

export { TYPE_DOT, TYPE_LABELS };
