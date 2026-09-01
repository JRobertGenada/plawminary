<?php
/**
 * response.php — JSON response and input parsing helpers.
 */

if (!function_exists('json_response')) {
    function json_response($data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

if (!function_exists('error_response')) {
    function error_response(string $message, int $statusCode = 400, $detail = null): void {
        $payload = ['error' => $message];
        if ($detail !== null) {
            $payload['detail'] = $detail;
        }
        json_response($payload, $statusCode);
    }
}

if (!function_exists('get_json_input')) {
    function get_json_input(): array {
        $raw = file_get_contents('php://input');
        if (!$raw) {
            return $_POST ?? [];
        }
        $decoded = json_decode($raw, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $_POST ?? [];
        }
        return is_array($decoded) ? $decoded : [];
    }
}
