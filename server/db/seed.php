<?php
/**
 * seed.php — Seeds initial mock users and campus ordinances into MySQL database.
 * Run with: php server/db/seed.php
 */

require_once __DIR__ . '/../config/database.php';

$mockUsers = [
    ['id' => 'admin',     'name' => 'Admin User',     'dept' => 'Administration',                     'role' => 'admin', 'password' => 'admin'],
    ['id' => '2023-0001', 'name' => 'Juan Dela Cruz', 'dept' => 'Col. of Business Administration',    'role' => 'user',  'password' => 'plsp1234'],
];

try {
    echo "🌱 Starting PHP MySQL seed...\n";

    Database::initDatabase();
    $db = get_db();

    // ─── Seed Users ───
    echo "👤 Seeding users...\n";
    $userStmt = $db->prepare('
        INSERT INTO users (id, name, dept, role, password_hash)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            dept = VALUES(dept),
            role = VALUES(role),
            password_hash = VALUES(password_hash)
    ');

    foreach ($mockUsers as $u) {
        $hash = password_hash($u['password'], PASSWORD_BCRYPT);
        $userStmt->execute([$u['id'], $u['name'], $u['dept'], $u['role'], $hash]);
        echo "   ✓ {$u['id']} ({$u['role']})\n";
    }

    // ─── Seed Ordinances ───
    $jsonPath = __DIR__ . '/ordinances.json';
    if (file_exists($jsonPath)) {
        $ordinances = json_decode(file_get_contents($jsonPath), true);
        echo "📋 Seeding " . count($ordinances) . " ordinances...\n";

        $ordStmt = $db->prepare('
            INSERT INTO ordinances (id, ref, cat_key, cat, title, `desc`, summary, full_text, steps, related)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                ref = VALUES(ref),
                cat_key = VALUES(cat_key),
                cat = VALUES(cat),
                title = VALUES(title),
                `desc` = VALUES(`desc`),
                summary = VALUES(summary),
                full_text = VALUES(full_text),
                steps = VALUES(steps),
                related = VALUES(related)
        ');

        foreach ($ordinances as $o) {
            $ordStmt->execute([
                $o['id'],
                $o['ref'],
                $o['catK'] ?? 'conduct',
                $o['cat'] ?? 'Student Conduct',
                $o['title'],
                $o['desc'] ?? '',
                $o['summary'] ?? '',
                $o['full'] ?? '',
                json_encode($o['steps'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($o['related'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
        }
        echo "   ✓ " . count($ordinances) . " ordinances seeded\n";
    } else {
        echo "⚠️  ordinances.json not found, skipping ordinances seeding.\n";
    }

    echo "\n🎉 MySQL seed complete!\n";
} catch (Exception $e) {
    echo "❌ Seed failed: " . $e->getMessage() . "\n";
    exit(1);
}
