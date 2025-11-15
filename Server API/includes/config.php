<?php
// Environment settings
// In production, you would set this to 'production'
define('ENVIRONMENT', 'development');

// Error reporting
if (ENVIRONMENT === 'development') {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    error_reporting(0);
}

// Database settings
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_db_name');
define('DB_USER', 'your_db_user');
define('DB_PASS', 'your_db_password');
define('DB_CHARSET', 'utf8mb4');

// Auth server settings
define('AUTH_SERVER_URL', 'https://auth.dkydivyansh.com'); // base URL only, path will be added in function
define('AUTH_CLIENT_ID', 'your_auth_client_id');
define('AUTH_CLIENT_SECRET', 'your_auth_client_secret');
define('AUTH_VERSION', 'v1');
define('AUTH_USER_AGENT', 'your_auth_user_agent');

