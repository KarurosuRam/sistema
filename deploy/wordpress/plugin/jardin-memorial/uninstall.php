<?php
/**
 * Desinstalación.
 *
 * Los memoriales son recuerdos de personas reales, así que por defecto NO se
 * borran al desinstalar el plugin: solo se limpian las opciones y los avisos
 * temporales. Para eliminar también los memoriales, las fotos, los mensajes,
 * las velas y las compras hay que definir en wp-config.php:
 *
 *   define('JM_BORRAR_DATOS', true);
 *
 * antes de desinstalar.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

global $wpdb;

// Opciones y avisos temporales: siempre se limpian.
$opciones = array(
    'jm_db_version',
    'jm_pages',
    'jm_settings',
    'jm_admin_emails',
    'jm_flush_needed',
);

foreach ($opciones as $opcion) {
    delete_option($opcion);
}

$wpdb->query(
    "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_jm\\_%' OR option_name LIKE '\\_transient\\_timeout\\_jm\\_%'"
);

// Los cupos viven en el perfil de cada cuenta.
delete_metadata('user', 0, 'jm_credits', '', true);
delete_metadata('user', 0, 'jm_phone', '', true);

if (!defined('JM_BORRAR_DATOS') || !JM_BORRAR_DATOS) {
    return;
}

// A partir de aquí, borrado definitivo.
$tablas = array(
    $wpdb->prefix . 'jm_candles',
    $wpdb->prefix . 'jm_guestbook',
    $wpdb->prefix . 'jm_photos',
    $wpdb->prefix . 'jm_rates',
    $wpdb->prefix . 'jm_purchases',
    $wpdb->prefix . 'jm_memorials',
);

foreach ($tablas as $tabla) {
    $wpdb->query("DROP TABLE IF EXISTS {$tabla}");
}

// Adjuntos importados o subidos por el plugin (carpeta propia en uploads).
$uploads = wp_upload_dir();
$carpeta = trailingslashit($uploads['basedir']) . 'jardin-memorial';
if (is_dir($carpeta)) {
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($carpeta, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($items as $item) {
        if ($item->isDir()) {
            @rmdir($item->getPathname());
        } else {
            @unlink($item->getPathname());
        }
    }
    @rmdir($carpeta);
}
