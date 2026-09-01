<?php
/**
 * database.php — PDO MySQL Database Connection & Initialization
 */

require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $pdo = null;

    public static function getConfig(): array {
        return [
            'host'     => getenv('DB_HOST') ?: 'localhost',
            'port'     => (int)(getenv('DB_PORT') ?: 3306),
            'user'     => getenv('DB_USER') ?: 'root',
            'password' => getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : '',
            'database' => getenv('DB_NAME') ?: 'plawminary',
        ];
    }

    public static function getConnection(): PDO {
        if (self::$pdo === null) {
            $config = self::getConfig();
            $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$pdo = new PDO($dsn, $config['user'], $config['password'], $options);
            } catch (PDOException $e) {
                // If database doesn't exist, try initializing
                if ($e->getCode() == 1049) {
                    self::initDatabase();
                    self::$pdo = new PDO($dsn, $config['user'], $config['password'], $options);
                } else {
                    throw $e;
                }
            }
        }
        return self::$pdo;
    }

    public static function initDatabase(): void {
        $config = self::getConfig();
        $serverDsn = "mysql:host={$config['host']};port={$config['port']};charset=utf8mb4";
        $serverPdo = new PDO($serverDsn, $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);

        $serverPdo->exec("CREATE DATABASE IF NOT EXISTS `{$config['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");

        $dbPdo = new PDO("mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset=utf8mb4", $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);

        $schemaPath = __DIR__ . '/../db/schema.sql';
        if (file_exists($schemaPath)) {
            $schemaSql = file_get_contents($schemaPath);
            $dbPdo->exec($schemaSql);
        }
    }
}

function get_db(): PDO {
    return Database::getConnection();
}
