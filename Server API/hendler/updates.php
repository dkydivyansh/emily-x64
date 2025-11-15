<?php
/**
 * Updates Handler
 * 
 * Handles GET requests to fetch latest version information from app_config table
 */

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method Not Allowed',
        'message' => 'Only GET requests are allowed for this endpoint',
        'code' => 405
    ]);
    exit();
}

// Include database connection
require_once __DIR__ . '/../includes/db.php';

try {
    // Query to get latest_version_info from app_config table    
    $stmt = $pdo->prepare("SELECT value FROM app_config WHERE type = ? LIMIT 1");
    if (!$stmt->execute(['latest_version_info'])) {
        throw new PDOException("Failed to execute query");
    }
    $result = $stmt->fetch();
    $stmt->closeCursor();
    $stmt = null;
    if (!$result) {
        // No version info found in database
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Not Found',
            'message' => 'Latest version information not found in database',
            'code' => 404
        ]);
        exit();
    }
    
    // Decode the JSON string from database
    $versionData = json_decode($result['value'], true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        // Invalid JSON in database
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid Data',
            'message' => 'Version information in database is not valid JSON',
            'code' => 500
        ]);
        exit();
    }
    
    // Return successful response with version data
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => $versionData
    ]);
    
} catch (PDOException $e) {
    // Database error
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database Error',
        'message' => 'Failed to retrieve version information',
        'code' => 500
    ]);
    
    // Log the actual error for debugging (don't expose to client)
    if (defined('ENVIRONMENT') && ENVIRONMENT === 'development') {
        error_log('Database error in updates.php: ' . $e->getMessage());
    }
    
} catch (Exception $e) {
    // General error
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal Server Error',
        'message' => 'An unexpected error occurred',
        'code' => 500
    ]);
    
    // Log the actual error for debugging
    if (defined('ENVIRONMENT') && ENVIRONMENT === 'development') {
        error_log('General error in updates.php: ' . $e->getMessage());
    }
}
?>