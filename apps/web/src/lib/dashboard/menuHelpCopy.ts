/**
 * "Ye kya hai?" copy for dashboard sidebar + header controls.
 * Keys: exact href, action id, or header ids.
 */

export type MenuHelpEntry = {
  title: string;
  body: string;
  tips?: string[];
};

const HEADER: Record<string, MenuHelpEntry> = {
  select_aansh: {
    title: 'Select Aansh',
    body:
      'Yahan se calling dialer (Aansh) choose / claim karte ho.\n\nJab call lagani ho, pehle yahan se available Aansh ID select karo. Bina session ke outbound call nahi chalegi.',
    tips: [
      'Sirf Telecaller / Lead Manager / RSA Manager ke liye dikhta hai.',
      'Session expire ho to dubara Select Aansh dabao.',
    ],
  },
  reminders: {
    title: 'Reminders',
    body:
      'Ye clock icon aaj ke pending follow-ups / callbacks dikhata hai.\n\nClick se Reminders page khulta hai jahan overdue aur scheduled callbacks list hoti hain. Badge count = aaj due / overdue reminders.',
    tips: [
      'Lead Manager team-wide reminders dekh sakta hai.',
      'Telecaller ko apni assigned reminders dikhti hain.',
    ],
  },
  notifications: {
    title: 'Notifications',
    body:
      'App ke andar system alerts aur activity notifications yahan aati hain (lead assign, status change, etc.).\n\nBell pe click = notifications panel. Unread count badge pe dikhta hai.',
    tips: [
      'Desktop browser alerts alag se Enable alerts se on ho sakte hain.',
      'Yeh WhatsApp inbox nahi hai — alag green WhatsApp button / menu use karo.',
    ],
  },
};

const BY_HREF: Record<string, MenuHelpEntry> = {
  '/dashboard/lead_manager': {
    title: 'Home',
    body:
      'Lead Manager CRM home: status counts, calls, charts, Quick Actions, aur upcoming reminders.',
  },
  '/dashboard/lead_manager/leads': {
    title: 'Leads',
    body:
      'Saari service leads / bookings list — filter, search, assign telecaller, status change.',
  },
  '/dashboard/lead_manager/followups': {
    title: 'Reminders',
    body: 'Pending follow-up callbacks list. Overdue pehle, scheduled baad mein.',
  },
  '/dashboard/lead_manager/team-whatsapp': {
    title: 'Team WA',
    body:
      'Team WhatsApp oversight — assigned WhatsApp chats (phone + assignee + last message).\n\nYeh service-leads queue nahi hai. Click se chat WhatsApp inbox mein khulti hai.',
    tips: [
      'Filter: assignee, unanswered hours, phone search.',
      'System / template messages bhi dikh sakte hain agar chat assigned hai.',
    ],
  },
  '/dashboard/lead_manager/floor': {
    title: 'Live floor',
    body: 'Live floor status — kaun punched in / busy / available, team activity overview.',
  },
  '/dashboard/lead_manager/whatsapp-dnd': {
    title: 'WA DND',
    body: 'WhatsApp Do-Not-Disturb — numbers jinpe WA message nahi bhejna / block list manage.',
  },
  '/dashboard/lead_manager/book': {
    title: 'Book',
    body: 'Nayi booking ya lead create karne ka form (customer, vehicle, service).',
  },
  '/dashboard/lead_manager/assignment': {
    title: 'Assignment',
    body:
      'Workshop assignment desk — leads jinhe workshop pe bhejna hai.\n\nYahan se workshop choose karke lead assign / reassign karte ho. Yeh telecaller lead queue nahi hai.',
    tips: [
      'Need Assignment = NEW/VALIDATED, complete, abhi workshop nahi.',
      'Rejected = workshop ne reject kiya.',
    ],
  },
  '/dashboard/lead_manager/workshops': {
    title: 'Workshops',
    body: 'Partner workshops list — details, city, assignment-ready network.',
  },
  '/dashboard/lead_manager/escalations': {
    title: 'Escalations',
    body: 'Escalated / stuck leads jo manager attention maangte hain.',
  },
  '/dashboard/lead_manager/team': {
    title: 'Team',
    body: 'Telecaller team members, permissions aur team management.',
  },
  '/dashboard/lead_manager/tags': {
    title: 'Lead tags',
    body:
      'Yahan se lead tags create karo (META, GOOGLE, WHATSAPP…).\n\nTelecallers lead detail pe ye tags apply kar sakte hain — incoming call reference ke liye.',
  },
  '/dashboard/lead_manager/statuses': {
    title: 'Lead status',
    body:
      'TeleCRM-style Active / Closed stages.\n\nActive, Won, Lost statuses create/edit/delete. Lost ke neeche Lost reasons alag manage.\n\n“Fresh” pehle New tha — filters aur Select status mein dikhega.',
  },
  '/dashboard/lead_manager/readme': {
    title: 'ReadMe',
    body:
      'Poora menu guide — har item kya hai aur kya karta hai, ek jagah padho.\n\nHar page pe title ke paas sirf ek i bhi hota hai (sirf usi page ke baare mein).',
  },
  '/dashboard/lead_manager/reports': {
    title: 'Reports · Overview',
    body: 'Team performance reports overview.',
  },
  '/dashboard/lead_manager/reports/leaderboard': {
    title: 'Leaderboard',
    body: 'Calls / bookings leaderboard — ranking by performance.',
  },
  '/dashboard/lead_manager/reports/calls': {
    title: 'Call activity',
    body: 'Call logs aur activity report for the team.',
  },
  '/dashboard/lead_manager/reports/exports': {
    title: 'Exports',
    body: 'Data export downloads for leads / calls reports.',
  },
  '/dashboard/lead_manager/reports/duplicates': {
    title: 'Duplicates',
    body: 'Duplicate leads by phone / vehicle — merge / clean up ke liye.',
  },
  '/dashboard/lead_manager/reports/pipeline': {
    title: 'Pipeline',
    body: 'Lead pipeline by status — funnel view of conversion stages.',
  },

  '/dashboard/telecaller': {
    title: 'Home',
    body: 'Telecaller CRM home: KPIs, calls, charts, Quick Actions, reminders.',
  },
  '/dashboard/telecaller/leads': {
    title: 'Leads',
    body: 'Aapki assigned leads list — call, WhatsApp, status update.',
  },
  '/dashboard/telecaller/followups': {
    title: 'Reminders',
    body: 'Aapke pending follow-up callbacks.',
  },
  '/dashboard/telecaller/book': {
    title: 'Book',
    body: 'Nayi booking / lead create.',
  },
  '/dashboard/telecaller/workshops': {
    title: 'Workshops',
    body: 'Nearby / available workshops for assigning service.',
  },
  '/dashboard/telecaller/rsa': {
    title: 'RSA',
    body: 'Roadside assistance related tasks / module for telecallers.',
  },
  '/dashboard/telecaller/reports': {
    title: 'Reports',
    body: 'Aapke call / booking reports.',
  },
  '/dashboard/telecaller/reports/leaderboard': {
    title: 'Leaderboard',
    body: 'Team leaderboard ranking.',
  },
  '/dashboard/telecaller/reports/calls': {
    title: 'Call activity',
    body: 'Aapki call activity detail.',
  },
  '/dashboard/telecaller/profile': {
    title: 'My Profile',
    body: 'Profile, punch status, aur personal settings.',
  },
  '/dashboard/telecaller/me': {
    title: 'My Profile',
    body: 'Profile, punch status, aur personal settings.',
  },
  '/dashboard/telecaller/readme': {
    title: 'ReadMe',
    body:
      'Poora menu guide — har item kya hai aur kya karta hai.\n\nHar page pe title ke paas sirf ek i hota hai usi page ke liye.',
  },
};

const BY_ACTION: Record<string, MenuHelpEntry> = {
  'open-wa-inbox': {
    title: 'WhatsApp',
    body:
      'WhatsApp inbox open hota hai — assigned customer chats, templates, replies.\n\nGreen FAB / yeh menu dono se same inbox khulta hai.',
  },
};

const BY_LABEL: Record<string, MenuHelpEntry> = {
  WhatsApp: BY_ACTION['open-wa-inbox'],
  Reports: {
    title: 'Reports',
    body: 'Reports section — overview, leaderboard, calls, exports, pipeline.',
  },
};

export function getMenuHelp(opts: {
  href?: string | null;
  action?: string | null;
  label?: string | null;
  headerId?: string | null;
}): MenuHelpEntry {
  if (opts.headerId && HEADER[opts.headerId]) return HEADER[opts.headerId];
  if (opts.action && BY_ACTION[opts.action]) return BY_ACTION[opts.action];
  const href = String(opts.href || '').split('?')[0];
  if (href && BY_HREF[href]) return BY_HREF[href];
  const label = String(opts.label || '').trim();
  if (label && BY_LABEL[label]) return BY_LABEL[label];
  return {
    title: label || 'Menu',
    body: `${label || 'Yeh page'} dashboard menu item hai. Click karke page kholo; detail wahan mil jayegi.`,
  };
}

export type ReadmeSection = {
  heading: string;
  items: Array<MenuHelpEntry & { href?: string }>;
};

/** Ordered ReadMe sections for Lead Manager sidebar menus + header tools. */
export function getLeadManagerReadme(): ReadmeSection[] {
  return [
    {
      heading: 'Header tools',
      items: [
        { ...HEADER.select_aansh },
        { ...HEADER.reminders },
        { ...HEADER.notifications },
      ],
    },
    {
      heading: 'Main menu',
      items: [
        { href: '/dashboard/lead_manager', ...BY_HREF['/dashboard/lead_manager'] },
        { href: '/dashboard/lead_manager/leads', ...BY_HREF['/dashboard/lead_manager/leads'] },
        { href: '/dashboard/lead_manager/followups', ...BY_HREF['/dashboard/lead_manager/followups'] },
        { ...BY_ACTION['open-wa-inbox'] },
        { href: '/dashboard/lead_manager/team-whatsapp', ...BY_HREF['/dashboard/lead_manager/team-whatsapp'] },
        { href: '/dashboard/lead_manager/floor', ...BY_HREF['/dashboard/lead_manager/floor'] },
        { href: '/dashboard/lead_manager/whatsapp-dnd', ...BY_HREF['/dashboard/lead_manager/whatsapp-dnd'] },
        { href: '/dashboard/lead_manager/book', ...BY_HREF['/dashboard/lead_manager/book'] },
        { href: '/dashboard/lead_manager/assignment', ...BY_HREF['/dashboard/lead_manager/assignment'] },
        { href: '/dashboard/lead_manager/workshops', ...BY_HREF['/dashboard/lead_manager/workshops'] },
        { href: '/dashboard/lead_manager/escalations', ...BY_HREF['/dashboard/lead_manager/escalations'] },
        { href: '/dashboard/lead_manager/team', ...BY_HREF['/dashboard/lead_manager/team'] },
        { href: '/dashboard/lead_manager/tags', ...BY_HREF['/dashboard/lead_manager/tags'] },
        { href: '/dashboard/lead_manager/statuses', ...BY_HREF['/dashboard/lead_manager/statuses'] },
      ],
    },
    {
      heading: 'Reports',
      items: [
        { href: '/dashboard/lead_manager/reports', ...BY_HREF['/dashboard/lead_manager/reports'] },
        {
          href: '/dashboard/lead_manager/reports/leaderboard',
          ...BY_HREF['/dashboard/lead_manager/reports/leaderboard'],
        },
        { href: '/dashboard/lead_manager/reports/calls', ...BY_HREF['/dashboard/lead_manager/reports/calls'] },
        { href: '/dashboard/lead_manager/reports/exports', ...BY_HREF['/dashboard/lead_manager/reports/exports'] },
        {
          href: '/dashboard/lead_manager/reports/duplicates',
          ...BY_HREF['/dashboard/lead_manager/reports/duplicates'],
        },
        {
          href: '/dashboard/lead_manager/reports/pipeline',
          ...BY_HREF['/dashboard/lead_manager/reports/pipeline'],
        },
      ],
    },
    {
      heading: 'Help',
      items: [
        {
          href: '/dashboard/lead_manager/readme',
          title: 'ReadMe',
          body: 'Yahi page — poori menu dictionary.',
        },
      ],
    },
  ];
}

/** Ordered ReadMe sections for Telecaller sidebar menus + header tools. */
export function getTelecallerReadme(): ReadmeSection[] {
  return [
    {
      heading: 'Header tools',
      items: [
        { ...HEADER.select_aansh },
        { ...HEADER.reminders },
        { ...HEADER.notifications },
      ],
    },
    {
      heading: 'Main menu',
      items: [
        { href: '/dashboard/telecaller', ...BY_HREF['/dashboard/telecaller'] },
        { href: '/dashboard/telecaller/leads', ...BY_HREF['/dashboard/telecaller/leads'] },
        { href: '/dashboard/telecaller/followups', ...BY_HREF['/dashboard/telecaller/followups'] },
        { ...BY_ACTION['open-wa-inbox'] },
        { href: '/dashboard/telecaller/book', ...BY_HREF['/dashboard/telecaller/book'] },
        { href: '/dashboard/telecaller/workshops', ...BY_HREF['/dashboard/telecaller/workshops'] },
        { href: '/dashboard/telecaller/rsa', ...BY_HREF['/dashboard/telecaller/rsa'] },
        {
          href: '/dashboard/telecaller/me',
          title: 'My Profile',
          body: BY_HREF['/dashboard/telecaller/profile'].body,
        },
      ],
    },
    {
      heading: 'Reports',
      items: [
        { href: '/dashboard/telecaller/reports', ...BY_HREF['/dashboard/telecaller/reports'] },
        {
          href: '/dashboard/telecaller/reports/leaderboard',
          ...BY_HREF['/dashboard/telecaller/reports/leaderboard'],
        },
        { href: '/dashboard/telecaller/reports/calls', ...BY_HREF['/dashboard/telecaller/reports/calls'] },
        {
          href: '/dashboard/telecaller/reports/duplicates',
          title: 'Duplicates',
          body: 'Duplicate leads by phone — clean-up view.',
        },
      ],
    },
    {
      heading: 'Help',
      items: [
        {
          href: '/dashboard/telecaller/readme',
          title: 'ReadMe',
          body: 'Yahi page — poori menu dictionary.',
        },
      ],
    },
  ];
}

