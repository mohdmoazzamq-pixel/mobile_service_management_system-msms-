/**
 * MSMS Root Server Entry Point
 * Starts the unified Express server which serves the frontend web application
 * as static assets and mounts all /api/* REST endpoints.
 */

const path = require('path');

// Ensure working directory is set to root or backend correctly
process.env.PROJECT_ROOT = path.resolve(__dirname);

// Delegate directly to the backend server
require('./backend/server.js');
