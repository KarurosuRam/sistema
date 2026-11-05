<?php
/**
 * Migración desde la app Node.
 *
 * El exportador (`npm run export-wordpress`) produce un ZIP con `datos.json` y
 * la carpeta `uploads/`. Este importador lo lee y crea usuarios de WordPress,
 * memoriales, fotos, mensajes, velas y compras.
 *
 * Las contraseñas no se pueden convertir: WordPress usa otro algoritmo, así que
 * cada cuenta se crea con una clave aleatoria y se le envía el enlace de
 * recuperación (o el dueño lo genera desde el panel).
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Migrate
{
    /** Importa el ZIP y devuelve un resumen o WP_Error. */
    public static function import_zip($file, $opciones = array())
    {
        $opciones = wp_parse_args($opciones, array('enviar_correos' => false, 'crear_usuarios' => true));

        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return new WP_Error('jm_migrate_file', 'No recibimos el archivo.');
        }
        if ((int) $file['size'] > 500 * MB_IN_BYTES) {
            return new WP_Error('jm_migrate_size', 'El archivo supera los 500 MB.');
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';

        $work = trailingslashit(get_temp_dir()) . 'jm-migrate-' . wp_generate_password(8, false);
        wp_mkdir_p($work);

        $unzipped = unzip_file($file['tmp_name'], $work);
        if (is_wp_error($unzipped)) {
            return new WP_Error('jm_migrate_zip', 'No pudimos abrir el ZIP: ' . $unzipped->get_error_message());
        }

        $json_path = $work . '/datos.json';
        if (!file_exists($json_path)) {
            return new WP_Error('jm_migrate_json', 'El ZIP no trae datos.json.');
        }

        $data = json_decode(file_get_contents($json_path), true);
        if (!is_array($data)) {
            return new WP_Error('jm_migrate_json', 'datos.json no es válido.');
        }

        $summary = array(
            'usuarios_creados' => 0,
            'usuarios_existentes' => 0,
            'memoriales' => 0,
            'fotos' => 0,
            'mensajes' => 0,
            'velas' => 0,
            'compras' => 0,
            'avisos' => array(),
        );

        $map_users = array();
        $map_memorials = array();

        // ---------------------------------------------------------- usuarios
        $users = isset($data['users']) && is_array($data['users']) ? $data['users'] : array();
        foreach ($users as $row) {
            $email = isset($row['email']) ? sanitize_email($row['email']) : '';
            if (!is_email($email)) {
                continue;
            }
            $existing = get_user_by('email', $email);
            if ($existing) {
                $map_users[(int) $row['id']] = (int) $existing->ID;
                $summary['usuarios_existentes']++;
                JP_Migrate_Helper::sync_credits($existing->ID, isset($row['credits']) ? $row['credits'] : 0);
                continue;
            }
            if (!$opciones['crear_usuarios']) {
                continue;
            }

            $password = wp_generate_password(24, true, true);
            $user_id = wp_create_user($email, $password, $email);
            if (is_wp_error($user_id)) {
                $summary['avisos'][] = 'No pudimos crear la cuenta ' . $email . ': ' . $user_id->get_error_message();
                continue;
            }
            wp_update_user(array(
                'ID' => $user_id,
                'display_name' => isset($row['name']) ? $row['name'] : $email,
                'first_name' => isset($row['name']) ? $row['name'] : '',
                'role' => 'subscriber',
            ));
            JP_Migrate_Helper::sync_credits($user_id, isset($row['credits']) ? $row['credits'] : 0);

            if (!empty($opciones['enviar_correos'])) {
                $reset = get_password_reset_key(get_user_by('id', $user_id));
                if (!is_wp_error($reset)) {
                    $url = network_site_url('wp-login.php?action=rp&key=' . $reset . '&login=' . rawurlencode($email), 'login');
                    wp_mail(
                        $email,
                        'Tu cuenta en Jardín Memorial',
                        "Hola:\n\nPasamos tu cuenta al nuevo sitio. Para elegir tu contraseña entra aquí:\n\n" . $url . "\n\nEl enlace vence en 24 horas."
                    );
                }
            }

            $map_users[(int) $row['id']] = (int) $user_id;
            $summary['usuarios_creados']++;
        }

        // -------------------------------------------------------- memoriales
        $memorials = isset($data['memorials']) && is_array($data['memorials']) ? $data['memorials'] : array();
        foreach ($memorials as $row) {
            $old_user = isset($row['user_id']) ? (int) $row['user_id'] : 0;
            if (!isset($map_users[$old_user])) {
                $summary['avisos'][] = 'Saltamos el memorial «' . (isset($row['full_name']) ? $row['full_name'] : '?') . '»: su cuenta no existe.';
                continue;
            }

            $slug = isset($row['slug']) ? JM_Util::slugify($row['slug']) : '';
            if ($slug === '' || JM_Repo::slug_exists($slug)) {
                $slug = JM_Repo::unique_slug(isset($row['full_name']) ? $row['full_name'] : $slug);
            }

            $code = isset($row['certificate_code']) && $row['certificate_code'] ? $row['certificate_code'] : JM_Util::certificate_code();

            $memorial_id = JM_Repo::insert_memorial(array(
                'user_id' => $map_users[$old_user],
                'slug' => $slug,
                'certificate_code' => $code,
                'kind' => isset($row['kind']) ? $row['kind'] : 'persona',
                'full_name' => isset($row['full_name']) ? $row['full_name'] : 'Memorial',
                'relationship' => isset($row['relationship']) ? $row['relationship'] : '',
                'birth_date' => isset($row['birth_date']) ? $row['birth_date'] : null,
                'death_date' => isset($row['death_date']) ? $row['death_date'] : null,
                'epitaph' => isset($row['epitaph']) ? $row['epitaph'] : '',
                'biography' => isset($row['biography']) ? $row['biography'] : '',
                'theme' => isset($row['theme']) ? $row['theme'] : 'jardin',
                'is_public' => !empty($row['is_public']),
                'allow_guestbook' => !empty($row['allow_guestbook']),
            ));

            if (!$memorial_id) {
                $summary['avisos'][] = 'No pudimos crear el memorial «' . $row['full_name'] . '».';
                continue;
            }

            $map_memorials[(int) $row['id']] = $memorial_id;
            $summary['memoriales']++;

            // Portada y música (los archivos vienen con la misma ruta relativa).
            if (!empty($row['main_photo'])) {
                $attachment = JP_Migrate_Helper::import_file($work, $row['main_photo']);
                if ($attachment) {
                    JM_Repo::update_memorial($memorial_id, array('cover_id' => $attachment));
                }
            }
            if (!empty($row['music_path'])) {
                $attachment = JP_Migrate_Helper::import_file($work, $row['music_path'], 'audio');
                if ($attachment) {
                    JM_Repo::update_memorial($memorial_id, array('music_id' => $attachment));
                }
            }
            if (!empty($row['video_path'])) {
                $attachment = JP_Migrate_Helper::import_file($work, $row['video_path'], 'video');
                if ($attachment) {
                    JM_Repo::update_memorial($memorial_id, array('video_id' => $attachment));
                }
            }

            // Galería.
            $photos = isset($row['photos']) && is_array($row['photos']) ? $row['photos'] : array();
            foreach ($photos as $photo) {
                if (empty($photo['filename'])) {
                    continue;
                }
                $attachment = JP_Migrate_Helper::import_file($work, $photo['filename']);
                if ($attachment) {
                    JM_Repo::add_photo($memorial_id, $attachment, isset($photo['caption']) ? $photo['caption'] : '');
                    $summary['fotos']++;
                }
            }

            // Libro de visitas.
            $guestbook = isset($row['guestbook']) && is_array($row['guestbook']) ? $row['guestbook'] : array();
            foreach ($guestbook as $entry) {
                global $wpdb;
                $wpdb->insert(JM_DB::table('guestbook'), array(
                    'memorial_id' => $memorial_id,
                    'name' => isset($entry['name']) ? $entry['name'] : 'Visitante',
                    'city' => isset($entry['city']) ? $entry['city'] : '',
                    'message' => isset($entry['message']) ? $entry['message'] : '',
                    'candle' => !empty($entry['candle']) ? 1 : 0,
                    'hidden' => !empty($entry['hidden']) ? 1 : 0,
                    'created_at' => isset($entry['created_at']) ? $entry['created_at'] : current_time('mysql'),
                ));
                $summary['mensajes']++;
            }

            // Velas.
            $candles = isset($row['candles']) && is_array($row['candles']) ? $row['candles'] : array();
            foreach ($candles as $candle) {
                global $wpdb;
                $wpdb->insert(JM_DB::table('candles'), array(
                    'memorial_id' => $memorial_id,
                    'name' => isset($candle['name']) ? $candle['name'] : '',
                    'created_at' => isset($candle['created_at']) ? $candle['created_at'] : current_time('mysql'),
                ));
                $summary['velas']++;
            }
        }

        // ---------------------------------------------------------- compras
        $purchases = isset($data['purchases']) && is_array($data['purchases']) ? $data['purchases'] : array();
        foreach ($purchases as $row) {
            $old_user = isset($row['user_id']) ? (int) $row['user_id'] : 0;
            if (!isset($map_users[$old_user])) {
                continue;
            }
            if (JM_Repo::find_purchase(isset($row['reference']) ? $row['reference'] : '')) {
                continue;
            }
            JM_Repo::insert_purchase(array(
                'user_id' => $map_users[$old_user],
                'plan' => isset($row['plan']) ? $row['plan'] : 'single',
                'plan_name' => isset($row['plan_name']) ? $row['plan_name'] : 'Memorial',
                'amount' => isset($row['amount']) ? (int) $row['amount'] : 0,
                'credits' => isset($row['credits']) ? (int) $row['credits'] : 0,
                'reference' => isset($row['reference']) ? $row['reference'] : JM_Util::reference(),
                'status' => isset($row['status']) ? $row['status'] : 'pagado',
                'mode' => 'importado',
                'provider_order' => isset($row['provider_order']) ? $row['provider_order'] : null,
                'payer_email' => isset($row['payer_email']) ? $row['payer_email'] : null,
                'paid_at' => isset($row['paid_at']) ? $row['paid_at'] : null,
                'refund_id' => isset($row['refund_id']) ? $row['refund_id'] : null,
                'created_at' => isset($row['created_at']) ? $row['created_at'] : null,
            ));
            $summary['compras']++;
        }

        JP_Migrate_Helper::rmdir($work);
        return $summary;
    }
}

/**
 * Ayudas del importador. Nombre propio para no chocar con el patrón habitual
 * de bloques de Gutenberg del proyecto antiguo.
 */
class JP_Migrate_Helper
{
    public static function sync_credits($user_id, $credits)
    {
        $credits = (int) $credits;
        // Nunca se bajan los cupos que ya tiene la cuenta en el sitio nuevo.
        if ($credits > JM_Accounts::credits($user_id)) {
            JM_Accounts::set_credits($user_id, $credits);
        }
    }

    public static function rmdir($dir)
    {
        if (!is_dir($dir)) {
            return;
        }
        $items = scandir($dir);
        foreach ((array) $items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $dir . '/' . $item;
            if (is_dir($path)) {
                self::rmdir($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }

    /**
     * Copia un archivo del ZIP a uploads y lo registra como adjunto.
     * Devuelve el ID del adjunto o 0.
     */
    public static function import_file($work, $relative, $kind = 'photo')
    {
        $relative = ltrim(str_replace('\\', '/', (string) $relative), '/');
        if ($relative === '' || strpos($relative, '..') !== false) {
            return 0;
        }
        $source = $work . '/uploads/' . $relative;
        if (!file_exists($source)) {
            return 0;
        }

        $uploads = wp_upload_dir();
        $target_dir = trailingslashit($uploads['basedir']) . 'jardin-memorial/importado';
        wp_mkdir_p($target_dir);

        $filename = wp_unique_filename($target_dir, sanitize_file_name(basename($source)));
        $target = $target_dir . '/' . $filename;
        if (!@copy($source, $target)) {
            return 0;
        }

        $mimes = array(
            'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp',
            'mp3' => 'audio/mpeg', 'm4a' => 'audio/mp4', 'ogg' => 'audio/ogg', 'wav' => 'audio/wav',
            'mp4' => 'video/mp4', 'webm' => 'video/webm', 'mov' => 'video/quicktime',
        );
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $mime = isset($mimes[$ext]) ? $mimes[$ext] : 'application/octet-stream';

        if (!function_exists('wp_generate_attachment_metadata')) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        $attachment_id = wp_insert_attachment(array(
            'post_mime_type' => $mime,
            'post_title' => sanitize_file_name(basename($filename, '.' . $ext)),
            'post_status' => 'inherit',
        ), $target, 0, true);

        if (is_wp_error($attachment_id) || !$attachment_id) {
            return 0;
        }

        if ($kind === 'photo') {
            wp_update_attachment_metadata($attachment_id, wp_generate_attachment_metadata($attachment_id, $target));
        }
        update_post_meta($attachment_id, 'jm_privado', 1);

        return (int) $attachment_id;
    }
}
