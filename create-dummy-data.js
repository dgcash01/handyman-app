// Dummy Data Generator for John the Handyman
// This script creates realistic invoice and quote data spanning a full year

const HANDYMAN_CONFIG = {
    getEndpoint: (path) => `https://handyman-invoice-worker.dangcashion.workers.dev${path}`
};

// John's business info
const JOHN_EMAIL = 'john@handyman.com';
const JOHN_BUSINESS = "John's Handyman Services";

// Sample clients
const CLIENTS = [
    { name: 'Sarah Johnson', email: 'sarah.johnson@email.com', street: '123 Oak Street', city: 'Springfield', state: 'IL', zip: '62701' },
    { name: 'Mike Chen', email: 'mike.chen@email.com', street: '456 Pine Avenue', city: 'Springfield', state: 'IL', zip: '62702' },
    { name: 'Lisa Rodriguez', email: 'lisa.rodriguez@email.com', street: '789 Maple Drive', city: 'Springfield', state: 'IL', zip: '62703' },
    { name: 'David Thompson', email: 'david.thompson@email.com', street: '321 Elm Court', city: 'Springfield', state: 'IL', zip: '62704' },
    { name: 'Jennifer Williams', email: 'jennifer.williams@email.com', street: '654 Birch Lane', city: 'Springfield', state: 'IL', zip: '62705' },
    { name: 'Robert Davis', email: 'robert.davis@email.com', street: '987 Cedar Road', city: 'Springfield', state: 'IL', zip: '62706' },
    { name: 'Amanda Wilson', email: 'amanda.wilson@email.com', street: '147 Spruce Way', city: 'Springfield', state: 'IL', zip: '62707' },
    { name: 'James Brown', email: 'james.brown@email.com', street: '258 Walnut Street', city: 'Springfield', state: 'IL', zip: '62708' }
];

// Service types with realistic pricing
const SERVICES = [
    { description: 'Kitchen faucet replacement', amount: 150 },
    { description: 'Bathroom sink repair', amount: 120 },
    { description: 'Toilet installation', amount: 200 },
    { description: 'Garbage disposal installation', amount: 180 },
    { description: 'Dishwasher hookup', amount: 160 },
    { description: 'Water heater repair', amount: 250 },
    { description: 'Drain cleaning', amount: 100 },
    { description: 'Pipe leak repair', amount: 140 },
    { description: 'Shower head replacement', amount: 80 },
    { description: 'Sump pump installation', amount: 300 },
    { description: 'Window screen repair', amount: 60 },
    { description: 'Door lock installation', amount: 90 },
    { description: 'Ceiling fan installation', amount: 120 },
    { description: 'Light fixture replacement', amount: 100 },
    { description: 'Electrical outlet installation', amount: 110 },
    { description: 'Deck repair', amount: 400 },
    { description: 'Fence gate repair', amount: 150 },
    { description: 'Gutter cleaning', amount: 120 },
    { description: 'Pressure washing', amount: 200 },
    { description: 'Furniture assembly', amount: 80 }
];

// Quote project types
const PROJECT_TYPES = [
    'Plumbing Repair',
    'Electrical Work',
    'Carpentry',
    'Home Maintenance',
    'Installation',
    'Repair & Maintenance',
    'Outdoor Work',
    'Emergency Service'
];

// Generate random date within a range
function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate random invoice data
function generateInvoice(date, client, service) {
    const invoiceDate = date.toISOString().split('T')[0];
    const paymentStatus = Math.random() > 0.3 ? 'paid' : 'pending'; // 70% paid, 30% pending
    
    return {
        id: crypto.randomUUID(),
        invoiceNumber: `INV-${date.getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
        userId: JOHN_EMAIL,
        businessName: JOHN_BUSINESS,
        senderEmail: JOHN_EMAIL,
        clientName: client.name,
        clientEmail: client.email,
        clientAddress: `${client.street}, ${client.city}, ${client.state} ${client.zip}`,
        clientStreet: client.street,
        clientCity: client.city,
        clientState: client.state,
        clientZip: client.zip,
        serviceDescription: service.description,
        amount: service.amount,
        invoiceDate: invoiceDate,
        paymentStatus: paymentStatus,
        createdAt: date.toISOString()
    };
}

// Generate random quote data
function generateQuote(date, client) {
    const projectType = PROJECT_TYPES[Math.floor(Math.random() * PROJECT_TYPES.length)];
    const statuses = ['draft', 'sent', 'pending', 'accepted', 'rejected', 'converted'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Generate materials
    const materials = [];
    const numMaterials = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numMaterials; i++) {
        const materialNames = ['Pipe fittings', 'Electrical wire', 'Wood boards', 'Paint', 'Hardware', 'Tools'];
        const materialName = materialNames[Math.floor(Math.random() * materialNames.length)];
        const quantity = Math.floor(Math.random() * 5) + 1;
        const cost = Math.floor(Math.random() * 50) + 10;
        
        materials.push({
            description: materialName,
            quantity: quantity,
            cost: cost,
            total: quantity * cost
        });
    }
    
    const totalAmount = materials.reduce((sum, mat) => sum + mat.total, 0) + Math.floor(Math.random() * 200) + 100;
    
    return {
        id: crypto.randomUUID(),
        quoteNumber: `QT-${date.getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
        userId: JOHN_EMAIL,
        businessName: JOHN_BUSINESS,
        senderEmail: JOHN_EMAIL,
        clientName: client.name,
        clientEmail: client.email,
        clientStreet: client.street,
        clientCity: client.city,
        clientState: client.state,
        clientZip: client.zip,
        projectType: projectType,
        priority: Math.random() > 0.7 ? 'High' : 'Normal',
        projectDescription: `${projectType} for ${client.name}`,
        scopeItems: [`Complete ${projectType.toLowerCase()}`, 'Quality inspection', 'Cleanup after work'],
        materials: materials,
        amount: totalAmount,
        totalAmount: totalAmount,
        quoteDate: date.toISOString().split('T')[0],
        validUntil: new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paymentTerms: 'Net 30',
        additionalTerms: 'Warranty included for 1 year',
        status: status,
        createdAt: date.toISOString()
    };
}

// Generate a year's worth of data
async function generateYearOfData() {
    console.log('🚀 Starting dummy data generation for John...');
    
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');
    
    const invoices = [];
    const quotes = [];
    
    // Generate data for each month with realistic patterns
    for (let month = 0; month < 12; month++) {
        const monthStart = new Date(2024, month, 1);
        const monthEnd = new Date(2024, month + 1, 0);
        
        // More work in spring/summer, less in winter
        let workIntensity = 1;
        if (month >= 2 && month <= 7) workIntensity = 1.5; // Spring/Summer
        if (month >= 11 || month <= 1) workIntensity = 0.7; // Winter
        
        // Generate 15-25 invoices per month (adjusted for season)
        const numInvoices = Math.floor((15 + Math.random() * 10) * workIntensity);
        
        for (let i = 0; i < numInvoices; i++) {
            const randomDate = randomDate(monthStart, monthEnd);
            const randomClient = CLIENTS[Math.floor(Math.random() * CLIENTS.length)];
            const randomService = SERVICES[Math.floor(Math.random() * SERVICES.length)];
            
            invoices.push(generateInvoice(randomDate, randomClient, randomService));
        }
        
        // Generate 8-15 quotes per month
        const numQuotes = Math.floor(8 + Math.random() * 7);
        
        for (let i = 0; i < numQuotes; i++) {
            const randomDate = randomDate(monthStart, monthEnd);
            const randomClient = CLIENTS[Math.floor(Math.random() * CLIENTS.length)];
            
            quotes.push(generateQuote(randomDate, randomClient));
        }
    }
    
    console.log(`📊 Generated ${invoices.length} invoices and ${quotes.length} quotes`);
    
    // Sort by date
    invoices.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    quotes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    return { invoices, quotes };
}

// Upload data to the worker
async function uploadData(invoices, quotes) {
    console.log('📤 Uploading data to worker...');
    
    // First, we need to create John's user account
    const userData = {
        email: JOHN_EMAIL,
        businessName: JOHN_BUSINESS,
        password: 'password123', // Simple password for testing
        createdAt: new Date('2024-01-01').toISOString()
    };
    
    try {
        // Create user account
        const userResponse = await fetch(HANDYMAN_CONFIG.getEndpoint('/auth/register'), {
            method: 'POST',
            body: new URLSearchParams({
                businessName: JOHN_BUSINESS,
                email: JOHN_EMAIL,
                password: 'password123'
            })
        });
        
        if (userResponse.ok) {
            console.log('✅ User account created');
        } else {
            console.log('ℹ️ User account may already exist');
        }
        
        // Login to get session token
        const loginResponse = await fetch(HANDYMAN_CONFIG.getEndpoint('/auth/login'), {
            method: 'POST',
            body: new URLSearchParams({
                email: JOHN_EMAIL,
                password: 'password123'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error('Failed to login');
        }
        
        const loginHtml = await loginResponse.text();
        const sessionMatch = loginHtml.match(/localStorage\.setItem\('sessionToken', '([^']+)'\)/);
        
        if (!sessionMatch) {
            throw new Error('Failed to extract session token');
        }
        
        const sessionToken = sessionMatch[1];
        console.log('🔑 Got session token');
        
        // Upload invoices
        console.log('📄 Uploading invoices...');
        for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];
            const formData = new FormData();
            
            // Add all invoice fields
            Object.keys(invoice).forEach(key => {
                if (key !== 'id' && key !== 'invoiceNumber' && key !== 'userId' && key !== 'businessName' && key !== 'senderEmail' && key !== 'createdAt') {
                    formData.append(key, invoice[key]);
                }
            });
            
            const response = await fetch(HANDYMAN_CONFIG.getEndpoint('/submit-invoice'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: formData
            });
            
            if (response.ok) {
                console.log(`✅ Invoice ${i + 1}/${invoices.length} uploaded`);
            } else {
                console.log(`❌ Failed to upload invoice ${i + 1}`);
            }
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Upload quotes
        console.log('📋 Uploading quotes...');
        for (let i = 0; i < quotes.length; i++) {
            const quote = quotes[i];
            const formData = new FormData();
            
            // Add all quote fields
            Object.keys(quote).forEach(key => {
                if (key !== 'id' && key !== 'quoteNumber' && key !== 'userId' && key !== 'businessName' && key !== 'senderEmail' && key !== 'createdAt') {
                    if (key === 'materials') {
                        formData.append(key, JSON.stringify(quote[key]));
                    } else if (key === 'scopeItems') {
                        formData.append(key, JSON.stringify(quote[key]));
                    } else {
                        formData.append(key, quote[key]);
                    }
                }
            });
            
            const response = await fetch(HANDYMAN_CONFIG.getEndpoint('/submit-quote'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: formData
            });
            
            if (response.ok) {
                console.log(`✅ Quote ${i + 1}/${quotes.length} uploaded`);
            } else {
                console.log(`❌ Failed to upload quote ${i + 1}`);
            }
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('🎉 Data upload complete!');
        console.log('');
        console.log('📋 Login Credentials:');
        console.log(`Email: ${JOHN_EMAIL}`);
        console.log(`Password: password123`);
        console.log('');
        console.log('📊 Data Summary:');
        console.log(`- ${invoices.length} invoices generated`);
        console.log(`- ${quotes.length} quotes generated`);
        console.log(`- Data spans from ${invoices[0]?.invoiceDate} to ${invoices[invoices.length - 1]?.invoiceDate}`);
        console.log('');
        console.log('🚀 You can now log in and see the dashboard with realistic data!');
        
    } catch (error) {
        console.error('❌ Error uploading data:', error);
    }
}

// Run the data generation
async function main() {
    try {
        const { invoices, quotes } = await generateYearOfData();
        await uploadData(invoices, quotes);
    } catch (error) {
        console.error('❌ Error in main:', error);
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.generateDummyData = main;
} else {
    main();
} 