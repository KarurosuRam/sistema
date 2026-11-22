<?php
if (!defined('ABSPATH')) {
    exit;
}
$flash = isset($jm_flash) ? $jm_flash : array();
$errors = isset($errors) ? $errors : array();
$values = isset($values) ? $values : array();
$redirect = isset($redirect) ? $redirect : JM_Util::page_url('panel');
?>
<div class="jm-wrap--narrow">
  <?php foreach ($flash as $notice) : ?>
    <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
  <?php endforeach; ?>

  <div class="jm-auth">
    <p class="jm-eyebrow">Ingresar</p>
    <h1 class="jm-title" style="font-size:2rem">Tu jardín te espera</h1>

    <?php if ($errors) : ?>
      <div class="jm-errors" role="alert">
        <ul><?php foreach ($errors as $error) : ?><li><?php echo esc_html($error); ?></li><?php endforeach; ?></ul>
      </div>
    <?php endif; ?>

    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
      <?php wp_nonce_field('jm_ingresar'); ?>
      <input type="hidden" name="action" value="jm_ingresar">
      <input type="hidden" name="redirect_to" value="<?php echo esc_attr($redirect); ?>">

      <div class="jm-field">
        <label for="jm-email">Correo electrónico</label>
        <input class="jm-input" id="jm-email" type="email" name="email" required autocomplete="email"
               value="<?php echo esc_attr(isset($values['email']) ? $values['email'] : ''); ?>">
      </div>

      <div class="jm-field">
        <label for="jm-pass">Contraseña</label>
        <input class="jm-input" id="jm-pass" type="password" name="password" required autocomplete="current-password">
      </div>

      <label class="jm-check">
        <input type="checkbox" name="remember" value="1" checked>
        <span>Mantener la sesión abierta</span>
      </label>

      <button class="jm-btn jm-btn--block" type="submit">Ingresar</button>
    </form>

    <p class="jm-auth__alt"><a href="<?php echo esc_url(JM_Util::page_url('recuperar')); ?>">¿Olvidaste tu contraseña?</a></p>
    <p class="jm-auth__alt">¿Aún no tienes cuenta? <a href="<?php echo esc_url(JM_Util::page_url('registro')); ?>">Crea tu cuenta gratis</a></p>
  </div>
</div>
