<?php
/**
 * Plugin Name:       Jardín Memorial
 * Plugin URI:        https://www.jardinmemorial.cl
 * Description:       Memoriales digitales completos dentro de WordPress: cuentas, planes, fotos, video, música, libro de visitas, velas, enlace con QR, certificado y pagos con Mercado Pago. No necesita Node ni un servidor aparte.
 * Version:           2.0.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Jardín Memorial
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       jardin-memorial
 * Domain Path:       /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('JM_VERSION', '2.0.0');
define('JM_FILE', __FILE__);
define('JM_DIR', plugin_dir_path(__FILE__));
define('JM_URL', plugin_dir_url(__FILE__));
define('JM_DB_VERSION', '1');

require_once JM_DIR . 'includes/class-jm-util.php';
require_once JM_DIR . 'includes/class-jm-db.php';
require_once JM_DIR . 'includes/class-jm-repo.php';
require_once JM_DIR . 'includes/class-jm-accounts.php';
require_once JM_DIR . 'includes/class-jm-media.php';
require_once JM_DIR . 'includes/class-jm-payments.php';
require_once JM_DIR . 'includes/class-jm-migrate.php';
require_once JM_DIR . 'includes/class-jm-actions.php';
require_once JM_DIR . 'includes/class-jm-frontend.php';
require_once JM_DIR . 'includes/class-jm-admin.php';

/**
 * Arranque del plugin. Cada clase se registra sola en sus hooks; aquí solo se
 * comprueba que la base esté al día (por si el plugin se actualizó subiendo
 * archivos sin desactivarlo).
 */
function jm_bootstrap()
{
    JM_DB::maybe_upgrade();
    JM_Actions::init();
    JM_Frontend::init();
    JM_Admin::init();
}
add_action('plugins_loaded', 'jm_bootstrap');

/** Activación: tablas, páginas y reglas de enlace permanente. */
function jm_activate()
{
    JM_DB::install();
    JM_Frontend::create_pages();
    JM_Frontend::add_rewrite_rules();
    flush_rewrite_rules();
    update_option('jm_flush_needed', '0');
}
register_activation_hook(__FILE__, 'jm_activate');

/** Desactivación: solo se limpian las reglas; los datos se conservan. */
function jm_deactivate()
{
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'jm_deactivate');
