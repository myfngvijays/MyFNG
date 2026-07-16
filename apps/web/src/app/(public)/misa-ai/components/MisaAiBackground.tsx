'use client';

export function MisaAiBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#050f1f] via-[#0a2545] to-[#023D95]" />
      <div className="misa-ai-grid absolute inset-0 opacity-60" />
      <div className="misa-ai-orb absolute -left-24 -top-20 h-[28rem] w-[28rem] rounded-full bg-brand-primary/25 blur-[100px]" />
      <div className="misa-ai-orb-delay absolute -right-16 top-1/4 h-80 w-80 rounded-full bg-cyan-400/15 blur-[90px]" />
      <div className="misa-ai-orb absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-indigo-500/20 blur-[80px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}
