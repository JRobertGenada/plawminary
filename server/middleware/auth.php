<?php
/**
 * auth.php — Authentication and role authorization guards.
 */

require_once __DIR__ . '/../helpers/response.php';

if (!function_exists('get_auth_user')) {
    function get_auth_user(): ?array {
        return $_SESSION['user'] ?? null;
    }
}

if (!function_exists('require_auth')) {
    function require_auth(): array {
        $user = get_auth_user();
        if (!$user) {
            error_response('Not authenticated', 401);
        }
        return $user;
    }
}

if (!function_exists('require_admin')) {
    function require_admin(): array {
        $user = require_auth();
        if (($user['role'] ?? '') !== 'admin') {
            error_response('Forbidden — admin only', 403);
        }
        return $user;
    }
}
