// Cloudflare Worker for Handyman Invoice App
// Handles form submissions, R2 storage, and email delivery

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (path === '/submit-invoice' && request.method === 'POST') {
        return await handleInvoiceSubmission(request, env);
      } else if (path === '/api/invoices' && request.method === 'GET') {
        return await getInvoices(env);
      } else if (path.startsWith('/api/invoices/') && path.endsWith('/status') && request.method === 'PUT') {
        const invoiceId = path.split('/')[3];
        return await updateInvoiceStatus(invoiceId, request, env);
      } else {
        return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', details: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

// Handle invoice form submission
async function handleInvoiceSubmission(request, env) {
  const formData = await request.formData();
  
  // Extract form data
  const invoiceData = {
    id: crypto.randomUUID(),
    senderEmail: formData.get('senderEmail'),
    clientName: formData.get('clientName'),
    clientEmail: formData.get('clientEmail'),
    serviceDescription: formData.get('serviceDescription'),
    amount: parseFloat(formData.get('amount')),
    invoiceDate: formData.get('invoiceDate'),
    paymentStatus: formData.get('paymentStatus'),
    createdAt: new Date().toISOString(),
  };

  // Validate required fields
  if (!invoiceData.senderEmail || !invoiceData.clientName || !invoiceData.clientEmail || 
      !invoiceData.serviceDescription || !invoiceData.amount || !invoiceData.invoiceDate) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Save to R2
    await env.INVOICE_BUCKET.put(
      `invoices/${invoiceData.id}.json`,
      JSON.stringify(invoiceData),
      { httpMetadata: { contentType: 'application/json' } }
    );

    // Send email
    await sendInvoiceEmail(invoiceData, env);

    // Return success response for HTMX - replace the entire form container
    const successHtml = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <div class="text-center py-8">
          <div class="mb-4">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Invoice Created Successfully!</h2>
          <p class="text-gray-600 mb-4">Your invoice has been generated and sent to <strong>${invoiceData.clientEmail}</strong></p>
          <div class="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 class="font-semibold text-gray-900 mb-2">Invoice Details:</h3>
            <p><strong>Client:</strong> ${invoiceData.clientName}</p>
            <p><strong>Service:</strong> ${invoiceData.serviceDescription}</p>
            <p><strong>Amount:</strong> $${invoiceData.amount.toFixed(2)}</p>
            <p><strong>Status:</strong> <span class="px-2 py-1 rounded-full text-xs font-medium ${invoiceData.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${invoiceData.paymentStatus}</span></p>
          </div>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="index.html" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
              Create Another Invoice
            </a>
            <a href="invoices.html" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors">
              View All Invoices
            </a>
          </div>
        </div>
      </div>
    `;

    return new Response(successHtml, {
      headers: { 
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error saving invoice:', error);
    
    const errorHtml = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <div class="text-center py-8">
          <div class="mb-4">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
              <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Error Creating Invoice</h2>
          <p class="text-gray-600 mb-6">Failed to create invoice. Please try again.</p>
          <a href="index.html" class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors">
            Try Again
          </a>
        </div>
      </div>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: { 
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Get all invoices
async function getInvoices(env) {
  try {
    const list = await env.INVOICE_BUCKET.list();
    const invoices = [];

    for (const obj of list.objects) {
      // Only process files in the invoices/ directory
      if (obj.key.startsWith('invoices/') && obj.key.endsWith('.json')) {
        const invoice = await env.INVOICE_BUCKET.get(obj.key);
        if (invoice) {
          invoices.push(JSON.parse(await invoice.text()));
        }
      }
    }

    // Sort by creation date (newest first)
    invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Generate HTML for HTMX
    const invoicesHtml = invoices.length > 0 
      ? invoices.map(invoice => generateInvoiceHtml(invoice)).join('')
      : '<div class="text-center py-8 text-gray-500">No invoices found</div>';

    return new Response(invoicesHtml, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    return new Response(
      '<div class="text-center py-8 text-red-500">Error loading invoices</div>',
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Update invoice payment status
async function updateInvoiceStatus(invoiceId, request, env) {
  try {
    const { paymentStatus } = await request.json();
    
    // Get current invoice
    const invoice = await env.INVOICE_BUCKET.get(`invoices/${invoiceId}.json`);
    if (!invoice) {
      return new Response('Invoice not found', { status: 404 });
    }

    const invoiceData = JSON.parse(await invoice.text());
    invoiceData.paymentStatus = paymentStatus;
    invoiceData.updatedAt = new Date().toISOString();

    // Update in R2
    await env.INVOICE_BUCKET.put(
      `invoices/${invoiceId}.json`,
      JSON.stringify(invoiceData),
      { httpMetadata: { contentType: 'application/json' } }
    );

    // Return updated invoice HTML
    return new Response(generateInvoiceHtml(invoiceData), {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error updating invoice status:', error);
    return new Response('Error updating status', { status: 500 });
  }
}

// Generate HTML for a single invoice
function generateInvoiceHtml(invoice) {
  const statusClass = invoice.paymentStatus === 'paid' 
    ? 'bg-green-100 text-green-800' 
    : 'bg-yellow-100 text-yellow-800';
  
  const newStatus = invoice.paymentStatus === 'paid' ? 'pending' : 'paid';
  
  return `
    <div class="border border-gray-200 rounded-lg p-4 mb-4 hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-900 mb-1">${invoice.clientName}</h3>
          <p class="text-gray-600 mb-2">${invoice.clientEmail}</p>
          <p class="text-sm text-gray-500 mb-2">Service: ${invoice.serviceDescription}</p>
          <p class="text-sm text-gray-500">Date: ${invoice.invoiceDate}</p>
        </div>
        <div class="text-right ml-4">
          <p class="text-xl font-bold text-gray-900 mb-2">$${invoice.amount.toFixed(2)}</p>
          <div class="flex items-center space-x-2">
            <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
              ${invoice.paymentStatus}
            </span>
            <button hx-put="/api/invoices/${invoice.id}/status" 
                    hx-target="closest .border" 
                    hx-swap="outerHTML"
                    hx-vals='{"paymentStatus": "${newStatus}"}'
                    class="text-blue-600 hover:text-blue-800 text-sm">
              Toggle Status
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Send invoice email via SendGrid
async function sendInvoiceEmail(invoiceData, env) {
  if (!env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured, skipping email');
    return;
  }

  const emailHtml = generateEmailHtml(invoiceData);
  
  const emailData = {
    personalizations: [{
      to: [{ email: invoiceData.clientEmail, name: invoiceData.clientName }],
      subject: `Invoice for ${invoiceData.serviceDescription}`
    }],
    from: { email: env.SENDGRID_FROM_EMAIL, name: 'Your Handyman Service' },
    content: [{
      type: 'text/html',
      value: emailHtml
    }]
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.status}`);
    }

    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't fail the entire request if email fails
  }
}

// Generate email HTML content
function generateEmailHtml(invoiceData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .invoice-details { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .amount { font-size: 24px; font-weight: bold; color: #28a745; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        .status.paid { background: #d4edda; color: #155724; }
        .status.pending { background: #fff3cd; color: #856404; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice</h1>
          <p>Thank you for choosing our services!</p>
        </div>
        
        <div class="invoice-details">
          <h2>Invoice Details</h2>
          <p><strong>Client:</strong> ${invoiceData.clientName}</p>
          <p><strong>Service:</strong> ${invoiceData.serviceDescription}</p>
          <p><strong>Date:</strong> ${invoiceData.invoiceDate}</p>
          <p><strong>Amount:</strong> <span class="amount">$${invoiceData.amount.toFixed(2)}</span></p>
          <p><strong>Status:</strong> <span class="status ${invoiceData.paymentStatus}">${invoiceData.paymentStatus}</span></p>
          
          <hr style="margin: 20px 0;">
          
          <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
          <p>Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;
} 