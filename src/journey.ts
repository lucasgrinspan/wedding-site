import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css'; // Global styles
import './journey.css'; // Page specific styles

// Import marker icons
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet's default icon path issues with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});

import coralReefImg from '../images/journey/coral-reef.JPG';
import highSchoolPromImg from '../images/journey/high-school-prom.JPG';
import universityOfFloridaImg from '../images/journey/university-of-florida.jpeg';
import firstApartmentImg from '../images/journey/first-apartment.JPG';
import newYorkImg from '../images/journey/new-york.jpeg';
import worldCupImg from '../images/journey/world-cup.jpg';
import chickenKeyImg from '../images/journey/chicken-key.jpeg';
import deeringEstateImg from '../images/journey/deering-estate.jpg';

// --- Types ---
interface JourneyLocation {
  id: string;
  title: string;
  date: string;
  lat: number;
  lng: number;
  photoUrl: string;
  caption: string;
  zoom?: number;
}

// --- Placeholder Data ---
const journeyData: JourneyLocation[] = [
  {
    id: 'coral-reef',
    title: 'Coral Reef High School',
    date: 'May 27, 2016',
    lat: 25.6306,
    lng: -80.3557,
    photoUrl: coralReefImg,
    caption: 'She asked Sarah to borrow a math textbook. Sarah, with infinite foresight, referred her to me.',
    zoom: 16
  },
  {
    id: 'coldstone',
    title: 'Coldstone Creamery',
    date: 'TBD',
    lat: 25.5767,
    lng: -80.3394,
    photoUrl: 'https://via.placeholder.com/400x300?text=Coldstone+Creamery',
    caption: 'Our first date. We ate ice cream in the car and ran out the battery. Thanks for the jumpstart, Rob.',
    zoom: 16
  },
  {
    id: 'high-school-prom',
    title: 'High School Prom',
    date: 'May 19, 2017',
    lat: 25.7853,
    lng: -80.1739,
    photoUrl: highSchoolPromImg,
    caption: 'She looked beautiful.',
    zoom: 15
  },
  {
    id: 'university-of-florida',
    title: 'University of Florida',
    date: 'August 18, 2017',
    lat: 29.6462,
    lng: -82.3487,
    photoUrl: universityOfFloridaImg,
    caption: 'We made it to UF! We were now spending every day together.',
    zoom: 14
  },
  {
    id: 'first-apartment',
    title: 'First Apartment',
    date: 'August 21, 2021',
    lat: 29.6251,
    lng: -82.3577,
    photoUrl: firstApartmentImg,
    caption: 'We are officially on the same lease. Shoutout Brigid and Trinidad.',
    zoom: 15
  },
  {
    id: 'new-york',
    title: 'New York',
    date: 'August 26, 2022',
    lat: 40.7734,
    lng: -73.9523,
    photoUrl: newYorkImg,
    caption: 'We move to New York City together. She is the cream cheese to my bagel.',
    zoom: 12
  },
  {
    id: 'world-cup',
    title: 'World Cup',
    date: 'December 18, 2022',
    lat: 25.4208,
    lng: 51.4908,
    photoUrl: worldCupImg,
    caption: 'Argentina wins the World Cup!',
    zoom: 10
  },
  {
    id: 'chicken-key',
    title: 'Chicken Key',
    date: 'November 26, 2024',
    lat: 25.6215,
    lng: -80.2853,
    photoUrl: chickenKeyImg,
    caption: 'She said yes!',
    zoom: 16
  },
  {
    id: 'deering-estate',
    title: 'Deering Estate',
    date: 'February 20, 2027',
    lat: 25.6158,
    lng: -80.3070,
    photoUrl: deeringEstateImg,
    caption: 'Now it\'s your turn to join us on our journey.',
    zoom: 15
  }
];

// --- Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});

function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  // Initialize Map
  const map = L.map('map').setView([20, 0], 2); // Global view initially

  // Add Tile Layer (Thunderforest Mobile Atlas)
  // Note: Requires API Key. Get one at https://manage.thunderforest.com/
  const apiKey = import.meta.env.VITE_THUNDERFOREST_API_KEY || 'YOUR_API_KEY_HERE';

  L.tileLayer('https://{s}.tile.thunderforest.com/mobile-atlas/{z}/{x}/{y}.png?apikey={apikey}', {
    attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    apikey: apiKey,
    maxZoom: 22
  } as L.TileLayerOptions & { apikey: string }).addTo(map);

  // Markers Layer Group
  const markersLayer = L.layerGroup().addTo(map);
  const markers: Record<string, L.Marker> = {};

  // Render Markers
  journeyData.forEach((location) => {
    const marker = L.marker([location.lat, location.lng])
      .addTo(markersLayer)
      .bindPopup(`<b>${location.title}</b><br>${location.date}`);

    // Initial click handler on marker
    marker.on('click', () => {
      selectLocation(location.id);
    });

    markers[location.id] = marker;
  });

  // Render Timeline
  renderTimeline(journeyData);

  // Fit bounds to show all markers
  if (journeyData.length > 0) {
    const group = L.featureGroup(Object.values(markers));
    map.fitBounds(group.getBounds().pad(0.2));
  }

  // Handle Close Button for Card
  const closeBtn = document.getElementById('close-card');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const card = document.getElementById('info-card');
      card?.classList.add('hidden');
      // Deselect timeline
      document.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('active'));
    });
  }

  // --- Functions ---

  function renderTimeline(locations: JourneyLocation[]) {
    const timelineList = document.getElementById('timeline-list');
    if (!timelineList) return;

    timelineList.innerHTML = ''; // Clear existing

    locations.forEach(location => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      li.dataset.id = location.id;
      li.innerHTML = `
        <strong>${location.title}</strong><br>
        <small>${location.date}</small>
      `;

      li.addEventListener('click', () => {
        selectLocation(location.id);
      });

      timelineList.appendChild(li);
    });
  }

  function selectLocation(id: string) {
    const location = journeyData.find(l => l.id === id);
    if (!location) return;

    // 1. Highlight Timeline Item
    document.querySelectorAll('.timeline-item').forEach(el => {
      el.classList.remove('active');
      if ((el as HTMLElement).dataset.id === id) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // 2. Move Map
    const zoomLevel = location.zoom || 13;
    map.flyTo([location.lat, location.lng], zoomLevel, {
      duration: 1.5
    });

    // 3. Open Popup (Optional, maybe we just use the card)
    const marker = markers[id];
    if (marker) {
      marker.openPopup();
    }

    // 4. Show Info Card
    showInfoCard(location);
  }

  function showInfoCard(location: JourneyLocation) {
    const card = document.getElementById('info-card');
    const title = document.getElementById('card-title');
    const date = document.getElementById('card-date');
    const caption = document.getElementById('card-caption');
    const img = document.getElementById('card-image') as HTMLImageElement;

    if (card && title && date && caption && img) {
      title.textContent = location.title;
      date.textContent = location.date;
      caption.textContent = location.caption;
      img.src = location.photoUrl;

      card.classList.remove('hidden');
    }
  }
}
