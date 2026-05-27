// TODO: configure cloudinary v2 SDK and wire up uploads.
// const { v2: cloudinary } = require('cloudinary');
// const env = require('../config/env');
// cloudinary.config({
//   cloud_name: env.CLOUDINARY_CLOUD_NAME,
//   api_key: env.CLOUDINARY_API_KEY,
//   api_secret: env.CLOUDINARY_API_SECRET,
// });

async function uploadImage(_file) {}
async function deleteImage(_publicId) {}

module.exports = { uploadImage, deleteImage };
