<?php
/**
 * Campos compartidos por «crear» y «editar» memorial.
 * Espera $form_values (array) definido por quien incluye.
 */

if (!defined('ABSPATH')) {
    exit;
}

$v = wp_parse_args((array) $form_values, array(
    'kind' => 'persona',
    'full_name' => '',
    'relationship' => '',
    'birth_date' => '',
    'death_date' => '',
    'epitaph' => '',
    'biography' => '',
    'theme' => 'jardin',
    'is_public' => 1,
    'allow_guestbook' => 1,
));
?>
<div class="jm-grid-2">
  <div class="jm-field">
    <label for="jm-kind">Es un memorial de</label>
    <select class="jm-select" id="jm-kind" name="kind">
      <option value="persona" <?php selected($v['kind'], 'persona'); ?>>Una persona</option>
      <option value="mascota" <?php selected($v['kind'], 'mascota'); ?>>Una mascota</option>
    </select>
  </div>

  <div class="jm-field">
    <label for="jm-theme">Ambiente</label>
    <select class="jm-select" id="jm-theme" name="theme">
      <?php foreach ($themes as $key => $label) : ?>
        <option value="<?php echo esc_attr($key); ?>" <?php selected($v['theme'], $key); ?>><?php echo esc_html($label); ?></option>
      <?php endforeach; ?>
    </select>
  </div>
</div>

<div class="jm-field">
  <label for="jm-full-name">Nombre completo</label>
  <input class="jm-input" id="jm-full-name" type="text" name="full_name" maxlength="120" required value="<?php echo esc_attr($v['full_name']); ?>">
</div>

<div class="jm-field">
  <label for="jm-relationship">Su relación contigo (opcional)</label>
  <input class="jm-input" id="jm-relationship" type="text" name="relationship" maxlength="80" value="<?php echo esc_attr($v['relationship']); ?>" placeholder="Mi madre, mi abuelo, mi compañera…">
</div>

<div class="jm-grid-2">
  <div class="jm-field">
    <label for="jm-birth">Fecha de nacimiento</label>
    <input class="jm-input" id="jm-birth" type="date" name="birth_date" value="<?php echo esc_attr((string) $v['birth_date']); ?>">
  </div>
  <div class="jm-field">
    <label for="jm-death">Fecha de fallecimiento</label>
    <input class="jm-input" id="jm-death" type="date" name="death_date" value="<?php echo esc_attr((string) $v['death_date']); ?>">
  </div>
</div>

<div class="jm-field">
  <label for="jm-epitaph">Una frase que lo recuerde</label>
  <input class="jm-input" id="jm-epitaph" type="text" name="epitaph" maxlength="200" value="<?php echo esc_attr($v['epitaph']); ?>" placeholder="Siempre en nuestro corazón">
  <span class="jm-hint">Hasta 200 caracteres.</span>
</div>

<div class="jm-field">
  <label for="jm-biography">Su historia</label>
  <textarea class="jm-textarea" id="jm-biography" name="biography" maxlength="5000" style="min-height:180px"><?php echo esc_textarea($v['biography']); ?></textarea>
  <span class="jm-hint">Cuéntale al mundo quién era, qué le gustaba, qué dejó en ustedes.</span>
</div>

<div class="jm-field">
  <label for="jm-cover">Foto principal</label>
  <input class="jm-input" id="jm-cover" type="file" name="main_photo" accept="image/jpeg,image/png,image/webp">
  <span class="jm-hint">JPG, PNG o WebP · hasta <?php echo JM_Media::MAX_PHOTO_MB; ?> MB</span>
</div>

<div class="jm-grid-2" style="margin-top:6px">
  <label class="jm-check">
    <input type="checkbox" name="is_public" value="1" <?php checked((int) $v['is_public'], 1); ?>>
    <span><strong>Memorial público.</strong> Cualquiera con el enlace puede entrar. Si lo desmarcas, solo tú lo ves.</span>
  </label>
  <label class="jm-check">
    <input type="checkbox" name="allow_guestbook" value="1" <?php checked((int) $v['allow_guestbook'], 1); ?>>
    <span><strong>Libro de visitas.</strong> Permitir que otras personas dejen mensajes.</span>
  </label>
</div>
