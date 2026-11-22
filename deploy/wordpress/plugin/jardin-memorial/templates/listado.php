<?php
/** Listado público de memoriales con búsqueda y filtro por tipo. */
if (!defined('ABSPATH')) {
    exit;
}

$flash = isset($jm_flash) ? $jm_flash : array();
$base = JM_Util::page_url('listado');
$pages = max(1, (int) ceil($total / max(1, $per_page)));
?>
<div class="jm-wrap">
  <?php foreach ($flash as $notice) : ?>
    <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
  <?php endforeach; ?>

  <header style="margin:10px 0 26px">
    <p class="jm-eyebrow">Memoriales</p>
    <h1 class="jm-title">Historias que siguen vivas</h1>
    <p class="jm-lede">Cada memorial guarda fotos, música y mensajes de quienes quieren recordar.</p>
  </header>

  <form method="get" action="<?php echo esc_url($base); ?>" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:26px">
    <input class="jm-input" type="search" name="q" value="<?php echo esc_attr($search); ?>" placeholder="Buscar por nombre" style="max-width:320px">
    <select class="jm-select" name="tipo" style="max-width:200px">
      <option value="">Todos</option>
      <option value="persona" <?php selected($kind, 'persona'); ?>>Personas</option>
      <option value="mascota" <?php selected($kind, 'mascota'); ?>>Mascotas</option>
    </select>
    <button class="jm-btn" type="submit">Buscar</button>
    <?php if ($search !== '' || $kind !== '') : ?>
      <a class="jm-btn jm-btn--ghost" href="<?php echo esc_url($base); ?>">Limpiar</a>
    <?php endif; ?>
  </form>

  <?php if (!$memorials) : ?>
    <div class="jm-empty">
      <p style="margin:0 0 12px">No encontramos memoriales con esos criterios.</p>
      <a class="jm-btn" href="<?php echo esc_url(JM_Util::page_url('planes')); ?>">Crear un memorial</a>
    </div>
  <?php else : ?>
    <div class="jm-gallery" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
      <?php foreach ($memorials as $memorial) :
          $cover = $memorial->cover_id ? JM_Media::url($memorial->cover_id, 'medium_large') : '';
          $range = JM_Util::life_range($memorial);
          ?>
        <a href="<?php echo esc_url(JM_Util::memorial_url($memorial)); ?>" style="text-decoration:none;color:inherit">
          <article class="jm-card" style="padding:0;overflow:hidden;height:100%">
            <div style="aspect-ratio:4/3;background:var(--cream-deep)">
              <?php if ($cover) : ?>
                <img src="<?php echo esc_url($cover); ?>" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">
              <?php endif; ?>
            </div>
            <div style="padding:16px 18px">
              <h2 style="font-family:var(--serif);font-weight:400;font-size:1.25rem;margin:0 0 4px"><?php echo esc_html($memorial->full_name); ?></h2>
              <?php if ($range) : ?>
                <p class="jm-small jm-muted" style="margin:0"><?php echo esc_html($range); ?></p>
              <?php endif; ?>
              <?php if ($memorial->epitaph) : ?>
                <p class="jm-small jm-muted" style="margin:8px 0 0">«<?php echo esc_html(JM_Util::excerpt($memorial->epitaph, 14)); ?>»</p>
              <?php endif; ?>
            </div>
          </article>
        </a>
      <?php endforeach; ?>
    </div>

    <?php if ($pages > 1) : ?>
      <nav class="jm-actions" style="justify-content:center;margin-top:30px" aria-label="Paginación">
        <?php for ($i = 1; $i <= $pages; $i++) : ?>
          <a class="jm-btn jm-btn--sm <?php echo $i === (int) $page ? '' : 'jm-btn--ghost'; ?>"
             href="<?php echo esc_url(add_query_arg(array('q' => $search, 'tipo' => $kind, 'pagina' => $i), $base)); ?>"><?php echo $i; ?></a>
        <?php endfor; ?>
      </nav>
    <?php endif; ?>
  <?php endif; ?>
</div>
