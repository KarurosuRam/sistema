<?php
/**
 * Página pública de un memorial: /m/<slug>
 * La incluye WordPress vía template_include, así que abre y cierra el tema.
 */

if (!defined('ABSPATH')) {
    exit;
}

global $jm_memorial_data;
$memorial = $jm_memorial_data;
$is_owner = JM_Util::is_owner($memorial);
$is_admin = JM_Accounts::is_admin_user();
$photos = JM_Repo::photos($memorial->id);
$messages = JM_Repo::guestbook($memorial->id, false, 80);
$candles = JM_Repo::count_candles($memorial->id);
$cover = $memorial->cover_id ? JM_Media::url($memorial->cover_id, 'full') : '';
$music = $memorial->music_id ? JM_Media::url($memorial->music_id, 'full') : '';
$video = $memorial->video_id ? JM_Media::url($memorial->video_id, 'full') : '';
$range = JM_Util::life_range($memorial);
$share_url = JM_Util::memorial_url($memorial);
$flash = JM_Util::take_flash();

if (!$is_owner) {
    JM_Repo::increment_views($memorial->id);
}

get_header();
?>
<main class="jm-page jm-memorial">
  <div class="jm-wrap">

    <?php foreach ($flash as $notice) : ?>
      <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
    <?php endforeach; ?>

    <section class="jm-hero">
      <?php if ($cover) : ?>
        <img class="jm-hero__media" src="<?php echo esc_url($cover); ?>" alt="">
      <?php endif; ?>
      <div class="jm-hero__shade"></div>
      <div class="jm-hero__body">
        <p class="jm-hero__kind"><?php echo $memorial->kind === 'mascota' ? 'En memoria de una mascota' : 'En memoria'; ?></p>
        <h1 class="jm-hero__name"><?php echo esc_html($memorial->full_name); ?></h1>
        <?php if ($range) : ?>
          <p class="jm-hero__dates"><?php echo esc_html($range); ?></p>
        <?php endif; ?>
        <?php if ($memorial->epitaph) : ?>
          <p class="jm-hero__epitaph">«<?php echo esc_html($memorial->epitaph); ?>»</p>
        <?php endif; ?>
      </div>
    </section>

    <?php if ($is_owner) : ?>
      <div class="jm-flash" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <span>Este memorial es tuyo<?php echo $memorial->is_public ? '' : ' y está privado: solo tú lo ves'; ?>.</span>
        <span class="jm-actions">
          <a class="jm-btn jm-btn--ghost jm-btn--sm" href="<?php echo esc_url(add_query_arg(array('m' => (int) $memorial->id), JM_Util::page_url('panel'))); ?>">Administrar</a>
          <a class="jm-btn jm-btn--ghost jm-btn--sm" href="<?php echo esc_url(add_query_arg('codigo', $memorial->certificate_code, JM_Util::page_url('certificado'))); ?>">Certificado</a>
        </span>
      </div>
    <?php endif; ?>

    <div class="jm-section jm-grid-2" style="align-items:start">
      <div>
        <?php if ($memorial->biography) : ?>
          <h2 class="jm-eyebrow">Su historia</h2>
          <div class="jm-quote jm-bio"><?php echo nl2br(esc_html($memorial->biography)); ?></div>
        <?php endif; ?>

        <?php if ($video) : ?>
          <div class="jm-section">
            <h2 class="jm-eyebrow">Un video para recordar</h2>
            <video controls preload="metadata" playsinline style="width:100%;border-radius:12px;background:#000">
              <source src="<?php echo esc_url($video); ?>">
              Tu navegador no puede reproducir este video.
            </video>
          </div>
        <?php endif; ?>
      </div>

      <aside>
        <div class="jm-card">
          <h3 class="jm-section-head" style="margin-bottom:10px"><span>Compartir</span></h3>
          <p class="jm-small jm-muted">Copia el enlace o escanea el código para abrir este memorial en el teléfono.</p>
          <div class="jm-share">
            <div class="jm-share__code" data-jm-qr="<?php echo esc_attr($share_url); ?>" aria-label="Código QR del memorial"></div>
            <div style="min-width:0">
              <code class="jm-share__url"><?php echo esc_html($share_url); ?></code>
              <button type="button" class="jm-btn jm-btn--ghost jm-btn--sm" data-jm-copy="<?php echo esc_attr($share_url); ?>">Copiar enlace</button>
            </div>
          </div>
          <p class="jm-small jm-muted" style="margin-top:14px;margin-bottom:0">
            <?php echo (int) $memorial->views; ?> visitas · <?php echo count($photos); ?> fotos · <?php echo count($messages); ?> mensajes · <?php echo (int) $candles; ?> velas
          </p>
        </div>
      </aside>
    </div>

    <?php if ($photos) : ?>
      <section class="jm-section" id="fotos">
        <div class="jm-section-head">
          <h2>Fotos</h2>
          <span class="jm-small jm-muted"><?php echo count($photos); ?> recuerdos</span>
        </div>
        <div class="jm-gallery">
          <?php foreach ($photos as $photo) :
              $full = JM_Media::url($photo->attachment_id, 'large');
              $thumb = JM_Media::url($photo->attachment_id, 'medium');
              ?>
            <figure class="jm-gallery__item">
              <img src="<?php echo esc_url($thumb); ?>" alt="<?php echo esc_attr($photo->caption ? $photo->caption : $memorial->full_name); ?>"
                   loading="lazy" data-jm-zoom="<?php echo esc_url($full); ?>">
              <?php if ($photo->caption) : ?>
                <figcaption><?php echo esc_html($photo->caption); ?></figcaption>
              <?php endif; ?>
            </figure>
          <?php endforeach; ?>
        </div>
      </section>
    <?php endif; ?>

    <section class="jm-section" id="velas">
      <div class="jm-section-head">
        <h2>Velas encendidas</h2>
        <span class="jm-small jm-muted"><?php echo (int) $candles; ?> en total</span>
      </div>
      <div class="jm-candles">
        <span aria-hidden="true" style="font-size:1.6rem">🕯️</span>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0">
          <?php wp_nonce_field('jm_vela'); ?>
          <input type="hidden" name="action" value="jm_vela">
          <input type="hidden" name="memorial_id" value="<?php echo (int) $memorial->id; ?>">
          <input class="jm-input" type="text" name="name" maxlength="80" placeholder="Tu nombre (opcional)" style="max-width:240px">
          <button class="jm-btn jm-btn--sm" type="submit">Encender una vela</button>
        </form>
      </div>
    </section>

    <?php if ($memorial->allow_guestbook) : ?>
      <section class="jm-section" id="libro">
        <div class="jm-section-head">
          <h2>Libro de visitas</h2>
          <span class="jm-small jm-muted"><?php echo count($messages); ?> mensajes</span>
        </div>

        <?php if ($messages) : ?>
          <div class="jm-messages">
            <?php foreach ($messages as $message) : ?>
              <article class="jm-message">
                <div class="jm-message__head">
                  <span class="jm-message__name"><?php echo esc_html($message->name); ?><?php echo $message->city ? ' · ' . esc_html($message->city) : ''; ?></span>
                  <span><?php echo esc_html(JM_Util::short_date($message->created_at)); ?><?php echo $message->candle ? ' · 🕯️' : ''; ?></span>
                </div>
                <p class="jm-message__text"><?php echo nl2br(esc_html($message->message)); ?></p>
              </article>
            <?php endforeach; ?>
          </div>
        <?php else : ?>
          <div class="jm-empty">Todavía no hay mensajes. Sé la primera persona en dejar uno.</div>
        <?php endif; ?>

        <div class="jm-card" style="margin-top:22px">
          <h3 style="margin-top:0;font-family:var(--serif);font-weight:400">Deja un mensaje</h3>
          <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <?php wp_nonce_field('jm_mensaje'); ?>
            <input type="hidden" name="action" value="jm_mensaje">
            <input type="hidden" name="memorial_id" value="<?php echo (int) $memorial->id; ?>">
            <input class="jm-hp" type="text" name="jm_hp" value="" tabindex="-1" autocomplete="off" aria-hidden="true">

            <div class="jm-grid-2">
              <div class="jm-field">
                <label for="jm-name">Tu nombre</label>
                <input class="jm-input" id="jm-name" type="text" name="name" maxlength="80" required>
              </div>
              <div class="jm-field">
                <label for="jm-city">Ciudad (opcional)</label>
                <input class="jm-input" id="jm-city" type="text" name="city" maxlength="80">
              </div>
            </div>

            <div class="jm-field">
              <label for="jm-message">Tu mensaje</label>
              <textarea class="jm-textarea" id="jm-message" name="message" maxlength="1200" required data-jm-maxlength="1200" data-jm-counter="#jm-counter"></textarea>
              <span class="jm-hint" id="jm-counter"></span>
            </div>

            <label class="jm-check">
              <input type="checkbox" name="candle" value="1">
              <span>Encender también una vela</span>
            </label>

            <button class="jm-btn" type="submit">Publicar mensaje</button>
          </form>
        </div>
      </section>
    <?php endif; ?>

    <p class="jm-small jm-muted" style="margin:40px 0 20px;text-align:center">
      Memorial cuidado por su familia en Jardín Memorial · <a href="<?php echo esc_url(JM_Util::page_url('listado')); ?>">Ver todos los memoriales</a>
    </p>
  </div>

  <div class="jm-lightbox" data-jm-lightbox data-open="0" role="dialog" aria-modal="true" aria-label="Foto ampliada">
    <button type="button" class="jm-lightbox__close" aria-label="Cerrar">×</button>
    <img src="" alt="">
  </div>

  <?php if ($music) : ?>
    <div class="jm-audio" data-jm-audio>
      <audio src="<?php echo esc_url($music); ?>" loop preload="none"></audio>
      <span>Música del memorial</span>
      <button type="button" data-jm-audio-toggle aria-label="Reproducir música">▶</button>
    </div>
  <?php endif; ?>
</main>
<?php
get_footer();
