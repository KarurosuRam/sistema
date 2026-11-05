<?php
/**
 * Mi jardín: lista de memoriales, creación, edición y mensajes.
 * Una sola plantilla con secciones; la pestaña activa llega por ?tab=.
 */

if (!defined('ABSPATH')) {
    exit;
}

$flash = isset($jm_flash) ? $jm_flash : array();
$memorials = isset($memorials) ? $memorials : array();
$purchases = isset($purchases) ? $purchases : array();
$messages = isset($messages) ? $messages : array();
$credits = isset($jm_credits) ? (int) $jm_credits : 0;

$editing_id = isset($_GET['m']) ? (int) $_GET['m'] : 0;
$editing = $editing_id ? JM_Repo::find_memorial($editing_id) : null;
$is_new = isset($_GET['nuevo']);
$recall = JM_Util::recall();
$form_errors = isset($recall['errors']) ? $recall['errors'] : array();
$form_values = isset($recall['values']) ? $recall['values'] : array();
$tab = isset($_GET['tab']) ? sanitize_key(wp_unslash($_GET['tab'])) : 'datos';

$user = wp_get_current_user();
$themes = array(
    'jardin' => 'Jardín',
    'bosque' => 'Bosque',
    'cielo' => 'Cielo',
    'arena' => 'Arena',
    'noche' => 'Noche',
);

$jm_form_action = esc_url(admin_url('admin-post.php'));
?>
<div class="jm-wrap">
  <?php foreach ($flash as $notice) : ?>
    <div class="jm-flash jm-flash--<?php echo esc_attr($notice['type']); ?>"><?php echo esc_html($notice['message']); ?></div>
  <?php endforeach; ?>

  <div class="jm-dash-head">
    <div>
      <p class="jm-eyebrow">Mi jardín</p>
      <h1 class="jm-title" style="font-size:2.2rem">Hola, <?php echo esc_html($user->display_name); ?></h1>
      <p class="jm-lede" style="margin-bottom:0">Un espacio para cuidar los recuerdos de quienes quieres.</p>
    </div>
    <div class="jm-actions">
      <a class="jm-btn jm-btn--ghost" href="<?php echo esc_url(JM_Util::page_url('planes')); ?>">Comprar memoriales</a>
      <?php if ($credits > 0) : ?>
        <a class="jm-btn" href="<?php echo esc_url(add_query_arg('nuevo', '1', JM_Util::page_url('panel'))); ?>">Crear memorial</a>
      <?php endif; ?>
      <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin:0">
        <?php wp_nonce_field('jm_salir'); ?>
        <input type="hidden" name="action" value="jm_salir">
        <button class="jm-btn jm-btn--ghost" type="submit">Cerrar sesión</button>
      </form>
    </div>
  </div>

  <div class="jm-stats">
    <div class="jm-stat">
      <span class="jm-stat__value"><?php echo count($memorials); ?></span>
      <span class="jm-stat__label">Memoriales</span>
    </div>
    <div class="jm-stat">
      <span class="jm-stat__value"><?php echo $credits; ?></span>
      <span class="jm-stat__label">Para crear</span>
    </div>
    <div class="jm-stat">
      <span class="jm-stat__value"><?php echo count($messages); ?></span>
      <span class="jm-stat__label">Mensajes recientes</span>
    </div>
    <div class="jm-stat">
      <span class="jm-stat__value"><?php echo count($purchases); ?></span>
      <span class="jm-stat__label">Compras</span>
    </div>
  </div>

  <?php if ($is_new) : ?>
    <!-- ------------------------------------------------------------ crear -->
    <section class="jm-section">
      <div class="jm-section-head"><h2>Nuevo memorial</h2>
        <a class="jm-btn jm-btn--ghost jm-btn--sm" href="<?php echo esc_url(JM_Util::page_url('panel')); ?>">Volver</a>
      </div>

      <?php if ($form_errors) : ?>
        <div class="jm-errors"><ul><?php foreach ($form_errors as $e) : ?><li><?php echo esc_html($e); ?></li><?php endforeach; ?></ul></div>
      <?php endif; ?>

      <form class="jm-card" method="post" action="<?php echo $jm_form_action; ?>" enctype="multipart/form-data">
        <?php wp_nonce_field('jm_crear_memorial'); ?>
        <input type="hidden" name="action" value="jm_crear_memorial">

        <?php include JM_DIR . 'templates/parts/memorial-form.php'; ?>

        <button class="jm-btn" type="submit">Crear memorial</button>
        <span class="jm-hint">Se usará 1 de tus <?php echo $credits; ?> memoriales disponibles.</span>
      </form>
    </section>

  <?php elseif ($editing && JM_Util::is_owner($editing)) :
      $photos = JM_Repo::photos($editing->id);
      $editing_messages = JM_Repo::guestbook($editing->id, true, 200);
      $cover = $editing->cover_id ? JM_Media::url($editing->cover_id, 'medium') : '';
      $music = $editing->music_id ? JM_Media::url($editing->music_id, 'full') : '';
      $video = $editing->video_id ? JM_Media::url($editing->video_id, 'full') : '';
      $tabs = array(
          'datos' => 'Datos',
          'fotos' => 'Fotos',
          'musica' => 'Música',
          'video' => 'Video',
          'mensajes' => 'Mensajes',
          'ajustes' => 'Ajustes',
      );
      ?>
    <!-- ------------------------------------------------------------ editar -->
    <section class="jm-section">
      <div class="jm-section-head">
        <h2><?php echo esc_html($editing->full_name); ?></h2>
        <div class="jm-actions">
          <a class="jm-btn jm-btn--ghost jm-btn--sm" href="<?php echo esc_url(JM_Util::memorial_url($editing)); ?>">Ver público</a>
          <a class="jm-btn jm-btn--ghost jm-btn--sm" href="<?php echo esc_url(add_query_arg('codigo', $editing->certificate_code, JM_Util::page_url('certificado'))); ?>">Certificado</a>
          <a class="jm-btn jm-btn--ghost jm-btn--sm" href="<?php echo esc_url(JM_Util::page_url('panel')); ?>">Volver</a>
        </div>
      </div>

      <nav class="jm-tabs">
        <?php foreach ($tabs as $key => $label) : ?>
          <a class="jm-tab" aria-current="<?php echo $tab === $key ? 'page' : 'false'; ?>"
             href="<?php echo esc_url(add_query_arg(array('m' => (int) $editing->id, 'tab' => $key), JM_Util::page_url('panel'))); ?>"><?php echo esc_html($label); ?></a>
        <?php endforeach; ?>
      </nav>

      <?php if ($tab === 'datos') : ?>
        <form class="jm-card" method="post" action="<?php echo $jm_form_action; ?>" enctype="multipart/form-data">
          <?php wp_nonce_field('jm_editar_memorial'); ?>
          <input type="hidden" name="action" value="jm_editar_memorial">
          <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
          <?php
          $form_values = array(
              'kind' => $editing->kind,
              'full_name' => $editing->full_name,
              'relationship' => $editing->relationship,
              'birth_date' => $editing->birth_date,
              'death_date' => $editing->death_date,
              'epitaph' => $editing->epitaph,
              'biography' => $editing->biography,
              'theme' => $editing->theme,
              'is_public' => $editing->is_public,
              'allow_guestbook' => $editing->allow_guestbook,
          );
          include JM_DIR . 'templates/parts/memorial-form.php';
          ?>
          <button class="jm-btn" type="submit">Guardar cambios</button>
        </form>

        <div class="jm-card" style="margin-top:18px">
          <h3 style="margin-top:0;font-family:var(--serif);font-weight:400">Enlace y QR</h3>
          <code class="jm-share__url"><?php echo esc_html(JM_Util::memorial_url($editing)); ?></code>
          <div class="jm-actions">
            <button class="jm-btn jm-btn--ghost jm-btn--sm" type="button" data-jm-copy="<?php echo esc_attr(JM_Util::memorial_url($editing)); ?>">Copiar enlace</button>
          </div>
        </div>

      <?php elseif ($tab === 'fotos') : ?>
        <div class="jm-card">
          <p class="jm-small jm-muted"><?php echo count($photos); ?> de <?php echo JM_Media::PHOTOS_POR_MEMORIAL; ?> fotos. La portada es la que se ve al abrir el memorial.</p>

          <div class="jm-gallery" style="margin:14px 0 22px">
            <?php foreach ($photos as $photo) : ?>
              <figure class="jm-gallery__item">
                <img src="<?php echo esc_url(JM_Media::url($photo->attachment_id, 'medium')); ?>" alt="">
                <div style="padding:10px;display:flex;flex-wrap:wrap;gap:6px">
                  <?php if ((int) $editing->cover_id === (int) $photo->attachment_id) : ?>
                    <span class="jm-badge">Portada</span>
                  <?php else : ?>
                    <form method="post" action="<?php echo $jm_form_action; ?>" style="margin:0">
                      <?php wp_nonce_field('jm_portada'); ?>
                      <input type="hidden" name="action" value="jm_portada">
                      <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
                      <input type="hidden" name="photo_id" value="<?php echo (int) $photo->id; ?>">
                      <button class="jm-btn jm-btn--ghost jm-btn--sm" type="submit">Portada</button>
                    </form>
                  <?php endif; ?>

                  <form method="post" action="<?php echo $jm_form_action; ?>" style="margin:0">
                    <?php wp_nonce_field('jm_mover_foto'); ?>
                    <input type="hidden" name="action" value="jm_mover_foto">
                    <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
                    <input type="hidden" name="photo_id" value="<?php echo (int) $photo->id; ?>">
                    <input type="hidden" name="direction" value="up">
                    <button class="jm-btn jm-btn--ghost jm-btn--sm" type="submit" aria-label="Mover antes">↑</button>
                  </form>

                  <form method="post" action="<?php echo $jm_form_action; ?>" style="margin:0">
                    <?php wp_nonce_field('jm_mover_foto'); ?>
                    <input type="hidden" name="action" value="jm_mover_foto">
                    <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
                    <input type="hidden" name="photo_id" value="<?php echo (int) $photo->id; ?>">
                    <input type="hidden" name="direction" value="down">
                    <button class="jm-btn jm-btn--ghost jm-btn--sm" type="submit" aria-label="Mover después">↓</button>
                  </form>

                  <form method="post" action="<?php echo $jm_form_action; ?>" style="margin:0" data-jm-confirm="¿Eliminar esta foto? No se puede deshacer.">
                    <?php wp_nonce_field('jm_borrar_foto'); ?>
                    <input type="hidden" name="action" value="jm_borrar_foto">
                    <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
                    <input type="hidden" name="photo_id" value="<?php echo (int) $photo->id; ?>">
                    <button class="jm-btn jm-btn--danger jm-btn--sm" type="submit">Borrar</button>
                  </form>
                </div>
              </figure>
            <?php endforeach; ?>
          </div>

          <?php if (count($photos) < JM_Media::PHOTOS_POR_MEMORIAL) : ?>
            <form method="post" action="<?php echo $jm_form_action; ?>" enctype="multipart/form-data">
              <?php wp_nonce_field('jm_subir_foto'); ?>
              <input type="hidden" name="action" value="jm_subir_foto">
              <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
              <div class="jm-grid-2">
                <div class="jm-field">
                  <label for="jm-photo">Agregar una foto</label>
                  <input class="jm-input" id="jm-photo" type="file" name="photo" accept="image/jpeg,image/png,image/webp" required>
                  <span class="jm-hint">JPG, PNG o WebP · hasta <?php echo JM_Media::MAX_PHOTO_MB; ?> MB · mínimo 300 × 300 px</span>
                </div>
                <div class="jm-field">
                  <label for="jm-caption">Pie de foto (opcional)</label>
                  <input class="jm-input" id="jm-caption" type="text" name="caption" maxlength="160">
                </div>
              </div>
              <button class="jm-btn" type="submit">Subir foto</button>
            </form>
          <?php endif; ?>
        </div>

      <?php elseif ($tab === 'musica') : ?>
        <div class="jm-card">
          <h3 style="margin-top:0;font-family:var(--serif);font-weight:400">Música del memorial</h3>
          <p class="jm-small jm-muted">Suena de fondo cuando alguien abre el memorial. Un archivo de hasta <?php echo JM_Media::MAX_AUDIO_MB; ?> MB.</p>

          <?php if ($music) : ?>
            <audio controls src="<?php echo esc_url($music); ?>" style="width:100%;margin:12px 0"></audio>
            <form method="post" action="<?php echo $jm_form_action; ?>" style="margin:0 0 16px" data-jm-confirm="¿Quitar la música personalizada?">
              <?php wp_nonce_field('jm_quitar_musica'); ?>
              <input type="hidden" name="action" value="jm_quitar_musica">
              <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
              <button class="jm-btn jm-btn--danger jm-btn--sm" type="submit">Quitar música</button>
            </form>
          <?php endif; ?>

          <form method="post" action="<?php echo $jm_form_action; ?>" enctype="multipart/form-data">
            <?php wp_nonce_field('jm_subir_musica'); ?>
            <input type="hidden" name="action" value="jm_subir_musica">
            <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
            <div class="jm-field">
              <label for="jm-audio">Archivo de audio</label>
              <input class="jm-input" id="jm-audio" type="file" name="audio" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav" required>
            </div>
            <button class="jm-btn" type="submit"><?php echo $music ? 'Reemplazar música' : 'Subir música'; ?></button>
          </form>
        </div>

      <?php elseif ($tab === 'video') : ?>
        <div class="jm-card">
          <h3 style="margin-top:0;font-family:var(--serif);font-weight:400">Video del memorial</h3>
          <p class="jm-small jm-muted">Un video corto de hasta <?php echo JM_Media::VIDEO_SEGUNDOS; ?> segundos y <?php echo JM_Media::MAX_VIDEO_MB; ?> MB.</p>

          <?php if ($video) : ?>
            <video controls src="<?php echo esc_url($video); ?>" style="width:100%;border-radius:10px;margin:12px 0;background:#000"></video>
            <form method="post" action="<?php echo $jm_form_action; ?>" style="margin:0 0 16px" data-jm-confirm="¿Quitar el video del memorial?">
              <?php wp_nonce_field('jm_quitar_video'); ?>
              <input type="hidden" name="action" value="jm_quitar_video">
              <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
              <button class="jm-btn jm-btn--danger jm-btn--sm" type="submit">Quitar video</button>
            </form>
          <?php endif; ?>

          <form method="post" action="<?php echo $jm_form_action; ?>" enctype="multipart/form-data">
            <?php wp_nonce_field('jm_subir_video'); ?>
            <input type="hidden" name="action" value="jm_subir_video">
            <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
            <div class="jm-field">
              <label for="jm-video">Archivo de video</label>
              <input class="jm-input" id="jm-video" type="file" name="video" accept="video/mp4,video/webm,video/quicktime" required>
            </div>
            <button class="jm-btn" type="submit"><?php echo $video ? 'Reemplazar video' : 'Subir video'; ?></button>
          </form>
        </div>

      <?php elseif ($tab === 'mensajes') : ?>
        <div class="jm-card">
          <p class="jm-small jm-muted">Oculta un mensaje para que no se vea en el memorial, o bórralo definitivamente.</p>
          <?php if (!$editing_messages) : ?>
            <div class="jm-empty">Todavía no hay mensajes en este memorial.</div>
          <?php else : ?>
            <div class="jm-messages" style="margin-top:14px">
              <?php foreach ($editing_messages as $message) : ?>
                <article class="jm-message">
                  <div class="jm-message__head">
                    <span class="jm-message__name"><?php echo esc_html($message->name); ?></span>
                    <span>
                      <?php echo esc_html(JM_Util::short_date($message->created_at)); ?>
                      <?php if ((int) $message->hidden === 1) : ?>
                        <span class="jm-badge jm-badge--clay">Oculto</span>
                      <?php endif; ?>
                    </span>
                  </div>
                  <p class="jm-message__text"><?php echo nl2br(esc_html($message->message)); ?></p>
                  <div class="jm-actions" style="margin-top:10px">
                    <form method="post" action="<?php echo $jm_form_action; ?>" style="margin:0">
                      <?php wp_nonce_field('jm_ocultar_mensaje'); ?>
                      <input type="hidden" name="action" value="jm_ocultar_mensaje">
                      <input type="hidden" name="message_id" value="<?php echo (int) $message->id; ?>">
                      <input type="hidden" name="visible" value="<?php echo (int) $message->hidden ? '1' : '0'; ?>">
                      <button class="jm-btn jm-btn--ghost jm-btn--sm" type="submit"><?php echo (int) $message->hidden ? 'Mostrar' : 'Ocultar'; ?></button>
                    </form>
                    <form method="post" action="<?php echo $jm_form_action; ?>" style="margin:0" data-jm-confirm="¿Eliminar definitivamente este mensaje?">
                      <?php wp_nonce_field('jm_borrar_mensaje'); ?>
                      <input type="hidden" name="action" value="jm_borrar_mensaje">
                      <input type="hidden" name="message_id" value="<?php echo (int) $message->id; ?>">
                      <button class="jm-btn jm-btn--danger jm-btn--sm" type="submit">Borrar</button>
                    </form>
                  </div>
                </article>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </div>

      <?php else : ?>
        <div class="jm-card">
          <h3 style="margin-top:0;font-family:var(--serif);font-weight:400">Zona delicada</h3>
          <p class="jm-small jm-muted">Si borras el memorial se borran también sus fotos, su música, su video y todos los mensajes. No se puede deshacer.</p>
          <form method="post" action="<?php echo $jm_form_action; ?>" data-jm-confirm="¿Estás seguro? El memorial y todos sus recuerdos se eliminarán para siempre.">
            <?php wp_nonce_field('jm_borrar_memorial'); ?>
            <input type="hidden" name="action" value="jm_borrar_memorial">
            <input type="hidden" name="memorial_id" value="<?php echo (int) $editing->id; ?>">
            <button class="jm-btn jm-btn--danger" type="submit">Eliminar el memorial</button>
          </form>
        </div>
      <?php endif; ?>
    </section>

  <?php else : ?>
    <!-- ---------------------------------------------------------- listado -->
    <section class="jm-section">
      <div class="jm-section-head">
        <h2>Mis memoriales</h2>
        <?php if ($credits > 0) : ?>
          <a class="jm-btn jm-btn--sm" href="<?php echo esc_url(add_query_arg('nuevo', '1', JM_Util::page_url('panel'))); ?>">Crear memorial</a>
        <?php endif; ?>
      </div>

      <?php if (!$memorials) : ?>
        <div class="jm-empty">
          <p style="margin:0 0 14px">Todavía no tienes memoriales.</p>
          <a class="jm-btn" href="<?php echo esc_url(JM_Util::page_url('planes')); ?>">Elegir un plan</a>
        </div>
      <?php else : ?>
        <div class="jm-list">
          <?php foreach ($memorials as $memorial) :
              $thumb = $memorial->cover_id ? JM_Media::url($memorial->cover_id, 'thumbnail') : '';
              $range = JM_Util::life_range($memorial);
              ?>
            <div class="jm-item">
              <?php if ($thumb) : ?>
                <img class="jm-item__thumb" src="<?php echo esc_url($thumb); ?>" alt="">
              <?php else : ?>
                <span class="jm-item__thumb" aria-hidden="true"></span>
              <?php endif; ?>
              <div class="jm-item__body">
                <h3 class="jm-item__title"><?php echo esc_html($memorial->full_name); ?></h3>
                <p class="jm-item__meta">
                  <?php echo esc_html($range ? $range . ' · ' : ''); ?>
                  <?php echo $memorial->is_public ? 'Público' : 'Privado'; ?> ·
                  <?php echo (int) $memorial->views; ?> visitas ·
                  <?php echo JM_Repo::count_photos($memorial->id); ?> fotos
                </p>
              </div>
              <div class="jm-actions">
                <a class="jm-btn jm-btn--ghost jm-btn--sm" href="<?php echo esc_url(JM_Util::memorial_url($memorial)); ?>">Ver</a>
                <a class="jm-btn jm-btn--sm" href="<?php echo esc_url(add_query_arg('m', (int) $memorial->id, JM_Util::page_url('panel'))); ?>">Administrar</a>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </section>

    <section class="jm-section">
      <div class="jm-section-head"><h2>Mis compras</h2></div>
      <?php if (!$purchases) : ?>
        <div class="jm-empty">Aún no has comprado memoriales.</div>
      <?php else : ?>
        <div class="jm-table-wrap">
          <table class="jm-table">
            <thead>
              <tr><th>Fecha</th><th>Plan</th><th>Monto</th><th>Estado</th><th>Referencia</th><th></th></tr>
            </thead>
            <tbody>
              <?php foreach ($purchases as $purchase) : ?>
                <tr>
                  <td><?php echo esc_html(JM_Util::short_date($purchase->created_at)); ?></td>
                  <td><?php echo esc_html($purchase->plan_name); ?></td>
                  <td><?php echo esc_html(JM_Util::clp($purchase->amount)); ?></td>
                  <td>
                    <span class="jm-badge <?php echo in_array($purchase->status, array('pagado'), true) ? '' : 'jm-badge--gold'; ?>">
                      <?php echo esc_html(JM_Admin::estado_label($purchase->status)); ?>
                    </span>
                  </td>
                  <td><?php echo esc_html($purchase->reference); ?></td>
                  <td><a class="jm-btn jm-btn--ghost jm-btn--sm" href="<?php echo esc_url(JM_Payments::receipt_url($purchase)); ?>">Ver</a></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </section>
  <?php endif; ?>
</div>
