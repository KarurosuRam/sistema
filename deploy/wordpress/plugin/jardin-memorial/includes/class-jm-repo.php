<?php
/**
 * Acceso a datos. Todas las consultas pasan por $wpdb con marcadores, así que
 * no se interpola nada escrito por el visitante.
 */

if (!defined('ABSPATH')) {
    exit;
}

class JM_Repo
{
    /* ------------------------------------------------------------ memorials */

    public static function memorial_table()
    {
        return JM_DB::table('memorials');
    }

    public static function find_memorial($id)
    {
        global $wpdb;
        $table = self::memorial_table();
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", (int) $id));
    }

    public static function find_memorial_by_slug($slug)
    {
        global $wpdb;
        $table = self::memorial_table();
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE slug = %s", (string) $slug));
    }

    public static function find_memorial_by_certificate($code)
    {
        global $wpdb;
        $table = self::memorial_table();
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE certificate_code = %s", (string) $code));
    }

    public static function insert_memorial(array $data)
    {
        global $wpdb;
        $now = current_time('mysql');
        $row = array(
            'user_id' => (int) $data['user_id'],
            'slug' => (string) $data['slug'],
            'certificate_code' => (string) $data['certificate_code'],
            'kind' => $data['kind'] === 'mascota' ? 'mascota' : 'persona',
            'full_name' => (string) $data['full_name'],
            'relationship' => isset($data['relationship']) ? (string) $data['relationship'] : '',
            'birth_date' => !empty($data['birth_date']) ? (string) $data['birth_date'] : null,
            'death_date' => !empty($data['death_date']) ? (string) $data['death_date'] : null,
            'epitaph' => isset($data['epitaph']) ? (string) $data['epitaph'] : '',
            'biography' => isset($data['biography']) ? (string) $data['biography'] : '',
            'theme' => isset($data['theme']) ? (string) $data['theme'] : 'jardin',
            'is_public' => !empty($data['is_public']) ? 1 : 0,
            'allow_guestbook' => !empty($data['allow_guestbook']) ? 1 : 0,
            'views' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        );
        $wpdb->insert(self::memorial_table(), $row);
        return (int) $wpdb->insert_id;
    }

    public static function update_memorial($id, array $fields)
    {
        global $wpdb;
        $fields['updated_at'] = current_time('mysql');
        return $wpdb->update(self::memorial_table(), $fields, array('id' => (int) $id));
    }

    public static function delete_memorial($id)
    {
        global $wpdb;
        $photos = JM_DB::table('photos');
        $guestbook = JM_DB::table('guestbook');
        $candles = JM_DB::table('candles');
        $memorials = self::memorial_table();

        $attachments = $wpdb->get_col($wpdb->prepare("SELECT attachment_id FROM $photos WHERE memorial_id = %d", (int) $id));
        $cover = $wpdb->get_var($wpdb->prepare("SELECT cover_id FROM $memorials WHERE id = %d", (int) $id));
        if ($cover) {
            $attachments[] = (int) $cover;
        }
        $music = $wpdb->get_var($wpdb->prepare("SELECT music_id FROM $memorials WHERE id = %d", (int) $id));
        $video = $wpdb->get_var($wpdb->prepare("SELECT video_id FROM $memorials WHERE id = %d", (int) $id));
        if ($music) {
            $attachments[] = (int) $music;
        }
        if ($video) {
            $attachments[] = (int) $video;
        }

        $wpdb->delete($photos, array('memorial_id' => (int) $id));
        $wpdb->delete($guestbook, array('memorial_id' => (int) $id));
        $wpdb->delete($candles, array('memorial_id' => (int) $id));
        $wpdb->delete($memorials, array('id' => (int) $id));

        foreach (array_unique(array_filter($attachments)) as $attachment_id) {
            wp_delete_attachment((int) $attachment_id, true);
        }
    }

    public static function memorials_by_user($user_id, $limit = 100)
    {
        global $wpdb;
        $table = self::memorial_table();
        return $wpdb->get_results(
            $wpdb->prepare("SELECT * FROM $table WHERE user_id = %d ORDER BY created_at DESC LIMIT %d", (int) $user_id, (int) $limit)
        );
    }

    public static function public_memorials($limit = 24, $offset = 0, $search = '', $kind = '')
    {
        global $wpdb;
        $table = self::memorial_table();
        $where = 'is_public = 1';
        $params = array();

        if ($search !== '') {
            $where .= ' AND full_name LIKE %s';
            $params[] = '%' . $wpdb->esc_like($search) . '%';
        }
        if ($kind === 'persona' || $kind === 'mascota') {
            $where .= ' AND kind = %s';
            $params[] = $kind;
        }

        $sql = "SELECT * FROM $table WHERE $where ORDER BY created_at DESC LIMIT %d OFFSET %d";
        $params[] = (int) $limit;
        $params[] = (int) $offset;
        return $wpdb->get_results($wpdb->prepare($sql, $params));
    }

    public static function count_public_memorials($search = '', $kind = '')
    {
        global $wpdb;
        $table = self::memorial_table();
        $where = 'is_public = 1';
        $params = array();

        if ($search !== '') {
            $where .= ' AND full_name LIKE %s';
            $params[] = '%' . $wpdb->esc_like($search) . '%';
        }
        if ($kind === 'persona' || $kind === 'mascota') {
            $where .= ' AND kind = %s';
            $params[] = $kind;
        }

        $sql = "SELECT COUNT(*) FROM $table WHERE $where";
        if ($params) {
            $sql = $wpdb->prepare($sql, $params);
        }
        return (int) $wpdb->get_var($sql);
    }

    public static function increment_views($id)
    {
        global $wpdb;
        $table = self::memorial_table();
        $wpdb->query($wpdb->prepare("UPDATE $table SET views = views + 1 WHERE id = %d", (int) $id));
    }

    public static function slug_exists($slug, $except_id = 0)
    {
        global $wpdb;
        $table = self::memorial_table();
        $found = $wpdb->get_var(
            $wpdb->prepare("SELECT id FROM $table WHERE slug = %s AND id <> %d", (string) $slug, (int) $except_id)
        );
        return (bool) $found;
    }

    /** Slug único a partir del nombre: "Rosa Elena Muñoz" → rosa-elena-munoz. */
    public static function unique_slug($base)
    {
        $root = JM_Util::slugify($base);
        if ($root === '') {
            $root = 'memorial';
        }
        $root = substr($root, 0, 70);
        $candidate = $root;
        $attempt = 0;
        while (self::slug_exists($candidate)) {
            $attempt++;
            $candidate = $root . '-' . strtolower(JM_Util::random_code(4));
            if ($attempt > 40) {
                $candidate = $root . '-' . time();
                break;
            }
        }
        return $candidate;
    }

    /* --------------------------------------------------------------- photos */

    public static function photos($memorial_id)
    {
        global $wpdb;
        $table = JM_DB::table('photos');
        return $wpdb->get_results(
            $wpdb->prepare("SELECT * FROM $table WHERE memorial_id = %d ORDER BY position ASC, id ASC", (int) $memorial_id)
        );
    }

    public static function count_photos($memorial_id)
    {
        global $wpdb;
        $table = JM_DB::table('photos');
        return (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM $table WHERE memorial_id = %d", (int) $memorial_id)
        );
    }

    public static function add_photo($memorial_id, $attachment_id, $caption = '')
    {
        global $wpdb;
        $table = JM_DB::table('photos');
        $position = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COALESCE(MAX(position), 0) + 1 FROM $table WHERE memorial_id = %d", (int) $memorial_id)
        );
        $wpdb->insert($table, array(
            'memorial_id' => (int) $memorial_id,
            'attachment_id' => (int) $attachment_id,
            'caption' => (string) $caption,
            'position' => $position,
            'created_at' => current_time('mysql'),
        ));
        return (int) $wpdb->insert_id;
    }

    public static function find_photo($id)
    {
        global $wpdb;
        $table = JM_DB::table('photos');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", (int) $id));
    }

    public static function delete_photo($id)
    {
        global $wpdb;
        $photo = self::find_photo($id);
        if (!$photo) {
            return;
        }
        $wpdb->delete(JM_DB::table('photos'), array('id' => (int) $id));
        wp_delete_attachment((int) $photo->attachment_id, true);
    }

    public static function move_photo($id, $direction)
    {
        global $wpdb;
        $table = JM_DB::table('photos');
        $photo = self::find_photo($id);
        if (!$photo) {
            return;
        }
        $operator = $direction === 'up' ? '<' : '>';
        $order = $direction === 'up' ? 'DESC' : 'ASC';
        $neighbour = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE memorial_id = %d AND position $operator %d ORDER BY position $order LIMIT 1",
            (int) $photo->memorial_id,
            (int) $photo->position
        ));
        if (!$neighbour) {
            return;
        }
        $wpdb->update($table, array('position' => (int) $neighbour->position), array('id' => (int) $photo->id));
        $wpdb->update($table, array('position' => (int) $photo->position), array('id' => (int) $neighbour->id));
    }

    /* ------------------------------------------------------------ guestbook */

    public static function guestbook($memorial_id, $include_hidden = false, $limit = 200)
    {
        global $wpdb;
        $table = JM_DB::table('guestbook');
        $where = $include_hidden ? '' : ' AND hidden = 0';
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE memorial_id = %d$where ORDER BY created_at DESC LIMIT %d",
            (int) $memorial_id,
            (int) $limit
        ));
    }

    public static function count_messages($memorial_id)
    {
        global $wpdb;
        $table = JM_DB::table('guestbook');
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table WHERE memorial_id = %d AND hidden = 0",
            (int) $memorial_id
        ));
    }

    public static function add_message($memorial_id, $name, $city, $message, $candle = 0)
    {
        global $wpdb;
        $wpdb->insert(JM_DB::table('guestbook'), array(
            'memorial_id' => (int) $memorial_id,
            'name' => (string) $name,
            'city' => (string) $city,
            'message' => (string) $message,
            'candle' => $candle ? 1 : 0,
            'hidden' => 0,
            'created_at' => current_time('mysql'),
        ));
        return (int) $wpdb->insert_id;
    }

    public static function find_message($id)
    {
        global $wpdb;
        $table = JM_DB::table('guestbook');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", (int) $id));
    }

    public static function latest_messages($user_id, $limit = 50)
    {
        global $wpdb;
        $guestbook = JM_DB::table('guestbook');
        $memorials = self::memorial_table();
        return $wpdb->get_results($wpdb->prepare(
            "SELECT g.*, m.full_name, m.slug FROM $guestbook g
               JOIN $memorials m ON m.id = g.memorial_id
              WHERE m.user_id = %d
              ORDER BY g.created_at DESC LIMIT %d",
            (int) $user_id,
            (int) $limit
        ));
    }

    public static function hide_message($id, $hidden = 1)
    {
        global $wpdb;
        return $wpdb->update(JM_DB::table('guestbook'), array('hidden' => $hidden ? 1 : 0), array('id' => (int) $id));
    }

    public static function delete_message($id)
    {
        global $wpdb;
        return $wpdb->delete(JM_DB::table('guestbook'), array('id' => (int) $id));
    }

    /* -------------------------------------------------------------- candles */

    public static function add_candle($memorial_id, $name = '')
    {
        global $wpdb;
        $wpdb->insert(JM_DB::table('candles'), array(
            'memorial_id' => (int) $memorial_id,
            'name' => (string) $name,
            'created_at' => current_time('mysql'),
        ));
        return (int) $wpdb->insert_id;
    }

    public static function count_candles($memorial_id)
    {
        global $wpdb;
        $table = JM_DB::table('candles');
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table WHERE memorial_id = %d",
            (int) $memorial_id
        ));
    }

    /* ------------------------------------------------------------ purchases */

    public static function insert_purchase(array $data)
    {
        global $wpdb;
        $now = current_time('mysql');
        $wpdb->insert(JM_DB::table('purchases'), array(
            'user_id' => (int) $data['user_id'],
            'plan' => (string) $data['plan'],
            'plan_name' => (string) $data['plan_name'],
            'amount' => (int) $data['amount'],
            'credits' => (int) $data['credits'],
            'reference' => (string) $data['reference'],
            'status' => isset($data['status']) ? (string) $data['status'] : 'pendiente',
            'mode' => isset($data['mode']) ? (string) $data['mode'] : 'demo',
            'provider_order' => isset($data['provider_order']) ? $data['provider_order'] : null,
            'payer_email' => isset($data['payer_email']) ? $data['payer_email'] : null,
            'paid_at' => isset($data['paid_at']) ? $data['paid_at'] : null,
            'created_at' => isset($data['created_at']) ? $data['created_at'] : $now,
            'updated_at' => isset($data['updated_at']) ? $data['updated_at'] : $now,
        ));
        return (int) $wpdb->insert_id;
    }

    public static function find_purchase($reference)
    {
        global $wpdb;
        $table = JM_DB::table('purchases');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE reference = %s", (string) $reference));
    }

    public static function purchases_by_user($user_id, $limit = 100)
    {
        global $wpdb;
        $table = JM_DB::table('purchases');
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE user_id = %d ORDER BY created_at DESC LIMIT %d",
            (int) $user_id,
            (int) $limit
        ));
    }

    public static function recent_purchases($limit = 30)
    {
        global $wpdb;
        $table = JM_DB::table('purchases');
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table ORDER BY created_at DESC LIMIT %d",
            (int) $limit
        ));
    }

    public static function update_purchase($reference, array $fields)
    {
        global $wpdb;
        $fields['updated_at'] = current_time('mysql');
        return $wpdb->update(JM_DB::table('purchases'), $fields, array('reference' => (string) $reference));
    }

    public static function purchase_totals()
    {
        global $wpdb;
        $table = JM_DB::table('purchases');
        $row = $wpdb->get_row(
            "SELECT COUNT(*) AS total,
                    COALESCE(SUM(CASE WHEN status = 'pagado' THEN amount ELSE 0 END), 0) AS amount_paid,
                    COALESCE(SUM(CASE WHEN status = 'pagado' THEN credits ELSE 0 END), 0) AS credits_sold,
                    COALESCE(SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END), 0) AS pending,
                    COALESCE(SUM(CASE WHEN status = 'reembolsado' THEN 1 ELSE 0 END), 0) AS refunded,
                    COALESCE(SUM(CASE WHEN status = 'reembolsado' THEN amount ELSE 0 END), 0) AS amount_refunded
               FROM $table"
        );
        return $row ? $row : (object) array('total' => 0, 'amount_paid' => 0, 'credits_sold' => 0, 'pending' => 0, 'refunded' => 0, 'amount_refunded' => 0);
    }

    /* --------------------------------------------------------------- límites */

    /** Cuenta un intento y dice si sigue dentro del límite. */
    public static function rate_hit($bucket, $ip_hash, $max, $window_seconds)
    {
        global $wpdb;
        $table = JM_DB::table('rate');
        $now = current_time('mysql', true);
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE bucket = %s AND ip_hash = %s",
            (string) $bucket,
            (string) $ip_hash
        ));

        if (!$row) {
            $wpdb->insert($table, array(
                'bucket' => (string) $bucket,
                'ip_hash' => (string) $ip_hash,
                'hits' => 1,
                'window_start' => $now,
            ));
            return true;
        }

        $elapsed = strtotime($now) - strtotime($row->window_start);
        if ($elapsed > $window_seconds) {
            $wpdb->update($table, array('hits' => 1, 'window_start' => $now), array('id' => (int) $row->id));
            return true;
        }

        if ((int) $row->hits >= $max) {
            return false;
        }

        $wpdb->update($table, array('hits' => (int) $row->hits + 1), array('id' => (int) $row->id));
        return true;
    }
}
