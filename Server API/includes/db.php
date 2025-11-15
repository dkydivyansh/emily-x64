<?php
/**
 * Database Connection
 * 
 * This file establishes a PDO database connection.
 */

// Make sure config is loaded first
if (!defined('DB_HOST')) {
    require_once __DIR__ . '/config.php';
}

try {
    // Build the DSN
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    
    // Database connection options
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ];
    
    // Create PDO instance
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    
    // Make $pdo available globally
    global $pdo;
    
} catch (PDOException $e) {
    // Log the error (in production, don't display the error message to end users)
    if (ENVIRONMENT === 'development') {
        die('Database Connection Error: ' . $e->getMessage());
    } else {
        error_log('Database Connection Error: ' . $e->getMessage());
        die('A database error occurred. Please try again later.');
    }
} 