// Cloudflare Worker for Handyman Invoice App
// Handles form submissions, R2 storage, and email delivery

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    console.log(`Worker request: ${request.method} ${path}`);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, hx-trigger, hx-target, hx-swap, hx-indicator, hx-request, hx-current-url, hx-history-restore-request',
      'Content-Type': 'application/json',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (path === '/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env);
      } else if (path === '/auth/register' && request.method === 'POST') {
        return await handleRegister(request, env);
      } else if (path === '/auth/logout' && request.method === 'POST') {
        return await handleLogout(request, env);
      } else if (path === '/submit-invoice' && request.method === 'POST') {
        console.log('Routing to invoice submission handler');
        return await handleInvoiceSubmission(request, env);
      } else if (path === '/submit-quote' && request.method === 'POST') {
        console.log('Routing to quote submission handler');
        return await handleQuoteSubmission(request, env);
      } else if (path === '/api/invoices' && request.method === 'GET') {
        return await getInvoices(request, env);
      } else if (path === '/api/quotes' && request.method === 'GET') {
        return await getQuotes(request, env);
      } else if (path === '/api/quotes/count' && request.method === 'GET') {
        return await getQuoteCountAPI(request, env);
      } else if (path.startsWith('/api/invoices/') && path.endsWith('/status') && request.method === 'PUT') {
        const invoiceId = path.split('/')[3];
        return await updateInvoiceStatus(invoiceId, request, env);
      } else if (path.startsWith('/api/quotes/') && path.endsWith('/status') && request.method === 'PUT') {
        const quoteId = path.split('/')[3];
        return await updateQuoteStatus(quoteId, request, env);
      } else if (path.startsWith('/api/invoices/') && path.endsWith('/resend') && request.method === 'POST') {
        const invoiceId = path.split('/')[3];
        return await resendInvoice(invoiceId, request, env);
      } else if (path.startsWith('/api/quotes/') && path.endsWith('/convert') && request.method === 'POST') {
        const quoteId = path.split('/')[3];
        return await convertQuoteToInvoice(quoteId, request, env);
      } else if (path.startsWith('/api/invoices/') && path.endsWith('/pdf') && request.method === 'GET') {
        const invoiceId = path.split('/')[3];
        return await generateInvoicePDF(invoiceId, request, env);
      } else if (path.startsWith('/api/quotes/') && path.endsWith('/pdf') && request.method === 'GET') {
        const quoteId = path.split('/')[3];
        return await generateQuotePDF(quoteId, request, env);
      } else if (path.startsWith('/api/quotes/') && path.endsWith('/email') && request.method === 'POST') {
        const quoteId = path.split('/')[3];
        return await sendQuoteEmail(quoteId, request, env);
      } else if (path === '/test' && request.method === 'GET') {
        return new Response('Worker is working!', { headers: corsHeaders });
      } else if (path === '/test-r2' && request.method === 'GET') {
        return await testR2Access(request, env);
      } else {
        console.log(`No route found for ${request.method} ${path}`);
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

// Authentication functions
async function handleLogin(request, env) {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');
  
  try {
    // Get user from R2
    const user = await env.INVOICE_BUCKET.get(`users/${email}.json`);
    if (!user) {
      return new Response(
        '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Invalid email or password</div>',
        { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    
    const userData = JSON.parse(await user.text());
    
    // Simple password check (in production, use proper hashing)
    if (userData.password !== password) {
      return new Response(
        '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Invalid email or password</div>',
        { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    
    // Create session token
    const sessionToken = crypto.randomUUID();
    const sessionData = {
      userId: email,
      businessName: userData.businessName,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    
    // Store session
    await env.INVOICE_BUCKET.put(
      `sessions/${sessionToken}.json`,
      JSON.stringify(sessionData),
      { httpMetadata: { contentType: 'application/json' } }
    );
    
    // Return success with session token
    const successHtml = `
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
        <strong>Login successful!</strong> Redirecting to dashboard...
      </div>
      <script>
        localStorage.setItem('sessionToken', '${sessionToken}');
        localStorage.setItem('userEmail', '${email}');
        localStorage.setItem('businessName', '${userData.businessName}');
        setTimeout(() => window.location.href = 'dashboard.html', 1000);
      </script>
    `;
    
    return new Response(successHtml, {
      headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Login failed. Please try again.</div>',
      { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

async function handleRegister(request, env) {
  const formData = await request.formData();
  const businessName = formData.get('businessName');
  const email = formData.get('email');
  const password = formData.get('password');
  
  try {
    // Check if user already exists
    const existingUser = await env.INVOICE_BUCKET.get(`users/${email}.json`);
    if (existingUser) {
      return new Response(
        '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">User already exists with this email</div>',
        { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    
    // Create user
    const userData = {
      email,
      businessName,
      password, // In production, hash this password
      createdAt: new Date().toISOString()
    };
    
    await env.INVOICE_BUCKET.put(
      `users/${email}.json`,
      JSON.stringify(userData),
      { httpMetadata: { contentType: 'application/json' } }
    );
    
    const successHtml = `
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
        <strong>Account created successfully!</strong> You can now log in.
      </div>
      <script>
        setTimeout(() => window.location.href = 'login.html', 2000);
      </script>
    `;
    
    return new Response(successHtml, {
      headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Registration failed. Please try again.</div>',
      { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

async function handleLogout(request, env) {
  const formData = await request.formData();
  const sessionToken = formData.get('sessionToken');
  
  if (sessionToken) {
    try {
      // Delete session
      await env.INVOICE_BUCKET.delete(`sessions/${sessionToken}.json`);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  const logoutHtml = `
    <div class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
      <strong>Logged out successfully!</strong> Redirecting to login...
    </div>
    <script>
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('businessName');
      setTimeout(() => window.location.href = 'login.html', 1000);
    </script>
  `;
  
  return new Response(logoutHtml, {
    headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' }
  });
}

// Helper function to get current user from session
async function getCurrentUser(request, env) {
  try {
    console.log('=== getCurrentUser called ===');
    const authHeader = request.headers.get('Authorization');
    console.log('Authorization header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid Authorization header');
      return null;
    }
    
    const sessionToken = authHeader.substring(7);
    console.log('Session token:', sessionToken);
    
    const session = await env.INVOICE_BUCKET.get(`sessions/${sessionToken}.json`);
    if (!session) {
      console.log('No session found');
      return null;
    }
    
    const sessionData = JSON.parse(await session.text());
    console.log('Session data:', sessionData);
    
    if (new Date(sessionData.expiresAt) < new Date()) {
      console.log('Session expired');
      // Session expired, delete it
      await env.INVOICE_BUCKET.delete(`sessions/${sessionToken}.json`);
      return null;
    }
    
    console.log('User authenticated successfully:', sessionData.userId);
    return sessionData;
  } catch (error) {
    console.error('=== ERROR in getCurrentUser ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    return null;
  }
}

// Handle invoice form submission
async function handleInvoiceSubmission(request, env) {
  console.log('Handling invoice submission...');
  
  const formData = await request.formData();
  console.log('Form data received:', Object.fromEntries(formData.entries()));
  
  // Get current user
  const user = await getCurrentUser(request, env);
  if (!user) {
    return new Response(
      '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Please log in to create invoices</div>',
      { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
    );
  }
  
  // Generate unique invoice number
  const invoiceCount = await getInvoiceCount(env, user.userId);
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(3, '0')}`;
  
  // Extract form data
  const clientStreet = formData.get('clientStreet');
  const clientCity = formData.get('clientCity');
  const clientState = formData.get('clientState');
  const clientZip = formData.get('clientZip');
  
  // Combine address fields into a formatted address
  const clientAddress = `${clientStreet}, ${clientCity}, ${clientState} ${clientZip}`;
  
  const invoiceData = {
    id: crypto.randomUUID(),
    invoiceNumber,
    userId: user.userId,
    businessName: user.businessName,
    senderEmail: user.userId, // Use user's email from session
    clientName: formData.get('clientName'),
    clientEmail: formData.get('clientEmail'),
    clientAddress: clientAddress,
    clientStreet: clientStreet,
    clientCity: clientCity,
    clientState: clientState,
    clientZip: clientZip,
    serviceDescription: formData.get('serviceDescription'),
    amount: parseFloat(formData.get('amount')),
    invoiceDate: formData.get('invoiceDate'),
    paymentStatus: formData.get('paymentStatus'),
    createdAt: new Date().toISOString(),
  };
  
  // Process materials data
  const materials = [];
  const materialEntries = Array.from(formData.entries());
  
  // Group materials by their ID
  const materialGroups = {};
  materialEntries.forEach(([key, value]) => {
    if (key.startsWith('materials[') && key.includes('][description]')) {
      const materialId = key.match(/materials\[([^\]]+)\]/)[1];
      if (!materialGroups[materialId]) {
        materialGroups[materialId] = {};
      }
      materialGroups[materialId].description = value;
    } else if (key.startsWith('materials[') && key.includes('][cost]')) {
      const materialId = key.match(/materials\[([^\]]+)\]/)[1];
      if (!materialGroups[materialId]) {
        materialGroups[materialId] = {};
      }
      materialGroups[materialId].cost = parseFloat(value) || 0;
    }
  });
  
  // Convert to materials array
  Object.values(materialGroups).forEach(material => {
    if (material.description && material.description.trim() && material.cost > 0) {
      materials.push({
        description: material.description.trim(),
        cost: material.cost
      });
    }
  });
  
  // Add materials to invoice data
  invoiceData.materials = materials;
  
  console.log('Processed invoice data:', invoiceData);

  // Validate required fields
  if (!invoiceData.clientName || !invoiceData.clientEmail || 
      !clientStreet || !clientCity || !clientState || !clientZip ||
      !invoiceData.serviceDescription || !invoiceData.amount || !invoiceData.invoiceDate) {
    console.log('Validation failed - missing fields');
    return new Response(
      '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Please fill in all required fields</div>',
      { status: 400, headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    // Save to R2 (user-specific)
    await env.INVOICE_BUCKET.put(
      `invoices/${user.userId}/${invoiceData.id}.json`,
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

// Get all invoices for current user
async function getInvoices(request, env) {
  try {
    console.log('=== getInvoices called ===');
    const user = await getCurrentUser(request, env);
    console.log('User from getCurrentUser:', user);
    
    if (!user) {
      console.log('No user found, returning login message');
      return new Response(
        '<div class="text-center py-8 text-red-500">Please log in to view invoices</div>',
        { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    
    console.log('User authenticated, proceeding with invoice fetch');
    // Get search query from HTMX request
    let searchQuery = '';
    const url = new URL(request.url);
    searchQuery = url.searchParams.get('search') || '';
    if (request.headers.get('HX-Request') && searchQuery === '') {
      try {
        const formData = await request.formData();
        searchQuery = formData.get('search') || '';
      } catch (error) {
        // Ignore error if no form data
      }
    }
    const list = await env.INVOICE_BUCKET.list({ prefix: `invoices/${user.userId}/` });
    const invoices = [];
    for (const obj of list.objects) {
      if (!obj.key.endsWith('.json')) continue;
      try {
        const invoice = await env.INVOICE_BUCKET.get(obj.key);
        if (!invoice) continue;
        let invoiceData;
        try {
          invoiceData = JSON.parse(await invoice.text());
        } catch (err) {
          console.error('Failed to parse invoice JSON:', obj.key, err);
          continue;
        }
        // Filter by search query if provided
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matches = 
            invoiceData.clientName?.toLowerCase().includes(query) ||
            invoiceData.clientEmail?.toLowerCase().includes(query) ||
            invoiceData.serviceDescription?.toLowerCase().includes(query) ||
            invoiceData.invoiceNumber?.toLowerCase().includes(query);
          if (!matches) continue;
        }
        invoices.push(invoiceData);
      } catch (err) {
        console.error('Error processing invoice file:', obj.key, err);
        continue;
      }
    }
    // Sort by creation date (newest first)
    invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // Generate HTML for HTMX
    const invoicesHtml = invoices.length > 0 
      ? invoices.map(invoice => generateInvoiceHtml(invoice)).join('')
      : '<div class="text-center py-8 text-gray-500">No invoices found</div>';
    return new Response(invoicesHtml, {
      headers: { 
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    });
      } catch (error) {
      console.error('=== ERROR in getInvoices ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error details:', error);
      return new Response(
        `<div class="text-center py-8 text-red-500">Error loading invoices: ${error.message}</div>`,
        { status: 500, headers: { 
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        } }
      );
    }
}

// Update invoice payment status
async function updateInvoiceStatus(invoiceId, request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Handle both JSON and form data
    let paymentStatus;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const jsonData = await request.json();
      paymentStatus = jsonData.paymentStatus;
    } else {
      // Handle form data (HTMX default)
      const formData = await request.formData();
      paymentStatus = formData.get('paymentStatus');
    }
    
    // Get current invoice
    const invoice = await env.INVOICE_BUCKET.get(`invoices/${user.userId}/${invoiceId}.json`);
    if (!invoice) {
      return new Response('Invoice not found', { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const invoiceData = JSON.parse(await invoice.text());
    invoiceData.paymentStatus = paymentStatus;
    invoiceData.updatedAt = new Date().toISOString();

    // Update in R2
    await env.INVOICE_BUCKET.put(
      `invoices/${user.userId}/${invoiceId}.json`,
      JSON.stringify(invoiceData),
      { httpMetadata: { contentType: 'application/json' } }
    );

    // Return updated invoice HTML
    return new Response(generateInvoiceHtml(invoiceData), {
      headers: { 
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error updating invoice status:', error);
    return new Response('Error updating status', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Generate HTML for a single invoice
function generateInvoiceHtml(invoice) {
  const statusClass = invoice.paymentStatus === 'paid' 
    ? 'bg-green-100 text-green-800' 
    : 'bg-yellow-100 text-yellow-800';
  
  const newStatus = invoice.paymentStatus === 'paid' ? 'pending' : 'paid';
  
  // Use hardcoded endpoint since HANDYMAN_CONFIG is not available in the worker
  const baseUrl = 'https://handyman-invoice-worker.dangcashion.workers.dev';
  
  return `
    <div class="border border-gray-200 rounded-lg p-4 mb-4 hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-lg font-semibold text-gray-900">${invoice.clientName}</h3>
            <span class="text-sm text-gray-500">#${invoice.invoiceNumber}</span>
          </div>
          <p class="text-gray-600 mb-2">${invoice.clientEmail}</p>
          <p class="text-sm text-gray-500 mb-2">Address: ${invoice.clientAddress}</p>
          <p class="text-sm text-gray-500 mb-2">Service: ${invoice.serviceDescription}</p>
          <p class="text-sm text-gray-500">Date: ${invoice.invoiceDate}</p>
          ${invoice.materials && invoice.materials.length > 0 ? `
            <div class="mt-2">
              <p class="text-sm font-medium text-gray-700 mb-1">Materials:</p>
              <div class="text-xs text-gray-600 space-y-1">
                ${invoice.materials.map(material => 
                  `<div>• ${material.description}: $${material.cost.toFixed(2)}</div>`
                ).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div class="text-right ml-4">
          <p class="text-xl font-bold text-gray-900 mb-2">$${invoice.amount.toFixed(2)}</p>
          <div class="flex items-center space-x-2 mb-2">
            <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
              ${invoice.paymentStatus}
            </span>
            <button hx-put="${baseUrl}/api/invoices/${invoice.id}/status" 
                    hx-target="closest .border" 
                    hx-swap="outerHTML"
                    hx-vals='{"paymentStatus": "${newStatus}"}'
                    class="text-blue-600 hover:text-blue-800 text-sm">
              Toggle Status
            </button>
          </div>
          <div class="flex flex-col gap-1">
            <button hx-post="${baseUrl}/api/invoices/${invoice.id}/resend" 
                    hx-target="closest .border" 
                    hx-swap="beforeend"
                    class="text-green-600 hover:text-green-800 text-sm">
              📧 Resend
            </button>
            <a href="${baseUrl}/api/invoices/${invoice.id}/pdf" 
               target="_blank"
               class="text-purple-600 hover:text-purple-800 text-sm">
              📄 PDF
            </a>
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
          <p><strong>Client Address:</strong> ${invoiceData.clientAddress}</p>
          <p><strong>Service:</strong> ${invoiceData.serviceDescription}</p>
          <p><strong>Date:</strong> ${invoiceData.invoiceDate}</p>
          ${invoiceData.materials && invoiceData.materials.length > 0 ? `
            <p><strong>Materials:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${invoiceData.materials.map(material => 
                `<li>${material.description}: $${material.cost.toFixed(2)}</li>`
              ).join('')}
            </ul>
          ` : ''}
          <p><strong>Total Amount:</strong> <span class="amount">$${invoiceData.amount.toFixed(2)}</span></p>
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

// Helper function to get invoice count for unique numbering
async function getInvoiceCount(env, userId) {
  try {
    const list = await env.INVOICE_BUCKET.list({ prefix: `invoices/${userId}/` });
    return list.objects.length;
  } catch (error) {
    console.error('Error getting invoice count:', error);
    return 0;
  }
}

// Resend invoice email
async function resendInvoice(invoiceId, request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Get invoice
    const invoice = await env.INVOICE_BUCKET.get(`invoices/${user.userId}/${invoiceId}.json`);
    if (!invoice) {
      return new Response('Invoice not found', { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    const invoiceData = JSON.parse(await invoice.text());
    
    // Send email to both client and handyman
    await sendInvoiceEmail(invoiceData, env);
    await sendHandymanCopy(invoiceData, env);
    
    return new Response(
      '<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">Invoice resent successfully!</div>',
      { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
    );
    
  } catch (error) {
    console.error('Error resending invoice:', error);
    return new Response(
      '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Failed to resend invoice</div>',
      { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// Send copy to handyman
async function sendHandymanCopy(invoiceData, env) {
  if (!env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured, skipping handyman copy');
    return;
  }
  
  const emailHtml = generateHandymanEmailHtml(invoiceData);
  
  const emailData = {
    personalizations: [{
      to: [{ email: invoiceData.senderEmail, name: invoiceData.businessName }],
      subject: `Invoice Copy: ${invoiceData.invoiceNumber} - ${invoiceData.clientName}`
    }],
    from: { email: env.SENDGRID_FROM_EMAIL, name: 'Handyman Invoice System' },
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
    
    console.log('Handyman copy sent successfully');
  } catch (error) {
    console.error('Error sending handyman copy:', error);
  }
}

// Generate handyman email HTML
function generateHandymanEmailHtml(invoiceData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice Copy</title>
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
          <h1>Invoice Copy</h1>
          <p>This is a copy of the invoice sent to your client.</p>
        </div>
        
        <div class="invoice-details">
          <h2>Invoice Details</h2>
          <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
          <p><strong>Client:</strong> ${invoiceData.clientName}</p>
          <p><strong>Client Email:</strong> ${invoiceData.clientEmail}</p>
          <p><strong>Client Address:</strong> ${invoiceData.clientAddress}</p>
          <p><strong>Service:</strong> ${invoiceData.serviceDescription}</p>
          <p><strong>Date:</strong> ${invoiceData.invoiceDate}</p>
          ${invoiceData.materials && invoiceData.materials.length > 0 ? `
            <p><strong>Materials:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${invoiceData.materials.map(material => 
                `<li>${material.description}: $${material.cost.toFixed(2)}</li>`
              ).join('')}
            </ul>
          ` : ''}
          <p><strong>Total Amount:</strong> <span class="amount">$${invoiceData.amount.toFixed(2)}</span></p>
          <p><strong>Status:</strong> <span class="status ${invoiceData.paymentStatus}">${invoiceData.paymentStatus}</span></p>
          
          <hr style="margin: 20px 0;">
          
          <p>This invoice was sent to ${invoiceData.clientEmail} on ${new Date().toLocaleDateString()}.</p>
          <p>Keep this copy for your records.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate PDF invoice (placeholder for now)
async function generateInvoicePDF(invoiceId, request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Get invoice
    const invoice = await env.INVOICE_BUCKET.get(`invoices/${user.userId}/${invoiceId}.json`);
    if (!invoice) {
      return new Response('Invoice not found', { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    const invoiceData = JSON.parse(await invoice.text());
    
    // For now, return HTML that can be printed as PDF
    // In production, you'd use a PDF generation service
    const pdfHtml = generatePDFHtml(invoiceData);
    
    return new Response(pdfHtml, {
      headers: { 
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoiceNumber}.html"`
      }
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response('Error generating PDF', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Generate PDF-ready HTML
function generatePDFHtml(invoiceData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoiceData.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .invoice-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .invoice-details { margin-bottom: 30px; }
        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .invoice-table th { background-color: #f8f9fa; }
        .total { font-size: 18px; font-weight: bold; text-align: right; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-header">
        <h1>${invoiceData.businessName}</h1>
        <h2>INVOICE</h2>
        <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
        <p><strong>Date:</strong> ${invoiceData.invoiceDate}</p>
      </div>
      
      <div class="invoice-details">
        <div style="float: left; width: 50%;">
          <h3>From:</h3>
          <p>${invoiceData.businessName}<br>
          ${invoiceData.senderEmail}</p>
        </div>
        <div style="float: right; width: 50%;">
          <h3>To:</h3>
          <p>${invoiceData.clientName}<br>
          ${invoiceData.clientEmail}</p>
        </div>
        <div style="clear: both;"></div>
      </div>
      
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${invoiceData.serviceDescription}</td>
            <td>$${invoiceData.amount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="total">
        <strong>Total: $${invoiceData.amount.toFixed(2)}</strong>
      </div>
      
      <div class="footer">
        <p>Thank you for your business!</p>
        <p>Status: ${invoiceData.paymentStatus.toUpperCase()}</p>
      </div>
      
      <div class="no-print" style="margin-top: 30px; text-align: center;">
        <button onclick="window.print()">Print Invoice</button>
      </div>
    </body>
    </html>
  `;
}

// Test R2 access
async function testR2Access(request, env) {
  try {
    console.log('Testing R2 access...');
    // Test basic list operation
    const list = await env.INVOICE_BUCKET.list();
    console.log('R2 list result:', list);
    // Test if we can write and read a test file
    const testKey = 'test/test-file.json';
    const testData = { test: 'data', timestamp: new Date().toISOString() };
    await env.INVOICE_BUCKET.put(testKey, JSON.stringify(testData));
    console.log('Test file written');
    const testFile = await env.INVOICE_BUCKET.get(testKey);
    const readData = JSON.parse(await testFile.text());
    console.log('Test file read:', readData);
    // Clean up
    await env.INVOICE_BUCKET.delete(testKey);
    console.log('Test file cleaned up');
    return new Response(JSON.stringify({
      success: true,
      listResult: list,
      testData: readData
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('R2 test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Quote submission handler
async function handleQuoteSubmission(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response(
        '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Authentication required</div>',
        { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const formData = await request.formData();
    
    // Extract quote data
    const quoteData = {
      quoteNumber: formData.get('quoteNumber'),
      quoteDate: formData.get('quoteDate'),
      validUntil: formData.get('validUntil'),
      clientName: formData.get('clientName'),
      clientStreet: formData.get('clientStreet') || formData.get('clientAddress') || '',
      clientCity: formData.get('clientCity') || '',
      clientState: formData.get('clientState') || '',
      clientZip: formData.get('clientZip') || '',
      clientPhone: formData.get('clientPhone'),
      clientEmail: formData.get('clientEmail'),
      projectType: formData.get('projectType'),
      priority: formData.get('priority'),
      projectDescription: formData.get('projectDescription'),
      scopeItems: formData.getAll('scopeItems[]'),
      paymentTerms: formData.get('paymentTerms'),
      additionalTerms: formData.get('additionalTerms'),
      amount: parseFloat(formData.get('amount') || '0'),
      isDraft: formData.get('isDraft') === 'true',
      businessName: user.businessName,
      senderEmail: user.userId,
      status: formData.get('isDraft') === 'true' ? 'draft' : 'pending',
      createdAt: new Date().toISOString(),
      materials: []
    };

    // Extract materials data - handle both detailed and quick quote formats
    const materials = [];
    const materialKeys = new Set();
    
    // Check if this is a quick quote (has materialsCost and laborCost)
    const materialsCost = parseFloat(formData.get('materialsCost') || '0');
    const laborCost = parseFloat(formData.get('laborCost') || '0');
    
    if (materialsCost > 0 || laborCost > 0) {
      // Quick quote format
      if (materialsCost > 0) {
        materials.push({
          description: 'Materials and Supplies',
          quantity: 1,
          cost: materialsCost,
          total: materialsCost
        });
      }
      if (laborCost > 0) {
        materials.push({
          description: 'Labor and Installation',
          quantity: 1,
          cost: laborCost,
          total: laborCost
        });
      }
    } else {
      // Detailed quote format
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('materials[') && key.includes('][description]')) {
          const materialId = key.match(/materials\[([^\]]+)\]/)[1];
          materialKeys.add(materialId);
        }
      }

      for (const materialId of materialKeys) {
        const description = formData.get(`materials[${materialId}][description]`);
        const quantity = parseFloat(formData.get(`materials[${materialId}][quantity]`) || '0');
        const cost = parseFloat(formData.get(`materials[${materialId}][cost]`) || '0');
        
        if (description && quantity > 0 && cost > 0) {
          materials.push({
            description,
            quantity,
            cost,
            total: quantity * cost
          });
        }
      }
    }

    quoteData.materials = materials;

    // Generate quote ID
    const quoteId = crypto.randomUUID();
    
    // Store quote in R2
    await env.INVOICE_BUCKET.put(
      `quotes/${user.userId}/${quoteId}.json`,
      JSON.stringify(quoteData),
      { httpMetadata: { contentType: 'application/json' } }
    );

    // Update quote count
    const quoteCount = await getQuoteCount(env, user.userId);
    await env.INVOICE_BUCKET.put(
      `counts/${user.userId}/quotes.json`,
      JSON.stringify({ count: quoteCount + 1 }),
      { httpMetadata: { contentType: 'application/json' } }
    );

    const successHtml = `
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
        <strong>Quote saved successfully!</strong> 
        ${quoteData.isDraft ? 'Your draft has been saved.' : 'Your quote has been created and is ready to send.'}
      </div>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button onclick="window.location.href='quotes.html'" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
          View All Quotes
        </button>
        <button onclick="window.location.href='quote.html'" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors">
          Create Another Quote
        </button>
      </div>
    `;

    return new Response(successHtml, {
      headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Quote submission error:', error);
    return new Response(
      '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Failed to save quote. Please try again.</div>',
      { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// Get quotes for a user
async function getQuotes(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // List all quotes for the user
    const quotes = await env.INVOICE_BUCKET.list({ prefix: `quotes/${user.userId}/` });
    
    const quoteList = [];
    for (const quote of quotes.objects) {
      const quoteData = await env.INVOICE_BUCKET.get(quote.key);
      if (quoteData) {
        const data = JSON.parse(await quoteData.text());
        const quoteId = quote.key.split('/').pop().replace('.json', '');
        quoteList.push({
          id: quoteId,
          ...data
        });
      }
    }

    // Sort by creation date (newest first)
    quoteList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return new Response(JSON.stringify(quoteList), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error getting quotes:', error);
    return new Response('Error retrieving quotes', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Update quote status
async function updateQuoteStatus(quoteId, request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const { status } = await request.json();
    
    // Get quote
    const quote = await env.INVOICE_BUCKET.get(`quotes/${user.userId}/${quoteId}.json`);
    if (!quote) {
      return new Response('Quote not found', { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const quoteData = JSON.parse(await quote.text());
    quoteData.status = status;
    quoteData.updatedAt = new Date().toISOString();

    // Update quote
    await env.INVOICE_BUCKET.put(
      `quotes/${user.userId}/${quoteId}.json`,
      JSON.stringify(quoteData),
      { httpMetadata: { contentType: 'application/json' } }
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error updating quote status:', error);
    return new Response('Error updating quote status', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Convert quote to invoice
async function convertQuoteToInvoice(quoteId, request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Get quote
    const quote = await env.INVOICE_BUCKET.get(`quotes/${user.userId}/${quoteId}.json`);
    if (!quote) {
      return new Response('Quote not found', { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const quoteData = JSON.parse(await quote.text());
    
    // Generate invoice number
    const invoiceCount = await getInvoiceCount(env, user.userId);
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(4, '0')}`;
    
    // Create invoice data from quote
    const invoiceData = {
      invoiceNumber,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      clientName: quoteData.clientName,
      clientEmail: quoteData.clientEmail,
      clientAddress: `${quoteData.clientStreet}, ${quoteData.clientCity}, ${quoteData.clientState} ${quoteData.clientZip}`,
      serviceDescription: quoteData.projectDescription,
      amount: quoteData.amount,
      paymentStatus: 'pending',
      businessName: quoteData.businessName,
      senderEmail: quoteData.senderEmail,
      createdAt: new Date().toISOString(),
      convertedFromQuote: quoteId,
      materials: quoteData.materials
    };

    // Generate invoice ID
    const invoiceId = crypto.randomUUID();
    
    // Store invoice
    await env.INVOICE_BUCKET.put(
      `invoices/${user.userId}/${invoiceId}.json`,
      JSON.stringify(invoiceData),
      { httpMetadata: { contentType: 'application/json' } }
    );

    // Update invoice count
    await env.INVOICE_BUCKET.put(
      `counts/${user.userId}/invoices.json`,
      JSON.stringify({ count: invoiceCount + 1 }),
      { httpMetadata: { contentType: 'application/json' } }
    );

    // Update quote status to converted
    quoteData.status = 'converted';
    quoteData.convertedToInvoice = invoiceId;
    quoteData.updatedAt = new Date().toISOString();
    
    await env.INVOICE_BUCKET.put(
      `quotes/${user.userId}/${quoteId}.json`,
      JSON.stringify(quoteData),
      { httpMetadata: { contentType: 'application/json' } }
    );

    return new Response(JSON.stringify({ 
      success: true, 
      invoiceId,
      invoiceNumber 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error converting quote to invoice:', error);
    return new Response('Error converting quote to invoice', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Generate quote PDF
async function generateQuotePDF(quoteId, request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Get quote
    const quote = await env.INVOICE_BUCKET.get(`quotes/${user.userId}/${quoteId}.json`);
    if (!quote) {
      return new Response('Quote not found', { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    const quoteData = JSON.parse(await quote.text());
    
    // Generate PDF-ready HTML
    const pdfHtml = generateQuotePDFHtml(quoteData);
    
    return new Response(pdfHtml, {
      headers: { 
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `attachment; filename="quote-${quoteData.quoteNumber}.html"`
      }
    });
    
  } catch (error) {
    console.error('Error generating quote PDF:', error);
    return new Response('Error generating quote PDF', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Generate PDF-ready HTML for quotes
function generateQuotePDFHtml(quoteData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quote ${quoteData.quoteNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .quote-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .quote-details { margin-bottom: 30px; }
        .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .quote-table th, .quote-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .quote-table th { background-color: #f8f9fa; }
        .total { font-size: 18px; font-weight: bold; text-align: right; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
        .scope-items { margin: 20px 0; }
        .scope-items ul { margin: 10px 0; padding-left: 20px; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="quote-header">
        <h1>${quoteData.businessName}</h1>
        <h2>QUOTE</h2>
        <p><strong>Quote Number:</strong> ${quoteData.quoteNumber}</p>
        <p><strong>Date:</strong> ${quoteData.quoteDate}</p>
        <p><strong>Valid Until:</strong> ${quoteData.validUntil}</p>
      </div>
      
      <div class="quote-details">
        <div style="float: left; width: 50%;">
          <h3>From:</h3>
          <p>${quoteData.businessName}<br>
          ${quoteData.senderEmail}</p>
        </div>
        <div style="float: right; width: 50%;">
          <h3>To:</h3>
          <p>${quoteData.clientName}<br>
          ${quoteData.clientEmail}<br>
          ${quoteData.clientStreet}<br>
          ${quoteData.clientCity}, ${quoteData.clientState} ${quoteData.clientZip}</p>
        </div>
        <div style="clear: both;"></div>
      </div>
      
      <div class="project-details">
        <h3>Project Details</h3>
        <p><strong>Type:</strong> ${quoteData.projectType}</p>
        <p><strong>Priority:</strong> ${quoteData.priority}</p>
        <p><strong>Description:</strong> ${quoteData.projectDescription}</p>
      </div>
      
      ${quoteData.scopeItems && quoteData.scopeItems.length > 0 ? `
        <div class="scope-items">
          <h3>Scope of Work</h3>
          <ul>
            ${quoteData.scopeItems.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${quoteData.materials && quoteData.materials.length > 0 ? `
        <table class="quote-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${quoteData.materials.map(material => `
              <tr>
                <td>${material.description}</td>
                <td>${material.quantity}</td>
                <td>$${material.cost.toFixed(2)}</td>
                <td>$${material.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      
      <div class="total">
        <strong>Total Estimate: $${quoteData.amount.toFixed(2)}</strong>
      </div>
      
      <div class="terms">
        <h3>Terms & Conditions</h3>
        <p><strong>Payment Terms:</strong> ${quoteData.paymentTerms}</p>
        ${quoteData.additionalTerms ? `<p><strong>Additional Terms:</strong> ${quoteData.additionalTerms}</p>` : ''}
      </div>
      
      <div class="footer">
        <p>This quote is valid until ${quoteData.validUntil}</p>
        <p>Status: ${quoteData.status.toUpperCase()}</p>
      </div>
      
      <div class="no-print" style="margin-top: 30px; text-align: center;">
        <button onclick="window.print()">Print Quote</button>
      </div>
    </body>
    </html>
  `;
}

// Send quote email
async function sendQuoteEmail(quoteId, request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Get quote
    const quote = await env.INVOICE_BUCKET.get(`quotes/${user.userId}/${quoteId}.json`);
    if (!quote) {
      return new Response('Quote not found', { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    const quoteData = JSON.parse(await quote.text());
    
    // Send email to client
    await sendQuoteEmailToClient(quoteData, env);
    
    // Send copy to handyman
    await sendHandymanQuoteCopy(quoteData, env);
    
    // Update quote status to sent
    quoteData.status = 'sent';
    quoteData.sentAt = new Date().toISOString();
    
    await env.INVOICE_BUCKET.put(
      `quotes/${user.userId}/${quoteId}.json`,
      JSON.stringify(quoteData),
      { httpMetadata: { contentType: 'application/json' } }
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('Error sending quote email:', error);
    return new Response('Error sending quote email', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Send quote email to client
async function sendQuoteEmailToClient(quoteData, env) {
  try {
    const emailHtml = generateQuoteEmailHtml(quoteData);
    
    const emailData = {
      to: quoteData.clientEmail,
      from: env.SENDGRID_FROM_EMAIL || 'noreply@handyman-app.com',
      subject: `Quote ${quoteData.quoteNumber} from ${quoteData.businessName}`,
      html: emailHtml
    };
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: emailData.to }]
        }],
        from: { email: emailData.from },
        subject: emailData.subject,
        content: [{
          type: 'text/html',
          value: emailData.html
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.status}`);
    }
    
    console.log(`Quote email sent to ${emailData.to}`);
    
  } catch (error) {
    console.error('Error sending quote email to client:', error);
    throw error;
  }
}

// Send quote copy to handyman
async function sendHandymanQuoteCopy(quoteData, env) {
  try {
    const emailHtml = generateHandymanQuoteEmailHtml(quoteData);
    
    const emailData = {
      to: quoteData.senderEmail,
      from: env.SENDGRID_FROM_EMAIL || 'noreply@handyman-app.com',
      subject: `Quote Copy: ${quoteData.quoteNumber} for ${quoteData.clientName}`,
      html: emailHtml
    };
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: emailData.to }]
        }],
        from: { email: emailData.from },
        subject: emailData.subject,
        content: [{
          type: 'text/html',
          value: emailData.html
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.status}`);
    }
    
    console.log(`Quote copy sent to handyman ${emailData.to}`);
    
  } catch (error) {
    console.error('Error sending quote copy to handyman:', error);
    // Don't throw error for copy email - it's not critical
  }
}

// Generate quote email HTML for client
function generateQuoteEmailHtml(quoteData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quote ${quoteData.quoteNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .quote-details { margin-bottom: 30px; }
        .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .quote-table th, .quote-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .quote-table th { background-color: #f8f9fa; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin: 20px 0; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
        .scope-items { margin: 20px 0; }
        .scope-items ul { margin: 10px 0; padding-left: 20px; }
        .cta-button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${quoteData.businessName}</h1>
          <h2>QUOTE</h2>
          <p><strong>Quote Number:</strong> ${quoteData.quoteNumber}</p>
          <p><strong>Date:</strong> ${quoteData.quoteDate}</p>
          <p><strong>Valid Until:</strong> ${quoteData.validUntil}</p>
        </div>
        
        <div class="quote-details">
          <div style="float: left; width: 50%;">
            <h3>From:</h3>
            <p>${quoteData.businessName}<br>
            ${quoteData.senderEmail}</p>
          </div>
          <div style="float: right; width: 50%;">
            <h3>To:</h3>
            <p>${quoteData.clientName}<br>
            ${quoteData.clientEmail}<br>
            ${quoteData.clientStreet}<br>
            ${quoteData.clientCity}, ${quoteData.clientState} ${quoteData.clientZip}</p>
          </div>
          <div style="clear: both;"></div>
        </div>
        
        <div class="project-details">
          <h3>Project Details</h3>
          <p><strong>Type:</strong> ${quoteData.projectType}</p>
          <p><strong>Priority:</strong> ${quoteData.priority}</p>
          <p><strong>Description:</strong> ${quoteData.projectDescription}</p>
        </div>
        
        ${quoteData.scopeItems && quoteData.scopeItems.length > 0 ? `
          <div class="scope-items">
            <h3>Scope of Work</h3>
            <ul>
              ${quoteData.scopeItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${quoteData.materials && quoteData.materials.length > 0 ? `
          <table class="quote-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${quoteData.materials.map(material => `
                <tr>
                  <td>${material.description}</td>
                  <td>${material.quantity}</td>
                  <td>$${material.cost.toFixed(2)}</td>
                  <td>$${material.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
        
        <div class="total">
          <strong>Total Estimate: $${quoteData.amount.toFixed(2)}</strong>
        </div>
        
        <div class="terms">
          <h3>Terms & Conditions</h3>
          <p><strong>Payment Terms:</strong> ${quoteData.paymentTerms}</p>
          ${quoteData.additionalTerms ? `<p><strong>Additional Terms:</strong> ${quoteData.additionalTerms}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <p><strong>Please review this quote and let us know if you'd like to proceed with the work.</strong></p>
          <p>You can contact us at ${quoteData.senderEmail} or call us to discuss any questions.</p>
        </div>
        
        <div class="footer">
          <p>This quote is valid until ${quoteData.validUntil}</p>
          <p>Thank you for considering ${quoteData.businessName} for your project!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate quote email HTML for handyman copy
function generateHandymanQuoteEmailHtml(quoteData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quote Copy ${quoteData.quoteNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .quote-details { margin-bottom: 30px; }
        .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .quote-table th, .quote-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .quote-table th { background-color: #f8f9fa; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin: 20px 0; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
        .scope-items { margin: 20px 0; }
        .scope-items ul { margin: 10px 0; padding-left: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Quote Copy</h1>
          <h2>${quoteData.businessName}</h2>
          <p><strong>Quote Number:</strong> ${quoteData.quoteNumber}</p>
          <p><strong>Client:</strong> ${quoteData.clientName}</p>
          <p><strong>Client Email:</strong> ${quoteData.clientEmail}</p>
          <p><strong>Client Address:</strong> ${quoteData.clientStreet}, ${quoteData.clientCity}, ${quoteData.clientState} ${quoteData.clientZip}</p>
          <p><strong>Project:</strong> ${quoteData.projectType}</p>
          <p><strong>Date:</strong> ${quoteData.quoteDate}</p>
          ${quoteData.materials && quoteData.materials.length > 0 ? `
            <p><strong>Materials:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${quoteData.materials.map(material => 
                `<li>${material.description}: $${material.cost.toFixed(2)}</li>`
              ).join('')}
            </ul>
          ` : ''}
          <p><strong>Total Amount:</strong> <span class="amount">$${quoteData.amount.toFixed(2)}</span></p>
          <p><strong>Status:</strong> <span class="status ${quoteData.status}">${quoteData.status}</span></p>
          
          <hr style="margin: 20px 0;">
          
          <p>This quote was sent to ${quoteData.clientEmail} on ${new Date().toLocaleDateString()}.</p>
          <p>Keep this copy for your records.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to get quote count
async function getQuoteCount(env, userId) {
  try {
    const countFile = await env.INVOICE_BUCKET.get(`counts/${userId}/quotes.json`);
    if (countFile) {
      const data = JSON.parse(await countFile.text());
      return data.count || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting quote count:', error);
    return 0;
  }
}

// API endpoint to get quote count
async function getQuoteCountAPI(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const count = await getQuoteCount(env, user.userId);
    
    return new Response(JSON.stringify({ count }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error getting quote count:', error);
    return new Response('Error getting quote count', { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
} 