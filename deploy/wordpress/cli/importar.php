<?php
/**
 * Importador por línea de comandos.
 *
 * Es el mismo trabajo que hace «Jardín Memorial → Migración», pero sin pasar
 * por el navegador: sirve para sembrar un WordPress recién instalado con los
 * datos de la app Node (cuentas, memoriales, fotos, mensajes, velas y compras).
 *
 * Uso:
 *   wp eval-file importar.php /ruta/al/jardin-memorial-migracion.zip
 *   php importar.php /ruta/al/zip   # con ABSPATH definido antes
 *
 * No envía correos: las cuentas se crean con una clave que el titular
 * reemplaza con «Recuperar contraseña».
 */

if (!defined('ABSPATH')) {
    exit(1);
}

$zip = isset($args[0]) ? $args[0] : (isset($argv[1]) ? $argv[1] : '');
if (!$zip || !file_exists($zip)) {
    fwrite(STDERR, "Falta el ZIP o no existe: {$zip}\n");
    exit(1);
}

// Se arma el mismo arreglo que entrega una subida del navegador.
$size = filesize($zip);
$file = array(
    'tmp_name' => $zip,
    'size' => $size,
    'error' => 0,
);

/*
 * `import_zip()` comprueba `is_uploaded_file()`, que solo acepta subidas HTTP.
 * En CLI se usa una copia temporal y se marca con una constante para que el
 * importador la acepte; ver JM_Migrate::import_zip.
 */
if (!defined('JM_MIGRATE_CLI')) {
    define('JM_MIGRATE_CLI', true);
}

$resultado = JM_Migrate::import_zip($file, array('enviar_correos' => false, 'crear_usuarios' => true));

if (is_wp_error($resultado)) {
    fwrite(STDERR, 'Error: ' . $resultado->get_error_message() . "\n");
    exit(1);
}

echo "Importación terminada\n";
foreach ($resultado as $clave => $valor) {
    if ($clave === 'avisos') {
        continue;
    }
    echo '  ' . str_pad($clave, 20) . $valor . "\n";
}
if (!empty($resultado['avisos'])) {
    echo "\nAvisos:\n";
    foreach ($resultado['avisos'] as $aviso) {
        echo '  · ' . $aviso . "\n";
    }
}
exit(0);
