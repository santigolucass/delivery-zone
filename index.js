const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const Zone = require("./models/Zone");
const UkPostcode = require("./models/UkPostcode");
const MtPostcode = require("./models/MtPostcode");
const { getBounds, getCenter, calculateZoom } = require("./helpers/zoom_helper");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 8081;

mongoose.connect("mongodb://mongo:27017/delivery-radius", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const checkStoreId = (req, res, next) => {
  const storeId = req.query.store_id;
  const { country_prefix, postcode } = req.query;

  if (!storeId) {
    return res.status(400).json({ message: "Missing store_id parameter" });
  }

  if (!country_prefix) {
    return res.status(400).json({ message: "Missing country_prefix parameter" });
  }

  req.storeId = storeId;
  next();
};

app.get('/api/postcodes/:postcode', async (req, res) => {
  const { postcode } = req.params;
  const { country_prefix } = req.query;

  let PostcodeModel;
  if (country_prefix === "uk") {
    PostcodeModel = UkPostcode;
  } else if (country_prefix === "mt") {
    PostcodeModel = MtPostcode;
  } else {
    return res.status(400).json({ message: "Invalid country_prefix" });
  }

  try {
    const dbPostcode = await PostcodeModel.findOne({ "properties.postcode": postcode });

    if (!dbPostcode) {
      res.status(404).json({ message: 'Postcode not found' });
      return;
    }


    res.status(200).json({
      latitude: dbPostcode.geometry.coordinates[0],
      longitude: dbPostcode.geometry.coordinates[1],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching coordinates for postcode' });
  }
});

app.post("/api/zones/:store_id", async (req, res) => {
  const { coordinates, radius } = req.body;
  const storeId = req.params.store_id;

  if (!coordinates) {
    return res.status(400).json({ message: "Missing coordinates parameter" });
  }

  if (!storeId) {
    return res.status(400).json({ message: "Missing store_id parameter" });
  }

  try {
    const existingZone = await Zone.findOne({ storeId });
    if (existingZone) {
      existingZone.coordinates = coordinates;
      existingZone.radius = radius;
      await existingZone.save();
      res.status(200).json(existingZone);
    } else {
      const newZone = new Zone({ coordinates, storeId, radius });
      await newZone.save();
      res.status(201).json(newZone);
    }
  } catch (error) {
    res.status(500).json({ message: "Error saving zone", error });
  }
});

app.delete("/api/zones/:store_id", async (req, res) => {
  const storeId = req.params.store_id;

  if (!storeId) {
    return res.status(400).json({ message: "Missing store_id parameter" });
  }

  try {
    const zoneToDelete = await Zone.findOne({ storeId });

    if (!zoneToDelete) {
      return res.status(404).json({ message: "Zone not found" });
    }

    await zoneToDelete.remove();
    res.status(200).json({ message: "Zone deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: "Error deleting zone", error });
  }
});

app.get("/api/point-in-zone", async (req, res) => {
  const { storeId, postcode, country_prefix } = req.query;

  if (!storeId) {
    return res.status(400).json({ message: "Missing storeId parameter" });
  }

  if (!postcode) {
    return res.status(400).json({ message: "Missing postcode parameter" });
  }

  if (!country_prefix) {
    return res.status(400).json({ message: "Missing country_prefix parameter" });
  }

  let PostcodeModel;
  if (country_prefix === "uk") {
    PostcodeModel = UkPostcode;
  } else if (country_prefix === "mt") {
    PostcodeModel = MtPostcode;
  } else {
    return res.status(400).json({ message: "Invalid country_prefix" });
  }

  try {
    const zone = await Zone.findOne({ storeId });
    if (!zone) {
      return res.status(404).json({ message: "Zone not found" });
    }

    const postcodeDocument = await PostcodeModel.findOne({
      "properties.postcode": postcode,
    });
    if (!postcodeDocument) {
      return res.status(404).json({ message: "Postcode not found" });
    }

    const zonePolygon = {
      type: "Polygon",
      coordinates: [zone.coordinates],
    };

    const isInsideZone = await PostcodeModel.findOne({
      _id: postcodeDocument._id,
      geometry: {
        $geoWithin: {
          $geometry: zonePolygon,
        },
      },
    });

    if (isInsideZone) {
      return res.status(200).json({ message: "Point is inside zone" });
    } else {
      return res.status(200).json({ message: "Point is outside zone" });
    }
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error checking point", error });
  }
});

app.get("/api/zones/:store_id", async (req, res) => {
  const storeId = req.params.store_id;

  if (!storeId) {
    return res.status(400).json({ message: "Missing store_id parameter" });
  }

  try {
    const zone = await Zone.findOne({ storeId });
    if (!zone) {
      return res.status(404).json({ message: "Zone not found" });
    }

    res.status(200).json(zone);
  } catch (error) {
    res.status(500).json({ message: "Error fetching zone", error });
  }
});

app.get('/postcode_image', async (req, res) => {
  const { postcode, country_prefix, store_id } = req.query;

  let zone = null;
  let postcodeDocument = null;
  let latitude = null;
  let longitude = null;
  const apiKey='<YOUR_MAPS_API_KEY_HERE>'

  if (!postcode) {
    return res.status(400).json({ message: "Missing postcode parameter" });
  }

  if (!country_prefix) {
    return res.status(400).json({ message: "Missing country_prefix parameter" });
  }

  if (store_id) {
    zone = await Zone.findOne({ storeId: store_id });
  }

  let PostcodeModel;
  if (country_prefix === "uk") {
    PostcodeModel = UkPostcode;
  } else if (country_prefix === "mt") {
    PostcodeModel = MtPostcode;
  } else {
    return res.status(400).json({ message: "Invalid country_prefix" });
  }

  postcodeDocument = await PostcodeModel.findOne({ "properties.postcode": postcode })

  if (!postcodeDocument && !zone) {
    return res.status(404).json({ mapsImageUrl: false });
  }

  postcodeLatitude = postcodeDocument.geometry.coordinates[0];
  postcodeLongitude = postcodeDocument.geometry.coordinates[1];

  if(zone) {
    const polygonCoordinates = zone.coordinates;
    const encodedPolygonCoordinates = polygonCoordinates
      .map(coord => `${coord[0]},${coord[1]}`)
      .join('|');

    const bounds = getBounds(polygonCoordinates);
    const zoom = calculateZoom(bounds, 600, 300);
    const zoneCenter = getCenter(bounds);

    const path = `color:blue|weight:3|fillcolor:rgba(0,0,255,0.4)|${encodedPolygonCoordinates}`;
    const mapsImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${zoneCenter.lat},${zoneCenter.lng}&zoom=${zoom}&size=600x300&maptype=roadmap&markers=color:red%7C${postcodeLatitude},${postcodeLongitude}&key=${apiKey}&path=${path}`;

    res.status(200).json({ mapsImageUrl });
  } else {
    const mapsImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${postcodeLatitude},${postcodeLongitude}&zoom=13&size=600x300&maptype=roadmap&markers=color:red%7C${postcodeLatitude},${postcodeLongitude}&key=${apiKey}`;
    res.status(200).json({ mapsImageUrl });
  }
})

app.get('/map', checkStoreId, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), {
    postcode: req.query.postcode
  });
});

app.use("/", express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
