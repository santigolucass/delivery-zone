let map;
let drawingManager;
let polygonOverlay = null;
let circleOverlay = null;
let callbackMessage = null;
let deleteFromDb = false;

function loadScript(url, callback) {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  script.onload = callback;
  document.body.appendChild(script);
}

function createControlElements(radius) {
  const confirmPopup = document.createElement('div');
  confirmPopup.classList.add('confirm-popup');

  const confirmBtn = document.createElement('button');
  confirmBtn.id = 'confirm-btn';
  confirmBtn.innerText = 'Confirm';
  confirmBtn.disabled = !!radius ? false : true;

  const deleteBtn = document.createElement('button');
  deleteBtn.id = 'delete-btn';
  deleteBtn.innerText = 'Delete';
  deleteBtn.disabled = !!radius ? false : true;
  deleteBtn.classList.add('delete-btn');

  const searchBar = document.createElement('input');
  searchBar.id = 'search-bar';
  searchBar.type = 'text';
  searchBar.placeholder = 'Search for an address...';
  searchBar.classList.add('search-bar');

  const helpBtn = document.createElement('button');
  helpBtn.innerText = '?';
  helpBtn.classList.add('help-btn');

  confirmPopup.appendChild(searchBar);
  confirmPopup.appendChild(helpBtn);
  confirmPopup.appendChild(confirmBtn);
  confirmPopup.appendChild(deleteBtn);

  return { confirmPopup, confirmBtn, deleteBtn, searchBar, helpBtn };
}

async function setupEventListeners(confirmBtn, deleteBtn, storeId, helpBtn, searchBar, radius) {
  try {
    google.maps.event.addListener(drawingManager, 'overlaycomplete', (event) => {
      if (event.type === google.maps.drawing.OverlayType.POLYGON) {
        drawingManager.setDrawingMode(null);

        if (polygonOverlay) {
          polygonOverlay.setMap(null);
        }

        polygonOverlay = event.overlay;
        confirmBtn.disabled = false;
        deleteBtn.disabled = false;
      }
    });

    confirmBtn.addEventListener('click', () => {
      saveZone(storeId, getPolygonCoords(polygonOverlay), radius);
      confirmBtn.disabled = true;
      deleteBtn.disabled = true;
    });

    deleteBtn.addEventListener('click', () => {
      deleteZone(storeId).then((confirmed) => {
        if(confirmed) {
          window.close()

          // Uncoment if you want to delete the polygon and keep window open
          // if (polygonOverlay) {
          //   polygonOverlay.setMap(null);
          //   polygonOverlay = null;
          // }
          // confirmBtn.disabled = true;
          // deleteBtn.disabled = true;
          // drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
        }
      });
    });

    searchBar.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchAddress(searchBar.value);
      }
    });

    helpBtn.addEventListener('click', () => {
      Swal.fire({
        title: 'Help',
        html: `
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivery Radius Mapping Tool - User Guide</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 2rem;
    }
    h1, h2, h3 {
      margin-bottom: 1rem;
    }
    ol, ul {
      margin-left: 2rem;
      margin-bottom: 1rem;
    }
    li {
      margin-bottom: 0.5rem;
    }
  </style>
</head>
<body>
  <h1>Delivery Radius Mapping Tool - User Guide</h1>
  <p>This tutorial will guide you through using the Delivery Radius Mapping Tool, a web application that allows you to create and manage delivery zones for your store based on geographic coordinates.</p>
  <h2>Getting Started</h2>
  <ol>
    <li><strong>View the map</strong>: The mapping tool will display a map interface, centered around a default location. If you've previously created a delivery zone for your store, the zone will be displayed as a polygon on the map.</li>
    <li><strong>Navigate the map</strong>: You can navigate the map by clicking and dragging the map with your mouse, or by using the zoom controls on the bottom-right corner of the map to zoom in and out.</li>
  </ol>
  <h2>Creating or Editing a Delivery Zone</h2>
  <ol>
    <li><strong>Enable the drawing mode</strong>: Click the "Draw a polygon" button on the top-center of the map to enable the drawing mode.</li>
    <li><strong>Draw the polygon</strong>: Click on the map to add the first point of your delivery zone. Continue clicking on the map to add more points, creating a shape that outlines your desired delivery area. Close the polygon by clicking on the first point or by double-clicking the last point.</li>
    <li><strong>Review the polygon</strong>: Once the polygon is complete, the "Confirm" and "Delete" buttons will be enabled in the top-right corner of the map.</li>
    <li><strong>Adjust the polygon</strong>: If you need to adjust the shape of the polygon, click and drag any of the existing points. You can also add new points by clicking and dragging the midpoint of an existing line segment.</li>
    <li><strong>Save the delivery zone</strong>: Once you're satisfied with the shape of the delivery zone, click the "Confirm" button in the top-right corner of the map. A success message will appear, indicating the zone has been saved.</li>
    <li><strong>Delete the polygon:</strong> If you want to remove the polygon and start over, click the "Delete" button in the top-right corner of the map. This will delete the current polygon, allowing you to draw a new one.
    </ol>
     <h3>Using the Search Address Feature</h3>
      <p>To search for a specific address, follow these steps:</p>
      <ol>
        <li>Type the address or location you want to find into the search bar.</li>
        <li>Press Enter or click the search button to find the location on the map.</li>
      </ol>
    </body>
    </html>
    `,
        width: '800px',
        showCloseButton: true,
        confirmButtonText: 'Close',
      });
    });
  } catch (err) {
    console.error(err);
  }
}

function getPolygonCoords(polygon) {
  const coords = polygon.getPath().getArray().map(coord => [coord.lat(), coord.lng()]);
  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];
  if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
    coords.push(firstCoord);
  }
  return coords;
}

function searchAddress(address) {
  const geocoder = new google.maps.Geocoder();

  geocoder.geocode({ address }, (results, status) => {
    if (status === google.maps.GeocoderStatus.OK) {
      const result = results[0].geometry.location;
      map.setCenter(result);
      map.setZoom(15);
    } else {
      alert('Address not found. Please try again.');
    }
  });
}

async function fetchCoordinatesForPostcode(postcode, countryPrefix, map) {
  if (!postcode || !countryPrefix || !map) {
    return null;
  }

  try {
    const response = await fetch(`/api/postcodes/${postcode}?country_prefix=${countryPrefix}`);
    if (!response.ok) {
      throw new Error('Error fetching coordinates for postcode');
    }
    const data = await response.json();
    if(data){
      const coords = { lat: data.latitude, lng: data.longitude };
      map.setCenter(coords);
      map.setZoom(13);
    }

    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function initMap() {
  const queryParams = new URLSearchParams(window.location.search);
  const postcode = queryParams.get('postcode');
  const storeId = queryParams.get('store_id');
  const countryPrefix = queryParams.get('country_prefix');
  const radius = parseFloat(queryParams.get('radius'));

  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 51.505144949568376, lng: -0.12218747614935366 },
    zoom: 13,
  });

  fetchCoordinatesForPostcode(postcode, countryPrefix, map).then((data) => {
    const center = data
    drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        strokeColor: '#035afc',
        fillColor: '#5e96ff',
        strokeWeight: 2,
        fillOpacity: 0.25,
      },
    });

    drawingManager.setMap(map);
    new google.maps.Marker({
      position: map.getCenter(),
      map: map,
    });

    const {
      confirmPopup,
      confirmBtn,
      deleteBtn,
      searchBar,
      helpBtn
    } = createControlElements(radius);
    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(confirmPopup);

    setupEventListeners(confirmBtn, deleteBtn, storeId, helpBtn, searchBar, radius).then(() => {
      fetchZone(storeId, deleteBtn, radius, center).then((data) => {
        if (!data && radius > 0) {
          drawPolygon(generateCirclePolygon(
            center,
            radius * 1000,
            20
          ))
        }
      });
    });

  });
}

function generateCirclePolygon(center, radius, numPoints) {
  const lat = center.latitude * (Math.PI / 180);
  const lng = center.longitude * (Math.PI / 180);
  const d = radius / 6371000;
  const coordinates = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i * 360) / numPoints;
    const theta = angle * (Math.PI / 180);
    const lat2 = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(theta));
    const lng2 = lng + Math.atan2(Math.sin(theta) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(lat2));

    const point = [
      lat2 * (180 / Math.PI),
      lng2 * (180 / Math.PI),
    ];
    coordinates.push(point);
  }

  return coordinates;
}

async function deleteZone(storeId) {
  try {
    const isConfirmed = await Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this zone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
    });

    if (isConfirmed.value) {
      if(deleteFromDb){
        const response = await fetch(`/api/zones/${storeId}`, {
          method: 'DELETE',
        });

        if (response.status === 200) {
          callbackMessage = 'Zone deleted successfully';
        } else {
          callbackMessage = 'Something went wrong';
        }
      } else {
        callbackMessage = 'Zone deleted successfully';
      }

      return isConfirmed.value;
    }
  } catch (error) {
    console.error('Error in deleteZone:', error);
  }
}

function saveZone(storeId, coords, radius) {
  fetch(`/api/zones/${storeId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coordinates: coords, radius: radius }),
  })
    .then((response) => {
      if (response.status === 200) {
        callbackMessage = 'Zone updated successfully';
      } else if (response.status === 201) {
        callbackMessage = 'Zone created successfully';
      } else {
        callbackMessage = 'Something went wrong';
      }
      window.close()
    })
}

function loadGoogleMaps() {
  const apiKey = '<YOUR_MAPS_API_KEY_HERE>';
  const apiUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,places`;

  loadScript(apiUrl, initMap);
}

async function fetchZone(storeId, deleteBtn, radius, center) {
  radius = radius || null;
  try {
    const response = await fetch(`/api/zones/${storeId}`);
    if (response.status === 404) {
      console.log('Zone not found');
      return false;
    }

    const zone = await response.json();
    if (zone.coordinates) {
      deleteBtn.disabled = false;
      deleteFromDb = true;
      drawCoordinates = zone.coordinates;
      if (radius !== zone.radius && radius != null) {
          drawCoordinates = generateCirclePolygon(center, radius * 1000, 20)
      }
      return drawPolygon(drawCoordinates);
    } else {
      return false
    }
  } catch (error) {
    console.log(error);
  }
}

function drawPolygon(coordinates) {
  if (polygonOverlay) {
    polygonOverlay.setMap(null);
  }

  polygonOverlay = new google.maps.Polygon({
    paths: coordinates.map(coord => ({ lat: coord[0], lng: coord[1] })),
    editable: true,
    draggable: true,
    fillColor: '#5e96ff',
    fillOpacity: 0.20,
    strokeColor: '#035afc',
    strokeOpacity: 1,
  });

  polygonOverlay.setMap(map);

  const bounds = new google.maps.LatLngBounds();
  coordinates.forEach(coord => bounds.extend(new google.maps.LatLng(coord[0], coord[1])));
  map.fitBounds(bounds);

  return true;
}

window.addEventListener('load', loadGoogleMaps);

window.onbeforeunload = function () {
  const mainWindowOrigin = 'http://stor.localhost';
  window.opener.postMessage(callbackMessage, mainWindowOrigin);
};
