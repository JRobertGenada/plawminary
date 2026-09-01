<?php
/**
 * router.php — Router script for PHP's built-in web server:
 * Run with: php -S localhost:3001 server/router.php
 */

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . $path;

// If request matches an existing static file, serve directly
if ($path !== '/' && file_exists($file) && !is_dir($file)) {
    return false;
}

// Forward all API and application requests to index.php
require __DIR__ . '/index.php';
