<?php
/**
 * Esquema de la base. Cada tabla lleva el prefijo de WordPress para convivir
 * con el resto del sitio.
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_DB
{
    /** Versión del esquema guardada en opciones. */
    const OPTION = 'jm_db_version';

    public static function table($name)
    {
        global $wpdb;
        return $wpdb->prefix . 'jm_' . $name;
    }

    /** Se ejecuta en cada carga: si el esquema cambió, lo actualiza. */
    public static function maybe_upgrade()
    {
        if (get_option(self::OPTION) !== JM_DB_VERSION) {
            self::install();
        }
    }

    public static function install()
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();
        $memorials = self::table('memorials');
        $photos = self::table('photos');
        $guestbook = self::table('guestbook');
        $candles = self::table('candles');
        $purchases = self::table('purchases');
        $rate = self::table('rate');

        $sql = array();

        $sql[] = "CREATE TABLE $memorials (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            slug VARCHAR(80) NOT NULL,
            certificate_code VARCHAR(24) NOT NULL,
            kind VARCHAR(12) NOT NULL DEFAULT 'persona',
            full_name VARCHAR(120) NOT NULL,
            relationship VARCHAR(80) NULL,
            birth_date DATE NULL,
            death_date DATE NULL,
            epitaph VARCHAR(200) NULL,
            biography TEXT NULL,
            cover_id BIGINT UNSIGNED NULL,
            video_id BIGINT UNSIGNED NULL,
            music_id BIGINT UNSIGNED NULL,
            theme VARCHAR(20) NOT NULL DEFAULT 'jardin',
            is_public TINYINT(1) NOT NULL DEFAULT 1,
            allow_guestbook TINYINT(1) NOT NULL DEFAULT 1,
            views BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY slug (slug),
            UNIQUE KEY certificate_code (certificate_code),
            KEY user_id (user_id, created_at)
        ) $charset;";

        $sql[] = "CREATE TABLE $photos (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            memorial_id BIGINT UNSIGNED NOT NULL,
            attachment_id BIGINT UNSIGNED NOT NULL,
            caption VARCHAR(160) NULL,
            position INT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY memorial_id (memorial_id, position)
        ) $charset;";

        $sql[] = "CREATE TABLE $guestbook (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            memorial_id BIGINT UNSIGNED NOT NULL,
            name VARCHAR(80) NOT NULL,
            city VARCHAR(80) NULL,
            message TEXT NOT NULL,
            candle TINYINT(1) NOT NULL DEFAULT 0,
            hidden TINYINT(1) NOT NULL DEFAULT 0,
            ip_hash CHAR(64) NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY memorial_id (memorial_id, hidden, created_at)
        ) $charset;";

        $sql[] = "CREATE TABLE $candles (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            memorial_id BIGINT UNSIGNED NOT NULL,
            name VARCHAR(80) NULL,
            ip_hash CHAR(64) NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY memorial_id (memorial_id, created_at)
        ) $charset;";

        $sql[] = "CREATE TABLE $purchases (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            plan VARCHAR(20) NOT NULL,
            plan_name VARCHAR(80) NOT NULL,
            amount INT NOT NULL,
            credits INT NOT NULL,
            reference VARCHAR(40) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
            mode VARCHAR(20) NOT NULL DEFAULT 'demo',
            provider_order VARCHAR(64) NULL,
            payer_email VARCHAR(190) NULL,
            paid_at DATETIME NULL,
            refund_id VARCHAR(64) NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY reference (reference),
            KEY user_id (user_id, created_at),
            KEY provider_order (provider_order)
        ) $charset;";

        // Límite de intentos por IP y acción (mensajes, velas, ingreso).
        $sql[] = "CREATE TABLE $rate (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            bucket VARCHAR(40) NOT NULL,
            ip_hash CHAR(64) NOT NULL,
            hits INT NOT NULL DEFAULT 0,
            window_start DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY bucket_ip (bucket, ip_hash)
        ) $charset;";

        dbDelta($sql);
        update_option(self::OPTION, JM_DB_VERSION);
    }
}
