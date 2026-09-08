-- ──────────────────────────────────────────────────────────────────────────────
-- Plawminary MySQL Schema
-- Uses CREATE TABLE IF NOT EXISTS + ALTER workaround for idempotency
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(64) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  dept          VARCHAR(255) NOT NULL,
  role          VARCHAR(32) NOT NULL DEFAULT 'user',
  email         VARCHAR(255) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ordinances (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  ref         VARCHAR(64) NOT NULL UNIQUE,
  cat_key     VARCHAR(64) NOT NULL,
  cat         VARCHAR(128) NOT NULL,
  title       VARCHAR(512) NOT NULL,
  `desc`      TEXT NOT NULL,
  summary     TEXT NOT NULL,
  full_text   LONGTEXT NOT NULL,
  steps       JSON NULL,
  related     JSON NULL,
  handbook_section_id VARCHAR(128) NULL,
  page        INT NULL,
  version_id  INT NULL,
  status      VARCHAR(32) NOT NULL DEFAULT 'published',
  updated_by  VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  ordinance_id INT NOT NULL,
  user_id      VARCHAR(64) NOT NULL,
  user_name    VARCHAR(255) NOT NULL,
  user_dept    VARCHAR(255) NOT NULL,
  type         VARCHAR(32) NOT NULL DEFAULT 'question',
  body         TEXT NOT NULL,
  agrees       JSON NULL,
  resolved     TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comments_ord (ordinance_id),
  CONSTRAINT fk_comments_ord FOREIGN KEY (ordinance_id) REFERENCES ordinances(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS progress (
  user_id     VARCHAR(64) NOT NULL,
  section_key VARCHAR(128) NOT NULL,
  page        INT NOT NULL,
  read_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, section_key),
  INDEX idx_progress_user (user_id),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Analytics: tracks every ordinance/handbook page view ─────────────────────
CREATE TABLE IF NOT EXISTS page_views (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(64) NULL,          -- NULL = guest
  target_type  VARCHAR(32) NOT NULL,       -- 'ordinance' | 'handbook'
  target_id    VARCHAR(128) NOT NULL,      -- ordinance id or section_key
  viewed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pv_target (target_type, target_id),
  INDEX idx_pv_user   (user_id),
  INDEX idx_pv_viewed (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Handbook versions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS versions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  label        VARCHAR(128) NOT NULL,
  description  TEXT NOT NULL,
  sections     INT NOT NULL DEFAULT 0,
  file_path    VARCHAR(512) NULL,
  status       VARCHAR(32) NOT NULL DEFAULT 'inactive',   -- 'active' | 'archived' | 'inactive' | 'processing' | 'review' | 'approved'
  edited_by    VARCHAR(255) NOT NULL,
  release_date DATE NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Policy Scenarios — one or more student-situation phrases per ordinance ────
-- Used by Fuse.js client-side scenario search.  No AI/external API needed.
CREATE TABLE IF NOT EXISTS policy_scenarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  policy_id  INT NOT NULL,
  scenario   TEXT NOT NULL,                -- natural-language student situation
  keywords   JSON NULL,                   -- ["threat","bully","insult",...]
  synonyms   JSON NULL,                   -- ["intimidation","verbal abuse",...]
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ps_policy (policy_id),
  CONSTRAINT fk_ps_policy FOREIGN KEY (policy_id) REFERENCES ordinances(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
