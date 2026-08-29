export default function AppDownloadSection({
  downloadHref,
  asHero = false,
}: {
  downloadHref?: string;
  asHero?: boolean;
} = {}) {
  const playHref = downloadHref || 'https://play.google.com/store/apps/details?id=com.myfng.app';
  const iosHref = downloadHref || 'https://apps.apple.com/in/app/myfng-trusted-car-care/id6767495114';
  const openStore = downloadHref
    ? {}
    : { target: '_blank' as const, rel: 'noopener noreferrer' };
  const TitleTag = asHero ? 'h1' : 'h2';
  return (
    <section
      className={`bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden ${
        asHero
          ? 'pt-40 sm:pt-44 md:pt-48 lg:pt-52 pb-12 sm:pb-16 md:pb-20'
          : 'py-12 sm:py-16 md:py-20'
      }`}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-400 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
          {/* Left: App Info + Download */}
          <div className="lg:col-span-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Now Available on Android & iOS
            </div>

            <TitleTag className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
              Download the<br />
              <span className="text-yellow-300">MyFNG App</span>
            </TitleTag>

            <p className="text-blue-100 text-sm sm:text-base max-w-lg mb-5">
              {asHero
                ? 'Book car service and repairs near you in Mumbai, Thane, Navi Mumbai and Pune. Periodic servicing, AC repair, engine work — with live updates from your phone.'
                : 'Book car services in 60 seconds, track live updates, get AI-powered diagnostics, and manage everything from your phone.'}
            </p>

            {/* App Features */}
            <div className="grid grid-cols-2 gap-2 mb-5 max-w-sm mx-auto lg:mx-0">
              {[
                { icon: '⚡', text: 'Book in 60 Seconds' },
                { icon: '📍', text: 'Live Tracking' },
                { icon: '🤖', text: 'AI Diagnostics' },
                { icon: '📸', text: 'Photo Updates' },
                { icon: '💰', text: 'Transparent Pricing' },
                { icon: '🛡️', text: 'Service Warranty' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-2.5 py-2 border border-white/10">
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <span className="text-white text-xs font-medium">{text}</span>
                </div>
              ))}
            </div>

            {/* Download Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              {downloadHref ? (
                <a
                  href={downloadHref}
                  className="inline-flex items-center justify-center gap-2 bg-white text-blue-800 hover:bg-blue-50 font-bold pl-4 pr-6 py-3 rounded-xl transition-all hover:scale-105 shadow-xl"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 14.59L8.41 12 11 9.41V17h2V9.41l2.59 2.59L17 11l-5-5-5 5 1.41 1.41L11 9.41V17h2Z" />
                  </svg>
                  Download MyFNG App
                </a>
              ) : (
                <>
              <a
                href={playHref}
                {...openStore}
                className="flex items-center gap-2 bg-[#01875f] hover:bg-[#016d4d] text-white pl-3 pr-5 py-2.5 rounded-xl transition-all hover:scale-105 shadow-xl"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
                </svg>
                <div className="text-left">
                  <div className="text-[9px] uppercase leading-tight opacity-80">GET IT ON</div>
                  <div className="text-sm font-semibold leading-tight">Google Play</div>
                </div>
              </a>

              <a
                href={iosHref}
                {...openStore}
                className="flex items-center gap-2 bg-black hover:bg-gray-900 text-white pl-3 pr-5 py-2.5 rounded-xl transition-all hover:scale-105 shadow-xl border border-white/20"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="text-left">
                  <div className="text-[9px] uppercase leading-tight opacity-80">Download on the</div>
                  <div className="text-sm font-semibold leading-tight">App Store</div>
                </div>
              </a>
                </>
              )}
            </div>

            {/* Rating */}
            <div className="mt-4 flex items-center justify-center lg:justify-start gap-3 text-white/80 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-yellow-400">★★★★★</span>
                <span>4.8 Rating</span>
              </div>
              <div className="w-px h-3 bg-white/30" />
              <span>Trusted by 10,000+ Customers</span>
            </div>
          </div>

          {/* Center: Phone Mockup with 3D Popups */}
          <div className="lg:col-span-3 flex justify-center">
            <div className="relative">
              <div className="relative w-52 sm:w-56 h-[26rem] sm:h-[28rem] bg-white rounded-[2.5rem] border-[5px] border-gray-800 shadow-2xl shadow-black/40 overflow-hidden">
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
                <img
                  src="/myfng-app-ui.png"
                  alt="MyFNG App"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              </div>
              {/* 3D Floating Popups */}
              <div className="absolute -left-4 sm:-left-10 top-8 sm:top-16 bg-white rounded-xl sm:rounded-2xl shadow-2xl px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 animate-[bounce_3s_ease-in-out_infinite] z-10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-sm sm:text-lg">🚗</span>
                  </div>
                  <div>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">Free</p>
                    <p className="text-[10px] sm:text-xs font-bold text-gray-900">Pickup & Drop</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-4 sm:-right-12 top-28 sm:top-36 bg-white rounded-xl sm:rounded-2xl shadow-2xl px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 animate-[bounce_3s_ease-in-out_infinite_0.5s] z-10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm sm:text-lg">🔔</span>
                  </div>
                  <div>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">Real-Time</p>
                    <p className="text-[10px] sm:text-xs font-bold text-gray-900">Live Updates</p>
                  </div>
                </div>
              </div>
              <div className="absolute -left-4 sm:-left-12 bottom-28 sm:bottom-36 bg-white rounded-xl sm:rounded-2xl shadow-2xl px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 animate-[bounce_3s_ease-in-out_infinite_1s] z-10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-sm sm:text-lg">🤖</span>
                  </div>
                  <div>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">AI-Powered</p>
                    <p className="text-[10px] sm:text-xs font-bold text-gray-900">Diagnostics</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-4 sm:-right-10 bottom-12 sm:bottom-20 bg-white rounded-xl sm:rounded-2xl shadow-2xl px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 animate-[bounce_3s_ease-in-out_infinite_1.5s] z-10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-sm sm:text-lg">⭐</span>
                  </div>
                  <div>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">4.8 Star</p>
                    <p className="text-[10px] sm:text-xs font-bold text-gray-900">Rated App</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Prime Membership Card */}
          <div className="lg:col-span-5">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 sm:p-6">
              {/* Prime Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    MyFNG <span className="text-yellow-300">Prime</span>
                  </h3>
                  <p className="text-blue-200 text-xs sm:text-sm">One Membership. Unlimited Benefits.</p>
                </div>
                <div className="bg-yellow-400 text-gray-900 px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                  ₹699/yr
                </div>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                {[
                  { icon: '💸', title: '10% Off Periodic Packages', value: 'Save up to ₹1,000' },
                  { icon: '💳', title: '5% Cashback to Wallet', value: 'On every bill, ₹500' },
                  { icon: '🔧', title: 'Free Top-Up & Inspection (2x)', value: 'Worth ₹1,200' },
                  { icon: '🔍', title: 'Free Car Scanning (2x)', value: 'Worth ₹1,200' },
                  { icon: '📋', title: 'Free Insurance Claim Help', value: 'Worth ₹1,000' },
                  { icon: '💬', title: 'Prime Personal WhatsApp Group', value: 'Senior technical advisor' },
                  { icon: '📅', title: 'Priority Slot Booking', value: 'Worth ₹500' },
                  { icon: '🛡️', title: '6-Month Extended Warranty', value: 'Worth ₹500' },
                ].map(({ icon, title, value }) => (
                  <div key={title} className="flex items-start gap-2 bg-white/8 rounded-lg px-3 py-2 border border-white/5">
                    <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
                    <div>
                      <p className="text-white text-xs sm:text-sm font-medium leading-tight">{title}</p>
                      <p className="text-blue-200 text-[10px] sm:text-xs leading-tight">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Value + CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-yellow-400/20 to-yellow-500/10 border border-yellow-400/30 rounded-xl px-4 py-3">
                <div className="text-center sm:text-left">
                  <p className="text-yellow-300 text-xs font-medium">Total Benefits Worth</p>
                  <p className="text-white text-xl font-bold">₹6,650+ <span className="text-sm font-normal text-blue-200">/ year</span></p>
                </div>
                <div className="flex items-center gap-2">
                  {downloadHref ? (
                    <a
                      href={downloadHref}
                      className="bg-white hover:bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold text-xs transition-all hover:scale-105 shadow-lg"
                    >
                      Download App
                    </a>
                  ) : (
                    <>
                  <a
                    href={playHref}
                    {...openStore}
                    className="bg-[#01875f] hover:bg-[#016d4d] text-white px-3.5 py-2 rounded-lg font-bold text-xs transition-all hover:scale-105 shadow-lg flex items-center gap-1.5"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
                    </svg>
                    Android
                  </a>
                  <a
                    href={iosHref}
                    {...openStore}
                    className="bg-black hover:bg-gray-900 text-white px-3.5 py-2 rounded-lg font-bold text-xs transition-all hover:scale-105 shadow-lg flex items-center gap-1.5 border border-white/20"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    iOS
                  </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust Bar */}
        <div className="mt-10 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-4 py-4 sm:px-8 sm:py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '🛡️', title: 'Premium Access', color: 'from-blue-400 to-blue-600' },
              { icon: '🎁', title: 'Exclusive Benefits', color: 'from-purple-400 to-purple-600' },
              { icon: '🎧', title: 'Priority Support', color: 'from-indigo-400 to-indigo-600' },
              { icon: '💎', title: 'Special Discounts', color: 'from-yellow-400 to-yellow-600' },
            ].map(({ icon, title, color }) => (
              <div key={title} className="flex items-center gap-3 justify-center">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                  <span className="text-lg">{icon}</span>
                </div>
                <span className="text-white text-xs sm:text-sm font-semibold">{title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
