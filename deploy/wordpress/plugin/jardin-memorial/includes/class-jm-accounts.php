<?php
/**
 * Cuentas: registro, ingreso y cupos.
 *
 * Los usuarios son usuarios reales de WordPress (wp_users), así que la
 * contraseña, el correo de recuperación y las sesiones los maneja WordPress.
 * Lo único propio son los "cupos" (memoriales pagados sin usar), que viven en
 * el metadato jm_credits.
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Accounts
{
    const META_CREDITS = 'jm_credits';
    const META_PHONE = 'jm_phone';

    public static function credits($user_id = null)
    {
        $user_id = $user_id ? (int) $user_id : get_current_user_id();
        if (!$user_id) {
            return 0;
        }
        return max(0, (int) get_user_meta($user_id, self::META_CREDITS, true));
    }

    public static function set_credits($user_id, $value)
    {
        update_user_meta((int) $user_id, self::META_CREDITS, max(0, (int) $value));
    }

    public static function add_credits($user_id, $amount)
    {
        $amount = (int) $amount;
        if ($amount <= 0) {
            return self::credits($user_id);
        }
        $total = self::credits($user_id) + $amount;
        self::set_credits($user_id, $total);
        return $total;
    }

    /**
     * Gasta un cupo. Devuelve true solo si había uno disponible; el UPDATE
     * condicional evita que dos peticiones simultáneas gasten el mismo cupo.
     */
    public static function consume_credit($user_id = null)
    {
        $user_id = $user_id ? (int) $user_id : get_current_user_id();
        if (!$user_id) {
            return false;
        }
        global $wpdb;
        $meta_id = $wpdb->get_var($wpdb->prepare(
            "SELECT umeta_id FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key = %s LIMIT 1",
            $user_id,
            self::META_CREDITS
        ));

        if (!$meta_id) {
            return false;
        }

        $updated = $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->usermeta} SET meta_value = meta_value - 1 WHERE umeta_id = %d AND CAST(meta_value AS SIGNED) > 0",
            $meta_id
        ));

        if (!$updated) {
            return false;
        }
        clean_user_cache($user_id);
        return true;
    }

    /** Cupos que quedan de una compra concreta: nunca más que los sin usar. */
    public static function refundable_credits($user_id, $credits)
    {
        return min((int) $credits, self::credits($user_id));
    }

    /* ------------------------------------------------------------ registro */

    /**
     * Crea la cuenta. Devuelve el ID o un WP_Error con los mensajes para el
     * formulario.
     */
    public static function register($input)
    {
        $name = isset($input['name']) ? trim(wp_strip_all_tags((string) $input['name'])) : '';
        $email = isset($input['email']) ? sanitize_email((string) $input['email']) : '';
        $password = isset($input['password']) ? (string) $input['password'] : '';
        $confirm = isset($input['password_confirm']) ? (string) $input['password_confirm'] : '';
        $trap = isset($input['jm_hp']) ? trim((string) $input['jm_hp']) : '';
        $terms = !empty($input['terms']);

        $errors = array();
        if (mb_strlen($name) < 2) {
            $errors[] = 'Escribe tu nombre completo.';
        }
        if (!is_email($email)) {
            $errors[] = 'Ingresa un correo electrónico válido.';
        }
        if (strlen($password) < 8) {
            $errors[] = 'La contraseña debe tener al menos 8 caracteres.';
        }
        if ($password !== $confirm) {
            $errors[] = 'Las contraseñas no coinciden.';
        }
        if ($trap !== '') {
            $errors[] = 'No pudimos validar el formulario.';
        }
        if (!$terms) {
            $errors[] = 'Necesitamos que aceptes el tratamiento de tus datos para crear la cuenta.';
        }
        if ($errors) {
            return new WP_Error('jm_validation', implode(' ', $errors), array('errors' => $errors));
        }

        if (email_exists($email)) {
            return new WP_Error(
                'jm_exists',
                'Ese correo ya tiene una cuenta. Ingresa con tu contraseña o usa «¿Olvidaste tu contraseña?».'
            );
        }

        $user_id = wp_create_user($email, $password, $email);
        if (is_wp_error($user_id)) {
            return new WP_Error('jm_create', 'No pudimos crear la cuenta: ' . $user_id->get_error_message());
        }

        wp_update_user(array(
            'ID' => $user_id,
            'display_name' => $name,
            'first_name' => $name,
            'role' => 'subscriber',
        ));
        self::set_credits($user_id, 0);

        $site = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);
        wp_mail(
            $email,
            sprintf('Tu cuenta en %s', $site),
            sprintf(
                "Hola %s:\n\nCreamos tu cuenta en %s con este correo.\n\nPara elegir tus memoriales entra en %s\n\nSi no fuiste tú, ignora este mensaje.\n\n— %s",
                $name,
                $site,
                JM_Util::page_url('planes'),
                $site
            )
        );

        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, true);
        do_action('wp_login', $email, get_user_by('id', $user_id));

        return $user_id;
    }

    /* -------------------------------------------------------------- ingreso */

    /** Ingresa con correo y contraseña. Devuelve true o WP_Error. */
    public static function login($input)
    {
        $email = isset($input['email']) ? sanitize_email((string) $input['email']) : '';
        $password = isset($input['password']) ? (string) $input['password'] : '';
        $remember = !empty($input['remember']);

        if (!$email || !$password) {
            return new WP_Error('jm_login_empty', 'Ingresa tu correo y tu contraseña.');
        }

        $bucket = 'login';
        if (!JM_Repo::rate_hit($bucket, JM_Util::ip_hash(), 10, 15 * MINUTE_IN_SECONDS)) {
            return new WP_Error(
                'jm_login_limit',
                'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.'
            );
        }

        $user = wp_signon(array(
            'user_login' => $email,
            'user_password' => $password,
            'remember' => $remember,
        ), is_ssl());

        if (is_wp_error($user)) {
            return new WP_Error(
                'jm_login_failed',
                'El correo o la contraseña no coinciden. Revísalos e inténtalo otra vez.'
            );
        }

        wp_set_current_user($user->ID);
        return true;
    }

    /* ------------------------------------------------- recuperar contraseña */

    /**
     * Envía el correo de recuperación con el mecanismo de WordPress.
     * La respuesta al visitante es siempre la misma para no revelar si el
     * correo existe.
     */
    public static function request_reset($email)
    {
        $email = sanitize_email((string) $email);
        if (!is_email($email)) {
            return false;
        }

        if (!JM_Repo::rate_hit('recuperar', JM_Util::ip_hash(), 8, 30 * MINUTE_IN_SECONDS)) {
            return false;
        }

        $user = get_user_by('email', $email);
        if ($user) {
            retrieve_password($user->user_login);
        }
        return true;
    }

    /* -------------------------------------------------------------- permisos */

    public static function admin_emails()
    {
        $raw = isset($_ENV['JM_ADMIN_EMAILS']) ? $_ENV['JM_ADMIN_EMAILS'] : '';
        if (defined('JM_ADMIN_EMAILS')) {
            $raw = JM_ADMIN_EMAILS;
        }
        $raw = (string) get_option('jm_admin_emails', $raw);
        $list = preg_split('/[\s,]+/', strtolower($raw), -1, PREG_SPLIT_NO_EMPTY);
        return $list ? $list : array();
    }

    public static function is_admin_user($user = null)
    {
        $user = $user ? $user : wp_get_current_user();
        if (!$user || !$user->ID) {
            return false;
        }
        if (user_can($user, 'manage_options')) {
            return true;
        }
        $email = strtolower((string) $user->user_email);
        return in_array($email, self::admin_emails(), true);
    }

    public static function require_login($redirect = '')
    {
        if (is_user_logged_in()) {
            return true;
        }
        $target = $redirect ? $redirect : JM_Util::page_url('panel');
        wp_safe_redirect(add_query_arg('redirect_to', rawurlencode($target), JM_Util::page_url('ingresar')));
        exit;
    }
}
