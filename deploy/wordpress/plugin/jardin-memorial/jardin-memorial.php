<?php
/**
 * Plugin Name:       Jardín Memorial
 * Plugin URI:        https://www.jardinmemorial.cl
 * Description:       Inserta la aplicación de memoriales (enlace, QR, galería, música y certificado) dentro de una página de WordPress mediante un iframe seguro. Incluye plantilla de pantalla completa.
 * Version:           1.0.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Jardín Memorial
 * License:           GPL-2.0-or-later
 * Text Domain:       jardin-memorial
 */

if (!defined('ABSPATH')) {
    exit;
}

define('JM_VERSION', '1.0.0');
define('JM_OPTION', 'jardin_memorial_settings');
define('JM_PATH', plugin_dir_path(__FILE__));
define('JM_URL', plugin_dir_url(__FILE__));

/* -------------------------------------------------------------------------
 * Ajustes
 * ---------------------------------------------------------------------- */

function jm_defaults()
{
    return array(
        'app_url' => '',
        'height'  => 1200,
    );
}

function jm_get_settings()
{
    $saved = get_option(JM_OPTION, array());
    if (!is_array($saved)) {
        $saved = array();
    }
    return wp_parse_args($saved, jm_defaults());
}

function jm_app_url()
{
    $settings = jm_get_settings();
    return untrailingslashit(trim((string) $settings['app_url']));
}

function jm_register_settings()
{
    register_setting(
        'jardin_memorial',
        JM_OPTION,
        array(
            'type'              => 'array',
            'sanitize_callback' => 'jm_sanitize_settings',
            'default'           => jm_defaults(),
        )
    );
}
add_action('admin_init', 'jm_register_settings');

function jm_sanitize_settings($input)
{
    $input = is_array($input) ? $input : array();
    $url   = isset($input['app_url']) ? trim((string) $input['app_url']) : '';

    if ($url !== '') {
        $url = esc_url_raw($url, array('http', 'https'));
        // Sin esquema, esc_url_raw devuelve vacío: se intenta completar.
        if ($url === '' && preg_match('#^[a-z0-9.-]+\.[a-z]{2,}#i', $input['app_url'])) {
            $url = esc_url_raw('https://' . ltrim($input['app_url'], '/'));
        }
    }

    return array(
        'app_url' => $url ? untrailingslashit($url) : '',
        'height'  => isset($input['height']) ? max(320, min(4000, absint($input['height']))) : 1200,
    );
}

function jm_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }

    $settings = jm_get_settings();
    $app_url  = jm_app_url();
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Jardín Memorial', 'jardin-memorial'); ?></h1>

        <p style="max-width:760px">
            <?php esc_html_e('Conecta este sitio de WordPress con la aplicación de memoriales. La app se ejecuta en un subdominio propio (por ejemplo, memoriales.tudominio.cl) y se muestra aquí mediante un iframe seguro.', 'jardin-memorial'); ?>
        </p>

        <form method="post" action="options.php" style="max-width:760px">
            <?php settings_fields('jardin_memorial'); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="jm-app-url"><?php esc_html_e('URL de la aplicación', 'jardin-memorial'); ?></label>
                    </th>
                    <td>
                        <input
                            type="url"
                            id="jm-app-url"
                            name="<?php echo esc_attr(JM_OPTION); ?>[app_url]"
                            value="<?php echo esc_attr($settings['app_url']); ?>"
                            class="regular-text code"
                            placeholder="https://memoriales.tudominio.cl"
                            required
                        >
                        <p class="description">
                            <?php esc_html_e('Dirección pública de la app Node.js, sin barra final. Debe ser HTTPS para que el iframe no sea bloqueado como contenido mixto.', 'jardin-memorial'); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="jm-height"><?php esc_html_e('Alto por defecto', 'jardin-memorial'); ?></label>
                    </th>
                    <td>
                        <input
                            type="number"
                            id="jm-height"
                            name="<?php echo esc_attr(JM_OPTION); ?>[height]"
                            value="<?php echo esc_attr((int) $settings['height']); ?>"
                            min="320"
                            max="4000"
                            step="20"
                            class="small-text"
                        >
                        <span>px</span>
                        <p class="description">
                            <?php esc_html_e('Se puede cambiar por página con el atributo alto del shortcode, por ejemplo alto="900" o alto="full".', 'jardin-memorial'); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <?php submit_button(__('Guardar ajustes', 'jardin-memorial')); ?>
        </form>

        <hr style="max-width:760px;margin:28px 0">

        <h2><?php esc_html_e('Cómo usarlo', 'jardin-memorial'); ?></h2>
        <ol style="max-width:760px;line-height:1.7">
            <li><?php esc_html_e('Crea una página (por ejemplo, «Memoriales») y escribe el shortcode:', 'jardin-memorial'); ?>
                <code>[jardin_memorial]</code>
            </li>
            <li><?php esc_html_e('En «Atributos de página» elige la plantilla «Jardín Memorial (pantalla completa)» para que la app ocupe todo el ancho, sin el encabezado del tema.', 'jardin-memorial'); ?></li>
            <li><?php esc_html_e('Agrega la página al menú del sitio. La app también se puede enlazar directamente, por ejemplo con:', 'jardin-memorial'); ?>
                <code>[jardin_memorial_enlace texto="Crear un memorial" ruta="/registro"]</code>
            </li>
        </ol>

        <h3><?php esc_html_e('Shortcodes disponibles', 'jardin-memorial'); ?></h3>
        <table class="widefat striped" style="max-width:760px">
            <thead>
                <tr>
                    <th><?php esc_html_e('Shortcode', 'jardin-memorial'); ?></th>
                    <th><?php esc_html_e('Para qué sirve', 'jardin-memorial'); ?></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>[jardin_memorial]</code></td>
                    <td><?php esc_html_e('Muestra la app completa (portada, memoriales, panel y pagos).', 'jardin-memorial'); ?></td>
                </tr>
                <tr>
                    <td><code>[jardin_memorial ruta="/memoriales"]</code></td>
                    <td><?php esc_html_e('Abre una sección concreta de la app.', 'jardin-memorial'); ?></td>
                </tr>
                <tr>
                    <td><code>[jardin_memorial alto="900"]</code></td>
                    <td><?php esc_html_e('Fija el alto del iframe en píxeles.', 'jardin-memorial'); ?></td>
                </tr>
                <tr>
                    <td><code>[jardin_memorial chrome="0"]</code></td>
                    <td><?php esc_html_e('Oculta el encabezado y el pie de la app cuando la página conserva el encabezado del tema.', 'jardin-memorial'); ?></td>
                </tr>
                <tr>
                    <td><code>[jardin_memorial_enlace texto="Ingresar" ruta="/ingresar"]</code></td>
                    <td><?php esc_html_e('Crea un enlace normal (sin iframe) hacia la app.', 'jardin-memorial'); ?></td>
                </tr>
            </tbody>
        </table>

        <?php if ($app_url) : ?>
            <p style="margin-top:18px">
                <a class="button button-secondary" href="<?php echo esc_url($app_url); ?>" target="_blank" rel="noopener noreferrer">
                    <?php esc_html_e('Abrir la aplicación en una pestaña nueva', 'jardin-memorial'); ?>
                </a>
                <a class="button button-secondary" href="<?php echo esc_url($app_url . '/pago/estado'); ?>" target="_blank" rel="noopener noreferrer">
                    <?php esc_html_e('Ver estado de pagos', 'jardin-memorial'); ?>
                </a>
            </p>
        <?php endif; ?>
    </div>
    <?php
}

function jm_admin_menu()
{
    add_options_page(
        __('Jardín Memorial', 'jardin-memorial'),
        __('Jardín Memorial', 'jardin-memorial'),
        'manage_options',
        'jardin-memorial',
        'jm_settings_page'
    );
}
add_action('admin_menu', 'jm_admin_menu');

function jm_plugin_action_links($links)
{
    $url = admin_url('options-general.php?page=jardin-memorial');
    array_unshift($links, '<a href="' . esc_url($url) . '">' . esc_html__('Ajustes', 'jardin-memorial') . '</a>');
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'jm_plugin_action_links');

function jm_admin_notice()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    if (jm_app_url() !== '') {
        return;
    }
    $url = admin_url('options-general.php?page=jardin-memorial');
    echo '<div class="notice notice-warning is-dismissible"><p><strong>Jardín Memorial:</strong> ';
    echo esc_html__('falta indicar la URL de la aplicación para que los shortcodes funcionen.', 'jardin-memorial');
    echo ' <a href="' . esc_url($url) . '">' . esc_html__('Configurar ahora', 'jardin-memorial') . '</a></p></div>';
}
add_action('admin_notices', 'jm_admin_notice');

/* -------------------------------------------------------------------------
 * Plantilla de pantalla completa
 * ---------------------------------------------------------------------- */

function jm_register_template($templates)
{
    $templates['jardin-memorial-fullscreen'] = __('Jardín Memorial (pantalla completa)', 'jardin-memorial');
    return $templates;
}
add_filter('theme_page_templates', 'jm_register_template');

function jm_template_include($template)
{
    if (is_page() && 'jardin-memorial-fullscreen' === get_page_template_slug(get_queried_object_id())) {
        $custom = JM_PATH . 'templates/fullscreen.php';
        if (file_exists($custom)) {
            return $custom;
        }
    }
    return $template;
}
add_filter('template_include', 'jm_template_include');

/* -------------------------------------------------------------------------
 * Shortcodes
 * ---------------------------------------------------------------------- */

function jm_build_url($ruta, $embebido, $chrome = '1')
{
    $base = jm_app_url();
    if ($base === '') {
        return '';
    }

    $path = '/' . ltrim((string) $ruta, '/');
    $path = preg_replace('#[^A-Za-z0-9/_\-.?=&%\#]#', '', $path);
    $url  = $base . $path;

    if ($embebido) {
        $url = add_query_arg(
            array(
                'embed'  => '1',
                // chrome=0 oculta el encabezado y el pie de la app (útil cuando
                // la página de WordPress conserva el encabezado del tema).
                'chrome' => $chrome === '0' ? '0' : '1',
            ),
            $url
        );
    }
    return $url;
}

function jm_shortcode($atts)
{
    $atts = shortcode_atts(
        array(
            'ruta'     => '/',
            'alto'     => '',
            'embebido' => '1',
            'chrome'   => '1',
            'titulo'   => 'Jardín Memorial',
            'clase'    => '',
        ),
        $atts,
        'jardin_memorial'
    );

    $url = jm_build_url($atts['ruta'], $atts['embebido'] !== '0', $atts['chrome'] === '0' ? '0' : '1');
    if ($url === '') {
        if (current_user_can('manage_options')) {
            return '<div class="jm-aviso">' . esc_html__('Jardín Memorial: configura la URL de la aplicación en Ajustes → Jardín Memorial.', 'jardin-memorial') . '</div>';
        }
        return '';
    }

    $settings = jm_get_settings();
    $alto     = strtolower(trim((string) $atts['alto']));

    if ($alto === 'full' || $alto === '100vh') {
        $style = 'height:100vh;min-height:640px;';
    } else {
        $height = $alto !== '' ? absint($alto) : (int) $settings['height'];
        if ($height < 320) {
            $height = 1200;
        }
        $style = 'height:' . $height . 'px;';
    }

    $classes = 'jm-embed';
    if ($atts['clase'] !== '') {
        $classes .= ' ' . sanitize_html_class($atts['clase']);
    }

    static $style_printed = false;
    $inline = '';
    if (!$style_printed) {
        $style_printed = true;
        $inline = '<style>.jm-embed{width:100%;max-width:100%;}.jm-embed iframe{display:block;width:100%;border:0;border-radius:0;background:#faf8f3;}.jm-aviso{padding:16px;border:1px solid #e0c9a6;background:#fbf3e2;border-radius:6px;}</style>';
    }

    return $inline . sprintf(
        '<div class="%1$s"><iframe src="%2$s" title="%3$s" loading="lazy" style="%4$s" allow="autoplay; fullscreen; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>',
        esc_attr($classes),
        esc_url($url),
        esc_attr($atts['titulo']),
        esc_attr($style)
    );
}
add_shortcode('jardin_memorial', 'jm_shortcode');

function jm_link_shortcode($atts)
{
    $atts = shortcode_atts(
        array(
            'texto' => 'Ir a Jardín Memorial',
            'ruta'  => '/',
            'clase' => 'button',
        ),
        $atts,
        'jardin_memorial_enlace'
    );

    $url = jm_build_url($atts['ruta'], false);
    if ($url === '') {
        return '';
    }

    return sprintf(
        '<a class="%1$s" href="%2$s">%3$s</a>',
        esc_attr(sanitize_html_class($atts['clase'])),
        esc_url($url),
        esc_html($atts['texto'])
    );
}
add_shortcode('jardin_memorial_enlace', 'jm_link_shortcode');

/* -------------------------------------------------------------------------
 * Aviso si el dominio de la app no está autorizado en EMBED_ORIGINS
 * ---------------------------------------------------------------------- */

function jm_embed_notice()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if (!$screen || strpos((string) $screen->id, 'jardin-memorial') === false) {
        return;
    }
    $app = jm_app_url();
    if ($app === '' || !is_ssl()) {
        return;
    }
    $app_host = wp_parse_url($app, PHP_URL_HOST);
    $home_host = wp_parse_url(home_url(), PHP_URL_HOST);
    if (!$app_host || !$home_host) {
        return;
    }
    if ($app_host === $home_host) {
        return;
    }
    // La comprobación real la hace el navegador; aquí solo se recuerda que el
    // dominio de WordPress debe estar en EMBED_ORIGINS de la app.
    echo '<div class="notice notice-info"><p><strong>Jardín Memorial:</strong> ';
    echo esc_html__('recuerda que EMBED_ORIGINS de la app debe incluir este dominio de WordPress para permitir el iframe y las cookies de sesión.', 'jardin-memorial');
    echo ' <code>' . esc_html(home_url('/')) . '</code></p></div>';
}
add_action('admin_notices', 'jm_embed_notice');
