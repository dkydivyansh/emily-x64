<?php
// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set content type to JSON for API responses
header('Content-Type: application/json');

// Enable CORS if needed
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get the request URI and remove query parameters
$request_uri = $_SERVER['REQUEST_URI'];
$request_uri = strtok($request_uri, '?'); // Remove query string if present

// Define the base path for your API
$base_path = '/Project/api/emilyx64';

// Remove the base path from the request URI to get the route
$route = str_replace($base_path, '', $request_uri);

// Remove leading slash if present
$route = ltrim($route, '/');

// If route is empty, set it to index
if (empty($route)) {
    $route = 'index';
}

// Define your routes and their corresponding files
$routes = [
    'serversts' => 'serversts.php',
    'index' => 'home.php',
    'auth/login' => 'hendler/login.php',
    'auth/logout' => 'hendler/logout.php',
    'auth/validate' => 'hendler/validate.php',
    'app/userinfo' => 'hendler/userinfo.php',
    'app/config' => 'hendler/config.php',
    'app/updates' => 'hendler/updates.php',
    'app/subscription' => 'hendler/subscription.php',
    'auth/refresh' => 'hendler/refresh.php',
];

// Function to handle 404 errors
function handle404() {
    http_response_code(404);
    echo json_encode([
        'error' => 'Not Found',
        'message' => 'The requested endpoint does not exist',
        'code' => 404
    ]);
    exit();
}

// Function to handle 500 errors
function handle500($message = 'Internal Server Error') {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error',
        'message' => $message,
        'code' => 500
    ]);
    exit();
}

// Check if the route exists in our routes array
if (array_key_exists($route, $routes)) {
    $file_path = __DIR__ . '/' . $routes[$route];
    
    // Check if the file exists
    if (file_exists($file_path)) {
        // Prevent infinite loop for index.php
        if ($routes[$route] === 'index.php' && $route !== 'index') {
            handle404();
        }
        
        // Include the requested file
        try {
            include $file_path;
        } catch (Exception $e) {
            handle500('Error loading endpoint: ' . $e->getMessage());
        }
    } else {
        // File doesn't exist
        handle500('Endpoint file not found: ' . $routes[$route]);
    }
} else {
    // Route not found in routes array
    handle404();
}



// Optional: Log the request for debugging
function logRequest($route, $method, $ip) {
    $log_entry = date('Y-m-d H:i:s') . " - IP: $ip - Method: $method - Route: $route" . PHP_EOL;
    file_put_contents('api_access.log', $log_entry, FILE_APPEND | LOCK_EX);
}

// Uncomment the line below to enable request logging
// logRequest($route, $_SERVER['REQUEST_METHOD'], $_SERVER['REMOTE_ADDR']);

?>