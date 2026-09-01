<?php
/**
 * AuthController.php — Authentication routes (login, logout, session check).
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

class AuthController {
    public static function login(): void {
        $data = get_json_input();
        $studentId = trim($data['studentId'] ?? '');
        $password  = $data['password'] ?? '';

        if ($studentId === '' || $password === '') {
            error_response('Student ID and password are required.', 400);
        }

        $db = get_db();
        $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$studentId]);
        $user = $stmt->fetch();

        if (!$user) {
            error_response('Invalid ID or password. Please try again.', 401);
        }

        if (!password_verify($password, $user['password_hash'])) {
            error_response('Invalid ID or password. Please try again.', 401);
        }

        $profile = [
            'id'   => $user['id'],
            'name' => $user['name'],
            'dept' => $user['dept'],
            'role' => $user['role'],
        ];

        $_SESSION['user'] = $profile;

        json_response([
            'success' => true,
            'user'    => $profile,
        ]);
    }

    public static function logout(): void {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        json_response(['success' => true]);
    }

    public static function register(): void {
        $data            = get_json_input();
        $studentId       = trim($data['studentId'] ?? '');
        $fullName        = trim($data['fullName'] ?? '');
        $dept            = trim($data['dept'] ?? '');
        $email           = strtolower(trim($data['email'] ?? ''));
        $password        = $data['password'] ?? '';
        $confirmPassword = $data['confirmPassword'] ?? '';

        if (!$studentId || !$fullName || !$dept || !$email || !$password || !$confirmPassword) {
            error_response('All fields are required.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_response('Please enter a valid email address.', 400);
        }

        if (strlen($password) < 8) {
            error_response('Password must be at least 8 characters.', 400);
        }

        if ($password !== $confirmPassword) {
            error_response('Passwords do not match.', 400);
        }

        $db = get_db();

        $stmt = $db->prepare('SELECT id FROM users WHERE id = ?');
        $stmt->execute([$studentId]);
        if ($stmt->fetch()) {
            error_response('Student ID is already registered.', 409);
        }

        $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            error_response('Email address is already registered.', 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $insert = $db->prepare('INSERT INTO users (id, name, dept, role, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)');
        $insert->execute([$studentId, $fullName, $dept, 'user', $email, $hash]);

        json_response([
            'success' => true,
            'message' => 'Account created successfully. You may now log in.',
        ], 201);
    }

    public static function me(): void {
        $user = $_SESSION['user'] ?? null;
        json_response(['user' => $user]);
    }
}
