# Sistema de Calificaciones · DTO 1825/1998

Aplicación de escritorio-web para gestionar el proceso calificatorio del personal afecto al
Estatuto Administrativo, con **identificación del padrón ANEIICH** (Asociación Nacional de
Funcionarios de Impuestos Internos de Chile). Cubre proceso completo: precalificación del jefe
directo, votación de la Junta Calificadora **subfactor por subfactor**, acuerdo fundado, actas,
apelaciones, hoja de vida de méritos y deméritos, informes de desempeño y escalafón de mérito.

## Puesta en marcha

```bash
npm install
npm run build     # compila el cliente React en public/
npm start         # API + aplicación en http://0.0.0.0:3000
```

Clave de acceso por defecto: `sii2025` (login con una sola clave, sin perfiles de usuario).
Se puede cambiar en **Ajustes → Clave de acceso** o con la variable `CLAVE_ACCESO`.

| Script | Uso |
| --- | --- |
| `npm run dev` | Vite en modo desarrollo (puerto 5173, proxy `/api` → 3000) |
| `npm run build` | Compila el cliente en `public/` |
| `npm start` | Sirve API + aplicación compilada |
| `npm run seed` | Recarga los datos de demostración |
| `npm run wipe` | Vacía todas las tablas (para cargar datos reales) |

Variables de entorno: `API_PORT` (3000), `DB_PATH` (`data/calificaciones.db`), `CLAVE_ACCESO`.

## Páginas

- **Tablero** — dotación, fichas en proceso, promedios por estamento / unidad / región / grado,
  series por año, distribución de notas por subfactor (radar), tramos de lista, comparativa
  asociados vs. no asociados ANEIICH, plazos del período, jefaturas con más pendientes y
  funcionarios destacados.
- **Calificaciones** — listado del período con estado, votos registrados, puntaje y lista;
  genera las fichas del período y filtra por estado, estamento, unidad y búsqueda.
- **Hoja de calificación** (una sola página por funcionario) — factóres y subfactores con notas,
  argumentos por subfactor, cálculo del puntaje, votación de la junta, acuerdo, apelaciones,
  hoja de vida, informes e historial; pestañas independientes e impresión.
- **Juntas y actas** — constitución de la junta (art. 22), sugerencia automática de integrantes,
  integrantes con derecho a voto, asignación de fichas del período, tablero de votación y libro
  de actas.
- **Escalafón de mérito** — lugares por grado ordenados por puntaje, notificación del escalafón.
- **Funcionarios** — padrón completo con ficha individual, jefatura, condición gremial e
  importación/exportación CSV.
- **Jefes evaluadores** — jefes con dependientes, fichas emitidas, precalificaciones pendientes y
  juntas presididas.
- **Padrón ANEIICH** — asociados marcados visualmente, selección rápida de todos los asociados,
  roles gremiales (dirigente nacional, regional, delegado) y acciones masivas.
- **Reportes** — exportables CSV por período, consolidados por estamento / unidad / año y bitácora
  de auditoría.
- **Ajustes** — datos de la institución y la asociación, períodos, unidades, clave de acceso,
  recarga de datos demo o vaciado total para importar datos reales.

## Reglas normativas implementadas

Factores y subfactores (art. 16): **Rendimiento** (cumplimiento, calidad), **Condiciones
Personales** (interés, trabajo en equipo) y **Comportamiento Funcionario** (normas e
instrucciones, asistencia y puntualidad).

Coeficientes (art. 17): Directivos 4,5 / 3,5 / 2,0 · Profesionales y Técnicos (incluye
fiscalizadores) 4,0 / 3,5 / 2,5 · Administrativos y Auxiliares 4,0 / 3,0 / 3,0.

Cálculo (art. 14): notas enteras de 1 a 10; la nota del factor es el promedio simple de sus
subfactores; el puntaje es la suma de cada nota multiplicada por su coeficiente, con dos
decimales (se aproxima hacia arriba cuando el tercer decimal es 5 o más).

Listas (art. 15): N°1 Distinción 81,00–100 · N°2 Buena 46,00–80,99 · N°3 Condicional 30,00–45,99
· N°4 Eliminación 10,00–29,99. Conceptos: 9–10 óptimo, 7–8 bueno, 5–6 satisfactorio,
3–4 insuficiente, 1–2 deficiente.

Plazos: período del 1 de septiembre al 31 de agosto; proceso entre el 1 de septiembre y el 30 de
noviembre; la junta se constituye el 21 de septiembre; las calificaciones deben estar en poder del
secretario antes del 15 de octubre; el jefe directo precalifica dentro de 10 días; el funcionario
dispone de 5 días para apelar (10 en casos excepcionales) y la apelación se resuelve en 15 días,
sin poder rebajar el puntaje (art. 33). El escalafón se ordena por puntaje decreciente dentro de
cada grado y rige del 1 de enero al 31 de diciembre.

Votación (art. 30): la nota de cada subfactor se fija por mayoría de votos de los integrantes de
la junta; en caso de empate decide el presidente y, si no hay voto dirimente, se consigna la nota
mayor. El acuerdo debe ser fundado y queda registrado con los votos de cada integrante.

No calificables (art. 5): jefe superior del servicio, subrogante legal, integrantes de la junta
central, delegados y dirigentes de asociaciones (salvo solicitud expresa) y quienes hayan
desempeñado funciones menos de seis meses en el período.

## Estructura

```
server/
  index.js        API Express, sesión y servido del cliente compilado
  db.js           capa SQLite (node:sqlite), migraciones y auditoría
  dominio.js      factores, subfactores, coeficientes, cálculo y plazos del DTO 1825
  seed.js         datos de demostración (SII, períodos 2023–2026)
  csv.js          importación/exportación CSV con validación de RUT
  rutas/          meta, funcionarios, calificaciones, juntas, dashboard
client/src/
  paginas/        Tablero, Calificaciones, CalificacionFicha, Funcionarios, FuncionarioFicha,
                  Jefes, Aneiich, Juntas, Escalafon, Reportes, Ajustes
  componentes/    UI, gráficos y diseño
data/calificaciones.db   base de datos (regenerable con `npm run seed`)
```

## Flujo de trabajo recomendado en el período en curso

1. **Ajustes → Períodos**: revise las fechas del período vigente y las unidades de personal.
2. **Calificaciones → Generar fichas del período**: crea una ficha por funcionario calificable y
   deja consignada la causal de quienes no lo son (art. 5).
3. **Hoja de calificación → Precalificación del jefe**: el jefe directo asigna notas por subfactor
   con su argumento (arts. 19 y 20).
4. **Juntas y actas**: constituya la junta (art. 22), registre a los integrantes con derecho a voto
   y asigne las fichas del período.
5. **Hoja de calificación → Votación de la Junta**: registre el voto de cada integrante subfactor
   por subfactor; el sistema consolida la nota por mayoría (art. 30).
6. **Consignar acuerdo**: fije la fecha de la sesión, el acta y la fundamentación, y cierre el
   acuerdo; la ficha queda *Calificada* con su puntaje y lista (arts. 14, 15 y 31).
7. **Apelaciones**: registre los recursos y su resolución, con la regla del art. 33 (el puntaje
   puede mantenerse o elevarse, nunca rebajarse).
8. **Escalafón de mérito**: confeccione el escalafón por grado y registre su notificación
   (arts. 38 y 39).

## Verificaciones realizadas

Con los datos de demostración se comprobaron (40 comprobaciones de API y 30 de interfaz, sin
errores): el cálculo del puntaje y la lista de cada estamento, la consolidación de votos por
subfactor con mayoría, empate y voto dirimente del presidente, la advertencia cuando la nota
acordada no coincide con la votación, el cierre del acuerdo con su acta y fundamentación, el
registro y la resolución de apelaciones con el tope del art. 33, la confección del escalafón por
grado con lugares consecutivos, la notificación, la asignación de fichas a la junta, la hoja de
vida, los informes de desempeño, el padrón ANEIICH con selección rápida, la importación y
exportación de planillas CSV y todos los reportes.

## Datos de demostración

Períodos 2023 a 2026 con 114 funcionarios de once unidades del Servicio de Impuestos Internos,
cuatro años de calificaciones (448 fichas y 7.560 votos de subfactor), juntas calificadoras,
apelaciones, hoja de vida, informes de desempeño, actas y padrón ANEIICH de 69 asociados.
El período 2026 queda en proceso para recorrer la votación de la junta y el cierre del escalafón.
Para cargar datos reales: **Ajustes → Vaciar datos** y luego importar el padrón por CSV.
