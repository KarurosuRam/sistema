<?php
/**
 * Cliente de Flow (https://www.flow.cl) para WordPress.
 *
 * Port de `src/flow.js` de la app Node a la API HTTP de WordPress: no hay SDK
 * ni Composer, así que se usa `wp_remote_request`, que ya trae reintentos y
 * respeta los proxies del hosting.
 *
 * Firma de Flow: los parámetros se ordenan alfabéticamente, se concatenan como
 * `nombrevalor` y se firman con HMAC-SHA256 en hexadecimal. El resultado viaja
 * en `s`.
 *
 * Solo se usan los tres servicios de una compra puntual:
 *   - payment/create                → crea la orden y devuelve url + token
 *   - payment/getStatus             → confirma el estado real de la orden
 *   - payment/refund (opcional)     → devuelve el dinero de una orden pagada
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Flow
{
    const SANDBOX_API = 'https://sandbox.flow.cl/api';
    const PRODUCTION_API = 'https://www.flow.cl/api';
    const SANDBOX_PAY = 'https://sandbox.flow.cl/app/web/pay.php';
    const PRODUCTION_PAY = 'https://www.flow.cl/app/web/pay.php';

    /** ¿Hay llaves guardadas? */
    public static function configured()
    {
        $settings = JM_Util::settings();
        return trim(JM_Util::decrypt((string) $settings['flow_key'])) !== ''
            && trim(JM_Util::decrypt((string) $settings['flow_secret'])) !== '';
    }

    public static function api_key()
    {
        $settings = JM_Util::settings();
        return trim(JM_Util::decrypt((string) $settings['flow_key']));
    }

    public static function secret_key()
    {
        $settings = JM_Util::settings();
        return trim(JM_Util::decrypt((string) $settings['flow_secret']));
    }

    public static function environment()
    {
        $settings = JM_Util::settings();
        return $settings['flow_env'] === 'production' ? 'production' : 'sandbox';
    }

    public static function base_url()
    {
        return self::environment() === 'production' ? self::PRODUCTION_API : self::SANDBOX_API;
    }

    public static function pay_url()
    {
        return self::environment() === 'production' ? self::PRODUCTION_PAY : self::SANDBOX_PAY;
    }

    /* ------------------------------------------------------------- firma */

    /**
     * Firma de Flow: claves ordenadas, `key + value` concatenados, HMAC-SHA256
     * hexadecimal con la llave secreta.
     */
    public static function sign($params, $secret)
    {
        $keys = array();
        foreach ((array) $params as $key => $value) {
            if ($key === 's' || $value === null || $value === '') {
                continue;
            }
            $keys[] = $key;
        }
        sort($keys, SORT_STRING);

        $payload = '';
        foreach ($keys as $key) {
            $payload .= $key . $params[$key];
        }

        return hash_hmac('sha256', $payload, $secret);
    }

    /* --------------------------------------------------------------- API */

    /**
     * Llama a un servicio de Flow.
     *
     * @param string     $service Ruta, por ejemplo '/payment/create'.
     * @param array      $params  Parámetros sin `apiKey` ni `s`.
     * @param string     $method  'POST' (formulario) o 'GET' (query string).
     * @return array|WP_Error JSON decodificado o error con mensaje legible.
     */
    public static function call($service, $params = array(), $method = 'POST')
    {
        if (!self::configured()) {
            return new WP_Error(
                'jm_flow_config',
                'Flow no está configurado: faltan la API Key y la Secret Key.'
            );
        }

        $payload = array('apiKey' => self::api_key());
        foreach ((array) $params as $key => $value) {
            if ($value !== null && $value !== '') {
                $payload[$key] = $value;
            }
        }
        $payload['s'] = self::sign($payload, self::secret_key());

        $url = self::base_url() . $service;
        $args = array(
            'timeout' => 25,
            'headers' => array('Accept' => 'application/json'),
        );

        if (strtoupper($method) === 'GET') {
            $url = add_query_arg(array_map('rawurlencode', $payload), $url);
        } else {
            $args['method'] = 'POST';
            $args['body'] = $payload;
        }

        $response = wp_remote_request($url, $args);
        if (is_wp_error($response)) {
            return new WP_Error(
                'jm_flow_net',
                'No pudimos conectar con Flow. Inténtalo en unos minutos.'
            );
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        $raw = wp_remote_retrieve_body($response);
        $data = $raw ? json_decode($raw, true) : null;

        if ($code >= 400) {
            $detail = '';
            if (is_array($data)) {
                if (!empty($data['message'])) {
                    $detail = (string) $data['message'];
                } elseif (!empty($data['error'])) {
                    $detail = (string) $data['error'];
                } elseif (!empty($data['comment'])) {
                    $detail = (string) $data['comment'];
                }
            }
            if ($detail === '') {
                $detail = sprintf('Flow respondió %d.', $code);
            }
            return new WP_Error('jm_flow_' . $code, $detail);
        }

        if (!is_array($data)) {
            return new WP_Error('jm_flow_empty', 'Flow devolvió una respuesta vacía.');
        }

        return $data;
    }

    /**
     * Crea una orden. Devuelve array('url' => ..., 'token' => ..., 'flowOrder' => ...).
     *
     * @param array $args commerceOrder, subject, amount, email, urlConfirmation, urlReturn.
     */
    public static function create_payment($args)
    {
        $args = wp_parse_args($args, array(
            'currency' => 'CLP',
            'paymentMethod' => 9,
            'timeout' => 3600,
        ));

        $params = array(
            'commerceOrder' => $args['commerceOrder'],
            'subject' => $args['subject'],
            'currency' => $args['currency'],
            'amount' => (int) round($args['amount']),
            'email' => $args['email'],
            'paymentMethod' => (int) $args['paymentMethod'],
            'urlConfirmation' => $args['urlConfirmation'],
            'urlReturn' => $args['urlReturn'],
            'timeout' => (int) $args['timeout'],
        );
        if (!empty($args['optional'])) {
            $params['optional'] = wp_json_encode($args['optional']);
        }

        $data = self::call('/payment/create', $params, 'POST');
        if (is_wp_error($data)) {
            return $data;
        }
        if (empty($data['url']) || empty($data['token'])) {
            return new WP_Error('jm_flow_create', 'Flow no devolvió la dirección de pago.');
        }

        return array(
            'url' => (string) $data['url'],
            'token' => (string) $data['token'],
            'flowOrder' => isset($data['flowOrder']) ? (string) $data['flowOrder'] : '',
        );
    }

    /** Estado real de una orden. status: 1 pendiente · 2 pagada · 3 rechazada · 4 anulada. */
    public static function get_status($token)
    {
        if (!$token) {
            return new WP_Error('jm_flow_token', 'Falta el token de la orden.');
        }
        return self::call('/payment/getStatus', array('token' => $token), 'GET');
    }

    /** Devuelve el dinero de una orden pagada. */
    public static function refund($token, $amount = null)
    {
        $params = array('token' => $token);
        if ($amount !== null) {
            $params['amount'] = (int) round($amount);
        }
        return self::call('/payment/refund', $params, 'POST');
    }

    /** URL de pago: Flow entrega la base y el token por separado. */
    public static function payment_url($url, $token)
    {
        $base = (string) $url;
        if ($base === '') {
            $base = self::pay_url();
        }
        $base = rtrim($base, '?');

        return $base . (strpos($base, '?') === false ? '?' : '&') . 'token=' . rawurlencode($token);
    }

    /** Traduce el estado numérico de Flow a los estados internos. */
    public static function normalize_status($status)
    {
        $value = (int) $status;
        if ($value === 2) {
            return 'pagado';
        }
        if ($value === 3) {
            return 'rechazado';
        }
        if ($value === 4) {
            return 'anulado';
        }
        return 'pendiente';
    }
}
