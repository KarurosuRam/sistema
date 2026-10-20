/* Jardín Memorial — vista previa del memorial */
(function () {
  'use strict';

  var preview = document.querySelector('[data-memorial-preview]');
  if (!preview) return;

  var nameInput = document.getElementById('full_name');
  var birthInput = document.getElementById('birth_date');
  var deathInput = document.getElementById('death_date');
  var epitaphInput = document.getElementById('epitaph');
  var kindRadios = document.querySelectorAll('input[name="kind"]');
  var themeRadios = document.querySelectorAll('input[name="theme"]');
  var photoInput = document.getElementById('main_photo');

  var nameEl = preview.querySelector('[data-preview-name]');
  var datesEl = preview.querySelector('[data-preview-dates]');
  var epitaphEl = preview.querySelector('[data-preview-epitaph]');
  var kindEl = preview.querySelector('[data-preview-kind]');
  var mediaEl = preview.querySelector('[data-preview-media]');
  var imageEl = preview.querySelector('[data-preview-image]');
  var placeholderEl = preview.querySelector('[data-preview-placeholder]');

  var MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  function yearOf(value) {
    return value && /^\d{4}/.test(value) ? value.slice(0, 4) : '';
  }

  function updateName() {
    var value = (nameInput.value || '').trim();
    nameEl.textContent = value || 'Nombre de quien recuerdas';
    nameEl.classList.toggle('is-placeholder', !value);
  }

  function updateDates() {
    var birth = yearOf(birthInput.value);
    var death = yearOf(deathInput.value);
    if (birth && death) {
      datesEl.textContent = birth + ' — ' + death;
    } else if (birth) {
      datesEl.textContent = 'Desde ' + birth;
    } else if (death) {
      datesEl.textContent = 'Hasta ' + death;
    } else {
      datesEl.textContent = 'Sus fechas';
    }
  }

  function updateEpitaph() {
    var value = (epitaphInput.value || '').trim();
    epitaphEl.textContent = value ? '«' + value + '»' : '';
    epitaphEl.classList.toggle('has-text', !!value);
  }

  function updateKind() {
    var selected = document.querySelector('input[name="kind"]:checked');
    kindEl.textContent = selected && selected.value === 'mascota' ? 'En memoria de su mascota' : 'En memoria de';
  }

  function updateTheme() {
    var selected = document.querySelector('input[name="theme"]:checked');
    var value = selected ? selected.value : 'jardin';
    preview.setAttribute('data-theme', value);
  }

  function updatePhoto() {
    if (!photoInput || !photoInput.files || !photoInput.files[0]) return;
    var file = photoInput.files[0];
    if (!/^image\//.test(file.type)) return;
    var reader = new FileReader();
    reader.onload = function (event) {
      if (imageEl) {
        imageEl.src = event.target.result;
        imageEl.classList.remove('is-hidden');
      }
      if (placeholderEl) placeholderEl.classList.add('is-hidden');
    };
    reader.readAsDataURL(file);
  }

  if (nameInput) nameInput.addEventListener('input', updateName);
  if (birthInput) birthInput.addEventListener('input', updateDates);
  if (deathInput) deathInput.addEventListener('input', updateDates);
  if (epitaphInput) epitaphInput.addEventListener('input', updateEpitaph);
  Array.prototype.forEach.call(kindRadios, function (radio) {
    radio.addEventListener('change', updateKind);
  });
  Array.prototype.forEach.call(themeRadios, function (radio) {
    radio.addEventListener('change', updateTheme);
  });
  if (photoInput) photoInput.addEventListener('change', updatePhoto);

  updateName();
  updateDates();
  updateEpitaph();
  updateKind();
  updateTheme();
})();
