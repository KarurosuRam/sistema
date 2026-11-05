<?php
if (!defined('ABSPATH')) {
    exit;
}
$flash = isset($jm_flash) ? $jm_flash : array();
$errors = isset($errors) ? $errors : array();
$values = isset($values) ? $values : array();
?>
<div class="jm-wrap--narrow">
  <?php foreach ($flash as $notice) : ?>
    <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
  <?php endforeach; ?>

  <div class="jm-auth">
    <p class="jm-eyebrow">Crear cuenta</p>
    <h1 class="jm-title" style="font-size:2rem">Empieza tu jardín</h1>
    <p class="jm-lede" style="font-size:0.95rem">Necesitas una cuenta para comprar memoriales y administrarlos.</p>

    <?php if ($errors) : ?>
      <div class="jm-errors" role="alert">
        <ul><?php foreach ($errors as $error) : ?><li><?php echo esc_html($error); ?></li><?php endforeach; ?></ul>
      </div>
    <?php endif; ?>

    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
      <?php wp_nonce_field('jm_registro'); ?>
      <input type="hidden" name="action" value="jm_registro">
      <input type="hidden" name="jm_registro_nonce" value="1">
      <input class="jm-hp" type="text" name="jm_hp" value="" tabindex="-1" autocomplete="off" aria-hidden="true">

      <div class="jm-field">
        <label for="jm-name">Nombre completo</label>
        <input class="jm-input" id="jm-name" type="text" name="name" maxlength="80" required autocomplete="name"
               value="<?php echo esc_attr(isset($values['name']) ? $values['name'] : ''); ?>">
      </div>

      <div class="jm-field">
        <label for="jm-email">Correo electrónico</label>
        <input class="jm-input" id="jm-email" type="email" name="email" required autocomplete="email"
               value="<?php echo esc_attr(isset($values['email']) ? $values['email'] : ''); ?>">
      </div>

      <div class="jm-grid-2">
        <div class="jm-field">
          <label for="jm-pass">Contraseña</label>
          <input class="jm-input" id="jm-pass" type="password" name="password" minlength="8" required autocomplete="new-password">
          <span class="jm-hint">Mínimo 8 caracteres.</span>
        </div>
        <div class="jm-field">
          <label for="jm-pass2">Repite la contraseña</label>
          <input class="jm-input" id="jm-pass2" type="password" name="password_confirm" minlength="8" required autocomplete="new-password">
        </div>
      </div>

      <label class="jm-check">
        <input type="checkbox" name="terms" value="1" required>
        <span>Acepto que mis datos se usen para crear y cuidar mis memoriales en este sitio.</span>
      </label>

      <button class="jm-btn jm-btn--block" type="submit">Crear mi cuenta</button>
    </form>

    <p class="jm-auth__alt">¿Ya tienes cuenta? <a href="<?php echo esc_url(JM_Util::page_url('ingresar')); ?>">Ingresa</a></p>
  </div>
</div>
