<?php
/**
 * Archivos: fotos, música y video.
 *
 * Todo entra a la biblioteca de medios de WordPress (wp-content/uploads), así
 * que los respaldos del sitio ya incluyen los recuerdos de cada memorial.
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Media
{
    const MAX_PHOTO_MB = 15;
    const MAX_AUDIO_MB = 20;
    const MAX_VIDEO_MB = 120;
    const PHOTOS_POR_MEMORIAL = 10;
    const VIDEO_SEGUNDOS = 60;

    /** Carpeta propia dentro de uploads para no mezclar con el tema. */
    public static function upload_dir($dirs)
    {
        $dirs['subdir'] = '/jardin-memorial' . $dirs['subdir'];
        $dirs['path'] = $dirs['basedir'] . $dirs['subdir'];
        $dirs['url'] = $dirs['baseurl'] . $dirs['subdir'];
        return $dirs;
    }

    public static function allowed_mime($tipo)
    {
        switch ($tipo) {
            case 'photo':
                return array(
                    'jpg|jpeg|jpe' => 'image/jpeg',
                    'png' => 'image/png',
                    'webp' => 'image/webp',
                );
            case 'audio':
                return array(
                    'mp3' => 'audio/mpeg',
                    'm4a' => 'audio/mp4',
                    'ogg' => 'audio/ogg',
                    'wav' => 'audio/wav',
                );
            case 'video':
                return array(
                    'mp4|m4v' => 'video/mp4',
                    'webm' => 'video/webm',
                    'mov' => 'video/quicktime',
                );
        }
        return array();
    }

    /**
     * Sube un archivo y lo registra como adjunto.
     *
     * @return int|WP_Error ID del adjunto.
     */
    public static function upload($file, $tipo, $memorial_id = 0)
    {
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return new WP_Error('jm_upload', 'No recibimos el archivo. Inténtalo de nuevo.');
        }

        if (!empty($file['error']) && (int) $file['error'] !== UPLOAD_ERR_OK) {
            $motivos = array(
                UPLOAD_ERR_INI_SIZE => 'El archivo supera el tamaño que permite el servidor.',
                UPLOAD_ERR_FORM_SIZE => 'El archivo es demasiado grande.',
                UPLOAD_ERR_PARTIAL => 'La subida se cortó a medias. Inténtalo otra vez.',
                UPLOAD_ERR_NO_FILE => 'No elegiste ningún archivo.',
            );
            $mensaje = isset($motivos[(int) $file['error']]) ? $motivos[(int) $file['error']] : 'No pudimos subir el archivo.';
            return new WP_Error('jm_upload', $mensaje);
        }

        $limites = array(
            'photo' => self::MAX_PHOTO_MB,
            'audio' => self::MAX_AUDIO_MB,
            'video' => self::MAX_VIDEO_MB,
        );
        $limite = isset($limites[$tipo]) ? $limites[$tipo] : 15;
        if ((int) $file['size'] > $limite * MB_IN_BYTES) {
            return new WP_Error('jm_upload_size', sprintf('El archivo supera los %d MB permitidos.', $limite));
        }

        if (!function_exists('wp_handle_upload')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if (!function_exists('wp_generate_attachment_metadata')) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }
        if (!function_exists('wp_read_video_metadata')) {
            require_once ABSPATH . 'wp-admin/includes/media.php';
        }

        add_filter('upload_dir', array('JM_Media', 'upload_dir'));
        $resultado = wp_handle_upload($file, array(
            'test_form' => false,
            'mimes' => self::allowed_mime($tipo),
        ));
        remove_filter('upload_dir', array('JM_Media', 'upload_dir'));

        if (isset($resultado['error'])) {
            return new WP_Error('jm_upload', $resultado['error']);
        }

        if ($tipo === 'photo') {
            $info = @getimagesize($resultado['file']);
            if (!$info || $info[0] < 300 || $info[1] < 300) {
                @unlink($resultado['file']);
                return new WP_Error(
                    'jm_upload_small',
                    'La foto es muy pequeña: usa una de al menos 300 × 300 píxeles.'
                );
            }
        }

        $attachment_id = wp_insert_attachment(array(
            'post_mime_type' => $resultado['type'],
            'post_title' => sanitize_file_name(basename($resultado['file'])),
            'post_content' => '',
            'post_status' => 'inherit',
        ), $resultado['file'], 0, true);

        if (is_wp_error($attachment_id) || !$attachment_id) {
            return new WP_Error('jm_upload', 'No pudimos registrar el archivo en la biblioteca.');
        }

        wp_update_attachment_metadata($attachment_id, wp_generate_attachment_metadata($attachment_id, $resultado['file']));
        update_post_meta($attachment_id, 'jm_privado', 1);

        return (int) $attachment_id;
    }

    public static function url($attachment_id, $size = 'large')
    {
        if (!$attachment_id) {
            return '';
        }
        $src = wp_get_attachment_image_src((int) $attachment_id, $size);
        if ($src) {
            return $src[0];
        }
        return wp_get_attachment_url((int) $attachment_id);
    }

    public static function srcset($attachment_id)
    {
        if (!$attachment_id) {
            return '';
        }
        return wp_get_attachment_image_srcset((int) $attachment_id, 'large');
    }

    public static function file_path($attachment_id)
    {
        $path = get_attached_file((int) $attachment_id);
        return $path && file_exists($path) ? $path : '';
    }

    public static function duration_label($seconds)
    {
        $seconds = (int) round((float) $seconds);
        if ($seconds <= 0) {
            return '';
        }
        return floor($seconds / 60) . ':' . str_pad((string) ($seconds % 60), 2, '0', STR_PAD_LEFT);
    }
}
