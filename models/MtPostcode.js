const mongoose = require("mongoose");

const mtPostcodeSchema =  {
  type: { type: String },
  geometry: {
    type: { type: String },
    coordinates: [Number],
  },
  properties: { postcode: String },
};

const MtPostcode = mongoose.model("MtPostcode", mtPostcodeSchema, "mt_postcodes");

module.exports = MtPostcode;
