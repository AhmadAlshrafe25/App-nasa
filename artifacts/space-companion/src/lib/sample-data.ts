import type { FamilyMessage, MissionContext, WellbeingSnapshot } from './types';

/** All content below is fictional demonstration data. */
export const SAMPLE_MESSAGES: FamilyMessage[] = [
  { id: 'm1', transcript: "Hi love. The porch light is still on, like every night. The kids drew you a rocket on the fridge. Sleep when you can. We're all right here, and we're counting the days with you.", sender: 'Ines Okafor', relationship: 'Partner', durationSeconds: 14, recordedOn: '2025-03-14', title: 'The porch light is still on', tags: ['comfort', 'sleep'], audioSrc: 'tone:1' },
  { id: 'm2', transcript: "Dad! Dad! I lost my first tooth today! It fell out in my apple. Mom says the tooth fairy knows how to find you in space. Can you keep it a secret from the stars?", sender: 'Tobi Okafor', relationship: 'Son, 9', durationSeconds: 9, recordedOn: '2025-03-12', title: 'I lost my first molar!', tags: ['celebration', 'humor'], audioSrc: 'tone:2' },
  { id: 'm3', transcript: "Hello my darling. I'm in the kitchen with the radio on, humming the song I used to sing you. Close your eyes for a minute and hum it with me. Rest well, we love you.", sender: 'Marguerite Lindqvist', relationship: 'Mother', durationSeconds: 17, recordedOn: '2025-03-10', title: 'A lullaby from the kitchen', tags: ['sleep', 'comfort'], audioSrc: 'tone:3' },
  { id: 'm4', transcript: "Bro, you won't believe it. The dog ate the remote again, third one this year. I told him you'd be disappointed. Anyway, hurry home, he misses you.", sender: 'Ade Okafor', relationship: 'Brother', durationSeconds: 11, recordedOn: '2025-03-08', title: 'The dog ate the remote again', tags: ['humor'], audioSrc: 'tone:4' },
  { id: 'm5', transcript: "Happy anniversary, from the ground to the sky. I saved you a slice of cake and I'm looking at the same moon you are. Thank you for everything you're doing. I love you.", sender: 'Ines Okafor', relationship: 'Partner', durationSeconds: 12, recordedOn: '2025-03-05', title: 'Anniversary, from 400 km below', tags: ['celebration', 'comfort'], audioSrc: 'tone:5' },
  { id: 'm6', transcript: "Goodnight, moon-mama. I waved at the moon today in case you saw me. I'm sleeping with the star blanket. Come home soon, okay? Bye!", sender: 'Sunniva Okafor', relationship: 'Daughter, 6', durationSeconds: 7, recordedOn: '2025-03-03', title: 'Goodnight, moon-mama', tags: ['sleep', 'humor'], audioSrc: 'tone:6' },
  { id: 'm7', transcript: "Hello son. The garden made it through winter. The tomatoes are coming back and your mother says they're yours when you land. We're proud of you. Take care up there.", sender: 'Rasmus Lindqvist', relationship: 'Father', durationSeconds: 15, recordedOn: '2025-02-27', title: 'The garden survived winter', tags: ['comfort'], audioSrc: 'tone:7' },
];

export const SAMPLE_SNAPSHOT: WellbeingSnapshot = { sleepHours: 5.4, stress: 6, mood: 3 };

export const SAMPLE_MISSION: MissionContext = {
  missionName: 'Aurora-7',
  missionDay: 117,
  totalDays: 186,
  daysSinceLastMessage: 2,
};
