// Configuration for Handyman Invoice App
window.HANDYMAN_CONFIG = {
    // Update this URL to your deployed Cloudflare Worker URL
    WORKER_URL: 'https://handyman-invoice-worker.dangcashion.workers.dev',
    
    // Helper function to get full endpoint URL
    getEndpoint: function(endpoint) {
        return this.WORKER_URL + endpoint;
    }
}; 