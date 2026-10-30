import{t as e}from"./supabase-BvOOc6YO.js";import{a as t,c as n,s as r,t as i}from"./schemas-BiBbXt8u.js";import{s as a}from"./index-DerJ0puI.js";var o=a(`briefcase`,[[`path`,{d:`M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16`,key:`jecpp`}],[`rect`,{width:`20`,height:`14`,x:`2`,y:`6`,rx:`2`,key:`i6l2r4`}]]),s=a(`file-text`,[[`path`,{d:`M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z`,key:`1oefj6`}],[`path`,{d:`M14 2v5a1 1 0 0 0 1 1h5`,key:`wfsgrz`}],[`path`,{d:`M10 9H8`,key:`b1mrlr`}],[`path`,{d:`M16 13H8`,key:`t4e002`}],[`path`,{d:`M16 17H8`,key:`z1uh3a`}]]),c=t({id:r().optional(),title:r().min(2,`Job title must be at least 2 characters`),department:r().min(2,`Department/Category must be at least 2 characters`),location:r().min(2,`Location description is required`),type:r().min(2,`Job type or tag is required`),role_type:i([`artisan`,`corporate`]),description:r().optional().nullable(),responsibilities:r().optional().nullable(),requirements:r().optional().nullable(),benefits:r().optional().nullable()}),l=[{title:`Customer Acquisition Representative`,department:`Sales & Marketing`,location:`Remote / Flexible`,type:`Commission-Based`,role_type:`corporate`,description:`Lezerv is a registered company in Nigeria that connects customers with trusted home service providers for services such as cleaning, repairs, maintenance, laundry, cooking, and other household needs. Our mission is to make accessing reliable home services simple, convenient, and efficient. We are seeking energetic and self-driven Customer Acquisition Representatives to help Lezerv grow its customer base. Your primary responsibility will be generating paying customers through online and offline channels. This role is ideal for individuals with strong communication skills who want flexible work and unlimited earning potential.`,responsibilities:`Identify and acquire new customers for Lezerv services.
Promote Lezerv through social media platforms, WhatsApp, referrals, communities, and direct outreach.
Follow up with potential customers and guide them through the booking process.
Build relationships and maintain customer engagement.
Track leads and report successful conversions.`,requirements:`Good communication and interpersonal skills.
Active use of WhatsApp and social media platforms.
Ability to work independently and achieve targets.
Previous sales or marketing experience is an advantage but not required.`,benefits:`Earn 15% commission on every successful completed booking from customers you bring.
Additional performance incentives may be provided for reaching customer acquisition targets.
Example: Customer booking value: ₦20,000 -> Your commission (15%): ₦3,000.
Flexible working schedule.
Unlimited earning opportunity.
Opportunity to grow with Lezerv as the company expands.`},{title:`Operations Manager`,department:`Logistics`,location:`Lagos, Nigeria`,type:`Full-Time`,role_type:`corporate`,description:`We are looking for an experienced Operations Manager to oversee our daily home services logistics, service provider onboarding, quality control processes, and customer satisfaction metrics. You will ensure seamless service delivery and direct field operations across Nigeria.`,responsibilities:`Manage day-to-day operations and service delivery logistics.
Onboard, verify, and monitor home service providers and artisans.
Implement quality control standards and handle escalations.
Optimize field resource allocation and dispatch schedules.
Track key operational performance indicators.`,requirements:`3+ years experience in operations, logistics, or project management.
Excellent organizational and team management skills.
Deep familiarity with the home service industry in Nigeria.
Strong analytical mindset and problem-solving skills.`,benefits:`Competitive monthly base salary.
Comprehensive health insurance plan.
Paid time off and performance-related bonuses.
Professional growth and executive leadership opportunities.`},{title:`Frontend Engineer (React)`,department:`Engineering`,location:`Remote`,type:`Full-Time`,role_type:`corporate`,description:`Join our dynamic product team and build the next-generation web platforms for Lezerv. You will build highly responsive, state-of-the-art interactive frontends utilizing React, TypeScript, and modern styling libraries.`,responsibilities:`Develop high-quality, responsive user interfaces and modular components.
Collaborate with product designers and backend engineers to integrate APIs.
Optimize application performance, loading speeds, and accessibility.
Write strict, clean, and maintainable TypeScript code.`,requirements:`3+ years of professional experience building frontend applications in React.
Expertise in CSS, TailwindCSS, Framer Motion, and TypeScript strict mode.
Familiarity with state management libraries and REST/GraphQL APIs.
Portfolio showcasing premium UI designs and micro-animations.`,benefits:`Competitive remote remuneration package.
Annual learning and device upgrades budgets.
Flexible working hours and remote setups.
Work with an exceptionally talented international tech team.`},{title:`Certified Electrician`,department:`Electrical Services`,location:`Lagos (Lekki, Ikeja, Yaba)`,type:`Apply for this role`,role_type:`artisan`,description:`We are expanding our verified artisan network in Lagos! Join Lezerv as an Electrical Services Partner and receive direct consumer jobs with guaranteed weekly payouts. We are reaching out to local skilled electricians to connect them with high-value contracts.`,responsibilities:`Perform house conduit and surface wiring installations.
Troubleshoot electrical faults, breaker issues, and short circuits.
Install and service distribution boards, lighting, and power outlets.
Ensure rigorous safety standards on all residential and commercial jobs.`,requirements:`Solid hands-on experience in residential and commercial electrical work.
Technical degree, vocational certificate, or proven local apprenticeship.
Ownership of basic professional testing and installation tools.
Reliable smartphone with WhatsApp access.`,benefits:`Constant stream of verified, high-paying bookings in your area.
Guaranteed weekly direct payouts to your bank account.
Free tool insurance and safety certifications.
No registration fees or commission cuts for verified basic tiers.`},{title:`Master Plumber`,department:`Plumbing Services`,location:`Lagos (Gbagada, Surulere, Victoria Island)`,type:`Apply for this role`,role_type:`artisan`,description:`Become a verified Plumbing Services Partner on the Lezerv platform. Build a steady customer base in Lagos and gain access to continuous high-demand bookings, from pipe fixing to complex pump installations.`,responsibilities:`Install, maintain, and repair residential plumbing systems and fixtures.
Detect leaks, unclog drains, and fix broken pipes or fittings.
Install and service overhead tanks, water pumps, and boreholes.
Provide accurate estimates on pipe lengths and plumbing materials.`,requirements:`Proven experience as a master plumber in Nigeria.
Strong practical knowledge of piping materials, water flow dynamics, and pump rigs.
Excellent communication skills with customers.
Reliable smartphone for receiving jobs via WhatsApp.`,benefits:`Direct job assignments near your location.
Transparent pricing and secure weekly bank transfers.
Growth support, tools subsidies, and partner benefits.
Flexible scheduling: choose when you are available to work.`}],u={fetchJobs:async()=>{try{let{data:t,error:n}=await e.from(`jobs`).select(`*`).order(`created_at`,{ascending:!1});if(n)throw n;return{success:!0,data:t||[]}}catch(e){return console.error(`Failed to fetch job positions:`,e),{success:!1,error:{code:`DATABASE_ERROR`,message:e.message||`Failed to fetch jobs.`}}}},addJob:async t=>{try{let n=c.parse(t),{data:r,error:i}=await e.from(`jobs`).insert([n]).select().single();if(i)throw i;return{success:!0,data:r}}catch(e){return console.error(`Failed to add job position:`,e),{success:!1,error:{code:e instanceof n?`VALIDATION_ERROR`:`DATABASE_ERROR`,message:e.message||`Failed to add job position.`}}}},deleteJob:async t=>{try{let{error:n}=await e.from(`jobs`).delete().eq(`id`,t);if(n)throw n;return{success:!0}}catch(e){return console.error(`Failed to delete job position:`,e),{success:!1,error:{code:`DATABASE_ERROR`,message:e.message||`Failed to delete job position.`}}}},seedDefaultJobs:async()=>{try{let{error:t}=await e.from(`jobs`).insert(l);if(t)throw t;return{success:!0}}catch(e){return console.error(`Failed to seed default jobs:`,e),{success:!1,error:{code:`DATABASE_ERROR`,message:e.message||`Failed to seed default jobs.`}}}}};export{s as n,o as r,u as t};