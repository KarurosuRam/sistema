<?php
/**
 * Utilidades sin estado: formato, slugs, fechas y mensajes.
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Util
{
    /** "Rosa Elena Muñoz" → "rosa-elena-munoz" (sin tildes ni signos). */
    public static function slugify($value)
    {
        $value = (string) $value;
        if (function_exists('remove_accents')) {
            $value = remove_accents($value);
        }
        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value);
        $value = trim((string) $value, '-');
        return substr($value, 0, 80);
    }

    public static function random_code($length = 4)
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $out = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        return $out;
    }

    public static function reference()
    {
        return 'JM-' . strtoupper(base_convert((string) time(), 10, 36)) . '-' . self::random_code(4);
    }

    public static function certificate_code()
    {
        return 'JM-' . date('Y') . '-' . self::random_code(5);
    }

    /** 6990 → "$6.990" (peso chileno, sin decimales). */
    public static function clp($amount)
    {
        return '$' . number_format((int) $amount, 0, ',', '.');
    }

    /** Fecha ISO de MySQL → "12 de marzo de 2024". */
    public static function long_date($value)
    {
        if (!$value || $value === '0000-00-00') {
            return '';
        }
        $timestamp = strtotime($value);
        if (!$timestamp) {
            return '';
        }
        $meses = array(
            1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril', 5 => 'mayo', 6 => 'junio',
            7 => 'julio', 8 => 'agosto', 9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre',
        );
        return (int) date('j', $timestamp) . ' de ' . $meses[(int) date('n', $timestamp)] . ' de ' . date('Y', $timestamp);
    }

    /** "12 mar 2024" para tablas y fichas. */
    public static function short_date($value)
    {
        if (!$value) {
            return '';
        }
        $timestamp = strtotime($value);
        if (!$timestamp) {
            return '';
        }
        $meses = array('ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic');
        return date('j', $timestamp) . ' ' . $meses[(int) date('n', $timestamp) - 1] . ' ' . date('Y', $timestamp);
    }

    public static function datetime($value)
    {
        if (!$value) {
            return '';
        }
        $timestamp = strtotime($value);
        return $timestamp ? date_i18n('j M Y, H:i', $timestamp) : '';
    }

    /** Fecha de nacimiento / fallecimiento como texto corto con años. */
    public static function life_range($memorial)
    {
        $birth = $memorial->birth_date ? (int) date('Y', strtotime($memorial->birth_date)) : 0;
        $death = $memorial->death_date ? (int) date('Y', strtotime($memorial->death_date)) : 0;
        if ($birth && $death) {
            return $birth . ' — ' . $death;
        }
        if ($birth) {
            return 'Desde ' . $birth;
        }
        if ($death) {
            return 'Hasta ' . $death;
        }
        return '';
    }

    /** Edad cumplida entre dos fechas (para la ficha del memorial). */
    public static function age($birth, $death)
    {
        if (!$birth || !$death) {
            return 0;
        }
        try {
            $a = new DateTime($birth);
            $b = new DateTime($death);
            return max(0, $a->diff($b)->y);
        } catch (Exception $e) {
            return 0;
        }
    }

    /** md5 de la IP con la sal del sitio: se guarda el hash, nunca la IP. */
    public static function ip_hash()
    {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
        return hash('sha256', $ip . '|' . wp_salt('auth'));
    }

    /** Texto plano recortado, sin romper palabras ni etiquetas. */
    public static function excerpt($text, $words = 40)
    {
        $text = trim(preg_replace('/\s+/', ' ', wp_strip_all_tags((string) $text)));
        if ($text === '') {
            return '';
        }
        return wp_trim_words($text, $words, '…');
    }

    /** URL de una página del plugin creada en la activación. */
    public static function page_url($key, $args = array())
    {
        $pages = get_option('jm_pages', array());
        $id = isset($pages[$key]) ? (int) $pages[$key] : 0;
        $base = $id ? get_permalink($id) : home_url('/');
        if (!$base) {
            $base = home_url('/');
        }
        return $args ? add_query_arg($args, $base) : $base;
    }

    public static function memorial_url($memorial)
    {
        return home_url('/m/' . $memorial->slug);
    }

    public static function is_owner($memorial, $user_id = null)
    {
        $user_id = $user_id ? (int) $user_id : get_current_user_id();
        return $user_id && (int) $memorial->user_id === $user_id;
    }

    /** Aviso flash entre una petición y la redirección siguiente. */
    public static function flash($type, $message)
    {
        $queue = get_transient('jm_flash_' . get_current_user_id());
        $queue = is_array($queue) ? $queue : array();
        $queue[] = array('type' => $type, 'message' => $message);
        set_transient('jm_flash_' . get_current_user_id(), $queue, 60);
    }

    public static function take_flash()
    {
        $key = 'jm_flash_' . get_current_user_id();
        $queue = get_transient($key);
        if (!is_array($queue)) {
            return array();
        }
        delete_transient($key);
        return $queue;
    }

    /** Error de validación que no debe perderse: se guarda con la sesión. */
    public static function remember($data)
    {
        set_transient('jm_form_' . get_current_user_id(), $data, 60);
    }

    public static function recall()
    {
        $key = 'jm_form_' . get_current_user_id();
        $data = get_transient($key);
        delete_transient($key);
        return is_array($data) ? $data : array();
    }

    public static function settings()
    {
        $defaults = array(
            'mode' => 'demo',
            'mp_env' => 'sandbox',
            'mp_token' => '',
            'mp_secret' => '',
            'notice' => '',
        );
        return wp_parse_args((array) get_option('jm_settings', array()), $defaults);
    }

    /** Cifra/descifra credenciales con las claves del sitio. */
    public static function encrypt($value)
    {
        if ($value === '') {
            return '';
        }
        $key = hash('sha256', wp_salt('auth') . '|jm', true);
        $iv = random_bytes(12);
        $cipher = openssl_encrypt((string) $value, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            return '';
        }
        return 'v1:' . base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt($value)
    {
        $value = (string) $value;
        if (strpos($value, 'v1:') !== 0) {
            return '';
        }
        $raw = base64_decode(substr($value, 3), true);
        if ($raw === false || strlen($raw) < 29) {
            return '';
        }
        $key = hash('sha256', wp_salt('auth') . '|jm', true);
        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $cipher = substr($raw, 28);
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        return $plain === false ? '' : $plain;
    }
}
