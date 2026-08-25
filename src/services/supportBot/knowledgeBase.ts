import type { IBotAction } from './types';

/**
 * The bot's knowledge of Lezerv.
 *
 * Every answer here must stay true to what the product actually does
 * today — a confidently wrong answer costs more trust than "let me get
 * a human". Where a feature is not live yet (card payments, formal
 * refund policy), the entry says so and routes to a person.
 *
 * Adding a topic = adding an entry. No engine changes required.
 */
export interface IKbEntry {
  id: string;
  /** Coarse subject stored on escalated tickets for triage. */
  topic: string;
  /**
   * Decisive words. A hit here is worth much more than a loose token
   * overlap — these are what make an entry *the* answer.
   */
  keywords: string[];
  /** Natural phrasings people actually type. Matched loosely. */
  patterns: string[];
  answer: string;
  actions?: IBotAction[];
  followUps?: string[];
  /**
   * True when the topic inherently needs a person (money disputes,
   * complaints). The bot answers what it can, then offers the handoff
   * rather than closing the conversation.
   */
  alwaysOfferHuman?: boolean;
}

export const SERVICE_CATEGORIES = [
  'Cleaning', 'Plumbing', 'Electrical', 'AC & Refrigeration', 'Generator & Power',
  'Solar & Inverter', 'Carpentry', 'Painting', 'Borehole & Water', 'Pest Control',
  'Appliance Repair', 'Masonry & Tiling', 'Gardening & Landscaping', 'Home Security',
];

export const SERVICE_AREAS = [
  'Ikeja', 'Lekki', 'Victoria Island', 'Ikoyi', 'Yaba', 'Surulere', 'Gbagada',
  'Ketu', 'Maryland', 'Ikorodu', 'Ajah', 'Agege', 'Oshodi', 'Isolo', 'Festac',
  'Apapa', 'Mushin', 'Ojota', 'Magodo', 'Ogudu', 'Sangotedo', 'Epe', 'Badagry', 'Ojo',
];

/**
 * Sentinel used as an `IBotAction.to`. The widget intercepts it and opens
 * the human-handoff form instead of navigating anywhere.
 */
export const ESCALATE_ACTION = '__escalate__';

export const WHATSAPP_URL =
  'https://wa.me/2349046367604?text=Hello%20Lezerv%2C%20I%20have%20a%20question%20about%20your%20services.';

export const knowledgeBase: IKbEntry[] = [
  // ── Getting a service ─────────────────────────────────────────────
  {
    id: 'post-job',
    topic: 'booking',
    keywords: ['post', 'request', 'book', 'hire', 'need', 'order'],
    patterns: [
      'how do i book a service', 'i need a plumber', 'how to request a service',
      'i want to hire an artisan', 'how do i post a job', 'book a cleaner',
      'i need someone to fix something', 'how do i order',
    ],
    answer:
      'Tap **Request for Service** and tell us what you need — the service type, your Lagos area, and a short description. That posts your job to our pool of approved artisans nearby.\n\nYou can add a preferred date, address landmark and budget, but only the description, service and area are required.',
    actions: [{ label: 'Request a service', to: '/post-job' }],
    followUps: ['What happens after I post a job?', 'How much does it cost?', 'Which areas do you cover?'],
  },
  {
    id: 'after-posting',
    topic: 'booking',
    keywords: ['after', 'next', 'happens', 'process', 'long', 'wait', 'assigned', 'matched'],
    patterns: [
      'what happens after i post a job', 'how long does it take to get an artisan',
      'how does it work', 'when will someone contact me', 'how are artisans assigned',
      'what is the process', 'nobody has contacted me',
    ],
    answer:
      'Here is the full flow:\n\n1. You post the job — it goes to approved artisans in your area who do that service.\n2. Interested artisans express interest.\n3. Our team reviews them and assigns the best fit.\n4. A private chat opens between you and the assigned artisan, right here on Lezerv.\n\nYou will get a notification at each step. Most jobs are matched the same day, though it depends on the service and your area.',
    actions: [
      { label: 'Track my jobs', to: '/my-jobs' },
      { label: 'Post a job', to: '/post-job' },
    ],
    followUps: ['How do I message the artisan?', 'How do I pay?', 'Can I cancel a job?'],
  },
  {
    id: 'find-artisans',
    topic: 'discovery',
    keywords: ['find', 'browse', 'search', 'directory', 'list', 'near', 'available'],
    patterns: [
      'how do i find an artisan', 'show me artisans near me', 'browse artisans',
      'is there a plumber in lekki', 'can i choose my own artisan', 'search for artisans',
    ],
    answer:
      'Use **Find Artisans** to browse approved artisans by area and service. Each card shows their rating, completed jobs and whether they are KYC-verified, and you can open a full profile to read reviews before deciding.\n\nIf you would rather we match you, posting a job is faster — our team handpicks the artisan for you.',
    actions: [
      { label: 'Browse artisans', to: '/find-artisans' },
      { label: 'Let us match me instead', to: '/post-job' },
    ],
    followUps: ['Which areas do you cover?', 'Are artisans verified?', 'How much does it cost?'],
  },
  {
    id: 'services-offered',
    topic: 'services',
    keywords: ['services', 'offer', 'categories', 'do you do', 'types', 'kind'],
    patterns: [
      'what services do you offer', 'what can you do', 'do you do painting',
      'what kind of work do you handle', 'list your services', 'do you offer cleaning',
    ],
    answer:
      `We cover ${SERVICE_CATEGORIES.length} categories of home service:\n\n${SERVICE_CATEGORIES.map((c) => `• ${c}`).join('\n')}\n\nIf what you need is not on the list, post it anyway and describe it — we will tell you if we can help.`,
    actions: [
      { label: 'See services & pricing', to: '/services' },
      { label: 'Request a service', to: '/post-job' },
    ],
    followUps: ['How much does it cost?', 'Which areas do you cover?'],
  },
  {
    id: 'areas',
    topic: 'coverage',
    keywords: ['area', 'areas', 'location', 'cover', 'lagos', 'abuja', 'city', 'where'],
    patterns: [
      'which areas do you cover', 'do you work in lekki', 'are you in abuja',
      'where are you located', 'do you serve my area', 'what locations',
    ],
    answer:
      `We are live across Lagos, covering:\n\n${SERVICE_AREAS.join(' · ')}\n\nPort Harcourt and Abuja are on the roadmap but not open for booking yet. If your area is not listed, post the job anyway — we will tell you honestly whether we can reach you.`,
    actions: [{ label: 'Request a service', to: '/post-job' }],
    followUps: ['What services do you offer?', 'How do I book a service?'],
  },

  // ── Money ─────────────────────────────────────────────────────────
  {
    id: 'pricing',
    topic: 'pricing',
    keywords: ['price', 'cost', 'charge', 'fee', 'rate', 'much', 'expensive', 'quote', 'budget'],
    patterns: [
      'how much does it cost', 'what are your prices', 'how much for cleaning',
      'what do you charge', 'is it expensive', 'price list', 'how much be am',
      'can i get a quote',
    ],
    answer:
      'Indicative pricing:\n\n• **Standard home clean** — ₦5,000 – ₦10,000\n• **Premium / deep clean** — ₦10,000 – ₦20,000\n• **Generator servicing** — from ₦10,000\n• **Borehole & plumbing** — from ₦25,000\n• **Technical repairs** (AC, electrical, carpentry) — from ₦12,000\n• **Full estate maintenance** — negotiable\n\nBigger or unusual jobs are quoted after the artisan sees the scope. You can also state your own budget when you post the job.',
    actions: [
      { label: 'Full pricing page', to: '/services' },
      { label: 'Request a service', to: '/post-job' },
    ],
    followUps: ['How do I pay?', 'How do I book a service?'],
  },
  {
    id: 'payment-methods',
    topic: 'payments',
    keywords: ['pay', 'payment', 'transfer', 'card', 'cash', 'bank', 'paystack'],
    patterns: [
      'how do i pay', 'what payment methods do you accept', 'can i pay with card',
      'do you accept transfer', 'can i pay cash', 'payment options',
    ],
    answer:
      'You can pay by:\n\n• **Bank transfer** — transfer to the Lezerv account shown on your payment page, then tap "I have paid" so our team confirms it.\n• **Pay on completion** — settle with the artisan once the work is done.\n\nCard payment is not switched on yet — it arrives with our Paystack integration. Until then, please use transfer or pay on completion.',
    actions: [{ label: 'My jobs & payments', to: '/my-jobs' }],
    followUps: ['Is my payment safe?', 'Can I get a refund?'],
  },
  {
    id: 'payment-safety',
    topic: 'payments',
    keywords: ['safe', 'secure', 'scam', 'trust', 'escrow', 'protected', 'guarantee'],
    patterns: [
      'is my payment safe', 'how do i know i wont be scammed', 'is it secure',
      'do you hold the money', 'what if the artisan runs away', 'is escrow available',
    ],
    answer:
      'Two things protect you today:\n\n• Every artisan is screened and approved by our team before they can take jobs, and many are KYC-verified (ID checked).\n• Bank transfers are confirmed by our team against your job, so payment is tied to a real booking, not a stranger\'s account.\n\nFull **escrow** — where Lezerv holds your money and only releases it to the artisan once you confirm the job is done — is being built and is not live yet. Never send money to an artisan\'s personal account outside the platform; if anyone asks you to, tell us immediately.',
    actions: [{ label: 'Report this to our team', to: '__escalate__' }],
    followUps: ['How do I pay?', 'Can I get a refund?'],
    alwaysOfferHuman: true,
  },
  {
    id: 'refund-dispute',
    topic: 'disputes',
    keywords: ['refund', 'dispute', 'money back', 'overcharged', 'chargeback', 'reimburse'],
    patterns: [
      'can i get a refund', 'i want my money back', 'i was overcharged',
      'the artisan did not show up and i paid', 'how do disputes work',
    ],
    answer:
      'Refunds and disputes are handled case by case by our team right now — there is no self-service refund button yet.\n\nSo this does not get lost, let me pass you to a human with the details of your job. Please have the job title and the amount ready.',
    actions: [{ label: 'Talk to our team', to: '__escalate__' }],
    alwaysOfferHuman: true,
  },

  // ── Account ───────────────────────────────────────────────────────
  {
    id: 'account-access',
    topic: 'account',
    keywords: ['login', 'signup', 'register', 'account', 'sign', 'log'],
    patterns: [
      'how do i create an account', 'i want to sign up', 'how do i log in',
      'do i need an account to book', 'where do i register',
    ],
    answer:
      'You can browse artisans and prices without an account, but you need one to post a job, chat with an artisan and track your work.\n\nSigning up takes an email and a password — no long form.',
    actions: [
      { label: 'Create an account', to: '/signup' },
      { label: 'Log in', to: '/login' },
    ],
    followUps: ['I forgot my password', 'How do I update my profile?'],
  },
  {
    id: 'password-reset',
    topic: 'account',
    keywords: ['password', 'forgot', 'reset', 'locked', 'cant login'],
    patterns: [
      'i forgot my password', 'how do i reset my password', 'i cant log into my account',
      'my password is not working', 'i am locked out',
    ],
    answer:
      'On the login page, use **Forgot password** and enter the email you signed up with — a reset link lands in your inbox. Check your spam folder if it does not show up within a few minutes.\n\nIf the email never arrives, it usually means the account was created with a different address. Our team can check that for you.',
    actions: [
      { label: 'Go to login', to: '/login' },
      { label: 'Still stuck — get help', to: '__escalate__' },
    ],
  },
  {
    id: 'profile-update',
    topic: 'account',
    keywords: ['profile', 'update', 'change', 'edit', 'details', 'phone', 'photo', 'avatar'],
    patterns: [
      'how do i update my profile', 'i want to change my phone number',
      'how do i change my details', 'update my picture', 'edit my account',
    ],
    answer:
      'Open **My account** from the profile menu in the header. You can update your name, phone number and profile photo there. Your email is the account identity — to change it, our team has to help.',
    actions: [{ label: 'My account', to: '/profile' }],
    followUps: ['I forgot my password', 'How do I delete my account?'],
  },
  {
    id: 'track-jobs',
    topic: 'booking',
    keywords: ['track', 'status', 'progress', 'my jobs', 'my booking', 'where'],
    patterns: [
      'how do i track my job', 'what is the status of my booking', 'where is my order',
      'i want to see my jobs', 'check my request',
    ],
    answer:
      '**My jobs** shows every job you have posted with its live status — open, assigned, in progress or completed — plus the chat with your artisan once one is assigned. The notification bell also pings you on every change.',
    actions: [
      { label: 'My jobs', to: '/my-jobs' },
      { label: 'Track an order', to: '/track' },
    ],
    followUps: ['Can I cancel a job?', 'How do I message the artisan?'],
  },
  {
    id: 'cancel-job',
    topic: 'booking',
    keywords: ['cancel', 'reschedule', 'postpone', 'change date', 'stop'],
    patterns: [
      'can i cancel a job', 'how do i cancel my booking', 'i want to reschedule',
      'change the date of my job', 'i no longer need the service',
    ],
    answer:
      'You can cancel a job from **My jobs** while it is still open or assigned — once the artisan has started, cancelling needs our team so nobody loses out unfairly.\n\nTo reschedule, message your artisan in the job chat and agree a new time; no need to cancel and repost.',
    actions: [
      { label: 'My jobs', to: '/my-jobs' },
      { label: 'Ask our team to cancel', to: '__escalate__' },
    ],
    alwaysOfferHuman: true,
  },

  // ── Artisan side ──────────────────────────────────────────────────
  {
    id: 'become-artisan',
    topic: 'artisan',
    keywords: ['become', 'join', 'work', 'apply', 'artisan', 'sign up as', 'employ'],
    patterns: [
      'how do i become an artisan', 'i want to work with lezerv', 'how do i join as a plumber',
      'i am an electrician how do i register', 'can i work for you', 'i want to get jobs',
    ],
    answer:
      'Great — we are always taking on skilled hands. Go to **Become an artisan**, then:\n\n1. Create your profile: your trade, years of experience and a short bio.\n2. Pick the Lagos areas you can work in and the services you offer.\n3. Submit for approval — our team reviews every application.\n4. Once approved, flip yourself to **ready for work** and jobs in your areas start showing up on your job board.\n\nIt is free to join. We take a commission on completed jobs, not an upfront fee.',
    actions: [{ label: 'Become an artisan', to: '/become-artisan' }],
    followUps: ['How long does approval take?', 'How do I get jobs?', 'What is KYC verification?'],
  },
  {
    id: 'artisan-approval',
    topic: 'artisan',
    keywords: ['approval', 'approved', 'pending', 'review', 'waiting', 'rejected'],
    patterns: [
      'how long does approval take', 'my application is still pending',
      'why was i not approved', 'when will my profile be approved', 'am i approved yet',
    ],
    answer:
      'Every artisan profile is reviewed by a person, so it is not instant — most are looked at within a couple of working days. You will get a notification the moment your status changes.\n\nApplications usually stall for one of two reasons: an incomplete profile (no bio, no areas, no services selected) or missing KYC details. Filling those in first speeds things up a lot.',
    actions: [
      { label: 'Check my artisan profile', to: '/become-artisan' },
      { label: 'Ask about my application', to: '__escalate__' },
    ],
    followUps: ['What is KYC verification?', 'How do I get jobs?'],
    alwaysOfferHuman: true,
  },
  {
    id: 'kyc',
    topic: 'artisan',
    keywords: ['kyc', 'verified', 'verification', 'nin', 'id', 'badge', 'document'],
    patterns: [
      'what is kyc verification', 'how do i get verified', 'why do you need my nin',
      'what is the verified badge', 'do i need id',
    ],
    answer:
      'KYC is our identity check for artisans — we collect your phone number, NIN and address, and our team verifies them. Verified artisans carry a **verified badge** on their profile.\n\nIt matters because clients are letting a stranger into their home: verified artisans get picked noticeably more often and rank higher in the directory. Your NIN is never shown publicly — clients only ever see the badge.',
    actions: [{ label: 'Complete my KYC', to: '/become-artisan' }],
    followUps: ['How long does approval take?', 'How do I get jobs?'],
  },
  {
    id: 'artisan-jobs',
    topic: 'artisan',
    keywords: ['job board', 'get jobs', 'interest', 'leads', 'no jobs', 'assigned to me'],
    patterns: [
      'how do i get jobs', 'why am i not getting jobs', 'where is the job board',
      'how do i express interest', 'no jobs are showing',
    ],
    answer:
      'Open **My jobs** to see the job board — every open job in the areas and services on your profile. Tap a job to express interest; our team then assigns one artisan per job and a chat opens with the client.\n\nSeeing nothing? The usual causes are: your profile is not approved yet, you are not marked **ready for work**, or your areas/services are too narrow. Widening your areas is the fastest fix.',
    actions: [{ label: 'My jobs', to: '/my-jobs' }],
    followUps: ['How long does approval take?', 'When do I get paid?'],
  },
  {
    id: 'artisan-payout',
    topic: 'artisan',
    keywords: ['payout', 'get paid', 'earnings', 'commission', 'withdraw', 'salary'],
    patterns: [
      'when do i get paid', 'how much commission do you take', 'how do payouts work',
      'how do i withdraw my money', 'what do i earn',
    ],
    answer:
      'For jobs settled on completion, the client pays you directly once the work is signed off. For jobs paid through Lezerv, our team releases your share after the client confirms completion, minus our commission.\n\nAutomated payouts to your bank account come with the Paystack integration we are building — until then a person handles each release, so reach out if one looks late.',
    actions: [{ label: 'Ask about a payout', to: '__escalate__' }],
    alwaysOfferHuman: true,
  },

  // ── Trust & safety ────────────────────────────────────────────────
  {
    id: 'messaging',
    topic: 'messaging',
    keywords: ['message', 'chat', 'contact', 'call', 'number', 'reach', 'talk to artisan'],
    patterns: [
      'how do i message the artisan', 'can i get the artisans phone number',
      'how do i contact my artisan', 'why is my number hidden', 'where is the chat',
    ],
    answer:
      'Once a job is assigned, a private chat opens between you and the artisan inside **My jobs** — that is where you agree timing and details.\n\nPhone numbers and emails are automatically removed from messages on purpose. Keeping the conversation on Lezerv is what lets us step in if something goes wrong: off-platform deals have no record, no dispute cover and no protection for either side.',
    actions: [{ label: 'Open my jobs', to: '/my-jobs' }],
    followUps: ['Can I cancel a job?', 'How do I leave a review?'],
  },
  {
    id: 'reviews',
    topic: 'reviews',
    keywords: ['review', 'rating', 'stars', 'feedback', 'rate'],
    patterns: [
      'how do i leave a review', 'can i rate the artisan', 'where do i give feedback',
      'how do ratings work', 'can i change my review',
    ],
    answer:
      'When a job is marked completed, a star rating prompt appears in **My jobs** — rate the artisan and add a comment. Reviews are two-sided, so artisans build a reputation and so do clients.\n\nYour review shows publicly on the artisan\'s profile, which is what other clients rely on. If you need one edited or removed, our team can help.',
    actions: [{ label: 'My jobs', to: '/my-jobs' }],
    followUps: ['I want to complain about an artisan', 'How do I track my job?'],
  },
  {
    id: 'complaint',
    topic: 'complaint',
    keywords: ['complain', 'bad', 'poor', 'damage', 'rude', 'unhappy', 'terrible', 'broke', 'show up', 'never came', 'no show'],
    patterns: [
      'i want to complain about an artisan', 'the work was badly done',
      'the artisan damaged my property', 'i am not happy with the service',
      'the artisan was rude', 'the artisan did not show up',
    ],
    answer:
      'I am sorry that happened — that is not the standard we hold artisans to, and a person needs to look at this rather than a bot.\n\nLet me open a ticket for our trust & safety team. Tell me which job it was and what went wrong, and we will follow it up with the artisan directly.',
    actions: [{ label: 'Report this to our team', to: '__escalate__' }],
    alwaysOfferHuman: true,
  },
  {
    id: 'privacy',
    topic: 'privacy',
    keywords: ['privacy', 'data', 'delete account', 'gdpr', 'ndpa', 'personal information'],
    patterns: [
      'what do you do with my data', 'how do i delete my account', 'is my data safe',
      'privacy policy', 'can i export my data',
    ],
    answer:
      'We keep only what running the service needs — your contact details, your jobs and your messages — and we do not sell it. Nigeria\'s NDPA gives you the right to see your data, correct it, export it or have it deleted.\n\nOur privacy policy has the full detail. To request an export or a deletion, our team handles it directly.',
    actions: [
      { label: 'Privacy policy', to: '/privacy' },
      { label: 'Request data export or deletion', to: '__escalate__' },
    ],
    followUps: ['How do I update my profile?'],
  },

  // ── Company ───────────────────────────────────────────────────────
  {
    id: 'referral',
    topic: 'referral',
    keywords: ['referral', 'refer', 'ambassador', 'invite', 'earn', 'code'],
    patterns: [
      'how does the referral program work', 'can i earn by referring people',
      'what is the ambassador program', 'where is my referral code', 'refer and earn',
    ],
    answer:
      'Our **ambassador programme** pays you for bringing people to Lezerv. You get a referral link, share it, and earn when the people you refer book jobs. The ambassador page shows your code, your clicks and the leaderboard.',
    actions: [{ label: 'Refer & earn', to: '/ambassador' }],
    followUps: ['How do I become an artisan?'],
  },
  {
    id: 'careers',
    topic: 'company',
    keywords: ['career', 'careers', 'vacancy', 'employment', 'cv', 'recruit', 'hiring'],
    patterns: [
      'are you hiring', 'do you have vacancies', 'i want to send my cv',
      'careers at lezerv', 'job openings',
    ],
    answer:
      'Open roles are listed on our careers page and you can submit your CV there.\n\nIf you meant working *as a tradesperson* — plumber, electrician, cleaner and so on — that is the artisan programme, which is a different sign-up.',
    actions: [
      { label: 'Careers', to: '/careers' },
      { label: 'Become an artisan', to: '/become-artisan' },
    ],
  },
  {
    id: 'about',
    topic: 'company',
    keywords: ['about', 'who are you', 'company', 'lezerv', 'blog', 'story'],
    patterns: [
      'what is lezerv', 'who are you', 'tell me about your company',
      'do you have a blog', 'where can i read more',
    ],
    answer:
      'Lezerv is a Nigerian home-services marketplace: we connect homeowners with verified artisans and professional cleaners, and handle the matching, the chat and the money so you are not gambling on a stranger from a WhatsApp group.\n\nWe are Lagos-first today, with Port Harcourt and Abuja to follow.',
    actions: [
      { label: 'About us', to: '/about' },
      { label: 'Read the blog', to: '/blog' },
    ],
    followUps: ['What services do you offer?', 'Which areas do you cover?'],
  },
  {
    id: 'human',
    topic: 'support',
    keywords: ['human', 'agent', 'person', 'support', 'someone', 'representative', 'staff'],
    patterns: [
      'i want to talk to a human', 'let me speak to someone', 'can i talk to an agent',
      'i need real support', 'connect me to your team', 'this bot is not helping',
    ],
    answer:
      'Of course — let me put you through to a person.',
    actions: [{ label: 'Talk to our team', to: '__escalate__' }],
    alwaysOfferHuman: true,
  },
];
