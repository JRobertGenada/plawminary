<?php
/**
 * config.php — Global configuration, environment parser, session setup, and CORS headers.
 */

// Load .env file from the server root if present
function load_env($filePath) {
    if (!file_exists($filePath)) {
        return;
    }
    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            // Remove surrounding quotes if any
            if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                $value = substr($value, 1, -1);
            }
            if (!isset($_SERVER[$name]) && !isset($_ENV[$name])) {
                putenv("$name=$value");
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}

// Polyfill for str_starts_with / str_ends_with if needed (PHP 8.0+ has it natively)
if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle) {
        return (string)$needle !== '' && strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}
if (!function_exists('str_ends_with')) {
    function str_ends_with($haystack, $needle) {
        return $needle !== '' && substr($haystack, -strlen($needle)) === (string)$needle;
    }
}

load_env(__DIR__ . '/../.env');

// CORS configuration
$allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
];

$httpOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($httpOrigin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $httpOrigin");
    header('Access-Control-Allow-Credentials: true');
} else {
    // If no origin or non-matching, allow all without credentials or match request
    if ($httpOrigin !== '') {
        header("Access-Control-Allow-Origin: $httpOrigin");
        header('Access-Control-Allow-Credentials: true');
    }
}

header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Respond immediately to OPTIONS preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Session configuration
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_samesite', 'Lax');
    // Set 8-hour cookie lifetime
    ini_set('session.gc_maxlifetime', (string)(8 * 3600));
    session_set_cookie_params([
        'lifetime' => 8 * 3600,
        'path'     => '/',
        'domain'   => '',
        'secure'   => false, // Set to true if on HTTPS
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}
