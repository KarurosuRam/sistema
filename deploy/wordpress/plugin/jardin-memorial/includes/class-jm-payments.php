<?php
/**
 * Planes y cobros.
 *
 * Tres modos:
 *   - demo        → pasarela de prueba dentro del sitio, sin dinero real.
 *   - mercadopago → Checkout Pro: el comprador paga en Mercado Pago y los
 *                   cupos se acreditan solo cuando la API confirma el pago.
 *   - flow        → Flow: la orden se crea en Flow y el comprador paga en su
 *                   sitio. Los cupos se acreditan solo cuando getStatus
 *                   confirma la orden con el monto y la referencia correctos.
 *
 * La pasarela activa se elige en Ajustes y solo entra en vigor si tiene sus
 * credenciales; si no, el sitio sigue en modo demostración.
 *
 * No se usa el SDK: son dos llamadas HTTP (crear preferencia y consultar el
 * pago) que se hacen con la API de WordPress, así no hay dependencias que
 * instalar en el hosting.
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Payments
{
    const MP_API = 'https://api.mercadopago.com';

    public static function plans()
    {
        return array(
            'single' => array(
                'id' => 'single',
                'name' => 'Un memorial',
                'credits' => 1,
                'amount' => 6990,
                'description' => 'Un memorial digital para una persona o mascota.',
                'badge' => '',
            ),
            'pack4' => array(
                'id' => 'pack4',
                'name' => 'Pack familia',
                'credits' => 4,
                'amount' => 11990,
                'description' => 'Cuatro memoriales digitales para quienes quieras recordar.',
                'badge' => 'Más elegido',
            ),
        );
    }

    public static function plan($id)
    {
        $plans = self::plans();
        return isset($plans[$id]) ? $plans[$id] : null;
    }

    public static function settings()
    {
        return JM_Util::settings();
    }

    /** Pasarela realmente activa: demo · mercadopago · flow. */
    public static function mode()
    {
        $settings = self::settings();
        if ($settings['mode'] === 'mercadopago' && self::token() !== '') {
            return 'mercadopago';
        }
        if ($settings['mode'] === 'flow' && JM_Flow::configured()) {
            return 'flow';
        }
        return 'demo';
    }

    /** Pasarela elegida en Ajustes, exista o no credencial. */
    public static function requested_mode()
    {
        $settings = self::settings();
        return in_array($settings['mode'], array('demo', 'mercadopago', 'flow'), true)
            ? $settings['mode']
            : 'demo';
    }

    /** Nombre legible de la pasarela activa. */
    public static function mode_label($mode = null)
    {
        $mode = $mode ? $mode : self::mode();
        if ($mode === 'mercadopago') {
            return 'Mercado Pago';
        }
        if ($mode === 'flow') {
            return 'Flow';
        }
        return 'Pasarela de prueba';
    }

    public static function token()
    {
        $settings = self::settings();
        return trim(JM_Util::decrypt((string) $settings['mp_token']));
    }

    public static function webhook_secret()
    {
        $settings = self::settings();
        return trim(JM_Util::decrypt((string) $settings['mp_secret']));
    }

    public static function token_is_test()
    {
        return strpos(self::token(), 'TEST-') === 0;
    }

    public static function provider_name()
    {
        $mode = self::mode();
        return $mode === 'demo' ? 'la pasarela de prueba' : self::mode_label($mode);
    }

    /* ------------------------------------------------------------- compras */

    public static function start($user_id, $plan_id)
    {
        $plan = self::plan($plan_id);
        if (!$plan) {
            return new WP_Error('jm_plan', 'Ese plan no existe.');
        }

        // Flow exige URLs públicas HTTPS para notificar y volver; sin eso el
        // comprador pagaría y la compra nunca se acreditaría.
        if (self::mode() !== 'demo' && !is_ssl()) {
            return new WP_Error(
                'jm_https',
                'Los pagos reales necesitan HTTPS. Configura el certificado del dominio antes de cobrar.'
            );
        }

        $reference = JM_Util::reference();
        JM_Repo::insert_purchase(array(
            'user_id' => (int) $user_id,
            'plan' => $plan['id'],
            'plan_name' => $plan['name'],
            'amount' => (int) $plan['amount'],
            'credits' => (int) $plan['credits'],
            'reference' => $reference,
            'status' => 'pendiente',
            'mode' => self::mode(),
        ));

        $purchase = JM_Repo::find_purchase($reference);
        if (!$purchase) {
            return new WP_Error('jm_purchase', 'No pudimos registrar la compra.');
        }

        if (self::mode() === 'demo') {
            return array('purchase' => $purchase, 'url' => self::demo_url($purchase));
        }

        if (self::mode() === 'flow') {
            return self::start_flow($purchase);
        }

        $preference = self::create_preference($purchase);
        if (is_wp_error($preference)) {
            JM_Repo::update_purchase($reference, array('status' => 'anulado'));
            return $preference;
        }

        JM_Repo::update_purchase($reference, array('provider_order' => (string) $preference['id']));
        $purchase = JM_Repo::find_purchase($reference);

        return array('purchase' => $purchase, 'url' => $preference['init_point']);
    }

    /**
     * Crea la orden en Flow y devuelve la URL de pago.
     *
     * `urlConfirmation` es la notificación servidor a servidor y `urlReturn`
     * la vuelta del navegador; ambas tienen que ser HTTPS públicas para que
     * Flow las acepte.
     */
    private static function start_flow($purchase)
    {
        $user = get_user_by('id', (int) $purchase->user_id);

        $order = JM_Flow::create_payment(array(
            'commerceOrder' => $purchase->reference,
            'subject' => 'Jardín Memorial · ' . $purchase->plan_name,
            'amount' => (int) $purchase->amount,
            'email' => $user ? $user->user_email : '',
            'urlConfirmation' => add_query_arg(
                array('action' => 'jm_flow', 'jm_flow' => 'confirmar'),
                admin_url('admin-post.php')
            ),
            'urlReturn' => add_query_arg(
                array('action' => 'jm_flow', 'jm_flow' => 'retorno'),
                admin_url('admin-post.php')
            ),
            'optional' => array(
                'referencia' => $purchase->reference,
                'plan' => $purchase->plan,
                'cuenta' => (int) $purchase->user_id,
            ),
        ));

        if (is_wp_error($order)) {
            JM_Repo::update_purchase($purchase->reference, array('status' => 'anulado'));
            return $order;
        }

        JM_Repo::update_purchase($purchase->reference, array(
            'provider_token' => $order['token'],
            'provider_order' => $order['flowOrder'] !== '' ? $order['flowOrder'] : null,
        ));

        $purchase = JM_Repo::find_purchase($purchase->reference);

        return array(
            'purchase' => $purchase,
            'url' => JM_Flow::payment_url($order['url'], $order['token']),
        );
    }

    public static function demo_url($purchase)
    {
        return add_query_arg(
            array('jm_pago' => $purchase->reference, 'jm_nonce' => wp_create_nonce('jm_demo_' . $purchase->reference)),
            JM_Util::page_url('comprobante')
        );
    }

    public static function receipt_url($purchase)
    {
        return add_query_arg('ref', $purchase->reference, JM_Util::page_url('comprobante'));
    }

    /**
     * Crea la preferencia de Checkout Pro.
     * Devuelve array('id' => ..., 'init_point' => ...) o WP_Error.
     */
    public static function create_preference($purchase)
    {
        $user = get_user_by('id', (int) $purchase->user_id);
        $settings = self::settings();
        $base = home_url('/');

        $body = array(
            'items' => array(
                array(
                    'id' => $purchase->plan,
                    'title' => 'Jardín Memorial · ' . $purchase->plan_name,
                    'description' => 'Memoriales digitales en Jardín Memorial',
                    'quantity' => 1,
                    'currency_id' => 'CLP',
                    'unit_price' => (float) $purchase->amount,
                ),
            ),
            'payer' => array(
                'email' => $user ? $user->user_email : '',
                'name' => $user ? $user->display_name : '',
            ),
            'external_reference' => $purchase->reference,
            'statement_descriptor' => 'JARDIN MEMORIAL',
            'notification_url' => rest_url('jardin-memorial/v1/mp'),
            'back_urls' => array(
                'success' => self::receipt_url($purchase),
                'pending' => self::receipt_url($purchase),
                'failure' => self::receipt_url($purchase),
            ),
            // Con HTTPS, Mercado Pago vuelve solo; con HTTP el comprador debe
            // pulsar «volver al sitio».
            'auto_return' => is_ssl() ? 'approved' : 'all',
        );

        $response = self::request('/checkout/preferences', 'POST', $body);
        if (is_wp_error($response)) {
            return $response;
        }
        if (empty($response['id'])) {
            return new WP_Error('jm_mp', 'Mercado Pago no devolvió la preferencia de pago.');
        }
        if (empty($response['init_point'])) {
            return new WP_Error('jm_mp', 'Mercado Pago no devolvió la dirección de pago.');
        }

        return array(
            'id' => (string) $response['id'],
            'init_point' => (string) ($response['init_point'] ? $response['init_point'] : $response['sandbox_init_point']),
        );
    }

    /* --------------------------------------------------------------- Flow */

    /**
     * Sincroniza una compra con el estado real de su orden en Flow.
     *
     * Comprobaciones antes de acreditar:
     *   - el token existe en nuestra base y la compra está pendiente;
     *   - `commerceOrder` que informa Flow es la referencia de esa compra;
     *   - el monto y la moneda coinciden con el plan vendido.
     *
     * Es idempotente: la notificación de Flow y la vuelta del navegador pueden
     * llegar juntas y los cupos se acreditan una sola vez.
     */
    public static function sync_flow($token)
    {
        $token = trim((string) $token);
        if ($token === '') {
            return new WP_Error('jm_flow_token', 'No recibimos el token de Flow.');
        }

        $purchase = JM_Repo::find_purchase_by_token($token, 'flow');
        if (!$purchase) {
            return new WP_Error('jm_flow_missing', 'No encontramos la compra de este pago.');
        }

        if ($purchase->status === 'pagado') {
            return array('status' => 'pagado', 'already' => true, 'purchase' => $purchase);
        }
        if ($purchase->status === 'reembolsado') {
            return array('status' => 'reembolsado', 'already' => true, 'purchase' => $purchase);
        }

        $data = JM_Flow::get_status($token);
        if (is_wp_error($data)) {
            return $data;
        }

        $status = JM_Flow::normalize_status(isset($data['status']) ? $data['status'] : 0);
        $order = isset($data['commerceOrder']) ? (string) $data['commerceOrder'] : '';
        $amount = isset($data['amount']) ? (int) round((float) $data['amount']) : 0;
        $currency = isset($data['currency']) ? strtoupper((string) $data['currency']) : 'CLP';
        $flow_order = isset($data['flowOrder']) ? (string) $data['flowOrder'] : $purchase->provider_order;
        $payer = isset($data['payer']) ? (string) $data['payer'] : null;

        // La orden tiene que ser la nuestra y por el monto vendido.
        if ($status === 'pagado' && ($order !== (string) $purchase->reference || $amount !== (int) $purchase->amount || $currency !== 'CLP')) {
            JM_Repo::update_purchase($purchase->reference, array(
                'status' => 'invalido',
                'provider_order' => $flow_order ? $flow_order : $purchase->provider_order,
            ));
            return new WP_Error(
                'jm_flow_mismatch',
                'El pago no coincide con la orden registrada (monto, moneda o referencia).'
            );
        }

        if ($status === 'pagado') {
            JM_Repo::update_purchase($purchase->reference, array(
                'status' => 'pagado',
                'provider_order' => $flow_order ? $flow_order : $purchase->provider_order,
                'payer_email' => $payer,
                'paid_at' => current_time('mysql'),
            ));

            $fresh = JM_Repo::find_purchase($purchase->reference);
            if ($fresh && $fresh->status === 'pagado') {
                JM_Accounts::add_credits((int) $fresh->user_id, (int) $fresh->credits);
            }

            return array('status' => 'pagado', 'credited' => true, 'purchase' => $fresh);
        }

        // Rechazada o anulada: nunca acredita. Pendiente: se conserva tal cual.
        if (in_array($status, array('rechazado', 'anulado'), true) && $purchase->status === 'pendiente') {
            JM_Repo::update_purchase($purchase->reference, array(
                'status' => 'anulado',
                'provider_order' => $flow_order ? $flow_order : $purchase->provider_order,
            ));
        }

        return array(
            'status' => $status,
            'purchase' => JM_Repo::find_purchase($purchase->reference),
        );
    }

    /* ------------------------------------------------------------ webhook */

    /**
     * Valida la firma del webhook. Si no hay secreto configurado, se acepta la
     * notificación pero igual se consulta el pago real antes de acreditar.
     */
    public static function valid_signature($request)
    {
        $secret = self::webhook_secret();
        if ($secret === '') {
            return true;
        }

        $signature = (string) $request->get_header('x-signature');
        $request_id = (string) $request->get_header('x-request-id');
        if ($signature === '') {
            return false;
        }

        $ts = '';
        $v1 = '';
        foreach (explode(',', $signature) as $part) {
            $pair = explode('=', trim($part), 2);
            if (count($pair) !== 2) {
                continue;
            }
            if ($pair[0] === 'ts') {
                $ts = $pair[1];
            } elseif ($pair[0] === 'v1') {
                $v1 = $pair[1];
            }
        }
        if ($ts === '' || $v1 === '') {
            return false;
        }

        $data_id = (string) $request->get_param('data_id');
        if ($data_id === '') {
            $data = $request->get_json_params();
            if (is_array($data) && isset($data['data']['id'])) {
                $data_id = (string) $data['data']['id'];
            }
        }
        if ($data_id !== '' && !is_numeric($data_id)) {
            $data_id = strtolower($data_id);
        }

        $manifest = '';
        if ($data_id !== '') {
            $manifest .= 'id:' . $data_id . ';';
        }
        if ($request_id !== '') {
            $manifest .= 'request-id:' . $request_id . ';';
        }
        $manifest .= 'ts:' . $ts . ';';

        $expected = hash_hmac('sha256', $manifest, $secret);
        return hash_equals($expected, strtolower($v1));
    }

    /** Procesa una notificación: trae el pago y lo aplica. */
    public static function handle_notification($payment_id)
    {
        $payment = self::get_payment($payment_id);
        if (is_wp_error($payment)) {
            return $payment;
        }
        return self::apply_payment($payment);
    }

    public static function get_payment($payment_id)
    {
        return self::request('/v1/payments/' . rawurlencode((string) $payment_id), 'GET');
    }

    public static function search_payment($reference)
    {
        $result = self::request(
            '/v1/payments/search?external_reference=' . rawurlencode($reference) . '&sort=date_created&criteria=desc',
            'GET'
        );
        if (is_wp_error($result)) {
            return $result;
        }
        if (!empty($result['results'])) {
            return $result['results'][0];
        }
        return null;
    }

    /**
     * Aplica un pago a su compra. Es idempotente: dos notificaciones del mismo
     * pago acreditan una sola vez.
     */
    public static function apply_payment($payment)
    {
        if (!is_array($payment) || empty($payment['external_reference'])) {
            return new WP_Error('jm_mp_data', 'El pago no trae referencia.');
        }

        $purchase = JM_Repo::find_purchase($payment['external_reference']);
        if (!$purchase) {
            return new WP_Error('jm_mp_missing', 'No existe una compra con esa referencia.');
        }

        $status = isset($payment['status']) ? strtolower((string) $payment['status']) : '';

        // Devolución o contracargo sobre una compra ya pagada.
        if (in_array($status, array('refunded', 'charged_back'), true)) {
            return self::mark_refunded($purchase, isset($payment['id']) ? $payment['id'] : null);
        }

        if ($purchase->status === 'pagado') {
            return array('status' => 'pagado', 'already' => true, 'purchase' => $purchase);
        }
        if ($purchase->status === 'reembolsado') {
            return array('status' => 'reembolsado', 'already' => true, 'purchase' => $purchase);
        }

        if ($status !== 'approved') {
            if (in_array($status, array('rejected', 'cancelled'), true) && $purchase->status === 'pendiente') {
                JM_Repo::update_purchase($purchase->reference, array('status' => 'anulado'));
            }
            return array('status' => $status, 'purchase' => JM_Repo::find_purchase($purchase->reference));
        }

        // El monto tiene que coincidir: un pago alterado no acredita cupos.
        $amount = isset($payment['transaction_amount']) ? (float) $payment['transaction_amount'] : 0;
        if ($amount > 0 && (int) round($amount) !== (int) $purchase->amount) {
            JM_Repo::update_purchase($purchase->reference, array('status' => 'invalido'));
            return new WP_Error('jm_mp_amount', 'El monto pagado no coincide con la compra.');
        }

        JM_Repo::update_purchase($purchase->reference, array(
            'status' => 'pagado',
            'provider_order' => isset($payment['id']) ? (string) $payment['id'] : $purchase->provider_order,
            'payer_email' => isset($payment['payer']['email']) ? (string) $payment['payer']['email'] : null,
            'paid_at' => current_time('mysql'),
        ));

        $fresh = JM_Repo::find_purchase($purchase->reference);
        // El UPDATE condicional de arriba pudo no aplicar si otra petición ganó
        // la carrera: se acredita solo si esta petición dejó la compra pagada.
        if ($fresh && $fresh->status === 'pagado' && $purchase->status !== 'pagado') {
            JM_Accounts::add_credits((int) $fresh->user_id, (int) $fresh->credits);
        }

        return array('status' => 'pagado', 'credited' => true, 'purchase' => $fresh);
    }

    /** Consulta el estado real de una compra pendiente. */
    public static function verify($purchase)
    {
        if (!$purchase) {
            return new WP_Error('jm_purchase', 'No encontramos esa compra.');
        }
        if ($purchase->mode === 'flow') {
            return self::sync_flow($purchase->provider_token);
        }
        if ($purchase->mode !== 'mercadopago') {
            return new WP_Error('jm_purchase', 'Esta compra es de la pasarela de prueba.');
        }

        $payment = null;
        if (!empty($purchase->provider_order)) {
            $candidate = self::get_payment($purchase->provider_order);
            if (!is_wp_error($candidate) && !empty($candidate['id'])) {
                $payment = $candidate;
            }
        }
        if (!$payment) {
            $found = self::search_payment($purchase->reference);
            if (!is_wp_error($found)) {
                $payment = $found;
            }
        }

        if (!$payment) {
            return array('status' => $purchase->status, 'purchase' => $purchase, 'message' => 'La pasarela todavía no registra ese pago.');
        }

        return self::apply_payment($payment);
    }

    /** Devuelve el dinero en Mercado Pago y cierra la compra. */
    public static function refund($purchase)
    {
        if (!$purchase) {
            return new WP_Error('jm_purchase', 'No encontramos esa compra.');
        }
        if ($purchase->mode === 'flow') {
            return self::refund_flow($purchase);
        }
        if ($purchase->mode !== 'mercadopago') {
            return new WP_Error('jm_refund', 'Fue una compra de prueba: no hay dinero que devolver.');
        }
        if ($purchase->status === 'reembolsado') {
            return new WP_Error('jm_refund', 'Esta compra ya está reembolsada.');
        }
        if ($purchase->status !== 'pagado') {
            return new WP_Error('jm_refund', 'Solo se pueden devolver compras pagadas.');
        }
        if (empty($purchase->provider_order)) {
            return new WP_Error('jm_refund', 'Falta el número de pago. Usa «Verificar» primero.');
        }

        $refund = self::request('/v1/payments/' . rawurlencode($purchase->provider_order) . '/refunds', 'POST', array());
        if (is_wp_error($refund)) {
            return $refund;
        }

        return self::mark_refunded($purchase, isset($refund['id']) ? $refund['id'] : null);
    }

    /** Devuelve en Flow el dinero de una orden pagada. */
    private static function refund_flow($purchase)
    {
        if (empty($purchase->provider_token)) {
            return new WP_Error('jm_refund', 'Falta el token de Flow. Usa «Verificar» primero.');
        }
        if ($purchase->status === 'reembolsado') {
            return new WP_Error('jm_refund', 'Esta compra ya está reembolsada.');
        }
        if ($purchase->status !== 'pagado') {
            return new WP_Error('jm_refund', 'Solo se pueden devolver compras pagadas.');
        }

        $refund = JM_Flow::refund($purchase->provider_token, (int) $purchase->amount);
        if (is_wp_error($refund)) {
            return $refund;
        }

        return self::mark_refunded(
            $purchase,
            isset($refund['refundOrder']) ? (string) $refund['refundOrder'] : null
        );
    }

    /** Cierra una compra como devuelta y libera los cupos sin usar. */
    public static function mark_refunded($purchase, $refund_id = null)
    {
        if ($purchase->status === 'reembolsado') {
            return array('status' => 'reembolsado', 'already' => true, 'purchase' => $purchase, 'credits_removed' => 0);
        }

        $was_paid = $purchase->status === 'pagado';
        JM_Repo::update_purchase($purchase->reference, array(
            'status' => 'reembolsado',
            'refund_id' => $refund_id ? (string) $refund_id : $purchase->refund_id,
        ));

        $removed = 0;
        if ($was_paid) {
            $removed = JM_Accounts::refundable_credits((int) $purchase->user_id, (int) $purchase->credits);
            if ($removed > 0) {
                JM_Accounts::set_credits((int) $purchase->user_id, JM_Accounts::credits((int) $purchase->user_id) - $removed);
            }
        }

        return array(
            'status' => 'reembolsado',
            'purchase' => JM_Repo::find_purchase($purchase->reference),
            'credits_removed' => $removed,
        );
    }

    /* ---------------------------------------------------------------- API */

    private static function request($path, $method = 'GET', $body = null)
    {
        $token = self::token();
        if ($token === '') {
            return new WP_Error('jm_mp_token', 'Falta el Access Token de Mercado Pago.');
        }

        $args = array(
            'method' => $method,
            'timeout' => 25,
            'headers' => array(
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ),
        );
        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }

        $response = wp_remote_request(self::MP_API . $path, $args);
        if (is_wp_error($response)) {
            return new WP_Error('jm_mp_net', 'No pudimos conectar con Mercado Pago. Inténtalo en unos minutos.');
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        $data = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 400) {
            $message = 'Mercado Pago respondió con un error.';
            if (is_array($data) && !empty($data['message'])) {
                $message .= ' ' . $data['message'];
            }
            if (is_array($data) && !empty($data['cause'][0]['description'])) {
                $message .= ' ' . $data['cause'][0]['description'];
            }
            return new WP_Error('jm_mp_' . $code, $message);
        }

        return is_array($data) ? $data : array();
    }
}
