<?php
/**
 * AdminController.php — Admin-only management endpoints (users, stats, moderation).
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/utils.php';
require_once __DIR__ . '/../middleware/auth.php';

class AdminController {
    public static function getUsers(): void {
        require_admin();
        $db = get_db();
        $stmt = $db->query('SELECT id, name, dept, role, created_at FROM users ORDER BY role DESC, name');
        json_response($stmt->fetchAll());
    }

    public static function createUser(): void {
        require_admin();
        $data = get_json_input();

        $id       = trim($data['id'] ?? '');
        $name     = trim($data['name'] ?? '');
        $dept     = trim($data['dept'] ?? '');
        $role     = trim($data['role'] ?? 'user');
        $password = $data['password'] ?? '';

        if ($id === '' || $name === '' || $password === '') {
            error_response('id, name, and password are required', 400);
        }

        $db = get_db();
        $stmt = $db->prepare('SELECT id FROM users WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->fetch()) {
            error_response('User ID already exists', 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $insert = $db->prepare('INSERT INTO users (id, name, dept, role, password_hash) VALUES (?, ?, ?, ?, ?)');
        $insert->execute([$id, $name, $dept, $role, $hash]);

        json_response(['success' => true, 'id' => $id], 201);
    }

    public static function deleteUser($id): void {
        require_admin();
        if ($id === 'admin') {
            error_response('Cannot delete the admin account', 400);
        }

        $db = get_db();
        $stmt = $db->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            error_response('User not found', 404);
        }

        json_response(['success' => true]);
    }

    public static function resetPassword($id): void {
        require_admin();
        $data = get_json_input();
        $password = $data['password'] ?? '';

        if ($password === '') {
            error_response('password is required', 400);
        }

        $db = get_db();
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([$hash, $id]);

        if ($stmt->rowCount() === 0) {
            // Check if user actually exists
            $check = $db->prepare('SELECT id FROM users WHERE id = ?');
            $check->execute([$id]);
            if (!$check->fetch()) {
                error_response('User not found', 404);
            }
        }

        json_response(['success' => true]);
    }

    public static function getStats(): void {
        require_admin();
        $db = get_db();

        $ordCount  = (int)($db->query('SELECT COUNT(*) as c FROM ordinances')->fetch()['c'] ?? 0);
        $userCount = (int)($db->query("SELECT COUNT(*) as c FROM users WHERE role='user'")->fetch()['c'] ?? 0);
        $progCount = (int)($db->query('SELECT COUNT(*) as c FROM progress')->fetch()['c'] ?? 0);

        json_response([
            'ordinanceCount' => $ordCount,
            'userCount'      => $userCount,
            'progressCount'  => $progCount,
        ]);
    }
}
