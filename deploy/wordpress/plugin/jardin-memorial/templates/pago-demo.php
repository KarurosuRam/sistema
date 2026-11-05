<?php
/** Pasarela de prueba: solo se usa cuando no hay credenciales reales. */
if (!defined('ABSPATH')) {
    exit;
}
$purchase = isset($purchase) ? $purchase : null;
$flash = isset($jm_flash) ? $jm_flash : array();

if (!$purchase || (int) $purchase->user_id !== get_current_user_id()) {
    echo '<div class="jm-wrap--narrow"><div class="jm-empty">Esa compra no existe.</div></div>';
    return;
}
?>
<div class="jm-wrap--narrow">
  <?php foreach ($flash as $notice) : ?>
    <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
  <?php endforeach; ?>

  <div class="jm-auth" style="max-width:560px">
    <p class="jm-eyebrow">Pasarela de prueba</p>
    <h1 class="jm-title" style="font-size:1.9rem">Simular el pago</h1>
    <p class="jm-lede" style="font-size:0.95rem">
      Esta instalación no tiene credenciales de pago reales, así que puedes aprobar o anular la compra
      para ver el recorrido completo. <strong>No se cobra dinero.</strong>
    </p>

    <div class="jm-receipt" style="margin:18px 0">
      <div class="jm-receipt__row"><span>Plan</span><span><?php echo esc_html($purchase->plan_name); ?></span></div>
      <div class="jm-receipt__row"><span>Memoriales</span><span><?php echo (int) $purchase->credits; ?></span></div>
      <div class="jm-receipt__total"><span>Total</span><span><?php echo esc_html(JM_Util::clp($purchase->amount)); ?></span></div>
    </div>

    <?php if ($purchase->status !== 'pendiente') : ?>
      <div class="jm-flash">Esta compra ya está <?php echo esc_html(JM_Admin::estado_label($purchase->status)); ?>.</div>
      <a class="jm-btn jm-btn--block" href="<?php echo esc_url(JM_Payments::receipt_url($purchase)); ?>">Ver comprobante</a>
    <?php else : ?>
      <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-bottom:10px">
        <?php wp_nonce_field('jm_demo'); ?>
        <input type="hidden" name="action" value="jm_demo_aprobar">
        <input type="hidden" name="reference" value="<?php echo esc_attr($purchase->reference); ?>">
        <button class="jm-btn jm-btn--block" type="submit">Aprobar el pago de prueba</button>
      </form>
      <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <?php wp_nonce_field('jm_demo'); ?>
        <input type="hidden" name="action" value="jm_demo_cancelar">
        <input type="hidden" name="reference" value="<?php echo esc_attr($purchase->reference); ?>">
        <button class="jm-btn jm-btn--ghost jm-btn--block" type="submit">Anular la compra</button>
      </form>
    <?php endif; ?>
  </div>
</div>
