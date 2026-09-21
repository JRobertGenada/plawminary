<?php
/**
 * utils.php — Data mapping and formatting helpers matching the frontend data model.
 */

if (!function_exists('parse_ordinance')) {
    function parse_ordinance(?array $row): ?array {
        if (!$row) {
            return null;
        }

        $steps = [];
        if (isset($row['steps'])) {
            if (is_string($row['steps'])) {
                $decoded = json_decode($row['steps'], true);
                $steps = is_array($decoded) ? $decoded : [];
            } elseif (is_array($row['steps'])) {
                $steps = $row['steps'];
            }
        }

        $related = [];
        if (isset($row['related'])) {
            if (is_string($row['related'])) {
                $decoded = json_decode($row['related'], true);
                $related = is_array($decoded) ? $decoded : [];
            } elseif (is_array($row['related'])) {
                $related = $row['related'];
            }
        }

        return [
            'id'      => (int)$row['id'],
            'ref'     => $row['ref'] ?? '',
            'catK'    => $row['cat_key'] ?? '',
            'cat'     => $row['cat'] ?? '',
            'title'   => $row['title'] ?? '',
            'desc'    => $row['desc'] ?? '',
            'summary' => $row['summary'] ?? '',
            'full'    => $row['full_text'] ?? '',
            'steps'   => $steps,
            'related' => $related,
        ];
    }
}

