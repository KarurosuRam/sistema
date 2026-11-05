<?php
/** Planes y compra. */
if (!defined('ABSPATH')) {
    exit;
}

$flash = isset($jm_flash) ? $jm_flash : array();
$logged = is_user_logged_in();
?>
<div class="jm-wrap--narrow">
  <?php foreach ($flash as $notice) : ?>
    <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
  <?php endforeach; ?>

  <header style="text-align:center;margin:10px 0 30px">
    <p class="jm-eyebrow">Planes</p>
    <h1 class="jm-title">Elige cuántos memoriales quieres</h1>
    <p class="jm-lede">Se paga una vez. Los memoriales no vencen y quedan en tu cuenta para cuando los necesites.</p>
  </header>

  <div class="jm-plans">
    <?php foreach ($plans as $plan) : ?>
      <article class="jm-plan <?php echo $plan['id'] === 'pack4' ? 'jm-plan--featured' : ''; ?>">
        <?php if ($plan['badge']) : ?>
          <span class="jm-plan__badge"><?php echo esc_html($plan['badge']); ?></span>
        <?php endif; ?>
        <h2 class="jm-plan__name"><?php echo esc_html($plan['name']); ?></h2>
        <p class="jm-plan__price"><?php echo esc_html(JM_Util::clp($plan['amount'])); ?></p>
        <p class="jm-plan__meta">
          <?php echo esc_html($plan['credits'] === 1 ? '1 memorial' : $plan['credits'] . ' memoriales'); ?>
          · <?php echo esc_html(JM_Util::clp((int) round($plan['amount'] / $plan['credits']))); ?> cada uno
        </p>
        <ul>
          <li>Enlace propio con QR</li>
          <li>Hasta 10 fotos, 1 video y música</li>
          <li>Libro de visitas y velas</li>
          <li>Certificado de propiedad</li>
          <li>Sin vencimiento</li>
        </ul>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
          <?php wp_nonce_field('jm_comprar'); ?>
          <input type="hidden" name="action" value="jm_comprar">
          <input type="hidden" name="plan" value="<?php echo esc_attr($plan['id']); ?>">
          <button class="jm-btn jm-btn--block" type="submit">
            <?php echo $logged ? 'Comprar' : 'Crear cuenta y comprar'; ?>
          </button>
        </form>
      </article>
    <?php endforeach; ?>
  </div>

  <p class="jm-small jm-muted" style="text-align:center;margin-top:24px">
    <?php if ($mode === 'demo') : ?>
      Esta instalación está en modo demostración: el pago se simula y no se cobra dinero real.
    <?php else : ?>
      El pago se hace en Mercado Pago. Acepta tarjetas de crédito y débito.
    <?php endif; ?>
  </p>

  <?php if (!is_user_logged_in()) : ?>
    <p class="jm-small jm-muted" style="text-align:center">
      ¿Ya tienes cuenta? <a href="<?php echo esc_url(JM_Util::page_url('ingresar')); ?>">Ingresa</a>.
    </p>
  <?php endif; ?>
</div>
