<?php
if (!defined('ABSPATH')) {
    exit;
}
$user = wp_get_current_user();
?>
<div class="jm-wrap--narrow">
  <div class="jm-auth" style="text-align:center">
    <p class="jm-eyebrow">Sesión abierta</p>
    <h1 class="jm-title" style="font-size:2rem">Ya estás dentro</h1>
    <p class="jm-lede" style="font-size:0.95rem">Entraste como <strong><?php echo esc_html($user->display_name); ?></strong>.</p>
    <a class="jm-btn jm-btn--block" href="<?php echo esc_url(JM_Util::page_url('panel')); ?>">Ir a mi jardín</a>
    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-top:12px">
      <?php wp_nonce_field('jm_salir'); ?>
      <input type="hidden" name="action" value="jm_salir">
      <button class="jm-btn jm-btn--ghost jm-btn--block" type="submit">Cerrar sesión</button>
    </form>
  </div>
</div>
