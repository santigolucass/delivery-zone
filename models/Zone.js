const mongoose = require("mongoose");

const coordinatesSchema = new mongoose.Schema({
  coordinates: [[Number]],
  storeId: String,
  radius: mongoose.Schema.Types.Mixed,
});

const Zone = mongoose.model("Zone", coordinatesSchema);

module.exports = Zone;
