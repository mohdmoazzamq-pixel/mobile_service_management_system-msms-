const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Middlewares
const errorHandler = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const customerRoutes = require('./routes/customerRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const servicesRoutes = require('./routes/servicesRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const repairRoutes = require('./routes/repairRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Cross-Origin Resource Sharing
const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin === '*' ? true : allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Static uploads directory (serve image attachments)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Resolve frontend directory path
const frontendPath = path.resolve(__dirname, '../../frontend');

// Explicit page route definitions (Clean URLs and direct .html routes)
const pageRoutes = [
  { paths: ['/', '/index', '/index.html'], file: 'index.html' },
  { paths: ['/login', '/login.html'], file: 'login.html' },
  { paths: ['/register', '/register.html'], file: 'register.html' },
  { paths: ['/forgot-password', '/forgot-password.html'], file: 'forgot-password.html' },
  { paths: ['/reset-password', '/reset-password.html'], file: 'reset-password.html' },
  { paths: ['/404', '/404.html'], file: '404.html' },
  { paths: ['/customer', '/customer/', '/customer/index', '/customer/index.html', '/customer/dashboard'], file: 'customer/index.html' },
  { paths: ['/customer/book', '/customer/book.html'], file: 'customer/book.html' },
  { paths: ['/customer/devices', '/customer/devices.html'], file: 'customer/devices.html' },
  { paths: ['/customer/tracking', '/customer/tracking.html'], file: 'customer/tracking.html' },
  { paths: ['/customer/invoices', '/customer/invoices.html'], file: 'customer/invoices.html' },
  { paths: ['/customer/feedback', '/customer/feedback.html'], file: 'customer/feedback.html' },
  { paths: ['/admin', '/admin/', '/admin/index', '/admin/index.html', '/admin/dashboard'], file: 'admin/index.html' },
  { paths: ['/admin/bookings', '/admin/bookings.html'], file: 'admin/bookings.html' },
  { paths: ['/admin/customers', '/admin/customers.html'], file: 'admin/customers.html' },
  { paths: ['/admin/inventory', '/admin/inventory.html'], file: 'admin/inventory.html' },
  { paths: ['/admin/invoices', '/admin/invoices.html'], file: 'admin/invoices.html' },
  { paths: ['/admin/reports', '/admin/reports.html'], file: 'admin/reports.html' },
  { paths: ['/admin/services', '/admin/services.html'], file: 'admin/services.html' },
  { paths: ['/admin/technicians', '/admin/technicians.html'], file: 'admin/technicians.html' },
  { paths: ['/technician', '/technician/', '/technician/index', '/technician/index.html', '/technician/dashboard'], file: 'technician/index.html' },
  { paths: ['/technician/repair-detail', '/technician/repair-detail.html'], file: 'technician/repair-detail.html' }
];

pageRoutes.forEach(({ paths: routePaths, file }) => {
  const filePath = path.join(frontendPath, file);
  routePaths.forEach(r => {
    app.get(r, (req, res) => res.sendFile(filePath));
    app.get(`/frontend${r}`, (req, res) => res.sendFile(filePath));
  });
});

// Explicit Favicon routes
app.get(['/favicon.ico', '/favicon.svg'], (req, res) => {
  const file = req.path.endsWith('.svg') ? 'favicon.svg' : 'favicon.ico';
  res.sendFile(path.join(frontendPath, file));
});
app.get(['/frontend/favicon.ico', '/frontend/favicon.svg'], (req, res) => {
  const file = req.path.endsWith('.svg') ? 'favicon.svg' : 'favicon.ico';
  res.sendFile(path.join(frontendPath, file));
});

// Serve frontend static assets & web pages (both at root / and /frontend/)
const staticOptions = {
  index: 'index.html',
  extensions: ['html', 'htm'],
  dotfiles: 'ignore',
  fallthrough: true
};
app.use(express.static(frontendPath, staticOptions));
app.use('/frontend', express.static(frontendPath, staticOptions));

// General rate limiter (Section 8.6)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again after 15 minutes.'
  }
});
app.use('/api', apiLimiter);

// Health check endpoint (Section 8.6 / 8.8)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mobile-service-management-api',
    timestamp: new Date().toISOString()
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/technician', technicianRoutes); // For /api/technician/jobs
app.use('/api/services', servicesRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/reports', reportRoutes);

// 404 Route Not Found for API
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Fallback 404 for web assets & SPA routing
app.use((req, res) => {
  const notFoundFile = path.join(frontendPath, '404.html');
  res.status(404).sendFile(notFoundFile, (err) => {
    if (err) res.status(404).send('Page not found');
  });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
