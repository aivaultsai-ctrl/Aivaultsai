## Email Nurture Sequences — AIVaultsAI

Korte uitleg
- Deze map bevat een kant-en-klare e-mail nurture sequence (5 e-mails) in zowel HTML als plain-text.
- Gebruik de templates rechtstreeks in uw e-mail provider (SendGrid, Mailgun, Postmark, HubSpot, Mailchimp, etc.) of importeer de HTML in uw automation builder.

Personalisatie tokens
- {{firstName}} — voornaam lead
- {{lastName}} — achternaam lead
- {{company}} — bedrijfsnaam
- {{leadSource}} — bron (bijv. "Vercel-form", "LM2-Hero")
- {{contactMethodUrl}} — URL naar planning/demo of landingspagina

Aanbevolen cadans (voorbeeld)
- Dag 0: E-mail 1 (Welcome / Lead Magnet)
- Dag 1: E-mail 2 (Probleem + social proof)
- Dag 3: E-mail 3 (Case study / ROI)
- Dag 7: E-mail 4 (Direct demo CTA / urgentie)
- Dag 14: E-mail 5 (Re-engage / laatste kans)

Tracking & UTM
- Voeg UTM-parameters toe aan CTA-links:
  ?utm_source=nurture&utm_medium=email&utm_campaign=nurture_1_variantA
- Zorg dat uw mailer click tracking ingeschakeld is en dat clicks getracked worden in GA4 of uw CRM.

Integratie stappen (kort)
1. Upload HTML templates en plain-text alternates naar uw e-mail provider.
2. Maak een automation workflow die de sequence payload (naam, e-mail, company, utm) injecteert.
3. Gebruik the `contactMethodUrl` met UTM-parameters voor CTA links.
4. Monitor opens, clicks, replies en demo-bookings. Stel een webhook in naar uw leadReceiver of CRM voor replies/bookings.

KPI's om te volgen
- Open rate, click-through rate (CTR), click-to-demo conversion, demo-to-deal conversion.
