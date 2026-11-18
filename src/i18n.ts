export type Locale = 'en' | 'es';

/**
 * Detects whether the current document is rendered in Spanish.
 */
export function getCurrentLocale(): Locale {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const paramLocale = (params.get('locale') || params.get('lang') || '').trim().toLowerCase();
    if (paramLocale === 'es') return 'es';
    if (paramLocale === 'en') return 'en';
  }
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
 */
export const esStrings: Record<string, string> = {
  // Page Titles
  'meta.homeTitle': 'Casamiento de Lianne & Lucas',
  'meta.detailsTitle': 'Detalles - Lianne & Lucas',
  'meta.journeyTitle': 'Nuestra Historia - Lianne & Lucas',
  'meta.rsvpTitle': 'Confirmar Asistencia - Casamiento de Lianne & Lucas',
  'meta.thanksTitle': '¡Gracias! - Casamiento de Lianne & Lucas',

  // Navigation
  'nav.home': 'Inicio',
  'nav.details': 'Detalles',
  'nav.journey': 'Nuestra Historia',
  'nav.rsvp': 'RSVP',

  // Home / Hero
  'hero.gettingMarried': '¡Nos casamos!',
  'hero.dateLocation': '20 DE FEBRERO DE 2027 \u2022 MIAMI, FL',
  'hero.countdownPlaceholder': '¡FALTAN --- DÍAS!',
  'hero.rsvpBtn': 'Confirmar Asistencia',
  'hero.rsvpDeadline': 'Confirmar antes del 31 de diciembre',
  'hero.detailsBtn': 'Detalles',

  // Celebration & Details Section (Home & Details Page)
  'celebration.subtitle': 'El Gran Día',
  'celebration.title': 'La Celebración',
  'celebration.date': 'Sábado 20 de febrero de 2027',
  'details.when.title': 'Cuándo',
  'details.when.date': '20 de febrero de 2027',
  'details.when.time': 'Ceremonia a las 5:30 PM',
  'details.where.title': 'Dónde',
  'details.where.venue': 'Deering Estate',
  'details.where.address': '16701 SW 72nd Ave, Miami, FL 33157',
  'details.where.directions': 'Cómo llegar',
  'details.travel.title': 'Viaje y Estadía',
  'details.travel.main': 'Alojamiento',
  'details.travel.sub': 'Recomendamos hospedarse por la zona de Coral Gables, Coconut Grove o Pinecrest.',
  'details.rsvp.title': 'RSVP',
  'details.rsvp.main': 'Confirmar Asistencia',
  'details.rsvp.sub': 'Por favor confirmá tu asistencia antes del 31 de diciembre de 2026.',
  'details.rsvp.link': 'Responder Online \u2192',
  'details.closingHeadline': '¡Nos vemos en Miami!',

  // Timeline Section (Home & Details Page)
  'timeline.subtitle': 'La Noche',
  'timeline.title': 'Cronograma',
  'timeline.ceremony.time': '5:30 PM',
  'timeline.ceremony.title': 'Ceremonia',
  'timeline.cocktail.time': '6:00 PM',
  'timeline.cocktail.title': 'Cóctel',
  'timeline.dinner.time': '7:15 PM',
  'timeline.dinner.title': 'Cena',

  // Good to Know Section (Home & Details Page)
  'gtk.subtitle': 'Más Detalles',
  'gtk.title': 'Para Tener en Cuenta',
  'gtk.dress.title': 'Vestimenta',
  'gtk.dress.main': 'Formal (Traje &amp; Corbata)',
  'gtk.dress.summary': 'Formal',
  'gtk.dress.sub': 'Traje (quizás con corbata), y vestidos largos o midi formales. A la noche puede refrescar, así que traé algo para abrigarte.',
  'gtk.palette.title': 'Paleta de Colores',
  'gtk.palette.main': 'Verde Oscuro &amp; Tonos Tierra',
  'gtk.palette.summarySr': 'Verdes oscuros y marrones cálidos',
  'gtk.palette.sub': 'Nuestra paleta de colores combina verdes oscuros y marrones cálidos (por si te dan ganas de combinar).',
  'gtk.palette.aria': 'Paleta de colores del casamiento: verdes oscuros y marrones tierra',
  'gtk.venue.title': 'El Lugar',
  'gtk.venue.main': 'Ceremonia sobre el Césped',
  'gtk.venue.summary': 'Césped y Patio',
  'gtk.venue.sub': 'La ceremonia es al aire libre sobre el césped (quizás mejor evitar los tacos aguja), y el cóctel es en un patio de piedra.',
  'gtk.guests.title': 'Invitados',
  'gtk.guests.main': 'Celebración Solo para Adultos',
  'gtk.guests.summary': 'Solo Adultos',
  'gtk.guests.sub': 'Es una noche solo para adultos, así que los más chicos se quedan en casa.',
  'gtk.registry.title': 'Regalos',
  'gtk.registry.main': 'Sin Lista de Regalos',
  'gtk.registry.summary': 'Donación a Audubon',
  'gtk.registry.sub': 'No tenemos lista de regalos. Si querés hacernos un regalo, nos encantaría una donación a la Audubon Society.',
  'gtk.registry.link': 'Donar a Audubon \u2192',

  // Closing / Footer
  'closing.headline': '¡Nos vemos en Miami!',
  'closing.rsvpBtn': 'Confirmar Asistencia',
  'closing.signature': 'Con amor, Lianne & Lucas <a href="/es/journey.html" class="signature-mango">🥭</a>',

  // RSVP Page
  'rsvp.subtitle': 'Confirmación',
  'rsvp.title': 'Confirmá tu Asistencia',
  'rsvp.deadline': 'Por favor avisanos si podés acompañarnos antes del 31 de diciembre de 2026.',
  'rsvp.firstNameLabel': 'Nombre',
  'rsvp.firstNamePlaceholder': 'Larry',
  'rsvp.lastNameLabel': 'Apellido',
  'rsvp.lastNamePlaceholder': 'Penny',
  'rsvp.notFoundError': 'No pudimos encontrar tu invitación. Por favor revisá cómo está escrito o probá buscando a otro integrante de tu grupo.',
  'rsvp.findBtn': 'Buscar Invitación',
  'rsvp.confirmSubtitle': 'Confirmar Asistencia',
  'rsvp.forYourParty': '¿Quiénes vienen?',
  'rsvp.updateAnytimeNote': '¿Todavía no sabés quiénes vienen o necesitás cambiar algo más adelante? Volvé y envialo de nuevo.',
  'rsvp.emailLabel': 'Correo Electrónico (Opcional)',
  'rsvp.emailHelp': 'Solo si querés recibir una confirmación por mail',
  'rsvp.dietaryLabel': 'Restricciones Alimentarias o Temas Musicales',
  'rsvp.dietaryPlaceholder': 'Vegetariano, sin TACC / sin gluten, temas que no pueden faltar, etc.',
  'rsvp.backBtn': 'Volver',
  'rsvp.submitBtn': 'Enviar Confirmación',
  'rsvp.personalNoteLabel': 'Una Nota Personal de Lianne y Lucas',

  // Thank You Page
  'thanks.title': '¡Gracias!',
  'thanks.received': 'Recibimos tu confirmación.',
  'thanks.celebrate': '¡No vemos la hora de celebrar con vos!',
  'thanks.personalNoteLabel': 'Una Nota Personal de Lianne y Lucas',
  'thanks.updateNote': '¿Necesitás hacer algún cambio más adelante? Podés volver a la <a href="/es/rsvp.html">página de confirmación</a> hasta el 31 de diciembre de 2026 para actualizar la respuesta de tu grupo.',
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
      missingAttendance: 'Please select an attendance option for each member of your party.',
      invalidEmail: 'Please enter a complete email address (e.g. name@example.com), or leave it blank.',
      notFound: "We couldn't find your invitation. Please check the spelling or try searching for another member of your party.",
      serverError: 'Something went wrong on our end. Please try again in a few moments.',
      networkError: 'Connection error. Please check your internet connection and try again.',
      acceptLabel: 'Joyfully Accept',
      declineLabel: 'Regretfully Decline',
    },
    thanks: {
      declinedCelebrate: "We'll miss celebrating with you, and thank you for letting us know!",
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
      missingAttendance: 'Por favor seleccioná una opción de asistencia para cada integrante de tu grupo.',
      invalidEmail: 'Por favor ingresá un correo electrónico completo (ej. nombre@ejemplo.com), o dejalo en blanco.',
      notFound: 'No pudimos encontrar tu invitación. Por favor revisá cómo está escrito o probá buscando a otro integrante de tu grupo.',
      serverError: 'Hubo un problema de nuestro lado. Por favor intentá de nuevo en unos instantes.',
      networkError: 'Error de conexión. Por favor revisá tu conexión a internet e intentá de nuevo.',
      acceptLabel: 'Confirmo con alegría',
      declineLabel: 'No voy a poder asistir',
    },
    thanks: {
      declinedCelebrate: '¡Te vamos a extrañar mucho, y muchas gracias por avisarnos!',
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
