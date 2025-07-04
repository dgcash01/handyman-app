# Deployment Guide - Fix 405 Error

## The Problem
You're getting a `405 (Method Not Allowed)` error because your form is trying to POST to a local development server that doesn't have the Cloudflare Worker running.

## Solution: Deploy the Worker

### Step 1: Deploy the Cloudflare Worker

1. **Install Wrangler CLI** (if not already installed):
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Navigate to worker directory**:
   ```bash
   cd worker
   ```

4. **Deploy the worker**:
   ```bash
   wrangler deploy
   ```

5. **Note the worker URL** from the deployment output. It will look like:
   ```
   ✨ Deployed to https://handyman-invoice-worker.your-subdomain.workers.dev
   ```

### Step 2: Update Configuration

1. **Edit `public/config.js`**:
   ```javascript
   window.HANDYMAN_CONFIG = {
       // Replace with your actual worker URL from step 1
       WORKER_URL: 'https://handyman-invoice-worker.your-subdomain.workers.dev',
       
       getEndpoint: function(endpoint) {
           return this.WORKER_URL + endpoint;
       }
   };
   ```

### Step 3: Test the Worker

1. **Test worker connectivity**:
   Visit: `https://your-worker-url/test`
   Should show: "Worker is working!"

2. **Test form submission**:
   - Open `public/test.html` in your browser
   - Click "Test Worker" - should show success
   - Submit the test form - should work without 405 error

### Step 4: Deploy Frontend

**Option A: Cloudflare Pages (Recommended)**
1. Go to Cloudflare Dashboard → Pages
2. Connect your GitHub repository
3. Set build settings:
   - Build command: `echo "No build required"`
   - Build output directory: `public`
   - Root directory: `/`

**Option B: Any Static Hosting**
- Upload the `public/` folder to any static hosting service
- Make sure to include the `config.js` file

## Alternative: Local Development

If you want to test locally with the worker:

1. **Start worker in development mode**:
   ```bash
   cd worker
   wrangler dev
   ```

2. **Update config.js** to use local worker:
   ```javascript
   window.HANDYMAN_CONFIG = {
       WORKER_URL: 'http://localhost:8787',
       // ... rest of config
   };
   ```

3. **Serve static files**:
   ```bash
   cd public
   python -m http.server 8000
   ```

## Troubleshooting

### Still getting 405 error?
1. Check that the worker URL in `config.js` is correct
2. Verify the worker is deployed: visit `/test` endpoint
3. Check worker logs: `wrangler tail`

### CORS errors?
The worker includes CORS headers, but if you're still getting CORS errors, check that the worker URL is correct.

### Form not submitting?
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify HTMX is loaded
4. Check that `config.js` is loading properly

## Quick Test

After deployment, test with this simple form:

```html
<form hx-post="https://your-worker-url/submit-invoice" hx-target="#result">
    <input name="senderEmail" value="test@example.com" required>
    <input name="clientName" value="Test Client" required>
    <input name="clientEmail" value="client@example.com" required>
    <textarea name="serviceDescription" required>Test service</textarea>
    <input name="amount" value="100" type="number" required>
    <input name="invoiceDate" value="2024-01-15" type="date" required>
    <select name="paymentStatus" required>
        <option value="pending">Pending</option>
    </select>
    <button type="submit">Submit</button>
</form>
<div id="result"></div>
```

This should work without any 405 errors! 