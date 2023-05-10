const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const connectionString = 'mongodb://localhost:27017/delivery-radius';
const geoJSONFilePath = path.join(__dirname, 'support', 'uk_postcodes');

const UKPostcodeSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, select: false },
  type: String,
  geometry: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
  },
  properties: {
    postcode: String,
  },
});

const UKPostcode = mongoose.model('UKPostcode', UKPostcodeSchema, 'uk_postcodes');

fs.readFile(geoJSONFilePath, 'utf-8', (err, data) => {
  if (err) {
    console.error('Error reading GeoJSON file:', err);
    process.exit(1);
  }

  const geoJSON = JSON.parse(data);

  geoJSON.forEach((feature) => {
    if (feature._id) {
      delete feature._id;
    }
  });

  mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      console.log('Connected to the database.');

      UKPostcode.insertMany(geoJSON)
        .then(() => {
          console.log('GeoJSON data imported successfully.');
          mongoose.connection.close();
        })
        .catch(err => {
          console.error('Error importing GeoJSON data:', err);
          mongoose.connection.close();
        });
    })
    .catch(err => {
      console.error('Error connecting to the database:', err);
      process.exit(1);
    });
});
