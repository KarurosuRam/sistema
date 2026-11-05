<?php
if (!defined('ABSPATH')) {
    exit;
}
$flash = isset($jm_flash) ? $jm_flash : array();
?>
<div class="jm-wrap--narrow">
  <?php foreach ($flash as $notice) : ?>
    <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
  <?php endforeach; ?>

  <div class="jm-auth">
    <?php if (!empty($sent)) : ?>
      <p class="jm-eyebrow">Revisa tu correo</p>
      <h1 class="jm-title" style="font-size:2rem">Te enviamos un enlace</h1>
      <p class="jm-lede" style="font-size:0.95rem">
        Si ese correo tiene una cuenta, recibirás un enlace para elegir una contraseña nueva.
        Vence en 24 horas y sirve una sola vez.
      </p>
      <p class="jm-small jm-muted">Si no llega en unos minutos, revisa la carpeta de correo no deseado o pídelo otra vez.</p>
      <a class="jm-btn jm-btn--block" href="<?php echo esc_url(JM_Util::page_url('recuperar')); ?>">Pedir otro enlace</a>
      <p class="jm-auth__alt"><a href="<?php echo esc_url(JM_Util::page_url('ingresar')); ?>">Volver al ingreso</a></p>
    <?php else : ?>
      <p class="jm-eyebrow">¿Olvidaste tu contraseña?</p>
      <h1 class="jm-title" style="font-size:2rem">Recupera tu cuenta</h1>
      <p class="jm-lede" style="font-size:0.95rem">Escribe el correo con el que te registraste y te enviamos un enlace para elegir una contraseña nueva.</p>

      <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <?php wp_nonce_field('jm_recuperar'); ?>
        <input type="hidden" name="action" value="jm_recuperar">

        <div class="jm-field">
          <label for="jm-email">Correo electrónico</label>
          <input class="jm-input" id="jm-email" type="email" name="email" required autocomplete="email">
        </div>

        <button class="jm-btn jm-btn--block" type="submit">Enviarme el enlace</button>
      </form>

      <p class="jm-auth__alt"><a href="<?php echo esc_url(JM_Util::page_url('ingresar')); ?>">Volver al ingreso</a></p>
    <?php endif; ?>
  </div>
</div>
