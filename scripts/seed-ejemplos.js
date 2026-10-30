'use strict';

/**
 * Crea los memoriales de ejemplo de Jardín Memorial.
 *
 * Uso:
 *   npm run seed-ejemplos
 *
 * Deja una cuenta con un pack de 4 comprado y cuatro memoriales completos:
 * foto principal, galería, música al abrir, libro de visitas y velas.
 * Sirve para revisar el sitio con contenido realista en una instalación vacía,
 * por ejemplo en una vista previa temporal o en un entorno de prueba.
 *
 * Es idempotente: si la cuenta ya existe, no duplica nada.
 */

const fs = require('fs');
const path = require('path');

const config = require('../src/config');
const store = require('../src/store');
const media = require('../src/media');
const { run } = require('../src/db');
const { hashPassword } = require('../src/security');

const ACCOUNT = {
  name: 'Cristián Ramírez',
  email: process.env.SEED_EXAMPLES_EMAIL || 'ccramireza@gmail.com',
  password: process.env.SEED_EXAMPLES_PASSWORD || 'jardin2026'
};

const PHOTOS = {
  rosa: 'retrato-jardin.jpg',
  oscar: 'demo-oscar.jpg',
  camila: 'demo-madre.jpg',
  nala: 'demo-nala.jpg',
  tea: 'te-recuerdos.jpg',
  hands: 'manos-fotografia.jpg',
  beach: 'costa-atardecer.jpg',
  garden: 'hero-garden.jpg',
  gato: 'demo-gato.jpg'
};

const MUSIC = path.join(config.publicDir, 'audio', 'jardin-ambiente.mp3');

const PERFILES = [
  {
    slug: 'rosa-elena-munoz',
    certificate: 'JM-2026-RE4N8',
    kind: 'persona',
    full_name: 'Rosa Elena Muñoz',
    relationship: 'Mi abuela',
    birth_date: '1938-04-12',
    death_date: '2021-08-03',
    epitaph: 'Su risa era la música de nuestra casa',
    theme: 'jardin',
    cover: 'rosa',
    daysAgo: 46,
    biography:
      'Rosa Elena nació en San Fernando y llegó a Santiago a los diecinueve años, con una maleta de cartón ' +
      'y un cuaderno de recetas. Regentó una fuente de soda en el barrio Matta durante treinta años, donde ' +
      'aprendió el nombre de cada vecino y nunca dejó a nadie irse con hambre.\n\n' +
      'Los domingos cocinaba para veinte aunque fuéramos ocho. Guardaba las flores que le regalaban en libros ' +
      'para prensarlas y, cuando alguien se casaba, aparecía con un mantel bordado a mano. Decía que la memoria ' +
      'es una casa y que había que barrerla todos los días para que no se llene de polvo.',
    gallery: [
      { key: 'tea', caption: 'Sus tardes de té, su manera de decir “quédate un rato más”.' },
      { key: 'garden', caption: 'El jardín que cuidaba cada mañana antes de desayunar.' }
    ],
    guestbook: [
      {
        name: 'Patricia Soto',
        city: 'Valparaíso',
        message:
          'Doña Rosa, todavía le debo el pan amasado que me guardaba cuando pasaba a estudiar. Nunca la voy a olvidar.',
        candle: 1
      },
      {
        name: 'Marta Contreras',
        city: 'San Fernando',
        message: 'Su risa era contagiosa. Gracias por dejarnos tantas recetas escritas con su letra pequeña.',
        candle: 1
      }
    ]
  },
  {
    slug: 'oscar-contreras-pena',
    certificate: 'JM-2026-OC7P3',
    kind: 'persona',
    full_name: 'Óscar Contreras Peña',
    relationship: 'Mi padre',
    birth_date: '1951-11-27',
    death_date: '2024-02-16',
    epitaph: 'Carpintero de oficio, jardinero de corazón',
    theme: 'amanecer',
    cover: 'oscar',
    daysAgo: 38,
    biography:
      'Óscar aprendió el oficio de su padre en un taller de la calle Franklin. Trabajó la madera con una ' +
      'paciencia que no tenía para nada más: podía pasar una tarde entera lijando una pata de silla hasta que ' +
      'quedaba como seda.\n\n' +
      'En el patio de la casa había un limonero que plantó el día que nació su primera hija. Escuchaba boleros ' +
      'mientras regaba y decía que las plantas, como las personas, agradecen que uno se acuerde de ellas todos ' +
      'los días.',
    gallery: [
      { key: 'hands', caption: 'Las manos que convirtieron la madera en muebles para toda la familia.' },
      { key: 'beach', caption: 'Los veranos en Cartagena, con la caña de pescar y el mate.' }
    ],
    guestbook: [
      {
        name: 'Luis Peña',
        city: 'Valparaíso',
        message:
          'Compañero de taller por más de veinte años. Me enseñó a medir dos veces y a callar cuando no hacía falta hablar.',
        candle: 1
      },
      {
        name: 'Camila Peña',
        city: 'Santiago',
        message: 'El limonero sigue dando frutos, tío Óscar. Cada verano te pensamos.',
        candle: 0
      }
    ]
  },
  {
    slug: 'camila-fuentes-rojas',
    certificate: 'JM-2026-CF9R1',
    kind: 'persona',
    full_name: 'Camila Fuentes Rojas',
    relationship: 'Mi hermana',
    birth_date: '1989-06-05',
    death_date: '2023-10-21',
    epitaph: 'Volvía de todos los viajes con algo que contarnos',
    theme: 'cielo',
    cover: 'camila',
    daysAgo: 29,
    biography:
      'Camila estudiaba geografía y pasaba los veranos recorriendo el sur con una mochila y una cámara ' +
      'prestada. Volvía con piedras de río, hojas secas y cuadernos llenos de mapas dibujados a mano.\n\n' +
      'Enseñaba en un colegio de Puente Alto y tenía la costumbre de aprenderse el nombre de cada estudiante ' +
      'en la primera semana. Cuando algo la entusiasmaba, lo contaba con las manos, y nadie podía quedarse ' +
      'indiferente.',
    gallery: [
      { key: 'beach', caption: 'La costa que recorrió mil veces con la cámara al hombro.' },
      { key: 'garden', caption: 'Su rincón favorito para dibujar mapas al aire libre.' }
    ],
    guestbook: [
      {
        name: 'Javiera Rojas',
        city: 'Puente Alto',
        message:
          'Era la profesora que todos recordamos. Mi hija todavía habla de los mapas que les enseñó a dibujar.',
        candle: 1
      },
      {
        name: 'Tomás Fuentes',
        city: 'Concepción',
        message: 'Guardé las piedras que trajiste del Biobío. Siguen en la misma repisa.',
        candle: 1
      }
    ]
  },
  {
    slug: 'nala',
    certificate: 'JM-2026-NA2L6',
    kind: 'mascota',
    full_name: 'Nala',
    relationship: 'Nuestra perra',
    birth_date: '2012-03-18',
    death_date: '2025-05-09',
    epitaph: 'Catorce años esperándonos en la puerta',
    theme: 'noche',
    cover: 'nala',
    daysAgo: 17,
    biography:
      'Nala llegó a la casa en una caja de zapatos y se quedó para siempre. Dormía en el mismo rincón del ' +
      'living, junto a la ventana que daba al sol de la tarde, y sabía distinguir el sonido del auto de cada ' +
      'uno de nosotros antes de que doblara la esquina.\n\n' +
      'Le encantaban las tostadas, las pelotas de tenis viejas y las caminatas largas por el cerro. Los últimos ' +
      'años fue ella la que nos cuidaba: se acostaba junto a la cama cuando alguien estaba enfermo y no se movía.',
    gallery: [
      { key: 'gato', caption: 'Su siesta favorita, siempre en el mismo sillón.' },
      { key: 'garden', caption: 'Las tardes de patio, olfateando todo lo que se movía.' }
    ],
    guestbook: [
      {
        name: 'Familia Silva',
        city: 'La Reina',
        message: 'La mejor compañera de la cuadra. Todavía se te echa de menos en la plaza.',
        candle: 1
      }
    ]
  }
];

async function importPhoto(key) {
  const source = path.join(config.publicDir, 'img', PHOTOS[key]);
  const temp = path.join(config.tmpDir, `ejemplo-${Date.now()}-${key}.jpg`);
  fs.mkdirSync(path.dirname(temp), { recursive: true });
  await fs.promises.copyFile(source, temp);
  const upload = await media.processImage(temp);
  media.removeQuiet(temp);
  return upload;
}

async function importMusic() {
  const temp = path.join(config.tmpDir, `ejemplo-musica-${Date.now()}.mp3`);
  fs.mkdirSync(path.dirname(temp), { recursive: true });
  await fs.promises.copyFile(MUSIC, temp);
  const upload = await media.saveAudio(temp);
  media.removeQuiet(temp);
  return upload;
}

/** Fecha desplazada hacia atrás, para que el historial no quede todo del mismo día. */
function before(days, hours = 0) {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
}

async function seedEjemplos() {
  const existing = store.findUserByEmail(ACCOUNT.email);
  if (existing) {
    console.log(`La cuenta ${ACCOUNT.email} ya existe: no se agrega nada.`);
    console.log('No se duplica nada. Para empezar de cero, usa un DATA_DIR vacío o elimina esa cuenta.');
    return { creados: 0, omitido: true };
  }

  console.log('🌱 Creando los memoriales de ejemplo…');

  const user = store.createUser({
    name: ACCOUNT.name,
    email: ACCOUNT.email,
    passwordHash: hashPassword(ACCOUNT.password)
  });

  // El pack de 4 que respalda la creación de los cuatro memoriales.
  const reference = `JM-EJEM-${Date.now().toString(36).toUpperCase()}`;
  store.completePurchase({
    userId: user.id,
    plan: 'pack4',
    planName: 'Pack familia',
    amount: 11990,
    credits: 4,
    reference,
    mode: 'demo'
  });
  run('UPDATE purchases SET created_at = ? WHERE reference = ?', before(47), reference);

  const musica = await importMusic();

  for (const perfil of PERFILES) {
    const cover = await importPhoto(perfil.cover);
    const memorial = store.createMemorial(user.id, {
      kind: perfil.kind,
      full_name: perfil.full_name,
      relationship: perfil.relationship,
      birth_date: perfil.birth_date,
      death_date: perfil.death_date,
      epitaph: perfil.epitaph,
      biography: perfil.biography,
      theme: perfil.theme,
      is_public: true,
      allow_guestbook: true
    });

    const creado = before(perfil.daysAgo);
    run(
      `UPDATE memorials
          SET slug = ?, certificate_code = ?, main_photo = ?, main_thumb = ?,
              music_path = ?, views = ?, created_at = ?, updated_at = ?
        WHERE id = ?`,
      perfil.slug,
      perfil.certificate,
      cover.filename,
      cover.thumb,
      musica.filename,
      0,
      creado,
      creado,
      memorial.id
    );

    const coverId = store.addPhoto(memorial.id, {
      filename: cover.filename,
      thumb: cover.thumb,
      caption: perfil.kind === 'mascota' ? 'Nuestra compañera' : 'Su retrato'
    });
    run('UPDATE photos SET created_at = ? WHERE id = ?', creado, coverId);

    for (const item of perfil.gallery) {
      const upload = await importPhoto(item.key);
      const photoId = store.addPhoto(memorial.id, {
        filename: upload.filename,
        thumb: upload.thumb,
        caption: item.caption
      });
      run('UPDATE photos SET created_at = ? WHERE id = ?', before(perfil.daysAgo, 2), photoId);
    }

    for (const entry of perfil.guestbook) {
      const entryId = store.addGuestbookEntry(memorial.id, {
        name: entry.name,
        city: entry.city,
        message: entry.message,
        candle: !!entry.candle
      });
      run('UPDATE guestbook SET created_at = ? WHERE id = ?', before(3, 4), entryId);
    }

    console.log(`   · ${perfil.full_name} → /m/${perfil.slug}`);
  }

  // Los cuatro memoriales consumieron los cuatro cupos del pack.
  run('UPDATE users SET credits = 0 WHERE id = ?', user.id);

  console.log(`✅ Listo. Cuenta: ${ACCOUNT.email} / ${ACCOUNT.password}`);
  console.log(`   Memoriales públicos: ${store.countPublicMemorials()}`);
  return { creados: PERFILES.length, omitido: false };
}

if (require.main === module) {
  seedEjemplos()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('No pudimos crear los memoriales de ejemplo:', error);
      process.exit(1);
    });
}

module.exports = { seedEjemplos, PERFILES };
