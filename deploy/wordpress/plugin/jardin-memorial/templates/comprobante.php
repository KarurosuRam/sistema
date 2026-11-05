<?php
if (!defined('ABSPATH')) {
    exit;
}
$flash = isset($jm_flash) ? $jm_flash : array();
$purchase = isset($purchase) ? $purchase : null;

$estados = array(
    'pagado' => array('Pago confirmado', 'Tu compra quedó acreditada.', 'jm-badge'),
    'pendiente' => array('Pago en proceso', 'La pasarela todavía no confirma el pago.', 'jm-badge jm-badge--gold'),
    'reembolsado' => array('Pago devuelto', 'Devolvimos el dinero de esta compra.', 'jm-badge jm-badge--gold'),
    'anulado' => array('Pago no completado', 'No se acreditó ningún cupo.', 'jm-badge jm-badge--clay'),
    'rechazado' => array('Pago rechazado', 'El medio de pago no autorizó el cobro.', 'jm-badge jm-badge--clay'),
    'invalido' => array('Revisión pendiente', 'El monto pagado no coincide con la orden.', 'jm-badge jm-badge--clay'),
);
?>
<div class="jm-wrap--narrow">
  <?php foreach ($flash as $notice) : ?>
    <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
  <?php endforeach; ?>

  <?php if (!$purchase) : ?>
    <div class="jm-empty" style="margin-top:30px">
      <p style="margin:0 0 12px">No encontramos ese comprobante o no tienes permiso para verlo.</p>
      <a class="jm-btn" href="<?php echo esc_url(JM_Util::page_url('panel')); ?>">Ir a mi jardín</a>
    </div>
  <?php else :
      $estado = isset($estados[$purchase->status]) ? $estados[$purchase->status] : array(ucfirst($purchase->status), '', 'jm-badge');
      $user = wp_get_current_user();
      ?>
    <div style="text-align:center;margin:14px 0 24px">
      <p class="jm-eyebrow"><?php echo esc_html($estado[0]); ?></p>
      <h1 class="jm-title" style="font-size:2.1rem"><?php echo $purchase->status === 'pagado' ? '¡Gracias por confiar en nosotros!' : esc_html($estado[0]); ?></h1>
      <p class="jm-lede" style="font-size:0.95rem"><?php echo esc_html($estado[1]); ?></p>
    </div>

    <div class="jm-receipt">
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px">
        <div>
          <strong>Comprobante <?php echo esc_html($purchase->reference); ?></strong><br>
          <span class="jm-small jm-muted"><?php echo esc_html(JM_Util::datetime($purchase->created_at)); ?></span>
        </div>
        <span class="<?php echo esc_attr($estado[2]); ?>"><?php echo esc_html($estado[0]); ?></span>
      </div>

      <div class="jm-receipt__row"><span>Titular</span><span><?php echo esc_html($user->display_name); ?></span></div>
      <div class="jm-receipt__row"><span>Correo</span><span><?php echo esc_html($user->user_email); ?></span></div>
      <div class="jm-receipt__row"><span>Plan</span><span><?php echo esc_html($purchase->plan_name); ?></span></div>
      <div class="jm-receipt__row">
        <span>Memoriales</span>
        <span><?php echo $purchase->status === 'pagado' ? (int) $purchase->credits : '0 (se acreditan al confirmar)'; ?></span>
      </div>
      <div class="jm-receipt__row">
        <span>Medio de pago</span>
        <span><?php echo esc_html($purchase->mode === 'demo' ? 'Pasarela de prueba' : ($purchase->mode === 'importado' ? 'Compra anterior' : 'Mercado Pago')); ?></span>
      </div>
      <?php if ($purchase->provider_order) : ?>
        <div class="jm-receipt__row"><span>N.º de pago</span><span><?php echo esc_html($purchase->provider_order); ?></span></div>
      <?php endif; ?>
      <?php if ($purchase->paid_at) : ?>
        <div class="jm-receipt__row"><span>Fecha de pago</span><span><?php echo esc_html(JM_Util::datetime($purchase->paid_at)); ?></span></div>
      <?php endif; ?>

      <div class="jm-receipt__total">
        <span><?php echo $purchase->status === 'reembolsado' ? 'Total devuelto' : ($purchase->status === 'pagado' ? 'Total pagado' : 'Total'); ?></span>
        <span><?php echo esc_html(JM_Util::clp($purchase->amount)); ?></span>
      </div>
    </div>

    <div class="jm-actions" style="justify-content:center;margin-top:22px">
      <?php if ($purchase->status === 'pendiente' && $purchase->mode !== 'demo') : ?>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin:0">
          <?php wp_nonce_field('jm_verificar_compra'); ?>
          <input type="hidden" name="action" value="jm_verificar_compra">
          <input type="hidden" name="reference" value="<?php echo esc_attr($purchase->reference); ?>">
          <button class="jm-btn jm-btn--ghost" type="submit">Verificar pago</button>
        </form>
      <?php endif; ?>
      <?php if ($purchase->status === 'pagado') : ?>
        <a class="jm-btn" href="<?php echo esc_url(JM_Util::page_url('panel')); ?>">Crear un memorial</a>
      <?php endif; ?>
      <a class="jm-btn jm-btn--ghost" href="<?php echo esc_url(JM_Util::page_url('panel')); ?>">Ver historial</a>
      <button class="jm-btn jm-btn--ghost" type="button" onclick="window.print()">Imprimir</button>
    </div>
  <?php endif; ?>
</div>
