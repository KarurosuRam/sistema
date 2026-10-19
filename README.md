# Sistema · Registro de votación de la Junta Calificadora

Página web de una sola hoja (`index.html`) para dejar registro de cómo vota la Junta Calificadora, compuesta por **Representante**, **Integrante 1**, **Integrante 2** y **Presidenta**.

## Funciones

- Identificación de la persona evaluada (nombre obligatorio, cargo y proceso opcionales) y fecha de la sesión.
- Registro del nombre y del voto de cada integrante: **a favor**, **en contra** o **abstención**.
- Resumen en vivo con el resultado de la votación (mayoría a favor, mayoría en contra, empate o sin mayoría).
- Guardado de actas en el navegador (localStorage) con numeración correlativa.
- Vista de acta lista para **imprimir o guardar en PDF** en una página A4, con espacio para las cuatro firmas.
- Historial de actas guardadas, con opción de ver, eliminar y exportar a **CSV** o respaldar en **JSON**.

## Uso

Abre `index.html` directamente en el navegador o sirve la carpeta:

```bash
python3 -m http.server 8000
```

No requiere instalación, dependencias ni conexión a internet. Los registros quedan solo en el navegador donde se usan; descarga un respaldo JSON si necesitas conservarlos o moverlos a otro equipo.
