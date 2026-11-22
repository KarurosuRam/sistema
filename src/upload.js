'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const MB = 1024 * 1024;

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, config.tmpDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10).replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

function rejection(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function imageFilter(req, file, cb) {
  if (/^image\/(jpeg|jpg|png|webp|heic|heif|avif|gif)$/i.test(file.mimetype || '')) return cb(null, true);
  return cb(rejection('Formato no compatible. Sube una foto JPG, PNG, WEBP o HEIC.'));
}

function audioFilter(req, file, cb) {
  if (/^audio\/(mpeg|mp3|x-mpeg)$/i.test(file.mimetype || '') || /\.mp3$/i.test(file.originalname || '')) {
    return cb(null, true);
  }
  return cb(rejection('La música debe ser un archivo MP3.'));
}

function videoFilter(req, file, cb) {
  if (/^video\/(mp4|quicktime|x-m4v)$/i.test(file.mimetype || '') || /\.(mp4|mov|m4v)$/i.test(file.originalname || '')) {
    return cb(null, true);
  }
  return cb(rejection('El video debe ser MP4 o MOV.'));
}

const photoSingle = multer({
  storage,
  limits: { fileSize: config.maxImageMB * MB, files: 1 },
  fileFilter: imageFilter
}).single('main_photo');

const photoArray = multer({
  storage,
  limits: { fileSize: config.maxImageMB * MB, files: config.maxPhotos },
  fileFilter: imageFilter
}).array('photos', config.maxPhotos);

const audioSingle = multer({
  storage,
  limits: { fileSize: config.maxAudioMB * MB, files: 1 },
  fileFilter: audioFilter
}).single('music');

const videoSingle = multer({
  storage,
  limits: { fileSize: config.maxVideoMB * MB, files: 1 },
  fileFilter: videoFilter
}).single('video');

module.exports = { photoSingle, photoArray, audioSingle, videoSingle, MB };
