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
import coldstoneImg from '../images/journey/coldstone.JPG';
import highSchoolPromImg from '../images/journey/high-school-prom.JPG';
import universityOfFloridaImg from '../images/journey/university-of-florida.jpg';
import graduationImg from '../images/journey/graduation.jpg';
import firstApartmentImg from '../images/journey/first-apartment.jpeg';
import newYorkImg from '../images/journey/new-york.jpeg';
import chickenKeyImg from '../images/journey/chicken-key.jpeg';
import deeringEstateImg from '../images/journey/deering-estate.jpg';

import { dynamicCopy, getCurrentLocale } from './i18n';

// --- Types ---
type JourneyId = keyof typeof dynamicCopy.en.journey;

interface JourneyLocation {
  id: JourneyId;
  title: string;
  date: string;
  lat: number;
  lng: number;
  photoUrl: string;
  caption: string;
  zoom?: number;
}

const baseLocations: Array<Omit<JourneyLocation, 'title' | 'date' | 'caption'>> = [
  {
    id: 'coral-reef',
    lat: 25.6306,
    lng: -80.3557,
    photoUrl: coralReefImg,
    zoom: 16
  },
  {
    id: 'coldstone',
    lat: 25.5767,
    lng: -80.3394,
    photoUrl: coldstoneImg,
    zoom: 16
  },
  {
    id: 'high-school-prom',
    lat: 25.7853,
    lng: -80.1739,
    photoUrl: highSchoolPromImg,
    zoom: 15
  },
  {
    id: 'university-of-florida',
    lat: 29.6462,
    lng: -82.3487,
    photoUrl: universityOfFloridaImg,
    zoom: 14
  },
  {
    id: 'college-graduation',
    lat: 29.64915,
    lng: -82.34412,
    photoUrl: graduationImg,
    zoom: 16
  },
  {
    id: 'first-apartment',
    lat: 29.6251,
    lng: -82.3577,
    photoUrl: firstApartmentImg,
    zoom: 15
  },
  {
    id: 'new-york',
    lat: 40.7734,
    lng: -73.9523,
    photoUrl: newYorkImg,
    zoom: 12
  },
  {
    id: 'chicken-key',
    lat: 25.6215,
    lng: -80.2853,
    photoUrl: chickenKeyImg,
    zoom: 16
  },
  {
    id: 'deering-estate',
    lat: 25.6158,
    lng: -80.3070,
    photoUrl: deeringEstateImg,
    zoom: 15
  }
];

function getJourneyData(): JourneyLocation[] {
  const locale = getCurrentLocale();
  const copy = dynamicCopy[locale].journey;
  return baseLocations.map((loc) => ({
    ...loc,
    ...copy[loc.id],
  }));
}

// --- Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});

function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  const journeyData = getJourneyData();

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
