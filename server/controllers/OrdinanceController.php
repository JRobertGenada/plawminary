<?php
/**
 * OrdinanceController.php — CRUD endpoints for campus ordinances.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/utils.php';
require_once __DIR__ . '/../middleware/auth.php';

class OrdinanceController {
    public static function getAll(): void {
        $db = get_db();
        $q   = isset($_GET['q']) ? trim($_GET['q']) : null;
        $cat = isset($_GET['cat']) ? trim($_GET['cat']) : null;

        if ($q !== null && $q !== '') {
            $like = "%$q%";
            $stmt = $db->prepare('
                SELECT * FROM ordinances
                WHERE title LIKE ? OR summary LIKE ? OR `desc` LIKE ? OR full_text LIKE ?
                ORDER BY id
            ');
            $stmt->execute([$like, $like, $like, $like]);
        } elseif ($cat !== null && $cat !== '') {
            $stmt = $db->prepare('SELECT * FROM ordinances WHERE cat_key = ? ORDER BY id');
            $stmt->execute([$cat]);
        } else {
            $stmt = $db->query('SELECT * FROM ordinances ORDER BY id');
        }

        $rows = $stmt->fetchAll();
        $result = array_map('parse_ordinance', $rows);
        json_response($result);
    }

    public static function getById($id): void {
        $db = get_db();
        $stmt = $db->prepare('SELECT * FROM ordinances WHERE id = ?');
        $stmt->execute([(int)$id]);
        $row = $stmt->fetch();

        if (!$row) {
            error_response('Ordinance not found', 404);
        }

        json_response(parse_ordinance($row));
    }

    public static function create(): void {
        require_admin();
        $data = get_json_input();

        $ref     = trim($data['ref'] ?? '');
        $title   = trim($data['title'] ?? '');
        $catK    = $data['catK'] ?? 'conduct';
        $cat     = $data['cat'] ?? 'Student Conduct';
        $desc    = $data['desc'] ?? '';
        $summary = $data['summary'] ?? '';
        $full    = $data['full'] ?? '';
        $steps   = isset($data['steps']) ? json_encode($data['steps'], JSON_UNESCAPED_UNICODE) : '[]';
        $related = isset($data['related']) ? json_encode($data['related'], JSON_UNESCAPED_UNICODE) : '[]';

        if ($ref === '' || $title === '') {
            error_response('ref and title are required', 400);
        }

        $db = get_db();
        $stmt = $db->prepare('
            INSERT INTO ordinances (ref, cat_key, cat, title, `desc`, summary, full_text, steps, related)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$ref, $catK, $cat, $title, $desc, $summary, $full, $steps, $related]);
        $newId = (int)$db->lastInsertId();

        $stmt = $db->prepare('SELECT * FROM ordinances WHERE id = ?');
        $stmt->execute([$newId]);
        $created = $stmt->fetch();

        json_response(parse_ordinance($created), 201);
    }

    public static function update($id): void {
        require_admin();
        $data = get_json_input();
        $db = get_db();

        $stmt = $db->prepare('SELECT * FROM ordinances WHERE id = ?');
        $stmt->execute([(int)$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            error_response('Ordinance not found', 404);
        }

        $ref     = array_key_exists('ref', $data) ? $data['ref'] : $existing['ref'];
        $catK    = array_key_exists('catK', $data) ? $data['catK'] : $existing['cat_key'];
        $cat     = array_key_exists('cat', $data) ? $data['cat'] : $existing['cat'];
        $title   = array_key_exists('title', $data) ? $data['title'] : $existing['title'];
        $desc    = array_key_exists('desc', $data) ? $data['desc'] : $existing['desc'];
        $summary = array_key_exists('summary', $data) ? $data['summary'] : $existing['summary'];
        $full    = array_key_exists('full', $data) ? $data['full'] : $existing['full_text'];

        $steps = array_key_exists('steps', $data)
            ? json_encode($data['steps'], JSON_UNESCAPED_UNICODE)
            : $existing['steps'];

        $related = array_key_exists('related', $data)
            ? json_encode($data['related'], JSON_UNESCAPED_UNICODE)
            : $existing['related'];

        $updateStmt = $db->prepare('
            UPDATE ordinances
            SET ref=?, cat_key=?, cat=?, title=?, `desc`=?,
                summary=?, full_text=?, steps=?, related=?
            WHERE id=?
        ');
        $updateStmt->execute([
            $ref, $catK, $cat, $title, $desc,
            $summary, $full, $steps, $related,
            (int)$id
        ]);

        $stmt = $db->prepare('SELECT * FROM ordinances WHERE id = ?');
        $stmt->execute([(int)$id]);
        $updated = $stmt->fetch();

        json_response(parse_ordinance($updated));
    }

    public static function delete($id): void {
        require_admin();
        $db = get_db();
        $stmt = $db->prepare('DELETE FROM ordinances WHERE id = ?');
        $stmt->execute([(int)$id]);

        if ($stmt->rowCount() === 0) {
            error_response('Ordinance not found', 404);
        }

        json_response(['success' => true]);
    }
}
