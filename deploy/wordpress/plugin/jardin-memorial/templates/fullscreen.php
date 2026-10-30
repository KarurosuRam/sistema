<?php
/**
 * Plantilla de página «Jardín Memorial (pantalla completa)».
 *
 * No carga el encabezado ni el pie del tema: la app ocupa toda la ventana.
 * Se conservan wp_head() y wp_footer() para que funcionen los plugins del sitio
 * (analítica, avisos, etc.) y para no romper la barra de administración.
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html(wp_get_document_title()); ?></title>
    <?php wp_head(); ?>
    <style>
        html, body { margin: 0; padding: 0; }
        body.jm-fullscreen { background: #faf8f3; }
        .jm-fullscreen .jm-embed iframe { height: 100vh !important; min-height: 640px; }
        .jm-fullscreen .jm-aviso { margin: 40px auto; max-width: 640px; }
        .jm-fullscreen.admin-bar .jm-embed iframe { height: calc(100vh - 32px) !important; }
        @media screen and (max-width: 782px) {
            .jm-fullscreen.admin-bar .jm-embed iframe { height: calc(100vh - 46px) !important; }
        }
    </style>
</head>
<body <?php body_class('jm-fullscreen'); ?>>
<?php
wp_body_open();
while (have_posts()) {
    the_post();
    the_content();
}
wp_footer();
?>
</body>
</html>
