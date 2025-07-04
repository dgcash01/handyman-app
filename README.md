# Handyman Invoice & Quote App

A professional invoice and quote management system for handyman businesses, built with modern web technologies.

## Features

- **Quick Quote Creation** - Fast quote generation for phone calls
- **Email Integration** - Send professional quotes and invoices via email
- **Quote to Invoice Conversion** - Seamlessly convert quotes to invoices
- **Professional Templates** - Beautiful, branded PDF-ready documents
- **Mobile Responsive** - Works perfectly on phones, tablets, and desktops
- **Cloud Storage** - All data stored securely in Cloudflare R2

## Workflow

1. **Quote** → Create and email quote to customer
2. **Email** → Professional quote sent automatically
3. **Earn Business** → Customer reviews and accepts quote
4. **Complete Work** → Perform the work
5. **Invoice** → Convert quote to invoice
6. **Email Invoice** → Send final invoice to customer

## Quick Start

### Prerequisites

- Cloudflare account (for worker and R2 storage)
- SendGrid account (for email functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd handyman-app
   ```

2. **Deploy the worker**
   ```bash
   ./deploy.sh
   ```

3. **Upload frontend files**
   - Upload the `public/` folder to your web server or Cloudflare Pages

## File Structure

```
handyman-app/
├── public/                 # Frontend files
│   ├── index.html         # Main invoice page
│   ├── quick-quote.html   # Quick quote form
│   ├── quotes.html        # Quote management
│   ├── login.html         # User login
│   ├── register.html      # User registration
│   ├── invoices.html      # Invoice management
│   └── config.js          # Configuration
├── worker/                # Backend worker
│   ├── submit-invoice.js  # Main worker file
│   └── wrangler.toml      # Worker configuration
└── deploy.sh             # Deployment script
```

## Configuration

### Environment Variables

Set these in your Cloudflare Worker:

- `SENDGRID_API_KEY` - For email functionality
- `SENDGRID_FROM_EMAIL` - Sender email address

### R2 Storage

The app uses Cloudflare R2 for data storage. Configure your bucket in `worker/wrangler.toml`.

## Usage

### Getting Started

1. **Register an Account**
   - Visit the app and click "Create one here" on the login page
   - Enter your business name, email, and password

2. **Login**
   - Enter your email and password
   - You'll see the main dashboard with navigation options

### Main Navigation

After login, you'll see:
- **Create Invoice** - Direct invoice creation
- **Create Quote** - Quick quote generation
- **View Quotes** - Manage existing quotes
- **View Invoices** - Manage existing invoices

### Creating Quotes

1. Click "Create Quote" in the menu
2. Fill out the quick form
3. Click "Create & Email Quote"
4. Quote is automatically emailed to customer

### Managing Quotes

1. Go to "View Quotes" in the menu
2. See all quotes with status indicators
3. Email quotes to customers
4. Convert accepted quotes to invoices

### Creating Invoices

1. Use the main page for direct invoice creation
2. Or convert quotes to invoices after work completion
3. Invoices are automatically emailed to customers

## Troubleshooting

### Common Issues

**Message Channel Errors**
- These are usually harmless browser extension conflicts
- The app includes error handling to suppress these in production

**Email Not Working**
- Check SendGrid API key configuration
- Verify sender email address
- Check Cloudflare Worker logs

### Support

For issues or questions:
1. Check the browser console for errors
2. Review Cloudflare Worker logs
3. Verify all environment variables are set

## License

This project is licensed under the MIT License. 