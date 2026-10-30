'use strict';

/**
 * Crea el contenido de demostración de Jardín Memorial.
 *
 * Uso:
 *   npm run seed            → recrea la cuenta demo y sus memoriales
 * Se ejecuta automáticamente en el primer arranque si la base está vacía.
 */

const fs = require('fs');
const path = require('path');

const config = require('../src/config');
const store = require('../src/store');
const { run, get } = require('../src/db');
const { hashPassword } = require('../src/security');

const media = require('../src/media');

const PHOTO_SOURCES = {
  rosa: 'retrato-jardin.jpg',
  oscar: 'demo-oscar.jpg',
  camila: 'demo-madre.jpg',
  nala: 'demo-nala.jpg',
  michi: 'demo-gato.jpg',
  garden: 'hero-garden.jpg',
  tea: 'te-recuerdos.jpg',
  hands: 'manos-fotografia.jpg',
  beach: 'costa-atardecer.jpg'
};

function daysAgo(days, hours = 0) {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
}

async function importPhoto(sourceKey) {
  const source = path.join(config.publicDir, 'img', PHOTO_SOURCES[sourceKey]);
  const temp = path.join(config.tmpDir, `seed-${Date.now()}-${sourceKey}.jpg`);
  await fs.promises.copyFile(source, temp);
  const upload = await media.processImage(temp);
  media.removeQuiet(temp);
  return upload;
}

function clearDemo() {
  const user = store.findUserByEmail(config.demoAccount.email);
  if (!user) return null;
  const memorials = store.listMemorialsByUser(user.id);
  for (const memorial of memorials) {
    for (const photo of store.listPhotos(memorial.id)) {
      media.deleteUpload(photo.filename);
      media.deleteUpload(photo.thumb);
    }
    if (memorial.video_path) media.deleteUpload(memorial.video_path);
    if (memorial.music_path) media.deleteUpload(memorial.music_path);
  }
  run('DELETE FROM users WHERE id = ?', user.id);
  return user;
}

const PROFILES = [
  {
    slug: 'rosa-elena-munoz',
    certificate: 'JM-2024-RS8K2',
    kind: 'persona',
    full_name: 'Rosa Elena Muñoz',
    relationship: 'Mi abuela',
    birth_date: '1943-04-12',
    death_date: '2024-08-03',
    epitaph: 'Su risa era la música de nuestra casa.',
    theme: 'jardin',
    cover: 'rosa',
    created: daysAgo(37),
    views: 512,
    biography: `Rosa Elena nació en Chillán un martes de abril, entre aromas de pan amasado y el ruido de una radio que nunca se apagaba. Fue la mayor de cinco hermanos y aprendió a cuidar de los demás antes de aprender a leer.

Se casó con Óscar en 1965 y juntos levantaron una casa en La Cisterna donde siempre había una taza de té esperando. Sus tardes comenzaban con el hervidor y terminaban con historias que se repetían, pero que nadie se cansaba de escuchar.

Fue costurera, jardinera y la mejor cocinera de cazuelas que haya existido. Cada domingo la mesa se llenaba de hijos, nietos y vecinos que llegaban sin avisar, porque en su casa siempre había lugar para uno más.

Nos enseñó que la generosidad no se mide en grandes gestos, sino en las pequeñas cosas: una llamada a tiempo, un plato servido, una mano que sostiene. Su risa, clara y contagiosa, sigue sonando en los pasillos de nuestra memoria.

Hoy la recordamos con sus flores favoritas, sus canciones de siempre y la certeza de que sigue cuidándonos desde algún jardín.`,
    gallery: [
      { key: 'tea', caption: 'Sus tardes de té, su manera de decir “quédate un rato más”.', created: daysAgo(37, 2) },
      { key: 'hands', caption: 'Las manos que guardaron cada recuerdo de la familia.', created: daysAgo(37, 4) },
      { key: 'beach', caption: 'El mar de Cartagena, su lugar favorito para descansar.', created: daysAgo(36) }
    ],
    guestbook: [
      {
        name: 'Carolina Muñoz',
        city: 'Santiago',
        message: 'Abuela, hoy preparé tu cazuela y me salió igual a la tuya. Te pensé en cada cucharada. Gracias por enseñarme a cocinar con amor.',
        candle: 1,
        created: daysAgo(2, 3)
      },
      {
        name: 'Diego Fuentes',
        city: 'La Cisterna',
        message: 'Nunca voy a olvidar los domingos en tu casa. Llegábamos con hambre y nos íbamos con el corazón lleno. Te quiero, tía Rosa.',
        candle: 1,
        created: daysAgo(5, 1)
      },
      {
        name: 'Familia Contreras',
        city: 'San Bernardo',
        message: 'Gracias por tanto, Rosa. Por recibirnos siempre con una sonrisa y por querer a nuestros hijos como si fueran tuyos. Tu jardín sigue floreciendo.',
        candle: 0,
        created: daysAgo(9, 6)
      },
      {
        name: 'Marta Vergara',
        city: 'Chillán',
        message: 'Mi vecina de toda la vida. Cuánto extraño verte regar las plantas por la mañana. Descansa en paz, querida amiga.',
        candle: 1,
        created: daysAgo(14, 2)
      },
      {
        name: 'Josefa Muñoz',
        city: 'Valparaíso',
        message: 'Abuela, tu risa es lo que más extraño. La escucho en las cosas simples, en el viento, en una canción de Los Ángeles Negros. Siempre estás.',
        candle: 1,
        created: daysAgo(21, 4)
      },
      {
        name: 'Pablo Contreras',
        city: 'Santiago',
        message: 'Gracias por ser el corazón de esta familia. Nos cuidaste toda la vida; ahora te cuidamos nosotros en la memoria.',
        candle: 0,
        created: daysAgo(30)
      }
    ],
    candles: 27
  },
  {
    slug: 'oscar-contreras',
    certificate: 'JM-2025-OC4M7',
    kind: 'persona',
    full_name: 'Óscar Contreras',
    relationship: 'Mi padre',
    birth_date: '1948-02-09',
    death_date: '2021-06-30',
    epitaph: 'Enseñó con el ejemplo y amó sin condiciones.',
    theme: 'cielo',
    cover: 'oscar',
    created: daysAgo(29),
    views: 341,
    biography: `Óscar fue un hombre de pocas palabras y gestos enormes. Nació en San Fernando y llegó a Santiago a los dieciocho años con una maleta de cartón y la convicción de que el trabajo honesto era la mejor herencia.

Fue mecánico durante cuarenta años. En su taller no solo arreglaba motores: escuchaba, aconsejaba y prestaba herramientas a quien lo necesitara. Muchos de sus aprendizajes no estaban en los libros, sino en las tardes compartidas entre autos y conversaciones.

Amaba el fútbol, los asados del sábado y su radio vieja. Tenía una memoria prodigiosa para los nombres y una generosidad que no hacía ruido. Nunca dijo “te quiero” demasiadas veces, pero estaba en cada partido, en cada cumpleaños, en cada llamada.

Sigue presente en las herramientas bien ordenadas, en el olor a pasto recién cortado y en la manera en que sus hijos enfrentan la vida: con esfuerzo, con humildad, con la frente en alto.`,
    gallery: [
      { key: 'garden', caption: 'El jardín que cuidó durante treinta años.', created: daysAgo(29, 3) }
    ],
    guestbook: [
      {
        name: 'Rodrigo Contreras',
        city: 'Santiago',
        message: 'Papá, hoy arreglé la llave del baño solo, como me enseñaste. Pensé en ti todo el tiempo. Gracias por tanto, viejo.',
        candle: 1,
        created: daysAgo(4, 5)
      },
      {
        name: 'Sergio Pérez',
        city: 'San Fernando',
        message: 'Óscar, compañero de taller y de vida. Nunca olvidaré los consejos y las tallas. Un abrazo hasta el cielo.',
        candle: 1,
        created: daysAgo(16, 2)
      },
      {
        name: 'Andrea Contreras',
        city: 'Rancagua',
        message: 'Mi papá fuerte, mi papá bueno. El pasto del jardín sigue creciendo y cada vez que lo corto te siento cerca.',
        candle: 0,
        created: daysAgo(25)
      }
    ],
    candles: 14
  },
  {
    slug: 'camila-fuentes',
    certificate: 'JM-2025-CF9T3',
    kind: 'persona',
    full_name: 'Camila Fuentes Rojas',
    relationship: 'Mi hermana',
    birth_date: '1978-09-21',
    death_date: '2023-03-14',
    epitaph: 'La vida era más liviana cuando ella estaba.',
    theme: 'noche',
    cover: 'camila',
    created: daysAgo(18),
    views: 268,
    biography: `Camila tenía una risa que se escuchaba antes de entrar a cualquier lugar. Nació en Viña del Mar, estudió diseño y convirtió su casa en un pequeño refugio de plantas, libros y amigas que llegaban a conversar hasta tarde.

Fue la hermana mayor de tres, la que organizaba los cumpleaños, la que llamaba cuando alguien estaba triste, la que sabía exactamente qué decir. Su generosidad era práctica: aparecía con comida, con un abrazo, con una solución.

Amaba el mar en invierno, el café sin azúcar y las películas de los domingos. Dibujaba en servilletas y guardaba cada papelito; decía que los recuerdos pequeños son los que sostienen la vida.

Se fue demasiado pronto, pero dejó una familia que aprendió de ella a cuidarse, a reírse de todo y a no dejar pasar la oportunidad de decir “te quiero”.`,
    gallery: [
      { key: 'beach', caption: 'El mar en invierno, donde siempre volvía.', created: daysAgo(18, 2) }
    ],
    guestbook: [
      {
        name: 'Fernanda Rojas',
        city: 'Viña del Mar',
        message: 'Cami, hoy tomé un café sin azúcar pensando en ti. No hay día que no te recuerde. Gracias por ser mi hermana del alma.',
        candle: 1,
        created: daysAgo(3, 4)
      },
      {
        name: 'Martín Fuentes',
        city: 'Santiago',
        message: 'Mi hermana, mi cómplice. Tu risa sigue viviendo en esta familia. Te quiero siempre.',
        candle: 1,
        created: daysAgo(11, 8)
      },
      {
        name: 'Javiera Soto',
        city: 'Concepción',
        message: 'Amiga linda, cuánto te extraño. Gracias por tanto. Vuelvo a mirar las fotos y me vuelves a hacer reír.',
        candle: 0,
        created: daysAgo(20)
      }
    ],
    candles: 19
  },
  {
    slug: 'nala',
    certificate: 'JM-2026-NL2B8',
    kind: 'mascota',
    full_name: 'Nala',
    relationship: 'Nuestra compañera de vida',
    birth_date: '2012-01-15',
    death_date: '2025-11-20',
    epitaph: 'La casa nunca dejó de tener huellas suyas.',
    theme: 'amanecer',
    cover: 'nala',
    created: daysAgo(11),
    views: 196,
    biography: `Nala llegó a la casa en 2012 dentro de una caja de zapatos, con las orejas enormes y una mirada que entendía todo. Desde ese día se convirtió en la compañera de cada rincón.

Esperaba en la puerta cada regreso, dormía en el sillón que nadie más usaba y celebraba cualquier noticia moviendo la cola como si fuera el día más importante del mundo. Era la primera en despertar y la última en dejar de dar cariño.

Le gustaban las naranjas, los paseos por el parque y perseguir las mariposas sin mucho éxito. No le gustaban los ruidos fuertes ni quedarse sola. Fue paciente con los niños, cómplice de los abuelos y confidente de los días difíciles.

Trece años de compañía incondicional. Una vida entera de fidelidad. Decir que fue una mascota se queda corto: Nala fue familia.`,
    gallery: [],
    guestbook: [
      {
        name: 'Pablo Fuentes',
        city: 'Concepción',
        message: 'Mi Nala querida. Todavía me esperas en la puerta, ¿verdad? Gracias por trece años de amor sin condiciones.',
        candle: 1,
        created: daysAgo(1, 6)
      },
      {
        name: 'Antonia Fuentes',
        city: 'Concepción',
        message: 'La mejor perrita de mi infancia. Te extraño, Nalita. Ojalá estés corriendo tras las mariposas.',
        candle: 1,
        created: daysAgo(6, 2)
      },
      {
        name: 'Familia Fuentes',
        city: 'Concepción',
        message: 'Gracias por cuidarnos siempre. La casa está más silenciosa sin ti, pero tu recuerdo llena cada espacio.',
        candle: 1,
        created: daysAgo(9)
      }
    ],
    candles: 22
  },
  {
    slug: 'michi',
    certificate: 'JM-2026-MC6R1',
    kind: 'mascota',
    full_name: 'Michi',
    relationship: 'El gato de la casa',
    birth_date: '2010-06-02',
    death_date: '2024-02-18',
    epitaph: 'Reinó el sillón y se ganó todos los corazones.',
    theme: 'jardin',
    cover: 'michi',
    created: daysAgo(6),
    views: 104,
    biography: `Michi apareció una tarde de junio en la ventana de la cocina, como si supiera que esa casa era suya. Entró, se instaló en el sillón de la abuela y nunca se fue.

Fue un gato de costumbres: dormir al sol, mirar por la ventana y dar sus paseos de medianoche por los techos del barrio. No le gustaba que lo cargaran, pero siempre dormía al pie de la cama de quien estuviera triste.

Dejó su huella en cada cojín y una colección de historias que la familia sigue contando. Vivió catorce años y se fue tranquilamente, en su lugar favorito, acompañado.

Este jardín es para él, que fue testigo de la vida de una casa entera.`,
    gallery: [],
    guestbook: [
      {
        name: 'Josefa Muñoz',
        city: 'Valparaíso',
        message: 'Michi, guardián del sillón de la abuela. Te imagino durmiendo al sol, sin preocupaciones. Gracias por tantos años.',
        candle: 1,
        created: daysAgo(2, 1)
      }
    ],
    candles: 8
  }
];

async function seed() {
  console.log('🌱 Sembrando el jardín de demostración…');
  clearDemo();

  const user = store.createUser({
    name: config.demoAccount.name,
    email: config.demoAccount.email,
    passwordHash: hashPassword(config.demoAccount.password)
  });

  const purchaseDateOne = daysAgo(45);
  const purchaseDateTwo = daysAgo(20);

  store.completePurchase({
    userId: user.id,
    plan: 'pack4',
    planName: 'Pack familia',
    amount: 11990,
    credits: 4,
    reference: 'JM-DEMO-4F7K',
    mode: 'demo'
  });
  run('UPDATE purchases SET created_at = ? WHERE reference = ?', purchaseDateOne, 'JM-DEMO-4F7K');

  store.completePurchase({
    userId: user.id,
    plan: 'pack4',
    planName: 'Pack familia',
    amount: 11990,
    credits: 4,
    reference: 'JM-DEMO-9Q2M',
    mode: 'demo'
  });
  run('UPDATE purchases SET created_at = ? WHERE reference = ?', purchaseDateTwo, 'JM-DEMO-9Q2M');

  // Reservamos una imagen de portada optimizada por memorial.
  for (const profile of PROFILES) {
    const cover = await importPhoto(profile.cover);
    const memorial = store.createMemorial(user.id, {
      kind: profile.kind,
      full_name: profile.full_name,
      relationship: profile.relationship,
      birth_date: profile.birth_date,
      death_date: profile.death_date,
      epitaph: profile.epitaph,
      biography: profile.biography,
      theme: profile.theme,
      is_public: true,
      allow_guestbook: true
    });

    run(
      `UPDATE memorials
          SET slug = ?, certificate_code = ?, main_photo = ?, main_thumb = ?, views = ?, created_at = ?, updated_at = ?
        WHERE id = ?`,
      profile.slug,
      profile.certificate,
      cover.filename,
      cover.thumb,
      profile.views,
      profile.created,
      profile.created,
      memorial.id
    );

    const coverPhotoId = store.addPhoto(memorial.id, {
      filename: cover.filename,
      thumb: cover.thumb,
      caption: profile.kind === 'mascota' ? 'Nuestra compañera' : 'Su retrato'
    });
    run('UPDATE photos SET created_at = ? WHERE id = ?', profile.created, coverPhotoId);

    for (const item of profile.gallery) {
      const upload = await importPhoto(item.key);
      const photoId = store.addPhoto(memorial.id, {
        filename: upload.filename,
        thumb: upload.thumb,
        caption: item.caption
      });
      run('UPDATE photos SET created_at = ? WHERE id = ?', item.created, photoId);
    }

    for (const entry of profile.guestbook) {
      const entryId = store.addGuestbookEntry(memorial.id, {
        name: entry.name,
        city: entry.city,
        message: entry.message,
        candle: !!entry.candle
      });
      run('UPDATE guestbook SET created_at = ? WHERE id = ?', entry.created, entryId);
    }

    for (let i = 0; i < profile.candles; i += 1) {
      const candleDate = new Date(Date.now() - (i + 1) * 6 * 3600000).toISOString();
      run(
        'INSERT INTO candles (memorial_id, name, created_at) VALUES (?, ?, ?)',
        memorial.id,
        i % 4 === 0 ? 'Un visitante' : null,
        candleDate
      );
    }

    console.log(`   · ${profile.full_name} → /m/${profile.slug}`);
  }

  // Los 5 memoriales creados consumen 5 de los 8 cupos comprados.
  run('UPDATE users SET credits = 3 WHERE id = ?', user.id);

  console.log('✅ Listo. Cuenta demo:', config.demoAccount.email, '/', config.demoAccount.password);
  console.log(`   Memoriales públicos: ${store.countPublicMemorials()}`);
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('No pudimos sembrar la demo:', error);
      process.exit(1);
    });
}

module.exports = { seed };
