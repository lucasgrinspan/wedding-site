export type Locale = 'en' | 'es';

/**
 * Detects whether the current document is rendered in Spanish.
 */
export function getCurrentLocale(): Locale {
  if (typeof document !== 'undefined' && document.documentElement.lang === 'es') {
    return 'es';
  }
  if (typeof window !== 'undefined' && /^\/es(\/|$)/.test(window.location.pathname)) {
    return 'es';
  }
  return 'en';
}

/**
 * Static HTML & UI translations for Spanish.
 * Replace the "[ES] ..." placeholders below with your final Spanish copy.
 */
export const esStrings: Record<string, string> = {
  // Page Titles
  'meta.homeTitle': 'Casamiento de Lucas & Lianne',
  'meta.detailsTitle': 'Detalles - Lucas & Lianne',
  'meta.journeyTitle': 'Nuestra Historia - Lucas & Lianne',
  'meta.rsvpTitle': 'Confirmar Asistencia - Casamiento de Lucas & Lianne',
  'meta.thanksTitle': '¡Gracias! - Casamiento de Lucas & Lianne',

  // Navigation
  'nav.home': 'Inicio',
  'nav.details': 'Detalles',
  'nav.journey': 'Nuestra Historia',

  // Home / Hero
  'hero.gettingMarried': '¡Nos casamos!',
  'hero.dateLocation': '20 DE FEBRERO DE 2027 \u2022 MIAMI, FL',
  'hero.countdownPlaceholder': '¡FALTAN --- DÍAS!',
  'hero.detailsBtn': 'Detalles',

  // Details Section (Home & Details Page)
  'details.when.title': 'Cuándo',
  'details.when.date': '20 de febrero de 2027',
  'details.when.time': 'A las cinco de la tarde',
  'details.where.title': 'Dónde',
  'details.where.venue': 'Deering Estate',
  'details.where.address': '16701 SW 72nd Ave, Miami, FL 33157',
  'details.travel.title': 'Viaje y Estadía',
  'details.travel.main': 'Alojamiento',
  'details.travel.sub': 'Recomendamos reservar tu estadía en las suites cercanas a Deering Estate.',
  'details.rsvp.title': 'RSVP',
  'details.rsvp.main': 'Confirmar Asistencia',
  'details.rsvp.sub': 'Por favor confirmá tu asistencia antes del 1 de diciembre de 2026. Los links privados de confirmación se envían a cada invitado.',
  'details.closingHeadline': 'Más fotos muy pronto',

  // Good to Know Section (Home)
  'gtk.subtitle': 'Más Detalles',
  'gtk.title': 'Para Tener en Cuenta',
  'gtk.dress.title': 'Vestimenta',
  'gtk.dress.main': 'Formal (Traje &amp; Corbata)',
  'gtk.dress.sub': 'Traje con corbata, y vestidos largos o midi formales.',
  'gtk.palette.title': 'Paleta de Colores',
  'gtk.palette.main': 'Verde Oscuro &amp; Tonos Tierra',
  'gtk.palette.sub': 'Nuestra paleta de colores combina verdes oscuros y marrones cálidos (por si te dan ganas de combinar).',
  'gtk.palette.aria': 'Paleta de colores del casamiento: verdes oscuros y marrones tierra',
  'gtk.venue.title': 'El Lugar',
  'gtk.venue.main': 'Ceremonia sobre el Césped',
  'gtk.venue.sub': 'La ceremonia será al aire libre sobre el césped y la recepción tendrá lugar en un patio de piedra.',
  'gtk.guests.title': 'Invitados',
  'gtk.guests.main': 'Celebración Solo para Adultos',
  'gtk.guests.sub': 'Aunque adoramos a los más chicos, nuestro casamiento será una noche exclusiva para adultos.',

  // Closing / Footer
  'closing.headline': '¡No vemos la hora de celebrar con vos!',
  'closing.signature': 'Con amor, Lianne & Lucas <a href="/es/journey.html" class="signature-mango">🥭</a>',

  // RSVP Page
  'rsvp.subtitle': 'Confirmación',
  'rsvp.title': 'Confirmá tu Asistencia',
  'rsvp.deadline': 'Por favor avisanos si podés acompañarnos antes del 1 de diciembre de 2026.',
  'rsvp.firstNameLabel': 'Nombre',
  'rsvp.firstNamePlaceholder': 'Ej. Lucas',
  'rsvp.lastNameLabel': 'Apellido',
  'rsvp.lastNamePlaceholder': 'Ej. Grinspan',
  'rsvp.notFoundError': 'No pudimos encontrar tu invitación. Por favor revisá cómo está escrito o probá buscando a otro integrante de tu grupo.',
  'rsvp.findBtn': 'Buscar Invitación',
  'rsvp.confirmSubtitle': 'Confirmar Asistencia',
  'rsvp.forYourParty': 'Para tu Grupo',
  'rsvp.emailLabel': 'Correo Electrónico (Opcional)',
  'rsvp.emailPlaceholder': 'Solo si querés recibir una confirmación por mail',
  'rsvp.emailHelp': 'Solo si querés recibir una confirmación por mail',
  'rsvp.dietaryLabel': 'Restricciones Alimentarias o Temas Musicales',
  'rsvp.dietaryPlaceholder': 'Vegetariano, sin TACC / sin gluten, temas que no pueden faltar, etc.',
  'rsvp.backBtn': 'Volver',
  'rsvp.submitBtn': 'Enviar Confirmación',

  // Thank You Page
  'thanks.title': '¡Muchas Gracias!',
  'thanks.received': 'Recibimos tu confirmación de asistencia.',
  'thanks.celebrate': '¡No vemos la hora de celebrar con vos!',
  'thanks.backHome': 'Volver al Inicio',

  // Journey Page
  'journey.timeline': 'Línea de Tiempo',
  'journey.photoAlt': 'Foto del lugar',
};

/**
 * Dynamic client-side strings used in main.ts, rsvp.ts, and journey.ts
 */
export const dynamicCopy = {
  en: {
    countdown: {
      daysToGo: (days: number) => `${days} DAYS TO GO!`,
      today: 'TODAY IS THE BIG DAY!',
      married: 'JUST MARRIED!',
    },
    rsvp: {
      missingFields: 'Please fill out both first and last name fields.',
      notFound: "We couldn't find your invitation. Please check the spelling or try searching for another member of your party.",
      serverError: 'Something went wrong on our end. Please try again in a few moments.',
      networkError: 'Connection error. Please check your internet connection and try again.',
      acceptLabel: 'Joyfully Accept',
      declineLabel: 'Regretfully Decline',
    },
    journey: {
      'coral-reef': {
        title: 'Coral Reef High School',
        date: 'May 27, 2016',
        caption: 'She asked Sarah to borrow a math textbook. Sarah, with infinite foresight, referred her to me.',
      },
      'coldstone': {
        title: 'Coldstone Creamery',
        date: 'January 9, 2017',
        caption: 'Our first date. We ate ice cream in the car and ran out the battery. Thanks for the jumpstart, Rob.',
      },
      'high-school-prom': {
        title: 'High School Prom',
        date: 'May 19, 2017',
        caption: 'She looked beautiful.',
      },
      'university-of-florida': {
        title: 'University of Florida',
        date: 'August 18, 2017',
        caption: 'We made it to UF! We were now spending every day together.',
      },
      'college-graduation': {
        title: 'College Graduation',
        date: 'May 9, 2021',
        caption: 'Ready for the real world, though that felt pretty real',
      },
      'first-apartment': {
        title: 'First Apartment',
        date: 'August 21, 2021',
        caption: 'We are officially on the same lease. Shoutout Brigid and Trinidad.',
      },
      'new-york': {
        title: 'New York',
        date: 'August 26, 2022',
        caption: 'We move to New York City together. She is the cream cheese to my bagel.',
      },
      'chicken-key': {
        title: 'Chicken Key',
        date: 'November 26, 2024',
        caption: 'She said yes!',
      },
      'deering-estate': {
        title: 'Deering Estate',
        date: 'February 20, 2027',
        caption: "Now it's your turn to join us on our journey.",
      },
    },
  },
  es: {
    countdown: {
      daysToGo: (days: number) => (days === 1 ? '¡FALTA 1 DÍA!' : `¡FALTAN ${days} DÍAS!`),
      today: '¡HOY ES EL GRAN DÍA!',
      married: '¡RECIÉN CASADOS!',
    },
    rsvp: {
      missingFields: 'Por favor completá tanto el nombre como el apellido.',
      notFound: 'No pudimos encontrar tu invitación. Por favor revisá cómo está escrito o probá buscando a otro integrante de tu grupo.',
      serverError: 'Hubo un problema de nuestro lado. Por favor intentá de nuevo en unos instantes.',
      networkError: 'Error de conexión. Por favor revisá tu conexión a internet e intentá de nuevo.',
      acceptLabel: 'Confirmo con alegría',
      declineLabel: 'No voy a poder asistir',
    },
    journey: {
      'coral-reef': {
        title: 'Coral Reef High School',
        date: '27 de mayo de 2016',
        caption: 'Le pidió prestado un libro de matemática a Sarah. Sarah, una visionaria total, la mandó a hablar conmigo.',
      },
      'coldstone': {
        title: 'Coldstone Creamery',
        date: '9 de enero de 2017',
        caption: 'Nuestra primera cita. Tomamos helado en el auto y nos quedamos sin batería. Gracias por hacernos puente, Rob.',
      },
      'high-school-prom': {
        title: 'Baile de Graduación',
        date: '19 de mayo de 2017',
        caption: 'Estaba hermosa.',
      },
      'university-of-florida': {
        title: 'University of Florida',
        date: '18 de agosto de 2017',
        caption: '¡Llegamos a UF! A partir de ahí empezamos a pasar todos los días juntos.',
      },
      'college-graduation': {
        title: 'Graduación de la Facultad',
        date: '9 de mayo de 2021',
        caption: 'Listos para el mundo real, aunque eso ya se sentía bastante real.',
      },
      'first-apartment': {
        title: 'Nuestro Primer Departamento',
        date: '21 de agosto de 2021',
        caption: 'Oficialmente en el mismo contrato de alquiler. Un agradecimiento especial a Brigid y Trinidad.',
      },
      'new-york': {
        title: 'New York',
        date: '26 de agosto de 2022',
        caption: 'Nos mudamos juntos a New York. Ella es el queso crema de mi bagel.',
      },
      'chicken-key': {
        title: 'Chicken Key',
        date: '26 de noviembre de 2024',
        caption: '¡Dijo que sí!',
      },
      'deering-estate': {
        title: 'Deering Estate',
        date: '20 de febrero de 2027',
        caption: 'Ahora te toca a vos sumarte a nuestra historia.',
      },
    },
  },
} as const;
