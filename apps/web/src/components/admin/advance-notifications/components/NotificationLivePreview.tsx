'use client';

type Props = {
  title: string;
  message: string;
  notificationType: string;
  priority: 'default' | 'high';
  imageUrl?: string;
};

const TYPE_LABELS: Record<string, string> = {
  promotional: 'Promotional',
  transactional: 'Transactional',
  reminder: 'Reminder',
  system: 'System',
};

export default function NotificationLivePreview({
  title,
  message,
  notificationType,
  priority,
  imageUrl,
}: Props) {
  const typeLabel = TYPE_LABELS[notificationType] || notificationType;
  const priorityLabel = priority === 'high' ? 'HIGH PRIORITY' : 'NORMAL';

  return (
    <div className="push-card p-5 sticky top-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-gray-900">Live Preview</h3>
          <p className="text-xs text-gray-500 mt-0.5">Android notification shade</p>
        </div>
        <span className="push-badge-pink">{typeLabel}</span>
      </div>

      <div className="push-phone-frame">
        <div className="push-phone-screen">
          <div className="push-notification-preview">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-md bg-[#1f7a55] text-white text-xs font-bold flex items-center justify-center">
                M
              </div>
              <div className="text-xs text-gray-500">
                <span className="font-semibold text-gray-800">MyFNG</span> · now
              </div>
            </div>
            <p className="font-bold text-sm text-gray-900 leading-snug">
              {title.trim() || 'Your notification title'}
            </p>
            <p className="text-sm text-gray-600 mt-1 leading-snug">
              {message.trim() || 'Your message body will appear here as you type.'}
            </p>
            {imageUrl?.trim() ? (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 h-24 flex items-center justify-center text-xs text-gray-400">
                Image attached
              </div>
            ) : null}
          </div>
          <p className="text-[10px] text-center text-gray-500 mt-4 uppercase tracking-wide">
            {typeLabel} · {priorityLabel}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">Preview updates in real time.</p>
    </div>
  );
}
