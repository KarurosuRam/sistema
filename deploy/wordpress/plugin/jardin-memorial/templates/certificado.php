<?php
if (!defined('ABSPATH')) {
    exit;
}
$memorial = isset($memorial) ? $memorial : null;
?>
<div class="jm-wrap">
  <?php if (!$memorial) : ?>
    <div class="jm-empty" style="margin-top:30px">
      <p style="margin:0 0 12px">El certificado es privado: solo lo puede ver la persona titular del memorial.</p>
      <a class="jm-btn" href="<?php echo esc_url(JM_Util::page_url('panel')); ?>">Ir a mi jardín</a>
    </div>
  <?php else :
      $owner = get_user_by('id', (int) $memorial->user_id);
      ?>
    <div class="jm-certificate">
      <p class="jm-eyebrow">Certificado de propiedad</p>
      <h1>Jardín Memorial</h1>
      <p class="jm-quote" style="margin:16px 0 0">Se certifica que</p>
      <p class="jm-certificate__name"><?php echo esc_html($memorial->full_name); ?></p>
      <p class="jm-quote" style="max-width:560px;margin:14px auto 0">
        tiene su memorial digital publicado en <strong><?php echo esc_html(wp_parse_url(home_url(), PHP_URL_HOST)); ?></strong>,
        cuidado por <?php echo esc_html($owner ? $owner->display_name : 'su familia'); ?>.
      </p>
      <p class="jm-certificate__code"><?php echo esc_html($memorial->certificate_code); ?></p>
      <p class="jm-small jm-muted" style="margin-top:10px">
        Creado el <?php echo esc_html(JM_Util::long_date($memorial->created_at)); ?> ·
        <?php echo esc_html(JM_Util::memorial_url($memorial)); ?>
      </p>
      <div class="jm-actions" style="justify-content:center;margin-top:24px">
        <button class="jm-btn jm-btn--ghost" type="button" onclick="window.print()">Imprimir o guardar en PDF</button>
        <a class="jm-btn jm-btn--ghost" href="<?php echo esc_url(JM_Util::memorial_url($memorial)); ?>">Ver el memorial</a>
      </div>
    </div>
  <?php endif; ?>
</div>
