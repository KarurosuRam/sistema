<?php
/**
 * Administración dentro del escritorio de WordPress.
 *
 * Cuatro pantallas: Pagos (estado, ventas, verificar y reembolsar), Correo y
 * claves (enlaces de recuperación), Migración (importar el ZIP de la app
 * anterior) y Ajustes (credenciales de Mercado Pago y correo del dueño).
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Admin
{
    public static function init()
    {
        add_action('admin_menu', array(__CLASS__, 'menu'));
        add_action('admin_post_jm_admin_guardar', array(__CLASS__, 'guardar_ajustes'));
        add_action('admin_post_jm_admin_verificar', array(__CLASS__, 'verificar'));
        add_action('admin_post_jm_admin_reembolsar', array(__CLASS__, 'reembolsar'));
        add_action('admin_post_jm_admin_importar', array(__CLASS__, 'importar'));
        add_action('admin_post_jm_admin_enlace', array(__CLASS__, 'crear_enlace'));
        add_action('admin_post_jm_admin_probar_correo', array(__CLASS__, 'probar_correo'));
        add_action('admin_notices', array(__CLASS__, 'aviso_configuracion'));
    }

    public static function menu()
    {
        $cap = 'manage_options';
        add_menu_page(
            'Jardín Memorial',
            'Jardín Memorial',
            $cap,
            'jm-pagos',
            array(__CLASS__, 'pagina_pagos'),
            'dashicons-heart',
            58
        );
        add_submenu_page('jm-pagos', 'Pagos', 'Pagos', $cap, 'jm-pagos', array(__CLASS__, 'pagina_pagos'));
        add_submenu_page('jm-pagos', 'Correo y claves', 'Correo y claves', $cap, 'jm-correo', array(__CLASS__, 'pagina_correo'));
        add_submenu_page('jm-pagos', 'Migración', 'Migración', $cap, 'jm-migracion', array(__CLASS__, 'pagina_migracion'));
        add_submenu_page('jm-pagos', 'Ajustes', 'Ajustes', $cap, 'jm-ajustes', array(__CLASS__, 'pagina_ajustes'));
    }

    private static function guard()
    {
        if (!current_user_can('manage_options')) {
            wp_die('No tienes permiso para esta página.', 'Sin permiso', array('response' => 403));
        }
    }

    private static function volver($page, $args = array())
    {
        wp_safe_redirect(add_query_arg($args, admin_url('admin.php?page=' . $page)));
        exit;
    }

    public static function aviso_configuracion()
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $aviso = get_transient('jm_admin_notice_' . get_current_user_id());
        if ($aviso) {
            delete_transient('jm_admin_notice_' . get_current_user_id());
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($aviso) . '</p></div>';
        }
        $settings = JM_Payments::settings();
        if ($settings['mode'] === 'mercadopago' && JM_Payments::token() === '') {
            echo '<div class="notice notice-warning"><p><strong>Jardín Memorial:</strong> el modo de pago es Mercado Pago pero falta el Access Token. Las compras quedan en la pasarela de prueba.</p></div>';
        }
        if (!self::correo_configurado()) {
            echo '<div class="notice notice-info"><p><strong>Jardín Memorial:</strong> WordPress no tiene un plugin de correo (SMTP) configurado. El enlace de recuperación de contraseña puede no llegar; puedes generarlo a mano en <a href="' . esc_url(admin_url('admin.php?page=jm-correo')) . '">Correo y claves</a>.</p></div>';
        }
    }

    public static function correo_configurado()
    {
        // Si hay un plugin de SMTP activo, el correo sale por él.
        return (bool) apply_filters('jm_mail_configured', defined('WPMS_PLUGIN_VER') || class_exists('PHPMailer\\PHPMailer\\PHPMailer') && has_action('phpmailer_init'));
    }

    /* --------------------------------------------------------------- pagos */

    public static function pagina_pagos()
    {
        self::guard();
        $mode = JM_Payments::mode();
        $totals = JM_Repo::purchase_totals();
        $purchases = JM_Repo::recent_purchases(30);
        $token = JM_Payments::token();

        echo '<div class="wrap">';
        echo '<h1>Pagos</h1>';

        echo '<table class="widefat striped" style="max-width:820px;margin:16px 0 26px">';
        echo '<tbody>';
        echo '<tr><th style="width:220px">Pasarela activa</th><td><strong>' . esc_html($mode === 'mercadopago' ? 'Mercado Pago' : 'Pasarela de prueba') . '</strong></td></tr>';
        if ($mode === 'mercadopago') {
            $tipo = JM_Payments::token_is_test() ? 'pruebas (TEST-)' : 'producción (APP_USR-)';
            echo '<tr><th>Access Token</th><td><code>' . esc_html(self::mask($token)) . '</code> · ' . esc_html($tipo) . '</td></tr>';
            echo '<tr><th>Firma del webhook</th><td>' . (JM_Payments::webhook_secret() !== '' ? 'definida' : 'sin definir (la app igual consulta el pago real)') . '</td></tr>';
            echo '<tr><th>URL de notificación</th><td><code>' . esc_html(rest_url('jardin-memorial/v1/mp')) . '</code></td></tr>';
        }
        echo '<tr><th>Ventas pagadas</th><td><strong>' . esc_html(JM_Util::clp($totals->amount_paid)) . '</strong> · ' . (int) $totals->credits_sold . ' memoriales</td></tr>';
        echo '<tr><th>Pagos pendientes</th><td>' . (int) $totals->pending . '</td></tr>';
        if ((int) $totals->refunded > 0) {
            echo '<tr><th>Devoluciones</th><td>' . esc_html(JM_Util::clp($totals->amount_refunded)) . ' · ' . (int) $totals->refunded . '</td></tr>';
        }
        echo '</tbody></table>';

        echo '<h2>Movimientos</h2>';
        echo '<table class="widefat striped"><thead><tr><th>Fecha</th><th>Cuenta</th><th>Plan</th><th>Monto</th><th>Estado</th><th>Referencia</th><th>Acciones</th></tr></thead><tbody>';

        if (!$purchases) {
            echo '<tr><td colspan="7">Todavía no hay compras.</td></tr>';
        }

        foreach ($purchases as $purchase) {
            $user = get_user_by('id', (int) $purchase->user_id);
            echo '<tr>';
            echo '<td>' . esc_html(JM_Util::short_date($purchase->created_at)) . '</td>';
            echo '<td>' . esc_html($user ? $user->user_email : '—') . '</td>';
            echo '<td>' . esc_html($purchase->plan_name) . '</td>';
            echo '<td>' . esc_html(JM_Util::clp($purchase->amount)) . '</td>';
            echo '<td>' . esc_html(self::estado_label($purchase->status)) . '</td>';
            echo '<td><code>' . esc_html($purchase->reference) . '</code>';
            if ($purchase->provider_order) {
                echo '<br><small>MP #' . esc_html($purchase->provider_order) . '</small>';
            }
            echo '</td><td>';

            if ($purchase->status === 'pendiente') {
                echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="display:inline">';
                wp_nonce_field('jm_admin_verificar');
                echo '<input type="hidden" name="action" value="jm_admin_verificar">';
                echo '<input type="hidden" name="reference" value="' . esc_attr($purchase->reference) . '">';
                submit_button('Verificar', 'secondary small', 'submit', false);
                echo '</form> ';
            }

            if ($purchase->status === 'pagado' && $purchase->mode === 'mercadopago') {
                echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="display:inline" onsubmit="return confirm(\'Se devolverá el dinero en Mercado Pago y se quitarán los cupos sin usar. Los memoriales creados no se borran. ¿Continuar?\');">';
                wp_nonce_field('jm_admin_reembolsar');
                echo '<input type="hidden" name="action" value="jm_admin_reembolsar">';
                echo '<input type="hidden" name="reference" value="' . esc_attr($purchase->reference) . '">';
                submit_button('Reembolsar', 'secondary small', 'submit', false);
                echo '</form>';
            }

            echo '</td></tr>';
        }

        echo '</tbody></table>';
        echo '<p style="margin-top:18px"><a class="button" href="' . esc_url(admin_url('admin.php?page=jm-ajustes')) . '">Configurar credenciales</a></p>';
        echo '</div>';
    }

    public static function estado_label($status)
    {
        $map = array(
            'pagado' => 'Pagado',
            'pendiente' => 'Pendiente',
            'anulado' => 'Anulado',
            'rechazado' => 'Rechazado',
            'reembolsado' => 'Reembolsado',
            'invalido' => 'Monto no coincide',
        );
        return isset($map[$status]) ? $map[$status] : $status;
    }

    private static function mask($value)
    {
        $value = (string) $value;
        if (strlen($value) <= 12) {
            return $value === '' ? '—' : str_repeat('•', strlen($value));
        }
        return substr($value, 0, 8) . str_repeat('•', 12) . substr($value, -4);
    }

    /* --------------------------------------------------------------- ajustes */

    public static function pagina_ajustes()
    {
        self::guard();
        $settings = JM_Payments::settings();
        $admin_emails = implode(', ', JM_Accounts::admin_emails());
        ?>
        <div class="wrap">
            <h1>Ajustes de Jardín Memorial</h1>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="max-width:760px;margin-top:18px">
                <?php wp_nonce_field('jm_admin_guardar'); ?>
                <input type="hidden" name="action" value="jm_admin_guardar">

                <h2>Cobros</h2>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="jm_mode">Pasarela</label></th>
                        <td>
                            <select name="mode" id="jm_mode">
                                <option value="demo" <?php selected($settings['mode'], 'demo'); ?>>Pasarela de prueba (sin cobros reales)</option>
                                <option value="mercadopago" <?php selected($settings['mode'], 'mercadopago'); ?>>Mercado Pago — Checkout Pro</option>
                            </select>
                            <p class="description">Con «Pasarela de prueba» se puede recorrer la compra completa sin dinero real.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="jm_mp_env">Ambiente</label></th>
                        <td>
                            <select name="mp_env" id="jm_mp_env">
                                <option value="sandbox" <?php selected($settings['mp_env'], 'sandbox'); ?>>Pruebas</option>
                                <option value="production" <?php selected($settings['mp_env'], 'production'); ?>>Producción</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="jm_mp_token">Access Token</label></th>
                        <td>
                            <input type="password" class="regular-text" id="jm_mp_token" name="mp_token" autocomplete="off"
                                   placeholder="<?php echo $settings['mp_token'] ? esc_attr('Guardado: ' . self::mask(JM_Payments::token())) : 'TEST-… o APP_USR-…'; ?>">
                            <p class="description">Se guarda cifrado. Déjalo vacío para conservar el actual. El de pruebas empieza con <code>TEST-</code> y el de producción con <code>APP_USR-</code>.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="jm_mp_secret">Secreto del webhook</label></th>
                        <td>
                            <input type="password" class="regular-text" id="jm_mp_secret" name="mp_secret" autocomplete="off"
                                   placeholder="<?php echo $settings['mp_secret'] ? 'Guardado' : 'Opcional pero recomendado'; ?>">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="jm_admin_emails">Correos administradores</label></th>
                        <td>
                            <input type="text" class="regular-text" id="jm_admin_emails" name="admin_emails" value="<?php echo esc_attr($admin_emails); ?>">
                            <p class="description">Además de los administradores de WordPress, estos correos pueden ver los pagos y generar enlaces de contraseña. Separados por coma.</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Guardar ajustes'); ?>
            </form>
        </div>
        <?php
    }

    public static function guardar_ajustes()
    {
        self::guard();
        check_admin_referer('jm_admin_guardar');

        $settings = JM_Payments::settings();
        $mode = isset($_POST['mode']) ? sanitize_key(wp_unslash($_POST['mode'])) : 'demo';
        $settings['mode'] = $mode === 'mercadopago' ? 'mercadopago' : 'demo';

        $env = isset($_POST['mp_env']) ? sanitize_key(wp_unslash($_POST['mp_env'])) : 'sandbox';
        $settings['mp_env'] = $env === 'production' ? 'production' : 'sandbox';

        if (!empty($_POST['mp_token'])) {
            $settings['mp_token'] = JM_Util::encrypt(sanitize_text_field(wp_unslash($_POST['mp_token'])));
        }
        if (!empty($_POST['mp_secret'])) {
            $settings['mp_secret'] = JM_Util::encrypt(sanitize_text_field(wp_unslash($_POST['mp_secret'])));
        }

        update_option('jm_settings', $settings);

        if (isset($_POST['admin_emails'])) {
            $emails = array_filter(array_map('sanitize_email', preg_split('/[\s,]+/', wp_unslash($_POST['admin_emails']))));
            update_option('jm_admin_emails', implode(',', $emails));
        }

        self::volver('jm-ajustes', array('guardado' => '1'));
    }

    /* ------------------------------------------------ verificar / reembolsar */

    public static function verificar()
    {
        self::guard();
        check_admin_referer('jm_admin_verificar');

        $reference = isset($_POST['reference']) ? sanitize_text_field(wp_unslash($_POST['reference'])) : '';
        $purchase = JM_Repo::find_purchase($reference);
        if (!$purchase) {
            self::volver('jm-pagos');
        }

        $result = JM_Payments::verify($purchase);
        if (is_wp_error($result)) {
            $notice = $result->get_error_message();
        } elseif (isset($result['status']) && $result['status'] === 'pagado') {
            $notice = 'Pago confirmado. Los cupos quedaron en la cuenta.';
        } else {
            $notice = 'La pasarela informa: ' . (isset($result['status']) ? $result['status'] : 'sin cambios') . '.';
        }

        set_transient('jm_admin_notice_' . get_current_user_id(), $notice, 60);
        self::volver('jm-pagos');
    }

    public static function reembolsar()
    {
        self::guard();
        check_admin_referer('jm_admin_reembolsar');

        $reference = isset($_POST['reference']) ? sanitize_text_field(wp_unslash($_POST['reference'])) : '';
        $purchase = JM_Repo::find_purchase($reference);
        if (!$purchase) {
            self::volver('jm-pagos');
        }

        $result = JM_Payments::refund($purchase);
        if (is_wp_error($result)) {
            $notice = 'No se pudo reembolsar: ' . $result->get_error_message();
        } else {
            $notice = 'Devolución hecha.';
            if (!empty($result['credits_removed'])) {
                $notice .= ' Se quitaron ' . (int) $result['credits_removed'] . ' cupos sin usar.';
            }
        }

        set_transient('jm_admin_notice_' . get_current_user_id(), $notice, 60);
        self::volver('jm-pagos');
    }

    /* ----------------------------------------------------------- correo/keys */

    public static function pagina_correo()
    {
        self::guard();
        $users = get_users(array('number' => 200, 'orderby' => 'registered', 'order' => 'DESC'));
        $enlace = get_transient('jm_admin_enlace_' . get_current_user_id());
        delete_transient('jm_admin_enlace_' . get_current_user_id());
        ?>
        <div class="wrap">
            <h1>Correo y claves</h1>

            <?php if ($enlace) : ?>
                <div class="notice notice-success">
                    <p><strong>Enlace para <?php echo esc_html($enlace['email']); ?></strong><br>
                    <code style="word-break:break-all"><?php echo esc_html($enlace['url']); ?></code><br>
                    <small>Sirve una sola vez. Envíalo a la persona por el medio que prefieras.</small></p>
                </div>
            <?php endif; ?>

            <p>WordPress envía los correos con su propia configuración. Si el hosting no envía correo, instala un plugin SMTP (por ejemplo <em>WP Mail SMTP</em>) o entrega el enlace a mano desde aquí.</p>

            <h2>Generar un enlace de recuperación</h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="max-width:620px">
                <?php wp_nonce_field('jm_admin_enlace'); ?>
                <input type="hidden" name="action" value="jm_admin_enlace">
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="jm_user">Cuenta</label></th>
                        <td>
                            <select name="user_id" id="jm_user" class="regular-text">
                                <?php foreach ($users as $user) : ?>
                                    <option value="<?php echo esc_attr($user->ID); ?>">
                                        <?php echo esc_html($user->display_name . ' · ' . $user->user_email); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Crear enlace'); ?>
            </form>

            <h2>Probar el correo</h2>
            <p>
                <a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=jm_admin_probar_correo'), 'jm_admin_probar')); ?>">Enviarme un correo de prueba</a>
                <span class="description">Se envía a <?php echo esc_html(wp_get_current_user()->user_email); ?>.</span>
            </p>
        </div>
        <?php
    }

    public static function crear_enlace()
    {
        self::guard();
        check_admin_referer('jm_admin_enlace');

        $user_id = isset($_POST['user_id']) ? (int) $_POST['user_id'] : 0;
        $user = get_user_by('id', $user_id);
        if (!$user) {
            self::volver('jm-correo');
        }

        $key = get_password_reset_key($user);
        if (is_wp_error($key)) {
            set_transient('jm_admin_notice_' . get_current_user_id(), 'No pudimos crear el enlace: ' . $key->get_error_message(), 60);
            self::volver('jm-correo');
        }

        $url = network_site_url('wp-login.php?action=rp&key=' . $key . '&login=' . rawurlencode($user->user_login), 'login');
        set_transient('jm_admin_enlace_' . get_current_user_id(), array('email' => $user->user_email, 'url' => $url), 120);
        self::volver('jm-correo');
    }

    public static function probar_correo()
    {
        self::guard();
        check_admin_referer('jm_admin_probar');
        $sent = wp_mail(
            wp_get_current_user()->user_email,
            'Prueba de correo · Jardín Memorial',
            'Si estás leyendo esto, WordPress puede enviar correo desde este sitio.'
        );
        set_transient(
            'jm_admin_notice_' . get_current_user_id(),
            $sent ? 'Correo de prueba enviado.' : 'No pudimos enviar el correo: revisa la configuración SMTP del sitio.',
            60
        );
        self::volver('jm-correo');
    }

    /* ------------------------------------------------------------ migración */

    public static function pagina_migracion()
    {
        self::guard();
        $resumen = get_transient('jm_migracion_' . get_current_user_id());
        delete_transient('jm_migracion_' . get_current_user_id());
        ?>
        <div class="wrap">
            <h1>Migrar desde la aplicación anterior</h1>

            <?php if (is_array($resumen)) : ?>
                <div class="notice notice-success">
                    <p><strong>Importación terminada.</strong></p>
                    <ul style="margin-left:18px">
                        <li>Cuentas nuevas: <?php echo (int) $resumen['usuarios_creados']; ?> (ya existían <?php echo (int) $resumen['usuarios_existentes']; ?>)</li>
                        <li>Memoriales: <?php echo (int) $resumen['memoriales']; ?> · Fotos: <?php echo (int) $resumen['fotos']; ?></li>
                        <li>Mensajes: <?php echo (int) $resumen['mensajes']; ?> · Velas: <?php echo (int) $resumen['velas']; ?> · Compras: <?php echo (int) $resumen['compras']; ?></li>
                    </ul>
                    <?php if (!empty($resumen['avisos'])) : ?>
                        <p><strong>Avisos:</strong></p>
                        <ul style="margin-left:18px">
                            <?php foreach ($resumen['avisos'] as $aviso) : ?>
                                <li><?php echo esc_html($aviso); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                </div>
            <?php endif; ?>

            <p>En la carpeta del proyecto ejecuta <code>npm run export-wordpress</code>: genera un ZIP con las cuentas, los memoriales, las fotos, los mensajes y las compras. Súbelo aquí y el plugin lo reparte en WordPress.</p>
            <p><strong>Las contraseñas no se pueden convertir</strong> (WordPress usa otro algoritmo). Cada cuenta se crea con una clave aleatoria: activa el envío de enlaces para que cada persona elija la suya, o entrégaselos desde <a href="<?php echo esc_url(admin_url('admin.php?page=jm-correo')); ?>">Correo y claves</a>.</p>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" enctype="multipart/form-data" style="max-width:640px;margin-top:18px">
                <?php wp_nonce_field('jm_admin_importar'); ?>
                <input type="hidden" name="action" value="jm_admin_importar">
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="jm_zip">Archivo ZIP</label></th>
                        <td><input type="file" id="jm_zip" name="archivo" accept=".zip" required></td>
                    </tr>
                    <tr>
                        <th scope="row">Correos</th>
                        <td>
                            <label><input type="checkbox" name="enviar_correos" value="1" checked> Enviar a cada persona un enlace para elegir su contraseña</label>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Importar'); ?>
            </form>
        </div>
        <?php
    }

    public static function importar()
    {
        self::guard();
        check_admin_referer('jm_admin_importar');

        $result = JM_Migrate::import_zip($_FILES['archivo'], array(
            'enviar_correos' => !empty($_POST['enviar_correos']),
        ));

        if (is_wp_error($result)) {
            set_transient('jm_admin_notice_' . get_current_user_id(), 'No pudimos importar: ' . $result->get_error_message(), 60);
            self::volver('jm-migracion');
        }

        set_transient('jm_migracion_' . get_current_user_id(), $result, 120);
        self::volver('jm-migracion');
    }
}
