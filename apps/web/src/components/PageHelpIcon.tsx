'use client';

import { usePathname } from 'next/navigation';
import MenuHelpPopover from '@/components/MenuHelpPopover';
import { getMenuHelp } from '@/lib/dashboard/menuHelpCopy';

/**
 * Single page-level "i" — only explains the current open page (not every sidebar item).
 */
export default function PageHelpIcon({
  href,
  label,
  className = '',
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  const pathname = usePathname() || '';
  const help = getMenuHelp({ href: href || pathname, label });
  return (
    <MenuHelpPopover
      {...help}
      tone="header"
      align="left"
      className={className}
    />
  );
}
