<?php
/**
 * CommentController.php — Student feedback comments for ordinances and handbook sections.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/utils.php';
require_once __DIR__ . '/../middleware/auth.php';

class CommentController {
    public static function getByOrdinance(): void {
        $ordinanceId = $_GET['ordinanceId'] ?? null;
        if (!$ordinanceId) {
            error_response('ordinanceId is required', 400);
        }

        $db = get_db();
        $stmt = $db->prepare('SELECT * FROM comments WHERE ordinance_id = ? ORDER BY created_at DESC');
        $stmt->execute([(int)$ordinanceId]);
        $rows = $stmt->fetchAll();

        json_response(array_map('parse_comment', $rows));
    }

    public static function create(): void {
        $user = require_auth();
        $data = get_json_input();

        $ordinanceId = $data['ordinanceId'] ?? null;
        $type        = $data['type'] ?? 'question';
        $body        = trim($data['body'] ?? '');

        if (!$ordinanceId || $body === '') {
            error_response('ordinanceId and body are required', 400);
        }

        $validTypes = ['question', 'revision', 'policy'];
        $safeType = in_array($type, $validTypes, true) ? $type : 'question';

        $db = get_db();
        $stmt = $db->prepare('
            INSERT INTO comments (ordinance_id, user_id, user_name, user_dept, type, body, agrees)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            (int)$ordinanceId,
            $user['id'],
            $user['name'],
            $user['dept'],
            $safeType,
            $body,
            json_encode([], JSON_UNESCAPED_UNICODE)
        ]);
        $newId = (int)$db->lastInsertId();

        $stmt = $db->prepare('SELECT * FROM comments WHERE id = ?');
        $stmt->execute([$newId]);
        $created = $stmt->fetch();

        json_response(parse_comment($created), 201);
    }

    public static function toggleAgree($id): void {
        $user = require_auth();
        $db = get_db();

        $stmt = $db->prepare('SELECT * FROM comments WHERE id = ?');
        $stmt->execute([(int)$id]);
        $comment = $stmt->fetch();

        if (!$comment) {
            error_response('Comment not found', 404);
        }

        $agrees = [];
        if (isset($comment['agrees'])) {
            if (is_string($comment['agrees'])) {
                $decoded = json_decode($comment['agrees'], true);
                $agrees = is_array($decoded) ? $decoded : [];
            } elseif (is_array($comment['agrees'])) {
                $agrees = $comment['agrees'];
            }
        }

        $uid = $user['id'];
        $idx = array_search($uid, $agrees, true);

        if ($idx === false) {
            $agrees[] = $uid;
        } else {
            array_splice($agrees, $idx, 1);
        }

        // Re-index array to prevent JSON object conversion
        $agrees = array_values($agrees);

        $stmt = $db->prepare('UPDATE comments SET agrees = ? WHERE id = ?');
        $stmt->execute([json_encode($agrees, JSON_UNESCAPED_UNICODE), (int)$id]);

        json_response(['agrees' => $agrees]);
    }

    public static function delete($id): void {
        $user = require_auth();
        $db = get_db();

        $stmt = $db->prepare('SELECT * FROM comments WHERE id = ?');
        $stmt->execute([(int)$id]);
        $comment = $stmt->fetch();

        if (!$comment) {
            error_response('Comment not found', 404);
        }

        if (($user['role'] ?? '') !== 'admin' && ($comment['user_id'] ?? '') !== $user['id']) {
            error_response('Not allowed to delete this comment', 403);
        }

        $stmt = $db->prepare('DELETE FROM comments WHERE id = ?');
        $stmt->execute([(int)$id]);

        json_response(['success' => true]);
    }
}
