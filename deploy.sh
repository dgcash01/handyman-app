#!/bin/bash

# Handyman Invoice App Deployment Script
# This script deploys both the Cloudflare Worker and provides instructions for frontend deployment

set -e

echo "🚀 Starting deployment of Handyman Invoice App..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Please run:"
    echo "   wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI is ready"

# Deploy the worker
echo "📦 Deploying Cloudflare Worker..."
cd worker
wrangler deploy
cd ..

echo "✅ Worker deployed successfully!"

echo ""
echo "🎉 Deployment Summary:"
echo "======================"
echo "✅ Cloudflare Worker: Deployed"
echo ""
echo "📋 Next Steps:"
echo "1. Deploy the frontend to Cloudflare Pages:"
echo "   - Go to Cloudflare Dashboard → Pages"
echo "   - Connect your GitHub repository"
echo "   - Set build settings:"
echo "     - Build command: echo 'No build required'"
echo "     - Build output directory: public"
echo "     - Root directory: /"
echo ""
echo "2. Configure environment variables in Pages (if needed)"
echo ""
echo "3. Test your application!"
echo ""
echo "📚 For more information, see README.md" 