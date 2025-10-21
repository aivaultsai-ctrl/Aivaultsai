// SendGrid helper to trigger the nurture sequence
// Usage:
//   const { startNurtureSequence } = require('./sendgrid_nurture');
//   await startNurtureSequence(leadData, leadSource);

const sgMail = require('@sendgrid/mail');

function initSendGrid() {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('Missing SENDGRID_API_KEY environment variable');
  }
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  } catch (e) {
    // setApiKey may be idempotent; swallow if already set
  }
}

/**
 * Start a nurture sequence for a lead.
 * This implementation sends the first (welcome) email immediately using a SendGrid dynamic template.
 * For a full automation you can instead trigger a SendGrid Automation workflow or use Marketing Campaigns.
 *
 * leadData: { firstName, lastName, email, company, contactMethodUrl }
 * leadSource: string identifier for mapping templates (e.g. 'roi_calculator')
 */
async function startNurtureSequence(leadData = {}, leadSource = 'default') {
  initSendGrid();

  // Map logical leadSource -> SendGrid dynamic template IDs
  // TODO: replace these placeholder IDs (d-...) with your real SendGrid template IDs
  const templateMap = {
    roi_calculator: process.env.SG_TEMPLATE_ROI || 'd-000000000000001',
    gdpr_guide: process.env.SG_TEMPLATE_GDPR || 'd-000000000000002',
    default: process.env.SG_TEMPLATE_DEFAULT || 'd-000000000000003'
  };

  const templateId = templateMap[leadSource] || templateMap.default;

  const fromAddress = process.env.SENDGRID_FROM || 'groei@aivaultsai.com';

  const dynamicTemplateData = {
    firstName: leadData.firstName || '',
    lastName: leadData.lastName || '',
    company: leadData.company || '',
    contactMethodUrl: leadData.contactMethodUrl || process.env.CONTACT_METHOD_URL || 'https://aivaultsai.vercel.app/#contact',
    leadSource: leadSource
  };

  const msg = {
    to: leadData.email,
    from: fromAddress,
    templateId,
    dynamic_template_data: dynamicTemplateData
  };

  try {
    const res = await sgMail.send(msg);
    // sgMail.send may return an array of responses when sending multiple messages
    console.log(`SendGrid: nurture started for ${leadData.email} using template ${templateId}`);
    return { ok: true, res };
  } catch (err) {
    console.error('SendGrid send error:', err && err.response ? err.response.body : err);
    return { ok: false, error: err };
  }
}

module.exports = { startNurtureSequence };
