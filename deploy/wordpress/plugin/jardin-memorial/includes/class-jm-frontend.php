<?php
/**
 * Parte visible: páginas, enlaces de memorial, plantillas y estilos.
 *
 * Todo se apoya en el tema activo (get_header / get_footer): el sitio sigue
 * siendo el de WordPress y el plugin aporta el contenido y sus estilos.
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Frontend
{
    public static function init()
    {
        add_action('init', array(__CLASS__, 'add_rewrite_rules'));
        add_filter('query_vars', array(__CLASS__, 'query_vars'));
        add_filter('template_include', array(__CLASS__, 'template_include'));
        add_action('wp_enqueue_scripts', array(__CLASS__, 'enqueue'));

        $shortcodes = array(
            'jardin_memorial_listado' => 'shortcode_listado',
            'jardin_memorial_panel' => 'shortcode_panel',
            'jardin_memorial_planes' => 'shortcode_planes',
            'jardin_memorial_ingresar' => 'shortcode_ingresar',
            'jardin_memorial_registro' => 'shortcode_registro',
            'jardin_memorial_recuperar' => 'shortcode_recuperar',
            'jardin_memorial_comprobante' => 'shortcode_comprobante',
            'jardin_memorial_certificado' => 'shortcode_certificado',
            'jardin_memorial' => 'shortcode_panel',
        );
        foreach ($shortcodes as $tag => $method) {
            add_shortcode($tag, array(__CLASS__, $method));
        }

        add_action('rest_api_init', array(__CLASS__, 'rest_routes'));

        // Las reglas nuevas necesitan un flush una sola vez después de activar.
        if (get_option('jm_flush_needed') === '1') {
            flush_rewrite_rules();
            update_option('jm_flush_needed', '0');
        }
    }

    /* ------------------------------------------------------------- REST */

    public static function rest_routes()
    {
        register_rest_route('jardin-memorial/v1', '/mp', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'mp_webhook'),
            'permission_callback' => '__return_true',
        ));
    }

    /**
     * Notificación de Mercado Pago. Siempre se responde 200: si algo falla se
     * registra y Mercado Pago reintenta. El pago se aplica solo después de
     * consultarlo en la API.
     */
    public static function mp_webhook($request)
    {
        if (!JM_Payments::valid_signature($request)) {
            return new WP_REST_Response(array('ok' => false, 'error' => 'firma'), 401);
        }

        $data = $request->get_json_params();
        $type = $request->get_param('type');
        if (!$type && is_array($data) && isset($data['type'])) {
            $type = $data['type'];
        }

        $payment_id = $request->get_param('data_id');
        if (!$payment_id && is_array($data) && isset($data['data']['id'])) {
            $payment_id = $data['data']['id'];
        }

        if ($type !== 'payment' || !$payment_id) {
            return new WP_REST_Response(array('ok' => true, 'ignorado' => true), 200);
        }

        $result = JM_Payments::handle_notification($payment_id);
        if (is_wp_error($result)) {
            error_log('[jardin-memorial] webhook: ' . $result->get_error_message());
        }

        return new WP_REST_Response(array('ok' => true), 200);
    }

    /* ------------------------------------------------------------- rutas */

    public static function add_rewrite_rules()
    {
        add_rewrite_rule('^m/([^/]+)/?$', 'index.php?jm_memorial=$matches[1]', 'top');
        add_rewrite_rule('^certificado/([^/]+)/?$', 'index.php?jm_certificado=$matches[1]', 'top');
    }

    public static function query_vars($vars)
    {
        $vars[] = 'jm_memorial';
        $vars[] = 'jm_certificado';
        return $vars;
    }

    public static function template_include($template)
    {
        $slug = get_query_var('jm_memorial');
        if (!$slug) {
            return $template;
        }

        $memorial = JM_Repo::find_memorial_by_slug($slug);
        if (!$memorial) {
            global $wp_query;
            $wp_query->set_404();
            status_header(404);
            return get_404_template();
        }

        $is_owner = JM_Util::is_owner($memorial);
        if (!$memorial->is_public && !$is_owner && !JM_Accounts::is_admin_user()) {
            global $wp_query;
            $wp_query->set_404();
            status_header(404);
            return get_404_template();
        }

        global $jm_memorial_data;
        $jm_memorial_data = $memorial;

        return JM_DIR . 'templates/memorial.php';
    }

    /* --------------------------------------------------------- estilos */

    public static function enqueue()
    {
        if (!self::is_plugin_page()) {
            return;
        }

        $version = JM_VERSION;
        wp_enqueue_style('jm', JM_URL . 'assets/css/jm.css', array(), $version);

        // El QR se dibuja en el navegador, sin llamar a ningún servicio externo.
        wp_enqueue_script('jm-qrcode', JM_URL . 'assets/js/vendor/qrcode.min.js', array(), '1.0.0', true);
        wp_enqueue_script('jm-app', JM_URL . 'assets/js/app.js', array('jm-qrcode'), $version, true);
    }

    public static function is_plugin_page()
    {
        if (get_query_var('jm_memorial') || get_query_var('jm_certificado')) {
            return true;
        }
        if (!is_singular()) {
            return false;
        }
        $pages = get_option('jm_pages', array());
        $ids = array_map('intval', array_values((array) $pages));
        return in_array((int) get_queried_object_id(), $ids, true);
    }

    public static function is_panel_area()
    {
        $pages = get_option('jm_pages', array());
        $panel = isset($pages['panel']) ? (int) $pages['panel'] : 0;
        return $panel && is_page($panel);
    }

    /* ------------------------------------------------------------ páginas */

    /** Crea (una sola vez) las páginas del plugin y recuerda sus IDs. */
    public static function create_pages()
    {
        $definidas = array(
            'listado' => array('Memoriales', 'memoriales', 'jardin_memorial_listado'),
            'panel' => array('Mi jardín', 'mi-jardin', 'jardin_memorial_panel'),
            'planes' => array('Planes', 'planes', 'jardin_memorial_planes'),
            'ingresar' => array('Ingresar', 'ingresar', 'jardin_memorial_ingresar'),
            'registro' => array('Crear cuenta', 'crear-cuenta', 'jardin_memorial_registro'),
            'recuperar' => array('Recuperar contraseña', 'recuperar-clave', 'jardin_memorial_recuperar'),
            'comprobante' => array('Comprobante', 'comprobante', 'jardin_memorial_comprobante'),
            'certificado' => array('Certificado', 'certificado', 'jardin_memorial_certificado'),
        );

        $guardadas = (array) get_option('jm_pages', array());

        foreach ($definidas as $key => $def) {
            if (!empty($guardadas[$key]) && get_post($guardadas[$key])) {
                continue;
            }
            $existing = get_page_by_path($def[1]);
            if ($existing) {
                $guardadas[$key] = (int) $existing->ID;
                continue;
            }
            $page_id = wp_insert_post(array(
                'post_title' => $def[0],
                'post_name' => $def[1],
                'post_content' => '[' . $def[2] . ']',
                'post_status' => 'publish',
                'post_type' => 'page',
                'comment_status' => 'closed',
                'ping_status' => 'closed',
            ));
            if (!is_wp_error($page_id) && $page_id) {
                $guardadas[$key] = (int) $page_id;
            }
        }

        update_option('jm_pages', $guardadas);
        return $guardadas;
    }

    /* --------------------------------------------------------- plantillas */

    /**
     * Incluye una plantilla con variables. Las plantillas no imprimen
     * <html>: eso lo pone el tema.
     */
    public static function render($name, array $vars = array())
    {
        $name = preg_replace('/\.php$/', '', (string) $name);
        $file = JM_DIR . 'templates/' . $name . '.php';
        if (!file_exists($file)) {
            return '';
        }

        $vars['jm_flash'] = JM_Util::take_flash();
        $vars['jm_user'] = wp_get_current_user();
        $vars['jm_credits'] = JM_Accounts::credits();
        $vars['jm_settings'] = JM_Payments::settings();

        ob_start();
        // phpcs:ignore WordPress.PHP.DontExtract.extract_extract
        extract($vars, EXTR_SKIP);
        include $file;
        return ob_get_clean();
    }

    /** Envuelve una plantilla con el encabezado y pie del tema. */
    public static function page($title, $template, array $vars = array())
    {
        $vars['jm_title'] = $title;
        get_header();
        echo '<main class="jm-page">';
        echo self::render($template, $vars);
        echo '</main>';
        get_footer();
    }

    /* -------------------------------------------------------- shortcodes */

    public static function shortcode_listado($atts)
    {
        $atts = shortcode_atts(array('limite' => 24), $atts, 'jardin_memorial_listado');
        $search = isset($_GET['q']) ? sanitize_text_field(wp_unslash($_GET['q'])) : '';
        $kind = isset($_GET['tipo']) ? sanitize_key(wp_unslash($_GET['tipo'])) : '';
        $page = max(1, isset($_GET['pagina']) ? (int) $_GET['pagina'] : 1);
        $per_page = max(1, min(60, (int) $atts['limite']));
        $offset = ($page - 1) * $per_page;

        return self::render('listado.php', array(
            'memorials' => JM_Repo::public_memorials($per_page, $offset, $search, $kind),
            'total' => JM_Repo::count_public_memorials($search, $kind),
            'search' => $search,
            'kind' => $kind,
            'page' => $page,
            'per_page' => $per_page,
        ));
    }

    public static function shortcode_panel($atts)
    {
        if (!is_user_logged_in()) {
            return self::render('auth-ingresar.php', array(
                'errors' => array(),
                'values' => array(),
                'redirect' => JM_Util::page_url('panel'),
            ));
        }
        return self::render('panel.php', array(
            'memorials' => JM_Repo::memorials_by_user(get_current_user_id()),
            'purchases' => JM_Repo::purchases_by_user(get_current_user_id()),
            'messages' => JM_Repo::latest_messages(get_current_user_id(), 20),
        ));
    }

    public static function shortcode_planes($atts)
    {
        return self::render('planes.php', array(
            'plans' => JM_Payments::plans(),
            'mode' => JM_Payments::mode(),
        ));
    }

    public static function shortcode_ingresar($atts)
    {
        if (is_user_logged_in() && empty($_GET['forzar'])) {
            return self::render('auth-ya-dentro.php');
        }
        return self::render('auth-ingresar.php', array(
            'errors' => array(),
            'values' => array(),
            'redirect' => isset($_GET['redirect_to']) ? esc_url_raw(wp_unslash($_GET['redirect_to'])) : JM_Util::page_url('panel'),
        ));
    }

    public static function shortcode_registro($atts)
    {
        if (is_user_logged_in() && empty($_GET['forzar'])) {
            return self::render('auth-ya-dentro.php');
        }
        $recall = JM_Util::recall();
        return self::render('auth-registro.php', array(
            'errors' => isset($recall['errors']) ? $recall['errors'] : array(),
            'values' => isset($recall['values']) ? $recall['values'] : array(),
        ));
    }

    public static function shortcode_recuperar($atts)
    {
        $sent = isset($_GET['enviado']) && $_GET['enviado'] === '1';
        return self::render('auth-recuperar.php', array('sent' => $sent));
    }

    public static function shortcode_comprobante($atts)
    {
        if (!empty($_GET['jm_pago'])) {
            return self::render('pago-demo.php', array(
                'purchase' => JM_Repo::find_purchase(sanitize_text_field(wp_unslash($_GET['jm_pago']))),
            ));
        }

        $reference = isset($_GET['ref']) ? sanitize_text_field(wp_unslash($_GET['ref'])) : '';
        $purchase = $reference ? JM_Repo::find_purchase($reference) : null;

        if (!$purchase || !is_user_logged_in() || (int) $purchase->user_id !== get_current_user_id()) {
            return self::render('comprobante.php', array('purchase' => null));
        }

        // Al volver de Mercado Pago se consulta el estado real una vez.
        if ($purchase->status === 'pendiente' && $purchase->mode === 'mercadopago' && isset($_GET['volver'])) {
            $result = JM_Payments::verify($purchase);
            if (!is_wp_error($result)) {
                $purchase = JM_Repo::find_purchase($purchase->reference);
            }
        }

        return self::render('comprobante.php', array('purchase' => $purchase));
    }

    public static function shortcode_certificado($atts)
    {
        $code = isset($_GET['codigo']) ? sanitize_text_field(wp_unslash($_GET['codigo'])) : '';
        $memorial = $code ? JM_Repo::find_memorial_by_certificate($code) : null;

        if (!$memorial || !is_user_logged_in() || !JM_Util::is_owner($memorial)) {
            return self::render('certificado.php', array('memorial' => null));
        }
        return self::render('certificado.php', array('memorial' => $memorial));
    }
}
