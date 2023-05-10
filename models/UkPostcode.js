const mongoose = require("mongoose");

const ukPostcodeSchema =  {
  type: { type: String },
  geometry: {
    type: { type: String },
    coordinates: [Number],
  },
  properties: { postcode: String },
};

const UKPostcode = mongoose.model("UKPostcode", ukPostcodeSchema, "uk_postcodes");

module.exports = UKPostcode;
