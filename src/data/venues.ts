import type { Fixed } from "../lib/venues.ts";

/**
 * Venue coordinates, filled once by `npm run geocode` and committed. A venue
 * does not move, so this is read for free forever and nothing is bought on a
 * page rebuild. `null` means looked up and not found — kept so the next run
 * does not pay to ask again.
 */
export const VENUES: Record<string, Fixed | null> = {
  "12 x 12": { lat: 13.7366358, lng: 100.5855019 },
  "4seas nimman": { lat: 18.7958868, lng: 98.96626549999999 },
  "amber bar bkk": { lat: 13.7232709, lng: 100.5610811 },
  "ambient bar bkk": { lat: 13.7510182, lng: 100.5040975 },
  "arcadia": { lat: 13.7118346, lng: 100.5938277 },
  "armania phuket": { lat: 7.8939004, lng: 98.2963714 },
  "attika studio café workshop": { lat: 18.7880017, lng: 98.9996304 },
  "avve": { lat: 13.7144532, lng: 100.5940104 },
  "bangkok island": { lat: 13.6981768, lng: 100.5484694 },
  "bangkok thailand": null,
  "bar temp": { lat: 13.7396753, lng: 100.5148243 },
  "begrüntes haus": { lat: 13.7160471, lng: 100.5911826 },
  "benchakitti park สวนเบญจก ต": { lat: 13.7292327, lng: 100.558726 },
  "café del mar phuket": { lat: 7.9620862, lng: 98.284317 },
  "chiang mai": null,
  "culture cafe": { lat: 13.7665679, lng: 100.5007105 },
  "deep green": { lat: 18.7859318, lng: 98.98176819999999 },
  "downtown garden": { lat: 18.7904556, lng: 98.99428379999999 },
  "dual": { lat: 13.7251706, lng: 100.5305394 },
  "elsewhere": { lat: 13.7237161, lng: 100.5299411 },
  "flamenco bangkok": { lat: 13.7312091, lng: 100.569039 },
  "hemingway": { lat: 13.7429081, lng: 100.5564524 },
  "hemingway soi11": { lat: 13.7405871, lng: 100.5562308 },
  "horn": { lat: 13.7282597, lng: 100.5329488 },
  "ikea swedish restaurant café sukhumvit": { lat: 13.7315836, lng: 100.5664967 },
  "jungle freedomland": { lat: 18.7183271, lng: 98.8865979 },
  "lounge by warm up cafe": { lat: 18.7952494, lng: 98.9655087 },
  "octave rooftop lounge bar": { lat: 13.7235023, lng: 100.5805426 },
  "otaqlab bangkok": { lat: 13.788519, lng: 100.5479649 },
  "public house sukhumvit 31": { lat: 13.7379547, lng: 100.5669017 },
  "red cnx": { lat: 18.7975063, lng: 98.9760898 },
  "robin hood": { lat: 13.731696, lng: 100.5682577 },
  "salsa kitchen ruamchok": { lat: 18.8266113, lng: 99.0071347 },
  "santi social space": { lat: 13.6835229, lng: 100.6061097 },
  "saphan hin park": { lat: 7.8654194, lng: 98.39813319999999 },
  "shine on social bar restaurant": { lat: 18.7974403, lng: 98.97586749999999 },
  "siwilai radical club": { lat: 13.7283716, lng: 100.5810882 },
  "speaker box live house": { lat: 13.7419838, lng: 100.5856022 },
  "spice garden": { lat: 18.789605, lng: 98.9925238 },
  "subwerk club": { lat: 13.7272115, lng: 100.5250456 },
  "tba baccarat": null,
  "tba bloq bangkok": null,
  "the hideaway cafe restaurant": { lat: 18.7609004, lng: 98.9764388 },
  "tibet gate": { lat: 13.7330809, lng: 100.5670939 },
};
