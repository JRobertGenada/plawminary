<?php
/**
 * index.php — Main API Front Controller and Router
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/OrdinanceController.php';
require_once __DIR__ . '/controllers/CommentController.php';
require_once __DIR__ . '/controllers/ProgressController.php';
require_once __DIR__ . '/controllers/AdminController.php';

// Normalize the request URI path
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($requestUri, PHP_URL_PATH);

// Strip script directory if running under a subdirectory in Apache/XAMPP
$scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
if ($scriptDir !== '/' && $scriptDir !== '\\' && strpos($path, $scriptDir) === 0) {
    $path = substr($path, strlen($scriptDir));
}

// Remove trailing slash except for root
$path = rtrim($path, '/');
if ($path === '') {
    $path = '/';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ─── Health Check ─────────────────────────────────────────────────────────────
if (($path === '/api/health' || $path === '/health') && $method === 'GET') {
    try {
        $db = get_db();
        $db->query('SELECT 1');
        $cfg = Database::getConfig();
        json_response([
            'status'    => 'ok',
            'database'  => 'mysql',
            'host'      => $cfg['host'],
            'name'      => $cfg['database'],
            'timestamp' => date('c'),
        ]);
    } catch (Throwable $e) {
        $cfg = Database::getConfig();
        json_response([
            'status'    => 'error',
            'database'  => 'mysql',
            'error'     => $e->getMessage(),
            'timestamp' => date('c'),
        ], 500);
    }
}

// ─── Auth Endpoints ───────────────────────────────────────────────────────────
if (($path === '/api/auth/register' || $path === '/auth/register') && $method === 'POST') {
    AuthController::register();
}
if (($path === '/api/auth/login' || $path === '/auth/login') && $method === 'POST') {
    AuthController::login();
}
if (($path === '/api/auth/logout' || $path === '/auth/logout') && $method === 'POST') {
    AuthController::logout();
}
if (($path === '/api/auth/me' || $path === '/auth/me') && $method === 'GET') {
    AuthController::me();
}

// ─── Ordinances Endpoints ─────────────────────────────────────────────────────
if ($path === '/api/ordinances' || $path === '/ordinances') {
    if ($method === 'GET') {
        OrdinanceController::getAll();
    } elseif ($method === 'POST') {
        OrdinanceController::create();
    }
}

if (preg_match('#^/(?:api/)?ordinances/(\d+)$#', $path, $matches)) {
    $id = $matches[1];
    if ($method === 'GET') {
        OrdinanceController::getById($id);
    } elseif ($method === 'PUT' || $method === 'PATCH') {
        OrdinanceController::update($id);
    } elseif ($method === 'DELETE') {
        OrdinanceController::delete($id);
    }
}

// ─── Comments Endpoints ───────────────────────────────────────────────────────
if ($path === '/api/comments' || $path === '/comments') {
    if ($method === 'GET') {
        CommentController::getByOrdinance();
    } elseif ($method === 'POST') {
        CommentController::create();
    }
}

if (preg_match('#^/(?:api/)?comments/(\d+)/agree$#', $path, $matches) && $method === 'POST') {
    CommentController::toggleAgree($matches[1]);
}

if (preg_match('#^/(?:api/)?comments/(\d+)$#', $path, $matches) && $method === 'DELETE') {
    CommentController::delete($matches[1]);
}

// ─── Progress Endpoints ───────────────────────────────────────────────────────
if ($path === '/api/progress' || $path === '/progress') {
    if ($method === 'GET') {
        ProgressController::get();
    } elseif ($method === 'POST') {
        ProgressController::save();
    } elseif ($method === 'DELETE') {
        ProgressController::reset();
    }
}

// ─── Admin Endpoints ──────────────────────────────────────────────────────────
if ($path === '/api/admin/users' || $path === '/admin/users') {
    if ($method === 'GET') {
        AdminController::getUsers();
    } elseif ($method === 'POST') {
        AdminController::createUser();
    }
}

if (preg_match('#^/(?:api/)?admin/users/([^/]+)/password$#', $path, $matches) && ($method === 'PATCH' || $method === 'POST')) {
    AdminController::resetPassword($matches[1]);
}

if (preg_match('#^/(?:api/)?admin/users/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    AdminController::deleteUser($matches[1]);
}

if (($path === '/api/admin/stats' || $path === '/admin/stats') && $method === 'GET') {
    AdminController::getStats();
}

if (($path === '/api/admin/comments' || $path === '/admin/comments') && $method === 'GET') {
    AdminController::getComments();
}

// ─── 404 Fallback ─────────────────────────────────────────────────────────────
error_response("Route $method $path not found", 404);
