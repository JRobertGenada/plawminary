<?php
/**
 * ProgressController.php — Handbook reading progress per user.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class ProgressController {
    public static function get(): void {
        $user = require_auth();
        $db = get_db();

        $stmt = $db->prepare('SELECT * FROM progress WHERE user_id = ?');
        $stmt->execute([$user['id']]);
        $rows = $stmt->fetchAll();

        $result = new stdClass();
        foreach ($rows as $row) {
            $key = $row['section_key'];
            $result->$key = [
                'page'   => (int)$row['page'],
                'readAt' => $row['read_at'],
            ];
        }

        json_response($result);
    }

    public static function save(): void {
        $user = require_auth();
        $data = get_json_input();

        $sectionKey = trim($data['sectionKey'] ?? '');
        $page       = isset($data['page']) ? (int)$data['page'] : null;

        if ($sectionKey === '' || $page === null) {
            error_response('sectionKey and page are required', 400);
        }

        $db = get_db();
        $stmt = $db->prepare('
            INSERT INTO progress (user_id, section_key, page, read_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE page = VALUES(page), read_at = NOW()
        ');
        $stmt->execute([$user['id'], $sectionKey, $page]);

        json_response(['success' => true]);
    }

    public static function reset(): void {
        $user = require_auth();
        $db = get_db();

        $stmt = $db->prepare('DELETE FROM progress WHERE user_id = ?');
        $stmt->execute([$user['id']]);

        json_response(['success' => true]);
    }
}
