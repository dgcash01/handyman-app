# Handyman Invoice Generator

A modern, responsive web application for creating and managing handyman invoices. Built with static HTML, Tailwind CSS, HTMX, and Cloudflare Workers.

## Features

- 📝 **Create Invoices**: Simple form to generate professional invoices
- 📧 **Email Delivery**: Automatic email sending to clients via SendGrid
- 💾 **Cloud Storage**: Secure storage using Cloudflare R2
- 📱 **Mobile Friendly**: Responsive design that works on all devices
- ⚡ **Real-time Updates**: HTMX-powered interactions without page reloads
- 🔄 **Status Management**: Toggle payment status with one click

## Tech Stack

- **Frontend**: HTML + Tailwind CSS + HTMX
- **Backend**: Cloudflare Workers
- **Storage**: Cloudflare R2
- **Email**: SendGrid API
- **Deployment**: Cloudflare Pages

## Project Structure

```
/
├── public/
│   ├── index.html          # Invoice creation form
│   └── invoices.html       # Invoice listing page
├── worker/
│   ├── wrangler.toml       # Cloudflare Worker configuration
│   └── submit-invoice.js   # Main worker logic
└── README.md
```

## Setup Instructions

### Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Node.js**: Install Node.js (version 16 or higher)
3. **Wrangler CLI**: Install Cloudflare's CLI tool

```bash
npm install -g wrangler
```

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd Handyman-app
```

### 2. Configure Cloudflare R2

1. **Create R2 Bucket**:
   - Go to Cloudflare Dashboard → R2 Object Storage
   - Create a new bucket named `handyman-invoices`
   - Note your Account ID and R2 API Token

2. **Configure Wrangler**:
   ```bash
   wrangler login
   ```

### 3. Configure SendGrid (Optional)

1. **Sign up for SendGrid**: [sendgrid.com](https://sendgrid.com)
2. **Create API Key**: Dashboard → Settings → API Keys
3. **Verify Sender**: Add and verify your sender email address

### 4. Update Configuration

Edit `worker/wrangler.toml`:

```toml
name = "handyman-invoice-worker"
main = "submit-invoice.js"
compatibility_date = "2024-01-01"

[env.production]
name = "handyman-invoice-worker"

[[r2_buckets]]
binding = "INVOICE_BUCKET"
bucket_name = "handyman-invoices"
preview_bucket_name = "handyman-invoices-dev"

[vars]
SENDGRID_API_KEY = "your-sendgrid-api-key-here"
SENDGRID_FROM_EMAIL = "your-verified-email@yourdomain.com"
```

### 5. Deploy the Worker

```bash
cd worker
wrangler deploy
```

### 6. Deploy Frontend

#### Option A: Cloudflare Pages (Recommended)

1. **Connect Repository**:
   - Go to Cloudflare Dashboard → Pages
   - Connect your GitHub repository
   - Set build settings:
     - Build command: `echo "No build required"`
     - Build output directory: `public`
     - Root directory: `/`

2. **Configure Environment Variables** (if needed):
   - Add any additional environment variables in Pages settings

#### Option B: Local Development

For local testing, you can serve the static files:

```bash
cd public
python -m http.server 8000
# or
npx serve .
```

Then visit `http://localhost:8000`

## Usage

### Creating an Invoice

1. Open the application in your browser
2. Fill out the invoice form:
   - **Your Email**: Your email address (sender)
   - **Client Name**: Customer's full name
   - **Client Email**: Customer's email address
   - **Service Description**: Details of work performed
   - **Amount**: Total cost in dollars
   - **Invoice Date**: Date of service
   - **Payment Status**: Paid or Pending
3. Click "Generate & Send Invoice"
4. The invoice will be saved to R2 and emailed to the client

### Managing Invoices

1. Click "View All Invoices" to see all created invoices
2. Use the "Toggle Status" button to update payment status
3. Invoices are automatically sorted by creation date (newest first)

## API Endpoints

The Cloudflare Worker provides these endpoints:

- `POST /submit-invoice` - Create and send a new invoice
- `GET /api/invoices` - Retrieve all invoices (returns HTML)
- `PUT /api/invoices/{id}/status` - Update invoice payment status

## Data Storage

Invoices are stored in Cloudflare R2 as individual JSON files:

```json
{
  "id": "uuid-here",
  "senderEmail": "handyman@example.com",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "serviceDescription": "Plumbing repair",
  "amount": 150.00,
  "invoiceDate": "2024-01-15",
  "paymentStatus": "pending",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

## Customization

### Styling

The app uses Tailwind CSS via CDN. To customize:

1. Replace the CDN link in HTML files with a custom build
2. Modify Tailwind classes in the HTML files
3. Add custom CSS as needed

### Email Templates

Edit the `generateEmailHtml()` function in `submit-invoice.js` to customize email appearance.

### Additional Features

Consider adding:
- Invoice PDF generation
- Payment integration (Stripe, PayPal)
- Client management
- Invoice templates
- Reporting and analytics

## Troubleshooting

### Common Issues

1. **Worker Deployment Fails**:
   - Check your `wrangler.toml` configuration
   - Ensure you're logged in with `wrangler login`
   - Verify R2 bucket exists and is accessible

2. **Emails Not Sending**:
   - Verify SendGrid API key is correct
   - Check sender email is verified in SendGrid
   - Review Cloudflare Worker logs

3. **CORS Errors**:
   - Ensure your domain is properly configured
   - Check that the worker is deployed to the correct environment

### Debugging

View Cloudflare Worker logs:

```bash
wrangler tail
```

## Security Considerations

- API keys are stored as environment variables
- CORS is configured for cross-origin requests
- Input validation is performed on all form data
- UUIDs are used for invoice IDs to prevent enumeration

## License

This project is open source and available under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Cloudflare Worker documentation
3. Check HTMX and Tailwind CSS documentation
4. Open an issue in the repository

---

Built with ❤️ using modern web technologies 