<?php
/**
 * Formularios. Todo pasa por admin-post.php con nonce: ninguna acción cambia
 * datos por GET.
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Actions
{
    public static function init()
    {
        $handlers = array(
            'jm_registro' => 'registro',
            'jm_ingresar' => 'ingresar',
            'jm_recuperar' => 'recuperar',
            'jm_crear_memorial' => 'crear_memorial',
            'jm_editar_memorial' => 'editar_memorial',
            'jm_subir_foto' => 'subir_foto',
            'jm_borrar_foto' => 'borrar_foto',
            'jm_mover_foto' => 'mover_foto',
            'jm_portada' => 'portada',
            'jm_subir_musica' => 'subir_musica',
            'jm_quitar_musica' => 'quitar_musica',
            'jm_subir_video' => 'subir_video',
            'jm_quitar_video' => 'quitar_video',
            'jm_borrar_memorial' => 'borrar_memorial',
            'jm_mensaje' => 'mensaje',
            'jm_vela' => 'vela',
            'jm_ocultar_mensaje' => 'ocultar_mensaje',
            'jm_borrar_mensaje' => 'borrar_mensaje',
            'jm_comprar' => 'comprar',
            'jm_demo_aprobar' => 'demo_aprobar',
            'jm_demo_cancelar' => 'demo_cancelar',
            'jm_verificar_compra' => 'verificar_compra',
        );

        foreach ($handlers as $action => $method) {
            add_action('admin_post_' . $action, array(__CLASS__, $method));
            add_action('admin_post_nopriv_' . $action, array(__CLASS__, $method));
        }

        add_action('admin_post_nopriv_jm_salir', array(__CLASS__, 'salir'));
        add_action('admin_post_jm_salir', array(__CLASS__, 'salir'));
    }

    /* ---------------------------------------------------------------- utils */

    private static function back($url, $fallback = '')
    {
        $url = $url ? $url : ($fallback ? $fallback : home_url('/'));
        wp_safe_redirect($url);
        exit;
    }

    private static function memorial_from_request($key = 'memorial_id')
    {
        $id = isset($_REQUEST[$key]) ? (int) $_REQUEST[$key] : 0;
        $memorial = $id ? JM_Repo::find_memorial($id) : null;
        if (!$memorial || !JM_Util::is_owner($memorial)) {
            wp_die('Ese memorial no existe o no es tuyo.', 'Memorial no disponible', array('response' => 404));
        }
        return $memorial;
    }

    private static function edit_url($memorial, $tab = '')
    {
        $args = array('m' => (int) $memorial->id);
        if ($tab) {
            $args['tab'] = $tab;
        }
        return add_query_arg($args, JM_Util::page_url('panel'));
    }

    /* ----------------------------------------------------------- cuentas */

    public static function registro()
    {
        check_admin_referer('jm_registro');
        if (!isset($_POST['jm_registro_nonce'])) {
            wp_die('Falta el formulario.');
        }

        $result = JM_Accounts::register(wp_unslash($_POST));
        if (is_wp_error($result)) {
            JM_Util::remember(array(
                'errors' => array($result->get_error_message()),
                'values' => array(
                    'name' => isset($_POST['name']) ? sanitize_text_field(wp_unslash($_POST['name'])) : '',
                    'email' => isset($_POST['email']) ? sanitize_email(wp_unslash($_POST['email'])) : '',
                ),
            ));
            self::back(JM_Util::page_url('registro'));
        }

        JM_Util::flash('success', 'Tu cuenta está creada. Bienvenido a Jardín Memorial.');
        self::back(JM_Util::page_url('panel'));
    }

    public static function ingresar()
    {
        check_admin_referer('jm_ingresar');
        $redirect = isset($_POST['redirect_to']) ? esc_url_raw(wp_unslash($_POST['redirect_to'])) : JM_Util::page_url('panel');

        $result = JM_Accounts::login(wp_unslash($_POST));
        if (is_wp_error($result)) {
            JM_Util::remember(array(
                'errors' => array($result->get_error_message()),
                'values' => array('email' => isset($_POST['email']) ? sanitize_email(wp_unslash($_POST['email'])) : ''),
            ));
            self::back(add_query_arg('redirect_to', rawurlencode($redirect), JM_Util::page_url('ingresar')));
        }

        self::back($redirect, JM_Util::page_url('panel'));
    }

    public static function salir()
    {
        check_admin_referer('jm_salir');
        wp_logout();
        self::back(home_url('/'));
    }

    public static function recuperar()
    {
        check_admin_referer('jm_recuperar');
        $email = isset($_POST['email']) ? sanitize_email(wp_unslash($_POST['email'])) : '';
        JM_Accounts::request_reset($email);
        self::back(add_query_arg('enviado', '1', JM_Util::page_url('recuperar')));
    }

    /* --------------------------------------------------------- memoriales */

    public static function crear_memorial()
    {
        check_admin_referer('jm_crear_memorial');
        if (!is_user_logged_in()) {
            self::back(JM_Util::page_url('ingresar'));
        }
        if (JM_Accounts::credits() < 1) {
            JM_Util::flash('error', 'No tienes memoriales disponibles. Elige un plan para continuar.');
            self::back(JM_Util::page_url('planes'));
        }

        $data = self::validate_memorial($_POST);
        if (is_wp_error($data)) {
            JM_Util::remember(array(
                'errors' => array($data->get_error_message()),
                'values' => wp_unslash($_POST),
            ));
            self::back(add_query_arg('nuevo', '1', JM_Util::page_url('panel')));
        }

        if (!JM_Accounts::consume_credit()) {
            JM_Util::flash('error', 'No tienes memoriales disponibles. Elige un plan para continuar.');
            self::back(JM_Util::page_url('planes'));
        }

        $data['user_id'] = get_current_user_id();
        $data['slug'] = JM_Repo::unique_slug($data['full_name']);
        $data['certificate_code'] = JM_Util::certificate_code();
        $memorial_id = JM_Repo::insert_memorial($data);

        if (isset($_FILES['main_photo']) && !empty($_FILES['main_photo']['tmp_name'])) {
            $attachment = JM_Media::upload($_FILES['main_photo'], 'photo', $memorial_id);
            if (!is_wp_error($attachment)) {
                JM_Repo::update_memorial($memorial_id, array('cover_id' => (int) $attachment));
            }
        }

        JM_Util::flash('success', 'Tu memorial está creado. Ya puedes compartir el enlace.');
        $memorial = JM_Repo::find_memorial($memorial_id);
        self::back(self::edit_url($memorial));
    }

    public static function editar_memorial()
    {
        check_admin_referer('jm_editar_memorial');
        $memorial = self::memorial_from_request();

        $data = self::validate_memorial($_POST, true);
        if (is_wp_error($data)) {
            JM_Util::flash('error', $data->get_error_message());
            self::back(self::edit_url($memorial));
        }

        JM_Repo::update_memorial($memorial->id, $data);

        if (isset($_FILES['main_photo']) && !empty($_FILES['main_photo']['tmp_name'])) {
            $attachment = JM_Media::upload($_FILES['main_photo'], 'photo', $memorial->id);
            if (is_wp_error($attachment)) {
                JM_Util::flash('error', $attachment->get_error_message());
            } else {
                JM_Repo::update_memorial($memorial->id, array('cover_id' => (int) $attachment));
            }
        }

        JM_Util::flash('success', 'Guardamos los cambios del memorial.');
        self::back(self::edit_url($memorial));
    }

    /** Reglas compartidas por crear y editar. */
    private static function validate_memorial($input, $editing = false)
    {
        $name = isset($input['full_name']) ? trim(sanitize_text_field(wp_unslash($input['full_name']))) : '';
        if (mb_strlen($name) < 2) {
            return new WP_Error('jm_name', 'Escribe el nombre de la persona o mascota.');
        }
        if (mb_strlen($name) > 120) {
            return new WP_Error('jm_name', 'El nombre es demasiado largo.');
        }

        $birth = isset($input['birth_date']) ? sanitize_text_field(wp_unslash($input['birth_date'])) : '';
        $death = isset($input['death_date']) ? sanitize_text_field(wp_unslash($input['death_date'])) : '';
        foreach (array($birth, $death) as $date) {
            if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                return new WP_Error('jm_date', 'Las fechas deben tener el formato año-mes-día.');
            }
        }
        if ($birth !== '' && $death !== '' && $birth > $death) {
            return new WP_Error('jm_date', 'La fecha de nacimiento no puede ser posterior a la del fallecimiento.');
        }

        $epitaph = isset($input['epitaph']) ? sanitize_text_field(wp_unslash($input['epitaph'])) : '';
        if (mb_strlen($epitaph) > 200) {
            return new WP_Error('jm_epitaph', 'La dedicatoria puede tener hasta 200 caracteres.');
        }

        $biography = isset($input['biography']) ? sanitize_textarea_field(wp_unslash($input['biography'])) : '';
        if (mb_strlen($biography) > 5000) {
            return new WP_Error('jm_bio', 'La biografía es demasiado larga.');
        }

        $themes = array('jardin', 'bosque', 'cielo', 'arena', 'noche');
        $theme = isset($input['theme']) ? sanitize_key(wp_unslash($input['theme'])) : 'jardin';

        return array(
            'kind' => isset($input['kind']) && $input['kind'] === 'mascota' ? 'mascota' : 'persona',
            'full_name' => $name,
            'relationship' => isset($input['relationship']) ? mb_substr(sanitize_text_field(wp_unslash($input['relationship'])), 0, 80) : '',
            'birth_date' => $birth !== '' ? $birth : null,
            'death_date' => $death !== '' ? $death : null,
            'epitaph' => $epitaph,
            'biography' => $biography,
            'theme' => in_array($theme, $themes, true) ? $theme : 'jardin',
            'is_public' => !empty($input['is_public']) ? 1 : 0,
            'allow_guestbook' => !empty($input['allow_guestbook']) ? 1 : 0,
        );
    }

    public static function borrar_memorial()
    {
        check_admin_referer('jm_borrar_memorial');
        $memorial = self::memorial_from_request();
        JM_Repo::delete_memorial($memorial->id);
        JM_Util::flash('success', 'El memorial y sus recuerdos se eliminaron definitivamente.');
        self::back(JM_Util::page_url('panel'));
    }

    /* ------------------------------------------------------------- fotos */

    public static function subir_foto()
    {
        check_admin_referer('jm_subir_foto');
        $memorial = self::memorial_from_request();

        if (JM_Repo::count_photos($memorial->id) >= JM_Media::PHOTOS_POR_MEMORIAL) {
            JM_Util::flash('error', 'Este memorial ya tiene ' . JM_Media::PHOTOS_POR_MEMORIAL . ' fotos. Borra una para subir otra.');
            self::back(self::edit_url($memorial, 'fotos'));
        }

        if (empty($_FILES['photo']['tmp_name'])) {
            JM_Util::flash('error', 'Elige una foto antes de subirla.');
            self::back(self::edit_url($memorial, 'fotos'));
        }

        $attachment = JM_Media::upload($_FILES['photo'], 'photo', $memorial->id);
        if (is_wp_error($attachment)) {
            JM_Util::flash('error', $attachment->get_error_message());
            self::back(self::edit_url($memorial, 'fotos'));
        }

        JM_Repo::add_photo($memorial->id, $attachment, isset($_POST['caption']) ? sanitize_text_field(wp_unslash($_POST['caption'])) : '');
        if (!$memorial->cover_id) {
            JM_Repo::update_memorial($memorial->id, array('cover_id' => (int) $attachment));
        }

        JM_Util::flash('success', 'Foto agregada.');
        self::back(self::edit_url($memorial, 'fotos'));
    }

    public static function borrar_foto()
    {
        check_admin_referer('jm_borrar_foto');
        $memorial = self::memorial_from_request();
        $photo_id = isset($_POST['photo_id']) ? (int) $_POST['photo_id'] : 0;
        $photo = $photo_id ? JM_Repo::find_photo($photo_id) : null;

        if ($photo && (int) $photo->memorial_id === (int) $memorial->id) {
            if ((int) $memorial->cover_id === (int) $photo->attachment_id) {
                JM_Repo::update_memorial($memorial->id, array('cover_id' => null));
            }
            JM_Repo::delete_photo($photo_id);
            JM_Util::flash('success', 'Foto eliminada.');
        }
        self::back(self::edit_url($memorial, 'fotos'));
    }

    public static function mover_foto()
    {
        check_admin_referer('jm_mover_foto');
        $memorial = self::memorial_from_request();
        $photo_id = isset($_POST['photo_id']) ? (int) $_POST['photo_id'] : 0;
        $direction = isset($_POST['direction']) && $_POST['direction'] === 'up' ? 'up' : 'down';
        $photo = $photo_id ? JM_Repo::find_photo($photo_id) : null;
        if ($photo && (int) $photo->memorial_id === (int) $memorial->id) {
            JM_Repo::move_photo($photo_id, $direction);
        }
        self::back(self::edit_url($memorial, 'fotos'));
    }

    public static function portada()
    {
        check_admin_referer('jm_portada');
        $memorial = self::memorial_from_request();
        $photo_id = isset($_POST['photo_id']) ? (int) $_POST['photo_id'] : 0;
        $photo = $photo_id ? JM_Repo::find_photo($photo_id) : null;
        if ($photo && (int) $photo->memorial_id === (int) $memorial->id) {
            JM_Repo::update_memorial($memorial->id, array('cover_id' => (int) $photo->attachment_id));
            JM_Util::flash('success', 'Esa foto ahora es la portada del memorial.');
        }
        self::back(self::edit_url($memorial, 'fotos'));
    }

    /* ------------------------------------------------------ música y video */

    public static function subir_musica()
    {
        check_admin_referer('jm_subir_musica');
        $memorial = self::memorial_from_request();

        if (empty($_FILES['audio']['tmp_name'])) {
            JM_Util::flash('error', 'Elige un archivo de audio.');
            self::back(self::edit_url($memorial, 'musica'));
        }

        $attachment = JM_Media::upload($_FILES['audio'], 'audio', $memorial->id);
        if (is_wp_error($attachment)) {
            JM_Util::flash('error', $attachment->get_error_message());
            self::back(self::edit_url($memorial, 'musica'));
        }

        if ($memorial->music_id) {
            wp_delete_attachment((int) $memorial->music_id, true);
        }
        JM_Repo::update_memorial($memorial->id, array('music_id' => (int) $attachment));
        JM_Util::flash('success', 'La música del memorial quedó guardada.');
        self::back(self::edit_url($memorial, 'musica'));
    }

    public static function quitar_musica()
    {
        check_admin_referer('jm_quitar_musica');
        $memorial = self::memorial_from_request();
        if ($memorial->music_id) {
            wp_delete_attachment((int) $memorial->music_id, true);
            JM_Repo::update_memorial($memorial->id, array('music_id' => null));
        }
        JM_Util::flash('success', 'Quitamos la música personalizada.');
        self::back(self::edit_url($memorial, 'musica'));
    }

    public static function subir_video()
    {
        check_admin_referer('jm_subir_video');
        $memorial = self::memorial_from_request();

        if (empty($_FILES['video']['tmp_name'])) {
            JM_Util::flash('error', 'Elige un video.');
            self::back(self::edit_url($memorial, 'video'));
        }

        $attachment = JM_Media::upload($_FILES['video'], 'video', $memorial->id);
        if (is_wp_error($attachment)) {
            JM_Util::flash('error', $attachment->get_error_message());
            self::back(self::edit_url($memorial, 'video'));
        }

        if ($memorial->video_id) {
            wp_delete_attachment((int) $memorial->video_id, true);
        }
        JM_Repo::update_memorial($memorial->id, array('video_id' => (int) $attachment));

        $meta = wp_get_attachment_metadata((int) $attachment);
        $seconds = isset($meta['length']) ? (float) $meta['length'] : 0;
        if ($seconds > JM_Media::VIDEO_SEGUNDOS + 1) {
            JM_Util::flash('error', sprintf(
                'El video dura %s y el máximo es de %d segundos. Recórtalo y vuelve a subirlo.',
                JM_Media::duration_label($seconds),
                JM_Media::VIDEO_SEGUNDOS
            ));
            wp_delete_attachment((int) $attachment, true);
            JM_Repo::update_memorial($memorial->id, array('video_id' => null));
            self::back(self::edit_url($memorial, 'video'));
        }

        JM_Util::flash('success', 'Video guardado.');
        self::back(self::edit_url($memorial, 'video'));
    }

    public static function quitar_video()
    {
        check_admin_referer('jm_quitar_video');
        $memorial = self::memorial_from_request();
        if ($memorial->video_id) {
            wp_delete_attachment((int) $memorial->video_id, true);
            JM_Repo::update_memorial($memorial->id, array('video_id' => null));
        }
        JM_Util::flash('success', 'Quitamos el video del memorial.');
        self::back(self::edit_url($memorial, 'video'));
    }

    /* ------------------------------------------------ libro de visitas */

    public static function mensaje()
    {
        check_admin_referer('jm_mensaje');
        $memorial_id = isset($_POST['memorial_id']) ? (int) $_POST['memorial_id'] : 0;
        $memorial = JM_Repo::find_memorial($memorial_id);

        if (!$memorial || !$memorial->is_public || !$memorial->allow_guestbook) {
            wp_die('No se pueden dejar mensajes en este memorial.', 'Memorial no disponible', array('response' => 404));
        }

        $url = JM_Util::memorial_url($memorial) . '#libro';

        if (!empty($_POST['jm_hp'])) {
            self::back($url);
        }

        if (!JM_Repo::rate_hit('mensaje', JM_Util::ip_hash(), 5, 10 * MINUTE_IN_SECONDS)) {
            JM_Util::flash('error', 'Dejaste varios mensajes seguidos. Espera unos minutos.');
            self::back($url);
        }

        $name = isset($_POST['name']) ? sanitize_text_field(wp_unslash($_POST['name'])) : '';
        $city = isset($_POST['city']) ? sanitize_text_field(wp_unslash($_POST['city'])) : '';
        $text = isset($_POST['message']) ? sanitize_textarea_field(wp_unslash($_POST['message'])) : '';

        if (mb_strlen($name) < 2) {
            JM_Util::flash('error', 'Escribe tu nombre para firmar el mensaje.');
            self::back($url);
        }
        if (mb_strlen($text) < 3) {
            JM_Util::flash('error', 'Escribe un mensaje un poco más largo.');
            self::back($url);
        }

        JM_Repo::add_message($memorial_id, $name, $city, mb_substr($text, 0, 1200), !empty($_POST['candle']));
        JM_Util::flash('success', 'Gracias. Tu mensaje quedó en el libro del memorial.');
        self::back($url);
    }

    public static function vela()
    {
        check_admin_referer('jm_vela');
        $memorial_id = isset($_POST['memorial_id']) ? (int) $_POST['memorial_id'] : 0;
        $memorial = JM_Repo::find_memorial($memorial_id);
        if (!$memorial || !$memorial->is_public) {
            wp_die('Memorial no disponible.', 'Memorial no disponible', array('response' => 404));
        }

        if (!JM_Repo::rate_hit('vela', JM_Util::ip_hash(), 12, 10 * MINUTE_IN_SECONDS)) {
            JM_Util::flash('error', 'Encendiste varias velas seguidas. Espera un momento.');
            self::back(JM_Util::memorial_url($memorial));
        }

        $name = isset($_POST['name']) ? sanitize_text_field(wp_unslash($_POST['name'])) : '';
        JM_Repo::add_candle($memorial_id, $name);
        JM_Util::flash('success', 'Encendimos una vela en memoria.');
        self::back(JM_Util::memorial_url($memorial) . '#velas');
    }

    public static function ocultar_mensaje()
    {
        check_admin_referer('jm_ocultar_mensaje');
        $message = JM_Repo::find_message(isset($_POST['message_id']) ? (int) $_POST['message_id'] : 0);
        if (!$message) {
            self::back(JM_Util::page_url('panel'));
        }
        $memorial = JM_Repo::find_memorial($message->memorial_id);
        if (!JM_Util::is_owner($memorial)) {
            wp_die('Ese mensaje no pertenece a un memorial tuyo.', 'Sin permiso', array('response' => 403));
        }
        JM_Repo::hide_message($message->id, empty($_POST['visible']));
        JM_Util::flash('success', 'Actualizamos la visibilidad del mensaje.');
        self::back(self::edit_url($memorial, 'mensajes'));
    }

    public static function borrar_mensaje()
    {
        check_admin_referer('jm_borrar_mensaje');
        $message = JM_Repo::find_message(isset($_POST['message_id']) ? (int) $_POST['message_id'] : 0);
        if (!$message) {
            self::back(JM_Util::page_url('panel'));
        }
        $memorial = JM_Repo::find_memorial($message->memorial_id);
        if (!JM_Util::is_owner($memorial)) {
            wp_die('Ese mensaje no pertenece a un memorial tuyo.', 'Sin permiso', array('response' => 403));
        }
        JM_Repo::delete_message($message->id);
        JM_Util::flash('success', 'El mensaje se eliminó definitivamente.');
        self::back(self::edit_url($memorial, 'mensajes'));
    }

    /* ------------------------------------------------------------- pagos */

    public static function comprar()
    {
        check_admin_referer('jm_comprar');
        if (!is_user_logged_in()) {
            self::back(add_query_arg('redirect_to', rawurlencode(JM_Util::page_url('planes')), JM_Util::page_url('ingresar')));
        }

        $plan_id = isset($_POST['plan']) ? sanitize_key(wp_unslash($_POST['plan'])) : '';
        $result = JM_Payments::start(get_current_user_id(), $plan_id);
        if (is_wp_error($result)) {
            JM_Util::flash('error', $result->get_error_message());
            self::back(JM_Util::page_url('planes'));
        }

        wp_redirect(esc_url_raw($result['url']));
        exit;
    }

    public static function demo_aprobar()
    {
        check_admin_referer('jm_demo');
        $reference = isset($_POST['reference']) ? sanitize_text_field(wp_unslash($_POST['reference'])) : '';
        $purchase = JM_Repo::find_purchase($reference);

        if (!$purchase || (int) $purchase->user_id !== get_current_user_id() || $purchase->mode !== 'demo') {
            wp_die('Esa compra no existe.', 'Compra no disponible', array('response' => 404));
        }

        JM_Payments::apply_payment(array(
            'id' => 'demo-' . $purchase->id,
            'external_reference' => $purchase->reference,
            'status' => 'approved',
            'transaction_amount' => (float) $purchase->amount,
            'payer' => array('email' => wp_get_current_user()->user_email),
        ));

        JM_Util::flash('success', 'Pago de prueba aprobado. Los memoriales quedaron en tu cuenta.');
        self::back(JM_Payments::receipt_url($purchase));
    }

    public static function demo_cancelar()
    {
        check_admin_referer('jm_demo');
        $reference = isset($_POST['reference']) ? sanitize_text_field(wp_unslash($_POST['reference'])) : '';
        $purchase = JM_Repo::find_purchase($reference);

        if ($purchase && (int) $purchase->user_id === get_current_user_id() && $purchase->mode === 'demo') {
            JM_Repo::update_purchase($purchase->reference, array('status' => 'anulado'));
        }
        JM_Util::flash('info', 'La compra de prueba quedó anulada.');
        self::back(JM_Util::page_url('planes'));
    }

    public static function verificar_compra()
    {
        check_admin_referer('jm_verificar_compra');
        $reference = isset($_POST['reference']) ? sanitize_text_field(wp_unslash($_POST['reference'])) : '';
        $purchase = JM_Repo::find_purchase($reference);

        if (!$purchase) {
            self::back(JM_Util::page_url('panel'));
        }
        $is_admin = JM_Accounts::is_admin_user();
        if ((int) $purchase->user_id !== get_current_user_id() && !$is_admin) {
            wp_die('Esa compra no es tuya.', 'Sin permiso', array('response' => 403));
        }

        $result = JM_Payments::verify($purchase);
        if (is_wp_error($result)) {
            JM_Util::flash('error', $result->get_error_message());
        } elseif (isset($result['status']) && $result['status'] === 'pagado') {
            JM_Util::flash('success', 'El pago está confirmado y los memoriales quedaron en la cuenta.');
        } else {
            JM_Util::flash('info', 'La pasarela todavía no confirma el pago. Vuelve a intentarlo en unos minutos.');
        }

        self::back($is_admin ? admin_url('admin.php?page=jm-pagos') : JM_Payments::receipt_url($purchase));
    }
}
